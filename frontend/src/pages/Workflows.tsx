import React, { useEffect, useState, useCallback } from 'react';
import pageStyles from './Page.module.css';
import styles from './Workflows.module.css';
import modalStyles from '../components/ApiKeyModal.module.css';
import {
  GitMerge,
  Plus,
  Trash2,
  X,
  Loader2,
  Sliders,
  Mail,
  Bell,
  Sparkles,
  Play,
  Code2,
} from 'lucide-react';
import {
  getWorkflows,
  createWorkflow,
  deleteWorkflow,
  createWorkflowVersion,
  publishWorkflowVersion,
  type WorkflowResponse,
} from '../api/workflows';
import { getApplications, type ApplicationResponse } from '../api/applications';
import TemplateEditor from '../components/TemplateEditor';
import CodeSnippetModal from '../components/CodeSnippetModal';
import TestEventModal from '../components/TestEventModal';

export default function Workflows() {
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter by Environment
  const [selectedEnvFilter, setSelectedEnvFilter] = useState<string>('');

  // Active Workflow for Studio Modal Editing
  const [studioWorkflowId, setStudioWorkflowId] = useState<string | null>(null);

  // Active Workflow for Snippet Modal
  const [snippetWorkflow, setSnippetWorkflow] = useState<WorkflowResponse | null>(null);

  // Active Workflow for Test Trigger Modal
  const [testWorkflow, setTestWorkflow] = useState<WorkflowResponse | null>(null);

  // Selected Version ID per Workflow
  const [selectedVersionIds, setSelectedVersionIds] = useState<Record<string, string>>({});

  // Create Workflow Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [workflowKey, setWorkflowKey] = useState<string>('');
  const [workflowName, setWorkflowName] = useState<string>('');
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [workflowPriority, setWorkflowPriority] = useState<'high' | 'default' | 'low'>('default');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Helper map for environment lookup
  const envMap: Record<string, { envName: string; appName: string }> = {};
  applications.forEach((app) => {
    app.environments.forEach((env) => {
      envMap[env.id] = { envName: env.name, appName: app.name };
    });
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [appsData, wfData] = await Promise.all([
        getApplications(),
        getWorkflows(selectedEnvFilter || undefined),
      ]);
      setApplications(appsData);
      setWorkflows(wfData);

      if (appsData.length > 0 && appsData[0].environments.length > 0) {
        setSelectedEnvId((prev) => prev || appsData[0].environments[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows or applications');
    } finally {
      setLoading(false);
    }
  }, [selectedEnvFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default selected version when workflows change
  useEffect(() => {
    setSelectedVersionIds((prevIds) => {
      const newVersionsMap: Record<string, string> = { ...prevIds };
      let changed = false;
      workflows.forEach((wf) => {
        if (wf.versions && wf.versions.length > 0 && !newVersionsMap[wf.id]) {
          changed = true;
          const pub = wf.versions.find((v) => v.status === 'published');
          if (pub) {
            newVersionsMap[wf.id] = pub.id;
          } else {
            const sorted = [...wf.versions].sort((a, b) => b.version_number - a.version_number);
            newVersionsMap[wf.id] = sorted[0].id;
          }
        }
      });
      return changed ? newVersionsMap : prevIds;
    });
  }, [workflows]);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowKey.trim() || !workflowName.trim() || !selectedEnvId) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const created = await createWorkflow({
        environment_id: selectedEnvId,
        key: workflowKey.trim(),
        name: workflowName.trim(),
        priority: workflowPriority,
      });

      setShowCreateModal(false);
      setWorkflowKey('');
      setWorkflowName('');
      setWorkflowPriority('default');
      setStudioWorkflowId(created.id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorkflow = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete workflow "${name}"?`)) return;

    try {
      setError(null);
      await deleteWorkflow(id);
      if (studioWorkflowId === id) setStudioWorkflowId(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete workflow');
    }
  };

  const handleCreateDraft = async (workflowId: string) => {
    try {
      setError(null);
      const newVersion = await createWorkflowVersion(workflowId);
      setSelectedVersionIds((prev) => ({ ...prev, [workflowId]: newVersion.id }));
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create new draft version');
    }
  };

  const handlePublishVersion = async (versionId: string) => {
    try {
      setError(null);
      await publishWorkflowVersion(versionId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to publish workflow version');
    }
  };

  const allEnvironments: { id: string; label: string }[] = [];
  applications.forEach((app) => {
    app.environments.forEach((env) => {
      allEnvironments.push({
        id: env.id,
        label: `${app.name} (${env.name})`,
      });
    });
  });

  const activeStudioWorkflow = workflows.find((w) => w.id === studioWorkflowId);
  const activeStudioVersionId = activeStudioWorkflow
    ? selectedVersionIds[activeStudioWorkflow.id] || activeStudioWorkflow.versions[0]?.id
    : null;
  const activeStudioVersion = activeStudioWorkflow?.versions.find(
    (v) => v.id === activeStudioVersionId
  );

  return (
    <div className={styles.container}>
      <header className={pageStyles.pageHeader}>
        <div className={styles.topBar}>
          <div>
            <h1 className={pageStyles.pageTitle}>Workflows</h1>
            <p className={pageStyles.pageSubtitle}>
              Configure notification routing, multi-channel templates, priority, and payload variables.
            </p>
          </div>
          <div className={styles.filterGroup}>
            <select
              className={styles.select}
              value={selectedEnvFilter}
              onChange={(e) => setSelectedEnvFilter(e.target.value)}
            >
              <option value="">All Environments</option>
              {allEnvironments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Create Workflow
            </button>
          </div>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loadingContainer}>
          <Loader2 className="animate-spin" size={26} color="var(--accent)" />
          <span>Loading workflows...</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className={styles.emptyState}>
          <GitMerge size={44} color="var(--text-muted)" />
          <h3>No workflows found</h3>
          <p>Create your first workflow to set up email and in-app templates.</p>
          <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            Create Workflow
          </button>
        </div>
      ) : (
        <div className={styles.workflowList}>
          {workflows.map((wf) => {
            const envMeta = envMap[wf.environment_id];
            const publishedVersion = wf.versions.find((v) => v.status === 'published');
            const latestVersion = publishedVersion || wf.versions[wf.versions.length - 1];
            const enabledChannels = Array.from(new Set(
              latestVersion?.audience_rules?.flatMap(ar => ar.channels || []) || []
            ));

            const priorityColors: Record<string, string> = {
              high: '#ef4444',
              default: 'var(--accent)',
              low: 'var(--text-secondary)',
            };

            return (
              <div key={wf.id} className={styles.workflowCard}>
                <div className={styles.workflowMainInfo}>
                  <div className={styles.workflowTitleRow}>
                    <h2 className={styles.workflowName}>
                      <GitMerge size={18} color="var(--accent)" />
                      {wf.name}
                    </h2>
                    <code className={styles.workflowKey}>{wf.key}</code>
                    {envMeta && (
                      <span className={styles.envBadge}>
                        {envMeta.appName} / {envMeta.envName}
                      </span>
                    )}
                    <span
                      className={styles.priorityBadge}
                      style={{ color: priorityColors[wf.priority] || 'var(--accent)' }}
                    >
                      ↑ {wf.priority}
                    </span>
                  </div>

                  <div className={styles.workflowDetailsRow}>
                    <div className={styles.channelsList}>
                      <span>Channels:</span>
                      {enabledChannels.includes('email') && (
                        <span className={styles.channelPill}>
                          <Mail size={11} /> Email
                        </span>
                      )}
                      {enabledChannels.includes('in_app') && (
                        <span className={styles.channelPill}>
                          <Bell size={11} /> In-App Webhook
                        </span>
                      )}
                    </div>

                    <span
                      className={`${styles.versionPill} ${
                        publishedVersion ? styles.versionPublished : styles.versionDraft
                      }`}
                    >
                      {publishedVersion ? `v${publishedVersion.version_number} Published` : 'Draft'}
                    </span>

                    <span>{wf.versions.length} version{wf.versions.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className={styles.actionsRow}>
                  <button
                    className={styles.actionIconButton}
                    onClick={() => setTestWorkflow(wf)}
                    title="Test Trigger Simulator"
                  >
                    <Play size={13} color="var(--green)" /> Test Event
                  </button>
                  <button
                    className={styles.actionIconButton}
                    onClick={() => setSnippetWorkflow(wf)}
                    title="Get API Integration Snippet"
                  >
                    <Code2 size={13} color="#a78bfa" /> API Snippet
                  </button>
                  <button
                    className={styles.editStudioBtn}
                    onClick={() => setStudioWorkflowId(wf.id)}
                  >
                    <Sliders size={14} /> Configure
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                    title="Delete Workflow"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Studio Modal Overlay for Workflow Editing ───────────────────── */}
      {activeStudioWorkflow && activeStudioVersion && (
        <div className={styles.studioOverlay} onClick={() => setStudioWorkflowId(null)}>
          <div className={styles.studioContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.studioHeader}>
              <div className={styles.studioTitleRow}>
                <Sparkles size={20} color="var(--accent)" />
                <h2 className={styles.studioTitle}>{activeStudioWorkflow.name}</h2>
                <code className={styles.workflowKey}>{activeStudioWorkflow.key}</code>
              </div>
              <button
                className={styles.studioCloseBtn}
                onClick={() => setStudioWorkflowId(null)}
                title="Close Studio"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.studioBody}>
              <TemplateEditor
                versionId={activeStudioVersion.id}
                audienceRules={activeStudioVersion.audience_rules}
                workflowName={activeStudioWorkflow.name}
                workflowKey={activeStudioWorkflow.key}
                versions={activeStudioWorkflow.versions}
                activeVersionId={activeStudioVersion.id}
                onSelectVersion={(vId) =>
                  setSelectedVersionIds((prev) => ({
                    ...prev,
                    [activeStudioWorkflow.id]: vId,
                  }))
                }
                onCreateDraft={() => handleCreateDraft(activeStudioWorkflow.id)}
                onPublishVersion={(vId) => handlePublishVersion(vId)}
                onSave={loadData}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── API Integration Snippet Modal ────────────────────────────────── */}
      {snippetWorkflow && (
        <CodeSnippetModal
          workflowKey={snippetWorkflow.key}
          environmentName={envMap[snippetWorkflow.environment_id]?.appName || 'App'}
          samplePayload={
            snippetWorkflow.versions.find((v) => v.status === 'published')?.variables_schema
              ? Object.fromEntries(
                  (
                    snippetWorkflow.versions.find((v) => v.status === 'published')
                      ?.variables_schema as any[]
                  ).map((v) => [v.name, v.example || 'sample_value'])
                )
              : { student_name: 'Rahul Kumar', from_time: '10:00 AM', to_time: '11:30 AM' }
          }
          onClose={() => setSnippetWorkflow(null)}
        />
      )}

      {/* ── Test Event Trigger Simulator Modal ──────────────────────────── */}
      {testWorkflow && (
        <TestEventModal
          workflowKey={testWorkflow.key}
          environmentName={envMap[testWorkflow.environment_id]?.appName || 'App'}
          sampleVariables={
            testWorkflow.versions.find((v) => v.status === 'published')?.variables_schema
              ? Object.fromEntries(
                  (
                    testWorkflow.versions.find((v) => v.status === 'published')
                      ?.variables_schema as any[]
                  ).map((v) => [v.name, v.example || 'sample_value'])
                )
              : { student_name: 'Rahul Kumar', from_time: '10:00 AM', to_time: '11:30 AM' }
          }
          onClose={() => setTestWorkflow(null)}
        />
      )}

      {/* ── Create Workflow Modal ────────────────────────────────────────── */}
      {showCreateModal && (
        <div className={modalStyles.overlay} onClick={() => setShowCreateModal(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h2 className={modalStyles.title}>Create New Workflow</h2>
              <button className={modalStyles.closeBtn} onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Target Environment *</label>
                <select
                  className={styles.modalSelect}
                  value={selectedEnvId}
                  onChange={(e) => setSelectedEnvId(e.target.value)}
                  required
                >
                  {allEnvironments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Workflow Key * (e.g. student.class_rescheduled)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. student.class_rescheduled"
                  value={workflowKey}
                  onChange={(e) =>
                    setWorkflowKey(e.target.value.toLowerCase().replace(/[\s-]+/g, '.'))
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Display Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Class Rescheduled Notification"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Delivery Priority</label>
                <select
                  className={styles.modalSelect}
                  value={workflowPriority}
                  onChange={(e) => setWorkflowPriority(e.target.value as 'high' | 'default' | 'low')}
                >
                  <option value="high">🔴 High — critical alerts, auth emails</option>
                  <option value="default">🟡 Default — standard notifications</option>
                  <option value="low">⚪ Low — marketing, digests</option>
                </select>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={pageStyles.primaryBtn}
                  disabled={isSubmitting || !workflowKey.trim() || !workflowName.trim()}
                >
                  {isSubmitting ? 'Creating...' : 'Create Workflow & Open Editor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
