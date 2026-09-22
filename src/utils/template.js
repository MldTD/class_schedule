// 生成通用空白 xlsx 导入模板（浏览器端，依赖 SheetJS）。
// 内容均为虚构占位示例，与任何真实课表无关；仅用于演示填写格式。
import * as XLSX from 'xlsx'

function cell(v) {
  return { t: 's', v, z: '@' } // 强制文本，避免编号/数字被 Excel 自动转换
}

const DEMO_CLASS = 'XX专业XX班'

function courseLine(name, periods, weeks, location, teacher, code, extra) {
  return [name, `(${periods}节)${weeks}`, location, teacher, code, DEMO_CLASS, extra].join('/')
}

// 9 列：A=上午/下午/晚上，B=节次（一~五），C~I=周一~周日
const NOTE =
  '注：内容顺序为：课程/(节次)周次/校区 地点/教师/课程编号/教学班/学时组成/总学时/学分；同一格多门课请换行分隔；单周写作 1-15周(单)，双周写作 2-16周(双)。不需要的段可在导入弹窗的“解析格式”中设为忽略。'

export function buildTemplateSheet() {
  const aoa = [
    ['20XX-20XX年第X学期', 'XX专业XX班课表', '', '', '', '', '', '', '专业：XX专业'],
    ['节次', '', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
    ['上午', '一',
      courseLine('示例课程甲', '1-2', '1-16周', 'XX校区 教学楼A-101', '张老师', 'COURSE-0001', '理论:32/32/2.0'),
      '', '', '', '', '', ''],
    ['', '二', '',
      courseLine('示例课程乙', '3-4', '1-15周(单)', 'XX校区 教学楼B-203', '李老师', 'COURSE-0002', '理论:48/48/3.0'),
      '', '', '', '', ''],
    ['下午', '三', '', '', '', '', '', ''],
    ['', '四', '',
      [
        courseLine('示例课程丙', '7-8', '1-7周(单)', 'XX校区 实验楼C-301', '王老师', 'COURSE-0003', '理论:8/8/1.0'),
        courseLine('示例课程丁', '7-8', '2-6周(双)', 'XX校区 教学楼D-405', '赵老师', 'COURSE-0004', '理论:32/32/2.0')
      ].join('\n'),
      '', '', '', '', ''],
    ['晚上', '五', '', '', '', '', '', ''],
    [NOTE, '', '', '', '', '', '', '', '']
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((row) => row.map((v) => (v ? cell(v) : v))))
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 7 } }, // 标题
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // “节次”跨两列
    { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }, // 上午
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // 下午
    { s: { r: 7, c: 0 }, e: { r: 7, c: 8 } } // 底部说明
  ]
  ws['!cols'] = [{ wch: 6 }, { wch: 6 }, ...Array(7).fill({ wch: 34 })]
  ws['!rows'] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 90 }, { hpt: 70 }, { hpt: 40 }, { hpt: 110 }, { hpt: 26 }, { hpt: 40 }]
  return ws
}

export function downloadScheduleTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = buildTemplateSheet()
  XLSX.utils.book_append_sheet(wb, ws, '课表')
  XLSX.writeFile(wb, '课程表导入模板.xlsx', { bookType: 'xlsx' })
}
