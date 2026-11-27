/* Эвакуатор Коломна — навигация, калькулятор, карта и защита формы. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const config = window.EVAC_CONFIG || {};

  // Мобильная навигация
  const menuButton = $("menuBtn");
  const navigation = $("nav");
  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const open = navigation.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    });
    navigation.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      navigation.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }));
  }
  if ($("year")) $("year").textContent = String(new Date().getFullYear());

  // Галерея
  const lightbox = $("lightbox"), lightboxImage = $("lightboxImage"), lightboxClose = $("lightboxClose");
  const galleryTrigger = document.querySelector(".gallery-feature-open");
  const closeLightbox = () => {
    if (!lightbox || !lightboxImage) return;
    lightbox.classList.remove("open"); lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; lightboxImage.removeAttribute("src");
  };
  if (lightbox && lightboxImage && galleryTrigger) {
    galleryTrigger.addEventListener("click", () => {
      lightboxImage.src = galleryTrigger.dataset.image || "";
      lightbox.classList.add("open"); lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden"; lightboxClose?.focus();
    });
    lightboxClose?.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
  }

  // Единые тарифы: подача + дорожное расстояние * тариф + ожидание сверх первых 15 минут.
  const tariffs = {
    car: { label: "Легковой автомобиль", dispatch: 4000, perKm: 100 },
    crossover: { label: "Кроссовер", dispatch: 4500, perKm: 100 },
    suv: { label: "Внедорожник", dispatch: 5000, perKm: 100 },
    van: { label: "Газель и микроавтобус", dispatch: 6000, perKm: 100 },
    manipulator: { label: "Эвакуатор-манипулятор", dispatch: 12000, perKm: 150 }
  };
  const vehicleSelect = $("vehicleType"), distanceInput = $("tripDistance");
  const waitingSelect = $("waitingBlocks"), estimatedPrice = $("estimatedPrice"), estimateDetails = $("estimateDetails");
  const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const updateEstimate = () => {
    if (!vehicleSelect || !distanceInput || !estimatedPrice || !estimateDetails) return;
    const tariff = tariffs[vehicleSelect.value], km = Number(distanceInput.value), blocks = Number(waitingSelect?.value || 0);
    if (!tariff || !Number.isFinite(km) || km <= 0 || km > 5000) {
      estimatedPrice.textContent = "— ₽";
      estimateDetails.textContent = km > 5000 ? "Максимальное расстояние для расчёта — 5 000 км" : "Укажите маршрут на карте или введите расстояние";
      return;
    }
    const waitCost = Math.max(0, blocks) * 300;
    const total = tariff.dispatch + km * tariff.perKm + waitCost;
    estimatedPrice.textContent = `${rub.format(Math.round(total))} ₽`;
    estimateDetails.textContent = `${rub.format(tariff.dispatch)} ₽ подача + ${rub.format(km)} км × ${rub.format(tariff.perKm)} ₽${waitCost ? ` + ${rub.format(waitCost)} ₽ ожидание` : ""}`;
  };
  vehicleSelect?.addEventListener("change", updateEstimate);
  distanceInput?.addEventListener("input", updateEstimate);
  waitingSelect?.addEventListener("change", updateEstimate);

  // Внешние карты вместо встроенных OSM-тайлов: посетитель выбирает привычный сервис.
  const routeForm = $("routeForm"), routePanel = $("routeMapPanel"), mapHelp = $("mapHelp"), mapResult = $("mapResult");
  const pickupInput = $("pickupAddress"), dropoffInput = $("dropoffAddress"), routeVehicle = $("routeVehicle");
  let pickupCoords = null, lastCalc = 0;
  const setMapMessage = (message) => { if (mapHelp) mapHelp.textContent = message; };
  const showMap = () => {
    if (!routePanel) return;
    routePanel.hidden = false;
    if (reducedMotion) routePanel.scrollIntoView({ block: "nearest" });
    else routePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    refreshMapLinks();
  };
  const currentPickup = () => pickupCoords ? `${pickupCoords.latitude},${pickupCoords.longitude}` : (pickupInput?.value.trim() || "");
  const refreshMapLinks = () => {
    const from = currentPickup();
    const to = dropoffInput?.value.trim() || "";
    const yandex = $("mapYandex"), gis = $("map2gis"), google = $("mapGoogle"), apple = $("mapApple");
    const enc = encodeURIComponent;
    if (yandex) yandex.href = from && to
      ? `https://yandex.ru/maps/?rtext=${enc(from)}~${enc(to)}&rtt=auto`
      : `https://yandex.ru/maps/?text=${enc(to || from || "Коломна")}`;
    if (google) google.href = from && to
      ? `https://www.google.com/maps/dir/?api=1&origin=${enc(from)}&destination=${enc(to)}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${enc(to || from || "Коломна")}`;
    if (apple) apple.href = from && to
      ? `https://maps.apple.com/?saddr=${enc(from)}&daddr=${enc(to)}&dirflg=d`
      : `https://maps.apple.com/?q=${enc(to || from || "Коломна")}`;
    // Веб-маршрут 2ГИС требует координаты обеих точек. Для текстового адреса открываем поиск 2ГИС.
    if (gis) gis.href = `https://2gis.ru/kolomna/search/${enc(to || from || "Коломна")}`;
  };
  $("openRouteMap")?.addEventListener("click", showMap);
  $("locateMe")?.addEventListener("click", () => {
    if (!navigator.geolocation) { setMapMessage("Этот браузер не поддерживает геолокацию. Введите адрес подачи вручную."); return; }
    setMapMessage("Запрашиваем разрешение на геолокацию…");
    navigator.geolocation.getCurrentPosition((position) => {
      pickupCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (pickupInput) pickupInput.value = "Моё местоположение";
      refreshMapLinks();
      setMapMessage("Местоположение определено. Укажите адрес доставки и выберите карту для построения маршрута.");
    }, () => setMapMessage("Не удалось определить местоположение. Проверьте разрешение браузера или введите адрес подачи вручную."), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
  pickupInput?.addEventListener("input", () => { pickupCoords = null; refreshMapLinks(); });
  dropoffInput?.addEventListener("input", refreshMapLinks);
  ["mapYandex", "map2gis", "mapGoogle", "mapApple"].forEach((id) => $(id)?.addEventListener("click", (event) => {
    if (!pickupInput?.value.trim() && !pickupCoords && !dropoffInput?.value.trim()) {
      event.preventDefault(); setMapMessage("Сначала укажите адрес подачи или доставки.");
    }
  }));
  $("applyRouteDistance")?.addEventListener("click", () => {
    const km = Number($("routeDistanceKm")?.value);
    if (!Number.isFinite(km) || km <= 0 || km > 5000) { setMapMessage("Введите расстояние по дорогам от 0,1 до 5 000 км."); return; }
    if (distanceInput) distanceInput.value = String(km);
    if (routeVehicle && vehicleSelect) vehicleSelect.value = routeVehicle.value;
    updateEstimate();
    if (mapResult) {
      mapResult.hidden = false;
      mapResult.textContent = `Расстояние: ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(km)} км. Предварительная стоимость: ${estimatedPrice?.textContent || "уточняется"}. Окончательную цену подтвердит Артемий.`;
    }
    setMapMessage("Расчёт обновлён. Для точной стоимости согласуйте маршрут и условия погрузки с Артемием.");
  });

  routeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const now = Date.now();
    if (now - lastCalc < 1500) { setMapMessage("Подождите немного перед следующим действием."); return; }
    lastCalc = now;
    if (!pickupInput?.value.trim() && !pickupCoords) { showMap(); setMapMessage("Укажите адрес подачи или нажмите «Моё местоположение»."); return; }
    if (!dropoffInput?.value.trim()) { showMap(); setMapMessage("Укажите адрес, куда доставить автомобиль."); return; }
    if (routeVehicle && vehicleSelect) vehicleSelect.value = routeVehicle.value;
    showMap(); refreshMapLinks();
    setMapMessage("Выберите Яндекс Карты, 2ГИС, Google Maps или Apple Карты. После просмотра маршрута введите километраж ниже — калькулятор рассчитает ориентировочную цену.");
    if ($("routeSummary")) {
      $("routeSummary").hidden = false;
      $("routeSummary").textContent = `Маршрут: ${pickupInput.value || "Моё местоположение"} → ${dropoffInput.value}`;
    }
  });

  // Плавное появление элементов; не запускаем анимации при prefers-reduced-motion.
  if (!reducedMotion && "IntersectionObserver" in window) {
    const items = document.querySelectorAll(".section-head,.service-card,.advantages-title,.adv-item,.gallery-feature,.contact-layout,.contact-card,.fleet-card,.arrival-prep");
    document.body.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries, obs) => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); obs.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: "0px 0px -35px 0px" });
    items.forEach((item, index) => { item.classList.add("reveal"); if (index % 3) item.classList.add(`reveal-delay-${index % 3}`); observer.observe(item); });
  }
})();
