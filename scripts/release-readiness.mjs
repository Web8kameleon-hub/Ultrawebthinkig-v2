import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const docsOnly = process.argv.includes('--docs-only');
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
const reportPath = resolve(root, reportArg?.slice('--report='.length) || 'reports/release-readiness.json');

const requiredFiles = [
  'docs/reference/GOVERNANCE_INDEX.md',
  'docs/reference/CI_REFERENCE.md',
  'docs/reference/CD_REFERENCE.md',
  'docs/reference/CLI_REFERENCE.md',
  'docs/reference/CLO_REFERENCE.md',
  'docs/reference/SLI_SLO_REFERENCE.md',
  'docs/reference/RELEASE_REFERENCE.md',
  'docs/reference/TEST_VALIDATION_REFERENCE.md',
  'docs/reference/AI_AGI_GOVERNANCE_REFERENCE.md',
  '.github/pull_request_template.md'
];

const requiredReports = [
  'reports/infra-topology-validation.json',
  'reports/no-fake-audit.json',
  'reports/governance-docs-check.json'
];

const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    errors.push(`Missing required governance file: ${file}`);
  }
}

let summary = {
  infraValid: null,
  noFakeFindingCount: null,
  docsValid: null
};

if (!docsOnly) {
  for (const report of requiredReports) {
    if (!existsSync(resolve(root, report))) {
      errors.push(`Missing required report: ${report}`);
    }
  }

  const infraPath = resolve(root, 'reports/infra-topology-validation.json');
  if (existsSync(infraPath)) {
    try {
      const infra = JSON.parse(readFileSync(infraPath, 'utf8'));
      summary.infraValid = infra.valid === true;
      if (!summary.infraValid) errors.push('Infra topology validation report indicates invalid topology.');
    } catch (error) {
      errors.push(`Failed parsing infra validation report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const noFakePath = resolve(root, 'reports/no-fake-audit.json');
  if (existsSync(noFakePath)) {
    try {
      const noFake = JSON.parse(readFileSync(noFakePath, 'utf8'));
      summary.noFakeFindingCount = typeof noFake.findingCount === 'number' ? noFake.findingCount : null;
    } catch (error) {
      errors.push(`Failed parsing no-fake report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const docsPath = resolve(root, 'reports/governance-docs-check.json');
  if (existsSync(docsPath)) {
    try {
      const docs = JSON.parse(readFileSync(docsPath, 'utf8'));
      summary.docsValid = docs.valid === true;
      if (!summary.docsValid) errors.push('Governance docs report indicates invalid documentation state.');
    } catch (error) {
      errors.push(`Failed parsing governance docs report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  docsOnly,
  valid: errors.length === 0,
  errors,
  summary
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Release readiness: ${report.valid ? 'PASS' : 'FAIL'}`);
console.log(`Report: ${relative(root, reportPath)}`);
if (summary.infraValid !== null) console.log(`Infra topology valid: ${summary.infraValid}`);
if (summary.noFakeFindingCount !== null) console.log(`No-fake findings: ${summary.noFakeFindingCount}`);
if (summary.docsValid !== null) console.log(`Governance docs valid: ${summary.docsValid}`);
if (errors.length > 0) {
  for (const error of errors) console.log(`ERROR: ${error}`);
  process.exitCode = 1;
}
