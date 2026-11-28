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

  // Встроенная карта Яндекс.Карт. API загружается только при открытии карты.
  // Для работы владелец сайта указывает собственный ключ в turnstile-config.js.
  const routeForm = $("routeForm"), routePanel = $("routeMapPanel");
  const pickupInput = $("pickupAddress"), dropoffInput = $("dropoffAddress"), routeVehicle = $("routeVehicle");
  const mapHelp = $("mapHelp"), mapApiNote = $("mapApiNote"), mapResult = $("mapResult");
  const choosePickup = $("choosePickup"), chooseDropoff = $("chooseDropoff");
  let mapInstance = null, multiRoute = null, mapLoadPromise = null;
  let pickupCoords = null, dropoffCoords = null, selectionMode = "pickup", lastCalc = 0;
  const mapPins = { pickup: null, dropoff: null };
  const setMapMessage = (message) => { if (mapHelp) mapHelp.textContent = message; };
  const setMapNote = (message) => { if (mapApiNote) mapApiNote.textContent = message; };
  const showMap = () => {
    if (!routePanel) return;
    routePanel.hidden = false;
    if (reducedMotion) routePanel.scrollIntoView({ block: "nearest" });
    else routePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    loadYandexMaps();
  };
  const setSelectionMode = (mode) => {
    selectionMode = mode;
    choosePickup?.classList.toggle("is-active", mode === "pickup");
    chooseDropoff?.classList.toggle("is-active", mode === "dropoff");
    setMapMessage(mode === "pickup"
      ? "Выбрана точка А — место подачи. Коснитесь нужного места на карте."
      : "Выбрана точка Б — место доставки. Коснитесь нужного места на карте.");
  };
  choosePickup?.addEventListener("click", () => setSelectionMode("pickup"));
  chooseDropoff?.addEventListener("click", () => setSelectionMode("dropoff"));

  const formatKm = (km) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(km);
  const calculateRoutePrice = (km) => {
    if (distanceInput) distanceInput.value = String(km);
    if (routeVehicle && vehicleSelect) vehicleSelect.value = routeVehicle.value;
    updateEstimate();
    const priceText = estimatedPrice?.textContent || "— ₽";
    if (mapResult) mapResult.hidden = false;
    if ($("mapDistance")) $("mapDistance").textContent = `${formatKm(km)} км`;
    if ($("mapPrice")) $("mapPrice").textContent = priceText;
    if ($("routeSummary")) {
      $("routeSummary").hidden = false;
      $("routeSummary").textContent = `Маршрут: ${pickupInput?.value || "Точка подачи"} → ${dropoffInput?.value || "Точка доставки"} · ${formatKm(km)} км`;
    }
  };
  const updateRouteDistance = () => {
    if (!multiRoute) return;
    const active = multiRoute.getActiveRoute && multiRoute.getActiveRoute();
    if (!active) return;
    const distance = active.properties.get("distance");
    let meters = distance && Number(distance.value);
    if ((!Number.isFinite(meters) || meters <= 0) && distance?.text) {
      const normalized = String(distance.text).replace(/\s/g, "").replace(",", ".");
      const amount = Number((normalized.match(/[0-9.]+/) || [])[0]);
      if (Number.isFinite(amount)) meters = /км/i.test(normalized) ? amount * 1000 : amount;
    }
    if (!Number.isFinite(meters) || meters <= 0) return;
    calculateRoutePrice(Math.max(0.1, Math.round((meters / 1000) * 10) / 10));
    setMapMessage("Маршрут построен. Стоимость рассчитана автоматически по дорожному расстоянию. Итог подтвердит Артемий.");
  };
  const clearRouteLine = () => {
    if (multiRoute && mapInstance) mapInstance.geoObjects.remove(multiRoute);
    multiRoute = null;
    if (mapResult) mapResult.hidden = true;
  };
  const drawSelectedPins = () => {
    if (!mapInstance || !window.ymaps) return;
    Object.keys(mapPins).forEach((key) => {
      if (mapPins[key]) mapInstance.geoObjects.remove(mapPins[key]);
      mapPins[key] = null;
    });
    if (pickupCoords) {
      mapPins.pickup = new ymaps.Placemark(pickupCoords, { balloonContent: "А · Место подачи" }, {
        preset: "islands#blueCircleDotIcon", iconColor: "#58b9f4"
      });
      mapInstance.geoObjects.add(mapPins.pickup);
    }
    if (dropoffCoords) {
      mapPins.dropoff = new ymaps.Placemark(dropoffCoords, { balloonContent: "Б · Место доставки" }, {
        preset: "islands#yellowCircleDotIcon", iconColor: "#f4cf73"
      });
      mapInstance.geoObjects.add(mapPins.dropoff);
    }
  };
  const reverseAddress = async (coords) => {
    try {
      const result = await ymaps.geocode(coords, { results: 1 });
      const first = result.geoObjects.get(0);
      return first ? first.getAddressLine() : `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
    } catch (_) {
      return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
    }
  };
  const buildRoute = () => {
    if (!mapInstance || !pickupCoords || !dropoffCoords) return;
    clearRouteLine();
    if (mapPins.pickup) mapInstance.geoObjects.remove(mapPins.pickup);
    if (mapPins.dropoff) mapInstance.geoObjects.remove(mapPins.dropoff);
    mapPins.pickup = mapPins.dropoff = null;
    multiRoute = new ymaps.multiRouter.MultiRoute({
      referencePoints: [pickupCoords, dropoffCoords],
      params: { routingMode: "auto", results: 2 }
    }, {
      boundsAutoApply: true,
      routeActiveStrokeWidth: 6,
      routeActiveStrokeColor: "#55b8f4",
      routeStrokeWidth: 4,
      wayPointStartIconColor: "#ffffff",
      wayPointStartIconFillColor: "#278ed0",
      wayPointFinishIconColor: "#142c46",
      wayPointFinishIconFillColor: "#f2ca6b"
    });
    mapInstance.geoObjects.add(multiRoute);
    multiRoute.model.events.add("requestsuccess", updateRouteDistance);
    multiRoute.model.events.add("requestfail", () => setMapMessage("Не удалось построить маршрут. Попробуйте выбрать точки ближе к дороге или уточните адреса."));
    multiRoute.events.add("activeroutechange", updateRouteDistance);
    setMapMessage("Прокладываем автомобильный маршрут и рассчитываем расстояние…");
  };
  const assignPoint = async (mode, coords) => {
    const normalized = [Number(coords[0]), Number(coords[1])];
    if (!normalized.every(Number.isFinite)) return;
    if (mode === "pickup") {
      pickupCoords = normalized;
      if (pickupInput) pickupInput.value = await reverseAddress(normalized);
      if ($("pickupPointStatus")) $("pickupPointStatus").textContent = pickupInput?.value || "Точка выбрана";
      setSelectionMode("dropoff");
    } else {
      dropoffCoords = normalized;
      if (dropoffInput) dropoffInput.value = await reverseAddress(normalized);
      if ($("dropoffPointStatus")) $("dropoffPointStatus").textContent = dropoffInput?.value || "Точка выбрана";
    }
    drawSelectedPins();
    if (pickupCoords && dropoffCoords) buildRoute();
    else setMapMessage("Точка сохранена. Теперь выберите вторую точку на карте.");
  };
  const geocodeInput = async (input) => {
    const result = await ymaps.geocode(input, { results: 1 });
    const first = result.geoObjects.get(0);
    if (!first) throw new Error("Адрес не найден");
    return first.geometry.getCoordinates();
  };
  const initMap = () => {
    if (mapInstance) { mapInstance.container.fitToViewport(); return; }
    const preview = $("mapPreview");
    if (preview) preview.remove();
    mapInstance = new ymaps.Map("routeMap", {
      center: [55.096, 38.77], zoom: 12,
      controls: ["zoomControl", "typeSelector", "fullscreenControl"]
    }, { suppressMapOpenBlock: true });
    mapInstance.events.add("click", async (event) => {
      const coords = event.get("coords");
      await assignPoint(selectionMode, coords);
    });
    setMapNote("Карта Яндекс загружена. Выберите точку А, затем точку Б.");
    setMapMessage("Коснитесь карты, чтобы поставить точку А — место подачи.");
    if (pickupCoords || dropoffCoords) drawSelectedPins();
  };
  function loadYandexMaps() {
    if (mapInstance) { mapInstance.container.fitToViewport(); return Promise.resolve(); }
    if (mapLoadPromise) return mapLoadPromise;
    const apiKey = config.yandexMapsApiKey || "";
    if (!apiKey) {
      setMapNote("");
      setMapMessage("Схема Коломны и Воскресенска показана для ориентира. Для выбора точек на настоящей карте владелец сайта должен подключить ключ картографического сервиса; пока можно позвонить Артемию и согласовать маршрут.");
      return Promise.resolve(false);
    }
    setMapNote("Подключаем Яндекс.Карты…");
    mapLoadPromise = new Promise((resolve) => {
      if (window.ymaps) {
        ymaps.ready(() => { initMap(); resolve(true); });
        return;
      }
      const script = document.createElement("script");
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
      script.async = true;
      script.onload = () => ymaps.ready(() => { initMap(); resolve(true); });
      script.onerror = () => {
        setMapNote("Не удалось загрузить Яндекс.Карты. Проверьте API-ключ и ограничения домена.");
        setMapMessage("Карта временно недоступна. Можно ввести адреса вручную после проверки ключа.");
        resolve(false);
      };
      document.head.appendChild(script);
    });
    return mapLoadPromise;
  }
  $("openRouteMap")?.addEventListener("click", () => {
    showMap();
    setSelectionMode(pickupCoords ? "dropoff" : "pickup");
  });
  $("locateMe")?.addEventListener("click", async () => {
    const ready = await loadYandexMaps();
    if (!ready || !mapInstance) { setMapMessage("Сначала подключите ключ Яндекс.Карт — после этого геолокация сможет поставить точку на встроенной карте."); return; }
    if (!navigator.geolocation) { setMapMessage("Браузер не поддерживает геолокацию. Выберите точку А касанием карты."); return; }
    setMapMessage("Запрашиваем разрешение на определение вашего местоположения…");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const coords = [position.coords.latitude, position.coords.longitude];
      await assignPoint("pickup", coords);
      if (mapInstance) mapInstance.setCenter(coords, 16, { duration: reducedMotion ? 0 : 250 });
    }, () => setMapMessage("Геолокация не разрешена или недоступна. Выберите точку подачи вручную на карте."), {
      enableHighAccuracy: true, timeout: 12000, maximumAge: 60000
    });
  });
  $("resetRoutePoints")?.addEventListener("click", () => {
    pickupCoords = null; dropoffCoords = null;
    if (pickupInput) pickupInput.value = "";
    if (dropoffInput) dropoffInput.value = "";
    if ($("pickupPointStatus")) $("pickupPointStatus").textContent = "Нажмите на карту";
    if ($("dropoffPointStatus")) $("dropoffPointStatus").textContent = "Выберите после точки А";
    clearRouteLine(); drawSelectedPins(); setSelectionMode("pickup");
    if (distanceInput) distanceInput.value = "";
    updateEstimate();
    setMapMessage("Точки сброшены. Сначала выберите место подачи.");
  });
  pickupInput?.addEventListener("input", () => { pickupCoords = null; if ($("pickupPointStatus")) $("pickupPointStatus").textContent = "Адрес введён вручную"; });
  dropoffInput?.addEventListener("input", () => { dropoffCoords = null; if ($("dropoffPointStatus")) $("dropoffPointStatus").textContent = "Адрес введён вручную"; });

  routeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const now = Date.now();
    if (now - lastCalc < 1200) return;
    lastCalc = now;
    showMap();
    if (routeVehicle && vehicleSelect) vehicleSelect.value = routeVehicle.value;
    if (!pickupInput?.value.trim() && !pickupCoords) {
      setSelectionMode("pickup"); setMapMessage("Сначала выберите место подачи: нажмите на карту или используйте геолокацию."); return;
    }
    if (!dropoffInput?.value.trim() && !dropoffCoords) {
      setSelectionMode("dropoff"); setMapMessage("Теперь выберите место доставки на карте."); return;
    }
    const loaded = await loadYandexMaps();
    if (!loaded || !window.ymaps) return;
    try {
      if (!pickupCoords) pickupCoords = await geocodeInput(pickupInput.value.trim());
      if (!dropoffCoords) dropoffCoords = await geocodeInput(dropoffInput.value.trim());
      if ($("pickupPointStatus")) $("pickupPointStatus").textContent = pickupInput.value;
      if ($("dropoffPointStatus")) $("dropoffPointStatus").textContent = dropoffInput.value;
      buildRoute();
    } catch (_) {
      setMapMessage("Не удалось найти один из адресов. Уточните адрес или поставьте точку непосредственно на карте.");
    }
  });


  // Клиентское подтверждение перед звонками и внешними ссылками.
  // Это дополнительный барьер интерфейса, не полноценная CAPTCHA.
  const humanModal = $("humanCheck"), humanSlider = $("humanSlider"), humanSliderInput = $("humanSliderInput");
  const humanSliderThumb = humanSlider?.querySelector(".human-slider-thumb"), humanSliderLabel = $("humanSliderLabel"), humanCaption = $("humanCheckCaption");
  let pendingHumanUrl = null, humanModalOpener = null, humanVerified = false;
  const closeHumanCheck = () => {
    if (!humanModal) return;
    humanModal.classList.remove("is-open"); humanModal.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
    pendingHumanUrl = null; humanVerified = false;
    if (humanSliderInput) humanSliderInput.value = "0";
    if (humanSliderThumb) humanSliderThumb.style.left = "5px";
    humanSlider?.classList.remove("is-success");
    if (humanSliderLabel) humanSliderLabel.textContent = "Проведите вправо";
    if (humanCaption) humanCaption.textContent = "Защита от автоматических переходов";
    humanModalOpener?.focus?.();
  };
  const openHumanCheck = (url, opener) => {
    if (!humanModal) { window.location.href = url; return; }
    pendingHumanUrl = url; humanModalOpener = opener;
    humanModal.classList.add("is-open"); humanModal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
    window.setTimeout(() => humanSliderInput?.focus(), 40);
  };
  const completeHumanCheck = () => {
    if (humanVerified || !pendingHumanUrl) return;
    humanVerified = true; humanSlider?.classList.add("is-success");
    if (humanSliderLabel) humanSliderLabel.textContent = "Проверка пройдена";
    if (humanCaption) humanCaption.textContent = "Готово! Выполняем действие…";
    const destination = pendingHumanUrl; pendingHumanUrl = null;
    window.setTimeout(() => { document.body.style.overflow = ""; humanModal?.classList.remove("is-open"); humanModal?.setAttribute("aria-hidden", "true"); window.location.assign(destination); }, 420);
  };
  humanSliderInput?.addEventListener("input", () => {
    const value = Number(humanSliderInput.value), width = humanSlider?.clientWidth || 300, thumb = humanSliderThumb?.offsetWidth || 64;
    const maxLeft = Math.max(5, width - thumb - 5);
    if (humanSliderThumb) humanSliderThumb.style.left = `${5 + (maxLeft - 5) * value / 100}px`;
    if (value >= 96) completeHumanCheck();
  });
  humanModal?.querySelectorAll("[data-human-close]").forEach(el => el.addEventListener("click", closeHumanCheck));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && humanModal?.classList.contains("is-open")) closeHumanCheck(); });
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const raw = link.getAttribute("href") || "", isPhone = /^tel:/i.test(raw); let isExternal = false;
    try { const parsed = new URL(raw, window.location.href); isExternal = /^https?:$/.test(parsed.protocol) && parsed.origin !== window.location.origin; } catch (_) {}
    if (!isPhone && !isExternal) return;
    event.preventDefault(); event.stopPropagation(); openHumanCheck(link.href, link);
  }, true);

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
