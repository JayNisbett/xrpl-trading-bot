import { useState } from 'react'
import { format } from 'date-fns'
import RecentTransactions from '../components/RecentTransactions'

interface TransactionsProps {
  transactions: any[]
}

export default function Transactions({ transactions }: TransactionsProps) {
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all')
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all')

  const filteredTransactions = transactions.filter(tx => {
    const isBuy = tx.type === 'snipe_buy' || tx.type === 'sniper_buy' || tx.type === 'copy_buy' || tx.type === 'receive' || tx.type === 'amm_deposit'
    const isSell = tx.type?.includes('sell') || tx.type === 'send' || tx.type === 'amm_withdraw'
    if (filter === 'buy' && !isBuy) return false
    if (filter === 'sell' && !isSell) return false

    // Filter by date
    if (dateRange !== 'all') {
      const txDate = new Date(tx.timestamp)
      const now = new Date()
      const dayInMs = 24 * 60 * 60 * 1000

      if (dateRange === 'today') {
        if (now.getTime() - txDate.getTime() > dayInMs) return false
      } else if (dateRange === 'week') {
        if (now.getTime() - txDate.getTime() > 7 * dayInMs) return false
      } else if (dateRange === 'month') {
        if (now.getTime() - txDate.getTime() > 30 * dayInMs) return false
      }
    }

    return true
  })

  const stats = {
    totalTrades: transactions.filter(tx => tx.type?.includes?.('sell') || tx.type === 'send' || tx.type === 'amm_withdraw').length,
    totalBuys: transactions.filter(tx => tx.type === 'snipe_buy' || tx.type === 'sniper_buy' || tx.type === 'copy_buy' || tx.type === 'receive' || tx.type === 'amm_deposit').length,
    totalSells: transactions.filter(tx => tx.type?.includes?.('sell') || tx.type === 'send' || tx.type === 'amm_withdraw').length,
    totalProfit: transactions
      .filter(tx => tx.profit !== undefined)
      .reduce((sum, tx) => sum + (tx.profit || 0), 0)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Transaction History</h1>
        <div className="page-stats">
          <div className="stat-pill">
            <span className="stat-label">Total Trades</span>
            <span className="stat-value">{stats.totalTrades}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Buys</span>
            <span className="stat-value">{stats.totalBuys}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Sells</span>
            <span className="stat-value">{stats.totalSells}</span>
          </div>
          <div className={`stat-pill ${stats.totalProfit >= 0 ? 'profit' : 'loss'}`}>
            <span className="stat-label">Total Profit</span>
            <span className="stat-value">
              {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)} XRP
            </span>
          </div>
        </div>
      </div>

      <div className="page-controls">
        <div className="filter-group">
          <label>Type:</label>
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'buy' ? 'active' : ''}`}
            onClick={() => setFilter('buy')}
          >
            Buys
          </button>
          <button 
            className={`filter-btn ${filter === 'sell' ? 'active' : ''}`}
            onClick={() => setFilter('sell')}
          >
            Sells
          </button>
        </div>

        <div className="filter-group">
          <label>Date Range:</label>
          <button 
            className={`filter-btn ${dateRange === 'all' ? 'active' : ''}`}
            onClick={() => setDateRange('all')}
          >
            All Time
          </button>
          <button 
            className={`filter-btn ${dateRange === 'today' ? 'active' : ''}`}
            onClick={() => setDateRange('today')}
          >
            Today
          </button>
          <button 
            className={`filter-btn ${dateRange === 'week' ? 'active' : ''}`}
            onClick={() => setDateRange('week')}
          >
            Week
          </button>
          <button 
            className={`filter-btn ${dateRange === 'month' ? 'active' : ''}`}
            onClick={() => setDateRange('month')}
          >
            Month
          </button>
        </div>

        <button className="export-btn">
          📥 Export CSV
        </button>
      </div>

      <RecentTransactions transactions={filteredTransactions} />
    </div>
  )
}
