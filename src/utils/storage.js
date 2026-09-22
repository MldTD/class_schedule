// localStorage 持久化，带 try/catch，隐私模式/非浏览器环境下不会崩溃。
const COURSES_KEY = 'class-schedule:courses:v1'
const SETTINGS_KEY = 'class-schedule:settings:v1'
const IMPORT_FORMAT_KEY = 'class-schedule:import-format:v1'
const hasLS = typeof localStorage !== 'undefined'

function read(key, fallback) {
  if (!hasLS) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  if (!hasLS) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额已满或被禁用时静默失败
  }
}

export const storage = {
  getCourses() {
    const v = read(COURSES_KEY, [])
    return Array.isArray(v) ? v : []
  },
  setCourses(courses) {
    write(COURSES_KEY, courses)
  },
  getSettings() {
    return read(SETTINGS_KEY, null)
  },
  setSettings(settings) {
    write(SETTINGS_KEY, settings)
  },
  getImportFormat() {
    return read(IMPORT_FORMAT_KEY, null)
  },
  setImportFormat(fmt) {
    write(IMPORT_FORMAT_KEY, fmt)
  }
}
