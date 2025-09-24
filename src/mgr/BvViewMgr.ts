import { BrowserView, RenderProcessGoneDetails, Result, webFrameMain } from 'electron'
import { AppConfig } from '../config/AppConfig'
import { ECommon, ETabType } from '../enum/ECommon'
import { EMessage } from '../enum/EMessage'
import { EWnd } from '../enum/EWnd'
import { MainWindow } from '../main/window/MainWindow'
import { AppUtil } from '../utils/AppUtil'
import { BvItem, BvMgr } from './BvMgr'
import Stack from '../dataStruct/Stack'

export class BvView extends BvItem {
    // life start ---------------------------------------------------------
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getTitle(): string {
        if (!this.m_view) {
            return ECommon.ENone
        }
        return this.m_view.webContents.getTitle()
    }
    onDestroy(): void {
        try {
            if (this.m_view && this.m_view.webContents) {
                ;(this.m_view.webContents as any).destroy()
            }
        } catch (error) {
            AppUtil.error('BvView', 'onDestroy', `${this.m_strId}`, error)
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

export class BvViewMgr extends BvMgr {
    protected m_dictBvView: { [key: string]: BvView } = {}
    
    // 事件去重机制：防止频繁触发相同事件
    private lastTitleUpdateTime: number = 0
    private lastDomReadyTime: number = 0
    private readonly EVENT_DEBOUNCE_INTERVAL = 1000 // 1秒内去重
    
    // life start ---------------------------------------------------------

    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    protected createNewBvItemView() {
        const view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                nodeIntegrationInSubFrames: true,

                scrollBounce: true,
                safeDialogs: true,
                safeDialogsMessage: '',
                contextIsolation: true,
                sandbox: true,
                preload: AppConfig.viewPreloadJSPath,
            },
        })
        // view.webContents.openDevTools({ mode: 'undocked' })
        // view.setAlwaysOnTop(true, 'floating')
        
        // 优化：添加防抖机制的页面标题更新事件
        view.webContents.on('page-title-updated', () => {
            const now = Date.now()
            if (now - this.lastTitleUpdateTime < this.EVENT_DEBOUNCE_INTERVAL) {
                return // 1秒内去重，避免频繁触发
            }
            this.lastTitleUpdateTime = now
            
            try {
                let wnd = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
                if (wnd) {
                    wnd.syncTabData('page-title-updated')
                }
            } catch (error) {
                AppUtil.error('BvViewMgr', 'page-title-updated', '处理页面标题更新事件失败', error)
            }
        })

        // 注册搜索消息
        view.webContents.on('found-in-page', (event: Event, result: Result) => {
            this.onSearchEvent(event, result)
        })
        
        // view.webContents.removeAllListeners('di')
        view.webContents.on(
            'did-frame-finish-load',
            (event: Event, isMainFrame: boolean, frameProcessId: number, frameRoutingId: number) => {
                const frame = webFrameMain.fromId(frameProcessId, frameRoutingId)
                if (frame && frame.url !== view.webContents.getURL()) {
                    frame.executeJavaScript(AppConfig.framePreloadJs)
                }
            }
        )
        
        view.webContents.on('did-finish-load', () => {
            try {
                view.webContents.executeJavaScript(AppConfig.viewFinishLoadJSPath)

                let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
                if (mainWindow) {
                    mainWindow.onUrlFinish(view.webContents.getURL())
                }
            } catch (error) {
                AppUtil.error('BvViewMgr', 'did-finish-load', '处理页面加载完成事件失败', error)
            }
        })

        // 优化：添加防抖机制的DOM准备事件
        view.webContents.on('dom-ready', () => {
            const now = Date.now()
            if (now - this.lastDomReadyTime < this.EVENT_DEBOUNCE_INTERVAL) {
                return // 1秒内去重，避免频繁触发
            }
            this.lastDomReadyTime = now
            
            try {
                let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
                if (mainWindow) {
                    mainWindow.syncTabData('dom-ready')
                }
            } catch (error) {
                AppUtil.error('BvViewMgr', 'dom-ready', '处理DOM准备事件失败', error)
            }
        })
        return view
    }
    protected createNewBvItem(strParenId: string, strId: string, strUrl: string, view: any): BvItem {
        return new BvView(strParenId, strId, strUrl, view)
    }
    setTopBrowserView(strViewId: string, strReason: string | undefined = undefined): void {
        if (!(strViewId in this.m_dictBvView)) {
            return
        }

        AppUtil.info('BvViewMgr', 'setTopBrowserView', `开始设置top页:${strReason},${strViewId}`)
        let wndParent = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
        if (!wndParent) {
            return
        }
        if (strViewId === this.m_dictTopViewId) {
            return
        } else {
            let currentView = this.m_dictBvView[this.m_dictTopViewId]

            if (currentView) {
                currentView.recordSetShow(false)
                wndParent.getBrowserWindow().removeBrowserView(currentView.getWebView())
            }
        }

        let targetView = this.m_dictBvView[strViewId]
        if (!targetView) {
            AppUtil.error('BvMgr', 'setTopBrowserView', `${strViewId}不存在`)
            return
        }

        targetView.recordSetShow(true)
        wndParent.getBrowserWindow().setBrowserView(targetView.getWebView())

        this.m_dictTopViewId = strViewId

        let strTab = wndParent.getCurrentTabType()

        this.addHistory(strTab, strViewId, 'setTopBrowserView')

        this.resetSearch()
        
        // 对于用户主动的tab切换操作，使用立即同步以提供即时反馈
        if (strReason === '/main/browser/setTop') {
            wndParent.syncTabDataImmediate('setTopBrowserView-immediate')
        } else {
            wndParent.syncTabData('setTopBrowserView')
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number): void {
        super.update(nDeltaTime)

        for (const strViewId of Object.keys(this.m_dictBvView)) {
            let view = this.m_dictBvView[strViewId]

            for (const strUrl of AppConfig.listCloseBv) {
                let regTest = new RegExp(strUrl)
                if (regTest.test(view.getUrl())) {
                    this.closeBv(strViewId)
                }
            }
        }
    }
    // update end ---------------------------------------------------------
}
