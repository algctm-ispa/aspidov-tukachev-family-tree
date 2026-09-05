// "Путь рода" — the migration map, ported from the Claude Design mockup:
// a Leaflet map on OpenStreetMap tiles, a ruby legend panel, square pins and
// three routes. Владимир's line runs solid, Людмила's dashed, and the move the
// two of them made together is drawn thicker.
//
// Village coordinates are approximate and labelled as such: Тюремка and
// Сырчики are small settlements and the family's exact plot is not documented.

const ROUTE_PLACES = {
  tyuremka: { ll: [57.19, 55.62], name: "Тюремка", sub: "ныне Красные Горки, Осинский округ. Положение примерное", approx: true },
  syrchiki: { ll: [58.52, 55.80], name: "Сырчики", sub: "Ильинский округ. Положение примерное", approx: true },
  chermoz:  { ll: [58.79, 56.17], name: "Чёрмоз", sub: "родина Людмилы" },
  perm:     { ll: [58.01, 56.25], name: "Пермь", sub: "здесь линии встретились" },
  moscow:   { ll: [55.75, 37.62], name: "Москва", sub: "куда переехала семья" }
};

// If the map library cannot be reached, the section still shows the route as
// a plain schematic rather than an empty box.
function renderRouteFallback(el) {
  const order = ["syrchiki", "chermoz", "tyuremka", "perm", "moscow"];
  const pts = {
    tyuremka: [70, 78], syrchiki: [22, 22], chermoz: [46, 34],
    perm: [64, 50], moscow: [12, 88]
  };
  void order;
  const line = (a, b, cls) => `<path class="${cls}" d="M ${pts[a][0]} ${pts[a][1]} L ${pts[b][0]} ${pts[b][1]}" />`;
  const pin = k => `<g><rect class="rf-pin" x="${pts[k][0] - 1.4}" y="${pts[k][1] - 1.4}" width="2.8" height="2.8" />
      <text class="rf-label" x="${pts[k][0] + 3}" y="${pts[k][1] + 1}">${ROUTE_PLACES[k].name}</text></g>`;
  el.innerHTML = `<svg class="route-fallback" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Схема пути рода: Тюремка в Пермь, Сырчики в Чёрмоз и в Пермь, из Перми в Москву">
      ${line("tyuremka", "perm", "rf-solid")}
      ${line("syrchiki", "chermoz", "rf-dashed")}
      ${line("chermoz", "perm", "rf-dashed")}
      ${line("perm", "moscow", "rf-thick")}
      ${Object.keys(pts).map(pin).join("")}
    </svg>`;
  el.classList.add("is-fallback");
}

function renderRouteMap() {
  const el = document.getElementById("route-map");
  if (!el) return;
  if (typeof L === "undefined") { renderRouteFallback(el); return; }

  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#8e1c2c";

  const vladimir = [ROUTE_PLACES.tyuremka.ll, ROUTE_PLACES.perm.ll];
  const lyudmila = [ROUTE_PLACES.syrchiki.ll, ROUTE_PLACES.chermoz.ll, ROUTE_PLACES.perm.ll];
  const together = [ROUTE_PLACES.perm.ll, ROUTE_PLACES.moscow.ll];

  L.polyline(vladimir, { color: accent, weight: 3 }).addTo(map);
  L.polyline(lyudmila, { color: accent, weight: 3, dashArray: "8 7" }).addTo(map);
  L.polyline(together, { color: accent, weight: 5 }).addTo(map);

  for (const key of Object.keys(ROUTE_PLACES)) {
    const place = ROUTE_PLACES[key];
    const icon = L.divIcon({
      className: "route-pin-wrap",
      html: `<div class="route-pin"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker(place.ll, { icon, title: place.name, keyboard: true })
      .addTo(map)
      .bindTooltip(
        `<span class="route-marker-label">${place.name}</span><br><span class="route-marker-sub">${place.sub}</span>`,
        { direction: "right", offset: [10, 0], opacity: 1 }
      );
  }

  const all = Object.keys(ROUTE_PLACES).map(k => ROUTE_PLACES[k].ll);
  map.fitBounds(L.latLngBounds(all).pad(0.18));
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());
}
