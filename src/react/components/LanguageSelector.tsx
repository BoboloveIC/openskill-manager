// ============================================================
// OpenSkill Manager - 语言选择器组件
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale, availableLocales, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentLocale = availableLocales.find(l => l.code === locale);

  return (
    <div className="language-selector" ref={ref} style={{ position: 'relative' }}>
      <button
        className="language-btn"
        onClick={() => setOpen(!open)}
        title={t('language')}
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
        🌐 {currentLocale?.name || locale}
      </button>

      {open && (
        <div className="language-dropdown" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 1000,
          maxHeight: 320,
          overflowY: 'auto',
          minWidth: 180,
          padding: 4,
        }}>
          {availableLocales.map(item => (
            <button
              key={item.code}
              onClick={() => { setLocale(item.code); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: item.code === locale ? 'var(--accent-color)' : 'transparent',
                color: item.code === locale ? '#fff' : 'var(--text-primary)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (item.code !== locale) (e.target as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (item.code !== locale) (e.target as HTMLElement).style.background = 'transparent';
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
