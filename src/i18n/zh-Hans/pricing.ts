import type { pricingCopy as en } from '../en/pricing.ts'
import { IPHONE_PRICE, LICENCE_PRICE, REFUND_DAYS, TRIAL_DAYS } from '../../site.ts'

const days = `${TRIAL_DAYS} 天`

export const pricingCopy: typeof en = {
  pricing: {
    label: '价格',
    title: [`${days}，全部功能。`, '然后一次买断。'],
    lead: '打开 Devot 即开始试用，书写、同步和 AI 全都包含。试用结束后，一次购买永久解锁全部功能，Mac 和 iPhone 通用。',
    trial: {
      name: '试用',
      price: days,
      terms: '免费试用，包含全部功能。第一次打开 Devot 时开始计算。',
      items: [
        '书写、笔记本、标签和搜索',
        '端到端加密同步，经由你的 iCloud 或你部署的中继',
        '使用你自己服务商密钥的 AI',
        '版本历史、备份和 Markdown 导出',
      ],
    },
    licence: {
      name: '许可证',
      price: LICENCE_PRICE,
      terms: '一次付款，含税。没有订阅，无需续费。',
      items: [
        '试用中的一切，永久可用',
        'Devot 今后的每个版本',
        '最多同时用于三台设备，Mac 或 iPhone 均可',
        '无需账户',
      ],
      buy: '购买许可证',
      refund: `${REFUND_DAYS} 天内可退款，无需理由。`,
    },
    iphone: {
      title: '在 iPhone 上',
      body: `Devot iPhone 版已在 App Store 上架，试用期相同。在那里购买 Devot Pro 一次 ${IPHONE_PRICE} 即可解锁。Mac 许可证也能解锁 iPhone，在 iPhone 上购买也会附赠一个 Mac 许可证密钥。`,
    },
    after: {
      title: '试用结束后',
      body: '没有许可证时，Devot 会变为只读：你仍然可以阅读、搜索、拷贝和导出每一篇笔记，但不能新建或编辑，同步和 AI 也会停止。什么都不会被删除，导出始终可用。添加许可证后，一切重新解锁。',
    },
    selfBuild: {
      title: '不想付费？',
      body: '源码是公开的。你可以自己从源码构建 Devot，所有功能无需许可证即可使用，遵循 FSL-1.1-MIT，只要不出售它，也不把它作为竞争产品提供。许可证支付的是签名应用、自动更新以及 Devot 的持续开发。',
      link: '如何构建 Devot',
    },
    delivery:
      '付款后，密钥会显示在页面上，同时发送到你的邮箱，邮件里的链接可以直接在 Devot 中打开它。付款由 Stripe 通过 Stripe Managed Payments 处理，这项服务由 Stripe 担任记录商户（merchant of record）。',
    links: {
      label: '关于购买',
      terms: '销售条款（英文）',
      refunds: '退款政策（英文）',
      lostKey: '许可证密钥丢了？',
    },
  },
}
