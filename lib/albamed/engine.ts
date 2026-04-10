import { ALBAMED_AGENTS, ALBAMED_REVIEWERS, selectAgents } from './agents';
import { albaMedCore } from './core';
import { aggregateConfidence, normalizeLanguage, pickBestSource, searchEverywherePossible, splitIntoChunks } from './helpers';
import {
  AlbaMedAgentResult,
  AlbaMedApprovalResult,
  AlbaMedEngineResult,
  AlbaMedRequest,
  AlbaMedReviewerDecision,
} from './types';
import { computeApproval } from '../runtime/moduleApproval';

export class AlbaMedEngine {
  async run(request: AlbaMedRequest): Promise<AlbaMedEngineResult> {
    const startedAt = Date.now();
    const language = normalizeLanguage(request.language);
    const chunks = splitIntoChunks(request.message, request.chunkSize ?? 320);

    if (chunks.length === 0) {
      return {
        summary: 'no data',
        source: 'none',
        confidence: 0,
        agentResults: [],
        searchHits: [],
        approval: {
          approved: false,
          requiredVotes: 3,
          receivedVotes: 0,
          avgConfidence: 0,
          decisions: [],
        },
        thinkingTime: Date.now() - startedAt,
      };
    }

    const agents = selectAgents(request.modules);
    const chunksText = chunks.map((chunk, index) => `Chunk ${index + 1}: ${chunk}`).join('\n');
    const searchHits = await searchEverywherePossible(request.message);
    const evidenceText = searchHits
      .slice(0, 6)
      .map((hit, index) => `[Evidence ${index + 1} | ${hit.sourceLabel}] ${hit.content}`)
      .join('\n\n');
    const augmentedInput = evidenceText ? `${chunksText}\n\n${evidenceText}` : chunksText;

    const agentResults = await Promise.all(
      agents.map(async (agent): Promise<AlbaMedAgentResult> => {
        const baseSystem =
          language === 'sq'
            ? `Ti je ${agent.titleSq} në AlbaMed Laboratory. Jep përgjigje mjekësore të kujdesshme, pa pretenduar diagnozë përfundimtare. ${agent.prompt}`
            : `You are ${agent.title} in AlbaMed Laboratory. Provide careful medical guidance without claiming definitive diagnosis. ${agent.prompt}`;

        const provider = await albaMedCore.request(baseSystem, augmentedInput, language, !!request.useCloud);

        return {
          agentId: agent.id,
          title: language === 'sq' ? agent.titleSq : agent.title,
          text: provider.text,
          source: provider.source,
          confidence: provider.confidence,
        };
      })
    );

    const successful = agentResults.filter((result) => result.text && result.text !== 'no data');

    if (successful.length === 0) {
      return {
        summary: 'no data',
        source: 'none',
        confidence: 0,
        agentResults,
        searchHits,
        approval: {
          approved: false,
          requiredVotes: 3,
          receivedVotes: 0,
          avgConfidence: 0,
          decisions: [],
        },
        thinkingTime: Date.now() - startedAt,
      };
    }

    const synthesisPrompt =
      language === 'sq'
        ? 'Përmblidh rezultatet e agjentëve me hapa praktikë, sinjale alarmi dhe kufizime klinike në mënyrë të qartë.'
        : 'Summarize agent results with practical steps, red flags, and clinical limitations clearly.';

    const synthesisInput = successful
      .map((item) => `${item.title}: ${item.text}`)
      .join('\n\n');

    const synthesis = await albaMedCore.request(synthesisPrompt, synthesisInput, language, !!request.useCloud);
    const approval = await this.runApprovalGate(
      language,
      request.useCloud,
      request.message,
      synthesis.text || 'no data',
      successful,
      searchHits
    );

    const approvedSummary = approval.approved ? (synthesis.text || 'no data') : 'no data';

    return {
      summary: approvedSummary,
      source: pickBestSource([synthesis.source, ...successful.map((item) => item.source)]),
      confidence: approval.approved
        ? Math.max(synthesis.confidence, aggregateConfidence(successful), approval.avgConfidence)
        : 0,
      agentResults,
      searchHits,
      approval,
      thinkingTime: Date.now() - startedAt,
    };
  }

  private async runApprovalGate(
    language: 'sq' | 'en' | 'mixed',
    useCloud: boolean | undefined,
    userMessage: string,
    summary: string,
    successfulAgentResults: AlbaMedAgentResult[],
    searchHits: Array<{ sourceLabel: string; content: string }>
  ): Promise<AlbaMedApprovalResult> {
    if (!summary || summary === 'no data') {
      return {
        approved: false,
        requiredVotes: 3,
        receivedVotes: 0,
        avgConfidence: 0,
        decisions: [],
      };
    }

    const evidence = searchHits
      .slice(0, 4)
      .map((hit, index) => `${index + 1}. ${hit.sourceLabel}: ${hit.content}`)
      .join('\n');

    const agentSummary = successfulAgentResults
      .map((item) => `${item.title}: ${item.text}`)
      .join('\n\n');

    const decisions = await Promise.all(
      ALBAMED_REVIEWERS.map(async (reviewer): Promise<AlbaMedReviewerDecision> => {
        const reviewerSystem =
          language === 'sq'
            ? `Ti je ${reviewer.title}. ${reviewer.prompt} Jep vendim me format: APPROVED ose REJECTED, pastaj 1-2 fjali arsye.`
            : `You are ${reviewer.title}. ${reviewer.prompt} Return decision as APPROVED or REJECTED with 1-2 sentence rationale.`;

        const reviewerInput = [
          `Original query: ${userMessage}`,
          `Candidate summary: ${summary}`,
          `Agent outputs: ${agentSummary}`,
          evidence ? `Evidence:\n${evidence}` : 'Evidence: none',
        ].join('\n\n');

        const evaluation = await albaMedCore.request(reviewerSystem, reviewerInput, language, !!useCloud);
        const text = evaluation.text || 'no data';
        const normalized = text.toLowerCase();
        const approved = normalized.includes('approved') && !normalized.includes('rejected');

        return {
          reviewer: reviewer.id,
          approved,
          confidence: evaluation.confidence,
          notes: text,
        };
      })
    );

    const approvalCore = computeApproval(
      decisions.map((decision) => ({
        reviewer: decision.reviewer,
        approved: decision.approved,
        confidence: decision.confidence,
        notes: decision.notes,
      })),
      {
        minVotes: 3,
        minAverageConfidence: 0.45,
      }
    );

    return {
      approved: approvalCore.approved,
      requiredVotes: approvalCore.requiredVotes,
      receivedVotes: approvalCore.receivedVotes,
      avgConfidence: approvalCore.avgConfidence,
      decisions,
    };
  }
}

export const albaMedEngine = new AlbaMedEngine();
export { ALBAMED_AGENTS };
