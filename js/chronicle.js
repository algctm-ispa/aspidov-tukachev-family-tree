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

function buildChronicleEvents(familyData) {
  const events = [];

  for (const person of familyData.people.values()) {
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
    if (person.deathYear != null) {
      events.push({
        year: person.deathYear,
        tier: person.statusTier,
        text: `${female ? "Умерла" : "Умер"} ${person.displayName}`
      });
    }
    if (person.militaryLossYear != null) {
      events.push({
        year: person.militaryLossYear,
        tier: person.statusTier,
        text: `${person.displayName} ${female ? "пропала" : "пропал"} без вести на службе`
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
