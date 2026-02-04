import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardStat, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button } from '@/components/ui';
import { BarChartComponent } from '@/components/charts';
import { useKB4Users, useKB4Stats, useKB4ByDepartment, useKB4HighRisk } from '@/hooks';
import { formatNumber, formatPercentage, formatDateTime } from '@/lib/utils';
import { Users, AlertTriangle, TrendingUp, Search, RefreshCw } from 'lucide-react';

export function KB4Page() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data: stats } = useKB4Stats();
  const { data: usersData, refetch } = useKB4Users({ page, limit: 15, search: search || undefined });
  const { data: deptData } = useKB4ByDepartment();
  const { data: highRiskData } = useKB4HighRisk(10);

  const chartData = deptData?.slice(0, 10).map((d: any) => ({
    name: d.department?.split(' ')[0] || 'N/A',
    value: d.avgRiskScore,
  })) || [];

  return (
    <PageContainer
      title="KB4 釣魚風險"
      description="員工資安意識訓練與釣魚測試結果"
      actions={
        <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
          重新整理
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardStat
            title="總用戶數"
            value={formatNumber(stats?.totalUsers || 0)}
            icon={Users}
            variant="default"
          />
          <CardStat
            title="活躍用戶"
            value={formatNumber(stats?.activeUsers || 0)}
            icon={Users}
            variant="success"
          />
          <CardStat
            title="高風險用戶"
            value={formatNumber(stats?.highRiskUsers || 0)}
            icon={AlertTriangle}
            variant="danger"
          />
          <CardStat
            title="平均風險分數"
            value={stats?.averages?.riskScore?.toFixed(1) || '0'}
            icon={TrendingUp}
            variant="warning"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Risk Chart */}
          <Card title="部門風險排名 (Top 10)" className="lg:col-span-1">
            <div className="h-80">
              <BarChartComponent data={chartData} layout="vertical" color="#3b82f6" />
            </div>
          </Card>

          {/* High Risk Users */}
          <Card title="高風險用戶" className="lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用戶</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>風險分數</TableHead>
                  <TableHead>易受騙率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRiskData?.data?.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{user.department?.split(' ')[0] || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.currentRiskScore >= 50 ? 'danger' : 'warning'}>
                        {user.currentRiskScore.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPercentage(user.phishPronePercentage)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* All Users Table */}
        <Card title="所有用戶">
          <div className="mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋用戶..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用戶</TableHead>
                <TableHead>部門</TableHead>
                <TableHead>組織</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>風險分數</TableHead>
                <TableHead>易受騙率</TableHead>
                <TableHead>最後登入</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersData?.data?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.department?.split(' ')[0] || '-'}</TableCell>
                  <TableCell className="text-sm">{user.organization?.split(' ')[0] || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'success' : 'default'}>
                      {user.status === 'active' ? '活躍' : '歸檔'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.currentRiskScore >= 50 ? 'danger' : user.currentRiskScore >= 30 ? 'warning' : 'success'}>
                      {user.currentRiskScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatPercentage(user.phishPronePercentage)}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {user.lastSignIn ? formatDateTime(user.lastSignIn) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {usersData?.pagination && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                顯示 {(page - 1) * 15 + 1} - {Math.min(page * 15, usersData.pagination.total)} / {usersData.pagination.total} 筆
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
                <Button variant="outline" size="sm" disabled={page >= usersData.pagination.totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
