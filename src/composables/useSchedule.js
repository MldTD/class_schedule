import { reactive, ref, watch } from 'vue'
import { storage } from '../utils/storage'
import { makeDefaultSettings, COURSE_COLORS } from '../data/defaults'
import { currentWeekNo } from '../utils/time'

// ---- 模块级单例状态：整个 App 共享同一份课表数据 ----
const courses = ref(storage.getCourses())

const savedSettings = storage.getSettings()
const settings = reactive({
  ...makeDefaultSettings(),
  ...(savedSettings && typeof savedSettings === 'object' ? savedSettings : {})
})
// 兼容旧/缺字段
if (!Array.isArray(settings.periodTimes) || !settings.periodTimes.length) {
  settings.periodTimes = makeDefaultSettings().periodTimes
}

const weekNo = ref(currentWeekNo(settings.semesterStart, settings.totalWeeks))

watch(courses, (v) => storage.setCourses(v), { deep: true })
watch(settings, (v) => storage.setSettings(v), { deep: true })

function uid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function sameSection(a, b) {
  return (
    a.day === b.day &&
    a.startPeriod === b.startPeriod &&
    a.endPeriod === b.endPeriod &&
    a.weeks.length === b.weeks.length &&
    a.weeks.every((w, i) => w === b.weeks[i])
  )
}

/** 合并同一门课（名称+教师+地点相同）的上课时段 */
function mergeCourseList(list) {
  const map = new Map()
  for (const raw of list) {
    const c = normalizeCourse(raw)
    const key = `${c.name}__${c.teacher}__${c.location}`
    if (!map.has(key)) {
      map.set(key, { ...c, sections: [] })
    }
    const target = map.get(key)
    for (const sec of c.sections) {
      if (!target.sections.some((x) => sameSection(x, sec))) target.sections.push(sec)
    }
  }
  return [...map.values()]
}

function normalizeCourse(raw) {
  return {
    id: raw.id || uid(),
    name: String(raw.name || '未命名课程').slice(0, 40),
    teacher: String(raw.teacher || '').slice(0, 30),
    location: String(raw.location || '').slice(0, 40),
    color: raw.color || '',
    sections: (raw.sections || [])
      .filter((s) => s && s.day >= 1 && s.day <= 7 && s.startPeriod >= 1)
      .map((s) => ({
        day: Number(s.day),
        startPeriod: Number(s.startPeriod),
        endPeriod: Math.max(Number(s.endPeriod) || Number(s.startPeriod), Number(s.startPeriod)),
        weeks: [...new Set((s.weeks || []).map(Number))].sort((a, b) => a - b)
      }))
  }
}

export function useSchedule() {
  function setWeek(n) {
    weekNo.value = Math.min(Math.max(Number(n) || 1, 1), settings.totalWeeks)
  }

  function goCurrentWeek() {
    weekNo.value = currentWeekNo(settings.semesterStart, settings.totalWeeks)
  }

  function addCourse(course) {
    courses.value.push(normalizeCourse({ ...course, id: uid() }))
  }

  function updateCourse(course) {
    const idx = courses.value.findIndex((c) => c.id === course.id)
    if (idx >= 0) courses.value[idx] = normalizeCourse(course)
  }

  function removeCourse(id) {
    courses.value = courses.value.filter((c) => c.id !== id)
  }

  function clearCourses() {
    courses.value = []
  }

  function loadDemo(list) {
    courses.value = list
  }

  /**
   * 导入课程
   * @param {Array} list 解析出的课程
   * @param {'merge'|'replace'} mode
   */
  function importCourses(list, mode = 'merge') {
    const incoming = mergeCourseList(list)
    if (mode === 'replace') {
      courses.value = incoming
    } else {
      courses.value = mergeCourseList([...courses.value, ...incoming])
    }
  }

  function saveSettings(patch) {
    Object.assign(settings, patch)
    if (settings.periodTimes) settings.periodTimes = settings.periodTimes.filter(Boolean)
    weekNo.value = Math.min(Math.max(weekNo.value, 1), settings.totalWeeks)
  }

  function resetSettings() {
    Object.assign(settings, makeDefaultSettings())
    goCurrentWeek()
  }

  /** 课程颜色：未指定时按名称稳定取色 */
  function colorOf(course) {
    return course.color || COURSE_COLORS[hashStr(course.name) % COURSE_COLORS.length]
  }

  return {
    courses,
    settings,
    weekNo,
    setWeek,
    goCurrentWeek,
    addCourse,
    updateCourse,
    removeCourse,
    clearCourses,
    loadDemo,
    importCourses,
    mergeCourseList,
    saveSettings,
    resetSettings,
    colorOf
  }
}
