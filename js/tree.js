// D3-based pan/zoom SVG rendering of the family tree.

function pairKey(a, b) {
  return [a, b].sort().join("::");
}

function buildLinks(familyData, positions) {
  const links = [];
  const drawnSpousePairs = new Set();

  // Spouse links
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

  // Parent-child links, merging couple parents into one branch point when possible
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

function renderTree(familyData, onPersonClick) {
  const { positions, unlinked } = computeLayout(familyData);
  const genHeight = SITE_CONFIG.layout.generationHeight;
  for (const p of positions.values()) p.y = -p.generation * genHeight;

  const nodeW = SITE_CONFIG.layout.nodeWidth;
  const nodeH = SITE_CONFIG.layout.nodeHeight;

  const svg = d3.select("#tree-svg");
  svg.selectAll("*").remove();

  const canvas = document.getElementById("tree-canvas");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  svg.attr("width", width).attr("height", height);

  const viewport = svg.append("g").attr("class", "viewport");

  const links = buildLinks(familyData, positions);
  viewport.append("g").attr("class", "links")
    .selectAll("path.spouse-link")
    .data(links.filter(l => l.type === "spouse"))
    .join("path")
    .attr("class", d => `spouse-link tier-${d.tier}`)
    .attr("d", d => `M${d.x1},${d.y1} L${d.x2},${d.y2}`);

  viewport.select(".links")
    .selectAll("path.parent-link")
    .data(links.filter(l => l.type === "parent-child"))
    .join("path")
    .attr("class", d => `parent-link tier-${d.tier}`)
    .attr("d", linkPath)
    .attr("fill", "none");

  const nodeGroups = viewport.append("g").attr("class", "nodes")
    .selectAll("g.node")
    .data([...positions.entries()].map(([id, pos]) => ({ id, ...pos, person: familyData.people.get(id) })))
    .join("g")
    .attr("class", d => `node tier-${d.person.statusTier} sex-${d.person.sex || "unknown"}`)
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .style("cursor", "pointer")
    .on("click", (event, d) => onPersonClick(d.person));

  nodeGroups.append("rect")
    .attr("x", -nodeW / 2).attr("y", -nodeH / 2)
    .attr("width", nodeW).attr("height", nodeH)
    .attr("rx", 10);

  nodeGroups.append("text")
    .attr("class", "node-name")
    .attr("y", -4)
    .text(d => d.person.displayName)
    .each(function (d) { fitText(this, nodeW - 16); });

  nodeGroups.append("text")
    .attr("class", "node-dates")
    .attr("y", nodeH / 2 - 14)
    .text(d => {
      const b = d.person.birthDisplay || "?";
      const dth = d.person.deathDisplay ? `— ${d.person.deathDisplay}` : (d.person.living ? "" : "");
      return dth ? `${b} ${dth}` : b;
    });

  // Fit + center the view.
  const xs = [...positions.values()].map(p => p.x);
  const ys = [...positions.values()].map(p => p.y);
  const bbox = {
    minX: Math.min(...xs) - nodeW, maxX: Math.max(...xs) + nodeW,
    minY: Math.min(...ys) - nodeH, maxY: Math.max(...ys) + nodeH
  };
  const contentW = bbox.maxX - bbox.minX;
  const contentH = bbox.maxY - bbox.minY;
  const scale = Math.min(1.1, Math.max(0.35, Math.min(width / contentW, height / contentH) * 0.92));
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const zoom = d3.zoom().scaleExtent([0.15, 3]).on("zoom", (event) => {
    viewport.attr("transform", event.transform);
  });
  svg.call(zoom);

  const initialTransform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(scale)
    .translate(-cx, -cy);
  svg.call(zoom.transform, initialTransform);

  document.getElementById("zoom-in").onclick = () => svg.transition().duration(200).call(zoom.scaleBy, 1.3);
  document.getElementById("zoom-out").onclick = () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.3);
  document.getElementById("zoom-reset").onclick = () => svg.transition().duration(300).call(zoom.transform, initialTransform);

  renderUnlinked(unlinked, familyData);
}

function fitText(textNode, maxWidth) {
  let fontSize = parseFloat(getComputedStyle(textNode).fontSize) || 12;
  while (textNode.getComputedTextLength() > maxWidth && fontSize > 8) {
    fontSize -= 0.5;
    textNode.style.fontSize = `${fontSize}px`;
  }
  if (textNode.getComputedTextLength() > maxWidth) {
    let text = textNode.textContent;
    while (text.length > 3 && textNode.getComputedTextLength() > maxWidth) {
      text = text.slice(0, -1);
      textNode.textContent = text + "…";
    }
  }
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
