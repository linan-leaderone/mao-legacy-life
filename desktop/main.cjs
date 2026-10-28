const { app, BrowserWindow, protocol, net, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const {performRequest,validateRequest}=require('./api-request.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('毛的遗产·人生重开');
let mainWindow;
app.whenReady().then(() => {
  const webRoot = path.join(__dirname, app.isPackaged ? 'web' : '../dist');
  protocol.handle('app', async request => {
    const url = new URL(request.url);
    if (url.hostname !== 'game') return new Response('Not found', { status: 404 });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(webRoot, relative);
    if (!target.startsWith(path.resolve(webRoot) + path.sep)) return new Response('Forbidden', { status: 403 });
    try { return await net.fetch(pathToFileURL(target).href); }
    catch { return new Response('Not found', { status: 404 }); }
  });
  const isGame = event => event.senderFrame?.url?.startsWith('app://game/');
  const apiRequests=new Map();
  const cancelWindowRequests=contentsId=>{
    for(const [key,controller]of apiRequests)if(key.startsWith(contentsId+':')){controller.abort('cancelled');apiRequests.delete(key);}
  };
  ipcMain.handle('api-request',async(event,input)=>{
    if(!isGame(event))return {error:'无法从此页面发起请求。',errorCode:'network'};
    let key,timer,controller;
    try{
      const validated=validateRequest(input);key=event.sender.id+':'+input.id;
      if(apiRequests.has(key))return {error:'请求正在进行。',errorCode:'network'};
      controller=new AbortController();apiRequests.set(key,controller);
      timer=setTimeout(()=>controller.abort('timeout'),validated.timeoutMs);
      return await performRequest(input,controller.signal,(url,init)=>net.fetch(url,init));
    }catch{
      const errorCode=controller?.signal.aborted?(controller.signal.reason==='timeout'?'timeout':'cancelled'):'network';
      return {error:({timeout:'API 请求等待超时。',cancelled:'API 请求已取消。',network:'无法完成 API 请求，请检查网络和服务地址。'})[errorCode],errorCode};
    }
    finally{clearTimeout(timer);if(controller&&apiRequests.get(key)===controller)apiRequests.delete(key);}
  });
  ipcMain.handle('api-cancel',(event,id)=>{if(isGame(event))apiRequests.get(event.sender.id+':'+String(id))?.abort('cancelled');});
  ipcMain.handle('read-local-settings', async event => {
    if (!isGame(event)) return null;
    const candidates = [path.join(app.getPath('appData'), 'MaoLegacyLife', 'settings.json')];
    if (!app.isPackaged) candidates.push(path.join(__dirname, '../.private/settings.json'));
    for (const filename of candidates) {
      try { return JSON.parse((await fs.readFile(filename, 'utf8')).replace(/^\uFEFF/, '')); }
      catch { /* A missing or malformed local file falls back to in-game settings. */ }
    }
    return null;
  });
  ipcMain.handle('save-text', async (event, filename, content) => {
    if (!isGame(event) || typeof content !== 'string' || content.length > 10_000_000) return false;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出人生档案', defaultPath: path.basename(String(filename || '人生档案.json')),
      filters: [{ name: 'JSON 存档', extensions: ['json'] }]
    });
    if (canceled || !filePath) return false;
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  });
  const createWindow = () => {
    mainWindow = new BrowserWindow({ width: 1440, height: 960, minWidth: 420, minHeight: 600,
      title: '毛的遗产·人生重开', backgroundColor: '#101310', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false }
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('app://game/')) event.preventDefault(); });
    mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    const contentsId=mainWindow.webContents.id;
    mainWindow.webContents.on('did-start-navigation',(_event,_url,isInPlace,isMainFrame)=>{if(isMainFrame&&!isInPlace)cancelWindowRequests(contentsId);});
    mainWindow.webContents.on('render-process-gone',()=>cancelWindowRequests(contentsId));
    mainWindow.on('closed',()=>cancelWindowRequests(contentsId));
    mainWindow.loadURL('app://game/index.html');
  };
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
