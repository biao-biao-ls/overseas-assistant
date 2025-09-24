import { Rectangle, Result, webFrameMain, screen, BrowserWindow, BrowserView } from 'electron'
import AppContainer from '../base/AppContainer'
import { AppMsg } from '../base/AppMsg'
import { AppConfig } from '../config/AppConfig'
import Stack from '../dataStruct/Stack'
import { EBvLabel as EBvLabel, ECommon, ETabType } from '../enum/ECommon'
import { EMessage } from '../enum/EMessage'
import { EWnd, EWndPrimary } from '../enum/EWnd'
import { MainWindow } from '../main/window/MainWindow'
import { AppUtil } from '../utils/AppUtil'
import { BvItem, BvMgr } from './BvMgr'

export class BvViewWindow extends BvItem {
    // life start ---------------------------------------------------------
    constructor(strParenId: string, strId: string, strUrl: string, view: BrowserWindow) {
        super(strParenId, strId, strUrl, view)

        this.m_view.once('ready-to-show', () => {
            this.m_bShow = true
            let wndParent = AppUtil.getExistWnd(this.m_strParentId)
            if (!wndParent) {
                return
            }
            if (!wndParent.getBrowserWindow().isMinimized()) {
                this.m_view.show()
            }
        })
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------

    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getTitle() {
        if (!this.m_view) {
            return ECommon.ENone
        }
        return this.m_view.webContents.getTitle()
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------

    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onDestroy(): void {
        try {
            if (this.m_view && this.m_view.webContents) {
                ;(this.m_view.webContents as any).destroy()
            }
        } catch (error) {
            AppUtil.error('BvViewWindow', 'onDestroy', `${this.m_strId}`, error)
        }
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
export class BvWindowMgr extends BvMgr {
    protected m_dictBvView: { [key: string]: BvViewWindow } = {}
    // life start ---------------------------------------------------------
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    protected createNewBvItem(strParenId: string, strId: string, strUrl: string, view: any): BvItem {
        return new BvViewWindow(strParenId, strId, strUrl, view)
    }
    setTopBrowserView(strViewId: string): void {
        if (!(strViewId in this.m_dictBvView)) {
            return
        }
        AppUtil.info('BvWindowMgr', 'setTopBrowserView', `${strViewId}开始设置top页`)
        if (strViewId === this.m_dictTopViewId) {
            return
        } else {
            let currentView = this.m_dictBvView[this.m_dictTopViewId]

            if (currentView) {
                currentView.recordSetShow(false)
                // wndParent.getBrowserWindow().removeBrowserView(currentView.getView())
            }
        }
        let wndParent = AppUtil.getCreateWnd(this.m_strParentWnd)
        if (!wndParent) {
            return
        }
        let targetView = this.m_dictBvView[strViewId]
        if (!targetView) {
            AppUtil.error('BvWindowMgr', 'setTopBrowserView', `${strViewId}不存在`)
            return
        }
        targetView.recordSetShow(true)

        this.m_dictTopViewId = strViewId

        this.resetSearch()
        targetView.getWebView().setParentWindow(wndParent.getBrowserWindow())

        let wnd = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
        wnd.syncTabData()
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    protected createNewBvItemView(): BrowserWindow {
        let bWin10Later = AppUtil.isWindow10OrLater()
        const view = new BrowserWindow({
            frame: false,
            hasShadow: false,
            resizable: false,
            autoHideMenuBar: true,
            show: false,
            alwaysOnTop: false,
            skipTaskbar: true,
            closable: false,
            minimizable: false,
            maximizable: false,
            movable: false,
            focusable: true,
            modal: true,
            transparent: bWin10Later,
            backgroundColor: bWin10Later ? '#00ffffff' : '#ffffff',
            webPreferences: {
                preload: AppConfig.viewPreloadJSPath,
            },
        })
        // view.webContents.openDevTools({ mode: 'undocked' })
        // view.setAlwaysOnTop(true, 'floating') 
        view.webContents.on('page-title-updated', () => {
            let wnd = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
            wnd.syncTabData()
        })
        view.webContents.on('did-stop-loading', () => {
            let wnd = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
            wnd.syncTabData()
        })

        // 注册搜索消息
        view.webContents.on('found-in-page', (event: Event, result: Result) => {
            this.onSearchEvent(event, result)
        })
        view.webContents.removeAllListeners('did-frame-navigate')
        view.webContents.on(
            'did-frame-navigate',
            (event, url, httpResponseCode, httpStatusText, isMainFrame, frameProcessId, frameRoutingId) => {
                const frame = webFrameMain.fromId(frameProcessId, frameRoutingId)
                if (frame && url !== view.webContents.getURL()) {
                    const code = AppConfig.framePreloadJs
                    frame.executeJavaScript(code)
                }
            }
        )
        view.loadFile('build/loading.html')
        return view
    }

    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------

    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
