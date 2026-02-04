import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SourceCardProps {
  title: string;
  icon: LucideIcon;
  mainValue: number | string;
  mainLabel: string;
  stats: { label: string; value: number | string; variant?: 'success' | 'warning' | 'danger' }[];
  color: string;
  href: string;
}

export function SourceCard({ title, icon: Icon, mainValue, mainLabel, stats, color, href }: SourceCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-lg', color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <a href={href} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          查看詳情 →
        </a>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      
      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900">{mainValue}</span>
        <span className="ml-2 text-sm text-gray-500">{mainLabel}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={cn(
              'text-lg font-semibold',
              stat.variant === 'danger' ? 'text-red-600' :
              stat.variant === 'warning' ? 'text-yellow-600' :
              stat.variant === 'success' ? 'text-green-600' : 'text-gray-900'
            )}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
