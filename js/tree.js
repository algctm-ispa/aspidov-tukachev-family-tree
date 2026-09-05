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
  // gen -> { vladimir: { ancestors: [ids], collaterals: [ids] }, lyudmila: {...} }
  const gridByGen = new Map();
  const siblings = [];   // generation 0: the anchor couple's own brothers and sisters
  const children = [];   // generation below the anchor couple
  const earlyLeads = []; // in the graph, but with no parents to hang off yet

  const emptySide = () => ({ ancestors: [], collaterals: [] });

  for (const [id] of familyData.people) {
    if (SITE_CONFIG.anchorPersonIds.includes(id)) continue;
    const gen = generations.get(id);
    if (gen == null) continue; // unlinked — shown in its own panel

    if (gen < 0) { children.push(id); continue; }
    if (gen === 0) { siblings.push(id); continue; }

    const side = sides.get(id) === "lyudmila" ? "lyudmila" : "vladimir";
    if (!gridByGen.has(gen)) gridByGen.set(gen, { vladimir: emptySide(), lyudmila: emptySide() });
    const bucket = gridByGen.get(gen)[side];

    // Confidence tier is now purely visual (border style); it no longer decides
    // whether someone appears in the tree at all. What decides placement is the
    // shape of the graph: on the direct line, beside it, or not yet attached.
    if (directAncestors.has(id)) bucket.ancestors.push(id);
    else if ((familyData.parentEdgesByChild.get(id) || []).length) bucket.collaterals.push(id);
    else earlyLeads.push(id);
  }
  return { gridByGen, siblings, children, earlyLeads };
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
  // The kicker is "<линия> · <роль>[· <статус>]", except for descendants,
  // where there is no line prefix to strip.
  const segments = (kinshipLabel || "").split(" · ");
  const role = segments.length > 1 ? segments.slice(1).join(" · ") : segments[0];
  if (role) parts.push(role);
  return parts.join(" · ") || " ";
}

function coupleBoxHtml(ids, familyData, kinship, photoAvailability, photoSize, tierClassFor, extraClass) {
  const [a, b] = ids;
  const personA = familyData.people.get(a);
  const tierClass = `tier-${tierClassFor ? tierClassFor(personA) : personA.statusTier}`;
  const extra = extraClass ? ` ${extraClass}` : "";
  if (!b) {
    return `<div class="tree-box single ${tierClass}${extra}">${personRowHtml(personA, kinship, photoAvailability, photoSize)}</div>`;
  }
  const personB = familyData.people.get(b);
  return `
    <div class="tree-box couple ${tierClass}${extra}">
      ${personRowHtml(personA, kinship, photoAvailability, photoSize)}
      <div class="tree-box-divider"></div>
      ${personRowHtml(personB, kinship, photoAvailability, photoSize)}
    </div>`;
}

function renderGenerationRow(gen, sideData, familyData, kinship, photoAvailability, isLast) {
  const photoSize = gen === 1 ? 48 : 40;

  const side = (label, data) => {
    const boxes = groupIntoBoxes(data.ancestors, familyData);
    const collateralBoxes = groupIntoBoxes(data.collaterals, familyData);
    // Brothers and sisters of this generation's direct ancestors: confirmed
    // family, but off the direct line — so they sit under it in smaller cards
    // rather than in the spine or in the unattached-leads block.
    const collateralHtml = collateralBoxes.length ? `
      <div class="tree-side-collaterals">
        <h6 class="tree-collateral-label">Братья и сёстры</h6>
        <div class="tree-side-boxes">
          ${collateralBoxes.map(b => coupleBoxHtml(b, familyData, kinship, photoAvailability, 32, null, "small")).join("")}
        </div>
      </div>` : "";
    return `
      <div class="tree-side">
        <h6 class="tree-side-label">${escapeHtml(label)}</h6>
        <div class="tree-side-boxes">
          ${boxes.length ? boxes.map(b => coupleBoxHtml(b, familyData, kinship, photoAvailability, photoSize)).join("") : `<div class="tree-box empty">Пока не установлены</div>`}
        </div>
        ${collateralHtml}
      </div>`;
  };

  return `
    <div class="tree-row">
      <h6 class="tree-row-label"><span>${escapeHtml(genericGenerationLabel(gen))}</span></h6>
      <div class="tree-row-columns">
        ${side("Линия Владимира", sideData.vladimir)}
        ${side("Линия Людмилы", sideData.lyudmila)}
      </div>
    </div>
    ${isLast ? "" : `<div class="tree-connector"><span></span><span></span></div>`}`;
}

function anchorRowHtml(familyData, kinship, photoAvailability) {
  const ids = SITE_CONFIG.anchorPersonIds.filter(id => familyData.people.has(id));
  return `
    <div class="tree-anchor-row">
      <div class="tree-anchor-inner">
        <div class="tree-anchor-ribbon"><span>Рубиновая свадьба · 40 лет</span></div>
        <div class="tree-anchor-box">
          ${ids.map(id => personRowHtml(familyData.people.get(id), kinship, photoAvailability, 64)).join(`<div class="tree-box-divider"></div>`)}
        </div>
      </div>
    </div>`;
}

// The generation below the anchor couple — the line carrying on.
function childrenRowHtml(childIds, familyData, kinship, photoAvailability) {
  if (!childIds.length) return "";
  // No connector stem here: the siblings row sits between this and the anchor
  // couple, so a line would appear to come from the wrong place.
  return `
    <div class="tree-children-row">
      <div class="tree-children-inner">
        <h6>Дети</h6>
        <div class="tree-children-list">
          ${groupIntoBoxes(childIds, familyData)
            .map(b => coupleBoxHtml(b, familyData, kinship, photoAvailability, 40))
            .join("")}
        </div>
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

function leadCardHtml(id, familyData, kinship) {
  const p = familyData.people.get(id);
  return `
    <div class="tree-lead tier-${p.statusTier}" data-id="${escapeHtml(id)}" role="button" tabindex="0">
      <div class="tree-lead-name">${escapeHtml(p.displayName)}</div>
      <div class="tree-lead-meta">${escapeHtml((kinship.get(id) || "").replace(" · ", " — "))}</div>
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
        ${leadIds.map(id => leadCardHtml(id, familyData, kinship)).join("")}
      </div>
    </div>`;
}

function renderTree(familyData, onPersonClick, kinship, photoAvailability) {
  const { generation: generations, unlinked } = computeGenerations(familyData);
  const sides = computeSides(familyData);
  const directAncestors = computeDirectAncestors(familyData);
  const { gridByGen, siblings, children, earlyLeads } = buildTreeSections(familyData, generations, sides, directAncestors);

  const gens = [...gridByGen.keys()].sort((a, b) => b - a); // oldest first

  const html = `
    ${gens.map((g, i) => renderGenerationRow(g, gridByGen.get(g), familyData, kinship, photoAvailability, false)).join("")}
    ${anchorRowHtml(familyData, kinship, photoAvailability)}
    ${siblingsRowHtml(siblings, familyData, kinship, photoAvailability)}
    ${childrenRowHtml(children, familyData, kinship, photoAvailability)}
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

  setupTreeCanvas(container);

  renderUnlinked(unlinked, familyData, onPersonClick, kinship);
}

function renderUnlinked(unlinked, familyData, onPersonClick, kinship) {
  const panel = document.getElementById("unlinked-panel");
  const list = document.getElementById("unlinked-list");
  if (!unlinked.length) { panel.hidden = true; return; }
  panel.hidden = false;
  list.innerHTML = unlinked.map(id => leadCardHtml(id, familyData, kinship)).join("");
  list.onclick = (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    const person = familyData.people.get(el.dataset.id);
    if (person) onPersonClick(person);
  };
}


// ---------------------------------------------------------------------------
// Canvas sizing, zoom and pan.
//
// The tree is meant to keep growing sideways as Codex adds relatives, so each
// generation row lays its two sides out on a single line (no wrapping) and the
// whole canvas scrolls horizontally. Vertically it just grows with the page.
//
// Column widths are measured once from the widest generation row and then
// pinned as CSS variables, so every row (and the connector lines between rows)
// shares the same "Линия Владимира" / "Линия Людмилы" split no matter how many
// people land in any single generation. Nothing here knows any person by name.
// ---------------------------------------------------------------------------

const TREE_COL_MIN = 420;   // px floor per side column, keeps a sparse tree from looking cramped
const TREE_COL_GAP = 24;    // must match --space-6, the gap in .tree-row-columns
const TREE_ZOOM_MIN = 0.4;
const TREE_ZOOM_MAX = 1.6;
const TREE_ZOOM_STEP = 0.15;
const TREE_DRAG_THRESHOLD = 5; // px before a mouse-down counts as a pan, not a click

function setupTreeCanvas(grid) {
  const wrap = document.getElementById("tree-canvas-wrap");
  const canvas = document.getElementById("tree-canvas");
  if (!wrap || !canvas) return;

  let zoom = 1;
  let naturalWidth = 0;
  let naturalHeight = 0;

  function applyZoom() {
    grid.style.transform = `scale(${zoom})`;
    // The sizer carries the *layout* size; a transform alone leaves the scroll
    // extents at 100%, which is why zooming in used to hide content.
    canvas.style.width = Math.round(naturalWidth * zoom) + "px";
    canvas.style.height = Math.round(naturalHeight * zoom) + "px";
  }

  function measure() {
    grid.style.transform = "none";
    grid.style.removeProperty("--tree-width");
    grid.style.setProperty("--tree-col-v", "max-content");
    grid.style.setProperty("--tree-col-l", "max-content");

    // Measure only the direct-ancestor line of each side. The collateral
    // sub-rows wrap inside whatever width that gives, so a generation with
    // many siblings makes its own row taller rather than stretching the
    // entire tree sideways.
    // is-measuring hides the collateral sub-rows, so the column width comes
    // from the direct-ancestor line alone. The sub-rows then wrap inside that
    // width — a generation with many siblings grows its own row taller
    // instead of stretching the whole tree sideways.
    grid.classList.add("is-measuring");
    let vlad = 0;
    let lyud = 0;
    for (const row of grid.querySelectorAll(".tree-row-columns")) {
      const sides = row.children;
      if (sides[0]) vlad = Math.max(vlad, sides[0].getBoundingClientRect().width);
      if (sides[1]) lyud = Math.max(lyud, sides[1].getBoundingClientRect().width);
    }
    grid.classList.remove("is-measuring");
    // Both sides get the same width, so the two lines stay a clean mirrored
    // split and the anchor couple lands exactly on the seam between them —
    // whichever side happens to be the crowded one as the data grows.
    const col = Math.max(Math.ceil(vlad), Math.ceil(lyud), TREE_COL_MIN);

    grid.style.setProperty("--tree-col-v", col + "px");
    grid.style.setProperty("--tree-col-l", col + "px");
    // Pinning the total width also gives the siblings / "Ранние следы" rows a
    // sane width to wrap inside, instead of stretching the canvas arbitrarily.
    grid.style.setProperty("--tree-width", (col * 2 + TREE_COL_GAP) + "px");

    naturalWidth = grid.offsetWidth;
    naturalHeight = grid.offsetHeight;
    applyZoom();
  }

  function setZoom(next) {
    const previous = zoom;
    zoom = Math.min(TREE_ZOOM_MAX, Math.max(TREE_ZOOM_MIN, Math.round(next * 100) / 100));
    if (zoom === previous) return;
    const anchor = wrap.scrollLeft + wrap.clientWidth / 2;
    applyZoom();
    wrap.scrollLeft = Math.max(0, anchor * (zoom / previous) - wrap.clientWidth / 2);
  }

  const zoomIn = document.getElementById("zoom-in");
  const zoomOut = document.getElementById("zoom-out");
  const zoomReset = document.getElementById("zoom-reset");
  if (zoomIn) zoomIn.onclick = () => setZoom(zoom + TREE_ZOOM_STEP);
  if (zoomOut) zoomOut.onclick = () => setZoom(zoom - TREE_ZOOM_STEP);
  if (zoomReset) zoomReset.onclick = () => { setZoom(1); wrap.scrollLeft = 0; };

  // Drag to pan. Mouse only — touch already pans natively, and hijacking it
  // would fight the browser's own scrolling.
  let drag = null;
  let swallowClick = false;

  wrap.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: wrap.scrollLeft, top: window.scrollY, moved: false };
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < TREE_DRAG_THRESHOLD) return;
    if (!drag.moved) { drag.moved = true; wrap.classList.add("is-panning"); }
    e.preventDefault();
    wrap.scrollLeft = drag.left - dx;
    window.scrollTo(0, Math.max(0, drag.top - dy));
  });

  const endDrag = () => {
    if (!drag) return;
    swallowClick = drag.moved;
    drag = null;
    wrap.classList.remove("is-panning");
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // Capture phase: stops a pan from also opening the dialog of whatever card
  // happened to be under the cursor when the drag started.
  wrap.addEventListener("click", (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  measure();
  // Archivo loads as a webfont; re-measure once it lands so the pinned column
  // widths match the final text metrics.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
}
