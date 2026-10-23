// Renders SF Symbols the way the app's native `symbol_png` command does (src-tauri/src/native/macos.rs):
// the symbol at twice the point size, one pixel to a point, black, as PNG. Reads "name pointSize weight"
// lines on stdin and answers each with one line of base64 (empty when the symbol does not exist).
import AppKit

func weight(_ name: String) -> NSFont.Weight {
  switch name {
  case "ultralight": return .ultraLight
  case "thin": return .thin
  case "light": return .light
  case "medium": return .medium
  case "semibold": return .semibold
  case "bold": return .bold
  case "heavy": return .heavy
  case "black": return .black
  default: return .regular
  }
}

func render(_ name: String, _ pointSize: Double, _ weightName: String) -> String {
  guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil) else { return "" }
  let configuration = NSImage.SymbolConfiguration(pointSize: pointSize * 2, weight: weight(weightName))
  guard let configured = image.withSymbolConfiguration(configuration),
    let tiff = configured.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let png = bitmap.representation(using: .png, properties: [:])
  else { return "" }
  return png.base64EncodedString()
}

while let line = readLine() {
  let parts = line.split(separator: " ").map(String.init)
  if parts.count < 3 { print(""); fflush(stdout); continue }
  print(render(parts[0], Double(parts[1]) ?? 13, parts[2]))
  fflush(stdout)
}
