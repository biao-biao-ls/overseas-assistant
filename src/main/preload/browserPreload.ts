import { ELogLevel } from '../../enum/ECommon'
import { EMessage } from '../../enum/EMessage'
import { ASSIT_VERSION } from '../config'

const { contextBridge, ipcRenderer, webFrame } = require('electron')

// const option = {
//     name: 'deviceInfo',
//     fileExtension: 'json',
//     cwd: app.getPath('userData'),
//     encryptionKey: 'aes-256-cbc', //对配置文件进行加密
//     clearInvalidConfig: true, // 发生 SyntaxError  则清空配置,
// }
// const store = new Store(option)

const funLog = window.console.log
const funInfo = window.console.info
const funWarn = window.console.warn
const funError = window.console.error

funWarn('加载BrowserPreload开始 -----------------------------')

// 初始化推送调试工具 - 使用直接的IPC通信
function initPushDebugTools() {
    // 创建推送调试工具对象
    const pushDebug = {
        // 显示推送状态
        showStatus: async () => {
            try {
                console.log('📊 [推送调试] 正在获取推送状态...')
                
                const response = await ipcRenderer.invoke('get-push-service-status')
                
                if (response?.success) {
                    const status = response.data
                    console.group('📊 [推送状态] 当前推送服务状态')
                    console.log('🔗 连接状态:', status.connectionStatus)
                    console.log('🔛 服务启用:', status.isEnabled ? '✅ 是' : '❌ 否')
                    console.log('⏰ 最后连接时间:', status.lastConnectTime ? new Date(status.lastConnectTime).toISOString() : '无')
                    console.log('📨 最后消息时间:', status.lastMessageTime ? new Date(status.lastMessageTime).toISOString() : '无')
                    console.log('🔄 重连次数:', status.reconnectAttempts)
                    console.log('📊 消息计数:', status.messageCount)
                    console.log('❌ 错误计数:', status.errorCount)
                    console.groupEnd()
                } else {
                    console.error('❌ 获取推送状态失败:', response?.error || '未知错误')
                }
            } catch (error) {
                console.error('❌ 获取推送状态异常:', error)
            }
        },
        
        // 显示详细统计
        showDetailedStats: async () => {
            try {
                console.log('📈 [推送调试] 正在获取详细统计...')
                
                const response = await ipcRenderer.invoke('get-push-service-stats')
                
                if (response?.success) {
                    console.group('📈 [推送统计] 详细统计信息')
                    console.log(response.data)
                    console.groupEnd()
                } else {
                    console.error('❌ 获取推送统计失败:', response?.error || '未知错误')
                }
            } catch (error) {
                console.error('❌ 获取推送统计异常:', error)
            }
        },
        
        // 重启推送服务
        restartService: async () => {
            try {
                console.log('🔄 [推送调试] 正在重启推送服务...')
                
                const response = await ipcRenderer.invoke('restart-push-service')
                
                if (response?.success) {
                    console.log('✅ [推送调试] 推送服务重启成功')
                    // 1秒后自动显示状态
                    setTimeout(() => {
                        pushDebug.showStatus()
                    }, 1000)
                } else {
                    console.error('❌ [推送调试] 推送服务重启失败:', response?.error || '未知错误')
                }
            } catch (error) {
                console.error('❌ 推送服务重启异常:', error)
            }
        },
        
        // 清除通知
        clearNotifications: async () => {
            try {
                console.log('🧹 [推送调试] 正在清除所有通知...')
                
                const response = await ipcRenderer.invoke('clear-push-notifications')
                
                if (response?.success) {
                    console.log('✅ [推送调试] 所有通知已清除')
                } else {
                    console.error('❌ [推送调试] 清除通知失败:', response?.error || '未知错误')
                }
            } catch (error) {
                console.error('❌ 清除通知异常:', error)
            }
        },
        
        // 调试IPC通信
        debugIPC: async () => {
            try {
                console.log('🔍 [IPC调试] 正在检查IPC处理器状态...')
                
                const response = await ipcRenderer.invoke('debug-push-ipc')
                
                if (response?.success) {
                    console.group('🔧 [IPC调试] IPC处理器状态')
                    console.log('📋 已注册的处理器:', response.data.registeredHandlers)
                    console.log('📊 推送管理器状态:', response.data.pushManagerStatus)
                    console.log('⏰ 检查时间:', new Date(response.data.timestamp).toISOString())
                    console.groupEnd()
                } else {
                    console.error('❌ IPC调试失败:', response?.error || '未知错误')
                }
            } catch (error) {
                console.error('❌ IPC调试异常:', error)
                console.log('💡 [提示] 这可能表示IPC处理器未正确注册')
            }
        },
        
        // 显示帮助
        showHelp: () => {
            console.group('📖 [推送调试] 可用的调试命令')
            console.log('📊 pushDebug.showStatus() - 显示推送服务状态')
            console.log('📊 showPushStatus() - 显示推送服务状态 (快捷方式)')
            console.log('📈 pushDebug.showDetailedStats() - 显示详细统计信息')
            console.log('📈 showPushStats() - 显示详细统计信息 (快捷方式)')
            console.log('🔄 pushDebug.restartService() - 重启推送服务')
            console.log('🧹 pushDebug.clearNotifications() - 清除所有通知')
            console.log('🔍 pushDebug.debugIPC() - 调试IPC通信状态')
            console.log('📖 pushDebug.showHelp() - 显示此帮助信息')
            console.log('')
            console.log('💡 提示: 打开开发者工具Console面板，输入上述命令即可使用')
            console.log('⌨️ 快捷键: Ctrl+Shift+P (状态), Ctrl+Shift+D (统计), Ctrl+Shift+H (帮助)')
            console.groupEnd()
        }
    }
    
    // 挂载到全局对象
    ;(window as any).pushDebug = pushDebug
    ;(window as any).showPushStatus = pushDebug.showStatus
    ;(window as any).showPushStats = pushDebug.showDetailedStats
    
    // 显示欢迎信息
    setTimeout(() => {
        console.log('%c🎉 推送调试工具已加载!', 'color: #4CAF50; font-size: 16px; font-weight: bold;')
        console.log('%c💡 快速命令:', 'color: #2196F3; font-weight: bold;')
        console.log('  • showPushStatus() - 查看推送状态')
        console.log('  • showPushStats() - 查看详细统计')
        console.log('  • pushDebug.restartService() - 重启服务')
        console.log('  • pushDebug.showHelp() - 查看所有命令')
        console.log('%c⌨️ 快捷键:', 'color: #9C27B0; font-weight: bold;')
        console.log('  • Ctrl+Shift+P - 显示推送状态')
        console.log('  • Ctrl+Shift+D - 显示详细统计')
        console.log('  • Ctrl+Shift+H - 显示帮助')
        console.log('%c🔧 提示: 如果命令无响应，请检查推送服务是否已启动', 'color: #FF9800;')
    }, 2000)
}

// 添加键盘快捷键支持
function addPushDebugShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Ctrl+Shift+P: 显示推送状态
        if (event.ctrlKey && event.shiftKey && event.key === 'P') {
            event.preventDefault()
            ;(window as any).pushDebug?.showStatus()
        }
        
        // Ctrl+Shift+D: 显示详细统计
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault()
            ;(window as any).pushDebug?.showDetailedStats()
        }
        
        // Ctrl+Shift+R: 重启推送服务
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault()
            ;(window as any).pushDebug?.restartService()
        }
        
        // Ctrl+Shift+H: 显示帮助
        if (event.ctrlKey && event.shiftKey && event.key === 'H') {
            event.preventDefault()
            ;(window as any).pushDebug?.showHelp()
        }
    })
}

// DOM加载完成后初始化推送调试工具
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initPushDebugTools()
        addPushDebugShortcuts()
    })
} else {
    initPushDebugTools()
    addPushDebugShortcuts()
}



function handleLog(strHref: string, message?: any, strLogType?: string, ...optionalParams: any[]) {
    try {
        ipcRenderer.send(EMessage.EMainRecordLog, strLogType, strHref, message, JSON.stringify(optionalParams))
    } catch (error) {
        switch (strLogType) {
            case ELogLevel.log:
                funLog('no Send log', message, optionalParams)
                break
            case ELogLevel.info:
                funInfo('no Send log', message, optionalParams)
                break
            case ELogLevel.warn:
                funWarn('no Send log', message, optionalParams)
                break
            case ELogLevel.error:
                funError('no Send log', message, optionalParams)
                break

            default:
                break
        }
    }
}

let MaxLength = 1024
// window.console.log = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funLog(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.log, strParam)
//     } catch (error) {}
// }
// window.console.info = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funInfo(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.info, strParam)
//     } catch (error) {}
// }
// window.console.warn = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funWarn(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.warn, strParam)
//     } catch (error) {}
// }

// window.console.error = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funError(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.error, strParam)
//     } catch (error) {}
// }

function loadOverByLogin() {
    // emitLoginWindowShow()
    return true
}

/** 查询小助手客户端版本号 */
function getPcAssitClientVersion() {
    return ASSIT_VERSION
}
function getPcAssistVersionNum(strVersion: string | undefined): number {
    if (!strVersion) {
        return 0
    }
    let listSplit = strVersion.split('.')
    try {
        let nStart = 0
        for (let nIndex = 0; nIndex < listSplit.length; nIndex++) {
            let nVersion = parseInt(listSplit[nIndex])
            nStart += nVersion * Math.pow(10, listSplit.length - nIndex)
        }
        return nStart
    } catch (error) {
        return 0
    }
}

/** 查询小助手客户端版本号 */
function getClientVersion() {
    return ASSIT_VERSION
}

// appClient.getDeviceInfo()
/** 获得设备 MAC 地址 */
function getDeviceInfo(security_code = '') {
    return ipcRenderer.send('viewFrame/getDeviceInfo', security_code)
}

// appClient.getPcAssitDeviceInfo()
type InfoType = 'all' | 'HardDisk' | 'OsInfo' | 'network_adapter' | 'processor' | 'system'
/** 获得设备信息接口 3 */
function getPcAssitDeviceInfo(info_type: InfoType, security_code: string = '', signal: string) {
    return ipcRenderer.send('viewFrame/getPcAssitDeviceInfo', info_type, security_code, signal)
}

function getDeviceInfoEx(security_code: string) {
    return ipcRenderer.send('viewFrame/getDeviceInfoEx', security_code)
}

function deCryptoAndUnZipTest(base64Url) {
    return ipcRenderer.send('viewFrame/deCryptoAndUnZipTest', base64Url)
}

/** 发送客户相关参数 */
function sendUserInfo(params: string) {
    console.log('$$ 登录成功？', params)
    const data = JSON.parse(params)
    emitLoginSuccess(data)
}

/** 查询小助手客户端组件版本号 */
function getComponentVersion() {
    return {
        gerber: '1.4.2',
        smtEditor: '1.1.3',
    }
}

/** 刷新用户信息界面 */
function updateCustomerInformationTab() {
    return true
}

/** 通知客户端在新标签页打开指定 URL */
function openNewTab(url: string, mode: 0 | 1) {
    console.log('$$ 在新标签页中打开链接 url: \n', url)
    debugger
    return true
}

/** 通知客户端在后台标签页打开登录成功后需打开的页面 */
function openLoginedBackgroundTab() {
    ipcRenderer.invoke('/msg/request/openTag')
    return true
}

/** 设置客户端顶部用户信息 web 空间大小、位置信息 */
function setCustomerInformationTabPos(width, height, padding_left, pt, pr, pb) {
    return true
}

/** 打开更新客户端？？？ */
function openPcAssitUpdateClient() {
    debugger
    return true
}

/** 打开 pcb 下单 Gerber 文件上传历史页面 */
function showGerberFileList(args) {
    ipcRenderer.send('/browserView/create/gerberList')
}

/** 文件上传历史页面点击“下单” */
function orderPcb(args: string) {
    ipcRenderer.send('/browserView/orderPcb', args)
    // console.log('[BrowserPreload.ts] orderPcb args \n', args)
}

/** 触发登录成功事件 */
function emitLoginSuccess(successInfo) {
    ipcRenderer.send('/login/success', successInfo)
}

function sendMsgToMain(strMessage, ...args) {
    ipcRenderer.send(strMessage, args)
}
function closeBvView() {
    ipcRenderer.send(EMessage.ERenderToMainCloseBvView, location.href)
}

// 所有Node.js API都可以在预加载过程中使用。
// 它拥有与Chrome扩展一样的沙盒。
window.addEventListener('DOMContentLoaded', () => {
    // document.body.style.backgroundColor = '#ffffff'
})

ipcRenderer.on('/browserView/executeJS', (event, code) => {
    // console.log('[BrowserPreload.ts] ipc on /browserView/executeJS', code)
    webFrame.executeJavaScript(code)
})

/**
 * /////////////////////////////////////////////////////////////////////////////////
 * //
 * //                           预加载暴露变量到 window
 * //
 * /////////////////////////////////////////////////////////////////////////////////
 */

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
            ipcRenderer.on(channel, listener)
        },
        removeAllListeners: (channel: string) => {
            ipcRenderer.removeAllListeners(channel)
        },
        invoke: (channel: string, ...args: any[]) => {
            return ipcRenderer.invoke(channel, ...args)
        },
        send: (channel: string, ...args: any[]) => {
            ipcRenderer.send(channel, ...args)
        }
    },
})

contextBridge.exposeInMainWorld('appClient', {
    getDeviceInfo, // 获得设备 MAC 地址
    getClientVersion,
    getPcAssitClientVersion,
    getPcAssistVersionNum,
    getPcAssitDeviceInfo,
    sendUserInfo,
    getDeviceInfoEx,
    getComponentVersion,
    updateCustomerInformationTab,
    openNewTab,
    openLoginedBackgroundTab,
    setCustomerInformationTabPos,
    openPcAssitUpdateClient,
    showGerberFileList,
    orderPcb,
    sendMsgToMain,
    closeBvView,
})

contextBridge.exposeInMainWorld('JLC_PC_Assit_Client_Information', {
    Client_Version: ASSIT_VERSION,
    Gerber_Version: '1.4.2',
    SmtEditor_Version: '1.1.3',
})

/**
 * /////////////////////////////////////////////////////////////////////////////////
 * //
 * //                           预加载监听 window 事件
 * //
 * /////////////////////////////////////////////////////////////////////////////////
 */

contextBridge.exposeInMainWorld('__assitEventHandle__', {
    handleContextMenu,
    handleKeydown,
    handleLog,
    handleZoomIn,
    handleCtrlDown,
    handlePageFailed,

    electronAlert,
})

function handleZoomIn(bZoomIn: boolean) {
    ipcRenderer.send(EMessage.EMainPageZoomIn, bZoomIn)
}
function handleCtrlDown(bKeyDown: boolean) {
    ipcRenderer.send(EMessage.EMainPageCtrl, bKeyDown)
}
function handleContextMenu(topUrl, frameUrl, anchorUrl, selectionStr) {
    ipcRenderer.send('/contextMenu/show', topUrl, frameUrl, anchorUrl, selectionStr)
}
function handlePageFailed() {
    ipcRenderer.send(EMessage.EMainPageFailed)
}

function handleKeydown(keyStr: string) {
    if (['F5', 'F12'].includes(keyStr)) {
        ipcRenderer.send('/browserView/keydown', keyStr)
    }
}

function electronAlert(strMessage: string) {
    ipcRenderer.send('/browserView/alert', strMessage)
}
setInterval(() => {
    if (window.location.href.startsWith('chrome-error')) {
        console.log('$$ BrowserPreload.ts setInterval 30s', window.location.href)
        // :TODO: 处理页面加载失败
        // handlePageFailed()
    }
}, 30000)

let funClose = window.close.prototype
window.close = () => {
    closeBvView()
    funClose()
}

funWarn('加载BrowserPreload结束 -----------------------------')
