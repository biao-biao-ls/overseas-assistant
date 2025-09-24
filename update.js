import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';

let mainWindow;

export function initAutoUpdate(win) {
  mainWindow = win;
  autoUpdater.autoDownload = false; // 关闭自动下载:cite[1]:cite[8]
  autoUpdater.allowPrerelease = false; // 仅稳定版

  // 事件监听
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('download-progress', Math.floor(progress.percent));
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err.message);
  });

  // 渲染进程触发检查更新
  ipcMain.handle('check-update', () => {
    autoUpdater.checkForUpdates();
  });

  // 用户确认后下载更新
  ipcMain.handle('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  // 退出并安装
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });
}