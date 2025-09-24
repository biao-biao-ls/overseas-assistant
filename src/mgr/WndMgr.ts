import {
    app,
    screen,
    BrowserWindow,
    BrowserWindowConstructorOptions,
    globalShortcut,
    ipcMain,
    dialog,
    Rectangle,
    shell,
    nativeImage,
} from 'electron'
import { WndBase } from '../base/WndBase'
import { ECommon } from '../enum/ECommon'
import { EWnd, EWndCfg, EWndFunction, EWndPrimary } from '../enum/EWnd'
import { AppUtil } from '../utils/AppUtil'
import { MainWindow } from '../main/window/MainWindow'
import { LoginWindow } from '../main/window/LoginWindow'
import path from 'path'
import fs from 'fs'
import { AppConfig } from '../config/AppConfig'
import { SettingWindow } from '../main/window/SettingWindow'
import AppContainer from '../base/AppContainer'
import { AlertCloseWindow } from '../main/window/AlertCloseWindow'
import { AlertEDAWindow } from '../main/window/AlertEDAWindow'
import { EMessage } from '../enum/EMessage'
import { AlertWindow } from '../main/window/AlertWindow'
import { AppMsg } from '../base/AppMsg'
import { MessageAlertWindow, MsgAlertCfg } from '../main/window/MessageAlertWindow'
import { MessageMgrWindow } from '../main/window/MessageMgrWindow'
import { UpdateTipWindow } from '../main/window/UpdateTipWindow'
import { ClientIndexDBMgr } from './ClientIndexDBMgr'
import { LoginCacheMgr } from './LoginCacheMgr'
import { LoginStateMgr } from './LoginStateMgr'
import { CacheConfig } from '../config/CacheConfig'

// 窗口数量
class WndState {
    public name!: string
    public primary!: number
    constructor(wnd: WndBase) {
        this.name = wnd.getWndType()
        this.primary = wnd.getWndPrimary()
    }
}

export class FloatBrowser {
    private m_strUUID: string
    private m_strUrl: string
    private m_browserWindow: BrowserWindow
    constructor(strKey: string, strUrl: string) {
        this.m_strUUID = strKey
        this.m_strUrl = strUrl

        let nWidth = 800
        let nHeight = 600

        let dictBound: Rectangle
        for (const strWnd of EWnd.listMainWnd) {
            if (strWnd) {
                let wnd = AppUtil.getExistWnd(strWnd)
                if (!wnd) {
                    continue
                }
                // 移动位置
                let bw = wnd.getBrowserWindow()
                if (!bw) {
                    continue
                }
                dictBound = bw.getBounds()

                break
            }
        }

        let nRate = 3 / 4
        nWidth = dictBound.width * nRate
        nHeight = dictBound.height * nRate
        this.m_browserWindow = new BrowserWindow({
            frame: true,
            width: nWidth,
            height: nHeight,
            x: dictBound.x + dictBound.width / 2 - nWidth / 2,
            y: dictBound.y + dictBound.height / 2 - nHeight / 2,
            show: false,
            minWidth: 400,
            minHeight: 300,
            hasShadow: false,

            autoHideMenuBar: true,

            webPreferences: {
                preload: AppConfig.BrowserPreLoadJSPath,
                nodeIntegration: true,
            },
        })
        this.m_browserWindow.show()
        this.m_browserWindow.loadURL(this.m_strUrl)

        this.m_browserWindow?.webContents?.openDevTools({ mode: 'undocked' })

        this.m_browserWindow.once('ready-to-show', () => {
            this.m_browserWindow.show()
            this.m_browserWindow.setTitle('JLCONE')
        })
        this.m_browserWindow?.webContents?.on('did-finish-load', () => {
            this.m_browserWindow?.webContents.executeJavaScript(AppConfig.viewFinishLoadJSPath)
        })
        this.m_browserWindow.on('close', () => {
            // 强制关闭
            AppContainer.getApp().getWndMgr().deleteFloatBrowser(this.m_strUUID)
        })
        this.m_browserWindow.on('closed', () => {
            AppContainer.getApp().getWndMgr().deleteFloatBrowser(this.m_strUUID)
        })
        // 拦截下载，自定义下载位置
        // this.m_browserWindow?.webContents?.session.on('will-download', (event, item) => {
        //     const dPath = AppConfig.getUserConfig('downloadsPath') as string
        //     const savePath = path.join(dPath, item.getFilename())
        //     AppUtil.info('WndMgr', 'will-download', `下载位置：${dPath}，保存路径：${savePath}`)
        //     item.setSavePath(savePath)
        // })
    }
    // life start ---------------------------------------------------------
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getBrowserWindow() {
        return this.m_browserWindow
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    destroy() {
        if (this.m_browserWindow) {
            this.m_browserWindow.destroy()
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
export class WindowPoolItem {
    private m_strUUID: string = ECommon.ENone
    private m_strFunction: string = ECommon.ENone
    private m_window!: BrowserWindow
    private m_bFree: boolean = true
    private m_dictFunUse: { [key: string]: string } = {}
    // life start ---------------------------------------------------------
    constructor(strUUID: string, window: BrowserWindow) {
        this.m_strUUID = strUUID
        this.m_window = window

        this.m_dictFunUse = {
            'alwaysOnTop': 'setAlwaysOnTop',
            'movable': 'setMovable',
            'fullscreenable': 'setFullScreenable',
            'maximizable': 'setMaximizable',
            'resizable': 'setResizable',
        }
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    isFree() {
        return this.m_bFree
    }
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getUUID() {
        return this.m_strUUID
    }
    setFunction(strFunction: string) {
        this.m_strFunction = strFunction
    }
    getFunction() {
        return this.m_strFunction
    }
    getWindow() {
        return this.m_window
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    initByWnd(wnd: WndBase) {
        this.m_bFree = false
        let dictAllCfg = wnd.getAllCfg()
        let dictWindowCfg = dictAllCfg[EWndCfg.EWindowCfg]
        let nWidth = dictWindowCfg['width'] as number
        let nHeight = dictWindowCfg['height'] as number
        let nMinWidth = dictWindowCfg['minWidth'] as number
        let nMinHeight = dictWindowCfg['minHeight'] as number

        let strRes = dictAllCfg[EWndCfg.EWndRes] as string
        this.m_window.loadFile(strRes)

        let bWin10Later = AppUtil.isWindow10OrLater()
        this.m_window.removeMenu()
        let nPrimary = wnd.getWndPrimary()

        wnd.setMinWidth(nMinWidth)
        wnd.setMinHeight(nMinHeight)
        if (nPrimary === EWndPrimary.EAlert) {
            for (const strCfg of Object.keys(dictWindowCfg)) {
                if (strCfg in this.m_dictFunUse) {
                    let cfg = dictWindowCfg[strCfg]
                    this.m_window[this.m_dictFunUse[strCfg]]?.(cfg)
                }
            }
            this.m_window.setAlwaysOnTop(true, 'modal-panel')
            this.m_window.setMaximizable(false)
            this.m_window.setFullScreenable(false)
        } else {
            // 根据配置
            for (const strCfg of Object.keys(dictWindowCfg)) {
                if (strCfg in this.m_dictFunUse) {
                    let cfg = dictWindowCfg[strCfg]
                    this.m_window[this.m_dictFunUse[strCfg]]?.(cfg)
                }
            }
        }

        this.m_window.on('unmaximize', () => {
            this.m_window.webContents.send(EMessage.ERenderUnMaximize, wnd.getIsMaximize())
        })

        // 居中显示

        let mainDisplay = screen.getPrimaryDisplay()
        let nCreateX = mainDisplay.workArea.width / 2 - nWidth / 2
        let nCreateY = mainDisplay.workArea.height / 2 - nHeight / 2

        for (const strWnd of EWnd.listMainWnd) {
            if (strWnd) {
                let wnd = AppUtil.getExistWnd(strWnd)
                if (!wnd) {
                    continue
                }
                // 移动位置
                let bw = wnd.getBrowserWindow()
                if (!bw) {
                    continue
                }
                let dictBound = bw.getBounds()

                nCreateX = dictBound.x + dictBound.width / 2 - nWidth / 2
                nCreateY = dictBound.y + dictBound.height / 2 - nHeight / 2

                break
            }
        }

        this.m_window.setBounds({
            x: Math.floor(nCreateX),
            y: Math.floor(nCreateY),
            width: nWidth,
            height: nHeight,
        })
        this.m_window.webContents.on('did-finish-load', () => {
            if (wnd) {
                if (!wnd.isSyncWin10()) {
                    wnd.getBrowserWindow()?.webContents?.send(
                        EMessage.ESendToRender,
                        new AppMsg(EMessage.ERenderSyncIsWin10, bWin10Later)
                    )
                    wnd.setSyncWin10(true)
                }

                wnd.getBrowserWindow()?.webContents?.send(
                    EMessage.ESendToRender,
                    new AppMsg(EMessage.ERenderUpdateSetting)
                )
                wnd.getBrowserWindow()?.webContents?.send(
                    EMessage.ESendToRender,
                    new AppMsg(EMessage.ERenderSyncIsDarwin, process.platform === 'darwin')
                )
            }

            AppUtil.showPanelPrimary(wnd, true)
            this.m_window.show()
        })
        // this.m_window.show()

        AppContainer.getApp().getWndMgr().checkPoolNum()
    }
    backToFree() {
        this.m_bFree = true
        this.m_window.removeAllListeners()
        this.m_window.hide()
        AppContainer.getApp().getWndMgr().checkPoolNum()
    }
    destroy() {
        this.m_window.destroy()
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
export default class WndMgr {
    private m_dictPanel: { [key: string]: WndBase } = {}

    private m_dictCurrentWnd: { [key: string]: WndState } = {}

    private m_dictBrowserWindow: { [key: string]: FloatBrowser } = {}
    private m_dictConfigMsg: { [key: string]: boolean } = {}

    private m_dictWindowCfg: { [key: string]: { [key: string]: unknown } } = {}
    private m_dictWindowPool: { [key: string]: WindowPoolItem } = {}

    private m_bRegisterKey: boolean = false
    // life start ---------------------------------------------------------

    constructor() {
        // 窗体配置
        this.registerCfg(
            EWnd.EMessageAlert,
            EWndFunction.EAlert,
            'build/messageAlert.html',
            EWndPrimary.EAlert,
            {
                frame: false,
                resizable: false,
                width: MsgAlertCfg.OnlyMsgWidth,
                height: MsgAlertCfg.OnlyMsgHeight,
                show: false,
                movable: false,
                hasShadow: false,

                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            MessageAlertWindow
        )
        this.registerCfg(
            EWnd.EMsessageMgr,
            EWndFunction.EUI,
            'build/messageMgr.html',
            EWndPrimary.EStackTop,
            {
                frame: false,
                width: 680,
                height: 430,
                minWidth: 680,
                minHeight: 430,
                resizable: true,
                show: false,
                focusable: true,
                hasShadow: false,
                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            MessageMgrWindow
        )
        // 登录窗口
        this.registerCfg(
            EWnd.ELoign,
            EWndFunction.EUI,
            'build/login.html',
            EWndPrimary.EOnly,
            {
                frame: false,
                resizable: false,
                width: 1000,
                height: 680,
                show: false,
                hasShadow: false,

                maximizable: false,
                fullscreenable: false,

                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            LoginWindow
        )

        // 更新提示
        this.registerCfg(
            EWnd.EUpdateTip,
            EWndFunction.EUI,
            'build/updateTip.html',
            EWndPrimary.EOnly,
            {
                frame: false,
                resizable: false,
                width: 500,
                height: 400, // 进一步增加高度确保按钮可见
                show: false,
                hasShadow: false,

                maximizable: false,
                fullscreenable: false,

                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            UpdateTipWindow
        )
        this.registerCfg(
            EWnd.EMain,
            EWndFunction.EUI,
            'build/index.html',
            EWndPrimary.EOnly,
            {
                frame: false,
                width: 1120,
                height: 630,
                minWidth: 1120,
                minHeight: 630,
                show: false,
                focusable: true,
                hasShadow: false,
                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            MainWindow
        )

        this.registerCfg(
            EWnd.ESetting,
            EWndFunction.ESetting,
            'build/setting.html',
            EWndPrimary.EAlert,
            {
                frame: false,
                resizable: false,
                width: 678,
                height: 490,
                show: false,
                hasShadow: false,
                transparent: true,
                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            SettingWindow
        )
        this.registerCfg(
            EWnd.EAlert,
            EWndFunction.EAlert,
            'build/alert.html',
            EWndPrimary.EAlert,
            {
                frame: false,
                resizable: false,
                width: 400,
                height: 204,
                show: false,
                hasShadow: false,

                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            AlertWindow
        )

        this.registerCfg(
            EWnd.EAlertClose,
            EWnd.EAlert,
            'build/alertClose.html',
            EWndPrimary.EAlert,
            {
                frame: false,
                resizable: false,
                width: 460,
                height: 265,
                show: false,
                hasShadow: false,

                webPreferences: {
                    preload: AppConfig.preloadJSPath,
                    nodeIntegration: true,
                },
            },
            AlertCloseWindow
        )


    }
    private registerCfg<Type extends WndBase>(
        strWndName: string,
        strFunction: string,
        strRes: string,
        nWndPrimary: number,
        dictCfg: BrowserWindowConstructorOptions,
        WidgetClass: new () => Type
    ) {
        this.m_dictWindowCfg[strWndName] = {
            [EWndCfg.EWndName]: strWndName,
            [EWndCfg.EWndRes]: strRes,
            [EWndCfg.EWndPrimary]: nWndPrimary,
            [EWndCfg.EWndLogicClass]: WidgetClass,
            [EWndCfg.EWindowCfg]: dictCfg,
        }
    }
    public getCreateWnd(strPanelName: string): WndBase | undefined {
        let panel = this.m_dictPanel[strPanelName] as WndBase
        if (panel) {
            return panel
        }
        // 初始化逻辑对象
        let dictWndCfg = this.m_dictWindowCfg[strPanelName]
        if (!dictWndCfg) {
            return undefined
        }
        let WidgetClass = dictWndCfg[EWndCfg.EWndLogicClass] as new () => WndBase
        // 注册消息处理
        if (!(strPanelName in this.m_dictConfigMsg)) {
            this.m_dictConfigMsg[strPanelName] = true
            ;(WidgetClass as any).configMsg?.()
        }

        let nWndPrimary = dictWndCfg[EWndCfg.EWndPrimary] as number
        AppUtil.info('WndMgr', 'getCreateWnd', `窗口创建:【${strPanelName}】`)
        let panelClass = new WidgetClass()
        panelClass.setWndPrimary(nWndPrimary)
        panelClass.setWndType(strPanelName)
        panelClass.setWndCfg(dictWndCfg)
        panelClass.init()
        this.m_dictPanel[strPanelName] = panelClass
        return panelClass
    }
    public getExistWnd(strPanelName: string) {
        return this.m_dictPanel[strPanelName] as WndBase
    }
    registerGlobalKey(bRegister: boolean) {
        if (this.m_bRegisterKey === bRegister) {
            return
        }
        this.m_bRegisterKey = bRegister
        if (bRegister) {
            // 快捷键注册一次
            // globalShortcut.register('CommandOrControl+Shift+i', () => {
            //     let strCurrentWnd = this.getCurrentShowWnd()
            //     AppUtil.info('WndMgr', 'CommandOrControl+Shift+i', '打开后台：' + strCurrentWnd)
            //     let wnd = this.getExistWnd(strCurrentWnd)
            //     if (!wnd) {
            //         AppUtil.warn('WndMgr', 'CommandOrControl+Shift+i', '打开后台：!wnd')
            //         return
            //     }
            //     wnd.getBrowserWindow()?.webContents?.openDevTools({ mode: 'undocked' })
            //     wnd.onOpenSubViewDevTools()
            // })
            // globalShortcut.register('CommandOrControl+Shift+m', () => {
            //     let msgDB = AppContainer.getApp().getDBMgr() as ClientIndexDBMgr
            //     msgDB.openDev()
            // })
            AppContainer.getApp().registerKey('CommandOrControl+Shift+i', () => {
                let strCurrentWnd = this.getCurrentShowWnd()
                AppUtil.info('WndMgr', 'CommandOrControl+Shift+i', '打开后台：' + strCurrentWnd)
                let wnd = this.getExistWnd(strCurrentWnd)
                if (!wnd) {
                    AppUtil.warn('WndMgr', 'CommandOrControl+Shift+i', '打开后台：!wnd')
                    return
                }
                wnd.getBrowserWindow()?.webContents?.openDevTools({ mode: 'undocked' })
                wnd.onOpenSubViewDevTools()
            })
            AppContainer.getApp().registerKey('CommandOrControl+Shift+m', () => {
                let msgDB = AppContainer.getApp().getDBMgr() as ClientIndexDBMgr
                msgDB.openDev()
            })
        } else {
            // globalShortcut.unregister('CommandOrControl+Shift+i')
            // globalShortcut.unregister('CommandOrControl+Shift+m')
        }
    }
    init() {
        // 异步初始化登录缓存管理器（不阻塞主流程）
        this.initLoginCache().catch(error => {
            AppUtil.error('WndMgr', 'init', '登录缓存初始化失败', error)
        })
        
        // 初始化登录状态管理器
        this.initLoginStateManager()
        
        if (AppConfig.isProcessDev()) {
            globalShortcut.register('CommandOrControl+Shift+R', () => {
                AppUtil.info('WndMgr', 'CommandOrControl+Shift+R', '刷新所有页面')
                for (const wnd of AppContainer.getApp().getWndMgr().getAllWnd()) {
                    if (wnd.getBrowserWindow()) {
                        wnd.reloadUI()
                    }
                }
            })
        }

        // 注册窗体管理事件, ui事件
        ipcMain.on(EMessage.EWindowOpen, (event, strWinType) => {
            let wndLogic = this.getCreateWnd(strWinType)
            wndLogic?.showPanel(true)
        })
        ipcMain.on(EMessage.EWindowMinimize, (event, strWinType) => {
            let wndLogic = this.getExistWnd(strWinType)
            wndLogic?.minimize()
        })
        ipcMain.on(EMessage.EWindowClose, (event, strWinType) => {
            if (strWinType === EWnd.ELoign) {
                // 退出app
                app.exit()
                return
            }
            if (strWinType === EWnd.EMain) {
                // 主界面窗口
                this.handleAlertClose()
                return
            }
            // 常规窗口
            let wndLogic = this.getExistWnd(strWinType)
            wndLogic?.showPanel(false)
        })
        ipcMain.handle(EMessage.EWindowMaximize, (event, strWinType) => {
            let wndLogic = this.getExistWnd(strWinType)
            if (!wndLogic) {
                return
            }
            let bCurrent = wndLogic.getIsMaximize()
            wndLogic?.maximizeToggle()
            return Promise.resolve(!bCurrent)
        })
        ipcMain.handle(EMessage.EWindowIsMaximize, async (event, strWndType) => {
            const logicWnd = AppUtil.getExistWnd(strWndType)
            if (logicWnd) {
                const bMaximized = logicWnd.getIsMaximize()
                return Promise.resolve(bMaximized)
            }
            return Promise.resolve(false)
        })
        ipcMain.on('/setting/webViewScale', (event, nScale) => {
            AppConfig.setCurrentWebViewScale(nScale)
            EWnd.listMainWnd.forEach(strWnd => {
                let wnd = AppUtil.getExistWnd(strWnd)
                if (wnd) {
                    wnd.onResetWebViewScale()
                }
            })
        })

        // 缓存管理相关 IPC 消息
        ipcMain.handle('/cache/getStats', async () => {
            try {
                const cacheMgr = LoginCacheMgr.getInstance()
                return cacheMgr.getCacheStats()
            } catch (error) {
                AppUtil.error('WndMgr', '/cache/getStats', '获取缓存统计失败', error)
                return { totalItems: 0, totalSize: 0, oldestCache: 0 }
            }
        })

        ipcMain.handle('/cache/clear', async () => {
            try {
                const cacheMgr = LoginCacheMgr.getInstance()
                await cacheMgr.clearAllCache()
                return { success: true }
            } catch (error) {
                AppUtil.error('WndMgr', '/cache/clear', '清理缓存失败', error)
                return { success: false, error: error.message }
            }
        })

        ipcMain.handle('/cache/refresh', async () => {
            try {
                const cacheMgr = LoginCacheMgr.getInstance()
                await cacheMgr.refreshCache()
                return { success: true }
            } catch (error) {
                AppUtil.error('WndMgr', '/cache/refresh', '刷新缓存失败', error)
                return { success: false, error: error.message }
            }
        })

        ipcMain.handle('/cache/getConfig', async () => {
            try {
                return CacheConfig.getAllConfig()
            } catch (error) {
                AppUtil.error('WndMgr', '/cache/getConfig', '获取缓存配置失败', error)
                return {}
            }
        })

        ipcMain.handle('/cache/setConfig', async (event, config) => {
            try {
                if (config.loginCacheExpiry !== undefined) {
                    CacheConfig.setLoginCacheExpiry(config.loginCacheExpiry)
                }
                if (config.maxCacheSize !== undefined) {
                    CacheConfig.setMaxCacheSize(config.maxCacheSize)
                }
                if (config.enableCache !== undefined) {
                    CacheConfig.setCacheEnabled(config.enableCache)
                }
                if (config.cleanupInterval !== undefined) {
                    CacheConfig.setCleanupInterval(config.cleanupInterval)
                }
                return { success: true }
            } catch (error) {
                AppUtil.error('WndMgr', '/cache/setConfig', '设置缓存配置失败', error)
                return { success: false, error: error.message }
            }
        })

        // 登录状态管理相关 IPC 消息
        ipcMain.handle('/loginState/get', async () => {
            try {
                const stateMgr = LoginStateMgr.getInstance()
                return stateMgr.getCurrentState()
            } catch (error) {
                AppUtil.error('WndMgr', '/loginState/get', '获取登录状态失败', error)
                return null
            }
        })

        ipcMain.handle('/loginState/isLoggedIn', async () => {
            try {
                const stateMgr = LoginStateMgr.getInstance()
                return stateMgr.isLoggedIn()
            } catch (error) {
                AppUtil.error('WndMgr', '/loginState/isLoggedIn', '检查登录状态失败', error)
                return false
            }
        })

        ipcMain.handle('/loginState/getUserInfo', async () => {
            try {
                const stateMgr = LoginStateMgr.getInstance()
                return stateMgr.getUserInfo()
            } catch (error) {
                AppUtil.error('WndMgr', '/loginState/getUserInfo', '获取用户信息失败', error)
                return null
            }
        })

        ipcMain.handle('/loginState/logout', async () => {
            try {
                const stateMgr = LoginStateMgr.getInstance()
                await stateMgr.logout('manual')
                
                // 关闭主窗口，显示登录窗口
                const mainWindow = this.getExistWnd(EWnd.EMain)
                if (mainWindow) {
                    mainWindow.showPanel(false)
                }
                
                const loginWindow = AppUtil.getCreateWnd(EWnd.ELoign)
                if (loginWindow) {
                    loginWindow.showPanel(true)
                }
                
                return { success: true }
            } catch (error) {
                AppUtil.error('WndMgr', '/loginState/logout', '退出登录失败', error)
                return { success: false, error: error.message }
            }
        })

        ipcMain.handle('/loginState/getStats', async () => {
            try {
                const stateMgr = LoginStateMgr.getInstance()
                return stateMgr.getLoginStats()
            } catch (error) {
                AppUtil.error('WndMgr', '/loginState/getStats', '获取登录统计失败', error)
                return {}
            }
        })

        ipcMain.handle('/loginState/updateUserInfo', async (event, userInfo) => {
            try {
                const stateMgr = LoginStateMgr.getInstance()
                await stateMgr.updateUserInfo(userInfo)
                return { success: true }
            } catch (error) {
                AppUtil.error('WndMgr', '/loginState/updateUserInfo', '更新用户信息失败', error)
                return { success: false, error: error.message }
            }
        })

        ipcMain.on(EMessage.EWindowReloadIgnoringCache, (event, strWinType) => {
            try {
                AppUtil.info('WndMgr', 'ReloadIgnoringCache', '强制刷新')
                const wndLogic = this.getExistWnd(strWinType)
                if (!wndLogic) {
                    return
                }
                wndLogic?.getBrowserWindow()?.getBrowserView()?.webContents?.reloadIgnoringCache()
            } catch (error) {
                AppUtil.error('WndMgr', 'ReloadIgnoringCache', '强制刷新失败', error)
            }
        })
        // 根据窗口分配实例化pool
        // 初始化窗口池 2个
        this.initPool()
    }
    
    /**
     * 初始化登录缓存
     */
    private async initLoginCache(): Promise<void> {
        try {
            const cacheMgr = LoginCacheMgr.getInstance()
            await cacheMgr.initCache()
            
            // 使用配置中的清理间隔
            const cleanupInterval = CacheConfig.getCleanupInterval()
            
            // 定期清理过期缓存
            setInterval(async () => {
                try {
                    await cacheMgr.cleanExpiredCache()
                } catch (error) {
                    AppUtil.error('WndMgr', 'cleanExpiredCache', '定期清理缓存失败', error)
                }
            }, cleanupInterval)
            
            AppUtil.info('WndMgr', 'initLoginCache', '登录缓存初始化完成')
        } catch (error) {
            AppUtil.error('WndMgr', 'initLoginCache', '登录缓存初始化失败', error)
        }
    }

    /**
     * 初始化登录状态管理器
     */
    private initLoginStateManager(): void {
        try {
            const stateMgr = LoginStateMgr.getInstance()
            
            // 添加状态变化监听器
            stateMgr.addStateChangeListener((event) => {
                AppUtil.info('WndMgr', 'loginStateChange', `登录状态变化: ${event.type}`, {
                    isLoggedIn: event.newState.isLoggedIn,
                    username: event.newState.username,
                    loginMethod: event.newState.loginMethod
                })
                
                // 根据状态变化执行相应操作
                this.handleLoginStateChange(event)
            })
            
            AppUtil.info('WndMgr', 'initLoginStateManager', '登录状态管理器初始化完成')
        } catch (error) {
            AppUtil.error('WndMgr', 'initLoginStateManager', '登录状态管理器初始化失败', error)
        }
    }

    /**
     * 处理登录状态变化
     */
    private handleLoginStateChange(event: any): void {
        try {
            switch (event.type) {
                case 'login':
                    // 登录成功，可以执行一些初始化操作
                    AppUtil.info('WndMgr', 'handleLoginStateChange', '用户登录成功')
                    break
                    
                case 'logout':
                    // 退出登录，清理相关数据
                    AppUtil.info('WndMgr', 'handleLoginStateChange', '用户退出登录')
                    this.handleUserLogout()
                    break
                    
                case 'expire':
                    // 登录过期，强制跳转到登录页
                    AppUtil.warn('WndMgr', 'handleLoginStateChange', '登录状态过期')
                    this.handleLoginExpire()
                    break
                    
                case 'refresh':
                    // token刷新，更新相关信息
                    AppUtil.info('WndMgr', 'handleLoginStateChange', 'Token已刷新')
                    break
            }
        } catch (error) {
            AppUtil.error('WndMgr', 'handleLoginStateChange', '处理登录状态变化失败', error)
        }
    }

    /**
     * 处理用户退出登录
     */
    private handleUserLogout(): void {
        try {
            // 关闭所有窗口
            this.closeAllWnd()
            
            // 显示登录窗口
            setTimeout(() => {
                const loginWindow = AppUtil.getCreateWnd(EWnd.ELoign)
                if (loginWindow) {
                    loginWindow.showPanel(true)
                }
            }, 500)
            
        } catch (error) {
            AppUtil.error('WndMgr', 'handleUserLogout', '处理用户退出登录失败', error)
        }
    }

    /**
     * 处理登录过期
     */
    private handleLoginExpire(): void {
        try {
            // 显示登录过期提示
            const alertWindow = AppUtil.getCreateWnd(EWnd.EAlert)
            if (alertWindow) {
                // 这里可以显示一个提示框告知用户登录已过期
                AppUtil.info('WndMgr', 'handleLoginExpire', '显示登录过期提示')
            }
            
            // 跳转到登录页面
            this.handleUserLogout()
            
        } catch (error) {
            AppUtil.error('WndMgr', 'handleLoginExpire', '处理登录过期失败', error)
        }
    }
    
    initPool() {
        for (let nIndex = 0; nIndex < 2; nIndex++) {
            this.addPoolItem()
        }
    }
    // life end ---------------------------------------------------------
    resetViewScale() {
        EWnd.listMainWnd.forEach(strWnd => {
            let wnd = AppUtil.getExistWnd(strWnd)
            if (wnd) {
                wnd.onResetWebViewScale()
            }
        })
    }
    public destroy() {
        this.destroyAllWnd()
        this.destroyPool()
    }
    destroyPool() {
        for (const strUUID of Object.keys(this.m_dictWindowPool)) {
            this.m_dictWindowPool[strUUID].destroy()
        }
    }
    protected destroyAllWnd() {
        let listPanel = Object.keys(this.m_dictPanel)
        for (const strPanelName of listPanel) {
            let wnd = this.getExistWnd(strPanelName as string)
            if (wnd) {
                wnd.destroy()
            }
            delete this.m_dictPanel[strPanelName]
        }
    }
    public removeWnd(strPanelName: string) {
        if (!(strPanelName in this.m_dictPanel)) {
            return
        }
        AppUtil.info('WndMgr', 'removeWnd', `窗口销毁:【${strPanelName}】`)
        delete this.m_dictPanel[strPanelName]
    }
    public closeAllWnd() {
        for (const strWnd of Object.keys(this.m_dictPanel)) {
            let wnd = this.m_dictPanel[strWnd]
            wnd.showPanel(false)
        }
    }

    public isPanelCreate(strPanelName: string) {
        let panel = this.getExistWnd(strPanelName)
        if (!panel) {
            return false
        }
        return true
    }
    public isPanelCreateAndShow(strPanelName: string) {
        let panel = this.getExistWnd(strPanelName)
        if (!panel) {
            return false
        }
        return panel.isShow()
    }
    hasWndShow() {
        for (const strWnd of Object.keys(this.m_dictPanel)) {
            let wnd = this.m_dictPanel[strWnd] as WndBase
            if (wnd && wnd.isShow()) {
                return true
            }
        }
        return false
    }
    getCurrentShowWnd() {
        for (const strWnd of Object.keys(this.m_dictCurrentWnd)) {
            const wnd = this.getExistWnd(strWnd)
            if (!wnd) {
                continue
            }
            if (!wnd.isShow()) {
                continue
            }
            return strWnd
        }
    }
    getAllWnd() {
        return Object.values(this.m_dictPanel)
    }
    public handlePanelPrimary(wndHandle: WndBase, bShow: boolean) {
        let nPrimary = wndHandle.getWndPrimary()
        let strWndNamd = wndHandle.getWndType()
        if (nPrimary === EWndPrimary.EAlert || nPrimary === EWndPrimary.EBase) {
            return
        }
        let funHandlePre = () => {
            for (const strWnd of Object.keys(this.m_dictCurrentWnd)) {
                let state = this.m_dictCurrentWnd[strWnd]
                if (state.name === wndHandle.getWndType()) {
                    continue
                }
                if (state.name === ECommon.ENone) {
                    continue
                }
                let wndPre = AppUtil.getExistWnd(state.name)
                if (!wndPre) {
                    continue
                }
                if (wndPre.getWndPrimary() === EWndPrimary.EControl || wndPre.getWndPrimary() === EWndPrimary.EEffect) {
                    continue
                }
                wndPre.showPanelWithoutPrimary(!bShow)
            }
        }
        if (bShow) {
            if (nPrimary === EWndPrimary.EOnly) {
                // 处理之前的
                funHandlePre()
            }
            let wndState = new WndState(wndHandle)
            this.m_dictCurrentWnd[strWndNamd] = wndState
        } else {
            delete this.m_dictCurrentWnd[strWndNamd]
            if (nPrimary === EWndPrimary.EOnly) {
                // 处理之前的
                funHandlePre()
            }

            // // 检查是否有窗体显示，是否退出
            // let strCurrentWnd = this.getCurrentShowWnd()
            // if (!strCurrentWnd) {
            //     this.handleAlertClose()
            // }
        }
    }
    private handleAlertClose() {
        const locale = AppConfig.getLocale()
        if (AppConfig.isAlertClose()) {
            // 提示退出选项
            let wndAlertClose = AppUtil.getCreateWnd(EWnd.EAlertClose) as AlertCloseWindow
            if (wndAlertClose) {
                wndAlertClose.showPanel()
            }
        } else {
            if (AppConfig.isHideToTask()) {
                // 提示气泡
                AppContainer.getApp().sendTrayMsg('', locale.locale_35)
                for (const wnd of AppUtil.getAllWnd()) {
                    wnd.showPanel(false)
                }
            } else {
                // 直接退出
                AppContainer.getApp().destroy('直接退出')
                app.exit()
            }
        }
    }

    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getFreeWindowFromPool(): WindowPoolItem | undefined {
        for (const strWindow of Object.keys(this.m_dictWindowPool)) {
            let item = this.m_dictWindowPool[strWindow]
            if (item.isFree()) {
                return item
            }
        }
    }
    checkPoolNum() {
        let nFreeNum = 0
        for (const strWindow of Object.keys(this.m_dictWindowPool)) {
            let item = this.m_dictWindowPool[strWindow]
            if (item.isFree()) {
                nFreeNum += 1
            }
        }
        if (nFreeNum < 1) {
            this.addPoolItem()
        } else {
            // 清除剩余1个
            let nDelteNum = nFreeNum - 1
            for (const strWindow of Object.keys(this.m_dictWindowPool)) {
                if (nDelteNum <= 0) {
                    return
                }
                let item = this.m_dictWindowPool[strWindow]
                if (item.isFree()) {
                    item.destroy()
                    delete this.m_dictWindowPool[strWindow]
                    nDelteNum -= 1
                    AppUtil.info('WndMgr', 'checkPoolNum', `删除窗体进程${Object.keys(this.m_dictWindowPool).length}`)
                }
            }
        }
    }
    private addPoolItem() {
        const icon = nativeImage.createFromPath(AppConfig.TrayIconPath)
        let createWindow = new BrowserWindow({
            icon: icon,
            frame: false,
            width: 800,
            height: 600,
            show: false,
            backgroundColor: '#ffffff',
            hasShadow: false,
            paintWhenInitiallyHidden: true,

            webPreferences: {
                preload: AppConfig.preloadJSPath,
                nodeIntegration: true,
            },
        })
        createWindow.setContentProtection(false)
        createWindow.hide()
        createWindow.removeMenu()
        let strUUID = AppUtil.createUUID()
        let newWindowLogic = new WindowPoolItem(strUUID, createWindow)
        this.m_dictWindowPool[strUUID] = newWindowLogic
        AppUtil.info('WndMgr', 'addPoolItem', `新增窗体进程${Object.keys(this.m_dictWindowPool).length}`)
    }
    getWindowLogicByUUID(strUUID: string): WindowPoolItem | undefined {
        return this.m_dictWindowPool[strUUID]
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    openNewBrowserWindow(strUrl: string, dictOption: { [key: string]: unknown } | undefined = undefined): FloatBrowser {
        let strUUID = new Date().getTime() + '' + strUrl
        let newBrowser = new FloatBrowser(strUUID, strUrl)
        this.m_dictBrowserWindow[strUUID] = newBrowser

        let listSize = newBrowser.getBrowserWindow().getSize()
        let nWidth = listSize[0]
        let nHeight = listSize[1]

        if (dictOption) {
            if (dictOption['width']) {
                nWidth = dictOption['width'] as number
            }
            if (dictOption['height']) {
                nHeight = dictOption['height'] as number
            }
        }

        let mainDisplay = screen.getPrimaryDisplay()
        let nCreateX = mainDisplay.workArea.width / 2 - nWidth / 2
        let nCreateY = mainDisplay.workArea.height / 2 - nHeight / 2

        for (const strWnd of EWnd.listMainWnd) {
            if (strWnd) {
                let wnd = AppUtil.getExistWnd(strWnd)
                if (!wnd) {
                    continue
                }
                // 移动位置
                let bw = wnd.getBrowserWindow()
                if (!bw) {
                    continue
                }
                let dictBound = bw.getBounds()

                nCreateX = dictBound.x + dictBound.width / 2 - nWidth / 2
                nCreateY = dictBound.y + dictBound.height / 2 - nHeight / 2

                break
            }
        }

        newBrowser.getBrowserWindow().setBounds({
            x: Math.floor(nCreateX),
            y: Math.floor(nCreateY),
            width: Math.floor(nWidth),
            height: Math.floor(nHeight),
        })
        return this.m_dictBrowserWindow[strUUID]
    }
    deleteFloatBrowser(strUUID: string) {
        if (strUUID in this.m_dictBrowserWindow) {
            this.m_dictBrowserWindow[strUUID].destroy()
            delete this.m_dictBrowserWindow[strUUID]
        }
    }

    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number) {
        let listWnd = Object.keys(this.m_dictPanel)
        for (const strWnd of listWnd) {
            if (this.m_dictPanel[strWnd]) {
                try {
                    this.m_dictPanel[strWnd].isShow()
                    this.m_dictPanel[strWnd].update(nDeltaTime)
                } catch (error) {
                    delete this.m_dictPanel[strWnd]
                }
            }
        }

        let strCurrentShowWnd = AppUtil.getCurrentShowWnd()
        let focusWnd = BrowserWindow.getFocusedWindow()
        if (!focusWnd || ECommon.isNone(strCurrentShowWnd)) {
            this.registerGlobalKey(false)
        } else {
            this.registerGlobalKey(true)
        }
    }
    // update end ---------------------------------------------------------
}
