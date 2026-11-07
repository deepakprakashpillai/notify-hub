import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CommandPalette.module.css';
import { Search, GitMerge, AppWindow, Activity, LayoutDashboard, ArrowRight, Command } from 'lucide-react';
import { getApplications, type ApplicationResponse } from '../api/applications';
import { getWorkflows, type WorkflowResponse } from '../api/workflows';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navigation' | 'Application' | 'Workflow';
  icon: React.ReactNode;
  action: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState<string>('');
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getApplications(), getWorkflows()])
        .then(([aData, wData]) => {
          setApps(aData);
          setWorkflows(wData);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or state
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultItems: SearchItem[] = [
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      subtitle: 'Overview & metrics',
      category: 'Navigation',
      icon: <LayoutDashboard size={16} color="var(--accent)" />,
      action: () => {
        navigate('/');
        onClose();
      },
    },
    {
      id: 'nav-apps',
      title: 'Applications',
      subtitle: 'Environments & API keys',
      category: 'Navigation',
      icon: <AppWindow size={16} color="#60a5fa" />,
      action: () => {
        navigate('/applications');
        onClose();
      },
    },
    {
      id: 'nav-workflows',
      title: 'Workflows',
      subtitle: 'Templates & channels',
      category: 'Navigation',
      icon: <GitMerge size={16} color="#34d399" />,
      action: () => {
        navigate('/workflows');
        onClose();
      },
    },
    {
      id: 'nav-monitoring',
      title: 'Monitoring',
      subtitle: 'Events & delivery log',
      category: 'Navigation',
      icon: <Activity size={16} color="#f59e0b" />,
      action: () => {
        navigate('/monitoring');
        onClose();
      },
    },
  ];

  const appItems: SearchItem[] = apps.map((app) => ({
    id: `app-${app.id}`,
    title: app.name,
    subtitle: `${app.environments.length} environment(s)`,
    category: 'Application',
    icon: <AppWindow size={16} color="#60a5fa" />,
    action: () => {
      navigate(`/applications/${app.id}`);
      onClose();
    },
  }));

  const workflowItems: SearchItem[] = workflows.map((wf) => ({
    id: `wf-${wf.id}`,
    title: wf.name,
    subtitle: `Key: ${wf.key}`,
    category: 'Workflow',
    icon: <GitMerge size={16} color="#34d399" />,
    action: () => {
      navigate('/workflows');
      onClose();
    },
  }));

  const allItems = [...defaultItems, ...appItems, ...workflowItems];
  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className={styles.searchBar}>
          <Search size={18} color="var(--accent)" />
          <input
            className={styles.searchInput}
            placeholder="Search pages, applications, workflows... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
          />
          <div className={styles.kbdHint}>
            <Command size={12} /> K
          </div>
        </div>

        <div className={styles.resultsList}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>No results found for "{query}"</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`${styles.resultRow} ${idx === selectedIndex ? styles.rowSelected : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={styles.rowIcon}>{item.icon}</div>
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowSubtitle}>{item.subtitle}</span>
                </div>
                <span className={styles.rowBadge}>{item.category}</span>
                <ArrowRight size={14} className={styles.rowArrow} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
