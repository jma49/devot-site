import type { cardsCopy as en } from '../en/cards.ts'

export const cardsCopy: typeof en = {
  cards: {
    label: '小细节，触手可及',
    lead: '每天都会用到的工具，一个按键或一次点按就能打开，其余时候不占地方。',
    items: {
      'card-1': {
        label: '主题',
        title: '四种渐变，浅色或深色。',
        body: [
          '用 Dawn、Tide、Sage 或 Ember 给窗口着色。四种渐变主题都有浅色和深色，也可以跟随你的 Mac。',
        ],
      },
      'card-2': {
        label: '专注模式',
        title: '只有笔记，别无其他。',
        body: ['一个快捷键就能隐藏侧边栏和笔记列表，屏幕上只留下你正在写的笔记。'],
        keys: { glyphs: '⇧⌘D', spoken: '快捷键：Shift Command D' },
      },
      'card-3': {
        label: '表格',
        title: '表格始终整整齐齐。',
        body: [
          '按 Tab 在单元格间移动，用快捷键添加、移动和对齐行与列，Markdown 表格越写越长也依然工整。',
        ],
        keys: { glyphs: '⇥', spoken: '下一个单元格：Tab' },
      },
      'card-4': {
        label: '命令面板',
        title: '每条命令，几下按键就到。',
        body: [
          '输入几个字母，就能找到任何命令、笔记本、标签或笔记，大多数快捷键也能改成你习惯的按键。',
        ],
        keys: { glyphs: '⌘K', spoken: '快捷键：Command K' },
      },
      'card-5': {
        label: '修订历史',
        title: '回到更早的版本。',
        body: [
          '你停下输入一分钟，Devot 就保存一个版本。一天内的版本全部保留，之后一周内每小时留一个，再往后每天留一个。',
        ],
        keys: { glyphs: '⌥⌘Y', spoken: '快捷键：Option Command Y' },
      },
      'card-6': {
        label: '模板',
        title: '新笔记，一开始就填好。',
        body: [
          '从模板新建笔记，自动设好笔记本、标签和状态，并填入 ',
          { code: '{{date}}' },
          ' 和 ',
          { code: '{{title}}' },
          ' 这样的占位符。',
        ],
        keys: { glyphs: '⌘T', spoken: '快捷键：Command T' },
      },
    },
  },
}
