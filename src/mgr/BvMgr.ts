import { Rectangle, Result, screen, BrowserWindow, RenderProcessGoneDetails, BrowserView } from 'electron'
import { AssistApp } from '../app/AssistApp'
import AppContainer from '../base/AppContainer'
import { AppMsg } from '../base/AppMsg'
import { AppConfig, ETabKey } from '../config/AppConfig'
import Stack from '../dataStruct/Stack'
import { EBvLabel, ECommon, ETabType } from '../enum/ECommon'
import { EMessage } from '../enum/EMessage'
import { EWnd } from '../enum/EWnd'
import { MainWindow } from '../main/window/MainWindow'
import { AppUtil } from '../utils/AppUtil'
import { BvView } from './BvViewMgr'
import { ErrorData } from '../main/window/LoginWindow'
import { ErrorConfig } from '../config/ErrorConfig'

export abstract class BvItem {
    protected m_strParentId: string = ECommon.ENone
    protected m_strId: string = ECommon.ENone
    protected m_nHistoryIndex: number = 0
    protected m_dictLabel: { [key: string]: any } = {}

    protected m_dictBound!: Rectangle
    protected m_bShow: boolean = false

    protected m_view: any = undefined
    // life start ---------------------------------------------------------
    constructor(strParenId: string, strId: string, strUrl: string, view: any) {
        this.m_strParentId = strParenId
        this.m_strId = strId
        this.m_view = view
    }
    setHistoryIndex(nIndex: number) {
        this.m_nHistoryIndex = nIndex
    }
    setUUID(strUUID: string) {
        this.m_strId = strUUID
    }
    getTabKey() {
        return AppConfig.getTabKeyFromCfg(this.getUrl())
    }
    getHistoryIndex() {
        return this.m_nHistoryIndex
    }
    abstract getTitle(): string

    abstract onDestroy(): void
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getViewId() {
        return this.m_strId
    }
    setViewScale(nScale: number) {
        AppUtil.info('BvItem', 'setViewScale', `【${this.m_strId}】界面调整网页比例: 【${nScale}】`)

        if (this.m_view && this.m_view.webContents) {
            this.m_view.webContents.setZoomFactor(nScale)
        }
    }
    getWebView() {
        return this.m_view
    }
    getAllLabel() {
        return this.m_dictLabel
    }
    getUrl() {
        return this.m_view?.webContents?.getURL()
    }

    setLabel(strLabel: string, value: any) {
        this.m_dictLabel[strLabel] = value
    }
    setAllLabel(dictAllLabel: { [key: string]: unknown }) {
        this.m_dictLabel = dictAllLabel
    }
    getLabel(strLabel: string) {
        return this.m_dictLabel[strLabel]
    }

    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    destroy() {
        this.onDestroy()
    }
    recordSetShow(bShow: boolean) {
        if (AppConfig.UseBrowserView) {
            return
        }
        if (this.m_bShow && bShow) {
            return
        }
        if (!this.m_bShow && !bShow) {
            return
        }
        this.m_bShow = bShow

        if (bShow) {
            this.recordFocus(true)
            if (this.m_bShow) {
                this.m_view.setOpacity(1)
            } else {
                this.m_view.show()
            }
        } else {
            this.recordFocus(false)
            this.m_view.setOpacity(0)
        }
    }
    recordWinBound(dictBound: Rectangle) {
        this.getWebView().setBounds(dictBound)
        if (this.m_dictBound === undefined) {
            this.m_dictBound = dictBound
            return
        }
        if (
            this.m_dictBound.x === dictBound.x &&
            this.m_dictBound.y === dictBound.y &&
            this.m_dictBound.width === dictBound.width &&
            this.m_dictBound.height === dictBound.height
        ) {
            return
        }

        this.getWebView().setBounds(dictBound)
        this.m_dictBound = dictBound
    }
    recordFocus(bFocus: boolean) {
        if (bFocus) {
            // this.m_view.setAlwaysOnTop(true, 'normal')
        } else {
            // this.m_view.setAlwaysOnTop(false, 'normal')
            let focusWindow = BrowserWindow.getFocusedWindow()
            if (focusWindow !== this.m_view) {
                this.m_view.blur()
                this.m_view.blurWebView()
            }
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}

const CheckErrorTime = 3000

export abstract class BvMgr {
    protected m_strParentWnd: string = ECommon.ENone

    protected m_dictTopViewId: string

    protected m_preLoadView!: any
    protected m_reloadView!: any
    protected m_dictBvView: { [key: string]: BvItem } = {}

    protected m_dictHistory: { [key: string]: Stack<string> } = {}

    protected m_bCheckError = true

    protected m_nCheckTimer = CheckErrorTime
    // life start ---------------------------------------------------------
    constructor(strParentId: string) {
        this.m_strParentWnd = strParentId
        this.m_preLoadView = this.createNewBvItemView()
    }

    protected abstract createNewBvItemView(): any
    protected abstract createNewBvItem(strParenId: string, strId: string, strUrl: string, view: any): BvItem
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getReloadData() {
        let dictReloadData: { [key: string]: unknown } = {}
        dictReloadData['view'] = {}
        let topView = this.getTopViewObj()
        if (topView) {
            dictReloadData['topUrl'] = topView.getUrl()
        }
        for (const strView of Object.keys(this.m_dictBvView)) {
            let viewObj = this.m_dictBvView[strView]
            dictReloadData['view'][strView] = {
                'url': viewObj.getUrl(),
                'label': viewObj.getAllLabel(),
            }
        }
        return dictReloadData
    }
    private getViewBound(): Rectangle {
        let wnd = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
        if (!wnd) {
            AppUtil.error('BvMgr', 'setViewBound', `!wnd【${this.m_strParentWnd}】`)
            return
        }
        let nBorderSize = 2
        let nShadowSize = 0
        let nAllNavHeight = 46
        let nTopTabHeight = 46
        let bWin10Later = AppUtil.isWindow10OrLater()
        let browserWindow = wnd.getBrowserWindow()
        let winBound = browserWindow.getBounds()
        let nWidth = winBound.width
        let nHeight = winBound.height
        let bMaximized = wnd.getIsMaximize()
        let bEDA = wnd.getCurrentTabType() === ETabType.EEDA
        let nUseNavHeight = bEDA ? nTopTabHeight : nAllNavHeight
        let dictBound: Rectangle = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        }
        let nOffset = 0
        let nFullScreenOffset = AppConfig.UseBrowserView ? 1 : 1
        if (bMaximized) {
            // 全屏
            let dictMaxBound = browserWindow.getBounds()
            nWidth = dictMaxBound.width - 8 * 2
            nHeight = dictMaxBound.height - 8 * 2
            // console.log('###########', browserWindow.getSize(), dictMaxBound)
            if (bWin10Later) {
                dictBound = {
                    x: 0,
                    y: nUseNavHeight + nOffset,
                    width: nWidth,
                    height: nHeight - nUseNavHeight - nOffset,
                }
            } else {
                dictBound = {
                    x: nFullScreenOffset,
                    y: nUseNavHeight + nFullScreenOffset,
                    width: nWidth,
                    height: nHeight - nUseNavHeight - nFullScreenOffset,
                }
            }
        } else {
            if (bWin10Later) {
                // window 10 之后启用阴影
                dictBound = {
                    x: nShadowSize,
                    y: nShadowSize + nUseNavHeight + nOffset,
                    width: nWidth - nShadowSize * 2,
                    height: nHeight - nUseNavHeight - nShadowSize * 2 - nOffset,
                }
            } else {
                dictBound = {
                    x: nBorderSize,
                    y: nUseNavHeight + nBorderSize + nOffset,
                    width: nWidth - nBorderSize * 2,
                    height: nHeight - nUseNavHeight - nBorderSize * 2 - nOffset,
                }
            }
        }
        // console.log(dictBound)
        return dictBound
    }

    refreshViewPos() {
        // 兼容win 11 win 10

        let dictBound = this.getViewBound()

        let wndParent = AppUtil.getCreateWnd(this.m_strParentWnd)
        if (!wndParent) {
            return
        }
        let posParent = wndParent.getBrowserWindow().getPosition()
        if (!AppConfig.UseBrowserView) {
            for (const strId of Object.keys(this.m_dictBvView)) {
                this.m_dictBvView[strId].recordWinBound({
                    x: dictBound.x + posParent[0],
                    y: dictBound.y + posParent[1],
                    width: dictBound.width,
                    height: dictBound.height,
                })
            }
        } else {
            for (const strId of Object.keys(this.m_dictBvView)) {
                this.m_dictBvView[strId].recordWinBound({
                    x: dictBound.x,
                    y: dictBound.y,
                    width: dictBound.width,
                    height: dictBound.height,
                })
            }
        }
    }

    getLogoutTab() {
        return this.m_preLoadView
    }
    getTopViewObj(): BvItem {
        if (!this.m_dictTopViewId) {
            return
        }
        let currentView = this.m_dictBvView[this.m_dictTopViewId]
        if (!currentView) {
            return
        }
        return currentView
    }
    getTopView(): any {
        if (!this.m_dictTopViewId) {
            return
        }
        let currentView = this.m_dictBvView[this.m_dictTopViewId]
        if (!currentView) {
            return
        }
        return currentView.getWebView()
    }
    getReloadView() {
        return this.m_reloadView
    }
    getLogicView(strViewId: string) {
        return this.m_dictBvView[strViewId]
    }
    getAllView() {
        return this.m_dictBvView
    }
    getWebView(strViewId: string) {
        let logicView = this.getLogicView(strViewId)
        if (!logicView) {
            return
        }
        return logicView.getWebView()
    }

    setTopBrowserView(strViewId: string, strReason: string | undefined = undefined) {}

    addHistory(strTab: string, strViewId: string, strReason: string) {
        if (!(strTab in this.m_dictHistory)) {
            this.m_dictHistory[strTab] = new Stack<string>(100)
        }
        this.m_dictHistory[strTab].push(strViewId)
        if (this.m_dictBvView[strViewId]) {
            this.m_dictBvView[strViewId].setHistoryIndex(this.m_dictHistory[strTab].getCount())
        }
    }
    setBvViewLabel(strViewId: string, strLabel: string, value: any) {
        let currentView = this.getLogicView(strViewId)
        if (!currentView) {
            AppUtil.error('BvMgr', 'setTopBrowserView', `${strViewId}不存在,${strLabel},${value}`)
            return
        }
        currentView.setLabel(strLabel, value)
    }
    getBvViewLabel(strViewId: string, strLabel: string) {
        let currentView = this.getLogicView(strViewId)
        if (!currentView) {
            AppUtil.error('BvMgr', 'getBvViewLabel', `${strViewId}不存在,${strLabel}`)
            return
        }
        return currentView.getLabel(strLabel)
    }

    getExistViewByUrl(strViewUUID: string | undefined, strNewUrl: string): BvItem | undefined {
        AppUtil.info('BvMgr', 'getExistViewByMatchData', '链接需要唯一：' + strNewUrl)
        // if (strNewUrl && strNewUrl.endsWith('/') && strNewUrl.length > 1) {
        //     // 去掉最后的斜杠
        //     strNewUrl = strNewUrl.substring(0, strNewUrl.length - 1)
        // }
        const topBv = this.getTopView()
        if (topBv) {
            const url = topBv.webContents.getURL()
            const topUrl = AppConfig.getTabUrlLabel(url)
            if (topUrl.endsWith('/user-center')) {
                return null
            }
        }
        const newUrl = AppConfig.getTabUrlLabel(strNewUrl)
        for (const strId in this.m_dictBvView) {
            const bvView: BvView = this.m_dictBvView[strId]
            let curUrl = bvView.getUrl()
            curUrl = AppConfig.getTabUrlLabel(curUrl)
            if (curUrl === newUrl) {
                bvView.getWebView().webContents.loadURL(strNewUrl)
                return this.m_dictBvView[strId]
            }
        }
    }

    getExistViewByTabKey(strViewUUID: string | undefined, listTab: string[]): BvItem | undefined {
        for (const strId of Object.keys(this.m_dictBvView)) {
            if (strId === strViewUUID) {
                continue
            }
            let strTabExist = this.m_dictBvView[strId].getTabKey()
            AppUtil.info('BvMgr', 'getExistViewByTabKey 优先选择', this.m_dictBvView[strId].getUrl(), strTabExist)
            if (strTabExist === listTab[0]) {
                return this.m_dictBvView[strId]
            }
        }

        for (const strId of Object.keys(this.m_dictBvView)) {
            if (strId === strViewUUID) {
                continue
            }
            let strTabExist = this.m_dictBvView[strId].getTabKey()
            AppUtil.info('BvMgr', 'getExistViewByTabKey 备用选择', this.m_dictBvView[strId].getUrl(), strTabExist)
            if (listTab.indexOf(strTabExist) >= 0) {
                return this.m_dictBvView[strId]
            }
        }
    }
    getErpView(): BvItem | undefined {
        const strIndexUrl = AppConfig.getIndexUrl()
        if (!strIndexUrl) {
            return
        }
        for (const strId of Object.keys(this.m_dictBvView)) {
            let strCurrentUrl = this.m_dictBvView[strId].getUrl()
            let strTest = strIndexUrl.split('#')[0].split('?')[0]

            if (strCurrentUrl.startsWith(strTest)) {
                return this.m_dictBvView[strId]
            }
        }
    }
    setViewScale() {
        let nScale = AppConfig.getWebViewScale(this.m_strParentWnd) / 100
        for (const strId of Object.keys(this.m_dictBvView)) {
            this.m_dictBvView[strId].setViewScale(nScale)
        }
    }

    getTopViewId() {
        let topView = this.getLogicView(this.m_dictTopViewId)
        if (!topView) {
            return ECommon.ENone
        }
        return topView.getViewId()
    }
    getBvInfoByLabel(dictLabel: { [key: string]: unknown } | undefined = undefined) {
        if (!dictLabel) {
            dictLabel = {}
        }
        let listViewId = this.getListViewByLabel(dictLabel)
        if (listViewId.length <= 0) {
            return []
        }
        // 按照创建时间排序
        listViewId.sort()
        let listData: { [key: string]: unknown }[] = []

        for (const strViewId of listViewId) {
            let dictLabel = this.m_dictBvView[strViewId].getAllLabel()
            let strUrl = this.m_dictBvView[strViewId].getUrl()
            let strTitle = this.m_dictBvView[strViewId].getTitle()

            let nIndex = this.m_dictBvView[strViewId].getHistoryIndex()
            listData.push({
                'id': strViewId,
                [EBvLabel.title]: strTitle,
                'label': dictLabel,
                'url': strUrl,
                'index': nIndex,
            })
        }


        return listData
    }
    getListViewByLabel(dictLabel: { [key: string]: unknown } | undefined = undefined): string[] {
        if (!dictLabel) {
            dictLabel = {}
        }
        let listViewId: string[] = []
        let listSort = Object.keys(this.m_dictBvView).sort()
        for (const strUUID of listSort) {
            let bvView = this.m_dictBvView[strUUID]
            let bChoose: boolean = true
            for (const strLabel of Object.keys(dictLabel)) {
                if (bvView.getLabel(strLabel) !== dictLabel[strLabel]) {
                    bChoose = false
                }
            }
            if (!bChoose) {
                continue
            }
            listViewId.push(strUUID)
        }
        return listViewId
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    protected resetSearch() {
        // 重置搜索结果
        let wnd = AppUtil.getExistWnd(this.m_strParentWnd)
        if (!wnd) {
            return
        }
        wnd.getBrowserWindow().webContents.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderResetSearch))
    }
    destroyAllView() {
        let listAllViewId = Object.keys(this.m_dictBvView)
        for (const strViewId of listAllViewId) {
            this.closeBv(strViewId)
        }
        if (this.m_preLoadView) {
            try {
                this.m_preLoadView.webContents.destroy()
            } catch (error) {}
        }
        this.m_preLoadView = undefined

        if (this.m_reloadView) {
            try {
                this.m_reloadView.webContents.destroy()
            } catch (error) {}
        }
        this.m_reloadView = undefined
    }
    destroyViewByLabel(dictLable: { [key: string]: unknown } | undefined = undefined) {
        if (!dictLable) {
            dictLable = {}
        }
        let listViewId = this.getListViewByLabel(dictLable)
        for (const strViewId of listViewId) {
            this.m_dictBvView[strViewId].destroy()
            delete this.m_dictBvView[strViewId]
        }
    }
    setShow(bShow: boolean) {
        for (const strViewId of Object.keys(this.m_dictBvView)) {
            this.m_dictBvView[strViewId].recordSetShow(bShow && strViewId === this.m_dictTopViewId)
        }
    }

    setFocus(bFocus: boolean) {
        for (const strViewId of Object.keys(this.m_dictBvView)) {
            this.m_dictBvView[strViewId].recordFocus(bFocus)
        }
    }
    createBv(
        strRawUrl: string,
        dictLable: { [key: string]: unknown } | undefined = undefined,
        strReason: string | undefined = undefined
    ) {
        if (!dictLable) {
            dictLable = {}
        }
        // if (strRawUrl && strRawUrl.endsWith('/') && strRawUrl.length > 1) {
        //     // 去掉最后的斜杠
        //     strRawUrl = strRawUrl.substring(0, strRawUrl.length - 1)
        // }
        let strViewUUID = new Date().getTime() + '' +  AppConfig.getTabUrlLabel(strRawUrl)
        // 添加后缀
        let strNewUrl =strRawUrl
        // 重复的也可以创建
        AppUtil.info('BvMgr', 'createBv', `创建tab【${strNewUrl}】${JSON.stringify(dictLable)}, ${strReason}`)
        let view = this.m_preLoadView
        if (!this.m_preLoadView) {
            view = this.createNewBvItemView()
        } else {
            view = this.m_preLoadView
        }

        let dictBound = this.getViewBound()

        let wndParent = AppUtil.getCreateWnd(this.m_strParentWnd) as MainWindow
        if (!wndParent) {
            AppUtil.error('BvMgr', 'createBv', `!wnd【${this.m_strParentWnd}】【${strNewUrl}】`)
            return
        }
        let posParent = wndParent.getBrowserWindow().getPosition()
        let posBv = {
            x: posParent[0] + dictBound.x,
            y: posParent[1] + dictBound.y,
        }

        view.setBounds(dictBound)

        if (!AppConfig.UseBrowserView) {
            view.setPosition(Math.floor(posBv.x), Math.floor(posBv.y))
        }

        view.webContents
            .loadURL(strNewUrl)
            .then(() => {
                view.webContents.clearHistory()
            })
            .catch(error => {
                // console.error('loadContent', error)
            })

        // 注册view加载事件
        // view.webContents.on(
        //     'did-fail-load',
        //     (
        //         event: Event,
        //         errorCode: number,
        //         errorDescription: string,
        //         validatedURL: string,
        //         isMainFrame: boolean,
        //         frameProcessId: number,
        //         frameRoutingId: number
        //     ) => {
        //         this.onPageLoadFailed(validatedURL, 'did-fail-load', {
        //             errorCode: errorCode,
        //             errorDescription: errorDescription,
        //             isMainFrame: isMainFrame,
        //             frameProcessId: frameProcessId,
        //             frameRoutingId: frameRoutingId,
        //         })
        //     }
        // )

        view.webContents.on('render-process-gone', (event: Event, details: RenderProcessGoneDetails) => {
            this.onPageLoadFailed(view.webContents?.getURL(), ErrorConfig.ERenderProcessGone, {
                reason: details.reason,
                exitCode: details.exitCode.toString(),
            })
        })

        view.webContents.on('will-navigate', (event: Event, strNewUrl: string) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            if (!mainWindow) {
                return
            }
            let strOldUrl = view.webContents.getURL()
            if (AppConfig.isIndexUrl(strOldUrl)) {
                // 跳转出去不是主页，没有带标识
                if (!AppConfig.hasIndexKey(strNewUrl)) {
                    // 新开
                    view.webContents.loadURL(strOldUrl)
                    mainWindow.handleCreateNewTab(strNewUrl)
                    return
                }
                mainWindow.filterUrlErpView(strViewUUID, strNewUrl)
            }
        })

        let newBvView = this.createNewBvItem(this.m_strParentWnd, strViewUUID, strNewUrl, view)
        this.m_dictBvView[strViewUUID] = newBvView
        this.m_dictBvView[strViewUUID].setAllLabel(dictLable)
        setTimeout(() => {
            this.setViewScale()
        }, 1000)
        AppUtil.info('BvMgr', 'createBv', `event【${strNewUrl}】`)

        this.setTopBrowserView(strViewUUID, 'createBv')

        // 创建预留 preLoadview
        this.m_preLoadView = this.createNewBvItemView()
        wndParent.syncTabData('createBv')

        let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
        if (mainWindow) {
            this.addHistory(mainWindow.getCurrentTabType(), strViewUUID, 'createBv')
        }
        return strViewUUID
    }
    private tryOpenViewId(strTab: string, strNewViewId: string): boolean {
        let useView = this.m_dictBvView[strNewViewId]

        if (strTab === undefined) {
            // 没有tab标签
            if (useView) {
                this.setTopBrowserView(strNewViewId, 'tryOpenViewId, useView')
                return true
            }
        } else {
            if (useView && useView.getLabel(EBvLabel.tab) === strTab) {
                this.setTopBrowserView(strNewViewId, 'tryOpenViewId, tab')
                return true
            }
        }
        return false
    }
    closeBv(strViewId: string) {
        let wndParent = AppUtil.getExistWnd(this.m_strParentWnd) as MainWindow
        let bvView = this.m_dictBvView[strViewId]
        if (!bvView) {
            return
        }
        let strTab = bvView.getLabel(EBvLabel.tab)
        bvView.destroy()
        delete this.m_dictBvView[strViewId]

        if (this.m_dictTopViewId === strViewId) {
            // 关闭了当前页
            AppUtil.info('BvMgr', 'closeBv', `close bvView,是当前页:${strViewId},currentTop:${this.m_dictTopViewId}`)

            let stackHis = this.m_dictHistory[wndParent.getCurrentTabType()]
            if (stackHis) {
                // 历史查找
                let listHistory = stackHis.getEasyCopyArray().reverse()
                for (const strHistory of listHistory) {
                    if (this.tryOpenViewId(strTab, strHistory)) {
                        return
                    }
                }
            }

            // 补充查找
            let listViewId = Object.keys(this.m_dictBvView)
            for (const strNewViewId of listViewId) {
                if (this.tryOpenViewId(strTab, strNewViewId)) {
                    return
                }
            }
        } else {
            // 没有关闭当前页
            AppUtil.info('BvMgr', 'closeBv', `close bvView,不是当前页:${strViewId},currentTop:${this.m_dictTopViewId}`)
            this.setTopBrowserView(this.m_dictTopViewId, '不是当前页')
        }

        wndParent.syncTabData('closeBv')
    }

    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onPageLoadFailed(strUrl: string, strReason: string, dictData: ErrorData) {
        AppUtil.error('BvMgr', 'onPageLoadFailed', `url:${strUrl}页面加载失败:${strReason}`, dictData)

        if (!AppConfig.UseBrowserView) {
            // 窗口方式弃用
            return
        }

        let wndParent = AppUtil.getExistWnd(this.m_strParentWnd)
        if (!wndParent) {
            AppUtil.error('BvMgr', 'onPageLoadFailed', '!wndParent')
            return
        }
        let dictBound = this.getViewBound()
        this.m_reloadView = this.createNewBvItemView()
        let posParent = wndParent.getBrowserWindow().getPosition()
        let posBv = {
            x: posParent[0] + dictBound.x,
            y: posParent[1] + dictBound.y,
        }

        this.m_reloadView.setBounds(dictBound)
        // 加载重刷页面
        ;(this.m_reloadView as BrowserView).webContents.loadFile('build/commonReload.html')
        for (const strViewId of Object.keys(this.m_dictBvView)) {
            wndParent.getBrowserWindow().removeBrowserView(this.m_dictBvView[strViewId].getWebView())
        }
        wndParent.getBrowserWindow().setBrowserView(this.m_reloadView)
        ;(this.m_reloadView as BrowserView).webContents.once('did-finish-load', () => {
            if (strReason === ErrorConfig.EChromeError) {
                AppUtil.createUserLog(this.m_reloadView.webContents, `${dictData.reason}`, [
                    '可尝试以下操作:',
                    '1. 重新加载当前页',
                    '2. 使用浏览器打开当前页面看是否可以访问',
                    '3. 在小助手设置中设置代理服务器',
                ])
            } else if (strReason === ErrorConfig.ERenderProcessGone) {
                AppUtil.createUserLog(
                    this.m_reloadView.webContents,
                    `渲染进程崩溃：${dictData.reason}, ${dictData.exitCode}`,
                    ['可尝试以下操作:', '1. 安装64位版本之后重新启动下单助手', '2. 联系技术支持人员']
                )
            } else {
                AppUtil.createUserLog(
                    this.m_reloadView.webContents,
                    `未知错误：${dictData.reason}, ${dictData.exitCode}`,
                    ['可尝试以下操作:', '1. 安装最新版的下单助手', '2. 联系技术支持人员']
                )
            }
        })
    }

    protected onSearchEvent(event: Event, result: Result) {
        let mainWindow = AppUtil.getExistWnd(EWnd.EMain)
        if (!mainWindow) {
            return
        }
        mainWindow
            .getBrowserWindow()
            .webContents.send(EMessage.ESendToRender, new AppMsg(EMessage.ERenderUpdateSearch, result))
    }
    protected onCheckErrorTime() {
        if (!this.m_bCheckError) {
            return
        }

        let topViewObj = this.m_dictBvView[this.m_dictTopViewId]
        if (!topViewObj) {
            return
        }

        let webView = topViewObj.getWebView()
        if (!webView) {
            return
        }
        if (!webView.webContents) {
            return
        }
        let strTopUrl = webView.webContents.getURL()
        // console.log('BvMgr', 'onCheckErrorTime', `检查当前页面加载状态: ${strTopUrl}`)
        if (strTopUrl.startsWith(AppConfig.ChromeErrorPage)) {
            this.onPageLoadFailed(strTopUrl, ErrorConfig.EChromeError, {
                reason: 'BrowserView 检测到加载了谷歌错误页',
                exitCode: '1',
            })
        }
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number) {
        this.m_nCheckTimer -= nDeltaTime
        if (this.m_nCheckTimer <= 0) {
            this.m_nCheckTimer = CheckErrorTime
            this.onCheckErrorTime()
        }
    }
    // update end ---------------------------------------------------------
}
