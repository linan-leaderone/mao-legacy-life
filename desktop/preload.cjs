const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopBridge', {
  readLocalSettings: () => ipcRenderer.invoke('read-local-settings'),
  requestApi: request => ipcRenderer.invoke('api-request',request),
  cancelApi: id => ipcRenderer.invoke('api-cancel',id),
  saveText: (filename, content) => ipcRenderer.invoke('save-text', filename, content)
});
