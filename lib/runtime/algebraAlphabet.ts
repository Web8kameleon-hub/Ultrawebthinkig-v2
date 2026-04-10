export interface AlgebraCandidate<T = unknown> {
  id: string;
  text: string;
  payload: T;
}

export const ALGEBRA_AI_PREPARATION_LAYERS = [
  'normalization',
  'tokenization',
  'alphabetVectorization',
  'bigramIndexing',
  'trigramIndexing',
  'numericExtraction',
] as const;

export const ALGEBRA_AI_SCORING_LAYERS = [
  'tokenCoverage',
  'orderedTokenAlignment',
  'phraseContinuity',
  'bigramSimilarity',
  'trigramSimilarity',
  'alphabetCosine',
  'prefixSimilarity',
  'numericAffinity',
  'exactness',
] as const;

export const ALGEBRA_AI_LAYER_COUNT = ALGEBRA_AI_PREPARATION_LAYERS.length + ALGEBRA_AI_SCORING_LAYERS.length;

type AlgebraScoringLayer = (typeof ALGEBRA_AI_SCORING_LAYERS)[number];

export interface AlgebraProfile {
  normalized: string;
  compact: string;
  tokens: string[];
  tokenSet: Set<string>;
  alphabetVector: number[];
  bigrams: Set<string>;
  trigrams: Set<string>;
  numbers: number[];
}

export interface AlgebraScoreBreakdown {
  tokenCoverage: number;
  orderedTokenAlignment: number;
  phraseContinuity: number;
  bigramSimilarity: number;
  trigramSimilarity: number;
  alphabetCosine: number;
  prefixSimilarity: number;
  numericAffinity: number;
  exactness: number;
  finalScore: number;
}

export interface AlgebraRankedCandidate<T = unknown> extends AlgebraCandidate<T> {
  score: number;
  breakdown: AlgebraScoreBreakdown;
}

export interface AlgebraRankOptions {
  limit?: number;
  minScore?: number;
  weights?: Partial<Record<AlgebraScoringLayer, number>>;
}

interface ResolvedAlgebraRankOptions {
  limit: number;
  minScore: number;
  weights: Record<AlgebraScoringLayer, number>;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzçë';
const DEFAULT_WEIGHTS: Record<AlgebraScoringLayer, number> = {
  tokenCoverage: 0.18,
  orderedTokenAlignment: 0.14,
  phraseContinuity: 0.14,
  bigramSimilarity: 0.11,
  trigramSimilarity: 0.11,
  alphabetCosine: 0.1,
  prefixSimilarity: 0.08,
  numericAffinity: 0.07,
  exactness: 0.07,
};

function normalizeInput(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zçë0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeInput(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function compactNormalized(value: string): string {
  return normalizeInput(value).replace(/\s+/g, '');
}

function buildAlphabetVector(value: string): number[] {
  const normalized = normalizeInput(value);
  const vector = new Array(ALPHABET.length).fill(0);
  for (const char of normalized) {
    const index = ALPHABET.indexOf(char);
    if (index >= 0) vector[index] += 1;
  }
  return vector;
}

function buildCharacterNgrams(value: string, size: number): Set<string> {
  const compact = compactNormalized(value);
  const grams = new Set<string>();

  if (compact.length < size) return grams;

  for (let index = 0; index <= compact.length - size; index++) {
    grams.add(compact.slice(index, index + size));
  }

  return grams;
}

function extractNumbers(value: string): number[] {
  const matches = normalizeInput(value).match(/\d+(?:[\.,]\d+)?/g) || [];
  return matches
    .map((item) => Number(item.replace(',', '.')))
    .filter((item) => Number.isFinite(item));
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) intersection += 1;
  }

  return intersection / (left.size + right.size - intersection);
}

function tokenCoverageScore(queryTokens: string[], candidateSet: Set<string>): number {
  if (queryTokens.length === 0 || candidateSet.size === 0) return 0;

  const uniqueTokens = [...new Set(queryTokens)];
  const totalWeight = uniqueTokens.reduce((sum, token) => sum + Math.max(1, token.length), 0);
  const matchedWeight = uniqueTokens.reduce(
    (sum, token) => sum + (candidateSet.has(token) ? Math.max(1, token.length) : 0),
    0
  );

  return totalWeight === 0 ? 0 : matchedWeight / totalWeight;
}

function orderedTokenAlignmentScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  let queryIndex = 0;
  for (const candidateToken of candidateTokens) {
    if (queryTokens[queryIndex] === candidateToken) {
      queryIndex += 1;
      if (queryIndex === queryTokens.length) break;
    }
  }

  return queryIndex / queryTokens.length;
}

function phraseContinuityScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  let longestRun = 0;

  for (let queryStart = 0; queryStart < queryTokens.length; queryStart++) {
    for (let candidateStart = 0; candidateStart < candidateTokens.length; candidateStart++) {
      let run = 0;
      while (
        queryStart + run < queryTokens.length &&
        candidateStart + run < candidateTokens.length &&
        queryTokens[queryStart + run] === candidateTokens[candidateStart + run]
      ) {
        run += 1;
      }
      if (run > longestRun) longestRun = run;
    }
  }

  return longestRun / queryTokens.length;
}

function prefixSimilarityScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  let matches = 0;
  for (const queryToken of queryTokens) {
    const hasPrefix = candidateTokens.some(
      (candidateToken) => candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)
    );
    if (hasPrefix) matches += 1;
  }

  return matches / queryTokens.length;
}

function numericAffinityScore(queryNumbers: number[], candidateNumbers: number[]): number {
  if (queryNumbers.length === 0) return 0;
  if (candidateNumbers.length === 0) return 0;

  let total = 0;
  for (const queryNumber of queryNumbers) {
    let best = 0;
    for (const candidateNumber of candidateNumbers) {
      if (queryNumber === candidateNumber) {
        best = 1;
        break;
      }

      const maxValue = Math.max(Math.abs(queryNumber), Math.abs(candidateNumber), 1);
      const score = Math.max(0, 1 - Math.abs(queryNumber - candidateNumber) / maxValue);
      if (score > best) best = score;
    }
    total += best;
  }

  return total / queryNumbers.length;
}

function exactnessScore(queryNormalized: string, candidateNormalized: string): number {
  if (!queryNormalized || !candidateNormalized) return 0;
  if (queryNormalized === candidateNormalized) return 1;
  if (candidateNormalized.startsWith(queryNormalized) || queryNormalized.startsWith(candidateNormalized)) return 0.92;
  if (candidateNormalized.includes(queryNormalized) || queryNormalized.includes(candidateNormalized)) return 0.82;
  return 0;
}

function buildAlgebraProfile(value: string): AlgebraProfile {
  const normalized = normalizeInput(value);
  const tokens = tokenize(value);

  return {
    normalized,
    compact: normalized.replace(/\s+/g, ''),
    tokens,
    tokenSet: new Set(tokens),
    alphabetVector: buildAlphabetVector(value),
    bigrams: buildCharacterNgrams(value, 2),
    trigrams: buildCharacterNgrams(value, 3),
    numbers: extractNumbers(value),
  };
}

function resolveOptions(optionsOrLimit?: number | AlgebraRankOptions): ResolvedAlgebraRankOptions {
  if (typeof optionsOrLimit === 'number') {
    return {
      limit: optionsOrLimit,
      minScore: 0,
      weights: DEFAULT_WEIGHTS,
    };
  }

  return {
    limit: optionsOrLimit?.limit ?? 10,
    minScore: optionsOrLimit?.minScore ?? 0,
    weights: {
      ...DEFAULT_WEIGHTS,
      ...(optionsOrLimit?.weights || {}),
    },
  };
}

function combineLayerScores(
  scores: Record<AlgebraScoringLayer, number>,
  weights: Record<AlgebraScoringLayer, number>,
  queryProfile: AlgebraProfile,
  candidateProfile: AlgebraProfile
): number {
  const activeEntries = ALGEBRA_AI_SCORING_LAYERS.map((key) => [key, scores[key]] as const).filter(([key, value]) => {
    if (key === 'numericAffinity') return queryProfile.numbers.length > 0 && candidateProfile.numbers.length > 0;
    if (key === 'bigramSimilarity') return queryProfile.bigrams.size > 0 && candidateProfile.bigrams.size > 0;
    if (key === 'trigramSimilarity') return queryProfile.trigrams.size > 0 && candidateProfile.trigrams.size > 0;
    return value > 0 || queryProfile.tokens.length > 0 || queryProfile.normalized.length > 0;
  });

  const totalWeight = activeEntries.reduce((sum, [key]) => sum + weights[key], 0);
  if (totalWeight === 0) return 0;

  const weightedSum = activeEntries.reduce((sum, [key, value]) => sum + value * weights[key], 0);
  return weightedSum / totalWeight;
}

export function rankByAlgebraAlphabet<T>(
  query: string,
  candidates: Array<AlgebraCandidate<T>>,
  optionsOrLimit?: number | AlgebraRankOptions
): Array<AlgebraRankedCandidate<T>> {
  const options = resolveOptions(optionsOrLimit);
  const queryProfile = buildAlgebraProfile(query);

  const ranked = candidates.map((candidate) => {
    const candidateProfile = buildAlgebraProfile(candidate.text);

    const breakdown: AlgebraScoreBreakdown = {
      tokenCoverage: tokenCoverageScore(queryProfile.tokens, candidateProfile.tokenSet),
      orderedTokenAlignment: orderedTokenAlignmentScore(queryProfile.tokens, candidateProfile.tokens),
      phraseContinuity: phraseContinuityScore(queryProfile.tokens, candidateProfile.tokens),
      bigramSimilarity: jaccardSimilarity(queryProfile.bigrams, candidateProfile.bigrams),
      trigramSimilarity: jaccardSimilarity(queryProfile.trigrams, candidateProfile.trigrams),
      alphabetCosine: cosineSimilarity(queryProfile.alphabetVector, candidateProfile.alphabetVector),
      prefixSimilarity: prefixSimilarityScore(queryProfile.tokens, candidateProfile.tokens),
      numericAffinity: numericAffinityScore(queryProfile.numbers, candidateProfile.numbers),
      exactness: exactnessScore(queryProfile.normalized, candidateProfile.normalized),
      finalScore: 0,
    };

    const score = combineLayerScores(breakdown, options.weights, queryProfile, candidateProfile);
    breakdown.finalScore = score;

    return { ...candidate, score, breakdown };
  });

  return ranked
    .filter((item) => item.score > options.minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, options.limit);
}

export function explainAlgebraLayers(): {
  preparation: typeof ALGEBRA_AI_PREPARATION_LAYERS;
  scoring: typeof ALGEBRA_AI_SCORING_LAYERS;
  total: number;
} {
  return {
    preparation: ALGEBRA_AI_PREPARATION_LAYERS,
    scoring: ALGEBRA_AI_SCORING_LAYERS,
    total: ALGEBRA_AI_LAYER_COUNT,
  };
}

export { buildAlgebraProfile };
