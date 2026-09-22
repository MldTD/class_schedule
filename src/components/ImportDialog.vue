<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useSchedule } from '../composables/useSchedule'
import { parseScheduleFile } from '../utils/excelParser'
import { parseICSFile } from '../utils/icsParser'
import {
  FIELD_OPTIONS,
  FIELD_LABELS,
  SEPARATOR_PRESETS,
  MODE_OPTIONS,
  loadImportFormat,
  saveImportFormat,
  makeDefaultFormat
} from '../utils/importFormat'
import { downloadScheduleTemplate } from '../utils/template'
import { WEEKDAY_NAMES } from '../data/defaults'
import { summarizeWeeks } from '../utils/time'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'imported'])

const { settings, mergeCourseList, importCourses } = useSchedule()

const activeTab = ref('excel')
const loading = ref(false)
const stage = ref('select')
const warnings = ref([])
const parsedCourses = ref([])
const selected = ref([])
const mergeMode = ref('merge')
const fileName = ref('')

const fmtCollapse = ref([])

// 导入格式（默认=教务系统标准格式），改动自动持久化
const fmt = reactive(loadImportFormat())
watch(
  fmt,
  (v) => saveImportFormat(v),
  { deep: true }
)

const sepSelectValue = computed({
  get: () => (SEPARATOR_PRESETS.some((p) => p.value === fmt.separator) ? fmt.separator : '__custom__'),
  set: (v) => {
    if (v !== '__custom__') fmt.separator = v
  }
})

const formatHint = computed(() =>
  fmt.fields.map((f) => FIELD_LABELS[f]).join(' → ')
)

function addField() {
  if (fmt.fields.length < 12) fmt.fields.push('ignore')
}
function removeField(i) {
  if (fmt.fields.length > 1) fmt.fields.splice(i, 1)
}
function resetFormat() {
  Object.assign(fmt, makeDefaultFormat())
  ElMessage.success('已恢复为教务系统标准格式')
}

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

watch(visible, (v) => {
  if (v) reset()
})

function reset() {
  stage.value = 'select'
  warnings.value = []
  parsedCourses.value = []
  selected.value = []
  fileName.value = ''
  mergeMode.value = 'merge'
}

function switchTab() {
  reset()
}

async function handleFile(uploadFile) {
  const file = uploadFile.raw || uploadFile
  if (!file) return
  loading.value = true
  warnings.value = []
  try {
    const name = file.name.toLowerCase()
    const isICS = name.endsWith('.ics')
    let result
    if (isICS) {
      result = await parseICSFile(file, settings)
    } else {
      result = await parseScheduleFile(file, settings.totalWeeks, fmt)
    }
    fileName.value = file.name
    parsedCourses.value = mergeCourseList(result.courses)
    warnings.value = result.warnings || []
    selected.value = [...parsedCourses.value]
    stage.value = 'preview'
    if (!parsedCourses.value.length) ElMessage.warning('未能从文件中解析到课程')
  } catch (e) {
    console.error(e)
    ElMessage.error('文件解析失败：' + (e.message || '文件格式不受支持'))
  } finally {
    loading.value = false
  }
}

function onSelectionChange(rows) {
  selected.value = rows
}

function confirmImport() {
  if (!selected.value.length) {
    ElMessage.warning('请至少选择一门课程')
    return
  }
  importCourses(selected.value, mergeMode.value)
  ElMessage.success(`已${mergeMode.value === 'replace' ? '替换' : '合并'}导入 ${selected.value.length} 门课程`)
  visible.value = false
  emit('imported', selected.value.length)
}

const sampleUrl = `${import.meta.env.BASE_URL}samples/sample.csv`
</script>

<template>
  <el-dialog
    v-model="visible"
    title="导入课表文件"
    width="680px"
    destroy-on-close
    class="import-dialog"
  >
    <!-- 第一步：选择文件 -->
    <div v-if="stage === 'select'">
      <el-tabs v-model="activeTab" @tab-change="switchTab">
        <el-tab-pane label="Excel / CSV" name="excel" />
        <el-tab-pane label="日历 (.ics)" name="ics" />
      </el-tabs>

      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        :accept="activeTab === 'excel' ? '.xlsx,.xls,.csv' : '.ics'"
        :on-change="handleFile"
      >
        <el-icon class="el-icon--upload" :size="42" color="#4f8cff">
          <UploadFilled v-if="activeTab === 'excel'" />
          <Calendar v-else />
        </el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击选择</em>
        </div>
        <template #tip>
          <div class="text-[12px] text-gray-400 mt-2 leading-relaxed">
            <template v-if="activeTab === 'excel'">
              默认兼容教务系统导出的标准课表（矩阵式，单元格形如
              <span class="text-gray-500">课程/(1-2节)1-16周/校区 地点/教师/…</span>
              ），也支持清单式 CSV，自动识别星期、节次、单双周、教室与教师
              <br />
              <a href="javascript:void(0)" class="text-brand-500" @click="downloadScheduleTemplate">下载标准模板 .xlsx</a>
              ｜
              <a :href="sampleUrl" download="sample-schedule.csv" class="text-brand-500">下载清单示例 CSV</a>
            </template>
            <template v-else>
              支持日历应用（如 Outlook、Google Calendar、iCal）导出的 .ics 文件，
              按上课时间自动匹配节次
            </template>
          </div>
        </template>
      </el-upload>

      <!-- 解析格式自定义（仅 Excel/CSV） -->
      <el-collapse v-if="activeTab === 'excel'" v-model="fmtCollapse" class="fmt-collapse mt-1">
        <el-collapse-item name="fmt">
          <template #title>
            <span class="text-[13px] font-medium text-gray-600">解析格式设置</span>
            <el-tag size="small" type="info" effect="plain" round class="ml-2 !text-[11px]">
              {{ fmt.mode === 'auto' ? '自动识别' : fmt.mode === 'matrix' ? '矩阵式' : '清单式' }}
            </el-tag>
          </template>

          <div class="fmt-row">
            <span class="fmt-label">表格类型</span>
            <el-radio-group v-model="fmt.mode" size="small">
              <el-radio-button v-for="m in MODE_OPTIONS" :key="m.value" :value="m.value">
                {{ m.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <div class="fmt-row">
            <span class="fmt-label">字段分隔符</span>
            <el-select v-model="sepSelectValue" size="small" class="!w-[220px]">
              <el-option v-for="p in SEPARATOR_PRESETS" :key="p.value" :value="p.value" :label="p.label" />
            </el-select>
            <el-input
              v-if="sepSelectValue === '__custom__'"
              v-model="fmt.separator"
              size="small"
              placeholder="输入自定义分隔符，如 @"
              class="!w-[160px] ml-2"
            />
          </div>

          <div class="fmt-row items-start">
            <span class="fmt-label mt-1">字段顺序</span>
            <div class="flex-1">
              <div v-for="(f, i) in fmt.fields" :key="i" class="flex items-center mb-1">
                <span class="text-[12px] text-gray-400 w-12">第{{ i + 1 }}段</span>
                <el-select v-model="fmt.fields[i]" size="small" class="!w-[150px]">
                  <el-option v-for="o in FIELD_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                </el-select>
                <el-button
                  link
                  size="small"
                  class="!ml-1"
                  :disabled="fmt.fields.length <= 1"
                  @click="removeField(i)"
                >
                  删除
                </el-button>
              </div>
              <el-button size="small" plain @click="addField">+ 添加字段位</el-button>
              <div class="text-[11px] text-gray-400 mt-1 break-all">
                当前映射：{{ formatHint }}　更多段默认忽略
              </div>
            </div>
          </div>

          <div class="fmt-row">
            <span class="fmt-label">节次来源</span>
            <el-radio-group v-model="fmt.periodSource" size="small">
              <el-radio value="cell">单元格内 (1-2节)</el-radio>
              <el-radio value="row">表格节次行（一/二/三…）</el-radio>
            </el-radio-group>
          </div>

          <div class="fmt-row">
            <el-button size="small" @click="resetFormat">恢复默认格式</el-button>
            <span class="text-[11px] text-gray-400 ml-2">格式设置会自动保存，下次导入继续生效</span>
          </div>
        </el-collapse-item>
      </el-collapse>

      <el-skeleton v-if="loading" :rows="4" animated class="mt-4" />
    </div>

    <!-- 第二步：预览确认 -->
    <div v-else v-loading="loading">
      <div class="flex-between mb-3">
        <div class="text-[13px] text-gray-500 truncate mr-2">
          <el-icon class="align-middle mr-1"><Document /></el-icon>
          {{ fileName }}
        </div>
        <el-button size="small" link @click="reset">重新选择文件</el-button>
      </div>

      <el-alert
        v-for="(w, i) in warnings"
        :key="i"
        :title="w"
        type="warning"
        :closable="false"
        show-icon
        class="mb-2"
      />

      <el-table
        :data="parsedCourses"
        max-height="340"
        size="small"
        class="mb-3"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="42" reserve-selection />
        <el-table-column label="课程" min-width="140">
          <template #default="{ row }">
            <div class="font-semibold">{{ row.name }}</div>
            <div class="text-[11px] text-gray-400">
              {{ [row.teacher, row.location].filter(Boolean).join(' · ') }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上课安排" min-width="220">
          <template #default="{ row }">
            <div class="flex flex-wrap gap-1">
              <el-tag
                v-for="(s, i) in row.sections"
                :key="i"
                size="small"
                effect="plain"
                class="!rounded-md"
              >
                {{ WEEKDAY_NAMES[s.day - 1] }} 第{{ s.startPeriod
                }}{{ s.endPeriod > s.startPeriod ? `-${s.endPeriod}` : '' }}节
                · {{ summarizeWeeks(s.weeks) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-radio-group v-model="mergeMode" class="mb-2">
        <el-radio value="merge">与现有课程合并</el-radio>
        <el-radio value="replace">替换全部现有课程</el-radio>
      </el-radio-group>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button v-if="stage === 'preview'" type="primary" @click="confirmImport">
        导入选中的 {{ selected.length }} 门课
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.fmt-collapse {
  border-top: none;
}
.fmt-collapse :deep(.el-collapse-item__header) {
  height: 36px;
  font-weight: normal;
}
.fmt-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.fmt-label {
  flex: 0 0 72px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
