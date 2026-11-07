import React, { useEffect, useState, useCallback } from 'react';
import pageStyles from './Page.module.css';
import styles from './Monitoring.module.css';
import {
  Activity,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Mail,
  Bell,
} from 'lucide-react';
import {
  getNotificationJobs,
  type NotificationJobResponse,
  type MonitoringFilters,
} from '../api/monitoring';
import { getApplications, type ApplicationResponse } from '../api/applications';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 size={14} color="#34d399" />,
  failed: <XCircle size={14} color="#f87171" />,
  processing: <Loader2 size={14} color="#60a5fa" className="animate-spin" />,
  pending: <Clock size={14} color="#fbbf24" />,
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  success: '#34d399',
  failed: '#f87171',
  pending: '#fbbf24',
  dead_letter: '#f97316',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function JobRow({ job }: { job: NotificationJobResponse }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`${styles.tableRow} ${expanded ? styles.tableRowExpanded : ''}`}
        onClick={() => setExpanded((e) => !e)}
        style={{ cursor: 'pointer' }}
      >
        <td className={styles.td}>
          <span className={styles.eventId}>{job.event_id}</span>
        </td>
        <td className={styles.td}>
          <code className={styles.workflowKey}>{job.workflow_key}</code>
        </td>
        <td className={styles.td}>
          <span className={styles.statusBadge} style={{ color: DELIVERY_STATUS_COLORS[job.status] || 'var(--text-secondary)' }}>
            {STATUS_ICONS[job.status] ?? <AlertTriangle size={14} />}
            {job.status}
          </span>
        </td>
        <td className={styles.td}>
          <div className={styles.deliverySummary}>
            {job.deliveries.map((d) => (
              <span
                key={d.id}
                className={styles.deliveryPill}
                style={{ borderColor: DELIVERY_STATUS_COLORS[d.status] || 'var(--border)' }}
                title={`${d.channel} → ${d.status}${d.error_message ? ': ' + d.error_message : ''}`}
              >
                {d.channel === 'email' ? <Mail size={11} /> : <Bell size={11} />}
                <span style={{ color: DELIVERY_STATUS_COLORS[d.status] }}>{d.status}</span>
              </span>
            ))}
            {job.deliveries.length === 0 && <span className={styles.noDeliveries}>No deliveries</span>}
          </div>
        </td>
        <td className={styles.td}>{formatDate(job.occurred_at)}</td>
        <td className={styles.td}>{formatDate(job.created_at)}</td>
        <td className={styles.td} onClick={(e) => e.stopPropagation()}>
          <button className={styles.expandBtn} onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className={styles.expandedRow}>
          <td colSpan={7} className={styles.expandedCell}>
            <div className={styles.expandedContent}>
              <div className={styles.jobMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Job ID</span>
                  <code className={styles.metaValue}>{job.id}</code>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Event ID</span>
                  <code className={styles.metaValue}>{job.event_id}</code>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Occurred At</span>
                  <span className={styles.metaValue}>{formatDate(job.occurred_at)}</span>
                </div>
              </div>

              {job.deliveries.length > 0 && (
                <div className={styles.deliveryDetails}>
                  <div className={styles.deliveryDetailsTitle}>Delivery Attempts</div>
                  {job.deliveries.map((d) => (
                    <div key={d.id} className={styles.deliveryDetailRow}>
                      <span className={styles.deliveryChannel}>
                        {d.channel === 'email' ? <Mail size={13} /> : <Bell size={13} />}
                        {d.channel}
                      </span>
                      <span className={styles.deliveryRecipient}>
                        recipient: <code>{d.recipient_id}</code>
                      </span>
                      <span style={{ color: DELIVERY_STATUS_COLORS[d.status] || 'inherit', fontWeight: 600, fontSize: '0.75rem' }}>
                        {d.status}
                      </span>
                      <span className={styles.deliveryAttempts}>
                        {d.attempt_count} attempt{d.attempt_count !== 1 ? 's' : ''}
                      </span>
                      {d.error_message && (
                        <span className={styles.deliveryError}>{d.error_message}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Monitoring() {
  const [jobs, setJobs] = useState<NotificationJobResponse[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);

  // Filters
  const [eventIdSearch, setEventIdSearch] = useState<string>('');
  const [workflowKeyFilter, setWorkflowKeyFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [envFilter, setEnvFilter] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const limit = 20;

  const allEnvs: { id: string; label: string }[] = [];
  applications.forEach((app) => {
    app.environments.forEach((env) => {
      allEnvs.push({ id: env.id, label: `${app.name} / ${env.name}` });
    });
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: MonitoringFilters = {
        limit,
        offset,
      };
      if (eventIdSearch.trim()) filters.event_id = eventIdSearch.trim();
      if (workflowKeyFilter.trim()) filters.workflow_key = workflowKeyFilter.trim();
      if (statusFilter) filters.status = statusFilter;
      if (envFilter) filters.environment_id = envFilter;

      const data = await getNotificationJobs(filters);
      setJobs(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, [eventIdSearch, workflowKeyFilter, statusFilter, envFilter, offset]);

  useEffect(() => {
    getApplications()
      .then(setApplications)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reset offset when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setOffset(0);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className={styles.container}>
      <header className={pageStyles.pageHeader}>
        <div className={styles.topBar}>
          <div>
            <h1 className={pageStyles.pageTitle}>Monitoring</h1>
            <p className={pageStyles.pageSubtitle}>
              Track event ingestion, delivery attempts, and failures across all workflows.
            </p>
          </div>
          <button className={styles.refreshBtn} onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Activity size={18} color="var(--accent)" />
          <span className={styles.statValue}>{total}</span>
          <span className={styles.statLabel}>Total Events</span>
        </div>
        <div className={styles.statCard}>
          <CheckCircle2 size={18} color="#34d399" />
          <span className={styles.statValue} style={{ color: '#34d399' }}>
            {jobs.filter((j) => j.status === 'completed').length}
          </span>
          <span className={styles.statLabel}>Completed (page)</span>
        </div>
        <div className={styles.statCard}>
          <XCircle size={18} color="#f87171" />
          <span className={styles.statValue} style={{ color: '#f87171' }}>
            {jobs.filter((j) => j.status === 'failed').length}
          </span>
          <span className={styles.statLabel}>Failed (page)</span>
        </div>
        <div className={styles.statCard}>
          <Clock size={18} color="#fbbf24" />
          <span className={styles.statValue} style={{ color: '#fbbf24' }}>
            {jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length}
          </span>
          <span className={styles.statLabel}>In-Flight (page)</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={14} color="var(--text-muted)" />
          <input
            className={styles.searchInput}
            placeholder="Search by event_id..."
            value={eventIdSearch}
            onChange={(e) => handleFilterChange(setEventIdSearch)(e.target.value)}
          />
        </div>
        <input
          className={styles.filterInput}
          placeholder="Workflow key filter..."
          value={workflowKeyFilter}
          onChange={(e) => handleFilterChange(setWorkflowKeyFilter)(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className={styles.filterSelect}
          value={envFilter}
          onChange={(e) => handleFilterChange(setEnvFilter)(e.target.value)}
        >
          <option value="">All Environments</option>
          {allEnvs.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Table */}
      <div className={styles.tableWrapper}>
        {loading && jobs.length === 0 ? (
          <div className={styles.loadingState}>
            <Loader2 size={28} color="var(--accent)" className={styles.spinning} />
            <span>Loading events...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className={styles.emptyState}>
            <Activity size={40} color="var(--text-secondary)" />
            <h3>No events found</h3>
            <p>Events will appear here once source applications begin sending notifications.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Event ID</th>
                <th className={styles.th}>Workflow</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Deliveries</th>
                <th className={styles.th}>Occurred At</th>
                <th className={styles.th}>Ingested At</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            disabled={offset === 0}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            Page {currentPage} of {totalPages} ({total} total)
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setOffset((o) => o + limit)}
            disabled={currentPage >= totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
