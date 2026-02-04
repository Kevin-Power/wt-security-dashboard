import { PageContainer } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { RiskGauge } from '@/components/dashboard/RiskGauge';
import { SourceCard } from '@/components/dashboard/SourceCard';
import { RiskTrendChart } from '@/components/charts/RiskTrendChart';
import { useDashboard, useTrendsRiskScore } from '@/hooks';
import { formatNumber, formatPercentage } from '@/lib/utils';
import { Users, Server, Shield, KeyRound, RefreshCw, AlertTriangle } from 'lucide-react';

export function Dashboard() {
  const { data, isLoading, refetch } = useDashboard();
  const { data: trendData } = useTrendsRiskScore(14);

  if (isLoading) {
    return (
      <PageContainer title="載入中...">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer title="錯誤">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">無法載入資料</p>
          <Button onClick={() => refetch()} className="mt-4">重試</Button>
        </div>
      </PageContainer>
    );
  }

  const { overallRiskScore, riskLevel, sources } = data;
  const { kb4, ncm, edr, hibp } = sources;

  return (
    <PageContainer
      title="資安情資總覽"
      description="WT 資安情資中心 - CISO Dashboard"
      actions={
        <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>
          重新整理
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Risk Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="整體風險指數" className="lg:col-span-1">
            <div className="flex justify-center py-4">
              <RiskGauge score={overallRiskScore} level={riskLevel} />
            </div>
          </Card>

          <Card title="風險趨勢 (14天)" className="lg:col-span-2">
            <div className="h-64">
              {trendData && <RiskTrendChart data={trendData} />}
            </div>
          </Card>
        </div>

        {/* Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SourceCard
            title="KB4 釣魚風險"
            icon={Users}
            mainValue={formatNumber(kb4.highRiskUsers)}
            mainLabel="高風險用戶"
            stats={[
              { label: '總用戶數', value: formatNumber(kb4.totalUsers) },
              { label: '平均風險', value: kb4.avgRiskScore.toFixed(1) },
              { label: '高風險比例', value: formatPercentage(kb4.riskPercentage), variant: kb4.riskPercentage > 10 ? 'danger' : 'success' },
              { label: '易受騙率', value: formatPercentage(kb4.avgPhishProneRate) },
            ]}
            color="bg-blue-500"
            href="/kb4"
          />

          <SourceCard
            title="NCM 設備漏洞"
            icon={Server}
            mainValue={formatNumber(ncm.byPriority.p0_immediate)}
            mainLabel="P0 緊急設備"
            stats={[
              { label: '總設備數', value: formatNumber(ncm.totalDevices) },
              { label: 'P1 設備', value: formatNumber(ncm.byPriority.p1_next_cycle), variant: 'warning' },
              { label: '平均 CVSS', value: ncm.avgMaxCvss.toFixed(1), variant: ncm.avgMaxCvss >= 7 ? 'danger' : 'warning' },
              { label: 'CVE 總數', value: formatNumber(ncm.totalCveInstances) },
            ]}
            color="bg-orange-500"
            href="/ncm"
          />

          <SourceCard
            title="EDR 警示"
            icon={Shield}
            mainValue={formatNumber(edr.pendingCount)}
            mainLabel="待處理警示"
            stats={[
              { label: '總警示數', value: formatNumber(edr.totalAlerts) },
              { label: 'High+', value: formatNumber(edr.bySeverity.high + edr.bySeverity.critical), variant: 'danger' },
              { label: '已解決', value: formatNumber(edr.byStatus.resolved), variant: 'success' },
              { label: '待處理率', value: formatPercentage(edr.pendingPercentage) },
            ]}
            color="bg-red-500"
            href="/edr"
          />

          <SourceCard
            title="HIBP 帳號外洩"
            icon={KeyRound}
            mainValue={formatNumber(hibp.pendingCount)}
            mainLabel="待處理外洩"
            stats={[
              { label: '總外洩數', value: formatNumber(hibp.totalBreaches) },
              { label: '近期發現', value: formatNumber(hibp.recentBreaches), variant: hibp.recentBreaches > 0 ? 'warning' : 'success' },
              { label: '已通知', value: formatNumber(hibp.byStatus.notified) },
              { label: '已解決', value: formatNumber(hibp.byStatus.resolved), variant: 'success' },
            ]}
            color="bg-purple-500"
            href="/hibp"
          />
        </div>
      </div>
    </PageContainer>
  );
}
