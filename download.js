// Public landing-page motion. No dashboard data or agent commands are used here.
(() => {
  const hero = document.querySelector('.download-hero');
  const steps = document.querySelector('.install-steps');
  const hold = document.querySelector('.gallery-hold');
  const screen = document.querySelector('.gallery-screen');
  const gallery = document.querySelector('.photo-gallery');
  const cards = [...gallery.querySelectorAll('.gallery-card')];
  const dialog = document.querySelector('.gallery-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 851px) and (min-height: 720px)');
  const galleryDesktop = matchMedia('(min-width: 1000px) and (min-height: 720px)');
  const hover = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1000px)');
  const nativeScroll = CSS.supports('animation-timeline: view()');
  const tokens = getComputedStyle(document.documentElement);
  const easeOut = tokens.getPropertyValue('--ease-out').trim();
  const easeInOut = tokens.getPropertyValue('--ease-in-out').trim();
  const navigation = document.querySelector('.download-nav');
  const menuToggle = navigation.querySelector('.nav-menu-toggle');
  const compactMenu = matchMedia('(max-width: 850px)');
  let navigationFocus = null;
  document.addEventListener('focusin', event => {
    if (navigation.contains(event.target)) navigationFocus = event.target;
    else if (event.target !== document.body) navigationFocus = null;
  });
  function menu(open, restoreFocus = false) {
    navigation.toggleAttribute('data-menu-open', open && compactMenu.matches);
    menuToggle.setAttribute('aria-expanded', String(open && compactMenu.matches));
    if (restoreFocus) menuToggle.focus({preventScroll: true});
  }
  menuToggle.addEventListener('click', () => menu(!navigation.hasAttribute('data-menu-open')));
  navigation.querySelector('nav').addEventListener('click', event => {
    if (event.target.closest('a')) menu(false, compactMenu.matches);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.hasAttribute('data-menu-open')) { event.preventDefault(); menu(false, true); }
  });
  document.addEventListener('pointerdown', event => { if (!navigation.contains(event.target)) { navigationFocus = null; menu(false); } });
  navigation.addEventListener('focusout', () => requestAnimationFrame(() => {
    if (!navigation.contains(document.activeElement)) menu(false);
  }));
  compactMenu.addEventListener('change', () => {
    const focused = document.activeElement === document.body ? navigationFocus : document.activeElement;
    const wasToggle = focused === menuToggle;
    const wasInMenu = navigation.querySelector('nav').contains(focused);
    menu(false);
    if (compactMenu.matches && wasInMenu) menuToggle.focus({preventScroll: true});
    else if (!compactMenu.matches && wasToggle) navigation.querySelector('nav a').focus({preventScroll: true});
  });
  let inView = true;
  let queued = false;
  let active = null;
  let selected = 0;
  let opener = null;
  let galleryWidth = 0;
  let layoutAnimations = [];
  let imageAnimation;
  let keyboardInput = false;
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') keyboardInput = true;
  }, {capture: true});

  function expand(index, instant = false) {
    if (!hover.matches || reduced.matches) index = null;
    if (index === active) {
      if (instant) {
        layoutAnimations.forEach(animation => animation.cancel());
        layoutAnimations = [];
        gallery.setAttribute('data-instant', '');
      }
      return;
    }
    // FLIP: one layout change per interaction; only transforms animate between layouts.
    // Read the current visual positions before cancelling, so rapid hovers can retarget.
    const before = cards.map(card => card.getBoundingClientRect());
    layoutAnimations.forEach(animation => animation.cancel());
    layoutAnimations = [];
    active = index;
    gallery.toggleAttribute('data-instant', instant);
    if (index === null) delete gallery.dataset.active;
    else gallery.dataset.active = String(index);
    cards.forEach((card, i) => card.toggleAttribute('data-selected', i === index));
    if (instant || reduced.matches || !hover.matches) return;
    const after = cards.map(card => card.getBoundingClientRect());
    cards.forEach((card, i) => {
      const scale = before[i].width / after[i].width;
      const offset = before[i].left - after[i].left;
      const options = {duration: 500, easing: easeInOut};
      layoutAnimations.push(card.animate([
        {transform: `translateX(${offset}px) scaleX(${scale})`}, {transform: 'none'},
      ], options));
      // Counter-scale the contents to avoid stretching faces and letterforms.
      // Sample the reciprocal: interpolating only its endpoints would distort mid-flight.
      const counterFrames = Array.from({length: 41}, (_, step) => {
        const progress = step / 40;
        return {offset: progress, transform: `scaleX(${1 / (scale + (1 - scale) * progress)})`};
      });
      card.querySelectorAll('.gallery-photo, .gallery-copy, .gallery-label').forEach(content => {
        layoutAnimations.push(content.animate(counterFrames, {...options, composite: 'add'}));
      });
    });
  }

  cards.forEach((card, index) => {
    card.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch' && !keyboardInput && !dialog.open) expand(index);
    });
    card.addEventListener('focus', () => {
      if (card.matches(':focus-visible') && !dialog.open) expand(index, true);
    });
    card.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = card;
      showImage(index, event.detail > 0);
      dialog.showModal();
      if (!reduced.matches && event.detail > 0) {
        dialog.animate([{opacity: 0, transform: 'scale(.96)'}, {opacity: 1, transform: 'scale(1)'}], {duration: 200, easing: easeOut});
      }
    });
  });
  gallery.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || dialog.open) return;
    keyboardInput = false;
    const card = event.target.closest('.gallery-card');
    if (card) expand(cards.indexOf(card));
  });
  gallery.addEventListener('pointerleave', () => {
    if (dialog.open) return;
    const focused = cards.findIndex(card => card.matches(':focus-visible'));
    expand(focused < 0 ? null : focused, focused >= 0);
  });
  gallery.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!gallery.contains(document.activeElement) && !dialog.open) expand(null, true);
    });
  });

  function showImage(index, animate = false) {
    selected = (index + cards.length) % cards.length;
    const card = cards[selected];
    const image = dialog.querySelector('.gallery-full-image');
    imageAnimation?.cancel();
    image.src = card.href;
    image.alt = card.querySelector('img').alt;
    dialog.querySelector('h2').textContent = card.querySelector('.gallery-label').textContent;
    dialog.querySelector('figcaption p').textContent = card.querySelector('.gallery-description').textContent;
    dialog.querySelector('.gallery-counter').textContent = `${selected + 1} / ${cards.length}`;
    if (animate && !reduced.matches) imageAnimation = image.animate([{opacity: .3}, {opacity: 1}], {duration: 200, easing: easeOut});
  }
  dialog.querySelector('.gallery-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.gallery-prev').addEventListener('click', event => showImage(selected - 1, event.detail > 0));
  dialog.querySelector('.gallery-next').addEventListener('click', event => showImage(selected + 1, event.detail > 0));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showImage(selected + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  dialog.addEventListener('close', () => {
    imageAnimation?.cancel();
    opener?.focus({preventScroll: true});
  });

  // Older browsers keep readable text and get a one-time entrance instead of scroll timelines.
  if (!nativeScroll) {
    const intro = document.querySelector('.how-intro');
    const reveal = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (!reduced.matches) intro.querySelectorAll('.intro-line > span').forEach((line, i) => {
        line.animate([{opacity: .15, transform: 'translateY(24px)'}, {opacity: 1, transform: 'none'}], {duration: 620, delay: i * 80, easing: easeOut, fill: 'backwards'});
      });
      reveal.disconnect();
    }, {threshold: .15});
    reveal.observe(intro);
  }

  function syncPlayback() {
    hero.setAttribute('data-motion-ready', '');
    hero.toggleAttribute('data-paused', !inView || document.hidden || reduced.matches);
  }

  function measure() {
    queued = false;
    const enhanced = desktop.matches && !reduced.matches && nativeScroll;
    if (gallery.clientWidth !== galleryWidth || !hover.matches || reduced.matches) {
      layoutAnimations.forEach(animation => animation.cancel());
      layoutAnimations = [];
      expand(null, true);
      galleryWidth = gallery.clientWidth;
    }
    gallery.setAttribute('data-ready', '');
    hold.style.setProperty('--gallery-height', `${screen.offsetHeight}px`);
    hold.toggleAttribute('data-pin-ready', galleryDesktop.matches && hover.matches && !reduced.matches && nativeScroll && screen.scrollHeight <= innerHeight - 112);
    steps.removeAttribute('data-stack-ready');
    if (enhanced) {
      const cards = [...steps.children];
      const tops = cards.map(card => parseFloat(getComputedStyle(card).top));
      steps.setAttribute('data-measuring', '');
      const start = steps.getBoundingClientRect().top;
      cards.slice(0, -1).forEach((card, i) => {
        const from = cards[i + 1].getBoundingClientRect().top - start;
        card.style.setProperty('--stack-from', `${from}px`);
        card.style.setProperty('--stack-to', `${from + innerHeight - tops[i + 1]}px`);
      });
      steps.removeAttribute('data-measuring');
      // Tall content (zoom or expanded instructions) must stay in the normal flow.
      if (cards.every(card => card.offsetHeight + 160 < innerHeight)) steps.setAttribute('data-stack-ready', '');
    }
    syncPlayback();
  }

  function queueMeasure() {
    if (!queued) { queued = true; requestAnimationFrame(measure); }
  }

  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncPlayback(); }).observe(hero);
  const anchors = [...document.querySelectorAll('.download-nav nav a[href^="#"]')];
  const visibleSections = new Set();
  const sections = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? visibleSections.add(entry.target) : visibleSections.delete(entry.target));
    const current = [...visibleSections].sort((a, b) => Math.abs(a.getBoundingClientRect().top - 90) - Math.abs(b.getBoundingClientRect().top - 90))[0];
    anchors.forEach(anchor => {
      if (current && anchor.hash === `#${current.id}`) anchor.setAttribute('aria-current', 'location');
      else anchor.removeAttribute('aria-current');
    });
  }, {rootMargin: '-90px 0px -90px 0px'});
  anchors.forEach(anchor => sections.observe(document.querySelector(anchor.hash)));
  new ResizeObserver(queueMeasure).observe(screen);
  new ResizeObserver(queueMeasure).observe(steps);
  addEventListener('resize', queueMeasure, {passive: true});
  document.addEventListener('visibilitychange', syncPlayback);
  reduced.addEventListener('change', queueMeasure);
  desktop.addEventListener('change', queueMeasure);
  galleryDesktop.addEventListener('change', queueMeasure);
  hover.addEventListener('change', queueMeasure);
  document.fonts.ready.then(queueMeasure);
  measure();
})();
