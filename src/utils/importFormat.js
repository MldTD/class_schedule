// 课表导入格式配置。
// 默认格式即教务系统导出的矩阵式课表，单元格内容形如：
//   课程名/(1-2节)1-16周/东校区 文华楼1-102/教师/课程编号/教学班/学时组成/总学时/学分
// 用户可以在导入弹窗中自定义：表格类型、单元格字段分隔符、各段字段含义、节次来源。

import { storage } from './storage'

export const FIELD_OPTIONS = [
  { value: 'name', label: '课程名称' },
  { value: 'weeks', label: '周次（可含节次）' },
  { value: 'location', label: '上课地点' },
  { value: 'teacher', label: '授课教师' },
  { value: 'ignore', label: '忽略该段' }
]

export const FIELD_LABELS = Object.fromEntries(FIELD_OPTIONS.map((o) => [o.value, o.label]))

export const SEPARATOR_PRESETS = [
  { value: '/', label: '斜杠 /（教务标准格式）' },
  { value: '\n', label: '换行' },
  { value: ',', label: '逗号 ,' },
  { value: ';', label: '分号 ;' },
  { value: ' ', label: '空格' },
  { value: '\t', label: '制表符 Tab' },
  { value: '__custom__', label: '自定义…' }
]

export const MODE_OPTIONS = [
  { value: 'auto', label: '自动识别（推荐）' },
  { value: 'matrix', label: '矩阵式（行=节次，列=星期）' },
  { value: 'list', label: '清单式（每行一门课）' }
]

/** 截图所示教务课表的默认格式 */
export function makeDefaultFormat() {
  return {
    mode: 'auto', // auto | matrix | list
    separator: '/', // 单元格内字段分隔符
    // 各段含义，按顺序对应：课程 / 周次节次 / 校区地点 / 教师 / 其余（编号/班级/学时/学分…）
    fields: ['name', 'weeks', 'location', 'teacher', 'ignore'],
    periodSource: 'cell' // cell：优先读单元格里的 (1-2节)；row：只用表格节次行
  }
}

const VALID_FIELDS = new Set(FIELD_OPTIONS.map((o) => o.value))

export function normalizeFormat(raw) {
  const d = makeDefaultFormat()
  if (!raw || typeof raw !== 'object') return d
  const fields = Array.isArray(raw.fields)
    ? raw.fields.slice(0, 20).map((f) => (VALID_FIELDS.has(f) ? f : 'ignore'))
    : d.fields
  return {
    mode: ['auto', 'matrix', 'list'].includes(raw.mode) ? raw.mode : d.mode,
    separator: typeof raw.separator === 'string' && raw.separator ? raw.separator : d.separator,
    fields: fields.length ? fields : d.fields,
    periodSource: raw.periodSource === 'row' ? 'row' : 'cell'
  }
}

export function loadImportFormat() {
  return normalizeFormat(storage.getImportFormat())
}

export function saveImportFormat(fmt) {
  storage.setImportFormat(normalizeFormat(fmt))
}
