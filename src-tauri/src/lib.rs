use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, RunEvent};

/// Files Finder asked us to open before the page was ready to receive them.
#[derive(Default)]
struct PendingFiles(Mutex<Vec<String>>);

#[tauri::command]
fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| format!("could not read {path}: {e}"))
}

/// The bytes come as the raw request body; the target path in the `path` header (URI-encoded).
#[tauri::command]
fn write_file(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("write_file expects raw bytes".into());
    };
    let encoded = request
        .headers()
        .get("path")
        .ok_or("write_file needs a path header")?
        .to_str()
        .map_err(|e| e.to_string())?;
    let path = percent_decode(encoded);
    std::fs::write(&path, bytes).map_err(|e| format!("could not save {path}: {e}"))
}

#[tauri::command]
fn take_pending_files(state: tauri::State<'_, PendingFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

/// "Remove background": sends the picture (raw request body) to the bundled
/// Swift helper, which returns the subject mask from the Mac's Vision framework.
#[tauri::command]
async fn remove_background(request: tauri::ipc::Request<'_>) -> Result<tauri::ipc::Response, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("remove_background expects raw picture bytes".into());
    };
    let input = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || run_remove_bg(&input))
        .await
        .map_err(|e| format!("remove background stopped: {e}"))?
        .map(tauri::ipc::Response::new)
}

fn run_remove_bg(input: &[u8]) -> Result<Vec<u8>, String> {
    // Tauri puts bundled helpers next to the app's executable (also in `tauri dev`).
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let helper = exe.with_file_name("remove-bg");
    let mut child = Command::new(&helper)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start {}: {e}", helper.display()))?;
    let mut stdin = child.stdin.take().ok_or("no stdin for the helper")?;
    let data = input.to_vec();
    // Write on another thread so a full stdout pipe can't deadlock us.
    let writer = std::thread::spawn(move || stdin.write_all(&data));
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    writer
        .join()
        .map_err(|_| "the helper input thread panicked".to_string())?
        .map_err(|e| format!("could not send the picture to the helper: {e}"))?;
    match out.status.code() {
        Some(0) => Ok(out.stdout),
        Some(2) => Err("NO_SUBJECT".into()),
        _ => Err(format!(
            "remove background failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        )),
    }
}

#[tauri::command]
fn print_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A small menu bar: every Paint command lives in the window's own File/Edit/View
/// menus, so the Mac menu only has the app items (and leaves Cmd shortcuts to the page).
fn app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let about = AboutMetadata {
        name: Some("Paint".into()),
        ..Default::default()
    };
    let app_sub = Submenu::with_items(
        app,
        "Paint",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Paint"), Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            // Our own Quit, so the page can ask to save first.
            &MenuItem::with_id(app, "quit", "Quit Paint", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;
    let window_sub = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::close_window(app, None)?,
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_sub, &window_sub])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(PendingFiles::default())
        .menu(app_menu)
        .on_menu_event(|app, event| {
            if event.id() == "quit" {
                let _ = app.emit("quit-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![read_file, write_file, take_pending_files, print_window, remove_background])
        .build(tauri::generate_context!())
        .expect("error while building Paint");

    app.run(|handle, event| {
        // Finder "Open With Paint" / "Edit in Paint" / dropping on the Dock icon.
        #[cfg(target_os = "macos")]
        if let RunEvent::Opened { urls } = &event {
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            if paths.is_empty() {
                return;
            }
            handle.state::<PendingFiles>().0.lock().unwrap().extend(paths);
            let _ = handle.emit("open-files", ());
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }
        let _ = (handle, event);
    });
}
