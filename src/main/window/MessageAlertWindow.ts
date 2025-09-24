import { WndBase } from '../../base/WndBase'
import { ipcMain, screen } from 'electron'
import { EMessage } from '../../enum/EMessage'
import { AppMsg } from '../../base/AppMsg'
import { EWnd, EWndCfg } from '../../enum/EWnd'
import { ECommon } from '../../enum/ECommon'
import { NIMMsg } from '../../mgr/NIMMgr'
import { Queue } from '../../dataStruct/Queue'
import { AppUtil } from '../../utils/AppUtil'
import AppContainer from '../../base/AppContainer'
import { MainWindow } from './MainWindow'

// 6s
const MsgShowTime = 60 * 60 * 24 * 1000

export class MsgAlertCfg {
    static MoveSpeed = 1000

    static OnlyMsgHeight = 130
    // (130 / 234) * 730
    static OnlyMsgWidth = 405

    static HtmlHeight = 450
    // (380 / 316) * 312
    static HtmlWidth = 375

    static PosXOffset = 5
    static PosYOffset = 5
}

export class MessageAlertWindow extends WndBase {
    static configMsg() {
        ipcMain.on(EMessage.EMainMsgAlertClickClose, event => {
            let messageAlertWindow = AppUtil.getCreateWnd(EWnd.EMessageAlert) as MessageAlertWindow
            messageAlertWindow.onShowNextMsg()
        })
        ipcMain.on(EMessage.EMainMsgAlertClickContent, (event, strMsgUUID) => {
            let nimMsg = AppContainer.getApp().getNIMMgr().getNIMMsgByUUID(strMsgUUID)
            if (!nimMsg) {
                AppUtil.error('MessageAlertWindow', EMessage.EMainMsgAlertClickContent, `找不到消息： ${strMsgUUID}`)
                return
            }
            let strUrl = nimMsg.getUrl()
            if (ECommon.isNone(strUrl)) {
                // 纯文本消息
                nimMsg.onClickContent()
            } else {
                // 带链接的推送消息，在主窗口中打开新标签页
                AppUtil.info('MessageAlertWindow', 'EMainMsgAlertClickContent', '点击推送消息，在主窗口中打开新标签页: ' + strUrl)
                nimMsg.onClickUrl()
            }

            // 当前跳转到下一条
            let messageAlertWindow = AppUtil.getCreateWnd(EWnd.EMessageAlert) as MessageAlertWindow
            messageAlertWindow.onShowNextMsg()
        })
        ipcMain.on(EMessage.EMainMsgAlertClickAd, (event, strMsgUUID) => {
            let nimMsg = AppContainer.getApp().getNIMMgr().getNIMMsgByUUID(strMsgUUID)
            if (!nimMsg) {
                AppUtil.error('MessageAlertWindow', EMessage.EMainMsgAlertClickAd, `找不到消息： ${strMsgUUID}`)
                return
            }
            let strUrl = nimMsg.getUrl()
            if (ECommon.isNone(strUrl)) {
                // 纯文本广告
                nimMsg.onClickAd()
            } else {
                // 带链接的推送广告，在主窗口中打开新标签页
                AppUtil.info('MessageAlertWindow', 'EMainMsgAlertClickAd', '点击推送广告，在主窗口中打开新标签页: ' + strUrl)
                nimMsg.onClickUrl()
            }

            let messageAlertWindow = AppUtil.getCreateWnd(EWnd.EMessageAlert) as MessageAlertWindow
            messageAlertWindow.onShowNextMsg()
        })
        ipcMain.on(EMessage.EMainMsgAlertIgnoreAll, event => {
            AppContainer.getApp().getNIMMgr().ignoreAll()
        })
    }

    private m_nEndX = 0
    private m_nStartX = 0

    private m_nWidth = MsgAlertCfg.HtmlWidth
    private m_nHeight = MsgAlertCfg.HtmlHeight

    private m_strMsgUUID: string = ECommon.ENone
    private m_strMsg: string = ECommon.ENone
    private m_strHtml: string = ECommon.ENone
    private m_strUrl: string = ECommon.ENone
    private m_strTitle: string = ECommon.ENone
    private m_listCode: string[] = []
    private m_queueShowMsg: Queue<NIMMsg>

    private m_nShowTimer: number = 0
    private m_bNeedCheckTime: boolean = true
    private m_bFinishLoad: boolean = false

    private m_strCurrentShowUUID = ECommon.ENone
    // life start ---------------------------------------------------------
    init() {
        this.m_queueShowMsg = new Queue(100)
    }
    onShow(bShow: boolean) {
        if (this.m_browserWindow) {
            if (bShow) {
                // this.m_browserWindow?.webContents?.openDevTools({ mode: 'undocked' })
            } else {
                let mainDisplay = screen.getPrimaryDisplay()
                let nScreenHeight = mainDisplay.workArea.height
                this.m_browserWindow.setBounds({
                    x: this.m_nEndX,
                    y: nScreenHeight - this.m_nHeight - MsgAlertCfg.PosYOffset,
                    width: this.m_nWidth,
                    height: this.m_nHeight,
                })
            }
        }
    }
    showNIMMsg(msg: NIMMsg, nTime: number = MsgShowTime) {
        for (const currentmsg of this.m_queueShowMsg.getArray()) {
            if (currentmsg.getUUID() === msg.getUUID()) {
                return
            }
        }
        msg.setShowTime(nTime)

        this.m_queueShowMsg.enqueue(msg)
        AppUtil.info(
            'MessageAlertWindw',
            'showNIMMsg',
            `显示NIM消息:${msg.getContent()},消息数量:${this.m_queueShowMsg.getCount()}`
        )
        if (!this.isShow()) {
            this.showPanel(true)
            if (this.m_strCurrentShowUUID === ECommon.ENone) {
                this.onShowNextMsg()
            }
        }
    }
    private showMsgByTileContent(
        strUUID: string,
        strTitle: string,
        strMsg: string,
        strHtml: string | undefined = undefined,
        strUrl: string | undefined = undefined,
        nTimer: number = MsgShowTime,
        listCode: string[] | undefined = undefined
    ) {
        this.m_strMsgUUID = strUUID
        this.m_strTitle = strTitle
        this.m_strMsg = strMsg
        this.m_strHtml = strHtml
        this.m_strUrl = strUrl
        if (!listCode) {
            listCode = []
        }
        this.m_listCode = listCode
        // 显示消息内容
        this.m_nShowTimer = nTimer
        this.m_bNeedCheckTime = true

        this.backToStart()
    }
    private backToStart() {
        if (!this.m_browserWindow) {
            return
        }
        let mainDisplay = screen.getPrimaryDisplay()
        let nScreenWidth = mainDisplay.workArea.width
        let nScreenHeight = mainDisplay.workArea.height

        if (this.m_strHtml !== undefined && this.m_strHtml !== '') {
            this.m_nWidth = MsgAlertCfg.HtmlWidth
            this.m_nHeight = MsgAlertCfg.HtmlHeight
        } else {
            this.m_nWidth = MsgAlertCfg.OnlyMsgWidth
            this.m_nHeight = MsgAlertCfg.OnlyMsgHeight
        }
        // 返回开始状态
        if (this.m_bFinishLoad) {
            this.m_browserWindow.webContents.send(
                EMessage.ESendToRender,
                new AppMsg(EMessage.ERenderMessageAlertContent, {
                    'uuid': this.m_strMsgUUID,
                    'title': this.m_strTitle,
                    'msg': this.m_strMsg,
                    'html': this.m_strHtml,
                    'url': this.m_strUrl,
                    'script': this.m_listCode,
                })
            )
        } else {
            this.m_browserWindow.webContents.once('did-finish-load', () => {
                if (this.m_bFinishLoad) {
                    return
                }
                this.m_bFinishLoad = true
                this.m_browserWindow.webContents.send(
                    EMessage.ESendToRender,
                    new AppMsg(EMessage.ERenderMessageAlertContent, {
                        'uuid': this.m_strMsgUUID,
                        'title': this.m_strTitle,
                        'msg': this.m_strMsg,
                        'html': this.m_strHtml,
                        'url': this.m_strUrl,
                        'script': this.m_listCode,
                    })
                )
            })
        }

        this.m_nStartX = nScreenWidth
        this.m_nEndX = nScreenWidth - this.m_nWidth - MsgAlertCfg.PosXOffset
        this.m_browserWindow.setBounds({
            x: this.m_nStartX,
            y: nScreenHeight - this.m_nHeight - MsgAlertCfg.PosYOffset,
            width: this.m_nWidth,
            height: this.m_nHeight,
        })
    }
    protected onSetBrowserWindow(): void {
        if (!this.m_browserWindow) {
            return
        }
        this.m_browserWindow.webContents.on('will-navigate', (event: Event, strUrl: string) => {
            let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
            mainWindow.openUrlFromOther(strUrl)
            event.preventDefault()
        })
        this.m_bFinishLoad = false
        this.backToStart()
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
    ignoreAll() {
        this.m_strCurrentShowUUID = ECommon.ENone
        this.m_queueShowMsg.clear()
        if (this.isShow()) {
            this.showPanel(false)
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onShowNextMsg() {
        let nCount = this.m_queueShowMsg.getCount()
        if (nCount <= 0) {
            // console.log('没有信息关闭窗口')
            this.m_strCurrentShowUUID = ECommon.ENone
            if (this.isShow()) {
                this.showPanel(false)
            }
            return
        }
        let tryGetMsg: NIMMsg | undefined = undefined
        for (let nIndex = 0; nIndex < nCount; nIndex++) {
            tryGetMsg = this.m_queueShowMsg.dequeue() as NIMMsg
            // console.log('取出消息', tryGetMsg.getUUID())
            if (tryGetMsg !== undefined) {
                break
            }
        }
        if (!tryGetMsg) {
            // 找不到可以显示的消息
            return
        }
        this.m_strCurrentShowUUID = tryGetMsg.getUUID()
        let strContent = tryGetMsg.getContent()
        let strHtml = tryGetMsg.getHtml()
        let strUrl = tryGetMsg.getUrl()
        let listCode = tryGetMsg.getCodeList()
        // 显示下一条消息
        if (strContent !== undefined || strHtml !== undefined) {
            this.showMsgByTileContent(
                tryGetMsg.getUUID(),
                tryGetMsg.getTitle(),
                strContent,
                strHtml,
                strUrl,
                tryGetMsg.getShowTime(),
                listCode
            )
        } else {
            this.onShowNextMsg()
        }
    }

    private onReachShowTime() {
        // 超过时间显示下一条
        this.onShowNextMsg()
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    update(nDeltaTime: number): void {
        super.update(nDeltaTime)
        if (this.m_bNeedCheckTime) {
            this.m_nShowTimer -= nDeltaTime

            if (this.m_nShowTimer <= 0) {
                this.m_bNeedCheckTime = false
                this.onReachShowTime()
            }
        }

        if (!this.m_browserWindow) {
            return
        }

        let dictBound = this.m_browserWindow.getBounds()
        if (dictBound.x >= this.m_nEndX) {
            let nDeltaMove = (nDeltaTime / 1000) * MsgAlertCfg.MoveSpeed
            let nPosX = Math.max(this.m_nEndX, dictBound.x - nDeltaMove)
            dictBound.x = nPosX
            let mainDisplay = screen.getPrimaryDisplay()
            let nScreenHeight = mainDisplay.workArea.height

            this.m_browserWindow.setBounds({
                x: nPosX,
                y: nScreenHeight - this.m_nHeight - MsgAlertCfg.PosYOffset,
                width: this.m_nWidth,
                height: this.m_nHeight,
            })
        }
    }
    // update end ---------------------------------------------------------
}
