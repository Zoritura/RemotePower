'use strict';
// No inline scripts (strict CSP). All dynamic text uses textContent only.
const $ = (id) => document.getElementById(id);
const views = ['login', 'main', 'confirm', 'count', 'done'];
let csrf = '', chosen = '', endsAt = 0, current = 'login', busy = false;

function show(v) { current = v; views.forEach((n) => { $('v-' + n).hidden = n !== v; }); }
function msg(t) { $('msg').textContent = t || ''; }
function pill(state, text) { $('dot').className = 'dot ' + state; $('pillText').textContent = text; }

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRF-Token'] = csrf;
  try {
    const r = await fetch(url, { method, headers, credentials: 'same-origin',
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined });
    let data = {}; try { data = await r.json(); } catch { /* ignore */ }
    return { status: r.status, data };
  } catch { return { status: 0, data: {} }; }
}

async function refresh() {
  const { status, data } = await api('GET', '/api/status');
  if (status === 0) { pill('offline', 'Offline'); return; }
  if (!data.authed) {
    csrf = ''; pill('online', 'Online');
    if (current !== 'login') show('login');
    return;
  }
  csrf = data.csrf;
  if (data.pending) {
    endsAt = Date.now() + data.pending.remaining * 1000;
    pill('pending', (data.pending.action === 'sleep' ? 'Sleep' : 'Shutdown') + ' pending');
    $('countText').textContent = data.pending.action === 'sleep' ? 'Going to sleep in' : 'Shutting down in';
    if (current !== 'count') show('count');
    return;
  }
  pill('online', 'Online');
  $('lastAction').textContent = data.last && data.last.at
    ? `Last action: ${data.last.text} (${new Date(data.last.at).toLocaleTimeString()})` : 'Last action: none';
  if (current === 'count') { $('doneText').textContent = 'Command sent. ' + data.last.text; show('done'); }
  else if (current === 'login') show('main');
}

setInterval(() => { // local countdown ticker
  if (current === 'count') $('countNum').textContent = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}, 250);
setInterval(() => { if (!document.hidden) refresh(); }, 2000);

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); msg('');
  const r = await api('POST', '/api/login', { password: $('pw').value });
  $('pw').value = '';
  if (r.status === 200) { csrf = r.data.csrf; await refresh(); show('main'); }
  else if (r.status === 429) msg('Too many attempts. Wait and try again.');
  else msg('Login failed.');
});

function choose(action) {
  chosen = action; msg('');
  $('confirmTitle').textContent = action === 'sleep' ? 'Put PC to sleep?' : 'Shut down PC?';
  $('slider').value = 0; show('confirm');
}
$('btnShutdown').addEventListener('click', () => choose('shutdown'));
$('btnSleep').addEventListener('click', () => choose('sleep'));
$('btnBack').addEventListener('click', () => show('main'));

$('slider').addEventListener('change', async () => {
  const s = $('slider');
  if (+s.value < 100 || busy) { s.value = 0; return; }
  busy = true;
  const r = await api('POST', '/api/action', { action: chosen });
  busy = false; s.value = 0;
  if (r.status === 200) await refresh();
  else { msg(r.status === 401 ? 'Session expired.' : 'Could not start the action.'); await refresh(); if (r.status !== 401) show('main'); }
});

async function cancel() {
  const r = await api('POST', '/api/cancel');
  msg(r.status === 200 ? '' : 'Cancel failed.');
  if (r.status === 200) { $('doneText').textContent = 'Cancelled.'; show('done'); }
  refresh();
}
$('btnCancelBig').addEventListener('click', cancel);
$('btnCancelSched').addEventListener('click', cancel);
$('btnDone').addEventListener('click', () => show('main'));
$('btnLogout').addEventListener('click', async () => { await api('POST', '/api/logout'); csrf = ''; show('login'); });

refresh().then(() => { if (current === 'login' && csrf) show('main'); });
show('login');