<script setup>
import { ref, watch, computed } from 'vue'
import { useSchedule } from '../composables/useSchedule'
import { WEEKDAY_NAMES, COURSE_COLORS } from '../data/defaults'
import { expandWeeks } from '../utils/time'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  course: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const { settings, addCourse, updateCourse } = useSchedule()

const formRef = ref(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    id: '',
    name: '',
    teacher: '',
    location: '',
    color: '',
    sections: [emptySection()]
  }
}
function emptySection() {
  return { day: 1, startPeriod: 1, endPeriod: 2, weekStart: 1, weekEnd: 16, parity: 'all' }
}

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const rules = {
  name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }]
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    if (props.course) {
      const secs = props.course.sections.length
        ? props.course.sections.map((s) => {
            const ws = [...s.weeks].sort((a, b) => a - b)
            let parity = 'all'
            if (ws.length > 1) {
              if (ws.every((w) => w % 2 === 1)) parity = 'odd'
              else if (ws.every((w) => w % 2 === 0)) parity = 'even'
            }
            return {
              day: s.day,
              startPeriod: s.startPeriod,
              endPeriod: s.endPeriod,
              weekStart: ws[0] || 1,
              weekEnd: ws[ws.length - 1] || 16,
              parity
            }
          })
        : [emptySection()]
      form.value = {
        id: props.course.id,
        name: props.course.name,
        teacher: props.course.teacher || '',
        location: props.course.location || '',
        color: props.course.color || '',
        sections: secs
      }
    } else {
      form.value = emptyForm()
    }
    formRef.value?.clearValidate?.()
  }
)

const periodCount = computed(() => settings.periodTimes.length)
const periodOptions = computed(() =>
  settings.periodTimes.map((p, i) => ({
    value: i + 1,
    label: `第${i + 1}节 ${p.start}`
  }))
)

function addSection() {
  form.value.sections.push(emptySection())
}
function removeSection(i) {
  form.value.sections.splice(i, 1)
}
function onStartChange(sec) {
  if (sec.endPeriod < sec.startPeriod) sec.endPeriod = sec.startPeriod
}

async function onSave() {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    const payload = {
      id: form.value.id || undefined,
      name: form.value.name.trim(),
      teacher: form.value.teacher.trim(),
      location: form.value.location.trim(),
      color: form.value.color,
      sections: form.value.sections.map((s) => ({
        day: s.day,
        startPeriod: s.startPeriod,
        endPeriod: Math.max(s.endPeriod, s.startPeriod),
        weeks: expandWeeks(
          Math.min(s.weekStart, s.weekEnd),
          Math.max(s.weekStart, s.weekEnd),
          s.parity
        )
      }))
    }
    if (form.value.id) updateCourse(payload)
    else addCourse(payload)
    visible.value = false
    emit('saved')
  })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="course ? '编辑课程' : '添加课程'"
    width="560px"
    destroy-on-close
    class="course-dialog"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-row :gutter="12">
        <el-col :xs="24" :sm="12">
          <el-form-item label="课程名称" prop="name">
            <el-input v-model="form.name" placeholder="如：高等数学" maxlength="30" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="授课教师">
            <el-input v-model="form.teacher" placeholder="如：王老师" maxlength="20" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="上课地点">
        <el-input v-model="form.location" placeholder="如：教学楼A-101" maxlength="30" />
      </el-form-item>

      <el-form-item label="颜色">
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-for="c in COURSE_COLORS"
            :key="c"
            type="button"
            class="w-6 h-6 rounded-full transition-transform"
            :class="form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''"
            :style="{ background: c }"
            @click="form.color = c"
          />
          <el-color-picker v-model="form.color" size="small" class="ml-1" />
          <span v-if="form.color" class="text-[12px] text-gray-400">点击色块可重置为自动</span>
          <button
            v-if="form.color"
            type="button"
            class="text-[12px] text-brand-500 ml-1"
            @click="form.color = ''"
          >
            自动配色
          </button>
        </div>
      </el-form-item>

      <el-divider content-position="left">上课时间</el-divider>

      <div
        v-for="(sec, i) in form.sections"
        :key="i"
        class="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-[13px] font-semibold text-gray-500">时段 {{ i + 1 }}</span>
          <el-button
            v-if="form.sections.length > 1"
            type="danger"
            size="small"
            link
            @click="removeSection(i)"
          >
            删除
          </el-button>
        </div>
        <el-row :gutter="8">
          <el-col :span="8">
            <el-select v-model="sec.day" class="w-full">
              <el-option
                v-for="(name, d) in WEEKDAY_NAMES"
                :key="d"
                :label="name"
                :value="d + 1"
              />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-select v-model="sec.startPeriod" class="w-full" @change="onStartChange(sec)">
              <el-option
                v-for="opt in periodOptions"
                :key="opt.value"
                :label="`第${opt.value}节`"
                :value="opt.value"
              />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-select v-model="sec.endPeriod" class="w-full">
              <el-option
                v-for="opt in periodOptions.filter((o) => o.value >= sec.startPeriod)"
                :key="opt.value"
                :label="`至第${opt.value}节`"
                :value="opt.value"
              />
            </el-select>
          </el-col>
        </el-row>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <span class="text-[12px] text-gray-500 shrink-0">周次</span>
          <el-input-number
            v-model="sec.weekStart"
            :min="1"
            :max="settings.totalWeeks"
            :controls="false"
            size="small"
            class="w-16"
          />
          <span class="text-gray-400">至</span>
          <el-input-number
            v-model="sec.weekEnd"
            :min="1"
            :max="settings.totalWeeks"
            :controls="false"
            size="small"
            class="w-16"
          />
          <span class="text-gray-400">周</span>
          <el-radio-group v-model="sec.parity" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="odd">单周</el-radio-button>
            <el-radio-button value="even">双周</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <el-button type="primary" plain class="w-full" @click="addSection">
        <el-icon class="mr-1"><Plus /></el-icon>添加一个上课时段
      </el-button>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>
