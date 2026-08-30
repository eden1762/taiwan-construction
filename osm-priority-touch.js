(() => {
  const MAP_SELECTOR = '#map';
  const TILE_RE = /\/([0-9]+)\/([0-9]+)\/([0-9]+)\.png(?:\?|$)/;
  const EXTRA_TILE_RING = 2;
  const ZOOM_IN_RATIO = 1.32;
  const ZOOM_OUT_RATIO = 0.76;

  let mapEl = null;
  let observer = null;
  let ensureQueued = false;
  let expandingTiles = false;
  let offsetX = 0;
  let offsetY = 0;
  let pointers = new Map();
  let dragStart = null;
  let pinchDistance = 0;
  let moved = false;
  let suppressClickUntil = 0;
  let lastTiles = null;

  const isEnglish = () => document.documentElement.lang === 'en';
  const readyText = () => isEnglish()
    ? 'OpenStreetMap stays active. Drag with one finger and pinch with two fingers to zoom.'
    : 'OpenStreetMap 持續優先顯示；單指可拖曳、雙指可縮放地圖。';
  const loadingText = () => isEnglish()
    ? 'OpenStreetMap tiles are loading. The map will keep retrying instead of switching to a simplified Taiwan map.'
    : 'OpenStreetMap 圖磚載入中，會持續優先重試，不切換成台灣簡圖。';

  function injectStyle() {
    if (document.getElementById('tcm-osm-priority-touch-style')) return;
    const style = document.createElement('style');
    style.id = 'tcm-osm-priority-touch-style';
    style.textContent = `
      ${MAP_SELECTOR}{touch-action:none!important;overscroll-behavior:contain;cursor:grab;background:linear-gradient(145deg,#cfeaf5,#eef8fc)!important;}
      ${MAP_SELECTOR}.tcm-map-dragging{cursor:grabbing;}
      ${MAP_SELECTOR} .local-map{display:none!important;}
      ${MAP_SELECTOR} .tiles{will-change:transform;}
      ${MAP_SELECTOR} .tiles img{-webkit-user-drag:none;user-select:none;}
      ${MAP_SELECTOR} .pin{will-change:translate;}
      ${MAP_SELECTOR} .tcm-osm-loading{position:absolute;left:12px;bottom:12px;z-index:5;pointer-events:none;max-width:min(78%,390px);padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 8px 22px rgba(0,0,0,.12);color:#0b6d89;font-size:12px;font-weight:900;backdrop-filter:blur(8px);}
      @media(max-width:900px),(pointer:coarse){${MAP_SELECTOR}{touch-action:none!important;}}
    `;
    document.head.appendChild(style);
  }

  function tileInfo(img) {
    const m = String(img.currentSrc || img.src || '').match(TILE_RE);
    if (!m) return null;
    const left = Number.parseFloat(img.style.left || '0');
    const top = Number.parseFloat(img.style.top || '0');
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]), left, top };
  }

  function snapshotTiles() {
    const tiles = mapEl?.querySelector('.tiles');
    if (!tiles) return;
    const infos = [...tiles.querySelectorAll('img')].map(tileInfo).filter(Boolean);
    if (!infos.length) return;
    lastTiles = infos.map(v => ({ ...v }));
  }

  function restoreLastTiles() {
    if (!mapEl || mapEl.querySelector('.tiles') || !lastTiles?.length) return false;
    const layer = document.createElement('div');
    layer.className = 'tiles tcm-restored-osm-tiles';
    layer.setAttribute('aria-hidden', 'true');
    lastTiles.forEach(t => {
      const img = document.createElement('img');
      img.src = `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
      img.loading = 'eager';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.alt = '';
      img.style.left = `${t.left}px`;
      img.style.top = `${t.top}px`;
      layer.appendChild(img);
    });
    mapEl.prepend(layer);
    return true;
  }

  function setLoadingBadge(show) {
    if (!mapEl) return;
    let badge = mapEl.querySelector('.tcm-osm-loading');
    if (!show) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'tcm-osm-loading';
      mapEl.appendChild(badge);
    }
    badge.textContent = loadingText();
  }

  function setHealthWhenUseful() {
    const health = document.querySelector('#health');
    if (!health || !mapEl) return;
    const imgs = [...mapEl.querySelectorAll('.tiles img')];
    const hasLoaded = imgs.some(img => img.complete && img.naturalWidth > 0);
    setLoadingBadge(!hasLoaded);
    if (hasLoaded && !health.querySelector('#retryMap')) {
      health.textContent = readyText();
      health.classList.remove('warn');
    }
  }

  function expandTileCoverage() {
    if (expandingTiles || !mapEl) return;
    const tiles = mapEl.querySelector('.tiles');
    if (!tiles) return;
    const infos = [...tiles.querySelectorAll('img')].map(tileInfo).filter(Boolean);
    if (!infos.length) return;
    const z = infos[0].z;
    const sameZoom = infos.filter(v => v.z === z);
    if (!sameZoom.length) return;
    const minX = Math.min(...sameZoom.map(v => v.x));
    const maxX = Math.max(...sameZoom.map(v => v.x));
    const minY = Math.min(...sameZoom.map(v => v.y));
    const maxY = Math.max(...sameZoom.map(v => v.y));
    const ref = sameZoom[0];
    const present = new Set(sameZoom.map(v => `${v.x}/${v.y}`));
    const n = 2 ** z;

    expandingTiles = true;
    for (let x = minX - EXTRA_TILE_RING; x <= maxX + EXTRA_TILE_RING; x++) {
      for (let y = minY - EXTRA_TILE_RING; y <= maxY + EXTRA_TILE_RING; y++) {
        if (y < 0 || y >= n || present.has(`${x}/${y}`)) continue;
        const wrappedX = ((x % n) + n) % n;
        const img = document.createElement('img');
        img.src = `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
        img.loading = 'eager';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.alt = '';
        img.dataset.tcmExtraTile = '1';
        img.style.left = `${ref.left + (x - ref.x) * 256}px`;
        img.style.top = `${ref.top + (y - ref.y) * 256}px`;
        img.addEventListener('load', setHealthWhenUseful, { once: true });
        tiles.appendChild(img);
      }
    }
    expandingTiles = false;
  }

  function applyOffset() {
    if (!mapEl) return;
    const tiles = mapEl.querySelector('.tiles');
    if (tiles) tiles.style.transform = `translate3d(${offsetX}px,${offsetY}px,0)`;
    mapEl.querySelectorAll('.pin').forEach(pin => {
      pin.style.translate = `${offsetX}px ${offsetY}px`;
    });
    expandTileCoverage();
  }

  function resetOffset() {
    offsetX = 0;
    offsetY = 0;
    dragStart = null;
    applyOffset();
  }

  function retryExistingMap() {
    const retry = document.querySelector('#retryMap');
    if (retry) {
      retry.click();
      return true;
    }
    return false;
  }

  function ensureOpenStreetMap() {
    ensureQueued = false;
    if (!mapEl?.isConnected) return;
    mapEl.querySelectorAll('.local-map').forEach(el => { el.hidden = true; });

    if (!mapEl.querySelector('.tiles')) {
      if (!retryExistingMap()) restoreLastTiles();
    }

    const tiles = mapEl.querySelector('.tiles');
    if (tiles) {
      const imgs = [...tiles.querySelectorAll('img')];
      imgs.forEach(img => {
        if (!img.dataset.tcmOsmObserved) {
          img.dataset.tcmOsmObserved = '1';
          img.addEventListener('load', setHealthWhenUseful, { once: true });
          img.addEventListener('error', () => setLoadingBadge(true), { once: true });
        }
      });
      snapshotTiles();
      expandTileCoverage();
      applyOffset();
    }
    setHealthWhenUseful();
  }

  function queueEnsure() {
    if (ensureQueued) return;
    ensureQueued = true;
    requestAnimationFrame(ensureOpenStreetMap);
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function interactiveTarget(target) {
    return target instanceof Element && Boolean(target.closest('.pin,.mapControls,button,a,input,select,summary'));
  }

  function rebaseSinglePointer() {
    if (pointers.size !== 1) {
      dragStart = null;
      return;
    }
    const p = [...pointers.values()][0];
    dragStart = { x: p.x, y: p.y, offsetX, offsetY };
  }

  function zoomByControl(direction) {
    const button = mapEl?.querySelector(direction > 0 ? '#zin' : '#zout');
    if (!button) return;
    button.click();
    queueEnsure();
  }

  function onPointerDown(event) {
    if (interactiveTarget(event.target)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { mapEl.setPointerCapture(event.pointerId); } catch {}
    moved = false;
    if (pointers.size === 1) {
      rebaseSinglePointer();
      mapEl.classList.add('tcm-map-dragging');
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = distance(a, b);
      dragStart = null;
    }
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1 && dragStart) {
      const p = [...pointers.values()][0];
      const dx = p.x - dragStart.x;
      const dy = p.y - dragStart.y;
      if (Math.hypot(dx, dy) > 4) moved = true;
      offsetX = dragStart.offsetX + dx;
      offsetY = dragStart.offsetY + dy;
      applyOffset();
    } else if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = distance(a, b);
      if (pinchDistance > 0) {
        const ratio = d / pinchDistance;
        if (ratio >= ZOOM_IN_RATIO) {
          moved = true;
          pinchDistance = d;
          zoomByControl(1);
        } else if (ratio <= ZOOM_OUT_RATIO) {
          moved = true;
          pinchDistance = d;
          zoomByControl(-1);
        }
      }
    }
    event.preventDefault();
  }

  function onPointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { mapEl.releasePointerCapture(event.pointerId); } catch {}
    if (moved) suppressClickUntil = Date.now() + 350;
    if (pointers.size === 1) {
      rebaseSinglePointer();
    } else if (pointers.size === 0) {
      dragStart = null;
      pinchDistance = 0;
      mapEl.classList.remove('tcm-map-dragging');
    }
    event.preventDefault();
  }

  function bindMapGestures() {
    mapEl.addEventListener('pointerdown', onPointerDown, { passive: false });
    mapEl.addEventListener('pointermove', onPointerMove, { passive: false });
    mapEl.addEventListener('pointerup', onPointerEnd, { passive: false });
    mapEl.addEventListener('pointercancel', onPointerEnd, { passive: false });
    mapEl.addEventListener('click', event => {
      if (Date.now() < suppressClickUntil && !event.target.closest('.mapControls')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    mapEl.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      zoomByControl(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  function bindResetSignals() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('#reset,.cityMain') || (target.closest('.proj') && !target.closest('#map'))) resetOffset();
      if (target.closest('#zin')) {
        offsetX *= 2;
        offsetY *= 2;
      } else if (target.closest('#zout')) {
        offsetX *= 0.5;
        offsetY *= 0.5;
      }
    }, true);
    document.addEventListener('change', event => {
      if (event.target instanceof Element && event.target.matches('#cityFilter')) resetOffset();
    }, true);
  }

  function boot() {
    injectStyle();
    mapEl = document.querySelector(MAP_SELECTOR);
    if (!mapEl) return;
    bindMapGestures();
    bindResetSignals();
    observer = new MutationObserver(queueEnsure);
    observer.observe(mapEl, { childList: true, subtree: true });
    new MutationObserver(() => {
      setLoadingBadge(Boolean(mapEl.querySelector('.tcm-osm-loading')));
      setHealthWhenUseful();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    queueEnsure();
    window.addEventListener('resize', queueEnsure, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
