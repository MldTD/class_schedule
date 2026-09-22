import * as XLSX from 'xlsx'

// 兼容两类常见课表：
// 1) 矩阵式：行=节次，列=周一~周日，单元格里是课程文本
// 2) 清单式：每行一门课，列含 课程名/教师/地点/星期/节次/周次

const DAY_CHAR = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
const DAY_EN = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 }

export function dayFromText(t = '') {
  const s = String(t)
  const m = s.match(/(?:星期|礼拜|周)\s*([一二三四五六日天1-7])/)
  if (m) return /[1-7]/.test(m[1]) ? Number(m[1]) : DAY_CHAR[m[1]]
  const en = s.toUpperCase().match(/\b(MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/)
  if (en) return DAY_EN[en[1].slice(0, 3)]
  return 0
}

/** 从文本中解析节次，如 "3-4节" / "第5节" / "7,8" */
export function periodFromText(t = '') {
  const s = String(t)
  let m = s.match(/(\d{1,2})\s*[-–—~至到]\s*(\d{1,2})/)
  if (m) return [Number(m[1]), Number(m[2])]
  m = s.match(/(\d{1,2})\s*[,，、]\s*(\d{1,2})/)
  if (m) return [Number(m[1]), Number(m[2])]
  m = s.match(/第?\s*(\d{1,2})\s*(?:小节|节)/)
  if (m) return [Number(m[1]), Number(m[1])]
  return [0, 0]
}

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

/**
 * 节次行标签转节次区间（严格：只接受很短的标签单元格）。
 * 教务课表常用中文数字「一~六」标注，每个标签对应两小节：
 * 一=1-2，二=3-4，三=5-6，四=7-8，五=9-10 …
 * 严格化是为了避开底部说明行长句（如“单周写作 1-15周(单)”）被误判。
 */
export function periodPairFromLabel(t = '') {
  const s = String(t).trim()
  if (!s || s.length > 10) return [0, 0]

  let m = s.match(/(\d{1,2})\s*[-–—~至到]\s*(\d{1,2})/)
  if (m) return [Number(m[1]), Number(m[2])]
  m = s.match(/(\d{1,2})\s*[,，、]\s*(\d{1,2})/)
  if (m) return [Number(m[1]), Number(m[2])]
  m = s.match(/第?\s*(\d{1,2})\s*(?:小节|节)/)
  if (m) return [Number(m[1]), Number(m[1])]

  // 允许 “上午一” / “节次 三” 这类带前缀的单字标签
  const cn = s.replace(/上午|下午|晚上|节次|[第\s:：]/g, '')
  if (/^[一二三四五六]$/.test(cn)) {
    const n = CN_NUM[cn]
    return [n * 2 - 1, n * 2]
  }
  return [0, 0]
}

/**
 * 提取周次，支持 "1-16周"、"3-15单周"、"(2-14双周)"、"1,3,5周"、"8周" 等。
 * 区间必须带“周/单/双”字样，避免把教学楼房间号（如 15-302）误判成周次。
 */
export function extractWeeks(text = '') {
  // 归一化 “1-15周(单)” / “2-16周（双）” → “1-15单周” / “2-16双周”
  const s = String(text).replace(
    /(\d{1,2})\s*周\s*[（(]\s*([单双])\s*[)）]/g,
    '$1$2周'
  )
  const weeks = new Set()
  let parity = ''

  let m
  const reRange = /(\d{1,2})\s*[-–—~至到]\s*(\d{1,2})\s*[（(]?\s*(?:\s*周|\s*([单双])\s*周?)/g
  while ((m = reRange.exec(s))) {
    let a = Number(m[1])
    let b = Number(m[2])
    const p = m[3]
    if (a > b) [a, b] = [b, a]
    if (a >= 1 && b <= 30) {
      for (let i = a; i <= b; i++) {
        if (!p || (p === '单' && i % 2 === 1) || (p === '双' && i % 2 === 0)) weeks.add(i)
      }
      if (p) parity = p
    }
  }

  const reList = /(?:^|[^\d\-–—~至到])(\d{1,2}(?:\s*[,，、]\s*\d{1,2})+)\s*周/g
  while ((m = reList.exec(s))) {
    m[1].split(/[,，、]/).forEach((x) => {
      const n = Number(x.trim())
      if (n >= 1 && n <= 30) weeks.add(n)
    })
  }

  if (!weeks.size) {
    const reSingle = /(?<!\d)(\d{1,2})\s*周(?!\s*[-–—~至到])/g
    while ((m = reSingle.exec(s))) {
      const n = Number(m[1])
      if (n >= 1 && n <= 30) weeks.add(n)
    }
  }

  if (!parity) {
    if (/单周/.test(s)) parity = '单'
    else if (/双周/.test(s)) parity = '双'
  }

  let arr = [...weeks].sort((a, b) => a - b)
  if (parity && arr.length) arr = arr.filter((w) => (parity === '单' ? w % 2 === 1 : w % 2 === 0))
  return arr
}

const ROOM_RE = /(楼|栋|馆|房|厅|堂|中心|大楼|学院|公寓|园区|空间|工坊|[A-Za-z]\d|\d{2,})/

/** 移除文本中的周次写法（提取完周次后调用） */
function stripWeekTokens(text) {
  return text
    .replace(/[（(]\s*[^（）()]{0,12}?\d[^（）()]{0,10}?周[^（）()]{0,6}[)）]/g, ' ')
    .replace(/\d{1,2}\s*[-–—~至到]\s*\d{1,2}\s*[（(]?\s*[单双]?\s*周?\s*[)）]?/g, ' ')
    .replace(/(?:^|[^\d\-–—~至到])\d{1,2}(?:\s*[,，、]\s*\d{1,2})+\s*周/g, ' ')
    .replace(/(?<!\d)\d{1,2}\s*周(?!\s*[-–—~至到])/g, ' ')
    .replace(/[单双]\s*周/g, ' ')
    .replace(/[（(]\s*[单双]\s*[)）]/g, ' ')
}

function hasWeekInfo(line) {
  return /\d/.test(line) && /周/.test(line) && extractWeeks(line).length > 0
}
function isRoomish(line) {
  return ROOM_RE.test(line)
}
function isTeacherish(line) {
  if (/(老师|教授|讲师)/.test(line)) return true
  return /^[\u4e00-\u9fa5·]{2,4}$/.test(line)
}

/**
 * 把一个单元格切分为一门或多门课的文本。
 * 单元格内换行在教务课表中既可能分隔不同课程，也可能是同一门课的
 * “名称/教师/周次/教室”多行，这里按内容特征进行智能归并。
 */
function groupCell(raw) {
  const lines = String(raw)
    .split(/[\r\n;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const groups = []
  let cur = null

  const push = () => {
    if (cur) groups.push(cur)
    cur = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const next = lines[i + 1] || ''
    if (!cur) {
      cur = { text: line, complete: false }
      continue
    }
    if (hasWeekInfo(line)) {
      const strippedLen = line.replace(/[\s\d周()（）单双,，、\-–—~至到:：.。节次第]/g, '').length
      if (strippedLen <= 4) {
        cur.text += '\n' + line
        cur.complete = true
      } else {
        // 行内含周次且带较多其他内容，视为下一门课
        push()
        cur = { text: line, complete: true }
      }
    } else if (isRoomish(line)) {
      cur.text += '\n' + line
    } else if (isTeacherish(line)) {
      // 上一门课已完整（出现过周次）且后面跟着教师/周次行时，短名更可能是新课程
      if (cur.complete && isTeacherish(line) && /(老师|教授|讲师|周)/.test(next)) {
        push()
        cur = { text: line, complete: false }
      } else {
        cur.text += '\n' + line
      }
    } else {
      push()
      cur = { text: line, complete: false }
    }
  }
  push()
  return groups.map((g) => g.text)
}

function splitBySeparator(raw, sep) {
  if (!sep) return [raw]
  if (sep === '\n') return raw.split(/\r?\n/)
  return raw.split(sep)
}

/**
 * 按用户配置的字段顺序做结构化解析（默认即教务标准格式）。
 * 映射失败（切不出多段或取不到课程名）时返回 null，由调用方回退到启发式解析。
 */
function parseMappedChunk(chunk, fmt, day, rowS, rowE, totalWeeks, warnings) {
  if (!fmt || !fmt.separator || !fmt.fields.includes('name')) return null
  const tokens = splitBySeparator(chunk, fmt.separator).map((x) => x.trim())
  if (tokens.length < 2) return null

  let name = ''
  let teacher = ''
  let location = ''
  let weekText = ''
  tokens.forEach((tok, i) => {
    const field = fmt.fields[i] || 'ignore'
    if (!tok) return
    if (field === 'name' && !name) name = tok
    else if (field === 'teacher' && !teacher) teacher = tok
    else if (field === 'location' && !location) location = tok
    else if (field === 'weeks') weekText += ` ${tok}`
  })
  if (!name) return null
  // 配置中包含周次段时，必须真的从该段提取到周次，否则视为非本格式，回退启发式
  if (fmt.fields.includes('weeks') && weekText.trim() && !extractWeeks(weekText).length) {
    return null
  }

  let weeks = extractWeeks(weekText)
  let s = rowS
  let e = rowE
  if (fmt.periodSource !== 'row') {
    const [ps, pe] = periodFromText(weekText)
    if (ps) {
      s = ps
      e = pe || ps
    }
  }
  if (!weeks.length) {
    weeks = Array.from({ length: Math.min(16, totalWeeks) }, (_, i) => i + 1)
    warnings.push(`「${name}」未识别到周次，已默认设为 1-${Math.min(16, totalWeeks)} 周，可在导入后编辑`)
  }

  return {
    name: name.slice(0, 30),
    teacher,
    location,
    sections: [{ day, startPeriod: s, endPeriod: e, weeks }]
  }
}

/** 课程文本块解析入口：优先按配置格式映射，失败再走启发式 */
function parseCourseChunk(chunk, day, startPeriod, endPeriod, totalWeeks, warnings, fmt) {
  if (fmt) {
    const mapped = parseMappedChunk(chunk, fmt, day, startPeriod, endPeriod, totalWeeks, warnings)
    if (mapped) return mapped
  }
  return parseCourseChunkHeuristic(chunk, day, startPeriod, endPeriod, totalWeeks, warnings)
}

/** 从一个课程文本块中启发式提取课程信息（无格式配置时的兜底） */
function parseCourseChunkHeuristic(chunk, day, startPeriod, endPeriod, totalWeeks, warnings) {
  // 1. 先从原文提取周次，再把周次写法移除，避免污染教师/教室提取
  let text = chunk.trim()
  let weeks = extractWeeks(text)
  text = stripWeekTokens(text)

  let location = ''
  let teacher = ''

  // 【教室】[教室] 优先作为地点
  let m = text.match(/[【\[「『]([^】\]」』]{2,30})[】\]」』]/)
  if (m) {
    location = m[1].trim()
    text = text.replace(m[0], ' ')
  }

  // @ 分隔：课程名@教师@地点
  const atParts = text.split('@').map((x) => x.trim()).filter(Boolean)
  if (atParts.length >= 2) {
    text = atParts[0]
    for (let i = 1; i < atParts.length; i++) {
      if (!teacher) teacher = atParts[i]
      else if (!location) location = atParts[i]
    }
  }

  // 圆括号分组：教师 / 地点
  const groups = []
  text = text.replace(/[（(]([^（）()]{1,30})[)）]/g, (full, g) => {
    groups.push(g.trim())
    return ' '
  })
  for (const g of groups) {
    if (!location && ROOM_RE.test(g)) {
      location = g
    } else if (!teacher && /^[\u4e00-\u9fa5A-Za-z·]{2,15}$/.test(g)) {
      teacher = g
    }
  }

  // 显式/称谓形式：王老师 / 张教授 / 教师：李明
  m = text.match(/([\u4e00-\u9fa5A-Za-z·]{2,15})\s*(?:老师|教授|讲师)(?!\s*[:：])/)
  if (m && !teacher) {
    teacher = m[1]
    text = text.replace(m[0], ' ')
  }
  m = text.match(/(?:授课)?(?:教师|老师|讲师)\s*[:：]\s*([\u4e00-\u9fa5A-Za-z·]{2,15})/)
  if (m) {
    teacher = m[1]
    text = text.replace(m[0], ' ')
  }

  // 显式地点标签
  m = text.match(/(?:上课)?(?:地点|教室|地址|场馆|位置)\s*[:：]?\s*([^\s,，;；()（）]{2,20})/)
  if (m && !location) {
    location = m[1]
    text = text.replace(m[0], ' ')
  }

  // 自由文本教室兜底：实验楼C-301 / 二教302 / A305
  if (!location) {
    m = text.match(
      /([\u4e00-\u9fa5]{2,10}(?:楼|栋|馆|厅|堂|大楼|中心)[A-Za-z0-9\-—]{0,8}|[\u4e00-\u9fa5]{0,6}教[A-Za-z0-9\-—]{2,10})/
    )
    if (m) {
      location = m[1]
      text = text.replace(m[1], ' ')
    }
  }

  text = text
    .replace(/(老师|教授|讲师)/g, ' ')
    .trim()
    .replace(/^[\s,，.。:：、·()（）]+|[\s,，.。:：、·()（）]+$/g, '')
  const name = text.split(/[\s,，、]+/).filter(Boolean)[0]

  if (!name) {
    warnings.push(`周${'一二三四五六日'[day - 1]} 第${startPeriod}-${endPeriod}节有无法识别的内容：${chunk.slice(0, 20)}`)
    return null
  }
  if (!weeks.length) {
    // 没写周次时按 1~min(16, 总周数) 兜底
    weeks = Array.from({ length: Math.min(16, totalWeeks) }, (_, i) => i + 1)
    warnings.push(`「${name}」未识别到周次，已默认设为 1-${Math.min(16, totalWeeks)} 周，可在导入后编辑`)
  }

  return {
    name: name.slice(0, 30),
    teacher,
    location,
    sections: [{ day, startPeriod, endPeriod, weeks }]
  }
}

/** 填充合并单元格，让矩阵解析能拿到跨行/跨列的值 */
function fillMerges(ws) {
  const merges = ws['!merges'] || []
  for (const mg of merges) {
    const top = ws[XLSX.utils.encode_cell({ r: mg.s.r, c: mg.s.c })]
    const v = top ? top.v : ''
    for (let r = mg.s.r; r <= mg.e.r; r++) {
      for (let c = mg.s.c; c <= mg.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) ws[addr] = { t: 's', v }
      }
    }
  }
}

/** 矩阵式解析 */
function parseMatrix(rows, headerRow, totalWeeks, warnings, fmt) {
  const dayCols = new Map()
  for (let c = 0; c < rows[headerRow].length; c++) {
    const d = dayFromText(rows[headerRow][c])
    if (d && !dayCols.has(d)) dayCols.set(d, c)
  }
  // 有些表头分两行（“星期一 / 9月2日”），向下扫描一行辅助识别
  if (dayCols.size < 2 && rows[headerRow + 1]) {
    for (let c = 0; c < rows[headerRow + 1].length; c++) {
      const d = dayFromText(rows[headerRow][c]) || dayFromText(rows[headerRow + 1][c])
      if (d) dayCols.set(d, c)
    }
  }

  const courses = []
  for (let r = headerRow + 1; r < rows.length; r++) {
    // 节次标签只在最左两列（第 0 列可能是“上午/下午/晚上”，第 1 列是节次）
    let [s, e] = [0, 0]
    let labelCol = -1
    for (let c = 0; c <= Math.min(1, (rows[r] || []).length - 1); c++) {
      ;[s, e] = periodPairFromLabel(rows[r][c])
      if (s) {
        labelCol = c
        break
      }
    }
    if (!s) continue
    e = e || s
    for (const [day, col] of dayCols) {
      // 节次标签列即使撞上星期列也不能当课程格解析
      if (col === labelCol) continue
      const cell = rows[r][col]
      if (!cell || !String(cell).trim()) continue
      for (const chunk of groupCell(cell)) {
        const course = parseCourseChunk(chunk, day, s, e, totalWeeks, warnings, fmt)
        if (course) courses.push(course)
      }
    }
  }
  return courses
}

/** 清单式解析 */
function parseList(rows, headerRow, totalWeeks, warnings) {
  const headers = rows[headerRow].map((x) => String(x ?? '').trim())
  const findCol = (...regs) =>
    headers.findIndex((h) => regs.some((re) => re.test(h)))

  const colName = findCol(/课程名|课程名称|科目|课程标题/)
  const colTeacher = findCol(/授课教师|教师|老师|讲师/)
  const colLocation = findCol(/上课地点|上课教室|教学场地|地点|教室|地址|场馆/)
  const colDay = findCol(/星期|礼拜|周(?!次)|week\s?day/i)
  const colStart = findCol(/开始节|起始节|开始小节/)
  const colEnd = findCol(/结束节|结束小节/)
  const colPeriod = findCol(/节次|小节|period/i)
  const colWeeks = findCol(/周次|上课周|周数|week/i)

  const courses = []
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row.some((x) => String(x ?? '').trim())) continue
    const name = colName >= 0 ? String(row[colName] ?? '').trim() : ''
    if (!name) continue

    let day = colDay >= 0 ? dayFromText(row[colDay]) : 0
    if (!day && colDay >= 0) {
      const n = Number(String(row[colDay]).replace(/[^\d]/g, ''))
      if (n >= 1 && n <= 7) day = n
    }

    let s = 0
    let e = 0
    if (colPeriod >= 0) {
      ;[s, e] = periodFromText(row[colPeriod])
    }
    if (!s && colStart >= 0) {
      s = Number(String(row[colStart]).replace(/[^\d]/g, ''))
      e = colEnd >= 0 ? Number(String(row[colEnd]).replace(/[^\d]/g, '')) : s
    }
    if (!s || !day) {
      warnings.push(`清单第 ${r + 1} 行「${name}」缺少星期或节次信息，已跳过`)
      continue
    }
    e = e || s

    let weeks = colWeeks >= 0 ? extractWeeks(row[colWeeks]) : []
    if (!weeks.length) weeks = extractWeeks(name) // 周次偶尔写在名称列
    if (!weeks.length) {
      weeks = Array.from({ length: Math.min(16, totalWeeks) }, (_, i) => i + 1)
      warnings.push(`「${name}」未识别到周次，已默认设为 1-${Math.min(16, totalWeeks)} 周`)
    }

    courses.push({
      name: name.slice(0, 30),
      teacher: colTeacher >= 0 ? String(row[colTeacher] ?? '').trim() : '',
      location: colLocation >= 0 ? String(row[colLocation] ?? '').trim() : '',
      sections: [{ day, startPeriod: s, endPeriod: e, weeks }]
    })
  }
  return courses
}

/**
 * 解析 Excel/CSV 课表文件
 * @param {object} fmt 导入格式配置（见 importFormat.js），控制表格类型/分隔符/字段映射
 * @returns {Promise<{courses: Array, warnings: string[]}>}
 */
export async function parseScheduleFile(file, totalWeeks = 20, fmt = null) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const warnings = []
  const mode = fmt?.mode || 'auto'

  const all = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    fillMerges(ws)
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
    if (!rows.length) continue

    // 扫描前 8 行寻找表头
    let matrixHeader = -1
    let listHeader = -1
    let matrixScore = 0
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const cells = rows[r].map((x) => String(x ?? ''))
      const dayHits = new Set(cells.map(dayFromText).filter(Boolean)).size
      if (dayHits >= 3 && matrixHeader < 0) {
        matrixHeader = r
        matrixScore = dayHits
      }
      const joined = cells.join(' ')
      if (listHeader < 0 && /(课程名|课程名称|科目)/.test(joined) && /(星期|节次|周次)/.test(joined)) {
        listHeader = r
      }
    }

    const useMatrix =
      mode === 'matrix'
        ? matrixHeader >= 0
        : mode === 'list'
          ? false
          : matrixHeader >= 0 && matrixScore >= Math.max(3, listHeader >= 0 ? matrixScore : 0)

    if (useMatrix) {
      all.push(...parseMatrix(rows, matrixHeader, totalWeeks, warnings, fmt))
    } else if (listHeader >= 0) {
      all.push(...parseList(rows, listHeader, totalWeeks, warnings))
    } else {
      warnings.push(`工作表「${sheetName}」未能识别表头，请参考示例文件的格式或在下方调整解析格式`)
    }
  }

  if (!all.length && !warnings.some((w) => w.includes('未能识别'))) {
    warnings.push('未从文件中解析到任何课程')
  }
  return { courses: all, warnings }
}
