// Renders the modal dialog content for one person.

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function humanizeCandidateRole(role) {
  if (!role) return "";
  return role.replace(/_/g, " ");
}

function tierBadge(tier) {
  return `<span class="tag tag-${tier}">${statusLabel(tier)}</span>`;
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

function buildNewRelativeFormUrl() {
  const cfg = SITE_CONFIG.correctionForm;
  if (!cfg.ready || !cfg.baseUrl || !cfg.personEntryId) return null;
  const url = new URL(cfg.baseUrl);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(cfg.personEntryId, "Новый родственник (пока не в древе)");
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
    <section class="dialog-section">
      <h6>Варианты имени</h6>
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
    <section class="dialog-section">
      <h6>Военная служба</h6>
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
    <section class="dialog-section">
      <h6>Источники</h6>
      <ul class="source-list">${items}</ul>
    </section>`;
}

function renderPersonDetail(person, familyData, kinshipLabel, hasPhoto) {
  const formUrl = buildPersonFormUrl(person);
  const newRelativeUrl = buildNewRelativeFormUrl();

  const dates = [];
  if (person.birthDisplay) dates.push(`<div><span class="date-label">Родился(ась)</span> ${escapeHtml(person.birthDisplay)}${person.birthPlace ? `, ${escapeHtml(person.birthPlace)}` : ""}</div>`);
  if (person.living && person.birthDisplay) dates.push(`<p class="privacy-note">Показан только год рождения — из уважения к приватности.</p>`);
  if (person.deathDisplay) dates.push(`<div><span class="date-label">Умер(ла)</span> ${escapeHtml(person.deathDisplay)}</div>`);
  if (person.residence && person.residence.placeName) dates.push(`<div><span class="date-label">Проживал(а)</span> ${escapeHtml(person.residence.placeName)}</div>`);

  const notesHtml = person.notes && person.notes.length
    ? `<section class="dialog-section"><h6>Заметки исследования</h6>${person.notes.map(n => `<p class="research-note">${escapeHtml(n)}</p>`).join("")}</section>`
    : "";

  const candidateHtml = person.candidateRole
    ? `<p class="candidate-role">Предполагаемая роль в древе: ${escapeHtml(humanizeCandidateRole(person.candidateRole))}</p>`
    : "";

  const photoHtml = hasPhoto
    ? `<div class="dialog-photo grayscale"><img src="${personPhotoUrl(person.id)}" alt="${escapeHtml(person.displayName)}"></div>`
    : "";

  return `
    <div class="dialog-head">
      <div>
        <div class="dialog-kicker">${escapeHtml(kinshipLabel)}</div>
        <div class="dialog-title">${escapeHtml(person.displayName)}</div>
      </div>
      <button class="btn btn-secondary btn-icon dialog-close" type="button" aria-label="Закрыть">×</button>
    </div>
    <div class="hr"></div>
    ${photoHtml}
    ${candidateHtml}
    <div class="dialog-dates">${dates.join("")}</div>
    ${renderMilitary(person)}
    ${renderNameVariants(person)}
    ${notesHtml}
    ${renderSources(person, familyData)}
    <div class="dialog-actions">
      <a class="btn btn-primary btn-block" href="${escapeHtml(formUrl || "#")}" target="_blank" rel="noopener">Изменить данные или добавить фото</a>
      <a class="btn btn-secondary btn-block" href="${escapeHtml(newRelativeUrl || "#")}" target="_blank" rel="noopener">Добавить нового родственника</a>
    </div>
    <div class="text-muted dialog-footnote">Форма откроется в новой вкладке и уже будет подписана нужным человеком.</div>
  `;
}

function renderNewRelativeDialog() {
  const url = buildNewRelativeFormUrl();
  return `
    <div class="dialog-head">
      <div>
        <div class="dialog-kicker">Новый родственник</div>
        <div class="dialog-title">Кого мы ещё не записали?</div>
      </div>
      <button class="btn btn-secondary btn-icon dialog-close" type="button" aria-label="Закрыть">×</button>
    </div>
    <div class="hr"></div>
    <div class="dialog-dates">
      <div>Имя, отчество, годы жизни — всё, что знаете.</div>
      <div>Где родился, где жил, чья это линия — Владимира или Людмилы.</div>
    </div>
    <div class="dialog-actions">
      <a class="btn btn-primary btn-block" href="${escapeHtml(url || "#")}" target="_blank" rel="noopener">Открыть форму</a>
    </div>
    <div class="text-muted dialog-footnote">Напишите даже одно имя: мы проверим и добавим человека в древо вручную.</div>
  `;
}
