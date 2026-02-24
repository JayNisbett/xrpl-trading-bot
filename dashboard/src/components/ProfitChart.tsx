import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  timestamp: string
  profit: number
  portfolioValue: number
}

interface ProfitChartProps {
  data: DataPoint[]
}

export default function ProfitChart({ data }: ProfitChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h2>📈 Profit Over Time</h2>
        <div className="empty-state">
          <p>No historical data yet. Start trading to see your profit chart!</p>
        </div>
      </div>
    )
  }

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm')
    } catch {
      return timestamp
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="chart-tooltip">
          <p className="tooltip-time">{format(new Date(data.timestamp), 'MMM dd, HH:mm')}</p>
          <p className="tooltip-value profit">
            Profit: {data.profit >= 0 ? '+' : ''}{data.profit.toFixed(2)} XRP
          </p>
          <p className="tooltip-value">
            Portfolio: {data.portfolioValue.toFixed(2)} XRP
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card">
      <h2>📈 Profit Over Time</h2>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${value.toFixed(1)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="portfolioValue" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="chart-legend-horizontal">
          <div className="legend-item">
            <span className="legend-line profit-line"></span>
            <span>Total Profit</span>
          </div>
          <div className="legend-item">
            <span className="legend-line portfolio-line"></span>
            <span>Portfolio Value</span>
          </div>
        </div>
      </div>
    </div>
  )
}
