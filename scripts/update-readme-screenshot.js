#!/usr/bin/env node
/**
 * 更新 README.md 中的截图引用。
 * 如果 README 中已有截图占位符则替换，否则在标题后插入。
 */

const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', 'README.md');
const screenshotRel = 'docs/screenshot.png';

if (!fs.existsSync(readmePath)) {
  console.error('README.md not found');
  process.exit(1);
}

let readme = fs.readFileSync(readmePath, 'utf-8');

const screenshotMarkdown = `<p align="center">\n  <img src="${screenshotRel}" alt="OpenSkill Manager Screenshot" width="800" />\n</p>`;

// 检查是否已有截图区域（通过注释标记识别）
const screenshotBlockRegex = /<!-- SCREENSHOT START -->[\s\S]*?<!-- SCREENSHOT END -->/;

if (screenshotBlockRegex.test(readme)) {
  // 替换已有截图
  readme = readme.replace(
    screenshotBlockRegex,
    `<!-- SCREENSHOT START -->\n${screenshotMarkdown}\n<!-- SCREENSHOT END -->`
  );
  console.log('Replaced existing screenshot block');
} else {
  // 在 --- 分隔线前插入截图
  const insertPoint = readme.indexOf('\n---');
  if (insertPoint !== -1) {
    readme =
      readme.slice(0, insertPoint) +
      `\n<!-- SCREENSHOT START -->\n${screenshotMarkdown}\n<!-- SCREENSHOT END -->\n` +
      readme.slice(insertPoint);
    console.log('Inserted screenshot block before ---');
  } else {
    // 在第二行插入（标题后）
    const lines = readme.split('\n');
    lines.splice(1, 0, '', `<!-- SCREENSHOT START -->`, screenshotMarkdown, `<!-- SCREENSHOT END -->`);
    readme = lines.join('\n');
    console.log('Inserted screenshot block after title');
  }
}

fs.writeFileSync(readmePath, readme, 'utf-8');
console.log('README.md updated');
