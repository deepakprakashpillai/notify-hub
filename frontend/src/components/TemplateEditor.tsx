import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './TemplateEditor.module.css';
import {
  Mail,
  Bell,
  Save,
  Check,
  Eye,
  Code,
  AlertCircle,
  Plus,
  Send,
  GitMerge,
  Settings,
  Trash2,
  Variable,
  Users
} from 'lucide-react';
import {
  type AudienceRuleResponse,
  type WorkflowVersionResponse,
  type VariableDefinition,
  createOrUpdateTemplate,
  updateWorkflowVersion,
  createAudienceRule,
  updateAudienceRule
} from '../api/workflows';
import { renderJinjaTemplate } from '../utils/jinja';

export interface TemplateEditorProps {
  versionId: string;
  audienceRules: AudienceRuleResponse[];
  workflowName?: string;
  workflowKey?: string;
  versions?: WorkflowVersionResponse[];
  activeVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
  onCreateDraft?: () => void;
  onPublishVersion?: (versionId: string) => void;
  onSave?: () => void;
}

type EditorTab = 'settings' | 'email' | 'in_app';

function buildPayloadFromVariables(variables: VariableDefinition[]): Record<string, string> {
  const obj: Record<string, string> = {};
  variables.forEach((v) => {
    if (v.example) {
      obj[v.name] = v.example;
    }
  });
  return obj;
}

function inAppDataSchema(workflowKey?: string) {
  if (workflowKey?.startsWith('booking.') || workflowKey === 'class.reminder_1h') {
    return {
      class_id: 'string',
      booking_id: 'string',
      teacher_name: 'string | null',
      student_name: 'string | null',
      starts_at: 'ISO 8601 UTC datetime',
      ends_at: 'ISO 8601 UTC datetime',
    };
  }
  const schemas: Record<string, Record<string, string>> = {
    'access.granted': { student_id: 'string', grant_id: 'string', access_starts_at: 'ISO 8601 UTC datetime', access_ends_at: 'ISO 8601 UTC datetime', duration_days: 'integer', package_name: 'string | null' },
    'access.expiring_7d': { student_id: 'string', access_ends_at: 'ISO 8601 UTC datetime', days_remaining: 'integer' },
    'access.expiring_1d': { student_id: 'string', access_ends_at: 'ISO 8601 UTC datetime', days_remaining: 'integer' },
    'access.expired': { student_id: 'string', access_ends_at: 'ISO 8601 UTC datetime' },
    'payment.recorded': { student_id: 'string', payment_id: 'string', amount_minor: 'integer', currency: 'string', payment_method: 'string', paid_at: 'ISO 8601 UTC datetime', package_name: 'string | null' },
    'payment.updated': { student_id: 'string', payment_id: 'string', amount_minor: 'integer', currency: 'string', payment_method: 'string', paid_at: 'ISO 8601 UTC datetime', package_name: 'string | null' },
    'payment.removed': { student_id: 'string', payment_id: 'string', amount_minor: 'integer', currency: 'string', payment_method: 'string', paid_at: 'ISO 8601 UTC datetime', package_name: 'string | null' },
    'student.status_changed': { student_id: 'string', previous_status: 'string', current_status: 'string' },
    'student.teacher_assignment_changed': { student_id: 'string', teacher_id: 'string | null', teacher_name: 'string | null', assignment_status: 'assigned | removed' },
    'teacher.student_assignment_changed': { student_id: 'string', student_name: 'string', teacher_id: 'string' },
    'student.teacher_assignment_removed': { student_id: 'string', teacher_id: 'string', teacher_name: 'string | null' },
    'student.program_changed': { student_id: 'string', previous_program: 'string', current_program: 'string', affected_booking_count: 'integer' },
    'teacher.profile_paused': { teacher_id: 'string', teacher_name: 'string', affected_student_count: 'integer' },
    'account.email_changed': { user_id: 'string', previous_email: 'string', current_email: 'string' },
    'account.status_changed': { user_id: 'string', previous_status: 'active | inactive', current_status: 'active | inactive' },
    'feedback.published': { feedback_id: 'string', booking_id: 'string', class_id: 'string', teacher_name: 'string | null', starts_at: 'ISO 8601 UTC datetime' },
  };
  return schemas[workflowKey ?? ''] ?? { event_type: 'string', entity: '{ type: string, id: string }' };
}

export default function TemplateEditor({
  versionId,
  audienceRules,
  workflowName,
  workflowKey,
  versions,
  activeVersionId,
  onSelectVersion,
  onCreateDraft,
  onPublishVersion,
  onSave,
}: TemplateEditorProps) {
  // ── Version & Overall Schema ───────────────────────────────────────────────────
  const currentVersion = versions?.find((v) => v.id === (activeVersionId || versionId)) ?? {
    id: versionId,
    workflow_id: 'unknown',
    version_number: 1,
    status: 'draft',
    variables_schema: [],
    audience_rules: audienceRules || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  const isReadOnly = currentVersion.status === 'published';

  const [variables, setVariables] = useState<VariableDefinition[]>(
    (currentVersion.variables_schema as VariableDefinition[] | null) ?? []
  );

  // ── Audience Selection ────────────────────────────────────────────────────────
  const resolvedAudienceRules = currentVersion.audience_rules || [];
  const [activeAudienceId, setActiveAudienceId] = useState<string | null>(
    resolvedAudienceRules.length > 0 ? resolvedAudienceRules[0].id : null
  );

  const activeAudienceRule = useMemo(
    () => resolvedAudienceRules.find((r) => r.id === activeAudienceId) || resolvedAudienceRules[0],
    [resolvedAudienceRules, activeAudienceId]
  );

  const [newAudienceKey, setNewAudienceKey] = useState<string>('');
  const [isAddingAudience, setIsAddingAudience] = useState(false);

  // ── Active editor tab ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<EditorTab>('settings');

  // ── Audience-Specific Settings & Templates ──────────────────────────────────
  const [enabledChannels, setEnabledChannels] = useState<string[]>([]);
  
  // Email state
  const [subject, setSubject] = useState<string>('');
  const [htmlBody, setHtmlBody] = useState<string>('');
  const [textBody, setTextBody] = useState<string>('');

  // In-App state
  const [actionLabel, setActionLabel] = useState<string>('');
  const [actionUrl, setActionUrl] = useState<string>('');

  // ── Save / status state ─────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // ── Test payload JSON state ─────────────────────────────────────────────────
  const [testPayloadJson, setTestPayloadJson] = useState<string>('{}');
  const [parsedPayload, setParsedPayload] = useState<Record<string, any>>({});
  const [newVarName, setNewVarName] = useState<string>('');

  // ── Reset basic version state ────────────────────────────────────────────────
  useEffect(() => {
    const ver = versions?.find((v) => v.id === (activeVersionId || versionId));
    if (ver) {
      setVariables((ver.variables_schema as VariableDefinition[] | null) ?? []);
      if (ver.audience_rules && ver.audience_rules.length > 0) {
        if (!ver.audience_rules.find(ar => ar.id === activeAudienceId)) {
          setActiveAudienceId(ver.audience_rules[0].id);
        }
      } else {
        setActiveAudienceId(null);
      }
    }
  }, [activeVersionId, versionId, versions]);

  // ── Load state for Active Audience ───────────────────────────────────────────
  useEffect(() => {
    if (activeAudienceRule) {
      setEnabledChannels(activeAudienceRule.channels || []);
      
      const emailTmpl = activeAudienceRule.templates?.find((t) => t.channel === 'email');
      setSubject(emailTmpl?.subject || '');
      setHtmlBody(emailTmpl?.html_body || '');
      setTextBody(emailTmpl?.text_body || '');

      const inAppTmpl = activeAudienceRule.templates?.find((t) => t.channel === 'in_app');
      setActionLabel(inAppTmpl?.action_label || '');
      setActionUrl(inAppTmpl?.action_url || '');
    } else {
      setEnabledChannels([]);
      setSubject(''); setHtmlBody(''); setTextBody('');
      setActionLabel(''); setActionUrl('');
    }
  }, [activeAudienceRule]);

  // ── Payload handling ─────────────────────────────────────────────────────────
  const regeneratePayload = useCallback((vars: VariableDefinition[]) => {
    const built = buildPayloadFromVariables(vars);
    if (Object.keys(built).length > 0) {
      setTestPayloadJson(JSON.stringify(built, null, 2));
    }
  }, []);

  useEffect(() => {
    try {
      const obj = JSON.parse(testPayloadJson);
      setParsedPayload(obj);
    } catch (err: any) {
      // Ignore JSON syntax errors while typing
    }
  }, [testPayloadJson]);

  // ── Variable management ──────────────────────────────────────────────────────
  const addVariable = () => {
    const name = newVarName.trim().replace(/\s+/g, '_');
    if (!name || variables.some((v) => v.name === name)) return;
    const newVars = [...variables, { name, description: '', required: true, example: '' }];
    setVariables(newVars);
    setNewVarName('');
  };

  const updateVariable = (index: number, field: keyof VariableDefinition, value: any) => {
    const updated = variables.map((v, i) => i === index ? { ...v, [field]: value } : v);
    setVariables(updated);
  };

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Audience Management ──────────────────────────────────────────────────────
  const handleAddAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAudienceKey.trim() || isReadOnly) return;
    try {
      setIsAddingAudience(true);
      const res = await createAudienceRule(currentVersion.id, {
        audience_key: newAudienceKey.toLowerCase().replace(/[\s-]+/g, '_'),
        channels: ['in_app'],
      });
      setActiveAudienceId(res.id);
      setNewAudienceKey('');
      if (onSave) onSave();
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Failed to create audience');
    } finally {
      setIsAddingAudience(false);
    }
  };

  // ── Saving Settings (Variables & Channels) ──────────────────────────────────
  const handleSaveSettings = async () => {
    if (isReadOnly) return;
    try {
      setIsSavingSettings(true);
      setSettingsError(null);
      
      // Update variables on the version
      await updateWorkflowVersion(currentVersion.id, {
        variables_schema: variables,
      });

      // Update channels on the specific active audience
      if (activeAudienceRule) {
        await updateAudienceRule(activeAudienceRule.id, {
          channels: enabledChannels,
        });
      }

      setSettingsSaveSuccess(true);
      regeneratePayload(variables);
      if (onSave) onSave();
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to save version settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ── Save templates ───────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!activeAudienceRule) return;
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      setErrorMessage(null);

      const saves: Promise<any>[] = [];
      if (enabledChannels.includes('email')) {
        saves.push(
          createOrUpdateTemplate(activeAudienceRule.id, {
            channel: 'email',
            subject: subject.trim(),
            html_body: htmlBody,
            text_body: textBody,
          })
        );
      }
      if (enabledChannels.includes('in_app')) {
        saves.push(
          createOrUpdateTemplate(activeAudienceRule.id, {
            channel: 'in_app',
            action_label: actionLabel.trim(),
            action_url: actionUrl.trim(),
          })
        );
      }

      await Promise.all(saves);
      setSaveSuccess(true);
      if (onSave) onSave();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save templates');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setEnabledChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  // ── Live preview values ──────────────────────────────────────────────────────
  const renderedSubject = renderJinjaTemplate(subject, parsedPayload);
  const renderedHtml = renderJinjaTemplate(htmlBody, parsedPayload);
  const renderedActionLabel = renderJinjaTemplate(actionLabel, parsedPayload);
  const renderedActionUrl = renderJinjaTemplate(actionUrl, parsedPayload);

  return (
    <div className={styles.editorContainer}>
      {/* ── Workflow Header Banner ─────────────────────────────────────────── */}
      <div className={styles.bannerHeader}>
        <div className={styles.workflowInfo}>
          <span className={styles.workflowBadge}>
            <GitMerge size={14} /> Workflow
          </span>
          {workflowName && <span className={styles.workflowTitle}>{workflowName}</span>}
          {workflowKey && <span className={styles.workflowKey}>{workflowKey}</span>}
          {isReadOnly && (
            <span className={styles.readOnlyBadge}>Published — Read Only</span>
          )}
        </div>

        <div className={styles.headerActions}>
          {versions && versions.length > 0 && onSelectVersion && (
            <div className={styles.versionSelectGroup}>
              <span className={styles.versionLabel}>Version:</span>
              <select
                className={styles.versionSelect}
                value={activeVersionId || versionId}
                onChange={(e) => onSelectVersion(e.target.value)}
              >
                {versions
                  .slice()
                  .sort((a, b) => b.version_number - a.version_number)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version_number} ({v.status})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {onCreateDraft && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={onCreateDraft}
            >
              <Plus size={14} /> New Draft
            </button>
          )}

          {onPublishVersion && currentVersion.status === 'draft' && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={() => onPublishVersion(currentVersion.id)}
            >
              <Send size={14} /> Publish v{currentVersion.version_number}
            </button>
          )}
        </div>
      </div>

      <div className={styles.editorLayout} style={{ flexDirection: 'row', display: 'flex', gap: '1rem' }}>
        {/* ── Left Sidebar: Audience Selection ────────────────────────────── */}
        <div className={styles.sidebarPane}>
          <div className={styles.paneHeader}>
            <div className={styles.paneTitle}>
              <Users size={16} color="var(--accent)" />
              Audiences
            </div>
          </div>
          
          <div className={styles.audienceList}>
            {resolvedAudienceRules.map((rule) => (
              <button
                key={rule.id}
                className={`${styles.audienceItem} ${activeAudienceId === rule.id ? styles.audienceItemActive : ''}`}
                onClick={() => setActiveAudienceId(rule.id)}
              >
                {rule.audience_key}
              </button>
            ))}
          </div>

          {!isReadOnly && (
            <form className={styles.audienceAddForm} onSubmit={handleAddAudience}>
              <input 
                type="text" 
                className={styles.audienceAddInput} 
                placeholder="New audience (e.g. parent)" 
                value={newAudienceKey}
                onChange={(e) => setNewAudienceKey(e.target.value)}
                disabled={isAddingAudience}
              />
              <button 
                type="submit"
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={!newAudienceKey.trim() || isAddingAudience}
                title="Add Audience"
              >
                <Plus size={14} />
              </button>
            </form>
          )}
        </div>

        {/* ── Middle Pane: Configuration & Templates ──────────────────────── */}
        <div className={styles.pane} style={{ flex: 1.5 }}>
          <div className={styles.paneHeader}>
            <div className={styles.paneTitle}>
              <Code size={16} color="var(--accent)" />
              {activeAudienceRule ? `Configure: ${activeAudienceRule.audience_key}` : 'Configuration'}
            </div>

            <div className={styles.channelTabs}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={14} /> Settings
              </button>
              {enabledChannels.includes('email') && (
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'email' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('email')}
                >
                  <Mail size={14} /> Email
                </button>
              )}
              {enabledChannels.includes('in_app') && (
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'in_app' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('in_app')}
                >
                  <Bell size={14} /> In-App
                </button>
              )}
            </div>
          </div>

          {!activeAudienceRule ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {resolvedAudienceRules.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '4rem 0' }}>
                  <Users size={48} style={{ opacity: 0.2 }} />
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>No audiences configured</h3>
                  <p style={{ margin: 0, maxWidth: '400px', lineHeight: 1.5 }}>
                    Add an audience such as student, teacher, or admin to begin configuring this workflow.
                  </p>
                </div>
              ) : (
                "Select an audience to configure."
              )}
            </div>
          ) : (
            <>
              {/* ── SETTINGS TAB ────────────────────────────────────────────── */}
              {activeTab === 'settings' && (
                <>
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsSectionTitle}>
                      <Bell size={14} /> Channels for "{activeAudienceRule.audience_key}"
                    </div>
                    <p className={styles.settingsHint}>
                      Enable which channels should be sent when delivering to this audience.
                    </p>
                    <div className={styles.channelToggles}>
                      {(['email', 'in_app'] as const).map((ch) => {
                        const on = enabledChannels.includes(ch);
                        return (
                          <label key={ch} className={`${styles.channelToggle} ${on ? styles.channelToggleOn : ''}`}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => !isReadOnly && toggleChannel(ch)}
                              disabled={isReadOnly}
                            />
                            <span className={styles.toggleIcon}>
                              {ch === 'email' ? <Mail size={16} /> : <Bell size={16} />}
                            </span>
                            <span className={styles.toggleLabel}>
                              {ch === 'email' ? 'Email' : 'In-App Webhook'}
                            </span>
                            <span className={`${styles.toggleStatus} ${on ? styles.toggleStatusOn : ''}`}>
                              {on ? 'Enabled' : 'Disabled'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.settingsSection}>
                    <div className={styles.settingsSectionTitle}>
                      <Variable size={14} /> Global Payload Variables
                    </div>
                    <p className={styles.settingsHint}>
                      Variables are shared across all audiences in this workflow version.
                    </p>
                    
                    {variables.length > 0 && (
                      <div className={styles.variableList}>
                        <div className={styles.variableHeader}>
                          <span>Name</span>
                          <span>Example</span>
                          <span>Required</span>
                          <span></span>
                        </div>
                        {variables.map((v, idx) => (
                          <div key={idx} className={styles.variableRow}>
                            <div className={styles.varNameCell}>
                              <code className={styles.varNameCode}>{`{{ ${v.name} }}`}</code>
                              <input
                                className={styles.varDescInput}
                                placeholder="Description (optional)"
                                value={v.description ?? ''}
                                onChange={(e) => updateVariable(idx, 'description', e.target.value)}
                                disabled={isReadOnly}
                              />
                            </div>
                            <input
                              className={styles.varExampleInput}
                              placeholder="e.g. John Doe"
                              value={v.example ?? ''}
                              onChange={(e) => updateVariable(idx, 'example', e.target.value)}
                              disabled={isReadOnly}
                            />
                            <label className={styles.varRequiredLabel}>
                              <input
                                type="checkbox"
                                checked={v.required}
                                onChange={(e) => updateVariable(idx, 'required', e.target.checked)}
                                disabled={isReadOnly}
                              />
                              Required
                            </label>
                            {!isReadOnly && (
                              <button
                                type="button"
                                className={styles.varRemoveBtn}
                                onClick={() => removeVariable(idx)}
                                title="Remove variable"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!isReadOnly && (
                      <div className={styles.addVariableRow}>
                        <input
                          className={styles.varNameInput}
                          placeholder="variable_name (e.g. student_name)"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value.toLowerCase().replace(/[\s-]+/g, '_'))}
                          onKeyDown={(e) => e.key === 'Enter' && addVariable()}
                        />
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          onClick={addVariable}
                          disabled={!newVarName.trim()}
                        >
                          <Plus size={14} /> Add Variable
                        </button>
                      </div>
                    )}
                  </div>

                  {settingsError && (
                    <div className={styles.errorMsg}>
                      <AlertCircle size={14} /> {settingsError}
                    </div>
                  )}

                  {!isReadOnly && (
                    <div className={styles.saveRow}>
                      {settingsSaveSuccess && (
                        <span className={styles.successMsg}>
                          <Check size={16} /> Saved!
                        </span>
                      )}
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                      >
                        <Save size={15} />
                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── EMAIL TAB ──────────────────────────────────────────────── */}
              {activeTab === 'email' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <span>Subject Line</span>
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <span>HTML Body</span>
                    </label>
                    <textarea
                      className={`${styles.textarea} ${styles.codeArea}`}
                      rows={8}
                      value={htmlBody}
                      onChange={(e) => setHtmlBody(e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <span>Text Body</span>
                    </label>
                    <textarea
                      className={`${styles.textarea} ${styles.codeArea}`}
                      rows={4}
                      value={textBody}
                      onChange={(e) => setTextBody(e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>

                  {errorMessage && <div className={styles.errorMsg}><AlertCircle size={14} /> {errorMessage}</div>}
                  {!isReadOnly && (
                    <div className={styles.saveRow}>
                      {saveSuccess && <span className={styles.successMsg}><Check size={16} /> Saved!</span>}
                      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveDraft} disabled={isSaving}>
                        <Save size={15} /> {isSaving ? 'Saving...' : 'Save Draft'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── IN-APP TAB ─────────────────────────────────────────────── */}
              {activeTab === 'in_app' && (
                <>
                  <p className={styles.settingsHint}>
                    CP Hub renders in-app copy and styling. Notify-Hub sends this workflow's data and CTA.
                  </p>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <span>Action Button Label</span>
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      value={actionLabel}
                      onChange={(e) => setActionLabel(e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <span>Action URL</span>
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      value={actionUrl}
                      onChange={(e) => setActionUrl(e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>

                  {errorMessage && <div className={styles.errorMsg}><AlertCircle size={14} /> {errorMessage}</div>}
                  {!isReadOnly && (
                    <div className={styles.saveRow}>
                      {saveSuccess && <span className={styles.successMsg}><Check size={16} /> Saved!</span>}
                      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSaveDraft} disabled={isSaving}>
                        <Save size={15} /> {isSaving ? 'Saving...' : 'Save Draft'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Right Pane: Live Preview ────────────────────────────────────── */}
        <div className={styles.pane} style={{ flex: 1 }}>
          <div className={styles.paneHeader}>
            <div className={styles.paneTitle}>
              <Eye size={16} color="#10b981" /> Preview
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <span>Test Payload JSON</span>
              {variables.length > 0 && (
                <button
                  type="button"
                  className={styles.syncPayloadBtn}
                  onClick={() => regeneratePayload(variables)}
                >
                  ↻ Sync
                </button>
              )}
            </label>
            <textarea
              className={`${styles.textarea} ${styles.codeArea} ${styles.jsonArea}`}
              value={testPayloadJson}
              onChange={(e) => setTestPayloadJson(e.target.value)}
            />
          </div>

          <div className={styles.previewContainer}>
            {activeTab === 'email' ? (
              <>
                <div className={styles.previewSubject}>
                  <strong>Subject:</strong> {renderedSubject || <em style={{opacity: 0.5}}>Empty</em>}
                </div>
                <div className={styles.previewHtml} dangerouslySetInnerHTML={{__html: renderedHtml || '<p>No HTML body</p>'}} />
              </>
            ) : activeTab === 'in_app' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  In-app payload sent to the target application:
                </div>
                <pre className={styles.inAppPayload}>{JSON.stringify({
                  workflow_key: workflowKey ?? null,
                  content: {
                    data: inAppDataSchema(workflowKey),
                    action_label: renderedActionLabel || null,
                    action_url: renderedActionUrl || null,
                  },
                }, null, 2)}</pre>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  Variables are used for all templates. Use {'{{ var_name }}'}.
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export const WorkflowEditor = TemplateEditor;
