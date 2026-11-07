import { request } from './client';

export interface DeliveryAttemptResponse {
  id: string;
  job_id: string;
  recipient_id: string;
  channel: string;
  status: 'pending' | 'success' | 'failed' | 'dead_letter' | string;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationJobResponse {
  id: string;
  environment_id: string;
  event_id: string;
  workflow_key: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  occurred_at: string | null;
  deliveries: DeliveryAttemptResponse[];
  created_at: string;
  updated_at: string;
}

export interface MonitoringListResponse {
  total: number;
  items: NotificationJobResponse[];
}

export interface MonitoringFilters {
  environment_id?: string;
  workflow_key?: string;
  status?: string;
  event_id?: string;
  limit?: number;
  offset?: number;
}

export async function getNotificationJobs(
  filters: MonitoringFilters = {}
): Promise<MonitoringListResponse> {
  const params = new URLSearchParams();
  if (filters.environment_id) params.set('environment_id', filters.environment_id);
  if (filters.workflow_key) params.set('workflow_key', filters.workflow_key);
  if (filters.status) params.set('status', filters.status);
  if (filters.event_id) params.set('event_id', filters.event_id);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));

  const query = params.toString() ? `?${params.toString()}` : '';
  return request<MonitoringListResponse>(`/monitoring/jobs${query}`);
}
