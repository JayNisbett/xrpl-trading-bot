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

interface LogViewerProps {
  botId?: string
  botName?: string
  maxHeight?: string
  socket?: Socket
}

export default function LogViewer({ botId, botName, maxHeight = '600px', socket }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [loading, setLoading] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchLogs()
    
    // Set up polling as backup
    const interval = setInterval(fetchLogs, 5000)
    
    return () => clearInterval(interval)
  }, [botId])

  useEffect(() => {
    if (!socket) return

    // Listen for real-time log events
    const handleLog = (logEntry: LogEntry) => {
      // Only add if it matches our filter (bot-specific or system-wide)
      if (botId && botId !== '' && logEntry.botId !== botId) {
        return
      }
      
      setLogs(prev => [...prev, logEntry].slice(-1000))
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
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const fetchLogs = async () => {
    try {
      const url = botId && botId !== ''
        ? `http://localhost:3000/api/logs/bot/${botId}`
        : 'http://localhost:3000/api/logs'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLoading(false)
    }
  }

  const clearLogs = async () => {
    const message = botId && botId !== ''
      ? `Clear logs for ${botName}? This cannot be undone.`
      : 'Clear all system logs? This cannot be undone.'
      
    if (!confirm(message)) return

    try {
      const url = botId && botId !== ''
        ? `http://localhost:3000/api/logs/bot/${botId}`
        : 'http://localhost:3000/api/logs'
      
      const response = await fetch(url, { method: 'DELETE' })
      if (response.ok) {
        setLogs([])
      }
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const getFilteredLogs = () => {
    let filtered = logs

    if (filterLevel !== 'all') {
      filtered = filtered.filter(log => log.level === filterLevel)
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(log => log.category === filterCategory)
    }

    return filtered
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

  const getUniqueCategories = () => {
    const categories = new Set(logs.map(log => log.category))
    return Array.from(categories).sort()
  }

  const filteredLogs = getFilteredLogs()
  const categories = getUniqueCategories()

  if (loading) {
    return (
      <div className="log-viewer">
        <div className="log-loading">Loading logs...</div>
      </div>
    )
  }

  return (
    <div className="log-viewer">
      <div className="log-controls">
        <div className="log-header">
          <h3 className="log-title">
            📋 {botName || 'System'} Logs
            <span className="log-count">({filteredLogs.length})</span>
          </h3>
          <div className="log-actions">
            <label className="auto-scroll-toggle">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              <span>Auto-scroll</span>
            </label>
            <button className="log-btn refresh" onClick={fetchLogs} title="Refresh logs">
              ↻
            </button>
            <button className="log-btn clear" onClick={clearLogs} title="Clear logs">
              🗑️
            </button>
          </div>
        </div>

        <div className="log-filters">
          <div className="filter-group">
            <label>Level:</label>
            <select 
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="log-select"
            >
              <option value="all">All Levels</option>
              <option value="info">ℹ️ Info</option>
              <option value="success">✅ Success</option>
              <option value="warning">⚠️ Warning</option>
              <option value="error">❌ Error</option>
              <option value="debug">🔍 Debug</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Category:</label>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="log-select"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="log-container" style={{ maxHeight }}>
        {filteredLogs.length === 0 ? (
          <div className="log-empty">
            <div className="empty-icon">📋</div>
            <div className="empty-text">No logs yet</div>
            <div className="empty-subtext">
              {filterLevel !== 'all' || filterCategory !== 'all' 
                ? 'Try adjusting filters' 
                : 'Logs will appear here when the bot performs actions'}
            </div>
          </div>
        ) : (
          <div className="log-entries">
            {filteredLogs.map((log, idx) => (
              <div key={idx} className={`log-entry level-${log.level}`}>
                <div className="log-meta">
                  <span className="log-timestamp">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="log-level">
                    {getLogIcon(log.level)} {log.level}
                  </span>
                  <span className="log-category">[{log.category}]</span>
                  {log.botName && !botName && (
                    <span className="log-bot-name">{log.botName}</span>
                  )}
                </div>
                <div className="log-message">{log.message}</div>
                {log.data && (
                  <details className="log-data">
                    <summary>View data</summary>
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
