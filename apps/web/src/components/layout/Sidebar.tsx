import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Server,
  Shield,
  KeyRound,
  TrendingUp,
  Settings,
  RefreshCw,
} from 'lucide-react';

const navigation = [
  { name: '總覽', href: '/', icon: LayoutDashboard },
  { name: 'KB4 釣魚風險', href: '/kb4', icon: Users },
  { name: 'NCM 設備漏洞', href: '/ncm', icon: Server },
  { name: 'EDR 警示', href: '/edr', icon: Shield },
  { name: 'HIBP 帳號外洩', href: '/hibp', icon: KeyRound },
  { name: '趨勢分析', href: '/trends', icon: TrendingUp },
];

const secondaryNavigation = [
  { name: '同步設定', href: '/sync', icon: RefreshCw },
  { name: '系統設定', href: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <div className="flex flex-col w-64 bg-gray-900 min-h-screen">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 bg-gray-800">
        <Shield className="w-8 h-8 text-primary-500" />
        <span className="ml-3 text-xl font-bold text-white">WT Security</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Secondary Navigation */}
      <div className="px-4 py-4 border-t border-gray-800">
        {secondaryNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
