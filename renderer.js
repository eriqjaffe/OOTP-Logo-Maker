const { app, shell, ipcRenderer } = require('electron')

ipcRenderer.on('save', (event, data) => {
    $("#save").trigger("click")
});

ipcRenderer.on('import-image', (event, data) => {
    $("#uploadImage").trigger("click")
});

ipcRenderer.on('updateFonts', (event, data) => {
    $("#localFontFolder").trigger("click")
})

ipcRenderer.on('about', (event, data) => {
    $("#aboutLogoMaker").trigger("click")
});

ipcRenderer.on('update', (event, data) => {
    $("#checkForUpdates").trigger("click")
});