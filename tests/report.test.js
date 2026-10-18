import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReport, computeAge, detresseStatus, formatTA, suggestions,
} from '../js/report.js';
import { malinas, rachisDecision, taParts, tempWarn } from '../js/schema.js';

const section = (r, id) => r.sections.find((x) => x.id === id).text;

const thoracique = {
  date_pec: '2026-10-18', heure_depart: '13:52', heure_pec: '14:01',
  motif: 'Douleur thoracique', adresse_inter: '12 rue de la Paix\n75002 Paris',
  danger: ['aucun'], securite_ok: 'oui',
  renfort: 'renfort', renfort_type: ['medical'], renfort_motif: 'douleur thoracique avec détresse', heure_renfort: '14:10',
  lieu_type: 'domicile', lieu: '3e étage sans ascenseur', temoins: 'son épouse',
  sexe: 'H', age: 58, histoire: 'ressent une douleur thoracique au repos depuis 1h', plainte: 'une douleur qui serre',
  sd_x: ['aucun'], sd_a: ['aucun'], sd_b: ['aucun'], sd_c: ['paleur', 'sueurs'], sd_d: ['aucun'],
  fr: '20', fr_ampl: 'ample', fr_reg: 'reguliere', fr_sym: 'symetrique',
  sat: '95', sat_sous: 'O2', o2_debit: '9', o2_masque: 'mhc',
  fc: '104', fc_ampl: 'bien_frappe', fc_reg: 'regulier', pouls_site: 'radial',
  ta_d: '150/95', ta_g: '125/80', trc: 'inf',
  gcs_y: '4', gcs_v: '5', gcs_m: '6', ost: 'oui', pupilles: 'egales', ms4m: 'oui', fast: 'negatif',
  q_type: 'serre', r_region: 'rétrosternale', s_eva: '7',
  spe: ['thoracique'], th_effort: 'non', th_irradiation: ['machoire', 'bras_g'], th_hta: 'oui',
  gly: '1.05', gly_unite: 'g/L', temp: '36.8', temp_site: 'tympanique',
  allergies: 'Aucune', traitements: 'Kardegic', atcd: 'HTA', dernier_repas: '12:30',
  position: 'demi_assise', gestes: ['protection', 'surveillance'],
  transmis: ['18', '15'], heure_transmis: '14:12', contact_urgent: 'oui',
  devenir: 'evac', evac_dest: 'les urgences de Lariboisière', evac_par: 'ar',
  surv: [{ heure: '14:20', fr: '18', sat: '97', sat_sous: 'O2', fc: '96', ta: '130/85', evolution: 'mieux' }],
  nom: 'Martin', prenom: 'Paul', ddn: '1968-02-03',
};

test('bilan complet : sections dans l’ordre S · XABCD', () => {
  const r = buildReport(thoracique);
  console.log(r.full);
  assert.deepEqual(r.sections.filter((x) => x.text).map((x) => x.id),
    ['synthese', 'circonstanciel', 'vital', 'complementaire', 'gestes', 'surveillance', 'devenir', 'identite']);
  assert.ok(r.full.startsWith('Bilan 18/10/2026 à 14h01 – MARTIN Paul\nMotif : Douleur thoracique\nAdresse : 12 rue de la Paix, 75002 Paris'));
});

test('bilan vital : détresses en tête, puis une ligne ou un bloc par lettre', () => {
  const vital = section(buildReport(thoracique), 'vital');
  assert.ok(vital.startsWith('SIGNES DE DÉTRESSE :\nC – Circulation : pâleur, sueurs froides\n\nX – Hémorragie : Pas d’hémorragie\nA – Voies aériennes : Libres\nB – Respiration :\n'));
  assert.match(vital, /FR 20\/min, ample, régulière, symétrique\nSpO2 95 % sous O2 9 L\/min \(MHC\)\nPas de détresse respiratoire/);
  assert.match(vital, /FC 104\/min, bien frappé, régulier \(radial\)\nTAD 150\/95\nTAG 125\/80\nTRC < 2 s/);
  assert.match(vital, /D – Neurologique :\nGlasgow 15\nOrientée dans le temps et l’espace\nPupilles égales et réactives/);
});

test('synthèse à transmettre', () => {
  const syn = section(buildReport(thoracique), 'synthese');
  assert.equal(syn, [
    'Homme de 58 ans – Douleur thoracique.',
    'Se plaint d’une douleur qui serre.',
    'Détresse C (pâleur, sueurs froides).',
    'FR 20, SpO2 95 % sous O2, FC 104, TA 125/80, Glasgow 15, glycémie 1,05 g/L, T° 36,8 °C.',
    'Gestes : position demi-assise, oxygénothérapie 9 L/min (MHC), protection thermique, surveillance.',
    'Évacuation médicalisée (AR / SMUR) vers les urgences de Lariboisière.',
  ].join('\n'));
});

test('circonstanciel, complémentaire, transmission', () => {
  const r = buildReport(thoracique);
  assert.match(section(r, 'circonstanciel'), /^Homme de 58 ans qui ressent une douleur thoracique au repos depuis 1h et se plaint d’une douleur qui serre\.\nIntervention à domicile : 3e étage sans ascenseur\./);
  assert.match(section(r, 'circonstanciel'), /Renfort demandé à 14h10 : médicalisation pour douleur thoracique avec détresse\./);
  const compl = section(r, 'complementaire');
  assert.match(compl, /Douleur thoracique :\nPas d’effort particulier\nIrradiation : la mâchoire et le bras gauche/);
  assert.match(compl, /Écart TAD \/ TAG : 25 mmHg \(> 20 : dissection \?\)/);
  assert.match(compl, /Pas d’allergie connue\nTraitement : Kardegic\nATCD : HTA\nDernier repas à 12h30/);
  assert.match(section(r, 'devenir'), /^Bilan transmis au 18 et au 15 à 14h12 \(contact urgent\)/);
  assert.match(section(r, 'surveillance'), /^14h20 : FR 18, SpO2 97 % sous O2, FC 96, TA 130\/85, amélioration$/);
});

test('hémorragie : garrot et gestes repris', () => {
  const s = { sd_x: ['externe'], x_loc: 'cuisse gauche', x_gestes: ['compression', 'garrot'], x_garrot_heure: '14:05', x_resultat: 'arretee' };
  const r = buildReport(s);
  assert.match(section(r, 'vital'), /^SIGNES DE DÉTRESSE :\nX – Hémorragie : hémorragie externe\n\nX – Hémorragie :\nLocalisation : cuisse gauche\nGarrot posé à 14h05\nHémorragie arrêtée$/);
  assert.equal(section(r, 'gestes'), 'Compression directe\nGarrot posé à 14h05');
});

test('arrêt cardiaque', () => {
  const s = {
    sd_c: ['acr'], acr_heure: '10:02', acr_temoin: 'oui', rcp_temoin: 'non',
    c_gestes: ['rcp', 'dae'], rcp_heure: '10:05', dae_chocs: '2', dae_heures: '10h07, 10h09', racs: 'oui',
  };
  const r = buildReport(s);
  assert.match(section(r, 'vital'), /C – Circulation :\nACR constaté à 10h02\nACR devant témoin\nPas de RCP avant notre arrivée\nReprise d’activité cardiaque spontanée/);
  assert.equal(section(r, 'gestes'), 'RCP débutée à 10h05\nDAE : 2 chocs (10h07, 10h09)');
  assert.equal(detresseStatus(s).text, 'Détresse C');
});

test('statut de détresse', () => {
  assert.equal(detresseStatus({}).level, 'todo');
  const ok = { sd_x: ['aucun'], sd_a: ['aucun'], sd_b: ['aucun'], sd_c: ['aucun'], sd_d: ['aucun'] };
  assert.equal(detresseStatus(ok).level, 'ok');
  assert.equal(section(buildReport(ok), 'vital').split('\n')[0], 'Pas de détresse vitale');
  assert.deepEqual(detresseStatus({ ...ok, sd_b: ['sat'], sd_d: ['glasgow'] }), { level: 'detresse', text: 'Détresse B et D' });
});

test('suggestions depuis les mesures', () => {
  const sug = suggestions({ fc: '141', sat: '91', fr: '5', ta_g: '85/50', gcs_y: '3', gcs_v: '4', gcs_m: '6', sd_c: ['fc'] });
  assert.deepEqual(sug.map((x) => `${x.group}:${x.v}`).sort(), ['sd_b:arret', 'sd_b:sat', 'sd_c:ta', 'sd_d:glasgow']);
  // TA en cmHg (13/8) : pas de fausse alerte.
  assert.deepEqual(suggestions({ ta_d: '13/8' }), []);
  assert.deepEqual(taParts('13/8'), [130, 80]);
});

test('formulaire vide', () => {
  assert.equal(buildReport({}).full, 'Bilan\n');
  assert.equal(buildReport({ sat_sous: 'AA', gly_unite: 'g/L', date_pec: '2026-10-18' }).full, 'Bilan 18/10/2026\n');
});

test('âge calculé', () => {
  assert.equal(computeAge('2000-10-08', new Date(2026, 9, 7)), 25);
  assert.equal(computeAge('2000-10-07', new Date(2026, 9, 7)), 26);
});

test('rachis : décision d’immobilisation', () => {
  assert.equal(rachisDecision({}), null);
  assert.equal(rachisDecision({ rc_fiabilite: 'non' }).level, 'alert');
  assert.equal(rachisDecision({ rc_fiabilite: 'oui', rc_signes: ['aucun'], rc_mecanisme: ['chute_tete'], rc_atcd: ['osteoporose'] }).level, 'alert');
  assert.equal(rachisDecision({ rc_fiabilite: 'oui', rc_signes: ['aucun'], rc_mecanisme: ['chute_tete'], rc_atcd: ['aucun'], age: 70 }).level, 'alert');
  assert.equal(rachisDecision({ rc_fiabilite: 'oui', rc_signes: ['aucun'], rc_mecanisme: ['chute_tete'], rc_atcd: ['aucun'], age: 30 }).level, 'ok');
  const r = buildReport({ spe: ['rachis'], rc_fiabilite: 'non' });
  assert.match(section(r, 'complementaire'), /Traumatisme du rachis :\nRéponses non fiables\nImmobiliser le rachis/);
});

test('trauma : fiches lésion', () => {
  const r = buildReport({
    spe: ['trauma'], tr_mecanisme: 'chute de sa hauteur',
    lesions: [{ zone: 'poignet', cote: 'd', signes: ['douleur', 'deformation'], eva: '6', distal: 'oui' }, {}],
  });
  assert.equal(section(r, 'complementaire'),
    'Bilan traumatique :\nMécanisme : chute de sa hauteur\nPoignet, côté droit : douleur 6/10, déformation ; motricité, sensibilité, pouls, TRC et chaleur conservés en aval');
});

test('grossesse : score de Malinas', () => {
  const s = { mal_parite: '1', mal_travail: '1', mal_duree: '1', mal_intervalle: '2', mal_eaux: '0' };
  assert.equal(malinas(s), 5);
  assert.equal(malinas({ ...s, mal_eaux: undefined }), null);
  assert.match(section(buildReport({ spe: ['grossesse'], ...s }), 'complementaire'), /Score de Malinas : 5\/10 \(accouchement proche\)/);
});

test('température : classement du mémo', () => {
  assert.equal(tempWarn({ temp: '37' }), null);
  assert.equal(tempWarn({ temp: '33,5' }).level, 'warn');
  assert.equal(tempWarn({ temp: '40.6' }).level, 'alert');
});

test('tension : barre ajoutée automatiquement', () => {
  const type = (keys) => { let v = ''; for (const k of keys) v = formatTA(v + k); return v; };
  assert.equal(type('13287'), '132/87');
  assert.equal(type('9560'), '95/60');
  assert.equal(type('210110'), '210/110');
  assert.equal(formatTA('132', true), '132');
  assert.equal(formatTA('12/8'), '12/8');
  assert.equal(formatTA(''), '');
});

test('pas de ligne vide quand une partie n’est pas renseignée', () => {
  const r = buildReport({ spe: ['malaise', 'intox'], dernier_repas: 'ce midi', sat_sous: 'AA', gly_unite: 'g/L' });
  assert.equal(section(r, 'complementaire'), 'Dernier repas ce midi');
});
