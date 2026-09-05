// Renders the family tree as a true pedigree chart: every generation sits on
// its own horizontal level, each parent pair is one grouped box, and a single
// elbow connector runs from that box down to a sibling bar and on to each of
// their children. Positions are computed from the relationship graph alone —
// no person is ever named here — so people Codex adds slot in on their own.
//
// Because ancestors form a binary tree (each person has at most one parent
// couple) and each subtree is laid out inside its own horizontal band, the
// connectors can never cross.

const CARD_W = 208;        // every card is exactly this size, always
const CARD_H = 64;
const CARD_PHOTO = 40;
const SIB_GAP = 14;        // between a person and their brothers and sisters
const PAIR_GAP = 64;       // between the father's block and the mother's block
const LEVEL_H = 172;       // vertical pitch between generations
const CANVAS_PAD = 48;

// Short label for the chip that sits above every card. Kept compact on purpose:
// the chip is pinned to the card's top left corner and must not run past it.
function generationChipLabel(gen) {
  if (gen <= -1) return "Дети";
  if (gen === 1) return "Родители";
  if (gen === 2) return "Дедушки и бабушки";
  const label = "пра".repeat(gen - 2) + "деды";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function parentsOf(id, familyData) {
  const ids = (familyData.parentEdgesByChild.get(id) || []).map(e => e.parentId).filter(p => familyData.people.has(p));
  // Father first, so the couple box reads the same way everywhere.
  return [...new Set(ids)].sort((a, b) => {
    const sa = familyData.people.get(a).sex === "male" ? 0 : 1;
    const sb = familyData.people.get(b).sex === "male" ? 0 : 1;
    return sa - sb;
  });
}

function childrenOfParents(parentIds, familyData) {
  if (!parentIds.length) return [];
  const sets = parentIds.map(p => new Set((familyData.childEdgesByParent.get(p) || []).map(e => e.childId)));
  return [...sets[0]].filter(id => sets.every(s => s.has(id)) && familyData.people.has(id));
}

function unitKey(memberIds) { return memberIds.join("+"); }

// ---------------------------------------------------------------------------
// Build the tree of units. A unit is one parent pair (or a single known
// parent) standing together in one box.
// ---------------------------------------------------------------------------

function buildUnitTree(familyData) {
  const anchors = SITE_CONFIG.anchorPersonIds.filter(id => familyData.people.has(id));
  const placed = new Set();
  const guard = new Set();

  function makeUnit(memberIds, gen) {
    const key = unitKey(memberIds);
    if (guard.has(key)) return null; // cycle guard; the data should never have one
    guard.add(key);

    const unit = { key, gen, members: [], parents: [] };
    for (const id of memberIds) {
      placed.add(id);
      const sibs = childrenOfParents(parentsOf(id, familyData), familyData)
        .filter(c => c !== id && !memberIds.includes(c) && !placed.has(c));
      sibs.forEach(s => placed.add(s));
      unit.members.push({ id, siblings: sibs, parentUnit: null });
    }
    for (const member of unit.members) {
      const p = parentsOf(member.id, familyData);
      if (p.length) member.parentUnit = makeUnit(p, gen + 1);
      if (member.parentUnit) unit.parents.push(member.parentUnit);
    }
    return unit;
  }

  const root = makeUnit(anchors, 0);
  const children = childrenOfParents(anchors, familyData).filter(id => !placed.has(id));
  children.forEach(id => placed.add(id));

  const unplaced = [...familyData.people.keys()].filter(id => !placed.has(id));
  return { root, children, unplaced };
}

// ---------------------------------------------------------------------------
// Measure, then place. measure() returns how far the unit's whole subtree
// reaches to the left and to the right of the unit's own centre line.
// ---------------------------------------------------------------------------

function measureUnit(unit) {
  const boxW = unit.members.length * CARD_W;
  const leftSibs = unit.members[0] ? unit.members[0].siblings.length : 0;
  const rightSibs = unit.members.length > 1
    ? unit.members[1].siblings.length
    : 0;
  // A single-member unit puts its siblings on both sides so it stays centred.
  const soloSibs = unit.members.length === 1 ? unit.members[0].siblings.length : 0;
  const soloLeft = Math.floor(soloSibs / 2);
  const soloRight = soloSibs - soloLeft;

  const ownLeft = boxW / 2 + (unit.members.length === 1 ? soloLeft : leftSibs) * (CARD_W + SIB_GAP);
  const ownRight = boxW / 2 + (unit.members.length === 1 ? soloRight : rightSibs) * (CARD_W + SIB_GAP);

  const above = unit.parents.map(measureUnit);
  let aboveLeft = 0, aboveRight = 0;
  if (above.length === 1) {
    aboveLeft = above[0].left;
    aboveRight = above[0].right;
  } else if (above.length === 2) {
    const total = above[0].left + above[0].right + PAIR_GAP + above[1].left + above[1].right;
    aboveLeft = total / 2;
    aboveRight = total / 2;
  }

  unit.measured = {
    left: Math.max(ownLeft, aboveLeft),
    right: Math.max(ownRight, aboveRight),
    above
  };
  return unit.measured;
}

function placeUnit(unit, cx, nodes) {
  unit.cx = cx;
  const boxW = unit.members.length * CARD_W;
  const boxLeft = cx - boxW / 2;
  unit.boxLeft = boxLeft;
  unit.boxW = boxW;

  unit.members.forEach((member, i) => {
    member.x = boxLeft + i * CARD_W;
    nodes.push({ id: member.id, x: member.x, gen: unit.gen, role: "unit", unit });
  });

  // Siblings sit beside the box, on their own member's side.
  if (unit.members.length === 1) {
    const sibs = unit.members[0].siblings;
    const leftCount = Math.floor(sibs.length / 2);
    sibs.forEach((id, i) => {
      const x = i < leftCount
        ? boxLeft - (leftCount - i) * (CARD_W + SIB_GAP)
        : boxLeft + boxW + SIB_GAP + (i - leftCount) * (CARD_W + SIB_GAP);
      nodes.push({ id, x, gen: unit.gen, role: "sibling", unit, of: unit.members[0].id });
    });
  } else {
    unit.members[0].siblings.forEach((id, i) => {
      const n = unit.members[0].siblings.length;
      const x = boxLeft - (n - i) * (CARD_W + SIB_GAP);
      nodes.push({ id, x, gen: unit.gen, role: "sibling", unit, of: unit.members[0].id });
    });
    unit.members[1].siblings.forEach((id, i) => {
      const x = boxLeft + boxW + SIB_GAP + i * (CARD_W + SIB_GAP);
      nodes.push({ id, x, gen: unit.gen, role: "sibling", unit, of: unit.members[1].id });
    });
  }

  const above = unit.measured.above;
  if (above.length === 1) {
    placeUnit(unit.parents[0], cx, nodes);
  } else if (above.length === 2) {
    const total = above[0].left + above[0].right + PAIR_GAP + above[1].left + above[1].right;
    const leftEdge = cx - total / 2;
    const c0 = leftEdge + above[0].left;
    const c1 = c0 + above[0].right + PAIR_GAP + above[1].left;
    placeUnit(unit.parents[0], c0, nodes);
    placeUnit(unit.parents[1], c1, nodes);
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

// Dates live in the dialog now, so the card carries only the relation. That
// keeps every card the same shape whether or not a birth year is known.
function cardMeta(person, kinshipLabel) {
  void person;
  const segments = (kinshipLabel || "").split(" · ");
  const role = segments.length > 1 ? segments.slice(1).join(" · ") : segments[0];
  return role || " ";
}

function cardHtml(person, kinship, photoAvailability, extraClass) {
  const hasPhoto = photoAvailability.has(person.id);
  const photoHtml = hasPhoto
    ? `<img src="${personPhotoUrl(person.id)}" alt="${escapeHtml(person.displayName)}">`
    : `<span class="person-photo-placeholder">${escapeHtml((person.displayName || "?").trim().charAt(0))}</span>`;
  return `
    <div class="tree-card tier-${person.statusTier}${extraClass ? " " + extraClass : ""}" data-id="${escapeHtml(person.id)}" role="button" tabindex="0">
      <div class="person-photo">${photoHtml}</div>
      <div class="person-info">
        <div class="person-name">${escapeHtml(person.displayName)}</div>
        <div class="person-meta">${escapeHtml(cardMeta(person, kinship.get(person.id)))}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------

function renderTree(familyData, onPersonClick, kinship, photoAvailability) {
  const { root, children, unplaced } = buildUnitTree(familyData);
  const nodes = [];

  measureUnit(root);
  placeUnit(root, 0, nodes);

  // Children of the anchor couple, centred beneath them.
  const childY = root.gen - 1;
  const childTotal = children.length * CARD_W + Math.max(0, children.length - 1) * SIB_GAP;
  children.forEach((id, i) => {
    nodes.push({ id, x: -childTotal / 2 + i * (CARD_W + SIB_GAP), gen: childY, role: "child" });
  });

  // Record where each unit's children ended up, so the connector bar can span
  // all of them rather than just the one on the direct line.
  const byGenParent = new Map();
  for (const n of nodes) {
    if (n.role === "unit" || n.role === "sibling") {
      const u = n.unit;
      for (const m of u.members) {
        if (m.id === n.id || m.siblings.includes(n.id)) {
          const owner = m.parentUnit;
          if (owner) {
            if (!byGenParent.has(owner.key)) byGenParent.set(owner.key, []);
            byGenParent.get(owner.key).push(n.x + CARD_W / 2);
          }
        }
      }
    }
  }
  (function walk(u) {
    u.childXs = byGenParent.get(u.key) || [];
    u.parents.forEach(walk);
  })(root);
  root.childXs = children.map((id, i) => -childTotal / 2 + i * (CARD_W + SIB_GAP) + CARD_W / 2);

  // Normalise coordinates so everything is positive.
  const gens = nodes.map(n => n.gen);
  const maxGen = Math.max(...gens);
  const minGen = Math.min(...gens);
  // Mirrored vertically: the couple and their children sit at the top and the
  // tree grows downwards into the older generations.
  const yOf = gen => (gen - minGen) * LEVEL_H + CANVAS_PAD;

  const minX = Math.min(...nodes.map(n => n.x)) - CANVAS_PAD;
  const maxX = Math.max(...nodes.map(n => n.x + CARD_W)) + CANVAS_PAD;
  const shift = -minX;
  const width = maxX - minX;
  const height = (maxGen - minGen) * LEVEL_H + CARD_H + CANVAS_PAD * 2;

  // Connectors
  const paths = [];
  (function collect(u) {
    for (const member of u.members) {
      if (!member.parentUnit) continue;
      const p = member.parentUnit;
      // The parent couple sits below its children, so the drop leaves the top
      // of the parent box and the stubs meet the bottom of each child card.
      const parentEdge = yOf(p.gen);
      const childEdge = yOf(u.gen) + CARD_H;
      const barY = (parentEdge + childEdge) / 2;
      const xs = (p.childXs && p.childXs.length ? p.childXs : [member.x + CARD_W / 2]).map(x => x + shift);
      const pcx = p.cx + shift;
      paths.push(`M ${pcx} ${parentEdge} L ${pcx} ${barY}`);
      paths.push(`M ${Math.min(...xs, pcx)} ${barY} L ${Math.max(...xs, pcx)} ${barY}`);
      for (const x of xs) paths.push(`M ${x} ${barY} L ${x} ${childEdge}`);
    }
    u.parents.forEach(collect);
  })(root);

  if (children.length) {
    // The children's row is above the couple after the mirror.
    const parentEdge = yOf(root.gen);
    const childEdge = yOf(childY) + CARD_H;
    const barY = (parentEdge + childEdge) / 2;
    const xs = root.childXs.map(x => x + shift);
    const pcx = root.cx + shift;
    paths.push(`M ${pcx} ${parentEdge} L ${pcx} ${barY}`);
    paths.push(`M ${Math.min(...xs, pcx)} ${barY} L ${Math.max(...xs, pcx)} ${barY}`);
    for (const x of xs) paths.push(`M ${x} ${barY} L ${x} ${childEdge}`);
  }

  const svg = `<svg class="tree-links" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    ${paths.map(d => `<path d="${d}" />`).join("")}
  </svg>`;

  // Couple group boxes, drawn behind the cards
  const groups = [];
  (function collectGroups(u) {
    if (u.members.length > 1) {
      groups.push(`<div class="tree-couple-frame" style="left:${u.boxLeft + shift}px;top:${yOf(u.gen)}px;width:${u.boxW}px;height:${CARD_H}px"></div>`);
    }
    u.parents.forEach(collectGroups);
  })(root);

  // No ribbon on the anchor frame: the mirrored tree runs its connector down
  // from the couple's box, and a ribbon there would sit across it. The ruby
  // frame, the tinted fill and the chip already mark the pair.
  const anchorFrame = `<div class="tree-couple-frame is-anchor" style="left:${root.boxLeft + shift}px;top:${yOf(root.gen)}px;width:${root.boxW}px;height:${CARD_H}px"></div>`;

  const cards = nodes.map(n => {
    const person = familyData.people.get(n.id);
    const extra = SITE_CONFIG.anchorPersonIds.includes(n.id) ? "is-anchor" : (n.role === "sibling" || n.role === "child" ? "is-collateral" : "");
    // Chips mark the direct line only. A unit is built from someone's parents,
    // so every unit member above the couple is a blood ancestor; brothers,
    // sisters and the couple's own generation get none. The couple's children
    // keep theirs, since they carry the line onward.
    const onBloodline = (n.role === "unit" && n.gen >= 1) || n.role === "child";
    const chip = onBloodline
      ? `<span class="tree-chip">${escapeHtml(generationChipLabel(n.gen))}</span>`
      : "";
    return `<div class="tree-node" style="left:${n.x + shift}px;top:${yOf(n.gen)}px">${chip}${cardHtml(person, kinship, photoAvailability, extra)}</div>`;
  }).join("");

  const labels = "";

  const container = document.getElementById("tree-grid");
  container.style.width = width + "px";
  container.style.height = height + "px";
  container.innerHTML = svg + groups.join("") + anchorFrame + labels + cards;
  container.dataset.anchorCx = String(root.cx + shift);
  container.dataset.anchorW = String(root.boxW);

  const open = el => {
    const person = familyData.people.get(el.dataset.id);
    if (person) onPersonClick(person);
  };
  container.onclick = (e) => { const el = e.target.closest("[data-id]"); if (el) open(el); };
  container.onkeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest("[data-id]");
    if (!el) return;
    e.preventDefault();
    open(el);
  };

  setupTreeCanvas(container);
  renderUnlinked(unplaced, familyData, onPersonClick, kinship);
}

function renderUnlinked(unlinked, familyData, onPersonClick, kinship) {
  const panel = document.getElementById("unlinked-panel");
  const list = document.getElementById("unlinked-list");
  if (!unlinked.length) { panel.hidden = true; return; }
  panel.hidden = false;
  list.innerHTML = unlinked.map(id => {
    const p = familyData.people.get(id);
    return `<div class="tree-lead tier-${p.statusTier}" data-id="${escapeHtml(id)}" role="button" tabindex="0">
      <div class="tree-lead-name">${escapeHtml(p.displayName)}</div>
      <div class="tree-lead-meta">${escapeHtml((kinship.get(id) || "").replace(" · ", ", "))}</div>
    </div>`;
  }).join("");
  list.onclick = (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    const person = familyData.people.get(el.dataset.id);
    if (person) onPersonClick(person);
  };
}

// ---------------------------------------------------------------------------
// Canvas: zoom, pan, and an opening view centred on the couple.
// ---------------------------------------------------------------------------

const TREE_ZOOM_MIN = 0.2;
const TREE_ZOOM_MAX = 1.6;
const TREE_ZOOM_STEP = 0.15;
const TREE_DRAG_THRESHOLD = 5;

function setupTreeCanvas(grid) {
  const wrap = document.getElementById("tree-canvas-wrap");
  const canvas = document.getElementById("tree-canvas");
  if (!wrap || !canvas) return;

  const naturalWidth = grid.offsetWidth;
  const naturalHeight = grid.offsetHeight;
  const anchorCx = Number(grid.dataset.anchorCx || naturalWidth / 2);
  const anchorW = Number(grid.dataset.anchorW || CARD_W * 2);
  let zoom = 1;

  function applyZoom() {
    grid.style.transform = `scale(${zoom})`;
    canvas.style.width = Math.round(naturalWidth * zoom) + "px";
    canvas.style.height = Math.round(naturalHeight * zoom) + "px";
  }

  function centreOnAnchor() {
    // Only the horizontal axis scrolls inside the canvas; the section's height
    // grows with the page, so there is nothing to centre vertically.
    wrap.scrollLeft = Math.max(0, anchorCx * zoom - wrap.clientWidth / 2);
  }

  function fit() {
    // Open at whatever scale puts the whole couple in the window, never
    // magnified past 1:1 — otherwise a phone opens on a box wider than itself.
    const byWidth = (wrap.clientWidth * 0.94) / anchorW;
    zoom = Math.min(1, Math.max(TREE_ZOOM_MIN, Math.round(byWidth * 100) / 100));
    applyZoom();
    centreOnAnchor();
  }

  function setZoom(next) {
    const previous = zoom;
    zoom = Math.min(TREE_ZOOM_MAX, Math.max(TREE_ZOOM_MIN, Math.round(next * 100) / 100));
    if (zoom === previous) return;
    const ax = wrap.scrollLeft + wrap.clientWidth / 2;
    applyZoom();
    wrap.scrollLeft = Math.max(0, ax * (zoom / previous) - wrap.clientWidth / 2);
  }

  const zoomIn = document.getElementById("zoom-in");
  const zoomOut = document.getElementById("zoom-out");
  const zoomReset = document.getElementById("zoom-reset");
  if (zoomIn) zoomIn.onclick = () => setZoom(zoom + TREE_ZOOM_STEP);
  if (zoomOut) zoomOut.onclick = () => setZoom(zoom - TREE_ZOOM_STEP);
  if (zoomReset) zoomReset.onclick = () => fit();

  let drag = null;
  let swallowClick = false;
  wrap.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: wrap.scrollLeft, top: window.scrollY, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
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
  wrap.addEventListener("click", (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
}
