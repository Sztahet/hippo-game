const fs = require('fs');
const path = require('path');

const WORDS_PATH = path.join(__dirname, '..', 'words.json');

const KNOWN_BAD_ENGLISH = new Set([
  'iss',
  'tive',
  'nimh',
  'masterbation',
  'masterbating',
  'travesti',
  'travestis'
]);

const KNOWN_BAD_POLISH = new Set([
  'marketingu',
  'tywny'
]);

const KNOWN_BAD_EXAMPLES = new Set([
  'The room having large windows feels bright.',
  'The soup tastes well balanced.',
  'This chair is used every day.',
  'The warehouse stores extra boxes for the shop.',
  'She enjoys athletics at school.',
  'Most students arrived early.',
  'He wore silver links with his shirt.',
  'The photos were posted yesterday.',
  'The store has enough stock.',
  'An iss in the network caused delays.',
  'The word has a suffix that is tive.'
]);

function normalizeExample(example) {
  return String(example || '').replace(/\s+/g, ' ').trim();
}

function getEnglishTerms(word) {
  if (Array.isArray(word.en)) return word.en;
  return [word.en];
}

function main() {
  const raw = fs.readFileSync(WORDS_PATH, 'utf8');
  const words = JSON.parse(raw);
  const issues = [];
  const seenIds = new Set();
  const seenExamples = new Map();

  for (const word of words) {
    if (!Number.isInteger(word.id)) {
      issues.push(`Non-integer id: ${JSON.stringify(word.id)}`);
      continue;
    }

    if (seenIds.has(word.id)) {
      issues.push(`Duplicate id: ${word.id}`);
    }
    seenIds.add(word.id);

    if (typeof word.pl !== 'string' || !word.pl.trim()) {
      issues.push(`Empty Polish lemma for id ${word.id}`);
    }

    const terms = getEnglishTerms(word)
      .map((term) => String(term || '').trim())
      .filter(Boolean);

    if (!terms.length) {
      issues.push(`Missing English term for id ${word.id}`);
    }

    for (const term of terms) {
      if (KNOWN_BAD_ENGLISH.has(term.toLowerCase())) {
        issues.push(`Known bad English lemma for id ${word.id}: ${term}`);
      }
    }

    if (KNOWN_BAD_POLISH.has(String(word.pl || '').trim().toLowerCase())) {
      issues.push(`Known bad Polish lemma for id ${word.id}: ${word.pl}`);
    }

    const example = normalizeExample(word.example);
    if (!example) {
      issues.push(`Missing example for id ${word.id}`);
    } else {
      if (seenExamples.has(example)) {
        issues.push(`Duplicate example for ids ${seenExamples.get(example)} and ${word.id}: ${example}`);
      } else {
        seenExamples.set(example, word.id);
      }

      if (KNOWN_BAD_EXAMPLES.has(example)) {
        issues.push(`Known bad example for id ${word.id}: ${example}`);
      }
    }
  }

  if (issues.length) {
    console.error('words.json validation failed:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    total: words.length,
    examples: seenExamples.size
  }, null, 2));
}

main();