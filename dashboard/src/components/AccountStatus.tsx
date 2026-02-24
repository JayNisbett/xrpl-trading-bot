interface AccountStatusProps {
  data: {
    xrpBalance: number
    lockedReserves: number
    tradableXRP: number
    activePositions: number
    maxPositions: number
    positionsAvailable: number
    healthStatus: string
  } | null
}

export default function AccountStatus({ data }: AccountStatusProps) {
  if (!data) return <div>Loading...</div>

  const healthColor = {
    healthy: '#22c55e',
    warning: '#eab308',
    critical: '#ef4444'
  }[data.healthStatus.toLowerCase()] || '#6b7280'

  return (
    <div className="card">
      <h2>💰 Account Status</h2>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Total Balance</div>
          <div className="stat-value">{data.xrpBalance.toFixed(2)} XRP</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tradable</div>
          <div className="stat-value">{data.tradableXRP.toFixed(2)} XRP</div>
        </div>
        <div className="stat">
          <div className="stat-label">Locked Reserves</div>
          <div className="stat-value">{data.lockedReserves.toFixed(2)} XRP</div>
        </div>
        <div className="stat">
          <div className="stat-label">Positions</div>
          <div className="stat-value">
            {data.activePositions}/{data.maxPositions}
            <span className="stat-sub">({data.positionsAvailable} available)</span>
          </div>
        </div>
        <div className="stat health-stat" style={{ borderColor: healthColor }}>
          <div className="stat-label">Health Status</div>
          <div className="stat-value" style={{ color: healthColor }}>
            {data.healthStatus.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  )
}
