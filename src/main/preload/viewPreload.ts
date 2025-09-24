import { version } from 'os'
import { ELogLevel } from '../../enum/ECommon'
import { EMessage } from '../../enum/EMessage'
import { ASSIT_VERSION } from '../config'
import { AppConfig } from '../../config/AppConfig'
import { ICountryItem } from '../../types'

const { contextBridge, ipcRenderer, webFrame } = require('electron')

const MsgPre = 'viewFrame/'

// const option = {
//     name: 'deviceInfo',
//     fileExtension: 'json',
//     cwd: app.getPath('userData'),
//     encryptionKey: 'aes-256-cbc', //对配置文件进行加密
//     clearInvalidConfig: true, // 发生 SyntaxError  则清空配置,
// }
// const store = new Store(option)

// 保存原始console函数引用
const funLog = window.console.log
const funInfo = window.console.info
const funWarn = window.console.warn
const funError = window.console.error

funWarn('加载ViewPreload开始 -----------------------------')

// 添加全局错误处理
window.addEventListener('error', event => {
    try {
        const errorInfo = {
            message: event.error?.message || event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
        }

        // 全局错误捕获

        // 发送错误信息到主进程
        ipcRenderer.send(
            EMessage.EMainRecordLog,
            ELogLevel.error,
            window.location.href,
            '渲染进程全局错误',
            JSON.stringify(errorInfo)
        )
    } catch (logError) {
        // 记录全局错误失败
    }
})

// 添加未处理的 Promise 拒绝处理
window.addEventListener('unhandledrejection', event => {
    try {
        const errorInfo = {
            reason: event.reason,
            promise: event.promise,
            stack: event.reason?.stack,
        }

        // 未处理的Promise拒绝

        // 发送错误信息到主进程
        ipcRenderer.send(
            EMessage.EMainRecordLog,
            ELogLevel.error,
            window.location.href,
            '未处理的Promise拒绝',
            JSON.stringify(errorInfo)
        )

        // 防止默认的控制台错误输出
        event.preventDefault()
    } catch (logError) {
        // 记录Promise拒绝失败
    }
})

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
// 例如，“1.2.3”将转换为 `["1", "2", "3"]`
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
    return ipcRenderer.sendSync(MsgPre + 'getDeviceInfo', security_code)
}
function getDeviceInfoEx(security_code: string) {
    return ipcRenderer.sendSync(MsgPre + 'getDeviceInfoEx', security_code)
}
// appClient.getPcAssitDeviceInfo()
type InfoType = 'all' | 'HardDisk' | 'OsInfo' | 'network_adapter' | 'processor' | 'system'
/** 获得设备信息接口 3 */
function getPcAssitDeviceInfo(info_type: InfoType, security_code: string = '', signal: string) {
    return ipcRenderer.send(MsgPre + 'getPcAssitDeviceInfo', info_type, security_code, signal)
}

function deCryptoAndUnZipTest(base64Url) {
    return ipcRenderer.sendSync(MsgPre + 'deCryptoAndUnZipTest', base64Url)
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
    // 在新标签页中打开链接
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
    // console.log('[viewPreload.ts] orderPcb args \n', args)
}

function sendMsgToMain(strMessage, ...args) {
    ipcRenderer.send(strMessage, args)
}
function insertUnionTab(strUrl: string, strTabType: string) {
    ipcRenderer.send(EMessage.EMainInsertUnionTab, strUrl, strTabType)
}
function insertIndexKey(strKey: string) {
    ipcRenderer.send(EMessage.EMainInsertIndexKey, strKey)
}
/** 触发登录成功事件 */
function emitLoginSuccess(successInfo) {
    ipcRenderer.send('/login/success', successInfo)
}

// 防循环跳转机制 - 升级版导航锁
let lastGotoTime = 0
let gotoCount = 0
let lastGotoType = ''
let navigationLocked = false
let lockTimeout = null
const GOTO_COOLDOWN = 3000 // 3秒冷却时间
const MAX_GOTO_COUNT = 3 // 最大连续跳转次数
const NAVIGATION_LOCK_DURATION = 5000 // 导航锁持续时间5秒

// 循环检测历史记录
let navigationHistory = []
const MAX_HISTORY_SIZE = 10
const LOOP_DETECTION_WINDOW = 10000 // 10秒内的操作

// 检测循环跳转模式
function detectLoopPattern(): boolean {
    const now = Date.now()

    // 清理过期的历史记录
    navigationHistory = navigationHistory.filter(record => now - record.timestamp < LOOP_DETECTION_WINDOW)

    if (navigationHistory.length < 4) {
        return false
    }

    // 检查是否存在 A->B->A 的循环模式
    for (let i = 0; i < navigationHistory.length - 2; i++) {
        const current = navigationHistory[i]
        const next = navigationHistory[i + 1]
        const afterNext = navigationHistory[i + 2]

        // 检测 gotoLogin -> gotoMain -> gotoLogin 模式
        if (current.type === 'gotoLogin' && next.type === 'gotoMain' && afterNext.type === 'gotoLogin') {
            // 检测到gotoLogin->gotoMain->gotoLogin循环模式
            return true
        }

        // 检测 gotoMain -> gotoLogin -> gotoMain 模式
        if (current.type === 'gotoMain' && next.type === 'gotoLogin' && afterNext.type === 'gotoMain') {
            // 检测到gotoMain->gotoLogin->gotoMain循环模式
            return true
        }
    }

    // 检查短时间内的重复操作
    const recentSameType = navigationHistory.filter(
        record => record.type === navigationHistory[navigationHistory.length - 1]?.type && now - record.timestamp < 3000
    )

    if (recentSameType.length >= 3) {
        // 检测到短时间内重复操作
        return true
    }

    return false
}

// 导航锁管理函数
function tryLockNavigation(gotoType: string): boolean {
    const now = Date.now()

    // 记录导航历史
    navigationHistory.push({
        type: gotoType,
        timestamp: now,
    })

    // 保持历史记录大小
    if (navigationHistory.length > MAX_HISTORY_SIZE) {
        navigationHistory = navigationHistory.slice(-MAX_HISTORY_SIZE)
    }

    // 检测循环模式
    const hasLoop = detectLoopPattern()

    // 如果导航已锁定，拒绝操作
    if (navigationLocked) {
        // 导航已锁定，拒绝操作
        return false
    }

    // 如果检测到循环，设置强制清除标志并锁定导航
    if (hasLoop) {
        // 检测到循环跳转，将强制清除状态

        // 设置循环检测标志，下次跳转时强制清除状态
        try {
            localStorage.setItem('jlcone-loop-detected', Date.now().toString())
        } catch (error) {
            // 设置循环检测标志失败
        }

        // 锁定导航更长时间
        navigationLocked = true
        if (lockTimeout) {
            clearTimeout(lockTimeout)
        }

        lockTimeout = setTimeout(() => {
            navigationLocked = false
            lockTimeout = null
            // 循环保护锁自动解除
        }, NAVIGATION_LOCK_DURATION * 2) // 双倍锁定时间

        return false
    }

    // 检查是否是快速重复的相同操作
    if (lastGotoType === gotoType && now - lastGotoTime < 2000) {
        // 检测到快速重复操作，拒绝执行
        return false
    }

    // 获取导航锁
    navigationLocked = true
    lastGotoTime = now
    lastGotoType = gotoType

    // 设置自动解锁
    if (lockTimeout) {
        clearTimeout(lockTimeout)
    }

    lockTimeout = setTimeout(() => {
        navigationLocked = false
        lockTimeout = null
        // 导航锁自动解除
    }, NAVIGATION_LOCK_DURATION)

    // 成功获取导航锁
    return true
}

function checkGotoLoop(gotoType: string): boolean {
    // 使用新的导航锁机制
    return !tryLockNavigation(gotoType)
}

// 所有Node.js API都可以在预加载过程中使用。
// 它拥有与Chrome扩展一样的沙盒。
window.addEventListener('DOMContentLoaded', () => {
    // document.body.style.backgroundColor = '#ffffff'
})

ipcRenderer.on('/browserView/executeJS', (event, code) => {
    // console.log('[viewPreload.ts] ipc on /browserView/executeJS', code)
    webFrame.executeJavaScript(code)
})

/**
 * /////////////////////////////////////////////////////////////////////////////////
 * //
 * //                           预加载暴露变量到 window
 * //
 * /////////////////////////////////////////////////////////////////////////////////
 */

contextBridge.exposeInMainWorld('appClient', {
    getClientVersion, // 查询小助手客户端版本号
    getDeviceInfo, // 获得设备 MAC 地址
    insertUnionTab,
    insertIndexKey,
    closeBvView,
    // 谷歌登录
    googleLogin(url) {
        ipcRenderer.send(EMessage.EGoogleLogin, url)
    },
    sendIpcMessage(message = '', data = {}) {
        ipcRenderer.send(message, data)
    },
    // 发送客户相关参数
    gotoMain: (params: string = '{}') => {
        // 防循环检查
        if (checkGotoLoop('gotoMain')) {
            // 检测到循环跳转，跳过本次操作
            return
        }

        try {
            const data = JSON.parse(params)

            // 解析登录信息，提取更多字段
            const loginInfo = {
                ...data,
                // 尝试从不同字段提取用户信息
                userId: data.userId || data.id || data.user_id,
                username: data.username || data.name || data.user_name || data.nickname,
                email: data.email || data.user_email,
                token: data.token || data.accessToken || data.access_token,
                refreshToken: data.refreshToken || data.refresh_token,
                loginMethod: data.loginMethod || data.login_method || 'password',
                // 确保 customerCode 被正确提取和传递
                customerCode: data.customerCode || data.customer_code || data.customerId,
            }

            // 准备跳转到主窗口

            emitLoginSuccess(loginInfo)
        } catch (error) {
            // 解析参数失败
        }
    },
    gotoLogin: (loginUrl: string) => {
        // 防循环检查
        if (checkGotoLoop('gotoLogin')) {
            console.warn('gotoLogin: 检测到循环跳转，跳过本次操作')
            return
        }

        console.log('$ gotoLogin: 准备跳转到登录窗口', loginUrl)

        // 检查是否检测到循环跳转
        let shouldClearState = true // 默认清除状态，确保同步
        let reason = 'manual'

        try {
            const loopDetected = localStorage.getItem('jlcone-loop-detected')
            if (loopDetected) {
                const detectedTime = parseInt(loopDetected)
                const now = Date.now()

                // 如果循环检测标志在5分钟内，则强制清除状态
                if (now - detectedTime < 5 * 60 * 1000) {
                    shouldClearState = true
                    reason = 'loopDetected'
                    console.log('$ gotoLogin: 检测到循环跳转标志，将强制清除登录状态')

                    // 清除标志，避免影响后续正常操作
                    localStorage.removeItem('jlcone-loop-detected')
                } else {
                    // 过期的标志，直接清除
                    localStorage.removeItem('jlcone-loop-detected')
                }
            }
        } catch (error) {
            console.error('$ gotoLogin: 检查循环检测标志失败', error)
        }

        try {
            // 立即清除当前页面的登录相关存储
            try {
                // 清除localStorage中的登录相关数据
                const keysToRemove = []
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (
                        key &&
                        (key.includes('token') || key.includes('auth') || key.includes('login') || key.includes('user'))
                    ) {
                        keysToRemove.push(key)
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key))

                // 清除sessionStorage
                sessionStorage.clear()

                console.log('$ gotoLogin: 已清除当前页面的登录相关存储')
            } catch (error) {
                console.error('$ gotoLogin: 清除页面存储失败', error)
            }

            // 发送跳转消息，默认清除所有状态以防止循环跳转
            ipcRenderer.send(EMessage.ELoadingGotoLogin, loginUrl, {
                clearCookies: shouldClearState,
                forceLogout: shouldClearState,
                disableAutoJump: shouldClearState,
                reason: reason,
            })

            console.log('$ gotoLogin: 跳转消息已发送', { shouldClearState, reason })
        } catch (error) {
            console.error('$ gotoLogin: 发送跳转消息失败', error)
        }
    },
    setUserConfigWithObj: (dict: Record<string, any>) => {
        console.log('📤 配置同步请求:', dict)
        
        // 简化的语言配置保护：拦截所有没有来源标记的语言修改
        if ('language' in dict && !dict.__source) {
            console.log('🔒 拦截未授权的语言配置修改:', dict.language)
            
            // 移除语言配置
            const filteredDict = { ...dict }
            delete filteredDict.language
            
            // 如果没有其他配置，直接返回
            if (Object.keys(filteredDict).length === 0) {
                console.log('   跳过此次请求（仅包含被拦截的语言配置）')
                return
            }
            
            dict = filteredDict
        }
        
        // 使用增强的配置API，但保持向后兼容
        try {
            const { enhancedViewPreloadAPI } = require('./EnhancedViewPreloadAPI')

            // 尝试使用增强API
            enhancedViewPreloadAPI
                .setUserConfigWithObj(dict, {
                    validate: true,
                    silent: false,
                })
                .then((result: any) => {
                    if (!result.success) {
                        // Enhanced API失败，回退到legacy
                        // 降级到原有实现
                        console.log('Legacy setUserConfigWithObj:', dict)
                        delete dict.language
                        ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, dict)
                    }
                })
                .catch((error: any) => {
                    console.warn('Enhanced API error, falling back to legacy:', error)
                    // 降级到原有实现
                    console.log('Legacy setUserConfigWithObj:', dict)
                    ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, dict)
                })
        } catch (error) {
            // 如果增强API不可用，使用原有实现
            console.log('Enhanced API not available, using legacy:', dict)
            ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, dict)
        }
    },

    // 新增：清除登录相关cookie的方法
    clearLoginCookies: async () => {
        try {
            console.log('$ clearLoginCookies: 开始清除登录相关cookie')
            const result = await ipcRenderer.invoke('/login/clearCookies')
            console.log('$ clearLoginCookies: cookie清除结果', result)
            return result
        } catch (error) {
            console.error('$ clearLoginCookies: 清除cookie失败', error)
            return { success: false, error: error.message }
        }
    },

    // 强制退出登录并跳转到登录窗口
    forceLogout: (loginUrl: string) => {
        // 防循环检查
        if (checkGotoLoop('forceLogout')) {
            console.warn('forceLogout: 检测到循环跳转，跳过本次操作')
            return
        }

        console.log('$ forceLogout: 强制退出登录并跳转到登录窗口', loginUrl)

        try {
            // 强制清除所有状态
            ipcRenderer.send(EMessage.ELoadingGotoLogin, loginUrl, {
                clearCookies: true,
                forceLogout: true,
                disableAutoJump: true,
                reason: 'forceLogout',
            })
        } catch (error) {
            console.error('$ forceLogout: 发送跳转消息失败', error)
        }
    },

    // 立即清除所有登录状态和cookie（不跳转窗口）
    clearAllLoginState: async () => {
        console.log('$ clearAllLoginState: 立即清除所有登录状态和cookie')

        try {
            // 1. 清除当前页面的cookie和存储
            document.cookie.split(';').forEach(function (c) {
                document.cookie = c
                    .replace(/^ +/, '')
                    .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
            })

            if (typeof localStorage !== 'undefined') {
                localStorage.clear()
            }

            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.clear()
            }

            // 2. 通知主进程清除所有相关状态
            const result = await ipcRenderer.invoke('/login/clearAllState')

            console.log('$ clearAllLoginState: 状态清除完成', result)
            return result
        } catch (error) {
            console.error('$ clearAllLoginState: 清除状态失败', error)
            return { success: false, error: error.message }
        }
    },

    // 正常启动时的登录检查，保留登录状态
    gotoLoginSoft: (loginUrl: string) => {
        // 防循环检查
        if (checkGotoLoop('gotoLoginSoft')) {
            console.warn('gotoLoginSoft: 检测到循环跳转，跳过本次操作')
            return
        }

        // 正常启动，进入登录页但保留登录状态
        console.log('$ gotoLoginSoft: 正常启动进入登录窗口，保留登录状态', loginUrl)

        try {
            // 不清除cookie，不强制退出，允许自动跳转
            ipcRenderer.send(EMessage.ELoadingGotoLogin, loginUrl, {
                clearCookies: false,
                forceLogout: false,
                disableAutoJump: false,
                reason: 'startup',
            })
        } catch (error) {
            console.error('$ gotoLoginSoft: 发送跳转消息失败', error)
        }
    },

    // 网页 -> 主进程
    sendToMain: data => ipcRenderer.send('from-web', data),

    // 主进程 -> 网页
    onUpdate: callback => ipcRenderer.on('update-state', (event, state) => callback(state)),
    getUserConfig: async () => {
        // 使用增强的配置API，但保持向后兼容
        try {
            const { enhancedViewPreloadAPI } = require('./EnhancedViewPreloadAPI')

            // 尝试使用增强API
            const result = await enhancedViewPreloadAPI.getUserConfig()
            if (result.success) {
                return result.data
            } else {
                console.warn('Enhanced API failed, falling back to legacy:', result.message)
                // 降级到原有实现
                const userConfig = await ipcRenderer.invoke(EMessage.EMainGetUserConfig)
                return userConfig
            }
        } catch (error) {
            console.warn('Enhanced API error, falling back to legacy:', error)
            // 降级到原有实现
            const userConfig = await ipcRenderer.invoke(EMessage.EMainGetUserConfig)
            return userConfig
        }
    },
    fromMainMessage: callback => ipcRenderer.on(EMessage.EMainFromMainMessage, (event, state) => callback(state)),

    // 登录状态管理相关API
    loginState: {
        // 获取当前登录状态
        getCurrentState: async () => {
            return await ipcRenderer.invoke('/loginState/get')
        },

        // 检查是否已登录
        isLoggedIn: async () => {
            return await ipcRenderer.invoke('/loginState/isLoggedIn')
        },

        // 获取用户信息
        getUserInfo: async () => {
            return await ipcRenderer.invoke('/loginState/getUserInfo')
        },

        // 退出登录
        logout: async () => {
            return await ipcRenderer.invoke('/loginState/logout')
        },

        // 获取登录统计信息
        getStats: async () => {
            return await ipcRenderer.invoke('/loginState/getStats')
        },

        // 更新用户信息
        updateUserInfo: async (userInfo: any) => {
            return await ipcRenderer.invoke('/loginState/updateUserInfo', userInfo)
        },

        // 监听登录状态变化
        onStateChange: (callback: (event: any) => void) => {
            ipcRenderer.on(EMessage.EMainFromMainMessage, (event, message) => {
                if (message.type === 'loginStateChange') {
                    callback(message.data)
                }
            })
        },
    },
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
    onMainMsg,
})

function onMainMsg(listener: (event: any, ...args: any[]) => void) {
    try {
        ipcRenderer.on(EMessage.ESendToRender, listener)
        console.log('$$ onMainMsg', EMessage.ESendToRender)
    } catch (error) {
        console.error('$$ onMainMsg error', error)
    }
}

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

let bHandle = false
setInterval(() => {
    if (!bHandle && window.location.href.startsWith('chrome-error')) {
        console.log('$$ BrowserPreload.ts setInterval 30s', window.location.href)
        // :TODO: 处理页面加载失败
        // handlePageFailed()
        bHandle = true
    }
}, 30000)

function closeBvView() {
    ipcRenderer.send(EMessage.ERenderToMainCloseBvView, location.href)
}
let funClose = window.close.prototype
window.close = () => {
    closeBvView()
    funClose()
}

funWarn('加载ViewPreload结束 -----------------------------')
