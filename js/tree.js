// Renders the family tree in the same structure as the Claude Design mockup:
// generation rows labeled by kinship distance, split into a Vladimir column
// and a Lyudmila column, couples merged into one box, the anchor couple
// highlighted, a siblings row, and a flexible "early leads" section for
// anything not a confirmed direct ancestor (hypothesis/unknown tier, or a
// collateral relative). Everything here is computed from the relationship
// graph (generation + side + direct-ancestor + tier) rather than naming any
// person, so new people Codex finds slot in automatically.

function genericGenerationLabel(gen) {
  if (gen === 1) return "Родители";
  if (gen === 2) return "Дедушки и бабушки";
  const prefix = "пра".repeat(gen - 2);
  const label = `${prefix}дедушки и ${prefix}бабушки`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildTreeSections(familyData, generations, sides, directAncestors) {
  const gridByGen = new Map(); // gen -> { vladimir: [ids], lyudmila: [ids] }
  const siblings = [];
  const earlyLeads = [];

  for (const [id, person] of familyData.people) {
    if (SITE_CONFIG.anchorPersonIds.includes(id)) continue;
    const gen = generations.get(id);
    if (gen == null) continue; // unlinked — shown in its own panel

    const side = sides.get(id) === "lyudmila" ? "lyudmila" : "vladimir";
    const isMainAncestor = gen >= 1 && person.statusTier === "confirmed" && directAncestors.has(id);

    if (isMainAncestor) {
      if (!gridByGen.has(gen)) gridByGen.set(gen, { vladimir: [], lyudmila: [] });
      gridByGen.get(gen)[side].push(id);
    } else if (gen === 0 && person.statusTier === "confirmed") {
      siblings.push(id);
    } else {
      earlyLeads.push(id);
    }
  }
  return { gridByGen, siblings, earlyLeads };
}

function groupIntoBoxes(ids, familyData) {
  const used = new Set();
  const boxes = [];
  for (const id of ids) {
    if (used.has(id)) continue;
    const spouseEntry = (familyData.spouseEdgesByPerson.get(id) || []).find(s => ids.includes(s.spouseId) && !used.has(s.spouseId));
    used.add(id);
    if (spouseEntry) { used.add(spouseEntry.spouseId); boxes.push([id, spouseEntry.spouseId]); }
    else boxes.push([id]);
  }
  return boxes;
}

function personRowHtml(person, kinship, photoAvailability, photoSize) {
  const hasPhoto = photoAvailability.has(person.id);
  const photoHtml = hasPhoto
    ? `<img src="${personPhotoUrl(person.id)}" alt="">`
    : `<span class="person-photo-placeholder">${escapeHtml((person.displayName || "?").trim().charAt(0))}</span>`;
  const meta = shortMeta(person, kinship.get(person.id));
  return `
    <div class="tree-person" data-id="${escapeHtml(person.id)}" role="button" tabindex="0">
      <div class="person-photo" style="width:${photoSize}px;height:${photoSize}px">${photoHtml}</div>
      <div class="person-info">
        <div class="person-name">${escapeHtml(person.displayName)}</div>
        <div class="person-meta">${escapeHtml(meta)}</div>
      </div>
    </div>`;
}

function shortMeta(person, kinshipLabel) {
  const parts = [];
  if (person.birthDisplay) parts.push(person.deathDisplay ? `${person.birthDisplay} — ${person.deathDisplay}` : person.birthDisplay);
  const role = (kinshipLabel || "").split(" · ").slice(1).join(" · ");
  if (role) parts.push(role);
  return parts.join(" · ") || " ";
}

function coupleBoxHtml(ids, familyData, kinship, photoAvailability, photoSize, tierClassFor) {
  const [a, b] = ids;
  const personA = familyData.people.get(a);
  const tierClass = `tier-${tierClassFor ? tierClassFor(personA) : personA.statusTier}`;
  if (!b) {
    return `<div class="tree-box single ${tierClass}">${personRowHtml(personA, kinship, photoAvailability, photoSize)}</div>`;
  }
  const personB = familyData.people.get(b);
  return `
    <div class="tree-box couple ${tierClass}">
      ${personRowHtml(personA, kinship, photoAvailability, photoSize)}
      <div class="tree-box-divider"></div>
      ${personRowHtml(personB, kinship, photoAvailability, photoSize)}
    </div>`;
}

function renderGenerationRow(gen, sideData, familyData, kinship, photoAvailability, isLast) {
  const photoSize = gen === 1 ? 48 : 40;
  const vladBoxes = groupIntoBoxes(sideData.vladimir, familyData);
  const lyudBoxes = groupIntoBoxes(sideData.lyudmila, familyData);
  const worstTierIn = (ids) => ids.some(id => familyData.people.get(id).statusTier === "hypothesis") ? "hypothesis"
    : ids.some(id => familyData.people.get(id).statusTier === "unknown") ? "unknown" : "confirmed";

  const side = (label, boxes) => `
    <div class="tree-side">
      <h6 class="tree-side-label">${escapeHtml(label)}</h6>
      <div class="tree-side-boxes">
        ${boxes.length ? boxes.map(b => coupleBoxHtml(b, familyData, kinship, photoAvailability, photoSize)).join("") : `<div class="tree-box empty">Пока не установлены</div>`}
      </div>
    </div>`;

  return `
    <div class="tree-row">
      <h6 class="tree-row-label">${escapeHtml(genericGenerationLabel(gen))}</h6>
      <div class="tree-row-columns">
        ${side("Линия Владимира", vladBoxes)}
        ${side("Линия Людмилы", lyudBoxes)}
      </div>
    </div>
    ${isLast ? "" : `<div class="tree-connector"><span></span><span></span></div>`}`;
}

function anchorRowHtml(familyData, kinship, photoAvailability) {
  const ids = SITE_CONFIG.anchorPersonIds.filter(id => familyData.people.has(id));
  return `
    <div class="tree-anchor-row">
      <div class="tree-anchor-ribbon"><span>Рубиновая свадьба · 40 лет</span></div>
      <div class="tree-anchor-box">
        ${ids.map(id => personRowHtml(familyData.people.get(id), kinship, photoAvailability, 64)).join(`<div class="tree-box-divider"></div>`)}
      </div>
    </div>`;
}

function siblingsRowHtml(siblingIds, familyData, kinship, photoAvailability) {
  if (!siblingIds.length) return "";
  return `
    <div class="tree-siblings-row">
      <h6>Братья и сёстры</h6>
      <div class="tree-siblings-list">
        ${siblingIds.map(id => `
          <div class="tree-box single small tier-${familyData.people.get(id).statusTier}">
            ${personRowHtml(familyData.people.get(id), kinship, photoAvailability, 32)}
          </div>`).join("")}
      </div>
    </div>`;
}

function earlyLeadsHtml(leadIds, familyData, kinship) {
  if (!leadIds.length) return "";
  return `
    <div class="tree-leads-row">
      <div class="tree-leads-head">
        <h6>Ранние следы · требуют записи</h6>
        <span class="text-muted">имена из архивных подсказок, родство пока не подтверждено документом</span>
      </div>
      <div class="tree-leads-list">
        ${leadIds.map(id => {
          const p = familyData.people.get(id);
          return `
            <div class="tree-lead tier-${p.statusTier}" data-id="${escapeHtml(id)}" role="button" tabindex="0">
              <div class="tree-lead-name">${escapeHtml(p.displayName)}</div>
              <div class="tree-lead-meta">${escapeHtml((kinship.get(id) || "").replace(" · ", " — "))}</div>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function renderTree(familyData, onPersonClick, kinship, photoAvailability) {
  const { generation: generations, unlinked } = computeGenerations(familyData);
  const sides = computeSides(familyData);
  const directAncestors = computeDirectAncestors(familyData);
  const { gridByGen, siblings, earlyLeads } = buildTreeSections(familyData, generations, sides, directAncestors);

  const gens = [...gridByGen.keys()].sort((a, b) => b - a); // oldest first

  const html = `
    ${gens.map((g, i) => renderGenerationRow(g, gridByGen.get(g), familyData, kinship, photoAvailability, false)).join("")}
    ${anchorRowHtml(familyData, kinship, photoAvailability)}
    ${siblingsRowHtml(siblings, familyData, kinship, photoAvailability)}
    ${earlyLeadsHtml(earlyLeads, familyData, kinship)}
  `;

  const container = document.getElementById("tree-grid");
  container.innerHTML = html;
  container.onclick = (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    const person = familyData.people.get(el.dataset.id);
    if (person) onPersonClick(person);
  };
  container.onkeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest("[data-id]");
    if (!el) return;
    e.preventDefault();
    const person = familyData.people.get(el.dataset.id);
    if (person) onPersonClick(person);
  };

  let zoom = 1;
  const applyZoom = () => { container.style.transform = `scale(${zoom})`; container.style.transformOrigin = "0 0"; };
  document.getElementById("zoom-in").onclick = () => { zoom = Math.min(1.5, zoom + 0.15); applyZoom(); };
  document.getElementById("zoom-out").onclick = () => { zoom = Math.max(0.5, zoom - 0.15); applyZoom(); };
  document.getElementById("zoom-reset").onclick = () => { zoom = 1; applyZoom(); };

  renderUnlinked(unlinked, familyData);
}

function renderUnlinked(unlinked, familyData) {
  const panel = document.getElementById("unlinked-panel");
  const list = document.getElementById("unlinked-list");
  list.innerHTML = "";
  if (!unlinked.length) { panel.hidden = true; return; }
  panel.hidden = false;
  for (const id of unlinked) {
    const person = familyData.people.get(id);
    if (!person) continue;
    const li = document.createElement("li");
    li.textContent = person.displayName;
    list.appendChild(li);
  }
}
