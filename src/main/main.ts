import {
    app,
    BrowserWindow,
    BrowserWindowConstructorOptions,
    crashReporter,
    globalShortcut,
    HandlerDetails,
    nativeImage,
    netLog,
    shell,
    Rectangle,
    ipcMain,
    WebContents,
} from 'electron'

import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { autoUpdater } from 'electron-updater'
import { getLogger } from 'log4js'
import languageList from '../utils/languages.json'

import { AssistApp } from '../app/AssistApp'
import AppContainer from '../base/AppContainer'
import { AppConfig } from '../config/AppConfig'
import { EWnd } from '../enum/EWnd'
import { AppUtil, initLog } from '../utils/AppUtil'
import { storeUserDeviceInfo } from './utils'
import { MainWindow } from './window/MainWindow'
import { ECommon } from '../enum/ECommon'
import { EMessage } from '../enum/EMessage'
import { AppMsg } from '../base/AppMsg'
import { UpdateService, UpdateInfo } from '../services/UpdateService'

// 开发环境自动重载
let reload: ((path: string, options?: { electron?: string; hardResetMethod?: string }) => void) | undefined
if (process.env.NODE_ENV === 'development') {
    try {
        reload = require('../../devTool/electron-reload/main.js')
    } catch (error) {
        // 开发工具不存在时忽略
    }
}

Object.defineProperty(app, 'isPackaged', {
    get() {
        return true
    },
})

// 只在生产环境下启用自动更新
if (!AppConfig.isProcessDev()) {
    autoUpdater.logger = getLogger()
    autoUpdater.checkForUpdatesAndNotify()
} else {
    AppUtil.info('main', 'autoUpdater', '开发环境跳过自动更新检查')
}

// 生产环境注册协议
if (!app.isDefaultProtocolClient('JLCONE')) {
    if (process.argv[1]) {
        const result = app.setAsDefaultProtocolClient('JLCONE', process.execPath, [path.resolve(process.argv[1])])
        AppUtil.info('main', 'protocol', `协议注册结果: ${result ? '成功' : '失败'}`)
    }
}

/**
 * 设置自动更新器的Feed URL
 * 根据平台（macOS/Windows）和架构（ARM/Intel）设置不同的更新源
 */
function setupAutoUpdater(): void {
    // 开发环境跳过自动更新设置
    if (AppConfig.isProcessDev()) {
        AppUtil.info('main', 'setupAutoUpdater', '开发环境跳过自动更新设置')
        return
    }

    const updateService = UpdateService.getInstance()
    const feedURL = updateService.getFeedURL()

    AppUtil.info('main', 'setupAutoUpdater', `设置更新源: ${feedURL}`)
    autoUpdater.setFeedURL(feedURL)
}

/**
 * 检查更新（结合API和electron-updater）
 */
async function checkForUpdatesWithAPI(): Promise<void> {
    // 开发环境跳过更新检查
    if (AppConfig.isProcessDev()) {
        AppUtil.info('main', 'checkForUpdatesWithAPI', '开发环境跳过更新检查')
        return
    }

    try {
        console.log('🔍 开始检查更新...')
        const updateService = UpdateService.getInstance()
        const updateInfo = await updateService.checkForUpdates()

        console.log('🔍 更新检查结果:', JSON.stringify(updateInfo, null, 2))

        if (updateInfo.hasUpdate) {
            AppUtil.info(
                'main',
                'checkForUpdatesWithAPI',
                `发现新版本: ${updateInfo.version}, 强制更新: ${updateInfo.forceUpdate}`
            )

            // 保存更新信息到配置
            AppConfig.setUserConfig('updateInfo', updateInfo, true)
            console.log('💾 已保存更新信息到配置')

            if (updateInfo.forceUpdate) {
                // 强制更新：直接显示更新窗口
                console.log('🔥 检测到强制更新，显示更新窗口')
                showForceUpdateWindow(updateInfo)
            } else {
                // 非强制更新：通过electron-updater检查并下载
                console.log('📦 检测到可选更新，使用 electron-updater')
                autoUpdater.checkForUpdates()
            }
        } else {
            AppUtil.info('main', 'checkForUpdatesWithAPI', '当前已是最新版本')
            console.log('✅ 当前已是最新版本')

            // 检查是否有之前保存的更新信息
            const existingUpdateInfo = AppConfig.getUserConfig('updateInfo') as UpdateInfo
            if (existingUpdateInfo && existingUpdateInfo.hasUpdate) {
                console.log('📋 发现已保存的更新信息，显示更新窗口')
                showForceUpdateWindow(existingUpdateInfo)
            } else {
                // 发送无更新消息到渲染进程
                const currentWindow = AppUtil.getCurrentShowWnd()
                const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
                if (mainWindow) {
                    mainWindow
                        .getBrowserWindow()
                        .webContents.send(
                            EMessage.ESendToRender,
                            new AppMsg('update-not-available', { version: updateInfo.version })
                        )
                }
            }
        }
    } catch (error) {
        AppUtil.error('main', 'checkForUpdatesWithAPI', '检查更新失败', error)
        console.error('❌ 更新检查失败:', error)
    }
}

/**
 * 显示强制更新窗口
 */
function showForceUpdateWindow(updateInfo: UpdateInfo): void {
    const currentWindow = AppUtil.getCurrentShowWnd()
    const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow

    if (mainWindow) {
        // 隐藏主窗口并显示更新窗口
        mainWindow.showPanel(false)

        const updateTipWin = AppUtil.getCreateWnd(EWnd.EUpdateTip)
        if (updateTipWin) {
            updateTipWin.showPanel(true)

            // 等待更新窗口准备好后发送消息
            setTimeout(() => {
                // 发送强制更新消息到更新窗口，确保包含正确的版本号
                updateTipWin.getBrowserWindow().webContents.send(
                    EMessage.ESendToRender,
                    new AppMsg('force-update-available', {
                        ...updateInfo,
                        version: updateInfo.version, // 使用API返回的新版本号
                    })
                )
                AppUtil.info('main', 'showForceUpdateWindow', `发送强制更新消息到更新窗口: ${updateInfo.version}`)
            }, 100) // 延迟100ms确保窗口已准备好
        }
    }
}

/**
 * 处理深度链接协议
 */
function handleProtocolLinks(): void {
    if (process.argv.length >= 2) {
        const uri = process.argv.find(arg => arg.startsWith('JLCONE://'))
        if (uri) {
            handleDeepLink(uri)
        }
    }
}

/**
 * 初始化应用程序实例
 */
function initializeApp(): AssistApp {
    const assistApp = new AssistApp()
    AppContainer.setApp(assistApp)
    assistApp.createTray()
    return assistApp
}

/**
 * 加载用户配置
 */
function loadUserConfig(): void {
    try {
        console.log('loadUserConfig: 开始加载配置文件', AppConfig.userConfigPath)
        const configData = fs.readFileSync(AppConfig.userConfigPath, 'utf-8')
        const config = JSON.parse(configData)
        console.log('loadUserConfig: 成功读取配置文件', {
            language: config.language,
            userLanguage: config.userLanguage,
            hasLanguageList: !!config.languageList,
            languageListLength: config.languageList?.length,
        })

        AppConfig.config = config

        // 确保语言列表不包含"跟随系统"选项
        AppConfig.config.languageList = languageList

        // 新的语言管理系统：使用有效语言逻辑
        const effectiveLanguage = AppConfig.getEffectiveLanguage()
        console.log('loadUserConfig: 计算出的有效语言:', effectiveLanguage)

        // 使用系统初始化标记来设置语言
        AppConfig.setUserConfigWithObject(
            {
                language: effectiveLanguage,
                __source: 'system-init',
            },
            false
        )

        AppConfig.readAutoStartFromRegdit()
        AppConfig.refreshAutoStart()
        AppConfig.checkVersion()

        console.log('loadUserConfig: 配置加载完成', {
            finalLanguage: AppConfig.config.language,
            getCurrentLanguage: AppConfig.getCurrentLanguage(),
            userLanguage: AppConfig.config.userLanguage,
        })
    } catch (err) {
        console.error('loadUserConfig: 读取配置文件失败', err)
        AppUtil.error('main', 'loadUserConfig', '读取用户配置失败，重置配置', err)
        AppConfig.resetUserConfig('读取文件失败重置配置')
    }
}

/**
 * 设置平台特定的UI配置
 */
function setupPlatformUI(): void {
    if (process.platform === 'darwin') {
        const icon = nativeImage.createFromPath(AppConfig.NavIconPath)
        app.dock.setIcon(icon)
    }
}

/**
 * 解析命令行参数
 */
function parseCommandLineArgs(): string[] {
    let args: string[] = []

    if (process.argv) {
        args = [...process.argv]
        AppUtil.info('main', 'parseCommandLineArgs', '命令行参数: ' + JSON.stringify(process.argv))
        args.splice(0, 1)
    } else {
        AppUtil.info('main', 'parseCommandLineArgs', '无命令行参数')
    }

    return args
}

/**
 * 清理旧的更新程序进程
 */
function cleanupOldUpdaters(): void {
    try {
        exec('taskkill /F /IM UpdateClient.exe', () => {})
        exec('taskkill /F /IM UpdateClientDaemon.exe', () => {})
    } catch (error) {
        // 忽略错误，进程可能不存在
    }
}

/**
 * 启动网络日志记录
 */
function startNetworkLogging(): void {
    const userPath = app.getPath('userData')
    netLog.startLogging(`${userPath}/logs/net.log`, { captureMode: 'default' })
}

/**
 * 根据环境配置启动相应的窗口
 */
function startAppropriateWindow(): void {
    const env = AppConfig.Env

    if (isProductionEnvironment(env)) {
        startProductionWindow()
    } else if (env === ECommon.ELOCAL) {
        startLocalWindow()
    } else if (env === ECommon.EDEV) {
        startDevWindow()
    } else if (env === ECommon.EINNER) {
        startInnerWindow()
    } else {
        handleInvalidEnvironment(env)
    }
}

/**
 * 检查是否为生产环境
 */
function isProductionEnvironment(env: string): boolean {
    return env === ECommon.EPro || env === ECommon.EUAT || env === ECommon.EFAT || env === ECommon.EDEV
}

/**
 * 启动生产环境窗口
 */
function startProductionWindow(): void {
    const loginWindow = AppUtil.getCreateWnd(EWnd.ELoign) as MainWindow
    if (loginWindow) {
        loginWindow.showPanel(true)
    }
}

/**
 * 启动本地环境窗口
 */
function startLocalWindow(): void {
    const mainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
    if (mainWindow) {
        mainWindow.showPanel(true)
        mainWindow.initOnLoginSuc()

        if (!mainWindow.getIsMaximize()) {
            mainWindow.maximizeToggle()
        }
    }
}

/**
 * 启动开发环境窗口
 */
function startDevWindow(): void {
    const loginWindow = AppUtil.getCreateWnd(EWnd.ELoign)
    if (loginWindow) {
        loginWindow.showPanel()
    }
}

/**
 * 启动内部环境窗口
 */
function startInnerWindow(): void {
    const mainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
    if (mainWindow) {
        mainWindow.showPanel(true)
        mainWindow.maximizeToggle()
        mainWindow.initInner()
    }
}

/**
 * 处理无效的运行环境
 */
function handleInvalidEnvironment(env: string): void {
    AppUtil.error('main', 'handleInvalidEnvironment', `运行环境[${env}]不合法，退出应用`)
    app.exit(-1)
}

/**
 * 读取程序配置文件
 */
function loadExeConfig(): void {
    try {
        const configData = fs.readFileSync(AppConfig.exeConfigPath, 'utf-8')
        const config = JSON.parse(configData)
        AppUtil.warn('main', 'loadExeConfig', '读取配置文件成功，当前运行环境是：' + config['env'])

        AppConfig.Env = config['env']
        AppConfig.GpuNormal = config['gpu']
        AppConfig.ChromiumLog = config['ChromiumLog']
        AppConfig.HardAccerlation = config['hard']
        AppConfig.SingleLock = config['singleLock']

        // 将 config.json 中的 version 设置到 AppConfig.config 的 version 属性中
        if (config['version']) {
            AppUtil.info('main', 'loadExeConfig', `设置版本号: ${config['version']}`)
            // 确保 AppConfig.config 已初始化
            if (!AppConfig.config) {
                AppConfig.config = {}
            }
            AppConfig.setUserConfig('version', config['version'], false)
        }

        AppUtil.info('main', 'loadExeConfig', `配置已设置 - AppConfig.Env: ${AppConfig.Env}`)
    } catch (err) {
        AppUtil.error(
            'main',
            'loadExeConfig',
            '读取程序配置文件失败，退出应用。可能是文件损坏，请重新运行安装程序。',
            err
        )

        // 设置默认值
        AppConfig.Env = 'PRO'
        AppConfig.GpuNormal = false
        AppConfig.ChromiumLog = false
        AppConfig.HardAccerlation = true
        AppConfig.SingleLock = true
    }
}

/**
 * 应用程序初始化主函数
 */
function initApp(): void {
    // 首先读取配置文件，确保环境配置正确
    loadExeConfig()

    setupAutoUpdater()
    handleProtocolLinks()

    // 启动时检查更新
    setTimeout(() => {
        checkForUpdatesWithAPI()
    }, 5000) // 延迟5秒检查更新，避免影响启动速度

    const assistApp = initializeApp()

    loadUserConfig()
    setupPlatformUI()

    try {
        assistApp.init()
    } catch (error) {
        AppUtil.error('main', 'initApp', '初始化App出错', error)
    }

    const commandLineArgs = parseCommandLineArgs()
    AppContainer.getApp().setLoginArgs(commandLineArgs)

    AppUtil.info('main', 'initApp', `是否为Win10系统: ${AppUtil.isWindow10OrLater()}`)

    cleanupOldUpdaters()
    startNetworkLogging()

    AppUtil.info('main', 'initApp', '应用初始化完成')

    storeUserDeviceInfo().then(() => {
        startAppropriateWindow()
    })
}

// 设置用户数据路径和日志
const strUserPath = app.getPath('userData')
AppUtil.info('main', 'setup', `用户数据路径: ${strUserPath}`)
app.setAppLogsPath(`${strUserPath}/logs`)

crashReporter.start({
    uploadToServer: false,
})

if (AppConfig.ChromiumLog) {
    app.commandLine.appendSwitch('enable-logging', '--enable-logging --v=1')
    app.commandLine.appendSwitch('log-file', `--verbose-logging --log-file=./chromium.log`)
}

AppUtil.info('main', 'initApp', `是否开启硬件加速:${AppConfig.HardAccerlation}`)
if (!AppConfig.HardAccerlation) {
    app.commandLine.appendSwitch('disable-gpu-sandbox')
    app.disableHardwareAcceleration()
}

// 单例锁
if (AppConfig.SingleLock) {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        AppUtil.error('main', '!gotTheLock', '没有获得锁')
        app.exit()

        const killCmd = 'taskkill /F /IM JLCONE.exe'
        exec(killCmd, error => {
            if (error) {
                AppUtil.error('main', '!gotTheLock', '清除之前的小助手进程失败')
            }
        })
    } else {
        app.on('second-instance', (event, commandLine) => {
            AppUtil.info('main', 'second-instance', '检测到第二个实例')

            // 尝试显示现有窗口
            let showSuccess = false
            for (const wndType of EWnd.listMainWnd) {
                if (wndType) {
                    const wnd = AppUtil.getExistWnd(wndType)
                    if (wnd) {
                        showSuccess = true
                        wnd.showPanel(true)
                        break
                    }
                }
            }

            if (!showSuccess) {
                AppUtil.info('main', 'second-instance', '没有找到现有窗口，显示登录界面')
                const loginWnd = AppUtil.getCreateWnd(EWnd.ELoign)
                loginWnd.showPanel(true)
            }
        })
    }
}

// 初始化日志
initLog(strUserPath)

// 全局异常处理
process.on('uncaughtException', error => {
    AppUtil.error('process', 'uncaughtException', '全局异常处理', error)
})

// 开发环境配置
if (process.env.NODE_ENV === 'development') {
    app.setAppUserModelId(process.execPath)

    const exePath = path.join(__dirname, '../node_modules', 'electron', 'dist', 'electron.exe')
    AppUtil.info('main', 'dev', '开发环境配置自动reload:' + exePath)

    const macAddress = AppUtil.getMacAddress()
    AppUtil.info('main', 'dev', '获取mac地址:' + macAddress)

    if (process.platform === 'win32' && reload) {
        reload(path.join(__dirname, '../'), {
            electron: exePath,
            hardResetMethod: 'exit',
        })
    }
}

// 禁用密码管理功能
app.commandLine.appendSwitch('disable-features', 'PasswordManagerEnable,AutofillServerCommunication')

// 应用生命周期事件
app.on('ready', initApp)

app.once('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        AppUtil.warn('main', 'window-all-closed', '所有窗口关闭，退出应用')
        AppContainer.getApp().destroy('所有窗口关闭，退出应用')
        app.exit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initApp()
    }
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    const assistApp = AppContainer.getApp() as AssistApp
    assistApp.getNIMMgr().logoutImServer()
    assistApp.getWndMgr().destroy()
})

/**
 * 计算主窗口的边界信息
 */
function getMainWindowBounds(): { width: number; height: number; bounds?: Rectangle } {
    let width = 800
    let height = 600
    let bounds: Rectangle | undefined

    for (const wndType of EWnd.listMainWnd) {
        if (wndType) {
            const wnd = AppUtil.getExistWnd(wndType)
            if (wnd) {
                const bw = wnd.getBrowserWindow()
                if (bw) {
                    bounds = bw.getBounds()
                    width = bounds.width
                    height = bounds.height
                    break
                }
            }
        }
    }

    return { width, height, bounds }
}

/**
 * 解析窗口特性字符串
 */
function parseWindowFeatures(features: string): { [key: string]: unknown } {
    const featureDict: { [key: string]: unknown } = {}

    if (!features || ECommon.isNone(features)) {
        return featureDict
    }

    const configs = features.split(',')
    for (const config of configs) {
        const [key, value] = config.split('=')
        if (key && value) {
            featureDict[key.trim()] = value
        }
    }

    return featureDict
}

/**
 * 计算新窗口的位置和大小
 */
function calculateWindowDimensions(detail: HandlerDetails): { width: number; height: number; x: number; y: number } {
    const { width, height, bounds } = getMainWindowBounds()

    const rate = 3 / 4
    let finalWidth = width * rate
    let finalHeight = height * rate
    let finalX = bounds ? bounds.x + bounds.width / 2 - finalWidth / 2 : 0
    let finalY = bounds ? bounds.y + bounds.height / 2 - finalHeight / 2 : 0

    // 解析窗口特性
    const features = detail['features'] as string
    const featureDict = parseWindowFeatures(features)

    if ('width' in featureDict && 'height' in featureDict) {
        try {
            finalWidth = parseInt(featureDict['width'] as string)
            finalHeight = parseInt(featureDict['height'] as string)
        } catch (error) {
            // 使用默认值
        }
    }

    if ('left' in featureDict && 'top' in featureDict) {
        try {
            finalX = parseInt(featureDict['left'] as string)
            finalY = parseInt(featureDict['top'] as string)
        } catch (error) {
            // 使用默认值
        }
    }

    return { width: finalWidth, height: finalHeight, x: finalX, y: finalY }
}

/**
 * 创建允许打开新窗口的配置
 */
function createAllowWindowConfig(
    detail: HandlerDetails,
    url: string,
    reason: string
): { action: 'allow'; overrideBrowserWindowOptions?: BrowserWindowConstructorOptions } {
    AppUtil.info('main', 'web-contents-created', `${url}使用默认浏览器:${reason}`)

    const { width, height, x, y } = calculateWindowDimensions(detail)

    AppUtil.info('main', 'useAllow', `窗口配置: ${width}x${height} at (${x},${y})`)

    return {
        action: 'allow',
        overrideBrowserWindowOptions: {
            width,
            height,
            x,
            y,
            fullscreenable: false,
            fullscreen: false,
            maximizable: false,
            minHeight: 300,
            minWidth: 500,
            resizable: true,
            autoHideMenuBar: true,
            webPreferences: { preload: AppConfig.BrowserPreLoadJSPath },
        },
    }
}

/**
 * 处理页面标题更新事件
 */
function handlePageTitleUpdated(contents: WebContents): void {
    contents.on('page-title-updated', (event, title) => {
        if (title === 'jlcone-google-login') {
            contents.close()
            ipcMain.emit(EMessage.EMainLoginSuccess, {})
        }
        if (title === 'jlcone-apple-login') {
            contents.close()
            ipcMain.emit(EMessage.EMainLoginSuccess, {})
        }
        if (title === 'jlcone-logout') {
            contents.close()
            ipcMain.emit(EMessage.ELoadingGotoLogin)
        }
    })
}

/**
 * 检查URL是否为登录相关URL
 */
function isLoginRelatedUrl(url: string, currentWindow: string): boolean {
    if (EWnd.ELoign !== currentWindow) {
        return false
    }

    return (
        url.startsWith('https://accounts.google.com') ||
        url.includes('/googleCallback') ||
        url.includes('/auth/google/googleAuth?') ||
        url.startsWith('https://appleid.apple.com') ||
        url.includes('/appleCallback') ||
        url.includes('/auth/apple/appleAuth?')
    )
}

/**
 * 检查URL是否为允许的域名
 */
function isAllowedDomain(url: string): boolean {
    const loginInfo = AppContainer.getApp().getLoginInfo()
    const allowedDomains = ['jlcpcb.com', 'jlcmc.com', 'jlc3dp.com', 'jlccnc.com', 'jlcdfm.com']
    const allAllowedUrls = allowedDomains.concat(loginInfo?.loadUrls?.domainUrls || [])
    return allAllowedUrls.some(domain => url.includes(domain))
}

/**
 * 重构 user-center URL 以包含语言路径
 * @param url 原始 URL
 * @returns 重构后的 URL
 */
function reconstructUserCenterUrl(url: string): string {
    // 检查是否是 user-center URL 且缺少语言路径
    if (url.includes('/user-center') && !url.match(/\/user-center\/[a-z]{2}\//)) {
        try {
            // 获取当前语言设置
            const currentLanguage = AppConfig.getCurrentLanguage()

            console.log('🔧 重构 user-center URL:', {
                原始URL: url,
                当前语言: currentLanguage,
            })

            // 如果不是英语，添加语言路径
            if (currentLanguage && currentLanguage !== 'en') {
                const urlParts = url.split('/user-center')
                if (urlParts.length === 2) {
                    const baseUrl = urlParts[0]
                    const remainingPath = urlParts[1]
                    const reconstructedUrl = `${baseUrl}/user-center/${currentLanguage}${remainingPath}`

                    console.log('✅ URL 重构完成:', reconstructedUrl)
                    return reconstructedUrl
                }
            }
        } catch (error) {
            console.error('❌ URL 重构失败:', error)
        }
    }

    return url
}

/**
 * 处理窗口打开请求
 */
function handleWindowOpen(details: any): any {
    const { url, disposition } = details

    if (details['postBody']?.contentType === 'application/x-www-form-urlencoded') {
        return createAllowWindowConfig(details, url, 'Post data')
    }

    AppUtil.info('app', 'web-contents-created', url, details)

    const mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
    const currentWindow = AppUtil.getCurrentShowWnd()

    // 处理特殊URL
    if (url.includes('jlcone-brower')) {
        const newUrl = url.replace('jlcone-brower=1', '')
        shell.openExternal(newUrl)
        return { action: 'deny' }
    }

    // 登录相关URL处理
    if (isLoginRelatedUrl(url, currentWindow)) {
        const reason = url.includes('google') ? '谷歌登录' : '苹果登录'
        return createAllowWindowConfig(details, url, reason)
    }

    // 退出登录处理
    if (url.includes('/logout?_t=')) {
        const mainWnd = AppUtil.getCreateWnd(EWnd.EMain)
        if (mainWnd) mainWnd.minimize()
        return createAllowWindowConfig(details, url, '退出登录')
    }

    if (!mainWindow) {
        return createAllowWindowConfig(details, url, '主窗口不存在')
    }

    // 设备预览
    if (/\(device\)/.test(url)) {
        return createAllowWindowConfig(details, url, '器件预览')
    }

    if (/login\?from=editor/.test(url)) {
        return createAllowWindowConfig(details, url, '标准版登录')
    }

    // 检查是否为允许的域名
    if (!isAllowedDomain(url)) {
        shell.openExternal(url)
        return { action: 'deny' }
    }

    if (url === 'about:blank' && disposition === 'new-window') {
        return createAllowWindowConfig(details, url, 'about:blank')
    }

    // 在主窗口中创建新标签页
    AppUtil.info('main', 'web-contents-created', `${url}创建新标签页`)

    // 重构 user-center URL 以包含语言路径
    const finalUrl = reconstructUserCenterUrl(url)
    AppUtil.info('main', 'web-contents-created', `重构后的URL: ${finalUrl}`)
    mainWindow.handleCreateNewTab(finalUrl)

    return { action: 'deny' }
}

// Web内容创建处理
app.on('web-contents-created', (event, contents) => {
    handlePageTitleUpdated(contents)
    contents.setWindowOpenHandler(handleWindowOpen)
})

// 自动更新事件处理
ipcMain.on('checkForUpdates', () => {
    const currentWindow = AppUtil.getCurrentShowWnd()
    AppUtil.info('main', 'checkForUpdates', `当前窗口: ${currentWindow}`)

    // 开发环境跳过更新检查
    if (AppConfig.isProcessDev()) {
        AppUtil.info('main', 'checkForUpdates', '开发环境跳过更新检查')
        return
    }

    // 使用新的检查更新方法
    checkForUpdatesWithAPI()
})

// 只在生产环境下注册自动更新事件监听器
if (!AppConfig.isProcessDev()) {
    autoUpdater.on('error', error => {
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg('updateError', error))
        }
    })

    autoUpdater.on('checking-for-update', () => {
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg('checking-for-update'))
        }
    })

    autoUpdater.on('update-available', info => {
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            AppConfig.setUserConfig('version', info.version, true)

            // 获取保存的更新信息
            const updateInfo = AppConfig.getUserConfig('updateInfo') as UpdateInfo

            if (updateInfo && updateInfo.forceUpdate) {
                // 强制更新：直接显示更新窗口，使用API返回的版本信息
                mainWindow.getBrowserWindow().webContents.send(
                    EMessage.ESendToRender,
                    new AppMsg('force-update-available', {
                        ...updateInfo,
                        version: info.version, // 使用electron-updater返回的版本号
                    })
                )
            } else {
                // 非强制更新：显示可选更新提示
                mainWindow.getBrowserWindow().webContents.send(
                    EMessage.ESendToRender,
                    new AppMsg('update-available', {
                        ...info,
                        forceUpdate: false,
                        version: info.version,
                        updateContent: updateInfo?.updateContent || '',
                        updateUrl: updateInfo?.updateUrl || '',
                    })
                )
            }
        }
    })

    autoUpdater.on('update-not-available', info => {
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow
                .getBrowserWindow()
                .webContents.send(EMessage.ESendToRender, new AppMsg('update-not-available', info))
        }
    })

    autoUpdater.on('download-progress', progressObj => {
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow
                .getBrowserWindow()
                .webContents.send(EMessage.ESendToRender, new AppMsg('download-progress', progressObj))
        }
    })

    autoUpdater.on('update-downloaded', info => {
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            const updateInfo = AppConfig.getUserConfig('updateInfo') as UpdateInfo

            // 显示更新提示窗口
            mainWindow.showPanel(false)

            const updateTipWin = AppUtil.getCreateWnd(EWnd.EUpdateTip)
            if (updateTipWin) {
                updateTipWin.showPanel(true)

                // 等待更新窗口准备好后发送消息
                setTimeout(() => {
                    updateTipWin.getBrowserWindow().webContents.send(
                        EMessage.ESendToRender,
                        new AppMsg('update-downloaded', {
                            ...updateInfo,
                            version: info?.version || updateInfo?.version, // 优先使用electron-updater的版本号
                        })
                    )
                    AppUtil.info(
                        'main',
                        'update-downloaded',
                        `发送下载完成消息到更新窗口: ${info?.version || updateInfo?.version}`
                    )
                }, 100) // 延迟100ms确保窗口已准备好
            }
        }
    })
}

ipcMain.on('comfirmUpdate', () => {
    const currentWindow = AppUtil.getCurrentShowWnd()
    const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
    if (mainWindow) {
        mainWindow.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg('comfirmUpdate'))
    }
})

ipcMain.on('quitAndInstall', () => {
    // 开发环境跳过安装更新
    if (AppConfig.isProcessDev()) {
        AppUtil.info('main', 'quitAndInstall', '开发环境跳过安装更新')
        return
    }

    const updateInfo = AppConfig.getUserConfig('updateInfo') as UpdateInfo

    if (updateInfo && updateInfo.forceUpdate && updateInfo.updateUrl) {
        // 强制更新：打开外部更新链接
        AppUtil.info('main', 'quitAndInstall', `强制更新，打开链接: ${updateInfo.updateUrl}`)
        shell.openExternal(updateInfo.updateUrl)
        app.quit()
    } else {
        // 非强制更新：使用electron-updater安装
        AppUtil.info('main', 'quitAndInstall', '使用electron-updater安装更新')
        autoUpdater.quitAndInstall()
        app.quit()
    }
})

// 处理延迟更新
ipcMain.on('delayUpdate', () => {
    AppUtil.info('main', 'delayUpdate', '用户选择延迟更新')

    const updateTipWin = AppUtil.getExistWnd(EWnd.EUpdateTip)
    if (updateTipWin) {
        updateTipWin.showPanel(false)
    }

    // 显示主窗口
    const currentWindow = AppUtil.getCurrentShowWnd()
    const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
    if (mainWindow) {
        mainWindow.showPanel(true)
    }
})

// 协议处理
app.on('open-url', (event, url) => {
    handleDeepLink(url)
})

/**
 * 处理深度链接
 */
function handleDeepLink(url: string): void {
    AppUtil.info('main', 'handleDeepLink', '收到协议请求: ' + url)

    try {
        const parsedUrl = new URL(url)
        const action = parsedUrl.searchParams.get('action')

        if (action === 'open-settings') {
            AppUtil.info('main', 'handleDeepLink', '打开设置窗口')
            // 可以在这里添加打开设置窗口的逻辑
        }

        ipcMain.emit(EMessage.EMainLoginSuccess, {})
    } catch (error) {
        AppUtil.error('main', 'handleDeepLink', '解析深度链接失败', error)
    }
}
