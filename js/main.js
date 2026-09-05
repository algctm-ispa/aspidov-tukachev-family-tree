async function main() {
  const loading = document.getElementById("tree-loading");
  try {
    const familyData = await loadFamilyData();

    const panel = document.getElementById("detail-panel");
    const overlay = document.getElementById("detail-overlay");
    const content = document.getElementById("detail-content");

    function openDetail(person) {
      content.innerHTML = renderPersonDetail(person, familyData);
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      overlay.hidden = false;
    }
    function closeDetail() {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      overlay.hidden = true;
    }
    document.getElementById("detail-close").addEventListener("click", closeDetail);
    overlay.addEventListener("click", closeDetail);

    renderTree(familyData, openDetail);
    loading.style.display = "none";

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => renderTree(familyData, openDetail), 200);
    });
  } catch (err) {
    console.error(err);
    loading.textContent = "Не удалось загрузить данные древа. Попробуйте обновить страницу.";
  }
}

main();
