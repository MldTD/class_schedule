<script setup>
import { computed } from 'vue'
import { useSchedule } from '../composables/useSchedule'
import { WEEKDAY_NAMES } from '../data/defaults'
import { mondayOfWeek, addDays, weekdayOf, fmtDate, summarizeWeeks } from '../utils/time'

const props = defineProps({
  week: { type: Number, required: true },
  // 0 = 显示全部天（桌面）；1-7 = 只显示某一天（手机）
  dayFilter: { type: Number, default: 0 }
})
const emit = defineEmits(['edit', 'delete'])

const { settings, courses, colorOf } = useSchedule()

const ROW_H = 62

const days = computed(() => {
  if (props.dayFilter) return [props.dayFilter]
  return settings.showWeekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5]
})

const weekMonday = computed(() => mondayOfWeek(props.week, settings.semesterStart))
const today = new Date()

function dateOf(day) {
  return addDays(weekMonday.value, day - 1)
}
function isToday(day) {
  return fmtDate(dateOf(day)) === fmtDate(today)
}

const periods = computed(() => settings.periodTimes)
const totalH = computed(() => periods.value.length * ROW_H)

/** 按天收集本周课程块，并对时间冲突分栏 */
const layout = computed(() => {
  const result = {}
  for (const day of days.value) {
    const blocks = []
    for (const course of courses.value) {
      for (const section of course.sections) {
        if (section.day !== day) continue
        if (!section.weeks.includes(props.week)) continue
        blocks.push({
          course,
          section,
          start: section.startPeriod,
          end: section.endPeriod,
          lane: 0,
          lanes: 1
        })
      }
    }
    blocks.sort((a, b) => a.start - b.start || a.end - b.end)

    // 贪心分栏
    const laneEnds = []
    for (const b of blocks) {
      let placed = -1
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] < b.start) {
          placed = i
          break
        }
      }
      if (placed < 0) {
        placed = laneEnds.length
        laneEnds.push(b.end)
      } else {
        laneEnds[placed] = b.end
      }
      b.lane = placed
    }
    // 标注每个重叠组的栏位数
    for (let i = 0; i < blocks.length; i++) {
      const group = blocks.filter(
        (b) => b !== blocks[i] && b.start <= blocks[i].end && b.end >= blocks[i].start
      )
      if (group.length) {
        const all = [blocks[i], ...group]
        const lanes = new Set(all.map((b) => b.lane)).size
        all.forEach((b) => (b.lanes = Math.max(b.lanes, lanes)))
      }
    }
    result[day] = blocks
  }
  return result
})

function blockStyle(b) {
  const pct = 100 / b.lanes
  return {
    top: `${(b.start - 1) * ROW_H + 2}px`,
    height: `${(b.end - b.start + 1) * ROW_H - 4}px`,
    left: `calc(${b.lane * pct}% + 2px)`,
    width: `calc(${pct}% - 4px)`,
    background: colorOf(b.course) + '1f',
    borderLeft: `3px solid ${colorOf(b.course)}`
  }
}

function blockTextStyle(b) {
  return { color: colorOf(b.course) }
}

function sectionText(b) {
  return `${WEEKDAY_NAMES[b.section.day - 1]} 第${b.section.startPeriod}${
    b.section.endPeriod > b.section.startPeriod ? `-${b.section.endPeriod}` : ''
  }节`
}

function onEdit(course) {
  emit('edit', course)
}
function onDelete(course) {
  emit('delete', course)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 表头：星期 + 日期 -->
    <div
      class="grid sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200"
      :style="{ gridTemplateColumns: `48px repeat(${days.length}, minmax(64px, 1fr))` }"
    >
      <div class="h-11 flex-center text-[11px] text-gray-400">节次</div>
      <div
        v-for="day in days"
        :key="day"
        class="h-11 flex flex-col items-center justify-center leading-tight"
        :class="isToday(day) ? 'text-brand-500' : 'text-gray-600'"
      >
        <span class="text-[13px] font-semibold">{{ WEEKDAY_NAMES[day - 1] }}</span>
        <span class="text-[10px]" :class="isToday(day) ? 'text-brand-500' : 'text-gray-400'">
          {{ dateOf(day).getMonth() + 1 }}/{{ dateOf(day).getDate() }}
        </span>
      </div>
    </div>

    <!-- 课表主体 -->
    <div class="flex-1 schedule-scroll overflow-auto">
      <div
        class="grid min-h-full"
        :style="{ gridTemplateColumns: `48px repeat(${days.length}, minmax(64px, 1fr))` }"
      >
        <!-- 节次/时间列 -->
        <div class="relative" :style="{ height: `${totalH}px` }">
          <div
            v-for="(p, i) in periods"
            :key="i"
            class="absolute left-0 right-0 flex flex-col items-center justify-center border-b border-gray-100"
            :style="{ top: `${i * ROW_H}px`, height: `${ROW_H}px` }"
          >
            <span class="text-[12px] font-semibold text-gray-500">{{ i + 1 }}</span>
            <span class="text-[9px] text-gray-400 mt-0.5">{{ p.start }}</span>
          </div>
        </div>

        <!-- 每天一列 -->
        <div
          v-for="day in days"
          :key="day"
          class="relative border-l border-gray-100"
          :class="isToday(day) ? 'bg-brand-50/40' : ''"
          :style="{ height: `${totalH}px` }"
        >
          <!-- 横向网格线 -->
          <div
            v-for="(p, i) in periods"
            :key="i"
            class="absolute left-0 right-0 border-b border-gray-100 pointer-events-none"
            :style="{ top: `${(i + 1) * ROW_H}px` }"
          />

          <el-popover
            v-for="b in layout[day]"
            :key="b.course.id + b.section.startPeriod + b.section.endPeriod"
            placement="top"
            :width="250"
            trigger="click"
            popper-class="course-popover"
          >
            <template #reference>
              <button class="course-block" :style="blockStyle(b)">
                <span class="course-name text-[12px]" :style="blockTextStyle(b)">
                  {{ b.course.name }}
                </span>
                <span v-if="b.end - b.start >= 1" class="course-meta text-gray-600">
                  {{ b.course.location || '—' }}
                </span>
                <span v-if="b.end - b.start >= 2" class="course-meta text-gray-500">
                  {{ b.course.teacher || '' }}
                </span>
              </button>
            </template>

            <div class="py-1">
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ background: colorOf(b.course) }"
                />
                <span class="font-bold text-[15px]">{{ b.course.name }}</span>
              </div>
              <div class="space-y-1 text-[13px] text-gray-600">
                <div v-if="b.course.teacher" class="flex gap-2">
                  <el-icon><User /></el-icon><span>{{ b.course.teacher }}</span>
                </div>
                <div v-if="b.course.location" class="flex gap-2">
                  <el-icon><Location /></el-icon><span>{{ b.course.location }}</span>
                </div>
                <div class="flex gap-2">
                  <el-icon><Clock /></el-icon><span>{{ sectionText(b) }}</span>
                </div>
                <div class="flex gap-2">
                  <el-icon><Calendar /></el-icon>
                  <span>{{ summarizeWeeks(b.section.weeks) }}</span>
                </div>
              </div>
              <div class="mt-3 pt-2 border-t border-gray-100 flex justify-end gap-2">
                <el-button size="small" @click="onDelete(b.course)">删除</el-button>
                <el-button size="small" type="primary" @click="onEdit(b.course)">编辑</el-button>
              </div>
            </div>
          </el-popover>
        </div>
      </div>
    </div>
  </div>
</template>
