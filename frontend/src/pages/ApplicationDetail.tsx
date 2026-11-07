import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ApplicationDetail.module.css';
import modalStyles from '../components/ApiKeyModal.module.css';
import {
  ArrowLeft,
  AppWindow,
  Layers,
  GitMerge,
  Plus,
  Key,
  Trash2,
  X,
  Loader2,
  Send,
  Globe,
  Check,
  Edit,
  Folder,
  Sliders,
} from 'lucide-react';
import {
  getApplication,
  createEnvironment,
  updateEnvironment,
  generateApiKey,
  type ApplicationResponse,
  type EnvironmentResponse,
} from '../api/applications';
import {
  getWorkflows,
  createWorkflow,
  deleteWorkflow,
  createWorkflowVersion,
  publishWorkflowVersion,
  type WorkflowResponse,
  type WorkflowGroupResponse,
  getWorkflowGroups,
  createWorkflowGroup,
  updateWorkflowGroup,
  deleteWorkflowGroup,
} from '../api/workflows';
import ApiKeyModal from '../components/ApiKeyModal';
import TemplateEditor from '../components/TemplateEditor';

export default function ApplicationDetail() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<ApplicationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'environments' | 'workflows'
  const [activeTab, setActiveTab] = useState<'environments' | 'workflows'>('environments');

  // Workflows state (for Tab 2)
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState<boolean>(false);
  const [wfEnvFilter, setWfEnvFilter] = useState<string>('all');
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Record<string, string>>({});
  
  const [groups, setGroups] = useState<WorkflowGroupResponse[]>([]);
  const [newGroupName, setNewGroupName] = useState<string>('');

  // Modals state
  const [showEnvModal, setShowEnvModal] = useState<boolean>(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [envName, setEnvName] = useState<string>('staging');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [resendApiKey, setResendApiKey] = useState<string>('');
  const [isSubmittingEnv, setIsSubmittingEnv] = useState<boolean>(false);

  const openCreateEnvModal = () => {
    setEditingEnvId(null);
    setEnvName('staging');
    setWebhookUrl('');
    setWebhookSecret('');
    setSenderEmail('');
    setResendApiKey('');
    setShowEnvModal(true);
  };

  const openEditEnvModal = (env: EnvironmentResponse) => {
    setEditingEnvId(env.id);
    setEnvName(env.name);
    setWebhookUrl(env.webhook_url || '');
    setWebhookSecret('');
    setSenderEmail(env.sender_email || '');
    setResendApiKey('');
    setShowEnvModal(true);
  };

  // Create / Update Environment Handler
  const handleSaveEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId || !envName.trim()) return;

    try {
      setIsSubmittingEnv(true);
      setError(null);
      const payload = {
        name: envName.trim().toLowerCase(),
        webhook_url: webhookUrl.trim() || undefined,
        webhook_secret: webhookSecret.trim() || undefined,
        sender_email: senderEmail.trim() || undefined,
        resend_api_key: resendApiKey.trim() || undefined,
      };

      if (editingEnvId) {
        await updateEnvironment(editingEnvId, payload);
      } else {
        await createEnvironment(appId, payload);
      }

      setShowEnvModal(false);
      await loadApp();
    } catch (err: any) {
      setError(err.message || 'Failed to save environment settings');
    } finally {
      setIsSubmittingEnv(false);
    }
  };

  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState<boolean>(false);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnvIdForWf || !newGroupName.trim()) return;

    try {
      setIsSubmittingGroup(true);
      setError(null);
      if (editingGroupId) {
        await updateWorkflowGroup(editingGroupId, { name: newGroupName.trim() });
      } else {
        await createWorkflowGroup(selectedEnvIdForWf, { name: newGroupName.trim(), sort_order: 0 });
      }
      setShowGroupModal(false);
      setNewGroupName('');
      setEditingGroupId(null);
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || 'Failed to save group');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete group "${name}"? Workflows will become ungrouped.`)) return;
    try {
      setError(null);
      await deleteWorkflowGroup(groupId);
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    }
  };

  const [showWfModal, setShowWfModal] = useState<boolean>(false);
  const [wfKey, setWfKey] = useState<string>('');
  const [wfName, setWfName] = useState<string>('');
  const [wfPriority, setWfPriority] = useState<'high' | 'default' | 'low'>('default');
  const [wfGroupId, setWfGroupId] = useState<string>('none');
  const [selectedEnvIdForWf, setSelectedEnvIdForWf] = useState<string>('');
  const [isSubmittingWf, setIsSubmittingWf] = useState<boolean>(false);

  // API Key Modal Popup State
  const [generatedKeyInfo, setGeneratedKeyInfo] = useState<{
    key: string;
    envName: string;
  } | null>(null);

  // Load Application details
  const loadApp = useCallback(async () => {
    if (!appId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getApplication(appId);
      setApp(data);
      if (data.environments.length > 0 && !selectedEnvIdForWf) {
        setSelectedEnvIdForWf(data.environments[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load application details');
    } finally {
      setLoading(false);
    }
  }, [appId, selectedEnvIdForWf]);

  const loadWorkflows = useCallback(async () => {
    if (!app || app.environments.length === 0) {
      setWorkflows([]);
      setGroups([]);
      return;
    }
    try {
      setLoadingWorkflows(true);
      const allWfs = await getWorkflows();
      const envIds = new Set(app.environments.map((e) => e.id));
      const appWfs = allWfs.filter((wf) => envIds.has(wf.environment_id));
      setWorkflows(appWfs);
      
      // Load groups for all environments
      const allGroups = await Promise.all(
        app.environments.map((e) => getWorkflowGroups(e.id))
      );
      setGroups(allGroups.flat());
    } catch (err: any) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoadingWorkflows(false);
    }
  }, [app]);

  useEffect(() => {
    loadApp();
  }, [loadApp]);

  useEffect(() => {
    if (app) {
      loadWorkflows();
    }
  }, [app, loadWorkflows]);

  // Update selected version map when workflows change
  useEffect(() => {
    setSelectedVersionIds((prevIds) => {
      const newMap = { ...prevIds };
      let changed = false;
      workflows.forEach((wf) => {
        if (wf.versions && wf.versions.length > 0 && !newMap[wf.id]) {
          changed = true;
          const pub = wf.versions.find((v) => v.status === 'published');
          if (pub) {
            newMap[wf.id] = pub.id;
          } else {
            const sorted = [...wf.versions].sort((a, b) => b.version_number - a.version_number);
            newMap[wf.id] = sorted[0].id;
          }
        }
      });
      return changed ? newMap : prevIds;
    });
  }, [workflows]);

  // Generate API Key Handler
  const handleGenerateKey = async (envId: string, envName: string) => {
    try {
      setError(null);
      const res = await generateApiKey(envId);
      setGeneratedKeyInfo({
        key: res.raw_key,
        envName: `${app?.name} / ${envName}`,
      });
      await loadApp();
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key');
    }
  };

  // Create Workflow Handler
  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wfKey.trim() || !wfName.trim() || !selectedEnvIdForWf) return;

    try {
      setIsSubmittingWf(true);
      setError(null);
      const payload = {
        environment_id: selectedEnvIdForWf,
        group_id: wfGroupId === 'none' ? undefined : wfGroupId,
        key: wfKey.trim().toLowerCase(),
        name: wfName.trim(),
        priority: wfPriority,
      };
      const created = await createWorkflow(payload);
      setShowWfModal(false);
      setWfKey('');
      setWfName('');
      setWfGroupId('none');
      setWfPriority('default');
      setExpandedWorkflowId(created.id);
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    } finally {
      setIsSubmittingWf(false);
    }
  };

  // Delete Workflow Handler
  const handleDeleteWorkflow = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete workflow "${name}"?`)) return;

    try {
      setError(null);
      await deleteWorkflow(id);
      if (expandedWorkflowId === id) setExpandedWorkflowId(null);
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || 'Failed to delete workflow');
    }
  };

  // Workflow Version Handlers
  const handleCreateDraft = async (workflowId: string) => {
    try {
      setError(null);
      const newVersion = await createWorkflowVersion(workflowId);
      setSelectedVersionIds((prev) => ({ ...prev, [workflowId]: newVersion.id }));
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || 'Failed to create new draft version');
    }
  };

  const handlePublishVersion = async (versionId: string) => {
    try {
      setError(null);
      await publishWorkflowVersion(versionId);
      await loadWorkflows();
    } catch (err: any) {
      setError(err.message || 'Failed to publish workflow version');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => navigate('/applications')}>
          <ArrowLeft size={16} /> Back to Applications
        </button>
        <div className={styles.loadingContainer}>
          <Loader2 className="animate-spin" size={28} color="var(--accent)" />
          <span>Loading application details...</span>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => navigate('/applications')}>
          <ArrowLeft size={16} /> Back to Applications
        </button>
        <div className={styles.errorBanner}>{error || 'Application not found.'}</div>
      </div>
    );
  }

  // Filter workflows by selected environment filter dropdown
  const filteredWorkflows = workflows.filter((wf) => {
    if (wfEnvFilter === 'all') return true;
    return wf.environment_id === wfEnvFilter;
  });

  return (
    <div className={styles.container}>
      {/* Back Button */}
      <button className={styles.backBtn} onClick={() => navigate('/applications')}>
        <ArrowLeft size={16} /> Back to Applications
      </button>

      {/* App Header */}
      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <AppWindow size={24} color="var(--accent)" />
            <h1 className={styles.appName}>{app.name}</h1>
            <span className={styles.appIdBadge}>ID: {app.id}</span>
          </div>
        </div>
        <p className={styles.appDesc}>{app.description || 'No description provided.'}</p>
        <div className={styles.headerMeta}>
          <span>Created: {new Date(app.created_at).toLocaleString()}</span>
          <span>Environments: {app.environments.length}</span>
          <span>Total Workflows: {workflows.length}</span>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'environments' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('environments')}
        >
          <Layers size={15} /> Environments & API Keys
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'workflows' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          <GitMerge size={15} /> Workflows ({workflows.length})
        </button>
      </div>

      {/* Tab 1: Environments & API Keys */}
      {activeTab === 'environments' && (
        <div className={styles.tabContent}>
          <div className={styles.actionRow}>
            <h2 className={styles.sectionTitle}>
              <Layers size={18} color="var(--accent)" /> Environments ({app.environments.length})
            </h2>
            <button className={styles.primaryBtn} onClick={openCreateEnvModal}>
              <Plus size={16} /> Create Environment
            </button>
          </div>

          {app.environments.length === 0 ? (
            <div className={styles.emptyState}>
              <Globe size={40} color="var(--text-secondary)" />
              <h3>No Environments Configured</h3>
              <p>Create live, test, or staging environments to manage email credentials, webhooks, and API keys.</p>
              <button className={styles.primaryBtn} onClick={openCreateEnvModal}>
                <Plus size={16} /> Create Environment
              </button>
            </div>
          ) : (
            <div className={styles.envList}>
              {app.environments.map((env) => {
                let tagClass = styles.tagCustom;
                if (env.name === 'live' || env.name === 'production') tagClass = styles.tagLive;
                if (env.name === 'test' || env.name === 'staging') tagClass = styles.tagTest;

                return (
                  <div key={env.id} className={styles.envCard}>
                    <div className={styles.envCardHeader}>
                      <div className={styles.envNameGroup}>
                        <span className={`${styles.envTag} ${tagClass}`}>{env.name}</span>
                        {env.is_active && (
                          <span className={styles.activeBadge}>
                            <Check size={12} /> Active
                          </span>
                        )}
                        <span className={styles.appIdBadge}>Env ID: {env.id}</span>
                      </div>

                      <button
                        className={styles.secondaryBtn}
                        onClick={() => openEditEnvModal(env)}
                        title="Edit Environment Settings"
                      >
                        <Edit size={14} /> Edit Settings
                      </button>
                    </div>

                    {/* Environment Credentials Summary */}
                    <div className={styles.envDetailsGrid}>
                      <div className={styles.envDetailItem}>
                        <span className={styles.envDetailLabel}>From Email Address</span>
                        <code className={styles.envDetailValue}>
                          {env.sender_email || 'noreply@notifyhub.dev (default)'}
                        </code>
                      </div>

                      <div className={styles.envDetailItem}>
                        <span className={styles.envDetailLabel}>Email Provider API Key</span>
                        <code className={styles.envDetailValue}>
                          {env.has_resend_api_key ? 'Configured' : 'Mock / System Default'}
                        </code>
                      </div>

                      <div className={styles.envDetailItem}>
                        <span className={styles.envDetailLabel}>In-App Webhook Callback URL</span>
                        <code className={styles.envDetailValue}>
                          {env.webhook_url || 'Not configured'}
                        </code>
                      </div>

                      <div className={styles.envDetailItem}>
                        <span className={styles.envDetailLabel}>Webhook HMAC Secret</span>
                        <code className={styles.envDetailValue}>
                          {env.has_webhook_secret ? 'Configured' : 'None'}
                        </code>
                      </div>
                    </div>

                    {/* API Keys Panel per Environment */}
                    <div className={styles.keyPanel}>
                      <div className={styles.keyInfo}>
                        <span className={styles.keyLabel}>Environment API Key</span>
                        {env.has_api_key ? (
                          <span className={styles.keyHash}>
                            Key active
                          </span>
                        ) : (
                          <span className={styles.keyHash} style={{ color: 'var(--text-muted)' }}>
                            No API Key Generated
                          </span>
                        )}
                      </div>
                      <button
                        className={styles.secondaryBtn}
                        onClick={() => handleGenerateKey(env.id, env.name)}
                      >
                        <Key size={14} />
                        {env.has_api_key ? 'Rotate Key' : 'Generate Key'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Workflows */}
      {activeTab === 'workflows' && (
        <div className={styles.tabContent}>
          <div className={styles.workflowControls}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Filter by Environment:</span>
              <select
                className={styles.select}
                value={wfEnvFilter}
                onChange={(e) => setWfEnvFilter(e.target.value)}
              >
                <option value="all">All Environments</option>
                {app.environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  if (app.environments.length > 0 && !selectedEnvIdForWf) {
                    setSelectedEnvIdForWf(app.environments[0].id);
                  }
                  setNewGroupName('');
                  setEditingGroupId(null);
                  setShowGroupModal(true);
                }}
              >
                <Folder size={16} /> New Group
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  if (app.environments.length > 0 && !selectedEnvIdForWf) {
                    setSelectedEnvIdForWf(app.environments[0].id);
                  }
                  setShowWfModal(true);
                }}
              >
                <Plus size={16} /> Create Workflow
              </button>
            </div>
          </div>

          {loadingWorkflows ? (
            <div className={styles.loadingContainer}>
              <Loader2 className="animate-spin" size={24} color="var(--accent)" />
              <span>Loading workflows...</span>
            </div>
          ) : filteredWorkflows.length === 0 && groups.length === 0 ? (
            <div className={styles.emptyState}>
              <GitMerge size={40} color="var(--text-secondary)" />
              <h3>No Workflows Found</h3>
              <p>Create notification workflows for this application's environments.</p>
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  if (app.environments.length > 0 && !selectedEnvIdForWf) {
                    setSelectedEnvIdForWf(app.environments[0].id);
                  }
                  setShowWfModal(true);
                }}
              >
                <Plus size={16} /> Create Workflow
              </button>
            </div>
          ) : (
            
            <div className={styles.workflowList}>
              {(() => {
                const groupedMap = new Map();
                groups.forEach(g => groupedMap.set(g.id, { group: g, wfs: [] }));
                const defaultWfs: WorkflowResponse[] = [];
                filteredWorkflows.forEach(wf => {
                  if (wf.group_id && groupedMap.has(wf.group_id)) {
                    groupedMap.get(wf.group_id).wfs.push(wf);
                  } else {
                    defaultWfs.push(wf);
                  }
                });
                const groupEntries = Array.from(groupedMap.values()).sort((a, b) => a.group.sort_order - b.group.sort_order);

                const renderWorkflowCard = (wf: WorkflowResponse) => {

                const isExpanded = expandedWorkflowId === wf.id;
                const envObj = app.environments.find((e) => e.id === wf.environment_id);
                const activeVersionId = selectedVersionIds[wf.id];
                const activeVersion =
                  wf.versions.find((v) => v.id === activeVersionId) || wf.versions[0];

                let envTagClass = styles.tagCustom;
                if (envObj?.name === 'live') envTagClass = styles.tagLive;
                if (envObj?.name === 'test') envTagClass = styles.tagTest;

                return (
                  <div
                    key={wf.id}
                    className={`${styles.workflowCard} ${isExpanded ? styles.workflowCardActive : ''}`}
                  >
                    <div 
                      className={styles.workflowHeader} 
                      onClick={() => setExpandedWorkflowId(isExpanded ? null : wf.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.workflowInfo}>
                        <h3 className={styles.workflowName}>
                          <GitMerge size={18} color="var(--accent)" />
                          {wf.name}
                        </h3>
                        <span className={styles.workflowKey}>{wf.key}</span>
                        {envObj && (
                          <span className={`${styles.envTag} ${envTagClass}`}>{envObj.name}</span>
                        )}

                        <div className={styles.badgeGroup}>
                          {activeVersion && (
                            <span
                              className={`${styles.statusBadge} ${
                                activeVersion.status === 'published'
                                  ? styles.statusPublished
                                  : styles.statusDraft
                              }`}
                            >
                              v{activeVersion.version_number} ({activeVersion.status})
                            </span>
                          )}
                          <span className={styles.activeBadge}>
                            {wf.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.actionsRow}>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkflow(wf.id, wf.name);
                          }}
                          title="Delete Workflow"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>


                  </div>
                );

                };

                return (
                  <>
                    {groupEntries.map(({ group, wfs }) => (
                      <div key={group.id} className={styles.groupSection}>
                        <div className={styles.groupSectionHeader}>
                          <h3 className={styles.groupSectionTitle}>
                            <Folder size={18} /> {group.name} <span>({wfs.length})</span>
                          </h3>
                          <div className={styles.groupSectionActions}>
                            <button onClick={() => { setEditingGroupId(group.id); setNewGroupName(group.name); setShowGroupModal(true); }}><Edit size={14} /></button>
                            <button onClick={() => handleDeleteGroup(group.id, group.name)}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className={styles.groupSectionWfs}>
                          {wfs.map(renderWorkflowCard)}
                        </div>
                      </div>
                    ))}

                    <div className={styles.groupSection}>
                        <div className={styles.groupSectionHeader}>
                          <h3 className={styles.groupSectionTitle}>
                            <Folder size={18} /> Default / Ungrouped <span>({defaultWfs.length})</span>
                          </h3>
                        </div>
                        <div className={styles.groupSectionWfs}>
                          {defaultWfs.map(renderWorkflowCard)}
                        </div>
                    </div>
                  </>
                );
              })()}
            </div>

          )}
        </div>
      )}


      {/* Workflow Configuration Modal */}
      {expandedWorkflowId && (() => {
        const wf = filteredWorkflows.find(w => w.id === expandedWorkflowId);
        if (!wf) return null;
        const activeVersionId = selectedVersionIds[wf.id];
        const activeVersion = wf.versions.find((v) => v.id === activeVersionId) || wf.versions[0];
        
        return (
          <div className={modalStyles.backdrop} style={{ zIndex: 9999 }} onClick={(e) => { e.stopPropagation(); setExpandedWorkflowId(null); }}>
            <div 
              className={modalStyles.modal} 
              onClick={(e) => e.stopPropagation()} 
              style={{ width: '90vw', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className={modalStyles.header}>
                <h3 className={modalStyles.title}>
                  <Sliders size={20} color="var(--accent)" />
                  Configure Workflow: {wf.name}
                </h3>
                <button className={modalStyles.closeBtn} onClick={(e) => { e.stopPropagation(); setExpandedWorkflowId(null); }}>
                  <X size={18} />
                </button>
              </div>
              
              <div className={styles.expandedBody} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <div className={styles.versionBar}>
                  <div className={styles.versionTabs}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Versions:
                    </span>
                    {wf.versions
                      .sort((a, b) => a.version_number - b.version_number)
                      .map((v) => {
                        const isSelected = v.id === activeVersionId;
                        let statusClass = styles.statusDraft;
                        if (v.status === 'published') statusClass = styles.statusPublished;
                        if (v.status === 'archived') statusClass = styles.statusArchived;

                        return (
                          <button
                            key={v.id}
                            className={`${styles.versionTab} ${isSelected ? styles.versionTabSelected : ''}`}
                            onClick={() => setSelectedVersionIds((prev) => ({ ...prev, [wf.id]: v.id }))}
                          >
                            <span>v{v.version_number}</span>
                            <span className={`${styles.statusBadge} ${statusClass}`}>{v.status}</span>
                          </button>
                        );
                      })}
                  </div>

                  <div className={styles.versionActions}>
                    <button className={styles.secondaryBtn} onClick={() => handleCreateDraft(wf.id)} title="Create new draft version">
                      <Plus size={14} /> New Draft
                    </button>

                    {activeVersion && activeVersion.status === 'draft' && (
                      <button className={styles.primaryBtn} onClick={() => handlePublishVersion(activeVersion.id)} title="Publish this version">
                        <Send size={14} /> Publish v{activeVersion.version_number}
                      </button>
                    )}
                  </div>
                </div>

                {activeVersion ? (
                  <TemplateEditor
                    versionId={activeVersion.id}
                    audienceRules={activeVersion.audience_rules}
                    workflowName={wf.name}
                    workflowKey={wf.key}
                    onSave={loadWorkflows}
                  />
                ) : (
                  <div style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>
                    No version selected
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* Create Environment Modal */}
      {showEnvModal && (
        <div className={modalStyles.backdrop} onClick={() => setShowEnvModal(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h3 className={modalStyles.title}>
                <Layers size={20} color="var(--accent)" />
                {editingEnvId ? 'Edit Environment Settings' : 'Create New Environment'} ({app.name})
              </h3>
              <button
                className={modalStyles.closeBtn}
                onClick={() => setShowEnvModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEnvironment}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Environment Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. production, staging, live"
                  value={envName}
                  onChange={(e) => setEnvName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Sender Email ID (From Address)</label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="e.g. notifications@cphub.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email Provider API Key (Resend / SMTP)</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder={editingEnvId ? 'Leave blank to keep the current key' : 're_••••••••••••'}
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>In-App Webhook Callback URL</label>
                <input
                  type="url"
                  className={styles.input}
                  placeholder="e.g. https://cphub.com/api/webhooks/notifications"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Webhook HMAC Secret Key</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder={editingEnvId ? 'Leave blank to keep the current secret' : 'Webhook signing secret'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowEnvModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={modalStyles.primaryBtn}
                  disabled={isSubmittingEnv}
                >
                  {isSubmittingEnv ? 'Saving...' : editingEnvId ? 'Save Settings' : 'Create Environment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      {showWfModal && (
        <div className={modalStyles.backdrop} onClick={() => setShowWfModal(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h3 className={modalStyles.title}>
                <GitMerge size={20} color="var(--accent)" />
                Create New Workflow ({app.name})
              </h3>
              <button className={modalStyles.closeBtn} onClick={() => setShowWfModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateWorkflow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Target Environment *</label>
                <select
                  className={styles.modalSelect}
                  value={selectedEnvIdForWf}
                  onChange={(e) => setSelectedEnvIdForWf(e.target.value)}
                  required
                >
                  {app.environments.length === 0 && (
                    <option value="">No environments available. Create an environment first.</option>
                  )}
                  {app.environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Workflow Key * (slug format)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. password-reset, order-confirmation"
                  value={wfKey}
                  onChange={(e) => setWfKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  required
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Display Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Class Rescheduled Notification"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Delivery Priority</label>
                <select
                  className={styles.input}
                  value={wfPriority}
                  onChange={(e) => setWfPriority(e.target.value as 'high' | 'default' | 'low')}
                >
                  <option value="high">🔴 High — critical alerts, auth emails</option>
                  <option value="default">🟡 Default — most notifications</option>
                  <option value="low">⚪ Low — marketing, digests</option>
                </select>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowWfModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={modalStyles.primaryBtn}
                  disabled={isSubmittingWf || !selectedEnvIdForWf}
                >
                  {isSubmittingWf ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Key Modal Popup */}
      {generatedKeyInfo && (
        <ApiKeyModal
          apiKey={generatedKeyInfo.key}
          environmentName={generatedKeyInfo.envName}
          onClose={() => setGeneratedKeyInfo(null)}
        />
      )}

      {/* Create / Edit Group Modal */}
      {showGroupModal && (
        <div className={modalStyles.backdrop} onClick={() => setShowGroupModal(false)}>
          <div className={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h3 className={modalStyles.title}>
                <Folder size={20} color="var(--accent)" />
                {editingGroupId ? 'Edit Group' : 'Create New Group'} ({app?.name})
              </h3>
              <button className={modalStyles.closeBtn} onClick={() => setShowGroupModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveGroup}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Group Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Classes, Payments"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowGroupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={modalStyles.primaryBtn} disabled={isSubmittingGroup}>
                  {isSubmittingGroup ? 'Saving...' : 'Save Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
