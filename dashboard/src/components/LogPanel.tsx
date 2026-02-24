import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'

interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error' | 'debug'
  botId?: string
  botName?: string
  category: string
  message: string
  data?: any
}

interface LogPanelProps {
  botId?: string
  botName?: string
  socket?: Socket
}

export default function LogPanel({ botId, botName, socket }: LogPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [isMinimized, setIsMinimized] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [botId])

  useEffect(() => {
    if (!socket) return

    const handleLog = (logEntry: LogEntry) => {
      if (botId && botId !== '' && logEntry.botId !== botId) return
      setLogs(prev => [...prev, logEntry].slice(-500))
    }

    const handleInitialLogs = (initialLogs: LogEntry[]) => {
      if (botId && botId !== '') {
        setLogs(initialLogs.filter(log => log.botId === botId))
      } else {
        setLogs(initialLogs)
      }
    }

    socket.on('log', handleLog)
    socket.on('initialLogs', handleInitialLogs)

    return () => {
      socket.off('log', handleLog)
      socket.off('initialLogs', handleInitialLogs)
    }
  }, [socket, botId])

  useEffect(() => {
    if (autoScroll && logsEndRef.current && !isMinimized) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll, isMinimized])

  const fetchLogs = async () => {
    try {
      const url = botId && botId !== ''
        ? `http://localhost:3000/api/logs/bot/${botId}?limit=500`
        : 'http://localhost:3000/api/logs?limit=500'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  const getFilteredLogs = () => {
    if (filterLevel === 'all') return logs
    return logs.filter(log => log.level === filterLevel)
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info': return 'ℹ️'
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'debug': return '🔍'
      default: return '📝'
    }
  }

  const filteredLogs = getFilteredLogs()
  const unreadCount = logs.slice(-10).length

  if (isMinimized) {
    return (
      <div className="log-panel minimized" onClick={() => setIsMinimized(false)}>
        <div className="log-panel-minimized-header">
          <span className="log-icon">📋</span>
          <span className="log-title">{botName || 'System'} Logs</span>
          {unreadCount > 0 && <span className="log-badge">{unreadCount}</span>}
          <button className="log-expand-btn">▲</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`log-panel ${isExpanded ? 'expanded' : ''}`}>
      <div className="log-panel-header">
        <div className="log-panel-title">
          <span className="log-icon">📋</span>
          <span className="log-title">{botName || 'System'} Activity Log</span>
          <span className="log-count">({filteredLogs.length})</span>
        </div>
        
        <div className="log-panel-controls">
          <select 
            value={filterLevel} 
            onChange={(e) => setFilterLevel(e.target.value)}
            className="log-filter-select"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>

          <label className="log-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>Auto</span>
          </label>

          <button 
            className="log-control-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '⇲' : '⇱'}
          </button>

          <button 
            className="log-control-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="log-panel-messages">
        {filteredLogs.length === 0 ? (
          <div className="log-panel-empty">
            <div className="empty-icon">💬</div>
            <div className="empty-text">No activity yet</div>
            <div className="empty-subtext">Logs will appear here as the bot operates</div>
          </div>
        ) : (
          <>
            {filteredLogs.map((log, idx) => (
              <div key={idx} className={`log-message level-${log.level}`}>
                <div className="log-message-header">
                  <span className="log-message-icon">{getLogIcon(log.level)}</span>
                  <span className="log-message-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="log-message-category">{log.category}</span>
                </div>
                <div className="log-message-content">{log.message}</div>
                {log.data && (
                  <details className="log-message-data">
                    <summary>View Details</summary>
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>
    </div>
  )
}
