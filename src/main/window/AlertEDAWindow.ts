import { app, ipcMain } from 'electron'
import AppContainer from '../../base/AppContainer'
import { AppMsg } from '../../base/AppMsg'
import { WndBase } from '../../base/WndBase'
import { AppConfig, DebugConfig } from '../../config/AppConfig'
import { ETabType } from '../../enum/ECommon'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'
import { MainWindow } from './MainWindow'
import { SettingWindow } from './SettingWindow'

export class AlertEDAWindow extends WndBase {
    static configMsg() {
        ipcMain.on(EMessage.EAlertEDACloseOther, (event, args) => {
            let alertEDA = AppUtil.getExistWnd(EWnd.EAlertEDA)
            if (alertEDA) {
                alertEDA.showPanel(false)
            }

            AppConfig.setCloseCur(true)

            let settingWindow = AppUtil.getExistWnd(EWnd.ESetting) as SettingWindow
            if (settingWindow) {
                settingWindow.sendUpdateSetting()
            }
            // 关闭当前，打开页面
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            // 清理资源
            mainWindow.doSwitchTab(mainWindow.getTargetTab(), mainWindow.getTargetUrl(), false)
        })
        ipcMain.on(EMessage.EAlertEDAOpenSame, (event, args) => {
            let alertEDA = AppUtil.getExistWnd(EWnd.EAlertEDA)
            if (alertEDA) {
                alertEDA.showPanel(false)
            }

            AppConfig.setCloseCur(false)
            let settingWindow = AppUtil.getExistWnd(EWnd.ESetting) as SettingWindow
            if (settingWindow) {
                settingWindow.sendUpdateSetting()
            }

            // 打开页面
            // 关闭当前，打开页面
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            // 清理资源
            mainWindow.doSwitchTab(mainWindow.getTargetTab(), mainWindow.getTargetUrl(), false)
        })
    }

    init() {}
    onShow(bShow: boolean) {}
    onRefresh() {}
    onDestroy() {}
    // life start ---------------------------------------------------------
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    protected onSetBrowserWindow(): void {
        // this.m_browserWindow?.webContents?.openDevTools({ mode: 'undocked' })
        if (this.m_browserWindow) {
            this.m_browserWindow.webContents.on('did-finish-load', event => {
                let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
                if (!mainWindow) {
                    return
                }
                let strCurrentType = mainWindow.getCurrentTabType()
                this.m_browserWindow?.webContents?.send(
                    EMessage.ESendToRender,
                    new AppMsg(EMessage.ERenderAlertEDASetAlert, strCurrentType)
                )
            })

            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            let strCurrentType = mainWindow.getCurrentTabType()
            this.m_browserWindow?.webContents?.send(
                EMessage.ESendToRender,
                new AppMsg(EMessage.ERenderAlertEDASetAlert, strCurrentType)
            )
        }
    }

    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
