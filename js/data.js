// Loads and normalizes the genealogy dataset (people/relationships/places/sources/hypotheses)
// into a shape the tree/layout/detail modules can rely on, tolerating the
// pipeline's loosely-typed, evolving JSON.

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
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

function statusLabel(tier) {
  switch (tier) {
    case "confirmed": return "Подтверждено";
    case "hypothesis": return "Предположение";
    case "unknown": return "Не установлено";
    case "rejected": return "Отклонено";
    default: return "";
  }
}

// Normalizes the many birth/death object shapes into {year, month, day, approximate, dateUnknown, oldStyle, raw}
function normalizeDateFields(obj) {
  if (!obj || typeof obj !== "object") return null;
  const out = {
    year: null, month: null, day: null,
    approximate: !!obj.approximate,
    dateUnknown: !!obj.date_unknown,
    oldStyle: obj.calendar === "old_style",
    raw: obj
  };
  if (typeof obj.year === "number") out.year = obj.year;
  if (typeof obj.date === "string") {
    const parts = obj.date.split("-").map(Number);
    if (parts[0]) out.year = parts[0];
    if (parts[1]) out.month = parts[1];
    if (parts[2]) out.day = parts[2];
  }
  return out;
}

function formatDate(normalized, { yearOnly = false } = {}) {
  if (!normalized) return null;
  if (normalized.dateUnknown) return null;
  if (normalized.year == null) return null;

  const approxPrefix = normalized.approximate ? "ок. " : "";
  const oldStyleSuffix = normalized.oldStyle ? " (ст. ст.)" : "";

  if (yearOnly || normalized.month == null) {
    return `${approxPrefix}${normalized.year}${oldStyleSuffix}`;
  }
  const monthName = MONTHS_RU[normalized.month - 1];
  if (normalized.day) {
    return `${approxPrefix}${normalized.day} ${monthName} ${normalized.year}${oldStyleSuffix}`;
  }
  return `${approxPrefix}${monthName} ${normalized.year}${oldStyleSuffix}`;
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

async function loadFamilyData() {
  const [peopleRaw, relationshipsRaw, placesRaw, sourcesRaw, hypothesesRaw] = await Promise.all([
    fetch("data/people.json").then(r => r.json()),
    fetch("data/relationships.json").then(r => r.json()),
    fetch("data/places.json").then(r => r.json()),
    fetch("data/sources.json").then(r => r.json()),
    fetch("data/hypotheses.json").then(r => r.json())
  ]);

  const placesById = new Map((placesRaw.places || []).map(p => [p.id, p]));
  const sourcesById = new Map((sourcesRaw.sources || []).map(s => [s.id, s]));

  const people = new Map();
  for (const raw of peopleRaw.people || []) {
    const tier = statusTier(raw.identity_status);
    if (tier === "rejected") continue; // never render rejected identities

    const primaryName = choosePrimaryName(raw.names);
    const nameVariants = (raw.names || []).map(n => ({
      ...n,
      tier: statusTier(n.status)
    }));

    const birthNorm = normalizeDateFields(raw.birth);
    const deathNorm = normalizeDateFields(raw.death);
    const hasMilitaryLoss = !!(raw.military && raw.military.loss_date);
    const hasDeathRecord = !!raw.death;

    const living = isLikelyLiving(hasDeathRecord, hasMilitaryLoss, birthNorm);

    const birthDisplay = birthNorm ? formatDate(birthNorm, { yearOnly: living }) : null;
    const deathDisplay = deathNorm ? formatDate(deathNorm, { yearOnly: false }) : null;

    const birthPlace = raw.birth && raw.birth.place_id ? buildPlaceLabel(raw.birth.place_id, placesById) : null;
    const residencePlace = raw.residence && raw.residence.place_id ? buildPlaceLabel(raw.residence.place_id, placesById) : null;
    const militaryLossYear = hasMilitaryLoss ? parseInt(raw.military.loss_date.slice(0, 4), 10) : null;

    people.set(raw.id, {
      id: raw.id,
      sex: raw.sex || null,
      displayName: primaryName.native || primaryName.display,
      nameVariants,
      identityStatus: raw.identity_status || null,
      statusTier: tier,
      candidateRole: raw.candidate_role || null,
      living,
      birthDisplay,
      birthYear: birthNorm && birthNorm.year != null ? birthNorm.year : null,
      birthPlace,
      residence: raw.residence ? { placeName: residencePlace, asRecorded: raw.residence.as_recorded || null } : null,
      deathDisplay,
      deathYear: deathNorm && deathNorm.year != null ? deathNorm.year : null,
      militaryLossYear,
      military: raw.military || null,
      attributes: raw.attributes || null,
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
