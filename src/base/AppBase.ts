import { app, Menu, nativeImage, MenuItem, session, Tray, Notification } from 'electron'
import path from 'path'

import { AppConfig } from '../config/AppConfig'
import { EAlertMsg } from '../enum/EAlertMsg'
import { ETabType } from '../enum/ECommon'
import { EMsgMgrType } from '../enum/EIMMsg'
import { EWnd } from '../enum/EWnd'
import { LoginSuccessInfo } from '../main/loginSuccessInfo'
import { AlertCloseWindow } from '../main/window/AlertCloseWindow'
import { AlertEDAWindow } from '../main/window/AlertEDAWindow'
import { AlertWindow } from '../main/window/AlertWindow'
import { LoginWindow } from '../main/window/LoginWindow'
import { MainWindow } from '../main/window/MainWindow'
import { MessageMgrWindow } from '../main/window/MessageMgrWindow'
import { SettingWindow } from '../main/window/SettingWindow'
import { BaseNIMDB } from '../mgr/BaseNIMDB'
import { ClientIndexDBMgr } from '../mgr/ClientIndexDBMgr'
import { MsgMgr } from '../mgr/MsgMgr'
import { NIMMgr } from '../mgr/NIMMgr'
import WndMgr from '../mgr/WndMgr'
import { WebSocketPushMgr } from '../mgr/WebSocketPushMgr'
import { AppUtil } from '../utils/AppUtil'
import AppContainer from './AppContainer'
const fs = require('fs')

const CheckPerformanceTime = 2000

const FrameRateTime = 500
const FlashTime = 300
export abstract class AppBase {
    private m_bInit: boolean = false
    private m_wndMgr!: WndMgr
    private m_msgMgr!: MsgMgr
    private m_dbMgr!: BaseNIMDB
    private m_loginSuccessInfo!: LoginSuccessInfo
    private m_listArgs: string[] = []

    private m_tray: Tray
    // 注册快捷键用
    private m_menu: Menu
    private m_bFlash: boolean = false
    private m_bTwinkle: boolean = false
    private m_nTrayFlashTimer: number = 0

    private m_dictSessionConfig: { [key: string]: unknown } = {}

    private m_nPerformanceTimer = 0
    private m_nSaveTimer = 0

    private m_dictIpcMainListener: { [key: string]: unknown } = {}

    private m_nGlobalTick: any

    private m_NIMMgr: NIMMgr
    private m_pushMgr: WebSocketPushMgr | null = null

    // life start ---------------------------------------------------------
    constructor() {
        this.m_msgMgr = new MsgMgr()
        this.m_wndMgr = new WndMgr()
        this.m_NIMMgr = new NIMMgr()
        this.m_dbMgr = new ClientIndexDBMgr()
    }
    init() {
        this.m_msgMgr.init()
        this.m_wndMgr.init()
        this.m_NIMMgr.init()
        this.m_dbMgr.init()
        
        // 初始化推送管理器
        this.initializePushManager()
        
        // 初始化推送调试工具
        this.initializePushDebugConsole()
        
        this.m_bInit = true

        this.warn('init', '初始化完毕')

        this.m_nGlobalTick = setInterval(() => {
            this.update(FrameRateTime)
        }, FrameRateTime)
    }
    registerKey(strKey: string, func: Function) {
        if (!this.m_menu) {
            this.m_menu = new Menu()
        }
        this.m_menu.append(
            new MenuItem({
                label: '',
                accelerator: strKey,
                click: () => {
                    console.log('按下快捷键', strKey)
                    func()
                },
            })
        )
        Menu.setApplicationMenu(this.m_menu)
    }

    destroy(strWhere: string) {
        AppUtil.info('app', 'destroy', strWhere)
        clearInterval(this.m_nGlobalTick)
        if (this.m_tray) {
            this.m_tray.destroy()
        }
        
        // 销毁推送管理器
        this.destroyPushManager()
        
        // NIM 功能已移除
        // this.m_NIMMgr.logoutImServer()
    }
    resetCookieAndCache() {
        return new Promise((resolve, reject) => {
            // 清除登录cookie
            session.defaultSession.cookies
                .get({})
                .then(listCookie => {
                    for (const cookie of listCookie) {
                        let strUrl = ''
                        strUrl += cookie.secure ? 'https://' : 'http://'
                        strUrl += cookie.domain.charAt(0) === '.' ? 'www' : ''
                        strUrl += cookie.domain
                        strUrl += cookie.path

                        session.defaultSession.cookies
                            .remove(strUrl, cookie.name)
                            .then(() => {
                                AppUtil.info('App', 'remove Cookie', `${cookie.name}, url:${strUrl}`)
                            })
                            .catch(error => {
                                AppUtil.error('App', 'remove Cookie', `${cookie.name}, url:${strUrl}`, error)
                            })
                    }
                    resolve(true)
                })
                .catch(error => {
                    AppUtil.error('App', 'reset', 'remove all Cookie', error)
                    resolve(false)
                })
            // 清除缓存 不关注回调
            session.defaultSession
                .clearCache()
                .then(() => {
                    AppUtil.info('App', 'clearCookieCache', 'clear cache suc')
                })
                .catch(error => {
                    AppUtil.error('App', 'clearCookieCache', 'clear cache error', error)
                })
        })
    }
    reset() {
        AppUtil.warn('AppBase', 'reset', '小助手重置配置')
        // 恢复设置
        AppConfig.resetUserConfig('小助手重置')

        this.resetCookieAndCache()

        // todo 重置机器码
        AppUtil.createAlert('提示', EAlertMsg.EAlertResetSuc)

        // 提醒窗口更新配置
        let wndSetting = AppUtil.getExistWnd(EWnd.ESetting) as SettingWindow
        if (wndSetting) {
            wndSetting.sendUpdateSetting()
            wndSetting.showPanel(false)
        }
        let wndCommandAlert = AppUtil.getExistWnd(EWnd.EAlert) as AlertWindow
        if (wndCommandAlert) {
            wndCommandAlert.showPanel(false)
        }
        let wndAlertClose = AppUtil.getExistWnd(EWnd.EAlertClose) as AlertCloseWindow
        if (wndAlertClose) {
            wndAlertClose.showPanel(false)
        }

        let wndAlertEDA = AppUtil.getExistWnd(EWnd.EAlertEDA) as AlertEDAWindow
        if (wndAlertEDA) {
            wndAlertEDA.showPanel(false)
        }

        // 还原界面比例
        this.m_wndMgr.resetViewScale()

        this.logout()
    }
    private handleLogoutFail(strReason: string) {
        let loginWindow = AppUtil.getCreateWnd(EWnd.ELoign) as LoginWindow
        if (loginWindow) {
            let strLoginUrl = AppConfig.getLoginUrlWithTimeStamp()
            AppUtil.info('app', 'logout', `重新到登录页面:${strLoginUrl}, 原因:${strReason}`)
            loginWindow.init()
        }
    }
    /** 切换账号，主动退出登录 */
    logout() {
        console.log('AppBase', 'logout', '主动退出登录')
    }

    /** 创建系统托盘 */
    createTray() {
        if (this.m_tray) {
            return
        }
        const icon = nativeImage.createFromPath(AppConfig.TrayIconPath)
        this.m_tray = new Tray(icon)
        this.m_tray.setToolTip('JLCONE')
        this.m_tray.setTitle('JLCONE')
        this.m_tray.on('right-click', () => {
            const locale = AppConfig.getLocale()
            const contextMenu = Menu.buildFromTemplate([
                // {
                //     type: 'checkbox',
                //     label: '开机启动',
                //     checked: app.getLoginItemSettings().openAtLogin,
                //     click: handleChangeOpenAtLogin,
                // },
                // {
                //     label: '消息管理器',
                //     click: () => {
                //         let wndMessageMgr = AppUtil.getCreateWnd(EWnd.EMsessageMgr) as MessageMgrWindow
                //         wndMessageMgr.enterTabTypeMsgID()
                //     },
                // },
                // {
                //     label: '切换账号',
                //     click: () => {
                //         this.logout()
                //     },
                // },

                {
                    label: locale.locale_15,
                    click: () => {
                        AppContainer.getApp().destroy('退出')
                        app.exit()
                    },
                },
            ])
            this.m_tray.popUpContextMenu(contextMenu)
        })
        this.m_tray.on('click', () => {
            this.showMainWindow()
        })
        this.setFlashTray(false)
    }

    createNotification(strMsg: string) {
        console.log('消息测试', strMsg)
        new Notification({
            title: '嘉立创下单助手消息',
            body: strMsg,
            // silent: true,
            icon: AppConfig.TrayIconPath,
            // timeoutType: 'never',
            // closeButtonText: '确定',
        }).show()
    }

    setFlashTray(bFlash: boolean) {
        if (!this.m_tray) {
            return
        }
        this.m_bFlash = bFlash
        this.m_bTwinkle = false
    }

    showMainWindow() {
        let strCurrentWnd = AppUtil.getCurrentShowWnd()
        let wndCurrent = AppUtil.getExistWnd(strCurrentWnd)
        AppUtil.info('AppBase', 'onClickTray', `当前显示窗口:【${strCurrentWnd}】`)
        let strFindKey: string = undefined
        if (!wndCurrent) {
            // 显示已经创建的窗口
            for (const strKey of EWnd.listMainWnd) {
                let wndFind = AppUtil.getExistWnd(strKey)
                AppUtil.info('AppBase', 'find', `${strKey} : ${wndFind === undefined}`)
                strFindKey = strKey
                if (wndFind !== undefined) {
                    wndCurrent = wndFind
                    break
                }
            }
        }
        AppUtil.info('AppBase', 'onClickTray', `找到主窗口:【${strFindKey}】`)
        if (!wndCurrent) {
            AppUtil.error('AppBase', 'onClickTray', `当前没有窗口显示`)
            // 创建新的登录窗口
            let loginWindow = AppUtil.getCreateWnd(EWnd.ELoign) as LoginWindow
            loginWindow?.showPanel(true)
            return
        }

        if (!wndCurrent.getBrowserWindow()?.isVisible()) {
            AppUtil.info('AppBase', 'onClickTray', `显示主窗口window:【${strFindKey}】`)
            wndCurrent.showPanel(true)
        }
        if (wndCurrent.getBrowserWindow()?.isMinimized()) {
            AppUtil.info('AppBase', 'onClickTray', `显示主窗口restore:【${strFindKey}】`)
            wndCurrent.getBrowserWindow()?.restore()
        }

        if (process.platform === 'darwin') {
            wndCurrent.getBrowserWindow().setFullScreen(wndCurrent.getIsMaximize())
        } else {
            if (wndCurrent.getIsMaximize()) {
                wndCurrent.getBrowserWindow().maximize()
            } else {
                wndCurrent.getBrowserWindow().unmaximize()
            }
        }

        wndCurrent.getBrowserWindow().moveTop()
        wndCurrent.getBrowserWindow().focus()
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    isInit() {
        return this.m_bInit
    }
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getListener(strMessage: string) {
        return this.m_dictIpcMainListener[strMessage]
    }
    addListener(strMessage: string, listener: any) {
        this.m_dictIpcMainListener[strMessage] = listener
    }
    setSessionConfig(strKey: string, value: any) {
        this.m_dictSessionConfig[strKey] = value
    }
    getSessionConfig(strKey: string) {
        return this.m_dictSessionConfig[strKey]
    }
    getWndMgr() {
        return this.m_wndMgr
    }
    getDBMgr() {
        return this.m_dbMgr
    }
    getNIMMgr() {
        return this.m_NIMMgr
    }

    setLoginInfo(loginInfo) {
        this.m_loginSuccessInfo = loginInfo
    }
    getLoginInfo() {
        return (
            this.m_loginSuccessInfo
        )
    }
    setLoginArgs(listArgs: string[]) {
        this.m_listArgs = listArgs
    }
    getLoginArgs() {
        return this.m_listArgs
    }
    getTray() {
        return this.m_tray
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    sendTrayMsg(strTitle: string, strMsg: string) {
        if (!this.m_tray) {
            return
        }
        if (process.platform === 'win32') {
            this.m_tray.displayBalloon({ icon: AppConfig.TrayIconPath, title: strTitle, content: strMsg })
        }
    }
    loginSuc() {
        this.registryUrlInterceptor()
        this.registryDownloadsInterceptor()
        this.createTray()
        
        // 延迟启动推送服务，确保登录状态已完全恢复
        setTimeout(() => {
            this.startPushServiceWithValidation()
        }, 1000)
    }
    info(strFunction: string, strLog: string, obj?: unknown) {
        AppUtil.info('AssistApp', strFunction, strLog, obj)
    }
    warn(strFunction: string, strLog: string, obj?: unknown) {
        AppUtil.warn('AssistApp', strFunction, strLog, obj)
    }
    error(strFunction: string, strLog: string, obj?: unknown) {
        AppUtil.error('AssistApp', strFunction, strLog, obj)
    }
    /**
     * 注册 URL 拦截器。
     * 功能：检测退出登录。
     * @param successInfo 登录成功后返回的 JSON 对象
     */
    private registryUrlInterceptor() {
        console.log('注册 URL 拦截器')
    }
    /**
     * 注册 下载 拦截器。
     * 功能：将下载项保存到设置默认下载位置。
     */
    private registryDownloadsInterceptor() {
        session.defaultSession.on('will-download', (event, item) => {
            const dPath = AppConfig.getUserConfig('downloadsPath') as string
            const savePath = path.join(dPath, item.getFilename())
            AppUtil.info('session', 'will-download', `下载位置：${dPath}，保存路径：${savePath}`)
            item.setSavePath(savePath)
        })
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onTimeCheckSave() {
        if (Object.keys(AppConfig.dictReason).length <= 0) {
            return
        }
        AppConfig.onTimeSave()
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number) {
        // console.log('桌面应用数据更新', nDeltaTime)
        this.m_nPerformanceTimer -= nDeltaTime
        if (this.m_nPerformanceTimer <= 0) {
            this.m_nPerformanceTimer = CheckPerformanceTime
            AppUtil.updateGetPerformance()
        }
        this.m_nSaveTimer -= nDeltaTime
        if (this.m_nSaveTimer <= 0) {
            this.m_nSaveTimer = 100
            this.onTimeCheckSave()
        }
        if (this.m_bFlash) {
            if (!this.m_tray) {
                this.m_bFlash = false
                return
            }
            this.m_nTrayFlashTimer -= nDeltaTime
            if (this.m_nTrayFlashTimer <= 0) {
                this.m_nTrayFlashTimer = FlashTime
                this.m_bTwinkle = !this.m_bTwinkle
                let strNullIcon = nativeImage.createFromPath(null)
                let strIconPath = nativeImage.createFromPath(AppConfig.TrayIconPath)
                this.m_tray.setImage(this.m_bTwinkle ? strIconPath : strNullIcon)
            }
        }

        if (this.m_wndMgr) {
            this.m_wndMgr.update(nDeltaTime)
        }
        if (this.m_msgMgr) {
            this.m_msgMgr.update(nDeltaTime)
        }
    }
    // update end ---------------------------------------------------------

    // WebSocket 推送功能相关方法 ---------------------------------------------------------
    
    /**
     * 初始化推送管理器
     */
    private initializePushManager(): void {
        try {
            this.info('initializePushManager', '开始初始化推送管理器')
            
            // 创建推送管理器实例
            this.m_pushMgr = new WebSocketPushMgr()
            
            // 设置推送服务的 IPC 通信接口
            this.setupPushServiceIPC()
            
            this.info('initializePushManager', '推送管理器初始化完成')
        } catch (error) {
            this.error('initializePushManager', '推送管理器初始化失败', error)
            // 推送功能初始化失败不应该影响应用启动
            this.m_pushMgr = null
        }
    }
    
    /**
     * 启动推送服务（带状态验证）
     */
    private async startPushServiceWithValidation(): Promise<void> {
        try {
            if (!this.m_pushMgr) {
                this.warn('startPushServiceWithValidation', '推送管理器未初始化，跳过启动推送服务')
                return
            }
            
            // 验证登录状态
            const LoginStateMgr = require('../mgr/LoginStateMgr').LoginStateMgr
            const loginStateMgr = LoginStateMgr.getInstance()
            
            if (!loginStateMgr.isLoggedIn()) {
                this.warn('startPushServiceWithValidation', '用户未登录，跳过推送服务启动')
                return
            }
            
            // 验证是否有用户标识信息
            const userInfo = loginStateMgr.getUserInfo()
            const hasCustomerCode = userInfo?.userInfo?.customerCode || 
                                  AppConfig.getUserConfig('customerCode') || 
                                  AppConfig.config?.customerCode
            const hasUserId = userInfo?.userId
            
            if (!hasCustomerCode && !hasUserId) {
                this.warn('startPushServiceWithValidation', '无法获取用户标识信息，跳过推送服务启动')
                this.info('startPushServiceWithValidation', '用户信息详情', {
                    userInfo: userInfo,
                    configCustomerCode: AppConfig.getUserConfig('customerCode'),
                    defaultCustomerCode: AppConfig.config?.customerCode
                })
                return
            }
            
            this.info('startPushServiceWithValidation', '开始启动推送服务', {
                hasCustomerCode: !!hasCustomerCode,
                hasUserId: !!hasUserId,
                loginTime: userInfo?.loginTime
            })
            
            await this.startPushService()
            
            this.info('startPushServiceWithValidation', '推送服务启动成功')
        } catch (error) {
            this.error('startPushServiceWithValidation', '启动推送服务失败', error)
            // 推送服务启动失败不应该影响应用正常运行
        }
    }

    /**
     * 启动推送服务
     */
    private async startPushService(): Promise<void> {
        try {
            if (!this.m_pushMgr) {
                this.warn('startPushService', '推送管理器未初始化，跳过启动推送服务')
                return
            }
            
            this.info('startPushService', '开始启动推送服务')
            
            await this.m_pushMgr.startPushService()
            
            this.info('startPushService', '推送服务启动成功')
        } catch (error) {
            this.error('startPushService', '启动推送服务失败', error)
            // 推送服务启动失败不应该影响应用正常运行
        }
    }
    
    /**
     * 停止推送服务
     */
    private async stopPushService(): Promise<void> {
        try {
            if (!this.m_pushMgr) {
                return
            }
            
            this.info('stopPushService', '开始停止推送服务')
            
            await this.m_pushMgr.stopPushService()
            
            this.info('stopPushService', '推送服务已停止')
        } catch (error) {
            this.error('stopPushService', '停止推送服务失败', error)
        }
    }
    
    /**
     * 获取推送服务状态
     */
    getPushServiceStatus(): any {
        if (!this.m_pushMgr) {
            return {
                isEnabled: false,
                connectionStatus: 'disconnected',
                error: '推送管理器未初始化'
            }
        }
        
        return this.m_pushMgr.getPushServiceStatus()
    }
    
    /**
     * 获取推送服务详细统计信息
     */
    getPushServiceStatistics(): any {
        if (!this.m_pushMgr) {
            return {
                error: '推送管理器未初始化'
            }
        }
        
        return this.m_pushMgr.getDetailedStatistics()
    }
    
    /**
     * 重启推送服务
     */
    async restartPushService(): Promise<void> {
        try {
            if (!this.m_pushMgr) {
                this.warn('restartPushService', '推送管理器未初始化')
                return
            }
            
            this.info('restartPushService', '开始重启推送服务')
            
            await this.m_pushMgr.restartPushService()
            
            this.info('restartPushService', '推送服务重启成功')
        } catch (error) {
            this.error('restartPushService', '重启推送服务失败', error)
        }
    }
    
    /**
     * 清除所有推送通知
     */
    clearAllPushNotifications(): void {
        try {
            if (!this.m_pushMgr) {
                return
            }
            
            this.m_pushMgr.clearAllNotifications()
            this.info('clearAllPushNotifications', '已清除所有推送通知')
        } catch (error) {
            this.error('clearAllPushNotifications', '清除推送通知失败', error)
        }
    }
    
    /**
     * 销毁推送管理器
     */
    private async destroyPushManager(): Promise<void> {
        try {
            if (!this.m_pushMgr) {
                return
            }
            
            this.info('destroyPushManager', '开始销毁推送管理器')
            
            await this.m_pushMgr.destroy()
            this.m_pushMgr = null
            
            this.info('destroyPushManager', '推送管理器已销毁')
        } catch (error) {
            this.error('destroyPushManager', '销毁推送管理器失败', error)
        }
    }
    
    /**
     * 设置推送服务的 IPC 通信接口
     */
    private setupPushServiceIPC(): void {
        try {
            this.info('setupPushServiceIPC', '设置推送服务 IPC 接口')
            
            // 获取推送服务状态 - 使用 handle 方法支持 invoke
            const getPushStatusHandler = async () => {
                try {
                    const status = this.getPushServiceStatus()
                    return { success: true, data: status }
                } catch (error) {
                    this.error('getPushStatusHandler', '获取推送服务状态失败', error)
                    return { success: false, error: error.message }
                }
            }
            AppUtil.ipcMainHandle('get-push-service-status', getPushStatusHandler)
            
            // 获取推送服务统计信息 - 使用 handle 方法支持 invoke
            const getPushStatsHandler = async () => {
                try {
                    const stats = this.getPushServiceStatistics()
                    return { success: true, data: stats }
                } catch (error) {
                    this.error('getPushStatsHandler', '获取推送服务统计信息失败', error)
                    return { success: false, error: error.message }
                }
            }
            AppUtil.ipcMainHandle('get-push-service-stats', getPushStatsHandler)
            
            // 重启推送服务 - 使用 handle 方法支持 invoke
            const restartPushServiceHandler = async () => {
                try {
                    await this.restartPushService()
                    return { success: true }
                } catch (error) {
                    this.error('restartPushServiceHandler', '重启推送服务失败', error)
                    return { success: false, error: error.message }
                }
            }
            AppUtil.ipcMainHandle('restart-push-service', restartPushServiceHandler)
            
            // 清除所有推送通知 - 使用 handle 方法支持 invoke
            const clearPushNotificationsHandler = async () => {
                try {
                    this.clearAllPushNotifications()
                    return { success: true }
                } catch (error) {
                    this.error('clearPushNotificationsHandler', '清除推送通知失败', error)
                    return { success: false, error: error.message }
                }
            }
            AppUtil.ipcMainHandle('clear-push-notifications', clearPushNotificationsHandler)
            
            // 同时保留旧的 on 方法以兼容性（如果有其他地方使用）
            const getPushStatusListener = (event: Electron.IpcMainEvent) => {
                try {
                    const status = this.getPushServiceStatus()
                    event.reply('push-service-status-reply', { success: true, data: status })
                } catch (error) {
                    this.error('getPushStatusListener', '获取推送服务状态失败', error)
                    event.reply('push-service-status-reply', { success: false, error: error.message })
                }
            }
            AppUtil.ipcMainOn('get-push-service-status', getPushStatusListener)
            
            const getPushStatsListener = (event: Electron.IpcMainEvent) => {
                try {
                    const stats = this.getPushServiceStatistics()
                    event.reply('push-service-stats-reply', { success: true, data: stats })
                } catch (error) {
                    this.error('getPushStatsListener', '获取推送服务统计信息失败', error)
                    event.reply('push-service-stats-reply', { success: false, error: error.message })
                }
            }
            AppUtil.ipcMainOn('get-push-service-stats', getPushStatsListener)
            
            // 添加调试方法来检查IPC处理器状态
            const debugIPCHandler = async () => {
                return {
                    success: true,
                    data: {
                        registeredHandlers: [
                            'get-push-service-status',
                            'get-push-service-stats', 
                            'restart-push-service',
                            'clear-push-notifications'
                        ],
                        timestamp: Date.now(),
                        pushManagerStatus: this.m_pushMgr ? 'initialized' : 'not_initialized'
                    }
                }
            }
            AppUtil.ipcMainHandle('debug-push-ipc', debugIPCHandler)
            
            this.info('setupPushServiceIPC', '推送服务 IPC 接口设置完成', {
                handlers: ['get-push-service-status', 'get-push-service-stats', 'restart-push-service', 'clear-push-notifications', 'debug-push-ipc']
            })
        } catch (error) {
            this.error('setupPushServiceIPC', '设置推送服务 IPC 接口失败', error)
        }
    }
    
    /**
     * 初始化推送调试Console工具
     */
    private initializePushDebugConsole(): void {
        try {
            // 在渲染进程中启用推送调试工具
            if (typeof window !== 'undefined') {
                this.info('initializePushDebugConsole', '推送调试Console工具已启用')
                
                // 显示调试工具可用信息
                setTimeout(() => {
                    console.log('🎯 [推送调试] 推送调试工具已就绪!')
                    console.log('📖 输入 pushDebug.showHelp() 查看可用命令')
                    console.log('📊 输入 pushDebug.showStatus() 查看当前状态')
                }, 2000)
            }
        } catch (error) {
            this.error('initializePushDebugConsole', '初始化推送调试工具失败', error)
        }
    }
    
    // 推送功能相关方法结束 ---------------------------------------------------------
}
