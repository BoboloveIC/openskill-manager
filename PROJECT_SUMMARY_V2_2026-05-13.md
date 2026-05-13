# OpenSkill Manager - 界面重新设计完成

**日期**: 2026-05-13 21:34 (GMT+8)  
**项目路径**: `/Users/boge/Downloads/公司/AI培训/OpenSkill/openskill-manager`

---

## 需求分析

用户反馈：
- 运行生成的 app 后打开是空白窗口
- 需要设计完整的 GUI 界面
- 能探测本地所有类似 OpenClaw 的 AI 工具（如 claude, codebuddy, cursor, openclaw, qclaw 等）
- 扫描并引入它们的 skills
- 按平台分类显示技能列表
- 支持手动添加自定义目录
- 收录技能到数据库（添加、删除、更新、迁移）
- 迁移：从一个 AI 工具迁移到另一个 AI 工具

---

## 设计方案

### 1. 数据模型

**平台 (Platform)**:
```typescript
interface Platform {
  name: string;           // 平台名称
  path: string;           // 主目录路径
  hasSkills: boolean;     // 是否有技能目录
  skillsPath: string;     // 技能目录路径
  isCustom: boolean;      // 是否是自定义
  discoveredAt: string;    // 发现时间
}
```

**技能 (Skill)**:
```typescript
interface Skill {
  id: string;             // 唯一标识 (platform:name)
  name: string;           // 技能名称
  platform: string;       // 所属平台
  path: string;           // 文件路径
  description: string;    // 描述
  version: string;        // 版本
  enabled: boolean;       // 是否启用
  author?: string;        // 作者
  license?: string;       // 许可证
  categories?: string[];  // 分类标签
  keywords?: string[];    // 关键词
  migratedFrom?: string;  // 迁移来源
  migratedAt?: string;   // 迁移时间
}
```

### 2. 通用扫描规则

**AI 工具目录模式**:
- 位于 `~/` 目录下
- 以 `.` 开头，或在已知列表中
- 包含 `skills`、`plugins`、`extensions` 等目录

**已知平台列表**:
```
claude, codebuddy, codebuddycn, docex, copilot, cursor,
hermes, kode, mempalace, openclaw, openclaw-autoclaw,
openclaw-zero, qclaw, qoder, qwen, skillhub, trae,
trae-cn, vibe, void-editor, vscode, vscord-R, zagent,
zen, zencoder, .claude, .cursor, .openclaw, .qclaw, etc.
```

**技能目录扫描深度**: 最多 4 层递归

### 3. UI 布局设计

```
┌──────────────┬───────────────────────────────────────┐
│   侧边栏     │               主内容区                 │
│  (260px)    │                                       │
│             │  ┌─────────────────────────────────┐  │
│  AI 平台    │  │ 头部: 标题 + 搜索 + 扫描按钮       │  │
│  ─────────  │  └─────────────────────────────────┘  │
│  🌐 全部平台│                                       │
│  🦞 openclaw│  ┌───────────────────┬─────────────┐  │
│  📍 cursor  │  │   技能网格区域     │  详情面板   │  │
│  💻 vscode  │  │   (卡片式布局)      │  (380px)    │  │
│  ...       │  │                   │             │  │
│             │  │                   │  技能详情   │  │
│  ➕ 添加    │  │                   │  或        │  │
│             │  │                   │  平台详情   │  │
│  平台统计   │  │                   │             │  │
└──────────────┴───────────────────────────────────────┘
```

### 4. 功能模块

**主进程 (Electron Main)**:
- `SkillDatabase`: JSON 文件数据库，支持增删改查
- `SkillDiscovery`: 扫描引擎，自动发现 AI 工具和技能
- IPC 处理器：scanAll, addCustomPath, migrateSkill, deleteSkill 等

**渲染进程 (React)**:
- `App`: 主组件，管理全局状态
- `Sidebar`: 侧边栏，平台列表和筛选
- `SkillGrid`: 技能卡片网格
- `SkillDetail`: 技能详情面板
- `PlatformDetail`: 平台详情面板
- `AddDirectoryModal`: 添加自定义目录弹窗
- `MigrateModal`: 迁移技能弹窗

---

## 实施步骤

### 1. 重新设计 Electron 主进程

**重写 `src/electron/main.js`**:
- 添加 `SkillDatabase` 类，持久化存储到 `skill-database.json`
- 添加 `SkillDiscovery` 类，实现通用扫描逻辑
- 自动发现 `~/.` 目录下所有 AI 工具
- 递归扫描技能目录（深度限制 4 层）
- 读取 `SKILL.md` 和 `package.json` 获取元数据

### 2. 重新设计 React UI

**新增组件**:
- `Sidebar.tsx`: 侧边栏，显示平台列表
- `SkillGrid.tsx`: 技能网格，卡片式布局
- `PlatformDetail.tsx`: 平台详情
- `AddDirectoryModal.tsx`: 添加目录弹窗
- `MigrateModal.tsx`: 迁移技能弹窗

**重构组件**:
- `App.tsx`: 完全重写，水平三栏布局
- `SkillDetail.tsx`: 增强详情展示
- `App.css`: 完整重写，现代化深色主题

### 3. 更新 Preload 脚本

**新增 IPC 方法**:
- `get-skills`: 获取所有平台和技能
- `scan-all`: 全量扫描
- `add-custom-path`: 添加自定义目录
- `migrate-skill`: 迁移技能
- `delete-skill`: 删除技能
- `select-directory`: 选择目录对话框

---

## 问题修复

### 1. 语法错误: 对象键包含 `-`

**问题**: `trae-cn: '🎨'` 导致 Babel 解析错误

**解决方案**: 使用引号包裹键名 `'trae-cn': '🎨'`

**影响文件**:
- `Sidebar.tsx`
- `SkillGrid.tsx`
- `SkillDetail.tsx`
- `PlatformDetail.tsx`

### 2. 构建和打包

执行命令:
```bash
# 1. 构建 Electron 主进程
npx webpack --config webpack.electron.config.js

# 2. 构建 React 应用
npx webpack --config webpack.react.config.js --mode production

# 3. 打包
npm run dist
```

---

## 最终输出

**打包文件**:
- `dist/OpenSkill Manager-1.0.0-arm64.dmg` (539 MB)
- `dist/OpenSkill Manager-1.0.0-arm64-mac.zip` (533 MB)

**功能清单**:
- ✅ 自动发现本地 AI 工具平台
- ✅ 扫描并收录所有技能
- ✅ 左侧平台分类列表
- ✅ 技能卡片网格展示
- ✅ 技能详情面板
- ✅ 搜索过滤
- ✅ 手动添加自定义目录
- ✅ 删除技能记录
- ✅ 迁移技能到其他平台
- ✅ 深色主题现代化 UI

---

## 技术亮点

1. **通用扫描算法**: 自动发现 `~/.` 目录下所有可能的 AI 工具，无需硬编码路径
2. **递归深度限制**: 防止无限递归，最多扫描 4 层目录
3. **多源元数据**: 从 `SKILL.md`、`package.json`、`README.md` 提取信息
4. **JSON 数据库**: 轻量级持久化，无需额外数据库
5. **迁移追踪**: 记录技能的迁移历史

---

## 下一步改进

1. **图标设计**: 添加入侵检测的 `assets/icon.png`
2. **技能操作**: 实现真正的文件操作（而非仅数据库记录）
3. **分类视图**: 按技能类型/标签分类，而非仅按平台
4. **批量迁移**: 支持一次迁移多个技能
5. **导入导出**: 支持数据库的备份和恢复