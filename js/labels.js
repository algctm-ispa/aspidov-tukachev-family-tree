// Translates every technical/English value the research pipeline uses into
// Russian via the pipeline's own ui-labels-ru.json dictionary. Per that
// file's own fallback rule: if a value has no Russian translation, hide it
// rather than showing the raw English/enum text.

let UI_LABELS = null;

async function loadUiLabels() {
  UI_LABELS = await fetch("data/ui-labels-ru.json").then(r => r.json());
  return UI_LABELS;
}

// Site owned Russian labels for enum values the pipeline dictionary does not
// cover yet. Kept separate so a new data pack never overwrites them, and
// merged per dictionary so nothing the pipeline does translate is replaced.
function applyLabelOverlay(overlay) {
  if (!overlay || !UI_LABELS) return;
  for (const [dict, table] of Object.entries(overlay)) {
    if (!table || typeof table !== "object") continue;
    UI_LABELS[dict] = Object.assign({}, table, UI_LABELS[dict] || {});
  }
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

// ---------------------------------------------------------------------------
// Typography: the site shows no hyphens or dashes in running text. The research
// pipeline writes ranges as "1900–1978" and uses "—" as a sentence dash, so
// every string that arrives from the data files is rewritten here rather than
// edited in the JSON — that way the rule survives the next data import.
//
// Hyphens Russian orthography requires are left alone: they sit inside a word
// with no spaces around them (коми-пермяцкого, 1990-е, 46-я, Иоанно-Предтеченская).
// ---------------------------------------------------------------------------

const DASHES = "\u2010\u2011\u2012\u2013\u2014\u2015";

function ruText(value) {
  let s = String(value);

  // Park machine dates so a range rule never chews through 1935-01-03.
  const parked = [];
  s = s.replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g, m => `\u0000${parked.push(m) - 1}\u0000`);

  // Any range whose two ends both carry a number becomes words:
  // 1900–1978 -> с 1900 по 1978, л. 30об.–34 -> л. с 30об. по 34.
  // "1990-е" and "46-я" never match: their right side has no digit.
  const TOKEN = `[^\\s\\/${DASHES}-]*\\d[^\\s\\/${DASHES}-]*`;
  s = s.replace(new RegExp(`(${TOKEN})\\s*[${DASHES}-]\\s*(${TOKEN})`, "g"), "с $1 по $2");
  // A dash standing as sentence punctuation becomes a comma.
  s = s.replace(new RegExp(`\\s+[${DASHES}-]\\s+`, "g"), ", ");
  // A dash opening a line is just a list marker.
  s = s.replace(new RegExp(`^[${DASHES}-]\\s+`), "");
  // Anything still left is a dash we have no better reading for.
  s = s.replace(new RegExp(`\\s*[${DASHES}]\\s*`, "g"), ", ");

  // Tidy up what the substitutions leave behind.
  s = s.replace(/(?:ок\.|около)\s+с\s+/g, "примерно с ")
       .replace(/\/с /g, " и с ")
       .replace(/,\s*,/g, ",")
       .replace(/,\s*([.;:!?»)])/g, "$1")
       .replace(/\(\s*,\s*/g, "(")
       .replace(/\s{2,}/g, " ");

  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => parked[Number(i)]).trim();
}

// Keys whose values are machine readable and must never be rewritten.
const RU_TEXT_SKIP_KEYS = new Set([
  "id", "url", "schema_version", "type", "status", "sex", "calendar", "category",
  "quality", "source_id", "place_id", "parent_id", "child_id", "person_id",
  "spouse_id", "from_place_id", "to_place_id", "candidate_role", "identity_status",
  "date", "before", "loss_date", "call_up_date", "date_precision",
  "loss_date_precision", "graduation_year_unknown", "specialty_unknown"
]);

const ISO_LIKE = /^\d{4}(-\d{2}){0,2}$/;
const ENUM_LIKE = /^[A-Za-z][A-Za-z0-9_.]*$/;

function normalizeRuStrings(node, key) {
  if (typeof node === "string") {
    if (key && (RU_TEXT_SKIP_KEYS.has(key) || key.endsWith("_id") || key.endsWith("_ids"))) return node;
    if (ISO_LIKE.test(node) || ENUM_LIKE.test(node)) return node;
    if (/^https?:\/\//i.test(node)) return node;
    return ruText(node);
  }
  if (Array.isArray(node)) return node.map(v => normalizeRuStrings(v, key));
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) node[k] = normalizeRuStrings(node[k], k);
    return node;
  }
  return node;
}
