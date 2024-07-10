const { app, BrowserWindow, dialog, Menu, shell, ipcMain, webContents  } = require('electron')
const os = require('os')
const path = require('path')
const fs = require('fs')
const url = require('url');
const increment = require('add-filename-increment');
const Jimp = require('jimp')
const Store = require("electron-store")
const fontname = require('fontname')
const ColorThief = require('colorthief');
const font2base64 = require("node-font2base64")
const chokidar = require("chokidar")

const isMac = process.platform === 'darwin'
const tempDir = os.tmpdir()

const store = new Store();
const userFontsFolder = path.join(app.getPath('userData'),"fonts")
const userPatternsFolder = path.join(app.getPath('userData'),"patterns")

if (!fs.existsSync(userFontsFolder)) {
    fs.mkdirSync(userFontsFolder);
}

if (!fs.existsSync(userPatternsFolder)) {
    fs.mkdirSync(userPatternsFolder);
}

if (!fs.existsSync(userFontsFolder+"/README.txt")) {
	var writeStream = fs.createWriteStream(userFontsFolder+"/README.txt");
	writeStream.write("TTF and OTF fonts dropped into this folder will automatically be imported into the Logo Maker!\r\n\r\nFonts removed from this folder will still be available in the Logo Maker until you quit the app, and they will not reload after that.")
	writeStream.end()
}

if (!fs.existsSync(userPatternsFolder+"/README.txt")) {
	var writeStream2 = fs.createWriteStream(userPatternsFolder+"/README.txt");
	writeStream2.write("Patterns must be in PNG format.\r\n\r\nPatterns should be transparent - any opaque pixels will appear as the same color in the app.")
	writeStream2.end()
}

const watcher = chokidar.watch(userFontsFolder, {
	ignored: /(^|[\/\\])\../, // ignore dotfiles
	persistent: true
});

watcher.on('ready', () => {})

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
						json.path = arg
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
			store.set("uploadImagePath", path.dirname(result.filePaths[0]))
            ColorThief.getPalette(result.filePaths[0], 8)
            .then(palette => { 
                Jimp.read(result.filePaths[0], (err, image) => {
                    if (err) {
                        json.filename = "error not an image"
                        json.image = "error not an image"
                        event.sender.send('add-image-response', json)
                    } else {
                        image.getBase64(Jimp.AUTO, (err, ret) => {
							json.path = result.filePaths[0]
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
					"fontPath": filePath,
					"destination": arg
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

ipcMain.on('remove-border', (event, arg) => {
	//[theImage, 1, 1, "removeBorder", null, null, fuzz, pictureName]
	let imgdata = arg.imgdata
	let pictureName = arg.name
	let filePath = arg.filePath
	let canvas = arg.canvas
	let top = arg.top
	let left = arg.left
	let json = {}
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	
	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = err.message
			event.sender.send('imagemagick-response', json)
		} else {
			try {
				image.autocrop()
				image.getBase64(Jimp.AUTO, (err, ret) => {
					json.status = 'success'
					json.data = ret
					json.canvas = canvas
					json.x = 0
					json.y = 0
					json.pTop = top
					json.pLeft = left
					json.pScaleX = 1
					json.pScaleY = 1
					json.pictureName = pictureName
					json.path = filePath
					event.sender.send('imagemagick-response', json)
				})
			} catch (error) {
				json.status = 'error'
				json.message = error.message
				log.error(error);
				event.sender.send('imagemagick-response', json)
			}
		}
	})
})

ipcMain.on('update-image', (event, arg) => {
	let imgdata = arg.imgdata
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let top = arg.pTop
	let left = arg.pLeft
	let scaleX = arg.pScaleX
	let scaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let canvas = arg.canvas
	let path = arg.path
	let json = {}
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = err.message
			event.sender.send('imagemagick-response', json)
		} else {
			try {
				image.autocrop()
				image.getBase64(Jimp.AUTO, (err, ret) => {
					json.status = 'success'
					json.data = ret
					json.canvas = canvas
					json.x = x
					json.y = y
					json.pTop = top
					json.pLeft = left
					json.pScaleX = scaleX
					json.pScaleY = scaleY
					json.pictureName = pictureName
					json.path = path
					event.sender.send('imagemagick-response', json)
				})
			} catch (error) {
				json.status = 'error'
				json.message = error.message
				log.error(error);
				event.sender.send('imagemagick-response', json)
			}
		}
	})
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
			store.set("downloadPath", path.dirname(result.filePath))
            event.sender.send('save-logo-response', null)
        } else {
            event.sender.send('save-logo-response', null)
        }
    }).catch((err) => {
        console.log(err);
        event.sender.send('save-logo-response', null)
    });
})

ipcMain.on('local-pattern-folder', (event, arg) => {
	filenames = fs.readdirSync(userPatternsFolder)
	let jsonArr = []
	for (i=0; i<filenames.length; i++) {
        if (path.extname(filenames[i]).toLowerCase() == ".json") {
			//let filePath = path.join(userFontsFolder,filenames[i])
			let txt = fs.readFileSync(path.join(userPatternsFolder,filenames[i]))
			let jsonObj = JSON.parse(txt)
			jsonArr.push(jsonObj)
		}
	}
	event.sender.send('local-pattern-folder-response', jsonArr)
})

ipcMain.on('local-font-folder', (event, arg) => {
	const jsonObj = {}
	const jsonArr = []

	filenames = fs.readdirSync(userFontsFolder);
	for (i=0; i<filenames.length; i++) {
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

ipcMain.on('open-folder', (event, arg) => {
	switch (arg) {
		case "fonts":
			shell.openPath(userFontsFolder)
			break;
		case "patterns":
			shell.openPath(userPatternsFolder)
			break;
	}
})

ipcMain.on('add-pattern', (event, arg) => {
	let json = {}
    const options = {
		defaultPath: store.get("uploadImagePath", app.getPath('pictures')),
		properties: ['openFile'],
		filters: [
			{ name: 'PNG files', extensions: ['png'] }
		]
	}
    dialog.showOpenDialog(null, options).then(result => {
        if (!result.canceled) {
			store.set("uploadImagePath", path.dirname(result.filePaths[0]))
			let filePath = path.join(userPatternsFolder,path.basename(result.filePaths[0]))
			Jimp.read(result.filePaths[0], (err, image) => {
				if (err) {
					json.filename = "error not an image"
					json.image = "error not an image"
					event.sender.send('add-pattern-response', json)
				} else {
					fs.copyFileSync(result.filePaths[0], filePath)
					image.getBase64(Jimp.AUTO, (err, ret) => {
						json.path = result.filePaths[0]
						json.filename = filePath
						json.image = ret
						//json.name = r
						event.sender.send('add-pattern-response', json)
					})
				}
			})
            .catch(err => { json.filename = "error not an image"
                json.image = "error not an image"
                event.sender.send('add-pattern-response', err) 
            })
        } else {
            res.end()
			  console.log("cancelled")
        }
    })
})

ipcMain.on('write-pattern-definition', (event, arg) => {
	let json = {}
	let displayName = arg.displayName;
	let fileName = arg.fileName;
	let filePath = path.join(userPatternsFolder,path.basename(fileName))
	json.displayName = displayName
	json.fileName = filePath
	let writeStream = fs.createWriteStream(userPatternsFolder+"/"+path.basename(fileName)+".json");
	writeStream.write(JSON.stringify(json))
	writeStream.end()
})

function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      icon: (__dirname + '/images/icon.ico'),
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
      }
    })

    watcher.on('add', (path, stats) => {
		mainWindow.webContents.send('updateFonts','click')
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
                  label: 'About the OOTP Logo Maker',
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
              label: 'About Fabric.js',
              click: async () => {
              await shell.openExternal('http://fabricjs.com/')
              }
          },
          {
              label: 'View project on GitHub',
              click: async () => {
              await shell.openExternal('https://github.com/eriqjaffe/OOTP-Logo-Maker')
              }
          }
          ]
      }
      ]
      
      const menu = Menu.buildFromTemplate(template)
      Menu.setApplicationMenu(menu)
  
    //mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}&preferredColorFormat=${preferredColorFormat}&preferredTexture=${preferredTexture}`);

    mainWindow.loadURL(`file://${__dirname}/index.html`)

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