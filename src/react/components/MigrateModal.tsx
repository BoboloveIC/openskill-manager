import React, { useEffect } from 'react';
import { Skill, Platform } from './App';
import { useLanguage } from '../i18n';

interface MigrateModalProps {
  skill: Skill;
  targets: Platform[];
  batchCount?: number;
  onClose: () => void;
  onConfirm: (targetPlatform: string) => void;
}

const MigrateModal: React.FC<MigrateModalProps> = ({ skill, targets, batchCount, onClose, onConfirm }) => {
  const { t } = useLanguage();
  const isBatch = !!batchCount && skill.id === '__batch__';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleConfirm = (targetPlatform: string) => {
    const label = isBatch
      ? `${t('batchMigrate')} (${batchCount}) → ${targetPlatform}`
      : `${skill.name} → ${targetPlatform}?`;
    if (confirm(t('confirmMigrate') + ': ' + label)) {
      onConfirm(targetPlatform);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal migrate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📤 {isBatch ? t('batchMigrate') : t('migrateTitle')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="migrate-info">
            {isBatch ? (
              <p><strong>{t('selectedCount', { n: batchCount })}</strong></p>
            ) : (
              <>
                <p><strong>{t('name')}:</strong> {skill.name}</p>
                <p><strong>{t('current')}:</strong> {skill.platform}</p>
              </>
            )}
          </div>
          <div className="migrate-targets">
            <h3>{t('selectTarget')}</h3>
            {targets.length === 0 ? (
              <p className="no-targets">-</p>
            ) : (
              <div className="target-list">
                {targets.map(platform => (
                  <div key={platform.name} className="target-item" onClick={() => handleConfirm(platform.name)}>
                    <span className="target-name">{platform.name}</span>
                    <span className="target-path">{platform.skillsPath || platform.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="migrate-warning">⚠️ {t('migrateWarning')}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-btn secondary" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
};

export default MigrateModal;
