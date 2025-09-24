import { BrowserView, BrowserWindow, Rectangle } from 'electron'
import { AppConfig } from '../config/AppConfig'
import { ECommon } from '../enum/ECommon'
import { EMessage } from '../enum/EMessage'
import { EWnd, EWndCfg, EWndPrimary } from '../enum/EWnd'
import { AppUtil } from '../utils/AppUtil'
import AppContainer from './AppContainer'
import { AppMsg } from './AppMsg'

export abstract class WndBase {
    protected m_browserWindow: BrowserWindow | undefined = undefined
    protected m_strWndLogicUUID: string = ECommon.ENone
    protected m_strWndType: string = ECommon.ENone
    protected m_nWndPrimary: number = EWndPrimary.EBase
    protected m_dictWndCfg: { [key: string]: unknown } = {}

    protected m_nMinWidth: number | undefined = undefined
    protected m_nMinHeight: number | undefined = undefined
    protected m_bSyncIsWin10 = false
    // life start ---------------------------------------------------------
    constructor() {}
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    isSyncWin10() {
        return this.m_bSyncIsWin10
    }
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getIsMaximize() {
        if (this.m_browserWindow) {
            if (process.platform === 'darwin') {
                return this.m_browserWindow.isFullScreen()
            } else {
                return this.m_browserWindow.isMaximized()
            }
        } else {
            return false
        }
    }
    setMinWidth(nMinWidth: number) {
        this.m_nMinWidth = nMinWidth
    }
    setMinHeight(nMinHeight: number) {
        this.m_nMinHeight = nMinHeight
    }
    getAllCfg() {
        return this.m_dictWndCfg
    }
    setSyncWin10(bSyncWin10: boolean) {
        this.m_bSyncIsWin10 = bSyncWin10
    }
    setWndType(strType: string) {
        this.m_strWndType = strType
    }
    setWndCfg(dictCfg: { [key: string]: unknown }) {
        this.m_dictWndCfg = dictCfg
    }
    getWndType() {
        return this.m_strWndType
    }
    setWndPrimary(nPrimary: number) {
        this.m_nWndPrimary = nPrimary
    }
    getWndPrimary() {
        return this.m_nWndPrimary
    }
    getBrowserWindow() {
        return this.m_browserWindow
    }
    setBrowserWindow(window: BrowserWindow | undefined) {
        this.m_browserWindow = window
        if (this.m_browserWindow) {
            this.m_browserWindow.on('resized', () => {
                let listSize = this.m_browserWindow.getSize()
                let nFinalWidth = listSize[0]
                let nFinalHeight = listSize[1]
                if (this.m_nMinWidth && this.m_nMinWidth >= nFinalWidth) {
                    nFinalWidth = this.m_nMinWidth
                }
                if (this.m_nMinHeight && this.m_nMinHeight >= nFinalHeight) {
                    nFinalHeight = this.m_nMinHeight
                }

                this.m_browserWindow.setSize(nFinalWidth, nFinalHeight, true)
            })
        }
        AppUtil.info(this.m_strWndType, 'setBrowserWindow', '获得窗体')
        this.onSetBrowserWindow()
    }
    setUseWindowUUID(strUUID: string) {
        this.m_strWndLogicUUID = strUUID
    }
    getUseWindowUUID() {
        return this.m_strWndLogicUUID
    }
    // abstract start ---------------------------------------------------------
    abstract init()
    abstract onShow(bShow: boolean)
    abstract onRefresh()
    abstract onDestroy()
    protected onSetBrowserWindow() {}
    // abstract end ---------------------------------------------------------
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    // 直接设置显示隐藏
    showPanelWithoutPrimary(bShow: boolean = true) {
        if (bShow) {
            // 没有窗口时获取窗体
            if (!this.m_browserWindow) {
                let WindowLogic = AppContainer.getApp().getWndMgr().getFreeWindowFromPool()
                if (!WindowLogic) {
                    AppUtil.error('WndBase', 'showPanelWithoutPrimary', `######没有空余窗口######`)
                    return
                }
                WindowLogic.initByWnd(this)
                this.setUseWindowUUID(WindowLogic.getUUID())
                this.setBrowserWindow(WindowLogic.getWindow())
            }
        }

        if (this.m_browserWindow) {
            // this.m_browserWindow.setOpacity(0)
            if (bShow) {
                // win10 win11 重新打开闪烁问题
                // setTimeout(() => {
                //     this.m_browserWindow.setOpacity(1)
                // }, 80)
                if (this.isShow()) {
                    // 已经显示
                    if (this.m_browserWindow.isMinimized()) {
                        this.m_browserWindow.restore()
                    }
                    this.m_browserWindow.moveTop()

                    if (this.m_nWndPrimary === EWndPrimary.EAlert) {
                        for (const strWnd of EWnd.listMainWnd) {
                            if (strWnd) {
                                let wnd = AppUtil.getExistWnd(strWnd)
                                if (!wnd) {
                                    continue
                                }
                                // 移动位置
                                let bw = wnd.getBrowserWindow()
                                if (!bw) {
                                    continue
                                }
                                let dictBound = bw.getBounds()
                                let dictAlertBound = this.m_browserWindow.getBounds()
                                let nCreateX = dictBound.x + dictBound.width / 2 - dictAlertBound.width / 2
                                let nCreateY = dictBound.y + dictBound.height / 2 - dictAlertBound.height / 2
                                let dictWindowCfg = this.m_dictWndCfg[EWndCfg.EWindowCfg]
                                let nWidth = dictWindowCfg['width'] as number
                                let nHeight = dictWindowCfg['height'] as number

                                let dictNewBound: Rectangle = {
                                    x: Math.floor(nCreateX),
                                    y: Math.floor(nCreateY),
                                    width: nWidth,
                                    height: nHeight,
                                }
                                this.m_browserWindow.setBounds(dictNewBound)
                                break
                            }
                        }
                    }

                    this.onRefresh()
                } else {
                    this.m_browserWindow.show()
                    this.m_browserWindow.setOpacity(1)
                }
            } else {
                this.m_browserWindow.setOpacity(0)
                this.m_browserWindow.hide()
            }
        }

        this.onShow(bShow)

        if (!bShow) {
            let strUseUUID = this.getUseWindowUUID()
            if (this.m_strWndType === EWnd.EMain) {
                // 主窗口不归还
                this.m_browserWindow.hide()
            } else {
                // 其他窗口归还.tab_item_right
                let windowLogic = AppContainer.getApp().getWndMgr().getWindowLogicByUUID(strUseUUID)

                if (windowLogic) {
                    windowLogic.backToFree()
                }
                this.setUseWindowUUID(ECommon.ENone)
                this.setBrowserWindow(undefined)
            }
        }
    }
    showPanel(bShow: boolean = true) {
        this.showPanelWithoutPrimary(bShow)
        AppUtil.showPanelPrimary(this, bShow)
    }
    maximizeToggle() {
        if (process.platform === 'darwin') {
            if (this.m_browserWindow) {
                // 苹果兼容
                if (this.m_browserWindow.isFullScreen()) {
                    this.m_browserWindow.setFullScreen(false)
                } else {
                    this.m_browserWindow.setFullScreen(true)
                }
            }
        } else {
            if (this.m_browserWindow) {
                // 防止悬停在任务栏上
                this.m_browserWindow.setFullScreen(false)
                if (this.m_browserWindow.isMaximized()) {
                    this.m_browserWindow.unmaximize()
                } else {
                    this.m_browserWindow.maximize()
                }
            }
        }
    }
    minimize() {
        this.m_browserWindow?.minimize()
    }
    refreshPanel() {
        this.onRefresh()
    }

    isShow() {
        return this.m_browserWindow?.isVisible()
    }

    onResetWebViewScale() {}
    onOpenSubViewDevTools() {}
    protected doResetWebViewScale(view: BrowserView) {
        if (!view) {
            AppUtil.warn('WndBase', 'resetWebViewScale', '界面调整网页比例!view')
            return
        }
        let nSacle = AppConfig.getWebViewScale(this.m_strWndType) / 100
        AppUtil.info('WndBase', 'resetWebViewScale', this.m_strWndType + '界面调整网页比例:' + nSacle)
        // view.webContents.enableDeviceEmulation({
        //     scale: nSacle,
        // } as any)
        view.webContents.setZoomFactor(nSacle)
    }
    destroy() {
        this.onDestroy()
        // 归还窗口
        let strUseUUID = this.getUseWindowUUID()
        let windowLogic = AppContainer.getApp().getWndMgr().getWindowLogicByUUID(strUseUUID)
        if (windowLogic) {
            windowLogic.backToFree()
        }
        AppUtil.removeWnd(this.m_strWndType)
    }
    reloadUI() {
        // 热加载ui
        let strFile = this.m_dictWndCfg[EWndCfg.EWndRes] as string
        console.log(this.m_strWndType, '重新加载:' + strFile)
        this.m_browserWindow.reload()
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number) {}
    // update end ---------------------------------------------------------
}
