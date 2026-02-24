import { useState } from 'react'
import PositionsList from '../components/PositionsList'
import PositionsCharts from '../components/PositionsCharts'
import type { Position } from '../components/PositionsList'

interface PositionsProps {
  positions: Position[]
}

function investedKey(p: Position): number {
  return p.costBasis !== undefined ? p.costBasis : p.xrpInvested
}

export default function Positions({ positions }: PositionsProps) {
  const [filter, setFilter] = useState<'all' | 'winning' | 'losing'>('all')
  const [sortBy, setSortBy] = useState<'profit' | 'time' | 'size'>('profit')

  const filteredPositions = positions.filter(pos => {
    if (filter === 'winning') return pos.profit > 0
    if (filter === 'losing') return pos.profit < 0
    return true
  })

  const sortedPositions = [...filteredPositions].sort((a, b) => {
    if (sortBy === 'profit') return b.profitPercent - a.profitPercent
    if (sortBy === 'size') return b.currentValue - a.currentValue
    if (sortBy === 'time') {
      const timeA = a.entryTime ? new Date(a.entryTime).getTime() : 0
      const timeB = b.entryTime ? new Date(b.entryTime).getTime() : 0
      return timeB - timeA
    }
    return 0
  })

  const totalInvested = positions.reduce((sum, p) => sum + investedKey(p), 0)
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
  const totalProfit = totalValue - totalInvested
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Positions</h1>
        <div className="page-stats">
          <div className="stat-pill">
            <span className="stat-label">Positions</span>
            <span className="stat-value">{positions.length}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Cost basis</span>
            <span className="stat-value">{totalInvested.toFixed(2)} XRP</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Market value</span>
            <span className="stat-value">{totalValue.toFixed(2)} XRP</span>
          </div>
          <div className={`stat-pill ${totalProfit >= 0 ? 'profit' : 'loss'}`}>
            <span className="stat-label">Total P/L</span>
            <span className="stat-value">
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} XRP
              {' '}({totalProfit >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="page-controls">
        <div className="filter-group">
          <label>Filter:</label>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'winning' ? 'active' : ''}`}
            onClick={() => setFilter('winning')}
          >
            Winning
          </button>
          <button
            className={`filter-btn ${filter === 'losing' ? 'active' : ''}`}
            onClick={() => setFilter('losing')}
          >
            Losing
          </button>
        </div>
        <div className="filter-group">
          <label>Sort by:</label>
          <button
            className={`filter-btn ${sortBy === 'profit' ? 'active' : ''}`}
            onClick={() => setSortBy('profit')}
          >
            P/L %
          </button>
          <button
            className={`filter-btn ${sortBy === 'time' ? 'active' : ''}`}
            onClick={() => setSortBy('time')}
          >
            Time
          </button>
          <button
            className={`filter-btn ${sortBy === 'size' ? 'active' : ''}`}
            onClick={() => setSortBy('size')}
          >
            Size
          </button>
        </div>
      </div>

      {positions.length > 0 && (
        <PositionsCharts positions={positions} />
      )}

      <PositionsList
        positions={sortedPositions}
        onPositionSold={() => {
          window.location.reload()
        }}
      />
    </div>
  )
}
