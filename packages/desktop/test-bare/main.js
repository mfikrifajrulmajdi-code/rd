const { app, BrowserWindow } = require('electron');
console.log('app type:', typeof app);
app.whenReady().then(() => {
    const win = new BrowserWindow({ width: 400, height: 300 });
    win.loadURL('data:text/html,<h1>It works!</h1>');
    setTimeout(() => app.quit(), 3000);
});
