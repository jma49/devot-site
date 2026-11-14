import type { heroCopy as en } from '../en/hero.ts'

const titleLines = ['你的笔记留在你的 Mac', '和 iPhone 上，']
const titleAccent = '握在你自己手中。'

export const heroCopy: typeof en = {
  hero: {
    title: titleLines.join('') + titleAccent,
    titleLines,
    titleAccent,
    lead: '适用于 Mac 和 iPhone 的本地优先 Markdown 笔记。离线书写，无需账户，再通过你自己的 iCloud 同步。',
  },
  install: {
    note: ['已由 Apple 签名并', { unbroken: '完成公证' }, '，像其他 Mac 应用一样直接打开。'],
    link: '安装步骤',
  },
}
