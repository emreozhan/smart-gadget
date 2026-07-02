'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  lang: 'tr',
  mini: false,
  alwaysOnTop: false,
  device: null // secili (ilk) cihazin JSON hali
};

const SWATCH_COLORS = ['#ffcc4d', '#ff8a5c', '#ff5c7a', '#b06cff', '#5c8aff', '#4dd0e1', '#6adf8f', '#ffffff'];

function t(key) {
  const entry = (I18N[state.lang] || I18N.tr)[key];
  return typeof entry === 'function' ? entry : (entry || key);
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $('langBtn').textContent = state.lang === 'tr' ? '🇹🇷' : '🇬🇧';
  renderDevice();
}

function applyUi() {
  document.body.classList.toggle('mini', state.mini);
  $('pinBtn').classList.toggle('active', state.alwaysOnTop);
  $('miniBtn').classList.toggle('active', state.mini);
}

// --- Cihaz gorunumu ---

function rgbToHex(rgb) {
  return '#' + Number(rgb || 0xffcc4d).toString(16).padStart(6, '0');
}

function renderDevice() {
  const dev = state.device;
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

  $('deviceName').textContent = dev.name || p.name || dev.model || 'Yeelight';
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

// --- Olaylar ---

$('powerBtn').addEventListener('click', () => {
  if (!state.device) return;
  const isOn = state.device.props.power === 'on';
  window.gadget.setPower(state.device.id, !isOn).catch(() => {});
});

$('brightSlider').addEventListener('input', (e) => {
  if (!state.device) return;
  $('brightVal').textContent = e.target.value + '%';
  window.gadget.setBright(state.device.id, Number(e.target.value));
});

$('ctSlider').addEventListener('input', (e) => {
  if (state.device) window.gadget.setCt(state.device.id, Number(e.target.value));
});

$('colorPicker').addEventListener('input', (e) => {
  if (state.device) window.gadget.setRgb(state.device.id, parseInt(e.target.value.slice(1), 16));
});

function buildSwatches() {
  const wrap = $('swatches');
  for (const hex of SWATCH_COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.addEventListener('click', () => {
      if (!state.device) return;
      $('colorPicker').value = hex;
      window.gadget.setRgb(state.device.id, parseInt(hex.slice(1), 16));
    });
    wrap.appendChild(b);
  }
}

async function scan(statusEl) {
  statusEl.textContent = t('scanning');
  try {
    const list = await window.gadget.discover();
    statusEl.textContent = t('foundDevices')(list.length);
    if (list.length) { state.device = list[0]; renderDevice(); }
  } catch (err) {
    statusEl.textContent = String(err.message || err);
  }
}

$('scanBtn').addEventListener('click', () => scan($('scanStatus')));
$('rescanBtn').addEventListener('click', () => scan({ set textContent(_) {} }));

$('addIpBtn').addEventListener('click', async () => {
  const ip = $('manualIp').value.trim();
  try {
    state.device = await window.gadget.addManual(ip);
    renderDevice();
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

// --- Ana surecten gelen guncellemeler ---

window.gadget.onDeviceState((dev) => {
  if (!state.device || state.device.id === dev.id) {
    state.device = dev;
    renderDevice();
  }
});

window.gadget.onDeviceList((list) => {
  if (list.length) {
    const current = state.device && list.find((d) => d.id === state.device.id);
    state.device = current || list[0];
  } else {
    state.device = null;
  }
  renderDevice();
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
  state.device = init.devices[0] || null;
  applyUi();
  applyLang();
})();
