import React from 'react';

interface PlatformFilterProps {
  platforms: string[];
  selectedPlatforms: Set<string>;
  onToggle: (platform: string) => void;
}

const PlatformFilter: React.FC<PlatformFilterProps> = ({
  platforms,
  selectedPlatforms,
  onToggle
}) => {
  if (platforms.length === 0) {
    return null;
  }

  return (
    <div className="platform-filter">
      <span className="filter-label">平台筛选:</span>
      {platforms.map(platform => (
        <button
          key={platform}
          className={`platform-btn ${selectedPlatforms.has(platform) ? 'active' : ''}`}
          onClick={() => onToggle(platform)}
        >
          {platform}
          <span className="platform-count">
            {/* TODO: 显示每个平台的技能数量 */}
          </span>
        </button>
      ))}
    </div>
  );
};

export default PlatformFilter;
