// Live "gaps in the tree" numbers — computed from the real dataset instead
// of hand-typed, so they stay honest as Codex adds or confirms more people.

async function renderGapStats(familyData) {
  const withPhoto = await computePhotoAvailability(familyData);
  let missingPhoto = 0, missingDate = 0, unconfirmed = 0;

  for (const person of familyData.people.values()) {
    if (!withPhoto.has(person.id)) missingPhoto++;
    if (!person.birthDisplay) missingDate++;
    if (person.statusTier !== "confirmed") unconfirmed++;
  }

  const table = document.getElementById("gap-stats");
  if (!table) return;
  table.innerHTML = `
    <tr><td style="padding-left:0">Без фотографии</td><td class="stat-value">${missingPhoto}</td></tr>
    <tr><td style="padding-left:0">Без даты рождения</td><td class="stat-value">${missingDate}</td></tr>
    <tr style="border-bottom:0"><td style="padding-left:0;border-bottom:0">Ждут подтверждения</td><td class="stat-value" style="border-bottom:0">${unconfirmed}</td></tr>
  `;
}
