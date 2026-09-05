// Translates every technical/English value the research pipeline uses into
// Russian via the pipeline's own ui-labels-ru.json dictionary. Per that
// file's own fallback rule: if a value has no Russian translation, hide it
// rather than showing the raw English/enum text.

let UI_LABELS = null;

async function loadUiLabels() {
  UI_LABELS = await fetch("data/ui-labels-ru.json").then(r => r.json());
  return UI_LABELS;
}

function isCyrillicText(value) {
  return typeof value === "string" && /[а-яА-ЯёЁ]/.test(value);
}

// Looks up `value` in UI_LABELS[dict]. If the value is already Russian
// prose (some records store plain Russian text instead of an enum key),
// it's shown as-is. Otherwise: translated label, or null to hide it.
function translate(dict, value) {
  if (value == null || value === "") return null;
  if (isCyrillicText(value)) return value;
  const table = UI_LABELS && UI_LABELS[dict];
  return (table && table[value]) || null;
}

// Status-like values appear in several different dictionaries depending on
// where they came from (identity/relationship status vs. a military status
// code); try them in order and fall back to the plain-Russian-text case.
function translateStatusLike(value) {
  return translate("status", value) || translate("military", value) || (isCyrillicText(value) ? value : null);
}
