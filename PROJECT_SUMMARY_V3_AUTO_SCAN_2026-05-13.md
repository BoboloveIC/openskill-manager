# OpenSkill Manager - 自动扫描与进度显示

**日期**: 2026-05-13 22:09 (GMT+8)  
**项目路径**: `/Users/boge/Downloads/公司/AI培训/OpenSkill/openskill-manager`

---

## 需求

用户要求应用初始化时自动扫描，并在主窗口中实时显示：
1. 扫描进度（阶段、进度条、当前扫描项）
2. 扫描日志（时间戳 + 消息）
3. 扫描结果（发现的平台和技能列表）

---

## 实现方案

### 三阶段 UI 视图切换

应用启动后有三个视图状态：

**视图 1: 扫描中 (`scanning && !scanComplete`)**
- 全屏扫描界面，居中显示
- 顶部：应用标题 + "正在扫描..." 副标题
- 中部：进度区域
  - 当前阶段（发现平台 / 扫描技能）
  - 进度条（已知总数时显示）
  - 当前扫描项（带 ✅/🔍 图标）
- 底部：实时日志滚动列表

**视图 2: 扫描完成 (`scanComplete && scanResult`)**
- 结果摘要卡片
- 发现的平台数 + 技能数（大字体统计）
- 平台列表预览（名称 + 技能数量）
- 技能列表预览（前 20 个）
- "进入管理界面" 按钮 → 切换到主界面
- "重新扫描" 按钮

**视图 3: 主管理界面（原有功能）**
- 侧边栏 + 技能网格 + 详情面板

### 主进程改动

1. **`sendProgress(phase, data)`** — 全局函数，向渲染进程发送进度事件
2. **`SkillDiscovery.fullScan()`** — 完整扫描流程：
   - 阶段 1：发现平台 → 逐个检测 `~/.` 下的目录
   - 阶段 2：扫描技能 → 逐平台逐技能扫描
   - 完成：发送最终统计
3. **`runAutoScan()`** — 在窗口 `ready-to-show` 后自动触发
4. **新增 IPC**: `open-in-finder` — 在 Finder 中显示文件

### 渲染进程改动

1. **App.tsx**: 新增 `scanProgress`、`scanLogs`、`scanComplete` 状态
2. **监听 `scan-progress` 事件**: 实时更新进度和日志
3. **条件渲染**: 根据 `scanning` / `scanComplete` 切换视图
4. **CSS**: 新增扫描视图样式（进度条、日志列表、结果卡片）

---

## 打包输出

- `dist/OpenSkill Manager-1.0.0-arm64.dmg` (1.2 GB)
- `dist/OpenSkill Manager-1.0.0-arm64-mac.zip` (1.2 GB)

> ⚠️ 打包体积偏大（1.2GB），原因是 webpack 未精确排除 node_modules。后续需优化 externals 配置。

---

## 后续优化方向

1. **减小打包体积**: 配置 webpack externals 排除不需要的 node_modules
2. **扫描结果缓存**: 首次扫描后缓存结果，下次启动直接加载
3. **增量扫描**: 只扫描新增/修改的目录
4. **更精准的平台识别**: 根据目录内容特征（如配置文件）判断是否为 AI 工具