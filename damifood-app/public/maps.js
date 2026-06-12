function loadYandex(key) {
  return new Promise((resolve, reject) => {
    if (window.ymaps) return ymaps.ready(resolve);
    if (!key || key === "YOUR_YANDEX_MAPS_API_KEY") return reject(new Error("Yandex Maps API key қойылмаған"));
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=kk_KZ`;
    s.onload = () => ymaps.ready(resolve);
    s.onerror = () => reject(new Error("Yandex Maps жүктелмеді"));
    document.head.appendChild(s);
  });
}

async function initAddressMap(id, onCoords, onAddress) {
  try {
    await loadYandex(Dami.state.settings.yandexApiKey);
    const map = new ymaps.Map(id, { center: [51.1282, 71.4304], zoom: 12, controls: ["zoomControl", "searchControl"] });
    let placemark;
    map.events.add("click", async e => {
      const coordsLatLon = e.get("coords");
      const coords = [coordsLatLon[1], coordsLatLon[0]];
      if (!placemark) {
        placemark = new ymaps.Placemark(coordsLatLon, {}, { draggable: true });
        map.geoObjects.add(placemark);
      } else placemark.geometry.setCoordinates(coordsLatLon);
      onCoords(coords);
      try {
        const res = await ymaps.geocode(coordsLatLon);
        const first = res.geoObjects.get(0);
        onAddress(first ? first.getAddressLine() : `${coordsLatLon[0]}, ${coordsLatLon[1]}`);
      } catch {
        onAddress(`${coordsLatLon[0]}, ${coordsLatLon[1]}`);
      }
    });
  } catch (e) {
    Dami.toast(e.message, true);
  }
}

async function initTrackingMap(id, order) {
  try {
    await loadYandex(Dami.state.settings.yandexApiKey);
    const userCoords = [order.coords[1], order.coords[0]];
    const courierCoords = [order.courierCoords[1], order.courierCoords[0]];
    const map = new ymaps.Map(id, { center: userCoords, zoom: 13, controls: ["zoomControl"] });
    const client = new ymaps.Placemark(userCoords, { balloonContent: order.address }, { preset: "islands#greenHomeIcon" });
    const courier = new ymaps.Placemark(courierCoords, { balloonContent: "Курьер" }, { preset: "islands#blueDeliveryIcon" });
    map.geoObjects.add(client).add(courier);
    ymaps.route([courierCoords, userCoords]).then(route => map.geoObjects.add(route));
  } catch (e) {
    Dami.toast(e.message, true);
  }
}
