// Renders the family tree as positioned HTML cards (photo + name + dates),
// matching the clean card look from the design, with a thin SVG layer
// underneath just for the connector lines. Positions come from layout.js's
// generic generation/x-position engine, so this keeps scaling automatically
// as more people (and more siblings, horizontally) are added — nothing here
// is hand-placed per person.

function pairKey(a, b) {
  return [a, b].sort().join("::");
}

function buildLinks(familyData, positions) {
  const links = [];
  const drawnSpousePairs = new Set();

  for (const [id, spouses] of familyData.spouseEdgesByPerson) {
    for (const { spouseId, tier } of spouses) {
      const key = pairKey(id, spouseId);
      if (drawnSpousePairs.has(key)) continue;
      drawnSpousePairs.add(key);
      const a = positions.get(id), b = positions.get(spouseId);
      if (!a || !b) continue;
      links.push({ type: "spouse", tier, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  for (const [childId, parentEdges] of familyData.parentEdgesByChild) {
    const childPos = positions.get(childId);
    if (!childPos) continue;

    if (parentEdges.length === 2) {
      const [p1, p2] = parentEdges;
      const pos1 = positions.get(p1.parentId), pos2 = positions.get(p2.parentId);
      const areSpouses = (familyData.spouseEdgesByPerson.get(p1.parentId) || []).some(s => s.spouseId === p2.parentId);
      if (pos1 && pos2 && areSpouses) {
        const worstTier = [p1.tier, p2.tier].includes("hypothesis") ? "hypothesis"
          : [p1.tier, p2.tier].includes("unknown") ? "unknown" : "confirmed";
        const midX = (pos1.x + pos2.x) / 2;
        links.push({ type: "parent-child", tier: worstTier, x1: midX, y1: pos1.y, x2: childPos.x, y2: childPos.y });
        continue;
      }
    }

    for (const { parentId, tier } of parentEdges) {
      const parentPos = positions.get(parentId);
      if (!parentPos) continue;
      links.push({ type: "parent-child", tier, x1: parentPos.x, y1: parentPos.y, x2: childPos.x, y2: childPos.y });
    }
  }

  return links;
}

function linkPath(d) {
  const midY = (d.y1 + d.y2) / 2;
  return `M${d.x1},${d.y1} C${d.x1},${midY} ${d.x2},${midY} ${d.x2},${d.y2}`;
}

function shortMeta(person, kinshipLabel) {
  const parts = [];
  if (person.birthDisplay) parts.push(person.deathDisplay ? `${person.birthDisplay} — ${person.deathDisplay}` : person.birthDisplay);
  const role = (kinshipLabel || "").split(" · ").slice(1).join(" · ");
  if (role) parts.push(role);
  return parts.join(" · ") || " ";
}

let currentZoom = 1;

function renderTree(familyData, onPersonClick, kinship, photoAvailability) {
  const { positions, unlinked, minGeneration, maxGeneration } = computeLayout(familyData);
  const { generationHeight, nodeWidth, nodeHeight } = SITE_CONFIG.layout;
  const margin = nodeWidth;

  const xs = [...positions.values()].map(p => p.x);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;

  for (const pos of positions.values()) {
    pos.px = pos.x - minX + margin;
    pos.py = (maxGeneration - pos.generation) * generationHeight + margin;
  }

  const canvasWidth = (maxX - minX) + margin * 2 + nodeWidth;
  const canvasHeight = (maxGeneration - minGeneration) * generationHeight + margin * 2 + nodeHeight * 1.6;

  const inner = document.getElementById("tree-inner");
  const cardsLayer = document.getElementById("tree-cards");
  const linksSvg = document.getElementById("tree-links-svg");
  inner.style.width = `${canvasWidth}px`;
  inner.style.height = `${canvasHeight}px`;
  linksSvg.setAttribute("width", canvasWidth);
  linksSvg.setAttribute("height", canvasHeight);
  linksSvg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);

  const links = buildLinks(familyData, new Map([...positions].map(([id, p]) => [id, { x: p.px, y: p.py }])));
  linksSvg.innerHTML = links.map(l => {
    if (l.type === "spouse") {
      return `<path class="spouse-link tier-${l.tier}" d="M${l.x1},${l.y1} L${l.x2},${l.y2}" fill="none"></path>`;
    }
    return `<path class="parent-link tier-${l.tier}" d="${linkPath(l)}" fill="none"></path>`;
  }).join("");

  cardsLayer.innerHTML = "";
  const isAnchor = id => SITE_CONFIG.anchorPersonIds.includes(id);

  for (const [id, pos] of positions) {
    const person = familyData.people.get(id);
    const anchor = isAnchor(id);
    const card = document.createElement("div");
    card.className = `person-card tier-${person.statusTier}${anchor ? " is-anchor" : ""}`;
    card.style.left = `${pos.px - nodeWidth / 2}px`;
    card.style.top = `${pos.py - nodeHeight / 2}px`;
    card.style.width = `${nodeWidth}px`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const hasPhoto = photoAvailability.has(id);
    const photoHtml = hasPhoto
      ? `<img src="${personPhotoUrl(id)}" alt="">`
      : `<span class="person-photo-placeholder">${escapeHtml((person.displayName || "?").trim().charAt(0))}</span>`;

    card.innerHTML = `
      <div class="person-photo${anchor ? " person-photo-lg" : ""}">${photoHtml}</div>
      <div class="person-info">
        <div class="person-name">${escapeHtml(person.displayName)}</div>
        <div class="person-meta">${escapeHtml(shortMeta(person, kinship.get(id)))}</div>
      </div>`;

    card.addEventListener("click", () => onPersonClick(person));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPersonClick(person); } });
    cardsLayer.appendChild(card);
  }

  currentZoom = 1;
  applyZoom();

  document.getElementById("zoom-in").onclick = () => { currentZoom = Math.min(1.5, currentZoom + 0.15); applyZoom(); };
  document.getElementById("zoom-out").onclick = () => { currentZoom = Math.max(0.4, currentZoom - 0.15); applyZoom(); };
  document.getElementById("zoom-reset").onclick = () => { currentZoom = 1; applyZoom(); };

  renderUnlinked(unlinked, familyData);
}

function applyZoom() {
  const inner = document.getElementById("tree-inner");
  inner.style.transform = `scale(${currentZoom})`;
  inner.style.transformOrigin = "0 0";
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
