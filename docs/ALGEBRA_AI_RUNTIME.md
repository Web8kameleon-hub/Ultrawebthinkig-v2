# Algebra AI Runtime

`lib/runtime/algebraAlphabet.ts` tani funksionon si një motor rankimi me shumë shtresa, i ripërdorshëm për çdo modul.

## Shtresat

- Përgatitje: `normalization`, `tokenization`, `alphabetVectorization`, `bigramIndexing`, `trigramIndexing`, `numericExtraction`
- Vlerësim: `tokenCoverage`, `orderedTokenAlignment`, `phraseContinuity`, `bigramSimilarity`, `trigramSimilarity`, `alphabetCosine`, `prefixSimilarity`, `numericAffinity`, `exactness`

Totali aktual është `15` shtresa logjike. Kombinimet e mundshme rriten në mënyrë kombinatorike nga token-at, n-gram-et, numrat dhe peshat e shtresave, kështu që hapësira efektive e krahasimit shkon shumë lart pa u futur në brute-force të panevojshme.

## API

Përdorimi bazë:

```ts
import { rankByAlgebraAlphabet } from '@/lib/runtime';

const ranked = rankByAlgebraAlphabet(query, candidates, { limit: 10, minScore: 0.05 });
```

Objekti i kthyer përfshin:

- `score`
- `breakdown`
- `payload`

## Verifikim

Test i fokusuar:

```powershell
npm run test:algebra
```

Benchmark i vogël:

```powershell
npm run bench:algebra
```
