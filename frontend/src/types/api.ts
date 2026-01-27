export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface TaskResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tool_type: string;
  created_at: string;
  completed_at?: string;
  file_name?: string;
  file_size?: number;
  download_url?: string;
  expires_at?: string;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  download_url?: string;
  error_message?: string;
}
