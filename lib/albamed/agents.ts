import { AlbaMedAgentId, AlbaMedReviewerId } from './types';

export interface AlbaMedAgentDefinition {
  id: AlbaMedAgentId;
  title: string;
  titleSq: string;
  prompt: string;
}

export const ALBAMED_AGENTS: AlbaMedAgentDefinition[] = [
  {
    id: 'triage',
    title: 'Triage Agent',
    titleSq: 'Agjenti i Triagjimit',
    prompt: 'Classify urgency, red flags, and immediate steps. Keep concise and clinically safe.',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics Agent',
    titleSq: 'Agjenti Diagnostik',
    prompt: 'Provide likely differential diagnosis and rationale based on symptoms only.',
  },
  {
    id: 'therapy',
    title: 'Therapy Agent',
    titleSq: 'Agjenti i Terapisë',
    prompt: 'Suggest evidence-based supportive care and practical next actions.',
  },
  {
    id: 'safety',
    title: 'Safety Agent',
    titleSq: 'Agjenti i Sigurisë',
    prompt: 'Focus on contraindications, warning signs, and when to seek emergency care.',
  },
  {
    id: 'guidelines',
    title: 'Guidelines Agent',
    titleSq: 'Agjenti i Udhëzimeve',
    prompt: 'Summarize guideline-aligned recommendations with transparent uncertainty.',
  },
];

export function selectAgents(modules?: string[]): AlbaMedAgentDefinition[] {
  const selectedModules = modules || [];
  if (selectedModules.length === 0 || selectedModules.includes('asi-medical')) {
    return ALBAMED_AGENTS;
  }
  return ALBAMED_AGENTS.filter((agent) => agent.id !== 'guidelines');
}

export interface AlbaMedReviewerDefinition {
  id: AlbaMedReviewerId;
  title: string;
  prompt: string;
}

export const ALBAMED_REVIEWERS: AlbaMedReviewerDefinition[] = [
  {
    id: 'asi',
    title: 'ASI Chief Reviewer',
    prompt: 'Evaluate if the output is medically safe, useful, and not overconfident. Return strict approval only if safe.',
  },
  {
    id: 'alba',
    title: 'ALBA Clinical Reviewer',
    prompt: 'Evaluate Albanian clinical clarity, practical applicability, and caution language for patients.',
  },
  {
    id: 'albi',
    title: 'ALBI Analytical Reviewer',
    prompt: 'Evaluate analytical consistency, missing contradictions, and guideline alignment.',
  },
  {
    id: 'jona',
    title: 'JONA Human-Care Reviewer',
    prompt: 'Evaluate empathy, readability, and whether user can act safely from recommendations.',
  },
];
