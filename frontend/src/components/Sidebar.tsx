import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AppWindow, BellRing, GitMerge, Activity, Search, Command } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onOpenSearch?: () => void;
}

export default function Sidebar({ onOpenSearch }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <div className={styles.logoIcon}>
          <BellRing size={18} color="#fff" strokeWidth={2.5} />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>Notify Hub</span>
          <span className={styles.logoSub}>Notification Platform</span>
        </div>
      </div>

      {/* Quick Search Button in Sidebar */}
      {onOpenSearch && (
        <button className={styles.sidebarSearchBtn} onClick={onOpenSearch}>
          <Search size={14} color="var(--accent)" />
          <span>Quick Search</span>
          <span className={styles.sidebarKbd}>
            <Command size={10} /> K
          </span>
        </button>
      )}

      {/* Navigation */}
      <nav className={styles.navSection}>
        <span className={styles.navLabel}>Navigation</span>

        <NavLink
          to="/"
          end
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/applications"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <AppWindow size={16} />
          <span>Applications</span>
        </NavLink>

        <NavLink
          to="/workflows"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <GitMerge size={16} />
          <span>Workflows</span>
        </NavLink>

        <NavLink
          to="/monitoring"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <Activity size={16} />
          <span>Monitoring</span>
        </NavLink>
      </nav>

      {/* Bottom */}
      <div className={styles.sidebarBottom}>
        <span className={styles.versionBadge}>
          <span className={styles.versionDot} />
          v2.0 — Phase 2
        </span>
      </div>
    </aside>
  );
}
