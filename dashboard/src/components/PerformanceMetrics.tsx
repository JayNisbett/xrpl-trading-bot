interface PerformanceMetricsProps {
  data: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    winRate: number
    totalProfit: number
    averageProfit: number
  } | null
}

export default function PerformanceMetrics({ data }: PerformanceMetricsProps) {
  if (!data) return <div>Loading...</div>

  return (
    <div className="card">
      <h2>🎯 Performance Metrics</h2>
      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-label">Total Trades</div>
          <div className="metric-value">{data.totalTrades}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Winning Trades</div>
          <div className="metric-value profit">{data.winningTrades}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Losing Trades</div>
          <div className="metric-value loss">{data.losingTrades}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Win Rate</div>
          <div className="metric-value">
            {data.winRate.toFixed(1)}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Total Profit</div>
          <div className={`metric-value ${data.totalProfit >= 0 ? 'profit' : 'loss'}`}>
            {data.totalProfit >= 0 ? '+' : ''}{data.totalProfit.toFixed(2)} XRP
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Avg Profit/Trade</div>
          <div className={`metric-value ${data.averageProfit >= 0 ? 'profit' : 'loss'}`}>
            {data.averageProfit >= 0 ? '+' : ''}{data.averageProfit.toFixed(2)} XRP
          </div>
        </div>
      </div>
    </div>
  )
}
