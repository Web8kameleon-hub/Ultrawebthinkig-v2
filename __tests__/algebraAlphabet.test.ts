import { describe, expect, test } from 'vitest';

import {
  ALGEBRA_AI_LAYER_COUNT,
  buildAlgebraProfile,
  explainAlgebraLayers,
  rankByAlgebraAlphabet,
} from '@/lib/runtime/algebraAlphabet';

describe('Algebra Alphabet Runtime', () => {
  test('exposes a deeper multi-layer engine', () => {
    const layers = explainAlgebraLayers();

    expect(ALGEBRA_AI_LAYER_COUNT).toBeGreaterThanOrEqual(12);
    expect(layers.total).toBe(ALGEBRA_AI_LAYER_COUNT);
    expect(layers.preparation.length).toBeGreaterThan(4);
    expect(layers.scoring.length).toBeGreaterThan(6);
  });

  test('prioritizes exact and continuous phrase matches', () => {
    const ranked = rankByAlgebraAlphabet(
      'real ai medical diagnosis',
      [
        {
          id: 'exact',
          text: 'real ai medical diagnosis assistant',
          payload: 'exact',
        },
        {
          id: 'shuffled',
          text: 'real assistant ai diagnosis medical',
          payload: 'shuffled',
        },
        {
          id: 'partial',
          text: 'clinical support platform',
          payload: 'partial',
        },
      ],
      3
    );

    expect(ranked[0]?.id).toBe('exact');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score || 0);
  });

  test('uses numeric affinity for high-token queries', () => {
    const ranked = rankByAlgebraAlphabet(
      'tokens 50000 zero timeout medical ai',
      [
        {
          id: 'preferred',
          text: 'medical ai tokens 50000 zero timeout pipeline',
          payload: 'preferred',
        },
        {
          id: 'weaker',
          text: 'medical ai tokens 4000 timeout pipeline',
          payload: 'weaker',
        },
      ],
      { limit: 2 }
    );

    expect(ranked[0]?.id).toBe('preferred');
    expect(ranked[0]?.breakdown.numericAffinity).toBeGreaterThan(ranked[1]?.breakdown.numericAffinity || 0);
  });

  test('normalizes accents and builds n-gram rich profiles', () => {
    const profile = buildAlgebraProfile('Çëdo AI mjekësore 50000');

    expect(profile.normalized).toContain('cedo');
    expect(profile.tokens).toContain('mjekesore');
    expect(profile.bigrams.size).toBeGreaterThan(0);
    expect(profile.trigrams.size).toBeGreaterThan(0);
    expect(profile.numbers).toContain(50000);
  });
});