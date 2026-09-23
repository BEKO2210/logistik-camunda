/**
 * Operations Control Tower — Logistik End-to-End
 * Vite + bpmn-js NavigatedViewer + Prozess-Baukasten (firmenspezifisch)
 */
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './styles.css';

const STORAGE_KEY = 'logistik-process-config';
const DEFAULT_EUR_PER_ORDER_HOUR = 8500;

const STEP_TYPES = [
  { id: 'buchung', label: 'Buchung' },
  { id: 'prozess', label: 'Prozess' },
  { id: 'qs', label: 'QS' },
  { id: 'lager', label: 'Lager' },
  { id: 'versand', label: 'Versand' },
  { id: 'custom', label: 'Custom' },
];

const TYPE_DEFAULTS = {
  buchung: { capacity: 4, serviceMs: [350, 800], booking: true },
  prozess: { capacity: 2, serviceMs: [800, 1500], booking: true },
  qs: { capacity: 2, serviceMs: [500, 1200], booking: true },
  lager: { capacity: 4, serviceMs: [400, 900], booking: true },
  versand: { capacity: 4, serviceMs: [350, 800], booking: true },
  custom: { capacity: 3, serviceMs: [500, 1000], booking: false },
};

function stepDefaults(type) {
  const d = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.custom;
  return { capacity: d.capacity, serviceMs: [...d.serviceMs], booking: d.booking };
}

function uid(prefix = 's') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeStep(partial) {
  const type = partial.type || 'custom';
  const defaults = stepDefaults(type);
  return {
    id: partial.id || uid('s'),
    name: partial.name || 'Neuer Schritt',
    type,
    capacity: partial.capacity ?? defaults.capacity,
    serviceMs: Array.isArray(partial.serviceMs)
      ? [...partial.serviceMs]
      : [...defaults.serviceMs],
    booking: partial.booking ?? defaults.booking,
  };
}

/** Templates: different company pipelines */
const TEMPLATES = {
  kfz: {
    id: 'kfz',
    name: 'KFZ/Montage',
    costPerOrderHour: 8500,
    steps: [
      makeStep({
        id: 'Task_MaterialBuchung',
        name: 'Material-/Lager-Buchung',
        type: 'lager',
        capacity: 4,
        serviceMs: [400, 900],
        booking: true,
      }),
      makeStep({
        id: 'Task_Vormontage',
        name: 'Vormontage',
        type: 'prozess',
        capacity: 2,
        serviceMs: [900, 1600],
        booking: true,
      }),
      makeStep({
        id: 'Task_Produktion',
        name: 'Produktion / Montage',
        type: 'prozess',
        capacity: 3,
        serviceMs: [700, 1300],
        booking: true,
      }),
      makeStep({
        id: 'Task_QS',
        name: 'QS / Freigabe',
        type: 'qs',
        capacity: 3,
        serviceMs: [500, 1000],
        booking: true,
      }),
      makeStep({
        id: 'Task_VersandBuchung',
        name: 'Versand-Buchung',
        type: 'versand',
        capacity: 4,
        serviceMs: [350, 800],
        booking: true,
      }),
    ],
  },
  wareneingang_qs: {
    id: 'wareneingang_qs',
    name: 'Wareneingang→QS zuerst',
    costPerOrderHour: 7200,
    steps: [
      makeStep({
        id: 's_we',
        name: 'Wareneingang',
        type: 'lager',
        capacity: 5,
        serviceMs: [300, 700],
        booking: true,
      }),
      makeStep({
        id: 's_qs_in',
        name: 'QS Eingang',
        type: 'qs',
        capacity: 2,
        serviceMs: [600, 1400],
        booking: true,
      }),
      makeStep({
        id: 's_buchung',
        name: 'Bestandsbuchung',
        type: 'buchung',
        capacity: 3,
        serviceMs: [400, 900],
        booking: true,
      }),
      makeStep({
        id: 's_einlagern',
        name: 'Einlagern',
        type: 'lager',
        capacity: 4,
        serviceMs: [500, 1000],
        booking: true,
      }),
      makeStep({
        id: 's_bereit',
        name: 'Bereitstellung',
        type: 'prozess',
        capacity: 3,
        serviceMs: [450, 900],
        booking: false,
      }),
    ],
  },
  buchung_first: {
    id: 'buchung_first',
    name: 'Buchung-first Lean',
    costPerOrderHour: 6500,
    steps: [
      makeStep({
        id: 's_bf_book',
        name: 'Auftrag buchen',
        type: 'buchung',
        capacity: 3,
        serviceMs: [250, 550],
        booking: true,
      }),
      makeStep({
        id: 's_bf_pick',
        name: 'Kommissionierung',
        type: 'lager',
        capacity: 4,
        serviceMs: [500, 1100],
        booking: true,
      }),
      makeStep({
        id: 's_bf_pack',
        name: 'Packen',
        type: 'prozess',
        capacity: 3,
        serviceMs: [400, 800],
        booking: false,
      }),
      makeStep({
        id: 's_bf_ship',
        name: 'Versand freigeben',
        type: 'versand',
        capacity: 4,
        serviceMs: [300, 700],
        booking: true,
      }),
    ],
  },
  leer: {
    id: 'leer',
    name: 'Leer (Custom)',
    costPerOrderHour: 8500,
    steps: [],
  },
};

function cloneConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return cloneConfig(TEMPLATES.kfz);
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((s) => makeStep(s || {}))
    : [];
  return {
    id: String(raw.id || 'custom'),
    name: String(raw.name || 'Mein Werk'),
    costPerOrderHour:
      Number.isFinite(Number(raw.costPerOrderHour)) && Number(raw.costPerOrderHour) >= 0
        ? Number(raw.costPerOrderHour)
        : DEFAULT_EUR_PER_ORDER_HOUR,
    steps,
  };
}

function loadStoredConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore quota */
  }
}

const SCENARIOS = {
  normal: {
    id: 'normal',
    label: 'Normalbetrieb',
    spawnIntervalMs: 700,
    firstServiceMult: 1,
    capacityMode: 'base',
    crisisChance: 0,
  },
  peak: {
    id: 'peak',
    label: 'Peak-Last',
    spawnIntervalMs: 320,
    firstServiceMult: 1,
    capacityMode: 'base',
    crisisChance: 0,
  },
  fehlteile: {
    id: 'fehlteile',
    label: 'Fehlteile-Krise',
    spawnIntervalMs: 650,
    firstServiceMult: 2.2,
    capacityMode: 'base',
    crisisChance: 0.18,
  },
  kapazitaet: {
    id: 'kapazitaet',
    label: 'Kapazität+',
    spawnIntervalMs: 700,
    firstServiceMult: 1,
    capacityMode: 'boost',
    crisisChance: 0,
  },
};

const PITCH_STEPS = [
  {
    title: '1 · Bestellung',
    body:
      'Jeder Auftrag startet und durchläuft Ihre Linie End-to-End. ' +
      'Die Prozesskarte zeigt die Shopfloor-/Logistik-Logik als BPMN — transparent und erweiterbar. ' +
      'Mit dem Prozess-Baukasten bauen Sie in Minuten die Linie des Kunden nach.',
  },
  {
    title: '2 · Buchungspunkte',
    body:
      'An konfigurierbaren Stationen gibt es Kapazität und optional Buchungspflicht. ' +
      'Simulation startet: Tokens fließen entlang Ihrer Bauschritte.',
    startSim: true,
  },
  {
    title: '3 · Engpass sichtbar',
    body:
      'Begrenzte Kapazität erzeugt Warteschlangen an der engsten Station. ' +
      'Amber/Rot auf der Karte und im Stations-Board — Bottleneck ohne Excel.',
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
      'Szenario „Kapazität+“ oder Priorisierung: Entlastung, Sinken von WIP und €-Stau. ' +
      'Nächster Schritt: echte Engine (Camunda Cockpit) + ERP/WMS — und Ihre Linie aus dem Baukasten.',
  },
];

const state = {
  processConfig: normalizeConfig(TEMPLATES.kfz),
  draftConfig: null,
  selectedStepIndex: -1,
  running: false,
  paused: false,
  speed: 1,
  nextOrderId: 1,
  activeOrders: 0,
  completedOrders: 0,
  spawnAccumMs: 0,
  spawnIntervalMs: SCENARIOS.normal.spawnIntervalMs,
  scenarioId: 'normal',
  firstServiceMult: 1,
  crisisChance: 0,
  eurPerOrderHour: DEFAULT_EUR_PER_ORDER_HOUR,
  completedTimestamps: /** @type {number[]} */ ([]),
  simElapsedMs: 0,
  leadTimeSumMs: 0,
  leadTimeCount: 0,
  orders: /** @type {Map<number, {id:number, stationIndex:number, remainingMs:number, waiting:boolean, startedAt:number}>} */ (
    new Map()
  ),
  stations: /** @type {any[]} */ ([]),
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

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Generate simple linear BPMN 2.0 XML from config.steps */
function generateBpmnXml(config) {
  const steps = config.steps || [];
  const processName = escapeXml(config.name || 'Logistik-Auftrag');
  const taskW = 120;
  const taskH = 80;
  const gap = 60;
  const startX = 80;
  const y = 120;
  const startW = 36;
  const endW = 36;

  const nodes = [];
  let x = startX;
  nodes.push({ kind: 'start', id: 'Start_Bestellung', name: 'Bestellung', x, y: y + 22, w: startW, h: startW });
  x += startW + gap;

  for (const step of steps) {
    nodes.push({
      kind: 'task',
      id: step.id,
      name: step.name,
      x,
      y,
      w: taskW,
      h: taskH,
    });
    x += taskW + gap;
  }

  nodes.push({
    kind: 'end',
    id: 'End_Abgeschlossen',
    name: 'Abgeschlossen',
    x,
    y: y + 22,
    w: endW,
    h: endW,
  });

  const flows = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    flows.push({
      id: `Flow_${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
    });
  }

  const processParts = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const incoming = i > 0 ? flows[i - 1].id : null;
    const outgoing = i < flows.length ? flows[i].id : null;
    if (n.kind === 'start') {
      processParts.push(
        `    <bpmn:startEvent id="${n.id}" name="${escapeXml(n.name)}">\n` +
          (outgoing ? `      <bpmn:outgoing>${outgoing}</bpmn:outgoing>\n` : '') +
          `    </bpmn:startEvent>`,
      );
    } else if (n.kind === 'end') {
      processParts.push(
        `    <bpmn:endEvent id="${n.id}" name="${escapeXml(n.name)}">\n` +
          (incoming ? `      <bpmn:incoming>${incoming}</bpmn:incoming>\n` : '') +
          `    </bpmn:endEvent>`,
      );
    } else {
      processParts.push(
        `    <bpmn:userTask id="${escapeXml(n.id)}" name="${escapeXml(n.name)}">\n` +
          (incoming ? `      <bpmn:incoming>${incoming}</bpmn:incoming>\n` : '') +
          (outgoing ? `      <bpmn:outgoing>${outgoing}</bpmn:outgoing>\n` : '') +
          `    </bpmn:userTask>`,
      );
    }
  }

  for (const f of flows) {
    processParts.push(
      `    <bpmn:sequenceFlow id="${f.id}" sourceRef="${escapeXml(f.source)}" targetRef="${escapeXml(f.target)}" />`,
    );
  }

  const diShapes = [];
  for (const n of nodes) {
    diShapes.push(
      `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${escapeXml(n.id)}">\n` +
        `        <dc:Bounds x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" />\n` +
        `      </bpmndi:BPMNShape>`,
    );
  }

  const diEdges = [];
  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    const src = nodes[i];
    const tgt = nodes[i + 1];
    const x1 = src.x + src.w;
    const y1 = src.y + src.h / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + tgt.h / 2;
    diEdges.push(
      `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n` +
        `        <di:waypoint x="${x1}" y="${y1}" />\n` +
        `        <di:waypoint x="${x2}" y="${y2}" />\n` +
        `      </bpmndi:BPMNEdge>`,
    );
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n` +
    `                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n` +
    `                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n` +
    `                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n` +
    `                  id="Definitions_Baukasten"\n` +
    `                  targetNamespace="http://novaforge.de/logistik"\n` +
    `                  exporter="Logistik Control Tower Baukasten"\n` +
    `                  exporterVersion="1.0.0">\n` +
    `  <bpmn:process id="LogistikAuftragDynamic" name="${processName}" isExecutable="true">\n` +
    processParts.join('\n') +
    `\n  </bpmn:process>\n` +
    `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n` +
    `    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="LogistikAuftragDynamic">\n` +
    diShapes.join('\n') +
    `\n` +
    diEdges.join('\n') +
    `\n    </bpmndi:BPMNPlane>\n` +
    `  </bpmndi:BPMNDiagram>\n` +
    `</bpmn:definitions>\n`
  );
}

function findNarrowestIndex(stations) {
  let idx = -1;
  let best = Infinity;
  stations.forEach((s, i) => {
    if (s.capacity < best) {
      best = s.capacity;
      idx = i;
    }
  });
  return idx;
}

function buildStationsFromConfig(config, scenarioId) {
  const sc = SCENARIOS[scenarioId] || SCENARIOS.normal;
  const stations = (config.steps || []).map((step) => ({
    id: step.id,
    name: step.name,
    type: step.type,
    booking: !!step.booking,
    baseCapacity: Math.max(1, Number(step.capacity) || 1),
    capacity: Math.max(1, Number(step.capacity) || 1),
    baseServiceMs: [...(step.serviceMs || [500, 1000])],
    serviceMs: [...(step.serviceMs || [500, 1000])],
    queue: 0,
    processing: 0,
    waiting: 0,
  }));

  if (stations.length > 0) {
    const mult = sc.firstServiceMult || 1;
    stations[0].serviceMs = [
      stations[0].baseServiceMs[0] * mult,
      stations[0].baseServiceMs[1] * mult,
    ];
  }

  if (sc.capacityMode === 'boost' && stations.length > 0) {
    const ni = findNarrowestIndex(stations);
    if (ni >= 0) {
      const base = stations[ni].baseCapacity;
      stations[ni].capacity = Math.max(base + 3, Math.round(base * 2.5), 5);
    }
  }

  return stations;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'string') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, String(v));
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

function typeLabel(typeId) {
  return STEP_TYPES.find((t) => t.id === typeId)?.label || typeId;
}

function ensureDraft() {
  if (!state.draftConfig) {
    state.draftConfig = cloneConfig(state.processConfig);
  }
  return state.draftConfig;
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
      text: 'Prozess-Baukasten · firmenspezifische Linien · Demo-Annahmen gekennzeichnet',
    }),
  ]);

  const toolbar = el('section', { className: 'toolbar' }, [
    el('div', { className: 'toolbar-inner' }, [
      el('div', { className: 'toolbar-title' }, [
        el('h1', { text: 'Operations Control Tower — Logistik End-to-End' }),
        el('p', {
          text:
            'Baukasten: Stationen einfügen · umordnen · löschen · Templates · Export/Import',
        }),
      ]),
      el('div', { className: 'toolbar-actions', id: 'toolbar-actions' }, [
        el('button', {
          className: 'btn btn-secondary btn-on-brand',
          id: 'btn-baukasten-focus',
          type: 'button',
          text: 'Prozess-Baukasten',
        }),
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
          value: String(state.eurPerOrderHour),
        }),
      ]),
    ]),
  ]);

  const canvasCard = el('section', { className: 'card', id: 'process-card' }, [
    el('div', { className: 'card-header' }, [
      el('h2', { id: 'process-title', text: `Prozesskarte · ${state.processConfig.name}` }),
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
        text: 'Badges = Warteschlange · Farbe = Auslastung vs. Kapazität · Linie aus Baukasten',
      }),
      el('div', { className: 'pitch-overlay', id: 'pitch-overlay', hidden: 'true' }),
    ]),
  ]);

  const baukastenCard = el('section', { className: 'card', id: 'baukasten-card' }, [
    el('div', { className: 'card-header' }, [
      el('h2', { text: 'Prozess-Baukasten' }),
      el('span', { className: 'baukasten-hint', id: 'baukasten-active-name', text: state.processConfig.name }),
    ]),
    el('div', { className: 'card-body card-body-tight' }, [
      el('div', { className: 'bk-meta' }, [
        el('label', { className: 'bk-field' }, [
          el('span', { text: 'Werk / Linie' }),
          el('input', {
            type: 'text',
            id: 'bk-name',
            value: state.processConfig.name,
            autocomplete: 'off',
          }),
        ]),
      ]),
      el('div', { className: 'bk-templates' }, [
        el('span', { className: 'bk-section-label', text: 'Templates' }),
        el('div', { className: 'bk-template-btns', id: 'bk-template-btns' }),
      ]),
      el('div', { className: 'bk-section-label', text: 'Bauschritte' }),
      el('div', { className: 'bk-steps', id: 'bk-steps' }),
      el('div', { className: 'bk-insert' }, [
        el('select', { id: 'bk-insert-type' }, STEP_TYPES.map((t) => el('option', { value: t.id, text: t.label }))),
        el('input', {
          type: 'text',
          id: 'bk-insert-name',
          placeholder: 'Name (optional)',
          autocomplete: 'off',
        }),
        el('button', {
          className: 'btn btn-primary',
          id: 'btn-bk-insert',
          type: 'button',
          text: 'Schritt einfügen',
        }),
      ]),
      el('div', { className: 'bk-actions' }, [
        el('button', {
          className: 'btn btn-primary',
          id: 'btn-bk-apply',
          type: 'button',
          text: 'Übernehmen',
        }),
        el('button', {
          className: 'btn btn-secondary',
          id: 'btn-bk-export',
          type: 'button',
          text: 'Export JSON',
        }),
        el('button', {
          className: 'btn btn-secondary',
          id: 'btn-bk-import',
          type: 'button',
          text: 'Import JSON',
        }),
        el('input', {
          type: 'file',
          id: 'bk-import-file',
          accept: 'application/json,.json',
          hidden: 'true',
        }),
      ]),
      el('p', {
        className: 'bk-footnote',
        text: 'Übernehmen baut Diagramm + Simulation neu. Profil wird lokal gespeichert.',
      }),
    ]),
  ]);

  const sidebar = el('aside', { className: 'sidebar-col' }, [
    baukastenCard,
    el('section', { className: 'card', style: 'margin-top:12px' }, [
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
            'Standard laut Profil — klar als <em>Demo-Annahme</em> gekennzeichnet. ' +
            'Jede Firma = eigene Pipeline im Baukasten.',
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
        'Logistik Camunda · Prozess-Baukasten · BPMN dynamisch aus Schritten · ' +
        'Browser-Simulation (optional: Camunda Cockpit lokal)',
    }),
  ]);

  root.append(topbar, toolbar, scenarioBar, main, footer);

  state.draftConfig = cloneConfig(state.processConfig);
  state.stations = buildStationsFromConfig(state.processConfig, state.scenarioId);

  renderScenarioButtons();
  renderTemplateButtons();
  renderBaukastenSteps();
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

function renderTemplateButtons() {
  const box = document.getElementById('bk-template-btns');
  if (!box) return;
  box.innerHTML = '';
  for (const tpl of Object.values(TEMPLATES)) {
    const btn = el('button', {
      className: `btn btn-scenario bk-tpl${state.draftConfig?.id === tpl.id ? ' active' : ''}`,
      type: 'button',
      text: tpl.name,
    });
    btn.addEventListener('click', () => {
      state.draftConfig = cloneConfig(tpl);
      state.selectedStepIndex = state.draftConfig.steps.length ? 0 : -1;
      const nameInput = document.getElementById('bk-name');
      if (nameInput) nameInput.value = state.draftConfig.name;
      renderTemplateButtons();
      renderBaukastenSteps();
      logEvent(`Template <strong>${tpl.name}</strong> in Entwurf geladen — „Übernehmen“ zum Anwenden`);
    });
    box.appendChild(btn);
  }
}

function renderBaukastenSteps() {
  const box = document.getElementById('bk-steps');
  if (!box) return;
  const draft = ensureDraft();
  box.innerHTML = '';

  if (!draft.steps.length) {
    box.appendChild(
      el('div', {
        className: 'bk-empty',
        text: 'Keine Schritte — Template wählen oder „Schritt einfügen“.',
      }),
    );
    return;
  }

  draft.steps.forEach((step, index) => {
    const selected = index === state.selectedStepIndex;
    const row = el('div', {
      className: `bk-step${selected ? ' selected' : ''}`,
      'data-index': String(index),
    });

    row.appendChild(
      el('div', { className: 'bk-step-head' }, [
        el('button', {
          className: 'btn btn-ghost bk-icon',
          type: 'button',
          title: 'Auswählen',
          text: selected ? '●' : '○',
          onClick: (e) => {
            e.stopPropagation();
            state.selectedStepIndex = index;
            renderBaukastenSteps();
          },
        }),
        el('span', { className: 'bk-step-idx', text: String(index + 1) }),
        el('span', { className: 'bk-step-type', text: typeLabel(step.type) }),
        el('div', { className: 'bk-step-move' }, [
          el('button', {
            className: 'btn btn-ghost bk-icon',
            type: 'button',
            title: 'Nach oben',
            disabled: index === 0 ? 'true' : undefined,
            text: '↑',
            onClick: (e) => {
              e.stopPropagation();
              moveStep(index, -1);
            },
          }),
          el('button', {
            className: 'btn btn-ghost bk-icon',
            type: 'button',
            title: 'Nach unten',
            disabled: index === draft.steps.length - 1 ? 'true' : undefined,
            text: '↓',
            onClick: (e) => {
              e.stopPropagation();
              moveStep(index, 1);
            },
          }),
          el('button', {
            className: 'btn btn-ghost bk-icon bk-del',
            type: 'button',
            title: 'Löschen',
            text: '✕',
            onClick: (e) => {
              e.stopPropagation();
              deleteStep(index);
            },
          }),
        ]),
      ]),
    );

    const fields = el('div', { className: 'bk-step-fields' });

    fields.appendChild(
      fieldRow('Name', el('input', {
        type: 'text',
        value: step.name,
        onInput: (e) => {
          draft.steps[index].name = e.target.value;
          draft.id = 'custom';
        },
      })),
    );

    const typeSel = el('select');
    for (const t of STEP_TYPES) {
      typeSel.appendChild(
        el('option', {
          value: t.id,
          text: t.label,
          selected: step.type === t.id ? 'true' : undefined,
        }),
      );
    }
    typeSel.addEventListener('change', (e) => {
      const newType = e.target.value;
      const d = stepDefaults(newType);
      draft.steps[index].type = newType;
      draft.steps[index].capacity = d.capacity;
      draft.steps[index].serviceMs = [...d.serviceMs];
      draft.steps[index].booking = d.booking;
      draft.id = 'custom';
      renderBaukastenSteps();
    });
    fields.appendChild(fieldRow('Typ', typeSel));

    fields.appendChild(
      fieldRow(
        'Kapazität',
        el('input', {
          type: 'number',
          min: '1',
          max: '50',
          value: String(step.capacity),
          onInput: (e) => {
            draft.steps[index].capacity = Math.max(1, Number(e.target.value) || 1);
            draft.id = 'custom';
          },
        }),
      ),
    );

    fields.appendChild(
      fieldRow(
        'Service ms (min–max)',
        el('div', { className: 'bk-range' }, [
          el('input', {
            type: 'number',
            min: '50',
            step: '50',
            value: String(step.serviceMs[0]),
            onInput: (e) => {
              draft.steps[index].serviceMs[0] = Math.max(50, Number(e.target.value) || 50);
              draft.id = 'custom';
            },
          }),
          el('span', { text: '–' }),
          el('input', {
            type: 'number',
            min: '50',
            step: '50',
            value: String(step.serviceMs[1]),
            onInput: (e) => {
              draft.steps[index].serviceMs[1] = Math.max(50, Number(e.target.value) || 50);
              draft.id = 'custom';
            },
          }),
        ]),
      ),
    );

    const bookLabel = el('label', { className: 'bk-check' }, [
      el('input', {
        type: 'checkbox',
        checked: step.booking ? 'true' : undefined,
        onChange: (e) => {
          draft.steps[index].booking = !!e.target.checked;
          draft.id = 'custom';
        },
      }),
      el('span', { text: 'Buchungspflicht' }),
    ]);
    fields.appendChild(bookLabel);

    row.appendChild(fields);
    row.addEventListener('click', () => {
      state.selectedStepIndex = index;
      renderBaukastenSteps();
    });
    box.appendChild(row);
  });
}

function fieldRow(label, control) {
  return el('label', { className: 'bk-field' }, [el('span', { text: label }), control]);
}

function moveStep(index, delta) {
  const draft = ensureDraft();
  const target = index + delta;
  if (target < 0 || target >= draft.steps.length) return;
  const tmp = draft.steps[index];
  draft.steps[index] = draft.steps[target];
  draft.steps[target] = tmp;
  draft.id = 'custom';
  state.selectedStepIndex = target;
  renderBaukastenSteps();
  renderTemplateButtons();
}

function deleteStep(index) {
  const draft = ensureDraft();
  draft.steps.splice(index, 1);
  draft.id = 'custom';
  if (state.selectedStepIndex >= draft.steps.length) {
    state.selectedStepIndex = draft.steps.length - 1;
  }
  renderBaukastenSteps();
  renderTemplateButtons();
}

function insertStep() {
  const draft = ensureDraft();
  const typeEl = document.getElementById('bk-insert-type');
  const nameEl = document.getElementById('bk-insert-name');
  const type = typeEl?.value || 'custom';
  const name = (nameEl?.value || '').trim() || `${typeLabel(type)} ${draft.steps.length + 1}`;
  const step = makeStep({ type, name });
  const insertAt =
    state.selectedStepIndex >= 0 ? state.selectedStepIndex + 1 : draft.steps.length;
  draft.steps.splice(insertAt, 0, step);
  draft.id = 'custom';
  state.selectedStepIndex = insertAt;
  if (nameEl) nameEl.value = '';
  renderBaukastenSteps();
  renderTemplateButtons();
  logEvent(`Schritt <strong>${escapeXml(name)}</strong> eingefügt (Entwurf)`);
}

async function applyDraftConfig() {
  const draft = ensureDraft();
  const nameInput = document.getElementById('bk-name');
  if (nameInput) draft.name = nameInput.value.trim() || draft.name || 'Mein Werk';

  // Normalize service ranges
  for (const s of draft.steps) {
    let a = Math.max(50, Number(s.serviceMs[0]) || 50);
    let b = Math.max(50, Number(s.serviceMs[1]) || 50);
    if (b < a) [a, b] = [b, a];
    s.serviceMs = [a, b];
    s.capacity = Math.max(1, Number(s.capacity) || 1);
  }

  state.processConfig = normalizeConfig(draft);
  state.draftConfig = cloneConfig(state.processConfig);
  state.eurPerOrderHour = state.processConfig.costPerOrderHour;
  const eurRate = document.getElementById('eur-rate');
  if (eurRate) eurRate.value = String(state.eurPerOrderHour);

  persistConfig(state.processConfig);

  const title = document.getElementById('process-title');
  if (title) title.textContent = `Prozesskarte · ${state.processConfig.name}`;
  const activeName = document.getElementById('baukasten-active-name');
  if (activeName) activeName.textContent = state.processConfig.name;

  hardResetSimState();
  state.stations = buildStationsFromConfig(state.processConfig, state.scenarioId);
  applyScenario(state.scenarioId, { silent: true, skipRebuild: true });

  renderTemplateButtons();
  renderBaukastenSteps();
  renderStationList();
  updateKpis();

  try {
    await reloadDiagramFromConfig();
    logEvent(
      `Linie <strong>${escapeXml(state.processConfig.name)}</strong> übernommen ` +
        `(${state.processConfig.steps.length} Schritte)`,
    );
  } catch (err) {
    console.error(err);
    logEvent(`BPMN-Fehler: ${err.message || err}`);
  }
}

function hardResetSimState() {
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
  clearHighlights();
}

function exportConfigJson() {
  const cfg = state.draftConfig ? normalizeConfig(ensureDraft()) : state.processConfig;
  const nameInput = document.getElementById('bk-name');
  if (nameInput) cfg.name = nameInput.value.trim() || cfg.name;
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logistik-prozess-${(cfg.id || 'custom').replace(/\W+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  logEvent('Prozess-Konfiguration <strong>exportiert</strong>');
}

function importConfigJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result || ''));
      state.draftConfig = normalizeConfig(parsed);
      state.selectedStepIndex = state.draftConfig.steps.length ? 0 : -1;
      const nameInput = document.getElementById('bk-name');
      if (nameInput) nameInput.value = state.draftConfig.name;
      renderTemplateButtons();
      renderBaukastenSteps();
      logEvent(
        `Import geladen: <strong>${escapeXml(state.draftConfig.name)}</strong> — „Übernehmen“ zum Anwenden`,
      );
    } catch (err) {
      logEvent(`Import fehlgeschlagen: ${err.message || err}`);
    }
  };
  reader.readAsText(file);
}

function applyScenario(id, { silent = false, skipRebuild = false } = {}) {
  const sc = SCENARIOS[id];
  if (!sc) return;
  state.scenarioId = id;
  state.spawnIntervalMs = sc.spawnIntervalMs;
  state.firstServiceMult = sc.firstServiceMult;
  state.crisisChance = sc.crisisChance;

  if (!skipRebuild) {
    state.stations = buildStationsFromConfig(state.processConfig, id);
  } else {
    // capacities already set; re-apply scenario modifiers on current stations from config
    state.stations = buildStationsFromConfig(state.processConfig, id);
  }

  renderScenarioButtons();
  renderStationList();
  updateKpis();
  if (!silent) {
    logEvent(`Szenario <strong>${sc.label}</strong> aktiv`);
  }
}

function wireControls() {
  document.getElementById('btn-start')?.addEventListener('click', () => {
    if (!state.processConfig.steps.length) {
      logEvent('Keine Schritte — bitte im <strong>Baukasten</strong> Stationen anlegen');
      return;
    }
    if (!state.running) startSimulation();
    else if (state.paused) resumeSimulation();
  });

  document.getElementById('btn-pause')?.addEventListener('click', () => {
    if (state.running && !state.paused) pauseSimulation();
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => resetSimulation());

  document.getElementById('btn-batch')?.addEventListener('click', () => {
    if (!state.processConfig.steps.length) {
      logEvent('Keine Schritte vorhanden');
      return;
    }
    for (let i = 0; i < 10; i++) spawnOrder();
    recountStations();
    syncVisuals();
    logEvent('<strong>+10 Aufträge</strong> injiziert');
  });

  document.getElementById('btn-pitch')?.addEventListener('click', () => {
    if (state.pitchActive) stopPitch();
    else startPitch();
  });

  document.getElementById('btn-baukasten-focus')?.addEventListener('click', () => {
    document.getElementById('baukasten-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('baukasten-card')?.classList.add('bk-flash');
    setTimeout(() => document.getElementById('baukasten-card')?.classList.remove('bk-flash'), 1200);
  });

  const speed = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
  speed?.addEventListener('input', () => {
    state.speed = Number(speed.value) || 1;
    if (speedLabel) speedLabel.textContent = `${state.speed}×`;
  });

  document.getElementById('eur-rate')?.addEventListener('change', (e) => {
    const v = Number(e.target.value);
    state.eurPerOrderHour = Number.isFinite(v) && v >= 0 ? v : DEFAULT_EUR_PER_ORDER_HOUR;
    state.processConfig.costPerOrderHour = state.eurPerOrderHour;
    if (state.draftConfig) state.draftConfig.costPerOrderHour = state.eurPerOrderHour;
    persistConfig(state.processConfig);
    updateKpis();
  });

  document.getElementById('bk-name')?.addEventListener('input', (e) => {
    ensureDraft().name = e.target.value;
    ensureDraft().id = 'custom';
  });

  document.getElementById('btn-bk-insert')?.addEventListener('click', () => insertStep());
  document.getElementById('btn-bk-apply')?.addEventListener('click', () => applyDraftConfig());
  document.getElementById('btn-bk-export')?.addEventListener('click', () => exportConfigJson());
  document.getElementById('btn-bk-import')?.addEventListener('click', () => {
    document.getElementById('bk-import-file')?.click();
  });
  document.getElementById('bk-import-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importConfigJson(file);
    e.target.value = '';
  });
}

/* ——— Pitch mode ——— */

function startPitch() {
  state.pitchActive = true;
  state.pitchStep = 0;
  const btn = document.getElementById('btn-pitch');
  if (btn) {
    btn.textContent = 'Pitch beenden';
    btn.classList.add('active');
  }
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
    dots.appendChild(el('span', { className: `pitch-dot${i === index ? ' active' : ''}` }));
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

  if (step.startSim && !state.running && state.processConfig.steps.length) {
    startSimulation();
  }
  // Only auto-switch scenarios when we have steps (custom empty = skip)
  if (state.processConfig.steps.length) {
    if (index === 3 && state.scenarioId === 'normal') {
      applyScenario('peak', { silent: true });
      logEvent('Pitch: Peak-Last für €-Impact');
    }
    if (index === 4) {
      applyScenario('kapazitaet', { silent: true });
      logEvent('Pitch: Kapazität+ zur Entlastung');
    }
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

  if (!state.stations.length) {
    list.appendChild(
      el('div', {
        className: 'bk-empty',
        text: 'Keine Stationen — Linie im Baukasten konfigurieren.',
      }),
    );
    return;
  }

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
        el('span', { html: `Typ: <strong>${typeLabel(s.type)}</strong>${s.booking ? ' · Buchung' : ''}` }),
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
  const noSteps = !state.processConfig.steps.length;
  if (btnStart && btnPause) {
    if (noSteps) {
      btnStart.textContent = 'Start';
      btnStart.disabled = true;
      btnPause.disabled = true;
    } else if (!state.running) {
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
  for (const s of state.stations) {
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
      if (i === 0 && Math.random() < state.crisisChance) {
        service *= 2.5;
      }
      o.remainingMs = service;
    }
  }
}

function spawnOrder() {
  if (!state.stations.length) return;
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
  if (mustWait && station.capacity <= 2) {
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
    if (state.orders.size < 50 && state.stations.length) spawnOrder();
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
  if (!state.stations.length) return;
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
  hardResetSimState();
  applyScenario(state.scenarioId, { silent: true });
  recountStations();
  renderStationList();
  updateKpis();
  const box = document.getElementById('event-log');
  if (box) box.innerHTML = '';
  logEvent('Simulation <strong>zurückgesetzt</strong>');
  syncVisuals();
}

async function ensureViewer() {
  const canvasEl = document.getElementById('canvas');
  if (!canvasEl) return null;
  if (state.viewer) return state.viewer;

  canvasEl.innerHTML = '';
  const viewer = new NavigatedViewer({ container: canvasEl });
  state.viewer = viewer;
  state.canvas = viewer.get('canvas');
  state.elementRegistry = viewer.get('elementRegistry');
  state.overlaysApi = viewer.get('overlays');
  return viewer;
}

async function reloadDiagramFromConfig() {
  const viewer = await ensureViewer();
  if (!viewer) return;
  state.overlays.clear();
  const xml = generateBpmnXml(state.processConfig);
  await viewer.importXML(xml);
  state.canvas = viewer.get('canvas');
  state.elementRegistry = viewer.get('elementRegistry');
  state.overlaysApi = viewer.get('overlays');
  state.canvas.zoom('fit-viewport', 'auto');
  syncVisuals();
}

async function loadDiagram() {
  await reloadDiagramFromConfig();
  logEvent(
    `BPMN für <strong>${escapeXml(state.processConfig.name)}</strong> generiert ` +
      `(${state.processConfig.steps.length} Stationen)`,
  );
}

async function main() {
  const stored = loadStoredConfig();
  if (stored) {
    state.processConfig = stored;
    state.eurPerOrderHour = stored.costPerOrderHour;
  } else {
    state.processConfig = cloneConfig(TEMPLATES.kfz);
    state.eurPerOrderHour = state.processConfig.costPerOrderHour;
  }

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
