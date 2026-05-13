import React from 'react';
import { Skill, stripDot } from './App';
import { useLanguage } from '../i18n';

interface SkillDetailProps {
  skill: Skill;
  onDelete: () => void;
  onMigrate: () => void;
  onOpenFinder: (path: string) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  openclaw: '🦞', qclaw: '🦞', claude: '🧠', cursor: '📍', vscode: '💻',
  codebuddy: '🤖', codebuddycn: '🤖', docex: '📄', copilot: '🔗',
  hermes: '⚡', kode: '📝', mempalace: '🏛️', qoder: '💡', qwen: '🌟',
  skillhub: '🛒', trae: '🎨', vibe: '🎵', 'void-editor': '🚫',
  'vscord-R': '🎮', zagent: '🤖', zen: '🧘', zencoder: '🔢', custom: '📁'
};

const getPlatformIcon = (name: string): string =>
  PLATFORM_ICONS[name.toLowerCase()] || PLATFORM_ICONS[name] || '🔧';

const SkillDetail: React.FC<SkillDetailProps> = ({ skill, onDelete, onMigrate }) => {
  const { t, locale } = useLanguage();

  const handleCopyPath = () => {
    navigator.clipboard.writeText(skill.path);
    alert(t('copied'));
  };

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleString(locale) : '-';

  return (
    <div className="skill-detail">
      <div className="skill-detail-header">
        <div className="header-info">
          <span className="skill-icon large">{getPlatformIcon(stripDot(skill.platform))}</span>
          <div className="header-text">
            <h2>{skill.name}</h2>
            <div className="header-badges">
              <span className="skill-platform-badge large">{stripDot(skill.platform)}</span>
              <span className={`type-badge detail ${skill.type === 'plugin' ? 'plugin' : skill.type === 'extension' ? 'extension' : 'skill'}`}>
                {skill.type === 'plugin' ? '🔌 Plugin' : skill.type === 'extension' ? '🧩 Extension' : '📦 Skill'}
              </span>
            </div>
          </div>
        </div>
        <div className={`skill-status ${skill.enabled ? 'enabled' : 'disabled'}`}>
          {skill.enabled ? '✅' : '❌'}
        </div>
      </div>

      <div className="skill-detail-content">
        <section className="detail-section">
          <h3>{t('basicInfo')}</h3>
          <div className="info-grid">
            <div className="info-row">
              <label>ID</label>
              <code>{skill.id}</code>
            </div>
            <div className="info-row">
              <label>{t('version')}</label>
              <span>{skill.version}</span>
            </div>
            {skill.author && (
              <div className="info-row">
                <label>{t('author')}</label>
                <span>{skill.author}</span>
              </div>
            )}
            {skill.license && (
              <div className="info-row">
                <label>{t('license')}</label>
                <span>{skill.license}</span>
              </div>
            )}
          </div>
        </section>

        <section className="detail-section">
          <h3>{t('pathInfo')}</h3>
          <div className="path-info">
            <code className="skill-path">{skill.path}</code>
            <div className="path-actions">
              <button className="action-btn small" onClick={handleCopyPath} title={t('copyPath')}>📋</button>
              <button className="action-btn small" onClick={() => onOpenFinder(skill.path)} title={t('openInFinder')}>📂</button>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <h3>{t('description')}</h3>
          <p className="description">{skill.description || '-'}</p>
        </section>

        {skill.categories && skill.categories.length > 0 && (
          <section className="detail-section">
            <h3>{t('categories')}</h3>
            <div className="tags-list">
              {skill.categories.map((cat, i) => <span key={i} className="tag">{cat}</span>)}
            </div>
          </section>
        )}

        {skill.keywords && skill.keywords.length > 0 && (
          <section className="detail-section">
            <h3>{t('keywords')}</h3>
            <div className="tags-list">
              {skill.keywords.map((kw, i) => <span key={i} className="tag keyword">{kw}</span>)}
            </div>
          </section>
        )}

        {skill.migratedFrom && (
          <section className="detail-section migrate-info">
            <h3>{t('migrateInfo')}</h3>
            <p>{t('source')}: {skill.migratedFrom}</p>
            <p className="migrate-date">{t('migrateTime')}: {fmtDate(skill.migratedAt)}</p>
          </section>
        )}

        <section className="detail-section timestamps">
          <div className="info-row">
            <label>{t('discoveredAt')}</label>
            <span>{fmtDate(skill.discoveredAt)}</span>
          </div>
          <div className="info-row">
            <label>{t('updatedAt')}</label>
            <span>{fmtDate(skill.updatedAt)}</span>
          </div>
        </section>
      </div>

      <div className="skill-detail-actions">
        <button className="action-btn primary" onClick={onMigrate}>
          📤 {t('migrate')}
        </button>
        <button className="action-btn danger" onClick={onDelete}>
          🗑️ {t('delete')}
        </button>
      </div>
    </div>
  );
};

export default SkillDetail;
