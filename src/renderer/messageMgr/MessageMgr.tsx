import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import icon from '../../../assets/jlcAssistant512.png'
import { EWnd } from '../../enum/EWnd'
import { NavButton } from '../components/navButton'

import './MessageMgr.css'
import '../style.css'
import { EMessage } from '../../enum/EMessage'
import { AppMsg } from '../../base/AppMsg'
import { ECommon } from '../../enum/ECommon'
import { SvgButton } from '../components/svgButton/svgButton'
import { EMsgMgrType } from '../../enum/EIMMsg'
import { NormalButton } from '../components/normalButton/NormalButton'

const { ipcRenderer } = (window as any)['electron'] as any

const MessageMgr = (): JSX.Element => {
    const [strCurTab, setCurTab] = useState(EMsgMgrType.EAll)
    const [listShowTab, setShowTab] = useState(EMsgMgrType.listTab)
    const [listShowMsg, setShowMsg] = useState([])
    const [dictMsgNum, setDictMsgNum] = useState({})
    const [strCurrentFocusMsg, setFocus] = useState(ECommon.ENone)
    const refScroller = useRef(null)

    function handleMini() {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.EMsessageMgr)
    }
    function handleClose(evt: any) {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EMsessageMgr)
    }
    const onSelectMsgType = (strType: string) => {
        ipcRenderer.send(EMessage.EMainMsgMgrTab, strType)
    }
    const onClickRead = (strUUID: string) => {
        ipcRenderer.send(EMessage.EMainMsgMgrRead, strUUID)
    }
    const onClickContent = (strUUID: string) => {
        ipcRenderer.send(EMessage.EMainMsgMgrClickContent, strUUID)
    }
    const dateFormat = (date, fmt) => {
        date = new Date(date)
        var a = ['日', '一', '二', '三', '四', '五', '六']
        var o = {
            'M+': date.getMonth() + 1, // 月份
            'd+': date.getDate(), // 日
            'h+': date.getHours(), // 小时
            'm+': date.getMinutes(), // 分
            's+': date.getSeconds(), // 秒
            'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
            'S': date.getMilliseconds(), // 毫秒
            'w': date.getDay(), // 周
            'W': a[date.getDay()], // 大写周
            'T': 'T',
        }
        if (/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
        }
        for (var k in o) {
            if (new RegExp('(' + k + ')').test(fmt)) {
                fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
            }
        }
        return fmt
    }

    const formateDate = (nTime: number) => {
        return dateFormat(new Date(nTime), 'yyyy-MM-dd hh:mm:ss')
    }

    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderUpdateMsg) {
                // 更新消息
                let strTab = msg.data['tab'] as string
                setCurTab(strTab)
                let listShowMsg = msg.data['msg'] as { [key: string]: unknown }[]
                setShowMsg(listShowMsg)

                let dictMsgNum = msg.data['msgNum'] as { [key: string]: unknown }
                setDictMsgNum(dictMsgNum)

                let strCurrentMsg = msg.data['msgFocus'] as string

                if (strCurrentMsg !== ECommon.ENone) {
                    setFocus(strCurrentMsg)

                    setTimeout(() => {
                        setFocus(ECommon.ENone)
                    }, 2000)

                    // 移动到最顶端

                    window.scrollTo(0, 0)
                }
            }
        })
    }, [])
    return (
        <div className="win_container">
            <div id="msg_mgr_container">
                <div id="msg_mgr_nav_bar">
                    <div className="nav-title">
                        <img src={icon} alt="嘉立创小助手icon" className="nav-bar-icon" />
                        <span>消息管理器</span>
                    </div>
                    <div id="msg_mgr_interface">
                        <NavButton type="minimize" onClick={handleMini} />
                        <NavButton type="close" onClick={handleClose} />
                    </div>
                </div>
                <div id="msg_mgr_content">
                    <div id="msg_mgr_left_tab">
                        {listShowTab.map((strType, nIndex) => {
                            return (
                                <React.Fragment key={'frag' + nIndex}>
                                    <div
                                        key={nIndex}
                                        onClick={() => {
                                            onSelectMsgType(strType)
                                        }}
                                        className={
                                            strType !== strCurTab ? 'msg_mgr_tab' : 'msg_mgr_tab msg_mgr_tab_select'
                                        }
                                    >
                                        <div className="msg_mgr_tab_name" key={'name' + nIndex}>
                                            {strType}
                                        </div>
                                        {dictMsgNum[strType] > 0 && (
                                            <div className="msg_mgr_tab_unread" key={'unread' + nIndex}>
                                                {dictMsgNum[strType]}
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            )
                        })}
                    </div>

                    <div id="msg_mgr_right_msg" ref={refScroller}>
                        {listShowMsg.map((msg, nIndex) => {
                            if (msg.html) {
                                // 广告样式
                                return (
                                    <div
                                        className={
                                            strCurrentFocusMsg === msg.uuid
                                                ? 'msg_mgr_item_ad msg_mgr_item_highlight'
                                                : 'msg_mgr_item_ad'
                                        }
                                        key={'item' + nIndex}
                                    >
                                        <div className="msg_mgr_item_date">{formateDate(msg.time)}</div>
                                        <div
                                            className="msg_mgr_item_content"
                                            dangerouslySetInnerHTML={{ __html: msg.html }}
                                        ></div>
                                        {msg.unRead && (
                                            <div
                                                className="msg_mgr_item_read"
                                                onClick={() => {
                                                    onClickRead(msg.uuid)
                                                }}
                                            >
                                                标为已读
                                            </div>
                                        )}
                                    </div>
                                )
                            } else {
                                // 链接样式
                                return (
                                    <div
                                        className={
                                            strCurrentFocusMsg === msg.uuid
                                                ? 'msg_mgr_item msg_mgr_item_highlight'
                                                : 'msg_mgr_item'
                                        }
                                        key={'item' + nIndex}
                                    >
                                        <div className="msg_mgr_item_date">{formateDate(msg.time)}</div>
                                        <div
                                            className={
                                                msg.url === undefined
                                                    ? 'msg_mgr_item_content'
                                                    : 'msg_mgr_item_content msg_alert_content_url'
                                            }
                                            onClick={() => {
                                                onClickContent(msg.uuid)
                                            }}
                                        >
                                            {msg.content}
                                        </div>
                                        {msg.unRead && (
                                            <div
                                                className="msg_mgr_item_read"
                                                onClick={() => {
                                                    onClickRead(msg.uuid)
                                                }}
                                            >
                                                标为已读
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                        })}
                        <h1></h1>
                    </div>
                </div>
            </div>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <MessageMgr />
    </React.StrictMode>,
    document.getElementById('root')
)
