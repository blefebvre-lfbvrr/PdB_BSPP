import { TABS, SIGNES_DETRESSE, SURV_FIELDS, SURV_EVOLUTION, LESION_SIGNES, has, hasSome, fmtTime } from './schema.js';
import {
  buildReport, computeAge, detresseStatus, expandFields, formatTA, gcsTotal, identiteRows, infoValue, isVisible, suggestions, victimSummary,
} from './report.js';

// ---------------------------------------------------------------------------
// Bilans (un par victime), gardés uniquement dans le navigateur du téléphone.
// Clés propres à cette application (même origine que « Prise de bilans » sur GitHub Pages).
// ---------------------------------------------------------------------------
const STORE_KEY = 'pdb-bspp:bilans';

function defaults() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date_pec: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    sat_sous: 'AA',
    gly_unite: 'g/L',
  };
}

function newBilan(store) {
  store.seq = (store.bilans.length ? store.seq || 0 : 0) + 1;
  return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, n: store.seq, tab: 0, state: defaults() };
}

function loadStore() {
  let store = null;
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { /* stockage indisponible */ }
  if (!store || !Array.isArray(store.bilans) || !store.bilans.length) {
    store = { seq: 0, bilans: [] };
    const b = newBilan(store);
    store.bilans.push(b);
    store.activeId = b.id;
  }
  if (!store.bilans.some((b) => b.id === store.activeId)) store.activeId = store.bilans[0].id;
  return store;
}

const store = loadStore();
const activeBilan = () => store.bilans.find((b) => b.id === store.activeId);
let state = activeBilan().state;

let saveTimer;
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* ignoré */ }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

// name -> fonctions de mise à jour de l'affichage
const bindings = new Map();
const bind = (name, fn) => {
  if (!bindings.has(name)) bindings.set(name, []);
  bindings.get(name).push(fn);
  fn(state[name]);
};
const rebindAll = () => bindings.forEach((fns, name) => fns.forEach((fn) => fn(state[name])));
// éléments dont la visibilité dépend de l'état
const conditionals = [];
// alertes et lignes calculées : { el, fn }
const infos = [];

function setValue(name, v, { silent = false } = {}) {
  if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) delete state[name];
  else state[name] = v;
  if (name === 'ddn') {
    const age = computeAge(v);
    if (age !== '') setValue('age', age, { silent: true });
  }
  (bindings.get(name) || []).forEach((fn) => fn(state[name]));
  if (!silent) refresh({ animate: true });
}

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

// ---------------------------------------------------------------------------
// Rendu des champs
// ---------------------------------------------------------------------------
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
};

// Rejoue une animation CSS sur un élément.
function play(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

let uid = 0;

function optButton(label, extraClass, onClick) {
  const b = h('button', { type: 'button', class: `opt ${extraClass || ''}`, 'aria-pressed': 'false' }, label);
  b.addEventListener('click', () => { play(b, 'just'); onClick(); });
  return b;
}

function renderSegmented(f, opts) {
  const seg = h('div', { class: `seg${f.vertical ? ' vertical' : ''}${f.cols2 ? ' grid2' : ''}`, role: 'group' });
  const buttons = opts.map((o) => {
    const b = optButton(o.l, o.cls, () => setValue(f.name, state[f.name] === o.v ? '' : o.v));
    b.dataset.v = o.v;
    seg.append(b);
    return b;
  });
  bind(f.name, (v) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))));
  return seg;
}

function renderChecks(f) {
  const seg = h('div', { class: `seg checks${f.big ? ' big' : ''}${f.cols2 ? ' grid2' : ''}`, role: 'group' });
  const buttons = f.options.map((o) => {
    const b = optButton(o.l, '', () => {
      let cur = [...(state[f.name] || [])];
      if (cur.includes(o.v)) cur = cur.filter((x) => x !== o.v);
      else if (o.exclusive) cur = [o.v];
      else cur = [...cur.filter((x) => !f.options.find((p) => p.v === x)?.exclusive), o.v];
      setValue(f.name, cur);
    });
    b.dataset.v = o.v;
    if (o.show) conditionals.push({ el: b, item: o });
    seg.append(b);
    return b;
  });
  bind(f.name, (v) => buttons.forEach((b) => b.setAttribute('aria-pressed', String((v || []).includes(b.dataset.v)))));
  return seg;
}

function renderInput(f, id) {
  let el;
  if (f.type === 'textarea') {
    el = h('textarea', { id, rows: 3, placeholder: f.placeholder, autocapitalize: 'sentences' });
  } else {
    el = h('input', {
      id,
      type: f.type === 'text' ? 'text' : f.type,
      placeholder: f.placeholder,
      inputmode: f.type === 'number' ? (f.step ? 'decimal' : 'numeric') : f.inputmode,
      step: f.step,
      min: f.min,
      max: f.max,
      autocomplete: 'off',
      autocapitalize: f.autocap || (f.type === 'text' ? 'sentences' : undefined),
    });
  }
  el.addEventListener('input', (e) => {
    if (f.ta) {
      const v = formatTA(el.value, e.inputType?.startsWith('delete'));
      if (v !== el.value) el.value = v;
    }
    setValue(f.name, el.value);
  });
  bind(f.name, (v) => {
    const next = v === undefined ? '' : String(v);
    if (el.value !== next) el.value = next;
    el.classList.toggle('filled', next !== '');
  });
  return el;
}

// Bouton « Maintenant » : met l'heure du moment, ou l'ajoute à la suite (heures des chocs…).
function nowButton(f) {
  const append = f.now === 'append';
  return h('button', {
    type: 'button',
    class: 'btn mini btn-side',
    onclick: (e) => {
      play(e.currentTarget, 'just');
      if (!append) return setValue(f.name, nowHHMM());
      const cur = String(state[f.name] || '').trim();
      setValue(f.name, cur ? `${cur.replace(/[,\s]+$/, '')}, ${fmtTime(nowHHMM())}` : fmtTime(nowHHMM()));
    },
  }, append ? '+ Maintenant' : 'Maintenant');
}

// Ligne d'alerte ou de calcul, mise à jour à chaque saisie.
function infoLine(fn) {
  const p = h('p', { class: 'info', hidden: true, role: 'status' });
  infos.push({ el: p, fn });
  return p;
}

// Couleur de l'EVA : du vert (0) au rouge (10).
const evaColor = (i) => `hsl(${Math.round(140 - i * 14)} 62% 40%)`;

function renderField(f) {
  if (f.type === 'subtitle') {
    const el = h('h3', {}, f.label);
    if (f.show) conditionals.push({ el, item: f });
    return el;
  }

  const id = `f-${f.name || 'x'}-${uid++}`;
  let wrap;

  switch (f.type) {
    case 'tri':
      wrap = h('div', { class: 'field tri' },
        h('span', { class: 'label' }, f.label),
        renderSegmented(f, [{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non', cls: 'no' }]));
      break;
    case 'radio':
    case 'select':
      wrap = h('div', { class: 'field' }, f.label ? h('span', { class: 'label' }, f.label) : null, renderSegmented(f, f.options));
      break;
    case 'checks':
      wrap = h('div', { class: 'field' }, f.label ? h('span', { class: 'label' }, f.label) : null, renderChecks(f));
      break;
    case 'eva': {
      const seg = renderSegmented(f, Array.from({ length: 11 }, (_, i) => ({ v: String(i), l: String(i) })));
      seg.querySelectorAll('.opt').forEach((b, i) => b.style.setProperty('--eva-c', evaColor(i)));
      wrap = h('div', { class: 'field eva' }, h('span', { class: 'label' }, `${f.label} (EN /10)`), seg);
      break;
    }
    case 'gcs':
      wrap = renderGcs();
      break;
    case 'surveillance':
      wrap = renderSurveillance(f);
      break;
    case 'lesions':
      wrap = renderLesions(f);
      break;
    case 'counts':
      wrap = renderCounts(f);
      break;
    case 'preset':
      wrap = h('div', { class: 'field preset' }, h('button', {
        type: 'button',
        class: 'btn mini',
        onclick: (e) => {
          play(e.currentTarget, 'just');
          for (const [k, v] of Object.entries(f.set)) setValue(k, v, { silent: true });
          refresh({ animate: true });
        },
      }, `✓ ${f.label}`));
      break;
    case 'info':
      wrap = h('div', { class: 'field-info' }, infoLine(f.calc));
      break;
    default: {
      const input = renderInput(f, id);
      let control = input;
      if (f.suffix) control = h('div', { class: 'with-suffix' }, input, h('span', {}, f.suffix));
      if (f.none || f.now) {
        const side = f.now ? nowButton(f)
          : h('button', { type: 'button', class: 'btn mini btn-side', onclick: () => setValue(f.name, f.none) }, f.none);
        control = h('div', { class: 'with-side' }, control, side);
      }
      wrap = h('div', { class: 'field' }, h('label', { for: id }, f.label), control);
    }
  }
  if (f.help) wrap.append(h('div', { class: 'help' }, f.help));
  if (f.warn) wrap.append(infoLine(f.warn));
  if (f.show) conditionals.push({ el: wrap, item: f });
  return wrap;
}

// Glasgow : chaque cotation avec son libellé.
const GCS = [
  ['gcs_y', 'Yeux', ['Aucune', 'À la douleur', 'À la demande', 'Spontanée']],
  ['gcs_v', 'Verbal', ['Aucune', 'Incompréhensible', 'Inappropriée', 'Confuse', 'Orientée']],
  ['gcs_m', 'Moteur', ['Aucune', 'Décérébration', 'Décortication', 'Évitement non adapté', 'Orientée à la douleur', 'À la demande']],
];

function renderGcs() {
  const sel = ([name, label, items]) => {
    const s = h('select', { id: `f-${name}` }, h('option', { value: '' }, '–'),
      ...items.map((_, i) => items.length - i).map((n) => h('option', { value: String(n) }, `${n} · ${items[n - 1]}`)));
    s.addEventListener('change', () => setValue(name, s.value));
    bind(name, (v) => { s.value = v ?? ''; });
    return h('div', {}, h('label', { for: `f-${name}` }, label), s);
  };
  const total = h('div', { class: 'total' }, '–');
  const set15 = h('button', { type: 'button', class: 'btn mini', onclick: () => {
    setValue('gcs_y', '4', { silent: true });
    setValue('gcs_v', '5', { silent: true });
    setValue('gcs_m', '6');
  } }, 'Glasgow 15');
  const upd = () => {
    const t = gcsTotal(state);
    total.textContent = t ? `= ${t}` : '–';
    total.classList.toggle('full', t === 15);
    total.classList.toggle('low', !!t && t < 15);
  };
  GCS.forEach(([n]) => bind(n, upd));
  return h('div', { class: 'field' },
    h('div', { class: 'tri' }, h('span', { class: 'label' }, 'Glasgow'), set15),
    h('div', { class: 'gcs' }, ...GCS.map(sel), total));
}

// Petits compteurs (nombre de victimes : impliqués, UR, UA, décédés).
function renderCounts(f) {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, f.label),
    h('div', { class: 'counts' }, ...f.items.map((it) => {
      const id = `f-${it.k}-${uid++}`;
      const inp = renderInput({ type: 'number', name: it.k }, id);
      return h('div', { class: 'count' }, h('label', { for: id }, it.l), inp);
    })));
}

// Action en deux appuis (les boîtes confirm() ne s'affichent pas partout).
function twoStep(btn, armedLabel, action) {
  const label = btn.textContent;
  let timer;
  btn.addEventListener('click', () => {
    if (!timer) {
      btn.textContent = armedLabel;
      btn.classList.add('armed');
      timer = setTimeout(() => { timer = null; btn.textContent = label; btn.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(timer);
    timer = null;
    btn.textContent = label;
    btn.classList.remove('armed');
    action();
  });
}

// Mini sélecteur dans une fiche (surveillance, lésion) : un choix ou aucun.
function miniSeg(options, get, set) {
  const seg = h('div', { class: 'seg', role: 'group' });
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', class: `opt ${o.cls || ''}`, 'aria-pressed': String(get() === o.v) }, o.l);
    b.addEventListener('click', () => {
      set(get() === o.v ? undefined : o.v);
      buttons.forEach((x, i) => x.setAttribute('aria-pressed', String(get() === options[i].v)));
      play(b, 'just');
      refresh();
    });
    seg.append(b);
    return b;
  });
  return seg;
}

// Liste de fiches (séries de surveillance, lésions) gardée dans state[name].
function renderList(f, { addLabel, emptyLabel, newEntry, card, before }) {
  const list = h('div', { class: 'surv-list' });
  const empty = h('p', { class: 'surv-empty' }, emptyLabel);
  const add = h('button', { type: 'button', class: 'btn primary block' }, addLabel);
  const entries = () => state[f.name] || (state[f.name] = []);

  function draw(focusLast) {
    const arr = state[f.name] || [];
    list.replaceChildren(...arr.map((e, i) => {
      const del = h('button', { type: 'button', class: 'btn mini danger' }, 'Supprimer');
      twoStep(del, 'Confirmer', () => { entries().splice(i, 1); draw(); refresh(); });
      return card(e, i, del);
    }));
    empty.hidden = arr.length > 0;
    const c = list.lastElementChild;
    if (focusLast && c) {
      play(c, 'reveal');
      c.scrollIntoView({ block: 'center', behavior: 'smooth' });
      c.querySelector('input')?.focus({ preventScroll: true });
    }
  }

  add.addEventListener('click', () => {
    entries().push(newEntry());
    draw(true);
    refresh();
  });
  bind(f.name, () => draw());
  return h('div', { class: 'field surv' }, before || null, list, empty, add);
}

function renderSurveillance(f) {
  const ref = h('div', { class: 'surv-ref' });
  updateSurvRef = () => renderSurvRef(ref);
  return renderList(f, {
    addLabel: '+ Nouvelle série de constantes',
    emptyLabel: 'Aucun contrôle pour l’instant.',
    newEntry: () => ({ heure: nowHHMM(), sat_sous: state.sat_sous === 'O2' ? 'O2' : 'AA' }),
    before: ref,
    card(e, i, del) {
      const time = h('input', { type: 'time', 'aria-label': `Heure du contrôle ${i + 1}` });
      time.value = e.heure || '';
      time.addEventListener('input', () => { e.heure = time.value; refresh(); });

      const grid = h('div', { class: 'surv-grid' }, ...SURV_FIELDS.map((sf) => {
        const id = `surv-${i}-${sf.k}-${uid++}`;
        const inp = h('input', { id, type: 'text', inputmode: sf.mode, placeholder: sf.placeholder, autocomplete: 'off' });
        inp.value = e[sf.k] ?? '';
        inp.addEventListener('input', (ev) => {
          if (sf.ta) {
            const v = formatTA(inp.value, ev.inputType?.startsWith('delete'));
            if (v !== inp.value) inp.value = v;
          }
          e[sf.k] = inp.value;
          refresh();
        });
        const unit = sf.k === 'gly' ? state.gly_unite || 'g/L' : sf.suffix;
        return h('div', { class: 'surv-field' },
          h('label', { for: id }, sf.l, unit ? h('span', { class: 'unit' }, ` ${unit}`) : null), inp);
      }));

      const o2 = h('button', { type: 'button', class: 'opt', 'aria-pressed': String(e.sat_sous === 'O2') }, 'SpO2 sous O2');
      o2.addEventListener('click', () => {
        e.sat_sous = e.sat_sous === 'O2' ? 'AA' : 'O2';
        o2.setAttribute('aria-pressed', String(e.sat_sous === 'O2'));
        play(o2, 'just');
        refresh();
      });
      const evo = miniSeg(SURV_EVOLUTION.map((o, k) => ({ ...o, cls: k === 2 ? 'bad' : '' })), () => e.evolution, (v) => { e.evolution = v; });
      const note = h('textarea', { rows: 2, placeholder: 'Remarque : évolution, plainte, geste…', 'aria-label': `Remarque du contrôle ${i + 1}` });
      note.value = e.note || '';
      note.addEventListener('input', () => { e.note = note.value; refresh(); });

      return h('article', { class: 'surv-card' },
        h('header', {}, h('span', { class: 'surv-n' }, `Contrôle ${i + 1}`), time),
        grid, h('div', { class: 'surv-extra' }, o2, del), h('div', { class: 'evo' }, evo), note);
    },
  });
}

// Rappel des constantes du bilan initial (étapes B, C, D), pour suivre l'évolution.
let updateSurvRef = () => {};
function renderSurvRef(el) {
  const s = state;
  const parts = [
    s.fr && `FR ${s.fr}`,
    s.sat && `SpO2 ${s.sat} %${s.sat_sous === 'O2' ? ' O2' : ''}`,
    s.fc && `FC ${s.fc}`,
    s.ta_d && `TAD ${s.ta_d}`,
    s.ta_g && `TAG ${s.ta_g}`,
    gcsTotal(s) && `Glasgow ${gcsTotal(s)}`,
    s.temp && `${s.temp}°`,
    s.gly && `Gly ${s.gly}`,
  ].filter(Boolean);
  el.replaceChildren(
    h('div', { class: 'surv-ref-head' },
      h('span', {}, 'Bilan initial'),
      h('span', { class: 'surv-ref-time' }, s.heure_pec ? s.heure_pec.replace(':', 'h') : '')),
    parts.length
      ? h('div', { class: 'surv-ref-vals' }, ...parts.map((p) => h('span', { class: 'chip' }, p)))
      : h('p', { class: 'surv-ref-empty' }, 'Constantes à saisir aux étapes B, C et D.'));
}

// Lésions du bilan traumatique : une fiche par zone.
function renderLesions(f) {
  return renderList(f, {
    addLabel: '+ Ajouter une lésion',
    emptyLabel: 'Aucune lésion notée.',
    newEntry: () => ({}),
    card(e, i, del) {
      const zid = `les-${i}-${uid++}`;
      const zone = h('input', { id: zid, type: 'text', placeholder: 'poignet, genou, épaule…', autocomplete: 'off', autocapitalize: 'none' });
      zone.value = e.zone || '';
      zone.addEventListener('input', () => { e.zone = zone.value; refresh(); });
      const cote = miniSeg([{ v: 'g', l: 'Gauche' }, { v: 'd', l: 'Droit' }], () => e.cote, (v) => { e.cote = v; });

      const signes = h('div', { class: 'seg checks' }, ...LESION_SIGNES.map((o) => {
        const b = h('button', { type: 'button', class: 'opt', 'aria-pressed': String((e.signes || []).includes(o.v)) }, o.l);
        b.addEventListener('click', () => {
          const cur = new Set(e.signes || []);
          if (cur.has(o.v)) cur.delete(o.v); else cur.add(o.v);
          e.signes = LESION_SIGNES.map((x) => x.v).filter((v) => cur.has(v));
          b.setAttribute('aria-pressed', String(cur.has(o.v)));
          play(b, 'just');
          refresh();
        });
        return b;
      }));

      const eid = `les-${i}-eva-${uid++}`;
      const eva = h('input', { id: eid, type: 'text', inputmode: 'numeric', placeholder: '0 à 10', autocomplete: 'off' });
      eva.value = e.eva ?? '';
      eva.addEventListener('input', () => { e.eva = eva.value; refresh(); });
      const distal = miniSeg([{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non', cls: 'no' }], () => e.distal, (v) => { e.distal = v; });
      const note = h('textarea', { rows: 2, placeholder: 'Autres constatations', 'aria-label': `Remarque de la lésion ${i + 1}` });
      note.value = e.note || '';
      note.addEventListener('input', () => { e.note = note.value; refresh(); });

      return h('article', { class: 'surv-card lesion' },
        h('header', {}, h('span', { class: 'surv-n' }, `Lésion ${i + 1}`), del),
        h('div', { class: 'field' }, h('label', { for: zid }, 'Zone'), zone),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Côté'), cote),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Constatations'), signes),
        h('div', { class: 'field' }, h('label', { for: eid }, 'Douleur (EN /10)'), eva),
        h('div', { class: 'field tri' }, h('span', { class: 'label' }, 'Motricité, sensibilité, pouls, TRC, chaleur en aval'), distal),
        note);
    },
  });
}

// Aide-mémoire repliable (mémo urgence, mémo bilans spécifiques).
function renderMemo(items) {
  const body = h('div', { class: 'memo-body' });
  for (const it of items) {
    if (typeof it === 'string') body.append(h('p', {}, it));
    else if (it.h) body.append(h('h4', {}, it.h));
    else if (it.ul) body.append(h('ul', {}, ...it.ul.map((x) => h('li', {}, x))));
    else if (it.table) {
      body.append(h('table', {}, ...it.table.map((row, r) =>
        h('tr', {}, ...row.map((c) => h(r === 0 && !it.nohead ? 'th' : 'td', {}, c))))));
    }
  }
  return h('details', { class: 'memo' }, h('summary', {}, 'Aide-mémoire'), body);
}

// Signes de détresse d'une lettre : bloc rouge si un signe est coché, vert si « aucun ».
const sdBlocks = [];
const suggestBoxes = [];
function renderSdField(f, section) {
  const el = renderField(f);
  el.classList.add('sd-block');
  sdBlocks.push({ el, name: f.name });
  section.append(el);
  const box = h('div', { class: 'suggest', hidden: true });
  suggestBoxes.push({ el: box, group: f.name });
  section.append(box);
}

function renderGroup(g) {
  const title = g.letter
    ? h('h2', {}, h('span', { class: 'lt', 'aria-hidden': 'true' }, g.letter), g.title)
    : h('h2', {}, g.title);
  const section = h('section', { class: `group${g.spe ? ' spe' : ''}${g.letter ? ' lettre' : ''}` }, title);
  if (g.hint) [].concat(g.hint).forEach((line) => section.append(h('p', { class: 'hint' }, line)));
  for (const f of expandFields(g.fields)) {
    if (f.sd) renderSdField(f, section);
    else section.append(renderField(f));
  }
  if (g.memo) section.append(renderMemo(g.memo));
  if (g.spe || g.show) {
    conditionals.push({ el: section, item: { show: (s) => (!g.spe || has(s, 'spe', g.spe)) && isVisible(g, s) } });
  }
  return section;
}

// ---------------------------------------------------------------------------
// Étapes : S · X · A · B · C · D en lettres, puis les autres en icônes.
// ---------------------------------------------------------------------------
const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const RAIL = {
  // ­ : coupure possible du nom sur deux lignes si la barre est étroite.
  situation: { short: 'Situation', letter: 'S', k: 's' },
  x: { short: 'Hémor­ragie', letter: 'X', k: 'x' },
  a: { short: 'Voies aé­riennes', letter: 'A', k: 'a' },
  b: { short: 'Respi­ration', letter: 'B', k: 'b' },
  c: { short: 'Circu­lation', letter: 'C', k: 'c' },
  d: { short: 'Neuro', letter: 'D', k: 'd' },
  complementaire: { short: 'Bilan compl.', icon: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/>' },
  gestes: { short: 'Gestes', icon: '<path d="M18 11V6a2 2 0 0 0-4 0v1"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>' },
  surveillance: { short: 'Surveil­lance', icon: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>' },
  identite: { short: 'Identité', icon: '<rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16.5a3 3 0 0 1 6 0"/><path d="M15 10h3"/><path d="M15 14h3"/>' },
  bilan: { short: 'Bilan', icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>' },
};
const ALL_TABS = [...TABS.map((t) => ({ id: t.id, title: t.letter ? `${t.letter} · ${t.title}` : t.title })), { id: 'bilan', title: 'Bilan' }];
const SD_OF_TAB = { x: 'sd_x', a: 'sd_a', b: 'sd_b', c: 'sd_c', d: 'sd_d' };
const TAB_DONE = {
  situation: (s) => !!(s.motif || s.plainte || s.histoire),
  x: (s) => (s.sd_x || []).length > 0,
  a: (s) => (s.sd_a || []).length > 0,
  b: (s) => (s.sd_b || []).length > 0 && !!s.fr && !!s.sat,
  c: (s) => (s.sd_c || []).length > 0 && (has(s, 'sd_c', 'acr') || (!!s.fc && !!(s.ta_d || s.ta_g))),
  d: (s) => (s.sd_d || []).length > 0 && !!gcsTotal(s),
  complementaire: (s) => !!(s.allergies && s.traitements && s.atcd),
  gestes: (s) => !!s.devenir,
  surveillance: (s) => (s.surv || []).length > 0,
  identite: (s) => !!(s.nom || s.prenom),
};
// La surveillance est facultative : elle ne compte pas dans la progression.
const PROGRESS_TABS = Object.keys(TAB_DONE).filter((id) => id !== 'surveillance');
let current = 0;

// Icône d'étape : la lettre (S, X, A…) ou un pictogramme.
function railIcon(r) {
  if (r.letter) return h('span', { class: 'ico letter' }, r.letter);
  const ico = h('span', { class: 'ico' });
  ico.innerHTML = svg(r.icon);
  return ico;
}

function renderTabs() {
  const nav = document.getElementById('tabs');
  const panels = document.getElementById('panels');
  ALL_TABS.forEach((t, i) => {
    const r = RAIL[t.id];
    const ico = railIcon(r);
    ico.append(h('span', { class: 'tick', 'aria-hidden': 'true' }));
    const tab = h('button', {
      type: 'button', class: 'tab', role: 'tab', id: `tab-${t.id}`, 'aria-controls': `panel-${t.id}`,
      'aria-label': `${i + 1}. ${t.title}`, onclick: () => { if (!scrub.justEnded) go(i); },
    }, ico, h('span', { class: 'lbl' }, r.short));
    if (r.k) tab.style.cssText = `--c: var(--c-${r.k}); --ink: var(--ink-${r.k})`;
    nav.append(tab);
  });
  for (const t of TABS) {
    const panel = h('section', { class: 'panel', id: `panel-${t.id}`, role: 'tabpanel', hidden: true });
    const r = RAIL[t.id];
    if (r.k) panel.style.cssText = `--c: var(--c-${r.k}); --ink: var(--ink-${r.k})`;
    t.groups.forEach((g) => panel.append(renderGroup(g)));
    panels.append(panel);
  }
}

// ---------------------------------------------------------------------------
// Vibration légère au changement d'étape. Android : API de vibration standard.
// iPhone (pas d'API de vibration) : Safari fait vibrer quand on bascule un
// interrupteur natif <input type="checkbox" switch> ; on en bascule un, caché.
// ---------------------------------------------------------------------------
let hapticLabel = null;
function haptic() {
  if (typeof navigator.vibrate === 'function') { navigator.vibrate(8); return; }
  if (!hapticLabel) {
    hapticLabel = h('label', { class: 'haptic', 'aria-hidden': 'true' },
      h('input', { type: 'checkbox', switch: true, tabindex: '-1' }));
    document.body.append(hapticLabel);
  }
  hapticLabel.click();
}

// ---------------------------------------------------------------------------
// Glisser le doigt sur la barre de gauche : l'étape sous le doigt s'ouvre en direct
// (comme l'index des Contacts), avec une bulle indiquant l'étape survolée.
// ---------------------------------------------------------------------------
const scrub = {
  id: null, startY: 0, y: 0, active: false, justEnded: false,
  rects: null, raf: 0, shown: -1, half: 0, reportTimer: 0, target: 0, panelTimer: 0,
  bubble: null, inner: null, icon: null, label: null,
};

// Positions des étapes mesurées une seule fois au début du geste (elles ne bougent pas).
function tabIndexAt(y) {
  const r = scrub.rects;
  if (y <= r[0].top) return 0;
  for (let i = 0; i < r.length; i++) if (y < r[i].bottom + 1) return i;
  return r.length - 1;
}

function placeBubble(i, y) {
  if (scrub.shown !== i) {
    scrub.shown = i;
    const r = RAIL[ALL_TABS[i].id];
    scrub.icon.replaceChildren(railIcon(r));
    scrub.icon.style.cssText = r.k ? `--c: var(--c-${r.k})` : '';
    scrub.label.textContent = ALL_TABS[i].title;
    scrub.icon.firstChild.animate?.(
      [{ transform: 'scale(.6)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' },
    );
  }
  const r = scrub.rects;
  const top = Math.min(Math.max(y, r[0].top + scrub.half), r[r.length - 1].bottom - scrub.half) - scrub.half;
  // Déplacement par transform (calculé par la carte graphique, sans recalcul de la page).
  scrub.bubble.style.transform = `translate3d(0, ${top}px, 0)`;
}

// Bulle et pastille suivent le doigt à chaque image ; la page de droite, plus lourde,
// suit au plus toutes les 70 ms (toujours sur l'étape sous le doigt).
function scrubFrame() {
  scrub.raf = 0;
  const i = tabIndexAt(scrub.y);
  if (i !== scrub.target) {
    scrub.target = i;
    moveIndicator(i);
    ALL_TABS.forEach((t, j) => document.getElementById(`tab-${t.id}`).setAttribute('aria-selected', String(j === i)));
    haptic();
    if (!scrub.panelTimer) scrub.panelTimer = setTimeout(syncScrubPanel, 70);
  }
  placeBubble(i, scrub.y);
}

function syncScrubPanel() {
  scrub.panelTimer = 0;
  if (scrub.target !== current) go(scrub.target, 'scrub');
}

function setupRailScrub() {
  const rail = $('tabs');
  scrub.icon = h('span', { class: 'scrub-icon' });
  scrub.label = h('span', { class: 'scrub-label' });
  scrub.inner = h('div', { class: 'scrub-inner' }, scrub.icon, scrub.label);
  scrub.bubble = h('div', { class: 'scrub-bubble', 'aria-hidden': 'true' }, scrub.inner);
  document.body.append(scrub.bubble);

  rail.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    scrub.id = e.pointerId;
    scrub.startY = e.clientY;
    scrub.active = false;
  });
  rail.addEventListener('pointermove', (e) => {
    if (e.pointerId !== scrub.id) return;
    if (!scrub.active) {
      if (Math.abs(e.clientY - scrub.startY) < 6) return;
      scrub.active = true;
      rail.setPointerCapture(e.pointerId);
      scrub.rects = [...rail.querySelectorAll('.tab')].map((tab) => tab.getBoundingClientRect());
      scrub.shown = -1;
      scrub.target = current;
      document.body.classList.add('scrubbing');
      scrub.bubble.classList.add('show');
      scrub.half = scrub.inner.offsetHeight / 2;
    }
    scrub.y = e.clientY;
    if (!scrub.raf) scrub.raf = requestAnimationFrame(scrubFrame);
  }, { passive: true });
  const end = (e) => {
    if (e.pointerId !== scrub.id) return;
    scrub.id = null;
    if (!scrub.active) return;
    scrub.active = false;
    if (scrub.raf) { cancelAnimationFrame(scrub.raf); scrubFrame(); }
    clearTimeout(scrub.panelTimer);
    syncScrubPanel();
    // Le relâchement déclenche un « click » sur l'étape d'origine : on l'ignore.
    scrub.justEnded = true;
    setTimeout(() => { scrub.justEnded = false; }, 350);
    document.body.classList.remove('scrubbing');
    scrub.bubble.classList.remove('show');
    if (ALL_TABS[current].id === 'bilan') { clearTimeout(scrub.reportTimer); renderReport(); }
  };
  rail.addEventListener('pointerup', end);
  rail.addEventListener('pointercancel', end);
}

// Noms d'étapes jamais coupés : si l'un dépasse (selon le modèle et la police du
// téléphone), on réduit la taille de tous les noms jusqu'à ce que chacun tienne.
function fitRailLabels() {
  const rail = $('tabs');
  const labels = [...rail.querySelectorAll('.lbl')].filter((l) => l.offsetParent);
  rail.style.removeProperty('--rail-font-fit');
  if (!labels.length) return;
  const overflows = () => labels.some((l) => l.scrollWidth > l.clientWidth + 0.5 || l.scrollHeight > l.clientHeight + 0.5);
  let size = parseFloat(getComputedStyle(labels[0]).fontSize);
  while (overflows() && size > 7) {
    size -= 0.25;
    rail.style.setProperty('--rail-font-fit', `${size}px`);
  }
}

// Pastille qui glisse sous l'étape active, à la couleur de sa lettre.
function moveIndicator(i = current) {
  const rail = $('tabs');
  const r = RAIL[ALL_TABS[i].id];
  rail.style.setProperty('--n', String(ALL_TABS.length));
  rail.style.setProperty('--i', String(i));
  rail.style.setProperty('--ind', r.k ? `var(--c-${r.k})` : 'var(--accent)');
  rail.style.setProperty('--ind-ink', r.k ? `var(--ink-${r.k})` : 'var(--accent-ink)');
}

function go(i, how) {
  const next = Math.max(0, Math.min(ALL_TABS.length - 1, i));
  // Vibration pour un changement voulu (appui sur une étape, Précédent / Suivant) ;
  // pendant le glissement, elle est déjà donnée à chaque étape survolée.
  if (!how && next !== current) haptic();
  const scrubbing = how === 'scrub';
  const anim = scrubbing ? null : how || (next > current ? 'from-below' : next < current ? 'from-above' : null);
  current = next;
  ALL_TABS.forEach((t, j) => {
    document.getElementById(`tab-${t.id}`).setAttribute('aria-selected', String(j === current));
    document.getElementById(`panel-${t.id}`).hidden = j !== current;
  });
  const panel = document.getElementById(`panel-${ALL_TABS[current].id}`);
  if (anim) play(panel, anim);
  // Pendant le glissement : simple fondu, très léger pour suivre le doigt.
  else if (scrubbing) panel.animate?.([{ opacity: 0.45 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
  moveIndicator();

  document.getElementById('btn-prev').disabled = current === 0;
  const last = current === ALL_TABS.length - 1;
  document.getElementById('btn-next').textContent = last
    ? 'Enregistrer'
    : `${ALL_TABS[current + 1].title} ›`;
  if (ALL_TABS[current].id === 'bilan') {
    // L'écran Bilan est le plus long à construire : pendant le glissement, seulement
    // si le doigt s'y arrête un instant.
    if (scrubbing) { clearTimeout(scrub.reportTimer); scrub.reportTimer = setTimeout(renderReport, 120); } else renderReport();
  }
  $('main').scrollTo({ top: 0 });
  activeBilan().tab = current;
  save();
}

// ---------------------------------------------------------------------------
// Mise à jour de l'affichage
// ---------------------------------------------------------------------------
function updateInfos() {
  for (const { el, fn } of infos) {
    const r = infoValue(fn(state));
    el.hidden = !r;
    if (!r) continue;
    el.className = `info ${r.level === 'info' ? 'note' : r.level || 'warn'}`;
    if (el.textContent !== r.text) el.textContent = r.text;
  }
}

function refresh({ animate = false } = {}) {
  for (const { el, item } of conditionals) {
    const visible = isVisible(item, state);
    if (animate && visible && el.hidden) play(el, 'reveal');
    el.hidden = !visible;
  }
  for (const { el, name } of sdBlocks) {
    const v = state[name] || [];
    el.classList.toggle('is-alert', v.some((k) => k !== 'aucun'));
    el.classList.toggle('is-ok', v.includes('aucun'));
  }
  updateSuggestions();
  updateInfos();
  updateSurvRef();
  updateProgress();
  updateHeader();
  if (ALL_TABS[current]?.id === 'bilan') renderReport();
  save();
}

function updateProgress() {
  let done = 0;
  for (const [id, test] of Object.entries(TAB_DONE)) {
    const ok = test(state);
    if (ok && PROGRESS_TABS.includes(id)) done++;
    const tab = document.getElementById(`tab-${id}`);
    tab.classList.toggle('done', ok);
    if (SD_OF_TAB[id]) tab.classList.toggle('alert', hasSome(state, SD_OF_TAB[id]));
  }
  document.getElementById('progress-bar').style.width = `${(done / PROGRESS_TABS.length) * 100}%`;
}

function victimTitle(b) {
  const { name } = victimSummary(b.state);
  return name ? `V${b.n} · ${name}` : `Victime ${b.n}`;
}

function updateHeader() {
  const b = activeBilan();
  document.getElementById('victim-label').textContent = victimTitle(b);
  const count = document.getElementById('victim-count');
  count.hidden = store.bilans.length < 2;
  count.textContent = String(store.bilans.length);
  document.getElementById('victim-dot').className = `victim-dot ${detresseStatus(state).level}`;
  document.getElementById('btn-victims').setAttribute('aria-label',
    `${victimTitle(b)}. ${store.bilans.length} bilan${store.bilans.length > 1 ? 's' : ''} en cours. Changer de victime`);
}

function updateSuggestions() {
  const list = suggestions(state);
  for (const { el, group } of suggestBoxes) {
    const mine = list.filter((x) => x.group === group);
    el.hidden = !mine.length;
    if (!mine.length) continue;
    const sd = SIGNES_DETRESSE.find((g) => g.name === group);
    el.replaceChildren(h('strong', {}, 'Valeurs anormales relevées'),
      ...mine.map((x) => {
        const label = sd.options.find((o) => o.v === x.v).l;
        return h('div', { class: 'row' },
          h('span', {}, `${x.why} → ${label}`),
          h('button', { type: 'button', onclick: () => {
            setValue(x.group, [...(state[x.group] || []).filter((k) => k !== 'aucun'), x.v]);
          } }, 'Cocher'));
      }));
  }
}

function missingItems() {
  const s = state;
  const m = [];
  const acr = has(s, 'sd_c', 'acr');
  if (!s.motif && !s.plainte) m.push('Motif / plainte');
  if (!s.sexe) m.push('Sexe');
  if (s.age === undefined) m.push('Âge');
  for (const sd of SIGNES_DETRESSE) if (!(s[sd.name] || []).length) m.push(`${sd.letter} – ${sd.title}`);
  if (has(s, 'x_gestes', 'garrot') && !s.x_garrot_heure) m.push('Heure du garrot');
  if (!s.fr) m.push('FR');
  if (!s.sat) m.push('SpO2');
  if (!acr && !s.fc) m.push('FC');
  if (!acr && !s.ta_g && !s.ta_d) m.push('TA');
  if (!gcsTotal(s)) m.push('Glasgow');
  if (!s.allergies) m.push('Allergies');
  if (!s.traitements) m.push('Traitements');
  if (!s.atcd) m.push('ATCD');
  if (!s.devenir) m.push('Devenir');
  return m;
}

function renderSummary() {
  const b = activeBilan();
  const v = victimSummary(state);
  const st = detresseStatus(state);
  document.getElementById('summary').replaceChildren(...[
    h('div', { class: 'who' },
      h('strong', {}, v.name || `Victime ${b.n}`),
      h('span', { class: 'meta' }, [v.heure, `n° ${b.n}`].filter(Boolean).join(' · '))),
    v.who || v.types.length
      ? h('div', { class: 'chips' }, v.who ? h('span', { class: 'chip' }, v.who) : null,
        ...v.types.map((t) => h('span', { class: 'chip' }, t)))
      : null,
    h('span', { class: `status ${st.level}` }, st.text),
  ].filter(Boolean));
}

// Texte d'une section : lignes de détresse en rouge, titres de lettre en gras.
const LETTER_HEAD = /^([XABCD] – [^:]+ :)(.*)$/;
function reportPre(sec) {
  const pre = h('pre', {});
  if (!sec.text) {
    pre.textContent = 'Non renseigné';
    pre.classList.add('empty');
    return pre;
  }
  let alert = sec.id === 'vital' && sec.text.startsWith('SIGNES DE DÉTRESSE');
  sec.text.split('\n').forEach((line, i) => {
    if (i) pre.append('\n');
    if (!line) alert = false;
    const m = line.match(LETTER_HEAD);
    const content = m ? [h('strong', {}, m[1]), m[2]] : [line];
    pre.append(alert ? h('span', { class: 'alert-line' }, ...content) : h('span', {}, ...content));
  });
  return pre;
}

// Identité : chaque valeur a son bouton, pour la recopier facilement.
function identiteList() {
  return h('dl', { class: 'id-list' }, ...identiteRows(state).map(([k, v]) => {
    const btn = h('button', { type: 'button', class: 'btn mini', 'aria-label': `Copier ${k.toLowerCase()}` }, 'Copier');
    btn.addEventListener('click', () => copy(v, `Copié : ${k.toLowerCase()}`, btn));
    return h('div', { class: 'id-row' }, h('dt', {}, k), h('dd', {}, v), btn);
  }));
}

function renderReport() {
  renderSummary();
  const report = buildReport(state);
  document.getElementById('report-sections').replaceChildren(...report.sections.map((sec) => {
    const btn = h('button', { type: 'button', class: 'btn mini', disabled: !sec.text || undefined }, 'Copier');
    btn.addEventListener('click', () => copy(sec.text, `${sec.title.charAt(0)}${sec.title.slice(1).toLowerCase()} copié`, btn));
    const body = sec.id === 'identite' && sec.text ? identiteList() : reportPre(sec);
    return h('article', { class: `report-card ${sec.id}` }, h('header', {}, h('h3', {}, sec.title), btn), body);
  }));
  const miss = missingItems();
  const box = document.getElementById('missing');
  box.hidden = !miss.length;
  box.replaceChildren(h('strong', {}, 'À vérifier avant d’enregistrer'), h('ul', {}, ...miss.map((x) => h('li', {}, x))));
}

// ---------------------------------------------------------------------------
// Export : Notes (feuille de partage) et presse-papiers
// ---------------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function copy(text, msg = 'Copié', btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { readonly: true, style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(`${msg} ✓`);
  if (btn) {
    const label = btn.textContent;
    btn.textContent = 'Copié ✓';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1600);
  }
}

// ---------------------------------------------------------------------------
// Enregistrement direct : un raccourci iOS (app Raccourcis) crée la note.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'pdb-bspp:reglages';
const settings = { direct: false, shortcut: 'PdB' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* ignoré */ }

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignoré */ }
}

function runShortcut(text) {
  const name = settings.shortcut.trim() || 'PdB';
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(text)}`;
}

function updateSettingsUI() {
  $('direct-on').setAttribute('aria-pressed', String(settings.direct));
  $('direct-off').setAttribute('aria-pressed', String(!settings.direct));
  const pill = $('direct-pill');
  pill.textContent = settings.direct ? 'Activé' : 'Désactivé';
  pill.classList.toggle('on', settings.direct);
  $('steps-name').textContent = settings.shortcut.trim() || 'PdB';
  if ($('shortcut-name').value !== settings.shortcut) $('shortcut-name').value = settings.shortcut;
  $('btn-share').textContent = settings.direct ? 'Créer la note' : 'Enregistrer dans Notes';
  $('btn-share-sheet').hidden = !settings.direct;
}

function setupSettings() {
  $('direct-on').addEventListener('click', () => { settings.direct = true; saveSettings(); updateSettingsUI(); });
  $('direct-off').addEventListener('click', () => { settings.direct = false; saveSettings(); updateSettingsUI(); });
  $('shortcut-name').addEventListener('input', (e) => { settings.shortcut = e.target.value; saveSettings(); updateSettingsUI(); });
  $('btn-test-shortcut').addEventListener('click', () => {
    runShortcut('Test Prise de bilans – Garde BSPP\nSi cette note apparaît dans Notes, l’enregistrement direct fonctionne. Vous pouvez la supprimer.');
  });
  $('btn-share-sheet').addEventListener('click', () => shareSheet());
  updateSettingsUI();
}

async function share() {
  if (settings.direct) {
    runShortcut(buildReport(state).full);
    toast('Création de la note…');
    return;
  }
  return shareSheet();
}

async function shareSheet() {
  const r = buildReport(state);
  if (navigator.share) {
    try {
      await navigator.share({ text: r.full });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  await copy(r.full, 'Bilan copié : collez-le dans une nouvelle note');
}

// ---------------------------------------------------------------------------
// Plusieurs victimes
// ---------------------------------------------------------------------------
function switchTo(id) {
  store.activeId = id;
  const b = activeBilan();
  state = b.state;
  rebindAll();
  current = b.tab;
  refresh();
  go(b.tab, 'swap');
}

function addBilan() {
  const b = newBilan(store);
  store.bilans.push(b);
  closeSheet();
  switchTo(b.id);
  toast(`Victime ${b.n} : nouveau bilan`);
}

function deleteBilan(id) {
  const i = store.bilans.findIndex((b) => b.id === id);
  if (i < 0) return;
  const [gone] = store.bilans.splice(i, 1);
  if (!store.bilans.length) store.bilans.push(newBilan(store));
  if (gone.id === store.activeId) switchTo(store.bilans[Math.max(0, i - 1)].id);
  else refresh();
  if (!document.getElementById('sheet-backdrop').hidden) renderVictims();
  toast(`Bilan de la victime ${gone.n} supprimé`);
}

function renderVictims() {
  const list = document.getElementById('victims');
  list.replaceChildren(...store.bilans.map((b) => {
    const v = victimSummary(b.state);
    const st = detresseStatus(b.state);
    const del = h('button', { type: 'button', class: 'del', 'aria-label': `Supprimer le bilan de la victime ${b.n}` }, 'Supprimer');
    const li = h('li', { class: `victim${b.id === store.activeId ? ' active' : ''}` },
      h('button', { type: 'button', class: 'open', onclick: () => { closeSheet(); if (b.id !== store.activeId) switchTo(b.id); } },
        h('span', { class: 'line1' }, h('span', { class: 'n' }, `Victime ${b.n}`), v.name ? h('span', { class: 'name' }, v.name) : null),
        h('span', { class: 'sub' }, [v.who, v.heure, v.types.join(', ')].filter(Boolean).join(' · ') || 'Bilan vide'),
        h('span', { class: `status ${st.level}` }, st.text)),
      del);
    twoStep(del, 'Confirmer', () => {
      li.classList.add('leaving');
      setTimeout(() => deleteBilan(b.id), 260);
    });
    return li;
  }));
}

let sheetTimer;
function openSheet() {
  renderVictims();
  const bd = document.getElementById('sheet-backdrop');
  clearTimeout(sheetTimer);
  bd.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => bd.classList.add('open')));
  document.getElementById('btn-sheet-close').focus({ preventScroll: true });
}

function closeSheet() {
  const bd = document.getElementById('sheet-backdrop');
  if (bd.hidden) return;
  bd.classList.remove('open');
  sheetTimer = setTimeout(() => { bd.hidden = true; }, 320);
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
window.addEventListener('resize', () => fitRailLabels());

renderTabs();
setupRailScrub();
$('btn-prev').addEventListener('click', () => go(current - 1));
$('btn-next').addEventListener('click', () => (current === ALL_TABS.length - 1 ? share() : go(current + 1)));
$('btn-share').addEventListener('click', share);
setupSettings();
$('btn-copy-all').addEventListener('click', (e) => copy(buildReport(state).full, 'Bilan complet copié', e.currentTarget));
$('btn-victims').addEventListener('click', openSheet);
$('btn-sheet-close').addEventListener('click', closeSheet);
$('btn-new').addEventListener('click', addBilan);
$('btn-new-bottom').addEventListener('click', addBilan);
twoStep($('btn-delete-current'), 'Confirmer la suppression', () => deleteBilan(store.activeId));
$('sheet-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
// Les durées affichées (garrot posé depuis…, premiers signes il y a…) avancent toutes seules.
setInterval(updateInfos, 30000);

current = activeBilan().tab || 0;
fitRailLabels();
refresh();
go(current, 'swap');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    saveNow();
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
}
