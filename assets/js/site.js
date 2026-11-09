(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sampleDataEl = $('sample-data');
  if (!sampleDataEl) return;

  const allSamples = JSON.parse(sampleDataEl.textContent);
  const samples = allSamples.slice(0, 10);
  const narrow = matchMedia('(max-width:640px)');
  const step = () => narrow.matches ? 1 : 2;
  const imageCache = new Map();

  function loadedImage(path) {
    const url = new URL(path, document.baseURI);
    if (!imageCache.has(url.href)) {
      const promise = new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = async () => {
          try {
            await im.decode();
            if (!im.naturalWidth) throw new Error('Empty image');
            resolve(url.href);
          } catch (error) {
            reject(error);
          }
        };
        im.onerror = () => reject(new Error('Image unavailable'));
        im.src = url.href;
      });
      imageCache.set(url.href, promise);
      promise.catch(() => imageCache.delete(url.href));
    }
    return imageCache.get(url.href);
  }

  async function pageImage(sample) {
    try {
      return await loadedImage(sample.src);
    } catch {
      return loadedImage(sample.thumb);
    }
  }

  let bookIndex = 0, bookOpened = false, bookBusy = false, bookRequest = 0;

  function bookButtons() {
    const prevBtn = $('book-prev');
    const nextBtn = $('book-next');
    if (prevBtn) prevBtn.disabled = !bookOpened || bookBusy || bookIndex === 0;
    if (nextBtn) nextBtn.disabled = !bookOpened || bookBusy || bookIndex + step() >= samples.length;
  }

  async function renderBook(nextIndex = bookIndex) {
    const request = ++bookRequest;
    nextIndex = Math.max(0, Math.min(samples.length - step(), nextIndex));
    bookBusy = true;
    bookButtons();
    const bookLabel = $('book-label');
    if (bookLabel) bookLabel.textContent = 'Cargando las páginas…';

    try {
      const chosen = samples.slice(nextIndex, nextIndex + step());
      const urls = await Promise.all(chosen.map(pageImage));
      if (request !== bookRequest || !bookOpened) return;

      chosen.forEach((s, i) => {
        const b = $(i === 0 ? 'book-left' : 'book-right');
        if (!b) return;
        const im = b.querySelector('img');
        if (im) {
          im.src = urls[i];
          im.alt = s.title;
        }
        b.hidden = false;
        b.setAttribute('aria-label', 'Ampliar: ' + s.title);
        b.onclick = () => openSample(s.id);
      });

      await Promise.all(chosen.map((_, i) => {
        const b = $(i === 0 ? 'book-left' : 'book-right');
        const im = b ? b.querySelector('img') : null;
        return im ? im.decode() : Promise.resolve();
      }));

      if (request !== bookRequest || !bookOpened) return;

      const bookRight = $('book-right');
      if (bookRight) bookRight.hidden = step() === 1;

      const bookOpen = $('book-open');
      if (bookOpen) bookOpen.hidden = true;

      const bookSpread = $('book-spread');
      if (bookSpread) bookSpread.hidden = false;

      const bookClose = $('book-close');
      if (bookClose) bookClose.hidden = false;

      bookIndex = nextIndex;
      const bookCount = $('book-count');
      if (bookCount) {
        bookCount.textContent = (bookIndex + 1) + (step() === 2 ? '–' + (bookIndex + 2) : '') + ' / 10';
      }
      if (bookLabel) {
        bookLabel.textContent = samples[bookIndex].book + ' · Página ' + samples[bookIndex].page;
      }
      samples.slice(bookIndex + step(), bookIndex + step() * 2).forEach(s => pageImage(s).catch(() => {}));
    } catch {
      if (bookLabel) bookLabel.textContent = 'No se pudo cargar. Inténtalo de nuevo.';
    } finally {
      if (request === bookRequest) {
        bookBusy = false;
        bookButtons();
      }
    }
  }

  const bookOpenBtn = $('book-open');
  if (bookOpenBtn) {
    bookOpenBtn.onclick = async () => {
      bookOpened = true;
      await renderBook();
      const nextBtn = $('book-next');
      if (nextBtn && !nextBtn.disabled) nextBtn.focus({ preventScroll: true });
    };
  }

  const bookCloseBtn = $('book-close');
  if (bookCloseBtn) {
    bookCloseBtn.onclick = () => {
      bookRequest++;
      bookOpened = false;
      bookBusy = false;
      const bOpen = $('book-open');
      if (bOpen) bOpen.hidden = false;
      const bSpread = $('book-spread');
      if (bSpread) bSpread.hidden = true;
      bookCloseBtn.hidden = true;
      const bCount = $('book-count');
      if (bCount) bCount.textContent = 'BIBLIOTECA';
      const bLabel = $('book-label');
      if (bLabel) bLabel.textContent = 'TOCA PARA ABRIR';
      bookButtons();
      if (bOpen) bOpen.focus({ preventScroll: true });
    };
  }

  function turn(direction) {
    if (bookOpened && !bookBusy) renderBook(bookIndex + direction * step());
  }

  const prevBtn = $('book-prev');
  if (prevBtn) prevBtn.onclick = () => turn(-1);

  const nextBtn = $('book-next');
  if (nextBtn) nextBtn.onclick = () => turn(1);

  const bookStage = $('book-stage');
  if (bookStage) {
    bookStage.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        turn(e.key === 'ArrowRight' ? 1 : -1);
      }
    });

    let startX = 0;
    bookStage.addEventListener('touchstart', e => startX = e.changedTouches[0].screenX, { passive: true });
    bookStage.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - startX;
      if (Math.abs(dx) > 65) turn(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  narrow.addEventListener('change', () => {
    if (bookOpened) renderBook();
  });

  const modal = $('sample-dialog');
  let modalSamples = allSamples, modalIndex = 0, modalBusy = false, modalRequest = 0;

  async function renderSample(index) {
    const request = ++modalRequest;
    modalBusy = true;
    const sPrev = $('sample-prev');
    const sNext = $('sample-next');
    if (sPrev) sPrev.disabled = true;
    if (sNext) sNext.disabled = true;

    try {
      const sample = modalSamples[index];
      const url = await pageImage(sample);
      if (request !== modalRequest) return;

      const sampleFull = $('sample-full');
      if (sampleFull) {
        sampleFull.src = url;
        await sampleFull.decode();
        if (request !== modalRequest) return;
        sampleFull.alt = sample.title;
        sampleFull.classList.remove('zoomed');
        sampleFull.title = 'Toca para ampliar';
      }

      const sTitle = $('sample-title');
      if (sTitle) sTitle.textContent = sample.title;

      const sOrigin = $('sample-origin');
      if (sOrigin) sOrigin.textContent = sample.book + ' · Página ' + sample.page;

      const sScroll = $('sample-scroll');
      if (sScroll) {
        sScroll.scrollTop = 0;
        sScroll.scrollLeft = 0;
      }

      modalIndex = index;
      const sCount = $('sample-count');
      if (sCount) sCount.textContent = (index + 1) + ' / ' + modalSamples.length;

      if (modal && !modal.open) {
        modal.showModal();
        document.body.classList.add('modal-open');
      }

      if (modalSamples[index + 1]) pageImage(modalSamples[index + 1]).catch(() => {});
    } catch {
      const sCount = $('sample-count');
      if (sCount) sCount.textContent = 'No se pudo cargar. Inténtalo de nuevo.';
    } finally {
      if (request === modalRequest) {
        modalBusy = false;
        if (sPrev) sPrev.disabled = modalIndex === 0;
        if (sNext) sNext.disabled = modalIndex === modalSamples.length - 1;
      }
    }
  }

  function openSample(id) {
    const index = allSamples.findIndex(s => s.id === id);
    if (index < 0) return;
    if (index < 10) {
      modalSamples = samples;
      renderSample(index);
    } else if (allSamples[index].id.startsWith('bonus')) {
      const bonusList = allSamples.filter(s => s.id.startsWith('bonus'));
      const bIdx = bonusList.findIndex(s => s.id === id);
      modalSamples = bonusList;
      renderSample(bIdx >= 0 ? bIdx : 0);
    } else {
      modalSamples = [allSamples[index]];
      renderSample(0);
    }
  }

  window.openAtlasSample = openSample;

  const sClose = $('sample-close');
  if (sClose && modal) {
    sClose.onclick = () => modal.close();
  }

  const sPrevBtn = $('sample-prev');
  if (sPrevBtn) {
    sPrevBtn.onclick = () => {
      if (!modalBusy && modalIndex > 0) renderSample(modalIndex - 1);
    };
  }

  const sNextBtn = $('sample-next');
  if (sNextBtn) {
    sNextBtn.onclick = () => {
      if (!modalBusy && modalIndex < modalSamples.length - 1) renderSample(modalIndex + 1);
    };
  }

  const sampleFull = $('sample-full');
  if (sampleFull) {
    sampleFull.onclick = () => {
      const zoomed = sampleFull.classList.toggle('zoomed');
      sampleFull.title = zoomed ? 'Toca para ajustar' : 'Toca para ampliar';
    };
  }

  document.querySelectorAll('[data-sample]').forEach(b => {
    b.onclick = () => openSample(b.dataset.sample);
  });

  document.querySelectorAll('[data-carousel-pause]').forEach(button => {
    const gallery = button.closest('.ecografia_gallery__FgeDv');
    if (!gallery) return;
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    gallery.dataset.paused = String(reduced);

    function label() {
      const paused = gallery.dataset.paused === 'true';
      button.setAttribute('aria-pressed', String(paused));
      button.textContent = paused ? 'Reanudar carrusel ▶' : 'Pausar carrusel Ⅱ';
    }

    label();
    button.onclick = () => {
      gallery.dataset.paused = String(gallery.dataset.paused !== 'true');
      label();
      button.blur();
    };
  });

  const upgrade = $('upgrade-dialog');
  const openUpgradeBtn = $('open-upgrade');
  const closeUpgradeBtn = $('close-upgrade');
  if (upgrade && openUpgradeBtn) {
    openUpgradeBtn.onclick = () => {
      upgrade.showModal();
      document.body.classList.add('modal-open');
    };
  }
  if (upgrade && closeUpgradeBtn) {
    closeUpgradeBtn.onclick = () => upgrade.close();
  }

  [modal, upgrade].forEach(d => {
    if (!d) return;
    d.addEventListener('click', e => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          d.close();
        }
      }
    });
    d.addEventListener('close', () => document.body.classList.remove('modal-open'));
  });

  if (modal) {
    modal.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') {
        const p = $('sample-prev');
        if (p) p.click();
      }
      if (e.key === 'ArrowRight') {
        const n = $('sample-next');
        if (n) n.click();
      }
    });
  }

  /* ========================================================================
     INTERACTIVE WIDGET 1: OCULAR DE MICROSCOPIO (100x vs 400x)
     ======================================================================== */
  const ocularPresets = {
    '100x-cilindros': {
      mag: '100x',
      focus: 'normal',
      hudTop: 'OBJETIVO 10x · CAMPO 100x · BARRIDO',
      hudBottom: 'Cilindro hialino vs. moco en borde de cubreobjetos',
      img: 'assets/samples/atlas-047.webp',
      sampleId: 'atlas-047',
      title: '100x · Barrido Panorámico de Cilindros y Moco',
      desc: 'A menor aumento y con el condensador bajo, recorres los bordes del cubreobjetos para localizar matrices cilíndricas de bajo índice de refracción antes de pasar a 400x.',
      bullets: [
        '<b>Dónde enfocar:</b> Bordes del cubreobjetos y campos periféricos con contraste reducido.',
        '<b>Qué diferenciar:</b> Extremos redondeados y lados paralelos del cilindro hialino frente a bandas irregulares de moco.',
        '<b>Referencia en el Atlas:</b> Páginas 12, 47 y 83 con esquemas y micrografías reales.'
      ]
    },
    '400x-acantocitos': {
      mag: '400x',
      focus: 'fine',
      hudTop: 'OBJETIVO 40x · CAMPO 400x · DETALLE CELULAR',
      hudBottom: 'Dismorfismo eritrocitario · Acantocito (G1)',
      img: 'assets/samples/atlas-029.webp',
      sampleId: 'atlas-029',
      title: '400x · Hematíes Dismórficos y Acantocitos (G1)',
      desc: 'A 400x de aumento, el ajuste fino del tornillo micrométrico revela el anillo citoplasmático con protrusiones vesiculares (blebs) típicas de hematuria de origen glomerular.',
      bullets: [
        '<b>Dónde enfocar:</b> Contorno de la membrana celular y proyecciones vesiculares en forma de "orejas de Mickey".',
        '<b>Qué diferenciar:</b> Los hematíes crenados (hiperosmolares) presentan espículas puntiagudas uniformes, no vesículas redondeadas.',
        '<b>Referencia en el Atlas:</b> Páginas 27, 28, 29, 85 y Caso Guiado 01 (pág. 93).'
      ]
    },
    '400x-cristais': {
      mag: '400x',
      focus: 'fine',
      hudTop: 'OBJETIVO 40x · CAMPO 400x · CRISTALURIA',
      hudBottom: 'Oxalato de calcio: sobre (di) × ovalado (mono)',
      img: 'assets/samples/atlas-087.webp',
      sampleId: 'atlas-087',
      title: '400x · Geometría de Cristales y Caras Ópticas',
      desc: 'Compara el clásico sobre bipiramidal del oxalato dihidratado con los discos ovalados/pesas del monohidratado, que pueden imitar hematíes isomórficos.',
      bullets: [
        '<b>Dónde enfocar:</b> Cruce de las líneas diagonales internas, refracción intensa y ausencia de halo bicóncavo.',
        '<b>Correlación química:</b> Verifica siempre el pH urinario en la tira reactiva antes de confirmar la identificación.',
        '<b>Referencia en el Atlas:</b> Páginas 34 a 46, 87 y Guía Rápida de Cristales (Bono 01).'
      ]
    },
    '400x-leveduras': {
      mag: '400x',
      focus: 'fine',
      hudTop: 'OBJETIVO 40x · CAMPO 400x · DIFERENCIAL CRÍTICO',
      hudBottom: 'Levaduras en gemación × hematíes',
      img: 'assets/samples/atlas-081.webp',
      sampleId: 'atlas-081',
      title: '400x · Levaduras en Gemación vs. Hematíes',
      desc: 'Una de las confusiones más frecuentes en la rutina: estructuras ovoides refringentes que simulan eritrocitos cuando la tira reactiva para sangre resulta negativa.',
      bullets: [
        '<b>Dónde enfocar:</b> Busca yemas adheridas (gemación), forma ovoide y variación de tamaño entre células vecinas.',
        '<b>Cuándo sospechar:</b> Sedimento rico en estructuras redondeadas pero con tira reactiva negativa para hemoglobina.',
        '<b>Referencia en el Atlas:</b> Páginas 55, 78 y Comparación Lado a Lado en la página 81.'
      ]
    }
  };

  const ocularButtons = document.querySelectorAll('[data-ocular-preset]');
  const ocularViewport = $('ocular-viewport');
  const ocularImg = $('ocular-img');
  const ocularHudTop = $('ocular-hud-top');
  const ocularHudBottom = $('ocular-hud-bottom');
  const ocularTitle = $('ocular-title');
  const ocularDesc = $('ocular-desc');
  const ocularList = $('ocular-list');
  const ocularZoomBtn = $('ocular-zoom-btn');

  ocularButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.ocularPreset;
      const data = ocularPresets[key];
      if (!data) return;

      ocularButtons.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
      if (ocularViewport) {
        ocularViewport.dataset.mag = data.mag;
        ocularViewport.dataset.focus = data.focus;
      }
      if (ocularImg) {
        ocularImg.src = data.img;
        ocularImg.alt = data.title;
      }
      if (ocularHudTop) ocularHudTop.textContent = data.hudTop;
      if (ocularHudBottom) ocularHudBottom.textContent = data.hudBottom;
      if (ocularTitle) ocularTitle.textContent = data.title;
      if (ocularDesc) ocularDesc.textContent = data.desc;
      if (ocularList) {
        ocularList.innerHTML = data.bullets.map(item => `<li><span>✓</span><div>${item}</div></li>`).join('');
      }
      if (ocularZoomBtn) {
        ocularZoomBtn.dataset.sample = data.sampleId;
        ocularZoomBtn.onclick = () => openSample(data.sampleId);
      }
    });
  });

  /* ========================================================================
     INTERACTIVE WIDGET 2: COMPARADOR LADO A LADO
     ======================================================================== */
  const compData = {
    'lev-hem': {
      sampleId: 'atlas-081',
      img: 'assets/samples/atlas-081.webp',
      badge: 'PÁGINA 81 · COMPARACIONES LADO A LADO',
      title: 'Levaduras × Hematíes isomórficos',
      subtitle: 'Estructuras incoloras y redondeadas que suelen generar falsas alertas de hematuria.',
      leftLabel: 'ESTRUCTURA A · LEVADURA',
      leftTitle: 'Gemación y contorno ovoide',
      leftText: 'Busca una yema adherida (gemación), pared más refringente y variación de calibre entre células cercanas. No sufre lisis con ácido acético.',
      rightLabel: 'ESTRUCTURA B · HEMATÍE',
      rightTitle: 'Disco bicóncavo regular',
      rightText: 'Contorno circular uniforme, doble halo al mover el enfoque micrométrico y ausencia de gemación. Se correlaciona con sangre en la tira.',
      alert: '<strong>Criterio de mesada:</strong> Cuando la gemación no aparece en el primer campo, recorre campos adyacentes y verifica si la tira reactiva es negativa para sangre.'
    },
    'muco-cil': {
      sampleId: 'atlas-083',
      img: 'assets/samples/atlas-083.webp',
      badge: 'PÁGINA 83 · COMPARACIONES LADO A LADO',
      title: 'Filamento de moco × Cilindro hialino',
      subtitle: 'Ambos tienen bajo índice de refracción y requieren condensador bajo para una visualización nítida.',
      leftLabel: 'ESTRUCTURA A · FILAMENTO DE MOCO',
      leftTitle: 'Cinta sinuosa y extremos afilados',
      leftText: 'Grosor variable a lo largo del trayecto, bordes ondulados o deshilachados y extremos que se abren en hebras finas.',
      rightLabel: 'ESTRUCTURA B · CILINDRO HIALINO',
      rightTitle: 'Matriz con lados paralelos',
      rightText: 'Molde tubular homogéneo de proteína de Tamm-Horsfall, con anchura constante y extremos redondeados bien delimitados.',
      alert: '<strong>Criterio de mesada:</strong> Revisa ambos extremos y la continuidad de los bordes en distintos planos de enfoque antes de clasificarlo como cilindro.'
    },
    'iso-dism': {
      sampleId: 'atlas-085',
      img: 'assets/samples/atlas-085.webp',
      badge: 'PÁGINA 85 · COMPARACIONES LADO A LADO',
      title: 'Hematíes isomórficos × dismórficos',
      subtitle: 'La distinción morfológica que orienta el estudio entre sangrado urológico y glomerular.',
      leftLabel: 'ESTRUCTURA A · ISOMÓRFICO',
      leftTitle: 'Morfología preservada y uniforme',
      leftText: 'Células de diámetro regular, contorno liso (o crenación fisiológica uniforme) y distribución homogénea por el campo.',
      rightLabel: 'ESTRUCTURA B · DISMÓRFICO / ACANTOCITO',
      rightTitle: 'Anillos deformados y vesículas (blebs)',
      rightText: 'Pérdida de la regularidad del disco, fragmentación de membrana y proyecciones vesiculares características del paso por la membrana basal glomerular.',
      alert: '<strong>Criterio de mesada:</strong> El patrón poblacional de múltiples células en varios campos tiene mucho más valor diagnóstico que un único hematíe aislado.'
    },
    'oxa-di-mono': {
      sampleId: 'atlas-087',
      img: 'assets/samples/atlas-087.webp',
      badge: 'PÁGINA 87 · COMPARACIONES LADO A LADO',
      title: 'Oxalato dihidratado × monohidratado',
      subtitle: 'Dos presentaciones cristalinas de la misma sal que pueden coexistir en la misma muestra.',
      leftLabel: 'ESTRUCTURA A · DIHIDRATADO (WEDDELLITA)',
      leftTitle: 'Sobre bipiramidal clásico',
      leftText: 'Octaedros transparentes con dos pirámides unidas por la base, formando la "X" central característica al ajustar el enfoque.',
      rightLabel: 'ESTRUCTURA B · MONOHIDRATADO (WHEWELLITA)',
      rightTitle: 'Discos ovalados, pesas o formas alargadas',
      rightText: 'Pequeños cristales ovoides o bicóncavos fuertemente birrefringentes que pueden simular hematíes en campo claro.',
      alert: '<strong>Criterio de mesada:</strong> Ambas formas aparecen en orina ácida o neutra. Registra únicamente la forma efectivamente reconocida en el campo.'
    },
    'cil-pseudo': {
      sampleId: 'atlas-092',
      img: 'assets/samples/atlas-092.webp',
      badge: 'PÁGINA 92 · COMPARACIONES LADO A LADO',
      title: 'Cilindro verdadero × Pseudocilindro',
      subtitle: 'Cómo no confundir un cilindro granuloso o celular real con un agregado alargado de uratos o cristales.',
      leftLabel: 'ESTRUCTURA A · CILINDRO VERDADERO',
      leftTitle: 'Matriz proteica continua',
      leftText: 'Los gránulos o células están verdaderamente inmersos dentro de una matriz cilíndrica con bordes laterales nítidos y contornos paralelos.',
      rightLabel: 'ESTRUCTURA B · PSEUDOCILINDRO',
      rightTitle: 'Agrupamiento casual sin matriz',
      rightText: 'Cristales amorfos, leucocitos o artefactos apilados en banda, pero con bordes irregulares y sin membrana hialina envolvente.',
      alert: '<strong>Criterio de mesada:</strong> Sigue toda la extensión de la estructura por el campo y verifica que exista matriz verdadera en los extremos antes de informar.'
    }
  };

  const compBtns = document.querySelectorAll('[data-comp-tab]');
  const compImg = $('comp-img');
  const compZoomBtn = $('comp-zoom-btn');
  const compBadge = $('comp-badge');
  const compTitle = $('comp-title');
  const compSubtitle = $('comp-subtitle');
  const compLeftLabel = $('comp-left-label');
  const compLeftTitle = $('comp-left-title');
  const compLeftText = $('comp-left-text');
  const compRightLabel = $('comp-right-label');
  const compRightTitle = $('comp-right-title');
  const compRightText = $('comp-right-text');
  const compAlert = $('comp-alert');

  compBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.compTab;
      const d = compData[key];
      if (!d) return;

      compBtns.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
      if (compImg) {
        compImg.src = d.img;
        compImg.alt = d.title;
        compImg.onclick = () => openSample(d.sampleId);
      }
      if (compZoomBtn) {
        compZoomBtn.dataset.sample = d.sampleId;
        compZoomBtn.onclick = () => openSample(d.sampleId);
      }
      if (compBadge) compBadge.textContent = d.badge;
      if (compTitle) compTitle.textContent = d.title;
      if (compSubtitle) compSubtitle.textContent = d.subtitle;
      if (compLeftLabel) compLeftLabel.textContent = d.leftLabel;
      if (compLeftTitle) compLeftTitle.textContent = d.leftTitle;
      if (compLeftText) compLeftText.textContent = d.leftText;
      if (compRightLabel) compRightLabel.textContent = d.rightLabel;
      if (compRightTitle) compRightTitle.textContent = d.rightTitle;
      if (compRightText) compRightText.textContent = d.rightText;
      if (compAlert) compAlert.innerHTML = d.alert;
    });
  });

  /* ========================================================================
     INTERACTIVE WIDGET 3: SIMULADOR DE TIRA REACTIVA × SEDIMENTO
     ======================================================================== */
  const dipstickData = {
    'sangue': {
      sampleId: 'atlas-022',
      img: 'assets/samples/atlas-022.webp',
      title: 'Sangre en la Tira Reactiva × Sedimento (Pág. 22)',
      detects: 'Actividad pseudoperoxidásica del grupo hemo (hematíes íntegros, hemoglobina libre post-lisis o mioglobina). Lectura en 60 segundos.',
      sediment: 'Busca hematíes isomórficos o dismórficos en 400x, además de cilindros hemáticos en 100x.',
      divergence: 'Tira positiva con sedimento sin hematíes sugiere lisis celular (orina alcalina o hipotónica) o mioglobinuria. El ácido ascórbico (vitamina C) elevado puede causar falso negativo en la tira.'
    },
    'leucocitos': {
      sampleId: 'atlas-023',
      img: 'assets/samples/atlas-023.webp',
      title: 'Esterasa Leucocitaria × Leucocitos en Campo (Pág. 23)',
      detects: 'Enzimas esterasas presentes en los gránulos azurófilos de granulocitos (neutrófilos íntegros o lisados). Lectura en 120 segundos.',
      sediment: 'Cuantifica leucocitos (piocitos) aislados o en acúmulos, cilindros leucocitarios y flora bacteriana.',
      divergence: 'Los linfocitos no producen esterasa leucocitaria. Glucosuria elevada, alta densidad o antibióticos (cefalexina, gentamicina) pueden atenuar la reacción en la tira.'
    },
    'nitrito': {
      sampleId: 'atlas-023',
      img: 'assets/samples/atlas-023.webp',
      title: 'Nitrito en la Tira × Bacteriuria en el Sedimento (Pág. 23)',
      detects: 'Conversión del nitrato dietético en nitrito por bacterias Gram-negativas reductoras de nitrato (ej.: E. coli). Lectura en 60 segundos.',
      sediment: 'Observa bacilos o cocos móviles/inmóviles en 400x asociados a la presencia de leucocitos.',
      divergence: 'Un nitrito negativo NO descarta infección: requiere permanencia de la orina en la vejiga (>4 h), dieta con nitratos y bacteria reductora (Enterococcus y Staphylococcus son nitrito-negativos).'
    },
    'proteina': {
      sampleId: 'atlas-019',
      img: 'assets/samples/atlas-019.webp',
      title: 'Proteína en la Tira × Cilindros en el Sedimento (Pág. 19)',
      detects: 'Error proteico de los indicadores de pH, altamente sensible a la albúmina urinaria. Lectura en 60 segundos.',
      sediment: 'Inspecciona cuidadosamente los bordes del cubreobjetos en 100x en busca de cilindros hialinos, granulosos, céreos, epiteliales o grasos.',
      divergence: 'La orina fuertemente alcalina (pH > 8,0) o contaminada con amonio cuaternario puede dar falso positivo. La tira es poco sensible a globulinas y cadenas ligeras.'
    },
    'ph': {
      sampleId: 'atlas-018',
      img: 'assets/samples/atlas-018.webp',
      title: 'pH Urinario × Clasificación de Cristales (Pág. 18)',
      detects: 'Concentración de iones hidrógeno entre pH 5,0 y 8,5 mediante doble indicador (rojo de metilo y azul de bromotimol).',
      sediment: 'Cruza obligatoriamente el pH con los cristales: ácido úrico, uratos amorfos y cistina predominan en pH ácido; estruvita y fosfatos amorfos en pH alcalino.',
      divergence: 'La muestra mantenida a temperatura ambiente sufre alcalinización por ureasa bacteriana y pérdida de CO₂, favoreciendo la precipitación secundaria de fosfatos y lisis de cilindros.'
    },
    'densidade': {
      sampleId: 'atlas-016',
      img: 'assets/samples/atlas-016.webp',
      title: 'Densidad Urinaria × Preservación Celular (Pág. 16)',
      detects: 'Concentración iónica de la orina (1.000 a 1.030) por cambio de pKa de polielectrolito.',
      sediment: 'En orina hiperconcentrada (>1.025), los hematíes suelen sufrir crenación; en orina muy diluida (<1.008), ocurre hinchazón ("hematíes fantasma") y lisis.',
      divergence: 'La tira reactiva mide solo solutos iónicos (no sufre interferencia directa de glucosa o contraste radiológico como el refractómetro, pero varía con pH > 6,5).'
    },
    'glicose': {
      sampleId: 'atlas-020',
      img: 'assets/samples/atlas-020.webp',
      title: 'Glucosa y Cetonas × Levaduras en el Sedimento (Pág. 20)',
      detects: 'Glucosa por reacción enzimática doble (glucosa oxidasa/peroxidasa) y ácido acetoacético por la reacción de Legal (nitroprusiato).',
      sediment: 'Las muestras glucosúricas favorecen la proliferación de levaduras (Candida spp.) con gemación y pseudohifas en el sedimento.',
      divergence: 'Concentraciones elevadas de ácido ascórbico o cuerpos cetónicos pueden reducir la sensibilidad del área de glucosa según el fabricante.'
    },
    'bilirrubina': {
      sampleId: 'atlas-021',
      img: 'assets/samples/atlas-021.webp',
      title: 'Bilirrubina y Urobilinógeno × Elementos Teñidos (Pág. 21)',
      detects: 'Bilirrubina directa (conjugada) hidrosoluble por sal de diazonio y urobilinógeno por el reactivo de Ehrlich.',
      sediment: 'La bilirrubinuria tiñe intensamente células epiteliales, cilindros granulosos y cristales de un color amarillo-pardo o ámbar dorado.',
      divergence: 'La bilirrubina es sumamente fotosensible: la exposición de la muestra a la luz oxida la bilirrubina a biliverdina, causando falso negativo en la tira.'
    }
  };

  const dipPads = document.querySelectorAll('[data-dipstick-pad]');
  const dipTitle = $('dip-title');
  const dipDetects = $('dip-detects');
  const dipSediment = $('dip-sediment');
  const dipDivergence = $('dip-divergence');
  const dipImg = $('dip-img');
  const dipZoomBtn = $('dip-zoom-btn');

  dipPads.forEach(pad => {
    pad.addEventListener('click', () => {
      const key = pad.dataset.dipstickPad;
      const d = dipstickData[key];
      if (!d) return;

      dipPads.forEach(p => p.setAttribute('aria-selected', String(p === pad)));
      if (dipTitle) dipTitle.textContent = d.title;
      if (dipDetects) dipDetects.textContent = d.detects;
      if (dipSediment) dipSediment.textContent = d.sediment;
      if (dipDivergence) dipDivergence.textContent = d.divergence;
      if (dipImg) {
        dipImg.src = d.img;
        dipImg.alt = d.title;
        dipImg.onclick = () => openSample(d.sampleId);
      }
      if (dipZoomBtn) {
        dipZoomBtn.dataset.sample = d.sampleId;
        dipZoomBtn.onclick = () => openSample(d.sampleId);
      }
    });
  });

  // Testimonials interactive drag/scroll
  const track = document.querySelector('.testimonials-track');
  if (track) {
    let isDown = false;
    track.addEventListener('mousedown', () => {
      isDown = true;
      track.style.cursor = 'grabbing';
      track.style.animationPlayState = 'paused';
    });
    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      track.style.cursor = 'grab';
      track.style.animationPlayState = 'running';
    });
  }

  /* ========================================================================
     REDIRECCIÓN CON PASO FORZADO DE PARÁMETROS DE URL
     (window.location.search -> window.location.href)
     ======================================================================== */
  const CHECKOUT_BASE_URL = 'https://pay.wiapy.com/6af0fe1d371815cbecca139b';

  function buildUrlWithParams(targetUrl) {
    const base = targetUrl || CHECKOUT_BASE_URL;
    const search = window.location.search || '';
    if (!search) return base;
    const cleanSearch = search.startsWith('?') ? search.substring(1) : search;
    if (!cleanSearch) return base;
    return base + (base.includes('?') ? '&' : '?') + cleanSearch;
  }

  function goToUrl(url, e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const finalUrl = buildUrlWithParams(url);
    if (typeof window.fbq === 'function') {
      try {
        window.fbq('track', 'InitiateCheckout');
      } catch (_) {}
    }
    window.location.href = finalUrl;
    return false;
  }

  window.buildCheckoutUrl = buildUrlWithParams;
  window.goToCheckout = function(e) {
    return goToUrl(CHECKOUT_BASE_URL, e);
  };

  function setupRedirects() {
    const redirectLinks = document.querySelectorAll('a[href*="pay.wiapy.com"], #cta-checkout, [data-checkout]');
    redirectLinks.forEach(link => {
      const targetUrl = link.getAttribute('href') || CHECKOUT_BASE_URL;
      link.href = buildUrlWithParams(targetUrl);
      link.addEventListener('click', function(e) {
        return goToUrl(this.getAttribute('href') || CHECKOUT_BASE_URL, e);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRedirects);
  } else {
    setupRedirects();
  }

})();
