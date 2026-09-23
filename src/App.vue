<script setup>
import { ref, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSchedule } from './composables/useSchedule'
import { makeDemoCourses } from './data/defaults'
import { mondayOfWeek, addDays, currentWeekNo } from './utils/time'
import ScheduleGrid from './components/ScheduleGrid.vue'
import CourseList from './components/CourseList.vue'
import CourseDialog from './components/CourseDialog.vue'
import ImportDialog from './components/ImportDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'

const {
  courses,
  settings,
  weekNo,
  setWeek,
  removeCourse,
  loadDemo
} = useSchedule()

const activeTab = ref('schedule')

const courseDialogVisible = ref(false)
const editingCourse = ref(null)
const importVisible = ref(false)
const settingsVisible = ref(false)

const isCurrentWeek = computed(
  () => weekNo.value === currentWeekNo(settings.semesterStart, settings.totalWeeks)
)
const weekMonday = computed(() => mondayOfWeek(weekNo.value, settings.semesterStart))
const weekRangeText = computed(() => {
  const sun = addDays(weekMonday.value, 6)
  return `${weekMonday.value.getMonth() + 1}/${weekMonday.value.getDate()} - ${
    sun.getMonth() + 1
  }/${sun.getDate()}`
})
const weekOptions = computed(() => {
  const real = currentWeekNo(settings.semesterStart, settings.totalWeeks)
  return Array.from({ length: settings.totalWeeks }, (_, i) => {
    const m = addDays(parseStart(settings.semesterStart), i * 7)
    return {
      value: i + 1,
      label: `第${i + 1}周`,
      date: `${m.getMonth() + 1}/${m.getDate()}`,
      current: i + 1 === real
    }
  })
})
function parseStart(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function prevWeek() {
  changeWeek(weekNo.value - 1, -1)
}
function nextWeek() {
  changeWeek(weekNo.value + 1, 1)
}
function pickWeek(w) {
  changeWeek(w, 0)
}
function backToCurrent() {
  changeWeek(currentWeekNo(settings.semesterStart, settings.totalWeeks), 0)
}

// ---- 手机端：左右滑动切换周次（整周视图铺满屏宽，无横向滚动，手势无冲突） ----
const swipeDir = ref(0) // 1 = 下一周（内容自右进入）；-1 = 上一周；0 = 无动画
const mobWrapRef = ref(null)
const touchStart = ref(null)
let savedScrollTop = 0

function changeWeek(n, dir) {
  if (n === weekNo.value || n < 1 || n > settings.totalWeeks) return
  swipeDir.value = dir
  const scroller = mobWrapRef.value && mobWrapRef.value.querySelector('.schedule-scroll')
  savedScrollTop = scroller ? scroller.scrollTop : 0
  setWeek(n)
  // :key 会重建网格，恢复纵向滚动位置
  nextTick(() => {
    const el = mobWrapRef.value && mobWrapRef.value.querySelector('.schedule-scroll')
    if (el) el.scrollTop = savedScrollTop
  })
}
function shiftWeek(dir) {
  changeWeek(weekNo.value + dir, dir)
}

function onTouchStart(e) {
  const t = e.touches[0]
  touchStart.value = { x: t.clientX, y: t.clientY, t: Date.now() }
}
function onTouchEnd(e) {
  const s = touchStart.value
  touchStart.value = null
  if (!s) return
  const t = e.changedTouches[0]
  const dx = t.clientX - s.x
  const dy = t.clientY - s.y
  const dt = Date.now() - s.t
  // 横向位移足够大、明显主导纵向、手势不太慢才判定为翻周
  if (dt > 600 || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return
  shiftWeek(dx < 0 ? 1 : -1)
}

function openAdd() {
  editingCourse.value = null
  courseDialogVisible.value = true
}
function openEdit(course) {
  editingCourse.value = course
  courseDialogVisible.value = true
}
async function onDelete(course) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${course.name}」及其全部上课时段吗？`,
      '删除课程',
      { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }
    )
    removeCourse(course.id)
    ElMessage.success('已删除')
  } catch {
    // 取消
  }
}

function loadDemoData() {
  loadDemo(makeDemoCourses())
  ElMessage.success('已加载示例课表')
}
</script>

<template>
  <el-config-provider>
    <div class="h-full flex flex-col bg-[#f3f5f9]">
      <!-- 顶部栏 -->
      <header
        class="safe-top h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-3 md:px-5 gap-2 md:gap-3 z-20"
      >
        <div class="flex items-center gap-2 shrink-0">
          <span
            class="w-8 h-8 rounded-lg bg-brand-500 text-white flex-center text-[15px] font-bold"
          >
            课
          </span>
          <span class="hidden sm:inline font-bold text-[17px]">课程表</span>
        </div>

        <!-- 周导航 -->
        <div class="flex items-center gap-1 ml-1">
          <el-button-group v-if="activeTab === 'schedule'">
            <el-button size="small" :disabled="weekNo <= 1" @click="prevWeek">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-dropdown trigger="click" @command="pickWeek" placement="bottom-start">
              <el-button size="small" class="!min-w-0 md:!min-w-[132px]">
                <span class="font-semibold">第{{ weekNo }}周</span>
                <span class="text-gray-400 text-[11px] ml-1 hidden md:inline">
                  {{ weekRangeText }}
                </span>
                <el-icon class="ml-1"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu class="week-dropdown">
                  <el-dropdown-item
                    v-for="w in weekOptions"
                    :key="w.value"
                    :command="w.value"
                    :class="w.value === weekNo ? 'text-brand-500 font-semibold' : ''"
                  >
                    {{ w.label }}
                    <span class="text-gray-400 text-[11px] ml-1">{{ w.date }}</span>
                    <el-tag v-if="w.current" size="small" type="success" class="ml-2">本周</el-tag>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" :disabled="weekNo >= settings.totalWeeks" @click="nextWeek">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-button-group>
          <el-button
            v-if="activeTab === 'schedule' && !isCurrentWeek"
            size="small"
            type="primary"
            plain
            class="ml-1 !px-2 md:!px-3 !text-[12px] whitespace-nowrap"
            @click="backToCurrent"
          >
            回到本周
          </el-button>
        </div>

        <div class="flex-1" />

        <el-button size="small" @click="importVisible = true">
          <el-icon class="md:mr-1"><Upload /></el-icon><span class="hidden md:inline">导入课表</span>
        </el-button>
        <el-button size="small" type="primary" class="hidden sm:inline-flex" @click="openAdd">
          <el-icon class="mr-1"><Plus /></el-icon>添加课程
        </el-button>
        <el-button size="small" circle @click="settingsVisible = true">
          <el-icon><Setting /></el-icon>
        </el-button>
      </header>

      <!-- 主内容 -->
      <main class="flex-1 overflow-hidden relative">
        <!-- 桌面全天视图：显隐控制放在包裹层（组件根节点自带 flex 类，会与 hidden 冲突） -->
        <div v-show="activeTab === 'schedule'" class="hidden md:block h-full">
          <ScheduleGrid
            :week="weekNo"
            :day-filter="0"
            class="h-full"
            @edit="openEdit"
            @delete="onDelete"
          />
        </div>
        <div
          v-show="activeTab === 'schedule'"
          ref="mobWrapRef"
          class="md:hidden h-full"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <ScheduleGrid
            :key="'w' + weekNo"
            :week="weekNo"
            :day-filter="0"
            fit
            class="h-full"
            :class="swipeDir === 1 ? 'day-slide-next' : swipeDir === -1 ? 'day-slide-prev' : ''"
            @edit="openEdit"
            @delete="onDelete"
          />
        </div>
        <CourseList
          v-show="activeTab === 'courses'"
          class="h-full"
          @edit="openEdit"
          @delete="onDelete"
          @add="openAdd"
        />

        <!-- 空状态 -->
        <div
          v-if="!courses.length && activeTab === 'schedule'"
          class="absolute inset-0 flex-center bg-[#f3f5f9]/95 px-6"
        >
          <div class="text-center max-w-xs">
            <el-icon :size="56" color="#c0c8d6"><Calendar /></el-icon>
            <h2 class="mt-4 text-lg font-bold text-gray-700">开始打造你的课表</h2>
            <p class="mt-2 text-[13px] text-gray-400 leading-relaxed">
              导入教务系统的 Excel 课表，或手动添加课程，数据保存在本机，无需联网
            </p>
            <div class="mt-5 flex flex-col gap-2">
              <el-button type="primary" size="large" @click="importVisible = true">
                <el-icon class="mr-1"><Upload /></el-icon>导入课表文件
              </el-button>
              <el-button size="large" @click="openAdd">手动添加课程</el-button>
              <el-button size="large" link @click="loadDemoData">加载示例课表看看</el-button>
            </div>
          </div>
        </div>

        <!-- 手机端悬浮添加按钮 -->
        <button
          v-if="activeTab === 'schedule' && courses.length"
          type="button"
          class="md:hidden absolute right-4 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/35 flex-center active:scale-95 transition-transform z-10"
          style="bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 16px); width: 52px; height: 52px"
          @click="openAdd"
        >
          <el-icon :size="24"><Plus /></el-icon>
        </button>
      </main>

      <!-- 手机端底部导航 -->
      <nav
        class="tabbar safe-bottom md:hidden shrink-0 z-20 bg-white/95 backdrop-blur-xl"
      >
        <div class="h-[58px] flex">
          <button
            v-for="t in [
              { key: 'schedule', label: '课表', icon: 'Calendar' },
              { key: 'courses', label: '课程', icon: 'Notebook' },
              { key: 'settings', label: '设置', icon: 'Setting' }
            ]"
            :key="t.key"
            type="button"
            class="tab-item flex-1 flex-center flex-col gap-[3px] select-none transition-transform duration-150 active:scale-90"
            :class="
              activeTab === t.key || (t.key === 'settings' && settingsVisible)
                ? 'is-active'
                : ''
            "
            @click="t.key === 'settings' ? (settingsVisible = true) : (activeTab = t.key)"
          >
            <span class="tab-pill flex-center w-12 h-[30px] rounded-full transition-all duration-200">
              <el-icon :size="20">
                <component :is="t.icon" />
              </el-icon>
            </span>
            <span class="tab-label text-[11px] leading-none transition-colors duration-200">{{
              t.label
            }}</span>
          </button>
        </div>
      </nav>

      <!-- 弹窗 -->
      <CourseDialog v-model="courseDialogVisible" :course="editingCourse" />
      <ImportDialog v-model="importVisible" />
      <SettingsDialog v-model="settingsVisible" />
    </div>
  </el-config-provider>
</template>
