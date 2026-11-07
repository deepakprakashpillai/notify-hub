import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import styles from './Layout.module.css';
import { Search, Command } from 'lucide-react';

export default function Layout() {
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar onOpenSearch={() => setPaletteOpen(true)} />
      <main className={styles.mainContent}>
        {/* Global Header Bar */}
        <header className={styles.globalHeader}>
          <button className={styles.searchTriggerBtn} onClick={() => setPaletteOpen(true)}>
            <Search size={14} color="var(--accent)" />
            <span>Search workflows, apps, logs...</span>
            <div className={styles.kbdBadge}>
              <Command size={11} /> K
            </div>
          </button>
        </header>

        <div className={styles.contentWrapper}>
          <Outlet />
        </div>
      </main>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
