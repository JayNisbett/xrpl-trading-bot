import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Socket } from 'socket.io-client'
import { API_BASE } from '../lib/api'

interface BotConfiguration {
  id: string
  name: string
  description?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
  mode: 'sniper' | 'copyTrading' | 'amm' | 'hybrid'
  sniper: {
    enabled: boolean
    checkInterval: number
    maxTokensPerScan: number
    buyMode: boolean
    snipeAmount: string
    customSnipeAmount: string
    minimumPoolLiquidity: number
    riskScore: 'low' | 'medium' | 'high'
    transactionDivides: number
  }
  copyTrading: {
    enabled: boolean
    checkInterval: number
    maxTransactionsToCheck: number
    traderAddresses: string[]
    tradingAmountMode: 'fixed' | 'percentage'
    matchTraderPercentage: number
    maxSpendPerTrade: number
    fixedAmount: number
  }
  trading: {
    minLiquidity: number
    minHolders: number
    minTradingActivity: number
    maxSnipeAmount: number
    emergencyStopLoss: number
    defaultSlippage: number
  }
  amm: {
    enabled: boolean
    arbitrage: {
      enabled: boolean
      minProfitPercent: number
      maxTradeAmount: number
      checkInterval: number
    }
    liquidity: {
      enabled: boolean
      strategy: 'one-sided' | 'balanced' | 'auto'
      minTVL: number
      maxPriceImpact: number
      targetAPR: number
      maxPositions: number
    }
    risk: {
      maxImpermanentLoss: number
      maxPositionSize: number
      diversification: boolean
    }
  }
}

interface BotInstance {
  id: string
  configId: string
  name: string
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  mode: string
  startedAt?: Date
  error?: string
  config?: {
    id: string
    name: string
    description?: string
    mode: string
    enabled: boolean
  }
}

interface LLMAgentLite {
  id: string
  name: string
  userId: string
}

interface BotConfigsProps {
  socket: Socket | null
}

export default function BotConfigs({ socket }: BotConfigsProps) {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<BotConfiguration[]>([])
  const [instances, setInstances] = useState<BotInstance[]>([])
  const [llmAgents, setLlmAgents] = useState<LLMAgentLite[]>([])
  const [loading, setLoading] = useState(true)
  const [editingConfig, setEditingConfig] = useState<BotConfiguration | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'configs' | 'instances'>('configs')
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [configsRes, instancesRes, agentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/configs`),
        fetch(`${API_BASE}/api/instances`),
        fetch(`${API_BASE}/api/llm-agents`)
      ])

      if (configsRes.ok) {
        const configsData = await configsRes.json()
        console.log('📥 Frontend: Fetched configs:', configsData.length)
        setConfigs(configsData)
      }
      
      if (instancesRes.ok) {
        const instancesData = await instancesRes.json()
        console.log('📥 Frontend: Fetched instances:', instancesData.length, instancesData)
        setInstances(instancesData)
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        setLlmAgents((agentsData?.agents || []).map((a: any) => ({ id: a.id, name: a.name, userId: a.userId })))
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setLoading(false)
    }
  }

  const importFromEnv = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/configs/from-env`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Configuration imported from .env!')
        fetchData()
      } else {
        toast.error('Failed to import from .env')
      }
    } catch (error) {
      toast.error('Error importing configuration')
    }
  }

  const createNewConfig = () => {
    const newConfig: Partial<BotConfiguration> = {
      name: 'New Bot Configuration',
      description: '',
      enabled: false,
      mode: 'hybrid',
      sniper: {
        enabled: false,
        checkInterval: 8000,
        maxTokensPerScan: 15,
        buyMode: false,
        snipeAmount: '1',
        customSnipeAmount: '',
        minimumPoolLiquidity: 100,
        riskScore: 'medium',
        transactionDivides: 1
      },
      copyTrading: {
        enabled: false,
        checkInterval: 3000,
        maxTransactionsToCheck: 20,
        traderAddresses: [],
        tradingAmountMode: 'percentage',
        matchTraderPercentage: 50,
        maxSpendPerTrade: 100,
        fixedAmount: 10
      },
      trading: {
        minLiquidity: 100,
        minHolders: 5,
        minTradingActivity: 3,
        maxSnipeAmount: 5000,
        emergencyStopLoss: 0.3,
        defaultSlippage: 4.0
      },
      amm: {
        enabled: false,
        arbitrage: {
          enabled: false,
          minProfitPercent: 0.5,
          maxTradeAmount: 5,
          checkInterval: 5000
        },
        liquidity: {
          enabled: false,
          strategy: 'one-sided',
          minTVL: 100,
          maxPriceImpact: 0.05,
          targetAPR: 20,
          maxPositions: 5
        },
        risk: {
          maxImpermanentLoss: 10,
          maxPositionSize: 3,
          diversification: true
        }
      }
    }
    
    setEditingConfig(newConfig as BotConfiguration)
    setIsCreating(true)
  }

  const saveConfig = async (config: BotConfiguration) => {
    try {
      const method = isCreating ? 'POST' : 'PUT'
      const url = isCreating 
        ? `${API_BASE}/api/configs`
        : `${API_BASE}/api/configs/${config.id}`

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        toast.success(isCreating ? 'Configuration created!' : 'Configuration updated!')
        setEditingConfig(null)
        setIsCreating(false)
        fetchData()
      } else {
        toast.error('Failed to save configuration')
      }
    } catch (error) {
      toast.error('Error saving configuration')
    }
  }

  const deleteConfig = async (configId: string) => {
    if (!confirm('Delete this configuration? This cannot be undone.')) return

    try {
      const response = await fetch(`${API_BASE}/api/configs/${configId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Configuration deleted')
        fetchData()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete configuration')
      }
    } catch (error) {
      toast.error('Error deleting configuration')
    }
  }

  const startBot = async (configId: string) => {
    const config = configs.find(c => c.id === configId)
    const toastId = toast.loading(`Starting ${config?.name || 'bot'}...`)
    
    try {
      const response = await fetch(`${API_BASE}/api/instances/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`${config?.name || 'Bot'} started successfully!`, { id: toastId })
        
        // Wait a moment then fetch to ensure instance is registered
        setTimeout(() => {
          fetchData()
        }, 500)
      } else {
        toast.error(data.error || 'Failed to start bot', { id: toastId })
        console.error('Start bot error:', data)
      }
    } catch (error: any) {
      toast.error(`Error starting bot: ${error.message}`, { id: toastId })
      console.error('Start bot exception:', error)
    }
  }

  const stopBot = async (instanceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/instances/${instanceId}/stop`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Bot stopped')
        fetchData()
      } else {
        toast.error('Failed to stop bot')
      }
    } catch (error) {
      toast.error('Error stopping bot')
    }
  }

  const restartBot = async (instanceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/instances/${instanceId}/restart`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Bot restarted!')
        fetchData()
      } else {
        toast.error('Failed to restart bot')
      }
    } catch (error) {
      toast.error('Error restarting bot')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading configurations...</div>
        </div>
      </div>
    )
  }

  const runningCount = instances.filter(i => i.status === 'running').length
  const agentByUserId = new Map(llmAgents.map(a => [a.userId, a]))

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">⚙️ Bot Configurations</h1>
          <p className="page-subtitle">Manage multiple bot instances with different strategies</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="debug-toggle-btn" 
            onClick={() => setShowDebug(!showDebug)}
            title="Toggle debug info"
          >
            {showDebug ? '🐛 Hide Debug' : '🔍 Show Debug'}
          </button>
          <button className="create-btn" onClick={createNewConfig}>
            + New Configuration
          </button>
        </div>
      </div>

      <div className="info-banner-small" style={{ marginBottom: '1rem' }}>
        <span className="info-icon">🧭</span>
        <span className="info-text">
          Control model: <strong>LLM Agent</strong> (capital + risk policy) → <strong>Strategy Config</strong> (execution settings) → <strong>Running Instance</strong> (live process placing trades).
        </span>
      </div>

      {showDebug && (
        <div className="debug-panel">
          <h3>🐛 Debug Information</h3>
          <div className="debug-grid">
            <div className="debug-item">
              <span className="debug-label">Configurations Loaded:</span>
              <span className="debug-value">{configs.length}</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Instances Fetched:</span>
              <span className="debug-value">{instances.length}</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Running Count:</span>
              <span className="debug-value profit">{instances.filter(i => i.status === 'running').length}</span>
            </div>
          </div>
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem' }}>
              View Raw Instance Data
            </summary>
            <pre style={{ 
              background: 'var(--bg-secondary)', 
              padding: '1rem', 
              borderRadius: '0.5rem',
              overflow: 'auto',
              fontSize: '0.75rem'
            }}>
              {JSON.stringify(instances, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'configs' ? 'active' : ''}`}
          onClick={() => setActiveTab('configs')}
        >
          📋 Configurations ({configs.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'instances' ? 'active' : ''}`}
          onClick={() => setActiveTab('instances')}
        >
          🤖 Running Instances ({runningCount})
        </button>
      </div>

      {activeTab === 'configs' && (
        <div className="configs-section">
          <div className="info-banner-small">
            <span className="info-icon">ℹ️</span>
            <span className="info-text">
              Your main bot (started with <code>npm start</code>) runs from <code>.env</code> settings. 
              Create additional configurations here to run multiple bots with different strategies.
            </span>
          </div>

          {configs.length === 0 && (
            <div className="info-banner">
              <div className="banner-content">
                <div className="banner-icon">💡</div>
                <div className="banner-text">
                  <div className="banner-title">Get Started Quickly</div>
                  <div className="banner-description">
                    Import your current .env settings as a configuration, or create a new one from scratch
                  </div>
                </div>
              </div>
              <div className="banner-actions">
                <button className="banner-btn secondary" onClick={importFromEnv}>
                  📥 Import from .env
                </button>
                <button className="banner-btn primary" onClick={createNewConfig}>
                  ➕ Create New
                </button>
              </div>
            </div>
          )}

          {configs.length === 0 ? (
            <div className="empty-state-fancy">
              <div className="empty-icon">⚙️</div>
              <div className="empty-title">No configurations yet</div>
              <div className="empty-message">
                Create your first bot configuration to get started
              </div>
              <button className="empty-action-btn" onClick={createNewConfig}>
                Create Configuration
              </button>
            </div>
          ) : (
            <div className="configs-grid">
              {configs.map(config => {
                const activeInstances = instances.filter(
                  inst => inst.configId === config.id && inst.status === 'running'
                )
                
                return (
                  <div key={config.id} className={`config-card ${config.enabled ? 'enabled' : ''}`}>
                    <div className="config-header">
                      <div className="config-title-group">
                        <h3>{config.name}</h3>
                        {config.description && (
                          <p className="config-description">{config.description}</p>
                        )}
                      </div>
                      <span className={`mode-badge ${config.mode}`}>
                        {config.mode === 'sniper' && '🎯'}
                        {config.mode === 'copyTrading' && '👥'}
                        {config.mode === 'amm' && '🌊'}
                        {config.mode === 'hybrid' && '🔀'}
                        {' '}{config.mode}
                      </span>
                    </div>

                    <div className="config-features">
                      {config.sniper.enabled && (
                        <div className="feature-tag sniper">
                          🎯 Sniper: {config.sniper.riskScore} risk
                        </div>
                      )}
                      {config.copyTrading.enabled && (
                        <div className="feature-tag copy">
                          👥 Copy: {config.copyTrading.traderAddresses.length} traders
                        </div>
                      )}
                      {config.amm.arbitrage.enabled && (
                        <div className="feature-tag arb">
                          💱 Arbitrage: {config.amm.arbitrage.minProfitPercent}% min
                        </div>
                      )}
                      {config.amm.liquidity.enabled && (
                        <div className="feature-tag lp">
                          💧 LP: {config.amm.liquidity.strategy}
                        </div>
                      )}
                    </div>

                    {activeInstances.length > 0 && (
                      <div className="running-banner">
                        ✓ {activeInstances.length} instance{activeInstances.length > 1 ? 's' : ''} running
                      </div>
                    )}

                    <div className="config-actions">
                      <button 
                        className="action-btn edit"
                        onClick={() => {
                          setEditingConfig(config)
                          setIsCreating(false)
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="action-btn start"
                        onClick={() => startBot(config.id)}
                        disabled={activeInstances.length > 0}
                      >
                        ▶️ Start
                      </button>
                      <button 
                        className="action-btn delete"
                        onClick={() => deleteConfig(config.id)}
                        disabled={activeInstances.length > 0}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'instances' && (
        <div className="instances-section">
          <div className="instances-debug-banner">
            <span className="debug-text">
              Active Instances: <strong>{instances.length}</strong> 
              {instances.length > 0 && (
                <> • Running: <strong className="profit">{instances.filter(i => i.status === 'running').length}</strong></>
              )}
            </span>
            <button 
              className="refresh-btn-small" 
              onClick={() => fetchData()}
              title="Refresh instances"
            >
              ↻
            </button>
          </div>

          {instances.length === 0 ? (
            <div className="empty-state-fancy">
              <div className="empty-icon">🤖</div>
              <div className="empty-title">No running instances</div>
              <div className="empty-message">
                Start a bot configuration to see it here. 
                {configs.length > 0 && (
                  <> You have {configs.length} configuration{configs.length > 1 ? 's' : ''} ready to start.</>
                )}
              </div>
              <button className="empty-action-btn" onClick={() => setActiveTab('configs')}>
                View Configurations
              </button>
            </div>
          ) : (
            <div className="instances-grid">
              {instances.map(instance => {
                const linkedConfig = configs.find(c => c.id === instance.configId)
                const displayConfig = instance.config || linkedConfig
                
                return (
                  <div key={instance.id} className={`instance-card status-${instance.status}`}>
                    <div className="instance-header">
                      <div className="instance-title-group">
                        <h3>{instance.name}</h3>
                        <span className="instance-id">{instance.id}</span>
                      </div>
                      <span className={`status-badge ${instance.status}`}>
                        {instance.status === 'running' && '✓'}
                        {instance.status === 'stopped' && '⏸'}
                        {instance.status === 'error' && '⚠️'}
                        {instance.status === 'starting' && '⟳'}
                        {instance.status === 'stopping' && '⏹'}
                        {' '}{instance.status}
                      </span>
                    </div>

                    <div className="instance-info">
                      <div className="info-row">
                        <span className="info-label">Mode:</span>
                        <span className="info-value">{instance.mode}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Owner:</span>
                        <span className="info-value">
                          {agentByUserId.get(instance.userId)?.name || instance.userId}
                        </span>
                      </div>
                      {instance.startedAt && (
                        <div className="info-row">
                          <span className="info-label">Started:</span>
                          <span className="info-value">
                            {new Date(instance.startedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {instance.error && (
                        <div className="error-message">
                          ⚠️ {instance.error}
                        </div>
                      )}
                    </div>

                    {displayConfig && (
                      <div className="instance-features">
                        {linkedConfig?.sniper?.enabled && <span className="feature-badge">🎯</span>}
                        {linkedConfig?.copyTrading?.enabled && <span className="feature-badge">👥</span>}
                        {linkedConfig?.amm?.enabled && <span className="feature-badge">🌊</span>}
                      </div>
                    )}

                    <div className="instance-actions">
                      <button 
                        className="action-btn view-details"
                        onClick={() => navigate(`/bot/${instance.id}`)}
                      >
                        📊 View Details
                      </button>
                      
                      {instance.status === 'running' && (
                        <>
                          <button 
                            className="action-btn stop"
                            onClick={() => stopBot(instance.id)}
                          >
                            ⏹ Stop
                          </button>
                          <button 
                            className="action-btn restart"
                            onClick={() => restartBot(instance.id)}
                          >
                            ↻ Restart
                          </button>
                        </>
                      )}
                      {(instance.status === 'stopped' || instance.status === 'error') && linkedConfig && (
                        <button 
                          className="action-btn start"
                          onClick={() => startBot(linkedConfig.id)}
                        >
                          ▶️ Start Again
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {editingConfig && (
        <ConfigEditor
          config={editingConfig}
          isCreating={isCreating}
          onSave={saveConfig}
          onCancel={() => {
            setEditingConfig(null)
            setIsCreating(false)
          }}
          onChange={setEditingConfig}
        />
      )}

    </div>
  )
}

interface ConfigEditorProps {
  config: BotConfiguration
  isCreating: boolean
  onSave: (config: BotConfiguration) => void
  onCancel: () => void
  onChange: (config: BotConfiguration) => void
}

function ConfigEditor({ config, isCreating, onSave, onCancel, onChange }: ConfigEditorProps) {
  const [activeSection, setActiveSection] = useState<'general' | 'sniper' | 'copy' | 'amm'>('general')

  const updateField = (path: string, value: any) => {
    const keys = path.split('.')
    const newConfig = JSON.parse(JSON.stringify(config))
    
    let obj = newConfig
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]]
    }
    obj[keys[keys.length - 1]] = value
    
    onChange(newConfig)
  }

  const updateTraderAddresses = (value: string) => {
    const addresses = value.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0)
    updateField('copyTrading.traderAddresses', addresses)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content config-editor" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isCreating ? '➕ New Configuration' : '✏️ Edit Configuration'}</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="editor-tabs">
          <button 
            className={`editor-tab ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSection('general')}
          >
            📝 General
          </button>
          <button 
            className={`editor-tab ${activeSection === 'sniper' ? 'active' : ''}`}
            onClick={() => setActiveSection('sniper')}
          >
            🎯 Sniper
          </button>
          <button 
            className={`editor-tab ${activeSection === 'copy' ? 'active' : ''}`}
            onClick={() => setActiveSection('copy')}
          >
            👥 Copy Trading
          </button>
          <button 
            className={`editor-tab ${activeSection === 'amm' ? 'active' : ''}`}
            onClick={() => setActiveSection('amm')}
          >
            🌊 AMM
          </button>
        </div>

        <div className="editor-content">
          {activeSection === 'general' && (
            <div className="editor-section">
              <div className="form-field">
                <label>Configuration Name *</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g., High Risk Sniper, Conservative AMM, etc."
                  className="text-input"
                  required
                />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  value={config.description || ''}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Describe this bot's strategy and purpose..."
                  className="textarea-input"
                  rows={3}
                />
              </div>

              <div className="form-field">
                <label>Bot Mode *</label>
                <select
                  value={config.mode}
                  onChange={e => updateField('mode', e.target.value)}
                  className="select-input"
                >
                  <option value="sniper">🎯 Sniper Only</option>
                  <option value="copyTrading">👥 Copy Trading Only</option>
                  <option value="amm">🌊 AMM Only</option>
                  <option value="hybrid">🔀 Hybrid (All Strategies)</option>
                </select>
                <small className="field-hint">
                  Choose which trading strategies this bot will use
                </small>
              </div>

              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={e => updateField('enabled', e.target.checked)}
                  />
                  <span>Enable this configuration</span>
                </label>
              </div>

              <div className="section-divider">Trading Settings</div>

              <div className="form-row">
                <div className="form-field">
                  <label>Default Slippage (%)</label>
                  <input
                    type="number"
                    value={config.trading.defaultSlippage}
                    onChange={e => updateField('trading.defaultSlippage', parseFloat(e.target.value))}
                    step="0.1"
                    min="0.1"
                    className="number-input"
                  />
                </div>
                <div className="form-field">
                  <label>Emergency Stop Loss</label>
                  <input
                    type="number"
                    value={config.trading.emergencyStopLoss}
                    onChange={e => updateField('trading.emergencyStopLoss', parseFloat(e.target.value))}
                    step="0.01"
                    min="0"
                    max="1"
                    className="number-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Min Liquidity</label>
                  <input
                    type="number"
                    value={config.trading.minLiquidity}
                    onChange={e => updateField('trading.minLiquidity', parseFloat(e.target.value))}
                    className="number-input"
                  />
                </div>
                <div className="form-field">
                  <label>Min Holders</label>
                  <input
                    type="number"
                    value={config.trading.minHolders}
                    onChange={e => updateField('trading.minHolders', parseInt(e.target.value))}
                    className="number-input"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'sniper' && (
            <div className="editor-section">
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.sniper.enabled}
                    onChange={e => updateField('sniper.enabled', e.target.checked)}
                  />
                  <span>Enable Sniper Bot</span>
                </label>
              </div>

              {config.sniper.enabled && (
                <>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Check Interval (ms)</label>
                      <input
                        type="number"
                        value={config.sniper.checkInterval}
                        onChange={e => updateField('sniper.checkInterval', parseInt(e.target.value))}
                        className="number-input"
                      />
                      <small className="field-hint">How often to scan for new tokens</small>
                    </div>
                    <div className="form-field">
                      <label>Max Tokens Per Scan</label>
                      <input
                        type="number"
                        value={config.sniper.maxTokensPerScan}
                        onChange={e => updateField('sniper.maxTokensPerScan', parseInt(e.target.value))}
                        className="number-input"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.sniper.buyMode}
                        onChange={e => updateField('sniper.buyMode', e.target.checked)}
                      />
                      <span>Auto-buy Mode</span>
                    </label>
                    <small className="field-hint">Automatically purchase qualifying tokens</small>
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label>Snipe Amount (XRP)</label>
                      <input
                        type="text"
                        value={config.sniper.snipeAmount}
                        onChange={e => updateField('sniper.snipeAmount', e.target.value)}
                        className="text-input"
                      />
                    </div>
                    <div className="form-field">
                      <label>Min Pool Liquidity</label>
                      <input
                        type="number"
                        value={config.sniper.minimumPoolLiquidity}
                        onChange={e => updateField('sniper.minimumPoolLiquidity', parseFloat(e.target.value))}
                        className="number-input"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Risk Score</label>
                    <select
                      value={config.sniper.riskScore}
                      onChange={e => updateField('sniper.riskScore', e.target.value)}
                      className="select-input"
                    >
                      <option value="low">🟢 Low Risk</option>
                      <option value="medium">🟡 Medium Risk</option>
                      <option value="high">🔴 High Risk</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'copy' && (
            <div className="editor-section">
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.copyTrading.enabled}
                    onChange={e => updateField('copyTrading.enabled', e.target.checked)}
                  />
                  <span>Enable Copy Trading</span>
                </label>
              </div>

              {config.copyTrading.enabled && (
                <>
                  <div className="form-field">
                    <label>Trader Addresses</label>
                    <textarea
                      value={config.copyTrading.traderAddresses.join(', ')}
                      onChange={e => updateTraderAddresses(e.target.value)}
                      placeholder="Enter XRPL addresses separated by commas"
                      className="textarea-input"
                      rows={3}
                    />
                    <small className="field-hint">
                      Currently tracking: {config.copyTrading.traderAddresses.length} trader(s)
                    </small>
                  </div>

                  <div className="form-row">
                    <div className="form-field">
                      <label>Check Interval (ms)</label>
                      <input
                        type="number"
                        value={config.copyTrading.checkInterval}
                        onChange={e => updateField('copyTrading.checkInterval', parseInt(e.target.value))}
                        className="number-input"
                      />
                    </div>
                    <div className="form-field">
                      <label>Max Transactions</label>
                      <input
                        type="number"
                        value={config.copyTrading.maxTransactionsToCheck}
                        onChange={e => updateField('copyTrading.maxTransactionsToCheck', parseInt(e.target.value))}
                        className="number-input"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Amount Mode</label>
                    <select
                      value={config.copyTrading.tradingAmountMode}
                      onChange={e => updateField('copyTrading.tradingAmountMode', e.target.value)}
                      className="select-input"
                    >
                      <option value="percentage">Percentage Match</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  {config.copyTrading.tradingAmountMode === 'percentage' ? (
                    <div className="form-field">
                      <label>Match Percentage (%)</label>
                      <input
                        type="number"
                        value={config.copyTrading.matchTraderPercentage}
                        onChange={e => updateField('copyTrading.matchTraderPercentage', parseFloat(e.target.value))}
                        min="1"
                        max="100"
                        className="number-input"
                      />
                      <small className="field-hint">
                        Trade {config.copyTrading.matchTraderPercentage}% of what the trader trades
                      </small>
                    </div>
                  ) : (
                    <div className="form-field">
                      <label>Fixed Amount (XRP)</label>
                      <input
                        type="number"
                        value={config.copyTrading.fixedAmount}
                        onChange={e => updateField('copyTrading.fixedAmount', parseFloat(e.target.value))}
                        step="0.1"
                        className="number-input"
                      />
                    </div>
                  )}

                  <div className="form-field">
                    <label>Max Spend Per Trade (XRP)</label>
                    <input
                      type="number"
                      value={config.copyTrading.maxSpendPerTrade}
                      onChange={e => updateField('copyTrading.maxSpendPerTrade', parseFloat(e.target.value))}
                      step="0.1"
                      className="number-input"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'amm' && (
            <div className="editor-section">
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.amm.enabled}
                    onChange={e => updateField('amm.enabled', e.target.checked)}
                  />
                  <span>Enable AMM Bot</span>
                </label>
              </div>

              {config.amm.enabled && (
                <>
                  <div className="section-divider">Arbitrage Settings</div>
                  
                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.amm.arbitrage.enabled}
                        onChange={e => updateField('amm.arbitrage.enabled', e.target.checked)}
                      />
                      <span>Enable Arbitrage</span>
                    </label>
                  </div>

                  {config.amm.arbitrage.enabled && (
                    <div className="form-row">
                      <div className="form-field">
                        <label>Min Profit (%)</label>
                        <input
                          type="number"
                          value={config.amm.arbitrage.minProfitPercent}
                          onChange={e => updateField('amm.arbitrage.minProfitPercent', parseFloat(e.target.value))}
                          step="0.1"
                          className="number-input"
                        />
                      </div>
                      <div className="form-field">
                        <label>Max Trade (XRP)</label>
                        <input
                          type="number"
                          value={config.amm.arbitrage.maxTradeAmount}
                          onChange={e => updateField('amm.arbitrage.maxTradeAmount', parseFloat(e.target.value))}
                          step="0.1"
                          className="number-input"
                        />
                      </div>
                      <div className="form-field">
                        <label>Check Interval (ms)</label>
                        <input
                          type="number"
                          value={config.amm.arbitrage.checkInterval}
                          onChange={e => updateField('amm.arbitrage.checkInterval', parseInt(e.target.value))}
                          className="number-input"
                        />
                      </div>
                    </div>
                  )}

                  <div className="section-divider">Liquidity Provision</div>

                  <div className="form-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.amm.liquidity.enabled}
                        onChange={e => updateField('amm.liquidity.enabled', e.target.checked)}
                      />
                      <span>Enable Liquidity Provision</span>
                    </label>
                  </div>

                  {config.amm.liquidity.enabled && (
                    <>
                      <div className="form-field">
                        <label>LP Strategy</label>
                        <select
                          value={config.amm.liquidity.strategy}
                          onChange={e => updateField('amm.liquidity.strategy', e.target.value)}
                          className="select-input"
                        >
                          <option value="one-sided">One-Sided (XRP only)</option>
                          <option value="balanced">Balanced (XRP + Token)</option>
                          <option value="auto">Auto (Bot decides)</option>
                        </select>
                      </div>

                      <div className="form-row">
                        <div className="form-field">
                          <label>Min TVL</label>
                          <input
                            type="number"
                            value={config.amm.liquidity.minTVL}
                            onChange={e => updateField('amm.liquidity.minTVL', parseFloat(e.target.value))}
                            className="number-input"
                          />
                        </div>
                        <div className="form-field">
                          <label>Target APR (%)</label>
                          <input
                            type="number"
                            value={config.amm.liquidity.targetAPR}
                            onChange={e => updateField('amm.liquidity.targetAPR', parseFloat(e.target.value))}
                            className="number-input"
                          />
                        </div>
                        <div className="form-field">
                          <label>Max Positions</label>
                          <input
                            type="number"
                            value={config.amm.liquidity.maxPositions}
                            onChange={e => updateField('amm.liquidity.maxPositions', parseInt(e.target.value))}
                            className="number-input"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-field">
                          <label>Max Price Impact</label>
                          <input
                            type="number"
                            value={config.amm.liquidity.maxPriceImpact}
                            onChange={e => updateField('amm.liquidity.maxPriceImpact', parseFloat(e.target.value))}
                            step="0.01"
                            className="number-input"
                          />
                        </div>
                        <div className="form-field">
                          <label>Max IL (%)</label>
                          <input
                            type="number"
                            value={config.amm.risk.maxImpermanentLoss}
                            onChange={e => updateField('amm.risk.maxImpermanentLoss', parseFloat(e.target.value))}
                            className="number-input"
                          />
                        </div>
                        <div className="form-field">
                          <label>Max Position Size</label>
                          <input
                            type="number"
                            value={config.amm.risk.maxPositionSize}
                            onChange={e => updateField('amm.risk.maxPositionSize', parseFloat(e.target.value))}
                            step="0.1"
                            className="number-input"
                          />
                        </div>
                      </div>

                      <div className="form-field">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.amm.risk.diversification}
                            onChange={e => updateField('amm.risk.diversification', e.target.checked)}
                          />
                          <span>Enable Diversification</span>
                        </label>
                        <small className="field-hint">
                          Spread positions across multiple pools
                        </small>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="editor-footer">
          <button className="cancel-btn large" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="submit-btn primary large"
            onClick={() => onSave(config)}
          >
            {isCreating ? '✓ Create Configuration' : '✓ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
