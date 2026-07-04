'use strict';

// Basit JSON ayar deposu (userData/settings.json). Yazmalar debounce'lu.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  devices: [],            // { id, ip, port, name, model, fw, support }
  selectedId: null,       // arayuzde ve tepside secili cihaz
  disabled: [],           // yonetilmeyecek (devre disi) cihaz id'leri
  windowBounds: null,     // { x, y, width, height } — normal mod
  miniBounds: null,       // { x, y } — mini mod konumu
  mini: false,
  alwaysOnTop: false,
  lang: 'tr'
};

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'settings.json');
    this.data = { ...DEFAULTS };
    this._saveTimer = null;
    try {
      Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch (_) { /* ilk calistirma */ }
  }

  get(key) { return this.data[key]; }

  set(key, value) {
    this.data[key] = value;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this._saveTimer);
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('settings save failed:', err.message);
    }
  }
}

module.exports = { Store };
