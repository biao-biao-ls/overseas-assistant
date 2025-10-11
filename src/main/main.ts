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
import { MacOSCompatibility } from '../utils/MacOSCompatibility.simple'
// import { UpdateLogger } from '../utils/UpdateLogger' // 暂时禁用以避免启动问题
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
import { UpdateService } from '../services/UpdateService'

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

// 配置自动更新器日志
autoUpdater.logger = getLogger()

// 系统信息将在 app ready 后记录

// 根据 macOS 版本配置 autoUpdater 选项
if (process.platform === 'darwin') {
    const config = MacOSCompatibility.getUpdaterConfig()
    autoUpdater.autoDownload = config.autoDownload
    autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit
    autoUpdater.allowPrerelease = config.allowPrerelease
    autoUpdater.allowDowngrade = config.allowDowngrade
    
    MacOSCompatibility.logCompatibilityInfo()
} else {
    // 非 macOS 系统使用标准配置
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
}

// 更新器配置将在 initApp 中记录

// 缓存清理将在 app ready 后执行

// macOS 配置
if (process.platform === 'darwin') {
    console.log('🍎 macOS 平台，使用 ZIP 文件进行自动更新')
}

// 开发环境特殊处理
if (AppConfig.isProcessDev()) {
    AppUtil.info('main', 'autoUpdater', '开发环境启用自动更新调试模式')
    
    // 开发环境下设置更宽松的错误处理
    autoUpdater.on('error', (error) => {
        if (error.message.includes('app-update.yml')) {
            console.log('🔧 开发环境 - 忽略 app-update.yml 缺失错误')
            AppUtil.info('main', 'autoUpdater', '开发环境忽略 app-update.yml 错误')
            return
        }
        // 其他错误正常处理
        AppUtil.error('main', 'autoUpdater-dev-error', '开发环境更新错误', error)
    })
    
    // 开发环境下不自动检查更新，等待手动触发
} else {
    // 生产环境的更新检查将在 setupAutoUpdater 之后进行
    console.log('🔍 生产环境 - 更新检查将在初始化完成后进行')
}

// 生产环境注册协议
if (!app.isDefaultProtocolClient('JLCONE')) {
    if (process.argv[1]) {
        const result = app.setAsDefaultProtocolClient('JLCONE', process.execPath, [path.resolve(process.argv[1])])
        AppUtil.info('main', 'protocol', `协议注册结果: ${result ? '成功' : '失败'}`)
    }
}

/**
 * 测试更新服务器连接
 */
function testUpdateServerConnection(feedURL: string): void {
    const https = require('https')
    const { URL } = require('url')

    try {
        const testUrl = `${feedURL}/latest.yml`
        const url = new URL(testUrl)

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'GET',
            headers: {
                'User-Agent': 'JLCONE-Desktop/1.0.13'
            }
        }

        const req = https.request(options, (res) => {
            console.log(`📊 服务器响应状态: ${res.statusCode}`)

            let data = ''
            res.on('data', (chunk) => {
                data += chunk
            })
            res.on('end', () => {
                console.log('📄 服务器返回的 latest.yml 内容:')
                console.log(data)

                // 解析版本号
                const versionMatch = data.match(/version:\s*(.+)/)
                if (versionMatch) {
                    const serverVersion = versionMatch[1].trim()
                    console.log(`🏷️ 服务器版本: ${serverVersion}`)
                    console.log(`🏷️ 当前版本: 1.0.13`)
                    console.log(`🔍 版本比较: ${serverVersion} vs 1.0.13`)
                }
            })
        })

        req.on('error', (error) => {
            console.error('❌ 测试连接失败:', error.message)
        })

        req.setTimeout(5000, () => {
            console.log('⏰ 连接超时')
            req.destroy()
        })

        req.end()
    } catch (error) {
        console.error('❌ URL 解析失败:', error)
    }
}

/**
 * 设置自动更新器的Feed URL
 * 根据平台（macOS/Windows）和架构（ARM/Intel）设置不同的更新源
 */
function setupAutoUpdater(): void {
    const updateService = UpdateService.getInstance()
    const feedURL = updateService.getFeedURL()

    AppUtil.info('main', 'setupAutoUpdater', `设置更新源: ${feedURL}`)

    console.log('🔧 更新配置详情:', {
        feedURL,
        platform: process.platform,
        arch: process.arch,
        currentVersion: updateService.getCurrentVersion?.() || 'unknown',
        expectedLatestYml: `${feedURL}/latest.yml`
    })

    // 测试 feedURL 的连通性
    if (AppConfig.isProcessDev()) {
        console.log('🌐 开发环境 - 测试更新服务器连通性...')
        testUpdateServerConnection(feedURL)
    }

    // 新版本 electron-updater 使用 publish 配置，但我们需要明确指定
    // 因为 electron-updater 可能选择了错误的配置
    
    // 根据平台和架构设置正确的更新服务器
    const publishConfig = {
        provider: 'generic' as const,
        url: feedURL,
        useMultipleRangeRequest: false
    }
    
    console.log('📋 设置明确的 publish 配置:', publishConfig)
    
    // 使用 setFeedURL 确保使用正确的服务器
    autoUpdater.setFeedURL(publishConfig)
    
    // 在生产环境中，设置完更新源后立即检查更新
    if (!AppConfig.isProcessDev()) {
        console.log('🔍 生产环境 - 立即检查更新')
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify()
        }, 1000) // 延迟1秒确保配置生效
    }
}

/**
 * 检查更新（简化版本，直接使用 electron-updater）
 */
function checkForUpdates(): void {
    if (AppConfig.isProcessDev()) {
        AppUtil.info('main', 'checkForUpdates', '开发环境启用更新检查调试模式')
        console.log('🔍 开发环境更新检查 - 当前配置:', {
            currentVersion: '1.0.13',
            targetVersion: '1.0.14',
            platform: process.platform,
            arch: process.arch,
            isDev: true
        })
        
        // 开发环境下检查必要文件
        const fs = require('fs')
        const path = require('path')
        const appUpdateYmlPath = path.join(process.resourcesPath || __dirname, 'app-update.yml')
        
        if (!fs.existsSync(appUpdateYmlPath)) {
            console.log('⚠️ 开发环境 - app-update.yml 不存在，这是正常的')
            console.log('📋 如果需要完整测试，请使用打包后的应用')
        }
    }

    try {
        console.log('🔍 开始检查更新...')
        AppUtil.info('main', 'checkForUpdates', '使用 electron-updater 检查更新')

        // 直接使用 electron-updater 检查更新
        autoUpdater.checkForUpdates()
    } catch (error) {
        AppUtil.error('main', 'checkForUpdates', '检查更新失败', error)
        console.error('❌ 更新检查失败:', error)
        
        if (AppConfig.isProcessDev() && error.message.includes('app-update.yml')) {
            console.log('💡 开发环境提示: 这个错误在打包后的应用中不会出现')
        }
    }
}

/**
 * 显示更新窗口
 */
function showUpdateWindow(updateInfo: any): void {
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
                // 发送更新消息到更新窗口
                updateTipWin.getBrowserWindow().webContents.send(
                    EMessage.ESendToRender,
                    new AppMsg('update-downloaded', updateInfo)
                )
                AppUtil.info('main', 'showUpdateWindow', `发送更新消息到更新窗口: ${updateInfo.version}`)
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
        exec('taskkill /F /IM UpdateClient.exe', () => { })
        exec('taskkill /F /IM UpdateClientDaemon.exe', () => { })
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

    // 启动时检查更新（备用检查，如果前面的检查没有触发）
    setTimeout(() => {
        console.log('🔍 备用更新检查')
        checkForUpdates()
    }, 10000) // 延迟10秒检查更新，作为备用

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

    // 记录系统信息和兼容性配置
    try {
        console.log('📊 系统信息:', {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            electronVersion: process.versions.electron
        })
        console.log('⚙️ 更新器配置:', {
            autoDownload: autoUpdater.autoDownload,
            autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit
        })
    } catch (error) {
        console.warn('⚠️ 记录系统信息失败:', error.message)
    }

    // 清除缓存（开发环境或旧版 macOS）
    try {
        const shouldClearCache = AppConfig.isProcessDev() || (process.platform === 'darwin' && MacOSCompatibility.isOldMacOS())

        if (shouldClearCache) {
            console.log('🧹 清除 electron-updater 缓存')
            // 简化的缓存清理，避免复杂的文件操作
            const path = require('path')
            const fs = require('fs')
            
            const cacheDir = path.join(app.getPath('userData'), 'JLCONE-updater')
            if (fs.existsSync(cacheDir)) {
                try {
                    fs.rmSync(cacheDir, { recursive: true, force: true })
                    console.log('✅ 已清除更新缓存目录')
                } catch (error) {
                    console.warn('⚠️ 清除缓存失败:', error.message)
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ 清除缓存失败:', error.message)
    }

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
            ipcMain.emit(EMessage.EMainLoginSuccess, null, { loginMethod: 'google' })
        }
        if (title === 'jlcone-apple-login') {
            contents.close()
            ipcMain.emit(EMessage.EMainLoginSuccess, null, { loginMethod: 'apple' })
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

    AppUtil.info('app', 'handleWindowOpen', `处理 window.open 请求: ${url}`)
    AppUtil.info('app', 'web-contents-created', url, details)

    const mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
    const currentWindow = AppUtil.getCurrentShowWnd()

    // 处理特殊URL
    if (url.includes('jlcone-brower')) {
        const newUrl = url.replace('jlcone-brower=1', '')
        shell.openExternal(newUrl)
        return { action: 'deny' }
    }

    // 处理推送消息URL
    if (url.includes('jlcone-push-notification=1')) {
        AppUtil.info('main', 'handleWindowOpen', `🎯 检测到推送消息URL标识: ${url}`)
        const cleanUrl = url.replace(/[?&]jlcone-push-notification=1/, '')
        AppUtil.info('main', 'handleWindowOpen', `🧹 清理后的推送消息URL: ${cleanUrl}`)

        if (!mainWindow) {
            AppUtil.error('main', 'handleWindowOpen', '❌ 主窗口不存在，推送消息URL使用外部浏览器打开')
            shell.openExternal(cleanUrl)
            return { action: 'deny' }
        }

        // 在主窗口中创建新标签页
        AppUtil.info('main', 'handleWindowOpen', `✅ 推送消息在主窗口中创建新标签页: ${cleanUrl}`)
        const result = mainWindow.handleCreateNewTab(cleanUrl)
        AppUtil.info('main', 'handleWindowOpen', `📋 handleCreateNewTab 返回结果: ${result}`)
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

    // 使用简化的检查更新方法
    checkForUpdates()
})

// 测试 electron-updater 直接检查
ipcMain.on('test-electron-updater', () => {
    AppUtil.info('main', 'test-electron-updater', '直接测试 electron-updater')
    console.log('⚡ 直接测试 electron-updater.checkForUpdates()')

    try {
        autoUpdater.checkForUpdates()
    } catch (error) {
        AppUtil.error('main', 'test-electron-updater', '测试失败', error)
        console.error('❌ electron-updater 测试失败:', error)
    }
})



// 注册自动更新事件监听器（开发环境也启用以便调试）
if (true) {
    autoUpdater.on('error', error => {
        console.error('🔍 更新错误详情:', error)
        AppUtil.error('main', 'autoUpdater-error', '自动更新错误', error)
        console.error('❌ 自动更新错误:', error)

        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg('updateError', error))
        }
    })

    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 更新事件: checking-for-update')
        AppUtil.info('main', 'autoUpdater', '正在检查更新...')
        console.log('🔍 正在检查更新...')

        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg('checking-for-update'))
        }
    })

    autoUpdater.on('update-available', info => {
        console.log('🔍 更新事件: update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            files: info.files?.map(f => ({ url: f.url, size: f.size }))
        })
        AppUtil.info('main', 'autoUpdater', `发现可用更新: ${info.version}`)
        console.log('✅ 发现可用更新:', {
            version: info.version,
            releaseDate: info.releaseDate,
            files: info.files?.map(f => ({ url: f.url, size: f.size }))
        })

        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            // 保存版本信息
            AppConfig.setUserConfig('version', info.version, true)

            // 检查是否是旧版 macOS 且禁用了自动下载
            if (process.platform === 'darwin' && !autoUpdater.autoDownload) {
                console.log('🍎 旧版 macOS 手动触发下载')
                // 手动触发下载
                autoUpdater.downloadUpdate().catch(error => {
                    console.error('❌ 手动下载失败:', error)
                    AppUtil.error('main', 'autoUpdater', '手动下载更新失败', error)
                })
            }

            // 发送更新可用消息到渲染进程
            console.log('📦 发现可用更新，开始下载')
            mainWindow.getBrowserWindow().webContents.send(
                EMessage.ESendToRender,
                new AppMsg('update-available', {
                    version: info.version,
                    releaseDate: info.releaseDate,
                    files: info.files
                })
            )
        }
    })

    autoUpdater.on('update-not-available', info => {
        AppUtil.info('main', 'autoUpdater', '当前已是最新版本')
        console.log('ℹ️ 当前已是最新版本:', {
            version: info.version,
            currentVersion: '1.0.13'
        })

        // 详细调试信息
        console.log('🔍 详细调试信息:')
        console.log('  - electron-updater 返回的版本:', info.version)
        console.log('  - 当前应用版本:', '1.0.13')
        console.log('  - feedURL:', autoUpdater.getFeedURL())
        console.log('  - 完整 info 对象:', JSON.stringify(info, null, 2))
        
        // 检查实际访问的 URL
        console.log('🌐 检查实际访问的服务器:')
        if (info.files && info.files.length > 0) {
            const fileUrl = info.files[0].url
            console.log('  - 文件 URL:', fileUrl)
            
            // 如果是 DMG 文件，说明访问的是错误的服务器
            if (fileUrl.endsWith('.dmg')) {
                console.log('  ❌ 错误: 访问的服务器返回 DMG 文件，应该返回 ZIP 文件')
                console.log('  💡 这说明 electron-updater 使用了错误的服务器配置')
                console.log('  🔧 可能的原因: 缓存问题或配置未生效')
            }
        }

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
        AppUtil.info('main', 'autoUpdater', `更新下载完成: ${info.version}`)
        console.log('📦 更新下载完成:', {
            version: info.version,
            releaseDate: info.releaseDate
        })

        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
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
                            version: info.version,
                            releaseDate: info.releaseDate
                        })
                    )
                    AppUtil.info('main', 'update-downloaded', `发送下载完成消息到更新窗口: ${info.version}`)
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
    console.log('📥 收到 quitAndInstall 请求')
    AppUtil.info('main', 'quitAndInstall', '收到更新安装请求')
    
    if (AppConfig.isProcessDev()) {
        AppUtil.info('main', 'quitAndInstall', '开发环境模拟安装更新')
        console.log('🔧 开发环境 - 模拟更新安装过程')
        console.log('💡 在生产环境中，这里会执行实际的更新安装')
        
        // 开发环境下给用户一些反馈
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(
                EMessage.ESendToRender,
                new AppMsg('dev-update-simulation', { message: '开发环境模拟更新完成' })
            )
        }
        return
    }

    try {
        // 检查是否有可用的更新
        console.log('🔍 检查更新状态...')
        
        // 使用 electron-updater 安装更新
        AppUtil.info('main', 'quitAndInstall', '使用 electron-updater 安装更新')
        console.log('🚀 开始安装更新并重启应用')
        
        // 给用户一些反馈
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(
                EMessage.ESendToRender,
                new AppMsg('update-installing', { message: '正在安装更新，应用即将重启...' })
            )
        }
        
        // 根据平台和版本选择安装策略
        if (process.platform === 'darwin') {
            const timeout = MacOSCompatibility.getInstallTimeout()
            
            if (MacOSCompatibility.isVeryOldMacOS()) {
                // 非常旧的 macOS 使用最保守的安装方式
                console.log('🍎 非常旧的 macOS 使用最保守安装模式')
                setTimeout(() => {
                    try {
                        // 强制退出并安装，不等待窗口关闭
                        autoUpdater.quitAndInstall(false, true)
                    } catch (error) {
                        console.error('❌ 非常旧的 macOS 安装失败，直接退出应用:', error)
                        require('electron').app.quit()
                    }
                }, timeout)
            } else if (MacOSCompatibility.isOldMacOS()) {
                // 旧版 macOS 使用兼容安装方式
                console.log('🍎 旧版 macOS 使用兼容安装模式')
                setTimeout(() => {
                    try {
                        autoUpdater.quitAndInstall(false, true)
                    } catch (error) {
                        console.error('❌ 旧版 macOS 安装失败，尝试备用方案:', error)
                        require('electron').app.quit()
                    }
                }, timeout)
            } else {
                // 新版 macOS 使用标准安装方式
                setTimeout(() => {
                    autoUpdater.quitAndInstall()
                }, 1000)
            }
        } else {
            // Windows/Linux 使用标准方式
            setTimeout(() => {
                autoUpdater.quitAndInstall()
            }, 1000)
        }
        
    } catch (error) {
        console.error('❌ 更新安装失败:', error)
        AppUtil.error('main', 'quitAndInstall', '更新安装失败', error)
        
        // 通知用户更新失败
        const currentWindow = AppUtil.getCurrentShowWnd()
        const mainWindow = AppUtil.getExistWnd(currentWindow) as MainWindow
        if (mainWindow) {
            mainWindow.getBrowserWindow().webContents.send(
                EMessage.ESendToRender,
                new AppMsg('update-install-error', { 
                    message: '更新安装失败，请稍后重试',
                    error: error.message 
                })
            )
        }
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

        ipcMain.emit(EMessage.EMainLoginSuccess, null, { loginMethod: 'deeplink' })
    } catch (error) {
        AppUtil.error('main', 'handleDeepLink', '解析深度链接失败', error)
    }
}
