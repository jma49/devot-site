import type { chromeCopy as en } from '../en/chrome.ts'
import { TRIAL_DAYS } from '../../site.ts'

const trial = `${TRIAL_DAYS} 天免费试用`

export const chromeCopy: typeof en = {
  meta: {
    title: 'Devot：本地优先的 Markdown 笔记，适用于 Mac 和 iPhone',
    description: `源码公开的 macOS Markdown 笔记：实时预览、嵌套笔记本、标签和全文搜索。笔记留在你的 Mac 上，离线可用，无需账户。${trial}，之后一次买断。`,
    ogLocale: 'zh_CN',
    imageAlt:
      '柔和蓝色渐变上的 Devot 窗口：侧边栏里是笔记本、状态和标签，旁边是笔记列表和一篇打开的笔记。',
  },
  notFound: {
    title: 'Devot：找不到页面',
    description: 'devot.online 上没有这个地址的页面。',
    heading: '找不到页面',
    body: '链接可能已经过期，或者地址有拼写错误。',
    home: '前往首页',
  },
  chrome: {
    skipLink: '跳到正文',
    home: 'Devot 首页',
    navLabel: '主导航',
    menu: '菜单',
    pause: '暂停动画',
    language: { name: '简体中文' },
    nav: {
      write: '功能',
      cards: '更多功能',
      iphone: 'iPhone',
      localFirst: '本地优先',
      pricing: '价格',
      download: '下载',
      source: 'GitHub',
    },
    downloadNote: trial,
  },
}
