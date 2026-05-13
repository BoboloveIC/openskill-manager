import React from 'react';
import { Skill, stripDot } from './App';

interface SkillListProps {
  skills: Skill[];
  selectedSkill: Skill | null;
  onSelect: (skill: Skill) => void;
  loading: boolean;
}

const SkillList: React.FC<SkillListProps> = ({ skills, selectedSkill, onSelect, loading }) => {
  if (loading) {
    return (
      <div className="skill-list-loading">
        <div className="loading-spinner"></div>
        <p>正在扫描技能...</p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="skill-list-empty">
        <p>📭 没有找到技能</p>
        <p className="hint">尝试调整搜索条件或扫描其他平台</p>
      </div>
    );
  }

  return (
    <div className="skill-list">
      {skills.map(skill => (
        <div
          key={`${skill.platform}:${skill.id}`}
          className={`skill-item ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
          onClick={() => onSelect(skill)}
        >
          <div className="skill-item-header">
            <span className="skill-platform-badge">{stripDot(skill.platform)}</span>
            <span className="skill-version">{skill.version}</span>
            {skill.type === 'plugin' && <span className="type-badge plugin">🔌</span>}
            {skill.type === 'extension' && <span className="type-badge extension">🧩</span>}
          </div>
          <h3 className="skill-name">{skill.name}</h3>
          <p className="skill-description">{skill.description}</p>
          <div className="skill-item-footer">
            <span className={`skill-status ${skill.enabled ? 'enabled' : 'disabled'}`}>
              {skill.enabled ? '✅ 已启用' : '❌ 已禁用'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkillList;
