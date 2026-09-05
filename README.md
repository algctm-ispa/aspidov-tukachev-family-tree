# Родословное древо Аспидовых — Тукачёвых

Static site, no build step. Ruby-wedding gift family tree, deployed via GitHub Pages.

## Updating the data

When the Codex research pipeline produces new/updated genealogy data:

1. Copy the new `people.json`, `relationships.json`, `places.json`, `sources.json`, `hypotheses.json` into `data/`, overwriting the old ones.
2. Commit and push. GitHub Pages redeploys automatically — no build step.

The site tolerates sparse/inconsistent fields by design (see `js/data.js`), and computes the tree layout from `relationships.json` at load time (see `js/layout.js`), so new people/generations just work without code changes — as long as new people connect to the existing tree via a relationship. Anyone who doesn't (yet) connect shows up in the "не удалось разместить" list below the tree instead of silently vanishing.

## Correction/photo submissions

The per-person "Изменить фото / данные" button opens a pre-filled Google Form (configured in `js/config.js` → `correctionForm`). Responses land in the linked Google Sheet, already tagged with the exact person. Review them and update the JSON data accordingly.
