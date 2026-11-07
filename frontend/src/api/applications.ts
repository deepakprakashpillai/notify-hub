import { request } from './client';

export interface EnvironmentResponse {
  id: string;
  application_id: string;
  name: string;
  has_api_key: boolean;
  webhook_url: string | null;
  has_webhook_secret: boolean;
  sender_email: string | null;
  has_resend_api_key: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationResponse {
  id: string;
  name: string;
  description: string | null;
  environments: EnvironmentResponse[];
  created_at: string;
  updated_at: string;
}

export interface ApplicationCreate {
  name: string;
  description?: string | null;
}

export interface ApplicationUpdate {
  name?: string | null;
  description?: string | null;
}

export interface EnvironmentCreate {
  name: string;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  sender_email?: string | null;
  resend_api_key?: string | null;
}

export interface EnvironmentUpdate {
  name?: string | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  sender_email?: string | null;
  resend_api_key?: string | null;
}

export interface ApiKeyCreateResponse {
  raw_key: string;
  environment_id: string;
  created_at: string;
}

export async function getApplications(): Promise<ApplicationResponse[]> {
  return request<ApplicationResponse[]>('/applications');
}

export async function getApplication(id: string): Promise<ApplicationResponse> {
  return request<ApplicationResponse>(`/applications/${id}`);
}

export async function createApplication(data: ApplicationCreate): Promise<ApplicationResponse> {
  return request<ApplicationResponse>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApplication(id: string, data: ApplicationUpdate): Promise<ApplicationResponse> {
  return request<ApplicationResponse>(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${id}`, {
    method: 'DELETE',
  });
}

export async function createEnvironment(appId: string, data: EnvironmentCreate): Promise<EnvironmentResponse> {
  return request<EnvironmentResponse>(`/applications/${appId}/environments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEnvironment(envId: string, data: EnvironmentUpdate): Promise<EnvironmentResponse> {
  return request<EnvironmentResponse>(`/environments/${envId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function generateApiKey(envId: string): Promise<ApiKeyCreateResponse> {
  return request<ApiKeyCreateResponse>(`/environments/${envId}/api-keys`, {
    method: 'POST',
  });
}
