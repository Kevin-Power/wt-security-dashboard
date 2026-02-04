import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface LineConfig {
  key?: string;
  dataKey?: string;
  color: string;
  name: string;
}

interface LineChartProps {
  data: Record<string, any>[];
  lines: LineConfig[];
  xAxisKey?: string;
  height?: number;
}

export function LineChartComponent({ data, lines, xAxisKey = 'date', height = 300 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            if (typeof value === 'string' && value.length > 5) {
              return value.slice(5);
            }
            return value;
          }}
          stroke="#9ca3af"
        />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <Legend />
        {lines.map((line) => {
          const lineKey = line.dataKey || line.key || '';
          return (
            <Line
              key={lineKey}
              type="monotone"
              dataKey={lineKey}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={line.name}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
