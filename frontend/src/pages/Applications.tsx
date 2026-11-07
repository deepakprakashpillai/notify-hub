import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import pageStyles from './Page.module.css';
import styles from './Applications.module.css';
import modalStyles from '../components/ApiKeyModal.module.css';
import {
  AppWindow,
  Plus,
  Layers,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import {
  getApplications,
  createApplication,
  deleteApplication,
  type ApplicationResponse,
} from '../api/applications';

export default function Applications() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAppModal, setShowAppModal] = useState<boolean>(false);
  const [appName, setAppName] = useState<string>('');
  const [appDesc, setAppDesc] = useState<string>('');
  const [isSubmittingApp, setIsSubmittingApp] = useState<boolean>(false);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getApplications();
      setApps(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    try {
      setIsSubmittingApp(true);
      setError(null);
      await createApplication({
        name: appName.trim(),
        description: appDesc.trim() || undefined,
      });
      setAppName('');
      setAppDesc('');
      setShowAppModal(false);
      await loadApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const handleDeleteApp = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete application "${name}"?`)) return;

    try {
      setError(null);
      await deleteApplication(id);
      await loadApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to delete application');
    }
  };

  return (
    <div className={styles.container}>
      <header className={pageStyles.pageHeader}>
        <div className={styles.topBar}>
          <div>
            <h1 className={pageStyles.pageTitle}>Applications</h1>
            <p className={pageStyles.pageSubtitle}>
              Manage connected applications, environments, workflows, and secret API keys.
            </p>
          </div>
          <button className={styles.createBtn} onClick={() => setShowAppModal(true)}>
            <Plus size={16} />
            Create Application
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loadingContainer}>
          <Loader2 className="animate-spin" size={24} color="var(--accent)" />
          <span>Loading applications...</span>
        </div>
      ) : apps.length === 0 ? (
        <div className={styles.emptyState}>
          <AppWindow size={44} color="var(--text-secondary)" />
          <h3>No applications found</h3>
          <p>Get started by creating your first application to set up live and test environments.</p>
          <button className={styles.createBtn} onClick={() => setShowAppModal(true)}>
            <Plus size={16} />
            Create Application
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {apps.map((app) => (
            <div
              key={app.id}
              className={styles.appCard}
              onClick={() => navigate(`/applications/${app.id}`)}
            >
              <div>
                <div className={styles.appHeader}>
                  <h2 className={styles.appName}>
                    <AppWindow size={20} color="var(--accent)" />
                    {app.name}
                  </h2>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteApp(e, app.id, app.name)}
                    title="Delete Application"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className={styles.appDesc}>
                  {app.description || 'No description provided.'}
                </p>
                <p className={styles.appMeta}>
                  Created: {new Date(app.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Environments section badges */}
              <div className={styles.envSection}>
                <div className={styles.envTitleRow}>
                  <span className={styles.envSectionTitle}>
                    <Layers size={13} /> Environments ({app.environments.length})
                  </span>
                </div>

                <div className={styles.envList}>
                  {app.environments.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      No environments
                    </span>
                  ) : (
                    app.environments.map((env) => {
                      let tagClass = styles.tagCustom;
                      if (env.name === 'live') tagClass = styles.tagLive;
                      if (env.name === 'test') tagClass = styles.tagTest;

                      return (
                        <div key={env.id} className={styles.envItem}>
                          <span className={`${styles.envTag} ${tagClass}`}>{env.name}</span>
                          <span className={styles.keyHashStatus}>
                            {env.has_api_key ? 'Key Active' : 'No Key'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Application Modal */}
      {showAppModal && (
        <div className={modalStyles.backdrop} onClick={() => setShowAppModal(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h3 className={modalStyles.title}>
                <AppWindow size={20} color="var(--accent)" />
                Create New Application
              </h3>
              <button
                className={modalStyles.closeBtn}
                onClick={() => setShowAppModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateApp}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Application Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. E-Commerce Backend"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Short summary of this application's purpose"
                  value={appDesc}
                  onChange={(e) => setAppDesc(e.target.value)}
                />
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowAppModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={modalStyles.primaryBtn}
                  disabled={isSubmittingApp}
                >
                  {isSubmittingApp ? 'Creating...' : 'Create Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
