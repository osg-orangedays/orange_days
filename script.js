import { parse } from 'https://cdn.jsdelivr.net/npm/@vanillaes/csv@latest/src/index.min.js';

/*
  Legge la configurazione globale definita in config.js
*/
const cfg = window.ORANGE_DAYS_CONFIG || {};

/*
  Stato interno dell'app.
  Serve per ricordare:
  - dati caricati
  - torneo attivo
  - fase attiva
  - eventuali errori
*/
const state = {
  tournaments: [],
  activeTournamentId: null,
  activePhaseId: null,
  loading: false,
  error: null
};

/*
  Converte i nomi delle colonne del CSV in formato uniforme.

  Esempi:
  "Squadra 1" -> "squadra_1"
  "Gol-Squadra-1" -> "gol_squadra_1"
*/
function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')
    .replaceAll('-', '_');
}

/*
  Ritorna il primo valore non vuoto tra quelli passati.
*/
function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return '';
}

/*
  Converte le righe grezze del CSV in oggetti JavaScript.
  Esempio:
  
  Input:
  [
    ["girone", "data", "squadra_1"],
    ["A", "12/06/2026", "Team A"]
  ]

  Output:
  [
    {
      girone: "A",
      data: "2026-06-12",
      squadra_1: "Team A"
    }
  ]
*/
function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const headers = rows.shift().map(header => normalizeHeader(header));

  return rows
    .filter(row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim() !== ''))
    .map(row => {
      const raw = Object.fromEntries(
        headers.map((header, index) => [header, String(row[index] ?? '').trim()])
      );

      return normalizeRow(raw);
    });
}

/*
  Uniforma i nomi dei campi partita.
*/
function normalizeRow(row) {
  const score1 = firstNonEmpty(
    row.gol_squadra_1,
    row.pti_squadra_1
  );

  const score2 = firstNonEmpty(
    row.gol_squadra_2,
    row.pti_squadra_2
  );

  return {
    ...row,

    // Identificativo partita, se presente.
    id: firstNonEmpty(row.id, row.partita, row.n),

    // Per i gironi sarà A/B/C.
    // Per le finali può essere Semifinale, Finale, Gold, Silver, ecc.
    girone: firstNonEmpty(row.girone, row.turno, row.fase, row.gruppo),

    // Data normalizzata in formato DD-MM-YYYY.
    data: normalizeDate(row.data),

    ora: row.ora || 'N/D',
    campo: row.campo || 'N/D',

    squadra_1: firstNonEmpty(row.squadra_1, row.squadra_casa, row.casa, row.team_1),
    squadra_2: firstNonEmpty(row.squadra_2, row.squadra_trasferta, row.trasferta, row.team_2),

    score_1: score1,
    score_2: score2,

    arbitro: row.arbitro || 'N/D',
    stato: firstNonEmpty(row.stato, row.status),
    note: row.note || ''
  };
}

/*
  Normalizza la data.

  Supporta:
  - 2026-06-12
  - 12/06/2026
  - seriali Excel / Google Sheets
*/
function normalizeDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(raw)) return raw;

  if (/^\d{4}\/\d{2}\/\d{4}$/.test(raw)) {
    const [year, month, day] = raw.split('/').map(Number);
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  }

  return raw;
}

/*
  Scarica un CSV pubblico da Google Sheets e lo converte in oggetti.
*/
async function loadCsv(url) {
  if (!url) return [];

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`CSV non raggiungibile: ${url}`);
  }

  const text = await res.text();
  return rowsToObjects(parse(text));
}

/*
  Carica tutte le fasi di un torneo:
  - Gironi
  - Finali
*/
async function loadTournament(tournament) {
  const phases = [];

  for (const phase of tournament.phases || []) {
    phases.push({
      ...phase,
      rows: await loadCsv(phase.csv)
    });
  }

  return {
    ...tournament,
    phases,
    scorers: await loadScorers(tournament.scorersCsv || null)
  };
}


/*
  Carica il CSV dei marcatori e lo converte in oggetti.

  Colonne attese (case-insensitive, con alias comuni):
    giocatore | nome
    squadra   | team
    goal | reti
*/
async function loadScorers(url) {
  if (!url) return [];

  const rows = await loadCsv(url);

  return rows
    .map(row => ({
      giocatore: firstNonEmpty(row.giocatore, row.nome, row.player, row.name),
      squadra:   firstNonEmpty(row.squadra, row.team, row.club),
      gol:       Number(firstNonEmpty(row.goal, row.reti, row.goals) || 0)
    }))
    .filter(row => row.giocatore !== '');
}

/*
  Ordina i marcatori per gol (decrescente), poi alfabeticamente.
*/
function calculateScorers(rows) {
  return [...rows].sort((a, b) =>
    b.gol - a.gol ||
    String(a.giocatore).localeCompare(String(b.giocatore), 'it-IT')
  );
}

/*
  Controlla se almeno una fase ha un CSV configurato.
*/
function hasAnyCsv() {
  return (cfg.tournaments || []).some(tournament =>
    (tournament.phases || []).some(phase => Boolean(phase.csv))
  );
}

/*
  Ritorna solo i tornei visibili.
*/
function visibleTournaments() {
  return state.tournaments.filter(tournament => tournament.visible !== false);
}

/*
  Ritorna il torneo attivo.
  Se non c'è, prende il primo torneo visibile.
*/
function getActiveTournament() {
  const visible = visibleTournaments();

  return (
    visible.find(tournament => tournament.id === state.activeTournamentId) ||
    visible[0] ||
    null
  );
}

/*
  Ritorna la fase attiva del torneo.
  Se non c'è, prende la prima fase.
*/
function getActivePhase(tournament) {
  if (!tournament) return null;

  return (
    (tournament.phases || []).find(phase => phase.id === state.activePhaseId) ||
    (tournament.phases || [])[0] ||
    null
  );
}

/*
  Legge il sistema punti dal torneo.

  Esempi:
  Calcio:
  points: { win: 3, draw: 1, loss: 0 }

  Basket/Volley:
  points: { win: 2, loss: 0 }

  Se draw manca, viene usato 1 come default che verrà ignorato successivamente.
*/
function getTournamentPoints(tournament) {
  const raw = tournament?.points || cfg.points || {};

  return {
    win: Number(raw.win ?? 3),
    draw: Number(raw.draw ?? raw.tie ?? 1),
    loss: Number(raw.loss ?? 0)
  };
}

/*
  Calcola la classifica per una fase a gironi.

  Ordine:
  1. girone
  2. punti
  3. differenza punti/gol
  4. punti/gol fatti
  5. nome squadra
*/
function calculateStandings(rows, tournament) {
  const points = getTournamentPoints(tournament);
  const table = new Map();
  const sport = String(tournament?.sport || '').toLowerCase();

  rows.forEach(match => {
    if (match.squadra_1) ensureTeam(table, match.girone, match.squadra_1);
    if (match.squadra_2) ensureTeam(table, match.girone, match.squadra_2);
  });

  rows.filter(isFinished).forEach(match => {
    const home = ensureTeam(table, match.girone, match.squadra_1);
    const away = ensureTeam(table, match.girone, match.squadra_2);

    const scoreHome = Number(match.score_1);
    const scoreAway = Number(match.score_2);

    home.G += 1;
    away.G += 1;

    home.F += scoreHome;
    home.S += scoreAway;

    away.F += scoreAway;
    away.S += scoreHome;

    if (scoreHome > scoreAway) {
      home.V += 1;
      away.P += 1;

      home.Pti += points.win;
      away.Pti += points.loss;
    } else if (scoreHome < scoreAway) {
      away.V += 1;
      home.P += 1;

      away.Pti += points.win;
      home.Pti += points.loss;
    } else {
      home.N += 1;
      away.N += 1;

      home.Pti += points.draw;
      away.Pti += points.draw;
    }
  });

  for (const row of table.values()) {
    row.Diff = row.F - row.S;

    if (sport.includes('calcio')) {
      row.GF = row.F;
      row.GS = row.S;
      row.DR = row.Diff;
    } else {
      row['Pt+'] = row.F;
      row['Pt-'] = row.S;
    }
  }

  return sortStandings([...table.values()], rows);
}

/*
 * Ordina l'intera classifica.
 *
 * Prima divide per girone (A, B, C, ...)
 * Poi applica i criteri di spareggio.
 */
function sortStandings(standings, matches) {
  return standings.sort((a, b) =>
    String(a.girone).localeCompare(
      String(b.girone),
      'it-IT',
      { numeric: true }
    ) ||
    compareTeams(a, b, matches)
  );
}

/*
 * Confronta due squadre e decide chi deve stare sopra.
 *
 * Ordine criteri:
 *
 * 1. Punti
 * 2. Differenza reti/punti
 * 3. Gol/Punti fatti
 * 4. Scontro diretto
 * 5. Sorteggio casuale stabile
 */
function compareTeams(a, b, matches) {

  // 1. PUNTI
  if (b.Pti !== a.Pti) {
    return b.Pti - a.Pti;
  }

  // 2. DIFFERENZA RETI / CANESTRI / PUNTI
  if (b.Diff !== a.Diff) {
    return b.Diff - a.Diff;
  }

  // 3. GOL FATTI / PUNTI FATTI
  if (b.F !== a.F) {
    return b.F - a.F;
  }

  // 4. SCONTRO DIRETTO
  const headToHead = compareHeadToHead(a, b, matches);

  if (headToHead !== 0) {
    return headToHead;
  }

  // 5. ESTRAZIONE CASUALE STABILE
  return stableRandomTieBreak(a, b);
}

/*
 * Calcola lo scontro diretto tra due squadre.
 *
 * Se hanno giocato più volte:
 * - conta punti negli scontri diretti
 * - poi differenza reti
 * - poi gol fatti
 *
 * Restituisce:
 * < 0 => vince A
 * > 0 => vince B
 * = 0 => perfetta parità
 */
function compareHeadToHead(a, b, matches) {

  // Recupera solo le partite tra A e B
  const directMatches = matches.filter(match =>
    isFinished(match) &&
    match.girone === a.girone &&
    (
      (
        match.squadra_1 === a.squadra &&
        match.squadra_2 === b.squadra
      ) ||
      (
        match.squadra_1 === b.squadra &&
        match.squadra_2 === a.squadra
      )
    )
  );

  if (!directMatches.length) {
    return 0;
  }

  let aDirectPoints = 0;
  let bDirectPoints = 0;

  let aDirectDiff = 0;
  let bDirectDiff = 0;

  let aDirectFor = 0;
  let bDirectFor = 0;

  directMatches.forEach(match => {

    const score1 = Number(match.score_1);
    const score2 = Number(match.score_2);

    const aIsHome = match.squadra_1 === a.squadra;

    const aScore = aIsHome ? score1 : score2;
    const bScore = aIsHome ? score2 : score1;

    // Gol/Punti fatti
    aDirectFor += aScore;
    bDirectFor += bScore;

    // Differenza reti/punti
    aDirectDiff += aScore - bScore;
    bDirectDiff += bScore - aScore;

    // Punti nello scontro diretto
    if (aScore > bScore) {

      // Vittoria A
      aDirectPoints += 3;

    } else if (aScore < bScore) {

      // Vittoria B
      bDirectPoints += 3;

    } else {

      // Pareggio
      aDirectPoints += 1;
      bDirectPoints += 1;
    }
  });

  /*
   * Spareggio interno:
   *
   * 1. punti scontro diretto
   * 2. differenza reti scontro diretto
   * 3. gol fatti scontro diretto
   */

  if (bDirectPoints !== aDirectPoints) {
    return bDirectPoints - aDirectPoints;
  }

  if (bDirectDiff !== aDirectDiff) {
    return bDirectDiff - aDirectDiff;
  }

  if (bDirectFor !== aDirectFor) {
    return bDirectFor - aDirectFor;
  }

  return 0;
}

/*
 * Sorteggio casuale.
 */
function stableRandomTieBreak(a, b) {

  const aSeed = seededValue(
    `${a.girone}|${a.squadra}`
  );

  const bSeed = seededValue(
    `${b.girone}|${b.squadra}`
  );

  return bSeed - aSeed;
}

/*
 * Genera un hash numerico a partire
 * dal nome della squadra.
 *
 * Stessa squadra -> stesso numero.
 */
function seededValue(value) {

  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {

    hash ^= value.charCodeAt(i);

    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return hash >>> 0;
}

/*
  Crea una squadra in classifica se non esiste ancora.
*/
function ensureTeam(table, girone = 'A', squadra = '') {
  const key = `${girone || 'A'}|${squadra}`;

  if (!table.has(key)) {
    table.set(key, {
      girone: girone || 'A',
      squadra,
      G: 0,
      V: 0,
      N: 0,
      P: 0,
      F: 0,
      S: 0,
      Diff: 0,
      Pti: 0
    });
  }

  return table.get(key);
}

/*
  Determina se una partita è terminata.

  Una partita viene considerata terminata solo se:
  - ha entrambi i punteggi
  - lo stato indica che è conclusa
*/
function isFinished(match) {
  const status = String(match.stato || '').toLowerCase();

  const hasScores =
    match.score_1 !== '' &&
    match.score_2 !== '' &&
    !Number.isNaN(Number(match.score_1)) &&
    !Number.isNaN(Number(match.score_2));

  const finishedByStatus =
    status.includes('terminata') ||
    status.includes('conclusa') ||
    status.includes('finita') ||
    status.includes('giocata') ||
    status.includes('finale');

  return hasScores && finishedByStatus;
}

/*
  Crea il badge colorato dello stato partita.
*/
function statusBadge(stato) {
  const status = String(stato || 'Da giocare').toLowerCase();

  const cls =
    status.includes('terminata') ||
    status.includes('conclusa') ||
    status.includes('finita') ||
    status.includes('giocata') ||
    status.includes('finale')
      ? 'done'
      : status.includes('corso') || status.includes('live')
        ? 'live'
        : status.includes('rinviata') || status.includes('annullata')
          ? 'postponed'
          : 'todo';

  return `<span class="badge ${cls}">${escapeHtml(stato || 'Da giocare')}</span>`;
}

/*
  Disegna i tab principali:
  - Calcio Over 35
  - Calcio a 7 12H
  - Basket 3vs3
  - Green Volley
*/
function renderTournamentTabs() {
  const tabs = document.getElementById('tournamentTabs');
  if (!tabs) return;

  tabs.innerHTML = visibleTournaments()
    .map(tournament => `
      <button
        class="tab ${tournament.id === state.activeTournamentId ? 'active' : ''}"
        data-id="${escapeHtml(tournament.id)}"
        style="--accent:${escapeHtml(tournament.color || '#F97316')}"
      >
        ${escapeHtml(tournament.name)}
      </button>
    `)
    .join('');

  tabs.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      state.activeTournamentId = button.dataset.id;
      state.activePhaseId = null;
      render();
    });
  });
}

/*
  Disegna i tab secondari:
  - Gironi
  - Finali
  - Marcatori (solo se scorersCsv è configurato)

  Usa '__scorers__' come id virtuale per il tab marcatori.
*/
function renderPhaseTabs(tournament) {
  const phases = tournament.phases || [];
  const hasScorers = (tournament.scorers || []).length > 0 || tournament.scorersCsv;

  // Mostra i tab solo se ci sono almeno 2 voci totali
  if (phases.length <= 1 && !hasScorers) return '';

  const activeId = state.activePhaseId;

  return `
    <nav class="phase-tabs" aria-label="Fasi torneo">
      ${phases.map(phase => `
        <button
          class="phase-tab ${phase.id === activeId ? 'active' : ''}"
          data-phase-id="${escapeHtml(phase.id)}"
        >
          ${escapeHtml(phase.name)}
        </button>
      `).join('')}
      ${hasScorers ? `
        <button
          class="phase-tab ${activeId === '__scorers__' ? 'active' : ''}"
          data-phase-id="__scorers__"
        >
          ⚽ Marcatori
        </button>
      ` : ''}
    </nav>
  `;
}

/*
  Associa il click ai tab delle fasi.
*/
function bindPhaseTabs() {
  document.querySelectorAll('.phase-tab').forEach(button => {
    button.addEventListener('click', () => {
      state.activePhaseId = button.dataset.phaseId;
      render();
    });
  });
}

/*
  Disegna la classifica marcatori.
  Mostra solo i primi 3 con medaglie, poi la lista completa.
*/
function renderScorersCard(scorers) {
  if (!scorers || !scorers.length) return '';

  const sorted = calculateScorers(scorers);
  const medals = ['🏆'];

  // Raggruppa per posizione: chi ha gli stessi gol condivide il podio
  let rank = 0;
  let lastGol = null;

  const ranked = sorted.map(row => {
    if (row.gol !== lastGol) {
      rank += 1;
      lastGol = row.gol;
    }
    return { ...row, rank };
  });

  return `
    <section class="card">
      <div class="card-header">
        <h2>⚽ Classifica marcatori</h2>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Giocatore</th>
              <th>Squadra</th>
              <th>Gol</th>
            </tr>
          </thead>

          <tbody>
            ${ranked.map(row => `
              <tr class="${row.rank === 1 ? 'team-rank-1' : ''}">
                <td>${medals[row.rank - 1] ?? row.rank}</td>
                <td>${escapeHtml(row.giocatore)}</td>
                <td>${escapeHtml(row.squadra)}</td>
                <td class="score">${row.gol}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}



/*
  Render principale della pagina.
*/
function render() {
  renderTournamentTabs();

  const content = document.getElementById('content');
  if (!content) return;

  const tournament = getActiveTournament();

  if (!tournament) {
    content.innerHTML = '<section class="card empty">Nessun torneo visibile.</section>';
    return;
  }

  state.activeTournamentId = tournament.id;

  // Tab marcatori attivo: mostra solo la classifica marcatori
  if (state.activePhaseId === '__scorers__') {
    content.innerHTML = `
      ${renderPhaseTabs(tournament)}
      ${renderScorersCard(tournament.scorers || [])}
    `;
    bindPhaseTabs();
    updateLastUpdate();
    return;
  }

  const phase = getActivePhase(tournament);

  if (!phase) {
    content.innerHTML = '<section class="card empty">Nessuna fase configurata per questo torneo.</section>';
    return;
  }

  state.activePhaseId = phase.id;

  const rows = phase.rows || [];
  const played = rows.filter(isFinished).length;
  const upcoming = rows.length - played;
  const teamCount = countTeams(rows);

  content.innerHTML = `
    ${renderPhaseTabs(tournament)}

    <section class="kpis">
      <div class="kpi">
        <strong>${teamCount}</strong>
        <span>Squadre nella fase</span>
      </div>

      <div class="kpi">
        <strong>${played}</strong>
        <span>Partite terminate</span>
      </div>

      <div class="kpi">
        <strong>${upcoming}</strong>
        <span>Da giocare</span>
      </div>
    </section>

    ${phase.type === 'groups'
      ? `
        <section class="stack">
          ${renderStandingsCard(calculateStandings(rows, tournament), tournament)}
          ${renderScheduleCard(rows, 'Calendario gironi', tournament)}
        </section>
      `
      :renderScheduleCard(rows, phase.name, tournament)
    }
  `;

  bindPhaseTabs();
  updateLastUpdate();
}

/*
  Aggiorna il timestamp "Aggiornato: HH:MM" nell'header.
*/
function updateLastUpdate() {


  const lastUpdate = document.getElementById('lastUpdate');

  if (lastUpdate) {
    lastUpdate.textContent = `Aggiornato: ${new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
}

/*
  Conta le squadre effettive nella fase.
  Esclude placeholder tipo:
  - Vincente SF1
  - 1A
  - 2B
*/
function countTeams(rows) {
  const teams = new Set();

  rows.forEach(row => {
    if (row.squadra_1 && !isPlaceholderTeam(row.squadra_1)) teams.add(row.squadra_1);
    if (row.squadra_2 && !isPlaceholderTeam(row.squadra_2)) teams.add(row.squadra_2);
  });

  return teams.size;
}

/*
  Riconosce squadre placeholder.
*/
function isPlaceholderTeam(name) {
  const value = String(name || '').toLowerCase();

  return (
    value.includes('classificata') ||
    value.includes('vincente') ||
    value.includes('perdente') ||
    value.includes('winner') ||
    value.includes('loser') ||
    value.includes('^') ||
    value.includes('finalista')
  );
}

function renderStandingsCard(rows, tournament) {
  if (!rows.length) {
    return '<section class="card empty">Nessuna squadra inserita.</section>';
  }

  const points = getTournamentPoints(tournament);
  const groups = groupBy(rows, row => row.girone || 'A');
  const columns = getStandingsColumns(tournament);

  return `
    <section class="card">
      <div class="card-header">
        <h2>Classifiche</h2>
      </div>

      ${Object.entries(groups).map(([groupName, items]) => `
        <div class="group-title">Girone ${escapeHtml(groupName)}</div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Squadra</th>
                ${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}
              </tr>
            </thead>

            <tbody>
              ${items.map((row, index) => `
                <tr class="${index === 0 ? 'team-rank-1' : ''}">
                  <td>${index + 1}</td>
                  <td>${escapeHtml(row.squadra)}</td>

                  ${columns.map(column => `
                    <td class="${column.key === 'Pti' ? 'score' : ''}">
                      ${escapeHtml(row[column.key] ?? 0)}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </section>
  `;
}

function getStandingsColumns(tournament) {
  const sport = String(tournament?.sport || '').toLowerCase();

  if (sport.includes('calcio')) {
    return [
      { key: 'G', label: 'G' },
      { key: 'V', label: 'V' },
      { key: 'N', label: 'N' },
      { key: 'P', label: 'P' },
      { key: 'F', label: 'GF' },
      { key: 'S', label: 'GS' },
      { key: 'Diff', label: 'DR' },
      { key: 'Pti', label: 'Pti.' }
    ];
  }

  return [
    { key: 'G', label: 'G' },
    { key: 'V', label: 'V' },
    { key: 'P', label: 'P' },
    { key: 'F', label: 'Pt+' },
    { key: 'S', label: 'Pt-' },
    { key: 'Diff', label: 'Diff' },
    { key: 'Pti', label: 'Pti.' }
  ];
}

function renderScheduleCard(rows, title = 'Calendario e risultati', tournament = null) {
  if (!rows.length) {
    return `<section class="card empty">Nessuna partita inserita per ${escapeHtml(title.toLowerCase())}.</section>`;
  }

  const sport = String(tournament?.sport || '').toLowerCase();
  const showReferee = sport.includes('volley');

  const sorted = [...rows].sort(compareMatches);
  const groups = groupBy(sorted, row => row.data || 'Data da definire');

  return `
    <section class="card">
      <div class="card-header">
        <h2>${escapeHtml(title)}</h2>
      </div>

      ${Object.entries(groups).map(([date, items]) => `
        <div class="group-title">${formatDate(date)}</div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ora</th>
                <th>Campo</th>
                <th>Fase/Girone</th>
                <th>Partita</th>
                <th>Risultato</th>
                ${showReferee ? '<th>Arbitro</th>' : ''}
                <th>Stato</th>
              </tr>
            </thead>

            <tbody>
              ${items.map(row => `
                <tr>
                  <td>${escapeHtml(row.ora || '')}</td>
                  <td>${escapeHtml(row.campo || '')}</td>
                  <td>${escapeHtml(row.girone || '')}</td>
                  <td>
                    ${escapeHtml(row.squadra_1)}
                    <span class="muted">vs</span>
                    ${escapeHtml(row.squadra_2)}
                  </td>
                  <td class="score">
                    ${row.score_1 !== '' || row.score_2 !== ''
                      ? `${escapeHtml(row.score_1)} - ${escapeHtml(row.score_2)}`
                      : '-'}
                  </td>
                  ${showReferee ? `<td>${escapeHtml(row.arbitro || '')}</td>` : ''}
                  <td>${statusBadge(row.stato)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </section>
  `;
}

/*
  Ordina le partite per:
  1. data
  2. ora
  3. id
*/
function compareMatches(a, b) {
  const dateCompare = String(a.data || '').localeCompare(String(b.data || ''), 'it-IT', {
    numeric: true
  });

  if (dateCompare !== 0) return dateCompare;

  const timeCompare = String(a.ora || '').localeCompare(String(b.ora || ''), 'it-IT', {
    numeric: true
  });

  if (timeCompare !== 0) return timeCompare;

  return String(a.id || '').localeCompare(String(b.id || ''), 'it-IT', {
    numeric: true
  });
}

/*
  Raggruppa una lista in base a una chiave.
*/
function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(item);
    return acc;
  }, {});
}

/*
  Mostra la data in formato italiano.
*/
function formatDate(value) {
  if (!value) return 'Data da definire';

  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return escapeHtml(value);
  }

  const [day, month, year] = value.split('-');

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

/*
  Evita problemi HTML se nei dati ci sono caratteri speciali.
*/
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

/*
  Avvio dell'app:
  - carica i CSV
  - salva i dati nello stato
  - renderizza la pagina
*/
async function boot() {
  try {
    state.loading = true;
    state.error = null;

    if (hasAnyCsv()) {
      state.tournaments = [];

      for (const tournament of cfg.tournaments || []) {
        state.tournaments.push(await loadTournament(tournament));
      }
    } else if (cfg.showDemoDataWhenCsvMissing && typeof demo !== 'undefined') {
      state.tournaments = demo.tournaments;
    } else {
      state.tournaments = cfg.tournaments || [];
    }

    if (!state.activeTournamentId) {
      state.activeTournamentId = visibleTournaments()[0]?.id || null;
    }

    render();
  } catch (err) {
    state.error = err;

    const content = document.getElementById('content');

    if (content) {
      content.innerHTML = `
        <section class="card empty">
          <strong>Errore caricamento dati.</strong><br>
          ${escapeHtml(err.message)}
        </section>
      `;
    }

    console.error(err);
  } finally {
    state.loading = false;
  }
}

boot();

/*
  Refresh automatico dei dati.
  Nel tuo config.js hai:
  refreshSeconds: 60

  Quindi ogni 60 secondi ricarica i CSV.
*/
if (Number(cfg.refreshSeconds) > 0) {
  setInterval(boot, Number(cfg.refreshSeconds) * 1000);
}