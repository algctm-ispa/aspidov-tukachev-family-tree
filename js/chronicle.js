// Builds the "Хроника рода" timeline from real dated events in the data
// (births, deaths, military losses) plus the fixed anniversary — instead of
// a hand-picked list, so it grows on its own as Codex confirms more dates.

// Fixed events the family confirms directly, kept alongside the dated events
// the renderer derives from the genealogy data itself.
const FIXED_EVENTS = [
  {
    year: 1986,
    tier: "confirmed",
    text: "6 сентября в Перми поженились Владимир Витальевич Аспидов и Людмила Михайловна Тукачёва"
  },
  {
    year: 2026,
    tier: "confirmed",
    text: "6 сентября рубиновая свадьба, сорок лет вместе"
  }
];

// Where a loss happened, in the genitive the phrase needs. Only two wars occur
// in this family's records, so their forms are spelled out; anything else is
// appended as its own clause rather than forced into a case we cannot derive.
const WAR_GENITIVE = {
  "Великая Отечественная война": "Великой Отечественной войны",
  "Первая мировая война": "Первой мировой войны"
};

function lossSetting(year, war) {
  if (war) {
    const genitive = WAR_GENITIVE[war];
    return genitive ? `на фронте ${genitive}` : `на фронте, ${war}`;
  }
  // A loss recorded in these years is a loss at the front.
  if (year >= 1941 && year <= 1945) return "на фронте Великой Отечественной войны";
  if (year >= 1939 && year <= 1945) return "на фронте";
  return "на службе";
}

function buildChronicleEvents(familyData) {
  const events = [];

  for (const person of familyData.people.values()) {
    // A withheld name has no place in a narrative timeline: every line here
    // names someone, and these people asked not to be named.
    if (person.nameWithheld) continue;
    // Russian marks gender on the verb, so each line is built from the
    // person's recorded sex rather than falling back on "родился(ась)".
    const female = person.sex === "female";
    if (person.birthYear != null) {
      events.push({
        year: person.birthYear,
        tier: person.statusTier,
        text: `${female ? "Родилась" : "Родился"} ${person.displayName}${person.birthPlace ? `, ${person.birthPlace}` : ""}`
      });
    }
    // A wartime loss is told once, as a loss, not twice as a death and a
    // separate line about service.
    const lossYear = person.militaryLossYear != null ? person.militaryLossYear : person.deathYear;
    const inWarYears = lossYear != null && lossYear >= 1939 && lossYear <= 1945;
    const wasKilled = String(person.militaryOutcome || "").includes("killed");
    const wentMissing = String(person.militaryOutcome || "").includes("missing")
      || /пропал/i.test(person.deathStatusLabel || "");
    // A military record settles it. Failing that, a man lost in the war years
    // was almost certainly lost at the front, which is how the family reads it.
    const isWartimeLoss = lossYear != null
      && (person.hasMilitaryRecord || ((wentMissing || !female) && inWarYears));

    if (isWartimeLoss) {
      const where = lossSetting(lossYear, person.militaryWar);
      // Only say how someone died when a record says so; otherwise the honest
      // phrasing is that he did not come back.
      const verb = wasKilled
        ? (female ? "погибла" : "погиб")
        : wentMissing
          ? (female ? "пропала без вести" : "пропал без вести")
          : (female ? "не вернулась с фронта" : "не вернулся с фронта");
      const text = verb.includes("фронта")
        ? `${person.displayName} ${verb}`
        : `${person.displayName} ${verb} ${where}`;
      events.push({ year: lossYear, tier: person.statusTier, text });
    } else if (person.deathYear != null) {
      events.push({
        year: person.deathYear,
        tier: person.statusTier,
        text: `${female ? "Умерла" : "Умер"} ${person.displayName}`
      });
    }
  }

  events.push(...FIXED_EVENTS);
  events.sort((a, b) => a.year - b.year);
  return events;
}

function renderChronicle(familyData) {
  const container = document.getElementById("chronicle-track");
  if (!container) return;
  const events = buildChronicleEvents(familyData);
  container.innerHTML = events.map(ev => `
    <div class="chronicle-item tier-${ev.tier}">
      <div class="chronicle-year">${ev.year}</div>
      <div class="chronicle-text">${escapeHtml(ev.text)}</div>
    </div>`).join("");
}

// ---------------------------------------------------------------------------
// Древо в цифрах
// ---------------------------------------------------------------------------

// Русский счёт: 1 человек, 2 человека, 5 человек. Числа здесь считаются из
// данных, поэтому окончание нельзя зашить в разметку.
function pluralRu(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

// Ничего не задано вручную: каждый показатель пересчитывается при загрузке,
// поэтому новая выгрузка меняет цифры сама.
function buildStats(familyData) {
  const people = [...familyData.people.values()];
  const stats = [];

  const total = people.length;
  stats.push({
    value: String(total),
    label: `${pluralRu(total, ["человек", "человека", "человек"])} в древе`
  });

  const years = people.map(p => p.birthYear).filter(y => typeof y === "number");
  if (years.length) {
    stats.push({
      value: `с ${Math.min(...years)} по ${Math.max(...years)}`,
      label: "годы рождения",
      wide: true
    });
  }

  const places = new Set(people.map(p => p.birthPlace).filter(Boolean));
  if (places.size) {
    stats.push({
      value: String(places.size),
      label: `${pluralRu(places.size, ["место", "места", "мест"])}, откуда мы`
    });
  }

  const sources = familyData.sourcesById ? familyData.sourcesById.size : 0;
  if (sources) {
    stats.push({
      value: String(sources),
      label: `${pluralRu(sources, ["документ", "документа", "документов"])} и ${pluralRu(sources, ["свидетельство", "свидетельства", "свидетельств"])}`
    });
  }

  return stats;
}

function renderStats(familyData) {
  const container = document.getElementById("stats");
  if (!container) return;
  const stats = buildStats(familyData);
  container.innerHTML = stats.map(s => `
    <div class="stat-cell${s.wide ? " is-wide" : ""}">
      <div class="stat-number">${escapeHtml(s.value)}</div>
      <div class="stat-label">${escapeHtml(s.label)}</div>
    </div>`).join("");
}
