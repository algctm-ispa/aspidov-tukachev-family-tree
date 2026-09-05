// Turns the relationship graph into (generation, x) coordinates for every
// person, without assuming a fixed shape: this must keep working as more
// ancestors are added to the dataset later.

function computeGenerations(familyData) {
  const generation = new Map();
  const queue = [];

  for (const id of SITE_CONFIG.anchorPersonIds) {
    if (familyData.people.has(id) && !generation.has(id)) {
      generation.set(id, 0);
      queue.push(id);
    }
  }

  while (queue.length) {
    const current = queue.shift();
    const g = generation.get(current);

    for (const { parentId } of familyData.parentEdgesByChild.get(current) || []) {
      if (!generation.has(parentId)) { generation.set(parentId, g + 1); queue.push(parentId); }
    }
    for (const { childId } of familyData.childEdgesByParent.get(current) || []) {
      if (!generation.has(childId)) { generation.set(childId, g - 1); queue.push(childId); }
    }
    for (const { spouseId } of familyData.spouseEdgesByPerson.get(current) || []) {
      if (!generation.has(spouseId)) { generation.set(spouseId, g); queue.push(spouseId); }
    }
  }

  const unlinked = [...familyData.people.keys()].filter(id => !generation.has(id));
  return { generation, unlinked };
}

// A DFS traversal starting from the anchor couple, used only to produce a
// sensible left-to-right ordering within each generation row (keeps couples
// and siblings visually clustered before the numeric relaxation pass runs).
function computeTraversalOrder(familyData, generation) {
  const visited = new Set();
  const order = [];

  function visit(id) {
    if (visited.has(id) || !generation.has(id)) return;
    visited.add(id);
    order.push(id);
    for (const { spouseId } of familyData.spouseEdgesByPerson.get(id) || []) visit(spouseId);
    for (const { parentId } of familyData.parentEdgesByChild.get(id) || []) visit(parentId);
    for (const { childId } of familyData.childEdgesByParent.get(id) || []) visit(childId);
  }

  for (const anchor of SITE_CONFIG.anchorPersonIds) visit(anchor);
  for (const id of generation.keys()) visit(id); // sweep up any remaining connected clusters

  return order;
}

function computeLayout(familyData) {
  const { generation, unlinked } = computeGenerations(familyData);
  const order = computeTraversalOrder(familyData, generation);
  const spacing = SITE_CONFIG.layout.minNodeSpacing;
  const spouseGap = SITE_CONFIG.layout.spouseGap;

  const rows = new Map(); // generation number -> [personId] in row order
  for (const id of order) {
    const g = generation.get(id);
    if (!rows.has(g)) rows.set(g, []);
    rows.get(g).push(id);
  }

  const positions = new Map(); // id -> {x, generation}
  for (const [g, ids] of rows) {
    ids.forEach((id, i) => positions.set(id, { x: i * spacing, generation: g }));
  }

  const generationsAscending = [...rows.keys()].sort((a, b) => a - b);
  const generationsDescending = [...generationsAscending].reverse();

  function pullTowardsChildren() {
    for (const g of generationsAscending) {
      for (const id of rows.get(g)) {
        const children = (familyData.childEdgesByParent.get(id) || [])
          .map(e => positions.get(e.childId))
          .filter(Boolean);
        if (children.length) {
          const avg = children.reduce((s, p) => s + p.x, 0) / children.length;
          positions.get(id).x = avg;
        }
      }
    }
  }

  function pullTowardsParents() {
    for (const g of generationsDescending) {
      for (const id of rows.get(g)) {
        const parents = (familyData.parentEdgesByChild.get(id) || [])
          .map(e => positions.get(e.parentId))
          .filter(Boolean);
        if (parents.length) {
          const avg = parents.reduce((s, p) => s + p.x, 0) / parents.length;
          positions.get(id).x = (positions.get(id).x + avg) / 2;
        }
      }
    }
  }

  function snapCouplesTogether() {
    const paired = new Set();
    for (const [g, ids] of rows) {
      for (const id of ids) {
        if (paired.has(id)) continue;
        const spouses = familyData.spouseEdgesByPerson.get(id) || [];
        const spouse = spouses.map(s => s.spouseId).find(sid => generation.get(sid) === g && !paired.has(sid));
        if (!spouse) continue;
        paired.add(id); paired.add(spouse);
        const center = (positions.get(id).x + positions.get(spouse).x) / 2;
        const idIsFirst = ids.indexOf(id) < ids.indexOf(spouse);
        positions.get(id).x = idIsFirst ? center - spouseGap / 2 : center + spouseGap / 2;
        positions.get(spouse).x = idIsFirst ? center + spouseGap / 2 : center - spouseGap / 2;
      }
    }
  }

  function resolveOverlaps() {
    for (const [g, ids] of rows) {
      const sorted = [...ids].sort((a, b) => positions.get(a).x - positions.get(b).x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = positions.get(sorted[i - 1]);
        const cur = positions.get(sorted[i]);
        if (cur.x < prev.x + spacing) cur.x = prev.x + spacing;
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    pullTowardsChildren();
    snapCouplesTogether();
    pullTowardsParents();
    snapCouplesTogether();
  }
  resolveOverlaps();
  snapCouplesTogether();

  // Center the whole layout horizontally around x = 0.
  const allX = [...positions.values()].map(p => p.x);
  const midX = allX.length ? (Math.min(...allX) + Math.max(...allX)) / 2 : 0;
  for (const p of positions.values()) p.x -= midX;

  return { positions, unlinked, minGeneration: generationsAscending[0] ?? 0, maxGeneration: generationsAscending[generationsAscending.length - 1] ?? 0 };
}
