// Builds the "Хроника рода" timeline from real dated events in the data
// (births, deaths, military losses) plus the fixed anniversary — instead of
// a hand-picked list, so it grows on its own as Codex confirms more dates.

const ANNIVERSARY_EVENT = {
  year: 2026,
  tier: "confirmed",
  text: "6 сентября — рубиновая свадьба, 40 лет вместе"
};

function buildChronicleEvents(familyData) {
  const events = [];

  for (const person of familyData.people.values()) {
    if (person.birthYear != null) {
      events.push({
        year: person.birthYear,
        tier: person.statusTier,
        text: `Родился(ась) ${person.displayName}${person.birthPlace ? ` — ${person.birthPlace}` : ""}`
      });
    }
    if (person.deathYear != null) {
      events.push({
        year: person.deathYear,
        tier: person.statusTier,
        text: `Не стало ${person.displayName}`
      });
    }
    if (person.militaryLossYear != null) {
      events.push({
        year: person.militaryLossYear,
        tier: person.statusTier,
        text: `${person.displayName} пропал(а) без вести на службе`
      });
    }
  }

  events.push(ANNIVERSARY_EVENT);
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
