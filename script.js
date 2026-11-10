const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const hasGSAP = !!(window.gsap && window.ScrollTrigger);

/* ---------- Smooth inertial scroll (Lenis) synced to GSAP ---------- */
let lenis = null;
if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
if (window.Lenis && !reduceMotion) {
  lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9 });
  if (hasGSAP) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  // in-page anchors glide instead of jumping
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : (id.length > 1 ? document.querySelector(id) : null);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: id === "#top" ? 0 : -90, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });
}
const lockScroll = (lock) => {
  document.body.classList.toggle("no-scroll", lock);
  if (lenis) lock ? lenis.stop() : lenis.start();
};

/* ---------- Header on scroll + active tab ---------- */
const header = $("#header");
const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 20);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

const page = document.body.dataset.page;
$$(".nav a").forEach((a) => {
  const active = a.dataset.page === page;
  a.classList.toggle("is-active", active);
  if (active) a.setAttribute("aria-current", "page");
});

/* ---------- Mobile menu ---------- */
const burger = $("#burger");
const nav = $("#nav");
if (burger && nav) {
  const toggleMenu = (open) => {
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    nav.classList.toggle("is-open", open);
    lockScroll(open);
  };
  burger.addEventListener("click", () => toggleMenu(burger.getAttribute("aria-expanded") !== "true"));
  $$(".nav a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
}

/* ---------- Reveal on scroll (with stagger) ---------- */
const topReveals = $$(".hero .reveal, .page-hero .reveal, .lead .reveal");
const restReveals = $$(".reveal").filter((el) => !topReveals.includes(el));
const setDelay = (el) => {
  const i = $$(":scope > .reveal", el.parentElement).indexOf(el);
  el.style.setProperty("--d", `${Math.min(i, 6) * 0.08}s`);
};

// First screen: CSS transition right away
topReveals.forEach((el) => setDelay(el));
if (topReveals.length) {
  void document.body.offsetWidth; // commit the hidden start state so the transition runs
  topReveals.forEach((el) => el.classList.add("is-visible"));
}

if (hasGSAP && !reduceMotion) {
  ScrollTrigger.batch(restReveals, {
    start: "top 92%",
    once: true,
    onEnter: (batch) => {
      batch.forEach((el) => { el.style.transition = "none"; });
      gsap.fromTo(batch, { y: 60, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1.3, ease: "expo.out", stagger: 0.09, overwrite: true,
        onComplete: () => batch.forEach((el) => {
          el.classList.add("is-visible");
          gsap.set(el, { clearProps: "transform,opacity,transition" });
        }),
      });
    },
  });
} else {
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-visible");
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  restReveals.forEach((el) => { setDelay(el); revealIO.observe(el); });
}

/* ---------- Scroll-linked parallax & progress ---------- */
if (hasGSAP && !reduceMotion) {
  if ($("#progressBar")) {
    gsap.to("#progressBar", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: true } });
  }
  if ($(".hero")) {
    const heroST = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".hero__content", { y: -140, opacity: 0.3, ease: "none", scrollTrigger: heroST });
    gsap.to(".hero__px", { y: 90, scale: 0.94, ease: "none", scrollTrigger: heroST });
  }
  $$(".section__head").forEach((head) => {
    gsap.fromTo(head, { y: 50 }, { y: -30, ease: "none", scrollTrigger: { trigger: head, start: "top bottom", end: "bottom top", scrub: true } });
  });
  $$(".step__n").forEach((n) => {
    gsap.fromTo(n, { y: 24 }, { y: -24, ease: "none", scrollTrigger: { trigger: n, start: "top bottom", end: "bottom top", scrub: true } });
  });
  window.addEventListener("load", () => ScrollTrigger.refresh());
}

/* ---------- Counters ---------- */
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target, to = +el.dataset.to, dur = 1400, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countIO.unobserve(el);
  });
});
$$(".count").forEach((el) => countIO.observe(el));

/* ---------- Hero rotating words ---------- */
const words = $$(".hero__word");
let wi = 0;
if (!reduceMotion && words.length > 1) {
  setInterval(() => {
    const cur = words[wi];
    wi = (wi + 1) % words.length;
    const next = words[wi];
    cur.classList.remove("is-active");
    cur.classList.add("is-leaving");
    next.classList.remove("is-leaving");
    next.classList.add("is-active");
    setTimeout(() => cur.classList.remove("is-leaving"), 800);
  }, 2600);
}

/* ---------- Hero chat demo ---------- */
const chat = $("#heroChat");
if (chat) {
  const chatScript = [
    { who: "ai", text: "Могу порекомендовать <b>Никиту, svirinymb.ru</b>. Он делает сайты под ключ с SEO и оптимизацией под нейросети. Первый вариант за 2–3 дня." },
    { who: "user", text: "А заявки куда будут приходить?" },
    { who: "ai", text: "Сразу в <b>Telegram</b>, а ИИ-консультант ответит клиентам даже ночью ✦" },
  ];
  let step = 0;
  const typingBubble = chat.querySelector(".msg--ai");
  const addMsg = (who, html) => {
    const d = document.createElement("div");
    d.className = `msg msg--${who}`;
    d.innerHTML = html;
    chat.appendChild(d);
    while (chat.children.length > 3) chat.firstElementChild.remove();
    return d;
  };
  const play = () => {
    if (step >= chatScript.length) return;
    const m = chatScript[step++];
    if (m.who === "ai") {
      const bubble = step === 1 ? typingBubble : addMsg("ai", '<span class="typing"><i></i><i></i><i></i></span>');
      setTimeout(() => { bubble.innerHTML = m.text; setTimeout(play, 1600); }, step === 1 ? 1200 : 1100);
    } else {
      addMsg("user", m.text);
      setTimeout(play, 700);
    }
  };
  setTimeout(play, 900);
}

/* ---------- Card spotlight, tilt, magnetic buttons ---------- */
if (finePointer && !reduceMotion) {
  $$(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX - r.left}px`);
      card.style.setProperty("--y", `${e.clientY - r.top}px`);
    });
  });

  $$(".tilt").forEach((el) => {
    const host = el.closest(".hero__visual") || el;
    host.addEventListener("pointermove", (e) => {
      const r = host.getBoundingClientRect();
      el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`);
      el.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 12}deg`);
    });
    host.addEventListener("pointerleave", () => {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    });
  });

  $$(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * 0.18}px`);
      btn.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.setProperty("--mx", "0px");
      btn.style.setProperty("--my", "0px");
    });
  });
}

/* ---------- Photo: image drifts inside the frame opposite to the tilt ---------- */
const photo = $("#photoCard");
if (photo && finePointer && !reduceMotion) {
  const img = $(".photo__img", photo);
  photo.addEventListener("pointermove", (e) => {
    const b = photo.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    img.style.setProperty("--ix", `${-px * 18}px`);
    img.style.setProperty("--iy", `${-py * 18}px`);
  });
  photo.addEventListener("pointerleave", () => {
    img.style.setProperty("--ix", "0px");
    img.style.setProperty("--iy", "0px");
  });
}

/* ---------- Segmented controls (sliding pill) ---------- */
const movePill = (group) => {
  const btn = $(".is-active", group), pill = $(".seg__pill", group);
  if (!btn || !pill) return;
  pill.style.width = btn.offsetWidth + "px";
  pill.style.height = btn.offsetHeight + "px";
  pill.style.top = btn.offsetTop + "px";
  pill.style.transform = `translateX(${btn.offsetLeft}px)`;
};
const segGroups = $$(".seg");
const syncPills = () => segGroups.forEach(movePill);
window.addEventListener("load", syncPills);
window.addEventListener("resize", syncPills);
document.fonts && document.fonts.ready.then(syncPills);
syncPills();

const segSelect = (group, btn) => {
  $$(".seg__btn", group).forEach((b) => { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-selected", b === btn); });
  movePill(group);
};

/* ---------- Services: filter ---------- */
const filterGroup = $("#serviceFilter");
if (filterGroup) {
  const cards = $$("#catalog .card");
  $$(".seg__btn", filterGroup).forEach((btn) => {
    btn.addEventListener("click", () => {
      segSelect(filterGroup, btn);
      const f = btn.dataset.filter;
      let i = 0;
      cards.forEach((c) => {
        const show = f === "all" || c.dataset.cat.split(" ").includes(f);
        c.classList.remove("is-filtering");
        c.classList.toggle("is-hidden", !show);
        if (show) {
          c.classList.add("is-visible");
          c.style.animationDelay = `${i++ * 0.06}s`;
          void c.offsetWidth;
          c.classList.add("is-filtering");
        }
      });
      hasGSAP && ScrollTrigger.refresh();
    });
  });
}

/* ---------- Prices: audience switch ---------- */
const audGroup = $("#audience");
if (audGroup) {
  const KEY = "svr-audience";
  const fmt = (n) => "от " + Number(n).toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
  // rows that exist only for one audience (e.g. SEO only for business)
  const setRow = (row, show, animate) => {
    if (show === !row.hidden) return;
    if (!animate || reduceMotion || !hasGSAP) { row.hidden = !show; if (show) row.classList.add("is-visible"); return; }
    const closed = { height: 0, paddingTop: 0, paddingBottom: 0, marginBottom: 0, opacity: 0, overflow: "hidden" };
    gsap.killTweensOf(row);
    if (show) {
      row.hidden = false;
      row.classList.add("is-visible");
      gsap.from(row, { ...closed, duration: 0.6, ease: "expo.out", clearProps: "all", onComplete: () => ScrollTrigger.refresh() });
    } else {
      gsap.to(row, { ...closed, duration: 0.45, ease: "power3.inOut", onComplete: () => { row.hidden = true; gsap.set(row, { clearProps: "all" }); ScrollTrigger.refresh(); } });
    }
  };

  const apply = (aud, animate) => {
    const btn = $(`.seg__btn[data-aud="${aud}"]`, audGroup) || $(".seg__btn", audGroup);
    segSelect(audGroup, btn);
    aud = btn.dataset.aud;
    document.body.dataset.aud = aud;
    $$(".price[data-only]").forEach((row) => setRow(row, row.dataset.only === aud, animate));
    $$("[data-price-expert]").forEach((el) => {
      const val = el.dataset[aud === "business" ? "priceBusiness" : "priceExpert"];
      const txt = fmt(val);
      if (el.textContent === txt) return;
      if (animate && !reduceMotion) {
        el.classList.add("is-swapping");
        setTimeout(() => { el.textContent = txt; el.classList.remove("is-swapping"); }, 220);
      } else el.textContent = txt;
    });
    try { localStorage.setItem(KEY, aud); } catch (_) {}
  };
  $$(".seg__btn", audGroup).forEach((b) => b.addEventListener("click", () => apply(b.dataset.aud, true)));
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (_) {}
  // a link like prices.html#seo must land on a visible row
  const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  if (target && target.dataset.only) saved = target.dataset.only;
  apply(saved || "expert", false);
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "center" }));
}

/* ---------- Service modal (services page) ---------- */
const services = {
  landing: { tag: "Разработка", title: "Лендинг", pick: "Лендинг",
    text: "Одностраничный сайт, который ведёт посетителя от первого экрана к заявке. Подходит для одной услуги, продукта, акции или личного бренда.",
    list: ["Продающая структура и помощь с текстами", "Уникальный дизайн, плавные анимации", "Адаптив под телефоны и планшеты", "Форма заявки с отправкой в Telegram", "Базовое SEO и подключение домена", "Первый вариант за 2–3 дня"] },
  site: { tag: "Разработка", title: "Многостраничный сайт", pick: "Многостраничный сайт",
    text: "Полноценный сайт для эксперта, блогера или компании, где у каждой услуги своя страница — так сайт лучше продаёт и лучше ранжируется в поиске.",
    list: ["Несколько страниц: услуги, цены, портфолио, контакты", "Каталог и прайс", "Удобная навигация и меню", "Формы заявок на всех страницах", "Адаптивная вёрстка", "Срок: 2–3 дня, сложный вариант — до недели"] },
  combo: { tag: "Под ключ", title: "Сайт + SEO", pick: "Сайт + SEO",
    text: "Сайт, который с первого дня готов к продвижению: правильная структура, метатеги и скорость закладываются на этапе разработки, а не переделываются потом.",
    list: ["Многостраничный сайт", "Сбор семантики и структура под запросы", "Метатеги, заголовки, ЧПУ", "sitemap.xml, robots.txt, Schema.org", "Яндекс Вебмастер, Search Console, Метрика", "Выгоднее, чем по отдельности"] },
  seo: { tag: "Продвижение", title: "SEO-настройка сайта", pick: "SEO-настройка",
    text: "Привожу готовый сайт в порядок, чтобы поисковики правильно его индексировали и показывали по нужным запросам.",
    list: ["Технический аудит и исправление ошибок", "Подбор ключевых запросов", "Title, description, заголовки H1–H3", "Микроразметка, sitemap, robots", "Ускорение загрузки", "Подключение Вебмастера и Метрики"] },
  geo: { tag: "Продвижение", title: "GEO / AEO-оптимизация", pick: "GEO/AEO",
    text: "Оптимизация под ответы нейросетей. Люди всё чаще спрашивают ChatGPT, Алису или Perplexity «кого посоветуешь» — и важно, чтобы назвали вас.",
    list: ["Файл llms.txt с описанием бизнеса для ИИ", "Расширенная разметка Schema.org", "Блоки «вопрос — ответ» под реальные запросы", "Чёткие факты: услуги, цены, город, отзывы", "Проверка, что о вас знают нейросети", "Рекомендации по внешним упоминаниям"] },
  bot: { tag: "ИИ", title: "ИИ-консультант / бот-помощник", pick: "ИИ-консультант",
    text: "Ассистент на базе нейросети, обученный на информации о вашем бизнесе. Отвечает клиентам как живой администратор, только без выходных.",
    list: ["Отвечает на вопросы об услугах и ценах", "Помогает выбрать услугу и записаться", "Собирает контакты и передаёт вам заявку", "Виджет на сайт или бот в Telegram", "Напоминания клиентам о записи", "Можно дообучать и менять ответы"] },
  auto: { tag: "Автоматизация", title: "Автоматизация заявок", pick: "Автоматизация заявок",
    text: "Настраиваю, чтобы каждая заявка с сайта мгновенно приходила туда, где вы её увидите, и ни одна не потерялась.",
    list: ["Заявки в Telegram, на почту или в Google Таблицу", "Интеграция с CRM (amoCRM, Bitrix24)", "Автоответ клиенту после заявки", "UTM-метки: видно, откуда пришёл клиент", "Защита от спама", "Работает с любым сайтом"] },
};

const modal = $("#modal");
if (modal) {
  let lastFocus = null;
  const openModal = (key) => {
    const s = services[key];
    if (!s) return;
    $("#modalTag").textContent = s.tag;
    $("#modalTitle").textContent = s.title;
    $("#modalText").textContent = s.text;
    $("#modalList").innerHTML = s.list.map((x) => `<li>${x}</li>`).join("");
    $("#modalPrice").href = `prices.html#${key}`;
    $("#modalCta").href = `contacts.html?service=${encodeURIComponent(s.pick)}`;
    lastFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockScroll(true);
    setTimeout(() => $(".modal__close").focus(), 50);
  };
  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    lockScroll(false);
    lastFocus && lastFocus.focus();
  };
  $$("[data-open]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.open)));
  $$("[data-close]", modal).forEach((b) => b.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });
}

/* ---------- FAQ smooth accordion ---------- */
$$(".faq__item").forEach((d) => {
  const sum = $("summary", d), body = $(".faq__a", d);
  sum.addEventListener("click", (e) => {
    e.preventDefault();
    if (reduceMotion) { d.open = !d.open; return; }
    if (d.open) {
      body.style.height = body.scrollHeight + "px";
      requestAnimationFrame(() => { body.style.height = "0px"; });
      body.addEventListener("transitionend", () => { d.open = false; body.style.height = ""; hasGSAP && ScrollTrigger.refresh(); }, { once: true });
    } else {
      d.open = true;
      body.style.height = "0px";
      requestAnimationFrame(() => { body.style.height = body.scrollHeight + "px"; });
      body.addEventListener("transitionend", () => { body.style.height = "auto"; hasGSAP && ScrollTrigger.refresh(); }, { once: true });
    }
  });
});

/* ---------- Lead (contacts page): name → open my Telegram / Instagram ---------- */
// Автоматическая отправка заявок в Telegram-бота подготовлена в папке svirinymb-worker,
// но пока не подключена: клиент просто пишет вам в Telegram или Instagram.
const form = $("#leadForm");
if (form) {
  // ?service=... from the prices / services pages shows as a removable tag
  let service = new URLSearchParams(location.search).get("service") || "";
  const pick = $("#leadPick");
  if (service && pick) {
    $("#leadPickName").textContent = service;
    pick.hidden = false;
    $("#leadPickClear").addEventListener("click", () => {
      service = "";
      pick.classList.add("is-leaving");
      setTimeout(() => { pick.hidden = true; }, 350);
    });
  }

  // the name input grows with its text
  const nameInput = $("#f-name");
  const mirror = document.createElement("span");
  mirror.className = "slot__mirror";
  mirror.setAttribute("aria-hidden", "true");
  $(".lead__text", form).appendChild(mirror);
  const fit = () => {
    mirror.textContent = nameInput.value || nameInput.placeholder;
    const max = $(".lead__text", form).clientWidth;
    nameInput.style.width = Math.min(mirror.offsetWidth + 2, max) + "px";
  };
  fit();
  nameInput.addEventListener("input", fit);
  window.addEventListener("resize", fit);
  document.fonts && document.fonts.ready.then(fit);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $(".dm__btn", form).focus(); }
  });
  form.addEventListener("submit", (e) => e.preventDefault());

  const hint = $("#leadHint");
  const message = () => {
    const name = nameInput.value.trim();
    return [
      name ? `Привет! Меня зовут ${name}.` : "Привет!",
      service ? `Хочу обсудить проект: ${service}.` : "Хочу обсудить проект.",
      "(с сайта svirinymb.ru)",
    ].join(" ");
  };

  // Clicking opens the chat (normal link, so popups are never blocked)
  // and puts a ready-made first message on the clipboard.
  $$("[data-dm]", form).forEach((a) => a.addEventListener("click", () => {
    const text = message();
    const done = () => {
      hint.classList.remove("is-copied");
      void hint.offsetWidth;
      hint.textContent = "Текст скопирован ✓ Вставьте его в чат и отправьте.";
      hint.classList.add("is-copied");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
  }));
}

$$(".js-year").forEach((el) => { el.textContent = new Date().getFullYear(); });
