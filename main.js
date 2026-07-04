'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { discover, sweepDiscover, queryOne, YeelightDevice } = require('./src/yeelight');
const { Store } = require('./src/store');

const NORMAL_SIZE = { width: 390, height: 570 };
const MINI_SIZE = { width: 460, height: 66 };
const MINI_OPACITY = 0.8;

const STRINGS = {
  tr: { show: 'Göster', hide: 'Gizle', on: 'Lambayı Aç', off: 'Lambayı Kapat', mini: 'Mini mod', pin: 'Her zaman üstte', quit: 'Çıkış' },
  en: { show: 'Show', hide: 'Hide', on: 'Turn Lamp On', off: 'Turn Lamp Off', mini: 'Mini mode', pin: 'Always on top', quit: 'Quit' }
};

let win = null;
let tray = null;
let store = null;
let quitting = false;
const devices = new Map(); // id -> YeelightDevice

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(init);
}

function init() {
  store = new Store(app.getPath('userData'));
  createWindow();
  createTray();
  for (const saved of store.get('devices')) attachDevice(new YeelightDevice(saved));
  // Acilista arka planda tarama: yeni lamba varsa listeye eklenir.
  runDiscovery().catch(() => {});
}

function createWindow() {
  const mini = store.get('mini');
  const bounds = mini ? store.get('miniBounds') : store.get('windowBounds');
  const size = mini ? MINI_SIZE : NORMAL_SIZE;
  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: bounds ? bounds.x : undefined,
    y: bounds ? bounds.y : undefined,
    minWidth: 340,
    minHeight: MINI_SIZE.height,
    resizable: !mini,
    maximizable: false,
    frame: false, // basligi uygulama ciziyor; mini modda hic baslik yok
    alwaysOnTop: store.get('alwaysOnTop'),
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (store.get('alwaysOnTop')) win.setAlwaysOnTop(true, 'floating');
  if (mini) win.setOpacity(MINI_OPACITY);
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Kapatma tusu uygulamayi tepsiye gizler; gercek cikis tepsi menusunden.
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('moved', saveBounds);
  win.on('resized', saveBounds);
}

function saveBounds() {
  if (!win) return;
  const b = win.getBounds();
  if (store.get('mini')) store.set('miniBounds', { x: b.x, y: b.y });
  else store.set('windowBounds', b);
}

function trayIcon(on) {
  return nativeImage.createFromPath(
    path.join(__dirname, 'assets', on ? 'tray.png' : 'tray-off.png')
  );
}

function isDisabled(id) {
  return (store.get('disabled') || []).includes(id);
}

function deviceJSON(d) {
  return { ...d.toJSON(), enabled: !isDisabled(d.id) };
}

function selectedDevice() {
  const sel = devices.get(store.get('selectedId'));
  if (sel && !isDisabled(sel.id)) return sel;
  for (const d of devices.values()) if (!isDisabled(d.id)) return d;
  return null;
}

function createTray() {
  const dev = selectedDevice();
  tray = new Tray(trayIcon(dev ? dev.props.power === 'on' : false));
  tray.setToolTip('Smart Gadget');
  tray.on('click', () => {
    if (win.isVisible()) win.hide();
    else { win.show(); win.focus(); }
  });
  updateTrayMenu();
}

function deviceLabel(dev) {
  return dev.name || dev.props.name || dev.model || dev.ip;
}

function updateTrayMenu() {
  const t = STRINGS[store.get('lang')] || STRINGS.tr;
  const dev = selectedDevice();
  tray.setImage(trayIcon(!!(dev && dev.props.power === 'on')));
  // Her (etkin) cihaz icin ayri ac/kapat anahtari.
  const deviceItems = [...devices.values()].filter((d) => !isDisabled(d.id)).map((d) => ({
    label: deviceLabel(d),
    type: 'checkbox',
    checked: d.props.power === 'on',
    enabled: d.connected,
    click: () => d.setPower(d.props.power !== 'on').catch(() => {})
  }));
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: win && win.isVisible() ? t.hide : t.show,
      click: () => { if (win.isVisible()) win.hide(); else { win.show(); win.focus(); } }
    },
    { type: 'separator' },
    ...deviceItems,
    { type: 'separator' },
    { label: t.mini, type: 'checkbox', checked: store.get('mini'), click: (item) => setMini(item.checked) },
    { label: t.pin, type: 'checkbox', checked: store.get('alwaysOnTop'), click: (item) => setPin(item.checked) },
    { type: 'separator' },
    { label: t.quit, click: () => { quitting = true; app.quit(); } }
  ]));
}

function attachDevice(dev) {
  if (devices.has(dev.id)) return devices.get(dev.id);
  devices.set(dev.id, dev);
  dev.on('props', () => {
    if (win) win.webContents.send('device:state', deviceJSON(dev));
    updateTrayMenu();
  });
  dev.on('connection', (ok) => {
    console.log(`device ${dev.ip}: ${ok ? 'connected' : 'disconnected'}`);
    if (win) win.webContents.send('device:state', deviceJSON(dev));
    updateTrayMenu();
  });
  if (!isDisabled(dev.id)) dev.connect(); // devre disi cihaza baglanma
  return dev;
}

function persistDevices() {
  store.set('devices', [...devices.values()].map((d) => ({
    id: d.id, ip: d.ip, port: d.port, name: d.name, model: d.model, fw: d.fw, support: d.support
  })));
}

function sendDeviceList() {
  if (win) win.webContents.send('devices:list', [...devices.values()].map(deviceJSON));
}

async function runDiscovery() {
  let found = await discover(3000);
  // Multicast engellenmis olabilir (istemci izolasyonu vb.) — port taramasiyla dene.
  if (!found.length) found = await sweepDiscover();
  console.log(`discovery: ${found.length} device(s)`, found.map((d) => `${d.ip} (${d.model || 'model?'})`).join(', '));
  for (const info of found) {
    const existing = devices.get(info.id);
    if (existing) {
      // IP degismis olabilir (DHCP); yeniden baglan.
      if (existing.ip !== info.ip) {
        existing.close();
        devices.delete(info.id);
        attachDevice(new YeelightDevice(info));
      } else {
        // Eski kayitlarda eksik olabilecek meta bilgileri tazele.
        existing.model = info.model || existing.model;
        existing.fw = info.fw || existing.fw;
        if (info.support && info.support.length) existing.support = info.support;
      }
    } else {
      attachDevice(new YeelightDevice(info));
    }
  }
  persistDevices();
  sendDeviceList();
  return [...devices.values()].map(deviceJSON);
}

function setMini(mini) {
  saveBounds();
  store.set('mini', mini);
  const size = mini ? MINI_SIZE : NORMAL_SIZE;
  const bounds = mini ? store.get('miniBounds') : store.get('windowBounds');
  win.setResizable(true);
  win.setBounds({
    width: bounds && bounds.width ? bounds.width : size.width,
    height: bounds && bounds.height && !mini ? bounds.height : size.height,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {})
  });
  win.setResizable(!mini);
  win.setOpacity(mini ? MINI_OPACITY : 1);
  sendUiState();
  updateTrayMenu();
}

function setPin(pin) {
  store.set('alwaysOnTop', pin);
  win.setAlwaysOnTop(pin, 'floating');
  sendUiState();
  updateTrayMenu();
}

function sendUiState() {
  if (win) {
    win.webContents.send('ui:state', {
      mini: store.get('mini'),
      alwaysOnTop: store.get('alwaysOnTop'),
      lang: store.get('lang')
    });
  }
}

// --- IPC ---

ipcMain.handle('app:getInitial', () => ({
  mini: store.get('mini'),
  alwaysOnTop: store.get('alwaysOnTop'),
  lang: store.get('lang'),
  selectedId: store.get('selectedId'),
  devices: [...devices.values()].map(deviceJSON)
}));

// Cihazi devre disi birak / etkinlestir. Devre disi: baglanti kesilir,
// sekmelerde/tepside gorunmez; kayit silinmez, tekrar etkinlestirilebilir.
ipcMain.handle('devices:setEnabled', (_e, id, enabled) => {
  const disabled = new Set(store.get('disabled') || []);
  if (enabled) disabled.delete(id); else disabled.add(id);
  store.set('disabled', [...disabled]);
  const dev = devices.get(id);
  if (dev) {
    if (enabled) {
      // close() kalici oldugundan cihazi ayni bilgilerle yeniden olustur.
      const info = { id: dev.id, ip: dev.ip, port: dev.port, name: dev.name, model: dev.model, fw: dev.fw, support: dev.support };
      dev.close();
      devices.delete(id);
      attachDevice(new YeelightDevice(info));
    } else {
      dev.close(); // haritada kalir ki listede gorunup tekrar acilabilsin
    }
  }
  sendDeviceList();
  updateTrayMenu();
});

ipcMain.handle('ui:selectDevice', (_e, id) => {
  store.set('selectedId', id);
  updateTrayMenu();
});

ipcMain.handle('devices:discover', () => runDiscovery());

ipcMain.handle('devices:addManual', async (_e, ip) => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error('invalid ip');
  // Model/yetenek bilgisi icin once SSDP ile sorgula; yanit yoksa duz IP ekle.
  const info = (await queryOne(ip)) || { ip };
  const dev = attachDevice(new YeelightDevice(info));
  persistDevices();
  sendDeviceList();
  return deviceJSON(dev);
});

ipcMain.handle('devices:remove', (_e, id) => {
  const dev = devices.get(id);
  if (dev) { dev.close(); devices.delete(id); }
  persistDevices();
  sendDeviceList();
});

ipcMain.handle('device:power', async (_e, id, on) => {
  const dev = devices.get(id);
  if (!dev) throw new Error('device not found');
  await dev.setPower(on);
  dev.props.power = on ? 'on' : 'off'; // props bildirimi gecikebilir; UI'yi hemen guncelle
  win.webContents.send('device:state', dev.toJSON());
  updateTrayMenu();
  // Yumusak gecis sirasinda lamba ara parlaklik degerleri bildirir ve son
  // deger kacabilir; gecis bittikten sonra gercek durumu tekrar oku.
  setTimeout(() => dev.refresh().catch(() => {}), 800);
});

// Debug popup'i icin anlik cihaz bilgisi: guncel gecikmeyi olcmek icin
// hafif bir get_prop atar (popup 2 sn'de bir sordugu icin kota sorunu olmaz).
ipcMain.handle('device:debug', async (_e, id) => {
  const dev = devices.get(id);
  if (!dev) throw new Error('device not found');
  if (dev.connected) {
    try { await dev.send('get_prop', ['power']); } catch (_) { /* gecikme stats'ta kalir */ }
  }
  return dev.toJSON();
});

ipcMain.on('device:bright', (_e, id, value) => {
  const dev = devices.get(id);
  if (dev) dev.setBright(value);
});

ipcMain.on('device:rgb', (_e, id, rgb) => {
  const dev = devices.get(id);
  if (dev) dev.setRgb(rgb);
});

ipcMain.on('device:ct', (_e, id, kelvin) => {
  const dev = devices.get(id);
  if (dev) dev.setCt(kelvin);
});

ipcMain.on('ui:minimize', () => win.minimize());
ipcMain.on('ui:hideWindow', () => { win.hide(); updateTrayMenu(); });

ipcMain.handle('ui:setMini', (_e, mini) => setMini(mini));
// Mini mod yari saydam; imlec penceredeyken gecici olarak netlesir.
ipcMain.on('ui:hover', (_e, hover) => {
  if (store.get('mini')) win.setOpacity(hover ? 1 : MINI_OPACITY);
});
ipcMain.handle('ui:setPin', (_e, pin) => setPin(pin));
ipcMain.handle('ui:setLang', (_e, lang) => {
  store.set('lang', lang === 'en' ? 'en' : 'tr');
  updateTrayMenu();
});

app.on('before-quit', () => {
  quitting = true;
  store.flush();
  for (const dev of devices.values()) dev.close();
});

app.on('window-all-closed', () => { /* tepside yasamaya devam */ });
