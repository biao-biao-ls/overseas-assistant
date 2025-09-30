import { app, BrowserWindow, BrowserView, ipcMain, screen } from 'electron'

import AppContainer from '../../base/AppContainer'

import { WndBase } from '../../base/WndBase'
import { AppConfig } from '../../config/AppConfig'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'
import { MainWindow } from './MainWindow'
import { ErrorConfig } from '../../config/ErrorConfig'

const ReloadLoginTime = 5 * 60 * 1000
const CheckLoginTime = 5000

export interface ErrorData {
    reason: string
    exitCode: string
}

export class UpdateTipWindow extends WndBase {
    static configMsg() {
        // 在窗体创建前运行
        let listenerLoginSuc = (event, loginSuccessInfo) => {}
        AppUtil.ipcMainOn(EMessage.EMainLoginSuccess, listenerLoginSuc)
        
        // 注册语言获取处理器
        AppUtil.ipcMainHandle(EMessage.EMainGetLocale, async () => {
            return AppConfig.getLocale()
        })
        
        // 注册用户配置获取处理器 - 修复 updateTip.tsx 中的调用错误
        AppUtil.ipcMainHandle(EMessage.EMainSettingGetUserConfig, async () => {
            const config = { ...AppConfig.config }
            const languageList = require('../../utils/languages.json')
            
            // 确保语言列表不包含"跟随系统"选项
            config.languageList = languageList
            
            // 确保语言配置不为空，如果是system或匹配不到支持的语言，默认使用英语
            if (!config.language || config.language === 'system') {
                // 如果是 system，尝试获取系统语言
                if (config.language === 'system') {
                    try {
                        const systemLanguage = AppConfig.getSystemLanguage()
                        const supportedLanguages = languageList.map(lang => lang.cfg)
                        if (supportedLanguages.includes(systemLanguage)) {
                            config.language = systemLanguage
                        } else {
                            config.language = 'en' // 系统语言不在支持列表中，默认英语
                        }
                    } catch (error) {
                        config.language = 'en' // 获取系统语言失败，默认英语
                    }
                } else {
                    config.language = 'en' // 语言配置为空，默认英语
                }
            } else {
                // 检查当前语言是否在支持的语言列表中
                const supportedLanguages = languageList.map(lang => lang.cfg)
                if (!supportedLanguages.includes(config.language)) {
                    config.language = 'en' // 匹配不到支持的语言，默认英语
                    console.log('UpdateTipWindow: 语言不在支持列表中，使用默认英语')
                }
            }
            
            console.log('UpdateTipWindow: 返回配置数据', {
                language: config.language,
                hasLanguageList: !!config.languageList,
                languageListLength: config.languageList?.length,
                hasUpdateInfo: !!config.updateInfo,
                version: config.version
            })
            
            return config
        })
        
        // 注册系统语言相关处理程序，保持与 SettingWindow 一致
        AppUtil.ipcMainHandle(EMessage.EMainGetSystemLanguage, async () => {
            return AppConfig.getSystemLanguage()
        })

        AppUtil.ipcMainHandle(EMessage.EMainGetCurrentLanguage, async () => {
            return AppConfig.getCurrentLanguage()
        })
    }

    private m_loginView: BrowserView

    private m_nReloadTimer: number = ReloadLoginTime

    private m_nCheckTimer: number = CheckLoginTime

    private m_bCheckLogin = true

    openDirectLogin() {}
    loadLoginUrl() {}
    init() {}
    private getLoginBound() {}
    protected onSetBrowserWindow(): void {}
    onResetWebViewScale(): void {
        this.doResetWebViewScale(this.m_loginView)
    }
    onOpenSubViewDevTools() {
        this.m_loginView?.webContents?.openDevTools({ mode: 'undocked' })
    }
    onShow(bShow: boolean) {}
    onRefresh() {}
    onDestroy() {
        ;(this.m_loginView?.webContents as any).destroy?.()
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
    private resetLoginView() {}
    reloadLogin() {}
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------

    private onReloadLoginPage() {}
    private onCheckLogin() {}
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    onLoginPageLoadFailed(strUrl: string, strReason: string, dictData: ErrorData) {}
    update(nDeltaTime: number): void {}
    // update end ---------------------------------------------------------
}
