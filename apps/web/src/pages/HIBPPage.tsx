import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardStat, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, StatusBadge } from '@/components/ui';
import { BarChartComponent } from '@/components/charts';
import { useHIBPBreaches, useHIBPStats, useHIBPPending, useUpdateHIBPStatus } from '@/hooks';
import { formatNumber, formatDate } from '@/lib/utils';
import { KeyRound, AlertTriangle, Bell, CheckCircle, RefreshCw, Search } from 'lucide-react';

export function HIBPPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: stats } = useHIBPStats();
  const { data: breachesData, refetch } = useHIBPBreaches({
    page, limit: 15, search: search || undefined,
    status: statusFilter || undefined,
  });
  const { data: pendingData } = useHIBPPending(10);
  const updateStatus = useUpdateHIBPStatus();

  const topBreachesData = stats?.topDomains?.map((d: any) => ({
    name: d.domain,
    value: d.count,
  })) || [];

  const handleStatusChange = async (id: string, status: string) => {
    await updateStatus.mutateAsync({ id, status });
  };

  return (
    <PageContainer
      title="HIBP 帳號外洩"
      description="Have I Been Pwned 帳號外洩情資監控"
      actions={
        <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
          重新整理
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardStat title="總外洩數" value={formatNumber(stats?.totalBreaches || 0)} icon={KeyRound} variant="default" />
          <CardStat title="待處理" value={formatNumber(stats?.byStatus?.new || 0)} icon={AlertTriangle} variant="danger" />
          <CardStat title="已通知" value={formatNumber(stats?.byStatus?.notified || 0)} icon={Bell} variant="warning" />
          <CardStat title="已解決" value={formatNumber(stats?.byStatus?.resolved || 0)} icon={CheckCircle} variant="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Domains */}
          <Card title="受影響網域 (Top 10)">
            <div className="h-80">
              <BarChartComponent data={topBreachesData} layout="vertical" color="#8b5cf6" />
            </div>
          </Card>

          {/* Pending Breaches */}
          <Card title="待處理外洩" className="lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>外洩事件</TableHead>
                  <TableHead>發現日期</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingData?.data?.map((breach: any) => (
                  <TableRow key={breach.id}>
                    <TableCell className="font-medium">{breach.email}</TableCell>
                    <TableCell className="text-sm">{breach.breachName}</TableCell>
                    <TableCell className="text-sm">{formatDate(breach.discoveredAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(breach.id, 'notified')}>
                          通知
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(breach.id, 'resolved')}>
                          解決
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* All Breaches */}
        <Card title="所有外洩記錄">
          <div className="flex gap-4 mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="搜尋 Email..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">所有狀態</option>
              <option value="new">新增</option>
              <option value="notified">已通知</option>
              <option value="password_reset">密碼重設</option>
              <option value="resolved">已解決</option>
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>網域</TableHead>
                <TableHead>外洩事件</TableHead>
                <TableHead>外洩日期</TableHead>
                <TableHead>發現日期</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breachesData?.data?.map((breach: any) => (
                <TableRow key={breach.id}>
                  <TableCell className="font-medium">{breach.email}</TableCell>
                  <TableCell className="text-sm">{breach.domain}</TableCell>
                  <TableCell className="text-sm">{breach.breachName}</TableCell>
                  <TableCell className="text-sm">{breach.breachDate ? formatDate(breach.breachDate) : '-'}</TableCell>
                  <TableCell className="text-sm">{formatDate(breach.discoveredAt)}</TableCell>
                  <TableCell><StatusBadge status={breach.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {breachesData?.pagination && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                顯示 {(page - 1) * 15 + 1} - {Math.min(page * 15, breachesData.pagination.total)} / {breachesData.pagination.total} 筆
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
                <Button variant="outline" size="sm" disabled={page >= breachesData.pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
