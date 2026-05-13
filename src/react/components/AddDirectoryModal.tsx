import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n';

interface AddDirectoryModalProps {
  onClose: () => void;
  onConfirm: (path: string) => void;
}

const AddDirectoryModal: React.FC<AddDirectoryModalProps> = ({ onClose, onConfirm }) => {
  const { t } = useLanguage();
  const [path, setPath] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) {
      setError(t('addDirDesc'));
      return;
    }
    onConfirm(path.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('addDirTitle')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="modal-description">{t('addDirDesc')}</p>
            <div className="form-group">
              <label htmlFor="dir-path">{t('path')}</label>
              <input
                id="dir-path"
                type="text"
                value={path}
                onChange={(e) => { setPath(e.target.value); setError(''); }}
                placeholder="~/my-custom-skills"
                className={error ? 'error' : ''}
                autoFocus
              />
              {error && <span className="error-text">{error}</span>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="action-btn secondary" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="action-btn primary">{t('confirm')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDirectoryModal;
