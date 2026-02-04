import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SourceCardProps {
  title: string;
  icon: LucideIcon;
  mainValue: number | string;
  mainLabel: string;
  score?: number;
  weight?: number;
  stats: { label: string; value: number | string; variant?: 'success' | 'warning' | 'danger' }[];
  color: string;
  href: string;
}

export function SourceCard({
  title,
  icon: Icon,
  mainValue,
  mainLabel,
  score,
  weight,
  stats,
  color,
  href,
}: SourceCardProps) {
  const weightedScore = score !== undefined && weight !== undefined ? Math.round(score * weight) : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-lg', color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2">
          {score !== undefined && (
            <div className="flex flex-col items-end text-xs">
              <span className="text-gray-500">風險分</span>
              <span
                className="font-bold"
                style={{ color: getScoreColor(score) }}
              >
                {Math.round(score)}
              </span>
            </div>
          )}
          <a
            href={href}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            查看詳情 →
          </a>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>

      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900">{mainValue}</span>
        <span className="ml-2 text-sm text-gray-500">{mainLabel}</span>
      </div>

      {/* Score bar */}
      {score !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>風險程度</span>
            {weight !== undefined && (
              <span>權重 {Math.round(weight * 100)}% (+{weightedScore})</span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(score, 100)}%`,
                backgroundColor: getScoreColor(score),
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p
              className={cn(
                'text-lg font-semibold',
                stat.variant === 'danger'
                  ? 'text-red-600'
                  : stat.variant === 'warning'
                    ? 'text-yellow-600'
                    : stat.variant === 'success'
                      ? 'text-green-600'
                      : 'text-gray-900'
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#dc2626'; // red-600
  if (score >= 60) return '#ea580c'; // orange-600
  if (score >= 40) return '#ca8a04'; // yellow-600
  if (score >= 20) return '#16a34a'; // green-600
  return '#22c55e'; // green-500
}
