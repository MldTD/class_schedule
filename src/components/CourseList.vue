<script setup>
import { ref, computed } from 'vue'
import { useSchedule } from '../composables/useSchedule'
import { WEEKDAY_NAMES } from '../data/defaults'
import { summarizeWeeks } from '../utils/time'

const emit = defineEmits(['edit', 'delete', 'add'])
const { courses, colorOf } = useSchedule()
const keyword = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return courses.value
  return courses.value.filter(
    (c) =>
      c.name.includes(kw) ||
      c.teacher.includes(kw) ||
      c.location.includes(kw)
  )
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-3 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
      <el-input
        v-model="keyword"
        placeholder="搜索课程 / 教师 / 教室"
        clearable
        :prefix-icon="'Search'"
        size="default"
      />
      <el-button type="primary" @click="emit('add')">
        <el-icon class="mr-1"><Plus /></el-icon><span class="hidden sm:inline">添加</span>
      </el-button>
    </div>

    <div class="flex-1 overflow-auto schedule-scroll p-3">
      <div v-if="!filtered.length" class="flex-center flex-col h-full text-gray-400">
        <el-icon :size="48" class="mb-3"><Notebook /></el-icon>
        <p class="text-sm">{{ keyword ? '没有匹配的课程' : '还没有课程，点击右上角添加或导入课表' }}</p>
      </div>

      <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 pb-4">
        <el-card
          v-for="course in filtered"
          :key="course.id"
          shadow="hover"
          :body-style="{ padding: '14px 16px' }"
          class="course-card"
        >
          <div class="flex items-start gap-3">
            <span
              class="w-1.5 self-stretch rounded-full shrink-0 min-h-[44px]"
              :style="{ background: colorOf(course) }"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <span class="font-bold text-[15px] truncate">{{ course.name }}</span>
                <div class="flex gap-1 shrink-0">
                  <el-button size="small" link @click="emit('edit', course)">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-button size="small" link type="danger" @click="emit('delete', course)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
              <div class="mt-1 text-[12px] text-gray-500 space-y-0.5">
                <div v-if="course.teacher" class="flex items-center gap-1">
                  <el-icon><User /></el-icon>{{ course.teacher }}
                </div>
                <div v-if="course.location" class="flex items-center gap-1">
                  <el-icon><Location /></el-icon>{{ course.location }}
                </div>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <el-tag
                  v-for="(s, i) in course.sections"
                  :key="i"
                  size="small"
                  effect="plain"
                  class="!rounded-md"
                >
                  {{ WEEKDAY_NAMES[s.day - 1] }}
                  第{{ s.startPeriod }}{{ s.endPeriod > s.startPeriod ? `-${s.endPeriod}` : '' }}节
                  · {{ summarizeWeeks(s.weeks) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
