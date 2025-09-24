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

export class AlertWindow extends WndBase {
    static configMsg() {
        // 注册消息
        let listenerOK = (event, ...args) => {
            let wndAlert = AppUtil.getExistWnd(EWnd.EAlert) as AlertWindow
            if (!wndAlert) {
                return
            }
            wndAlert.onClickOK()
        }

        AppUtil.ipcMainOn(EMessage.EMainAlertOK, listenerOK)

        let listenerCancel = (event, ...args) => {
            let wndAlert = AppUtil.getExistWnd(EWnd.EAlert) as AlertWindow
            if (!wndAlert) {
                return
            }
            wndAlert.onClickCancel()
        }

        AppUtil.ipcMainOn(EMessage.EMainAlertCancel, listenerCancel)

        let handlerGetInfo = async event => {
            let wndAlert = AppUtil.getCreateWnd(EWnd.EAlert) as AlertWindow
            if (!wndAlert) {
                return
            }
            return Promise.resolve({
                'title': wndAlert.getTitle(),
                'info': wndAlert.getInfo(),
                'confirm': wndAlert.isConfirm(),
            })
        }
        AppUtil.ipcMainHandle(EMessage.EMainAlertInfo, handlerGetInfo)
    }

    private m_strTitle: string = '警告'
    private m_listInfo: string[] = []
    private m_funOK: Function | undefined = undefined
    private m_funCancel: Function | undefined = undefined
    private m_bIsConfirm: boolean = false

    init() {}
    onShow(bShow: boolean) {
        // this.m_browserWindow?.webContents?.openDevTools({ mode: 'undocked' })
        if (bShow) {
            this.m_browserWindow?.webContents?.send(
                EMessage.ESendToRender,
                new AppMsg(EMessage.ERenderUpdateSetting, {
                    'title': this.getTitle(),
                    'info': this.getInfo(),
                    'confirm': this.isConfirm(),
                })
            )
        }
    }
    onRefresh() {}
    onDestroy() {}
    // life start ---------------------------------------------------------
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    isConfirm() {
        return this.m_bIsConfirm
    }
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getTitle() {
        return this.m_strTitle
    }
    getInfo() {
        return this.m_listInfo
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    showConfirm(
        strTitle: string,
        listInfo: string[],
        funOK: Function | undefined = undefined,
        funCancel: Function | undefined = undefined
    ) {
        this.m_strTitle = strTitle
        this.m_listInfo = listInfo
        this.m_funOK = funOK
        this.m_funCancel = funCancel
        this.m_bIsConfirm = true
        this.showPanel(true)
    }
    showAlert(strTitle: string, listInfo: string[]) {
        this.m_strTitle = strTitle
        this.m_listInfo = listInfo
        this.m_funOK = undefined
        this.m_funCancel = undefined
        this.m_bIsConfirm = false
        this.showPanel(true)
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onClickOK() {
        this.showPanel(false)
        if (this.m_funOK) {
            this.m_funOK()
        }
    }
    onClickCancel() {
        this.showPanel(false)
        if (this.m_funCancel) {
            this.m_funCancel()
        }
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
