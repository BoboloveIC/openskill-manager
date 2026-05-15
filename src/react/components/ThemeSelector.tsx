// ============================================================
// OpenSkill Manager - 主题选择器组件
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
];

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = THEME_OPTIONS.find(o => o.value === theme);

  return (
    <div className="language-selector" ref={ref} style={{ position: 'relative' }}>
      <button
        className="language-btn theme-btn"
        onClick={() => setOpen(!open)}
        title="切换主题"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}
      >
        {current?.icon} {current?.label}
      </button>

      {open && (
        <div className="language-dropdown theme-dropdown" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: 140,
          padding: 4,
        }}>
          {THEME_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => { setTheme(option.value); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: option.value === theme ? 'var(--primary-color)' : 'transparent',
                color: option.value === theme ? '#fff' : 'var(--text-primary)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (option.value !== theme) (e.target as HTMLElement).style.background = 'var(--hover-bg)';
              }}
              onMouseLeave={(e) => {
                if (option.value !== theme) (e.target as HTMLElement).style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 16 }}>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
