const $ = (id) => document.getElementById(id);

const MAX_NETWORKS = 120;

/* ---------- fullscreen ---------- */
const fullscreenButton = $('fullscreen-button');
const fullscreenLabel = $('fullscreen-label');

function syncFullscreenUI() {
  const active = Boolean(document.fullscreenElement);
  $('icon-expand').hidden = active;
  $('icon-collapse').hidden = !active;
  fullscreenLabel.textContent = active ? 'Exit' : 'Full';
  fullscreenButton.setAttribute('aria-pressed', String(active));
}
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (err) {
    setStatus('Fullscreen blocked by the browser', 'wait');
  }
});
document.addEventListener('fullscreenchange', syncFullscreenUI);
syncFullscreenUI();

/* ---------- scan button ---------- */
const scanButton = $('scan-button');
scanButton.addEventListener('click', async () => {
  const label = $('scan-button-label');
  scanButton.disabled = true;
  label.textContent = 'Scanning…';
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'x-wifi-detector': '1' },
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok && data.snapshot) render(data.snapshot); // immediate feedback
  } catch (err) {
    setStatus('Scan failed', 'bad');
  } finally {
    scanButton.disabled = false;
    label.textContent = 'Scan';
  }
});

/* ---------- theme ---------- */
const THEME_KEY = 'wifi-detector-theme';

function currentTheme() {
  return document.documentElement.dataset.theme || 'dark';
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('icon-sun').style.display = theme === 'dark' ? 'inline' : 'none';
  $('icon-moon').style.display = theme === 'dark' ? 'none' : 'inline';
  $('theme-label').textContent = theme === 'dark' ? 'Dark' : 'Light';
}
$('theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  applyTheme(next);
});
applyTheme(currentTheme());

/* ---------- helpers ---------- */
function barsHTML(n) {
  let html = '<span class="bars">';
  for (let i = 1; i <= 4; i++) html += `<i class="${i <= n ? 'on' : ''}"></i>`;
  return html + '</span>';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setStatus(text, state) {
  $('scan-state').textContent = text;
  const dot = $('live-dot');
  dot.className = 'dot ' + (state === 'ok' ? 'dot-ok' : state === 'bad' ? 'dot-bad' : 'dot-wait');
}

/* ---------- renderers ---------- */
function renderConnected(c) {
  if (!c) {
    $('connected-ssid').textContent = 'Not connected';
    $('connected-bssid').textContent = '';
    $('connected-security').textContent = '—';
    $('connected-band').textContent = '—';
    $('connected-channel').textContent = '—';
    $('connected-rssi').textContent = '—';
    $('connected-radio').textContent = '—';
    $('connected-bars').innerHTML = barsHTML(0);
    return;
  }
  $('connected-ssid').textContent = c.ssid || '(hidden)';
  $('connected-bssid').textContent = c.bssid || '—';
  $('connected-security').textContent = c.security || 'unknown';
  $('connected-band').textContent = c.band || '—';
  $('connected-channel').textContent = c.channel ?? '—';
  $('connected-rssi').textContent = c.rssiDbm != null ? `${c.rssiDbm} dBm · ${c.signalPct ?? '–'}%` : '—';
  $('connected-radio').textContent = c.radio || '—';
  $('connected-bars').innerHTML = barsHTML(c.bars ?? 0);
}

function renderDiagnosis(d) {
  const causeEl = $('diag-cause');
  causeEl.textContent = d?.cause || 'unknown';
  causeEl.className = 'cause cause-' + (d?.cause || 'unknown');
  $('diag-summary').textContent = d?.summary || '—';
  const conf = d?.confidence || 'low';
  const el = $('diag-confidence');
  el.textContent = `confidence: ${conf}`;
  el.className = 'confidence-tag' + (conf === 'high' ? ' confidence-high' : conf === 'medium' ? ' confidence-medium' : '');
  $('diag-suggestions').innerHTML = (d?.suggestions || []).map((s) => `<li>${esc(s)}</li>`).join('');
}

function renderCongestion(list) {
  const host = $('congestion');
  if (!list || list.length === 0) {
    host.innerHTML = '<p class="cell-dim">No channel data yet.</p>';
    return;
  }
  const byBand = new Map();
  for (const r of list) {
    if (!byBand.has(r.band)) byBand.set(r.band, []);
    byBand.get(r.band).push(r);
  }
  host.innerHTML = [...byBand.entries()].map(([band, rows]) => `
    <div class="band-block"><h3>${esc(band)}</h3>
      <div class="chip-row">${rows.map((r) =>
        `<span class="chip chip-${esc(r.congestion)}" title="${r.networkCount} network(s) in range${r.energyDbm != null ? `, ~${r.energyDbm} dBm combined` : ''}">ch ${r.channel} · ${r.networkCount}${r.energyDbm != null ? ` · ${r.energyDbm} dBm` : ''}</span>`).join('')}
      </div>
    </div>`).join('');
}

function connectCell(n) {
  if (n.isConnected) return '<button class="row-connect connected" disabled>Connected</button>';
  const raw = n.securityRaw || '';
  if (/enterprise|802\.?1x|eap/i.test(raw) || n.security === 'WEP') {
    return '<button class="row-connect" disabled title="Enterprise (802.1X) / WEP not supported from the app yet">Unavailable</button>';
  }
  return `<button class="row-connect" data-ssid="${esc(n.ssid)}" data-security="${esc(n.security)}" data-securityraw="${esc(raw)}">Connect</button>`;
}

function renderNetworks(list, staleSec) {
  $('networks-count').textContent = ` · ${list?.length ?? 0}`;
  $('env-count').textContent = `${list?.length ?? 0} heard`;
  $('env-stale').textContent = staleSec != null ? `last full scan ${staleSec}s ago · driver withholding detail  ` : '';
  const tbody = $('networks-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="cell-dim">No networks visible — is Wi-Fi on?</td></tr>';
    return;
  }
  tbody.innerHTML = list.slice(0, MAX_NETWORKS).map((n) => `
    <tr class="${n.isConnected ? 'is-connected' : ''}">
      <td>${barsHTML(n.signalBars ?? 0)}<span class="mono-num cell-dim" style="font-size:11px">${n.rssiDbm != null ? ' ' + n.rssiDbm + ' dBm' : ''}</span></td>
      <td>${esc(n.ssid || '(hidden)')}${n.isConnected ? ' <span class="connected-tag">you</span>' : ''}</td>
      <td class="mono-num cell-dim">${esc(n.bssid || '—')}</td>
      <td class="band-tag">${esc(n.band || '—')}</td>
      <td class="mono-num">${n.channel ?? '—'}</td>
      <td>${esc(n.security || '—')}</td>
      <td class="connect-row-cell">${connectCell(n)}</td>
    </tr>`).join('');
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderSparkline(history) {
  const canvas = $('rssi-spark');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const midLine = cssVar('--line-strong') || 'rgba(128,128,128,.4)';
  ctx.strokeStyle = midLine;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  const samples = (history || []).slice(-120);
  if (samples.length < 2) return;
  const vals = samples.map((s) => s.rssi);
  const min = Math.min(...vals) - 2, max = Math.max(...vals) + 2;
  ctx.strokeStyle = cssVar('--accent') || '#f0a63c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = (i / (vals.length - 1)) * (W - 16) + 8;
    const y = H - 6 - ((v - min) / (max - min)) * (H - 12);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function render(snap) {
  if (!snap) return;
  renderConnected(snap.connected);
  renderDiagnosis(snap.diagnosis);
  renderCongestion(snap.congestion);
  renderNetworks(snap.networks, snap.environmentStaleSec);
  renderSparkline(snap.history);
  $('last-update').textContent = 'updated ' + new Date(snap.capturedAt).toLocaleTimeString();
  const degraded = snap.diagnosis && snap.diagnosis.scanSupported === false;
  const onlyConnected = (snap.networks || []).length <= 1;
  const noteEl = $('scan-support-note');
  noteEl.textContent = degraded && onlyConnected
    ? 'Per-BSSID detail is not reaching the app on this adapter — the list may stay thin until a full scan lands.'
    : '';
  const degradedErr = snap.errors && snap.errors.length > 0;
  setStatus(degradedErr ? 'Degraded — ' + snap.errors.join(' | ') : 'Live', degradedErr ? 'bad' : 'ok');
}

/* ---------- connect modal ---------- */

let connectTarget = null;
const overlay = $('connect-overlay');

function openConnectModal(btn) {
  connectTarget = { ssid: btn.dataset.ssid, security: btn.dataset.security, securityRaw: btn.dataset.securityraw };
  $('connect-ssid').textContent = connectTarget.ssid;
  $('connect-password').value = '';
  $('connect-result').textContent = '';
  $('connect-result').className = 'connect-result';
  overlay.hidden = false;
  $('connect-password').focus();
}
function closeConnectModal() {
  overlay.hidden = true;
  connectTarget = null;
  $('connect-password').value = ''; // never leave a secret sitting in the DOM
}
$('connect-cancel').addEventListener('click', closeConnectModal);
overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeConnectModal(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !overlay.hidden) closeConnectModal(); });
$('connect-password').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('connect-submit').click(); });

const passwordToggle = $('password-toggle');
passwordToggle.addEventListener('click', () => {
  const input = $('connect-password');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('icon-eye').hidden = !showing;
  $('icon-eye-off').hidden = showing;
  passwordToggle.setAttribute('aria-pressed', String(!showing));
  passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  input.focus();
});

$('networks-body').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.row-connect');
  if (btn && btn.dataset.ssid) openConnectModal(btn);
});

$('connect-submit').addEventListener('click', async () => {
  if (!connectTarget) return;
  const submitBtn = $('connect-submit');
  const resultEl = $('connect-result');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connecting…';
  resultEl.textContent = '';
  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-wifi-detector': '1' },
      body: JSON.stringify({
        ssid: connectTarget.ssid,
        password: $('connect-password').value === '' ? undefined : $('connect-password').value,
        security: connectTarget.security,
        securityRaw: connectTarget.securityRaw,
      }),
    });
    $('connect-password').value = ''; // never hold the secret in the DOM longer than needed
    const data = await res.json().catch(() => ({ ok: false, message: 'Invalid response from the app server.' }));
    resultEl.textContent = data.message || (data.ok ? 'Requested.' : 'Failed.');
    resultEl.className = 'connect-result ' + (data.ok ? 'ok' : 'bad');
    if (data.ok) setTimeout(closeConnectModal, 1200); // snapshot will refresh via SSE
  } catch (err) {
    $('connect-password').value = '';
    resultEl.textContent = 'Could not reach the app server.';
    resultEl.className = 'connect-result bad';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Connect';
  }
});

function connect() {
  const es = new EventSource('/api/events');
  es.onmessage = (ev) => { try { render(JSON.parse(ev.data)); } catch (e) {} };
  es.onerror = () => setStatus('Reconnecting…', 'wait');
}

setStatus('Connecting…', 'wait');
connect();
