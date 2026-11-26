/* =========================================================
   ЭВАКУАТОР — ЛОГИКА САЙТА
   1. Мобильная навигация
   2. Динамический год в подвале
   3. Просмотр фотографии
   4. Плавное появление блоков при прокрутке
   ========================================================= */

(() => {
    "use strict";

    /* 1. Мобильная навигация */
    const menuButton = document.getElementById("menuBtn");
    const navigation = document.getElementById("nav");

    if (menuButton && navigation) {
        menuButton.addEventListener("click", () => {
            const isOpen = navigation.classList.toggle("open");
            menuButton.setAttribute("aria-expanded", String(isOpen));
            menuButton.setAttribute(
                "aria-label",
                isOpen ? "Закрыть меню" : "Открыть меню"
            );
        });

        navigation.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navigation.classList.remove("open");
                menuButton.setAttribute("aria-expanded", "false");
                menuButton.setAttribute("aria-label", "Открыть меню");
            });
        });
    }

    /* 2. Актуальный год в подвале */
    const yearElement = document.getElementById("year");
    if (yearElement) {
        yearElement.textContent = String(new Date().getFullYear());
    }

    /* 3. Увеличение единственной фотографии в блоке «Наш эвакуатор» */
    const lightbox = document.getElementById("lightbox");
    const lightboxImage = document.getElementById("lightboxImage");
    const lightboxClose = document.getElementById("lightboxClose");
    const galleryTrigger = document.querySelector(".gallery-feature-open");

    let pageScrollPosition = 0;
    let previousBodyPosition = "";
    let previousBodyTop = "";
    let previousBodyWidth = "";

    const closeLightbox = () => {
        if (!lightbox || !lightboxImage || !lightbox.classList.contains("open")) return;

        lightbox.classList.remove("open");
        lightbox.setAttribute("aria-hidden", "true");

        // iOS Safari does not consistently honor overflow:hidden on body.
        // Restore the exact scroll position after releasing the fixed body.
        document.body.style.position = previousBodyPosition;
        document.body.style.top = previousBodyTop;
        document.body.style.width = previousBodyWidth;
        window.scrollTo(0, pageScrollPosition);
        lightboxImage.removeAttribute("src");

        galleryTrigger?.focus({ preventScroll: true });
    };

    if (lightbox && lightboxImage && galleryTrigger) {
        galleryTrigger.addEventListener("click", () => {
            const imagePath = galleryTrigger.dataset.image;
            if (!imagePath || lightbox.classList.contains("open")) return;

            pageScrollPosition = window.scrollY || window.pageYOffset;
            previousBodyPosition = document.body.style.position;
            previousBodyTop = document.body.style.top;
            previousBodyWidth = document.body.style.width;

            lightboxImage.src = imagePath;
            lightbox.classList.add("open");
            lightbox.setAttribute("aria-hidden", "false");

            // Fixed positioning reliably locks background scrolling on iPhone.
            document.body.style.position = "fixed";
            document.body.style.top = `-${pageScrollPosition}px`;
            document.body.style.width = "100%";

            if (lightboxClose) lightboxClose.focus();
        });

        lightboxClose?.addEventListener("click", closeLightbox);

        lightbox.addEventListener("click", (event) => {
            if (event.target === lightbox) closeLightbox();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeLightbox();
        });
    }

    /* 4. Появление контента при прокрутке.
       При системной настройке «уменьшить движение» анимации отключаются. */
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const revealSelectors = [
        ".section-head",
        ".service-card",
        ".advantages-title",
        ".adv-item",
        ".gallery-feature",
        ".contact-layout",
        ".contact-card"
    ];

    const revealElements = document.querySelectorAll(
        revealSelectors.join(", ")
    );

    if (!revealElements.length) return;

    document.body.classList.add("motion-ready");

    revealElements.forEach((element, index) => {
        element.classList.add("reveal");

        if (element.matches(".service-card, .adv-item")) {
            element.classList.add(`reveal-delay-${(index % 3) + 1}`);
        }
    });

    if (!("IntersectionObserver" in window)) {
        revealElements.forEach((element) => {
            element.classList.add("is-visible");
        });
        return;
    }

    const observer = new IntersectionObserver(
        (entries, currentObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                entry.target.classList.add("is-visible");
                currentObserver.unobserve(entry.target);
            });
        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -45px 0px"
        }
    );

    revealElements.forEach((element) => observer.observe(element));
})();
