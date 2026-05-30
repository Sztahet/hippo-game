const fs = require('fs');
const { spawnSync } = require('child_process');

const WORDS_PATH = './words.json';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_PROVIDER = 'copilot';

function parseArgs(argv) {
  const options = {
    provider: DEFAULT_PROVIDER,
    limit: 0,
    startId: 1,
    batchSize: 20,
    overwrite: false,
    dryRun: false,
    preview: 12
  };

  for (const arg of argv) {
    if (arg === '--overwrite') options.overwrite = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--provider=')) options.provider = String(arg.split('=')[1] || DEFAULT_PROVIDER).trim().toLowerCase();
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1] || 0);
    else if (arg.startsWith('--start-id=')) options.startId = Number(arg.split('=')[1] || 1);
    else if (arg.startsWith('--batch-size=')) options.batchSize = Number(arg.split('=')[1] || 20);
    else if (arg.startsWith('--preview=')) options.preview = Number(arg.split('=')[1] || 12);
  }

  if (!['copilot', 'openai'].includes(options.provider)) throw new Error('Invalid --provider value');
  if (!Number.isFinite(options.limit) || options.limit < 0) throw new Error('Invalid --limit value');
  if (!Number.isFinite(options.startId) || options.startId < 1) throw new Error('Invalid --start-id value');
  if (!Number.isFinite(options.batchSize) || options.batchSize < 1) throw new Error('Invalid --batch-size value');
  if (!Number.isFinite(options.preview) || options.preview < 0) throw new Error('Invalid --preview value');

  return options;
}

function getPrimaryEnglish(word) {
  if (Array.isArray(word.en)) return String(word.en[0] || '').trim();
  return String(word.en || '').trim();
}

function getExistingExamples(word) {
  if (Array.isArray(word.examples)) {
    return word.examples
      .map((example) => String(example || '').trim())
      .filter(Boolean);
  }
  if (typeof word.example === 'string' && word.example.trim()) {
    return [word.example.trim()];
  }
  return [];
}

function selectWords(words, options) {
  const filtered = words.filter((word) => {
    if ((Number(word.id) || 0) < options.startId) return false;
    if (!options.overwrite && getExistingExamples(word).length > 0) return false;
    return Boolean(getPrimaryEnglish(word));
  });

  return options.limit > 0 ? filtered.slice(0, options.limit) : filtered;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildPrompt(batch) {
  return [
    'Create one short natural English example sentence for each flashcard item.',
    'Return valid JSON only in the form {"items":[{"id":123,"example":"..."}]}.',
    'Rules:',
    '- Use the primary English translation exactly as written when possible.',
    '- Keep each sentence simple, natural, useful for memorization, and neutral in tone.',
    '- Prefer everyday contexts like home, school, work, travel, shopping, and routine activities.',
    '- Avoid dramatic or loaded contexts such as violence, politics, religion, insults, crime, sex, and romance unless the target word itself requires that domain.',
    '- Avoid stereotypes, conflict, fear, embarrassment, or strong emotional framing.',
    '- One sentence per item.',
    '- Max 14 words.',
    '- No numbering, no markdown, no explanations.',
    '- Keep punctuation simple.',
    '',
    JSON.stringify({
      items: batch.map((word) => ({
        id: word.id,
        pl: word.pl,
        en: getPrimaryEnglish(word),
        level: word.level
      }))
    })
  ].join('\n');
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Model did not return JSON');
  }
  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function normalizeExample(example) {
  const value = String(example || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (/[.!?]$/.test(value)) return value;
  return `${value}.`;
}

function buildPreviewRows(words, generatedExamples, previewCount) {
  if (previewCount <= 0) return [];

  return words
    .filter((word) => generatedExamples.has(Number(word.id)))
    .slice(0, previewCount)
    .map((word) => ({
      id: word.id,
      pl: word.pl,
      en: getPrimaryEnglish(word),
      example: generatedExamples.get(Number(word.id))
    }));
}

function getCopilotCommand() {
  return process.platform === 'win32' ? 'copilot.cmd' : 'copilot';
}

function runCopilotCommand(args) {
  if (process.platform === 'win32') {
    return spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$copilotArgs = $env:COPILOT_ARGS_JSON | ConvertFrom-Json; & copilot @copilotArgs"
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          COPILOT_ARGS_JSON: JSON.stringify(args)
        }
      }
    );
  }

  return spawnSync(getCopilotCommand(), args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024
  });
}

async function generateBatch(batch, config) {
  if (config.provider === 'copilot') {
    return generateBatchWithCopilot(batch, config);
  }

  return generateBatchWithOpenAI(batch, config);
}

async function generateBatchWithOpenAI(batch, config) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You write concise, neutral English example sentences for vocabulary flashcards and always return strict JSON.'
        },
        {
          role: 'user',
          content: buildPrompt(batch)
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  return new Map(
    items
      .map((item) => [Number(item?.id), normalizeExample(item?.example)])
      .filter(([id, example]) => Number.isInteger(id) && id > 0 && example)
  );
}

function ensureCopilotCliAvailable() {
  const probe = runCopilotCommand(['--version']);
  if (probe.error || probe.status !== 0) {
    throw new Error('Copilot CLI is not available. Install or log in to the local Copilot CLI first.');
  }
}

async function generateBatchWithCopilot(batch, config) {
  ensureCopilotCliAvailable();

  const args = [
    '-p',
    buildPrompt(batch),
    '--allow-all-tools',
    '--no-ask-user',
    '--no-custom-instructions',
    '--no-color',
    '-s'
  ];

  if (config.model) {
    args.push('--model', config.model);
  }

  const response = runCopilotCommand(args);

  if (response.error) {
    throw response.error;
  }

  if (response.status !== 0) {
    throw new Error((response.stderr || response.stdout || 'Copilot CLI request failed').trim());
  }

  let parsed;
  try {
    parsed = extractJson(response.stdout || '');
  } catch (error) {
    const snippet = String(response.stdout || '').trim().slice(0, 1200);
    throw new Error(`Model did not return JSON. Raw output: ${snippet || '<empty>'}`);
  }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  return new Map(
    items
      .map((item) => [Number(item?.id), normalizeExample(item?.example)])
      .filter(([id, example]) => Number.isInteger(id) && id > 0 && example)
  );
}

function mergeExamples(words, generatedExamples, overwrite) {
  let updated = 0;

  for (const word of words) {
    const existingExamples = getExistingExamples(word);
    if (!overwrite && existingExamples.length > 0) continue;

    const generated = generatedExamples.get(Number(word.id));
    if (!generated) continue;

    word.example = generated;
    delete word.examples;
    updated++;
  }

  return updated;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = options.provider === 'openai'
    ? (process.env.OPENAI_MODEL || DEFAULT_MODEL)
    : (process.env.COPILOT_MODEL || '');

  if (options.provider === 'openai' && !apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const words = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf8'));
  const targets = selectWords(words, options);

  if (targets.length === 0) {
    console.log('No words selected.');
    return;
  }

  const batches = chunk(targets, options.batchSize);
  const generatedExamples = new Map();

  console.log(`Provider: ${options.provider}`);
  console.log(`Selected ${targets.length} words in ${batches.length} batch(es).`);

  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    console.log(`Generating batch ${index + 1}/${batches.length}...`);
    const generated = await generateBatch(batch, { provider: options.provider, apiKey, baseUrl, model });

    for (const [id, example] of generated.entries()) {
      generatedExamples.set(id, example);
    }
  }

  const updated = mergeExamples(words, generatedExamples, options.overwrite);
  console.log(`Generated examples for ${updated} word(s).`);

  const previewRows = buildPreviewRows(targets, generatedExamples, options.preview);
  if (previewRows.length > 0) {
    console.log('Preview:');
    for (const row of previewRows) {
      console.log(`${row.id} | ${row.pl} | ${row.en} | ${row.example}`);
    }
  }

  if (options.dryRun) {
    console.log('Dry run enabled. No files written.');
    return;
  }

  fs.writeFileSync(WORDS_PATH, `${JSON.stringify(words, null, 2)}\n`, 'utf8');
  console.log(`Saved ${WORDS_PATH}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});