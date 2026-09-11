'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gadget', {
  getInitial: () => ipcRenderer.invoke('app:getInitial'),
  discover: () => ipcRenderer.invoke('devices:discover'),
  addManual: (ip) => ipcRenderer.invoke('devices:addManual', ip),
  removeDevice: (id) => ipcRenderer.invoke('devices:remove', id),
  selectDevice: (id) => ipcRenderer.invoke('ui:selectDevice', id),
  getDebug: (id) => ipcRenderer.invoke('device:debug', id),
  setDeviceEnabled: (id, enabled) => ipcRenderer.invoke('devices:setEnabled', id, enabled),
  renameDevice: (id, name) => ipcRenderer.invoke('devices:rename', id, name),
  setPower: (id, on) => ipcRenderer.invoke('device:power', id, on),
  setBright: (id, value) => ipcRenderer.send('device:bright', id, value),
  setRgb: (id, rgb) => ipcRenderer.send('device:rgb', id, rgb),
  setCt: (id, kelvin) => ipcRenderer.send('device:ct', id, kelvin),
  setMini: (mini) => ipcRenderer.invoke('ui:setMini', mini),
  setHover: (hover) => ipcRenderer.send('ui:hover', hover),
  minimize: () => ipcRenderer.send('ui:minimize'),
  hideWindow: () => ipcRenderer.send('ui:hideWindow'),
  setPin: (pin) => ipcRenderer.invoke('ui:setPin', pin),
  setLang: (lang) => ipcRenderer.invoke('ui:setLang', lang),
  onDeviceState: (cb) => ipcRenderer.on('device:state', (_e, dev) => cb(dev)),
  onDeviceList: (cb) => ipcRenderer.on('devices:list', (_e, list) => cb(list)),
  onUiState: (cb) => ipcRenderer.on('ui:state', (_e, state) => cb(state))
});
