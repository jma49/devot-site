// Drives the real Devot app for `pnpm media:device`: posts mouse and keyboard events as a person
// would, and shows a soft wallpaper window behind Devot so Glass has the same desktop in every clip.
// Reads one command a line on stdin and answers "ok" or "error <reason>" for each:
//   move <x> <y>        the pointer to global points (drags while the button is down)
//   down | up           the left button at the pointer
//   key <code> [mods]   a key by virtual key code, mods a comma list of cmd, shift, alt, ctrl
//   text <string>       types the string, one key per character
//   backdrop <light|dark|off>
//   trusted             "ok" when this process may post events (Accessibility)
//   screen              "ok <width> <height> <scale>" of the main screen, in points
import AppKit
import ApplicationServices

let source = CGEventSource(stateID: .hidSystemState)
var buttonDown = false

func pointer() -> CGPoint { CGEvent(source: nil)?.location ?? .zero }

// Flags set explicitly: a mouse event would otherwise take them from the source's state, and a
// leftover Command turns a click into one that adds a cursor.
func post(_ type: CGEventType, at point: CGPoint) {
  let event = CGEvent(
    mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left)
  event?.flags = []
  event?.post(tap: .cghidEventTap)
}

func flags(_ list: String) -> CGEventFlags {
  var out: CGEventFlags = []
  for name in list.split(separator: ",") {
    switch name {
    case "cmd": out.insert(.maskCommand)
    case "shift": out.insert(.maskShift)
    case "alt": out.insert(.maskAlternate)
    case "ctrl": out.insert(.maskControl)
    default: break
    }
  }
  return out
}

func key(_ code: CGKeyCode, _ mods: CGEventFlags) {
  for down in [true, false] {
    let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down)
    event?.flags = mods
    event?.post(tap: .cghidEventTap)
    usleep(8_000)
  }
}

func type(_ text: String) {
  for scalar in text.unicodeScalars {
    if scalar == "\n" {
      key(36, [])
      continue
    }
    let units = Array(String(scalar).utf16)
    for down in [true, false] {
      let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: down)
      event?.flags = []
      event?.keyboardSetUnicodeString(stringLength: units.count, unicodeString: units)
      event?.post(tap: .cghidEventTap)
      usleep(6_000)
    }
  }
}

final class Backdrop {
  private var window: NSWindow?

  func show(dark: Bool) {
    let frame = NSScreen.main?.frame ?? .zero
    let window =
      self.window
      ?? NSWindow(contentRect: frame, styleMask: .borderless, backing: .buffered, defer: false)
    window.setFrame(frame, display: true)
    window.isReleasedWhenClosed = false
    window.hasShadow = false
    window.ignoresMouseEvents = true
    window.collectionBehavior = [.canJoinAllSpaces, .stationary]
    let view = NSView(frame: frame)
    view.wantsLayer = true
    let gradient = CAGradientLayer()
    gradient.frame = view.bounds
    gradient.startPoint = CGPoint(x: 0, y: 1)
    gradient.endPoint = CGPoint(x: 1, y: 0)
    gradient.colors = (dark
      ? [0x1b2440, 0x2c2350, 0x3d2440, 0x1d3340]
      : [0xc9dcf5, 0xd9d0f2, 0xf3d6dc, 0xd4ecea]).map { rgb in
        CGColor(
          red: CGFloat((rgb >> 16) & 0xff) / 255, green: CGFloat((rgb >> 8) & 0xff) / 255,
          blue: CGFloat(rgb & 0xff) / 255, alpha: 1)
      }
    view.layer?.addSublayer(gradient)
    window.contentView = view
    window.orderFrontRegardless()
    self.window = window
  }

  func hide() {
    window?.orderOut(nil)
  }
}

let backdrop = Backdrop()

func run(_ line: String) -> String {
  let parts = line.split(separator: " ", maxSplits: 1).map(String.init)
  let rest = parts.count > 1 ? parts[1] : ""
  let args = rest.split(separator: " ").map(String.init)
  switch parts.first ?? "" {
  case "trusted":
    return CGPreflightPostEventAccess() ? "ok" : "error untrusted"
  case "screen":
    let screen = DispatchQueue.main.sync { NSScreen.main }
    guard let screen else { return "error screen" }
    return "ok \(Int(screen.frame.width)) \(Int(screen.frame.height)) \(screen.backingScaleFactor)"
  case "move":
    guard args.count == 2, let x = Double(args[0]), let y = Double(args[1]) else {
      return "error args"
    }
    post(buttonDown ? .leftMouseDragged : .mouseMoved, at: CGPoint(x: x, y: y))
  case "down":
    buttonDown = true
    post(.leftMouseDown, at: pointer())
  case "up":
    buttonDown = false
    post(.leftMouseUp, at: pointer())
  case "key":
    guard let code = args.first.flatMap({ UInt16($0) }) else { return "error args" }
    key(code, flags(args.count > 1 ? args[1] : ""))
  case "text":
    type(rest.replacingOccurrences(of: "\\n", with: "\n"))
  case "backdrop":
    DispatchQueue.main.sync {
      if rest == "off" { backdrop.hide() } else { backdrop.show(dark: rest == "dark") }
    }
  default:
    return "error unknown"
  }
  return "ok"
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
Thread.detachNewThread {
  while let line = readLine() {
    print(run(line))
    fflush(stdout)
  }
  exit(0)
}
app.run()
