import { resolve } from 'path'
import { AssistApp } from '../app/AssistApp'
import AppContainer from '../base/AppContainer'
import { AppConfig } from '../config/AppConfig'
import { ECommon } from '../enum/ECommon'
import { EBusinessMsgContent, EBusinessMsgType, EMsgMgrType } from '../enum/EIMMsg'
import { EWnd } from '../enum/EWnd'
import { MainWindow } from '../main/window/MainWindow'
import { MessageAlertWindow } from '../main/window/MessageAlertWindow'
import { MessageMgrWindow } from '../main/window/MessageMgrWindow'
import { AppUtil } from '../utils/AppUtil'

interface loginOption {
    accid: string
    token: string
    NIMConfig?: any
}

export class ENIMMsgState {
    static EUnread = 0
    static ERead = 1 << 1
}

export class ENIMMsg {
    static getMsgField(msg) {
        let listMsgFieldCheck = ['content', 'body', 'text']
        for (const strCheck of listMsgFieldCheck) {
            if (msg[strCheck] !== undefined) {
                return strCheck
            }
        }
        return undefined
    }
}

export class NIMMsg {
    private m_strNIMMsgId: string = ECommon.ENone
    private m_nShowTime: number = 5
    private m_rawData: any
    private m_nState = ENIMMsgState.EUnread

    private m_strTitle: string | undefined = undefined
    private m_strContent: string | undefined = undefined
    private m_strHtml: string | undefined = undefined
    private m_strUrl: string | undefined = undefined
    private m_listCode: string[] = []

    // life start ---------------------------------------------------------
    private constructor(rawMsg) {
        this.m_rawData = rawMsg

        if (rawMsg['time']) {
            this.m_strNIMMsgId = rawMsg['time'].toString()
        }
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    setTitle(strTitle: string) {
        this.m_strTitle = strTitle
    }
    setContent(strContent: string | undefined) {
        this.m_strContent = strContent
    }
    setHtml(strHtml: string | undefined) {
        this.m_strHtml = strHtml
    }
    setUrl(strUrl: string | undefined) {
        this.m_strUrl = strUrl
    }
    getUrl() {
        return this.m_strUrl
    }
    getCodeList() {
        return this.m_listCode
    }
    setCodeList(listCode: string[]) {
        this.m_listCode = listCode
    }
    setState(nState: number) {
        this.m_nState = nState
    }
    isUnRead() {
        return !this.hasFlag(ENIMMsgState.ERead)
    }
    isRead() {
        return this.hasFlag(ENIMMsgState.ERead)
    }
    getRawMsg() {
        return this.m_rawData
    }
    getUUID() {
        return this.m_strNIMMsgId
    }
    getRawValue(strValue: string) {
        if (!this.m_rawData) {
            return ECommon.ENone
        }
        if (!this.m_rawData[strValue]) {
            return ECommon.ENone
        }
        return this.m_rawData[strValue]
    }
    getState() {
        return this.m_nState
    }
    addFlag(nState: number, bSave: boolean = true) {
        this.m_nState |= nState
        if (bSave) {
            let assistApp = AppContainer.getApp() as AssistApp
            assistApp.getDBMgr().saveMsg(this)
            AppUtil.info('NIMMgr', 'addFlag', `消息增加标志位:${this.getUUID()}, ${nState}`)
        }
    }
    removeFlag(nState: number, bSave: boolean = true) {
        this.m_nState |= nState
        if (bSave) {
            let assistApp = AppContainer.getApp() as AssistApp
            assistApp.getDBMgr().saveMsg(this)
            AppUtil.info('NIMMgr', 'addFlag', `消息去除标志位:${this.getUUID()}, ${nState}`)
        }
    }
    private hasFlag(nState: number) {
        return (this.m_nState & nState) > 0
    }

    static handleFailRead(msg, strReason, strMsgTextName) {
        // 处理失败的消息不存数据库
        AppUtil.error(
            'NIMMsg',
            'handleFailRead',
            `消息处理失败：${strReason}, msg消息内容字段【${strMsgTextName}】:${msg[strMsgTextName]}`,
            msg
        )

        let strUUID = msg['time'].toString()
        AppUtil.info('NIMMgr', 'handleFailRead', '消息处理失败，NIM功能已移除:' + strUUID)
    }

    private static tryGetElementInfo(msg, strInfo, strMsgTextName): string | undefined {
        let strRawText = msg[strMsgTextName] as string
        let strStartFind = `<${strInfo}>`
        let strEndFind = `</${strInfo}>`
        let nStartContent = strRawText.search(strStartFind)
        let nEndContent = strRawText.search(strEndFind)
        let strData = undefined
        if (nStartContent !== undefined && nEndContent !== undefined && nEndContent > nStartContent) {
            strData = strRawText.slice(nStartContent + strStartFind.length, nEndContent)
            return strData
        }
        return
    }
    
    private static tryGetElementInfoList(msg, strInfo, strMsgTextName): string[] {
        let strRawText = msg[strMsgTextName] as string
        let patternStart = new RegExp(`<${strInfo}`, 'g')
        let listStartMatch = strRawText.matchAll(patternStart)
        let listStartIndex: number[] = []
        let patternEnd = new RegExp(`</${strInfo}>`, 'g')
        let listEndMatch = strRawText.matchAll(patternEnd)
        let listEndIndex: number[] = []
        console.log(listStartMatch, listEndMatch)
        for (const match of listStartMatch) {
            listStartIndex.push(match.index)
        }
        for (const match of listEndMatch) {
            listEndIndex.push(match.index)
        }
        console.log(listStartIndex, listEndIndex)

        if (listStartIndex.length !== listEndIndex.length) {
            AppUtil.warn('NIMMgr', 'tryGetElementInfoList', '首尾不匹配')
            return []
        }

        let listData: string[] = []
        for (let nIndex = 0; nIndex < listStartIndex.length; nIndex++) {
            let nStartIndex = listStartIndex[nIndex]
            let nEndIndex = listEndIndex[nIndex]
            listData.push(strRawText.slice(nStartIndex, nEndIndex + `</${strInfo}>`.length))
        }
        return listData
    }
    
    static fromRawMsg(msg, bUnread, strMsgField): Promise<NIMMsg | undefined> {
        return new Promise((reslove, reject) => {
            let funhandleFail = strReason => {
                if (bUnread) {
                    this.handleFailRead(msg, strReason, strMsgField)
                    return
                }
                reslove(undefined)
            }
            try {
                let strHtml = undefined
                let strTitle = undefined
                let nExpireTime = undefined
                strHtml = NIMMsg.tryGetElementInfo(msg, EBusinessMsgContent.EHtmlContent, strMsgField)
                let strExpireTime = NIMMsg.tryGetElementInfo(msg, EBusinessMsgContent.EExpireTime, strMsgField)
                let bExpireWeek = true
                if (!ECommon.isNone(strExpireTime)) {
                    try {
                        nExpireTime = parseFloat(strExpireTime)
                        if (nExpireTime <= 1641017518000) {
                            if (nExpireTime >= 21017518) {
                                AppUtil.warn(
                                    'NIMMgr',
                                    'fromRawMsg',
                                    `消息可能填成了秒：${strExpireTime}=>${nExpireTime}`
                                )
                                nExpireTime = nExpireTime * 1000
                                bExpireWeek = false
                            } else {
                                bExpireWeek = true
                            }
                        } else {
                            bExpireWeek = false
                        }
                    } catch (error) {
                        bExpireWeek = true
                    }
                }
                if (!nExpireTime) {
                    bExpireWeek = true
                }
                if (bExpireWeek) {
                    try {
                        nExpireTime = parseFloat(msg['time']) + 7 * 3600 * 24 * 1000
                    } catch (error) {}
                }
                AppUtil.info(
                    'NIMMgr',
                    'fromRawMsg',
                    `是否默认一周：${bExpireWeek}，当前时间${new Date().getTime()}，过期时间${nExpireTime}，超过：${
                        new Date().getTime() > nExpireTime
                    }`
                )
                if (!ECommon.isNone(nExpireTime) && new Date().getTime() > nExpireTime) {
                    AppUtil.warn('NIMMgr', 'fromRawMsg', `消息超过了过期时间：${strExpireTime}=>${nExpireTime}`)
                    NIMMsg.handleFailRead(msg, '消息超过了过期时间：', strMsgField)
                    return
                }
                let listCode = NIMMsg.tryGetElementInfoList(msg, 'code', strMsgField)
                console.log('debug', listCode)

                if (strHtml !== undefined) {
                    let strMessageType = NIMMsg.tryGetElementInfo(msg, EBusinessMsgContent.EMessageNewType, strMsgField)
                    strTitle = EBusinessMsgType.getTitleName(strMessageType)

                    let creatNIMMsg = new NIMMsg(msg)
                    creatNIMMsg.setTitle('嘉立创下单助手消息')
                    creatNIMMsg.setContent(undefined)
                    creatNIMMsg.setHtml(strHtml)
                    creatNIMMsg.setCodeList(listCode)
                    reslove(creatNIMMsg)
                } else {
                    let strNews = NIMMsg.tryGetElementInfo(msg, 'news', strMsgField)
                    let strMessageType = NIMMsg.tryGetElementInfo(msg, EBusinessMsgContent.EMessageNewType, strMsgField)
                    strTitle = EBusinessMsgType.getTitleName(strMessageType)

                    let strContent = undefined
                    let strUrl = undefined

                    let strContentElement = EBusinessMsgType.getContentElementByType(strMessageType)
                    if (strNews) {
                        strContent = NIMMsg.tryGetElementInfo(msg, 'title', strMsgField)
                    } else {
                        if (ECommon.isNone(strContentElement)) {
                            strContent = undefined
                        } else {
                            strContent = NIMMsg.tryGetElementInfo(msg, strContentElement, strMsgField)
                        }
                    }
                    strUrl = NIMMsg.tryGetElementInfo(msg, 'url', strMsgField)
                    let createNIMMsg = new NIMMsg(msg)
                    createNIMMsg.setTitle(strTitle)
                    createNIMMsg.setContent(strContent)
                    createNIMMsg.setHtml(undefined)
                    createNIMMsg.setUrl(strUrl)
                    createNIMMsg.setCodeList(listCode)
                    reslove(createNIMMsg)
                }
            } catch (error) {
                funhandleFail(error)
                reslove(undefined)
            }
        })
    }
    
    setShowTime(nShowTime: number) {
        this.m_nShowTime = nShowTime
    }
    getShowTime() {
        return this.m_nShowTime
    }
    getTitle(): string | undefined {
        return this.m_strTitle
    }
    getContent(): string | undefined {
        return this.m_strContent
    }
    getHtml(): string | undefined {
        return this.m_strHtml
    }
    getTime() {
        let nTime = this.getRawValue('time')
        try {
            nTime = parseFloat(nTime)
        } catch (error) {}
        return nTime
    }
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    onClickContent() {
        // 标记已读
        AppContainer.getApp().getNIMMgr().markMsgReadByUUID(this.getUUID())
        // 点击了文字内容，打开消息管理器
        let msgMgr = AppUtil.getCreateWnd(EWnd.EMsessageMgr) as MessageMgrWindow
        msgMgr.enterTabTypeMsgID(EMsgMgrType.EAll, this.getUUID())
    }
    onClickAd() {
        // 点击了广告
        AppContainer.getApp().getNIMMgr().markMsgReadByUUID(this.getUUID())
        let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
        if (mainWindow) {
            mainWindow.showPanel(true)
            mainWindow.getBrowserWindow().moveTop()
        }
    }
    onClickUrl() {
        AppContainer.getApp().getNIMMgr().markMsgReadByUUID(this.getUUID())
        if (ECommon.isNone(this.m_strUrl)) {
            return
        }

        AppUtil.info('NIMMsg', 'onClickUrl', '点击推送消息，URL: ' + this.m_strUrl)
        let mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
        if (!mainWindow) {
            AppUtil.error('NIMMsg', 'onClickUrl', '主窗口不存在，无法打开链接')
            return
        }

        // 显示主窗口并置顶
        mainWindow.showPanel(true)
        mainWindow.getBrowserWindow().moveTop()
        
        // 使用TabManager在主窗口中创建新标签页
        AppUtil.info('NIMMsg', 'onClickUrl', '通过推送消息在主窗口中创建新标签页: ' + this.m_strUrl)
        
        // 检查主窗口是否有TabManager集成
        if (mainWindow.getTabManager && typeof mainWindow.getTabManager === 'function') {
            const tabManager = mainWindow.getTabManager()
            if (tabManager) {
                // 使用TabManager创建新标签页
                tabManager.createTab(this.m_strUrl, {
                    fromWindowOpen: false,
                    position: 'last',
                    labels: { 
                        source: 'push-notification',
                        messageId: this.getUUID(),
                        title: this.getTitle() || '推送消息',
                        originalUrl: this.m_strUrl
                    }
                })
                return
            }
        }
        
        // 回退到原有方法
        mainWindow.handleCreateNewTab(this.m_strUrl, true)
    }
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}

export class NIMMgr {
    private m_dictNIMMsgCache: { [key: string]: NIMMsg } = {}

    // life start ---------------------------------------------------------
    init() {
        AppUtil.info('NIMMgr', 'init', '消息管理器已初始化（NIM功能已移除）')
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    getUnreadMsgList() {
        let listMsg: string[] = []
        let listAllMsgId = Object.keys(this.m_dictNIMMsgCache)
        listAllMsgId = listAllMsgId.sort().reverse()
        for (const strId of listAllMsgId) {
            let nimMsg = this.m_dictNIMMsgCache[strId]
            if (nimMsg.isUnRead() && nimMsg.getHtml() === undefined) {
                listMsg.push(strId)
            }
        }
        return listMsg
    }
    getAllMsgList() {
        let listMsg: string[] = []
        let listAllMsgId = Object.keys(this.m_dictNIMMsgCache)
        listAllMsgId = listAllMsgId.sort().reverse()
        for (const strId of listAllMsgId) {
            let nimMsg = this.m_dictNIMMsgCache[strId]
            if (nimMsg.getHtml() !== undefined) {
                continue
            }
            listMsg.push(strId)
        }
        return listMsg
    }
    getNIMMsgByUUID(strMsgUUID: string): NIMMsg {
        return this.m_dictNIMMsgCache[strMsgUUID]
    }
    getNIMMgrObj() {
        // NIM 功能已移除，返回 null
        return null
    }

    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------

    public async loginImServer(dictOption: loginOption): Promise<any> {
        return new Promise((resolve, reject) => {
            AppUtil.info('NIMMgr', 'loginImServer', 'NIM 登录功能已移除')
            resolve(null)
        })
    }

    public connect(): void {
        AppUtil.info('NIMMgr', 'connect', 'NIM 连接功能已移除')
    }
    
    public logoutImServer(): void {
        AppUtil.info('NIMMgr', 'logoutImServer', 'NIM 登出功能已移除')
    }
    
    public pushCustomSysMsg(listCustomMsg) {
        AppUtil.info('NIMMgr', 'pushCustomSysMsg', 'NIM 自定义消息功能已移除')
    }

    pullHistoryMsgFromDB() {
        let assistApp = AppContainer.getApp() as AssistApp
        assistApp
            .getDBMgr()
            .pullMsg({
                startTime: new Date().getTime() - 7 * 3600 * 24 * 1000,
                limit: 100,
            })
            .then((listMsg: any[]) => {
                AppUtil.info('NIMMgr', 'pullHistoryMsgFromDB', `数据库消息数量: ${listMsg.length}`)
                for (const dictMsg of listMsg) {
                    let strMsgId = dictMsg['time'].toString()
                    if (strMsgId in this.m_dictNIMMsgCache) {
                        continue
                    }
                    let nState = dictMsg['state'] as number
                    let dictRawMsg = JSON.parse(dictMsg['rawMsg'] as string)
                    let strMsgField = ENIMMsg.getMsgField(dictRawMsg)
                    if (!strMsgField) {
                        continue
                    }
                    NIMMsg.fromRawMsg(dictRawMsg, false, strMsgField).then(nimMsg => {
                        if (nimMsg) {
                            nimMsg.setState(nState)
                            this.m_dictNIMMsgCache[strMsgId] = nimMsg
                        }
                    })
                }
            })
    }

    markMsgReadByUUID(strUUID: string) {
        let nimMsg = this.getNIMMsgByUUID(strUUID)
        if (!nimMsg) {
            return
        }
        // 标记为已读（不再调用 NIM 接口）
        AppUtil.info('NIMMgr', 'markMsgReadByUUID', '标记消息已读:' + strUUID)
        nimMsg.addFlag(ENIMMsgState.ERead)
        this.refreshMsgMgrWnd()
    }
    
    ignoreAll() {
        let messageAlertWindow = AppUtil.getCreateWnd(EWnd.EMessageAlert) as MessageAlertWindow
        messageAlertWindow.ignoreAll()

        let app = AppContainer.getApp() as AssistApp
        if (app.getDBMgr().isInit()) {
            // 初始化成功
            for (const strMsgId of Object.keys(this.m_dictNIMMsgCache)) {
                let nimMsg = this.m_dictNIMMsgCache[strMsgId]
                nimMsg.addFlag(ENIMMsgState.ERead)
            }
        } else {
            for (const strMsgId of Object.keys(this.m_dictNIMMsgCache)) {
                this.markMsgReadByUUID(strMsgId)
            }
        }
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    private refreshMsgMgrWnd() {
        let messageMgrWindow = AppUtil.getExistWnd(EWnd.EMsessageMgr) as MessageMgrWindow
        if (messageMgrWindow) {
            // 刷新消息列表 - 重新进入当前标签页
            messageMgrWindow.enterTabTypeMsgID()
        }
    }

    showMsgAlert(nimMsg: NIMMsg) {
        let messageAlertWindow = AppUtil.getCreateWnd(EWnd.EMessageAlert) as MessageAlertWindow
        messageAlertWindow.showNIMMsg(nimMsg)
    }
    // callback end ---------------------------------------------------------
}