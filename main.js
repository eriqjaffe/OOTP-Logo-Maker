const { app, BrowserWindow, dialog, Menu, shell, webContents  } = require('electron')
const path = require('path')
const fs = require('fs')
const url = require('url');
const express = require('express')
const Jimp = require('jimp')
const Store = require("electron-store")
const hasbin = require('hasbin');
const fontname = require('fontname')

const isMac = process.platform === 'darwin'

const app2 = express();
const store = new Store();
const userFontsFolder = path.join(app.getPath('userData'),"fonts")

const server = app2.listen(0, () => {
	console.log(`Server running on port ${server.address().port}`);
});

const imInstalled = hasbin.sync('magick');

app2.use(express.urlencoded({limit: '200mb', extended: true, parameterLimit: 500000}));

app2.get("/dropImage", (req, res) => {
	Jimp.read(req.query.file, (err, image) => {
		if (err) {
			res.json({
				"filename": "error not an image",
				"image": "error not an image"
			})
		} else {
			image.getBase64(Jimp.AUTO, (err, ret) => {
				res.json({
					"filename": path.basename(req.query.file),
					"image": ret
				});
			})
		}
	})
})

app2.get("/uploadImage", (req, res) => {
    const options = {
		defaultPath: store.get("uploadImagePath", app.getPath('pictures')),
		properties: ['openFile'],
		filters: [
			{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'] }
		]
	}
    dialog.showOpenDialog(null, options).then(result => {
        if (!result.canceled) {
            Jimp.read(result.filePaths[0], (err, image) => {
                if (err) {
                    console.log(err);
                    res.end()
                } else {
                    image.getBase64(Jimp.AUTO, (err, ret) => {
                        res.json({
                            "filename": path.basename(result.filePaths[0]),
                            "image": ret
                          });
                        res.end();
                    })
                }
            });
        } else {
            res.end()
			  console.log("cancelled")
        }
    })
})

app2.get("/customFont", (req, res) => {
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
				var json = {
					"status": "ok",
					"fontName": fontMeta.fullName,
					"fontStyle": fontMeta.fontSubfamily,
					"familyName": fontMeta.fontFamily,
					"fontFormat": ext,
					"fontMimetype": 'font/' + ext,
					"fontData": fontPath.href,
					"fontPath": filePath
				};
				//fs.copyFileSync(result.filePaths[0], filePath)
				res.json(json)
				res.end()
			} catch (err) {
				const json = {
					"status": "error",
					"fontName": path.basename(result.filePaths[0]),
					"fontPath": result.filePaths[0],
					"message": err
				}
				res.json(json)
				res.end()
				//fs.unlinkSync(result.filePaths[0])
			}
		} else {
			res.json({"status":"cancelled"})
			res.end()
			console.log("cancelled")
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

app2.get("/dropFont", (req, res) => {
	try {
		const filePath = path.join(userFontsFolder,path.basename(req.query.file))
		const fontMeta = fontname.parse(fs.readFileSync(req.query.file))[0];
		var ext = getExtension(req.query.file)
		var fontPath = url.pathToFileURL(req.query.file)
		var json = {
			"status": "ok",
			"fontName": fontMeta.fullName,
			"fontStyle": fontMeta.fontSubfamily,
			"familyName": fontMeta.fontFamily,
			"fontFormat": ext,
			"fontMimetype": 'font/' + ext,
			"fontData": fontPath.href,
			"fontPath": filePath
		};
		// const fs = require('fs')fs.copyFileSync(req.query.file, filePath)
		res.json(json)
		res.end()
	} catch (err) {
		const json = {
			"status": "error",
			"fontName": path.basename(req.query.file),
			"fontPath": req.query.file,
			"message": err
		}
		res.json(json)
		res.end()
		//fs.unlinkSync(req.query.file)
	}
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

    mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}`)

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