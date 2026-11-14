import type { privacyCopy as en } from '../en/privacy.ts'
import { TRIAL_DAYS } from '../../site.ts'

export const privacyCopy: typeof en = {
  privacy: {
    label: '本地优先',
    title: '你的笔记存放在你的设备上。',
    lede: '打开镜像后，就是普通的 Markdown 文件。',
    facts: {
      label: '笔记存放在哪里，需要什么',
      rows: [
        ['存放在你的设备上', '无需账户', '离线可用'],
        ['导出为纯 Markdown', 'Mac 上的版本历史'],
        ['源码公开，FSL-1.1-MIT', '每日本地备份'],
      ],
    },
    body: 'Devot 把笔记保存在“资源库”文件夹里的 SQLite 数据库中，书写、搜索、备份和导出都不需要账户或网络。选择一个镜像文件夹后，Devot 还会把每篇笔记写成 Markdown 文件放在那里，供 Git、聚焦搜索和其他编辑器读取，而且从不读回这些文件。',
    network: {
      summary: 'Devot 会通过网络发送什么？',
      items: [
        {
          term: '检查更新',
          text: '正式版在启动 30 秒后向 GitHub 请求更新信息，之后每天一次（测试版每小时一次）。',
        },
        {
          term: '链接标题',
          text: '只有在你选中链接、或选择需要标题的粘贴格式时，才会获取网页标题或 GitHub 摘要。',
        },
        {
          term: '嵌入内容与网络图片',
          text: 'YouTube 和 Vimeo 嵌入只在你要求时加载。通过 https 链接的图片按原样加载。',
        },
        {
          term: '崩溃报告',
          text: '默认关闭，需在“设置 > 通用”中打开。报告只含错误代码和代码位置，从不包含笔记内容。',
        },
        {
          term: '同步',
          text: '笔记端到端加密，经由你的 iCloud 或你部署的中继传输。两者都读不到内容。',
        },
        {
          term: 'AI',
          text: '只有在你使用 AI 时，笔记内容才会发送给你添加了密钥的服务商。',
        },
      ],
      footnote:
        '除非你导出、镜像、通过你的 iCloud 或中继同步、发送给你的 AI 服务商，或允许 MCP 客户端读取，否则笔记内容哪儿也不会去。',
    },
    link: '了解 Devot 如何存储笔记',
  },
  closing: {
    label: '下载 Devot',
    title: ['在 Mac 和 iPhone 上书写。', '留住你写下的一切。'],
    lead: `${TRIAL_DAYS} 天免费试用，包含全部功能。源码以 FSL-1.1-MIT 公开。`,
    installNote: '更新会在应用内推送，安装一次就够了。',
    links: {
      label: '更多入口',
      source: 'GitHub 上的源码',
      releases: '所有版本',
    },
  },
  footer: {
    label: '页脚',
    tagline: '适用于 Mac 和 iPhone 的本地优先 Markdown 笔记。',
    copyright: (year: number) => `© ${year} devot.online`,
    licence: '源码以 FSL-1.1-MIT 公开。',
    backToTop: '回到顶部',
    groups: {
      product: {
        title: '产品',
        links: {
          features: '功能',
          cards: '更多功能',
          localFirst: '本地优先',
          pricing: '价格',
          download: '下载',
        },
      },
      resources: {
        title: '资源',
        links: {
          docs: '文档（英文）',
          blog: '博客（英文）',
          plugins: '插件（英文）',
          releases: '版本发布',
          install: '安装步骤',
          architecture: 'Devot 的工作原理',
          development: '开发指南',
          mcp: '通过 MCP 使用 AI 工具',
        },
      },
      community: {
        title: '社区',
        links: {
          support: '支持',
          github: 'GitHub 上的源码',
          issues: '问题反馈',
          pulls: '拉取请求',
          contributing: '参与贡献',
          milestones: '里程碑',
        },
      },
      legal: {
        title: '法律',
        links: {
          licence: 'FSL-1.1-MIT 许可',
          terms: '销售条款（英文）',
          refunds: '退款政策（英文）',
          privacy: '隐私政策（英文）',
          mcpPrivacy: 'AI 工具隐私（英文）',
          security: '安全政策',
          report: '报告漏洞',
        },
      },
    },
  },
}
