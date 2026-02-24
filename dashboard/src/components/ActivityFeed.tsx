import { formatDistanceToNow } from 'date-fns'

interface Activity {
  id: string
  type: 'snipe' | 'profit_take' | 'stop_loss' | 'error' | 'status'
  message: string
  timestamp: Date
  data?: any
}

interface ActivityFeedProps {
  activities: Activity[]
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'snipe': return '🎯'
      case 'profit_take': return '💰'
      case 'stop_loss': return '🛑'
      case 'error': return '⚠️'
      case 'status': return 'ℹ️'
      default: return '📝'
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'snipe': return 'var(--accent)'
      case 'profit_take': return 'var(--profit)'
      case 'stop_loss': return 'var(--loss)'
      case 'error': return 'var(--warning)'
      case 'status': return 'var(--text-secondary)'
      default: return 'var(--text-primary)'
    }
  }

  return (
    <div className="card">
      <h2>🔴 Live Activity Feed</h2>
      {activities.length === 0 ? (
        <div className="empty-state">
          <p>Waiting for trading activity...</p>
        </div>
      ) : (
        <div className="activity-list">
          {activities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon" style={{ color: getActivityColor(activity.type) }}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="activity-content">
                <div className="activity-message">{activity.message}</div>
                <div className="activity-time">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
