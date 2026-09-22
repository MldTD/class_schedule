import parseICSFromLib from 'ics-parser'
import { parseDate, getMonday, diffDays, minutesOf } from './time'

// 使用 ics-parser 库解析 VEVENT 基础字段（纯 JS、浏览器可运行）；
// 该库不处理 RRULE，因此周期性规则由内置的 RFC5545 轻量解析器补充。
// 库异常时回退到完整内置解析，保证 Tauri/Capacitor 各端导入都可用。

const BYDAY_MAP = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 }

/** 折行还原（RFC5545: CRLF 后接空格/制表符表示续行） */
function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '')
}

function unescape(s) {
  return String(s)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** 解析 iCal 日期时间值，支持 VALUE=DATE、浮动时间、UTC */
function parseDateTime(value, params = {}) {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z?)$/)
  if (!m) return null
  const [, y, mo, d, h, mi, se, z] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h || 0), Number(mi || 0), Number(se || 0))
  return {
    date,
    isAllDay: !h,
    isUTC: z === 'Z',
    tzid: params.TZID || ''
  }
}

/** 内置的轻量 VEVENT 解析器 */
function parseICSRaw(text) {
  const unfolded = unfold(text).replace(/\r\n/g, '\n')
  const lines = unfolded.split('\n')
  const events = []
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current)
      current = null
      continue
    }
    if (!current) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const keyPart = line.slice(0, idx)
    const value = line.slice(idx + 1)
    const [name, ...paramParts] = keyPart.split(';')
    const params = {}
    for (const p of paramParts) {
      const eq = p.indexOf('=')
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1)
    }
    const key = name.toUpperCase()
    if (key === 'DTSTART' || key === 'DTEND') {
      current[key.toLowerCase()] = parseDateTime(value, params)
    } else if (key === 'RRULE') {
      current.rrule = parseRRule(value)
    } else if (key === 'SUMMARY') {
      current.summary = unescape(value)
    } else if (key === 'LOCATION') {
      current.location = unescape(value)
    } else if (key === 'DESCRIPTION') {
      current.description = unescape(value)
    }
  }
  return events
}

function parseRRule(value) {
  const rule = {}
  for (const part of String(value).split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1)
  }
  return rule
}

/**
 * 使用 ics-parser 提取事件，并用内置解析补齐 RRULE。
 * 两边都按文档顺序产出 VEVENT，按“开始时间+名称”对齐更稳妥。
 */
function parseWithLibrary(text) {
  const rawList = parseICSFromLib(text).filter((e) => e && e.type === 'VEVENT' && e.startDate)
  const withRules = parseICSRaw(text)

  return rawList.map((e) => {
    const ruleEvent =
      withRules.find(
        (r) =>
          r.summary === e.name &&
          r.dtstart &&
          r.dtstart.date.getTime() === new Date(e.startDate).getTime()
      ) || withRules.find((r) => r.summary === e.name) || {}
    return {
      summary: e.name || '',
      location: e.location || '',
      description: e.description || '',
      dtstart: { date: new Date(e.startDate), isAllDay: false, isUTC: false, tzid: '' },
      dtend: e.endDate ? { date: new Date(e.endDate), isAllDay: false, isUTC: false, tzid: '' } : null,
      rrule: ruleEvent.rrule || null
    }
  })
}

/** 按开始时间匹配节次索引（0-based） */
function matchPeriod(startDate, periodTimes) {
  const mins = startDate.getHours() * 60 + startDate.getMinutes()
  let best = -1
  let bestDiff = Infinity
  periodTimes.forEach((p, i) => {
    const diff = Math.abs(minutesOf(p.start) - mins)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  })
  // 超过 40 分钟匹配不上时，按上午/下午/晚上顺序兜底
  if (bestDiff > 40) {
    if (mins >= 19 * 60) best = Math.min(8, periodTimes.length - 1)
    else if (mins >= 14 * 60) best = Math.min(4, periodTimes.length - 1)
    else best = 0
  }
  return best
}

/** 根据 RRULE 生成落在学期内的周次 */
function weeksFromEvent(event, settings, day) {
  const start = event.dtstart?.date
  if (!start) return [1]
  const semesterMonday = getMonday(parseDate(settings.semesterStart))
  const interval = Number(event.rrule?.INTERVAL || 1)
  const byday = event.rrule?.BYDAY
    ? String(event.rrule.BYDAY)
        .split(',')
        .map((x) => BYDAY_MAP[x.trim().slice(0, 2).toUpperCase()])
        .filter(Boolean)
    : [day]

  const startWeek = Math.floor(diffDays(start, semesterMonday) / 7) + 1
  const count = Number(event.rrule?.COUNT || 0)
  let until = null
  if (event.rrule?.UNTIL) {
    const u = parseDateTime(event.rrule.UNTIL)
    if (u) until = u.date
  }

  const weeks = []
  for (const d of byday) {
    for (let k = 0; k < settings.totalWeeks + 8; k++) {
      const w = startWeek + k * interval
      if (w < 1) continue
      if (w > settings.totalWeeks) break
      if (count && k >= count) break
      if (until) {
        const occDate = new Date(semesterMonday)
        occDate.setDate(occDate.getDate() + (w - 1) * 7 + (d - 1))
        if (occDate > until) break
      }
      weeks.push(w)
    }
  }
  return [...new Set(weeks)].sort((a, b) => a - b)
}

function spanFromEvent(event, periodTimes) {
  const start = event.dtstart?.date
  const end = event.dtend?.date
  if (!start) return 1
  const startIdx = matchPeriod(start, periodTimes)
  if (!end) return 1
  let dur = end.getHours() * 60 + end.getMinutes() - (start.getHours() * 60 + start.getMinutes())
  if (dur <= 0) dur = 45
  const span = Math.max(1, Math.round(dur / 50))
  return Math.min(span, periodTimes.length - startIdx)
}

function extractTeacher(event) {
  const desc = event.description || ''
  const m = desc.match(/(?:授课教师|教师|老师|讲师)\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z·]{2,15})/)
  return m ? m[1] : ''
}

/**
 * 解析 ICS 文件并转换为课表课程结构
 * @param {File} file
 * @param {object} settings 课表设置（学期开始日、节次时间、总周数）
 */
export async function parseICSFile(file, settings) {
  const text = await file.text()
  let events = null
  try {
    events = parseWithLibrary(text)
  } catch (e) {
    console.warn('ics-parser 解析失败，使用内置解析器：', e)
    events = null
  }
  if (!events || !events.length) events = parseICSRaw(text)

  const warnings = []
  const merged = new Map()

  for (const event of events) {
    if (!event.dtstart) continue
    const start = event.dtstart.date
    const day = event.rrule?.BYDAY
      ? BYDAY_MAP[String(event.rrule.BYDAY).split(',')[0].trim().slice(0, 2).toUpperCase()]
      : start.getDay() === 0
        ? 7
        : start.getDay()
    if (!day) continue

    const startPeriod = matchPeriod(start, settings.periodTimes) + 1
    const span = spanFromEvent(event, settings.periodTimes)
    const weeks = weeksFromEvent(event, settings, day)
    const name = (event.summary || '未命名日程').trim().slice(0, 30)
    const teacher = extractTeacher(event)
    const location = (event.location || '').trim()

    const key = `${name}__${teacher}__${location}`
    if (!merged.has(key)) merged.set(key, { name, teacher, location, sections: [] })
    merged.get(key).sections.push({
      day,
      startPeriod,
      endPeriod: startPeriod + span - 1,
      weeks
    })
  }

  const courses = [...merged.values()]
  if (!courses.length) warnings.push('未从 ICS 文件中解析到任何日程，请确认文件中包含 VEVENT')
  else
    warnings.push(
      `已解析 ${courses.length} 门课程，节次按上课时间与“设置”中的作息时间自动匹配，请核对`
    )
  return { courses, warnings }
}
