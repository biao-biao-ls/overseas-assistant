import { BrowserView, ipcMain, Rectangle, BrowserWindow } from 'electron'
import AppContainer from '../../base/AppContainer'
import { AppMsg } from '../../base/AppMsg'
import { WndBase } from '../../base/WndBase'
import { AppConfig, DebugConfig, ETabKey } from '../../config/AppConfig'
import { EBvLabel, ECommon, ETabType } from '../../enum/ECommon'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'
import { BvWindowMgr } from '../../mgr/BvWindowMgr'
import { ASSIT_VERSION } from '../config'
import { AlertEDAWindow } from './AlertEDAWindow'
import { LoginWindow } from './LoginWindow'
import { BvViewMgr } from '../../mgr/BvViewMgr'
import { BvMgr } from '../../mgr/BvMgr'
import { SettingWindow } from './SettingWindow'
import { debounce } from '../../utils'
import { TabManager } from '../../mgr/TabManager'
import { TabConfigFactory } from '../../mgr/TabConfigFactory'
import { TabIPCHandler } from '../../mgr/TabIPCHandler'
import { TabBrowserViewManager } from '../../mgr/TabBrowserViewManager'
import { enhancedConfigHandler } from '../config/EnhancedConfigHandler'

// 在窗体创建前运行
let strErpViewId: string = ECommon.ENone
let strGerberListViewId: string = ECommon.ENone

// 20分钟reload
const ReloadTime = 20 * 60 * 1000
const ResizeTime = 1000

export class EBVWindowState {
    static ETotalShow = 'ETotalShow'
    static EMaskByOther = 'EMaskByOther'
    static EMinimize = 'EMinimize'
    static EHide = 'EHide'
}

export class MainWindow extends WndBase {
    static configMsg() {
        function handleKeydown(keyStr: string, webContents: Electron.WebContents) {
            switch (keyStr) {
                case 'F5':
                    webContents.reload()
                    break
                case 'F12':
                    webContents.openDevTools({ mode: 'undocked' })
                    break
            }
        }

        ipcMain.handle(EMessage.EMainGetCustomInfo, async (event, args) => { })
        ipcMain.handle(EMessage.EMainConfig, async (event, winName) => {
            const strIndexUrl = AppConfig.getIndexUrl()
            const config = {
                env: strIndexUrl.replace(/https+:\/\//, '').replace(/\/[\s\S]*/, ''),
                version: ASSIT_VERSION,
            }
            return Promise.resolve(config)
        })

        ipcMain.handle(EMessage.EMainGetUserConfig, async (event, winName) => {
            const { country, language, rate } = AppConfig.config as any
            return Promise.resolve({ country, language, rate })
        })

        ipcMain.handle(EMessage.EMainBrowserviewSetTop, async (event, viewId) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            const bvMgr = mainWindow.getBvMgr()

            bvMgr.setTopBrowserView(viewId, EMessage.EMainBrowserviewSetTop)
            return Promise.resolve(0)
        })

        ipcMain.handle(EMessage.EMainBrowserviewClose, async (event, viewId) => {
            AppUtil.info('MainWindow', EMessage.EMainBrowserviewClose, 'close bvView:' + viewId)
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            const bvMgr = mainWindow.getBvMgr()

            bvMgr.closeBv(viewId)

            /** 关闭 browser view 时判断关闭的页面是否是【 Gerber 文件上传历史页面】 */
            if (strGerberListViewId === viewId) {
                strGerberListViewId = ECommon.ENone
            }
            return Promise.resolve(0)
        })
        ipcMain.on('/browserView/keydown', (event, keyStr) => {
            handleKeydown(keyStr, event.sender)
        })

        // /** orderPcb，跳转到 ERP 主页，并执行脚本 */
        ipcMain.on('/browserView/orderPcb', (event, code) => {
            AppUtil.info('MainWindow', '/browserView/orderPcb', 'orderPcb:' + code)
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            const bvMgr = mainWindow.getBvMgr()
            bvMgr.setTopBrowserView(strErpViewId, 'orderPcb')

            mainWindow.syncTabData('orderPcb') // 重要操作，会输出日志
            const erpView = bvMgr.getWebView(strErpViewId)
            erpView.webContents.send('/browserView/executeJS', code)
        })

        ipcMain.on(EMessage.EMainSearchStart, (event, strValue) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            const bvMgr = mainWindow.getBvMgr()
            if (!bvMgr.getTopView()) {
                return
            }
            let topContent = bvMgr.getTopView().webContents
            if (!topContent) {
                return
            }
            let nRequestId = topContent.findInPage(strValue)
        })

        ipcMain.on(EMessage.EMainSearchNext, (event, strValue) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            const bvMgr = mainWindow.getBvMgr()
            if (!bvMgr.getTopView()) {
                return
            }
            let topContent = bvMgr.getTopView().webContents
            if (!topContent) {
                return
            }
            let nRequestId = topContent.findInPage(strValue, { findNext: true, forward: true })
        })
        ipcMain.on(EMessage.EMainSearchBack, (event, strValue) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            const bvMgr = mainWindow.getBvMgr()
            if (!bvMgr.getTopView()) {
                return
            }
            let topContent = bvMgr.getTopView().webContents
            if (!topContent) {
                return
            }
            let nRequestId = topContent.findInPage(strValue, { findNext: true, forward: false })
        })
        ipcMain.on(EMessage.EMainSearchClose, (event, strValue) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.showSearch(false)
        })
        ipcMain.on(EMessage.EMainMainSwitchTab, async (event, strSelectType: string) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.onChangeTab(strSelectType)
        })
        ipcMain.on(EMessage.EMainBvMgrResetBound, (event, strValue) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.getBvMgr().refreshViewPos()
        })

        ipcMain.on(EMessage.EMainReloadCommon, event => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.reloadAllView()
        })

        ipcMain.on(EMessage.EMainMouseEnterSite, () => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.showSiteWindow()
        })
        ipcMain.on(EMessage.EMainMouseLeaveSite, () => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.hideSiteWindow()
        })
        ipcMain.on(EMessage.EMainOpenSiteUrl, (event, strUrl) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            mainWindow.openUrlFromOther(strUrl)
        })

        const listenerSetUserConfig = (event: Electron.IpcMainEvent, dictConfig: { [key: string]: any }) => {
            // 设置用户配置
            AppConfig.setUserConfig(dictConfig.key, dictConfig.value)
        }
        // 设置用户配置 - 保留原有处理器作为备用
        AppUtil.ipcMainOn(EMessage.EMainSetUserConfig, listenerSetUserConfig)

        // 注意：EMainSetUserConfigWithObj 现在由 EnhancedConfigHandler 处理
        // 这里保留原有逻辑作为备用，但优先使用新的处理器
        const legacyConfigHandler = (event, dictConfig: { [key: string]: any }) => {
            if (dictConfig && dictConfig.language && dictConfig.source !== 'setting-window') {
                delete dictConfig.language
            }
            if (dictConfig && !dictConfig.language) {
                dictConfig.language = AppConfig.config.language
            }
         
            const { country, language, rate } = AppConfig.config as any
            const data = { country, language, rate }
            let hasDiff = false
            AppConfig.setUserConfigWithObject(dictConfig)

            for (const key in data) {
                const oldVal = data[key]
                const newVal = dictConfig[key]
                if (!newVal) continue
                if (oldVal !== newVal) {
                    hasDiff = true
                }
            }
            if (!hasDiff) return
            updateAllView({
                type: 'setting-update',
                data: { country: dictConfig.country, language: dictConfig.language, rate: dictConfig.rate },
            })
        }

        // 备用配置处理器（在增强处理器未初始化时使用）
        AppUtil.ipcMainOn(EMessage.EMainSetUserConfigWithObj, legacyConfigHandler)

        // 未登录，跳到登录窗口
        const listenerGotoLogin = async (event: Electron.IpcMainEvent, strUrl: string, options?: {
            clearCookies?: boolean,
            forceLogout?: boolean,
            disableAutoJump?: boolean
        }) => {
            AppUtil.info('EMainWindow', EMessage.ELoadingGotoLogin, '未登录，跳到登录窗口', { strUrl, options })
            try {
                // 立即清除登录状态管理器的状态，防止循环跳转
                const { LoginStateMgr } = require('../../mgr/LoginStateMgr')
                const loginStateMgr = LoginStateMgr.getInstance()
                await loginStateMgr.logout('manual')

                // 立即清除cookie，确保登录窗口不会检测到有效状态
                await clearLoginCookies()

                // 如果请求强制退出登录，执行额外的强制清除
                if (options?.forceLogout) {
                    await forceLogout()
                }

                // 如果请求清除cookie，创建清除cookie的标志文件
                if (options?.clearCookies) {
                    await createClearCookieFlag()
                }

                // 创建手动退出标志，防止登录窗口自动跳转
                await createManualLogoutFlag()

                let EMainWindow = AppUtil.getCreateWnd(EWnd.EMain)
                if (EMainWindow) {
                    EMainWindow.showPanel(false)
                    EMainWindow.destroy()
                }

                let loginWnd = AppUtil.getCreateWnd(EWnd.ELoign) as LoginWindow
                if (loginWnd) {
                    // 强制禁用自动跳转，防止循环
                    if (typeof loginWnd.setAutoJumpDisabled === 'function') {
                        loginWnd.setAutoJumpDisabled(true)
                    }
                    loginWnd.showPanel()
                }
            } catch (error) {
                AppUtil.error('EMainWindow', EMessage.ELoadingGotoLogin, '未登录，跳到登录窗口报错', error)
            }
        }

        // 创建清除cookie标志的函数
        const createClearCookieFlag = async () => {
            try {
                AppUtil.info('MainWindow', 'createClearCookieFlag', '创建清除cookie标志文件')

                const fs = require('fs')
                const path = require('path')
                const { app } = require('electron')
                const flagFile = path.join(app.getPath('userData'), 'clear-cookies.flag')
                fs.writeFileSync(flagFile, Date.now().toString())

                AppUtil.info('MainWindow', 'createClearCookieFlag', '清除cookie标志文件创建完成')

            } catch (error) {
                AppUtil.error('MainWindow', 'createClearCookieFlag', '创建清除cookie标志文件失败', error)
            }
        }

        // 创建手动退出标志的函数
        const createManualLogoutFlag = async () => {
            try {
                AppUtil.info('MainWindow', 'createManualLogoutFlag', '创建手动退出标志文件')

                const fs = require('fs')
                const path = require('path')
                const { app } = require('electron')
                const flagFile = path.join(app.getPath('userData'), 'manual-logout.flag')
                fs.writeFileSync(flagFile, Date.now().toString())

                AppUtil.info('MainWindow', 'createManualLogoutFlag', '手动退出标志文件创建完成')

            } catch (error) {
                AppUtil.error('MainWindow', 'createManualLogoutFlag', '创建手动退出标志文件失败', error)
            }
        }

        // 强制退出登录的函数
        const forceLogout = async () => {
            try {
                AppUtil.info('MainWindow', 'forceLogout', '开始强制清除登录状态')

                // 清除LoginStateMgr的状态
                const { LoginStateMgr } = require('../../mgr/LoginStateMgr')
                const loginStateMgr = LoginStateMgr.getInstance()
                await loginStateMgr.logout('force')

                // 清除AppConfig中的用户配置
                const { AppConfig } = require('../../config/AppConfig')
                AppConfig.setUserConfig('customerCode', '')
                AppConfig.setUserConfig('username', '')
                AppConfig.setUserConfig('token', '')
                AppConfig.setUserConfig('refreshToken', '')

                // 创建强制退出标志文件
                const fs = require('fs')
                const path = require('path')
                const { app } = require('electron')
                const flagFile = path.join(app.getPath('userData'), 'force-logout.flag')
                fs.writeFileSync(flagFile, Date.now().toString())

                AppUtil.info('MainWindow', 'forceLogout', '强制退出登录完成')

            } catch (error) {
                AppUtil.error('MainWindow', 'forceLogout', '强制退出登录失败', error)
            }
        }

        // 清除登录相关cookie的函数
        const clearLoginCookies = async () => {
            try {
                AppUtil.info('MainWindow', 'clearLoginCookies', '开始清除登录相关cookie')

                const { session } = require('electron')
                const defaultSession = session.defaultSession

                // 获取所有cookie
                const cookies = await defaultSession.cookies.get({})

                // 定义需要清除的登录相关cookie名称模式
                const loginCookiePatterns = [
                    /token/i,
                    /auth/i,
                    /session/i,
                    /login/i,
                    /user/i,
                    /jwt/i,
                    /access/i,
                    /refresh/i,
                    /passport/i,
                    /jlc/i,  // JLC相关的cookie
                    /cas/i   // CAS相关的cookie
                ]

                // 定义需要清除的域名模式
                const loginDomainPatterns = [
                    /jlc\.com$/i,
                    /passport\.jlc\.com$/i,
                    /helper\.jlc\.com$/i,
                    /\.jlc\.com$/i
                ]

                let clearedCount = 0

                for (const cookie of cookies) {
                    let shouldClear = false

                    // 检查cookie名称是否匹配登录相关模式
                    for (const pattern of loginCookiePatterns) {
                        if (pattern.test(cookie.name)) {
                            shouldClear = true
                            break
                        }
                    }

                    // 检查域名是否匹配登录相关模式
                    if (!shouldClear) {
                        for (const pattern of loginDomainPatterns) {
                            if (pattern.test(cookie.domain)) {
                                shouldClear = true
                                break
                            }
                        }
                    }

                    if (shouldClear) {
                        try {
                            const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`
                            await defaultSession.cookies.remove(url, cookie.name)
                            clearedCount++
                            AppUtil.info('MainWindow', 'clearLoginCookies', `已清除cookie: ${cookie.name} from ${cookie.domain}`)
                        } catch (error) {
                            AppUtil.error('MainWindow', 'clearLoginCookies', `清除cookie失败: ${cookie.name}`, error)
                        }
                    }
                }

                // 额外清除存储数据
                try {
                    await defaultSession.clearStorageData({
                        storages: ['cookies', 'localstorage', 'sessionstorage', 'websql', 'indexdb'],
                        quotas: ['temporary', 'persistent', 'syncable']
                    })
                    AppUtil.info('MainWindow', 'clearLoginCookies', '已清除存储数据')
                } catch (error) {
                    AppUtil.warn('MainWindow', 'clearLoginCookies', '清除存储数据失败', error)
                }

                AppUtil.info('MainWindow', 'clearLoginCookies', `cookie清除完成，共清除 ${clearedCount} 个cookie`)
                return { success: true, clearedCount }

            } catch (error) {
                AppUtil.error('MainWindow', 'clearLoginCookies', '清除cookie失败', error)
                return { success: false, error: error.message }
            }
        }
        AppUtil.ipcMainOn(EMessage.ELoadingGotoLogin, listenerGotoLogin)

        // 添加清除cookie的IPC处理器
        ipcMain.handle('/login/clearCookies', async () => {
            return await clearLoginCookies()
        })

        // 添加清除所有登录状态的IPC处理器
        ipcMain.handle('/login/clearAllState', async () => {
            try {
                AppUtil.info('MainWindow', '/login/clearAllState', '开始清除所有登录状态')

                // 1. 强制退出登录状态管理器
                await forceLogout()

                // 2. 清除所有cookie
                await clearLoginCookies()

                // 3. 清除所有登录窗口的状态
                const loginWnd = AppUtil.getExistWnd(EWnd.ELoign) as LoginWindow
                if (loginWnd) {
                    await loginWnd.clearCache()
                    AppUtil.info('MainWindow', '/login/clearAllState', '已清除登录窗口缓存')
                }

                AppUtil.info('MainWindow', '/login/clearAllState', '所有登录状态清除完成')
                return { success: true, message: '所有登录状态已清除' }

            } catch (error) {
                AppUtil.error('MainWindow', '/login/clearAllState', '清除所有登录状态失败', error)
                return { success: false, error: error.message }
            }
        })

        AppUtil.ipcMainOn(EMessage.EMainHistoryBack, (event: Electron.IpcMainEvent) => {
            let EMainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
            if (!EMainWindow.m_bvMgr) {
                return
            }
            let topView = EMainWindow.m_bvMgr.getTopView()
            if (!topView) {
                return
            }
            if (!topView.webContents) {
                return
            }
            if (topView.webContents.canGoBack()) {
                topView.webContents.goBack()
            }
            // console.log('topView', Object.keys(topView.webContents))
        })
        AppUtil.ipcMainOn(EMessage.EMainToViewMessage, (event: Electron.IpcMainEvent, obj: any) => {
            let EMainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
            if (!EMainWindow.m_bvMgr) {
                return
            }
            let topView = EMainWindow.m_bvMgr.getTopView()
            if (!topView) {
                return
            }
            if (!topView.webContents) {
                return
            }
            let ESettingWindow = AppUtil.getCreateWnd(EWnd.ESetting)
            if (ESettingWindow) {
                ESettingWindow.showPanel(false)
                ESettingWindow.destroy()
            }
            topView.webContents.send(EMessage.EMainFromMainMessage, obj)
        })

        const updateAllViewFunc = function updateAllView(obj: any): void {
            let EMainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
            if (!EMainWindow.m_bvMgr) {
                return
            }
            let allView = EMainWindow.m_bvMgr.getAllView() || {}
            for (let id in allView) {
                const currentView = allView[id]
                const view = currentView.getWebView()
                view.webContents.send(EMessage.EMainFromMainMessage, obj)
            }
        }

        const updateAllView = debounce(updateAllViewFunc, 100) as (obj: any) => void

        // 初始化增强配置处理器
        try {
            enhancedConfigHandler.initialize(updateAllView)
            AppUtil.info('MainWindow', 'configMsg', '增强配置处理器初始化成功')
        } catch (error) {
            AppUtil.error('MainWindow', 'configMsg', '增强配置处理器初始化失败', error)
        }

        AppUtil.ipcMainOn(EMessage.EMainSendAllView, (event: Electron.IpcMainEvent, obj: any) => {
            updateAllView(obj)
        })

        AppUtil.ipcMainHandle(EMessage.EMainGetLocale, async () => {
            return AppConfig.getLocale()
        })
    }
    private m_bvMgr!: BvMgr
    private m_strErpView: string | undefined = undefined
    private m_strCurTab: string = ETabType.EAssist
    // 目标变量，配合窗口使用
    private m_strTargetTab: string = ECommon.ENone
    private m_strTargetUrl: string = ECommon.ENone

    // 是否注册快捷键
    private m_bHadRegisterSearch: boolean = false

    // 防抖机制：防止频繁的tab更新日志
    private syncTabDataDebounce: NodeJS.Timeout | null = null
    private lastSyncReason: string = ''
    private syncCount: number = 0 // 统计同步次数
    private lastLogTime: number = 0 // 上次输出日志的时间

    private m_bDrag: boolean = false

    private m_nReloadTimer = ReloadTime

    private m_nResizeTimer = ResizeTime

    private m_strCurrentBVState: string = EBVWindowState.ETotalShow

    private m_listAfterIndexLoadUrl: string[] = []

    private m_siteWindow: BrowserWindow
    private m_nHideTimeOut: any = undefined

    // Tab 管理系统相关属性
    private m_tabManager: TabManager | null = null
    private m_tabIPCHandler: TabIPCHandler | null = null
    private m_tabBrowserViewManager: TabBrowserViewManager | null = null
    private m_isTabSystemEnabled: boolean = true
    // life start ---------------------------------------------------------
    showSiteWindow() {
        let listPos = this.m_browserWindow.getPosition()
        if (this.getIsMaximize()) {
            let dictBound: Rectangle = {
                x: listPos[0] + 16,
                y: listPos[1] + 8 + 46,
                width: 220,
                height: this.getSiteWindowHeight(),
            }
            this.m_siteWindow.setBounds(dictBound)
        } else {
            let dictBound: Rectangle = {
                x: listPos[0] + 8,
                y: listPos[1] + 46 + 2,
                width: 220,
                height: this.getSiteWindowHeight(),
            }
            this.m_siteWindow.setBounds(dictBound)
        }
        clearTimeout(this.m_nHideTimeOut)
        if (!this.m_siteWindow.isVisible()) {
            this.m_siteWindow.show()
            this.m_browserWindow.webContents.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderSiteState, true))
        }
    }
    hideSiteWindow() {
        clearTimeout(this.m_nHideTimeOut)
        this.m_nHideTimeOut = setTimeout(() => {
            this.m_siteWindow.hide()
            this.m_browserWindow.webContents.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderSiteState, false))
        }, 400)
    }
    getSiteWindowHeight() {
        return 46
    }
    initSiteWindow() {
        this.m_siteWindow = new BrowserWindow({
            alwaysOnTop: true,
            frame: false,
            hasShadow: false,
            width: 220,
            height: this.getSiteWindowHeight(),
            show: false,

            webPreferences: {
                nodeIntegrationInSubFrames: true,

                scrollBounce: true,
                safeDialogs: true,
                safeDialogsMessage: '',
                contextIsolation: true,
                sandbox: true,
                preload: AppConfig.preloadJSPath,
            },
        })
        this.m_siteWindow.loadFile('build/site.html')
    }
    init() {
        if (AppConfig.UseBrowserView) {
            this.m_bvMgr = new BvViewMgr(this.m_strWndType)
        } else {
            this.m_bvMgr = new BvWindowMgr(this.m_strWndType)
        }

        this.initSiteWindow()
        this.initTabSystem()
    }

    /**
     * 初始化 Tab 系统
     */
    private initTabSystem(): void {
        try {
            AppUtil.info('MainWindow', 'initTabSystem', '开始初始化 Tab 系统')

            // 创建 Tab 配置
            const tabConfig = TabConfigFactory.createDefaultConfig()

            // 创建 TabManager 实例
            this.m_tabManager = TabManager.getInstance(tabConfig)

            // 创建 IPC 处理器
            this.m_tabIPCHandler = new TabIPCHandler()
            this.m_tabIPCHandler.initialize(this.m_tabManager)

            // 创建 BrowserView 管理器
            this.m_tabBrowserViewManager = new TabBrowserViewManager(EWnd.EMain)
            this.m_tabBrowserViewManager.initialize(this.m_tabManager)

            // 设置事件监听器
            this.setupTabSystemEventListeners()

            AppUtil.info('MainWindow', 'initTabSystem', 'Tab 系统初始化完成')

        } catch (error) {
            AppUtil.error('MainWindow', 'initTabSystem', 'Tab 系统初始化失败', error)
            this.m_isTabSystemEnabled = false
        }
    }

    /**
     * 设置 Tab 系统事件监听器
     */
    private setupTabSystemEventListeners(): void {
        if (!this.m_tabManager || !this.m_tabBrowserViewManager) {
            return
        }

        // 监听窗口大小变化，更新 BrowserView 位置
        this.m_browserWindow?.on('resize', () => {
            if (this.m_tabBrowserViewManager) {
                this.m_tabBrowserViewManager.refreshAllBrowserViewBounds()
            }
        })

        // 监听窗口最大化/还原，更新 BrowserView 位置
        this.m_browserWindow?.on('maximize', () => {
            if (this.m_tabBrowserViewManager) {
                setTimeout(() => {
                    this.m_tabBrowserViewManager!.refreshAllBrowserViewBounds()
                }, 100)
            }
        })

        this.m_browserWindow?.on('unmaximize', () => {
            if (this.m_tabBrowserViewManager) {
                setTimeout(() => {
                    this.m_tabBrowserViewManager!.refreshAllBrowserViewBounds()
                }, 100)
            }
        })

        // 监听 Tab 管理器事件
        this.m_tabManager.onTabCreated((data) => {
            AppUtil.info('MainWindow', 'TabCreated', `Tab 创建: ${data.tabId}`)
        })

        this.m_tabManager.onTabClosed((data) => {
            AppUtil.info('MainWindow', 'TabClosed', `Tab 关闭: ${data.tabId}`)
        })

        this.m_tabManager.onTabActivated((data) => {
            AppUtil.info('MainWindow', 'TabActivated', `Tab 激活: ${data.tabId}`)
        })
    }

    protected onSetBrowserWindow(): void {
        if (!this.m_browserWindow) {
            return
        }
        if (process.platform === 'darwin') {
            this.getBrowserWindow().setFullScreen(this.getIsMaximize())
        } else {
            if (this.getIsMaximize()) {
                this.getBrowserWindow().maximize()
            } else {
                this.getBrowserWindow().unmaximize()
            }
        }

        if (!this.m_siteWindow) {
            this.initSiteWindow()
        }
        this.m_siteWindow.setParentWindow(this.getBrowserWindow())

        // this.getBrowserWindow().webContents.openDevTools({ mode: 'undocked' })

        this.m_browserWindow.on('resize', () => {
            if (this.m_bDrag) {
                return
            }
            if (this.m_bvMgr) {
                this.m_bvMgr.refreshViewPos()
            }
        })
        this.m_browserWindow.on('maximize', () => {
            if (this.m_bvMgr) {
                this.m_bvMgr.refreshViewPos()
            }
        })
        this.m_browserWindow.on('unmaximize', () => {
            if (this.m_bvMgr) {
                this.m_bvMgr.refreshViewPos()
            }
        })
        this.m_browserWindow.on('focus', () => {
            if (this.m_strCurTab !== ETabType.EEDA) {
                this.registerShortcutKey(true)
            }
        })
        this.m_browserWindow.on('blur', () => {
            this.registerShortcutKey(false)
        })

        this.m_browserWindow.webContents.on('did-finish-load', () => { })

        // 双击托盘
        if (this.m_bvMgr) {
            let topView = this.m_bvMgr.getTopView()
            this.m_browserWindow.setBrowserView(topView)
        }
    }
    sendSiteAndButtonCfg() { }

    initOnLoginSuc(strUseUrl: string | undefined = undefined) {
        try {
            // 检查登录状态是否有效
            const LoginStateMgr = require('../../mgr/LoginStateMgr').LoginStateMgr
            const loginStateMgr = LoginStateMgr.getInstance()

            if (!loginStateMgr.isLoggedIn()) {
                AppUtil.warn('MainWindow', 'initOnLoginSuc', '登录状态无效，跳转到登录页面')
                AppContainer.getApp().logout()
                return
            }

            const strIndexUrl = AppConfig.getIndexUrl()
            this.doOpenErpUrl(strIndexUrl)
            // 保存erp连接
            AppConfig.setUserConfig('erpUrl', strIndexUrl)
            AppUtil.info('MainWindow', 'initOnLoginSuc', '打开erp主页面', strIndexUrl)
        } catch (error) {
            AppUtil.error('MainWindow', 'initOnLoginSuc', '打开主页面报错', error)
            // 从之前历史中获取页面打开
            if (strUseUrl) {
                try {
                    AppUtil.warn('MainWindow', 'initOnLoginSuc history url', '打开使用主页面', strUseUrl)
                    this.doOpenErpUrl(strUseUrl)
                } catch (error) {
                    // 某得救了
                    AppUtil.error('MainWindow', 'initOnLoginSuc history url', '打开使用主页面报错', error)
                    // 重新登录
                    AppContainer.getApp().logout()
                    throw error
                }
                throw error
            } else {
                const strHistoryUrl = AppConfig.getUserConfig('erpUrl') as string
                try {
                    AppUtil.warn('MainWindow', 'initOnLoginSuc history url', '打开历史主页面', strHistoryUrl)
                    this.doOpenErpUrl(strHistoryUrl)
                } catch (error) {
                    // 某得救了
                    AppUtil.error('MainWindow', 'initOnLoginSuc history url', '打开历史主页面报错', error)
                    // 重新登录
                    AppContainer.getApp().logout()
                    throw error
                }
                throw error
            }
        }

        // 确保用户中心 Tab 存在
        this.ensureUserCenterTab()

        // 注册测试回调
        // setTimeout(() => {
        //     this.m_bvMgr.onPageLoadFailed('test', {})
        // }, 10000)
    }
    // life end ---------------------------------------------------------
    private doOpenErpUrl(strIndexUrl: string) {
        this.m_strCurTab = ETabType.EAssist
        if (this.m_strErpView === undefined) {
            // 第一次登录
            this.m_strErpView = this.handleCreateNewTab(strIndexUrl)
        } else {
            // 重新登录
            this.resetBvMgr()
            this.m_strErpView = this.handleCreateNewTab(strIndexUrl)
        }
        // 创建托盘，初始化管理器
        const strTopViewId = this.m_bvMgr.getTopViewId()

        this.m_bvMgr.setTopBrowserView(strTopViewId, 'doOpenErpUrl')

        AppContainer.getApp().loginSuc()

        // if (AppConfig.isDev() && DebugConfig.DebugOpenDev) {
        //     this.getBrowserWindow().webContents.openDevTools({ mode: 'undocked' })
        // }

        this.onResetWebViewScale()
        // 首页是小助手页面
        this.m_strCurTab = ETabType.EAssist
    }
    initInner() { }
    onResetWebViewScale(): void {
        this.m_bvMgr?.setViewScale()
    }
    resetBvMgr() {
        if (this.m_bvMgr) {
            // 销毁资源
            AppUtil.info('MainWindow', 'resetBvMgr', '销毁资源')
            this.m_bvMgr.destroyAllView()
        }
    }
    getBvMgr() {
        return this.m_bvMgr
    }

    /**
     * 获取 Tab 管理器
     */
    getTabManager(): TabManager | null {
        return this.m_tabManager
    }

    /**
     * 获取 Tab IPC 处理器
     */
    getTabIPCHandler(): TabIPCHandler | null {
        return this.m_tabIPCHandler
    }

    /**
     * 获取 Tab BrowserView 管理器
     */
    getTabBrowserViewManager(): TabBrowserViewManager | null {
        return this.m_tabBrowserViewManager
    }

    /**
     * 检查 Tab 系统是否启用
     */
    isTabSystemEnabled(): boolean {
        return this.m_isTabSystemEnabled && this.m_tabManager !== null
    }

    /**
     * 确保用户中心 Tab 存在
     */
    ensureUserCenterTab(): void {
        if (!this.isTabSystemEnabled() || !this.m_tabManager) {
            AppUtil.warn('MainWindow', 'ensureUserCenterTab', 'Tab 系统未启用')
            return
        }

        try {
            this.m_tabManager.ensureUserCenterTab()
            AppUtil.info('MainWindow', 'ensureUserCenterTab', '用户中心 Tab 已确保存在')
        } catch (error) {
            AppUtil.error('MainWindow', 'ensureUserCenterTab', '确保用户中心 Tab 失败', error)
        }
    }

    /**
     * 创建新的 Tab
     */
    createTab(url: string, options?: any): string | null {
        if (!this.isTabSystemEnabled() || !this.m_tabManager) {
            AppUtil.warn('MainWindow', 'createTab', 'Tab 系统未启用')
            return null
        }

        try {
            return this.m_tabManager.createTab(url, options)
        } catch (error) {
            AppUtil.error('MainWindow', 'createTab', '创建 Tab 失败', error)
            return null
        }
    }

    /**
     * 关闭指定的 Tab
     */
    closeTab(tabId: string): boolean {
        if (!this.isTabSystemEnabled() || !this.m_tabManager) {
            AppUtil.warn('MainWindow', 'closeTab', 'Tab 系统未启用')
            return false
        }

        try {
            return this.m_tabManager.closeTab(tabId)
        } catch (error) {
            AppUtil.error('MainWindow', 'closeTab', '关闭 Tab 失败', error)
            return false
        }
    }

    /**
     * 切换到指定的 Tab
     */
    switchToTab(tabId: string): void {
        if (!this.isTabSystemEnabled() || !this.m_tabManager) {
            AppUtil.warn('MainWindow', 'switchToTab', 'Tab 系统未启用')
            return
        }

        try {
            this.m_tabManager.switchToTab(tabId)
        } catch (error) {
            AppUtil.error('MainWindow', 'switchToTab', '切换 Tab 失败', error)
        }
    }

    /**
     * 获取所有 Tab 信息
     */
    getAllTabs(): any[] {
        if (!this.isTabSystemEnabled() || !this.m_tabManager) {
            return []
        }

        return this.m_tabManager.getAllTabs()
    }

    /**
     * 销毁 Tab 系统
     */
    private destroyTabSystem(): void {
        try {
            AppUtil.info('MainWindow', 'destroyTabSystem', '开始销毁 Tab 系统')

            // 销毁 Tab BrowserView 管理器
            if (this.m_tabBrowserViewManager) {
                this.m_tabBrowserViewManager.destroy()
                this.m_tabBrowserViewManager = null
            }

            // 销毁 IPC 处理器
            if (this.m_tabIPCHandler) {
                this.m_tabIPCHandler.destroy()
                this.m_tabIPCHandler = null
            }

            // 销毁 TabManager（单例）
            if (this.m_tabManager) {
                TabManager.destroyInstance()
                this.m_tabManager = null
            }

            this.m_isTabSystemEnabled = false

            AppUtil.info('MainWindow', 'destroyTabSystem', 'Tab 系统销毁完成')

        } catch (error) {
            AppUtil.error('MainWindow', 'destroyTabSystem', 'Tab 系统销毁失败', error)
        }
    }

    setCurrentTab(strTab: string) {
        this.m_strCurTab = strTab
    }
    openTopViewDevTool() {
        if (!this.m_bvMgr) {
            return
        }
        const strTopViewId = this.m_bvMgr.getTopViewId()
        let topView = this.m_bvMgr.getTopView()
        if (!topView) {
            return
        }
        if (!topView.webContents) {
            return
        }
        topView.webContents.openDevTools({ mode: 'undocked' })
    }
    showSearch(bShow = true) {
        if (!this.getBrowserWindow()) {
            return
        }
        if (!this.getBrowserWindow().webContents) {
            return
        }

        this.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderSetSearch, bShow))

        if (bShow === false) {
            let topContent = this.m_bvMgr.getTopView().webContents
            if (!topContent) {
                return
            }
            topContent.stopFindInPage('clearSelection')
        }
    }
    private registerShortcutKey(bRegister: boolean) {
        if (this.m_bHadRegisterSearch === bRegister) {
            return
        }
        this.m_bHadRegisterSearch = bRegister

        if (bRegister) {
            // console.log('注册搜索快捷键')
            // globalShortcut.register('CommandOrControl+f', () => {
            //     let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            //     if (!mainWindow) {
            //         return
            //     }
            //     if (mainWindow.getCurrentTabType() === ETabType.EEDA) {
            //         return
            //     }
            //     let strTopUrl = this.m_bvMgr.getTopView().webContents.getURL()
            //     if (/lceda.cn\/editor/.test(strTopUrl)) {
            //         return
            //     }

            //     mainWindow.showSearch(true)
            // })
            AppContainer.getApp().registerKey('CommandOrControl+f', () => {
                let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
                if (!mainWindow) {
                    return
                }
                if (mainWindow.getCurrentTabType() === ETabType.EEDA) {
                    return
                }
                let strTopUrl = this.m_bvMgr.getTopView().webContents.getURL()
                if (/lceda.cn\/editor/.test(strTopUrl)) {
                    return
                }

                mainWindow.showSearch(true)
            })
        } else {
            // console.log('取消注册搜索快捷键')
            // globalShortcut.unregister('CommandOrControl+f')
        }
    }
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getSiteWindow() {
        return this.m_siteWindow
    }
    getCurrentTabType() {
        return this.m_strCurTab
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    reloadAllView() {
        // 主界面重新加载所有界面
        if (!this.m_bvMgr) {
            return
        }
        let dictAllReloadData = this.m_bvMgr.getReloadData()

        this.resetBvMgr()

        let dictViewData = dictAllReloadData['view']
        let strTopViewUrl = dictAllReloadData['topUrl']
        let strTopViewId = ECommon.ENone
        for (const strView of Object.keys(dictViewData)) {
            let dictSingleViewData = dictViewData[strView]
            let strUrl = dictSingleViewData['url']
            let dictLabel = dictSingleViewData['label']
            let strUUID = this.m_bvMgr.createBv(strUrl, dictLabel, 'reloadAllView')
            if (strUrl === strTopViewUrl) {
                strTopViewId = strUUID
            }
        }
        if (strTopViewId !== ECommon.ENone) {
            this.m_bvMgr.setTopBrowserView(strTopViewId)
        }
        // 刷新tab信息
        this.syncTabData('reloadAllView') // 重要操作，会输出日志
    }
    syncTabData(strReason: string | undefined = undefined) {
        const reason = strReason || 'unknown'

        // 清除之前的防抖定时器
        if (this.syncTabDataDebounce) {
            clearTimeout(this.syncTabDataDebounce)
        }

        // 设置防抖，500ms内只执行一次，避免频繁更新
        this.syncTabDataDebounce = setTimeout(() => {
            this.doSyncTabData(reason)
            this.syncTabDataDebounce = null
        }, 500)
    }

    /**
     * 立即同步tab数据，用于用户主动操作需要即时反馈的场景
     */
    syncTabDataImmediate(strReason: string) {
        // 清除防抖定时器，避免重复执行
        if (this.syncTabDataDebounce) {
            clearTimeout(this.syncTabDataDebounce)
            this.syncTabDataDebounce = null
        }

        // 立即执行同步
        this.doSyncTabData(strReason)
    }

    /**
     * 实际执行tab数据同步的方法
     */
    private doSyncTabData(strReason: string) {
        try {
            this.syncCount++

            let listCfg = this.m_bvMgr.getBvInfoByLabel({
                [EBvLabel.tab]: this.getCurrentTabType(),
            })
            const dictViewInfo = {
                bvViewTitle: listCfg,
                topViewId: this.m_bvMgr.getTopViewId(),
                reason: strReason, // 传递同步原因，用于渲染进程判断是否需要立即响应
            }

            // 优化日志输出：智能日志控制
            if (this.shouldLogTabUpdate(strReason)) {
                const now = Date.now()
                // 避免相同原因的日志在短时间内重复输出
                if (strReason !== this.lastSyncReason || now - this.lastLogTime > 5000) {
                    AppUtil.info('MainWindow', 'syncTabData', `更新tab: ${this.getCurrentTabType()}, ${strReason} (总计: ${this.syncCount})`)
                    this.lastLogTime = now

                    // 只在开发环境下输出详细信息
                    if (AppConfig.isProcessDev()) {
                        // 开发环境配置信息
                    }
                }
            }

            // 发送消息到渲染进程
            if (this.getBrowserWindow() && this.getBrowserWindow().webContents) {
                this.getBrowserWindow().webContents?.send(
                    EMessage.ESendToRender,
                    new AppMsg(EMessage.ERenderRefreshTab, dictViewInfo)
                )
            }

            this.lastSyncReason = strReason
        } catch (error) {
            AppUtil.error('MainWindow', 'doSyncTabData', '同步tab数据失败', error)
        }
    }

    /**
     * 判断是否应该输出tab更新日志
     */
    private shouldLogTabUpdate(reason: string): boolean {
        // 在开发环境下输出所有日志
        if (AppConfig.isProcessDev()) {
            return true
        }

        // 生产环境只记录重要的更新事件，过滤掉频繁的页面事件
        const importantReasons = [
            'orderPcb', // 下单操作
            'reloadAllView', // 重新加载所有视图
            'sendMsgToTab', // 发送消息到tab
            'manual', // 手动触发的更新
            'createBv', // 创建浏览器视图
            'closeBv', // 关闭浏览器视图
            'setTopBrowserView', // 设置顶部浏览器视图
        ]

        // 过滤掉频繁触发的页面事件
        const frequentEvents = [
            'page-title-updated', // 页面标题更新（频繁）
            'dom-ready', // DOM就绪（频繁）
            'did-stop-loading', // 页面加载完成（频繁）
            'unknown', // 未知原因（通常是频繁事件）
        ]

        // 如果是频繁事件，不输出日志
        if (frequentEvents.includes(reason)) {
            return false
        }

        return importantReasons.includes(reason)
    }
    sendMsgToTab() {
        this.m_browserWindow?.webContents?.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderUpdateSetting))
        if (this.m_strCurTab === ETabType.EEDA) {
            this.showSearch(false)
        }

        this.m_browserWindow?.webContents?.send(
            EMessage.ESendToRender,
            new AppMsg(EMessage.ERenderMainSwitchTab, this.m_strCurTab)
        )
        let topView = this.m_bvMgr.getTopView() as BrowserView
        if (topView) {
            topView.webContents?.focus()
        }
        this.syncTabData('sendMsgToTab') // 重要操作，会输出日志
    }
    enterState(strState: string) {
        if (this.m_strCurrentBVState === strState) {
            return
        }
        this.m_strCurrentBVState = strState
    }
    /** 切换顶部大的标签页 */
    enterTabUrl(
        strTargetTab: string,
        strUrl: string,
        dictLable: { [key: string]: unknown } | undefined = undefined
    ): string {
        if (!dictLable) {
            dictLable = {}
        }
        let bNew = dictLable['new']
        dictLable[EBvLabel.tab] = this.m_strCurTab

        // 缓存
        this.m_strTargetTab = strTargetTab

        const logInfo = (strReason: string) => {
            AppUtil.info(
                'MainWindow',
                'enterTabUrl',
                `${strReason},${strTargetTab},${strUrl},${JSON.stringify(dictLable)}`
            )
        }

        AppUtil.info('MainWindow', 'enterTabUrl', `判断tab,${strTargetTab},${strUrl},${JSON.stringify(dictLable)}`)

        const handleAlertAsk = () => {
            let strLog = `切换页签拦截询问:${this.m_strCurTab} => ${strTargetTab}`
            logInfo(strLog)
            this.setTargetTabUrl(strUrl, strLog)
            let alertEDA = AppUtil.getCreateWnd(EWnd.EAlertEDA) as AlertEDAWindow
            if (alertEDA) {
                alertEDA.showPanel()
            }
            this.sendMsgToTab()
            return ECommon.ENone
        }

        const handleSame = () => {
            let strLog = `处理相同页签:${this.m_strCurTab} => ${strTargetTab}`
            // 检测是否已经创建
            let strTopViewId = this.m_bvMgr.getTopViewId()
            if (strTopViewId === strUrl) {
                logInfo('当前页面相等:' + strLog)
                return ECommon.ENone
            }
            let bvView = this.m_bvMgr.getExistViewByUrl(undefined, strUrl)
            if (!bNew && bvView) {
                // 已经创建
                // this.doReload(strUrl, '重新刷新：' + strLog, bvView.getViewId(), undefined, false)
                logInfo('已经创建:' + strLog)
                this.sendMsgToTab()
                this.m_bvMgr.setTopBrowserView(bvView.getViewId())
                return ECommon.ENone
            } else {
                logInfo('创建新的页签:' + strLog)
                dictLable[EBvLabel.tab] = this.m_strCurTab
                let strId = this.m_bvMgr.createBv(strUrl, dictLable, strLog)
                this.sendMsgToTab()
                return strId
            }
        }
        const handleDirect = () => {
            let strLog = `直接进入:${this.m_strCurTab} => ${strTargetTab}`
            logInfo(strLog)
            this.m_strCurTab = this.m_strTargetTab
            this.setTargetTabUrl(strUrl, strLog)
            let strId = ECommon.ENone
            dictLable[EBvLabel.tab] = this.m_strCurTab
            let bvView = this.m_bvMgr.getExistViewByUrl(undefined, this.m_strTargetUrl)
            if (bvView) {
                // 已经创建
                logInfo('已经创建')
                strId = bvView.getViewId()
                this.m_bvMgr.setTopBrowserView(strId)
            } else {
                logInfo('创建新的页签:' + this.m_strTargetUrl)
                strId = this.m_bvMgr.createBv(this.m_strTargetUrl, dictLable, strLog)
            }

            this.sendMsgToTab()
            return strId
        }

        /** 进入小助手 */
        if (strTargetTab === ETabType.EAssist) {
            if (this.m_strCurTab === ETabType.EAssist) {
                /** 小助手 => 小助手 */
                return handleSame()
            }
        }
        this.syncTabData()
    }
    getTargetTab() {
        return this.m_strTargetTab
    }
    getTargetUrl() {
        return this.m_strTargetUrl
    }

    setTargetTabUrl(strUrl: string, strReason: string) {
        AppUtil.info('MainWindow', 'setTargetUrl', `设置目标url: ${strUrl}【${strReason}】`)
        this.m_strTargetUrl = strUrl
    }

    // doSwitchTabFromFrame(bCloseCur: boolean) {
    //     if (this.m_strTargetTab === ECommon.ENone || this.m_strTargetUrl === ECommon.ENone) {
    //         AppUtil.error(
    //             'MainWindow',
    //             'doSwitchTabFromFrame',
    //             'this.m_strTargetTab === ECommon.ENone || this.m_strTargetUrl === ECommon.ENone'
    //         )
    //         return
    //     }
    //     let dictLabel = {
    //         [EBvLabel.tab]: this.m_strTargetTab,
    //     }
    //     if (bCloseCur) {
    //         this.m_bvMgr.destroyViewByLabel({
    //             [EBvLabel.tab]: this.m_strCurTab,
    //         })
    //     }
    //     AppUtil.info('MainWindow', 'doSwitchTabFromFrame', `${this.m_strTargetUrl},${this.m_strTargetTab}`)
    //     // 设置数据
    //     this.m_strCurTab = this.m_strTargetTab
    //     if (this.m_strCurTab === ETabType.EEDA) {
    //         this.registerShortcutKey(false)
    //     }
    //     let strTabKey = AppConfig.getTabKeyFromCfg(this.m_strTargetUrl)
    //     let bvFindView: BvItem | undefined = undefined
    //     if (strTabKey === ETabKey.EErpIndex) {
    //         // 是主页，检查是否有带index的tab
    //         AppUtil.info('MainWindow', 'doSwitchTabFromFrame', `需要打开主页: ${this.m_strTargetUrl}`)
    //         let listViewTitle = this.m_bvMgr.getBvInfoByLabel({ [EBvLabel.tab]: this.getCurrentTabType() })
    //         for (const item of listViewTitle) {
    //             if (AppConfig.hasIndexKey(item['url'])) {
    //                 AppUtil.info('MainWindow', 'doSwitchTab', `找到带主页连接标识: ${item['url']}`)
    //                 bvFindView = this.m_bvMgr.getLogicView(item['id'])
    //                 this.setTargetTabUrl(item['url'], '找到带主页连接标识')
    //                 break
    //             }
    //         }
    //     } else {
    //         // 切换检查
    //         if (strTabKey === ETabKey.EFAIndex) {
    //             bvFindView = this.m_bvMgr.getExistViewByTabKey(undefined, [ETabKey.EFAIndex, ETabKey.EFA])
    //         } else {
    //             bvFindView = this.m_bvMgr.getExistViewByUrl(undefined, this.m_strTargetUrl)
    //         }
    //     }
    //     if (bvFindView) {
    //         AppUtil.info('MainWindow', 'doSwitchTab', `找到目标：${this.m_strTargetUrl}, 当前:${bvFindView.getUrl()}`)
    //         this.m_bvMgr.setTopBrowserView(bvFindView.getViewId(), 'doSwitchTab找到目标')
    //         AppUtil.info(
    //             'MainWindow',
    //             'doSwitchTab',
    //             `直接切换链接:${this.m_strTargetUrl}, ${this.m_listAfterIndexLoadUrl}`
    //         )
    //         if (AppConfig.isIndexUrl(this.m_strTargetUrl)) {
    //             AppUtil.info('MainWindow', 'doSwitchTab', `切换目标是主页 ${this.m_listAfterIndexLoadUrl}`)
    //             for (const strUrl of this.m_listAfterIndexLoadUrl) {
    //                 this.openUrlFromOther(strUrl)
    //             }
    //             this.m_listAfterIndexLoadUrl = []
    //         }
    //     } else {
    //         AppUtil.info('MainWindow', 'getExistViewByUrl', `没有找到目标：${this.m_strTargetUrl}`)
    //         this.m_bvMgr.createBv(this.m_strTargetUrl, dictLabel, 'doSwitchTab')
    //     }
    //     // 通知主窗体
    //     this.m_browserWindow?.webContents?.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderUpdateSetting))
    //     if (this.m_strCurTab === ETabType.EEDA) {
    //         this.showSearch(false)
    //     }
    //     this.m_browserWindow?.webContents?.send(
    //         EMessage.ESendToRender,
    //         new AppMsg(EMessage.ERenderMainSwitchTab, this.m_strCurTab)
    //     )
    //     let topView = this.m_bvMgr.getTopView() as BrowserView
    //     if (topView) {
    //         topView.webContents?.focus()
    //         setTimeout(() => {
    //             if (topView.webContents.getURL() !== this.m_strTargetUrl && ECommon.isNotNone(this.m_strTargetUrl)) {
    //                 console.log('刷新当前页面', topView.webContents.getURL(), this.m_strTargetUrl)
    //                 topView.webContents.loadURL(this.m_strTargetUrl)
    //                 topView.webContents.once('did-finish-load', () => {
    //                     if (topView.webContents.getURL().split('?')[0] === this.m_strTargetUrl.split('?')[0]) {
    //                         console.log('重新刷新', topView.webContents.getURL())
    //                         topView.webContents.reload()
    //                     }
    //                 })
    //             }
    //             this.m_strTargetTab = ECommon.ENone
    //             this.setTargetTabUrl(ECommon.ENone, '已刷新完当前页面')
    //         }, 200)
    //     } else {
    //         this.m_strTargetTab = ECommon.ENone
    //         this.setTargetTabUrl(ECommon.ENone, '重置')
    //     }
    // }
    doSwitchTab(strTargetTab: string, strTargetUrl: string, bAlert: undefined | boolean = undefined): string {
        this.m_strTargetTab = strTargetTab
        this.m_strTargetUrl = strTargetUrl

        if (bAlert === undefined)
            if (AppConfig.isAlertEDA()) {
                AppUtil.info('MainWindow', 'doSwitchTab', '提示询问:' + this.m_strTargetUrl)
                let alertEDA = AppUtil.getCreateWnd(EWnd.EAlertEDA) as AlertEDAWindow
                if (alertEDA) {
                    alertEDA.showPanel()
                }
                this.sendMsgToTab()
                return ECommon.ENone
            }
        if (AppConfig.isCloseCur()) {
            // 删除当前
            this.m_bvMgr.destroyViewByLabel({
                [EBvLabel.tab]: this.m_strCurTab,
            })
        }

        this.m_strCurTab = this.m_strTargetTab

        let listCurrentTab = this.m_bvMgr.getBvInfoByLabel({
            [EBvLabel.tab]: this.m_strTargetTab,
        })

        let dictLabel = {
            [EBvLabel.tab]: this.m_strTargetTab,
        }

        let strViewId = ECommon.ENone
        if (listCurrentTab.length <= 0) {
            AppUtil.info('MainWindow', 'doSwitchTab', '当前历史记录Tab不存在:' + this.m_strTargetTab)

            strViewId = this.m_bvMgr.createBv(this.m_strTargetUrl, dictLabel)
            this.m_bvMgr.setTopBrowserView(strViewId)
        } else {
            // 按照历史记录
            listCurrentTab.sort((dictItem1, dictItem2) => {
                return (dictItem2.index as number) - (dictItem1.index as number)
            })
            AppUtil.info('MainWindow', 'doSwitchTab', '当前历史记录Tab存在:' + this.m_strTargetTab)
            // 有数据，切换为之前的页面
            this.m_bvMgr.setTopBrowserView(listCurrentTab[0].id as string)
        }

        this.sendMsgToTab()
        return strViewId
    }

    handleCreateNewTab(strUrl: string, bNew: boolean = false): string {
        let dictLabel = {
            'new': bNew,
        }
        return this.enterTabUrl(ETabType.EAssist, strUrl, dictLabel)
    }
    filterUrlErpView(strViewCurId: string | undefined, strNewUrl: string): boolean {
        let bvView = this.m_bvMgr.getExistViewByUrl(strViewCurId, strNewUrl)

        if (bvView !== undefined) {
            // 替换当前页
            AppUtil.info('MainWindow', 'filterUrlErpView', `查找到匹配的tab页: ${strNewUrl}, ${bvView.getViewId()}`)
            this.doReload(strNewUrl, 'filterUrlErpView', bvView.getViewId(), strViewCurId)
            return true
        } else {
            AppUtil.info('MainWindow', 'filterUrlErpView', `查找不到到匹配的tab页: ${strNewUrl}`)
        }

        return false
    }
    private doReload(
        strNewUrl: string,
        strReason: string,
        strViewFindId: string,
        strViewCurId: string | undefined = undefined,
        bReload: boolean = true
    ) {
        if (!this.m_bvMgr) {
            return
        }

        let bvCurView = this.m_bvMgr.getLogicView(strViewCurId)
        if (bvCurView) {
            AppUtil.info('MainWindow', 'doReload', '关闭当前页面:' + strViewCurId)
            this.m_bvMgr.closeBv(strViewCurId)
        }
        let bvFindView = this.m_bvMgr.getLogicView(strViewFindId)
        if (!bvFindView) {
            AppUtil.info('MainWindow', 'doReload', '找到的页面丢失:' + strViewFindId)
            return
        }
        bvFindView.getWebView()?.webContents?.loadURL(strNewUrl)
        this.m_bvMgr.setTopBrowserView(bvFindView.getViewId(), 'doReload:' + bReload)
        if (bReload) {
            setTimeout(() => {
                AppUtil.info('MainWindow', 'doReload', `reload: ${strReason}, ${strNewUrl}`)
                bvFindView.getWebView()?.webContents.reload()
            }, 800)
        }
    }
    openUrlFromOther(strUrl: string) {
        let bEDA = AppConfig.isEditorUrl(strUrl)
        let dictLabel = {
            'new': true,
        }
        let bSite = true
        AppUtil.info('MainWindow', 'openUrlFromOther', `从其他地方打开:${strUrl}`)
        if (this.m_strCurTab === ETabType.EAssist) {
            if (bEDA) {
                // 小助手页面打开eda连接
                AppUtil.info('MainWindow', 'openUrlFromOther', `小助手页面打开eda连接:${strUrl}`)
                return this.enterTabUrl(ETabType.EEDA, strUrl, dictLabel)
            } else {
                AppUtil.info('MainWindow', 'openUrlFromOther', `小助手页面打开小助手连接:${strUrl}`)
                if (!this.filterUrlErpView(undefined, strUrl)) {
                    return this.enterTabUrl(ETabType.EAssist, strUrl, dictLabel)
                }
            }
        } else if (this.m_strCurTab === ETabType.EEDA) {
            if (bEDA) {
                // eda页面打开eda连接
                AppUtil.info('MainWindow', 'openUrlFromOther', `eda页面打开eda连接:${strUrl}`)
                return this.enterTabUrl(ETabType.EEDA, strUrl, dictLabel)
            } else {
                if (bSite) {
                    AppUtil.info('MainWindow', 'openUrlFromOther', `eda页面打开eda连接，站点打开:${strUrl}`)
                    AppUtil.openNewBrowserWindow(strUrl)
                } else {
                    const strIndexUrl = AppConfig.getIndexUrl()
                    // 先打开主页，再打开另一个
                    AppUtil.info('MainWindow', 'openUrlFromOther', `eda页面打开小助手连接:${strUrl}`)
                    AppUtil.info(
                        'MainWindow',
                        'openUrlFromOther',
                        '先打开小助手再打开页面：' + this.m_listAfterIndexLoadUrl
                    )
                    this.m_listAfterIndexLoadUrl.push(strUrl)

                    this.enterTabUrl(ETabType.EAssist, strIndexUrl, dictLabel)
                }
            }
        }
    }
    refreshReloadTime() {
        // AppUtil.info("MainWindow", "refreshReloadTime", "刷新reloadBv时间")
        this.m_nReloadTimer = ReloadTime
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onChangeTab(strSelectTab: string) {
        /** 填写Url */
        if (strSelectTab === ETabType.EAssist) {
            let strIndexUrl = AppConfig.getIndexUrl()
            this.doSwitchTab(ETabType.EAssist, strIndexUrl)
        } else if (strSelectTab == ETabType.EEDA) {
            this.doSwitchTab(ETabType.EEDA, AppConfig.EditorUrl)
        }
    }
    onUrlFinish(strFinishUrl: string) {
        AppUtil.info('MainWindow', 'onUrlFinish', `直接切换链接:${strFinishUrl}, ${this.m_listAfterIndexLoadUrl}`)
        if (AppConfig.isIndexUrl(strFinishUrl)) {
            AppUtil.info('MainWindow', 'onUrlFinish', `切换目标是主页 ${this.m_listAfterIndexLoadUrl}`)
            for (const strUrl of this.m_listAfterIndexLoadUrl) {
                this.openUrlFromOther(strUrl)
            }
            this.m_listAfterIndexLoadUrl = []
        }
    }
    onOpenSubViewDevTools(): void {
        if (this.m_bvMgr) {
            this.m_bvMgr.getTopView().webContents.openDevTools({ mode: 'undocked' })
            // 测试
            // this.m_bvMgr.getReloadView().webContents.openDevTools({ mode: 'undocked' })
        }
    }
    maximizeToggle(): void {
        super.maximizeToggle()

        let bWin10Later = AppUtil.isWindow10OrLater()
        this.getBrowserWindow().webContents.send(
            EMessage.ESendToRender,
            new AppMsg(EMessage.ERenderSyncIsWin10, bWin10Later)
        )
        this.m_bvMgr.refreshViewPos()
    }
    minimize(): void {
        super.minimize()
    }

    onShow(bShow: boolean) {
        if (this.m_bvMgr) {
            this.m_bvMgr.setShow(bShow)
        }
    }
    onRefresh() { }
    onDestroy() {
        try {
            /** 退出登录时销毁相关变量 */
            strGerberListViewId = ECommon.ENone
            strErpViewId = ECommon.ENone

            // 清理防抖定时器
            if (this.syncTabDataDebounce) {
                clearTimeout(this.syncTabDataDebounce)
                this.syncTabDataDebounce = null
            }

            // 销毁 Tab 系统
            this.destroyTabSystem()

            // 销毁BrowserView管理器
            this.m_bvMgr?.destroyAllView()

            AppUtil.info('MainWindow', 'onDestroy', '主窗口资源清理完成')
        } catch (error) {
            AppUtil.error('MainWindow', 'onDestroy', '主窗口销毁失败', error)
        }
    }
    onReloadBv() {
        if (this.m_strCurTab === ETabType.EEDA) {
            return
        }
        if (this.m_bvMgr) {
            let topView = this.m_bvMgr.getTopView()
            if (topView) {
                AppUtil.info('MainWindow', 'onReloadBv', '重新刷新Bv')
                // topView.webContents.reload()
            }
        }
    }
    onCheckResize() {
        if (!this.m_bvMgr) {
            return
        }
        this.m_bvMgr.refreshViewPos()
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number) {
        super.update(nDeltaTime)

        if (this.m_bvMgr) {
            this.m_bvMgr.update(nDeltaTime)
        }
        let strTopUrl = this.m_bvMgr.getTopView()?.webContents?.getURL()
        let bStandard = false
        if (strTopUrl) {
            bStandard = /lceda.cn\/editor/.test(strTopUrl)
        }
        this.m_nReloadTimer -= nDeltaTime
        if (this.m_nReloadTimer <= 0) {
            this.m_nReloadTimer = ReloadTime
            this.onReloadBv()
        }
        this.m_nResizeTimer -= nDeltaTime
        if (this.m_nResizeTimer <= 0) {
            this.m_nResizeTimer = ResizeTime
            this.onCheckResize()
        }

        // 检测 bvmgr显示
        // if (!this.m_bvMgr) {
        //     return
        // }
        // let bMinimized = this.m_browserWindow.isMinimized()
        // let bVisible = this.m_browserWindow.isVisible()

        // if (bMinimized) {
        //     this.enterState(EBVWindowState.EMinimize)
        // } else {
        //     if (bVisible) {
        //         let focusWindow = BrowserWindow.getFocusedWindow()
        //         if (focusWindow === null) {
        //             this.enterState(EBVWindowState.EMaskByOther)
        //         } else {
        //             this.enterState(EBVWindowState.ETotalShow)
        //         }
        //     } else {
        //         this.enterState(EBVWindowState.EHide)
        //     }
        // }

        // this.m_bvMgr.refreshViewPos()
    }
    updateState() {
        switch (this.m_strCurrentBVState) {
            case EBVWindowState.ETotalShow:
                this.m_bvMgr.setShow(true)
                this.m_bvMgr.setFocus(true)
                break
            case EBVWindowState.EHide:
                this.m_bvMgr.setShow(false)
                this.m_bvMgr.setFocus(false)
                break
            case EBVWindowState.EMaskByOther:
                this.m_bvMgr.setShow(true)
                this.m_bvMgr.setFocus(false)
                break
            case EBVWindowState.EMinimize:
                this.m_bvMgr.setShow(false)
                this.m_bvMgr.setFocus(false)
                break

            default:
                break
        }
    }
    // update end ---------------------------------------------------------
}
