import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const enforce = process.argv.includes('--enforce');
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
const reportPath = resolve(root, reportArg?.slice('--report='.length) || 'reports/no-fake-audit.json');

const runtimeExtensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.py']);
const excluded = [
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)reports\//,
  /(^|\/)(__tests__|tests?|fixtures?)\//,
  /\.(test|spec)\.[^.]+$/,
  /(^|\/)scripts\/no-fake-policy\.mjs$/,
];

const rules = [
  {
    id: 'fabricated-random-data',
    severity: 'error',
    pattern: /Math\.random\s*\(/g,
    message: 'Runtime randomness can fabricate user-visible data. Use a real provider; crypto.randomUUID is allowed only for identifiers.',
  },
  {
    id: 'fake-provider',
    severity: 'error',
    pattern: /\b(mock|fake|dummy|synthetic)[-_ ]?(data|service|provider|response|metric|telemetry|analytics|balance|transaction)s?\b/gi,
    message: 'Fake providers and fabricated runtime records are forbidden.',
  },
  {
    id: 'simulation-as-runtime',
    severity: 'error',
    pattern: /\b(simulate(?:d|s|ing)?|simulation)\b/gi,
    message: 'Simulation code must not be shipped as a real runtime data source.',
  },
  {
    id: 'placeholder-record',
    severity: 'error',
    pattern: /(?:https?:\/\/[^\s'"`]*placeholder|\bplaceholder(?:Id|Url|Data|Record)\b)/gi,
    message: 'Placeholder records must be replaced by real data or an explicit unavailable state.',
  },
];

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  return [...new Set(output.split(/\r?\n/).filter(Boolean))]
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => runtimeExtensions.has(extname(file)))
    .filter((file) => !excluded.some((pattern) => pattern.test(file)));
}

const findings = [];
for (const file of trackedFiles()) {
  let source;
  try {
    source = readFileSync(resolve(root, file), 'utf8');
  } catch {
    continue;
  }

  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes('no-fake: allow')) continue;
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file,
          line: index + 1,
          evidence: line.trim().slice(0, 240),
          message: rule.message,
        });
      }
    }
  }
}

const report = {
  policy: 'NO_FAKE_EVER',
  generatedAt: new Date().toISOString(),
  mode: enforce ? 'enforce' : 'audit',
  filesWithFindings: new Set(findings.map((finding) => finding.file)).size,
  findingCount: findings.length,
  findings,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`No Fake audit: ${report.findingCount} finding(s) in ${report.filesWithFindings} file(s).`);
console.log(`Report: ${relative(root, reportPath)}`);
for (const finding of findings.slice(0, 30)) {
  console.log(`${finding.file}:${finding.line} [${finding.rule}] ${finding.evidence}`);
}
if (findings.length > 30) console.log(`... ${findings.length - 30} additional finding(s) are in the report.`);

if (enforce && findings.length > 0) process.exitCode = 1;
