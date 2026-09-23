/**
 * Logistik End-to-End — Engpass-Demo (clientseitig)
 * Vite + bpmn-js NavigatedViewer + Stations-Simulation
 */
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './styles.css';

/** Happy-Path-Stationen mit Buchungskapazität (Engpass: Vormontage). */
const STATIONS = [
  { id: 'Task_MaterialBuchung', name: 'Material-/Lager-Buchung', capacity: 4, serviceMs: [400, 900] },
  { id: 'Task_Vormontage', name: 'Vormontage', capacity: 2, serviceMs: [900, 1600] },
  { id: 'Task_Produktion', name: 'Produktion / Montage', capacity: 3, serviceMs: [700, 1300] },
  { id: 'Task_QS', name: 'QS / Freigabe', capacity: 3, serviceMs: [500, 1000] },
  { id: 'Task_VersandBuchung', name: 'Versand-Buchung', capacity: 4, serviceMs: [350, 800] },
];

const BPMN_URL = new URL('../public/logistik-auftrag.bpmn', import.meta.url).href;

const state = {
  running: false,
  paused: false,
  speed: 1,
  nextOrderId: 1,
  activeOrders: 0,
  completedOrders: 0,
  spawnAccumMs: 0,
  spawnIntervalMs: 700,
  orders: /** @type {Map<number, {id:number, stationIndex:number, remainingMs:number, waiting:boolean}>} */ (new Map()),
  /** queue = waiting + processing at station */
  stations: STATIONS.map((s) => ({
    ...s,
    queue: 0,
    processing: 0,
    waiting: 0,
  })),
  overlays: /** @type {Map<string, string>} */ (new Map()),
  viewer: /** @type {import('bpmn-js/lib/NavigatedViewer').default | null} */ (null),
  canvas: null,
  elementRegistry: null,
  overlaysApi: null,
  lastTs: 0,
  rafId: 0,
  maxLog: 40,
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function buildShell(root) {
  root.innerHTML = '';

  const topbar = el('header', { className: 'topbar' }, [
    el('div', { className: 'topbar-logo' }, [
      el('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' }, [
        (() => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('d', 'M3 7h13l5 5v5h-2.5a2.5 2.5 0 01-5 0H10a2.5 2.5 0 01-5 0H3V7z');
          p.setAttribute('stroke', 'currentColor');
          p.setAttribute('stroke-width', '1.6');
          p.setAttribute('fill', 'rgba(255,255,255,0.15)');
          return p;
        })(),
      ]),
      el('span', { text: 'Logistik Camunda' }),
    ]),
    el('span', { className: 'topbar-badge', text: 'Browser-Demo' }),
    el('div', { className: 'topbar-spacer' }),
    el('span', { className: 'topbar-note', text: 'Clientseitige Engpass-Simulation · kein Backend nötig' }),
  ]);

  const hero = el('section', { className: 'hero' }, [
    el('div', { className: 'hero-inner' }, [
      el('h1', { text: 'Logistik End-to-End — Engpass-Demo' }),
      el('p', {
        text:
          'Visualisierung des BPMN-Prozesses „Logistik-Auftrag“ mit Buchungspunkten. ' +
          'Die Simulation zeigt, wie begrenzte Stationskapazität (z. B. Vormontage) Warteschlangen und Engpässe erzeugt.',
      }),
      el('div', { className: 'hero-meta' }, [
        el('span', { className: 'chip', text: 'bpmn-js Viewer' }),
        el('span', { className: 'chip', text: 'Buchungskapazität' }),
        el('span', { className: 'chip', text: 'Happy Path + Engpass' }),
        el('span', { className: 'chip', text: 'Deutsch' }),
      ]),
    ]),
  ]);

  const canvasCard = el('section', { className: 'card', id: 'process-card' }, [
    el('div', { className: 'card-header' }, [
      el('h2', { text: 'Prozesskarte · Logistik-Auftrag' }),
      el('div', { className: 'controls', id: 'controls' }, [
        el('button', { className: 'btn btn-primary', id: 'btn-start', type: 'button', text: 'Simulation starten' }),
        el('button', { className: 'btn btn-secondary', id: 'btn-pause', type: 'button', disabled: 'true', text: 'Pausieren' }),
        el('button', { className: 'btn btn-danger', id: 'btn-reset', type: 'button', text: 'Zurücksetzen' }),
        el('div', { className: 'speed-control' }, [
          el('label', { for: 'speed', text: 'Geschwindigkeit' }),
          el('input', { type: 'range', id: 'speed', min: '0.5', max: '4', step: '0.5', value: '1' }),
          el('span', { id: 'speed-label', text: '1×' }),
        ]),
      ]),
    ]),
    el('div', { className: 'stats-row', id: 'stats-row' }, [
      statBlock('laufend', '0', 'stat-active'),
      statBlock('abgeschlossen', '0', 'stat-done'),
      statBlock('engpass', '—', 'stat-bottleneck'),
      statBlock('status', 'Bereit', 'stat-status'),
    ]),
    el('div', { className: 'canvas-wrap' }, [
      el('div', { id: 'canvas' }, [el('div', { className: 'loading', text: 'BPMN wird geladen …' })]),
      el('div', {
        className: 'canvas-overlay-hint',
        text: 'Badges = Warteschlange · Farbe = Auslastung vs. Kapazität',
      }),
    ]),
  ]);

  const sidebar = el('aside', { className: 'sidebar-col' }, [
    el('section', { className: 'card' }, [
      el('div', { className: 'card-header' }, [el('h2', { text: 'Stationen · Buchungskapazität' })]),
      el('div', { className: 'card-body' }, [el('div', { className: 'station-list', id: 'station-list' })]),
    ]),
    el('section', { className: 'card', style: 'margin-top:16px' }, [
      el('div', { className: 'card-header' }, [el('h2', { text: 'Legende' })]),
      el('div', { className: 'card-body' }, [
        el('div', { className: 'legend' }, [
          legendRow('ok', 'OK — Auslastung unter 70 %'),
          legendRow('warn', 'Warnung — 70–100 % Kapazität'),
          legendRow('danger', 'Engpass — Queue > Kapazität'),
          legendRow('active', 'Aktiv — Tokens an Station'),
        ]),
        el('div', {
          className: 'footnote',
          html:
            'Demo ohne Camunda-Runtime. Vormontage hat bewusst niedrige Kapazität (2), damit der Engpass sichtbar wird.',
        }),
      ]),
    ]),
    el('section', { className: 'card', style: 'margin-top:16px' }, [
      el('div', { className: 'card-header' }, [el('h2', { text: 'Ereignisprotokoll' })]),
      el('div', { className: 'card-body' }, [el('div', { className: 'event-log', id: 'event-log' })]),
    ]),
  ]);

  const main = el('main', { className: 'main' }, [canvasCard, sidebar]);

  const footer = el('footer', { className: 'footer' }, [
    el('span', {
      html:
        'Logistik Camunda Demo · BPMN: <code>logistik-auftrag.bpmn</code> · Nur Browser-Simulation',
    }),
  ]);

  root.append(topbar, hero, main, footer);
  renderStationList();
  wireControls();
}

function statBlock(label, value, id) {
  return el('div', { className: 'stat' }, [
    el('span', { className: 'stat-label', text: label }),
    el('span', { className: 'stat-value', id, text: value }),
  ]);
}

function legendRow(swatch, text) {
  return el('div', { className: 'legend-row' }, [
    el('span', { className: `swatch ${swatch}` }),
    el('span', { text }),
  ]);
}

function wireControls() {
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const speed = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');

  btnStart.addEventListener('click', () => {
    if (!state.running) {
      startSimulation();
    } else if (state.paused) {
      resumeSimulation();
    }
  });

  btnPause.addEventListener('click', () => {
    if (state.running && !state.paused) pauseSimulation();
  });

  btnReset.addEventListener('click', () => resetSimulation());

  speed.addEventListener('input', () => {
    state.speed = Number(speed.value) || 1;
    speedLabel.textContent = `${state.speed}×`;
  });
}

function statusLabel(level) {
  if (level === 'danger') return 'Engpass';
  if (level === 'warn') return 'Warnung';
  if (level === 'ok') return 'OK';
  return 'Leer';
}

function stationLevel(station) {
  const { queue, capacity } = station;
  if (queue === 0) return 'idle';
  const ratio = queue / capacity;
  if (ratio > 1) return 'danger';
  if (ratio >= 0.7) return 'warn';
  return 'ok';
}

function renderStationList() {
  const list = document.getElementById('station-list');
  if (!list) return;
  list.innerHTML = '';
  for (const s of state.stations) {
    const level = stationLevel(s);
    const cls = level === 'idle' ? '' : level;
    const ratio = Math.min(100, (s.queue / Math.max(1, s.capacity)) * 100);
    const fillCls = level === 'danger' || level === 'warn' ? level : '';
    const card = el('div', { className: `station ${cls}`.trim(), 'data-id': s.id }, [
      el('div', { className: 'station-top' }, [
        el('span', { className: 'station-name', text: s.name }),
        el('span', { className: 'station-status', text: statusLabel(level === 'idle' ? 'ok' : level) }),
      ]),
      el('div', { className: 'station-meta' }, [
        el('span', { html: `Kapazität: <strong>${s.capacity}</strong>` }),
        el('span', { html: `Queue: <strong>${s.queue}</strong>` }),
        el('span', { html: `in Arbeit: <strong>${s.processing}</strong>` }),
        el('span', { html: `wartend: <strong>${s.waiting}</strong>` }),
      ]),
      el('div', { className: 'bar' }, [
        el('div', {
          className: `bar-fill ${fillCls}`.trim(),
          style: `width:${ratio}%`,
        }),
      ]),
    ]);
    list.appendChild(card);
  }
}

function logEvent(msg) {
  const box = document.getElementById('event-log');
  if (!box) return;
  const now = new Date();
  const ts = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const row = el('div', { className: 'ev', html: `<strong>${ts}</strong> ${msg}` });
  box.prepend(row);
  while (box.children.length > state.maxLog) box.removeChild(box.lastChild);
}

function updateStats() {
  const active = document.getElementById('stat-active');
  const done = document.getElementById('stat-done');
  const bottleneck = document.getElementById('stat-bottleneck');
  const status = document.getElementById('stat-status');
  if (active) active.textContent = String(state.activeOrders);
  if (done) done.textContent = String(state.completedOrders);

  let worst = null;
  let worstScore = -1;
  for (const s of state.stations) {
    const score = s.queue / Math.max(1, s.capacity);
    if (score > worstScore) {
      worstScore = score;
      worst = s;
    }
  }
  if (bottleneck) {
    bottleneck.textContent =
      worst && worst.queue > worst.capacity ? worst.name : worst && worst.queue > 0 ? worst.name : '—';
  }
  if (status) {
    status.textContent = !state.running
      ? 'Bereit'
      : state.paused
        ? 'Pausiert'
        : 'Läuft';
  }

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  if (btnStart && btnPause) {
    if (!state.running) {
      btnStart.textContent = 'Simulation starten';
      btnStart.disabled = false;
      btnPause.disabled = true;
    } else if (state.paused) {
      btnStart.textContent = 'Fortsetzen';
      btnStart.disabled = false;
      btnPause.disabled = true;
    } else {
      btnStart.textContent = 'Läuft …';
      btnStart.disabled = true;
      btnPause.disabled = false;
    }
  }
}

function randBetween([a, b]) {
  return a + Math.random() * (b - a);
}

function clearHighlights() {
  if (!state.elementRegistry) return;
  for (const s of STATIONS) {
    const shape = state.elementRegistry.get(s.id);
    if (!shape) continue;
    const gfx = state.canvas.getGraphics(shape);
    if (gfx) {
      gfx.classList.remove('highlight-ok', 'highlight-warn', 'highlight-danger', 'highlight-active');
    }
  }
  if (state.overlaysApi) {
    for (const oid of state.overlays.values()) {
      try {
        state.overlaysApi.remove(oid);
      } catch {
        /* ignore */
      }
    }
  }
  state.overlays.clear();
}

function syncVisuals() {
  if (!state.elementRegistry || !state.canvas) return;
  clearHighlights();

  for (const s of state.stations) {
    const shape = state.elementRegistry.get(s.id);
    if (!shape) continue;
    const gfx = state.canvas.getGraphics(shape);
    if (!gfx) continue;

    const level = stationLevel(s);
    if (level === 'danger') gfx.classList.add('highlight-danger');
    else if (level === 'warn') gfx.classList.add('highlight-warn');
    else if (level === 'ok') gfx.classList.add('highlight-ok');
    else if (s.processing > 0) gfx.classList.add('highlight-active');

    if (s.queue > 0 && state.overlaysApi) {
      const badge = document.createElement('div');
      badge.className = 'token-badge';
      if (level === 'warn') badge.classList.add('warn');
      if (level === 'danger') badge.classList.add('danger');
      badge.textContent = String(s.queue);
      const oid = state.overlaysApi.add(s.id, {
        position: { top: -10, right: -10 },
        html: badge,
      });
      state.overlays.set(s.id, oid);
    }
  }

  renderStationList();
  updateStats();
}

function recountStations() {
  for (const s of state.stations) {
    s.queue = 0;
    s.processing = 0;
    s.waiting = 0;
  }
  for (const order of state.orders.values()) {
    const s = state.stations[order.stationIndex];
    if (!s) continue;
    s.queue += 1;
    if (order.waiting) s.waiting += 1;
    else s.processing += 1;
  }
}

function tryPromoteWaiting() {
  for (let i = 0; i < state.stations.length; i++) {
    const station = state.stations[i];
    const processing = [...state.orders.values()].filter(
      (o) => o.stationIndex === i && !o.waiting,
    ).length;
    const free = Math.max(0, station.capacity - processing);
    if (free <= 0) continue;
    const waiting = [...state.orders.values()]
      .filter((o) => o.stationIndex === i && o.waiting)
      .slice(0, free);
    for (const o of waiting) {
      o.waiting = false;
      o.remainingMs = randBetween(station.serviceMs);
    }
  }
}

function spawnOrder() {
  const id = state.nextOrderId++;
  const first = state.stations[0];
  const processing = [...state.orders.values()].filter(
    (o) => o.stationIndex === 0 && !o.waiting,
  ).length;
  const waiting = processing >= first.capacity;
  state.orders.set(id, {
    id,
    stationIndex: 0,
    remainingMs: waiting ? 0 : randBetween(first.serviceMs),
    waiting,
  });
  state.activeOrders += 1;
  if (id === 1 || id % 5 === 0) {
    logEvent(`Auftrag <strong>#${id}</strong> gestartet → ${first.name}`);
  }
  if (!waiting && first.id === 'Task_Vormontage') {
    /* n/a at first station */
  }
}

function advanceOrder(order) {
  const next = order.stationIndex + 1;
  if (next >= state.stations.length) {
    state.orders.delete(order.id);
    state.activeOrders = Math.max(0, state.activeOrders - 1);
    state.completedOrders += 1;
    if (state.completedOrders % 3 === 0 || state.completedOrders <= 2) {
      logEvent(`Auftrag <strong>#${order.id}</strong> abgeschlossen`);
    }
    return;
  }
  const station = state.stations[next];
  const processing = [...state.orders.values()].filter(
    (o) => o.stationIndex === next && !o.waiting,
  ).length;
  const mustWait = processing >= station.capacity;
  order.stationIndex = next;
  order.waiting = mustWait;
  order.remainingMs = mustWait ? 0 : randBetween(station.serviceMs);
  if (mustWait && station.id === 'Task_Vormontage') {
    logEvent(
      `Engpass an <strong>${station.name}</strong>: Auftrag #${order.id} wartet (Queue &gt; Kapazität ${station.capacity})`,
    );
  }
}

function tick(dtMs) {
  const scaled = dtMs * state.speed;

  state.spawnAccumMs += scaled;
  while (state.spawnAccumMs >= state.spawnIntervalMs) {
    state.spawnAccumMs -= state.spawnIntervalMs;
    if (state.orders.size < 40) spawnOrder();
  }

  tryPromoteWaiting();

  for (const order of [...state.orders.values()]) {
    if (order.waiting) continue;
    order.remainingMs -= scaled;
    if (order.remainingMs <= 0) advanceOrder(order);
  }

  tryPromoteWaiting();
  recountStations();

  // Extra Engpass-Hinweis wenn Vormontage über Kapazität
  const vorm = state.stations.find((s) => s.id === 'Task_Vormontage');
  if (vorm && vorm.queue > vorm.capacity) {
    // visual handled in syncVisuals
  }

  syncVisuals();
}

function loop(ts) {
  if (!state.running || state.paused) {
    state.lastTs = ts;
    state.rafId = requestAnimationFrame(loop);
    return;
  }
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(100, ts - state.lastTs);
  state.lastTs = ts;
  tick(dt);
  state.rafId = requestAnimationFrame(loop);
}

function startSimulation() {
  state.running = true;
  state.paused = false;
  state.lastTs = 0;
  logEvent('Simulation <strong>gestartet</strong>');
  updateStats();
  if (!state.rafId) state.rafId = requestAnimationFrame(loop);
}

function pauseSimulation() {
  state.paused = true;
  logEvent('Simulation <strong>pausiert</strong>');
  updateStats();
}

function resumeSimulation() {
  state.paused = false;
  state.lastTs = 0;
  logEvent('Simulation <strong>fortgesetzt</strong>');
  updateStats();
}

function resetSimulation() {
  state.running = false;
  state.paused = false;
  state.orders.clear();
  state.activeOrders = 0;
  state.completedOrders = 0;
  state.nextOrderId = 1;
  state.spawnAccumMs = 0;
  state.lastTs = 0;
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }
  recountStations();
  clearHighlights();
  renderStationList();
  updateStats();
  const box = document.getElementById('event-log');
  if (box) box.innerHTML = '';
  logEvent('Simulation <strong>zurückgesetzt</strong>');
}

async function loadDiagram() {
  const canvasEl = document.getElementById('canvas');
  canvasEl.innerHTML = '';

  const viewer = new NavigatedViewer({
    container: canvasEl,
  });
  state.viewer = viewer;
  state.canvas = viewer.get('canvas');
  state.elementRegistry = viewer.get('elementRegistry');
  state.overlaysApi = viewer.get('overlays');

  let xml;
  try {
    const res = await fetch(BPMN_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    // Fallback: relative public path (Vite serves /public at root; with base prefix)
    const fallback = `${import.meta.env.BASE_URL}logistik-auftrag.bpmn`.replace(/\/{2,}/g, '/');
    const res2 = await fetch(fallback.startsWith('http') ? fallback : fallback);
    if (!res2.ok) throw err;
    xml = await res2.text();
  }

  await viewer.importXML(xml);
  state.canvas.zoom('fit-viewport', 'auto');
  logEvent('BPMN <strong>Logistik-Auftrag</strong> geladen');
  syncVisuals();
}

async function main() {
  const root = document.getElementById('app');
  buildShell(root);
  try {
    await loadDiagram();
  } catch (err) {
    console.error(err);
    const canvasEl = document.getElementById('canvas');
    if (canvasEl) {
      canvasEl.innerHTML = '';
      canvasEl.appendChild(
        el('div', {
          className: 'loading',
          text: `BPMN konnte nicht geladen werden: ${err.message || err}`,
        }),
      );
    }
    logEvent(`Fehler beim Laden: ${err.message || err}`);
  }
}

main();
