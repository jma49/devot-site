import type { edgeCopy as en } from '../en/edge.ts'

export const edgeCopy: typeof en = {
  edge: {
    label: 'Devot 的不同之处',
    lead: '一次买断，这四样全都包含：不用订阅，也不用盲目信任谁。',
    items: [
      {
        id: 'sync',
        name: '同步',
        title: '端到端加密同步，无需订阅。',
        body: '每篇笔记离开设备前都先用 AES-256-GCM 加密，再经由你自己的 iCloud 或你部署的中继传输。两者都读不到内容，一次买断的许可证永久包含同步。',
      },
      {
        id: 'meaning',
        name: '搜索',
        title: '按意思搜索，就在你的设备上。',
        body: '“意思相关”会找出换了说法、却讲同一件事的笔记。系统自带的语言模型在你的设备上读取笔记，支持七种语言，离线可用，没有笔记因此离开设备。',
      },
      {
        id: 'review',
        name: 'AI',
        title: 'AI 的修改，你逐处审阅。',
        body: '“用 AI 编辑”把建议显示为差异对比，只应用你勾选的修改。AI 工具通过 MCP 写入时，Devot 会标出它改了哪里，每处修改都可以保留或撤销。使用你自己服务商的密钥。',
      },
      {
        id: 'source',
        name: '源代码',
        title: '源代码公开，可读也可自行构建。',
        body: 'Devot 的每一行代码都以 FSL-1.1-MIT 公开。你可以查看笔记如何存储和加密，也可以自己构建这个应用。',
      },
    ],
  },
}
