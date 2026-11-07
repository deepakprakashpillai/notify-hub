import { request } from './client';

export interface TemplateResponse {
  id: string;
  audience_rule_id: string;
  channel: 'email' | 'in_app' | string;
  subject: string | null;
  html_body: string | null;
  text_body: string | null;
  in_app_title: string | null;
  in_app_body: string | null;
  action_label: string | null;
  action_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudienceRuleResponse {
  id: string;
  version_id: string;
  audience_key: string;
  channels: string[];
  priority: 'high' | 'default' | 'low';
  templates: TemplateResponse[];
  created_at: string;
  updated_at: string;
}

export interface VariableDefinition {
  name: string;
  description?: string | null;
  required: boolean;
  example?: string | null;
}

export interface WorkflowVersionResponse {
  id: string;
  workflow_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'archived' | string;
  variables_schema: VariableDefinition[] | null;
  audience_rules: AudienceRuleResponse[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowResponse {
  id: string;
  environment_id: string;
  group_id: string | null;
  key: string;
  name: string;
  is_active: boolean;
  priority: 'high' | 'default' | 'low';
  versions: WorkflowVersionResponse[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowCreate {
  environment_id: string;
  group_id?: string | null;
  key: string;
  name: string;
  is_active?: boolean;
  priority?: 'high' | 'default' | 'low';
}

export interface WorkflowUpdate {
  group_id?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  priority?: 'high' | 'default' | 'low' | null;
}

export interface WorkflowVersionCreate {
  variables_schema?: VariableDefinition[] | null;
}

export interface WorkflowVersionUpdate {
  variables_schema?: VariableDefinition[] | null;
}

export interface AudienceRuleCreate {
  audience_key: string;
  channels?: string[];
  priority?: 'high' | 'default' | 'low';
}

export interface AudienceRuleUpdate {
  audience_key?: string | null;
  channels?: string[] | null;
  priority?: 'high' | 'default' | 'low' | null;
}

export interface TemplateCreate {
  channel: string;
  subject?: string | null;
  html_body?: string | null;
  text_body?: string | null;
  in_app_title?: string | null;
  in_app_body?: string | null;
  action_label?: string | null;
  action_url?: string | null;
}

export interface TemplateUpdate {
  channel?: string | null;
  subject?: string | null;
  html_body?: string | null;
  text_body?: string | null;
  in_app_title?: string | null;
  in_app_body?: string | null;
  action_label?: string | null;
  action_url?: string | null;
}

export async function getWorkflows(environmentId?: string): Promise<WorkflowResponse[]> {
  const query = environmentId ? `?environment_id=${encodeURIComponent(environmentId)}` : '';
  return request<WorkflowResponse[]>(`/workflows${query}`);
}

export async function getWorkflow(id: string): Promise<WorkflowResponse> {
  return request<WorkflowResponse>(`/workflows/${id}`);
}

export async function createWorkflow(data: WorkflowCreate): Promise<WorkflowResponse> {
  return request<WorkflowResponse>('/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWorkflow(id: string, data: WorkflowUpdate): Promise<WorkflowResponse> {
  return request<WorkflowResponse>(`/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  return request<void>(`/workflows/${id}`, {
    method: 'DELETE',
  });
}

export async function createWorkflowVersion(
  workflowId: string,
  data?: WorkflowVersionCreate
): Promise<WorkflowVersionResponse> {
  return request<WorkflowVersionResponse>(`/workflows/${workflowId}/versions`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

export async function updateWorkflowVersion(
  versionId: string,
  data: WorkflowVersionUpdate
): Promise<WorkflowVersionResponse> {
  return request<WorkflowVersionResponse>(`/versions/${versionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function listWorkflowVersions(workflowId: string): Promise<WorkflowVersionResponse[]> {
  return request<WorkflowVersionResponse[]>(`/workflows/${workflowId}/versions`);
}

export async function publishWorkflowVersion(versionId: string): Promise<WorkflowVersionResponse> {
  return request<WorkflowVersionResponse>(`/versions/${versionId}/publish`, {
    method: 'POST',
  });
}

export async function createAudienceRule(
  versionId: string,
  data: AudienceRuleCreate
): Promise<AudienceRuleResponse> {
  return request<AudienceRuleResponse>(`/versions/${versionId}/audiences`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAudienceRule(
  audienceId: string,
  data: AudienceRuleUpdate
): Promise<AudienceRuleResponse> {
  return request<AudienceRuleResponse>(`/audiences/${audienceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAudienceRule(audienceId: string): Promise<void> {
  return request<void>(`/audiences/${audienceId}`, {
    method: 'DELETE',
  });
}

export async function createOrUpdateTemplate(
  audienceId: string,
  data: TemplateCreate
): Promise<TemplateResponse> {
  return request<TemplateResponse>(`/audiences/${audienceId}/templates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listTemplatesForAudience(audienceId: string): Promise<TemplateResponse[]> {
  return request<TemplateResponse[]>(`/audiences/${audienceId}/templates`);
}

export async function updateTemplate(templateId: string, data: TemplateUpdate): Promise<TemplateResponse> {
  return request<TemplateResponse>(`/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Workflow Groups ──────────────────────────────────────────────────────────

export interface WorkflowGroupResponse {
  id: string;
  environment_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowGroupCreate {
  name: string;
  description?: string;
  sort_order?: number;
}

export interface WorkflowGroupUpdate {
  name?: string;
  description?: string;
  sort_order?: number;
}

export async function createWorkflowGroup(environmentId: string, payload: WorkflowGroupCreate): Promise<WorkflowGroupResponse> {
  return request(`/environments/${environmentId}/groups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getWorkflowGroups(environmentId: string): Promise<WorkflowGroupResponse[]> {
  return request(`/environments/${environmentId}/groups`);
}

export async function updateWorkflowGroup(groupId: string, payload: WorkflowGroupUpdate): Promise<WorkflowGroupResponse> {
  return request(`/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkflowGroup(groupId: string): Promise<void> {
  return request(`/groups/${groupId}`, {
    method: 'DELETE',
  });
}
