import React, { useCallback } from 'react';
import { Skill, stripDot } from './App';
import { useLanguage } from '../i18n';
import PlatformIconWithFallback from './PlatformIcon';

interface SkillGridProps {
  skills: Skill[];
  selectedSkill: Skill | null;
  selectedIds: Set<string>;
  onSelect: (skill: Skill) => void;
  onToggleSelect: (skillId: string, multi: boolean) => void;
  onDelete: (skillId: string) => void;
  onMigrate: (skill: Skill) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const SkillGrid: React.FC<SkillGridProps> = ({
  skills, selectedSkill, selectedIds,
  onSelect, onToggleSelect, onDelete, onMigrate, onSelectAll, onDeselectAll,
}) => {
  const { t } = useLanguage();
  const hasSelection = selectedIds.size > 0;

  const handleCardClick = useCallback((skill: Skill, e: React.MouseEvent) => {
    const multi = e.metaKey || e.ctrlKey || e.shiftKey;
    onToggleSelect(skill.id, multi);
    if (!multi) {
      onSelect(skill);
    }
  }, [onToggleSelect, onSelect]);

  if (skills.length === 0) {
    return (
      <div className="skill-grid-empty">
        <div className="empty-icon">📭</div>
        <p>{t('noSkillsFound')}</p>
      </div>
    );
  }

  return (
    <div className="skill-grid-wrapper">
      {/* 多选工具栏 */}
      <div className="multi-select-toolbar">
        <div className="multi-select-toolbar-left">
          <button
            className={`action-btn small ${hasSelection ? 'secondary' : ''}`}
            onClick={hasSelection ? onDeselectAll : onSelectAll}
          >
            {hasSelection ? t('deselectAll') : t('selectAll')}
          </button>
          {hasSelection && (
            <span className="selected-count">{t('selectedCount', { n: selectedIds.size })}</span>
          )}
        </div>
        {hasSelection && (
          <div className="multi-select-toolbar-right">
            <button className="action-btn small primary" onClick={() => { /* open batch migrate */ }}>
              📤 {t('batchMigrate')}
            </button>
            <button className="action-btn small secondary" onClick={() => { /* open batch export */ }}>
              📦 {t('batchExport')}
            </button>
            <button className="action-btn small danger" onClick={() => { /* batch delete */ }}>
              🗑️ {t('batchDelete')}
            </button>
          </div>
        )}
      </div>

      <div className="skill-grid">
        {skills.map(skill => {
          const isSelected = selectedIds.has(skill.id);
          return (
            <div
              key={skill.id}
              className={`skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''} ${isSelected ? 'multi-selected' : ''}`}
              onClick={(e) => handleCardClick(skill, e)}
            >
              {/* 多选勾选框 */}
              <div className={`skill-checkbox ${isSelected ? 'checked' : ''}`}>
                {isSelected && <span>✓</span>}
              </div>

              <div className="skill-card-header">
                <PlatformIconWithFallback name={stripDot(skill.platform)} size={22} />
                <span className="skill-platform-badge">{stripDot(skill.platform)}</span>
                {skill.type === 'plugin' && <span className="type-badge plugin">🔌 Plugin</span>}
                {skill.type === 'extension' && <span className="type-badge extension">🧩 Extension</span>}
              </div>
              <h3 className="skill-name">{skill.name}</h3>
              <p className="skill-description">{skill.description || '-'}</p>
              <div className="skill-meta">
                <span className="skill-version">v{skill.version}</span>
                {skill.categories && skill.categories.length > 0 && (
                  <div className="skill-tags">
                    {skill.categories.slice(0, 2).map((cat, i) => (
                      <span key={i} className="skill-tag">{cat}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="skill-card-actions">
                <button className="action-btn small" onClick={(e) => { e.stopPropagation(); onMigrate(skill); }} title={t('migrate')}>
                  📤
                </button>
                <button className="action-btn small danger" onClick={(e) => { e.stopPropagation(); onDelete(skill.id); }} title={t('deleteSkill')}>
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SkillGrid;
