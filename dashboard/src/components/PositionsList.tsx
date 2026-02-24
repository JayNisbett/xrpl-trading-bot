import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export interface Position {
  symbol: string
  displayName?: string
  currency: string
  issuer: string
  tokensHeld: number
  xrpInvested: number
  costBasis?: number
  currentValue: number
  profit: number
  profitPercent: number
  entryPrice: number
  currentPrice: number
  entryTime?: string
  riskLevel?: 'low' | 'medium' | 'high'
  liquidity?: number
  source?: 'sniper' | 'copy' | 'wallet'
}

interface PositionsListProps {
  positions: Position[]
  onPositionSold?: () => void
}

function getRiskColor(risk?: string) {
  switch (risk) {
    case 'low': return '#22c55e'
    case 'medium': return '#eab308'
    case 'high': return '#ef4444'
    default: return '#64748b'
  }
}

function getRiskLabel(risk?: string) {
  return risk ? risk.charAt(0).toUpperCase() + risk.slice(1) : 'Unknown'
}

export default function PositionsList({ positions, onPositionSold }: PositionsListProps) {
  const [sellModal, setSellModal] = useState<{ position: Position; amount: number } | null>(null)
  const [selling, setSelling] = useState(false)

  const investedKey = (p: Position) => (p.costBasis !== undefined ? p.costBasis : p.xrpInvested)
  const totalInvested = positions.reduce((sum, p) => sum + investedKey(p), 0)
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
  const totalProfit = totalValue - totalInvested
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

  const displayName = (p: Position) => p.displayName || p.symbol

  if (positions.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Active Positions</h2>
        <div className="empty-state">
          <p>No active positions</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="card-title">Active Positions ({positions.length})</h2>

      <div className="portfolio-summary">
        <div className="summary-item">
          <span>Cost basis:</span>
          <strong>{totalInvested.toFixed(2)} XRP</strong>
        </div>
        <div className="summary-item">
          <span>Current value:</span>
          <strong>{totalValue.toFixed(2)} XRP</strong>
        </div>
        <div className="summary-item">
          <span>Total P/L:</span>
          <strong className={totalProfit >= 0 ? 'profit' : 'loss'}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} XRP
            ({totalProfit >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
          </strong>
        </div>
      </div>

      <div className="positions-table-wrap">
        <table className="positions-table">
          <thead>
            <tr>
              <th>Symbol / Name</th>
              <th>Source</th>
              <th className="num">Entry price</th>
              <th className="num">Current price</th>
              <th className="num">Quantity</th>
              <th className="num">Cost basis</th>
              <th className="num">Value</th>
              <th className="num">P/L</th>
              <th>Held</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => (
              <tr key={`${position.currency}-${position.issuer}-${index}`}>
                <td>
                  <span className="position-symbol">{displayName(position)}</span>
                  {position.symbol !== displayName(position) && (
                    <span className="position-code" title={position.currency}>{position.symbol}</span>
                  )}
                </td>
                <td>
                  {position.source && (
                    <span className="source-badge" title={`Source: ${position.source}`}>
                      {position.source === 'sniper' ? 'Sniper' : position.source === 'copy' ? 'Copy' : 'Wallet'}
                    </span>
                  )}
                  {position.riskLevel && (
                    <span
                      className="risk-badge"
                      style={{ borderColor: getRiskColor(position.riskLevel), color: getRiskColor(position.riskLevel) }}
                    >
                      {getRiskLabel(position.riskLevel)}
                    </span>
                  )}
                </td>
                <td className="num">
                  {investedKey(position) > 0 ? `${position.entryPrice.toFixed(6)} XRP` : '—'}
                </td>
                <td className="num">{position.currentPrice.toFixed(6)} XRP</td>
                <td className="num">{position.tokensHeld.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className="num">{investedKey(position).toFixed(2)} XRP</td>
                <td className="num">{position.currentValue.toFixed(2)} XRP</td>
                <td className="num">
                  <span className={position.profit >= 0 ? 'profit' : 'loss'}>
                    {position.profit >= 0 ? '+' : ''}{position.profit.toFixed(2)} XRP
                    <br />
                    <small>({position.profit >= 0 ? '+' : ''}{position.profitPercent.toFixed(2)}%)</small>
                  </span>
                </td>
                <td>
                  {position.entryTime ? formatDistanceToNow(new Date(position.entryTime), { addSuffix: false }) : '—'}
                </td>
                <td className="actions-col">
                  <div className="position-actions-inline">
                    <button
                      type="button"
                      className="sell-btn-inline"
                      onClick={() => setSellModal({ position, amount: position.tokensHeld * 0.25 })}
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      className="sell-btn-inline"
                      onClick={() => setSellModal({ position, amount: position.tokensHeld * 0.5 })}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      className="sell-btn-inline sell-all"
                      onClick={() => setSellModal({ position, amount: position.tokensHeld })}
                    >
                      All
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sellModal && (
        <div className="modal-overlay" onClick={() => setSellModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Confirm sell</h2>
            <div className="sell-confirmation">
              <div className="confirm-details">
                <div className="detail-row">
                  <span className="label">Token:</span>
                  <span className="value">{displayName(sellModal.position)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Amount:</span>
                  <span className="value">{sellModal.amount.toFixed(2)} tokens</span>
                </div>
                <div className="detail-row">
                  <span className="label">Current price:</span>
                  <span className="value">{sellModal.position.currentPrice.toFixed(6)} XRP</span>
                </div>
                <div className="detail-row">
                  <span className="label">Est. receive:</span>
                  <span className="value">{(sellModal.amount * sellModal.position.currentPrice).toFixed(2)} XRP</span>
                </div>
                <div className="detail-row">
                  <span className="label">P/L:</span>
                  <span className={`value ${sellModal.position.profit >= 0 ? 'profit' : 'loss'}`}>
                    {sellModal.position.profit >= 0 ? '+' : ''}{sellModal.position.profitPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setSellModal(null)} className="cancel-btn" disabled={selling}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setSelling(true)
                    try {
                      const response = await fetch('http://localhost:3000/api/positions/sell', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          currency: sellModal.position.currency,
                          issuer: sellModal.position.issuer,
                          amount: sellModal.amount
                        })
                      })
                      if (response.ok) {
                        toast.success(`Sold ${sellModal.amount.toFixed(2)} ${displayName(sellModal.position)}`)
                        setSellModal(null)
                        onPositionSold?.()
                      } else {
                        const error = await response.json()
                        toast.error(error.message || 'Failed to sell position')
                      }
                    } catch {
                      toast.error('Error selling position')
                    } finally {
                      setSelling(false)
                    }
                  }}
                  className="submit-btn sell-submit-btn"
                  disabled={selling}
                >
                  {selling ? 'Selling…' : 'Confirm sell'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
