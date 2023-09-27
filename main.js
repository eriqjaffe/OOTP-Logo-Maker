const { app, BrowserWindow, dialog, Menu, shell, ipcMain, webContents  } = require('electron')
const os = require('os')
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
const chokidar = require("chokidar")
const imagemagickCli = require('imagemagick-cli')

const isMac = process.platform === 'darwin'
const tempDir = os.tmpdir()

const store = new Store();
const userFontsFolder = path.join(app.getPath('userData'),"fonts")

if (!fs.existsSync(userFontsFolder)) {
    fs.mkdirSync(userFontsFolder);
}

if (!fs.existsSync(userFontsFolder+"/README.txt")) {
	var writeStream = fs.createWriteStream(userFontsFolder+"/README.txt");
	writeStream.write("TTF and OTF fonts dropped into this folder will automatically be imported into the Logo Maker!\r\n\r\nFonts removed from this folder will still be available in the Logo Maker until you quit the app, and they will not reload after that.")
	writeStream.end()
}

const watcher = chokidar.watch(userFontsFolder, {
	ignored: /(^|[\/\\])\../, // ignore dotfiles
	persistent: true
});

watcher.on('ready', () => {})

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

ipcMain.on('remove-border', (event, arg) => {
	//[theImage, 1, 1, "removeBorder", null, null, fuzz, pictureName]
	let imgdata = arg[0]
	let fuzz = parseInt(arg[6]);
	let pictureName = arg[7]
	let canvas = arg[8]
	let imgLeft = arg[9]
	let imgTop = arg[10]
	let json = {}
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);
		} else {
			try {
				image.write(tempDir+"/temp.png");
				imagemagickCli.exec('magick convert -trim -fuzz '+fuzz+'% '+tempDir+'/temp.png '+tempDir+'/temp.png').then(({ stdout, stderr }) => {
					Jimp.read(tempDir+"/temp.png", (err, image) => {
						if (err) {
							json.status = 'error'
							json.message = err
							console.log(err);
							event.sender.send('imagemagick-response', json)
						} else {
							image.getBase64(Jimp.AUTO, (err, ret) => {
								json.status = 'success'
								json.image = ret
								json.canvas = canvas
								json.imgTop = imgTop
								json.imgLeft = imgLeft
								json.pictureName = pictureName
								event.sender.send('imagemagick-response', json)
							})
						}
					})
				})
			} catch (error) {
				json.status = 'error'
				json.message = "An error occurred - please make sure ImageMagick is installed"
				console.log(error);
				event.sender.send('imagemagick-response', json)
			}
		}
	})
})

ipcMain.on('replace-color', (event, arg) => {
	let imgdata = arg[0]
	let pLeft = arg[1]
	let pTop = arg[2]
	let pScaleX = arg[3]
	let pScaleY = arg[4]
	let action = arg[5]
	let color = arg[6]
	let newcolor = arg[7]
	let fuzz = arg[8]
	let pictureName = arg[9]
	let canvas = arg[10]
	let x = arg[11]
	let y = arg[12]
	let colorSquare = arg[13]
	let newColorSquare = arg[14]
	let json = {}
	var buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.result = "error"
			json.message = err
			event.sender.send('replace-color-response', json)
		} else {
			image.write(tempDir+"/temp.png");
      if (action.slice(-17) == "ReplaceColorRange") {
				cmdString = 'magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill '+newcolor+' -draw "color '+x+','+y+' floodfill" '+tempDir+'/temp.png';		
			} else {
				cmdString = 'magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill '+newcolor+' -opaque '+color+' '+tempDir+'/temp.png';	
			}
			try {
				imagemagickCli.exec(cmdString).then(({ stdout, stderr }) => {
					Jimp.read(tempDir+"/temp.png", (err, image) => {
						if (err) {
							json.result = "error"
							json.message = err
							event.sender.send('replace-color-response', json)
						} else {
							image.getBase64(Jimp.AUTO, (err, ret) => {
								json.result = "success"
								json.data = ret
								json.pTop = pTop
								json.pLeft = pLeft
								json.x = pScaleX
								json.y = pScaleY
								json.pictureName = pictureName
								json.canvas = canvas
								json.colorSquare = colorSquare
								json.newColorSquare = newColorSquare
								json.pScaleX = pScaleX
								json.pScaleY = pScaleY
								event.sender.send('replace-color-response', json)
							})
						}
					})
				})
			} catch (error) {
				json.status = 'error'
				json.message = "An error occurred - please make sure ImageMagick is installed"
				console.log(err);
				event.sender.send('remove-border-response', json)
			}
		}
	})
})

ipcMain.on('make-transparent', (event, arg) => {
	let buffer = Buffer.from(arg.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let pTop = arg.pTop
	let pLeft = arg.pLeft
	let pScaleX = arg.pScaleX
	let pScaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let colorSquare = arg.colorSquare
	let fuzz = parseInt(arg.fuzz);
	let canvas = arg.canvas
	let json = {}
	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = "An error occurred - please make sure ImageMagick is installed"
			console.log(err);
			event.sender.send('imagemagick-response', json)
		} else {
            let cornerColor = image.getPixelColor(x, y)
            new Jimp(image.bitmap.width+20, image.bitmap.height+20, cornerColor, (err, img) => {
                img.blit(image, 10, 10)
                img.write(tempDir+"/temp.png", (err) => {
                    try {
                        imagemagickCli.exec('magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill none -draw "color '+x+','+y+' floodfill" '+tempDir+'/temp.png')
                        .then(({ stdout, stderr }) => {
                            Jimp.read(tempDir+"/temp.png", (err, image) => {
                                if (err) {
                                    json.status = 'error'
                                    json.message = "An error occurred - please make sure ImageMagick is installed"
                                    console.log(err);
                                    event.sender.send('imagemagick-response', json)
                                } else {
                                    image.getBase64(Jimp.AUTO, (err, ret) => {
                                        json.status = 'success'
                                        json.data = ret
                                        json.canvas = canvas
                                        json.x = x
                                        json.y = y
                                        json.pTop = pTop
                                        json.pLeft = pLeft
                                        json.pScaleX = pScaleX
                                        json.pScaleY = pScaleY
                                        json.pictureName = pictureName
                                        json.colorSquare = colorSquare
                                        event.sender.send('imagemagick-response', json)
                                    })
                                }
                            })
                        })
                    } catch (error) {
                        json.status = 'error'
                        json.message = "An error occurred - please make sure ImageMagick is installed"
                        console.log(err);
                        event.sender.send('imagemagick-response', json)
                    }
                })
            })		
		}
 	})
})

ipcMain.on('remove-color-range', (event, arg) => {
	let buffer = Buffer.from(arg.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let pTop = arg.pTop
	let pLeft = arg.pLeft
	let pScaleX = arg.pScaleX
	let pScaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let colorSquare = arg.colorSquare
	let fuzz = parseInt(arg.fuzz);
	let canvas = arg.canvas
	let json = {}
	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = "An error occurred - please make sure ImageMagick is installed"
			console.log(err);
			event.sender.send('imagemagick-response', json)
		} else {
			image.write(tempDir+"/temp.png", (err) => {
				try {
					imagemagickCli.exec('magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill none -draw "color '+x+','+y+' floodfill" '+tempDir+'/temp.png')
					.then(({ stdout, stderr }) => {
						Jimp.read(tempDir+"/temp.png", (err, image) => {
							if (err) {
								json.status = 'error'
								json.message = "An error occurred - please make sure ImageMagick is installed"
								console.log(err);
								event.sender.send('imagemagick-response', json)
							} else {
								image.getBase64(Jimp.AUTO, (err, ret) => {
									json.status = 'success'
									json.data = ret
									json.canvas = canvas
									json.x = x
									json.y = y
									json.pTop = pTop
									json.pLeft = pLeft
									json.pScaleX = pScaleX
									json.pScaleY = pScaleY
									json.pictureName = pictureName
									json.colorSquare = colorSquare
									event.sender.send('imagemagick-response', json)
								})
							}
						})
					})
				} catch (error) {
					json.status = 'error'
					json.message = "An error occurred - please make sure ImageMagick is installed"
					console.log(err);
					event.sender.send('imagemagick-response', json)
				}
				
			})
		}
 	})
})

ipcMain.on('remove-all-color', (event, arg) => {
	let buffer = Buffer.from(arg.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let pTop = arg.pTop
	let pLeft = arg.pLeft
	let pScaleX = arg.pScaleX
	let pScaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let colorSquare = arg.colorSquare
	let fuzz = parseInt(arg.fuzz);
	let canvas = arg.canvas
	let color = arg.color
	let json = {}
	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = err
			console.log(err);
			event.sender.send('remove-all-color-response', json)
		} else {
			image.write(tempDir+"/temp.png", (err) => {
				try {
					imagemagickCli.exec('magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -transparent '+color+' '+tempDir+'/temp.png')
					.then(({ stdout, stderr }) => {
						Jimp.read(tempDir+"/temp.png", (err, image) => {
							if (err) {
								json.status = 'error'
								json.message = err
								console.log(err);
								event.sender.send('remove-all-color-response', json)
							} else {
								image.getBase64(Jimp.AUTO, (err, ret) => {
									json.status = 'success'
									json.data = ret
									json.canvas = canvas
									json.x = x
									json.y = y
									json.pTop = pTop
									json.pLeft = pLeft
									json.pScaleX = pScaleX
									json.pScaleY = pScaleY
									json.pictureName = pictureName
									json.colorSquare = colorSquare
									event.sender.send('remove-all-color-response', json)
								})
							}
						})
					})
				} catch (error) {
					json.status = 'error'
					json.message = "An error occurred - please make sure ImageMagick is installed"
					console.log(err);
					event.sender.send('remove-all-color-response', json)
				}
				
			})
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