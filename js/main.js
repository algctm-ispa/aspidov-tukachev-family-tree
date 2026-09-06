async function main() {
  const loading = document.getElementById("tree-loading");
  try {
    const familyData = await loadFamilyData();
    const { generation: generations } = computeGenerations(familyData);
    const sides = computeSides(familyData);
    const directAncestors = computeDirectAncestors(familyData);
    const kinship = buildKinship(familyData, generations, sides, directAncestors);
    const photoAvailability = await computePhotoAvailability(familyData);

    const overlay = document.getElementById("detail-overlay");
    const content = document.getElementById("detail-content");

    function openDialog(html) {
      content.innerHTML = html;
      overlay.hidden = false;
      const closeBtn = content.querySelector(".dialog-close");
      if (closeBtn) closeBtn.addEventListener("click", closeDialog);
    }
    function closeDialog() {
      overlay.hidden = true;
    }
    function openPerson(person) {
      openDialog(renderPersonDetail(person, familyData, kinship.get(person.id) || "", photoAvailability.has(person.id)));
    }
    function openNewRelative() {
      openDialog(renderNewRelativeDialog());
    }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDialog(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDialog(); });

    for (const id of ["add-relative", "story-add", "contribute-add"]) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", openNewRelative);
    }

    const changeLink = document.getElementById("contribute-change");
    if (changeLink && SITE_CONFIG.correctionForm.ready) {
      changeLink.href = SITE_CONFIG.correctionForm.baseUrl;
    }

    // Слева день свадьбы, справа сегодняшний снимок. Свадебное фото уже есть
    // в проекте, его же показывает «Вестник нашей семьи», второй копии не нужно.
    const heroShots = [
      { id: "hero-photo-then", url: "assets/photos/wedding.jpg", fallback: "Свадебная фотография, 6 сентября 1986 года" },
      { id: "hero-photo", url: "assets/photos/hero.jpg", fallback: "Фотография Владимира и Людмилы" }
    ];
    for (const shot of heroShots) {
      const el = document.getElementById(shot.id);
      if (!el) continue;
      if (await checkImageExists(shot.url)) {
        el.style.backgroundImage = `url(${shot.url})`;
      } else {
        el.textContent = shot.fallback;
      }
    }

    renderTree(familyData, openPerson, kinship, photoAvailability);
    renderStats(familyData);
    renderChronicle(familyData);
    if (typeof renderNews === "function") renderNews("news-list", 3);
    if (typeof renderRouteMap === "function") renderRouteMap();
    loading.style.display = "none";
  } catch (err) {
    console.error(err);
    loading.textContent = "Не удалось загрузить данные древа. Попробуйте обновить страницу.";
  }
}

main();
