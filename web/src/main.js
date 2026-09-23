/**
 * Operations Control Tower — Logistik End-to-End
 * Vite + bpmn-js NavigatedViewer + Stations-Simulation (Enterprise Demo)
 */
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './styles.css';

/** Happy-Path-Stationen mit Buchungskapazität (Engpass: Vormontage). */
const STATIONS_BASE = [
  { id: 'Task_MaterialBuchung', name: 'Material-/Lager-Buchung', capacity: 4, serviceMs: [400, 900] },
  { id: 'Task_Vormontage', name: 'Vormontage', capacity: 2, serviceMs: [900, 1600] },
  { id: 'Task_Produktion', name: 'Produktion / Montage', capacity: 3, serviceMs: [700, 1300] },
  { id: 'Task_QS', name: 'QS / Freigabe', capacity: 3, serviceMs: [500, 1000] },
  { id: 'Task_VersandBuchung', name: 'Versand-Buchung', capacity: 4, serviceMs: [350, 800] },
];

const BPMN_URL = `${import.meta.env.BASE_URL}logistik-auftrag.bpmn`;

/** Demo-Annahme: Kosten eines verzögerten Auftrags pro Stunde (EUR). */
const DEFAULT_EUR_PER_ORDER_HOUR = 8500;

const SCENARIOS = {
  normal: {
    id: 'normal',
    label: 'Normalbetrieb',
    spawnIntervalMs: 700,
    materialMult: 1,
    vormontageCapacity: 2,
    crisisChance: 0,
  },
  peak: {
    id: 'peak',
    label: 'Peak-Last',
    spawnIntervalMs: 320,
    materialMult: 1,
    vormontageCapacity: 2,
    crisisChance: 0,
  },
  fehlteile: {
    id: 'fehlteile',
    label: 'Fehlteile-Krise',
    spawnIntervalMs: 650,
    materialMult: 2.2,
    vormontageCapacity: 2,
    crisisChance: 0.18,
  },
  kapazitaet: {
    id: 'kapazitaet',
    label: 'Kapazität+',
    spawnIntervalMs: 700,
    materialMult: 1,
    vormontageCapacity: 5,
    crisisChance: 0,
  },
};

const PITCH_STEPS = [
  {
    title: '1 · Bestellung',
    body:
      'Jeder Auftrag startet als Bestellung und durchläuft den End-to-End-Prozess. ' +
      'Die Prozesskarte zeigt die Shopfloor-/Logistik-Logik als BPMN — transparent, auditierbar, erweiterbar.',
  },
  {
    title: '2 · Buchungspunkte',
    body:
      'An jeder Station gibt es einen Buchungspunkt (Kapazität). ' +
      'Simulation startet jetzt: Tokens fließen — Material, Vormontage, Produktion, QS, Versand.',
    startSim: true,
  },
  {
    title: '3 · Engpass sichtbar',
    body:
      'Begrenzte Kapazität an der Vormontage erzeugt Warteschlangen. ' +
      'Amber/Rot auf der Karte und im Stations-Board: der Bottleneck ist sofort sichtbar — ohne Excel.',
  },
  {
    title: '4 · €-Impact',
    body:
      'Wartende Tokens × Demo-Annahme (€/Auftrag/Stunde) = €-Stau. ' +
      'So wird der Engpass zur Management-Kennzahl — Entscheidungsgrundlage, nicht nur Diagramm.',
  },
  {
    title: '5 · Entscheidung',
    body:
      'Szenario „Kapazität+“ oder Priorisierung: Entlastung der Vormontage, Sinken von WIP und €-Stau. ' +
      'Nächster Schritt: echte Engine (Camunda Cockpit) + ERP/WMS-Anbindung.',
  },
];

const state = {
  running: false,
  paused: false,
  speed: 1,
  nextOrderId: 1,
  activeOrders: 0,
  completedOrders: 0,
  spawnAccumMs: 0,
  spawnIntervalMs: SCENARIOS.normal.spawnIntervalMs,
  scenarioId: 'normal',
  materialMult: 1,
  crisisChance: 0,
  eurPerOrderHour: DEFAULT_EUR_PER_ORDER_HOUR,
  /** Rolling throughput samples (completed in last ~60s sim-time) */
  completedTimestamps: /** @type {number[]} */ ([]),
  simElapsedMs: 0,
  /** Sum of lead times for completed orders */
  leadTimeSumMs: 0,
  leadTimeCount: 0,
  waitingAccumMs: 0,
  orders: /** @type {Map<number, {id:number, stationIndex:number, remainingMs:number, waiting:boolean, startedAt:number}>} */ (
    new Map()
  ),
  stations: cloneStations(SCENARIOS.normal.vormontageCapacity),
  overlays: /** @type {Map<string, string>} */ (new Map()),
  viewer: /** @type {import('bpmn-js/lib/NavigatedViewer').default | null} */ (null),
  canvas: null,
  elementRegistry: null,
  overlaysApi: null,
  lastTs: 0,
  rafId: 0,
  maxLog: 50,
  pitchActive: false,
  pitchStep: 0,
  pitchTimer: 0,
};

function cloneStations(vormontageCapacity) {
  return STATIONS_BASE.map((s) => ({
    ...s,
    capacity: s.id === 'Task_Vormontage' ? vormontageCapacity : s.capacity,
    serviceMs: [...s.serviceMs],
    queue: 0,
    processing: 0,
    waiting: 0,
  }));
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'string') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function formatEur(n) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMs(ms) {
  if (!ms || ms <= 0) return '—';
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  return `${(sec / 60).toFixed(1)} min`;
}

function buildShell(root) {
  root.innerHTML = '';

  const topbar = el('header', { className: 'topbar' }, [
    el('div', { className: 'topbar-logo' }, [
      el('span', { 'aria-hidden': 'true', className: 'topbar-mark', text: '▣' }),
      el('span', { text: 'Logistik Camunda' }),
    ]),
    el('span', { className: 'topbar-badge', text: 'Operations Control Tower' }),
    el('div', { className: 'topbar-spacer' }),
    el('span', {
      className: 'topbar-note',
      text: 'Browser-Simulation · BPMN End-to-End · Demo-Annahmen gekennzeichnet',
    }),
  ]);

  const toolbar = el('section', { className: 'toolbar' }, [
    el('div', { className: 'toolbar-inner' }, [
      el('div', { className: 'toolbar-title' }, [
        el('h1', { text: 'Operations Control Tower — Logistik End-to-End' }),
        el('p', {
          text:
            'Buchungspunkte · Engpass-KPIs · €-Stau (Demo-Annahme) · Szenarien für Kapazität & Peak',
        }),
      ]),
      el('div', { className: 'toolbar-actions', id: 'toolbar-actions' }, [
        el('button', {
          className: 'btn btn-accent',
          id: 'btn-pitch',
          type: 'button',
          text: 'Pitch-Modus',
        }),
      ]),
    ]),
  ]);

  const scenarioBar = el('section', { className: 'scenario-bar' }, [
    el('div', { className: 'scenario-bar-inner' }, [
      el('span', { className: 'scenario-label', text: 'Szenario' }),
      el('div', { className: 'scenario-btns', id: 'scenario-btns' }),
      el('div', { className: 'scenario-cost' }, [
        el('label', { for: 'eur-rate', text: '€/Auftrag/h (Demo)' }),
        el('input', {
          type: 'number',
          id: 'eur-rate',
          min: '0',
          step: '500',
          value: String(DEFAULT_EUR_PER_ORDER_HOUR),
        }),
      ]),
    ]),
  ]);

  const canvasCard = el('section', { className: 'card', id: 'process-card' }, [
    el('div', { className: 'card-header' }, [
      el('h2', { text: 'Prozesskarte · Logistik-Auftrag' }),
      el('div', { className: 'controls', id: 'controls' }, [
        el('button', {
          className: 'btn btn-primary',
          id: 'btn-start',
          type: 'button',
          text: 'Start',
        }),
        el('button', {
          className: 'btn btn-secondary',
          id: 'btn-pause',
          type: 'button',
          disabled: 'true',
          text: 'Pause',
        }),
        el('button', {
          className: 'btn btn-secondary',
          id: 'btn-batch',
          type: 'button',
          text: '+10 Aufträge',
        }),
        el('button', {
          className: 'btn btn-danger',
          id: 'btn-reset',
          type: 'button',
          text: 'Reset',
        }),
        el('div', { className: 'speed-control' }, [
          el('label', { for: 'speed', text: 'Tempo' }),
          el('input', { type: 'range', id: 'speed', min: '0.5', max: '4', step: '0.5', value: '1' }),
          el('span', { id: 'speed-label', text: '1×' }),
        ]),
      ]),
    ]),
    el('div', { className: 'kpi-strip', id: 'kpi-strip' }, [
      kpiBlock('Durchsatz', '—', 'Aufträge/min (sim)', 'kpi-throughput'),
      kpiBlock('WIP', '0', 'aktive Aufträge', 'kpi-wip'),
      kpiBlock('Ø Durchlaufzeit', '—', 'sim', 'kpi-lead'),
      kpiBlock('Engpass', '—', 'Station', 'kpi-bottleneck'),
      kpiBlock('€-Stau', '—', 'Demo-Annahme', 'kpi-eur', true),
    ]),
    el('div', { className: 'canvas-wrap' }, [
      el('div', { id: 'canvas' }, [el('div', { className: 'loading', text: 'BPMN wird geladen …' })]),
      el('div', {
        className: 'canvas-overlay-hint',
        text: 'Badges = Warteschlange · Farbe = Auslastung vs. Kapazität',
      }),
      el('div', { className: 'pitch-overlay', id: 'pitch-overlay', hidden: 'true' }),
    ]),
  ]);

  const sidebar = el('aside', { className: 'sidebar-col' }, [
    el('section', { className: 'card' }, [
      el('div', { className: 'card-header' }, [el('h2', { text: 'Stations-Board' })]),
      el('div', { className: 'card-body card-body-tight' }, [
        el('div', { className: 'station-list', id: 'station-list' }),
      ]),
    ]),
    el('section', { className: 'card', style: 'margin-top:12px' }, [
      el('div', { className: 'card-header' }, [el('h2', { text: 'Legende & Annahmen' })]),
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
            '<strong>€-Stau</strong> = wartende Tokens × konfigurierbarer €/Auftrag/Stunde. ' +
            'Standard 8.500 € — klar als <em>Demo-Annahme</em> gekennzeichnet, keine Kundendaten. ' +
            'Vormontage startet mit Kapazität 2, damit der Engpass sichtbar wird.',
        }),
      ]),
    ]),
    el('section', { className: 'card', style: 'margin-top:12px' }, [
      el('div', { className: 'card-header' }, [el('h2', { text: 'Ereignisprotokoll' })]),
      el('div', { className: 'card-body' }, [el('div', { className: 'event-log', id: 'event-log' })]),
    ]),
  ]);

  const main = el('main', { className: 'main' }, [canvasCard, sidebar]);

  const footer = el('footer', { className: 'footer' }, [
    el('span', {
      html:
        'Logistik Camunda · Operations Control Tower · BPMN <code>logistik-auftrag.bpmn</code> · ' +
        'Browser-Simulation (optional: Camunda Cockpit lokal für Engine-Wahrheit)',
    }),
  ]);

  root.append(topbar, toolbar, scenarioBar, main, footer);
  renderScenarioButtons();
  renderStationList();
  wireControls();
  updateKpis();
}

function kpiBlock(label, value, hint, id, emphasis = false) {
  return el('div', { className: `kpi${emphasis ? ' kpi-emphasis' : ''}` }, [
    el('span', { className: 'kpi-label', text: label }),
    el('span', { className: 'kpi-value', id, text: value }),
    el('span', { className: 'kpi-hint', text: hint }),
  ]);
}

function legendRow(swatch, text) {
  return el('div', { className: 'legend-row' }, [
    el('span', { className: `swatch ${swatch}` }),
    el('span', { text }),
  ]);
}

function renderScenarioButtons() {
  const box = document.getElementById('scenario-btns');
  if (!box) return;
  box.innerHTML = '';
  for (const sc of Object.values(SCENARIOS)) {
    const btn = el('button', {
      className: `btn btn-scenario${state.scenarioId === sc.id ? ' active' : ''}`,
      type: 'button',
      'data-scenario': sc.id,
      text: sc.label,
    });
    btn.addEventListener('click', () => applyScenario(sc.id));
    box.appendChild(btn);
  }
}

function applyScenario(id, { silent = false } = {}) {
  const sc = SCENARIOS[id];
  if (!sc) return;
  state.scenarioId = id;
  state.spawnIntervalMs = sc.spawnIntervalMs;
  state.materialMult = sc.materialMult;
  state.crisisChance = sc.crisisChance;

  const vorm = state.stations.find((s) => s.id === 'Task_Vormontage');
  if (vorm) vorm.capacity = sc.vormontageCapacity;

  const mat = state.stations.find((s) => s.id === 'Task_MaterialBuchung');
  if (mat) {
    const base = STATIONS_BASE[0].serviceMs;
    mat.serviceMs = [base[0] * sc.materialMult, base[1] * sc.materialMult];
  }

  renderScenarioButtons();
  renderStationList();
  updateKpis();
  if (!silent) {
    logEvent(`Szenario <strong>${sc.label}</strong> aktiv`);
  }
}

function wireControls() {
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnBatch = document.getElementById('btn-batch');
  const btnPitch = document.getElementById('btn-pitch');
  const speed = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
  const eurRate = document.getElementById('eur-rate');

  btnStart.addEventListener('click', () => {
    if (!state.running) startSimulation();
    else if (state.paused) resumeSimulation();
  });

  btnPause.addEventListener('click', () => {
    if (state.running && !state.paused) pauseSimulation();
  });

  btnReset.addEventListener('click', () => resetSimulation());

  btnBatch.addEventListener('click', () => {
    for (let i = 0; i < 10; i++) spawnOrder();
    recountStations();
    syncVisuals();
    logEvent('<strong>+10 Aufträge</strong> injiziert');
  });

  btnPitch.addEventListener('click', () => {
    if (state.pitchActive) stopPitch();
    else startPitch();
  });

  speed.addEventListener('input', () => {
    state.speed = Number(speed.value) || 1;
    speedLabel.textContent = `${state.speed}×`;
  });

  eurRate.addEventListener('change', () => {
    const v = Number(eurRate.value);
    state.eurPerOrderHour = Number.isFinite(v) && v >= 0 ? v : DEFAULT_EUR_PER_ORDER_HOUR;
    updateKpis();
  });
}

/* ——— Pitch mode ——— */

function startPitch() {
  state.pitchActive = true;
  state.pitchStep = 0;
  document.getElementById('btn-pitch').textContent = 'Pitch beenden';
  document.getElementById('btn-pitch').classList.add('active');
  showPitchStep(0);
  schedulePitchAdvance();
  logEvent('Pitch-Modus <strong>gestartet</strong>');
}

function stopPitch() {
  state.pitchActive = false;
  clearTimeout(state.pitchTimer);
  state.pitchTimer = 0;
  const ov = document.getElementById('pitch-overlay');
  if (ov) {
    ov.hidden = true;
    ov.innerHTML = '';
  }
  const btn = document.getElementById('btn-pitch');
  if (btn) {
    btn.textContent = 'Pitch-Modus';
    btn.classList.remove('active');
  }
}

function schedulePitchAdvance() {
  clearTimeout(state.pitchTimer);
  if (!state.pitchActive) return;
  state.pitchTimer = window.setTimeout(() => {
    if (!state.pitchActive) return;
    if (state.pitchStep < PITCH_STEPS.length - 1) {
      showPitchStep(state.pitchStep + 1);
      schedulePitchAdvance();
    }
  }, 8000);
}

function showPitchStep(index) {
  state.pitchStep = index;
  const step = PITCH_STEPS[index];
  const ov = document.getElementById('pitch-overlay');
  if (!ov || !step) return;
  ov.hidden = false;
  ov.innerHTML = '';

  const dots = el('div', { className: 'pitch-dots' });
  for (let i = 0; i < PITCH_STEPS.length; i++) {
    dots.appendChild(
      el('span', { className: `pitch-dot${i === index ? ' active' : ''}` }),
    );
  }

  ov.append(
    el('div', { className: 'pitch-card' }, [
      el('div', { className: 'pitch-step-num', text: `Schritt ${index + 1} / ${PITCH_STEPS.length}` }),
      el('h3', { text: step.title }),
      el('p', { text: step.body }),
      dots,
      el('div', { className: 'pitch-actions' }, [
        el('button', {
          className: 'btn btn-secondary',
          type: 'button',
          text: 'Zurück',
          disabled: index === 0 ? 'true' : undefined,
          onClick: () => {
            if (state.pitchStep > 0) {
              showPitchStep(state.pitchStep - 1);
              schedulePitchAdvance();
            }
          },
        }),
        el('button', {
          className: 'btn btn-primary',
          type: 'button',
          text: index < PITCH_STEPS.length - 1 ? 'Weiter' : 'Fertig',
          onClick: () => {
            if (index < PITCH_STEPS.length - 1) {
              showPitchStep(index + 1);
              schedulePitchAdvance();
            } else {
              stopPitch();
            }
          },
        }),
        el('button', {
          className: 'btn btn-ghost',
          type: 'button',
          text: 'Schließen',
          onClick: () => stopPitch(),
        }),
      ]),
    ]),
  );

  if (step.startSim && !state.running) {
    startSimulation();
  }
  if (index === 3 && state.scenarioId === 'normal') {
    applyScenario('peak', { silent: true });
    logEvent('Pitch: Peak-Last für €-Impact');
  }
  if (index === 4) {
    applyScenario('kapazitaet', { silent: true });
    logEvent('Pitch: Kapazität+ zur Entlastung');
  }
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

function totalWaiting() {
  return state.stations.reduce((sum, s) => sum + s.waiting, 0);
}

function eurStau() {
  return totalWaiting() * state.eurPerOrderHour;
}

function stationEurShare(station) {
  const total = totalWaiting();
  if (total <= 0) return 0;
  return (station.waiting / total) * eurStau();
}

function utilizationPct(station) {
  if (station.capacity <= 0) return 0;
  return Math.min(999, Math.round((station.queue / station.capacity) * 100));
}

function renderStationList() {
  const list = document.getElementById('station-list');
  if (!list) return;
  list.innerHTML = '';
  const totalEur = eurStau();

  for (const s of state.stations) {
    const level = stationLevel(s);
    const cls = level === 'idle' ? '' : level;
    const util = utilizationPct(s);
    const fillCls = level === 'danger' || level === 'warn' ? level : '';
    const barW = Math.min(100, util);
    const share = stationEurShare(s);
    const sharePct = totalEur > 0 ? Math.round((share / totalEur) * 100) : 0;

    const card = el('div', { className: `station ${cls}`.trim(), 'data-id': s.id }, [
      el('div', { className: 'station-top' }, [
        el('span', { className: 'station-name', text: s.name }),
        el('span', { className: 'station-status', text: statusLabel(level === 'idle' ? 'ok' : level) }),
      ]),
      el('div', { className: 'station-meta' }, [
        el('span', { html: `Kapazität: <strong>${s.capacity}</strong>` }),
        el('span', { html: `In Arbeit: <strong>${s.processing}</strong>` }),
        el('span', { html: `Warteschlange: <strong>${s.waiting}</strong>` }),
        el('span', { html: `Auslastung: <strong>${util} %</strong>` }),
      ]),
      el('div', { className: 'station-eur' }, [
        el('span', { text: '€-Anteil am Stau' }),
        el('strong', { text: totalEur > 0 ? `${formatEur(share)} (${sharePct} %)` : '—' }),
      ]),
      el('div', { className: 'bar' }, [
        el('div', {
          className: `bar-fill ${fillCls}`.trim(),
          style: `width:${barW}%`,
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
  const ts = now.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const row = el('div', { className: 'ev', html: `<strong>${ts}</strong> ${msg}` });
  box.prepend(row);
  while (box.children.length > state.maxLog) box.removeChild(box.lastChild);
}

function throughputPerMin() {
  const windowMs = 60_000;
  const cutoff = state.simElapsedMs - windowMs;
  state.completedTimestamps = state.completedTimestamps.filter((t) => t >= cutoff);
  if (state.simElapsedMs < 5_000) return null;
  const count = state.completedTimestamps.length;
  const window = Math.min(windowMs, state.simElapsedMs);
  return (count / window) * 60_000;
}

function avgLeadMs() {
  if (state.leadTimeCount <= 0) return null;
  return state.leadTimeSumMs / state.leadTimeCount;
}

function findBottleneck() {
  let worst = null;
  let worstScore = -1;
  for (const s of state.stations) {
    const score = s.queue / Math.max(1, s.capacity);
    if (score > worstScore) {
      worstScore = score;
      worst = s;
    }
  }
  if (!worst || worst.queue === 0) return null;
  return worst;
}

function updateKpis() {
  const tp = throughputPerMin();
  const tpEl = document.getElementById('kpi-throughput');
  if (tpEl) tpEl.textContent = tp == null ? '—' : tp.toFixed(1);

  const wipEl = document.getElementById('kpi-wip');
  if (wipEl) wipEl.textContent = String(state.activeOrders);

  const leadEl = document.getElementById('kpi-lead');
  if (leadEl) {
    const avg = avgLeadMs();
    leadEl.textContent = avg == null ? '—' : formatMs(avg);
  }

  const bn = findBottleneck();
  const bnEl = document.getElementById('kpi-bottleneck');
  if (bnEl) {
    bnEl.textContent = bn ? bn.name : '—';
    bnEl.classList.toggle('kpi-hot', !!(bn && bn.queue > bn.capacity));
  }

  const eurEl = document.getElementById('kpi-eur');
  if (eurEl) {
    const eur = eurStau();
    eurEl.textContent = formatEur(eur);
    eurEl.classList.toggle('kpi-hot', eur > 0);
  }

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  if (btnStart && btnPause) {
    if (!state.running) {
      btnStart.textContent = 'Start';
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
  for (const s of STATIONS_BASE) {
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
  if (!state.elementRegistry || !state.canvas) {
    renderStationList();
    updateKpis();
    return;
  }
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
  updateKpis();
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
      let service = randBetween(station.serviceMs);
      if (station.id === 'Task_MaterialBuchung' && Math.random() < state.crisisChance) {
        service *= 2.5;
      }
      o.remainingMs = service;
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
  let remaining = waiting ? 0 : randBetween(first.serviceMs);
  if (!waiting && Math.random() < state.crisisChance) remaining *= 2.5;

  state.orders.set(id, {
    id,
    stationIndex: 0,
    remainingMs: remaining,
    waiting,
    startedAt: state.simElapsedMs,
  });
  state.activeOrders += 1;
  if (id === 1 || id % 5 === 0) {
    logEvent(`Auftrag <strong>#${id}</strong> gestartet → ${first.name}`);
  }
}

function advanceOrder(order) {
  const next = order.stationIndex + 1;
  if (next >= state.stations.length) {
    const lead = state.simElapsedMs - order.startedAt;
    state.leadTimeSumMs += lead;
    state.leadTimeCount += 1;
    state.completedTimestamps.push(state.simElapsedMs);
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
  state.simElapsedMs += scaled;

  state.spawnAccumMs += scaled;
  while (state.spawnAccumMs >= state.spawnIntervalMs) {
    state.spawnAccumMs -= state.spawnIntervalMs;
    if (state.orders.size < 50) spawnOrder();
  }

  tryPromoteWaiting();

  for (const order of [...state.orders.values()]) {
    if (order.waiting) continue;
    order.remainingMs -= scaled;
    if (order.remainingMs <= 0) advanceOrder(order);
  }

  tryPromoteWaiting();
  recountStations();
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
  updateKpis();
  if (!state.rafId) state.rafId = requestAnimationFrame(loop);
}

function pauseSimulation() {
  state.paused = true;
  logEvent('Simulation <strong>pausiert</strong>');
  updateKpis();
}

function resumeSimulation() {
  state.paused = false;
  state.lastTs = 0;
  logEvent('Simulation <strong>fortgesetzt</strong>');
  updateKpis();
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
  state.simElapsedMs = 0;
  state.completedTimestamps = [];
  state.leadTimeSumMs = 0;
  state.leadTimeCount = 0;
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }
  applyScenario(state.scenarioId, { silent: true });
  recountStations();
  clearHighlights();
  renderStationList();
  updateKpis();
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

  const res = await fetch(BPMN_URL);
  if (!res.ok) throw new Error(`BPMN-Datei nicht gefunden (HTTP ${res.status})`);
  const xml = await res.text();

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
