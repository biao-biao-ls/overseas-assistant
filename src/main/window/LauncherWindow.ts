import { ipcMain } from 'electron'
import AppContainer from '../../base/AppContainer'
import { WndBase } from '../../base/WndBase'
import { AppConfig } from '../../config/AppConfig'
import { ECommon } from '../../enum/ECommon'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'

export class LauncherWindow extends WndBase {
    init() {
        // ipcMain.on('/dev/selectEnv', (event, env) => {
        //     switch (env) {
        //         case ECommon.EUAT:
        //             break
        //         case ECommon.EPro:
        //             break
        //     }
        //     let loginWindow = AppUtil.getCreateWnd(EWnd.ELoign)
        //     loginWindow?.showPanel(true)
        //     this.showPanel(false)
        //     this.destroy()
        // })
    }
    onShow(bShow: boolean) {}
    onRefresh() {}
    onDestroy() {}
}
