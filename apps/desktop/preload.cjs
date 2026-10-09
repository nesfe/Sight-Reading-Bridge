const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sightReadingBridge', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getFullscreen: () => ipcRenderer.invoke('window:get-fullscreen'),
  setFullscreen: value => ipcRenderer.invoke('window:set-fullscreen', value),
  onFullscreen: callback => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('window:fullscreen', listener)
    return () => ipcRenderer.removeListener('window:fullscreen', listener)
  },
})
