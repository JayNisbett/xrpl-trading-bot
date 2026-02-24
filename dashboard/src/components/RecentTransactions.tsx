import { formatDistanceToNow } from 'date-fns'

interface Transaction {
  type: string
  timestamp: string
  tokenSymbol?: string
  amount?: number
  profit?: number
  profitPercent?: number
  status?: string
  ourTxHash?: string
  originalTxHash?: string
  walletAddress?: string
}

interface RecentTransactionsProps {
  transactions: Transaction[]
  walletAddress?: string
}

export default function RecentTransactions({ transactions, walletAddress = '' }: RecentTransactionsProps) {
  const recentTxs = [...transactions].slice(0, 50).reverse()

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'arbitrage': return '💱'
      case 'lp_entry': return '💧'
      case 'lp_exit': return '🚪'
      case 'buy': return '🟢'
      case 'sell': return '🔴'
      case 'snipe_buy':
      case 'sniper_buy':
      case 'copy_buy':
      case 'receive':
      case 'amm_deposit': return '🟢'
      case 'send':
      case 'amm_withdraw': return '🔴'
      default: return '📝'
    }
  }

  const getXRPScanLink = (tx: Transaction) => {
    const txHash = tx.ourTxHash || tx.originalTxHash || (tx as any).txHash
    if (!txHash) return walletAddress ? `https://xrpscan.com/account/${walletAddress}` : 'https://xrpscan.com'
    return `https://xrpscan.com/tx/${txHash}`
  }

  return (
    <div className="recent-transactions-card">
      <div className="card-header">
        <h3>Recent Transactions</h3>
        <a 
          href={`https://xrpscan.com/account/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="xrpscan-link"
        >
          View on XRPScan →
        </a>
      </div>

      {recentTxs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <div className="empty-text">No transactions yet</div>
          <div className="empty-subtext">Transactions will appear here as bots trade</div>
        </div>
      ) : (
        <div className="transaction-list">
          {recentTxs.map((tx, idx) => (
            <div key={idx} className={`transaction-item ${tx.status}`}>
              <div className="tx-left">
                <span className="tx-icon">{getTypeIcon(tx.type)}</span>
                <div className="tx-details">
                  <div className="tx-type">{tx.type.replace('_', ' ').toUpperCase()}</div>
                  <div className="tx-symbol">{tx.tokenSymbol || 'XRP'}</div>
                </div>
              </div>

              <div className="tx-middle">
                <div className="tx-amount">{tx.amount?.toFixed(2) || '—'} XRP</div>
                {tx.profit !== undefined && (
                  <div className={`tx-profit ${tx.profit >= 0 ? 'positive' : 'negative'}`}>
                    {tx.profit >= 0 ? '+' : ''}{tx.profit.toFixed(2)} XRP
                    {tx.profitPercent !== undefined && ` (${tx.profitPercent.toFixed(2)}%)`}
                  </div>
                )}
              </div>

              <div className="tx-right">
                <div className="tx-time">
                  {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                </div>
                {(tx.ourTxHash || tx.originalTxHash || (tx as any).txHash) ? (
                  <a 
                    href={getXRPScanLink(tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-verify"
                    title="Verify on XRPScan"
                  >
                    🔍 Verify
                  </a>
                ) : (
                  <div className="tx-no-hash" title="Transaction hash not available">
                    —
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
