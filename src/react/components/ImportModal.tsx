import React, { useState, useEffect } from 'react';
import { Platform } from './App';
import { useLanguage } from '../i18n';

interface ImportModalProps {
  platforms: Platform[];
  onClose: () => void;
  onConfirm: (filePath: string, targetPlatform: string) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ platforms, onClose, onConfirm }) => {
  const { t } = useLanguage();
  const [filePath, setFilePath] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelectFile = async () => {
    try {
      const selectedPath = await (window as any).electronAPI.selectImportFile();
      if (selectedPath) setFilePath(selectedPath);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirm = () => {
    if (!filePath) { alert(t('importFileTitle')); return; }
    if (!targetPlatform) { alert(t('selectTargetPlatform')); return; }
    onConfirm(filePath, targetPlatform);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 {t('importFileTitle')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-description">{t('importFileDesc')}</p>

          <div className="form-group">
            <label>{t('importFromFile')} (ZIP)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="skills-package.zip"
                readOnly
              />
              <button className="action-btn secondary" onClick={handleSelectFile}>
                📂
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>{t('selectTargetPlatform')}</label>
            <select
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            >
              <option value="">-- {t('selectTargetPlatform')} --</option>
              {platforms.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-btn secondary" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="action-btn primary" onClick={handleConfirm} disabled={!filePath || !targetPlatform}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
