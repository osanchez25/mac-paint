// Paint's "Remove background" helper.
// Reads a picture on stdin and writes the subject mask on stdout as raw bytes:
// width (UInt32 LE), height (UInt32 LE), then one byte per pixel, row by row:
// 255 = subject (keep), 0 = background (remove), in between = soft edge. Uses the Mac's own
// subject detection (Vision), the same one behind Preview's "Remove Background".
//
// Exit codes: 0 ok, 2 no subject found, 1 any other failure (message on stderr).
import CoreImage
import CoreVideo
import Foundation
import Vision

func fail(_ message: String, code: Int32 = 1) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(code)
}

let input = FileHandle.standardInput.readDataToEndOfFile()
guard let image = CIImage(data: input) else { fail("the picture could not be read") }

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: image)
do {
  try handler.perform([request])
} catch {
  fail("subject detection failed: \(error.localizedDescription)")
}

guard let result = request.results?.first, !result.allInstances.isEmpty else {
  fail("no subject found", code: 2)
}

let maskBuffer: CVPixelBuffer
do {
  maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
} catch {
  fail("could not make the mask: \(error.localizedDescription)")
}

// The mask is one Float32 per pixel (0…1), at the picture's size.
CVPixelBufferLockBaseAddress(maskBuffer, .readOnly)
defer { CVPixelBufferUnlockBaseAddress(maskBuffer, .readOnly) }
let width = CVPixelBufferGetWidth(maskBuffer)
let height = CVPixelBufferGetHeight(maskBuffer)
let rowBytes = CVPixelBufferGetBytesPerRow(maskBuffer)
guard CVPixelBufferGetPixelFormatType(maskBuffer) == kCVPixelFormatType_OneComponent32Float,
  let base = CVPixelBufferGetBaseAddress(maskBuffer)
else {
  fail("unexpected mask format")
}

var out = Data(capacity: 8 + width * height)
withUnsafeBytes(of: UInt32(width).littleEndian) { out.append(contentsOf: $0) }
withUnsafeBytes(of: UInt32(height).littleEndian) { out.append(contentsOf: $0) }
var row = [UInt8](repeating: 0, count: width)
for y in 0..<height {
  let src = (base + y * rowBytes).assumingMemoryBound(to: Float32.self)
  for x in 0..<width {
    row[x] = UInt8(max(0, min(255, (src[x] * 255).rounded())))
  }
  out.append(contentsOf: row)
}
FileHandle.standardOutput.write(out)
