import type { heroCopy as en } from '../en/hero.ts'

const titleLines = ['你的笔记留在你的 Mac', '和 iPhone 上，']
const titleAccent = '握在你自己手中。'

export const heroCopy: typeof en = {
  hero: {
    title: titleLines.join('') + titleAccent,
    titleLines,
    titleAccent,
    lead: '适用于 Mac 和 iPhone 的本地优先 Markdown 笔记，无需账户。端到端加密同步，不用订阅；按意思搜索，就在你的设备上；AI 的修改，由你逐处审阅。',
  },
  install: {
    note: ['已由 Apple 签名并', { unbroken: '完成公证' }, '，像其他 Mac 应用一样直接打开。'],
    link: '安装步骤',
  },
}
