import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'

interface WalletItem {
  userId: string
  walletAddress: string
  label: string
  balance: number
  agentId?: string
  agentName?: string
}

export default function Wallets() {
  const [wallets, setWallets] = useState<WalletItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showFundModal, setShowFundModal] = useState(false)
  const [fundTarget, setFundTarget] = useState<WalletItem | null>(null)
  const [transferForm, setTransferForm] = useState({
    from: '',
    to: '',
    amount: ''
  })
  const [fundForm, setFundForm] = useState({
    fromWalletAddress: '',
    amount: ''
  })
  const [funding, setFunding] = useState(false)

  const fetchWallets = async () => {
    try {
      const response = await apiFetch('/api/wallets')
      if (response.ok) {
        const data = await response.json()
        setWallets(data.wallets || [])
      }
    } catch {
      toast.error('Failed to load wallets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallets()
    const interval = setInterval(fetchWallets, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferForm.from || !transferForm.to || !transferForm.amount) {
      toast.error('Please fill all fields')
      return
    }
    try {
      const response = await apiFetch('/api/wallets/transfer', {
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
        fetchWallets()
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || 'Transfer failed')
      }
    } catch {
      toast.error('Transfer error')
    }
  }

  const openFundModal = (wallet: WalletItem) => {
    setFundTarget(wallet)
    setFundForm({ fromWalletAddress: wallets[0]?.walletAddress || '', amount: '10' })
    setShowFundModal(true)
  }

  const handleFundWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundTarget || !fundForm.fromWalletAddress || !fundForm.amount) {
      toast.error('Select source wallet and enter amount')
      return
    }
    const amount = parseFloat(fundForm.amount)
    if (amount <= 0) {
      toast.error('Amount must be positive')
      return
    }
    setFunding(true)
    try {
      const response = await apiFetch('/api/wallets/fund-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWalletAddress: fundForm.fromWalletAddress,
          toAddress: fundTarget.walletAddress,
          amount
        })
      })
      if (response.ok) {
        toast.success(`Sent ${amount} XRP to ${fundTarget.label || fundTarget.walletAddress}`)
        setShowFundModal(false)
        setFundTarget(null)
        fetchWallets()
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || 'Failed to fund wallet')
      }
    } catch {
      toast.error('Failed to fund wallet')
    } finally {
      setFunding(false)
    }
  }

  const setPrimaryWallet = async (_walletId: string) => {
    toast('Primary wallet is set in settings', { icon: 'ℹ️' })
  }

  const collectProfits = async () => {
    toast('Collect profits is not yet implemented', { icon: 'ℹ️' })
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Wallet Management</h1>
        </div>
        <p style={{ opacity: 0.8 }}>Loading wallets…</p>
      </div>
    )
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
        {wallets.map((wallet, index) => (
          <div
            key={wallet.walletAddress}
            className={`wallet-card ${index === 0 ? 'primary' : ''}`}
          >
            {index === 0 && (
              <div className="primary-badge">⭐ Default</div>
            )}

            <div className="wallet-header">
              <div>
                <h3 className="wallet-name">{wallet.label || wallet.userId}</h3>
                <div className="wallet-address-display">{wallet.walletAddress}</div>
              </div>
            </div>

            <div className="wallet-balance">
              <div className="balance-label">Balance</div>
              <div className="balance-amount">{wallet.balance.toFixed(2)} XRP</div>
            </div>

            <div className="wallet-info">
              {wallet.agentName ? (
                <div className="info-item">
                  <span className="info-label">LLM Agent:</span>
                  <span className="info-value">{wallet.agentName}</span>
                </div>
              ) : (
                <div className="info-item">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{wallet.userId === 'default' ? 'Default wallet' : 'Wallet'}</span>
                </div>
              )}
            </div>

            <div className="wallet-actions">
              {index !== 0 && (
                <button
                  className="action-btn"
                  onClick={() => setPrimaryWallet(wallet.walletAddress)}
                >
                  Set as Primary
                </button>
              )}
              <button
                className="action-btn"
                onClick={() => openFundModal(wallet)}
              >
                Add funds (from master)
              </button>
            </div>
          </div>
        ))}

        {wallets.length === 0 && (
          <div className="wallet-card add-new">
            <div className="add-new-content">
              <p style={{ opacity: 0.8 }}>No wallets yet. Create an LLM agent with a new wallet, or add your default wallet seed in .env.</p>
            </div>
          </div>
        )}
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
                    <option key={w.walletAddress} value={w.walletAddress}>
                      {w.label} ({w.balance.toFixed(2)} XRP)
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

      {showFundModal && fundTarget && (
        <div className="modal-overlay" onClick={() => { setShowFundModal(false); setFundTarget(null) }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add funds to wallet</h2>
            <p style={{ marginBottom: 16, opacity: 0.9 }}>
              Send XRP from a master wallet to <strong>{fundTarget.label || fundTarget.walletAddress}</strong> ({fundTarget.walletAddress.slice(0, 12)}…).
            </p>
            <form onSubmit={handleFundWallet} className="transfer-form">
              <div className="form-group">
                <label>From (master wallet)</label>
                <select
                  value={fundForm.fromWalletAddress}
                  onChange={e => setFundForm({ ...fundForm, fromWalletAddress: e.target.value })}
                  required
                >
                  <option value="">Select source wallet...</option>
                  {wallets.map(w => (
                    <option key={w.walletAddress} value={w.walletAddress}>
                      {w.label} ({w.balance.toFixed(2)} XRP)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (XRP)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={fundForm.amount}
                  onChange={e => setFundForm({ ...fundForm, amount: e.target.value })}
                  placeholder="10"
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => { setShowFundModal(false); setFundTarget(null) }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={funding}>
                  {funding ? 'Sending…' : 'Send XRP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
