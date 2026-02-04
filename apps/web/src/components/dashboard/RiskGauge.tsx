import { cn } from '@/lib/utils';

interface RiskGaugeProps {
  score: number;
  level: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskGauge({ score, level, size = 'lg' }: RiskGaugeProps) {
  const sizes = {
    sm: { width: 120, height: 120, strokeWidth: 8, fontSize: 'text-2xl' },
    md: { width: 160, height: 160, strokeWidth: 10, fontSize: 'text-3xl' },
    lg: { width: 200, height: 200, strokeWidth: 12, fontSize: 'text-4xl' },
  };

  const { width, height, strokeWidth, fontSize } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const progress = (score / 100) * circumference;

  const levelLabels: Record<string, string> = {
    critical: '嚴重',
    high: '高',
    medium: '中等',
    low: '低',
    minimal: '極低',
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: height / 2 + 20 }}>
        <svg width={width} height={height / 2 + 20} className="transform -rotate-0">
          {/* Background arc */}
          <path
            d={`M ${strokeWidth / 2} ${height / 2} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${height / 2}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M ${strokeWidth / 2} ${height / 2} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${height / 2}`}
            fill="none"
            stroke={
              level === 'critical' ? '#ef4444' :
              level === 'high' ? '#f97316' :
              level === 'medium' ? '#eab308' :
              level === 'low' ? '#84cc16' : '#22c55e'
            }
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className={cn('font-bold', fontSize)}>{score}</span>
          <span className="text-sm text-gray-500">/ 100</span>
        </div>
      </div>
      <div className={cn(
        'mt-2 px-4 py-1 rounded-full text-sm font-medium',
        level === 'critical' ? 'bg-red-100 text-red-700' :
        level === 'high' ? 'bg-orange-100 text-orange-700' :
        level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
        level === 'low' ? 'bg-lime-100 text-lime-700' : 'bg-green-100 text-green-700'
      )}>
        風險等級: {levelLabels[level] || level}
      </div>
    </div>
  );
}
