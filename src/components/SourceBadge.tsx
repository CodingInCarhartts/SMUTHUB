import { SOURCE_UI_CONFIG } from '../services/manga/types';

interface SourceBadgeProps {
  source: string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const config = (SOURCE_UI_CONFIG as Record<string, any>)[source];
  const icon = config?.icon || '📚';
  const displayName = config?.displayName || source;
  const shortName = displayName.replace(/[0-9]/g, '');

  return (
    <text style={`display: inline; margin-right: 4px;`}>
      {icon} {shortName}
    </text>
  );
}
