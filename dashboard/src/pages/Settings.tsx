import { useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'

export default function Settings() {
  const [settings, setSettings] = useState({
    primaryWallet: 'rDQqZ5a3bJfYJxuMfjs34WkVCcSg64Su8Q',
    autoProfitCollection: true,
    profitCollectionThreshold: 10,
    notifications: {
      snipes: true,
      profitTargets: true,
      stopLosses: true,
      errors: true
    },
    trading: {
      defaultMinLiquidity: 10,
      defaultSnipeAmount: 2,
      defaultProfitTarget: 12,
      defaultStopLoss: 8,
      maxPositionsPerBot: 12
    },
    api: {
      xrplServer: 'wss://s2.ripple.com',
      requestTimeout: 20000
    }
  })

  const handleSave = async () => {
    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('Settings saved successfully!')
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      toast.error('Error saving settings')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button className="primary-button" onClick={handleSave}>
          💾 Save Changes
        </button>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h2 className="section-title">💰 Wallet Configuration</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Primary Wallet Address</label>
              <input
                type="text"
                value={settings.primaryWallet}
                onChange={e => setSettings({ ...settings, primaryWallet: e.target.value })}
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
              <small>All profits will be collected to this wallet</small>
            </div>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.autoProfitCollection}
                  onChange={e => setSettings({ ...settings, autoProfitCollection: e.target.checked })}
                />
                <span>Auto-collect profits</span>
              </label>
              <small>Automatically transfer profits to primary wallet</small>
            </div>

            <div className="setting-item">
              <label>Profit Collection Threshold (XRP)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={settings.profitCollectionThreshold}
                onChange={e => setSettings({ ...settings, profitCollectionThreshold: parseFloat(e.target.value) })}
              />
              <small>Collect profits when balance exceeds this amount</small>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">🔔 Notifications</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.snipes}
                  onChange={e => setSettings({ 
                    ...settings, 
                    notifications: { ...settings.notifications, snipes: e.target.checked }
                  })}
                />
                <span>Snipe notifications</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.profitTargets}
                  onChange={e => setSettings({ 
                    ...settings, 
                    notifications: { ...settings.notifications, profitTargets: e.target.checked }
                  })}
                />
                <span>Profit target notifications</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.stopLosses}
                  onChange={e => setSettings({ 
                    ...settings, 
                    notifications: { ...settings.notifications, stopLosses: e.target.checked }
                  })}
                />
                <span>Stop loss notifications</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications.errors}
                  onChange={e => setSettings({ 
                    ...settings, 
                    notifications: { ...settings.notifications, errors: e.target.checked }
                  })}
                />
                <span>Error notifications</span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">📊 Default Trading Parameters</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Minimum Liquidity (XRP)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={settings.trading.defaultMinLiquidity}
                onChange={e => setSettings({ 
                  ...settings, 
                  trading: { ...settings.trading, defaultMinLiquidity: parseFloat(e.target.value) }
                })}
              />
            </div>

            <div className="setting-item">
              <label>Snipe Amount (XRP)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={settings.trading.defaultSnipeAmount}
                onChange={e => setSettings({ 
                  ...settings, 
                  trading: { ...settings.trading, defaultSnipeAmount: parseFloat(e.target.value) }
                })}
              />
            </div>

            <div className="setting-item">
              <label>Profit Target (%)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={settings.trading.defaultProfitTarget}
                onChange={e => setSettings({ 
                  ...settings, 
                  trading: { ...settings.trading, defaultProfitTarget: parseFloat(e.target.value) }
                })}
              />
            </div>

            <div className="setting-item">
              <label>Stop Loss (%)</label>
              <input
                type="number"
                step="1"
                min="1"
                value={settings.trading.defaultStopLoss}
                onChange={e => setSettings({ 
                  ...settings, 
                  trading: { ...settings.trading, defaultStopLoss: parseFloat(e.target.value) }
                })}
              />
            </div>

            <div className="setting-item">
              <label>Max Positions Per Bot</label>
              <input
                type="number"
                step="1"
                min="1"
                value={settings.trading.maxPositionsPerBot}
                onChange={e => setSettings({ 
                  ...settings, 
                  trading: { ...settings.trading, maxPositionsPerBot: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">⚙️ API Configuration</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>XRPL Server</label>
              <input
                type="text"
                value={settings.api.xrplServer}
                onChange={e => setSettings({ 
                  ...settings, 
                  api: { ...settings.api, xrplServer: e.target.value }
                })}
              />
              <small>WebSocket URL for XRPL connection</small>
            </div>

            <div className="setting-item">
              <label>Request Timeout (ms)</label>
              <input
                type="number"
                step="1000"
                min="5000"
                value={settings.api.requestTimeout}
                onChange={e => setSettings({ 
                  ...settings, 
                  api: { ...settings.api, requestTimeout: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
