import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { apiFetch } from '../lib/api'

interface PoolMetrics {
  ammId: string
  asset1: { currency: string; issuer?: string }
  asset2: { currency: string; issuer?: string }
  tvl: number
  apr?: number
  tradingFee: number
  liquidityDepth: number
  priceImpact: number
}

interface LPPosition {
  poolId: string
  asset1: { currency: string; issuer?: string }
  asset2: { currency: string; issuer?: string }
  lpTokens: number
  currentValue: number
  feesEarned: number
  impermanentLoss: number
  apr: number
  entryTime: Date
  strategy: string
}

interface ArbitrageStats {
  totalExecutions: number
  successfulExecutions: number
  totalProfit: number
  successRate: number
  averageProfit?: number
}

export default function AMMPools() {
  const [pools, setPools] = useState<PoolMetrics[]>([])
  const [positions, setPositions] = useState<LPPosition[]>([])
  const [arbStats, setArbStats] = useState<ArbitrageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPool, setSelectedPool] = useState<PoolMetrics | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'apr' | 'tvl' | 'depth'>('apr')
  const [filterRisk, setFilterRisk] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async (showRefreshToast = false) => {
    if (showRefreshToast) setRefreshing(true)
    
    try {
      const [poolsRes, positionsRes, statsRes] = await Promise.all([
        apiFetch('/api/amm/pools'),
        apiFetch('/api/amm/positions'),
        apiFetch('/api/amm/stats')
      ])

      if (poolsRes.ok) setPools(await poolsRes.json())
      if (positionsRes.ok) setPositions(await positionsRes.json())
      if (statsRes.ok) setArbStats(await statsRes.json())
      
      setLoading(false)
      setRefreshing(false)
      
      if (showRefreshToast) {
        toast.success('Data refreshed', { duration: 2000 })
      }
    } catch (error) {
      console.error('Failed to fetch AMM data:', error)
      setLoading(false)
      setRefreshing(false)
      if (showRefreshToast) {
        toast.error('Failed to refresh data')
      }
    }
  }

  const getRiskLevel = (pool: PoolMetrics): 'low' | 'medium' | 'high' => {
    if (pool.tvl >= 500 && pool.priceImpact <= 0.02) return 'low'
    if (pool.tvl >= 100 && pool.priceImpact <= 0.05) return 'medium'
    return 'high'
  }

  const getFilteredAndSortedPools = () => {
    let filtered = pools.filter(pool => {
      const matchesSearch = 
        pool.asset1.currency.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pool.asset2.currency.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRisk = filterRisk === 'all' || getRiskLevel(pool) === filterRisk
      
      return matchesSearch && matchesRisk
    })

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'apr':
          return (b.apr || 0) - (a.apr || 0)
        case 'tvl':
          return b.tvl - a.tvl
        case 'depth':
          return b.liquidityDepth - a.liquidityDepth
        default:
          return 0
      }
    })
  }

  const calculateTimeHeld = (entryTime: Date): string => {
    try {
      return formatDistanceToNow(new Date(entryTime), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  const calculateEstimatedDailyReturn = (position: LPPosition): number => {
    return (position.currentValue * (position.apr / 100)) / 365
  }

  const enterPool = async (pool: PoolMetrics, amount: number, strategy: string) => {
    try {
      const response = await apiFetch('/api/amm/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: pool.ammId,
          amount,
          strategy
        })
      })

      if (response.ok) {
        toast.success(`Entered liquidity pool!`)
        fetchData()
      } else {
        toast.error('Failed to enter pool')
      }
    } catch (error) {
      toast.error('Error entering pool')
    }
    setSelectedPool(null)
  }

  const exitPosition = async (position: LPPosition) => {
    if (!confirm(`Exit ${position.asset1.currency}/${position.asset2.currency} position?`)) return

    try {
      const response = await apiFetch('/api/amm/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: position.poolId
        })
      })

      if (response.ok) {
        toast.success('Position exited!')
        fetchData()
      } else {
        toast.error('Failed to exit position')
      }
    } catch (error) {
      toast.error('Error exiting position')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Scanning AMM pools on XRPL...</div>
          <div className="loading-subtext">This may take 10-30 seconds</div>
        </div>
      </div>
    )
  }

  const filteredPools = getFilteredAndSortedPools()
  const totalLPValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0)
  const totalFeesEarned = positions.reduce((sum, pos) => sum + pos.feesEarned, 0)
  const avgAPR = positions.length > 0 
    ? positions.reduce((sum, pos) => sum + pos.apr, 0) / positions.length 
    : 0

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">🌊 AMM Pools & Arbitrage</h1>
          <p className="page-subtitle">Automated liquidity provision and cross-pool arbitrage</p>
        </div>
        <button 
          className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          {refreshing ? '⟳ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {arbStats && (
        <div className="amm-stats-overview">
          <div className="stat-card arb-card">
            <div className="stat-icon">💱</div>
            <div className="stat-content">
              <div className="stat-label">Arbitrage Executions</div>
              <div className="stat-value">{arbStats.totalExecutions}</div>
              <div className="stat-detail">
                {arbStats.successfulExecutions} successful ({arbStats.successRate.toFixed(1)}%)
              </div>
            </div>
          </div>
          
          <div className="stat-card profit-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">Arbitrage Profit</div>
              <div className="stat-value profit">+{arbStats.totalProfit.toFixed(3)} XRP</div>
              <div className="stat-detail">
                {arbStats.averageProfit ? `Avg: ${arbStats.averageProfit.toFixed(3)} XRP` : 'No trades yet'}
              </div>
            </div>
          </div>

          <div className="stat-card lp-card">
            <div className="stat-icon">💧</div>
            <div className="stat-content">
              <div className="stat-label">LP Positions</div>
              <div className="stat-value">{positions.length}</div>
              <div className="stat-detail">
                {totalLPValue.toFixed(2)} XRP total value
              </div>
            </div>
          </div>

          <div className="stat-card fees-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <div className="stat-label">Fees Earned</div>
              <div className="stat-value profit">+{totalFeesEarned.toFixed(3)} XRP</div>
              <div className="stat-detail">
                {avgAPR > 0 ? `Avg APR: ${avgAPR.toFixed(1)}%` : 'No positions'}
              </div>
            </div>
          </div>
        </div>
      )}

      {positions.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>💧 Active Liquidity Positions ({positions.length})</h2>
            <div className="section-summary">
              Total Value: <span className="highlight">{totalLPValue.toFixed(2)} XRP</span>
              <span className="separator">•</span>
              Fees: <span className="profit">+{totalFeesEarned.toFixed(3)} XRP</span>
            </div>
          </div>
          
          <div className="lp-positions-grid">
            {positions.map((pos, idx) => {
              const timeHeld = calculateTimeHeld(pos.entryTime)
              const dailyReturn = calculateEstimatedDailyReturn(pos)
              const ilStatus = pos.impermanentLoss < -5 ? 'high' : pos.impermanentLoss < 0 ? 'medium' : 'low'
              
              return (
                <div key={idx} className={`lp-position-card il-${ilStatus}`}>
                  <div className="lp-header">
                    <div className="lp-title-group">
                      <h3>{pos.asset1.currency}/{pos.asset2.currency}</h3>
                      <span className="time-held">{timeHeld}</span>
                    </div>
                    <span className={`strategy-badge ${pos.strategy}`}>{pos.strategy}</span>
                  </div>
                  
                  <div className="lp-primary-stats">
                    <div className="primary-stat">
                      <span className="primary-label">Current Value</span>
                      <span className="primary-value">{pos.currentValue.toFixed(3)} XRP</span>
                    </div>
                    <div className="primary-stat">
                      <span className="primary-label">APR</span>
                      <span className={`primary-value ${pos.apr > 25 ? 'profit' : pos.apr > 15 ? '' : 'warning'}`}>
                        {pos.apr.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="lp-stats">
                    <div className="lp-stat">
                      <span className="lp-label">Fees Earned</span>
                      <span className="lp-value profit">+{pos.feesEarned.toFixed(4)} XRP</span>
                    </div>
                    <div className="lp-stat">
                      <span className="lp-label">Daily Est.</span>
                      <span className="lp-value">~{dailyReturn.toFixed(4)} XRP</span>
                    </div>
                    <div className="lp-stat">
                      <span className="lp-label">Impermanent Loss</span>
                      <span className={`lp-value ${pos.impermanentLoss < -5 ? 'loss' : pos.impermanentLoss < 0 ? 'warning' : 'profit'}`}>
                        {pos.impermanentLoss.toFixed(2)}%
                      </span>
                    </div>
                    <div className="lp-stat">
                      <span className="lp-label">LP Tokens</span>
                      <span className="lp-value">{pos.lpTokens.toFixed(2)}</span>
                    </div>
                  </div>

                  {pos.impermanentLoss < -8 && (
                    <div className="il-warning">
                      ⚠️ High impermanent loss - consider exiting
                    </div>
                  )}

                  <div className="lp-footer">
                    <button className="exit-btn exit-full" onClick={() => exitPosition(pos)}>
                      Exit Position
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h2>🏊 Available Pools ({filteredPools.length})</h2>
        </div>

        <div className="pools-controls">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search pools by token..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          <div className="filter-controls">
            <div className="control-group">
              <label>Sort By:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="control-select">
                <option value="apr">Highest APR</option>
                <option value="tvl">Highest TVL</option>
                <option value="depth">Highest Depth</option>
              </select>
            </div>

            <div className="control-group">
              <label>Risk:</label>
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value as any)} className="control-select">
                <option value="all">All Risks</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>
          </div>
        </div>

        {filteredPools.length === 0 ? (
          <div className="empty-state-fancy">
            <div className="empty-icon">🏊</div>
            <div className="empty-title">No pools found</div>
            <div className="empty-message">
              {searchTerm || filterRisk !== 'all' 
                ? 'Try adjusting your filters or search term' 
                : 'The bot is still discovering AMM pools. This may take a few minutes.'}
            </div>
            {(searchTerm || filterRisk !== 'all') && (
              <button 
                className="empty-action-btn"
                onClick={() => {
                  setSearchTerm('')
                  setFilterRisk('all')
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="pools-grid">
            {filteredPools.map((pool, idx) => {
              const riskLevel = getRiskLevel(pool)
              const isHighYield = (pool.apr || 0) >= 25
              const isMediumYield = (pool.apr || 0) >= 15 && (pool.apr || 0) < 25
              
              return (
                <div key={idx} className={`pool-card risk-${riskLevel}`}>
                  <div className="pool-header">
                    <div className="pool-title-group">
                      <h3>{pool.asset1.currency}/{pool.asset2.currency}</h3>
                      <div className="pool-badges">
                        {isHighYield && <span className="yield-badge high">🔥 High Yield</span>}
                        {isMediumYield && <span className="yield-badge medium">⭐ Good Yield</span>}
                        <span className={`risk-badge-small ${riskLevel}`}>
                          {riskLevel === 'low' ? '🟢' : riskLevel === 'medium' ? '🟡' : '🔴'} {riskLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pool-primary-metrics">
                    <div className="pool-primary-metric">
                      <div className="metric-icon">📊</div>
                      <div className="metric-info">
                        <span className="metric-label">TVL</span>
                        <span className="metric-value">{pool.tvl.toFixed(2)} XRP</span>
                      </div>
                    </div>
                    <div className="pool-primary-metric">
                      <div className="metric-icon">💹</div>
                      <div className="metric-info">
                        <span className="metric-label">Est. APR</span>
                        <span className={`metric-value ${isHighYield ? 'profit' : ''}`}>
                          {pool.apr ? `${pool.apr.toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pool-secondary-metrics">
                    <div className="secondary-metric">
                      <span className="metric-label">Trading Fee</span>
                      <span className="metric-value">{(pool.tradingFee / 100).toFixed(2)}%</span>
                    </div>
                    <div className="secondary-metric">
                      <span className="metric-label">Liquidity Depth</span>
                      <span className="metric-value">{pool.liquidityDepth.toFixed(2)} XRP</span>
                    </div>
                    <div className="secondary-metric">
                      <span className="metric-label">Price Impact</span>
                      <span className={`metric-value ${pool.priceImpact > 0.03 ? 'warning' : ''}`}>
                        {(pool.priceImpact * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="pool-quality-bar">
                    <div className="quality-indicator">
                      <span className="quality-label">Liquidity:</span>
                      <div className="quality-bar">
                        <div 
                          className={`quality-fill ${pool.tvl > 500 ? 'high' : pool.tvl > 100 ? 'medium' : 'low'}`}
                          style={{ width: `${Math.min(100, (pool.tvl / 1000) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="quality-value">
                        {pool.tvl > 500 ? 'Excellent' : pool.tvl > 100 ? 'Good' : 'Fair'}
                      </span>
                    </div>
                  </div>

                  <button 
                    className="enter-pool-btn"
                    onClick={() => setSelectedPool(pool)}
                  >
                    <span className="btn-icon">💧</span>
                    Enter Pool
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedPool && (
        <div className="modal-overlay" onClick={() => setSelectedPool(null)}>
          <div className="modal-content amm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💧 Enter Liquidity Pool</h2>
              <button className="modal-close" onClick={() => setSelectedPool(null)}>✕</button>
            </div>
            
            <div className="pool-entry-form">
              <div className="pool-info-detailed">
                <div className="pool-info-header">
                  <h3>{selectedPool.asset1.currency}/{selectedPool.asset2.currency}</h3>
                  <span className={`risk-badge-small ${getRiskLevel(selectedPool)}`}>
                    {getRiskLevel(selectedPool)} risk
                  </span>
                </div>
                
                <div className="pool-metrics-detailed">
                  <div className="metric-row">
                    <span className="metric-label">
                      <span className="metric-icon">💹</span>
                      Estimated APR
                    </span>
                    <span className="metric-value profit">{selectedPool.apr?.toFixed(2)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">
                      <span className="metric-icon">📊</span>
                      Total Value Locked
                    </span>
                    <span className="metric-value">{selectedPool.tvl.toFixed(2)} XRP</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">
                      <span className="metric-icon">💧</span>
                      Liquidity Depth
                    </span>
                    <span className="metric-value">{selectedPool.liquidityDepth.toFixed(2)} XRP</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">
                      <span className="metric-icon">📈</span>
                      Trading Fee
                    </span>
                    <span className="metric-value">{(selectedPool.tradingFee / 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">
                      <span className="metric-icon">⚡</span>
                      Price Impact (1 XRP)
                    </span>
                    <span className={`metric-value ${selectedPool.priceImpact > 0.03 ? 'warning' : 'profit'}`}>
                      {(selectedPool.priceImpact * 100).toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const amount = parseFloat(formData.get('amount') as string)
                const strategy = formData.get('strategy') as string
                enterPool(selectedPool, amount, strategy)
              }}>
                <div className="form-group-enhanced">
                  <label>Deposit Amount</label>
                  <div className="input-with-unit">
                    <input 
                      type="number" 
                      name="amount"
                      step="0.1" 
                      min="0.1" 
                      max="10"
                      defaultValue="2"
                      required 
                      className="amount-input"
                    />
                    <span className="input-unit">XRP</span>
                  </div>
                  <div className="input-suggestions">
                    <button type="button" className="suggestion-chip" onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.previousElementSibling as HTMLDivElement)?.querySelector('input')
                      if (input) input.value = '1'
                    }}>1 XRP</button>
                    <button type="button" className="suggestion-chip" onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.previousElementSibling as HTMLDivElement)?.querySelector('input')
                      if (input) input.value = '2'
                    }}>2 XRP</button>
                    <button type="button" className="suggestion-chip" onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.previousElementSibling as HTMLDivElement)?.querySelector('input')
                      if (input) input.value = '5'
                    }}>5 XRP</button>
                  </div>
                  <small className="form-hint">
                    💡 Recommended: 2-5 XRP for optimal risk/reward
                  </small>
                </div>

                <div className="form-group-enhanced">
                  <label>Entry Strategy</label>
                  <div className="strategy-options">
                    <label className="strategy-option">
                      <input type="radio" name="strategy" value="one-sided" defaultChecked />
                      <div className="strategy-card">
                        <div className="strategy-title">
                          <span className="strategy-icon">🎯</span>
                          One-Sided
                        </div>
                        <div className="strategy-desc">Deposit only XRP. Simpler but higher slippage.</div>
                        <div className="strategy-tag">Recommended for beginners</div>
                      </div>
                    </label>
                    <label className="strategy-option">
                      <input type="radio" name="strategy" value="balanced" />
                      <div className="strategy-card">
                        <div className="strategy-title">
                          <span className="strategy-icon">⚖️</span>
                          Balanced
                        </div>
                        <div className="strategy-desc">Deposit XRP + tokens. Lower slippage.</div>
                        <div className="strategy-tag">Requires token holdings</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="estimated-returns">
                  <div className="returns-title">📈 Estimated Returns</div>
                  <div className="returns-grid">
                    <div className="return-item">
                      <span className="return-period">Daily</span>
                      <span className="return-amount">
                        ~{((2 * (selectedPool.apr || 0)) / 365 / 100).toFixed(4)} XRP
                      </span>
                    </div>
                    <div className="return-item">
                      <span className="return-period">Weekly</span>
                      <span className="return-amount">
                        ~{((2 * (selectedPool.apr || 0)) / 52 / 100).toFixed(3)} XRP
                      </span>
                    </div>
                    <div className="return-item">
                      <span className="return-period">Monthly</span>
                      <span className="return-amount">
                        ~{((2 * (selectedPool.apr || 0)) / 12 / 100).toFixed(2)} XRP
                      </span>
                    </div>
                  </div>
                  <div className="returns-note">
                    Based on 2 XRP deposit at {selectedPool.apr?.toFixed(1)}% APR
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => setSelectedPool(null)} className="cancel-btn">
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn primary">
                    <span className="btn-icon">💧</span>
                    Enter Pool
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
