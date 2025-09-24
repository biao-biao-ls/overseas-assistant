import { ipcMain, shell } from 'electron'
import AppContainer from '../../base/AppContainer'
import { AppMsg } from '../../base/AppMsg'
import { WndBase } from '../../base/WndBase'
import { ECommon } from '../../enum/ECommon'
import { EMsgMgrType } from '../../enum/EIMMsg'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppUtil } from '../../utils/AppUtil'
import { MainWindow } from './MainWindow'

export class MessageMgrWindow extends WndBase {
    static configMsg() {
        ipcMain.on(EMessage.EMainMsgMgrTab, (event, strTab) => {
            let messageMgrWindow = AppUtil.getCreateWnd(EWnd.EMsessageMgr) as MessageMgrWindow
            messageMgrWindow.enterTabTypeMsgID(strTab)
        })
        ipcMain.on(EMessage.EMainMsgMgrRead, (event, strUUID) => {
            AppContainer.getApp().getNIMMgr().markMsgReadByUUID(strUUID)
        })
        ipcMain.on(EMessage.EMainMsgMgrClickContent, (event, strMsgUUID) => {
            let nimMsg = AppContainer.getApp().getNIMMgr().getNIMMsgByUUID(strMsgUUID)
            if (!nimMsg) {
                AppUtil.error('MessageMgrWindow', EMessage.EMainMsgMgrClickContent, `找不到消息： ${strMsgUUID}`)
                return
            }

            // 检查是否有URL链接
            let strUrl = nimMsg.getUrl()
            if (ECommon.isNone(strUrl)) {
                AppUtil.info('MessageMgrWindow', 'EMainMsgMgrClickContent', '消息没有链接，无需处理')
                return
            } 
            
            // 在主窗口中打开新标签页
            AppUtil.info('MessageMgrWindow', 'EMainMsgMgrClickContent', '从消息管理器点击消息，在主窗口中打开新标签页: ' + strUrl)
            nimMsg.onClickUrl()
        })
    }
    private m_strWillSwitchTab: string = ECommon.ENone
    private m_strEnterFocusMsgUUID: string = ECommon.ENone

    private m_strCurrentTab: string = EMsgMgrType.EAll

    private m_bFinishLoad: boolean = false
    // life start ---------------------------------------------------------
    init() {}
    onShow(bShow: boolean) {
        if (bShow) {
            // this.m_browserWindow.webContents.openDevTools({ mode: 'undocked' })
            AppContainer.getApp().getNIMMgr().pullHistoryMsgFromDB()
        }
    }
    onRefresh() {}
    onDestroy() {}

    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    enterTabTypeMsgID(strTab: string = ECommon.ENone, strMsgUUID: string = ECommon.ENone) {
        this.m_strWillSwitchTab = strTab
        this.m_strEnterFocusMsgUUID = strMsgUUID
        this.showPanel()
        if (this.m_bFinishLoad) {
            this.doEnterTab()
        }
    }
    protected onSetBrowserWindow(): void {
        if (!this.m_browserWindow) {
            return
        }
        this.m_browserWindow.webContents.on('did-finish-load', () => {
            this.m_bFinishLoad = true
            this.doEnterTab()
        })
        this.m_browserWindow.webContents.on('will-navigate', (event: Event, url: string) => {
            shell.openExternal(url)
            event.preventDefault()
        })
    }
    private doEnterTab() {
        if (this.m_strWillSwitchTab !== ECommon.ENone) {
            this.m_strCurrentTab = this.m_strWillSwitchTab
        }
        // 切换到tab页面，查询消息
        if (this.m_strCurrentTab === EMsgMgrType.EAll) {
            let listAllMsgId = AppContainer.getApp().getNIMMgr().getAllMsgList()
            this.syncMsgDataToRender(listAllMsgId)
            AppUtil.info('MessageMgrWindow', '进入全部消息', '全部消息总数：' + listAllMsgId.length)
        } else if (this.m_strCurrentTab === EMsgMgrType.EUnread) {
            let listUnreadMsgId = AppContainer.getApp().getNIMMgr().getUnreadMsgList()
            this.syncMsgDataToRender(listUnreadMsgId)

            AppUtil.info('MessageMgrWindow', '进入未读消息', '未读消息总数：' + listUnreadMsgId.length)
        }

        if (this.m_strEnterFocusMsgUUID !== ECommon.ENone) {
            // 设置为已读
            AppContainer.getApp().getNIMMgr().markMsgReadByUUID(this.m_strEnterFocusMsgUUID)
        }
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    syncMsgDataToRender(listMsg: string[]) {
        let listMsgShow: { [key: string]: unknown }[] = []
        for (const strMsgId of listMsg) {
            let nimMsg = AppContainer.getApp().getNIMMgr().getNIMMsgByUUID(strMsgId)
            if (!nimMsg) {
                continue
            }
            if (nimMsg.getHtml() !== undefined) {
                continue
            }
            let dictMsg = {
                'uuid': nimMsg.getUUID(),
                'unRead': nimMsg.isUnRead(),
                'title': nimMsg.getTitle(),
                'content': nimMsg.getContent(),
                'html': nimMsg.getHtml(),
                'time': nimMsg.getTime(),
                'url': nimMsg.getUrl(),
            }
            listMsgShow.push(dictMsg)
        }
        if (this.m_browserWindow) {
            this.m_browserWindow.webContents.send(
                EMessage.ESendToRender,
                new AppMsg(EMessage.ERenderUpdateMsg, {
                    'tab': this.m_strCurrentTab,
                    'msgFocus': this.m_strEnterFocusMsgUUID,
                    'msg': listMsgShow,
                    'msgNum': {
                        [EMsgMgrType.EAll]: AppContainer.getApp().getNIMMgr().getAllMsgList().length,
                        [EMsgMgrType.EUnread]: AppContainer.getApp().getNIMMgr().getUnreadMsgList().length,
                    },
                })
            )
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
