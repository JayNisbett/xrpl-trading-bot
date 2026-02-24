import { useState } from 'react'
import toast from 'react-hot-toast'

interface BotControlsProps {
  sniperActive: boolean
  copyTradingActive: boolean
  onToggleSniper: () => Promise<void>
  onToggleCopyTrading: () => Promise<void>
}

export default function BotControls({ 
  sniperActive, 
  copyTradingActive, 
  onToggleSniper, 
  onToggleCopyTrading 
}: BotControlsProps) {
  const [sniperLoading, setSniperLoading] = useState(false)
  const [copyTradingLoading, setCopyTradingLoading] = useState(false)

  const handleSniperToggle = async () => {
    setSniperLoading(true)
    try {
      await onToggleSniper()
      toast.success(sniperActive ? 'Sniper stopped' : 'Sniper started')
    } catch (error) {
      toast.error('Failed to toggle sniper')
    } finally {
      setSniperLoading(false)
    }
  }

  const handleCopyTradingToggle = async () => {
    setCopyTradingLoading(true)
    try {
      await onToggleCopyTrading()
      toast.success(copyTradingActive ? 'Copy trading stopped' : 'Copy trading started')
    } catch (error) {
      toast.error('Failed to toggle copy trading')
    } finally {
      setCopyTradingLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>⚙️ Bot Controls</h2>
      <div className="controls-grid">
        <div className="control-item">
          <div className="control-header">
            <div>
              <div className="control-title">Sniper Bot</div>
              <div className="control-description">Automatically snipe new AMM tokens</div>
            </div>
            <div className={`status-badge ${sniperActive ? 'active' : 'inactive'}`}>
              {sniperActive ? '● Active' : '○ Inactive'}
            </div>
          </div>
          <button 
            className={`control-button ${sniperActive ? 'stop' : 'start'}`}
            onClick={handleSniperToggle}
            disabled={sniperLoading}
          >
            {sniperLoading ? 'Loading...' : sniperActive ? 'Stop Sniper' : 'Start Sniper'}
          </button>
        </div>

        <div className="control-item">
          <div className="control-header">
            <div>
              <div className="control-title">Copy Trading</div>
              <div className="control-description">Follow successful trader transactions</div>
            </div>
            <div className={`status-badge ${copyTradingActive ? 'active' : 'inactive'}`}>
              {copyTradingActive ? '● Active' : '○ Inactive'}
            </div>
          </div>
          <button 
            className={`control-button ${copyTradingActive ? 'stop' : 'start'}`}
            onClick={handleCopyTradingToggle}
            disabled={copyTradingLoading}
          >
            {copyTradingLoading ? 'Loading...' : copyTradingActive ? 'Stop Copy Trading' : 'Start Copy Trading'}
          </button>
        </div>
      </div>
    </div>
  )
}
