import AccountStatus from '../components/AccountStatus'
import PerformanceMetrics from '../components/PerformanceMetrics'
import PerformanceChart from '../components/PerformanceChart'
import ProfitChart from '../components/ProfitChart'
import ActivityFeed from '../components/ActivityFeed'
import RecentTransactions from '../components/RecentTransactions'

interface OverviewProps {
  accountStatus: any
  metrics: any
  profitHistory: any[]
  activities: any[]
  transactions?: any[]
  walletAddress?: string
}

export default function Overview({ accountStatus, metrics, profitHistory, activities, transactions = [], walletAddress = '' }: OverviewProps) {
  return (
    <div className="page">
      <h1 className="page-title">Dashboard Overview</h1>
      
      <div className="dashboard-grid">
        <div className="section account-section">
          <AccountStatus data={accountStatus} />
        </div>

        <div className="section metrics-section">
          <PerformanceMetrics data={metrics} />
        </div>

        <div className="section chart-section">
          <PerformanceChart metrics={metrics} />
        </div>

        <div className="section profit-chart-section">
          <ProfitChart data={profitHistory} />
        </div>

        <div className="section activity-section">
          <ActivityFeed activities={activities} />
        </div>

        {transactions.length > 0 && (
          <div className="section transactions-section">
            <RecentTransactions 
              transactions={transactions} 
              walletAddress={walletAddress}
            />
          </div>
        )}
      </div>
    </div>
  )
}
