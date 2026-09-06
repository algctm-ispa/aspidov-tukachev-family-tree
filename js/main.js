// Шапка липкая и на узком экране переносится на несколько строк, поэтому её
// высота меряется, а не задаётся числом: на неё опираются якоря секций.
function syncNavHeight() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  document.documentElement.style.setProperty("--nav-h", Math.round(nav.getBoundingClientRect().height) + "px");
}

async function main() {
  syncNavHeight();
  window.addEventListener("resize", syncNavHeight);
  const loading = document.getElementById("tree-loading");
  try {
    const familyData = await loadFamilyData();
    const kinshipFor = data => {
      const { generation } = computeGenerations(data);
      return buildKinship(data, generation, computeSides(data), computeDirectAncestors(data));
    };
    const kinship = kinshipFor(familyData);
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

    // Подарок открывается на том, что семья подтвердила. Непроверенные версии
    // никуда не деваются, но ждут за переключателем «Гипотеза».
    const hypothesesToggle = document.getElementById("toggle-hypotheses");
    const unlinkedPanel = document.getElementById("unlinked-panel");
    let showHypotheses = false;

    function drawTree() {
      const view = showHypotheses
        ? familyData
        : filterFamilyData(familyData, p => p.statusTier === "confirmed");
      renderTree(view, openPerson, showHypotheses ? kinship : kinshipFor(view), photoAvailability);
      if (unlinkedPanel && !showHypotheses) unlinkedPanel.hidden = true;
      if (hypothesesToggle) hypothesesToggle.setAttribute("aria-pressed", String(showHypotheses));
    }

    if (hypothesesToggle) {
      hypothesesToggle.addEventListener("click", () => {
        showHypotheses = !showHypotheses;
        drawTree();
      });
    }

    drawTree();
    renderStats(familyData);
    renderChronicle(familyData);
    renderMemorial(familyData);
    const memorialList = document.getElementById("memorial-list");
    if (memorialList) {
      memorialList.addEventListener("click", (e) => {
        const el = e.target.closest("[data-id]");
        if (!el) return;
        const person = familyData.people.get(el.dataset.id);
        if (person) openPerson(person);
      });
    }
    if (typeof renderNews === "function") renderNews("news-list", 3);
    if (typeof renderRouteMap === "function") renderRouteMap();
    loading.style.display = "none";
  } catch (err) {
    console.error(err);
    loading.textContent = "Не удалось загрузить данные древа. Попробуйте обновить страницу.";
  }
}

main();
