// Loads and normalizes the genealogy dataset (people/relationships/places/sources/hypotheses)
// into a shape the tree/layout/detail modules can rely on, tolerating the
// pipeline's loosely-typed, evolving JSON. Every technical value is routed
// through js/labels.js for Russian translation; nothing untranslatable is
// ever shown to a visitor (see web-content-manifest-ru.json's rule).

// Genitive, for "29 декабря 1941"; nominative, for a month with no day.
const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];
const MONTHS_RU_NOMINATIVE = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
];

function statusTier(status) {
  if (!status) return "confirmed";
  const s = String(status).toUpperCase();
  if (s === "CONFIRMED" || s === "CONFIRMED_BY_FAMILY" || s === "HIGHLY_PROBABLE") return "confirmed";
  if (s === "HYPOTHESIS") return "hypothesis";
  if (s === "UNKNOWN") return "unknown";
  if (s === "REJECTED") return "rejected";
  return "confirmed";
}

// Fixed two-category system per the pipeline's own README: a hypothesis
// must never be visually merged with a confirmed identity.
function statusLabel(tier) {
  switch (tier) {
    case "confirmed": return "Подтверждено семьёй";
    case "hypothesis": return "Гипотеза";
    case "unknown": return "Не установлено";
    case "rejected": return "Отвергнуто";
    default: return "";
  }
}

function formatOneDate(dateStr, { day, month, year } = {}) {
  if (dateStr) {
    const parts = dateStr.split("-").map(Number);
    year = parts[0]; month = parts[1]; day = parts[2];
  }
  if (!year) return null;
  if (!month) return `${year}`;
  return day
    ? `${day} ${MONTHS_RU[month - 1]} ${year}`
    : `${MONTHS_RU_NOMINATIVE[month - 1]} ${year}`;
}

// Normalizes the many birth/death object shapes (date, year, estimated_range,
// date_unknown, date_variants, approximate, calendar, cause, place_as_recorded,
// status) into one structure the detail view can render in full, plus a
// best-effort single-line summary for compact contexts (tree cards, chronicle).
function normalizeDateFields(obj) {
  if (!obj || typeof obj !== "object") return null;
  const approxPrefix = obj.approximate ? "ок. " : "";
  const oldStyleSuffix = obj.calendar === "old_style" ? " (ст. ст.)" : "";
  let year = null, display = null;

  if (obj.date_unknown) {
    display = null;
  } else if (obj.before) {
    // "born before <date>" — used where only an ordering is known
    // (e.g. an older sibling of someone with a documented birth date).
    const formatted = formatOneDate(obj.before);
    display = formatted ? `до ${formatted}` : null;
  } else if (Array.isArray(obj.date_variants) && obj.date_variants.length) {
    const formatted = obj.date_variants.map(d => formatOneDate(d)).filter(Boolean);
    display = formatted.length ? `${formatted.join(" или ")}${oldStyleSuffix}` : null;
    year = parseInt(String(obj.date_variants[0]).slice(0, 4), 10) || null;
  } else if (obj.estimated_range) {
    display = `ориентировочно ${obj.estimated_range}`;
  } else if (typeof obj.date === "string") {
    display = formatOneDate(obj.date);
    year = parseInt(obj.date.slice(0, 4), 10) || null;
    if (display) display = `${approxPrefix}${display}${oldStyleSuffix}`;
  } else if (typeof obj.year === "number") {
    year = obj.year;
    display = `${approxPrefix}${obj.year}${oldStyleSuffix}`;
  }

  return {
    year,
    display,
    hasVariants: Array.isArray(obj.date_variants) && obj.date_variants.length > 1,
    statusLabel: translateStatusLike(obj.status),
    cause: obj.cause || null,
    raw: obj
  };
}

function yearOnlyDisplay(normalized) {
  if (!normalized || normalized.year == null) return normalized ? normalized.display : null;
  return `${normalized.year}`;
}

function isLikelyLiving(hasDeathRecord, hasMilitaryLoss, normalizedBirth) {
  if (hasDeathRecord || hasMilitaryLoss) return false;
  if (normalizedBirth && normalizedBirth.year != null) {
    return (SITE_CONFIG.currentYear - normalizedBirth.year) < SITE_CONFIG.livingThresholdYears;
  }
  return true; // unknown birth, no death on record: default to the private side
}

function choosePrimaryName(names) {
  if (!names || !names.length) return { display: "Без имени", native: "" };
  const priority = ["primary", "birth", "documentary", "married"];
  for (const type of priority) {
    const match = names.find(n => n.type === type);
    if (match) return match;
  }
  return names[0];
}

function buildPlaceLabel(placeId, placesById) {
  if (!placeId || !placesById.has(placeId)) return null;
  const chain = [];
  let current = placesById.get(placeId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const nameEntry = (current.names || []).find(n => n.type === "modern") || (current.names || [])[0];
    if (nameEntry) chain.push(nameEntry.native || nameEntry.name);
    const parentId = (current.parent_place_ids || [])[0];
    current = parentId ? placesById.get(parentId) : null;
  }
  return chain.join(", ") || null;
}

// residence_history entries record a move between two places. The event name
// arrives as plain Russian ("переезд"); anything else is hidden rather than
// shown untranslated, per the manifest's fallback rule.
function buildResidenceHistory(history, placesById) {
  if (!Array.isArray(history)) return [];
  const moves = [];
  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue;
    const event = isCyrillicText(entry.event) ? entry.event : null;
    const from = entry.from_place_id ? buildPlaceLabel(entry.from_place_id, placesById) : null;
    const to = entry.to_place_id ? buildPlaceLabel(entry.to_place_id, placesById) : null;
    if (!to && !from) continue;
    moves.push({
      event: event || "Переезд",
      from,
      to,
      year: typeof entry.year === "number" ? entry.year : null,
      dateUnknown: !entry.year && !!entry.date_unknown,
      statusLabel: translateStatusLike(entry.status)
    });
  }
  return moves;
}

function resolvePlace(placeId, placeAsRecorded, placesById) {
  if (placeId) return buildPlaceLabel(placeId, placesById);
  return placeAsRecorded || null;
}

// Renders the "attributes" bag (patronymic conflicts, alternative family
// recollections, etc.) as a list of {label, lines} conflict cards, so a
// documented disagreement is shown in full rather than silently resolved.
function buildAttributeConflicts(attributes) {
  if (!attributes) return [];
  const titles = {
    patronymic: "Отчество",
    alternative_family_recollection: "По семейной памяти"
  };
  // A variant the family has explicitly ruled out must not resurface on the
  // site as if it were still an open question.
  const hidden = new Set(["rejected_alternative"]);
  const conflicts = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (!value || typeof value !== "object") continue;
    if (hidden.has(key) || String(value.status).toUpperCase() === "REJECTED") continue;
    // No Russian title for this key means no way to label it without leaking
    // the raw English key — hide it, per the manifest's own fallback rule.
    if (!titles[key]) continue;
    const lines = [];
    if (value.document_text) lines.push({ label: "Запись в документе", text: value.document_text });
    if (value.full_form) lines.push({ label: "Полная форма", text: value.full_form });
    if (value.probable_expansion) lines.push({ label: "Предполагаемая полная форма", text: value.probable_expansion });
    if (value.value) lines.push({ label: "Указано", text: value.value });
    if (!lines.length) continue;
    conflicts.push({
      title: titles[key],
      lines,
      statusLabel: translateStatusLike(value.status)
    });
  }
  return conflicts;
}

function buildMilitary(raw) {
  if (!raw) return null;
  const fieldOrder = [
    ["call_up_date", v => formatOneDate(v)],
    ["call_up_year", v => String(v)],
    ["call_up_authority", v => v],
    ["call_up_place", v => v],
    ["rank", v => v],
    ["unit", v => v],
    ["war", v => v],
    ["role_as_recorded", v => v],
    ["loss_date", v => formatOneDate(v)]
  ];
  const rows = [];
  for (const [key, fmt] of fieldOrder) {
    if (raw[key] == null) continue;
    const label = translate("military", key);
    if (!label) continue;
    rows.push([label, fmt(raw[key])]);
  }
  const statusLabel = translateStatusLike(raw.status);
  return { rows, statusLabel };
}

async function loadFamilyData() {
  // normalizeRuStrings strips hyphens and dashes out of every piece of prose the
  // pipeline sends, at the point it arrives — so the rule holds for future
  // data packs without anyone editing the JSON by hand.
  const load = name => fetch(`data/${name}.json`).then(r => r.json()).then(json => normalizeRuStrings(json));
  // Owner confirmed facts the pipeline has not caught up with yet. Kept in a
  // file the pipeline never writes, so a new data pack cannot undo them.
  const corrections = await fetch("data/site-corrections.json")
    .then(r => (r.ok ? r.json() : null))
    .then(json => (json ? normalizeRuStrings(json) : null))
    .catch(() => null);
  const [peopleRaw, relationshipsRaw, placesRaw, sourcesRaw, hypothesesRaw] = await Promise.all([
    load("people"),
    load("relationships"),
    load("places"),
    load("sources"),
    load("hypotheses"),
    loadUiLabels()
  ]);

  if (corrections && corrections.people) {
    for (const raw of peopleRaw.people || []) {
      const patch = corrections.people[raw.id];
      if (patch) Object.assign(raw, patch);
    }
  }

  const placesById = new Map((placesRaw.places || []).map(p => [p.id, p]));
  const sourcesById = new Map((sourcesRaw.sources || []).map(s => [s.id, s]));

  const people = new Map();
  for (const raw of peopleRaw.people || []) {
    const tier = statusTier(raw.identity_status);
    if (tier === "rejected") continue; // never render rejected identities

    const primaryName = choosePrimaryName(raw.names);
    const nameVariants = (raw.names || []).map(n => ({
      ...n,
      tier: statusTier(n.status),
      typeLabel: translate("name_type", n.type)
    }));

    const birthNorm = normalizeDateFields(raw.birth);
    const deathNorm = normalizeDateFields(raw.death);
    const hasMilitaryLoss = !!(raw.military && raw.military.loss_date);
    const hasDeathRecord = !!raw.death;

    const living = isLikelyLiving(hasDeathRecord, hasMilitaryLoss, birthNorm);

    const birthDisplay = birthNorm ? (living ? yearOnlyDisplay(birthNorm) : birthNorm.display) : null;
    const deathDisplay = deathNorm ? deathNorm.display : null;

    const birthPlace = raw.birth ? resolvePlace(raw.birth.place_id, raw.birth.place_as_recorded, placesById) : null;
    const deathPlace = raw.death ? resolvePlace(raw.death.place_id, raw.death.place_as_recorded, placesById) : null;
    const residencePlace = raw.residence && raw.residence.place_id ? buildPlaceLabel(raw.residence.place_id, placesById) : null;
    const residenceAsRecorded = raw.residence && raw.residence.as_recorded && raw.residence.as_recorded !== residencePlace ? raw.residence.as_recorded : null;
    const militaryLossYear = hasMilitaryLoss ? parseInt(String(raw.military.loss_date).slice(0, 4), 10) : null;
    const moves = buildResidenceHistory(raw.residence_history, placesById);

    people.set(raw.id, {
      id: raw.id,
      sex: raw.sex || null,
      displayName: primaryName.native || primaryName.display,
      nameVariants,
      identityStatus: raw.identity_status || null,
      statusTier: tier,
      candidateRole: translate("candidate_role", raw.candidate_role),
      living,
      birthDisplay,
      birthYear: birthNorm && birthNorm.year != null ? birthNorm.year : null,
      birthPlace,
      birthStatusLabel: birthNorm ? birthNorm.statusLabel : null,
      birthHasVariants: !!(birthNorm && birthNorm.hasVariants),
      residence: raw.residence ? { placeName: residencePlace || raw.residence.as_recorded || null, asRecorded: residenceAsRecorded } : null,
      moves,
      deathDisplay,
      deathYear: deathNorm && deathNorm.year != null ? deathNorm.year : null,
      deathPlace,
      deathCause: deathNorm ? deathNorm.cause : null,
      deathStatusLabel: deathNorm ? deathNorm.statusLabel : null,
      deathHasVariants: !!(deathNorm && deathNorm.hasVariants),
      militaryLossYear,
      hasMilitaryRecord: !!raw.military,
      militaryWar: (raw.military && raw.military.war) || null,
      militaryOutcome: (raw.military && raw.military.status) || null,
      military: buildMilitary(raw.military),
      attributeConflicts: buildAttributeConflicts(raw.attributes),
      notes: raw.notes || [],
      sourceIds: raw.evidence_source_ids || []
    });
  }

  const parentEdgesByChild = new Map();   // childId -> [{parentId, status, tier}]
  const childEdgesByParent = new Map();   // parentId -> [{childId, status, tier}]
  const spouseEdgesByPerson = new Map();  // personId -> [{spouseId, status, tier}]

  for (const rel of relationshipsRaw.relationships || []) {
    const tier = statusTier(rel.status);
    if (tier === "rejected") continue;

    if (rel.type === "biological_parent") {
      if (!people.has(rel.parent_id) || !people.has(rel.child_id)) continue;
      if (!parentEdgesByChild.has(rel.child_id)) parentEdgesByChild.set(rel.child_id, []);
      parentEdgesByChild.get(rel.child_id).push({ parentId: rel.parent_id, status: rel.status, tier });

      if (!childEdgesByParent.has(rel.parent_id)) childEdgesByParent.set(rel.parent_id, []);
      childEdgesByParent.get(rel.parent_id).push({ childId: rel.child_id, status: rel.status, tier });
    } else if (rel.type === "spouse") {
      if (!people.has(rel.person_1_id) || !people.has(rel.person_2_id)) continue;
      const add = (a, b) => {
        if (!spouseEdgesByPerson.has(a)) spouseEdgesByPerson.set(a, []);
        spouseEdgesByPerson.get(a).push({ spouseId: b, status: rel.status, tier });
      };
      add(rel.person_1_id, rel.person_2_id);
      add(rel.person_2_id, rel.person_1_id);
    }
  }

  // The research data records ancestors' marriages, but not the anchor
  // couple's own — they're the reason the site exists, so pair them up
  // even without a formal relationship edge.
  const [anchorA, anchorB] = SITE_CONFIG.anchorPersonIds;
  if (people.has(anchorA) && people.has(anchorB)) {
    const alreadyPaired = (spouseEdgesByPerson.get(anchorA) || []).some(e => e.spouseId === anchorB);
    if (!alreadyPaired) {
      const addAnchorPair = (a, b) => {
        if (!spouseEdgesByPerson.has(a)) spouseEdgesByPerson.set(a, []);
        spouseEdgesByPerson.get(a).push({ spouseId: b, status: "CONFIRMED", tier: "confirmed" });
      };
      addAnchorPair(anchorA, anchorB);
      addAnchorPair(anchorB, anchorA);
    }
  }

  return {
    people,
    parentEdgesByChild,
    childEdgesByParent,
    spouseEdgesByPerson,
    placesById,
    sourcesById,
    hypotheses: hypothesesRaw.hypotheses || []
  };
}
