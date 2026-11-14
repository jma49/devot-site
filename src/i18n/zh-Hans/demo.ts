import type { demoCopy as en } from '../en/demo.ts'

const playClip = '播放片段'

export const demoCopy: typeof en = {
  demo: {
    label: '试一试',
    title: '按状态筛选',
    hint: '像在侧边栏里一样选一个状态，列表就只留下它的笔记。再选一次即可看到全部。',
    filtersLabel: '按状态筛选示例笔记',
    listLabel: '示例笔记',
    all: '所有笔记',
    statuses: {
      active: '进行中',
      on_hold: '搁置',
      completed: '已完成',
      dropped: '已放弃',
      none: '无状态',
    },
    searchLabel: '相当于搜索',
    summary: (name: string, shown: number, total: number) =>
      shown === total ? `${name}：${total} 篇笔记` : `${name}：${total} 篇中的 ${shown} 篇`,
    notes: [
      { title: '春季发布计划', book: '春季发布', status: 'active' },
      { title: '落地页文案', book: '春季发布', status: 'on_hold' },
      { title: '带退避的重试', book: '项目', status: 'active' },
      { title: '设计同步会，10 月 21 日', book: '会议', status: 'completed' },
      { title: '录音室声学', book: '家庭录音室', status: 'on_hold' },
      { title: '晨间随笔', book: '日记', status: 'none' },
      { title: '定价实验', book: '春季发布', status: 'dropped' },
      { title: '迷迭香佛卡夏', book: '厨房', status: 'completed' },
      { title: '阅读清单', book: '阅读', status: 'active' },
    ],
  },
  clipControl: {
    label: playClip,
    named: (clip: string) => `${playClip}：${clip}`,
  },
}
