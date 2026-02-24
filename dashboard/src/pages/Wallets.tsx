import { useState } from 'react'
import toast from 'react-hot-toast'

interface Wallet {
  id: string
  name: string
  address: string
  balance: number
  isPrimary: boolean
  linkedBots: string[]
}

export default function Wallets() {
  const [wallets, setWallets] = useState<Wallet[]>([
    {
      id: 'wallet-1',
      name: 'Main Trading Wallet',
      address: 'rDQqZ5a3bJfYJxuMfjs34WkVCcSg64Su8Q',
      balance: 47.23,
      isPrimary: true,
      linkedBots: ['bot-1']
    }
  ])

  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferForm, setTransferForm] = useState({
    from: '',
    to: '',
    amount: ''
  })

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!transferForm.from || !transferForm.to || !transferForm.amount) {
      toast.error('Please fill all fields')
      return
    }

    try {
      const response = await fetch('http://localhost:3000/api/wallets/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: transferForm.from,
          toAddress: transferForm.to,
          amount: parseFloat(transferForm.amount)
        })
      })

      if (response.ok) {
        toast.success('Transfer successful!')
        setShowTransferModal(false)
        setTransferForm({ from: '', to: '', amount: '' })
        // Refresh wallets
      } else {
        toast.error('Transfer failed')
      }
    } catch (error) {
      toast.error('Transfer error')
    }
  }

  const setPrimaryWallet = async (walletId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/wallets/${walletId}/primary`, {
        method: 'POST'
      })

      if (response.ok) {
        setWallets(wallets.map(w => ({
          ...w,
          isPrimary: w.id === walletId
        })))
        toast.success('Primary wallet updated')
      }
    } catch (error) {
      toast.error('Failed to update primary wallet')
    }
  }

  const collectProfits = async () => {
    const primaryWallet = wallets.find(w => w.isPrimary)
    if (!primaryWallet) {
      toast.error('No primary wallet set')
      return
    }

    try {
      const response = await fetch('http://localhost:3000/api/wallets/collect-profits', {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Profits collected to primary wallet!')
      }
    } catch (error) {
      toast.error('Failed to collect profits')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Wallet Management</h1>
        <div className="page-actions">
          <button className="secondary-button" onClick={() => setShowTransferModal(true)}>
            💸 Transfer XRP
          </button>
          <button className="primary-button" onClick={collectProfits}>
            💰 Collect All Profits
          </button>
        </div>
      </div>

      <div className="wallets-grid">
        {wallets.map(wallet => (
          <div key={wallet.id} className={`wallet-card ${wallet.isPrimary ? 'primary' : ''}`}>
            {wallet.isPrimary && (
              <div className="primary-badge">⭐ Primary Wallet</div>
            )}
            
            <div className="wallet-header">
              <div>
                <h3 className="wallet-name">{wallet.name}</h3>
                <div className="wallet-address-display">{wallet.address}</div>
              </div>
            </div>

            <div className="wallet-balance">
              <div className="balance-label">Balance</div>
              <div className="balance-amount">{wallet.balance.toFixed(2)} XRP</div>
            </div>

            <div className="wallet-info">
              <div className="info-item">
                <span className="info-label">Linked Bots:</span>
                <span className="info-value">{wallet.linkedBots.length}</span>
              </div>
            </div>

            <div className="wallet-actions">
              {!wallet.isPrimary && (
                <button 
                  className="action-btn"
                  onClick={() => setPrimaryWallet(wallet.id)}
                >
                  Set as Primary
                </button>
              )}
              <button className="action-btn">View Details</button>
            </div>
          </div>
        ))}

        <div className="wallet-card add-new">
          <div className="add-new-content">
            <div className="add-icon">+</div>
            <div className="add-text">Add New Wallet</div>
          </div>
        </div>
      </div>

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Transfer XRP</h2>
            <form onSubmit={handleTransfer} className="transfer-form">
              <div className="form-group">
                <label>From Wallet</label>
                <select 
                  value={transferForm.from}
                  onChange={e => setTransferForm({ ...transferForm, from: e.target.value })}
                  required
                >
                  <option value="">Select wallet...</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.address}>
                      {w.name} ({w.balance.toFixed(2)} XRP)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>To Address</label>
                <input
                  type="text"
                  value={transferForm.to}
                  onChange={e => setTransferForm({ ...transferForm, to: e.target.value })}
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  required
                />
              </div>

              <div className="form-group">
                <label>Amount (XRP)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transferForm.amount}
                  onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowTransferModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
