import { ipcMain, clipboard, Menu, BrowserWindow } from 'electron'
import { EWnd } from '../enum/EWnd'
import { MainWindow } from '../main/window/MainWindow'
import { AppUtil } from '../utils/AppUtil'
import { deCrypto, enCrypto, parseKey, storeUserDeviceInfo } from '../main/utils'
import CryptoJS from 'crypto-js'
import Store from 'electron-store'
import zlib from 'zlib'
import { AppConfig } from '../config/AppConfig'
import { EMessage } from '../enum/EMessage'
import { ECommon, ELogLevel, ETabType } from '../enum/ECommon'
import { SettingWindow } from '../main/window/SettingWindow'
import { LoginWindow } from '../main/window/LoginWindow'
import { EAlertMsg } from '../enum/EAlertMsg'
import AppContainer from '../base/AppContainer'
import { AppMsg } from '../base/AppMsg'
import { ErrorConfig } from '../config/ErrorConfig'

/** 十六进制的 key */
const AES_KEY = '5F296A415F6F673F2879296F5F6F6740'

const store = new Store()

type InfoType = 'all' | 'HardDisk' | 'OsInfo' | 'network_adapter' | 'processor' | 'system'
export class MsgMgr {
    private m_bCtrlDown = false
    // life start ---------------------------------------------------------
    constructor() {}
    init() {
        this.configMsg()
    }
    private configMsg() {
        AppUtil.info('MsgMgr', 'configMsg', '注册消息')
        // 创建右键菜单
        ipcMain.on('/contextMenu/show', (event, topUrl, frameUrl, strAnchorUrl, strSelection) => {
            const locale = AppConfig.getLocale()
            let bShowContextMenu = true

            let currentContent = event.sender

            AppUtil.info('msgMgr', "/contextMenu/show'", [topUrl, frameUrl, strAnchorUrl, strSelection].toString())

            const templateRefresh = [
                {
                    label: locale.locale_24,
                    accelerator: 'f5',
                    click: () => {
                        event.sender.reload()
                    },
                },

                { type: 'separator' },
            ]
            const templateRefreshHard = [
                { type: 'separator' },
                {
                    label: locale.locale_25,
                    click: () => {
                        event.sender.reloadIgnoringCache()
                    },
                },
                { type: 'separator' },
            ]

            const templateReturn: any = [
                {
                    label: locale.locale_26,
                    click: () => {
                        event.sender.goBack()
                    },
                    enabled: event.sender.canGoBack(),
                },
                {
                    label: locale.locale_27,
                    click: () => {
                        event.sender.goForward()
                    },
                    enabled: event.sender.canGoForward(),
                },
                { type: 'separator' },
            ]
            const templatePage = [
                {
                    label: locale.locale_28,
                    click: () => {
                        clipboard.writeText(topUrl)
                    },
                },
                {
                    label: locale.locale_29,
                    click: () => {
                        clipboard.writeText(frameUrl)
                    },
                },
                { type: 'separator' },
            ]

            const templateOpenNew = [
                { type: 'separator' },
                {
                    label: locale.locale_30,
                    click: () => {
                        clipboard.writeText(strAnchorUrl)
                    },
                },
                {
                    label: locale.locale_31,
                    click: () => {
                        let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
                        if (!mainWindow) {
                            return
                        }
                        mainWindow.handleCreateNewTab(strAnchorUrl, true)
                    },
                },
                { type: 'separator' },
            ]

            const templateCopy = [
                { type: 'separator' },
                {
                    label: locale.locale_32,
                    accelerator: 'CmdOrCtrl+C',
                    click: () => {
                        clipboard.writeText(strSelection)
                    },
                    enabled: !ECommon.isNone(strSelection),
                },
            ]
            const templatePaste = [
                {
                    label: locale.locale_33,
                    accelerator: 'CmdOrCtrl+V',
                    click: () => {
                        currentContent?.send(EMessage.ESendToRender, new AppMsg(EMessage.EPaste, clipboard.readText()))
                    },
                    enabled: !ECommon.isNone(clipboard.readText()),
                },
                { type: 'separator' },
            ]

            let listTemplateFinal = []

            if (!ECommon.isNone(strAnchorUrl)) {
                listTemplateFinal = [
                    ...templateReturn,
                    ...templateRefresh,
                    ...templateCopy,
                    ...templatePaste,
                    ...templatePage,
                    ...templateOpenNew,
                    ...templateRefreshHard,
                ]
            } else {
                listTemplateFinal = [
                    ...templateReturn,
                    ...templateRefresh,
                    ...templateCopy,
                    ...templatePaste,
                    ...templatePage,
                    ...templateRefreshHard,
                ]
            }

            // 开发者模式
            let strCurrentWnd = AppUtil.getCurrentShowWnd()
            if (strCurrentWnd === EWnd.EMain) {
                //主界面添加开发者模式
                listTemplateFinal.push({
                    label: locale.locale_34,
                    click: () => {
                        let wndMain = AppUtil.getExistWnd(strCurrentWnd) as MainWindow
                        if (!wndMain) {
                            return
                        }
                        wndMain.openTopViewDevTool()
                    },
                })
            }

            const menu = Menu.buildFromTemplate(listTemplateFinal as any)
            menu.on('menu-will-close', () => {
                bShowContextMenu = true
            })
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (mainWindow && mainWindow.getCurrentTabType() === ETabType.EEDA) {
                bShowContextMenu = false
            }
            if (/lceda.cn\/editor/.test(frameUrl)) {
                bShowContextMenu = false
            }

            if (bShowContextMenu) {
                // 外壳右键可用
                menu.popup(BrowserWindow.fromWebContents(event.sender) as any)
            }
        })

        // 获取设备信息 getDeviceInfo
        ipcMain.on('viewFrame/getDeviceInfo', (event, security_code) => {
            let macAddress = ECommon.ENone
            try {
                macAddress = AppUtil.getMacAddress()
                console.log('获取mac地址:', macAddress)
            } catch (error) {
                // 获取版本信息容错
            }
            const deviceInfo = {
                device_info: macAddress.replaceAll(':', '').toUpperCase(),
                device_info_type: 'mac_address',
                device_name: 'Carl',
                device_type: 'PCHelper',
                security_code: security_code,
            }

            const enCryptoDeviceInfo = enCrypto(
                CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(deviceInfo))),
                AES_KEY
            )

            // console.log('[preload.ts] deviceInfo: ', deviceInfo)
            // console.log('[prelaod.ts] encodeDeviceInfo:', enCryptoDeviceInfo)

            // 测试：解密小助手拿到的字符串
            // const userInfoBase64Url = 'NjFGOUJGRkEyQ0UxOEE4OEYxN0Q2OTFDM0U1MkVEMURBNDBEMjBBQkU1NjUxRTZDQzhGMzM4RkQ4REMwRTFFMkEwRTIzQTJDRUQ0NkZCOTczMDYwNjZENDVDNTlCNDJFMkJFNjBBQTQ1ODMyOUM5NDg3NTdDRkFBOUYyMTQyNzE3OEJDMkYwRjhCRDk2NDRCMkI3MjE4MEU5MEZDRTg5NkU1ODI3QzYyRTQ4OTRBMzBGRTlCQ0RBOTI4NjJEN0MzMkYxQTBFOUMxRjBGOEIyQ0Y0MUIzMDAyRjY1QkE5NjNGRjVFODc0ODQ3RDI5NTc2MzIyMjdCOEQ0OUM2RTI0MzZCNUIwNjNBODMyMEU3ODg0ODcyQjgxRjgyNENBQzgw'
            // const userInfoHaxWord = (CryptoJS.enc.Base64url.parse(userInfoBase64Url)).toString(CryptoJS.enc.Utf8)
            // const deCryptoDeviceInfo = deCrypto(userInfoHaxWord, AES_KEY)
            // console.log('[preload.ts] deCryptoDeviceInfo:', JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Hex.parse(deCryptoDeviceInfo))))

            event.returnValue = CryptoJS.enc.Base64url.stringify(CryptoJS.enc.Utf8.parse(enCryptoDeviceInfo))
        })

        // 获取Pc端小助手设备信息 getPcAssitDeviceInfo
        ipcMain.on(
            'viewFrame/getDeviceInfo',
            (event, info_type: InfoType, security_code: string = '', signal: string) => {
                if (signal === 'reset_pc_assit_device_info') {
                    storeUserDeviceInfo(true)
                }
                let sysInfo: any
                try {
                    sysInfo = JSON.parse(
                        CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(store.get('device_info') as string))
                    )
                    console.log('getDeviceInfo 设备信息', sysInfo)
                } catch (error) {
                    console.error('[viewPreload.ts] parse local sysInfo', error)
                    storeUserDeviceInfo(true)
                    event.returnValue = ''
                }
                if (sysInfo) {
                    let device_info = {}
                    switch (info_type) {
                        case 'all':
                            device_info = {
                                HardDisk: sysInfo.HardDisk,
                                OsInfo: sysInfo.OsInfo,
                                UUID: sysInfo.UUID,
                                network_adapter: sysInfo.network_adapter,
                                processor: sysInfo.processor,
                                system: sysInfo.system,
                            }
                            break
                        default:
                            device_info = {
                                [info_type]: sysInfo[info_type],
                            }
                            break
                    }
                    const pcAssitDeviceInfo = {
                        device_name: sysInfo.hostName,
                        device_type: 'PCHelper',
                        security_code: security_code,
                        device_info_type: 'PcAssit_Device_Info',
                        device_info: device_info,
                    }
                    console.log('pcAssitDeviceInfo: \n', pcAssitDeviceInfo)
                    try {
                        const buffer = zlib.deflateSync(JSON.stringify(pcAssitDeviceInfo))
                        const enCryptoDeviceInfo = enCrypto(buffer.toString('base64'), AES_KEY)
                        const base64url = CryptoJS.enc.Base64url.stringify(CryptoJS.enc.Utf8.parse(enCryptoDeviceInfo))
                        // const testStr = 'NEQ0ODg2QTM4RjlGMjI2NzNEMEY4OEUxOEZCMTM2RTIxNDkzMDQ0Q0NERTk1OUU2NkM0RkQwMzEzRkIwRUMwMEQ2QjAwM0QyRkYwNzMxMDYwRkYwQUNERDY1MUUyMTBDNkY2NUQxRThCODM3QTAxOUExOUIyMjg0NDBFNDhGNDExMTQ0RUM0RDEyMzJCNkI1NzNDMzU5MEUzQzJCREU1NkM5N0JEMTNDOUNDRkY1MkRFMkVFMzAwRjUyNTg2NTZDNThFNjJDMzFBMzJGODdDQURFRjJCRjFGNTMwRDUyOEU0ODAyMDcwRjQ0MUE4OEQ1RTUwMjNDMTE1MjEzQjVEOTE3Q0E1NjQ4RUMzODgwNDlFOENEMzJDQTM4RkYyRTI4MDlENjY1Q0E0MjZGNTVFMThERkJGODkzNDZBQjMzRjE5NTYyNjBGQjlDQThCOENCOEZGNEFEREMzNjA4MDZGNjY2NzZEMDhFQUM2MjlGRTU1NzEwQ0E3QUQ1MEI4NTczMzQzRjg2M0UwMjZDMEJBOUIzQUYzOEI3RUIyMTQyMzM1MTcwMDU2MzA1QkFFRjMxRTgwQkE2N0M1MkU2QjEzNzE0NzJCRDY0QkYyNTM4QjFENDQ1QUY4MzE3OURCRUM5OTQxQUQ0MTMxN0Y1MkVBMDRENzI3MjM0QUI1QjREQTY1Q0EwN0IxRUNGNTE1QUFCMUY1MjJDNjE0QTRBQzZBNUU0OTIzNUFCMUNDMjY1OTlCNUUwRjVDOTQ3Mzg3QTlGRjE4RERFNUQ0NEJBNjQ0MEY1MDAwMkZBMEU3MkQxMUFFOUZFOUMzODJDQTk4RjM2QjM3NkVBRTAyM0I5MEJBRTBCRkU1MzBFQjBDMkY4RTZFNDc4MTI4REI1N0E3NTYyNjBENTA5MzA0OTE5QTUwODkyMUQ5QzhCN0ZBMURFRUQ3RjA1QzdCMTY4ODUwRjE4QjExNENGOENFMEY0NDU0N0U5OEExRjE2QjU3RkE1RDlFQzRGNDUyMTJGODRBM0Q3NjM4N0ZDNTMxMEIxMUIyRkM1RDFGMTU3MjEzMDVERjQ5NUIwMkIzRkEyMEU2OENGMEM4MkZGQ0NDQTczRjBBQUQ0MDU1QTlEQTUzMzZEMjE0MTQ5MEREMzI1RDQyQTNFQTQ2MDhGQjBGQTFEMzE0NDhCQjRGMDM4RkQ5MTQ5MjcwREU1QjUzQjg2OEVGRTE5REE2MzA1RDNERkQ5QTM3QUZGQjEyNDlBRkI3RjZERjU3MTlBQkZGMDVGQ0Y4OTQ3NDU0MDYzOUNGOTZBODA4MzRDMkFDN0Y0MkVCRDM4MUY1MTZDOTQ5NTA1NDExMDBGNkE1OUM3RDc2QTdENjgyRkFFOTcyODI3NjI1Qjg2M0RGMjhBREUyRDVFQjU2NjE3RjA0NjFCMDZCRjk0QTc4QUNDRDQ3ODEwQjlBRjQyMzU4NzUzNTk2Mzk1Njg2NDVEODQ4RDRBMTVGOUIwRjY5Qjk3MzJDQTY0QTJGRUI1NTU4QjgyRjRDQ0E5RjVBRUUyNUZEMDc1RDZDMDE0MjZGQ0MyMDg0RUVEQkE1OTY4MTlBMzFEMDBFMDM3MjdGMTk2NzEzNDFBNkYxQTVCMDM5RDVGMEVBQjUxREEzQjc0QzA2ODhGODZFNUVCNDUwMDUyODA5RjVGMTg0RDUwRkJGM0E2MUE4NzNCQzk2NzdGODU4Q0U3M0JDMTUwREM0QkUwRjU0NzgyNTVGMTY5ODkyQ0VFOTFBMDFDQTMxN0ZCRjg1RkU1OTBGNjY5Q0ZBMTdFRUMyN0I4MzIyMkJGM0JGMTkxQzc2RjEyNDg0QTM0QjBCRjEyODA0RkMwRjg2MjVGMkY0QzAzMzkyQTY0RUFCRDFBNkFEMjY0NEQzRTFBMkExODg2MzM4OUQ0N0JEMUI3NTJCMTUzNkU2N0U3RjM3NDRFMzg2NjFEOUM0NDYwOTQ0OTlDNEM5Q0M1REQ3MDY1OUJENDA5RTI4MjkwQTU1OA'
                        // deCryptoAndUnZipTest(base64url)
                        event.returnValue = base64url
                    } catch (error) {
                        console.error(error)
                    }
                }
                event.returnValue = ''
            }
        )

        // 获取设备信息 getDeviceInfoEx
        ipcMain.on('viewFrame/getDeviceInfoEx', (event, security_code) => {
            let sysInfo: any
            try {
                let strDeviceInfo = store.get('device_info') as string

                sysInfo = JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(strDeviceInfo)))
                // console.log('[viewPreload.ts] getPcAssitDeviceInfo sysInfo', sysInfo)
                AppUtil.info('MsgMgr', 'getDeviceInfoEx', sysInfo)
                console.log(sysInfo)
            } catch (error) {
                console.error('[viewPreload.ts] parse local sysInfo', error)
                storeUserDeviceInfo(true)
                event.returnValue = ''
            }
            if (sysInfo) {
                const pcAssitDeviceInfo = {
                    device_name: sysInfo.hostName,
                    device_type: 'PCHelper',
                    security_code: security_code,
                    device_info_type: 'multi_device_infos',
                    device_info: JSON.stringify([sysInfo.system, sysInfo.processor, sysInfo.network_adapter]),
                }
                console.log('pcAssitDeviceInfo: \n', pcAssitDeviceInfo)
                try {
                    const buffer = zlib.deflateSync(JSON.stringify(pcAssitDeviceInfo))
                    const enCryptoDeviceInfo = enCrypto(buffer.toString('base64'), AES_KEY)
                    const base64url = CryptoJS.enc.Base64url.stringify(CryptoJS.enc.Utf8.parse(enCryptoDeviceInfo))
                    // console.log('[preload.ts] getDeviceInfoEx: \n', base64url)

                    // const testStr = 'MzQ1RkE1Qjg4Qzg1ODc0QjU5M0NDQjk2MEU0ODgyNkI0RUVDOUNGRUVFNEI0NUQ1OTdFMzBGODU1OUMxODlFMUMwQzY0Q0Y0MEFBMEE4MkU0MTBGNTkzOUE3MzcwRTgwRDMzRTRBRkEwRjM1Rjc0ODA4NDQ2MkNCNTczOENCNzQxMzE4NEVEOERDRDY0QTRFRTZDRERGQzM1NDI0QkVCNDkwRjc0ODQ2MTIxQjUwNzk2RjIxMEM4QUQyOTU2QzBCQzVGRjEyQTczQUVCQ0M0QTgzOURENjdDMUIyNTZCNjc3MkIxRkJFRDUwNUREQUM3NEYzREY2NjVEMTkzRkUwNzFCMzExNUE4RjMwNDQ4NDgwMDU1QUM1Q0FFREZEOEVGQ0Q4MzNDOEM2OTBDMTY3RjFENkU0NEIzRkRGQzREOEZBREEwMTIxQUU4N0VBMzM1REI2QkFCQTBBOUREMTlCRTZGMDFCOTkwQTI4RTU5MEZDQUI2MDc4NTI2QjhEREVGNEUyNDc4NjZCOTU2RjBBQ0RGNjNERjMzRURBMkY4OTkzQ0U0NkM2REJGNDQ1ODE5QjJCODQyRkIzMERBNUNFRkEyMjFENDc5OTMwM0QxRDIyNTRERTg1MTg2NEYzOEQ3NDQzMTUyRUVDRDREOTg2NTVGRjdEOERBMkU5M0VFNkNFMUQ3QzBDNEZCN0QwMzBEMEUxNDk5QTdBMDlFRTQ1RTVBMzlCQTJFMzNBNEQyQjU3NUY2NzBFRDdDQTUxNUU0MDJFMzdDRjlGNTYwOTQ5MjQ1MDYyMjY3OTMzRkFERkJCODExMzM0RTZEQjgxRDFCNDlBM0M4MThFMzJDRDk5MQ'
                    // deCryptoAndUnZipTest(base64url)
                    event.returnValue = base64url
                } catch (error) {
                    console.error(error)
                    event.returnValue = ''
                }
            }
            event.returnValue = ''
        })

        // 解压测试
        ipcMain.on('viewFrame/deCryptoAndUnZipTest', (event, base64Url) => {
            const hax = CryptoJS.enc.Base64url.parse(base64Url).toString(CryptoJS.enc.Utf8)
            const deCryptoHex = deCrypto(hax, AES_KEY)
            const buffer = Buffer.from(deCryptoHex, 'hex')
            const str = zlib.unzipSync(buffer).toString('utf8')
            console.log('解密结果: \n', JSON.parse(str))
            // console.log('解密设备信息: \n', JSON.parse(JSON.parse(str).device_info))
            event.returnValue = JSON.parse(str)
        })

        // 用户配置，只注册一次，不在窗体中注册，可能没有创建窗体
        ipcMain.on(EMessage.ESetCurrentHideTask, async (event, args) => {
            AppConfig.setHideToTask(args)
        })
        ipcMain.handle(EMessage.EGetCurrentHideTask, async (event, args) => {
            return Promise.resolve(AppConfig.isHideToTask())
        })
        ipcMain.handle(EMessage.EGetAutoStart, async (event, args) => {
            return Promise.resolve(AppConfig.isAutoStart())
        })
        ipcMain.on(EMessage.ESetAutoStart, async (event, args) => {
            AppConfig.setAutoStart(args)
        })

        ipcMain.on(EMessage.ESetCurrentAlertClose, async (event, args) => {
            AppConfig.setAlertClose(args)
        })
        ipcMain.handle(EMessage.EGetCurrentAlertClose, async (event, args) => {
            return Promise.resolve(AppConfig.isAlertClose())
        })

        ipcMain.handle(EMessage.EGetCurrentAlertEDA, async (event, args) => {
            return Promise.resolve(AppConfig.isAlertEDA())
        })
        ipcMain.on(EMessage.ESetCurrentAlertEDA, async (event, args) => {
            AppConfig.setAlertEDA(args)
            let settingWindow = AppUtil.getExistWnd(EWnd.ESetting) as SettingWindow
            if (settingWindow) {
                settingWindow.sendUpdateSetting()
            }
        })
        ipcMain.on(EMessage.ESetDownloadsPath, async (event, args) => {
            AppConfig.setDownloadsPath(args)
        })

        ipcMain.handle(EMessage.EGetCurrentCloseOther, async (event, args) => {
            return Promise.resolve(AppConfig.isCloseCur())
        })
        ipcMain.on(EMessage.ESetCurrentCloseOther, async (event, args) => {
            AppConfig.setCloseCur(args)
        })
        ipcMain.handle(EMessage.EGetWin10, async (event, args) => {
            return Promise.resolve(AppUtil.isWindow10OrLater())
        })
        ipcMain.handle(EMessage.EGetProxy, async (event, args) => {
            return Promise.resolve(AppConfig.getProxy())
        })
        ipcMain.handle(EMessage.EGetDownloadsPath, async (event, args) => {
            return Promise.resolve(AppConfig.getDownloadsPath())
        })
        // ipcMain.handle(EMessage.EMainGetPerformance, async (event, args) => {
        //     EMessage.EMainGetPerformance
        // })

        ipcMain.on('/browserView/alert', (event, strMessage: string) => {
            AppUtil.createAlert('提示', [strMessage])
        })

        ipcMain.on(
            EMessage.EMainRecordLog,
            (event, strLogType: string, href: string, strMessage: string, strOptionalParams: string) => {
                switch (strLogType) {
                    case ELogLevel.info:
                        AppUtil.infoRenderer('MsgMgr', href, strMessage, strOptionalParams)
                        break
                    case ELogLevel.log:
                        AppUtil.infoRenderer('MsgMgr', href, strMessage, strOptionalParams)
                        break
                    case ELogLevel.warn:
                        AppUtil.warnRenderer('MsgMgr', href, strMessage, strOptionalParams)
                        break
                    case ELogLevel.error:
                        AppUtil.errorRenderer('MsgMgr', href, strMessage, strOptionalParams)
                        break

                    default:
                        break
                }
            }
        )
        ipcMain.on(EMessage.EMainOpenUrlInTab, (event, strUrl) => {
            let mainWindow = AppUtil.getCreateWnd(EWnd.EMain) as MainWindow
            AppUtil.info('main', EMessage.EMainOpenUrlInTab, `OpenUrlInTab:${strUrl}`)
            if (mainWindow) {
                AppUtil.info('main', EMessage.EMainOpenUrlInTab, `OpenUrlInTab:${strUrl}`)
                let strCode = `window.open("${strUrl}")`
                mainWindow.getBrowserWindow()?.webContents?.executeJavaScript(strCode)
            }
        })
        ipcMain.on(EMessage.EMainInsertUnionTab, (event, strUrl, strTabType) => {
            AppConfig.insertUnionTab(strUrl, strTabType)
        })

        ipcMain.on(EMessage.EMainInsertIndexKey, (event, strKey) => {
            AppConfig.insertIndexKey(strKey)
        })

        ipcMain.on(EMessage.EMainPageCtrl, (event, bCtrlDown) => {
            this.m_bCtrlDown = bCtrlDown
        })
        ipcMain.on(EMessage.EMainPageZoomIn, (event, bZoomIn) => {
            if (!this.m_bCtrlDown) {
                return
            }
            let wndMain = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!wndMain) {
                return
            }
            if (wndMain.getCurrentTabType() === ETabType.EEDA) {
                // EDA不进行缩放操作
                return
            }
            // 当前的比例
            let nScale = AppConfig.getWebViewScale(EWnd.EMain)
            let nCurrentIndex = AppConfig.listScale.indexOf(nScale)

            if (nCurrentIndex < 0) {
                return
            }

            if (bZoomIn) {
                nCurrentIndex = Math.min(nCurrentIndex + 1, AppConfig.listScale.length - 1)
            } else {
                nCurrentIndex = Math.max(nCurrentIndex - 1, 0)
            }
            let nNewScale = AppConfig.listScale[nCurrentIndex]

            AppConfig.setCurrentWebViewScale(nNewScale)

            wndMain.onResetWebViewScale()

            let wndSetting = AppUtil.getExistWnd(EWnd.ESetting) as SettingWindow
            if (wndSetting) {
                wndSetting.sendUpdateSetting()
            }
        })
        ipcMain.on(EMessage.EMainPageFailed, event => {
            let strCurrentWnd = AppUtil.getCurrentShowWnd()
            if (strCurrentWnd === EWnd.ELoign) {
                let wndLogin = AppUtil.getExistWnd(strCurrentWnd) as LoginWindow
                if (!wndLogin) {
                    return
                }
                let strCurrentUrl = ''
                let loginView = wndLogin.getLoginView()
                if (loginView && loginView.webContents) {
                    strCurrentUrl = loginView.webContents.getURL()
                    // 重新刷新登录链接
                    if (/login/.test(strCurrentUrl)) {
                        // 重新加载
                        AppUtil.warn(
                            'msgMgr',
                            'onPageLoadFailed',
                            `url:${strCurrentUrl}页面加载失败，重新加载:${strCurrentUrl}`
                        )
                        loginView.webContents.loadURL(strCurrentUrl)
                        return
                    }
                }
                wndLogin.onLoginPageLoadFailed(strCurrentUrl, ErrorConfig.EChromeError, {
                    reason: '登录页检测到加载了谷歌错误页',
                    exitCode: '0',
                })
            } else if (strCurrentWnd === EWnd.EMain) {
                // bv错误页
                let wndMain = AppUtil.getExistWnd(strCurrentWnd) as MainWindow
                if (!wndMain) {
                    return
                }
                let bvMgr = wndMain.getBvMgr()
                if (!bvMgr) {
                    return
                }
                let strTopViewUrl = bvMgr?.getTopViewObj()?.getUrl()
                // 不清楚为啥，主页会跳到这个链接
                if (/www.jlc.com:80/.test(strTopViewUrl)) {
                    let strReplaceUrl = strTopViewUrl.replaceAll('jlc.com:80', 'jlc.com')
                    AppUtil.warn(
                        'msgMgr',
                        'onPageLoadFailed',
                        `url:${strTopViewUrl}页面加载失败，重新加载:${strReplaceUrl}`
                    )
                    bvMgr.getTopViewObj()?.getWebView()?.webContents?.loadURL(strReplaceUrl)
                    return
                }

                bvMgr.onPageLoadFailed(strTopViewUrl, ErrorConfig.EChromeError, {
                    reason: 'BrowserView 检测到加载了谷歌错误页',
                    exitCode: '1',
                })
            }
        })
        ipcMain.on(EMessage.EMainClickPlatformMsg, event => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            let bvMgr = mainWindow.getBvMgr()
            if (!bvMgr) {
                return
            }
            let topView = bvMgr.getTopViewObj()
            if (!topView) {
                return
            }
            let strUrl = topView.getUrl()

            let bIndex = AppConfig.isIndexUrl(strUrl)
            if (bIndex) {
                // toggle msg
                let webView = topView.getWebView()
                if (!webView) {
                    return
                }
                webView.webContents.executeJavaScript('window.noticeHandle()')
            } else {
                // 弹出alert
                AppUtil.createAlert('提示', EAlertMsg.EAlertPlatformMsgOnlyShowIndex)
            }
        })

        ipcMain.on(EMessage.EMainClickUrl, (event, strUrl) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            let browserWindow = mainWindow.getBrowserWindow()

            browserWindow?.webContents?.executeJavaScript(`window.open("${strUrl}")`)
        })


        ipcMain.on(EMessage.ERenderToMainCloseBvView, (event, strUrl) => {
            let wndMain = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!wndMain) {
                return
            }
            let dictAllView = wndMain.getBvMgr().getAllView()
            for (const view of Object.values(dictAllView)) {
                if (view.getUrl() === strUrl) {
                    wndMain.getBvMgr().closeBv(view.getViewId())
                    return
                }
            }
        })
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number) {
        if (BrowserWindow.getFocusedWindow() === null) {
            this.m_bCtrlDown = false
        }
    }
    // update end ---------------------------------------------------------
}
