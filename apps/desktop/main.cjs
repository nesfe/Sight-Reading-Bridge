const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const path = require('node:path')

const isDev = !app.isPackaged && process.argv.includes('--development')
const rendererFile = path.join(__dirname, '../../dist/index.html')
const { pathToFileURL } = require('node:url')
const trusted = url => isDev ? url.startsWith('http://127.0.0.1:5173/') : url.split('#')[0] === pathToFileURL(rendererFile).href

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 740,
    title: 'Sight Reading Bridge',
    backgroundColor: '#f3f6fa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(rendererFile)
  }
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault() })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/nesfe/Sight-Reading-Bridge/')) void shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  // Chromium requests the combined MIDI permission even with sysex:false.
  // Restrict it to our own top-level renderer; the client never enables SysEx.
  const midiPermission = permission => permission === 'midi' || permission === 'midiSysex'
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
    !!contents && trusted(contents.getURL()) && details.isMainFrame && midiPermission(permission))
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(trusted(contents.getURL()) && details.isMainFrame && trusted(details.requestingUrl) && midiPermission(permission))
  })
  if (!isDev) session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'"] } }))
  ipcMain.handle('app:get-version', () => app.getVersion())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
