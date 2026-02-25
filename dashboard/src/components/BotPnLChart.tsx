import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { apiFetch } from '../lib/api'

interface PnLDataPoint {
  timestamp: string
  profit: number
  cumulative: number
}

interface BotPnLChartProps {
  botId: string
  botName: string
}

export default function BotPnLChart({ botId, botName }: BotPnLChartProps) {
  const [data, setData] = useState<PnLDataPoint[]>([])
  const [stats, setStats] = useState({
    totalProfit: 0,
    totalTrades: 0,
    winRate: 0,
    bestTrade: 0,
    worstTrade: 0
  })

  useEffect(() => {
    fetchBotPnL()
    const interval = setInterval(fetchBotPnL, 5000)
    return () => clearInterval(interval)
  }, [botId])

  const fetchBotPnL = async () => {
    try {
      const response = await apiFetch(`/api/bot/${botId}/pnl`)
      if (response.ok) {
        const result = await response.json()
        setData(result.data || [])
        setStats(result.stats || stats)
      }
    } catch (error) {
      console.error('Failed to fetch bot P&L:', error)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatProfit = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)} XRP`
  }

  return (
    <div className="bot-pnl-chart">
      <div className="pnl-header">
        <h3 className="pnl-title">📊 {botName} P&L</h3>
        <div className="pnl-stats">
          <div className="stat-item">
            <span className="stat-label">Total P&L</span>
            <span className={`stat-value ${stats.totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {formatProfit(stats.totalProfit)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Trades</span>
            <span className="stat-value">{stats.totalTrades}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{stats.winRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="pnl-chart-container">
        {data.length === 0 ? (
          <div className="pnl-empty">
            <div className="empty-icon">📈</div>
            <div className="empty-text">No trades yet</div>
            <div className="empty-subtext">P&L will appear when bot starts trading</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`colorPnl-${botId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTime}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                tickFormatter={(value) => `${value.toFixed(1)}`}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
                formatter={(value: number) => [formatProfit(value), 'Cumulative P&L']}
                labelFormatter={(label) => new Date(label).toLocaleString()}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#colorPnl-${botId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="pnl-footer">
        <div className="pnl-range">
          <span className="range-label">Best:</span>
          <span className="range-value positive">{formatProfit(stats.bestTrade)}</span>
        </div>
        <div className="pnl-range">
          <span className="range-label">Worst:</span>
          <span className="range-value negative">{formatProfit(stats.worstTrade)}</span>
        </div>
      </div>
    </div>
  )
}
