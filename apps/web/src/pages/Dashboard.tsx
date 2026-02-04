import { PageContainer } from '@/components/layout';
import { Card, Button, Badge } from '@/components/ui';
import { RiskGauge } from '@/components/dashboard/RiskGauge';
import { SourceCard } from '@/components/dashboard/SourceCard';
import { RiskTrendChart } from '@/components/charts/RiskTrendChart';
import { useDashboard, useTrendsRiskScore, useSyncStatus } from '@/hooks';
import { formatNumber, formatPercentage } from '@/lib/utils';
import {
  Users,
  Server,
  Shield,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
} from 'lucide-react';

export function Dashboard() {
  const { data, isLoading, refetch, isFetching } = useDashboard();
  const { data: trendData } = useTrendsRiskScore(14);
  const { data: syncStatus } = useSyncStatus();

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
          <Button onClick={() => refetch()} className="mt-4">
            重試
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { overallRiskScore, riskLevel, riskColor, sources, weights, dataQuality } = data;
  const { kb4, ncm, edr, hibp } = sources;

  return (
    <PageContainer
      title="資安情資總覽"
      description="WT 資安情資中心 - CISO Dashboard"
      actions={
        <div className="flex items-center gap-3">
          {syncStatus?.isSyncing && (
            <Badge variant="warning" className="flex items-center gap-1">
              <Clock className="w-3 h-3 animate-pulse" />
              同步中
            </Badge>
          )}
          <Button
            variant="outline"
            icon={<RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            重新整理
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Data Quality Warnings */}
        {dataQuality.warnings.length > 0 && (
          <Card className="bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">數據警告</h4>
                <ul className="mt-1 text-sm text-yellow-700">
                  {dataQuality.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Risk Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="整體風險指數" className="lg:col-span-1">
            <div className="flex flex-col items-center py-4">
              <RiskGauge score={overallRiskScore} level={riskLevel} color={riskColor} />
              {/* Weight breakdown */}
              <div className="mt-4 w-full">
                <div className="text-xs text-gray-500 mb-2 text-center">權重分配</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  <WeightBadge label="KB4" value={weights.kb4} score={kb4.score} />
                  <WeightBadge label="NCM" value={weights.ncm} score={ncm.score} />
                  <WeightBadge label="EDR" value={weights.edr} score={edr.score} />
                  <WeightBadge label="HIBP" value={weights.hibp} score={hibp.score} />
                </div>
              </div>
            </div>
          </Card>

          <Card title="風險趨勢 (14天)" className="lg:col-span-2">
            <div className="h-64">{trendData && <RiskTrendChart data={trendData} />}</div>
          </Card>
        </div>

        {/* Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SourceCard
            title="KB4 釣魚風險"
            icon={Users}
            mainValue={formatNumber(kb4.highRiskUsers)}
            mainLabel="高風險用戶"
            score={kb4.score}
            weight={weights.kb4}
            stats={[
              { label: '總用戶數', value: formatNumber(kb4.totalUsers) },
              { label: '平均風險', value: kb4.avgRiskScore.toFixed(1) },
              {
                label: '高風險比例',
                value: formatPercentage(kb4.riskPercentage),
                variant: kb4.riskPercentage > 10 ? 'danger' : 'success',
              },
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
            score={ncm.score}
            weight={weights.ncm}
            stats={[
              { label: '總設備數', value: formatNumber(ncm.totalDevices) },
              {
                label: 'P1 設備',
                value: formatNumber(ncm.byPriority.p1_next_cycle),
                variant: 'warning',
              },
              {
                label: '平均 CVSS',
                value: ncm.avgMaxCvss.toFixed(1),
                variant: ncm.avgMaxCvss >= 7 ? 'danger' : 'warning',
              },
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
            score={edr.score}
            weight={weights.edr}
            stats={[
              { label: '總警示數', value: formatNumber(edr.totalAlerts) },
              {
                label: 'High+',
                value: formatNumber(edr.bySeverity.high + edr.bySeverity.critical),
                variant: 'danger',
              },
              {
                label: '已解決',
                value: formatNumber(edr.byStatus.resolved),
                variant: 'success',
              },
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
            score={hibp.score}
            weight={weights.hibp}
            stats={[
              { label: '總外洩數', value: formatNumber(hibp.totalBreaches) },
              {
                label: '近期發現',
                value: formatNumber(hibp.recentBreaches),
                variant: hibp.recentBreaches > 0 ? 'warning' : 'success',
              },
              { label: '已通知', value: formatNumber(hibp.byStatus.notified) },
              {
                label: '已解決',
                value: formatNumber(hibp.byStatus.resolved),
                variant: 'success',
              },
            ]}
            color="bg-purple-500"
            href="/hibp"
          />
        </div>

        {/* Sync Status */}
        {syncStatus?.lastSyncResult && (
          <Card title="同步狀態" className="text-sm">
            <div className="flex flex-wrap gap-4">
              {(['kb4', 'ncm', 'edr', 'hibp'] as const).map((source) => {
                const result = syncStatus.lastSyncResult![source];
                return (
                  <div key={source} className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="uppercase font-medium">{source}:</span>
                    <span className="text-gray-600">{result.count} 筆</span>
                  </div>
                );
              })}
              {syncStatus.lastSyncTime && (
                <div className="ml-auto text-gray-500">
                  最後同步: {new Date(syncStatus.lastSyncTime).toLocaleString('zh-TW')}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

// Weight badge component
function WeightBadge({
  label,
  value,
  score,
}: {
  label: string;
  value: number;
  score: number;
}) {
  const percentage = Math.round(value * 100);
  const weightedScore = Math.round(score * value);

  return (
    <div className="flex flex-col items-center bg-gray-50 rounded px-2 py-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <span className="text-xs text-gray-500">{percentage}%</span>
      <span className="text-xs font-bold" style={{ color: getScoreColor(score) }}>
        +{weightedScore}
      </span>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 40) return '#ca8a04';
  if (score >= 20) return '#16a34a';
  return '#22c55e';
}
