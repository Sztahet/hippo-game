# Scripts

Offline tooling lives in this directory so the repo root stays focused on runtime files.

- `build.js` - generates `bundle.html` from the live runtime files.
- `generate_examples.js` - fills missing example sentences in `words.json`.
- `generate_words_extension.js` - legacy dataset extension script.
- `generate_words_v2.js` - legacy bulk dataset generation script.
- `add_synonyms.js` - legacy synonym-expansion script.
- `words_20k_pipeline.js` - bulk import and cleanup pipeline for larger vocabulary sources.
- `validate_words.js` - validates `words.json` for duplicate examples and known bad historical artifacts.
- `generate_words.py` - archival generator for the original seed dataset.