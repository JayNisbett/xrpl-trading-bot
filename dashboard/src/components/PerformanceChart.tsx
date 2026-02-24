interface PerformanceChartProps {
  metrics: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    winRate: number
  } | null
}

export default function PerformanceChart({ metrics }: PerformanceChartProps) {
  if (!metrics) return <div>Loading...</div>

  const winPercentage = metrics.totalTrades > 0 
    ? (metrics.winningTrades / metrics.totalTrades) * 100 
    : 0
  const lossPercentage = metrics.totalTrades > 0 
    ? (metrics.losingTrades / metrics.totalTrades) * 100 
    : 0

  return (
    <div className="card">
      <h2>📈 Win/Loss Distribution</h2>
      <div className="chart-container">
        <div className="pie-chart">
          <svg viewBox="0 0 200 200" className="pie-svg">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#22c55e"
              strokeWidth="40"
              strokeDasharray={`${winPercentage * 5.03} 503`}
              transform="rotate(-90 100 100)"
            />
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#ef4444"
              strokeWidth="40"
              strokeDasharray={`${lossPercentage * 5.03} 503`}
              strokeDashoffset={-winPercentage * 5.03}
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="95" textAnchor="middle" className="pie-center-text">
              {metrics.winRate.toFixed(1)}%
            </text>
            <text x="100" y="115" textAnchor="middle" className="pie-center-subtext">
              Win Rate
            </text>
          </svg>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot profit"></span>
            <span>Wins: {metrics.winningTrades}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot loss"></span>
            <span>Losses: {metrics.losingTrades}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
