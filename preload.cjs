const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ron', {
  bootstrap: () => ipcRenderer.invoke('bootstrap'),
  connections: () => ipcRenderer.invoke('connections'),
  saveSettings: value => ipcRenderer.invoke('settings:save', value),
  history: () => ipcRenderer.invoke('history:list'),
  loadHistory: id => ipcRenderer.invoke('history:load', id),
  start: value => ipcRenderer.invoke('run:start', value),
  retry: id => ipcRenderer.invoke('run:retry', id),
  stop: () => ipcRenderer.invoke('run:stop'),
  copy: text => ipcRenderer.invoke('clipboard:write', text),
  paste: () => ipcRenderer.invoke('clipboard:read'),
  openLink: url => ipcRenderer.invoke('link:open', url),
  openJarvis: () => ipcRenderer.invoke('jarvis:open'),
  avatarInfo: () => ipcRenderer.invoke('avatar:info'),
  avatarIce: () => ipcRenderer.invoke('avatar:ice'),
  avatarOffer: offer => ipcRenderer.invoke('avatar:offer', offer),
  avatarSpeak: text => ipcRenderer.invoke('avatar:speak', text),
  avatarLeave: () => ipcRenderer.invoke('avatar:leave'),
  onRun: fn => { const listener = (_event, run) => fn(run); ipcRenderer.on('run:update', listener); return () => ipcRenderer.removeListener('run:update', listener); },
  onIdle: fn => { const listener = () => fn(); ipcRenderer.on('run:idle', listener); return () => ipcRenderer.removeListener('run:idle', listener); }
});
