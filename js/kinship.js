// Works out, generically, which side of the family (Vladimir's or Lyudmila's)
// each person belongs to, whether they're a direct ancestor of the anchor
// couple or a collateral relative (sibling/cousin), and how many generations
// back they sit — so the detail dialog can show a kicker like
// "Линия Владимира · прадед" without anyone hand-writing it per person.

function computeSides(familyData) {
  const [a, b] = SITE_CONFIG.anchorPersonIds;
  const side = new Map();

  function bfs(start, label, exclude) {
    if (!familyData.people.has(start)) return;
    const queue = [start];
    side.set(start, label);
    while (queue.length) {
      const cur = queue.shift();
      const neighbors = [
        ...(familyData.parentEdgesByChild.get(cur) || []).map(e => e.parentId),
        ...(familyData.childEdgesByParent.get(cur) || []).map(e => e.childId),
        ...(familyData.spouseEdgesByPerson.get(cur) || []).map(e => e.spouseId)
      ];
      for (const id of neighbors) {
        if (id === exclude || side.has(id)) continue;
        side.set(id, label);
        queue.push(id);
      }
    }
  }

  bfs(a, "vladimir", b);
  bfs(b, "lyudmila", a);
  return side;
}

// A person is a "direct ancestor" if you can reach an anchor by repeatedly
// following biological_parent edges downward from them (or if they ARE an
// anchor). Everyone else connected to the graph is a collateral relative
// (a sibling, or a sibling's descendant).
function computeDirectAncestors(familyData) {
  const direct = new Set(SITE_CONFIG.anchorPersonIds);
  const queue = [...SITE_CONFIG.anchorPersonIds];
  while (queue.length) {
    const cur = queue.shift();
    for (const { parentId } of familyData.parentEdgesByChild.get(cur) || []) {
      if (!direct.has(parentId)) { direct.add(parentId); queue.push(parentId); }
    }
  }
  return direct;
}

function kinshipTerm(generation, sex) {
  const male = sex === "male";
  if (generation <= 1) return male ? "отец" : "мать";
  if (generation === 2) return male ? "дед" : "бабушка";
  if (generation === 3) return male ? "прадед" : "прабабушка";
  const prefix = "пра".repeat(generation - 3);
  return male ? `${prefix}прадед` : `${prefix}прабабушка`;
}

// Genitive of the same term, so a collateral relative can be described by who
// they are a sibling of ("брат бабушки", "сестра прадеда") instead of being
// flattened to a bare "брат".
function kinshipTermGenitive(generation, sex) {
  const male = sex === "male";
  if (generation <= 1) return male ? "отца" : "матери";
  if (generation === 2) return male ? "деда" : "бабушки";
  const prefix = "пра".repeat(Math.max(0, generation - 3));
  return male ? `${prefix}прадеда` : `${prefix}прабабушки`;
}

// Generations below the anchor couple: the line carrying on.
function descendantTerm(generation, sex) {
  const male = sex === "male";
  if (generation === -1) return male ? "сын" : "дочь";
  const prefix = "пра".repeat(Math.max(0, -generation - 2));
  return male ? `${prefix}внук` : `${prefix}внучка`;
}

// For someone off the direct line, find the direct ancestor they share a
// parent with — that sibling is what gives the relation its name.
function ancestorSiblingOf(id, familyData, directAncestors) {
  for (const { parentId } of familyData.parentEdgesByChild.get(id) || []) {
    for (const { childId } of familyData.childEdgesByParent.get(parentId) || []) {
      if (childId !== id && directAncestors.has(childId)) return childId;
    }
  }
  return null;
}

function buildKinship(familyData, generations, sides, directAncestors) {
  const kinship = new Map();
  for (const [id, person] of familyData.people) {
    if (SITE_CONFIG.anchorPersonIds.includes(id)) {
      kinship.set(id, "Рубиновая свадьба · 40 лет вместе");
      continue;
    }
    const side = sides.get(id);
    const sideLabel = side === "vladimir" ? "Линия Владимира" : side === "lyudmila" ? "Линия Людмилы" : "Родство уточняется";
    const gen = generations.get(id);
    const male = person.sex === "male";
    let role;
    if (gen == null) {
      // No edge into the tree yet — say only what is actually known.
      role = male ? "родственник" : "родственница";
    } else if (gen < 0) {
      role = descendantTerm(gen, person.sex);
    } else if (directAncestors.has(id)) {
      role = kinshipTerm(gen, person.sex);
    } else if (gen === 0) {
      role = male ? "брат" : "сестра";
    } else {
      const sibling = ancestorSiblingOf(id, familyData, directAncestors);
      const siblingPerson = sibling ? familyData.people.get(sibling) : null;
      role = siblingPerson
        ? `${male ? "брат" : "сестра"} ${kinshipTermGenitive(generations.get(sibling), siblingPerson.sex)}`
        : (male ? "родственник" : "родственница");
    }
    const tierSuffix = person.statusTier !== "confirmed" ? ` · ${statusLabel(person.statusTier)}` : "";
    // A descendant belongs to both lines at once, so naming one of them would
    // be arbitrary — the relation alone says everything.
    const prefix = gen != null && gen < 0 ? "" : `${sideLabel} · `;
    kinship.set(id, `${prefix}${role}${tierSuffix}`);
  }
  return kinship;
}
