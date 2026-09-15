const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sightReadingBridge', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
})
