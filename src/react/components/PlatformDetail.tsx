import React from 'react';
import { Platform, stripDot } from './App';
import { useLanguage } from '../i18n';

interface PlatformDetailProps {
  platform: Platform | undefined;
  skillCount: number;
  onOpenFinder: (path: string) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  openclaw: '🦞', qclaw: '🦞', claude: '🧠', cursor: '📍', vscode: '💻',
  codebuddy: '🤖', codebuddycn: '🤖', docex: '📄', copilot: '🔗', hermes: '⚡',
  kode: '📝', mempalace: '🏛️', qoder: '💡', qwen: '🌟', skillhub: '🛒',
  trae: '🎨', vibe: '🎵', 'void-editor': '🚫', 'vscord-R': '🎮',
  zagent: '🤖', zen: '🧘', zencoder: '🔢', custom: '📁'
};

const getPlatformIcon = (name: string): string =>
  PLATFORM_ICONS[name.toLowerCase()] || PLATFORM_ICONS[name] || '🔧';

const PlatformDetail: React.FC<PlatformDetailProps> = ({ platform, skillCount, onOpenFinder }) => {
  const { t, locale } = useLanguage();

  if (!platform) {
    return (
      <div className="platform-detail-empty">
        <p>{t('selectHint')}</p>
      </div>
    );
  }

  return (
    <div className="platform-detail">
      <div className="platform-detail-header">
        <span className="platform-icon large">{getPlatformIcon(stripDot(platform.name))}</span>
        <h2>{stripDot(platform.name)}</h2>
      </div>

      <div className="platform-detail-content">
        <section className="detail-section">
          <h3>{t('statistics')}</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{skillCount}</div>
              <div className="stat-label">{t('skillCountLabel')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{platform.hasSkills ? '✅' : '❌'}</div>
              <div className="stat-label">{t('hasSkillDir')}</div>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <h3>{t('pathInfo')}</h3>
          <div className="path-list">
            <div className="path-item">
              <label>{t('platform')}</label>
              <code>{platform.path}</code>
              <button className="action-btn small" onClick={() => onOpenFinder(platform.path)} title={t('openInFinder')}>📂</button>
            </div>
            {platform.skillsPath && (
              <div className="path-item">
                <label>{t('hasSkillDir')}</label>
                <code>{platform.skillsPath}</code>
                <button className="action-btn small" onClick={() => onOpenFinder(platform.skillsPath)} title={t('openInFinder')}>📂</button>
              </div>
            )}
          </div>
        </section>

        <section className="detail-section">
          <h3>{t('config')}</h3>
          <div className="config-list">
            <div className="config-row">
              <label>{t('type')}</label>
              <span>{platform.isCustom ? t('custom') : t('systemDiscovered')}</span>
            </div>
            <div className="config-row">
              <label>{t('discoveredAt')}</label>
              <span>{new Date(platform.discoveredAt).toLocaleString(locale)}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="platform-detail-actions">
        <button className="action-btn secondary" onClick={() => onOpenFinder(platform.path)}>
          {t('openMainDir')}
        </button>
        {platform.skillsPath && (
          <button className="action-btn secondary" onClick={() => onOpenFinder(platform.skillsPath)}>
            {t('openSkillDir')}
          </button>
        )}
      </div>
    </div>
  );
};

export default PlatformDetail;
