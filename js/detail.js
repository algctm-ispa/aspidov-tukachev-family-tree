// Renders the slide-in detail panel content for one person.

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CANDIDATE_ROLE_RU = {
  "father_of": "предполагаемый отец",
  "mother_of": "предполагаемая мать"
};

function humanizeCandidateRole(role) {
  if (!role) return "";
  return role.replace(/_/g, " ");
}

function tierBadge(tier) {
  return `<span class="badge badge-${tier}">${statusLabel(tier)}</span>`;
}

function buildPersonFormUrl(person) {
  const cfg = SITE_CONFIG.correctionForm;
  if (!cfg.ready || !cfg.baseUrl || !cfg.personEntryId) return null;
  const label = `${person.displayName} — id: ${person.id}`;
  const url = new URL(cfg.baseUrl);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(cfg.personEntryId, label);
  return url.toString();
}

function renderNameVariants(person) {
  if (!person.nameVariants || person.nameVariants.length < 2) return "";
  const items = person.nameVariants.map(n => `
    <li>
      <span class="variant-name">${escapeHtml(n.native || n.display)}</span>
      ${n.tier && n.tier !== "confirmed" ? tierBadge(n.tier) : ""}
    </li>`).join("");
  return `
    <section class="detail-block">
      <h4>Варианты имени</h4>
      <ul class="variant-list">${items}</ul>
    </section>`;
}

function renderMilitary(person) {
  const m = person.military;
  if (!m) return "";
  const rows = [
    m.call_up_date ? ["Призван", `${escapeHtml(m.call_up_date)}${m.call_up_authority ? ` (${escapeHtml(m.call_up_authority)})` : ""}`] : null,
    m.role_as_recorded ? ["Должность", escapeHtml(m.role_as_recorded)] : null,
    m.status ? ["Судьба", escapeHtml(m.status === "missing_in_action" ? "пропал без вести" : m.status)] : null,
    m.loss_date ? ["Дата потери", escapeHtml(m.loss_date)] : null
  ].filter(Boolean);
  return `
    <section class="detail-block">
      <h4>Военная служба</h4>
      <dl class="kv-list">
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
      </dl>
    </section>`;
}

function renderSources(person, familyData) {
  if (!person.sourceIds || !person.sourceIds.length) return "";
  const items = person.sourceIds
    .map(id => familyData.sourcesById.get(id))
    .filter(Boolean)
    .map(src => `
      <li>
        ${src.url ? `<a href="${escapeHtml(src.url)}" target="_blank" rel="noopener">${escapeHtml(src.title)}</a>` : escapeHtml(src.title)}
        <span class="source-quality">${escapeHtml(src.source_quality || "")}</span>
      </li>`).join("");
  return `
    <section class="detail-block">
      <h4>Источники</h4>
      <ul class="source-list">${items}</ul>
    </section>`;
}

function renderPersonDetail(person, familyData) {
  const formUrl = buildPersonFormUrl(person);
  const ctaHtml = formUrl
    ? `<a class="cta-button" href="${escapeHtml(formUrl)}" target="_blank" rel="noopener">Изменить фото / данные</a>`
    : `<button class="cta-button cta-pending" type="button" disabled>Форма скоро появится</button>`;

  const dates = [];
  if (person.birthDisplay) dates.push(`<div><span class="date-label">Родился(ась)</span> ${escapeHtml(person.birthDisplay)}${person.birthPlace ? `, ${escapeHtml(person.birthPlace)}` : ""}</div>`);
  if (person.living && person.birthDisplay) dates.push(`<p class="privacy-note">Показан только год рождения — из уважения к приватности.</p>`);
  if (person.deathDisplay) dates.push(`<div><span class="date-label">Умер(ла)</span> ${escapeHtml(person.deathDisplay)}</div>`);
  if (person.residence && person.residence.placeName) dates.push(`<div><span class="date-label">Проживал(а)</span> ${escapeHtml(person.residence.placeName)}</div>`);

  const notesHtml = person.notes && person.notes.length
    ? `<section class="detail-block"><h4>Заметки исследования</h4>${person.notes.map(n => `<p class="research-note">${escapeHtml(n)}</p>`).join("")}</section>`
    : "";

  const candidateHtml = person.candidateRole
    ? `<p class="candidate-role">Предполагаемая роль в древе: ${escapeHtml(humanizeCandidateRole(person.candidateRole))}</p>`
    : "";

  return `
    <div class="detail-header">
      <h2>${escapeHtml(person.displayName)}</h2>
      ${tierBadge(person.statusTier)}
    </div>
    ${candidateHtml}
    <div class="detail-dates">${dates.join("")}</div>
    ${renderMilitary(person)}
    ${renderNameVariants(person)}
    ${notesHtml}
    ${renderSources(person, familyData)}
    <div class="detail-cta">${ctaHtml}</div>
  `;
}
