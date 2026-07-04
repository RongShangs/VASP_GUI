export interface ServerNode {
  id: number;
  alias: string;
  host: string;
  port: number;
  username: string;
  auth_type: string;
  has_password: boolean;
  created_at: string | null;
}

export interface ConnectionStatus {
  alias: string;
  connected: boolean;
  home?: string;
  error?: string;
}
