import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import toast, { Toaster } from 'react-hot-toast'
import './App.css'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import Positions from './pages/Positions'
import AMMPools from './pages/AMMPools'
import BotConfigs from './pages/BotConfigs'
import BotDetail from './pages/BotDetail'
import Bots from './pages/Bots'
import Transactions from './pages/Transactions'
import Wallets from './pages/Wallets'
import Settings from './pages/Settings'
import type { Position } from './components/PositionsList'

interface AccountStatusData {
  xrpBalance: number
  lockedReserves: number
  tradableXRP: number
  activePositions: number
  maxPositions: number
  positionsAvailable: number
  healthStatus: string
}

interface PerformanceMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalProfit: number
  averageProfit: number
}

interface Transaction {
  type: string
  timestamp: string
  tokenSymbol?: string
  amount?: number
  profit?: number
  profitPercent?: number
  status?: string
}

interface Activity {
  id: string
  type: 'snipe' | 'profit_take' | 'stop_loss' | 'error' | 'status' | 'arbitrage' | 'lp_enter' | 'lp_exit'
  message: string
  timestamp: Date
  data?: any
}

interface ProfitDataPoint {
  timestamp: string
  profit: number
  portfolioValue: number
}

interface BotStatus {
  sniperActive: boolean
  copyTradingActive: boolean
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE

function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [accountStatus, setAccountStatus] = useState<AccountStatusData | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [profitHistory, setProfitHistory] = useState<ProfitDataPoint[]>([])
  const [botStatus, setBotStatus] = useState<BotStatus>({ sniperActive: false, copyTradingActive: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activityIdCounter = useRef(0)

  const addActivity = (type: Activity['type'], message: string, data?: any) => {
    const newActivity: Activity = {
      id: `activity-${activityIdCounter.current++}`,
      type,
      message,
      timestamp: new Date(),
      data
    }
    setActivities(prev => [newActivity, ...prev].slice(0, 50)) // Keep last 50 activities
  }

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io(SOCKET_URL)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      console.log('Connected to bot')
      setConnected(true)
      setError(null)
      addActivity('status', 'Connected to trading bot')
      toast.success('Connected to trading bot')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from bot')
      setConnected(false)
      addActivity('error', 'Disconnected from trading bot')
      toast.error('Disconnected from trading bot')
    })

    newSocket.on('connect_error', () => {
      setError('Cannot connect to bot. Make sure the bot is running.')
      setConnected(false)
    })

    newSocket.on('positions', (data: Position[]) => {
      setPositions(data)
    })

    newSocket.on('accountStatus', (data: AccountStatusData) => {
      setAccountStatus(data)
    })

    newSocket.on('metrics', (data: PerformanceMetrics) => {
      setMetrics(data)
    })

    newSocket.on('snipe', (data: any) => {
      addActivity('snipe', `Sniped ${data.symbol} for ${data.amount} XRP`, data)
      toast.success(`🎯 Sniped ${data.symbol}!`)
    })

    newSocket.on('profitTake', (data: any) => {
      addActivity('profit_take', `Profit target hit for ${data.symbol}! +${data.profitPercent}%`, data)
      toast.success(`💰 Profit taken on ${data.symbol}: +${data.profitPercent}%`)
    })

    newSocket.on('stopLoss', (data: any) => {
      addActivity('stop_loss', `Stop loss triggered for ${data.symbol}: ${data.profitPercent}%`, data)
      toast.error(`🛑 Stop loss on ${data.symbol}: ${data.profitPercent}%`)
    })

    newSocket.on('error', (data: any) => {
      addActivity('error', data.message || 'An error occurred', data)
    })

    newSocket.on('profitHistory', (data: ProfitDataPoint[]) => {
      setProfitHistory(data)
    })

    newSocket.on('arbitrage', (data: any) => {
      addActivity('arbitrage', `Arbitrage profit: +${data.profit?.toFixed(2)} XRP on ${data.token}`, data)
      toast.success(`💱 Arbitrage: +${data.profit?.toFixed(2)} XRP on ${data.token}`, {
        duration: 4000
      })
    })

    newSocket.on('lpPosition', (data: any) => {
      if (data.action === 'enter') {
        addActivity('lp_enter', `Entered ${data.pool} pool (${data.apr?.toFixed(1)}% APR)`, data)
        toast.success(`🌊 Entered ${data.pool} pool`, {
          duration: 5000
        })
      } else if (data.action === 'exit') {
        addActivity('lp_exit', `Exited ${data.pool}: +${data.profit?.toFixed(2)} XRP (${data.return?.toFixed(1)}%)`, data)
        toast.success(`💸 Exited ${data.pool}: +${data.profit?.toFixed(2)} XRP`, {
          duration: 5000
        })
      }
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const toggleSniper = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/controls/sniper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: botStatus.sniperActive ? 'stop' : 'start' })
      })
      if (response.ok) {
        const data = await response.json()
        setBotStatus(prev => ({ ...prev, sniperActive: data.sniperActive }))
      } else {
        throw new Error('Failed to toggle sniper')
      }
    } catch (error) {
      throw error
    }
  }

  const toggleCopyTrading = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/controls/copytrading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: botStatus.copyTradingActive ? 'stop' : 'start' })
      })
      if (response.ok) {
        const data = await response.json()
        setBotStatus(prev => ({ ...prev, copyTradingActive: data.copyTradingActive }))
      } else {
        throw new Error('Failed to toggle copy trading')
      }
    } catch (error) {
      throw error
    }
  }

  useEffect(() => {
    // Fetch initial data
    const fetchData = async () => {
      try {
        const [positionsRes, statusRes, metricsRes, txRes, historyRes] = await Promise.all([
          fetch(`${API_BASE}/api/positions`),
          fetch(`${API_BASE}/api/status`),
          fetch(`${API_BASE}/api/performance`),
          fetch(`${API_BASE}/api/transactions`),
          fetch(`${API_BASE}/api/history`)
        ])

        const positionsData = await positionsRes.json()
        const statusData = await statusRes.json()
        const metricsData = await metricsRes.json()
        const txData = await txRes.json()
        
        setPositions(positionsData)
        setAccountStatus(statusData.accountStatus)
        setBotStatus({
          sniperActive: statusData.sniperActive,
          copyTradingActive: statusData.copyTradingActive
        })
        setMetrics(metricsData)
        setTransactions(txData)
        
        if (historyRes.ok) {
          const historyData = await historyRes.json()
          setProfitHistory(historyData)
        }
        
        setLoading(false)
        setError(null)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setError('Failed to load dashboard data')
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s (WebSocket provides real-time updates)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="app loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Connecting to trading bot...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155'
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        <Sidebar />
        
        <main className="main-content">
          <header className="top-header">
            <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
              <span className="dot"></span>
              {connected ? 'Live' : 'Disconnected'}
            </div>
          </header>

          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <div className="error-content">
                <div className="error-title">Connection Error</div>
                <div className="error-message">{error}</div>
              </div>
            </div>
          )}

          <Routes>
            <Route 
              path="/" 
              element={
                <Overview 
                  accountStatus={accountStatus}
                  metrics={metrics}
                  profitHistory={profitHistory}
                  activities={activities}
                  transactions={transactions}
                  walletAddress={accountStatus?.walletAddress || ''}
                />
              } 
            />
            <Route 
              path="/positions" 
              element={<Positions positions={positions} />} 
            />
            <Route 
              path="/amm" 
              element={<AMMPools />} 
            />
            <Route 
              path="/configs" 
              element={<BotConfigs socket={socket} />} 
            />
            <Route 
              path="/bot/:botId" 
              element={<BotDetail socket={socket} />} 
            />
            <Route 
              path="/bots" 
              element={<Bots />} 
            />
            <Route 
              path="/transactions" 
              element={<Transactions transactions={transactions} />} 
            />
            <Route 
              path="/wallets" 
              element={<Wallets />} 
            />
            <Route 
              path="/settings" 
              element={<Settings />} 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
