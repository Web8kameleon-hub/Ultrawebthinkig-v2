export type AlbaMedSource = 'ollama' | 'clisonix' | 'none';

export type AlbaMedAgentId =
  | 'triage'
  | 'diagnostics'
  | 'therapy'
  | 'safety'
  | 'guidelines';

export interface AlbaMedRequest {
  message: string;
  language?: 'sq' | 'en' | 'mixed' | string;
  modules?: string[];
  context?: string[];
  useCloud?: boolean;
  chunkSize?: number;
}

export interface AlbaMedSearchHit {
  sourceId: string;
  sourceLabel: string;
  content: string;
  confidence: number;
  latencyMs: number;
}

export interface AlbaMedProviderResult {
  text: string;
  source: AlbaMedSource;
  confidence: number;
  tokens?: number;
}

export interface AlbaMedAgentResult {
  agentId: AlbaMedAgentId;
  title: string;
  text: string;
  source: AlbaMedSource;
  confidence: number;
}

export interface AlbaMedEngineResult {
  summary: string;
  source: AlbaMedSource;
  confidence: number;
  agentResults: AlbaMedAgentResult[];
  searchHits: AlbaMedSearchHit[];
  approval: AlbaMedApprovalResult;
  thinkingTime: number;
}

export type AlbaMedReviewerId = 'asi' | 'alba' | 'albi' | 'jona';

export interface AlbaMedReviewerDecision {
  reviewer: AlbaMedReviewerId;
  approved: boolean;
  confidence: number;
  notes: string;
}

export interface AlbaMedApprovalResult {
  approved: boolean;
  requiredVotes: number;
  receivedVotes: number;
  avgConfidence: number;
  decisions: AlbaMedReviewerDecision[];
}
