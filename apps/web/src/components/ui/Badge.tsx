import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span className={cn('inline-flex items-center font-medium rounded-full', variants[variant], sizes[size])}>
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const variant = {
    Critical: 'danger',
    High: 'danger',
    Medium: 'warning',
    Low: 'info',
  }[severity] as 'danger' | 'warning' | 'info' | 'default';

  return <Badge variant={variant || 'default'}>{severity}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
    new: { variant: 'danger', label: '新增' },
    investigating: { variant: 'warning', label: '調查中' },
    resolved: { variant: 'success', label: '已解決' },
    false_positive: { variant: 'default', label: '誤報' },
    notified: { variant: 'info', label: '已通知' },
    password_reset: { variant: 'warning', label: '密碼重設' },
    active: { variant: 'success', label: '活躍' },
    archived: { variant: 'default', label: '已歸檔' },
  };

  const { variant, label } = config[status] || { variant: 'default', label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { variant: 'danger' | 'warning' | 'info'; label: string }> = {
    'P0-Immediate': { variant: 'danger', label: 'P0 立即' },
    'P1-NextCycle': { variant: 'warning', label: 'P1 下週期' },
    'P3-Monitor': { variant: 'info', label: 'P3 監控' },
  };

  const { variant, label } = config[priority] || { variant: 'info', label: priority };
  return <Badge variant={variant}>{label}</Badge>;
}
