import https from 'https'
import path from 'path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'

import { AppUtil } from '../utils/AppUtil'
import { ASSIT_VERSION } from './config'

interface IVersionInfo {
    jlcOrderClientMinVersion: string
    jlcOrderClientWindows64: string
    jlcOrderClientMac64: string
    jlcOrderClientLinux64: string
}
/** 版本信息 URL */
const VERSION_INFO_URL = 'https://lceda.cn/api/jlcOrderClientVersion/'
/** 小助手下载地址 */
const DOWNLOAD_URL = 'https://www.jlc.com'

const updateTips = '您的小助手版本较低，请及时更新。'
const forceUpdateTips = '您的小助手版本过低，已经无法使用，请及时更新。'
const props = {
    createTime: '',
    cancelVisible: true,
    cancelText: '下次一定',
    confirmVisible: true,
    confirmText: '前往下载',
    content: updateTips,
}
let alertWindow: BrowserWindow | null = null

/** 检查更新 */
export function checkForUpdates() {
    AppUtil.info('utils', 'checkForUpdates', 'start checkUpdate')
    return new Promise(resolve => {
        // 这里只请求一次，请求失败就算了？
        https
            .get(VERSION_INFO_URL, res => {
                // AppUtil.info('utils', 'checkForUpdates', 'interface', res)
                if (res.statusCode !== 200) {
                    console.log(`[checkForUpdated.ts] get ${VERSION_INFO_URL} failed. statusCode:`, res.statusCode)
                    resolve(true)
                }
                res.on('data', (buffer: Buffer) => {
                    const data = JSON.parse(buffer.toString('utf8'))
                    AppUtil.info('utils', 'checkForUpdates', 'data', data)
                    if (!data?.success) {
                        console.log(
                            '[checkForUpdated.ts] get https://lceda.cn/api/jlcOrderClientVersion/ failed. result:',
                            data?.result
                        )
                        resolve(true)
                    } else {
                        const versionInfo: IVersionInfo = {} as any
                        data.result.forEach(item => {
                            versionInfo[item.keyword] = item.value
                        })
                        resolve(compareAndAlert(versionInfo))
                    }
                })
            })
            .on('error', e => {
                console.error(e)
                resolve(true)
            })
    })
}

/** 比较并弹窗提醒 */
function compareAndAlert(versionInfo: IVersionInfo) {
    try {
        const nowVersion = ASSIT_VERSION
        const minVersion = versionInfo.jlcOrderClientMinVersion
        // 小于最小版本号，需要强制用户更新
        const forceUpdate = compareVersion(nowVersion, minVersion) < 0
        if (forceUpdate) {
            props.createTime = new Date().getTime() + ''
            ipcMain.once('/alert/cancel', (event, time) => {
                if (time === props.createTime) {
                    appQuit()
                }
            })
            ipcMain.once('/alert/confirm', (event, time) => {
                if (time === props.createTime) {
                    onConfirm()
                }
            })
            props.cancelVisible = false
            props.content = forceUpdateTips
            props.cancelText = '退出应用'
            createAlert(props)
            return false
        }
        let newVersion = nowVersion
        switch (process.platform) {
            case 'win32':
                newVersion = versionInfo.jlcOrderClientWindows64
                break
            case 'darwin':
                newVersion = versionInfo.jlcOrderClientMac64
                break
            case 'linux':
                newVersion = versionInfo.jlcOrderClientLinux64
                break
        }
        // 需要更新
        const updatable = compareVersion(nowVersion, newVersion) < 0
        if (updatable) {
            props.createTime = new Date().getTime() + ''
            ipcMain.once('/alert/cancel', (event, time) => {
                if (time === props.createTime) {
                    onCancel()
                }
            })
            ipcMain.once('/alert/confirm', (event, time) => {
                if (time === props.createTime) {
                    onConfirm()
                }
            })
            createAlert(props)
        }
        return true
    } catch (error) {
        console.log('[checkForUpdates.ts] error', error)
        return true
    }
}

/** 比较版本号函数 */
function compareVersion(ver1, ver2) {
    const verNums1 = ver1.split('.')
    const verNums2 = ver2.split('.')
    for (let i = 0; i < verNums1.length; i++) {
        const num1 = parseInt(verNums1[i])
        const num2 = parseInt(verNums2[i])
        if (num1 < num2) {
            return -1
        } else if (num1 > num2) {
            return 1
        }
    }
    return 0
}

/** 创建提示窗体 */
function createAlert(props) {
    const preloadJSPath = path.join(__dirname, 'preload.js')
    alertWindow = new BrowserWindow({
        frame: false,
        resizable: false,
        width: 300,
        height: 150,
        show: false,
        alwaysOnTop: true,
        webPreferences: {
            preload: preloadJSPath,
            nodeIntegration: true,
        },
    })
    alertWindow.loadFile('build/alert.html')
    // alertWindow.webContents.openDevTools({ mode: 'undocked' })
    alertWindow.once('ready-to-show', () => {
        alertWindow?.show()
    })
    alertWindow.on('closed', () => {
        alertWindow = null
    })

    ipcMain.removeHandler('/alert/props')
    ipcMain.handle('/alert/props', async (event, args) => {
        return Promise.resolve(props)
    })
}

/** 确认 */
function onConfirm() {
    shell.openExternal(DOWNLOAD_URL)
}

/** 普通更新提醒关闭 */
function onCancel() {
    alertWindow?.close()
    alertWindow?.destroy()
}

/** 强制更新提醒关闭 */
function appQuit() {
    app.quit()
}
