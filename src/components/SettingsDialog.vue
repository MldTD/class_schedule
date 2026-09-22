<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSchedule } from '../composables/useSchedule'
import { DEFAULT_PERIODS } from '../data/defaults'
import { PLATFORM } from '../utils/platform'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const { settings, saveSettings, resetSettings, courses, clearCourses } = useSchedule()

const local = ref(cloneSettings())

function cloneSettings() {
  return {
    semesterStart: settings.semesterStart,
    totalWeeks: settings.totalWeeks,
    showWeekend: settings.showWeekend,
    periodTimes: settings.periodTimes.map((p) => ({ ...p }))
  }
}

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

watch(visible, (v) => {
  if (v) local.value = cloneSettings()
})

function addPeriod() {
  const last = local.value.periodTimes[local.value.periodTimes.length - 1]
  const start = last ? addMinutes(last.end, 10) : '08:00'
  const end = addMinutes(start, 45)
  local.value.periodTimes.push({ start, end })
}
function addMinutes(t, delta) {
  const [h, m] = t.split(':').map(Number)
  let total = h * 60 + m + delta
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}
function removePeriod(i) {
  local.value.periodTimes.splice(i, 1)
}
function restorePeriods() {
  local.value.periodTimes = DEFAULT_PERIODS.map((p) => ({ ...p }))
}

function onSave() {
  if (!local.value.periodTimes.length) {
    ElMessage.warning('至少保留一个节次')
    return
  }
  saveSettings({
    semesterStart: local.value.semesterStart,
    totalWeeks: local.value.totalWeeks,
    showWeekend: local.value.showWeekend,
    periodTimes: local.value.periodTimes
  })
  ElMessage.success('设置已保存')
  visible.value = false
}

async function onResetSettings() {
  await ElMessageBox.confirm('确定恢复默认作息与学期设置吗？', '提示', { type: 'warning' })
  resetSettings()
  local.value = cloneSettings()
  ElMessage.success('已恢复默认设置')
}

async function onClearCourses() {
  await ElMessageBox.confirm(
    `将删除全部 ${courses.value.length} 门课程，且不可恢复，建议先导出备份。确定继续？`,
    '清空课程',
    { type: 'warning', confirmButtonText: '全部删除', confirmButtonClass: 'el-button--danger' }
  )
  clearCourses()
  ElMessage.success('课程已清空')
}

function exportBackup() {
  const data = {
    app: 'class-schedule',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    courses: courses.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `课表备份-${settings.semesterStart}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importBackup(uploadFile) {
  const file = uploadFile.raw || uploadFile
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data.courses)) throw new Error('备份文件中没有课程数据')
    await ElMessageBox.confirm(
      `备份包含 ${data.courses.length} 门课程，导入将替换当前全部数据，确定继续？`,
      '恢复备份',
      { type: 'warning' }
    )
    if (data.settings) saveSettings(data.settings)
    saveSettings({}) // 触发持久化
    const { importCourses } = useSchedule()
    importCourses(data.courses, 'replace')
    local.value = cloneSettings()
    ElMessage.success('备份已恢复')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('恢复失败：' + (e.message || '文件无效'))
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="课表设置" width="560px" destroy-on-close>
    <el-form label-position="top">
      <el-row :gutter="12">
        <el-col :xs="24" :sm="12">
          <el-form-item label="学期第一周的周一">
            <el-date-picker
              v-model="local.semesterStart"
              type="date"
              value-format="YYYY-MM-DD"
              class="w-full"
              placeholder="选择日期"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="学期总周数">
            <el-input-number v-model="local.totalWeeks" :min="1" :max="30" class="w-full" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item>
        <el-switch v-model="local.showWeekend" active-text="显示周末（周六、周日）" />
      </el-form-item>

      <el-divider content-position="left">
        <div class="flex items-center justify-between w-full pr-2">
          <span>作息时间（{{ local.periodTimes.length }} 节）</span>
          <el-button size="small" link @click="restorePeriods">恢复默认</el-button>
        </div>
      </el-divider>

      <div class="max-h-64 overflow-auto schedule-scroll pr-1">
        <div
          v-for="(p, i) in local.periodTimes"
          :key="i"
          class="flex items-center gap-2 mb-2"
        >
          <span class="w-12 text-[13px] text-gray-500 shrink-0">第{{ i + 1 }}节</span>
          <el-time-picker
            v-model="p.start"
            format="HH:mm"
            value-format="HH:mm"
            class="flex-1"
            size="small"
            :clearable="false"
          />
          <span class="text-gray-400">~</span>
          <el-time-picker
            v-model="p.end"
            format="HH:mm"
            value-format="HH:mm"
            class="flex-1"
            size="small"
            :clearable="false"
          />
          <el-button
            size="small"
            link
            type="danger"
            :disabled="local.periodTimes.length <= 1"
            @click="removePeriod(i)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
      <el-button size="small" plain class="mt-1" @click="addPeriod">
        <el-icon class="mr-1"><Plus /></el-icon>添加一节
      </el-button>

      <el-divider content-position="left">备份与恢复</el-divider>
      <div class="flex gap-2 flex-wrap">
        <el-button @click="exportBackup">
          <el-icon class="mr-1"><Download /></el-icon>导出 JSON 备份
        </el-button>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".json"
          :on-change="importBackup"
        >
          <el-button>
            <el-icon class="mr-1"><Upload /></el-icon>恢复备份
          </el-button>
        </el-upload>
      </div>

      <el-divider />
      <div class="flex-between flex-wrap gap-2">
        <span class="text-[12px] text-gray-400">当前平台：{{ PLATFORM }} · 数据仅保存在本机</span>
        <el-button type="danger" plain size="small" @click="onClearCourses">清空全部课程</el-button>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="onResetSettings">恢复默认</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onSave">保存设置</el-button>
    </template>
  </el-dialog>
</template>
