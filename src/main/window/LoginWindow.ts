import { app, BrowserView, net, RenderProcessGoneDetails, screen } from 'electron'
import AppContainer from '../../base/AppContainer'
import { WndBase } from '../../base/WndBase'
import { AppConfig } from '../../config/AppConfig'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'
import { MainWindow } from './MainWindow'
import { ErrorConfig } from '../../config/ErrorConfig'
import { LoginCacheMgr } from '../../mgr/LoginCacheMgr'
import { LoginStateMgr } from '../../mgr/LoginStateMgr'

const ReloadLoginTime = 10 * 60 * 1000  // 优化：从5分钟改为10分钟
const CheckLoginTime = 10000            // 优化：从5秒改为10秒



export interface ErrorData {
    reason: string
    exitCode: string
}

export class LoginWindow extends WndBase {
    static configMsg() {
        // 在窗体创建前运行
        let listenerLoginSuc = async (event, loginSuccessInfo) => {
            // 登录成功日志已清除
            try {
                // 检查登录信息是否有效
                if (!loginSuccessInfo) {
                    AppUtil.error('LoginWindow', '/login/success', '登录信息为空')
                    return
                }
                
                // 更新登录状态管理器
                const stateMgr = LoginStateMgr.getInstance()
                await stateMgr.setLoginState({
                    userId: loginSuccessInfo.userId || loginSuccessInfo.id || 'unknown',
                    username: loginSuccessInfo.username || loginSuccessInfo.name || 'unknown',
                    email: loginSuccessInfo.email || '',
                    token: loginSuccessInfo.token || loginSuccessInfo.accessToken || '',
                    refreshToken: loginSuccessInfo.refreshToken || '',
                    loginMethod: loginSuccessInfo.loginMethod || 'password',
                    userInfo: loginSuccessInfo
                })
                
                // 确保 customerCode 和 username 被保存到 AppConfig
                const configToSave = {
                    ...loginSuccessInfo,
                    customerCode: loginSuccessInfo.customerCode || loginSuccessInfo.customer_code || loginSuccessInfo.customerId,
                    username: loginSuccessInfo.username || loginSuccessInfo.name || loginSuccessInfo.user_name || loginSuccessInfo.nickname
                }
                
                // 确保关键信息被正确保存
                if (configToSave.customerCode) {
                    AppConfig.setUserConfig('customerCode', configToSave.customerCode)
                    // customerCode 保存日志已清除
                }
                
                if (configToSave.username) {
                    AppConfig.setUserConfig('username', configToSave.username)
                    // username 保存日志已清除
                }
                
                let loginWindow = AppUtil.getCreateWnd(EWnd.ELoign) as LoginWindow
                if (loginWindow) {
                    loginWindow.showPanel(false)
                    loginWindow.destroy()
                }
                
                // 保持原有的逻辑
                let assistApp = AppContainer.getApp()
                AppConfig.setUserConfigWithObject(configToSave)
                assistApp.setLoginInfo(configToSave)
                
                let mainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
                if (mainWindow) {
                    mainWindow.showPanel(true)
                    mainWindow.initOnLoginSuc()
                    // 先最大化
                    if (!mainWindow.getIsMaximize()) {
                        mainWindow.maximizeToggle()
                    }
                }
            } catch (error) {
                AppUtil.error('LoginWindow', '/login/success', '登录报错', error)
            }
        }
        AppUtil.ipcMainOn(EMessage.EMainLoginSuccess, listenerLoginSuc)

        let listenReloadLogin = event => {
            let loginWindow = AppUtil.getExistWnd(EWnd.ELoign) as LoginWindow
            if (!loginWindow) {
                return
            }

            loginWindow.reloadLogin()
        }
        AppUtil.ipcMainOn(EMessage.EMainReloadLogin, listenReloadLogin)

    }

    private m_loginView: BrowserView

    private m_nReloadTimer: number = ReloadLoginTime

    private m_nCheckTimer: number = CheckLoginTime

    private m_bCheckLogin = true

    private m_cacheMgr: LoginCacheMgr

    private m_loadFromCache = false

    private m_stateMgr: LoginStateMgr

    private m_bDestroyed = false // 标记窗口是否已销毁
    
    private m_bAutoJumpDisabled = false // 标记是否禁用自动跳转
    
    private m_startupMode: 'normal' | 'forced' = 'normal' // 启动模式：normal=正常启动，forced=强制跳转

    openDirectLogin() {}
    async loadLoginUrl() {
        let strLoginUrl = AppConfig.getLoginUrlWithTimeStamp()
        // 登录连接日志已清除

        // 只在特定情况下清除cookie，而不是每次都清除
        const shouldClearCookies = this.shouldClearCookiesOnLoad()
        if (shouldClearCookies) {
            // 清除cookie检测日志已清除
            await this.clearLoginCookies()
        } else {
            // 保留cookie日志已清除
        }

        // 禁用缓存加载，直接从服务器加载最新页面以避免404资源问题
        // await this.tryLoadFromCache(strLoginUrl)

        // 直接加载最新的登录页面
        this.m_loginView.webContents.loadURL(strLoginUrl)

        // 进行网络请求检测
        let request = net.request(strLoginUrl)

        request.on('abort', () => {
            // 登录页访问失败日志已清除
            this.openDirectLogin()
        })
        request.on(
            'redirect',
            (statusCode: number, method: string, redirectUrl: string, responseHeaders: Record<string, string[]>) => {
                // 登录页重定向日志已清除
                this.openDirectLogin()
            }
        )
        request.on('error', error => {
            // 登录页访问错误日志已清除

            let strError = error.toString()
            if (/ERR_CERT/.test(strError)) {
                app.importCertificate(
                    {
                        certificate: AppConfig.exeCrtPath,
                        password: '',
                    },
                    () => {}
                )
                AppUtil.createUserLog(this.m_browserWindow.webContents, strError, [])
            } else {
                AppUtil.createUserLog(this.m_browserWindow.webContents, strError, [])
            }

            this.openDirectLogin()
        })
        request.on('response', response => {
            // 可以访问
            if (response.statusCode === 200) {
                // 登录页访问成功日志已清除
            } else {
                // 登录页响应错误日志已清除
                this.openDirectLogin()
            }
        })
        request.end()
    }
    init() {
        // 初始化缓存管理器
        this.m_cacheMgr = LoginCacheMgr.getInstance()
        
        // 初始化状态管理器
        this.m_stateMgr = LoginStateMgr.getInstance()
        
        // 检查是否已有有效登录状态
        this.checkExistingLoginState()
        
        this.resetLoginView()

        let listLoginArgs = AppContainer.getApp().getLoginArgs()
        if (!(listLoginArgs && listLoginArgs.length > 1)) {
            this.loadLoginUrl()
        }

        let strLoginUrl = AppConfig.getLoginUrlWithTimeStamp()



        this.m_loginView.webContents.on('render-process-gone', (event: Event, details: RenderProcessGoneDetails) => {
            AppUtil.error('LoginWindow', 'render-process-gone', '渲染进程崩溃', {
                reason: details.reason,
                exitCode: details.exitCode
            })
            
            // 停止检查登录状态，防止操作已销毁的对象
            this.m_bCheckLogin = false
            
            try {
                // 处理渲染进程崩溃
                this.onLoginPageLoadFailed(strLoginUrl, ErrorConfig.ERenderProcessGone, {
                    reason: details.reason,
                    exitCode: details.exitCode.toString(),
                })
                
                // 延迟重建BrowserView，给系统时间清理资源
                setTimeout(() => {
                    try {
                        this.resetLoginView()
                        this.loadLoginUrl()
                    } catch (error) {
                        AppUtil.error('LoginWindow', 'render-process-gone-recovery', '渲染进程崩溃恢复失败', error)
                    }
                }, 2000)
                
            } catch (error) {
                AppUtil.error('LoginWindow', 'render-process-gone-handler', '处理渲染进程崩溃失败', error)
            }
        })

        this.m_loginView.webContents.on('did-finish-load', () => {
            this.m_loginView.webContents.executeJavaScript(AppConfig.viewFinishLoadJSPath)
        })
        this.m_loginView.webContents.on('will-navigate', (event, strUrl: string) => {
            if (/backpwd/.test(strUrl)) {
                // 修改密码连接日志已清除
                let mainDisplay = screen.getPrimaryDisplay()

                let dictOption = {
                    width: mainDisplay.workArea.width * 0.8,
                    height: mainDisplay.workArea.height * 0.8,
                }
                AppUtil.openNewBrowserWindow(strUrl, dictOption)
                event.preventDefault()
            }
        })
        this.onResetWebViewScale()
    }
    private getLoginBound() {
        let nWidth = 1000
        let nNavHeight = 30
        let nHeight = 680 - nNavHeight
        let nBorderSize = 2
        let nShadowSize = 0
        let bWin10Later = AppUtil.isWindow10OrLater()
        if (bWin10Later) {
            // window 10 之后启用阴影
            return {
                x: nShadowSize,
                y: nShadowSize + nNavHeight,
                width: nWidth - nShadowSize * 2,
                height: nHeight - nShadowSize,
            }
        } else {
            return {
                x: 1,
                y: nNavHeight + nBorderSize,
                width: nWidth - nBorderSize,
                height: nHeight - nBorderSize,
            }
        }
    }
    protected onSetBrowserWindow(): void {
        if (!this.m_browserWindow) {
            return
        }

        this.m_browserWindow.setBrowserView(this.m_loginView)
        let dictBound = this.getLoginBound()
        this.m_loginView.setBounds(dictBound)
        // 设置登录视图边界
    }
    onResetWebViewScale(): void {
        this.doResetWebViewScale(this.m_loginView)
    }
    onOpenSubViewDevTools() {
        try {
            if (this.m_loginView?.webContents && !this.m_loginView.webContents.isDestroyed()) {
                this.m_loginView.webContents.openDevTools({ mode: 'undocked' })
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'onOpenSubViewDevTools', '打开开发者工具失败', error)
        }
    }
    onShow(bShow: boolean) {}
    onRefresh() {}
    onDestroy() {
        try {
            // 停止所有检查和定时器
            this.m_bCheckLogin = false
            
            // 安全销毁 BrowserView（这会自动销毁 webContents）
            if (this.m_loginView?.webContents && !this.m_loginView.webContents.isDestroyed()) {
                this.m_loginView.webContents.removeAllListeners()
            }
            
            // 销毁 BrowserView 对象
            if (this.m_loginView) {
                try {
                    // 从窗口中移除 BrowserView
                    if (this.m_browserWindow && !this.m_browserWindow.isDestroyed()) {
                        this.m_browserWindow.removeBrowserView(this.m_loginView)
                    }
                } catch (error) {
                    AppUtil.error('LoginWindow', 'onDestroy', '移除BrowserView失败', error)
                }
            }
            
            // 设置销毁标志
            this.m_bDestroyed = true
            
            // 清理引用
            this.m_loginView = null
            this.m_cacheMgr = null
            this.m_stateMgr = null
            
        } catch (error) {
            AppUtil.error('LoginWindow', 'onDestroy', '销毁登录窗口失败', error)
        }
    }
    // life start ---------------------------------------------------------
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    setCheckLogin(bCheckLogin) {
        this.m_bCheckLogin = bCheckLogin
    }
    getLoginView() {
        return this.m_loginView
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    private resetLoginView() {
        try {
            // 安全检查：确保 webContents 存在且未被销毁
            if (this.m_loginView?.webContents && !this.m_loginView.webContents.isDestroyed()) {
                // 移除所有监听器防止内存泄漏
                this.m_loginView.webContents.removeAllListeners()
            }
            
            // 从窗口中移除旧的 BrowserView
            if (this.m_loginView && this.m_browserWindow && !this.m_browserWindow.isDestroyed()) {
                try {
                    this.m_browserWindow.removeBrowserView(this.m_loginView)
                } catch (error) {
                    AppUtil.error('LoginWindow', 'resetLoginView', '移除旧BrowserView失败', error)
                }
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'resetLoginView', '销毁webContents失败', error)
        }

        try {
            this.m_loginView = new BrowserView({
                webPreferences: {
                    preload: AppConfig.viewPreloadJSPath,
                },
            })
            
            let dictBound = this.getLoginBound()
            this.m_loginView.setBounds(dictBound)

            if (this.m_browserWindow && !this.m_browserWindow.isDestroyed()) {
                this.m_browserWindow.setBrowserView(this.m_loginView)
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'resetLoginView', '创建BrowserView失败', error)
            throw error // 重新抛出，让调用者处理
        }
    }
    reloadLogin() {
        this.m_bCheckLogin = true
        this.m_loadFromCache = false
        
        // 重新加载登录页
        let strTargetLogin = AppConfig.getLoginUrlWithTimeStamp()
        // 重新登录连接日志已清除
        
        // 清除cookie 重新登陆
        AppContainer.getApp()
            .resetCookieAndCache()
            .then(async () => {
                // 强制刷新缓存
                await this.m_cacheMgr.refreshCache()
                
                let strLoginUrl = AppConfig.getLoginUrlWithTimeStamp()
                this.m_loginView.webContents.loadURL(strLoginUrl)
            })
    }

    /**
     * 尝试从缓存加载登录页面
     */
    private async tryLoadFromCache(loginUrl: string): Promise<void> {
        try {
            // 缓存加载尝试日志已清除
            
            const cachedContent = await this.m_cacheMgr.getCachedLoginPage(loginUrl)
            
            if (cachedContent) {
                // 创建临时HTML文件
                const tempHtmlPath = await this.createTempHtmlFile(cachedContent, loginUrl)
                
                if (tempHtmlPath) {
                    // 缓存页面加载成功日志已清除
                    this.m_loginView.webContents.loadFile(tempHtmlPath)
                    this.m_loadFromCache = true
                    
                    // 在后台预加载最新页面
                    this.preloadLatestLoginPage(loginUrl)
                    return
                }
            }
            
            // 缓存不可用日志已清除
        } catch (error) {
            AppUtil.error('LoginWindow', 'tryLoadFromCache', '从缓存加载失败', error)
        }
    }

    /**
     * 创建临时HTML文件
     */
    private async createTempHtmlFile(content: string, originalUrl: string): Promise<string | null> {
        try {
            const path = require('path')
            const fs = require('fs')
            const tempDir = require('os').tmpdir()
            const tempFile = path.join(tempDir, `jlcone-login-${Date.now()}.html`)
            
            // 修改HTML内容，添加基础URL和缓存标识
            const modifiedContent = this.modifyHtmlForCache(content, originalUrl)
            
            fs.writeFileSync(tempFile, modifiedContent, 'utf-8')
            
            // 设置定时清理临时文件
            setTimeout(() => {
                try {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile)
                    }
                } catch (error) {
                    AppUtil.warn('LoginWindow', 'cleanupTempFile', '清理临时文件失败', error)
                }
            }, 5 * 60 * 1000) // 5分钟后清理
            
            return tempFile
        } catch (error) {
            AppUtil.error('LoginWindow', 'createTempHtmlFile', '创建临时HTML文件失败', error)
            return null
        }
    }

    /**
     * 修改HTML内容以适配缓存加载
     */
    private modifyHtmlForCache(content: string, originalUrl: string): string {
        try {
            const url = new URL(originalUrl)
            const baseUrl = `${url.protocol}//${url.host}`
            
            // 添加base标签
            let modifiedContent = content.replace(
                /<head>/i,
                `<head>\n<base href="${baseUrl}/">\n<meta name="jlcone-cached" content="true">`
            )
            
            // 添加缓存提示脚本
            const cacheScript = `
                <script>
                    // 页面从缓存加载
                    window.JLCONE_CACHED = true;
                    
                    // 添加缓存状态指示器
                    document.addEventListener('DOMContentLoaded', function() {
                        const indicator = document.createElement('div');
                        indicator.style.cssText = 'position:fixed;top:10px;right:10px;background:#4CAF50;color:white;padding:5px 10px;border-radius:3px;font-size:12px;z-index:9999;';
                        indicator.textContent = '缓存模式';
                        document.body.appendChild(indicator);
                        
                        // 3秒后隐藏指示器
                        setTimeout(() => {
                            indicator.style.display = 'none';
                        }, 3000);
                    });
                </script>
            `
            
            modifiedContent = modifiedContent.replace(
                /<\/body>/i,
                `${cacheScript}\n</body>`
            )
            
            return modifiedContent
        } catch (error) {
            AppUtil.error('LoginWindow', 'modifyHtmlForCache', '修改HTML内容失败', error)
            return content
        }
    }

    /**
     * 在后台预加载最新登录页面
     */
    private async preloadLatestLoginPage(loginUrl: string): Promise<void> {
        try {
            // 后台预加载开始日志已清除
            
            // 延迟2秒后开始预加载，避免影响当前页面加载
            setTimeout(async () => {
                try {
                    // 检查对象是否仍然有效，避免在窗口销毁后访问null对象
                    if (this.m_cacheMgr && !this.m_bDestroyed) {
                        await this.m_cacheMgr.precacheLoginPage()
                        // 后台预加载完成日志已清除
                    } else {
                        // 窗口销毁跳过预加载日志已清除
                    }
                } catch (error) {
                    AppUtil.error('LoginWindow', 'preloadLatestLoginPage', '后台预加载失败', error)
                }
            }, 2000)
            
        } catch (error) {
            AppUtil.error('LoginWindow', 'preloadLatestLoginPage', '启动后台预加载失败', error)
        }
    }

    /**
     * 自动跳转到主窗口
     */
    private autoJumpToMain(): void {
        try {
            AppUtil.info('LoginWindow', 'autoJumpToMain', '开始自动跳转到主窗口')
            
            // 隐藏登录窗口
            this.showPanel(false)
            
            // 创建主窗口
            const mainWindow = AppUtil.getCreateWnd(require('../../enum/EWnd').EWnd.EMain) as any
            if (mainWindow) {
                mainWindow.showPanel(true)
                mainWindow.initOnLoginSuc()
                
                // 先最大化
                if (!mainWindow.getIsMaximize()) {
                    mainWindow.maximizeToggle()
                }
            }
            
            // 销毁登录窗口
            this.destroy()
            
            AppUtil.info('LoginWindow', 'autoJumpToMain', '自动跳转到主窗口完成')
            
        } catch (error) {
            AppUtil.error('LoginWindow', 'autoJumpToMain', '自动跳转到主窗口失败', error)
        }
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): any {
        if (this.m_bDestroyed || !this.m_cacheMgr) {
            return { totalItems: 0, totalSize: 0, oldestCache: 0 }
        }
        return this.m_cacheMgr.getCacheStats() || { totalItems: 0, totalSize: 0, oldestCache: 0 }
    }

    /**
     * 清理缓存
     */
    async clearCache(): Promise<void> {
        try {
            if (!this.m_bDestroyed && this.m_cacheMgr) {
                await this.m_cacheMgr.clearAllCache()
                // 登录缓存清理完成日志已清除
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'clearCache', '清理登录缓存失败', error)
        }
    }

    /**
     * 设置是否禁用自动跳转
     */
    setAutoJumpDisabled(disabled: boolean): void {
        this.m_bAutoJumpDisabled = disabled
        // 如果禁用自动跳转，说明是强制模式
        this.m_startupMode = disabled ? 'forced' : 'normal'
        // 自动跳转设置日志已清除
    }
    
    /**
     * 检查是否禁用了自动跳转
     */
    isAutoJumpDisabled(): boolean {
        return this.m_bAutoJumpDisabled
    }
    
    /**
     * 检查强制退出标志
     */
    private checkForceLogoutFlag(): boolean {
        try {
            const path = require('path')
            const fs = require('fs')
            const flagFile = path.join(require('electron').app.getPath('userData'), 'force-logout.flag')
            return fs.existsSync(flagFile)
        } catch (error) {
            AppUtil.error('LoginWindow', 'checkForceLogoutFlag', '检查强制退出标志失败', error)
            return false
        }
    }
    
    /**
     * 清除强制退出标志
     */
    private clearForceLogoutFlag(): void {
        try {
            const path = require('path')
            const fs = require('fs')
            const flagFile = path.join(require('electron').app.getPath('userData'), 'force-logout.flag')
            if (fs.existsSync(flagFile)) {
                fs.unlinkSync(flagFile)
                // 清除强制退出标志日志已清除
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'clearForceLogoutFlag', '清除强制退出标志失败', error)
        }
    }

    /**
     * 检查现有登录状态
     */
    private async checkExistingLoginState(): Promise<void> {
        try {
            // 检查是否禁用了自动跳转
            if (this.m_bAutoJumpDisabled) {
                AppUtil.info('LoginWindow', 'checkExistingLoginState', '自动跳转已禁用，跳过检查')
                return
            }
            
            // 立即检查是否是主动退出登录（通过检查退出标志文件）
            const isManualLogout = this.checkManualLogoutFlag()
            if (isManualLogout) {
                AppUtil.info('LoginWindow', 'checkExistingLoginState', '检测到手动退出标志，清除标志并跳过自动跳转')
                this.clearManualLogoutFlag()
                // 立即清除登录状态和cookie，确保同步
                await this.clearAllLoginState()
                return
            }
            
            // 检查是否是强制退出登录
            const isForceLogout = this.checkForceLogoutFlag()
            if (isForceLogout) {
                AppUtil.info('LoginWindow', 'checkExistingLoginState', '检测到强制退出标志，清除标志并跳过自动跳转')
                this.clearForceLogoutFlag()
                // 立即清除登录状态和cookie，确保同步
                await this.clearAllLoginState()
                return
            }
            
            // 检查是否需要清除cookie
            const shouldClearCookies = this.shouldClearCookiesOnLoad()
            if (shouldClearCookies) {
                AppUtil.info('LoginWindow', 'checkExistingLoginState', '检测到需要清除cookie，执行清除操作')
                await this.clearLoginCookies()
                // 清除后不进行自动跳转
                return
            }
            
            // 添加延迟，给状态清除操作更多时间完成
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // 再次检查是否禁用了自动跳转（可能在延迟期间被设置）
            if (this.m_bAutoJumpDisabled) {
                AppUtil.info('LoginWindow', 'checkExistingLoginState', '延迟期间自动跳转被禁用，跳过检查')
                return
            }
            
            // 检查登录状态管理器的状态
            if (this.m_stateMgr && this.m_stateMgr.isLoggedIn()) {
                const userInfo = this.m_stateMgr.getUserInfo()
                AppUtil.info('LoginWindow', 'checkExistingLoginState', '检测到有效登录状态，准备自动跳转', {
                    username: userInfo?.username,
                    loginMethod: userInfo?.loginMethod
                })
                
                // 恢复正常的自动跳转逻辑
                this.autoJumpToMain()
                return
            }
            
            AppUtil.info('LoginWindow', 'checkExistingLoginState', '无有效登录状态，保持在登录页面')
        } catch (error) {
            AppUtil.error('LoginWindow', 'checkExistingLoginState', '检查登录状态失败', error)
        }
    }
    
    /**
     * 检查是否是手动退出登录
     */
    private checkManualLogoutFlag(): boolean {
        try {
            const path = require('path')
            const fs = require('fs')
            const flagFile = path.join(require('electron').app.getPath('userData'), 'manual-logout.flag')
            return fs.existsSync(flagFile)
        } catch (error) {
            AppUtil.error('LoginWindow', 'checkManualLogoutFlag', '检查退出标志失败', error)
            return false
        }
    }
    
    /**
     * 清除手动退出标志
     */
    private clearManualLogoutFlag(): void {
        try {
            const path = require('path')
            const fs = require('fs')
            const flagFile = path.join(require('electron').app.getPath('userData'), 'manual-logout.flag')
            if (fs.existsSync(flagFile)) {
                fs.unlinkSync(flagFile)
                // 清除退出标志日志已清除
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'clearManualLogoutFlag', '清除退出标志失败', error)
        }
    }
    
    /**
     * 判断是否需要在加载时清除cookie
     */
    private shouldClearCookiesOnLoad(): boolean {
        try {
            const path = require('path')
            const fs = require('fs')
            const { app } = require('electron')
            
            // 检查是否存在强制退出标志
            const forceLogoutFlag = path.join(app.getPath('userData'), 'force-logout.flag')
            if (fs.existsSync(forceLogoutFlag)) {
                // 强制退出标志检测日志已清除
                return true
            }
            
            // 检查是否存在手动退出标志
            const manualLogoutFlag = path.join(app.getPath('userData'), 'manual-logout.flag')
            if (fs.existsSync(manualLogoutFlag)) {
                // 手动退出标志检测日志已清除
                return true
            }
            
            // 检查是否禁用了自动跳转（通常表示从gotoLogin调用而来）
            if (this.m_bAutoJumpDisabled) {
                // 自动跳转禁用检测日志已清除
                return true
            }
            
            // 检查是否存在清除cookie的请求标志
            const clearCookieFlag = path.join(app.getPath('userData'), 'clear-cookies.flag')
            if (fs.existsSync(clearCookieFlag)) {
                // 清除cookie标志检测日志已清除
                // 清除标志文件
                fs.unlinkSync(clearCookieFlag)
                return true
            }
            
            // 保留cookie状态日志已清除
            return false
            
        } catch (error) {
            AppUtil.error('LoginWindow', 'shouldClearCookiesOnLoad', '检查清除cookie条件失败', error)
            // 出错时保守处理，不清除cookie
            return false
        }
    }

    /**
     * 清除所有登录状态（包括LoginStateMgr和cookie）
     */
    private async clearAllLoginState(): Promise<void> {
        try {
            AppUtil.info('LoginWindow', 'clearAllLoginState', '开始清除所有登录状态')
            
            // 1. 清除登录状态管理器
            if (this.m_stateMgr) {
                await this.m_stateMgr.logout('manual')
            }
            
            // 2. 清除cookie
            await this.clearLoginCookies()
            
            // 3. 清除AppConfig中的用户配置
            const { AppConfig } = require('../../config/AppConfig')
            AppConfig.setUserConfig('customerCode', '')
            AppConfig.setUserConfig('username', '')
            AppConfig.setUserConfig('token', '')
            AppConfig.setUserConfig('refreshToken', '')
            
            AppUtil.info('LoginWindow', 'clearAllLoginState', '所有登录状态清除完成')
            
        } catch (error) {
            AppUtil.error('LoginWindow', 'clearAllLoginState', '清除所有登录状态失败', error)
        }
    }

    /**
     * 清除登录相关的cookie
     */
    private async clearLoginCookies(): Promise<void> {
        try {
            // 开始清除cookie日志已清除
            
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
                        // 单个cookie清除日志已清除
                    } catch (error) {
                        AppUtil.error('LoginWindow', 'clearLoginCookies', `清除cookie失败: ${cookie.name}`, error)
                    }
                }
            }
            
            // 清除登录窗口BrowserView的存储数据
            if (this.m_loginView?.webContents && !this.m_loginView.webContents.isDestroyed()) {
                try {
                    await this.m_loginView.webContents.session.clearStorageData({
                        storages: ['cookies', 'localstorage', 'sessionstorage', 'websql', 'indexdb'],
                        quotas: ['temporary', 'persistent', 'syncable']
                    })
                    // 登录窗口存储数据清除日志已清除
                } catch (error) {
                    AppUtil.warn('LoginWindow', 'clearLoginCookies', '清除登录窗口存储数据失败', error)
                }
            }
            
            // cookie清除完成统计日志已清除
            
        } catch (error) {
            AppUtil.error('LoginWindow', 'clearLoginCookies', '清除cookie失败', error)
        }
    }
    
    /**
     * 显示继续登录确认对话框
     */
    private async showContinueLoginDialog(userInfo: any): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // 在登录页面显示提示信息
                this.m_loginView.webContents.executeJavaScript(`
                    (function() {
                        // 移除可能存在的旧对话框
                        const existingDialog = document.getElementById('jlcone-continue-dialog');
                        if (existingDialog) {
                            existingDialog.remove();
                        }
                        
                        const dialog = document.createElement('div');
                        dialog.id = 'jlcone-continue-dialog';
                        dialog.style.cssText = \`
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: white;
                            padding: 30px;
                            border-radius: 12px;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                            z-index: 10000;
                            text-align: center;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            max-width: 400px;
                            border: 1px solid #e0e0e0;
                        \`;
                        
                        const username = ${JSON.stringify(userInfo?.username || '未知用户')};
                        
                        dialog.innerHTML = \`
                            <div style="margin-bottom: 20px;">
                                <div style="font-size: 24px; margin-bottom: 10px;">🔐</div>
                                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">检测到已登录状态</h3>
                                <p style="margin: 0; color: #666; font-size: 14px;">用户: <strong>\${username}</strong></p>
                            </div>
                            <p style="margin: 0 0 20px 0; color: #555; font-size: 14px;">是否继续使用该账户？</p>
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <button id="continueBtn" style="
                                    padding: 10px 20px; 
                                    background: #007bff; 
                                    color: white; 
                                    border: none; 
                                    border-radius: 6px; 
                                    cursor: pointer;
                                    font-size: 14px;
                                    transition: background-color 0.2s;
                                ">继续使用</button>
                                <button id="reloginBtn" style="
                                    padding: 10px 20px; 
                                    background: #6c757d; 
                                    color: white; 
                                    border: none; 
                                    border-radius: 6px; 
                                    cursor: pointer;
                                    font-size: 14px;
                                    transition: background-color 0.2s;
                                ">重新登录</button>
                            </div>
                            <div style="margin-top: 15px; font-size: 12px; color: #999;">
                                <span id="countdown">10</span> 秒后自动继续使用
                            </div>
                        \`;
                        
                        document.body.appendChild(dialog);
                        
                        // 按钮事件处理
                        document.getElementById('continueBtn').onclick = () => {
                            document.body.removeChild(dialog);
                            window.postMessage({ type: 'continueLogin', result: true }, '*');
                        };
                        
                        document.getElementById('reloginBtn').onclick = () => {
                            document.body.removeChild(dialog);
                            window.postMessage({ type: 'continueLogin', result: false }, '*');
                        };
                        
                        // 倒计时
                        let countdown = 10;
                        const countdownElement = document.getElementById('countdown');
                        const timer = setInterval(() => {
                            countdown--;
                            if (countdownElement) {
                                countdownElement.textContent = countdown;
                            }
                            
                            if (countdown <= 0) {
                                clearInterval(timer);
                                if (document.body.contains(dialog)) {
                                    document.body.removeChild(dialog);
                                    window.postMessage({ type: 'continueLogin', result: true }, '*');
                                }
                            }
                        }, 1000);
                        
                        // 添加按钮悬停效果
                        const continueBtn = document.getElementById('continueBtn');
                        const reloginBtn = document.getElementById('reloginBtn');
                        
                        continueBtn.onmouseover = () => continueBtn.style.backgroundColor = '#0056b3';
                        continueBtn.onmouseout = () => continueBtn.style.backgroundColor = '#007bff';
                        
                        reloginBtn.onmouseover = () => reloginBtn.style.backgroundColor = '#545b62';
                        reloginBtn.onmouseout = () => reloginBtn.style.backgroundColor = '#6c757d';
                    })();
                `)
                
                // 监听用户选择
                const messageHandler = (event) => {
                    if (event.data?.type === 'continueLogin') {
                        window.removeEventListener('message', messageHandler)
                        resolve(event.data.result)
                    }
                }
                
                window.addEventListener('message', messageHandler)
                
                // 超时保护，15秒后自动选择继续
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler)
                    resolve(true)
                }, 15000)
                
            } catch (error) {
                AppUtil.error('LoginWindow', 'showContinueLoginDialog', '显示确认对话框失败', error)
                resolve(true) // 出错时默认继续
            }
        })
    }
    


    /**
     * 获取登录状态信息
     */
    getLoginStateInfo(): any {
        return this.m_stateMgr?.getCurrentState() || null
    }

    /**
     * 手动退出登录
     */
    async manualLogout(): Promise<void> {
        try {
            await this.m_stateMgr?.logout('manual')
            // 手动退出登录成功日志已清除
        } catch (error) {
            AppUtil.error('LoginWindow', 'manualLogout', '手动退出登录失败', error)
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------

    /**
     * 定时重新加载登录页面的回调方法
     */
    private onReloadLoginPage() {
        try {
            // 检查是否需要重新加载登录页面
            if (this.m_bCheckLogin && this.m_browserWindow?.isVisible()) {
                // 定时器重新加载日志已清除
                this.reloadLogin()
            }
        } catch (error) {
            AppUtil.error('LoginWindow', 'onReloadLoginPage', '重新加载登录页面失败', error)
        }
    }

    private onCheckLogin() {
        // 优化：添加更多检查条件，避免不必要的处理
        if (!this.m_bCheckLogin) {
            return
        }
        
        // 检查窗口是否可见，不可见时跳过检查
        if (!this.m_browserWindow?.isVisible()) {
            return
        }
        
        // 检测登陆成功
        if (!this.m_loginView) {
            return
        }
        if (!this.m_loginView.webContents) {
            return
        }
        
        // 检查webContents是否正在加载，加载中时跳过检查
        if (this.m_loginView.webContents.isLoading()) {
            return
        }

        let strUrl = this.m_loginView.webContents.getURL()
        if (strUrl.startsWith(AppConfig.ChromeErrorPage)) {
            // 页面重定向到了错误页，前端也需要window.location.href判断比较准
            this.onLoginPageLoadFailed(strUrl, ErrorConfig.EChromeError, {
                reason: '登录页重定向到了错误页',
                exitCode: '0',
            })
            return
        }

        let bCurrentIsLogin = false
        let listLoginUrl = [
            'https://passport.jlc.com/login',
            'https://helper.jlc.com/cas/realLogin.html',
            'https://passport.jlc.com/wechat?service',
            AppConfig.getLoginUrlWithTimeStamp(false),
        ]
        for (const strSplit of listLoginUrl) {
            if (strUrl.startsWith(strSplit)) {
                bCurrentIsLogin = true
                break
            }
        }

        if (!bCurrentIsLogin) {
            // 扫码登陆到了主页才处理
            if (AppConfig.isIndexUrl(strUrl)) {
                // 意外进入主页日志已清除
                let loginWindow = AppUtil.getCreateWnd(EWnd.ELoign) as LoginWindow
                if (loginWindow) {
                    loginWindow.showPanel(false)
                    loginWindow.destroy()
                }
                // 没有登陆数据的登陆
                let assistApp = AppContainer.getApp()
                assistApp.setLoginInfo({})

                let mainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
                if (mainWindow) {
                    mainWindow.showPanel(true)
                    mainWindow.initOnLoginSuc(strUrl)

                    // 先最大化
                    if (!mainWindow.getIsMaximize()) {
                        mainWindow.maximizeToggle()
                    }
                }
            }

            // 已注释的重新登录逻辑和相关日志已清除
        }
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    onLoginPageLoadFailed(strUrl: string, strReason: string, dictData: ErrorData) {
        AppUtil.error('BvMgr', 'onLoginPageLoadFailed', `url:${strUrl}页面加载失败:${strReason}`, dictData)

        this.m_bCheckLogin = false

        this.resetLoginView()

        this.m_loginView.webContents.loadFile('build/loginReload.html')

        this.m_loginView.webContents.once('did-finish-load', () => {
            if (strReason === ErrorConfig.EChromeError) {
                AppUtil.createUserLog(this.m_loginView.webContents, `${dictData.reason}`, [])
            } else if (strReason === ErrorConfig.ERenderProcessGone) {
                AppUtil.createUserLog(
                    this.m_loginView.webContents,
                    `渲染进程崩溃：${dictData.reason}, ${dictData.exitCode}`,
                    ['可尝试以下操作:', '1. 安装64位版本之后重新启动下单助手', '2. 联系技术支持人员']
                )
            } else {
                AppUtil.createUserLog(
                    this.m_loginView.webContents,
                    `未知错误：${dictData.reason}, ${dictData.exitCode}`,
                    ['可尝试以下操作:', '1. 安装最新版的下单助手', '2. 联系技术支持人员']
                )
            }
        })
    }
    update(nDeltaTime: number): void {
        super.update(nDeltaTime)
        this.m_nReloadTimer -= nDeltaTime
        if (this.m_nReloadTimer <= 0) {
            this.m_nReloadTimer = ReloadLoginTime
            this.onReloadLoginPage()
        }
        this.m_nCheckTimer -= nDeltaTime
        if (this.m_nCheckTimer <= 0) {
            this.m_nCheckTimer = CheckLoginTime
            this.onCheckLogin()
        }
    }
    // update end ---------------------------------------------------------
}
