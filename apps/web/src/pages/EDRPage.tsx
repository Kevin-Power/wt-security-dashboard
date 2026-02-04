import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardStat, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, SeverityBadge, StatusBadge } from '@/components/ui';
import { LineChartComponent, PieChartComponent } from '@/components/charts';
import { useEDRAlerts, useEDRStats, useEDRPending, useEDRTimeline, useUpdateEDRStatus } from '@/hooks';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle, Clock, RefreshCw, Search } from 'lucide-react';

export function EDRPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: stats } = useEDRStats();
  const { data: alertsData, refetch } = useEDRAlerts({ 
    page, limit: 15, search: search || undefined,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: pendingData } = useEDRPending(10);
  const { data: timelineData } = useEDRTimeline();
  const updateStatus = useUpdateEDRStatus();

  const severityChartData = stats?.bySeverity ? [
    { name: 'Critical', value: stats.bySeverity.critical || 0, color: '#991b1b' },
    { name: 'High', value: stats.bySeverity.high || 0, color: '#ef4444' },
    { name: 'Medium', value: stats.bySeverity.medium || 0, color: '#f97316' },
    { name: 'Low', value: stats.bySeverity.low || 0, color: '#22c55e' },
  ] : [];

  const handleStatusChange = async (id: string, status: string) => {
    await updateStatus.mutateAsync({ id, status });
  };

  return (
    <PageContainer
      title="EDR 警示"
      description="CrowdStrike EDR 端點偵測與回應"
      actions={
        <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
          重新整理
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardStat title="總警示數" value={formatNumber(stats?.totalAlerts || 0)} icon={Shield} variant="default" />
          <CardStat title="待處理" value={formatNumber(stats?.byStatus?.new + stats?.byStatus?.investigating || 0)} icon={Clock} variant="warning" />
          <CardStat title="High+" value={formatNumber((stats?.bySeverity?.high || 0) + (stats?.bySeverity?.critical || 0))} icon={AlertTriangle} variant="danger" />
          <CardStat title="已解決" value={formatNumber(stats?.byStatus?.resolved || 0)} icon={CheckCircle} variant="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Severity Distribution */}
          <Card title="嚴重度分佈">
            <div className="h-64">
              <PieChartComponent data={severityChartData} innerRadius={50} outerRadius={80} />
            </div>
          </Card>

          {/* Timeline */}
          <Card title="7 天趨勢" className="lg:col-span-2">
            <div className="h-64">
              {timelineData && (
                <LineChartComponent
                  data={timelineData}
                  lines={[{ key: 'count', color: '#ef4444', name: '警示數' }]}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Pending Alerts */}
        <Card title="待處理警示 (Top 10)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>偵測時間</TableHead>
                <TableHead>主機</TableHead>
                <TableHead>IOA</TableHead>
                <TableHead>嚴重度</TableHead>
                <TableHead>VT 判定</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingData?.data?.map((alert: any) => (
                <TableRow key={alert.id}>
                  <TableCell className="text-sm">{formatDateTime(alert.detectedAt)}</TableCell>
                  <TableCell className="font-medium">{alert.hostname}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{alert.ioaName}</TableCell>
                  <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                  <TableCell>
                    <span className={alert.vtVerdict === 'malicious' ? 'text-red-600' : 'text-gray-600'}>
                      {alert.vtVerdict || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(alert.id, 'investigating')}>
                        調查
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleStatusChange(alert.id, 'resolved')}>
                        解決
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* All Alerts */}
        <Card title="所有警示">
          <div className="flex gap-4 mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="搜尋..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">所有嚴重度</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">所有狀態</option>
              <option value="new">新增</option>
              <option value="investigating">調查中</option>
              <option value="resolved">已解決</option>
              <option value="false_positive">誤報</option>
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>偵測時間</TableHead>
                <TableHead>主機</TableHead>
                <TableHead>IOA</TableHead>
                <TableHead>嚴重度</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>VT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertsData?.data?.map((alert: any) => (
                <TableRow key={alert.id}>
                  <TableCell className="text-sm">{formatDateTime(alert.detectedAt)}</TableCell>
                  <TableCell className="font-medium">{alert.hostname}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{alert.ioaName}</TableCell>
                  <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                  <TableCell><StatusBadge status={alert.status} /></TableCell>
                  <TableCell className={alert.vtVerdict === 'malicious' ? 'text-red-600' : ''}>{alert.vtVerdict || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {alertsData?.pagination && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                顯示 {(page - 1) * 15 + 1} - {Math.min(page * 15, alertsData.pagination.total)} / {alertsData.pagination.total} 筆
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
                <Button variant="outline" size="sm" disabled={page >= alertsData.pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
