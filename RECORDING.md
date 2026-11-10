# Devot v1.1.5 素材录制：本机执行说明（第 2 版）

这份说明给在这台 Mac 上工作的 agent。它取代上一版《素材录制指引》，目标不变（落地页 10 个片段、宣传片的 Mac 整窗母带、iPhone 镜头、两台设备同框的同步镜头），但有三处决定变了，代码侧的准备也已经做完。

这个文件只是交接用，不要合并进 `main`。

## 1. 和上一版的三处不同

1. **iPhone 镜头改用 iOS 模拟器录。** 用户不想占用真机。模拟器里跑的是 Devot iPhone app 的 debug 构建，不是 App Store 正式版。上一版写了"不要用模拟器截图顶替"，这一条由用户改了；`manifest.json` 的 `source` 会如实写成 `iOS Simulator (...), debug build @ e2a39a3`，`notes.md` 里也要写明。
2. **同步镜头不走 iCloud，走本机中继。** 模拟器的 debug 构建没有 iCloud 权限。Devot 自带的中继可以用 Node 在本机跑（`http://localhost:8787`），Mac 演示构建和模拟器通过它配对。全程只有演示数据，不碰用户的真实笔记库和 Apple ID。代价：D 部分左边是演示构建而不是正式版 1.1.5；`p8` 不录同步页，只录外观。
3. **建议不要在片段 PR 里移动 pin。** 原因见第 6 节。录制用 `DEVOT_CHECKOUT` 指定 v1.1.5 的检出，不依赖 pin。

## 2. 已经做完、并且验证过的

都在分支 `media/v1.1.5-recording` 上（从 `main` 的 `179ab69` 开出）。`pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm format:check` 全过。

| 内容                                                                                                                       | 怎么验证的                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 设备 seed 的导入路径修正（v1.1.5 把 SQLite 适配器搬到了 `tests/support/sqlite-adapter`，旧路径会让每个片段在第一步就失败） | 在 v1.1.5 检出里实际跑通，生成了演示库                                            |
| `organise` 场景：加标签现在弹出 "Tag this note" 浮层，选完不会自己关                                                       | 见下                                                                              |
| `find` 场景：反向链接从预览底部搬到了 Note Info                                                                            | 见下                                                                              |
| 8 个新场景 `n1` 到 `n8`（`scripts/media/film-scenes.ts`）                                                                  | 见下                                                                              |
| 整窗母带开关 `MEDIA_FULL_WINDOW=1`、节拍（beats）记录、`pnpm media:film:pack`                                              | 单元测试；`pack` 用合成母带实际跑过，出的 mp4 是 2560×1600、30 fps、首尾各 0.8 秒 |
| 本机中继 `pnpm media:phone relay`                                                                                          | 实际启动过，`/v1` 有应答                                                          |

**"见下"的意思：** 全部 18 个镜头（10 个现有场景加 `n1` 到 `n8`）都在 Devot v1.1.5 的 UI 测试构建里，用 Chromium 按真实时间线跑通了，`check` 也过了；`hero`、`card-1`、`n1`、`n7` 的深色也跑过。这验证了选择器、步骤和时长，**没有**验证真机管线：桥接层（`bridge.ts`）的定位器是自己实现的，行为可能和 Playwright 有出入；真实指针的拖拽（`n2` 的看板拖卡片、`n7` 的滑块）也只在浏览器里试过。

## 3. 写了但完全没跑过的

iPhone 这一套只能在 Mac 上跑，云端没法验证，第一次跑大概率要调：

- `scripts/media/phone/cli.ts`（`pnpm media:phone`）：构建、seed、录制、同步镜头。命令照 Devot 自己的 `scripts/ci/iphone-ui-tests.sh` 写的。
- `scripts/media/phone/FilmShots.swift`：`p1` 到 `p8` 和 `x2` 各一个 XCUITest。元素名照 Devot 的 `DevotUITests` 和 `DevotScreens` 的字符串写的，没编译过。最没把握的是 `testP3Edit`（在网页视图里落光标、勾任务）和 `testP7NewNote`（标题栏是否是 `textFields["Title"]`）。
- seed 假设 iPhone app 的数据库叫 `devot.sqlite`，在容器的 `Library/` 下，和 Mac 一样。找不到会报 `E_PHONE_NO_DATA`。

## 4. 环境

- 仓库在 `~/Code/personal/devot` 和 `~/Code/personal/devot-site`。
- **不要在用户的 `devot` 工作目录里直接检出标签**，用 worktree：

  ```bash
  git -C ~/Code/personal/devot worktree add ../devot-v1.1.5 v1.1.5
  ```

  然后在 `~/Code/personal/devot-v1.1.5` 里 `pnpm install`。下文的 `$DEVOT` 指这个目录。

- `devot-site`：`git fetch origin && git switch media/v1.1.5-recording && pnpm install`。
- 其余同上一版：macOS 26+、Retina 默认缩放、带 `libx264` 和 `libsvtav1` 的 ffmpeg、Node 24、pnpm 12.10.1；终端要有辅助功能和屏幕录制权限；录制时开勿扰，不要碰电脑。
- iPhone 部分另需 Xcode、iOS 26 模拟器运行时（`xcodebuild -downloadPlatform iOS`）、`xcodegen`、Rust 的模拟器目标（`rust-toolchain.toml` 自带）。

## 5. 执行步骤

### 5.1 演示构建（一次）

在 `$DEVOT` 里写一个配置文件 `/tmp/devot-demo.json`（`devCsp` 是 v1.1.5 的原值，只在 `script-src` 里加了 `'unsafe-eval'`）：

```json
{
  "identifier": "io.github.jma49.devot.demo",
  "build": {
    "beforeDevCommand": "DEVOT_DIR=$DEVOT pnpm exec vite --config $SITE/scripts/media/device/devot/vite.config.ts --strictPort"
  },
  "app": {
    "security": {
      "devCsp": {
        "default-src": "'self'",
        "script-src": "'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' data: blob: devot: https:",
        "font-src": "'self'",
        "connect-src": "'self' ipc: http://ipc.localhost http://localhost:5173 ws://localhost:5173",
        "frame-src": "'self' https: devot-plugin:",
        "object-src": "'none'",
        "base-uri": "'none'",
        "form-action": "'none'"
      }
    }
  }
}
```

把 `$DEVOT`、`$SITE` 换成绝对路径，然后 `pnpm tauri dev --config /tmp/devot-demo.json`，窗口出现后退出。二进制在 `$DEVOT/src-tauri/target/debug/devot`，下文叫 `$BIN`。

### 5.2 B 部分：Mac 整窗母带（先做，优先级最高的 `hero` 在这里）

```bash
MEDIA_FULL_WINDOW=1 DEVOT_CHECKOUT=$DEVOT DEVOT_BINARY=$BIN pnpm media:device hero
```

先单跑 `hero` 看管线通不通，再不带参数跑全部（18 个镜头，按各自的配色，共 22 条）。母带在 `.cache/media/film/<id>-<scheme>.mkv`，旁边的 `.json` 记了脚本起点和节拍。然后：

```bash
DEVOT_CHECKOUT=$DEVOT pnpm media:film:pack
```

产出 `footage/mac/*.mp4` 和 `footage/manifest.json`。

要你判断的两件事：

- **Gradient 默认是 0。** v1.1.5 里渐变主题在新库上是纯色，要到 设置 > 外观 把 Gradient 拉起来才有渐变。默认设置下录出来的 Tide 是一整片淡蓝，旧素材是有渐变的。`MEDIA_GRADIENT=100` 可以让所有镜头从满渐变开始（`n7` 除外，它演示的就是拖滑块，应保持默认 0）。建议：`n7` 用默认，其余用 `MEDIA_GRADIENT=100` 录，并在 `notes.md` 写明。拿不准就两种都录，文件名加后缀。
- **每个镜头都要看成片。** 重点看 `n2`（拖卡片有没有真的拖起来）、`n7`（滑块）、`organise`（结尾在正文空行点了一下来关浮层，会露出 "Type '/' for commands..." 的占位文字，觉得碍眼就换个点击位置）。

### 5.3 A 部分：落地页 10 个片段

```bash
DEVOT_CHECKOUT=$DEVOT DEVOT_BINARY=$BIN pnpm media:device
```

```bash
pnpm media:encode
```

```bash
pnpm test
```

已知问题：**`find` 片段的结尾不在裁切范围里。** 片段只取窗口左上 672×448，而 Note Info 卡片出现在 x≈800 到 1120。整窗母带没问题，落地页片段需要重新设计结尾或裁切（例如把这个片段改成取窗口右侧，或换一个窄窗口）。这同时牵涉文案："Find and connect" 那段还写着 "Linked to This Note"，v1.1.5 里已经叫 Backlinks。文案不要改，记进 `notes.md`。

片段提交到 `media/v1.1.5-clips`（从 `media/v1.1.5-recording` 开），draft PR 标题 `chore: re-record product clips at Devot v1.1.5`，不带 AI 署名。

### 5.4 C 部分：iPhone（模拟器）

```bash
DEVOT_CHECKOUT=$DEVOT pnpm media:phone build
```

```bash
DEVOT_CHECKOUT=$DEVOT pnpm media:phone shot p1-notes
```

先单跑 `p1-notes`，通了再跑全部。每个镜头会：装 app、把演示库和 Tide 主题写进模拟器的数据目录、固定状态栏（9:41、满电）、用 `simctl io recordVideo` 录屏、跑对应的测试、按测试自己记的起止时间裁切。产出 `footage/iphone/<id>-<scheme>.mp4`（60 fps，原生分辨率，没有 Mac 指针）、`footage/iphone/stills/` 下的静帧，以及 manifest 里的节拍（带触点坐标，单位是点）。

测试失败时，`xcodebuild` 的输出会说哪个元素没找到。改 `scripts/media/phone/FilmShots.swift`，然后重新 `build`（它每次把这个文件拷进 Devot 的 `DevotUITests/Tests/`，构建完再删掉）。元素名去 `$DEVOT/src-tauri/apple/DevotUITests/Tests/` 和 `DevotScreens/Sources/DevotScreens/UI/` 里核对。

### 5.5 D 部分：同步镜头

1. 起中继，留着它跑：

   ```bash
   DEVOT_CHECKOUT=$DEVOT pnpm media:phone relay
   ```

   它会打印地址 `http://localhost:8787` 和密钥。

2. 准备两边。Mac：演示库已经在演示构建的数据目录里（跑过 5.2 的任意一个镜头就有了），再跑一次 5.1 的 `pnpm tauri dev --config ...` 把它开起来。iPhone：

   ```bash
   DEVOT_CHECKOUT=$DEVOT pnpm media:phone seed light empty
   ```

   带 `empty` 是重装一个不放演示库的 app，让笔记全部从 Mac 同步过去。如果两边各放一份演示库，同名笔记会各有两条。新装的 app 自带欢迎笔记，配对后它们可能也会同步到 Mac；碍眼的话配对前先在模拟器里删掉。

3. 配对。Mac 的 设置 > Sync：填中继地址和密钥，建 vault，点配对拿到配对码；模拟器的 Settings > Sync：填同一个中继，输入配对码。这一步没有脚本，用屏幕操作完成。等笔记同步到模拟器。
4. 两边都打开 "Weekly review, week 43"。Mac 上把光标点进正文。把两个窗口左右摆开，互不遮挡。
5. 录制，各 2 到 3 条：

   ```bash
   DEVOT_CHECKOUT=$DEVOT DEVOT_BINARY=$BIN pnpm media:phone sync x1-mac-to-iphone 1
   ```

   ```bash
   DEVOT_CHECKOUT=$DEVOT DEVOT_BINARY=$BIN pnpm media:phone sync x2-iphone-to-mac 1
   ```

   `x1` 在 Mac 上按 Command-Down 到文末、打一行字（`SYNC_LINE` 可改），然后继续录 `SYNC_WAIT` 秒（默认 12）。`x2` 用测试在 iPhone 上勾一个任务。整屏录制，不裁；两个窗口的像素矩形写在 manifest 的 `windows` 里。同步延迟是多少就是多少。

   如果中继同步比预期慢，把 `SYNC_WAIT` 调大，不要剪。如果配对走不通，把卡在哪一步写进 `notes.md`，D 部分跳过，不要造一个。

### 5.6 交付

同上一版第 9 节：`footage/` 推到分支 `footage/v1.1.5`（从 `origin/main` 开，只提交 `footage/`，不开 PR）。`manifest.json` 由上面的命令逐条写入，`notes.md` 你来写。交付前按上一版第 10 节自查，另加一条：**iPhone 镜头的 `source` 写的是模拟器**。

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

## 7. 优先级

时间不够时按这个顺序保：

1. `hero` 整窗浅深两条；`p1`、`p2` 浅深两套和静帧；D 部分的同步镜头。
2. A 部分的 10 个片段；`write`、`organise`、`find` 的整窗母带；`n1`、`n2`、`n7`。
3. 其余镜头。

D 部分排在第 1 档的最后，是因为它现在依赖一步没有脚本的配对，风险最高；先把确定能拿到的拿到。
