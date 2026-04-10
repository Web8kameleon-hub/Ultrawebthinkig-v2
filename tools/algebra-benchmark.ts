import { ALGEBRA_AI_LAYER_COUNT, explainAlgebraLayers, rankByAlgebraAlphabet } from '../lib/runtime/algebraAlphabet';

const query = 'real medical ai tokens 50000 zero timeout approval engine';

const candidates = [
  {
    id: 'albamed-core',
    text: 'real medical ai approval engine with tokens 50000 and zero timeout orchestration',
    payload: { module: 'albamed' },
  },
  {
    id: 'dualmind-core',
    text: 'dual mind engine for ai orchestration with timeout controls and review gates',
    payload: { module: 'dualmind' },
  },
  {
    id: 'guardian-core',
    text: 'guardian security approval engine with real telemetry and module ranking',
    payload: { module: 'guardian' },
  },
  {
    id: 'generic-demo',
    text: 'demo content without real token controls or medical alignment',
    payload: { module: 'generic' },
  },
];

const started = performance.now();
const ranked = rankByAlgebraAlphabet(query, candidates, { limit: 3, minScore: 0.05 });
const ended = performance.now();
const layers = explainAlgebraLayers();

console.log(JSON.stringify({
  layerCount: ALGEBRA_AI_LAYER_COUNT,
  preparationLayers: layers.preparation,
  scoringLayers: layers.scoring,
  durationMs: Number((ended - started).toFixed(3)),
  top: ranked.map((item) => ({
    id: item.id,
    score: Number(item.score.toFixed(6)),
    breakdown: item.breakdown,
  })),
}, null, 2));