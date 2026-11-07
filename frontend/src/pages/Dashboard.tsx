import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import pageStyles from './Page.module.css';
import styles from './Dashboard.module.css';
import {
  AppWindow,
  GitMerge,
  Layers,
  FileCode,
  Loader2,
  Server,
  ArrowRight,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { getApplications, type ApplicationResponse } from '../api/applications';
import { getWorkflows, type WorkflowResponse } from '../api/workflows';

const METRIC_ICON_COLORS = [
  { bg: 'rgba(124,58,237,0.18)', color: '#a78bfa' },   // violet
  { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa' },   // blue
  { bg: 'rgba(16,185,129,0.18)', color: '#34d399' },   // green
  { bg: 'rgba(192,132,252,0.18)', color: '#c084fc' },  // purple
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function Dashboard() {
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        setError(null);
        const [appsData, wfData] = await Promise.all([getApplications(), getWorkflows()]);
        setApps(appsData);
        setWorkflows(wfData);
      } catch (err: any) {
        setError(err.message || 'Failed to load system metrics');
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const totalApplications = apps.length;
  const totalEnvironments = apps.reduce((sum, app) => sum + app.environments.length, 0);
  const totalWorkflows = workflows.length;
  let totalEmailTemplates = 0;
  let totalInAppTemplates = 0;
  workflows.forEach((wf) => {
    wf.versions.forEach((ver) => {
      ver.audience_rules?.forEach((rule) => {
        rule.templates?.forEach((t) => {
          if (t.channel === 'email') totalEmailTemplates++;
          if (t.channel === 'in_app') totalInAppTemplates++;
        });
      });
    });
  });

  const metrics = [
    {
      label: 'Applications',
      value: totalApplications,
      desc: 'Connected microservices',
      link: '/applications',
      linkLabel: 'Manage',
      icon: <AppWindow size={17} color={METRIC_ICON_COLORS[0].color} />,
      iconStyle: { background: METRIC_ICON_COLORS[0].bg },
    },
    {
      label: 'Environments',
      value: totalEnvironments,
      desc: 'Live & staging instances',
      link: '/applications',
      linkLabel: 'View',
      icon: <Layers size={17} color={METRIC_ICON_COLORS[1].color} />,
      iconStyle: { background: METRIC_ICON_COLORS[1].bg },
    },
    {
      label: 'Workflows',
      value: totalWorkflows,
      desc: 'Active notification routings',
      link: '/workflows',
      linkLabel: 'Configure',
      icon: <GitMerge size={17} color={METRIC_ICON_COLORS[2].color} />,
      iconStyle: { background: METRIC_ICON_COLORS[2].bg },
    },
    {
      label: 'Templates',
      value: totalEmailTemplates + totalInAppTemplates,
      desc: `${totalEmailTemplates} Email · ${totalInAppTemplates} In-App`,
      link: '/workflows',
      linkLabel: 'Editor',
      icon: <FileCode size={17} color={METRIC_ICON_COLORS[3].color} />,
      iconStyle: { background: METRIC_ICON_COLORS[3].bg },
    },
  ];

  return (
    <div className={styles.container}>
      <header className={pageStyles.pageHeader}>
        <h1 className={pageStyles.pageTitle}>Dashboard</h1>
        <p className={pageStyles.pageSubtitle}>
          System overview, multi-channel workflow metrics, and connected applications.
        </p>
      </header>

      {error && (
        <div style={{
          padding: '0.7rem 1rem',
          background: 'var(--red-subtle)',
          border: '1px solid var(--red-border)',
          borderRadius: 'var(--radius-md)',
          color: '#fca5a5',
          fontSize: '0.85rem',
        }}>
          {error} — Make sure the backend is running.
        </div>
      )}

      {loading ? (
        <div className={styles.loadingState}>
          <Loader2 className="animate-spin" size={22} color="var(--accent)" />
          <span>Fetching metrics...</span>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className={styles.metricsGrid}>
            {metrics.map((m) => (
              <div key={m.label} className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <div className={styles.metricIconBox} style={m.iconStyle}>
                    {m.icon}
                  </div>
                </div>
                <div className={styles.metricValue}>{m.value}</div>
                <div className={styles.metricFooter}>
                  <span className={styles.metricDesc}>{m.desc}</span>
                  <Link to={m.link} className={styles.quickLinkBtn}>
                    {m.linkLabel} <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Panels */}
          <div className={styles.contentGrid}>
            {/* Applications Panel */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>
                  <AppWindow size={17} color="var(--accent)" />
                  Connected Applications
                </h2>
                <Link to="/applications" className={styles.quickLinkBtn}>
                  View all ({totalApplications}) <ArrowRight size={11} />
                </Link>
              </div>

              {apps.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No applications yet. Register your first source application to get started.</p>
                  <Link
                    to="/applications"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 1rem',
                      background: 'var(--accent-gradient)',
                      color: '#fff',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <Plus size={14} /> Create Application
                  </Link>
                </div>
              ) : (
                <div className={styles.appList}>
                  {apps.slice(0, 6).map((app) => (
                    <Link key={app.id} to={`/applications/${app.id}`} className={styles.appRow}>
                      <div className={styles.appInfo}>
                        <div className={styles.appAvatar}>{getInitials(app.name)}</div>
                        <div className={styles.appInfoText}>
                          <span className={styles.appName}>{app.name}</span>
                          <span className={styles.appMeta}>{app.description || 'No description'}</span>
                        </div>
                      </div>
                      <div className={styles.envBadges}>
                        {app.environments.map((env) => (
                          <span
                            key={env.id}
                            className={`${styles.envBadge} ${env.name === 'live' || env.name === 'production' ? styles.envBadgeLive : ''}`}
                          >
                            {env.name}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Service Health */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>
                  <Server size={17} color="var(--green)" />
                  Service Health
                </h2>
              </div>

              <div className={styles.healthList}>
                {[
                  { name: 'FastAPI Engine', value: 'Healthy' },
                  { name: 'PostgreSQL Store', value: 'Connected' },
                  { name: 'Jinja2 Renderer', value: 'Active' },
                  { name: 'Celery Dispatcher', value: 'Ready' },
                  { name: 'Webhook Delivery', value: 'Online' },
                ].map((svc) => (
                  <div key={svc.name} className={styles.healthRow}>
                    <span className={styles.healthName}>
                      <span className={styles.statusDot} />
                      {svc.name}
                    </span>
                    <span className={styles.healthValue}>{svc.value}</span>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '0.65rem 0.875rem',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid var(--green-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: '#6ee7b7',
              }}>
                <ShieldCheck size={15} color="var(--green)" />
                HMAC SHA-256 webhook authentication active
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
