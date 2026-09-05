// Renders the modal dialog content for one person.

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function tierBadge(tier) {
  return `<span class="tag tag-${tier}">${statusLabel(tier)}</span>`;
}

function buildPersonFormUrl(person) {
  const cfg = SITE_CONFIG.correctionForm;
  if (!cfg.ready || !cfg.baseUrl || !cfg.personEntryId) return null;
  const label = `${person.displayName} · id: ${person.id}`;
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
      ${n.typeLabel ? `<span class="variant-type">${escapeHtml(n.typeLabel)}</span>` : ""}
      ${n.tier && n.tier !== "confirmed" ? tierBadge(n.tier) : ""}
    </li>`).join("");
  return `
    <section class="dialog-section">
      <h6>Варианты имени</h6>
      <ul class="variant-list">${items}</ul>
    </section>`;
}

// Documented conflicts (patronymic disagreements, alternative family
// recollections) are shown side by side rather than silently resolved.
function renderAttributeConflicts(person) {
  if (!person.attributeConflicts || !person.attributeConflicts.length) return "";
  const cards = person.attributeConflicts.map(c => `
    <div class="conflict-card">
      <div class="conflict-title">${escapeHtml(c.title)}${c.statusLabel ? ` <span class="tag tag-hypothesis">${escapeHtml(c.statusLabel)}</span>` : ""}</div>
      ${c.lines.map(l => `<div class="conflict-line"><span class="conflict-label">${escapeHtml(l.label)}:</span> «${escapeHtml(l.text)}»</div>`).join("")}
    </div>`).join("");
  return `
    <section class="dialog-section">
      <h6>Противоречивые сведения</h6>
      ${cards}
    </section>`;
}

function renderMilitary(person) {
  const m = person.military;
  if (!m || !m.rows.length) return "";
  return `
    <section class="dialog-section">
      <h6>Военная служба</h6>
      <dl class="kv-list">
        ${m.rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("")}
      </dl>
      ${m.statusLabel ? `<div class="military-status tag tag-hypothesis">${escapeHtml(m.statusLabel)}</div>` : ""}
    </section>`;
}

function renderSources(person, familyData) {
  if (!person.sourceIds || !person.sourceIds.length) return "";
  const items = person.sourceIds
    .map(id => familyData.sourcesById.get(id))
    .filter(Boolean)
    .map(src => {
      const category = translate("source_category", src.category);
      const quality = translate("source_quality", src.source_quality);
      const extraLinks = (src.document_urls || [])
        .filter(d => d.url)
        .map(d => {
          const typeLabel = translate("source_link_type", d.type);
          return `<a class="source-link" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">${escapeHtml(typeLabel || d.note || "Открыть источник")}</a>`;
        }).join("");
      return `
        <li>
          <div class="source-title">${escapeHtml(src.title)}</div>
          <div class="source-tags">
            ${category ? `<span class="tag tag-outline">${escapeHtml(category)}</span>` : ""}
            ${quality ? `<span class="tag tag-outline">${escapeHtml(quality)}</span>` : ""}
          </div>
          ${(src.notes || []).map(n => `<p class="research-note">${escapeHtml(n)}</p>`).join("")}
          <div class="source-links">
            ${src.url ? `<a class="source-link" href="${escapeHtml(src.url)}" target="_blank" rel="noopener">Открыть источник</a>` : ""}
            ${extraLinks}
          </div>
        </li>`;
    }).join("");
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
  if (person.birthDisplay) {
    dates.push(`<div><span class="date-label">Дата рождения</span> ${escapeHtml(person.birthDisplay)}${person.birthPlace ? `, ${escapeHtml(person.birthPlace)}` : ""}${person.birthStatusLabel ? ` <span class="tag tag-outline">${escapeHtml(person.birthStatusLabel)}</span>` : ""}</div>`);
  }
  if (person.living && person.birthDisplay) dates.push(`<p class="privacy-note">Показан только год рождения, из уважения к приватности.</p>`);
  if (person.deathDisplay) {
    const variantNote = person.deathStatusLabel ? ` <span class="tag tag-hypothesis">${escapeHtml(person.deathStatusLabel)}</span>` : "";
    dates.push(`<div><span class="date-label">Дата смерти</span> ${escapeHtml(person.deathDisplay)}${person.deathPlace ? `, ${escapeHtml(person.deathPlace)}` : ""}${person.deathCause ? `, ${escapeHtml(person.deathCause)}` : ""}${variantNote}</div>`);
  }
  if (person.residence && person.residence.placeName) {
    const asRecordedNote = person.residence.asRecorded ? ` <span class="text-muted">(в документе: «${escapeHtml(person.residence.asRecorded)}»)</span>` : "";
    dates.push(`<div><span class="date-label">Место жительства</span> ${escapeHtml(person.residence.placeName)}${asRecordedNote}</div>`);
  }

  for (const move of person.moves || []) {
    const route = move.from && move.to ? `${move.from} → ${move.to}` : (move.to || move.from);
    const when = move.year
      ? `, ${move.year} год`
      : (move.dateUnknown ? ` <span class="text-muted">(дата неизвестна)</span>` : "");
    const label = move.event.charAt(0).toUpperCase() + move.event.slice(1);
    dates.push(`<div><span class="date-label">${escapeHtml(label)}</span> ${escapeHtml(route)}${when}</div>`);
  }

  const notesHtml = person.notes && person.notes.length
    ? `<section class="dialog-section"><h6>Заметки исследования</h6>${person.notes.map(n => `<p class="research-note">${escapeHtml(n)}</p>`).join("")}</section>`
    : "";

  const candidateHtml = person.candidateRole
    ? `<p class="candidate-role">${escapeHtml(person.candidateRole)}</p>`
    : "";

  const photoHtml = hasPhoto
    ? `<div class="dialog-photo"><img src="${personPhotoUrl(person.id)}" alt="${escapeHtml(person.displayName)}"></div>`
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
    <div class="dialog-layout${photoHtml ? "" : " is-textonly"}">
      ${photoHtml}
      <div class="dialog-main">
      ${candidateHtml}
      <div class="dialog-dates">${dates.join("")}</div>
        ${renderAttributeConflicts(person)}
        ${renderMilitary(person)}
        ${renderNameVariants(person)}
        ${notesHtml}
        ${renderSources(person, familyData)}
        <div class="dialog-actions">
          <a class="btn btn-primary btn-block" href="${escapeHtml(formUrl || "#")}" target="_blank" rel="noopener">Изменить данные или добавить фото</a>
          <a class="btn btn-secondary btn-block" href="${escapeHtml(newRelativeUrl || "#")}" target="_blank" rel="noopener">Добавить нового родственника</a>
        </div>
        <div class="text-muted dialog-footnote">Форма откроется в новой вкладке и уже будет подписана нужным человеком.</div>
      </div>
    </div>
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
      <div>Имя, отчество, годы жизни: всё, что знаете.</div>
      <div>Где родился, где жил, чья это линия: Владимира или Людмилы.</div>
    </div>
    <div class="dialog-actions">
      <a class="btn btn-primary btn-block" href="${escapeHtml(url || "#")}" target="_blank" rel="noopener">Открыть форму</a>
    </div>
    <div class="text-muted dialog-footnote">Напишите даже одно имя: мы проверим и добавим человека в древо вручную.</div>
  `;
}
