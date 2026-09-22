# 课程表 Class Schedule

一个跨平台课程表应用：同一套代码同时支持 **网页浏览器、电脑桌面（Tauri）、Android 手机（Capacitor）**。
支持导入教务系统导出的 Excel/CSV 课表以及日历 `.ics` 文件，自动识别星期、节次、单双周、教室与教师，数据全部保存在本地。

## 功能特性

- **课表网格**：周视图展示，自动处理时间冲突分栏；桌面显示整周，手机端显示单天并可横向切换星期
- **周次导航**：按学期设置计算当前周，支持前后翻周、下拉选周、一键回到本周；单周 / 双周课程正确过滤
- **课程管理**：添加 / 编辑 / 删除课程，支持一门课多个上课时段、自定义颜色（不选则按课程名自动配色）
- **文件导入**
  - Excel（`.xlsx` / `.xls`）与 CSV，兼容教务系统常见的**矩阵式**（行=节次、列=星期）与**清单式**（每行一门课）
  - 默认即适配教务系统标准单元格格式：`课程名/(1-2节)1-16周/校区 地点/教师/课程编号/教学班/学时/学分`
  - 支持 `1-15周(单)`、`2-16周(双)` 等单双周写法、中文节次行（一=1-2节…五=9-10节）、同一单元格内多门课换行分隔
  - 导入前可预览、多选、合并或替换；**解析格式可自定义**（表格类型 / 分隔符 / 字段顺序 / 节次来源），设置自动保存
  - 内置标准 `.xlsx` 模板下载，以及清单式 CSV 示例
  - 支持 `.ics` 日历文件（RRULE 循环、COUNT、单双周，按上课时间自动匹配节次）
- **学期设置**：学期开始日期（周一）、总周数、是否显示周末、每节课起止时间均可自定义
- **备份恢复**：设置支持导出 / 导入 JSON 备份
- **本地存储**：课程与设置保存在浏览器 / WebView 的 localStorage，无需后端、无需注册
- **响应式界面**：桌面顶栏 + 手机底部三 Tab 导航，适配刘海屏安全区域

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端框架 | Vue 3（Composition API）+ Vite 5 |
| UI | Element Plus + @element-plus/icons-vue |
| 原子化 CSS | UnoCSS |
| 文件解析 | SheetJS（xlsx）、ics-parser |
| 桌面端 | Tauri 2（`src-tauri/`，窗口 1180×800） |
| 移动端 | Capacitor 6 + Android（`android/`，appId `com.classschedule.app`） |

## 环境要求

- Node.js **≥ 18**（推荐 20 LTS），npm ≥ 9
- 桌面打包另需 [Rust 工具链](https://www.rust-lang.org/tools/install)
- Android 打包另需 Android Studio（JDK 17 + Android SDK）

> 国内网络安装依赖慢时可使用镜像：`npm install --registry=https://registry.npmmirror.com`

## 快速开始

```bash
# 安装依赖
npm install

# 网页开发（http://127.0.0.1:5173 ）
npm run dev

# 网页生产构建 → dist/
npm run build
```

### 电脑桌面应用（Tauri）

```bash
npm run tauri:dev      # 开发调试（自动起 Vite 并打开桌面窗口）
npm run build:tauri    # 仅构建前端资源 → dist-tauri/（相对路径）
npm run tauri:build    # 打包桌面安装包（需要 Rust）
```

### Android 手机应用（Capacitor）

```bash
npm run build:capacitor   # 构建手机端前端资源（base: './'）
npx cap sync android      # 同步到原生工程
npm run android           # 上面两步的合并命令
```

然后用 Android Studio 打开 `android/` 目录，连接手机运行或打 APK：

```bash
npx cap open android
```

首次初始化（已执行过，一般无需再跑）：`npx cap add android`。

## 课表文件导入说明

应用在导入弹窗中提供「解析格式设置」，默认值即多数高校教务系统导出的标准格式：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| 表格类型 | 自动识别 | 可强制矩阵式 / 清单式 |
| 字段分隔符 | `/` | 可选换行、逗号、分号、空格、Tab 或自定义字符 |
| 字段顺序 | 课程名称 → 周次(含节次) → 上课地点 → 授课教师 → 忽略 | 可增删字段位、拖拽调整含义 |
| 节次来源 | 单元格内 `(1-2节)` | 也可只按表格节次行解析 |

配置自动持久化到本地，点「恢复默认格式」可还原。不确定格式时，先点「下载标准模板 .xlsx」按模板填写。

## 数据结构

```ts
// 课程
{
  id: string,
  name: string,
  teacher: string,
  location: string,
  color: string,              // 空串 = 按名称自动配色
  sections: [{
    day: 1 | 2 | ... | 7,     // 周一=1
    startPeriod: number,
    endPeriod: number,
    weeks: number[]           // 上课周次，如 [1,3,5,7] 表示单周
  }]
}

// 设置
{
  semesterStart: 'YYYY-MM-DD',// 学期第一周的周一
  totalWeeks: number,
  showWeekend: boolean,
  periodTimes: [{ start: 'HH:mm', end: 'HH:mm' }]
}
```

localStorage 键：`class-schedule:courses:v1`、`class-schedule:settings:v1`、`class-schedule:import-format:v1`。

## 目录结构

```
class_schedule/
├─ src/
│  ├─ components/          # ScheduleGrid / CourseDialog / CourseList / ImportDialog / SettingsDialog
│  ├─ composables/         # useSchedule：模块级单例 store（课程、设置、周次）
│  ├─ data/defaults.js     # 默认节次时间、颜色、示例课程
│  ├─ utils/
│  │  ├─ excelParser.js    # Excel/CSV 解析（矩阵 + 清单 + 可配置字段映射）
│  │  ├─ icsParser.js      # ICS 解析（RRULE/COUNT/单双周）
│  │  ├─ importFormat.js   # 导入格式配置（默认教务格式）
│  │  ├─ template.js       # 标准 xlsx 模板生成
│  │  ├─ time.js           # 周一为起点的周次/日期工具
│  │  ├─ storage.js        # localStorage 封装
│  │  └─ platform.js       # web / tauri / capacitor 环境判断
│  ├─ App.vue              # 响应式外壳（桌面顶栏 / 手机底部导航）
│  └─ main.js
├─ public/samples/         # 清单式 CSV 示例
├─ src-tauri/              # Tauri 桌面壳（配置、图标、Rust 入口）
├─ android/                # Capacitor Android 原生工程
├─ scripts/gen-icon.mjs    # 应用图标生成脚本
├─ vite.config.js          # 多端 mode：web / tauri / capacitor
└─ capacitor.config.json
```

## 开发备注

- Vite 按 mode 切换 `base` 与产物目录：web → `dist/`（`/`），tauri → `dist-tauri/`，capacitor → `dist/`（`./` 相对路径）
- `ics-parser` 当前版本为 0.1.x（函数式 API，接收原始 ICS 字符串，不解析 RRULE），项目内额外实现了 RFC5545 规则补齐
- 应用数据完全本地化，不包含任何网络请求与账号体系

## License

MIT
