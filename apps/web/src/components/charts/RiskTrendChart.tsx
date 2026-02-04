import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RiskTrendChartProps {
  data: { date: string; riskScore: number }[];
}

export function RiskTrendChart({ data }: RiskTrendChartProps) {
  const getColor = (score: number) => {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f97316';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#84cc16';
    return '#22c55e';
  };

  const latestScore = data[data.length - 1]?.riskScore || 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={getColor(latestScore)} stopOpacity={0.3} />
            <stop offset="95%" stopColor={getColor(latestScore)} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => value.slice(5)} // Show MM-DD
          stroke="#9ca3af"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          formatter={(value: number) => [`${value}`, '風險分數']}
          labelFormatter={(label) => `日期: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="riskScore"
          stroke={getColor(latestScore)}
          strokeWidth={2}
          fill="url(#riskGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
