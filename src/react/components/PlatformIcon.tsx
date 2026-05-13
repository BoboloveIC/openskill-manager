import React from 'react';

// 平台图标映射：有真实图标的用图片，没有的用颜色首字母
const PLATFORM_CONFIG: Record<string, {
  iconFile?: string;
  color: string;
  letter: string;
}> = {
  // 有真实图标的平台
  claude:      { iconFile: 'claude.png',      color: '#D97757', letter: 'C' },
  cursor:      { iconFile: 'cursor.png',      color: '#0099FF', letter: 'Cu' },
  vscode:      { iconFile: 'vscode.png',      color: '#007ACC', letter: 'VS' },
  copilot:     { iconFile: 'copilot.png',     color: '#6E40C9', letter: 'Co' },
  qwen:        { iconFile: 'qwen.png',        color: '#6C3FC5', letter: 'Q' },
  trae:        { iconFile: 'trae.png',        color: '#4F46E5', letter: 'T' },
  hermes:      { iconFile: 'hermes.png',      color: '#E85D3A', letter: 'H' },
  mempalace:   { iconFile: 'mempalace.png',   color: '#8B5CF6', letter: 'M' },
  'void-editor': { iconFile: 'void-editor.png', color: '#1E293B', letter: 'VE' },
  zencoder:    { iconFile: 'zencoder.png',    color: '#2563EB', letter: 'Ze' },
  zen:         { iconFile: 'zen.png',         color: '#0F172A', letter: 'Ze' },
  codebuddycn: { iconFile: 'codebuddycn.png', color: '#07C160', letter: 'CB' },
  // 没有真实图标，使用颜色首字母
  codebuddy:   { color: '#07C160', letter: 'CB' },
  qclaw:       { color: '#FF6B35', letter: 'QC' },
  openclaw:    { color: '#FF6B35', letter: 'OC' },
  'openclaw-autoclaw': { color: '#FF6B35', letter: 'OA' },
  'openclaw-zero':     { color: '#FF6B35', letter: 'OZ' },
  skillhub:    { color: '#10B981', letter: 'SH' },
  qoder:       { color: '#FF6A00', letter: 'Qo' },
  kode:        { color: '#8B5CF6', letter: 'K' },
  vibe:        { color: '#EC4899', letter: 'V' },
  'vscord-R':  { color: '#5865F2', letter: 'VR' },
  zagent:      { color: '#14B8A6', letter: 'ZA' },
  docex:       { color: '#F59E0B', letter: 'D' },
  'trae-cn':   { color: '#4F46E5', letter: 'TC' },
};

interface PlatformIconProps {
  name: string;
  size?: number; // default 24
  className?: string;
}

// 确定性颜色生成器（用于未配置的平台）
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function nameToLetter(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length <= 2) return clean.toUpperCase();
  // 取首字母和最后一个大写字母
  const first = clean[0].toUpperCase();
  const lastUpper = [...clean].reverse().find(c => c === c.toUpperCase() && c !== c.toLowerCase());
  return lastUpper ? first + lastUpper : first + clean[1].toUpperCase();
}

const PlatformIcon: React.FC<PlatformIconProps> = ({ name, size = 24, className = '' }) => {
  const key = name.toLowerCase();
  const config = PLATFORM_CONFIG[key];
  const s = size;
  const radius = s / 2;

  if (config?.iconFile) {
    return (
      <img
        src={`../icons/${config.iconFile}`}
        alt={name}
        width={s}
        height={s}
        className={`platform-icon-img ${className}`}
        style={{ borderRadius: radius * 0.2, objectFit: 'cover' }}
        onError={(e) => {
          // 图片加载失败时隐藏，显示 fallback
          (e.target as HTMLImageElement).style.display = 'none';
          const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      // fallback 元素，默认隐藏
    );
  }

  // 颜色首字母 fallback
  const color = config?.color || nameToColor(name);
  const letter = config?.letter || nameToLetter(name);

  return (
    <div
      className={`platform-icon-letter ${className}`}
      style={{
        width: s,
        height: s,
        borderRadius: radius * 0.25,
        backgroundColor: color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: Math.max(s * 0.38, 10),
        fontWeight: 700,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", sans-serif',
        lineHeight: 1,
        flexShrink: 0,
      }}
      title={name}
    >
      {letter}
    </div>
  );
};

// 包装组件：同时渲染图片和 fallback，图片失败时自动切换
export const PlatformIconWithFallback: React.FC<PlatformIconProps> = ({ name, size = 24, className = '' }) => {
  const key = name.toLowerCase();
  const config = PLATFORM_CONFIG[key];
  const s = size;
  const radius = s / 2;
  const color = config?.color || nameToColor(name);
  const letter = config?.letter || nameToLetter(name);

  if (config?.iconFile) {
    return (
      <span className={`platform-icon-wrapper ${className}`} style={{ position: 'relative', display: 'inline-flex', width: s, height: s, flexShrink: 0 }}>
        <img
          src={`../icons/${config.iconFile}`}
          alt={name}
          width={s}
          height={s}
          style={{ borderRadius: radius * 0.2, objectFit: 'cover' }}
          className="platform-icon-real"
        />
        <span
          className="platform-icon-fallback"
          style={{
            display: 'none',
            width: s,
            height: s,
            borderRadius: radius * 0.25,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: Math.max(s * 0.38, 10),
            fontWeight: 700,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", sans-serif',
            lineHeight: 1,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {letter}
        </span>
      </span>
    );
  }

  // 无图标文件，直接显示字母
  return (
    <div
      className={`platform-icon-letter ${className}`}
      style={{
        width: s,
        height: s,
        borderRadius: radius * 0.25,
        backgroundColor: color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: Math.max(s * 0.38, 10),
        fontWeight: 700,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", sans-serif',
        lineHeight: 1,
        flexShrink: 0,
      }}
      title={name}
    >
      {letter}
    </div>
  );
};

export default PlatformIconWithFallback;
