'use strict';

// Simple JSON settings store (userData/settings.json) with debounced writes.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  devices: [],            // { id, ip, port, name, model, fw, support }
  selectedId: null,       // Selected device in the UI and system tray
  disabled: [],           // IDs of unmanaged (disabled) devices
  windowBounds: null,     // { x, y, width, height } — Normal mode
  miniBounds: null,       // { x, y } — Mini mode position
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
    } catch (_) { /* First run */ }
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
