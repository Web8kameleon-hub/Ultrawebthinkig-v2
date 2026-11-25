import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
const reportPath = resolve(root, reportArg?.slice('--report='.length) || 'reports/governance-docs-check.json');

const requiredDocs = [
  'docs/reference/GOVERNANCE_INDEX.md',
  'docs/reference/CI_REFERENCE.md',
  'docs/reference/CD_REFERENCE.md',
  'docs/reference/CLI_REFERENCE.md',
  'docs/reference/CLO_REFERENCE.md',
  'docs/reference/SLI_SLO_REFERENCE.md',
  'docs/reference/RELEASE_REFERENCE.md',
  'docs/reference/TEST_VALIDATION_REFERENCE.md',
  'docs/reference/AI_AGI_GOVERNANCE_REFERENCE.md',
  'docs/INFRA_TOPOLOGY_NO_FAKE.md',
];

const requiredConfig = [
  'config/infra-topology.json',
  'config/ai-governance-sources.json',
];

const errors = [];

for (const doc of requiredDocs) {
  if (!existsSync(resolve(root, doc))) {
    errors.push(`Missing required doc: ${doc}`);
  }
}

for (const conf of requiredConfig) {
  if (!existsSync(resolve(root, conf))) {
    errors.push(`Missing required config: ${conf}`);
  }
}

if (existsSync(resolve(root, 'config/ai-governance-sources.json'))) {
  try {
    const data = JSON.parse(readFileSync(resolve(root, 'config/ai-governance-sources.json'), 'utf8'));
    if (!Array.isArray(data?.githubContributions?.repositories) || data.githubContributions.repositories.length === 0) {
      errors.push('`config/ai-governance-sources.json` must contain at least one GitHub repository.');
    }
  } catch (error) {
    errors.push(`Unable to parse config/ai-governance-sources.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  valid: errors.length === 0,
  errors,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Governance docs check: ${report.valid ? 'PASS' : 'FAIL'}`);
console.log(`Report: ${relative(root, reportPath)}`);

if (!report.valid) {
  for (const error of report.errors) console.log(`ERROR: ${error}`);
  process.exitCode = 1;
}
