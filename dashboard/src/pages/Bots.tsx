import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface BotsProps {}

interface BotInstance {
  id: string
  configId: string
  name: string
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  mode: string
  startedAt?: string
  error?: string
  config?: {
    id: string
    name: string
    description?: string
    mode: string
    enabled: boolean
  }
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Bots(_props: BotsProps) {
  const navigate = useNavigate()
  const [instances, setInstances] = useState<BotInstance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInstances = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/instances`)
      if (response.ok) {
        const data = await response.json()
        setInstances(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      toast.error('Failed to fetch bots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstances()
    const interval = setInterval(fetchInstances, 5000)
    return () => clearInterval(interval)
  }, [])

  const stopInstance = async (instanceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/instances/${instanceId}/stop`, {
        method: 'POST'
      })
      if (response.ok) {
        await fetchInstances()
        toast.success('Bot stopped')
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || 'Failed to stop bot')
      }
    } catch (error) {
      toast.error('Failed to stop bot')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading bots...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Running Bots</h1>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate('/configs')}
        >
          + Create or start a bot
        </button>
      </div>

      <p className="page-description" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Bot instances started from <strong>Configurations</strong>. To add a new bot, go to Configurations to create a configuration and start an instance.
      </p>

      {instances.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No bot instances running.</p>
          <button
            className="primary-button"
            style={{ marginTop: '1rem' }}
            onClick={() => navigate('/configs')}
          >
            Go to Configurations
          </button>
        </div>
      ) : (
        <div className="bots-grid">
          {instances.map((inst) => (
            <div key={inst.id} className="bot-card">
              <div className="bot-header">
                <div>
                  <h3 className="bot-name">{inst.name}</h3>
                  <div className="bot-type">
                    {inst.mode === 'sniper' && '🎯 Sniper'}
                    {inst.mode === 'copyTrading' && '👥 Copy Trader'}
                    {inst.mode === 'amm' && '🌊 AMM'}
                    {inst.mode === 'hybrid' && '🔀 Hybrid'}
                    {!['sniper', 'copyTrading', 'amm', 'hybrid'].includes(inst.mode) && inst.mode}
                  </div>
                </div>
                <div className={`status-badge ${inst.status}`}>
                  {inst.status === 'running' && '● Running'}
                  {inst.status === 'starting' && '◐ Starting'}
                  {inst.status === 'stopping' && '◐ Stopping'}
                  {inst.status === 'stopped' && '○ Stopped'}
                  {inst.status === 'error' && '⚠ Error'}
                </div>
              </div>

              {inst.error && (
                <div className="bot-error" style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {inst.error}
                </div>
              )}

              {inst.startedAt && (
                <div className="bot-meta" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Started {new Date(inst.startedAt).toLocaleString()}
                </div>
              )}

              <div className="bot-actions" style={{ marginTop: '1rem' }}>
                <button
                  className="action-btn"
                  onClick={() => navigate(`/bot/${inst.id}`)}
                >
                  View details
                </button>
                {inst.status === 'running' && (
                  <button
                    className="action-btn stop"
                    onClick={() => stopInstance(inst.id)}
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
