import { ipcMain, session, dialog } from 'electron'
import AppContainer from '../../base/AppContainer'
import { AppMsg } from '../../base/AppMsg'
import { WndBase } from '../../base/WndBase'
import { AppConfig, DebugConfig } from '../../config/AppConfig'
import { EAlertMsg } from '../../enum/EAlertMsg'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'

export class SettingWindow extends WndBase {
    static configMsg() {
        let handlerGetViewScale = async (event, args) => {
            let nScale = AppConfig.getCurrentWebViewScale()
            return Promise.resolve(nScale)
        }
        AppUtil.ipcMainHandle(EMessage.EMainSettingGetCurrentWebViewScale, handlerGetViewScale)

        let listenerReset = event => {
            AppUtil.createConfirmAlert('警告', EAlertMsg.EAlertReset, () => {
                AppContainer.getApp().reset()
            })
        }
        AppUtil.ipcMainOn(EMessage.EMainSettingReset, listenerReset)

        AppUtil.ipcMainHandle(EMessage.EMainSettingDownloadsPath, async () => {
            const settingWindow = AppUtil.getExistWnd(EWnd.ESetting) as SettingWindow
            const m_browserWindow = settingWindow?.m_browserWindow
            if (m_browserWindow) {
                m_browserWindow.setAlwaysOnTop(false)
                const { canceled, filePaths } = await dialog.showOpenDialog(m_browserWindow, {
                    title: '选择默认下载位置',
                    defaultPath: AppConfig.getDownloadsPath(),
                    properties: ['openDirectory'],
                })
                m_browserWindow.setAlwaysOnTop(true)
                if (!canceled) {
                    return filePaths[0]
                }
                return ''
            } else {
                AppUtil.error('SettingWindow', 'EMainSettingDownloadsPath', '设置默认下载位置：找不到设置窗口')
            }
        })

        AppUtil.ipcMainHandle(EMessage.EMainSettingGetUserConfig, async () => {
            const config = { ...AppConfig.config }
            const languageList = require('../../utils/languages.json')
            
            // 确保语言列表不包含"跟随系统"选项
            config.languageList = languageList
            
            // 新的语言管理系统：使用有效语言逻辑
            const effectiveLanguage = AppConfig.getEffectiveLanguage()
            config.language = effectiveLanguage
            
            console.log('SettingWindow: 使用新的语言管理系统', {
                effectiveLanguage,
                userLanguage: AppConfig.config.userLanguage,
                systemLanguage: AppConfig.getSystemLanguage(),
                hasLanguageList: !!config.languageList,
                languageListLength: config.languageList?.length,
            })
            
            return config
        })

        AppUtil.ipcMainHandle(EMessage.EMainGetSystemLanguage, async () => {
            return AppConfig.getSystemLanguage()
        })

        AppUtil.ipcMainHandle(EMessage.EMainGetCurrentLanguage, async () => {
            return AppConfig.getCurrentLanguage()
        })

        ipcMain.on(EMessage.ESetProxy, (event, data) => {
            let dictCurrent = AppConfig.getProxy()

            if (!data || data === '') {
                dictCurrent['proxyRules'] = ''
                session.defaultSession.setProxy(dictCurrent)
                session.defaultSession.forceReloadProxyConfig()
                return
            }
            dictCurrent['proxyRules'] = data
            session.defaultSession.setProxy(dictCurrent)
            session.defaultSession.forceReloadProxyConfig()
            AppConfig.setProxy(dictCurrent)
            AppUtil.info('main', 'ESetProxy', '设置代理：' + dictCurrent)
        })
    }
    // life start ---------------------------------------------------------
    init() {}
    onShow(bShow: boolean) {
        if (bShow) {
            // this.m_browserWindow?.webContents?.openDevTools({ mode: 'undocked' })
        }
    }
    onRefresh() {}
    onDestroy() {}
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    sendUpdateSetting() {
        this.m_browserWindow?.webContents?.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderUpdateSetting))
    }

    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
