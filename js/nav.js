// Шапка на телефоне. Семь ссылок и кнопка занимали три строки и съедали
// треть первого экрана, поэтому на узком экране они убраны под кнопку меню,
// а в шапке остаётся только имя сайта. На широком экране всё как было.

// Высота липкой шапки меряется, а не задаётся числом: на неё опираются якоря
// секций, а сама шапка меняет высоту вместе с шириной окна.
function syncNavHeight() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  document.documentElement.style.setProperty("--nav-h", Math.round(nav.getBoundingClientRect().height) + "px");
}

function setupNav() {
  syncNavHeight();
  window.addEventListener("resize", syncNavHeight);

  const burger = document.getElementById("nav-burger");
  const links = document.getElementById("nav-links");
  if (!burger || !links) return;

  const close = () => {
    links.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  };
  const toggle = () => {
    const open = links.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  };

  burger.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  // Переход по ссылке закрывает меню: иначе оно осталось бы висеть над
  // разделом, к которому человек только что перешёл.
  links.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  document.addEventListener("click", (e) => {
    if (!links.classList.contains("is-open")) return;
    if (!links.contains(e.target) && e.target !== burger) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // Меню нужно только на узком экране: на широком ссылки видны всегда.
  window.addEventListener("resize", () => { if (window.innerWidth > 900) close(); });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupNav);
} else {
  setupNav();
}
