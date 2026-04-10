export interface ReviewerDecisionInput {
  reviewer: string;
  approved: boolean;
  confidence: number;
  notes: string;
}

export interface ApprovalPolicy {
  minVotes: number;
  minAverageConfidence: number;
}

export interface ApprovalResult {
  approved: boolean;
  receivedVotes: number;
  requiredVotes: number;
  avgConfidence: number;
}

export function computeApproval(
  decisions: ReviewerDecisionInput[],
  policy: ApprovalPolicy
): ApprovalResult {
  const receivedVotes = decisions.filter((decision) => decision.approved).length;
  const avgConfidence = decisions.length
    ? decisions.reduce((sum, decision) => sum + decision.confidence, 0) / decisions.length
    : 0;

  return {
    approved: receivedVotes >= policy.minVotes && avgConfidence >= policy.minAverageConfidence,
    receivedVotes,
    requiredVotes: policy.minVotes,
    avgConfidence,
  };
}
