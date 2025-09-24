import { ipcMain, WebContents } from 'electron'
import AppContainer from '../base/AppContainer'
import { WndBase } from '../base/WndBase'

import { getLogger, configure } from 'log4js'
import { v1 as uuidv1 } from 'uuid'
import { AppConfig } from '../config/AppConfig'
import { ASSIT_VERSION } from '../main/config'
import { EWnd } from '../enum/EWnd'
import { AlertWindow } from '../main/window/AlertWindow'
import { FloatBrowser } from '../mgr/WndMgr'
import CryptoJS from 'crypto-js'

import { ECommon } from '../enum/ECommon'
import { AppMsg } from '../base/AppMsg'
import { EMessage } from '../enum/EMessage'


import * as osUtils from 'os-utils'
import * as os from 'os'



/**
 * 初始化日志系统配置
 * @param strUserPath 用户数据路径，用于存储日志文件
 */
export function initLog(strUserPath: string) {
    // 初始化日志
    configure({
        appenders: {
            infoLogs: {
                type: 'dateFile',
                filename: strUserPath + '/logs/info/file.log',
                maxLogSize: 10485760, // 10mb,日志文件大小,超过该size则自动创建新的日志文件
                backups: 20, // 仅保留最新的20个日志文件
                compress: false, //  超过maxLogSize,压缩代码
            },
            errorLogs: {
                type: 'dateFile',
                filename: strUserPath + '/logs/error/file.log',
                maxLogSize: 10485760,
                backups: 20,
                compress: false,
            },
            justErrors: {
                type: 'logLevelFilter', // 过滤指定level的文件
                appender: 'errorLogs', // appender
                level: 'error', // 过滤得到error以上的日志
            },
            rendererInfoLogs: {
                type: 'dateFile',
                filename: strUserPath + '/logs/info/renderer.log',
                maxLogSize: 10485760, // 10mb,日志文件大小,超过该size则自动创建新的日志文件
                backups: 20, // 仅保留最新的20个日志文件
                compress: false, //  超过maxLogSize,压缩代码
            },
            rendererErrorLogs: {
                type: 'dateFile',
                filename: strUserPath + '/logs/error/renderer.log',
                maxLogSize: 10485760,
                backups: 20,
                compress: false,
            },
            crashLogs: {
                type: 'dateFile',
                filename: strUserPath + '/logs/error/crash.log',
                maxLogSize: 10485760,
                backups: 20,
                compress: false,
            },
            console: { type: 'console' },
        },
        categories: {
            default: { appenders: ['console', 'justErrors', 'infoLogs'], level: 'info' },
            err: { appenders: ['errorLogs'], level: 'error' },
            renderer: { appenders: ['console', 'rendererErrorLogs', 'rendererInfoLogs'], level: 'info' },
            crash: { appenders: ['crashLogs'], level: 'error' },
        },
    })
}
const logger = getLogger()
const rendererLogger = getLogger('renderer')
const crashLogger = getLogger('crash')
/**
 * 应用程序工具类
 * 提供日志记录、窗口管理、系统信息获取等功能
 */
export class AppUtil {
    /** 服务器性能信息字典 */
    static dictServerInfo: { [key: string]: number } = {
        cpuUsage: 0,
        gpuUsage: 0,
        freeMem: 0,
        totalMem: 0,
    }
    /**
     * 获取格式化的性能信息字符串
     * @returns 包含CPU使用率、总内存和可用内存的格式化字符串
     */
    static getFormatPerformance(): string {
        let serverInfo = AppUtil.getPerformance()
        return `cpu: ${Math.ceil(serverInfo.cpuUsage * 100)}%, totalMem:${Math.floor(
            serverInfo.totalMem
        )}MB, freeMem:${Math.floor(serverInfo.freeMem)}MB`
    }
    /**
     * 检查当前系统是否为Windows 10或更高版本
     * 同时检查GPU状态和虚拟机环境
     * @returns 如果是Windows 10+且GPU正常且非虚拟机环境则返回true
     */
    static isWindow10OrLater(): boolean {
        let strWindow = os.platform()
        let strRelease = os.release()
        let listSplit = strRelease.split('.')
        if (listSplit.length <= 0) {
            return false
        }
        let nVersion = 0
        try {
            nVersion = parseInt(listSplit[0])
        } catch (error) {
            return false
        }
        let bAfterWin10 = strWindow === 'win32' && nVersion >= 10
        if (!bAfterWin10) {
            return false && AppConfig.GpuNormal
        } else {
            // 判断虚拟机
            let bIsVirtualMachine = AppConfig.isVirtualMachine()
            return bAfterWin10 && AppConfig.GpuNormal && !bIsVirtualMachine
        }
    }
    static info(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        // logger.info(`${AppUtil.getFormatPerformance()} ${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        // if (obj) {
        //     logger.info(obj)
        // }
    }
    static warn(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        logger.warn(`${AppUtil.getFormatPerformance()} ${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        if (obj) {
            logger.warn(obj)
        }
    }
    static error(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        logger.error(`${AppUtil.getFormatPerformance()} ${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        if (obj) {
            logger.error(obj)
        }
    }
    static debug(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        logger.debug(`${AppUtil.getFormatPerformance()} ${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        if (obj) {
            logger.debug(obj)
        }
    }
    static infoRenderer(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        rendererLogger.info(`${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        if (obj) {
            rendererLogger.info(obj)
        }
    }
    static warnRenderer(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        rendererLogger.warn(`${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        if (obj) {
            rendererLogger.warn(obj)
        }
    }
    static errorRenderer(strModule: string, strFunction: string, strLog: string | number, obj?: unknown) {
        rendererLogger.error(`${ASSIT_VERSION}【${strModule}-${strFunction}】${strLog}`)
        if (obj) {
            rendererLogger.error(obj)
        }
    }
    static crashLog(details: unknown) {
        crashLogger.error(details)
    }

    // UI start
    static getCurrentShowWnd() {
        return AppContainer.getApp().getWndMgr().getCurrentShowWnd()
    }
    static getAllWnd() {
        return AppContainer.getApp().getWndMgr().getAllWnd()
    }
    static getCreateWnd(strWndType: string) {
        return AppContainer.getApp().getWndMgr().getCreateWnd(strWndType)
    }
    static getExistWnd(strWndType: string) {
        return AppContainer.getApp().getWndMgr().getExistWnd(strWndType)
    }
    static removeWnd(strWndType: string) {
        AppContainer.getApp().getWndMgr().removeWnd(strWndType)
    }
    static showPanelPrimary(wndHandle: WndBase, bShow: boolean) {
        AppContainer.getApp().getWndMgr().handlePanelPrimary(wndHandle, bShow)
    }
    static addListener(strMessage: string, listener: (...args: unknown[]) => void) {
        return AppContainer.getApp().addListener(strMessage, listener)
    }
    static getListener(strMessage: string) {
        return AppContainer.getApp().getListener(strMessage)
    }
    // UI end
    static createUUID() {
        return uuidv1()
    }
    static getPerformance() {
        return AppUtil.dictServerInfo
    }
    static updateGetPerformance() {
        AppUtil.dictServerInfo.freeMem = osUtils.freemem()
        AppUtil.dictServerInfo.totalMem = osUtils.totalmem()
        osUtils.cpuUsage(function (v: number) {
            AppUtil.dictServerInfo.cpuUsage = v
        })
    }
    static createConfirmAlert(
        strTitle: string,
        listInfo: string[],
        funOK: Function | undefined = undefined,
        funCancel: Function | undefined = undefined
    ) {
        let wndAlert = AppUtil.getCreateWnd(EWnd.EAlert) as AlertWindow
        wndAlert.showConfirm(strTitle, listInfo, funOK, funCancel)
    }
    static createAlert(strTitle: string, listInfo: string[]) {
        let wndAlert = AppUtil.getCreateWnd(EWnd.EAlert) as AlertWindow
        wndAlert.showAlert(strTitle, listInfo)
    }
    static createUserLog(content: WebContents, strReason: string, listOperate: string[]) {
        content.send(
            EMessage.ESendToRender,
            new AppMsg(EMessage.EMainToRenderCreateUserLog, {
                'reason': strReason,
                'operate': listOperate,
            })
        )
    }

    static openNewBrowserWindow(
        strUrl: string,
        dictOption: { [key: string]: unknown } | undefined = undefined
    ): FloatBrowser {
        return AppContainer.getApp().getWndMgr().openNewBrowserWindow(strUrl, dictOption)
    }

    static ipcMainOn(strMessage: string, listener: (...args: unknown[]) => void) {
        if (AppUtil.getListener(strMessage) === undefined) {
            AppUtil.addListener(strMessage, listener)
            ipcMain.on(strMessage, listener)
        }
    }

    static ipcMainHandle(strMessage: string, listener: (...args: unknown[]) => unknown) {
        if (AppUtil.getListener(strMessage) === undefined) {
            AppUtil.addListener(strMessage, listener)
            ipcMain.handle(strMessage, listener)
        }
    }

    static addUrlTimestamp(strUrl: string) {
        if (strUrl.indexOf('?') > 0) {
            return `${strUrl}&t=${new Date().getTime()}`
        } else {
            return `${strUrl}?t=${new Date().getTime()}`
        }
    }

    static spawnTask(strExe: string, ...args: string[]) {
        import('child_process').then(cp => cp.spawn(strExe, args))
    }

    static commandLineArgListToArgMap(listArg: string[]): { [key: string]: unknown } | undefined {
        let strChar: string
        if (listArg.length <= 0) {
            return
        }
        let reg1 = new RegExp(/\//g)
        let reg2 = new RegExp(/\\/g)
        for (const strParam of listArg) {
            let listSplitEqual = strParam.split('=')
            let strItem = listSplitEqual[0]

            strItem = strItem.replace(reg1, '')
            strItem = strItem.replace(reg2, '')

            if (strItem === 'Params_Count') {
                continue
            }
            let strValue = listSplitEqual[1]
            if (!strChar) {
                strChar = strValue
            } else {
                strChar += strValue
            }
        }
        return this.deEncryptByChar(strChar)
    }
    static deEncryptByChar(strChar: string): { [key: string]: unknown } | undefined {
        let dictArg: { [key: string]: unknown } = {}
        let list16Num: number[] = []
        for (let nIndex = strChar.length, j = 0; j < nIndex; j += 2) {
            list16Num[j / 2] = parseInt(strChar.substring(j, j + 2), 16)
        }

        let strHexData = ''
        for (const nCode of list16Num) {
            strHexData += String.fromCharCode(nCode)
        }



        const hexWordArray = CryptoJS.enc.Hex.parse(strHexData)
        const strBase64 = CryptoJS.enc.Base64.stringify(hexWordArray)
        const result = CryptoJS.DES.decrypt(strBase64, CryptoJS.enc.Utf8.parse(AppConfig.DESKey), {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.NoPadding,
        })

        let strJson = result.toString(CryptoJS.enc.Utf8).replace(/\s/g, '')
        let listJson = strJson.split('')
        let listJsonReverse = listJson.reverse()
        let nIndex = listJsonReverse.indexOf('}')
        if (nIndex < 0) {
            AppUtil.error('AppUtil', 'commandLineArgListToArgMap', '解密失败, 找不到最后一个花括号')
            return dictArg
        }
        let nEnd = strJson.length - nIndex
        let strFinalJson = strJson.slice(0, nEnd)

        try {
            dictArg = JSON.parse(strFinalJson)
        } catch (error) {
            AppUtil.error('AppUtil', 'commandLineArgListToArgMap', '解密失败', error)
        }
        return dictArg
    }

    static tryGetDataByPath(obj: unknown, listPath: string[]): unknown {
        if (!obj) {
            return
        }
        if (listPath.length <= 0) {
            return
        }
        if (listPath.length === 1) {
            return (obj as Record<string, unknown>)[listPath[0]]
        }
        let start = (obj as Record<string, unknown>)[listPath[0]]
        if (!start) {
            return
        }
        for (let nIndex = 1; nIndex < listPath.length; nIndex++) {
            let child = (start as Record<string, unknown>)[listPath[nIndex]]
            if (!child) {
                return
            }
            start = child
        }
        return start
    }
    static getXmlElementName(xml: Record<string, unknown>): string {
        if (!xml) {
            return ECommon.ENone
        }
        for (const strKey of Object.keys(xml)) {
            if (xml.strKey instanceof Function) {
                continue
            }
            return strKey
        }
        return ECommon.ENone
    }
    static getUrlParam(strUrl: string) {
        let arrObj = strUrl.split('?')
        let params = Object.create(null)
        if (arrObj.length > 1) {
            arrObj = arrObj[1].split('&')
            arrObj.forEach(item => {
                let listSplit = item.split('=')
                params[listSplit[0]] = listSplit[1]
            })
        }
        return params
    }

    static getVersionNum(strVersion: string | undefined): number {
        if (!strVersion) {
            return 0
        }
        let listSplit = strVersion.split('.')
        if (listSplit.length <= 0) {
            return 0
        }
        let nStartValue = 0
        for (let nIndex = 0; nIndex < listSplit.length; nIndex++) {
            let nNum = 0
            try {
                nNum = parseFloat(listSplit[nIndex])
            } catch (error) {
                return 0
            }

            let nPow = listSplit.length - nIndex
            nStartValue += nNum * Math.pow(100, nPow)
        }
        return nStartValue
    }
    static isVirtualNetworkInterface(strName: string, listInterface: Array<{ internal: boolean; mac: string }>) {
        const listVMKeyword = ['VMware', 'VirtualBox', 'Virtual', 'Virtio']
        for (const strTest of listVMKeyword) {
            if (new RegExp(strTest).test(strName)) {
                return true
            }
        }
        for (const strAddress of listInterface) {
            if (listVMKeyword.some(keyword => strAddress.internal || strAddress.mac.startsWith(keyword))) {
                return true
            }
        }

        return false
    }
    static getMacAddress() {
        let dictInterFace = os.networkInterfaces()
        for (let strName of Object.keys(dictInterFace)) {
            let listCfg = dictInterFace[strName]
            if (this.isVirtualNetworkInterface(strName, listCfg)) {
                continue
            }
            for (let dictCfg of listCfg) {
                let { family, address, internal, mac } = dictCfg
                if (family === 'IPv4' && address !== '127.0.0.1' && !internal) {
                    return mac
                }
            }
        }
    }
    static getAppDataPath(): string {
        const { app } = require('electron')
        return app.getPath('userData')
    }
}
