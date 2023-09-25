const { app, BrowserWindow, dialog, Menu, shell, ipcMain, webContents  } = require('electron')
const path = require('path')
const fs = require('fs')
const url = require('url');
const increment = require('add-filename-increment');
const Jimp = require('jimp')
const Store = require("electron-store")
const hasbin = require('hasbin');
const fontname = require('fontname')
const ColorThief = require('colorthief');
const font2base64 = require("node-font2base64")

const isMac = process.platform === 'darwin'

const store = new Store();
const userFontsFolder = path.join(app.getPath('userData'),"fonts")

if (!fs.existsSync(userFontsFolder)) {
    fs.mkdirSync(userFontsFolder);
}

const imInstalled = hasbin.sync('magick');

ipcMain.on('drop-image', (event, arg) => {
    let json = {}
    ColorThief.getPalette(arg, 8)
        .then(palette => { 
            Jimp.read(arg, (err, image) => {
                if (err) {
                    json.filename = "error not an image"
                    json.image = "error not an image"
                    event.sender.send('add-image-response', json)
                } else {
                    image.getBase64(Jimp.AUTO, (err, ret) => {
                        json.filename = path.basename(arg)
                        json.image = ret
                        json.palette = palette
                        event.sender.send('add-image-response', json)
                    })
                }
            })
        })
        .catch(err => { json.filename = "error not an image"
            json.image = "error not an image"
            event.sender.send('add-image-response', err) 
        })
    
})

ipcMain.on('upload-image', (event, arg) => {
    let json = {}
    const options = {
		defaultPath: store.get("uploadImagePath", app.getPath('pictures')),
		properties: ['openFile'],
		filters: [
			{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'] }
		]
	}
    dialog.showOpenDialog(null, options).then(result => {
        if (!result.canceled) {
            ColorThief.getPalette(result.filePaths[0], 8)
            .then(palette => { 
                Jimp.read(result.filePaths[0], (err, image) => {
                    if (err) {
                        json.filename = "error not an image"
                        json.image = "error not an image"
                        event.sender.send('add-image-response', json)
                    } else {
                        image.getBase64(Jimp.AUTO, (err, ret) => {
                            json.filename = path.basename(result.filePaths[0])
                            json.image = ret
                            json.palette = palette
                            event.sender.send('add-image-response', json)
                        })
                    }
                })
            })
            .catch(err => { json.filename = "error not an image"
                json.image = "error not an image"
                event.sender.send('add-image-response', err) 
            })
        } else {
            res.end()
			  console.log("cancelled")
        }
    })
})

ipcMain.on('upload-font', (event, arg) => {
    let json = {}
    const options = {
		defaultPath: store.get("uploadFontPath", app.getPath('desktop')),
		properties: ['openFile'],
		filters: [
			{ name: 'Fonts', extensions: ['ttf', 'otf'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		if(!result.canceled) {
			store.set("uploadFontPath", path.dirname(result.filePaths[0]))
			const filePath = path.join(userFontsFolder,path.basename(result.filePaths[0]))
			try {
				const fontMeta = fontname.parse(fs.readFileSync(result.filePaths[0]))[0];
				var ext = getExtension(result.filePaths[0])
				var fontPath = url.pathToFileURL(result.filePaths[0])
				json = {
					"status": "ok",
					"fontName": fontMeta.fullName,
					"fontStyle": fontMeta.fontSubfamily,
					"familyName": fontMeta.fontFamily,
					"fontFormat": ext,
					"fontMimetype": 'font/' + ext,
					"fontData": fontPath.href,
					"fontPath": filePath
				};
				fs.copyFileSync(result.filePaths[0], filePath)
				event.sender.send('add-font-response', json)
			} catch (err) {
				json = {
					"status": "error",
					"fontName": path.basename(result.filePaths[0]),
					"fontPath": result.filePaths[0],
					"message": err
				}
				event.sender.send('add-font-response', json)
				//fs.unlinkSync(result.filePaths[0])
			}
		} else {
            json.status = "cancelled"
			event.sender.send('add-font-response', json)
		}
	}).catch(err => {
		console.log(err)
		res.json({
			"status":"error",
			"message": err
		})
		res.end()
	})
})

ipcMain.on('drop-font', (event, arg) => {
    let json = {}
    try {
		const filePath = path.join(userFontsFolder,path.basename(arg))
		const fontMeta = fontname.parse(fs.readFileSync(arg))[0];
		var ext = getExtension(arg)
		var fontPath = url.pathToFileURL(arg)
		json = {
			"status": "ok",
			"fontName": fontMeta.fullName,
			"fontStyle": fontMeta.fontSubfamily,
			"familyName": fontMeta.fontFamily,
			"fontFormat": ext,
			"fontMimetype": 'font/' + ext,
			"fontData": fontPath.href,
			"fontPath": filePath
		};
		fs.copyFileSync(req.query.file, filePath)
		event.sender.send('add-font-response', json)
	} catch (err) {
		json = {
			"status": "error",
			"fontName": path.basename(req.query.file),
			"fontPath": req.query.file,
			"message": err
		}
		event.sender.send('add-font-response', json)
		//fs.unlinkSync(req.query.file)
	}
})

ipcMain.on('save-logo', (event, arg) => {
    const buffer = Buffer.from(arg.image.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const filename = arg.filename
	
	const options = {
		defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + filename+'.png',{fs: true})
	}

    dialog.showSaveDialog(null, options).then((result) => {
        if (!result.canceled) {
            Jimp.read(buffer, (err, image) => {
				if (err) {
					console.log(err);
				} else {
					image.autocrop().resize(300,300);
					image.write(result.filePath);
				}
			})
            event.sender.send('save-logo-response', null)
        } else {
            event.sender.send('save-logo-response', null)
        }
    }).catch((err) => {
        console.log(err);
        event.sender.send('save-logo-response', null)
    });
})

ipcMain.on('local-font-folder', (event, arg) => {
	const jsonObj = {}
	const jsonArr = []

	filenames = fs.readdirSync(userFontsFolder);
	for (i=0; i<filenames.length; i++) {
        console.log(filenames)
		if (path.extname(filenames[i]).toLowerCase() == ".ttf" || path.extname(filenames[i]).toLowerCase() == ".otf") {
			const filePath = path.join(userFontsFolder,filenames[i])
			try {
				const fontMeta = fontname.parse(fs.readFileSync(filePath))[0];
				var ext = getExtension(filePath)
				const dataUrl = font2base64.encodeToDataUrlSync(filePath)
				var fontPath = url.pathToFileURL(filePath)
				var json = {
					"status": "ok",
					"fontName": fontMeta.fullName,
					"fontStyle": fontMeta.fontSubfamily,
					"familyName": fontMeta.fontFamily,
					"fontFormat": ext,
					"fontMimetype": 'font/' + ext,
					"fontData": fontPath.href,
					"fontBase64": dataUrl,
					"fontPath": filePath,
				};
				jsonArr.push(json)
			} catch (err) {
				const json = {
					"status": "error",
					"fontName": path.basename(filePath),
					"fontPath": filePath,
					"message": err
				}
				jsonArr.push(json)
				//fs.unlinkSync(filePath)
			}
		}
	}
	jsonObj.result = "success"
	jsonObj.fonts = jsonArr
	event.sender.send('local-font-folder-response', jsonObj)
})

ipcMain.on('open-font-folder', (event, arg) => {
	shell.openPath(userFontsFolder)
})


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
              label: 'Save Logo',
          },
          {
            click: () => mainWindow.webContents.send('import-image','click'),
            accelerator: isMac ? 'Cmd+I' : 'Control+I',
            label: 'Import Image',
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

    mainWindow.loadURL(`file://${__dirname}/index.html?`)

    //mainWindow.loadURL(`file://${__dirname}/index.html`)
  
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

function getExtension(filename) {
    var ext = path.extname(filename||'').split('.');
	return ext[ext.length - 1];
}