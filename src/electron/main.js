const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');

let mainWindow;
let tray;
let skillWatcher;
let db;

// 截图模式: 解析参数（路径在 app.whenReady 里再确定，见下方）
const screenshotArg = process.argv.find(a => a.startsWith('--screenshot='));
let screenshotPath = null;

// 预定义的 AI 工具平台
const KNOWN_PLATFORMS = [
  'claude', 'codebuddy', 'codebuddycn', 'docex', 'copilot', 'cursor',
  'hermes', 'kode', 'mempalace', 'openclaw', 'openclaw-autoclaw',
  'openclaw-zero', 'qclaw', 'qoder', 'qwen', 'skillhub', 'trae',
  'trae-cn', 'vibe', 'void-editor', 'vscode', 'vscord-R', 'zagent',
  'zen', 'zencoder', 'aichat', 'continue', 'llama', 'llm', 'ollama',
  'perplexity', 'chata', 'chatgpt', 'gemini', 'cline'
];

// ============================================================
// 技能广场数据源配置
// ============================================================
const SKILL_SOURCES = [
  {
    id: 'clawhub',
    name: 'ClawHub',
    url: 'https://clawhub.com',
    apiUrl: 'https://clawhub.com/api/v1/skills?page=1&limit=50',
    searchUrl: 'https://clawhub.com/api/search?q=',
    description: 'Fast skill registry for agents with vector search',
    category: 'registry',
    color: '#10B981',
    defaultTab: 'skills'
  },
  {
    id: 'skillhub',
    name: 'SkillHub',
    url: 'https://skillhub.dev',
    apiUrl: 'https://skillhub.dev/api/skills',
    searchUrl: 'https://skillhub.dev/api/search?q=',
    description: 'Community skill registry for OpenClaw agents',
    category: 'community',
    color: '#6366F1',
    defaultTab: 'skills'
  },
  {
    id: 'github',
    name: 'GitHub Topics',
    url: 'https://github.com/topics/openclaw-skill',
    apiUrl: null,
    searchUrl: 'https://api.github.com/search/repositories?q=openclaw+skill+language:json&sort=stars&per_page=20',
    description: 'Open-source skills tagged on GitHub',
    category: 'community',
    color: '#24292F',
    defaultTab: 'repos'
  },
  {
    id: 'npm_skills',
    name: 'npm Registry',
    url: 'https://www.npmjs.com/search?q=openclaw+skill',
    apiUrl: null,
    searchUrl: 'https://registry.npmjs.org/-/v1/search?text=openclaw+skill&size=20',
    description: 'npm packages tagged as openclaw skill',
    category: 'registry',
    color: '#CB3837',
    defaultTab: 'packages'
  },
  {
    id: 'awesome_openclaw',
    name: 'Awesome OpenClaw',
    url: 'https://github.com/awesome-openclaw/awesome-openclaw',
    apiUrl: 'https://raw.githubusercontent.com/awesome-openclaw/awesome-openclaw/main/skills.json',
    searchUrl: null,
    description: 'Curated list of awesome OpenClaw skills',
    category: 'curated',
    color: '#FF6B6B',
    defaultTab: 'skills'
  },
  {
    id: 'openclaw_marketplace',
    name: 'OpenClaw Marketplace',
    url: 'https://openclaw.ai/marketplace',
    apiUrl: null,
    searchUrl: null,
    description: 'Official OpenClaw skill marketplace',
    category: 'official',
    color: '#3B82F6',
    defaultTab: 'skills'
  },
  {
    id: 'mcp_registry',
    name: 'MCP Registry',
    url: 'https://modelcontextprotocol.io/registry',
    apiUrl: null,
    searchUrl: 'https://raw.githubusercontent.com/modelcontextprotocol/registry/main/registry.json',
    description: 'Model Context Protocol skill registry',
    category: 'protocol',
    color: '#8B5CF6',
    defaultTab: 'skills'
  },
  {
    id: 'agent_skills',
    name: 'Agent Skills Hub',
    url: 'https://github.com/agent-skills/agent-skills',
    apiUrl: null,
    searchUrl: 'https://api.github.com/repos/agent-skills/agent-skills/contents/skills.json',
    description: 'Community-driven agent skill collection',
    category: 'community',
    color: '#F59E0B',
    defaultTab: 'skills'
  },
  {
    id: 'claw_marketplace',
    name: 'Claw Marketplace',
    url: 'https://clawmarket.dev',
    apiUrl: null,
    searchUrl: null,
    description: 'Cross-platform AI agent skill marketplace',
    category: 'registry',
    color: '#EC4899',
    defaultTab: 'skills'
  },
  {
    id: 'skill_central',
    name: 'Skill Central',
    url: 'https://skillcentral.dev',
    apiUrl: null,
    searchUrl: null,
    description: 'Central repository for AI agent skills',
    category: 'registry',
    color: '#14B8A6',
    defaultTab: 'skills'
  },
  {
    id: 'openskill_hub',
    name: 'OpenSkill Hub',
    url: 'https://openskillhub.io',
    apiUrl: null,
    searchUrl: null,
    description: 'Open platform for AI tool skill management',
    category: 'registry',
    color: '#06B6D4',
    defaultTab: 'skills'
  },
  {
    id: 'agentverse',
    name: 'AgentVerse',
    url: 'https://agentverse.ai',
    apiUrl: null,
    searchUrl: null,
    description: 'Multi-agent skill marketplace and collaboration',
    category: 'platform',
    color: '#8B5CF6',
    defaultTab: 'skills'
  }
];

// HTTP/HTTPS 请求辅助函数
function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'OpenSkillManager/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.setTimeout(timeout);
  });
}

// 解析 ClawHub API 数据
function parseClawHubSkills(raw) {
  try {
    const data = JSON.parse(raw);
    const items = data.items || data.results || [];
    return {
      skills: items.map(item => ({
        id: `clawhub:${item.slug}`,
        name: item.displayName || item.slug,
        description: item.summary || '',
        version: item.latestVersion?.version || item.tags?.latest || '1.0.0',
        author: (item.author && item.author.name) || 'ClawHub Community',
        source: 'ClawHub',
        sourceUrl: `https://clawhub.com/skills/${item.slug}`,
        downloadUrl: `https://clawhub.com/api/v1/skills/${item.slug}/download`,
        category: item.category || inferCategory(null, item.summary),
        tags: item.tags ? Object.keys(item.tags).filter(k => k !== 'latest') : [],
        platforms: item.platforms || ['openclaw', 'qclaw'],
        installed: false,
        stats: item.stats || {}
      })),
      nextCursor: data.nextCursor || null
    };
  } catch { return { skills: [], nextCursor: null }; }
}

// 解析 GitHub search 结果
function parseGitHubSkills(raw) {
  try {
    const data = JSON.parse(raw);
    const items = data.items || [];
    return {
      skills: items.map(item => ({
        id: `github:${item.full_name}`,
        name: item.name,
        description: item.description || '',
        version: '1.0.0',
        author: item.owner.login,
        source: 'GitHub',
        sourceUrl: item.html_url,
        downloadUrl: `https://github.com/${item.full_name}/archive/refs/heads/main.zip`,
        category: inferCategory(null, item.description),
        tags: item.topics?.slice(0, 5) || [],
        platforms: ['openclaw', 'qclaw'],
        installed: false,
        stats: { stars: item.stargazers_count }
      })),
      nextCursor: null
    };
  } catch { return { skills: [], nextCursor: null }; }
}

// 推断分类
function inferCategory(tags, description) {
  const text = ((tags || []).join(' ') + ' ' + (description || '')).toLowerCase();
  if (text.includes('search') || text.includes('web') || text.includes('google')) return 'search';
  if (text.includes('code') || text.includes('git') || text.includes('github')) return 'devops';
  if (text.includes('news') || text.includes('rss') || text.includes('media')) return 'media';
  if (text.includes('code') || text.includes('mcp') || text.includes('api')) return 'code';
  if (text.includes('file') || text.includes('storage') || text.includes('drive')) return 'storage';
  if (text.includes('chat') || text.includes('message')) return 'communication';
  return 'utility';
}

// 从多个数据源收集技能
async function fetchMarketplaceSkills() {
  const results = [];

  // ClawHub - 主要来源 (支持 cursor 分页)
  try {
    let cursor = null;
    let pagesFetched = 0;
    do {
      let url = 'https://clawhub.com/api/v1/skills?page=1&limit=50';
      if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
      const raw = await fetchUrl(url);
      const { skills, nextCursor } = parseClawHubSkills(raw);
      results.push(...skills);
      cursor = nextCursor;
      pagesFetched++;
    } while (cursor && pagesFetched < 3); // 最多抓3页
  } catch (e) { console.warn('ClawHub fetch failed:', e.message); }

  // ClawHub search API
  try {
    const raw = await fetchUrl('https://clawhub.com/api/search?q=skill&limit=20');
    const data = JSON.parse(raw);
    const items = data.results || [];
    for (const item of items) {
      if (!results.find(s => s.id === `clawhub:${item.slug}`)) {
        results.push({
          id: `clawhub:${item.slug}`,
          name: item.displayName || item.slug,
          description: item.summary || '',
          version: item.version || '1.0.0',
          author: 'ClawHub Community',
          source: 'ClawHub',
          sourceUrl: `https://clawhub.com/skills/${item.slug}`,
          downloadUrl: `https://clawhub.com/api/v1/skills/${item.slug}/download`,
          category: inferCategory(null, item.summary),
          tags: [],
          platforms: ['openclaw', 'qclaw'],
          installed: false
        });
      }
    }
  } catch (e) { console.warn('ClawHub search failed:', e.message); }

  // GitHub Topics
  try {
    const raw = await fetchUrl(
      'https://api.github.com/search/repositories?q=openclaw+skill+language:json&sort=stars&per_page=20',
      15000
    );
    const { skills: ghSkills } = parseGitHubSkills(raw);
    results.push(...ghSkills);
  } catch (e) { console.warn('GitHub fetch failed:', e.message); }

  // npm registry
  try {
    const raw = await fetchUrl('https://registry.npmjs.org/-/v1/search?text=openclaw+skill&size=20', 10000);
    const data = JSON.parse(raw);
    const objects = data.objects || [];
    for (const obj of objects) {
      const pkg = obj.package;
      results.push({
        id: `npm:${pkg.name}`,
        name: pkg.name,
        description: pkg.description || '',
        version: pkg.version,
        author: (pkg.maintainers && pkg.maintainers[0]?.username) || 'npm',
        source: 'npm',
        sourceUrl: pkg.links?.homepage || pkg.links?.repository || `https://npmjs.com/package/${pkg.name}`,
        downloadUrl: `https://registry.npmjs.org/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`,
        category: inferCategory(pkg.keywords, pkg.description),
        tags: (pkg.keywords || []).slice(0, 5),
        platforms: ['openclaw', 'qclaw'],
        installed: false
      });
    }
  } catch (e) { console.warn('npm fetch failed:', e.message); }

  return results;
}

// 下载并安装技能（到指定平台）
async function installMarketplaceSkill(skill, targetPlatform) {
  console.log(`[Install] Starting: ${skill.name} → ${targetPlatform}`);
  
  // 1. 查找目标平台（支持模糊匹配）
  let platform = db.getPlatform(targetPlatform);
  if (!platform) {
    // 尝试不区分大小写匹配
    const allPlatforms = db.getPlatforms();
    platform = allPlatforms.find(p => p.name.toLowerCase() === targetPlatform.toLowerCase());
  }
  if (!platform) {
    // 如果数据库里没有平台信息，尝试直接从文件系统推断
    const homeDir = app.getPath('home');
    const possiblePaths = [
      path.join(homeDir, `.${targetPlatform}`, 'skills'),
      path.join(homeDir, targetPlatform, 'skills'),
      path.join(homeDir, `.${targetPlatform}`, '.openclaw', 'skills'),
      path.join(homeDir, `.${targetPlatform}`),
    ];
    for (const pp of possiblePaths) {
      if (await fs.pathExists(pp)) {
        platform = { name: targetPlatform, skillsPath: pp, path: path.dirname(pp) };
        console.log(`[Install] Found platform via filesystem: ${pp}`);
        break;
      }
    }
  }
  if (!platform) {
    return { success: false, error: `Platform "${targetPlatform}" not found. Please run Scan Skills first.` };
  }
  
  try {
    let downloadUrl = skill.downloadUrl;
    
    // GitHub raw content
    if (skill.source === 'GitHub' && skill.sourceUrl) {
      const repo = skill.sourceUrl.replace('https://github.com/', '');
      downloadUrl = `https://github.com/${repo}/archive/refs/heads/main.zip`;
    }
    
    // 构建目标路径
    const skillDirName = skill.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5_-]/g, '_');
    const targetDir = path.join(platform.skillsPath, skillDirName);
    
    console.log(`[Install] Target dir: ${targetDir}, downloadUrl: ${downloadUrl || '(none)'}`);
    
    if (!downloadUrl) {
      // 无下载链接：创建 SKILL.md 占位符
      await fs.ensureDir(targetDir);
      await fs.writeFile(path.join(targetDir, 'SKILL.md'), 
        `# ${skill.name}\n\n${skill.description}\n\nSource: ${skill.sourceUrl || skill.source}\nVersion: ${skill.version}\nInstalled from: Marketplace (${skill.source})\n`);
      
      // 注册到数据库
      registerInstalledSkill(skill, targetPlatform, skillDirName, targetDir, 'bookmark_only');
      return { success: true, path: targetDir, note: 'bookmark_only' };
    }
    
    // 下载 zip（带重试和更好的错误处理）
    const tempZip = path.join(app.getPath('temp'), `openskill-temp-${Date.now()}.zip`);
    try {
      const zipData = await fetchUrl(downloadUrl, 30000);
      if (!zipData || zipData.length < 10) {
        throw new Error(`Download returned empty response (${zipData ? zipData.length : 0} bytes)`);
      }
      await fs.writeFile(tempZip, zipData);
      console.log(`[Install] Downloaded ${zipData.length} bytes to ${tempZip}`);
    } catch (dlErr) {
      console.error(`[Install] Download failed for ${downloadUrl}:`, dlErr.message);
      // 降级：创建占位符
      await fs.ensureDir(targetDir);
      await fs.writeFile(path.join(targetDir, 'SKILL.md'), 
        `# ${skill.name}\n\n${skill.description}\n\nSource: ${skill.sourceUrl || downloadUrl}\nVersion: ${skill.version}\n> ⚠️ Download failed: ${dlErr.message}\n`);
      registerInstalledSkill(skill, targetPlatform, skillDirName, targetDir, 'download_failed');
      return { success: true, path: targetDir, note: 'download_failed', warning: dlErr.message };
    }
    
    // 解压
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(tempZip);
      const entries = zip.getEntries();
      
      // 检查是否只有一个根目录（常见于 GitHub archive zip）
      const rootDirs = entries.filter(e => e.entryName && !e.entryName.includes('/') && !e.isDirectory).length === 0
        ? [...new Set(entries.map(e => e.entryName.split('/')[0]).filter(Boolean))]
        : [];
      
      if (rootDirs.length === 1) {
        // 单根目录：解压到临时目录再移动内容
        const tempExtract = path.join(app.getPath('temp'), `openskill-extract-${Date.now()}`);
        zip.extractAllTo(tempExtract, true);
        const innerDir = path.join(tempExtract, rootDirs[0]);
        if (await fs.pathExists(innerDir)) {
          await fs.copy(innerDir, targetDir);
          await fs.remove(tempExtract);
        } else {
          zip.extractAllTo(targetDir, true);
        }
      } else {
        zip.extractAllTo(targetDir, true);
      }
      console.log(`[Install] Extracted to ${targetDir}`);
    } catch (extractErr) {
      console.error('[Install] Extract failed:', extractErr.message);
      throw extractErr;
    }
    
    // 清理临时文件
    try { await fs.remove(tempZip); } catch (_) {}
    
    // 注册到数据库
    registerInstalledSkill(skill, targetPlatform, skillDirName, targetDir, 'installed');
    
    return { success: true, path: targetDir };
  } catch (error) {
    console.error(`[Install] Failed for ${skill.name}:`, error);
    return { success: false, error: error.message };
  }
}

// 注册已安装技能到数据库
function registerInstalledSkill(skill, targetPlatform, skillDirName, targetDir, method) {
  const installedSkill = {
    id: `${targetPlatform}:${skillDirName}`,
    name: skill.name,
    platform: targetPlatform,
    path: targetDir,
    description: skill.description,
    version: skill.version,
    author: skill.author,
    source: skill.source,
    sourceUrl: skill.sourceUrl,
    type: 'skill',
    enabled: true,
    discoveredAt: new Date().toISOString(),
    marketplaceId: skill.id,
    marketplaceSource: skill.source,
    installMethod: method
  };
  db.addSkill(installedSkill);
  db.save();
  console.log(`[Install] Registered: ${installedSkill.id} (method=${method})`);
}

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

  let targetUrl;
  if (app.isPackaged) {
    targetUrl = path.join(__dirname, '../react/index.html');
  } else {
    targetUrl = 'http://localhost:3000';
  }
  mainWindow.loadFile(targetUrl);

  // 截图路径：在确定 isPackaged 后才能正确解析
  if (screenshotArg) {
    screenshotPath = screenshotArg.split('=').slice(1).join('=');
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

  // ===== 技能广场 IPC =====
  ipcMain.handle('get-marketplace-sources', async () => SKILL_SOURCES);

  ipcMain.handle('get-marketplace-skills', async () => {
    try {
      return await fetchMarketplaceSkills();
    } catch (error) {
      console.error('Marketplace fetch failed:', error);
      return [];
    }
  });

  ipcMain.handle('install-marketplace-skill', async (event, skill, targetPlatform) => {
    return await installMarketplaceSkill(skill, targetPlatform);
  });

  ipcMain.handle('search-marketplace', async (event, query, sourceId) => {
    try {
      const source = SKILL_SOURCES.find(s => s.id === sourceId);
      if (!source?.searchUrl) return [];
      
      if (sourceId === 'clawhub') {
        const raw = await fetchUrl(`https://clawhub.com/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = JSON.parse(raw);
        return (data.results || []).map(item => ({
          id: `clawhub:${item.slug}`,
          name: item.displayName || item.slug,
          description: item.summary || '',
          version: item.version || '1.0.0',
          author: 'ClawHub Community',
          source: 'ClawHub',
          sourceUrl: `https://clawhub.com/skills/${item.slug}`,
          downloadUrl: `https://clawhub.com/api/v1/skills/${item.slug}/download`,
          category: inferCategory(null, item.summary),
          tags: [],
          platforms: ['openclaw', 'qclaw'],
          installed: false
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
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