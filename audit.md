# Audit

## Status After Cleanup

- Post-audit cleanup has already removed the dead auth wrapper and legacy startup cleanup from [app.js](app.js).
- Tooling-only root scripts have been moved under [scripts/README.md](scripts/README.md) and are no longer mixed with runtime entrypoints in the repo root.
- Dataset guardrails now include [scripts/validate_words.js](scripts/validate_words.js) for duplicate examples and known historical artifact regressions.
- The most obvious malformed entries in [words.json](words.json) were normalized, and two irrecoverably broken import artifacts (`id 14625`, `id 14626`) were removed.
- Current dataset status after cleanup: 14,164 entries, 14,164 entries with examples, 0 duplicate example sentences.

## Scope

- Vocabulary data audit of [words.json](words.json)
- Runtime and dead-code audit of [app.js](app.js), [index.html](index.html), [supabase-config.js](supabase-config.js), plus a classification of repo scripts as runtime vs tooling-only

## Executive Summary

- The dataset is structurally healthy: [words.json](words.json) parses, all 14,164 entries have examples, and there are no duplicate example sentences.
- Historical malformed imports and runtime dead-code findings have been cleaned in the current repo state.
- The remaining vocabulary risk is mainly product-governance: a few specialized C2 entries are still public, but they are now normalized and phrased neutrally.
- The initial runtime dead-code findings in [app.js](app.js) are resolved.
- Tooling scripts have been separated from runtime files, so the repo root is now aligned with the actual deployment surface.

## Findings

### High

1. Specialized/adult vocabulary was normalized and moved out of low CEFR levels, but it still remains in the public dataset.

Current examples:
- [words.json](words.json): `id 11581`, `masterbacja -> masturbation`, level `C2`
- [words.json](words.json): `id 11857`, `perwersyjne -> perverse`, level `C2`
- [words.json](words.json): `id 13436`, `foot fetysz -> foot fetish`, level `C2`
- [words.json](words.json): `id 15322`, `wzwodny -> erectile`, level `C2`

Why this matters:
- These entries are no longer malformed, but they still represent a content-scope decision for a public learning product.

Status:
- Mitigated in data quality terms.
- Still open as a product-policy decision.

2. The historical import-artifact lemmas called out in the first audit pass have been cleaned from the current dataset.

Resolved examples:
- [words.json](words.json): `id 11337`, `jest -> is`
- [words.json](words.json): `id 11234`, `mistrzowskie -> masterful`
- [words.json](words.json): `id 11240`, `upławy -> discharge`
- [words.json](words.json): `id 7837`, `trawesti -> drag performer`
- [words.json](words.json): `id 14907`, `trawestis -> drag performers`
- `id 14625` and `id 14626` were removed as irrecoverable import noise

Why this matters:
- These were the most trust-damaging data-corruption issues in the dataset.

Status:
- Resolved in current data.
- Regression guardrail added in [scripts/validate_words.js](scripts/validate_words.js).

### Medium

3. The earlier tone issue around conflict-related vocabulary has been normalized.

Example:
- [words.json](words.json): `id 11012`, `bombardowanie -> bombing`, example `The report examined the history of bombing campaigns during the war.`

Why this matters:
- Earlier content work moved toward neutral, non-vivid examples.

Status:
- Resolved.

4. `isAuthenticated()` was dead runtime code and has been removed.

Evidence:
- Definition at [app.js](app.js#L2155)
- Search in [app.js](app.js) shows no callsites beyond the definition itself

Why this matters:
- It is a stale wrapper over `isSupabaseAuthenticated()`.
- It increases confusion about which auth helper is canonical.

Status:
- Resolved.

5. Legacy migration cleanup looked stale and was executed twice during startup.

Evidence:
- Legacy constants at [app.js](app.js#L5), [app.js](app.js#L6), [app.js](app.js#L7)
- Cleanup function at [app.js](app.js#L275)
- Called inside `init()` at [app.js](app.js#L2122)
- Called again inside `boot()` at [app.js](app.js#L2341)

Why this matters:
- The keys being removed belong to the pre-Supabase migration path.
- The cleanup is harmless, but it is now redundant work and a sign that migration code has outlived its operational value.

Status:
- Resolved.

### Low

6. Repo scripts were easy to mistake for dead code, but most are tooling-only rather than runtime-dead.

Runtime entrypoints:
- [index.html](index.html#L11)
- [index.html](index.html#L12)
- [index.html](index.html#L13)

What runtime actually loads:
- Supabase CDN
- [supabase-config.js](supabase-config.js)
- [app.js](app.js)

Tooling-only, but still useful:
- [scripts/build.js](scripts/build.js)
- [scripts/generate_examples.js](scripts/generate_examples.js)
- [scripts/generate_words.py](scripts/generate_words.py)
- [scripts/generate_words_v2.js](scripts/generate_words_v2.js)
- [scripts/generate_words_extension.js](scripts/generate_words_extension.js)
- [scripts/add_synonyms.js](scripts/add_synonyms.js)
- [scripts/words_20k_pipeline.js](scripts/words_20k_pipeline.js)

Why this matters:
- These files are not dead runtime code, but the flat repo layout makes them look that way.

Status:
- Resolved by moving them under `scripts/` and documenting them in the README.

## Positive Checks

- [words.json](words.json) is valid JSON
- All entries currently have example coverage
- No duplicate example sentences were found in the current file
- No additional clearly dead runtime helpers were found in [app.js](app.js) beyond `isAuthenticated()`
- [scripts/validate_words.js](scripts/validate_words.js) passes on the current dataset

## Recommended Next Steps

1. Decide whether specialized C2 vocabulary should stay public or move behind a separate advanced/specialized policy.
2. Continue normalizing weak or awkward example sentences in [words.json](words.json).
3. Run `node scripts/validate_words.js` before committing future dataset imports or bulk cleanup batches.