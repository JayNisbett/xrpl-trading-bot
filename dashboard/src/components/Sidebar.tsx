import { Link, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  const navItems = [
    { path: '/', icon: '📊', label: 'Overview' },
    { path: '/positions', icon: '💼', label: 'Positions' },
    { path: '/amm', icon: '🌊', label: 'AMM Pools' },
    { path: '/configs', icon: '⚙️', label: 'Configurations' },
    { path: '/bots', icon: '🤖', label: 'Bots' },
    { path: '/transactions', icon: '📜', label: 'Transactions' },
    { path: '/wallets', icon: '👛', label: 'Wallets' },
    { path: '/settings', icon: '🔧', label: 'Settings' }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>🚀 XRPL Bot</h2>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="version-info">v3.1</div>
      </div>
    </aside>
  )
}
