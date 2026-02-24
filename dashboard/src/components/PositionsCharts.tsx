import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface PositionForChart {
  symbol: string
  displayName?: string
  currentValue: number
}

const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
]

interface PositionsChartsProps {
  positions: PositionForChart[]
}

export default function PositionsCharts({ positions }: PositionsChartsProps) {
  const total = positions.reduce((sum, p) => sum + p.currentValue, 0)
  const data = positions
    .map((p, i) => ({
      name: p.displayName || p.symbol,
      value: p.currentValue,
      color: CHART_COLORS[i % CHART_COLORS.length]
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (data.length === 0 || total <= 0) return null

  return (
    <div className="card positions-charts-card">
      <h2 className="card-title">Portfolio allocation</h2>
      <div className="positions-charts-inner">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)} XRP`, 'Value']}
              contentStyle={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)'
              }}
              labelFormatter={label => label}
            />
            <Legend
              formatter={(value, entry: { payload?: { value: number } }) => {
                const pct = entry?.payload?.value != null && total > 0
                  ? ((entry.payload.value / total) * 100).toFixed(1)
                  : '0'
                return `${value} (${pct}%)`
              }}
              wrapperStyle={{ fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
