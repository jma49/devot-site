# Footage for the film, recorded at Devot v1.1.5

Everything here is the real app running: no frame is composed, graded, scaled or dressed.
`manifest.json` has one record per video, with its measured duration, size, source and beats.

| Part | Files | What it is |
| --- | --- | --- |
| `mac/` | 22 | Whole-window masters of 18 shots: `hero`, `card-1`, `n1-write-mode` and `n7-gradient` in light and dark, the rest in light. |
| `iphone/` | 10, and 10 stills in `iphone/stills/` | `p1` to `p8`; `p1` and `p2` in light and dark. Each record names its still. |
| `sync/` | 12 (6 takes of 2 files) | `x1-mac-to-iphone` and `x2-iphone-to-mac`, three takes each. |

## Where it comes from

- **Mac:** a demo build of Devot v1.1.5 (commit `e2a39a3`): `tauri dev` with its own identifier and data folder, holding the demo library only.
- **iPhone:** the iOS Simulator (iPhone 17, iOS 27.2) running a debug build of the same commit. It is not the App Store release and not a device. No Mac pointer is in these files.
- **Sync:** the demo build and the simulator, paired through Devot's relay running on this Mac (`http://localhost:8787`). It is not iCloud. The delay between the two devices is what the relay gave and is not cut.

## Gradient

Settings > Appearance > Gradient is 0 on a new library, which draws Tide as one solid colour.

- `MEDIA_GRADIENT=100` for every Mac master except `n7-gradient`, for `p1` to `p7`, and for the Mac in the sync takes.
- Default (0) for `n7-gradient` and for `p8-settings`: both show the slider being dragged up from Solid.
  `p8` was not in the instruction's exception; at 100 its drag would have moved nothing.
- The simulator in the sync takes was a new install, also set to 100.

## Shots that differ from the brief

No shot was skipped outright. These were cut down to what the app did:

- **`n2-gallery-board`: no card is dragged to another column.** It shows Gallery, then Board, and the pointer resting on a card.
  In the demo build a drag begun with the real pointer reached the page as `dragstart` and `dragend` only, with no `dragover` or `drop` between, so the card never moved (the same scene passes in the browser dry run).
  Not checked by hand in the release app.
- **`p3-edit`: no line is typed.** It switches to Edit, back to Preview, and ticks a task.
  **`p7-new-note`: no title or text is typed.** It taps New Note and the editor opens with the keyboard up.
  In both, the first key made the editor scroll the typed line under the navigation bar, so the text could not be read (seen in the first recordings of each, on the iOS 27.2 simulator).
- **`p8-settings`:** Appearance only, as planned (no Sync page). The Gradient drag ends at 90, not 100. The Settings root shows `Devot 0.0.0 · Not needed`: the debug build's version and licence line.
- **`p2-read`:** the third scroll moves little, because the note has reached its end.
- **Sync takes are two files, not one frame.** Xcode 27.2 has no Simulator app, and Device Hub quit at launch on this Mac, so there was no simulator window to stand beside the Mac's.
  Each take is `<id>-take<n>-mac.mp4` (the Mac window, 2560×1600, 30 fps, with the pointer) and `<id>-take<n>-iphone.mp4` (the simulator's screen, 1206×2622, 60 fps), cut to the same stretch of the wall clock and the same length; played from the same moment they show the same seconds. Each record names the other file as `pair` and carries the same beats.
- **The takes share one note**, so each begins with the earlier takes' changes in it. Order recorded: `x1` take 2, `x1` take 3, `x2` take 1, `x1` take 1, `x2` take 2, `x2` take 3.
  The Mac is in Edit with Write Mode on; the iPhone is in Preview.

## Other differences from the recording guide

- **Second screen.** The Mac has two screens; the masters and the Mac side of the sync takes were recorded on the external one (2× backing scale) with `MEDIA_SCREEN=1`. A window of 1280×800 points is 2560×1600 pixels, unscaled; narrower scenes are twice their own size (`write` 1520×1240, `card-2`, `card-3`, `card-6` 1800×1400, `card-5` 2560×1240).
- **Keyboard layout.** The recorder selects the ABC layout before it types; the Mac's input method would have rewritten the text.
- **Simulator runtime.** iOS 27.2 instead of the guide's iOS 26: it is the only runtime installed here.
- **iPhone recordings.** `simctl io recordVideo` writes a frame only when the screen changes and puts frames out of order after a still stretch, which moved cuts made by time by seconds. The shots are recorded as HEVC and cut by each frame's own presentation time, then encoded as H.264 at a constant 60 fps.
- **Pairing.** The simulator joined with the relay's address typed in Settings > Sync and a typed pairing code. Opening the pairing link (`devot://pair?...`) from outside the app was refused (`W_DEEP_LINK_REFUSED E_URL_PATH`), and the link typed into Join With a Code showed "Use This Relay" but joined nothing when it was confirmed.
  The new install's two welcome notes synced to the Mac and were moved to the Trash there before recording; the Mac's sidebar keeps an empty "Getting started" notebook and a Trash count of 2.
- **Still head and tail.** Each Mac master has about 0.8 s before its first step and after its last in which only the text caret blinks. Light and dark masters of a shot have the same frame count (`hero`: 549 frames, 18.30 s, identical beats).
- **`organise`** ends with a click on an empty line of the note to close the tag popover, which shows the editor's placeholder ("Type '/' for commands..."); left as recorded.
- **Node.** Recorded with Node 26.13 (the repository names 24.22.1); `pnpm test` passes.

## For the landing page

- **`find` clip.** The page's clip keeps the top left 672×448 of the window, and the scene's ending (the Note Info card with Backlinks) appears to the right of it. The clip was recorded with the present crop; record it again once the page has a new crop or ending. The whole-window master `mac/find-light.mp4` shows all of it.
- **Stale copy.** "Find and connect" still says "Linked to This Note"; v1.1.5 calls it Backlinks. The copy was not changed.
- **The pin was not moved.** The section below is copied as written from the recording handoff (`RECORDING.md`, section 6).

---

## 6. pin 的问题（需要告诉做落地页的 agent）

把 `devot.pin.json` 移到 `e2a39a3` 并跑 `pnpm tokens` 之后：

- `pnpm test` 有 3 个文件失败，都是因为 v1.1.5 的 token 变了，不是文案：
  - `tests/unit/hero.test.ts`：`unreadable tide backdrop`。`--backdrop` 的每个色标现在是 `color-mix(in srgb, <色> calc(var(--gradient-strength, 100) * 1%), <色>)`，`src/scripts/hero-backdrop.ts` 的解析读不了。
  - `tests/unit/og-image.test.ts`：同一个原因，`src/lib/og-image.ts` 的 `backdrop()` 只读出 1 个色标。
  - `tests/policy/colors.test.ts`：`--gradient-strength` 被读但没有定义（32 处，都在生成的 `tokens.css` 里）；`--color-line-float-bar` 在 Devot 里没有了，`src/components/SiteHeader.astro` 还在用。
- `pnpm facts` 的报错（原样）：

  ```
  E_FACT_SOURCE src/renderer/src/i18n/en.ts is missing
  E_FACT_UPDATES src-tauri/src/updates.rs means the page should say "undefined seconds after launch"
  E_FACT_UPDATES src-tauri/src/updates.rs means the page should say "then every undefined s"
  E_FACT_MCP README.md no longer says devot-mcp runs from a checkout
  E_FACT_ANCHOR https://github.com/jma49/devot#claude-and-other-mcp-clients-devot-mcp names no section of README.md
  ```

  第一条说明 facts 脚本自己也要跟着改：Devot 的文案目录从单个 `en.ts` 拆成了 `i18n/en/` 下的多个文件。

`pre-push` 钩子会跑 `pnpm test`，所以带着 pin 移动的分支推不上去，除非先把上面三处适配掉。这是落地页的活（渐变颜色和页眉描边都会变），不在录制范围里。建议：片段 PR 不动 pin，pin 的移动和这些适配放进落地页正式实现的那个 PR。把这一节原样抄进 `notes.md`。
