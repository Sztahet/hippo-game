const fs = require('fs');

const WORDS_PATH = 'words.json';
const SOURCE_PATH = '20k.txt';

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','been','being','by','for','from','had','has','have','he','her','hers','him','his','i','if','in','is','it','its','me','my','no','not','of','on','or','our','ours','she','so','that','the','their','theirs','them','there','they','this','those','to','us','was','we','were','what','when','where','which','who','whom','why','will','with','would','you','your','yours',
  'am','pm','re','ve','ll','d','m','s','t','c','e','b','n','x',
  'new','all','more','can','out','only','here','also','how','some','these','than','over','into','both','while','down','without','per','since','yes','too','few','non','via','either','ago','yet',
  'www','http','https','com','org','net','co','io','url','html','css','xml','php','api','pdf','ftp','smtp',
  'mr','mrs','ms','dr','jr','sr',
  'etc','eg','ie',
  'inc','ltd','llc'
]);

const LOW_SIGNAL = new Set([
  'usr','pst','gmt','dvd','rss','isbn','oauth','smtp','fgets','printf','xhtml','xlibs','dns','tcp','udp','pci','usb','vga','bmp','jpg','jpeg','png','gif','asp','jsp','cgi','dll',
  'aaa','xxx','xx','yy','zz','ooo','todo','misc','aka','ibid','lhs','rhs','sdk','cmd','tmp','spec','proc',
  'thats','hdtv','expansys','utils','phys','comp','ist','nascar'
]);

const ADULT_OR_UNWANTED = new Set([
  'porn','porno','xxx','sex','sexy','nude','nudity','naked','boobs','boob','bitch','fucking','whore','cock','dildo','vagina','penis','cumshot','cumshots','sperm','orgy','orgies','fetish','lesbian','lesbians','anal','ass','milf','milfs','pussy','rape','incest','blowjob','blowjobs','masturbation','transvestite','transvestites','tranny','shemale','shemales',
  'nazis','nazi','qaeda','terrorist','terrorists'
]);

const NAME_LIKE = new Set([
  'john','mary','michael','david','james','robert','daniel','thomas','richard','charles','joseph','paul','mark','donald','george','kenneth','steven','edward','brian','ronald','anthony','kevin','jason','matthew','gary','timothy','jose','larry','jeffrey','frank','scott','eric','andrew','raymond','gregory','joshua','jerry','dennis','walter','patrick','peter','harold','douglas','henry','carl','arthur','ryan','roger','joe','juan','jack','albert','jonathan','justin',
  'anna','emma','julia','sarah','jessica','laura','nicole','linda','karen','ashley','susan','maria','jennifer','donna','jill','helen','rachel','katie','christine','victoria','amanda','lisa','kimberly','melissa','deborah','sharon','michelle','emily','sandra','carol','rebecca','diane','kathleen','amy','angela','heather','sophia',
  'ted','luke','julie','catherine','chuck','dale','perry','thomson','palmer','harrison','benjamin'
]);

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function isWordToken(w) {
  return /^[a-z][a-z'-]*[a-z]$/.test(w);
}

function isCandidateAllowed(word) {
  const w = normalize(word);
  if (!w) return false;
  if (!isWordToken(w)) return false;
  if (w.length < 3 || w.length > 24) return false;
  if (STOPWORDS.has(w)) return false;
  if (LOW_SIGNAL.has(w)) return false;
  if (ADULT_OR_UNWANTED.has(w)) return false;
  if (NAME_LIKE.has(w)) return false;
  if (/^\d+$/.test(w)) return false;
  if (/^(ha|ah|oh|uh|um)+$/.test(w)) return false;
  return true;
}

function shouldRemoveImportedRow(row, importStartId) {
  const en = normalize(row.en);
  if (Number(row.id) < importStartId) return false;
  if (ADULT_OR_UNWANTED.has(en)) return true;
  if (LOW_SIGNAL.has(en)) return true;
  if (!isWordToken(en)) return true;
  if (en.length < 3) return true;
  if (STOPWORDS.has(en)) return true;
  return false;
}

function assignLevel(i) {
  if (i < 900) return 'A2';
  if (i < 1800) return 'B1';
  if (i < 2500) return 'B2';
  if (i < 2900) return 'C1';
  return 'C2';
}

function parseArgs(argv) {
  const out = {
    cleanOnly: false,
    target: 0,
    consumeAll: false,
    importStartId: 3327,
    batchSize: 220,
    concurrency: 12
  };

  for (const arg of argv) {
    if (arg === '--clean-only') out.cleanOnly = true;
    else if (arg === '--consume-all') out.consumeAll = true;
    else if (arg.startsWith('--target=')) out.target = Number(arg.split('=')[1] || 0);
    else if (arg.startsWith('--import-start-id=')) out.importStartId = Number(arg.split('=')[1] || 3327);
    else if (arg.startsWith('--batch-size=')) out.batchSize = Number(arg.split('=')[1] || 220);
    else if (arg.startsWith('--concurrency=')) out.concurrency = Number(arg.split('=')[1] || 12);
  }

  if (!Number.isFinite(out.target) || out.target < 0) throw new Error('Invalid --target value');
  if (!Number.isFinite(out.importStartId) || out.importStartId < 1) throw new Error('Invalid --import-start-id value');
  if (!Number.isFinite(out.batchSize) || out.batchSize < 1) throw new Error('Invalid --batch-size value');
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) throw new Error('Invalid --concurrency value');
  if (out.cleanOnly) {
    out.target = 0;
    out.consumeAll = false;
  }

  return out;
}

async function translateEnToPl(word) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pl&dt=t&q=' + encodeURIComponent(word);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Bad translation payload');
  const translated = data[0].map((part) => part[0]).join('').trim();
  if (!translated) throw new Error('Empty translation');
  return translated;
}

async function translateBatch(words, concurrency) {
  const out = new Array(words.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= words.length) return;
      const w = words[i];

      let errLast = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          out[i] = await translateEnToPl(w);
          break;
        } catch (err) {
          errLast = err;
          await new Promise((r) => setTimeout(r, 250 * attempt));
        }
      }

      if (!out[i]) {
        throw new Error(`Failed translating '${w}': ${errLast ? errLast.message : 'unknown'}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

function cleanupRows(words, importStartId) {
  const cleaned = [];
  const seenEn = new Set();
  const seenPl = new Set();

  const removed = {
    duplicateEn: 0,
    duplicatePl: 0,
    importedNoise: 0,
    samePlEn: 0,
    invalid: 0
  };

  for (const row of words) {
    const en = normalize(row.en);
    const pl = normalize(row.pl);

    if (!en || !pl) {
      removed.invalid++;
      continue;
    }

    if (en === pl) {
      removed.samePlEn++;
      continue;
    }

    if (seenEn.has(en)) {
      removed.duplicateEn++;
      continue;
    }

    if (seenPl.has(pl)) {
      removed.duplicatePl++;
      continue;
    }

    if (shouldRemoveImportedRow(row, importStartId)) {
      removed.importedNoise++;
      continue;
    }

    seenEn.add(en);
    seenPl.add(pl);
    cleaned.push(row);
  }

  return { cleaned, removed };
}

function countDuplicates(words) {
  const enMap = new Map();
  const plMap = new Map();
  for (const row of words) {
    const en = normalize(row.en);
    const pl = normalize(row.pl);
    enMap.set(en, (enMap.get(en) || 0) + 1);
    plMap.set(pl, (plMap.get(pl) || 0) + 1);
  }
  return {
    dupEn: [...enMap.values()].filter((v) => v > 1).length,
    dupPl: [...plMap.values()].filter((v) => v > 1).length
  };
}

(async () => {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(SOURCE_PATH)) {
      throw new Error(`Missing ${SOURCE_PATH}. Provide a plain-text list with one English word per line.`);
    }

    const words = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf8'));
    const sourceLines = fs.readFileSync(SOURCE_PATH, 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

    const { cleaned, removed } = cleanupRows(words, args.importStartId);

    const existingEn = new Set(cleaned.map((w) => normalize(w.en)));
    const existingPl = new Set(cleaned.map((w) => normalize(w.pl)));

    const added = [];
    let translatedTotal = 0;
    let consumedFromTop = 0;
    let skippedBeforeTranslate = 0;

    if (args.target > 0 || args.consumeAll) {
      let nextId = Math.max(...cleaned.map((w) => Number(w.id) || 0)) + 1;
      const seenConsumedEn = new Set();

      while (consumedFromTop < sourceLines.length && (args.consumeAll || added.length < args.target)) {
        const batch = [];

        // Consume strictly from the top of 20k.txt; any reviewed entry is removed.
        while (consumedFromTop < sourceLines.length && batch.length < args.batchSize) {
          const raw = sourceLines[consumedFromTop++];
          const w = normalize(raw);

          if (!isCandidateAllowed(w)) {
            skippedBeforeTranslate++;
            continue;
          }
          if (existingEn.has(w) || seenConsumedEn.has(w)) {
            skippedBeforeTranslate++;
            continue;
          }

          seenConsumedEn.add(w);
          batch.push(w);
        }

        if (batch.length === 0) continue;

        const translated = await translateBatch(batch, args.concurrency);
        translatedTotal += batch.length;

        for (let i = 0; i < batch.length && added.length < args.target; i++) {
          const en = batch[i];
          const pl = normalize(translated[i]);

          if (!pl) continue;
          if (en === pl) continue;
          if (existingEn.has(en)) continue;
          if (existingPl.has(pl)) continue;

          const row = {
            id: nextId++,
            pl,
            en,
            level: assignLevel(added.length)
          };

          cleaned.push(row);
          added.push(row);
          existingEn.add(en);
          existingPl.add(pl);
        }

        console.log(`Progress: consumed ${consumedFromTop}, translated ${translatedTotal}, added ${added.length}/${args.target}`);
      }

      if (!args.consumeAll && added.length !== args.target) {
        throw new Error(`Could not add ${args.target} unique words. Added ${added.length}, consumed ${consumedFromTop}.`);
      }
    }

    const remaining20k = (args.target > 0 || args.consumeAll) ? sourceLines.slice(consumedFromTop) : sourceLines;

    const duplicates = countDuplicates(cleaned);

    fs.writeFileSync(WORDS_PATH, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
    fs.writeFileSync(SOURCE_PATH, remaining20k.join('\n') + '\n', 'utf8');

    const levelAdded = {};
    for (const r of added) levelAdded[r.level] = (levelAdded[r.level] || 0) + 1;

    console.log('Cleanup removed duplicate EN rows:', removed.duplicateEn);
    console.log('Cleanup removed duplicate PL rows:', removed.duplicatePl);
    console.log('Cleanup removed imported low-signal rows:', removed.importedNoise);
    console.log('Cleanup removed rows with same PL/EN:', removed.samePlEn);
    console.log('Cleanup removed invalid rows:', removed.invalid);
    console.log('Added rows:', added.length);
    console.log('Added by level:', levelAdded);
    if (args.target > 0 || args.consumeAll) {
      console.log('Consumed from top of 20k:', consumedFromTop);
      console.log('Skipped before translate:', skippedBeforeTranslate);
    }
    console.log('Final words count:', cleaned.length);
    console.log('Remaining 20k entries:', remaining20k.length);
    console.log('Final duplicate EN keys:', duplicates.dupEn);
    console.log('Final duplicate PL keys:', duplicates.dupPl);
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
