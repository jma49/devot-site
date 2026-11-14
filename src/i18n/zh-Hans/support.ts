import { PRIVACY_EMAIL, REFUND_DAYS, TRIAL_DAYS } from '../../site.ts'
import type { LegalPage } from '../en/legal.ts'
import type { supportCopy as en } from '../en/support.ts'

const support: LegalPage = {
  title: 'Devot：支持',
  description:
    '获取 Devot Mac 版和 iPhone 版的帮助：恢复购买、在两端使用许可证密钥、退款和常见问题。',
  heading: '支持',
  updated: '更新于 2026 年 11 月 6 日',
  intro: '如何获得 Devot 的帮助，以及大家最常问的问题。',
  sections: [
    {
      title: '获取帮助',
      paragraphs: [
        [
          '遇到错误，或者任何人都能回答的问题，请',
          { text: '在 GitHub 上提交问题', link: 'issues' },
          '。不要在问题里贴出你的许可证密钥或笔记内容。',
        ],
        [
          '涉及隐私的事情，比如购买，请发邮件到 ',
          { text: PRIVACY_EMAIL, link: 'privacyEmail' },
          '。如果你在 Mac 上购买了许可证，也可以直接回复许可证邮件。',
        ],
      ],
    },
    {
      title: '在 iPhone 上恢复购买',
      paragraphs: [
        [
          'Devot Pro 属于购买它的 Apple 账户。在新 iPhone 上或重新安装后，请登录该 Apple 账户，打开 Devot 的“设置”，点按“许可证”下方的“恢复购买”。购买面板里也有“恢复购买”。',
        ],
        ['通过家人共享获得的购买项目不能解锁 Devot Pro；每个 Apple 账户需要单独购买。'],
      ],
    },
    {
      title: '在 iPhone 上使用 Mac 许可证密钥',
      paragraphs: [
        [
          '在 Mac 上购买的许可证也能解锁 iPhone 上的 Devot。在购买面板中点按“输入许可证密钥”，或者打开“设置 > 许可证”在那里添加。iPhone 会占用许可证三个设备名额中的一个。',
        ],
      ],
    },
    {
      title: '用 iPhone 购买获取 Mac 密钥',
      paragraphs: [
        [
          'Devot Pro 附赠一个 Mac 许可证密钥，不额外收费。在 iPhone 上打开“设置”，点按“获取 Mac 许可证密钥”，然后选择“拷贝密钥”或“共享”。在 Mac 上打开共享的链接，或者把密钥粘贴到“设置 > 许可证 > 添加许可证”。再次获取会显示同一个密钥。',
        ],
      ],
    },
    {
      title: '设备名额',
      paragraphs: [
        [
          '一个许可证密钥最多同时用于三台设备。要换到新设备，请在',
          { text: '管理设备', link: 'devices' },
          '中移除一台不再使用的设备，“设置 > 许可证”里也有这个入口。',
        ],
      ],
    },
    {
      title: '退款',
      paragraphs: [
        [
          '在 iPhone 上的购买由 Apple 处理退款。在 Devot 中打开“设置”并点按“申请退款”，或者前往',
          { text: 'Apple 的“报告问题”页面', link: 'appleRefund' },
          '申请。是否退款由 Apple 决定。退款会终止 Devot Pro，并吊销随附的 Mac 密钥。',
        ],
        [
          `在 Mac 上购买的许可证可在 ${REFUND_DAYS} 天内退款；详见`,
          { text: '退款政策（英文）', link: 'refunds' },
          '。',
        ],
      ],
    },
    {
      title: '常见问题',
      paragraphs: [
        ['Devot Pro 是订阅吗？不是。一次购买，解锁今后的每个版本。'],
        [
          `试用期多长？${TRIAL_DAYS} 天，包含全部功能。在 iPhone 上，每个 Apple 账户只能试用一次，重新安装不会重新开始。`,
        ],
        [
          '试用结束后会怎样？什么都不会被删除。每篇笔记仍可阅读、搜索和导出；编辑、同步和 AI 需要 Devot Pro 或许可证。',
        ],
        [
          '需要账户吗？不需要。Devot 没有账户体系。同步经由你自己的 iCloud 账户或你部署的中继进行，端到端加密。',
        ],
        [
          'Mac 许可证密钥丢了。',
          { text: '让我们重新发送', link: 'resend' },
          '到你购买时使用的邮箱。如果密钥来自 iPhone 购买，再点按一次“获取 Mac 许可证密钥”即可。',
        ],
        [
          '我的笔记在哪里？在你的设备上。',
          { text: '隐私政策（英文）', link: 'privacy' },
          '说明了 Devot 会发送什么、发送到哪里。',
        ],
      ],
    },
  ],
}

export const supportCopy: typeof en = { support }
