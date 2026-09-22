// 纯日期工具：课表只关心“日/周”，统一用本地时间，避免 UTC 偏移问题。

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function fmtDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** 返回给定日期所在周的周一 */
export function getMonday(d) {
  const x = startOfDay(d)
  const offset = (x.getDay() + 6) % 7 // 周一=0 ... 周日=6
  x.setDate(x.getDate() - offset)
  return x
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function diffDays(a, b) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000)
}

/** 星期几，周一=1 ... 周日=7 */
export function weekdayOf(d) {
  return d.getDay() === 0 ? 7 : d.getDay()
}

/** 第 week 周（从 1 开始）的周一 */
export function mondayOfWeek(week, semesterStart) {
  return addDays(parseDate(semesterStart), (week - 1) * 7)
}

/** 今天是学期第几周，结果夹在 [1, totalWeeks] */
export function currentWeekNo(semesterStart, totalWeeks) {
  const n = Math.floor(diffDays(new Date(), parseDate(semesterStart)) / 7) + 1
  return Math.min(Math.max(n, 1), totalWeeks)
}

/** "HH:mm" -> 分钟数 */
export function minutesOf(t) {
  const [h, m] = String(t).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 分钟数 -> "HH:mm" */
export function toTime(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

/** 把周次数组压缩成 "1-8,10,12-16 单周" 这样的文本 */
export function summarizeWeeks(weeks) {
  if (!weeks || !weeks.length) return ''
  const arr = [...new Set(weeks)].sort((a, b) => a - b)
  const ranges = []
  let s = arr[0]
  let e = arr[0]
  for (let i = 1; i <= arr.length; i++) {
    if (i < arr.length && arr[i] === e + 1) {
      e = arr[i]
    } else {
      ranges.push(s === e ? `${s}` : `${s}-${e}`)
      if (i < arr.length) s = e = arr[i]
    }
  }
  let parity = ''
  if (arr.length > 1) {
    if (arr.every((w) => w % 2 === 1)) parity = ' 单周'
    else if (arr.every((w) => w % 2 === 0)) parity = ' 双周'
  }
  return `${ranges.join(',')}周${parity}`
}

/** 根据起止周与单双周展开周次数组 */
export function expandWeeks(start, end, parity = 'all') {
  const out = []
  for (let w = start; w <= end; w++) {
    if (parity === 'odd' && w % 2 === 0) continue
    if (parity === 'even' && w % 2 === 1) continue
    out.push(w)
  }
  return out
}
