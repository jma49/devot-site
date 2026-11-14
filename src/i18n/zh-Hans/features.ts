import type { featuresCopy as en } from '../en/features.ts'

const titleLines = ['写下来。', '理清楚。', '找得回。']

export const featuresCopy: typeof en = {
  features: {
    titleLines,
    label: titleLines.join(''),
    lead: '笔记应用必须做好的三件事，都在 Mac 上一个安静的窗口里。',
    listLabel: '功能',
    items: [
      {
        slot: 'write',
        name: '书写',
        title: '一边是 Markdown，一边是排好的页面。',
        body: [
          '输入纯 Markdown，实时预览跟着你的节奏同步滚动。代码有语法高亮，数学公式和 Mermaid 图表随写随渲染。专注模式会隐藏侧边栏和列表，只留下笔记。',
        ],
      },
      {
        slot: 'organise',
        name: '整理',
        title: '每篇笔记各归其位，进展一目了然。',
        body: [
          '笔记本可以层层嵌套，每个都有自己的图标，标签也可以设颜色。把笔记标为进行中、搁置、已完成或已放弃，或者不设状态：列表会显示每篇的状态，侧边栏也能按状态筛选。',
        ],
      },
      {
        slot: 'find',
        name: '查找与关联',
        title: '任何一篇笔记，几下按键就到。',
        body: [
          '搜索每一个词，再用 ',
          { code: 'book:' },
          '、',
          { code: 'tag:' },
          ' 或 ',
          { code: 'status:' },
          ' 缩小范围，或者用减号排除。输入 ',
          { code: '[[' },
          ' 把一篇笔记链接到另一篇，另一篇会在“反向链接”下列出它。',
        ],
      },
    ],
  },
}
