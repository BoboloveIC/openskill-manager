const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');

let mainWindow;
let tray;
let skillWatcher;
let db;

// 截图模式: --screenshot <output-path>
const screenshotArg = process.argv.find(a => a.startsWith('--screenshot='));
const screenshotPath = screenshotArg ? screenshotArg.split('=').slice(1).join('=') : null;

// 预定义的 AI 工具平台
const KNOWN_PLATFORMS = [
  'claude', 'codebuddy', 'codebuddycn', 'docex', 'copilot', 'cursor',
  'hermes', 'kode', 'mempalace', 'openclaw', 'openclaw-autoclaw',
  'openclaw-zero', 'qclaw', 'qoder', 'qwen', 'skillhub', 'trae',
  'trae-cn', 'vibe', 'void-editor', 'vscode', 'vscord-R', 'zagent',
  'zen', 'zencoder', 'aichat', 'continue', 'llama', 'llm', 'ollama',
  'perplexity', 'chata', 'chatgpt', 'gemini', 'cline'
];

// 技能目录模式
const SKILL_DIR_PATTERNS = [
  'skills', 'plugins', 'extensions', 'addons', 'modules',
  'packages', 'skill', 'plugin', 'extension', 'addon', 'module',
  '.skills', '.plugins', '.extensions'
];

// 向渲染进程发送扫描进度
function sendProgress(phase, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scan-progress', { phase, ...data, timestamp: Date.now() });
  }
}

// 初始化数据库
class SkillDatabase {
  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'skill-database.json');
    this.data = {
      version: '1.0.0',
      updatedAt: null,
      platforms: {},
      skills: {},
      customPaths: [],
    };
  }

  async load() {
    try {
      if (await fs.pathExists(this.dbPath)) {
        const content = await fs.readFile(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load database:', error);
    }
    return this.data;
  }

  async save() {
    try {
      this.data.updatedAt = new Date().toISOString();
      await fs.writeJson(this.dbPath, this.data, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  getPlatforms() { return Object.values(this.data.platforms); }
  getPlatform(name) { return this.data.platforms[name]; }

  addPlatform(platform) {
    if (!this.data.platforms[platform.name]) {
      this.data.platforms[platform.name] = platform;
    }
  }

  updatePlatform(name, updates) {
    if (this.data.platforms[name]) {
      this.data.platforms[name] = { ...this.data.platforms[name], ...updates };
    }
  }

  getSkills() { return Object.values(this.data.skills); }
  getSkill(id) { return this.data.skills[id]; }

  addSkill(skill) {
    const id = `${skill.platform}:${skill.name}`;
    this.data.skills[id] = {
      ...skill,
      id,
      discoveredAt: skill.discoveredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  removeSkill(id) { delete this.data.skills[id]; }

  getSkillsByPlatform(platformName) {
    return Object.values(this.data.skills).filter(s => s.platform === platformName);
  }

  addCustomPath(customPath) {
    if (!this.data.customPaths.includes(customPath)) {
      this.data.customPaths.push(customPath);
    }
  }

  removeCustomPath(customPath) {
    const index = this.data.customPaths.indexOf(customPath);
    if (index > -1) this.data.customPaths.splice(index, 1);
  }

  getCustomPaths() { return this.data.customPaths; }
}

// 技能发现引擎（带进度上报）
class SkillDiscovery {
  constructor(database) {
    this.db = database;
  }

  // 发现阶段：扫描 ~/ 下所有可能的 AI 工具目录
  async discoverPlatforms() {
    const homeDir = app.getPath('home');
    const discovered = [];

    sendProgress('discover', { message: '扫描用户目录...', step: 0, total: 0 });

    try {
      const entries = await fs.readdir(homeDir, { withFileTypes: true });
      const candidates = entries.filter(e =>
        e.isDirectory() && (e.name.startsWith('.') || KNOWN_PLATFORMS.includes(e.name))
      );

      sendProgress('discover', {
        message: `发现 ${candidates.length} 个候选目录，正在检测...`,
        step: 0,
        total: candidates.length
      });

      for (let i = 0; i < candidates.length; i++) {
        const entry = candidates[i];
        const platformPath = path.join(homeDir, entry.name);

        sendProgress('discover', {
          message: `检测 ${entry.name}...`,
          step: i + 1,
          total: candidates.length,
          current: entry.name
        });

        // 发现所有类型的扩展目录 (skills / plugins / extensions)
        const extensionPaths = await this.findExtensionDirectories(platformPath);
        if (extensionPaths.length > 0) {
          const platform = {
            name: entry.name,
            path: platformPath,
            hasSkills: true,
            skillsPath: extensionPaths[0], // 保持兼容
            extensionPaths: extensionPaths, // 新增：所有扩展目录
            isCustom: false,
            discoveredAt: new Date().toISOString()
          };
          discovered.push(platform);
          this.db.addPlatform(platform);

          sendProgress('discover', {
            message: `✅ ${entry.name} → 发现 ${extensionPaths.length} 个扩展目录`,
            step: i + 1,
            total: candidates.length,
            current: entry.name,
            found: true
          });
        }
      }
    } catch (error) {
      console.error('Error discovering platforms:', error);
    }

    sendProgress('discover', {
      message: `发现阶段完成，共 ${discovered.length} 个平台有扩展`,
      step: -1,
      total: discovered.length,
      done: true,
      platformCount: discovered.length
    });

    return discovered;
  }

  // 在目录中查找所有扩展目录 (skills/plugins/extensions)，返回 [{type, path}]
  async findExtensionDirectories(basePath, depth = 0) {
    const results = [];
    if (depth > 3) return results;
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name.toLowerCase();
          // 检测类型
          let extType = null;
          if (['skills', 'skill', '.skills'].includes(dirName)) extType = 'skill';
          else if (['plugins', 'plugin', '.plugins'].includes(dirName)) extType = 'plugin';
          else if (['extensions', 'extension', '.extensions'].includes(dirName)) extType = 'extension';
          else if (['addons', 'addon', 'modules', 'module', 'packages', 'package'].includes(dirName)) extType = 'skill'; // 通用归类为 skill

          if (extType) {
            const fullPath = path.join(basePath, entry.name);
            if (await this.hasSkillFiles(fullPath)) {
              results.push({ type: extType, path: fullPath });
            }
          }
          // 继续向下查找
          const subPath = path.join(basePath, entry.name);
 results.push(...await this.findExtensionDirectories(subPath, depth + 1));
        }
      }
    } catch (e) { /* ignore */ }
    return results;
  }

  // 在目录中查找技能目录（兼容旧逻辑）
  async findSkillsDirectory(basePath, depth = 0) {
    const extDirs = await this.findExtensionDirectories(basePath, depth);
    return extDirs.length > 0 ? extDirs[0].path : null;
  }

  // 检查目录中是否包含技能文件
  async hasSkillFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(dirPath, entry.name);
          if (await fs.pathExists(path.join(skillDir, 'SKILL.md')) ||
              await fs.pathExists(path.join(skillDir, 'package.json'))) {
            return true;
          }
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // 扫描阶段：遍历每个平台的技能
  async scanAllPlatforms() {
    const platforms = this.db.getPlatforms();
    const allSkills = [];

    sendProgress('scan', {
      message: '开始扫描技能...',
      step: 0,
      total: platforms.length
    });

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      sendProgress('scan', {
        message: `扫描平台: ${platform.name}`,
        step: i,
        total: platforms.length,
        current: platform.name
      });

      const skills = await this.scanPlatform(platform.path, platform.name, platform);
      for (const skill of skills) {
        this.db.addSkill(skill);
        allSkills.push(skill);

        const typeLabel = skill.type === 'plugin' ? '🔌' : skill.type === 'extension' ? '🧩' : '📦';
        sendProgress('scan', {
          message: `${typeLabel} ${platform.name} / ${skill.name}`,
          step: i,
          total: platforms.length,
          current: platform.name,
          skill: skill.name,
          totalSkills: allSkills.length
        });
      }
    }

    // 扫描自定义目录
    const customPaths = this.db.getCustomPaths();
    for (const customPath of customPaths) {
      if (await fs.pathExists(customPath)) {
        const skill = await this.loadSkill(customPath, 'custom');
        if (skill) {
          this.db.addSkill(skill);
          allSkills.push(skill);
        }
      }
    }

    await this.db.save();

    sendProgress('scan', {
      message: `扫描完成！共发现 ${allSkills.length} 个技能`,
      step: -1,
      total: platforms.length,
      done: true,
      totalSkills: allSkills.length
    });

    return allSkills;
  }

  // 扫描单个平台的所有扩展 (skills + plugins + extensions)
  async scanPlatform(platformPath, platformName, platformData) {
    const skills = [];
    try {
      // 优先使用已发现的扩展目录
      const extDirs = platformData?.extensionPaths || await this.findExtensionDirectories(platformPath);
      for (const extDir of extDirs) {
        const items = await this.scanExtensionDirectory(extDir.path, platformName, extDir.type);
        skills.push(...items);
      }
      // 同时做通用扫描，防止遗漏
      const genericDirs = await this.findAllSkillDirectories(platformPath);
      const knownPaths = new Set(extDirs.map(d => d.path));
      for (const dir of genericDirs) {
        if (!knownPaths.has(dir)) {
          const skill = await this.loadSkill(dir, platformName, 'skill');
          if (skill) skills.push(skill);
        }
      }
    } catch (error) {
      console.error(`Error scanning platform ${platformName}:`, error);
    }
    return skills;
  }

  // 扫描单个扩展目录（带类型标注）
  async scanExtensionDirectory(dirPath, platformName, extType) {
    const results = [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          const skill = await this.loadSkill(fullPath, platformName, extType);
          if (skill) results.push(skill);
        }
      }
    } catch (e) { /* ignore */ }
    return results;
  }

  // 递归查找所有技能目录（兼容旧逻辑）
  async findAllSkillDirectories(basePath, depth = 0) {
    const results = [];
    if (depth > 4) return results;
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(basePath, entry.name);
          if (await fs.pathExists(path.join(fullPath, 'SKILL.md')) ||
              await fs.pathExists(path.join(fullPath, 'package.json'))) {
            results.push(fullPath);
          } else {
            results.push(...await this.findAllSkillDirectories(fullPath, depth + 1));
          }
        }
      }
    } catch (e) { /* ignore */ }
    return results;
  }

  // 加载单个扩展（支持 skill/plugin/extension 类型）
  async loadSkill(skillPath, platformName, extType = 'skill') {
    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      const packagePath = path.join(skillPath, 'package.json');

      let metadata = {
        id: path.basename(skillPath),
        name: path.basename(skillPath),
        platform: platformName,
        path: skillPath,
        description: '',
        version: 'unknown',
        enabled: true,
        author: null,
        license: null,
        categories: [],
        type: extType // 'skill' | 'plugin' | 'extension'
      };

      if (await fs.pathExists(skillMdPath)) {
        const content = await fs.readFile(skillMdPath, 'utf-8');
        const lines = content.split('\n');
        const titleMatch = lines[0]?.match(/^#\s+(.+)$/);
        if (titleMatch) metadata.name = titleMatch[1].trim();
        const descMatch = content.match(/Description:\s*(.+?)(?=\n\n|\n##|$)/is);
        if (descMatch) metadata.description = descMatch[1].trim();
        const catMatch = content.match(/Categories?:\s*(.+?)(?=\n\n|\n##|$)/is);
        if (catMatch) metadata.categories = catMatch[1].split(',').map(c => c.trim()).filter(Boolean);
      }

      if (await fs.pathExists(packagePath)) {
        const pkg = await fs.readJson(packagePath);
        // author/license 可能是对象，需要展平为字符串
        const author = pkg.author
          ? typeof pkg.author === 'string' ? pkg.author : (pkg.author.name || (pkg.author.url ? `@${pkg.author.url}` : JSON.stringify(pkg.author)))
          : metadata.author;
        const license = pkg.license
          ? typeof pkg.license === 'string' ? pkg.license : (pkg.license.type || JSON.stringify(pkg.license))
          : metadata.license;
        const categories = Array.isArray(pkg.categories)
          ? pkg.categories.map(c => typeof c === 'string' ? c : JSON.stringify(c))
          : (pkg.categories && typeof pkg.categories === 'string' ? [pkg.categories] : metadata.categories);
        const keywords = Array.isArray(pkg.keywords)
          ? pkg.keywords.map(k => typeof k === 'string' ? k : JSON.stringify(k))
          : metadata.keywords || [];
        metadata = {
          ...metadata,
          name: pkg.name || metadata.name,
          version: pkg.version || metadata.version,
          description: pkg.description || metadata.description,
          author,
          license,
          categories,
          keywords
        };
      }

      metadata.id = `${platformName}:${metadata.id}`;
      return metadata;
    } catch (error) {
      console.error(`Error loading skill at ${skillPath}:`, error);
      return null;
    }
  }

  // 完整扫描流程（发现 + 扫描）
  async fullScan() {
    sendProgress('start', { message: '🚀 开始自动扫描...', phase: '开始' });

    // 阶段 1：发现平台
    sendProgress('start', { message: '📋 阶段 1/2：发现 AI 工具平台...', phase: '发现平台' });
    const platforms = await this.discoverPlatforms();

    // 阶段 2：扫描扩展 (skills + plugins + extensions)
    sendProgress('start', { message: '🔍 阶段 2/2：扫描技能/插件/扩展...', phase: '扫描技能' });
    const allItems = await this.scanAllPlatforms();

    // 统计各类型数量
    const skillCount = allItems.filter(s => s.type === 'skill').length;
    const pluginCount = allItems.filter(s => s.type === 'plugin').length;
    const extCount = allItems.filter(s => s.type === 'extension').length;

    sendProgress('done', {
      message: `✅ 扫描完成！${platforms.length} 个平台，${skillCount} 技能 / ${pluginCount} 插件 / ${extCount} 扩展`,
      phase: '完成',
      platformCount: platforms.length,
      skillCount: allItems.length,
      platforms: this.db.getPlatforms(),
      skills: this.db.getSkills()
    });

    return {
      platforms: this.db.getPlatforms(),
      skills: this.db.getSkills()
    };
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../react/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 窗口就绪后自动触发扫描
    runAutoScan();

    // 截图模式: 等待渲染完成后截图并退出
    if (screenshotPath) {
      let scanDone = false;
      // 监听扫描完成
      ipcMain.handle('__screenshot-ping', async () => {
        scanDone = true;
        return 'ok';
      });
      // 轮询等待渲染进程就绪 + 扫描完成，最多 30s
      const pollInterval = setInterval(async () => {
        try {
          await mainWindow.webContents.executeJavaScript(
            `new Promise(r => setTimeout(() => r('ok'), 200))`
          );
          clearInterval(pollInterval);
          // 扫描完成后等 2s 让 UI 渲染完毕
          setTimeout(async () => {
            try {
              const image = await mainWindow.webContents.capturePage();
              const dir = path.dirname(screenshotPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(screenshotPath, image.toPNG());
              console.log(`Screenshot saved to ${screenshotPath}`);
            } catch (err) {
              console.error('Screenshot failed:', err);
            }
            app.quit();
          }, 2000);
        } catch (e) {
          // 页面还没加载好，继续等待
        }
      }, 1000);
      // 超时保护: 30s 后强制截图
      setTimeout(() => {
        clearInterval(pollInterval);
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.capturePage().then(image => {
            const dir = path.dirname(screenshotPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(screenshotPath, image.toPNG());
            console.log(`Screenshot saved (timeout fallback) to ${screenshotPath}`);
          }).catch(() => {}).finally(() => app.quit());
        }
      }, 30000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 自动扫描
async function runAutoScan() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    const discovery = new SkillDiscovery(db);
    const result = await discovery.fullScan();
    // fullScan 内部已通过 sendProgress 发送进度，完成后发最终数据
    mainWindow.webContents.send('skills-updated', result);
  } catch (error) {
    console.error('Auto scan failed:', error);
    sendProgress('error', { message: `扫描出错: ${error.message}` });
  }
}

// 创建系统托盘
function createTray() {
  try {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: '重新扫描', click: () => runAutoScan() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray.setToolTip('OpenSkill Manager');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch (e) { console.log('Tray creation skipped'); }
}

// App 生命周期
app.whenReady().then(async () => {
  db = new SkillDatabase();
  await db.load();

  createWindow();
  if (!app.isPackaged) createTray();

  // IPC 通信
  ipcMain.handle('get-skills', async () => ({
    platforms: db.getPlatforms(),
    skills: db.getSkills()
  }));

  ipcMain.handle('scan-all', async () => {
    const discovery = new SkillDiscovery(db);
    return await discovery.fullScan();
  });

  ipcMain.handle('scan-platform', async (event, platformName) => {
    const platform = db.getPlatform(platformName);
    if (!platform) return [];
    const discovery = new SkillDiscovery(db);
    const skills = await discovery.scanPlatform(platform.path, platformName, platform);
    for (const skill of skills) db.addSkill(skill);
    await db.save();
    return skills;
  });

  ipcMain.handle('add-custom-path', async (event, customPath) => {
    if (await fs.pathExists(customPath)) {
      db.addCustomPath(customPath);
      await db.save();
      const discovery = new SkillDiscovery(db);
      const skill = await discovery.loadSkill(customPath, 'custom');
      if (skill) { db.addSkill(skill); await db.save(); }
      return { success: true, skill };
    }
    return { success: false, error: 'Path does not exist' };
  });

  ipcMain.handle('remove-custom-path', async (event, customPath) => {
    db.removeCustomPath(customPath);
    await db.save();
    return { success: true };
  });

  ipcMain.handle('get-skill-details', async (event, skillId) => db.getSkill(skillId));

  ipcMain.handle('delete-skill', async (event, skillId) => {
    db.removeSkill(skillId);
    await db.save();
    return { success: true };
  });

  ipcMain.handle('migrate-skill', async (event, skillId, targetPlatform) => {
    const skill = db.getSkill(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    const target = db.getPlatform(targetPlatform);
    if (!target) return { success: false, error: 'Target platform not found' };
    const skillName = path.basename(skill.path);
    const targetPath = path.join(target.skillsPath, skillName);
    try {
      await fs.copy(skill.path, targetPath, { overwrite: false });
      const newSkill = {
        ...skill, id: `${targetPlatform}:${skillName}`,
        platform: targetPlatform, path: targetPath,
        migratedFrom: skillId, migratedAt: new Date().toISOString()
      };
      db.addSkill(newSkill);
      await db.save();
      return { success: true, newSkill };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
  });

  ipcMain.handle('open-in-finder', async (event, filePath) => {
    if (mainWindow) shell.showItemInFolder(filePath);
  });

  // 批量打包导出
  ipcMain.handle('export-skills', async (event, skillIds) => {
    try {
      const { dialog } = require('electron');
      const archiver = require('archiver');
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出技能包',
        defaultPath: `openskill-export-${Date.now()}.zip`,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
      });
      if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' };

      const output = require('fs').createWriteStream(result.filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => {});
      archive.pipe(output);

      let count = 0;
      for (const id of skillIds) {
        const skill = db.getSkill(id);
        if (skill && require('fs').existsSync(skill.path)) {
          const dirName = require('path').basename(skill.path);
          archive.directory(skill.path, dirName);
          count++;
        }
      }
      await archive.finalize();
      await new Promise((resolve) => output.on('close', resolve));
      return { success: true, count, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 从 zip 文件导入
  ipcMain.handle('import-skills-from-file', async (event, filePath, targetPlatform) => {
    try {
      const AdmZip = require('adm-zip');
      if (!require('fs').existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }
      const platform = db.getPlatform(targetPlatform);
      if (!platform) {
        return { success: false, error: 'Target platform not found' };
      }
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      let count = 0;
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        // 提取到目标平台的 skills 目录
        const targetPath = path.join(platform.skillsPath, entry.entryName);
        // 确保父目录存在
        require('fs').mkdirSync(path.dirname(targetPath), { recursive: true });
        zip.extractEntryTo(entry, platform.skillsPath, false, true);
        count++;
      }
      // 重新扫描目标平台
      const discovery = new SkillDiscovery(db);
      await discovery.scanPlatform(platform.path, targetPlatform, platform);
      await db.save();
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 选择导入文件对话框
  ipcMain.handle('select-import-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择技能包文件',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
  });
});

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '扫描所有技能', accelerator: 'CmdOrCtrl+R', click: () => runAutoScan() },
        {
          label: '添加自定义目录', accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('add-custom-directory', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }] },
    {
      label: '视图',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }]
    },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('ready', () => createMenu());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', async () => { if (db) await db.save(); if (skillWatcher) skillWatcher.close(); });