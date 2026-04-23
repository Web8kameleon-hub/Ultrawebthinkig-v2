import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const scanRoots = [
  'app',
  'pages',
  'core',
  'lib',
  'modules',
  'backend',
  'api-gateway'
];

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
const ignoredDirNames = new Set([
  '__tests__',
  'tests',
  'postman',
  'node_modules',
  '.next',
  'dist',
  'coverage',
  'legacy-npm'
]);
const ignoredFileFragments = ['.test.', '.spec.'];

const bannedPatterns = [
  /\bmock\b/i,
  /\bfake\b/i,
  /\bstub\b/i,
  /\bdummy\b/i,
  /\bsimulat(e|ed|ion)\b/i,
  /fallback to mock/i,
  /generateFallback/i,
  /synthetic api data/i,
  /source:\s*['"]fallback['"]/i,
  /DEMO_KEY/i
];

function normalizeExecutableLine(line, blockState) {
  let currentLine = line;
  const state = blockState;

  if (state.inBlockComment) {
    const endIndex = currentLine.indexOf('*/');
    if (endIndex === -1) {
      return { normalized: '', inBlockComment: true };
    }
    currentLine = currentLine.slice(endIndex + 2);
    state.inBlockComment = false;
  }

  while (true) {
    const startIndex = currentLine.indexOf('/*');
    if (startIndex === -1) {
      break;
    }
    const endIndex = currentLine.indexOf('*/', startIndex + 2);
    if (endIndex === -1) {
      currentLine = currentLine.slice(0, startIndex);
      state.inBlockComment = true;
      break;
    }
    currentLine = currentLine.slice(0, startIndex) + currentLine.slice(endIndex + 2);
  }

  const trimmed = currentLine.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return { normalized: '', inBlockComment: state.inBlockComment };
  }

  const withoutInlineComment = currentLine.split('//')[0] ?? '';
  const withoutStringLiterals = withoutInlineComment
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '``');

  return {
    normalized: withoutStringLiterals.trim(),
    inBlockComment: state.inBlockComment
  };
}

async function collectFiles(dirPath, bucket) {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = path.relative(process.cwd(), absolutePath);

    if (entry.isDirectory()) {
      if (ignoredDirNames.has(entry.name)) {
        continue;
      }
      await collectFiles(absolutePath, bucket);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(extension) || entry.name.endsWith('.d.ts')) {
      continue;
    }

    if (ignoredFileFragments.some((fragment) => entry.name.includes(fragment))) {
      continue;
    }

    bucket.push({ absolutePath, relativePath });
  }
}

const files = [];

for (const root of scanRoots) {
  await collectFiles(path.join(process.cwd(), root), files);
}

const violations = [];

for (const fileEntry of files) {
  const content = await readFile(fileEntry.absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const blockState = { inBlockComment: false };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const { normalized, inBlockComment } = normalizeExecutableLine(line, blockState);
    blockState.inBlockComment = inBlockComment;

    if (!normalized) {
      continue;
    }

    const matched = bannedPatterns.find((pattern) => pattern.test(normalized));
    if (matched) {
      violations.push({
        file: fileEntry.relativePath,
        line: index + 1,
        pattern: matched.toString(),
        snippet: line.trim().slice(0, 180)
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\n❌ Real-only verification failed. Found ${violations.length} violation(s):\n`);
  for (const violation of violations.slice(0, 120)) {
    console.error(`- ${violation.file}:${violation.line} | ${violation.snippet}`);
  }
  if (violations.length > 120) {
    console.error(`\n...and ${violations.length - 120} more violation(s).`);
  }
  process.exit(1);
}

console.log('✅ Real-only verification passed. No fake/mock patterns found in runtime code.');
