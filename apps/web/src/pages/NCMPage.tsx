import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardStat, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, PriorityBadge } from '@/components/ui';
import { PieChartComponent } from '@/components/charts';
import { useNCMDevices, useNCMStats, useNCMCritical } from '@/hooks';
import { formatNumber } from '@/lib/utils';
import { Server, AlertTriangle, Shield, Activity, RefreshCw, Search } from 'lucide-react';

export function NCMPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const { data: stats } = useNCMStats();
  const { data: devicesData, refetch } = useNCMDevices({ 
    page, 
    limit: 15, 
    search: search || undefined,
    priority: priorityFilter || undefined,
  });
  const { data: criticalData } = useNCMCritical(10);

  const priorityChartData = stats ? [
    { name: 'P0 緊急', value: stats.byPriority.p0_immediate, color: '#ef4444' },
    { name: 'P1 下週期', value: stats.byPriority.p1_next_cycle, color: '#f97316' },
    { name: 'P3 監控', value: stats.byPriority.p3_monitor, color: '#22c55e' },
  ] : [];

  return (
    <PageContainer
      title="NCM 設備漏洞"
      description="網路設備漏洞管理與韌體狀態"
      actions={
        <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
          重新整理
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardStat title="總設備數" value={formatNumber(stats?.totalDevices || 0)} icon={Server} variant="default" />
          <CardStat title="P0 緊急" value={formatNumber(stats?.byPriority?.p0_immediate || 0)} icon={AlertTriangle} variant="danger" />
          <CardStat title="平均 CVSS" value={stats?.cvss?.average?.toFixed(1) || '0'} icon={Shield} variant="warning" />
          <CardStat title="CVE 總數" value={formatNumber(stats?.totals?.cveInstances || 0)} icon={Activity} variant="default" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Priority Distribution */}
          <Card title="優先級分佈">
            <div className="h-64">
              <PieChartComponent data={priorityChartData} innerRadius={50} outerRadius={80} />
            </div>
          </Card>

          {/* Critical Devices */}
          <Card title="P0 緊急設備 (Top 10)" className="lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>設備名稱</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>型號</TableHead>
                  <TableHead>CVSS</TableHead>
                  <TableHead>CVE 數</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criticalData?.data?.map((device: any) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.deviceName}</TableCell>
                    <TableCell className="text-sm text-gray-600">{device.deviceIp || '-'}</TableCell>
                    <TableCell className="text-sm">{device.hwModel || '-'}</TableCell>
                    <TableCell>
                      <span className={device.maxCvss >= 9 ? 'text-red-600 font-bold' : device.maxCvss >= 7 ? 'text-orange-600 font-semibold' : ''}>
                        {device.maxCvss.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>{device.totalCveInstances}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* All Devices */}
        <Card title="所有設備">
          <div className="flex gap-4 mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋設備..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">所有優先級</option>
              <option value="P0-Immediate">P0 緊急</option>
              <option value="P1-NextCycle">P1 下週期</option>
              <option value="P3-Monitor">P3 監控</option>
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>設備名稱</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>型號</TableHead>
                <TableHead>韌體</TableHead>
                <TableHead>優先級</TableHead>
                <TableHead>CVSS</TableHead>
                <TableHead>CVE 數</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devicesData?.data?.map((device: any) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.deviceName}</TableCell>
                  <TableCell className="text-sm text-gray-600">{device.deviceIp || '-'}</TableCell>
                  <TableCell className="text-sm">{device.hwModel || '-'}</TableCell>
                  <TableCell className="text-sm">{device.fwVersion || '-'}</TableCell>
                  <TableCell><PriorityBadge priority={device.updatePriority} /></TableCell>
                  <TableCell>
                    <span className={device.maxCvss >= 9 ? 'text-red-600 font-bold' : device.maxCvss >= 7 ? 'text-orange-600' : ''}>
                      {device.maxCvss.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>{device.totalCveInstances}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {devicesData?.pagination && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                顯示 {(page - 1) * 15 + 1} - {Math.min(page * 15, devicesData.pagination.total)} / {devicesData.pagination.total} 筆
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
                <Button variant="outline" size="sm" disabled={page >= devicesData.pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
