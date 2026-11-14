import type { iphoneCopy as en } from '../en/iphone.ts'

export const iphoneCopy: typeof en = {
  whatsNew: {
    label: 'Devot 1.1 新功能',
    title: ['Devot 1.1 新功能，', 'Mac 和 iPhone 都有。'],
    items: [
      {
        name: '书写模式',
        text: '笔记随写随渲染，只显示光标所在元素的 Markdown。',
      },
      {
        name: '画廊与看板',
        text: '把笔记本看作页面预览，或者按状态排成看板，每张卡片显示任务进度。',
      },
      {
        name: '保存的搜索',
        text: '把一次搜索留在侧边栏里。重命名标签之后它依然有效。',
      },
      {
        name: '通过 iCloud 同步',
        text: '笔记经由你自己的 iCloud 传输，离开设备前已用 Devot 的密钥加密。',
      },
      {
        name: '大纲与字数',
        text: '编辑器旁有大纲，角落里显示字数和字符数。',
      },
      {
        name: '更多图表',
        text: '除 Mermaid 之外，PlantUML 图表和 Markmap 思维导图也在你的 Mac 上渲染。',
      },
    ],
  },
  iphone: {
    label: 'Devot iPhone 版',
    title: ['从上次停下的地方', '继续写。'],
    lead: '同样的笔记、同样的编辑器，搭配 iPhone 应用该有的标签栏、搜索、面板和轻扫手势。离线书写，联网时自动同步。',
    facts: [
      {
        name: '经由你的 iCloud，由 Devot 加密',
        text: '每篇笔记在离开设备前就已加密，iCloud 存的是它读不懂的内容。你自己部署的中继也一样。',
      },
      {
        name: '无需配对码就能加入',
        text: '同一 Apple ID 下的设备通过 iCloud 钥匙串获得密钥。移除一台设备，新密钥就会把它挡在外面。',
      },
      {
        name: '买一次，两边都能用',
        text: 'Mac 许可证可以解锁 iPhone，在 iPhone 上购买也会附赠一个 Mac 许可证密钥。',
      },
    ],
    caption: 'iPhone 上的 Devot：笔记列表，以及一篇正在阅读的笔记。',
  },
}
