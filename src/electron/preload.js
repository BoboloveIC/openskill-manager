const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据
  getSkills: () => ipcRenderer.invoke('get-skills'),
  getPlatforms: () => ipcRenderer.invoke('get-platforms'),

  // 扫描
  scanAll: () => ipcRenderer.invoke('scan-all'),
  scanPlatform: (platformName) => ipcRenderer.invoke('scan-platform', platformName),

  // 自定义目录
  addCustomPath: (p) => ipcRenderer.invoke('add-custom-path', p),
  removeCustomPath: (p) => ipcRenderer.invoke('remove-custom-path', p),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // 技能操作
  getSkillDetails: (skillId) => ipcRenderer.invoke('get-skill-details', skillId),
  deleteSkill: (skillId) => ipcRenderer.invoke('delete-skill', skillId),
  migrateSkill: (skillId, targetPlatform) => ipcRenderer.invoke('migrate-skill', skillId, targetPlatform),

  // 文件操作
  openInFinder: (filePath) => ipcRenderer.invoke('open-in-finder', filePath),

  // 导入导出
  exportSkills: (skillIds) => ipcRenderer.invoke('export-skills', skillIds),
  importSkillsFromFile: (filePath, targetPlatform) => ipcRenderer.invoke('import-skills-from-file', filePath, targetPlatform),
  selectImportFile: () => ipcRenderer.invoke('select-import-file'),

  // 技能广场
  getMarketplaceSources: () => ipcRenderer.invoke('get-marketplace-sources'),
  getMarketplaceSkills: () => ipcRenderer.invoke('get-marketplace-skills'),
  installMarketplaceSkill: (skill, targetPlatform) => ipcRenderer.invoke('install-marketplace-skill', skill, targetPlatform),
  searchMarketplace: (query, sourceId) => ipcRenderer.invoke('search-marketplace', query, sourceId),

  // 进度事件
  onScanProgress: (callback) => {
    ipcRenderer.on('scan-progress', (event, data) => callback(data));
  },

  // 数据更新事件
  onSkillsUpdated: (callback) => {
    ipcRenderer.on('skills-updated', (event, data) => callback(data));
  },

  onAddCustomDirectory: (callback) => {
    ipcRenderer.on('add-custom-directory', (event, p) => callback(p));
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});