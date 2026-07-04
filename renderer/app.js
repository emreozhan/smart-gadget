'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  lang: 'tr',
  mini: false,
  alwaysOnTop: false,
  devices: [],      // ana surecten gelen cihaz JSON'lari
  selectedId: null
};

const SWATCH_COLORS = ['#ffcc4d', '#ff8a5c', '#ff5c7a', '#b06cff', '#5c8aff', '#4dd0e1', '#6adf8f', '#ffffff'];

function t(key) {
  const entry = (I18N[state.lang] || I18N.tr)[key];
  return typeof entry === 'function' ? entry : (entry || key);
}

function enabledDevices() {
  return state.devices.filter((d) => d.enabled !== false);
}

function selectedDevice() {
  const list = enabledDevices();
  return list.find((d) => d.id === state.selectedId) || list[0] || null;
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $('langBtn').textContent = state.lang === 'tr' ? '🇹🇷' : '🇬🇧';
  renderAll();
}

function applyUi() {
  document.body.classList.toggle('mini', state.mini);
  $('pinBtn').classList.toggle('active', state.alwaysOnTop);
  $('miniBtn').classList.toggle('active', state.mini);
  // Mini modda ust bar gizlendigi icin islevsel butonlar (pin, mini, gizle)
  // kompakt satirin sonuna tasinir; normal modda ust bara geri doner.
  if (state.mini) {
    $('miniCtrls').append($('pinBtn'), $('miniBtn'), $('closeBtn'));
  } else {
    $('topbarBtns').append($('pinBtn'), $('miniBtn'), $('minBtn'), $('closeBtn'));
  }
}

// --- Cihaz sekmeleri ---

function deviceLabel(dev) {
  return dev.name || (dev.props && dev.props.name) || dev.model || dev.ip;
}

function renderMiniSelect() {
  const sel = $('miniDeviceSelect');
  const current = selectedDevice();
  sel.innerHTML = '';
  for (const dev of enabledDevices()) {
    const opt = document.createElement('option');
    opt.value = dev.id;
    opt.textContent = (dev.props && dev.props.power === 'on' ? '● ' : '○ ') + deviceLabel(dev);
    sel.appendChild(opt);
  }
  if (current) sel.value = current.id;
}

function renderTabs() {
  const wrap = $('deviceTabs');
  wrap.innerHTML = '';
  const list = enabledDevices();
  // Tek cihaz varken sekme cubugu gereksiz.
  wrap.classList.toggle('hidden', list.length < 2);
  const sel = selectedDevice();
  for (const dev of list) {
    const b = document.createElement('button');
    b.className = 'tab' + (sel && dev.id === sel.id ? ' active' : '');
    const dot = document.createElement('span');
    dot.className = 'tab-dot' + (dev.props && dev.props.power === 'on' ? ' on' : '');
    b.appendChild(dot);
    b.appendChild(document.createTextNode(deviceLabel(dev)));
    b.title = dev.ip;
    b.addEventListener('click', () => {
      state.selectedId = dev.id;
      window.gadget.selectDevice(dev.id);
      renderAll();
    });
    wrap.appendChild(b);
  }
}

// --- Cihaz gorunumu ---

function rgbToHex(rgb) {
  return '#' + Number(rgb || 0xffcc4d).toString(16).padStart(6, '0');
}

function renderDevice() {
  const dev = selectedDevice();
  $('emptyState').classList.toggle('hidden', !!dev);
  $('deviceView').classList.toggle('hidden', !dev);
  if (!dev) return;

  const p = dev.props || {};
  const isOn = p.power === 'on';
  // Yetenekler: SSDP "support" listesi varsa tek gecerli kaynak odur (ornegin
  // "monoa" gibi sabit beyaz lambalar ct=2700 bildirir ama set_ct_abx
  // desteklemez). Liste yoksa lambanin bildirdigi prop'lara bakilir.
  const support = dev.support || [];
  const hasColor = support.length ? support.includes('set_rgb') : (p.rgb != null && p.rgb !== '');
  const hasCt = support.length ? support.includes('set_ct_abx') : (p.ct != null && p.ct !== '');
  $('colorRow').classList.toggle('hidden', !hasColor);
  $('ctRow').classList.toggle('hidden', !hasCt);
  $('deviceView').classList.toggle('no-color', !hasColor);

  $('deviceName').textContent = deviceLabel(dev);
  $('deviceInfo').textContent = `${dev.model || ''} · ${dev.ip} · ${dev.connected ? t('connected') : t('disconnected')}`;
  $('connDot').classList.toggle('on', dev.connected);

  $('powerBtn').classList.toggle('on', isOn);
  $('powerLabel').textContent = isOn ? t('turnOff') : t('turnOn');

  // Kullanici surukleme ortasindayken slider'i geri cekme.
  if (document.activeElement !== $('brightSlider') && p.bright != null) {
    $('brightSlider').value = Number(p.bright);
    $('brightVal').textContent = Math.round(Number(p.bright)) + '%';
  }
  if (document.activeElement !== $('ctSlider') && p.ct) {
    $('ctSlider').value = Number(p.ct);
  }
  if (p.rgb && Number(p.color_mode) === 1) {
    $('colorPicker').value = rgbToHex(p.rgb);
  }
}

function renderDeviceManager() {
  const wrap = $('devRows');
  wrap.innerHTML = '';
  for (const dev of state.devices) {
    const enabled = dev.enabled !== false;
    const row = document.createElement('label');
    row.className = 'dev-row' + (enabled ? '' : ' off');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = enabled;
    chk.addEventListener('change', () => {
      window.gadget.setDeviceEnabled(dev.id, chk.checked).catch(() => {});
    });
    const name = document.createElement('span');
    name.className = 'dev-name';
    name.textContent = deviceLabel(dev);
    const ip = document.createElement('span');
    ip.className = 'dev-ip';
    ip.textContent = dev.ip;
    row.append(chk, name, ip);
    wrap.appendChild(row);
  }
}

function renderAll() {
  renderTabs();
  renderMiniSelect();
  renderDevice();
  renderDeviceManager();
}

// --- Olaylar ---

$('powerBtn').addEventListener('click', () => {
  const dev = selectedDevice();
  if (!dev) return;
  window.gadget.setPower(dev.id, dev.props.power !== 'on').catch(() => {});
});

$('brightSlider').addEventListener('input', (e) => {
  const dev = selectedDevice();
  if (!dev) return;
  $('brightVal').textContent = e.target.value + '%';
  window.gadget.setBright(dev.id, Number(e.target.value));
});

$('ctSlider').addEventListener('input', (e) => {
  const dev = selectedDevice();
  if (dev) window.gadget.setCt(dev.id, Number(e.target.value));
});

$('colorPicker').addEventListener('input', (e) => {
  const dev = selectedDevice();
  if (dev) window.gadget.setRgb(dev.id, parseInt(e.target.value.slice(1), 16));
});

function buildSwatches() {
  const wrap = $('swatches');
  for (const hex of SWATCH_COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.addEventListener('click', () => {
      const dev = selectedDevice();
      if (!dev) return;
      $('colorPicker').value = hex;
      window.gadget.setRgb(dev.id, parseInt(hex.slice(1), 16));
    });
    wrap.appendChild(b);
  }
}

async function scan(statusEl) {
  $('rescanBtn').classList.add('spin');
  statusEl.textContent = t('scanning');
  try {
    const list = await window.gadget.discover();
    statusEl.textContent = t('foundDevices')(list.length);
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  } finally {
    $('rescanBtn').classList.remove('spin');
  }
}

$('scanBtn').addEventListener('click', () => scan($('scanStatus')));
$('rescanBtn').addEventListener('click', () => scan({ set textContent(_) {} }));

$('addIpBtn').addEventListener('click', async () => {
  const ip = $('manualIp').value.trim();
  try {
    const dev = await window.gadget.addManual(ip);
    state.selectedId = dev.id;
    renderAll();
  } catch (_) {
    $('scanStatus').textContent = t('invalidIp');
  }
});

$('langBtn').addEventListener('click', () => {
  state.lang = state.lang === 'tr' ? 'en' : 'tr';
  window.gadget.setLang(state.lang);
  applyLang();
});

$('pinBtn').addEventListener('click', () => window.gadget.setPin(!state.alwaysOnTop));
$('miniBtn').addEventListener('click', () => window.gadget.setMini(!state.mini));
$('minBtn').addEventListener('click', () => window.gadget.minimize());
$('closeBtn').addEventListener('click', () => window.gadget.hideWindow());

// --- Debug popup ---

let debugTimer = null;

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + 'sa ' : '') + (m ? m + 'dk ' : '') + (s % 60) + 'sn';
}

function dbgRow(rows, key, value) {
  rows.push({ key, value });
}

async function updateDebug() {
  const dev = selectedDevice();
  const wrap = $('dbgRows');
  if (!dev) { wrap.textContent = t('noDevice'); return; }
  let d;
  try {
    d = await window.gadget.getDebug(dev.id);
  } catch (_) {
    return; // cihaz listeden kalkmis olabilir; popup bir sonraki turda toparlar
  }
  const p = d.props || {};
  const st = d.stats || {};
  const rows = [];
  dbgRow(rows, 'Model', (d.model || '—') + (d.fw ? ' (fw ' + d.fw + ')' : ''));
  dbgRow(rows, 'IP', d.ip + ':' + d.port);
  dbgRow(rows, 'ID', d.id);
  dbgRow(rows, t('dbgStatus'), d.connected ? t('connected') : t('disconnected'));
  if (d.connected && st.connectedAt) dbgRow(rows, t('dbgUptime'), fmtDuration(Date.now() - st.connectedAt));
  dbgRow(rows, t('dbgLatency'), st.lastLatency != null ? st.lastLatency + ' ms' : '—');
  dbgRow(rows, '§' + t('dbgTraffic'), '');
  dbgRow(rows, '↑ / ↓', st.tx + ' / ' + st.rx);
  dbgRow(rows, t('dbgNotifications'), String(st.notifications || 0));
  dbgRow(rows, t('dbgReconnects'), String(st.reconnects || 0));
  dbgRow(rows, '§' + t('dbgState'), '');
  dbgRow(rows, t('turnOn') + '/' + t('turnOff'), p.power || '—');
  if (p.bright != null) dbgRow(rows, t('brightness'), p.bright + '%');
  if (p.ct) dbgRow(rows, t('colorTemp'), p.ct + ' K');
  if (p.rgb != null && p.rgb !== '') dbgRow(rows, 'RGB', '#' + Number(p.rgb).toString(16).padStart(6, '0'));
  if (p.color_mode != null) dbgRow(rows, 'color_mode', String(p.color_mode));
  dbgRow(rows, '§' + t('dbgSupport') + ' (' + (d.support || []).length + ')', '');
  dbgRow(rows, '', (d.support || []).join(' ') || '—');

  wrap.innerHTML = '';
  for (const r of rows) {
    if (r.key.startsWith('§')) {
      const sec = document.createElement('div');
      sec.className = 'dbg-section';
      sec.textContent = r.key.slice(1);
      wrap.appendChild(sec);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'dbg-row';
    const k = document.createElement('span'); k.className = 'k'; k.textContent = r.key;
    const v = document.createElement('span'); v.className = 'v'; v.textContent = r.value;
    row.append(k, v);
    wrap.appendChild(row);
  }
}

function setDebugOpen(open) {
  $('debugPopup').classList.toggle('hidden', !open);
  $('debugBtn').classList.toggle('active', open);
  clearInterval(debugTimer);
  if (open) {
    updateDebug();
    debugTimer = setInterval(updateDebug, 2000);
  }
}

$('debugBtn').addEventListener('click', () => setDebugOpen($('debugPopup').classList.contains('hidden')));
$('debugCloseBtn').addEventListener('click', () => setDebugOpen(false));

// --- Cihaz yonetimi popup'i ---

$('devicesBtn').addEventListener('click', () => {
  const pop = $('devicesPopup');
  const show = pop.classList.contains('hidden');
  pop.classList.toggle('hidden', !show);
  $('devicesBtn').classList.toggle('active', show);
  if (show) renderDeviceManager();
});
$('devicesCloseBtn').addEventListener('click', () => {
  $('devicesPopup').classList.add('hidden');
  $('devicesBtn').classList.remove('active');
});

$('miniDeviceSelect').addEventListener('change', (e) => {
  state.selectedId = e.target.value;
  window.gadget.selectDevice(state.selectedId);
  renderAll();
});

// Mini mod yari saydam; imlec uzerindeyken netlessin.
document.addEventListener('mouseenter', () => window.gadget.setHover(true));
document.addEventListener('mouseleave', () => window.gadget.setHover(false));

// --- Ana surecten gelen guncellemeler ---

window.gadget.onDeviceState((dev) => {
  const i = state.devices.findIndex((d) => d.id === dev.id);
  if (i >= 0) state.devices[i] = dev;
  else state.devices.push(dev);
  renderAll();
});

window.gadget.onDeviceList((list) => {
  state.devices = list;
  if (!list.find((d) => d.id === state.selectedId)) state.selectedId = null;
  renderAll();
});

window.gadget.onUiState((ui) => {
  state.mini = ui.mini;
  state.alwaysOnTop = ui.alwaysOnTop;
  applyUi();
});

// --- Baslangic ---

(async () => {
  buildSwatches();
  const init = await window.gadget.getInitial();
  state.lang = init.lang;
  state.mini = init.mini;
  state.alwaysOnTop = init.alwaysOnTop;
  state.devices = init.devices;
  state.selectedId = init.selectedId;
  applyUi();
  applyLang();
})();
