import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card } from '@/components/ui';
import { LineChartComponent, BarChartComponent } from '@/components/charts';
import {
  useTrendsRiskScore,
  useTrendsComparison,
  useTrendsKB4,
  useTrendsNCM,
  useTrendsEDR,
  useTrendsHIBP,
} from '@/hooks';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

const periodOptions = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
  { value: 90, label: '90 Days' },
];

export function TrendsPage() {
  const [days, setDays] = useState(30);

  const { data: riskScoreData, isLoading: isLoadingRisk } = useTrendsRiskScore(days);
  const { data: comparisonData, isLoading: isLoadingComparison } = useTrendsComparison();
  const { data: kb4Data, isLoading: isLoadingKB4 } = useTrendsKB4(days);
  const { data: ncmData, isLoading: isLoadingNCM } = useTrendsNCM(days);
  const { data: edrData, isLoading: isLoadingEDR } = useTrendsEDR(days);
  const { data: hibpData, isLoading: isLoadingHIBP } = useTrendsHIBP(days);

  const isLoading =
    isLoadingRisk ||
    isLoadingComparison ||
    isLoadingKB4 ||
    isLoadingNCM ||
    isLoadingEDR ||
    isLoadingHIBP;

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (change: number, inverse = false) => {
    if (inverse) {
      if (change > 0) return 'text-green-600';
      if (change < 0) return 'text-red-600';
    } else {
      if (change > 0) return 'text-red-600';
      if (change < 0) return 'text-green-600';
    }
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <PageContainer title="Trends Analysis" description="Loading trend data...">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Trends Analysis"
      description="Historical security metrics and trend analysis"
    >
      {/* Period Selector */}
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-gray-500" />
        <span className="text-sm text-gray-600">Period:</span>
        <div className="flex gap-2">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setDays(option.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                days === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Week-over-Week Comparison */}
      {comparisonData && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Week-over-Week Comparison
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Risk Score</span>
                {getTrendIcon(comparisonData.riskScore?.change || 0)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {comparisonData.riskScore?.current?.toFixed(1) || 'N/A'}
              </div>
              <div
                className={`text-sm ${getTrendColor(
                  comparisonData.riskScore?.change || 0
                )}`}
              >
                {comparisonData.riskScore?.change > 0 ? '+' : ''}
                {comparisonData.riskScore?.change?.toFixed(1) || '0'}% vs last week
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">High Risk Users</span>
                {getTrendIcon(comparisonData.highRiskUsers?.change || 0)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {comparisonData.highRiskUsers?.current || 0}
              </div>
              <div
                className={`text-sm ${getTrendColor(
                  comparisonData.highRiskUsers?.change || 0
                )}`}
              >
                {comparisonData.highRiskUsers?.change > 0 ? '+' : ''}
                {comparisonData.highRiskUsers?.change || 0} vs last week
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">P0 Devices</span>
                {getTrendIcon(comparisonData.p0Devices?.change || 0)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {comparisonData.p0Devices?.current || 0}
              </div>
              <div
                className={`text-sm ${getTrendColor(
                  comparisonData.p0Devices?.change || 0
                )}`}
              >
                {comparisonData.p0Devices?.change > 0 ? '+' : ''}
                {comparisonData.p0Devices?.change || 0} vs last week
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Pending Alerts</span>
                {getTrendIcon(comparisonData.pendingAlerts?.change || 0)}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {comparisonData.pendingAlerts?.current || 0}
              </div>
              <div
                className={`text-sm ${getTrendColor(
                  comparisonData.pendingAlerts?.change || 0
                )}`}
              >
                {comparisonData.pendingAlerts?.change > 0 ? '+' : ''}
                {comparisonData.pendingAlerts?.change || 0} vs last week
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Overall Risk Score Trend */}
      {riskScoreData && riskScoreData.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Overall Risk Score Trend
          </h3>
          <LineChartComponent
            data={riskScoreData}
            lines={[
              { dataKey: 'riskScore', name: 'Risk Score', color: '#3b82f6' },
            ]}
            xAxisKey="date"
            height={300}
          />
        </Card>
      )}

      {/* Source-specific Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KB4 Trends */}
        {kb4Data && kb4Data.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              KnowBe4 - User Risk Trends
            </h3>
            <LineChartComponent
              data={kb4Data}
              lines={[
                { dataKey: 'avgRiskScore', name: 'Avg Risk Score', color: '#f59e0b' },
                { dataKey: 'highRiskUsers', name: 'High Risk Users', color: '#ef4444' },
              ]}
              xAxisKey="date"
              height={250}
            />
          </Card>
        )}

        {/* NCM Trends */}
        {ncmData && ncmData.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              NCM - Device Vulnerability Trends
            </h3>
            <BarChartComponent
              data={ncmData}
              bars={[
                { dataKey: 'p0Devices', name: 'P0 (Immediate)', color: '#ef4444' },
                { dataKey: 'p1Devices', name: 'P1 (Next Cycle)', color: '#f59e0b' },
              ]}
              xAxisKey="date"
              height={250}
            />
          </Card>
        )}

        {/* EDR Trends */}
        {edrData && edrData.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              CrowdStrike EDR - Alert Trends
            </h3>
            <LineChartComponent
              data={edrData}
              lines={[
                { dataKey: 'totalAlerts', name: 'Total Alerts', color: '#3b82f6' },
                { dataKey: 'pendingAlerts', name: 'Pending', color: '#ef4444' },
                { dataKey: 'resolvedAlerts', name: 'Resolved', color: '#10b981' },
              ]}
              xAxisKey="date"
              height={250}
            />
          </Card>
        )}

        {/* HIBP Trends */}
        {hibpData && hibpData.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              HIBP - Breach Detection Trends
            </h3>
            <LineChartComponent
              data={hibpData}
              lines={[
                { dataKey: 'totalBreaches', name: 'Total Breaches', color: '#8b5cf6' },
                { dataKey: 'newBreaches', name: 'New Breaches', color: '#ef4444' },
              ]}
              xAxisKey="date"
              height={250}
            />
          </Card>
        )}
      </div>

      {/* Empty State */}
      {(!riskScoreData || riskScoreData.length === 0) &&
        (!kb4Data || kb4Data.length === 0) &&
        (!ncmData || ncmData.length === 0) &&
        (!edrData || edrData.length === 0) &&
        (!hibpData || hibpData.length === 0) && (
          <Card className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <TrendingUp className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Trend Data Available
            </h3>
            <p className="text-gray-500">
              Trend data will be available once daily snapshots are collected.
              Please check back after the sync job has run for a few days.
            </p>
          </Card>
        )}
    </PageContainer>
  );
}
