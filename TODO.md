
## 2026-05-16 Header 响应式优化

### 问题
- 右上角按钮被截断（5个按钮 + search + tabs 空间不足）
- 只有 960px 一个断点

### 方案
- 添加 1200px, 1400px 断点
- header-actions 使用 flex 自适应收缩
- 按钮文本用 span 包裹，支持断点隐藏

### 进度
- [x] CSS 断点优化（960px, 1200px, 1400px 三级）
- [x] flex 布局 + max-width 限制
- [x] 按钮文本 span 包裹
- [ ] 本地测试验证
- [ ] 提交发布
