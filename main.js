const { app, BrowserWindow, dialog, Menu, shell, webContents  } = require('electron')

const isMac = process.platform === 'darwin'

function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1280,
      height: 780,
      icon: (__dirname + '/images/icon.png'),
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
      }
    })
    
    const template = [
      ...(isMac ? [{
          label: app.name,
          submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
          ]
      }] : []),
      {
          label: 'File',
          submenu: [
/*           {
              click: () => mainWindow.webContents.send('load','click'),
              accelerator: isMac ? 'Cmd+L' : 'Control+L',
              label: 'Load Font',
          }, */
          {
              click: () => mainWindow.webContents.send('save','click'),
              accelerator: isMac ? 'Cmd+S' : 'Control+S',
              label: 'Save Font',
          },
          isMac ? { role: 'close' } : { role: 'quit' }
          ]
      },
      {
          label: 'View',
          submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
          ]
      },
      {
          label: 'Window',
          submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(isMac ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
          ] : [
              { role: 'close' }
          ])
          ]
      },
      {
          role: 'help',
          submenu: [
          {
              click: () => mainWindow.webContents.send('about','click'),
                  label: 'About the OOTP Font Maker',
          },
          {
              label: 'About OOTP Baseball',
              click: async () => {    
              await shell.openExternal('https://www.ootpdevelopments.com/out-of-the-park-baseball-home/')
              }
          },
          {
              label: 'About Node.js',
              click: async () => {    
              await shell.openExternal('https://nodejs.org/en/about/')
              }
          },
          {
              label: 'About Electron',
              click: async () => {
              await shell.openExternal('https://electronjs.org')
              }
          },
          {
              label: 'View project on GitHub',
              click: async () => {
              await shell.openExternal('https://github.com/eriqjaffe/OOTP-Font-Maker')
              }
          }
          ]
      }
      ]
      
      const menu = Menu.buildFromTemplate(template)
      Menu.setApplicationMenu(menu)
  
    //mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}&preferredColorFormat=${preferredColorFormat}&preferredTexture=${preferredTexture}`);

    //mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}`)

    mainWindow.loadURL(`file://${__dirname}/index.html`)
  
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  
    // Open the DevTools.
    //mainWindow.maximize()
    //mainWindow.webContents.openDevTools()
    
  }
  
  app.whenReady().then(() => {
        createWindow()
  
        app.on('activate', function () {
          if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
  })
  
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  })

