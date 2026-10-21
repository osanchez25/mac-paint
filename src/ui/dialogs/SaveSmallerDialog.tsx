import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";

import { hasTransparency, QUALITY_CHOICES, SCALE_CHOICES, savings, scaledSize, type QualityId, type ScalePercent } from "../../core/compress";
import { formatBytes } from "../../core/image-math";
import { ctx2d } from "../../editor/document";
import { messageOf } from "../../editor/actions/file-actions";
import { useEditor, usePaint } from "../app-context";

/**
 * "Save a smaller copy": pick a quality and a size, see how big the file
 * will be, and save it as a JPEG next to the original. The open picture
 * stays as it is.
 */
export function SaveSmallerDialog() {
  const { editor, files } = usePaint();
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const original = useEditor((s) => s.file.bytes);
  const [quality, setQuality] = useState<QualityId>("medium");
  const [percent, setPercent] = useState<ScalePercent>(100);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const close = () => editor.set({ dialog: null });

  const transparent = useMemo(() => {
    const flat = editor.doc.flatten();
    return hasTransparency(ctx2d(flat).getImageData(0, 0, flat.width, flat.height).data);
  }, [editor]);

  // Encode for real (shortly after the last change) so the size shown is the true size.
  useEffect(() => {
    let live = true;
    setEstimate(null);
    const t = window.setTimeout(() => {
      files
        .encodeSmaller(quality, percent)
        .then((b) => live && setEstimate(b.byteLength))
        .catch((e) => live && setError(messageOf(e)));
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [files, quality, percent]);

  const save = async () => {
    setSaving(true);
    const ok = await files.saveSmaller(quality, percent);
    setSaving(false);
    if (ok) close();
  };

  const target = scaledSize(width, height, percent);
  const smaller = original !== null && estimate !== null ? savings(original, estimate) : null;

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface className="paint-dialog">
        <DialogBody>
          <DialogTitle>Save a smaller copy</DialogTitle>
          <DialogContent className="dialog-form">
            <h3>Quality</h3>
            <div className="segmented" role="radiogroup" aria-label="Quality">
              {QUALITY_CHOICES.map((q) => (
                <button key={q.id} className={quality === q.id ? "active" : ""} onClick={() => setQuality(q.id)} role="radio" aria-checked={quality === q.id}>
                  {q.label}
                </button>
              ))}
            </div>
            <h3>Picture size</h3>
            <div className="segmented" role="radiogroup" aria-label="Picture size">
              {SCALE_CHOICES.map((p) => (
                <button key={p} className={percent === p ? "active" : ""} onClick={() => setPercent(p)} role="radio" aria-checked={percent === p}>
                  {p === 100 ? "Same" : `${p}%`}
                </button>
              ))}
            </div>
            <p className="hint">{`${target.w} × ${target.h} px`}</p>
            <div className="size-compare">
              <div>
                <span className="hint">Now</span>
                <strong>{original !== null ? formatBytes(original) : "Not saved yet"}</strong>
              </div>
              <div>
                <span className="hint">Smaller copy (JPEG)</span>
                <strong>{estimate !== null ? formatBytes(estimate) : <Spinner size="extra-tiny" />}</strong>
                {smaller && <span className="good">{smaller}</span>}
              </div>
            </div>
            {transparent && <p className="hint">Transparent areas will be white: JPEG can't keep transparency.</p>}
            {error && <p className="dialog-error">{error}</p>}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={saving} onClick={() => void save()}>Save copy</Button>
            <Button onClick={close}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
