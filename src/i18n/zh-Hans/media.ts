import type { mediaCopy as en } from '../en/media.ts'

// The recordings show the English interface, so the note names they show stay in English.
export const mediaCopy: typeof en = {
  media: {
    iphoneNotes: 'iPhone 上的 Devot：“笔记”标签页，置顶笔记在最近笔记上方，底部是标签栏。',
    iphoneReading:
      'iPhone 上的 Devot：从“笔记”标签页打开 Spring launch plan，向下滚过它的目标、时间线和任务。',
    iphoneRead:
      'iPhone 上的 Devot：打开的 Spring launch plan，目标和时间线上方是它的笔记本、状态和标签。',
    hero: 'Devot 窗口：打开一篇笔记，在分栏的编辑器和预览中输入一项任务，把状态改为已完成，再搜索 launch 缩小笔记范围。',
    write: '在 Markdown 编辑器里输入一句含行内公式的话，旁边的预览同时渲染出公式。',
    organise:
      '从页眉整理一篇零散笔记：把它移到 Projects 下的 Spring launch 笔记本，状态从已放弃改为进行中，并加上 planning 标签。',
    find: '输入两个方括号，把一篇笔记链接到 Spring launch plan；再搜索 launch tag:planning 打开这份计划，它的笔记信息在反向链接下列出了那篇笔记。',
    'card-1':
      '设置窗口浮在主窗口上方，主题从 Tide 切换到 Dawn、Sage，再回到 Tide，两个窗口都随之换上相应的渐变。',
    'card-2': '专注模式隐藏笔记列表，只留下笔记，然后再把列表显示回来。',
    'card-3': '按 Tab 在单元格间移动时，Markdown 表格新增一行，各列随之对齐。',
    'card-4':
      '命令面板列出状态命令及其快捷键，再缩小到 Set Status to Completed，把笔记设为已完成。',
    'card-5': '修订历史把最早的版本和当前笔记对比，恢复它，然后撤销这次恢复。',
    'card-6': '用 Daily standup 模板新建一篇笔记，占位符里填好了日期和时间。',
  },
}
