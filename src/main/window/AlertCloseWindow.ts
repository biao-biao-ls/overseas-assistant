import { app, ipcMain } from 'electron'
import AppContainer from '../../base/AppContainer'
import { AppMsg } from '../../base/AppMsg'
import { WndBase } from '../../base/WndBase'
import { AppConfig, DebugConfig } from '../../config/AppConfig'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'

export class AlertCloseWindow extends WndBase {
    static configMsg() {
        ipcMain.on('/msg/alertClose/clickConfirm', (event, args) => {
            const locale = AppConfig.getLocale()
            let alertClose = AppUtil.getExistWnd(EWnd.EAlertClose)
            if (alertClose) {
                alertClose.showPanel(false)
            }
            if (AppConfig.isHideToTask()) {
                AppContainer.getApp().sendTrayMsg('', locale.locale_35)
                // 提示气泡
                for (const wnd of AppUtil.getAllWnd()) {
                    wnd.showPanel(false)
                }
            } else {
                // 直接退出
                AppContainer.getApp().destroy('直接退出')
                app.exit()
            }
        })
        ipcMain.on('/msg/alertClose/clickCancel', (event, args) => {
            // 重新显示主窗口
            let alertClose = AppUtil.getExistWnd(EWnd.EAlertClose)
            if (alertClose) {
                alertClose.showPanel(false)
            }
            AppContainer.getApp().showMainWindow()
        })
    }
    init() {}
    onShow(bShow: boolean) {
        if (bShow) {
            // this.m_browserWindow?.webContents?.openDevTools({ mode: 'undocked' })
        }
    }
    onRefresh() {}
    onDestroy() {}
}
