import { fmtDate, getMonday } from '../utils/time'

export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']

// 国内高校常见作息（节次时间可在设置中自定义）
export const DEFAULT_PERIODS = [
  { start: '08:00', end: '08:45' },
  { start: '08:55', end: '09:40' },
  { start: '10:00', end: '10:45' },
  { start: '10:55', end: '11:40' },
  { start: '14:00', end: '14:45' },
  { start: '14:55', end: '15:40' },
  { start: '16:00', end: '16:45' },
  { start: '16:55', end: '17:40' },
  { start: '19:00', end: '19:45' },
  { start: '19:55', end: '20:40' },
  { start: '20:50', end: '21:35' }
]

// 课程块配色
export const COURSE_COLORS = [
  '#4f8cff',
  '#36b37e',
  '#ff8b3d',
  '#9a5cff',
  '#ff5c8a',
  '#17a2b8',
  '#f6b73c',
  '#ef5b5b',
  '#5b8ff9',
  '#61c0a8',
  '#e06666',
  '#7e9ff0'
]

export function makeDefaultSettings() {
  return {
    // 默认学期从本周一开始
    semesterStart: fmtDate(getMonday(new Date())),
    totalWeeks: 20,
    showWeekend: true,
    periodTimes: DEFAULT_PERIODS.map((p) => ({ ...p }))
  }
}

// 示例课表（空状态时一键体验）
export function makeDemoCourses() {
  return [
    {
      id: 'demo-1',
      name: '高等数学A',
      teacher: '王建国',
      location: '教学楼A-101',
      color: '#4f8cff',
      sections: [
        { day: 1, startPeriod: 1, endPeriod: 2, weeks: range(1, 16) },
        { day: 3, startPeriod: 1, endPeriod: 2, weeks: range(1, 16) }
      ]
    },
    {
      id: 'demo-2',
      name: '大学英语',
      teacher: '李芳',
      location: '外语楼B-203',
      color: '#36b37e',
      sections: [
        { day: 2, startPeriod: 3, endPeriod: 4, weeks: range(1, 12) },
        { day: 4, startPeriod: 1, endPeriod: 2, weeks: range(1, 12) }
      ]
    },
    {
      id: 'demo-3',
      name: '程序设计基础',
      teacher: '张伟',
      location: '实验楼C-301',
      color: '#9a5cff',
      sections: [{ day: 4, startPeriod: 5, endPeriod: 6, weeks: range(1, 16) }]
    },
    {
      id: 'demo-4',
      name: '大学体育',
      teacher: '陈强',
      location: '体育馆',
      color: '#ff8b3d',
      sections: [{ day: 5, startPeriod: 3, endPeriod: 4, weeks: range(2, 15).filter((w) => w % 2 === 0) }]
    },
    {
      id: 'demo-5',
      name: '思想道德与法治',
      teacher: '赵敏',
      location: '教学楼D-205',
      color: '#ef5b5b',
      sections: [{ day: 2, startPeriod: 7, endPeriod: 8, weeks: range(1, 8) }]
    },
    {
      id: 'demo-6',
      name: '线性代数',
      teacher: '孙丽华',
      location: '教学楼A-305',
      color: '#17a2b8',
      sections: [{ day: 1, startPeriod: 5, endPeriod: 6, weeks: range(1, 10) }]
    }
  ]
}

function range(a, b) {
  const out = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}
