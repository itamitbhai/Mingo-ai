export interface IGitHubStatus {
  connected: boolean;
  username?: string;
  email?: string;
  avatarUrl?: string;
  scopes?: string[];
  status?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface IGitHubRepository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  updatedAt: string | null;
  owner: { login: string; avatarUrl: string };
}

export interface IGitHubRepositoryList {
  items: IGitHubRepository[];
  page: number;
  limit: number;
}

export interface IGitHubBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}
