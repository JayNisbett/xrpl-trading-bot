import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Socket } from 'socket.io-client'
import toast from 'react-hot-toast'
import BotPnLChart from '../components/BotPnLChart'
import LogPanel from '../components/LogPanel'

interface BotDetailProps {
  socket: Socket | null
}

interface BotInstance {
  id: string
  configId: string
  name: string
  mode: string
  status: string
  startedAt?: Date
  error?: string
  config?: any
}

export default function BotDetail({ socket }: BotDetailProps) {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const [instance, setInstance] = useState<BotInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [arbitrageStats, setArbitrageStats] = useState({
    scansCompleted: 0,
    opportunitiesFound: 0,
    opportunitiesFiltered: 0,
    tradesExecuted: 0,
    tradesFailed: 0
  })

  useEffect(() => {
    if (botId) {
      fetchBotInstance()
      fetchLogs()
      const interval = setInterval(() => {
        fetchBotInstance()
        fetchLogs()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [botId])

  const fetchLogs = async () => {
    if (!botId) return
    
    try {
      const response = await fetch(`http://localhost:3000/api/logs/bot/${botId}?limit=100`)
      if (response.ok) {
        const data = await response.json()
        const logs = data.logs || []
        setRecentLogs(logs)
        
        // Calculate arbitrage stats from logs
        const stats = {
          scansCompleted: logs.filter((l: any) => 
            l.category === 'Arbitrage' && l.message.includes('Scanning')).length,
          opportunitiesFound: logs.filter((l: any) => 
            l.category === 'Arbitrage' && l.message.includes('Found')).length,
          opportunitiesFiltered: logs.filter((l: any) => 
            l.category === 'Arbitrage' && l.level === 'warning').length,
          tradesExecuted: logs.filter((l: any) => 
            l.category === 'Arbitrage' && l.message.includes('executed successfully')).length,
          tradesFailed: logs.filter((l: any) => 
            l.category === 'Arbitrage' && l.message.includes('execution failed')).length
        }
        
        setArbitrageStats(stats)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  const fetchBotInstance = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/instances')
      if (response.ok) {
        const instances = await response.json()
        const found = instances.find((i: BotInstance) => i.id === botId)
        if (found) {
          setInstance(found)
        } else {
          toast.error('Bot instance not found')
          navigate('/configs')
        }
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch bot instance:', error)
      setLoading(false)
    }
  }

  const stopBot = async () => {
    if (!botId) return
    
    try {
      const response = await fetch(`http://localhost:3000/api/instances/${botId}/stop`, {
        method: 'POST'
      })
      
      if (response.ok) {
        toast.success('Bot stopped successfully')
        fetchBotInstance()
      } else {
        const error = await response.json()
        toast.error(`Failed to stop bot: ${error.error}`)
      }
    } catch (error) {
      toast.error('Failed to stop bot')
    }
  }

  const restartBot = async () => {
    if (!botId) return
    
    try {
      const response = await fetch(`http://localhost:3000/api/instances/${botId}/restart`, {
        method: 'POST'
      })
      
      if (response.ok) {
        toast.success('Bot restarting...')
        fetchBotInstance()
      } else {
        const error = await response.json()
        toast.error(`Failed to restart bot: ${error.error}`)
      }
    } catch (error) {
      toast.error('Failed to restart bot')
    }
  }

  if (loading) {
    return (
      <div className="page bot-detail-page">
        <div className="loading-state">
          <div className="loading-spinner">⟳</div>
          <p>Loading bot details...</p>
        </div>
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="page bot-detail-page">
        <div className="empty-state-fancy">
          <div className="empty-icon">🤖</div>
          <div className="empty-title">Bot not found</div>
          <div className="empty-message">This bot instance may have been stopped or removed.</div>
          <button className="empty-action-btn" onClick={() => navigate('/configs')}>
            Back to Configurations
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page bot-detail-page">
      {/* Header */}
      <div className="bot-detail-header">
        <button className="back-btn" onClick={() => navigate('/configs')}>
          ← Back
        </button>
        
        <div className="bot-detail-title-section">
          <div className="bot-detail-title-group">
            <h1 className="page-title">{instance.name}</h1>
            <span className={`status-badge-large ${instance.status}`}>
              {instance.status === 'running' && '✓ Running'}
              {instance.status === 'stopped' && '⏸ Stopped'}
              {instance.status === 'error' && '⚠️ Error'}
              {instance.status === 'starting' && '⟳ Starting'}
              {instance.status === 'stopping' && '⏹ Stopping'}
            </span>
          </div>
          
          <div className="bot-detail-meta">
            <span className="meta-item">
              <span className="meta-label">ID:</span>
              <span className="meta-value">{instance.id}</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">Mode:</span>
              <span className="meta-value">{instance.mode}</span>
            </span>
            {instance.startedAt && (
              <span className="meta-item">
                <span className="meta-label">Started:</span>
                <span className="meta-value">
                  {new Date(instance.startedAt).toLocaleString()}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="bot-detail-actions">
          {instance.status === 'running' && (
            <>
              <button className="action-btn stop" onClick={stopBot}>
                ⏹ Stop Bot
              </button>
              <button className="action-btn restart" onClick={restartBot}>
                ↻ Restart Bot
              </button>
            </>
          )}
          {instance.status === 'stopped' && (
            <button className="action-btn start" onClick={() => navigate('/configs')}>
              ▶️ Start Bot
            </button>
          )}
        </div>
      </div>

      {instance.error && (
        <div className="bot-detail-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{instance.error}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="bot-detail-grid">
        {/* Left Column - P&L and Stats */}
        <div className="bot-detail-column left">
          {instance.config?.amm?.arbitrage?.enabled && (
            <div className="bot-detail-section">
              <div className="section-header">
                <h2 className="section-title">🔍 Arbitrage Stats</h2>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card-value">{arbitrageStats.scansCompleted}</div>
                  <div className="stat-card-label">Scans</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value">{arbitrageStats.opportunitiesFound}</div>
                  <div className="stat-card-label">Found</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-card-value">{arbitrageStats.opportunitiesFiltered}</div>
                  <div className="stat-card-label">Filtered</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-card-value">{arbitrageStats.tradesExecuted}</div>
                  <div className="stat-card-label">Executed</div>
                </div>
                <div className="stat-card error">
                  <div className="stat-card-value">{arbitrageStats.tradesFailed}</div>
                  <div className="stat-card-label">Failed</div>
                </div>
              </div>
              
              {arbitrageStats.scansCompleted > 5 && arbitrageStats.tradesExecuted === 0 && (
                <div className="stats-insight">
                  <span className="insight-icon">💡</span>
                  <div className="insight-content">
                    <div className="insight-title">No trades executed yet</div>
                    <div className="insight-text">
                      {arbitrageStats.opportunitiesFound === 0 && 
                        'No arbitrage opportunities detected. This is normal - real opportunities are rare on XRPL AMMs.'}
                      {arbitrageStats.opportunitiesFound > 0 && arbitrageStats.opportunitiesFiltered > 0 &&
                        `Opportunities found but filtered. Common reasons: trade amount exceeds max (${instance.config?.amm?.arbitrage?.maxTradeAmount || 5} XRP), extreme prices, or XRP as token. Check logs.`}
                      {arbitrageStats.tradesFailed > 0 &&
                        'Some trades attempted but failed. Check error logs for transaction issues.'}
                    </div>
                    {instance.config?.amm?.arbitrage && (
                      <div className="insight-config">
                        <strong>Current Limits:</strong> Min Profit: {instance.config.amm.arbitrage.minProfitPercent}% | 
                        Max Trade: {instance.config.amm.arbitrage.maxTradeAmount} XRP
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bot-detail-section">
            <div className="section-header">
              <h2 className="section-title">📊 Performance</h2>
            </div>
            <BotPnLChart botId={instance.id} botName={instance.name} />
          </div>

          {instance.config && (
            <div className="bot-detail-section">
              <div className="section-header">
                <h2 className="section-title">⚙️ Configuration</h2>
              </div>
              <div className="config-display">
                {instance.config.sniper?.enabled && (
                  <div className="config-item">
                    <span className="config-icon">🎯</span>
                    <div className="config-info">
                      <div className="config-label">Token Sniper</div>
                      <div className="config-value">
                        {instance.config.sniper.riskScore} risk • 
                        {instance.config.sniper.snipeAmount} amount
                      </div>
                    </div>
                  </div>
                )}
                
                {instance.config.copyTrading?.enabled && (
                  <div className="config-item">
                    <span className="config-icon">👥</span>
                    <div className="config-info">
                      <div className="config-label">Copy Trading</div>
                      <div className="config-value">
                        {instance.config.copyTrading.traderAddresses?.length || 0} traders
                      </div>
                    </div>
                  </div>
                )}
                
                {instance.config.amm?.enabled && (
                  <div className="config-item">
                    <span className="config-icon">🌊</span>
                    <div className="config-info">
                      <div className="config-label">AMM Trading</div>
                      <div className="config-value">
                        {instance.config.amm.arbitrage?.enabled && 'Arbitrage • '}
                        {instance.config.amm.liquidity?.enabled && 'Liquidity'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Activity Log */}
        <div className="bot-detail-column right">
          <LogPanel 
            botId={instance.id} 
            botName={instance.name}
            socket={socket}
          />
        </div>
      </div>
    </div>
  )
}
