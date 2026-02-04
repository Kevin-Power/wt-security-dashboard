import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function Card({ children, className, title, description, action }: CardProps) {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export function CardStat({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'text-primary-600 bg-primary-50',
    success: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    danger: 'text-red-600 bg-red-50',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {Icon && (
          <div className={cn('p-2 rounded-lg', variantStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <p className={cn('mt-2 text-sm', change >= 0 ? 'text-red-600' : 'text-green-600')}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% {changeLabel || '較上週'}
        </p>
      )}
    </div>
  );
}
