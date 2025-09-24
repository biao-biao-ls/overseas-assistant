import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import icon from '../../../assets/jlcAssistant512.png'
import { EWnd } from '../../enum/EWnd'
import { NavButton } from '../components/navButton'

import './MessageAlert.css'
import '../style.css'
import { EMessage } from '../../enum/EMessage'
import { AppMsg } from '../../base/AppMsg'
import { ECommon } from '../../enum/ECommon'
import { SvgButton } from '../components/svgButton/svgButton'
import LinkEvent from './LinkEvent'

const { ipcRenderer } = (window as any)['electron'] as any

let linkEvent = new LinkEvent()

const MessageAlert = (): JSX.Element => {
    const [strUUID, setMsgUUID] = useState('')
    const [strTitle, setMsgTitle] = useState('')
    const [strMsg, setMsgContent] = useState('')
    const [strHtml, setMsgHtml] = useState('')
    const [strUrl, setMsgUrl] = useState('')

    function handleClose(evt: any) {
        ipcRenderer.send(EMessage.EMainMsgAlertClickClose)
    }
    function onClickContent() {
        ipcRenderer.send(EMessage.EMainMsgAlertClickContent, strUUID)
    }
    const onClickIgnoreAll = () => {
        ipcRenderer.send(EMessage.EMainMsgAlertIgnoreAll, strUUID)
    }

    const onClickAd = (strMsgId: string) => {
        ipcRenderer.send(EMessage.EMainMsgAlertClickAd, strMsgId)
    }
    async function insertJs(element: HTMLScriptElement) {
        let scriptEle = document.createElement('script')
        if (element.src) {
            scriptEle.src = element.src
        } else {
            scriptEle.innerHTML = element.textContent
        }
        document.head.appendChild(scriptEle)

        await new Promise<void>((resolve, reject) => {
            scriptEle.onload = () => {
                resolve()
            }
        })
    }
    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg(async (event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderMessageAlertContent) {
                let strUUID = msg.data['uuid']
                let strTitle = msg.data['title']
                let strMsg = msg.data['msg']
                let strHtml = msg.data['html']
                let strUrl = msg.data['url']
                let listScript = msg.data['script']
                // 事件
                linkEvent.setAlertFun((strMsgId: string) => {
                    onClickAd(strMsgId)
                })
                linkEvent.setUUID(strUUID)
                linkEvent.init()

                setMsgUUID(strUUID)
                setMsgTitle(strTitle)
                setMsgContent(strMsg)
                setMsgHtml(strHtml)
                setMsgUrl(strUrl)

                if (strHtml !== undefined) {
                    let parser = new DOMParser()
                    for (const strScript of listScript) {
                        let strNewScript = strScript.replace(/<code/, '<script').replace(/<\/code>/, '</script>')
                        let node = parser.parseFromString(strNewScript, 'text/html')
                        let listScriptElement = node.getElementsByTagName('script')
                        for (const element of listScriptElement) {
                            await insertJs(element)
                        }
                    }
                }
            }
        })
    }, [])
    useEffect(() => {
        // 查找图片
        let listImg = document.getElementsByTagName('img')
        for (const imgElement of listImg) {
            if ('href' in imgElement.attributes) {
                let strHrefValue = imgElement.attributes['href']['value']
                imgElement.onclick = () => {
                    // 点击了图片
                    let a = document.createElement('a')
                    a.href = strHrefValue
                    a.click()
                }
            }
        }
    }, [strHtml])
    return (
        <div className="win_container">
            <div id="msg_alert_container">
                <div id="msg_alert_nav_bar">
                    <div className="nav-title">
                        <img src={icon} alt="嘉立创小助手icon" className="nav-bar-icon" />
                        <span>{strTitle}</span>
                    </div>
                    <div id="msg_alert_interface">
                        {/* <NavButton type="minimize" onClick={handleMini} /> */}
                        <NavButton type="close" onClick={handleClose} />
                    </div>
                </div>
                <div
                    id="msg_alert_data"
                    onClick={() => {
                        if (strHtml === undefined) {
                            onClickContent()
                        } else {
                            onClickAd(strUUID)
                        }
                    }}
                >
                    {strHtml === undefined && (
                        <div
                            className={
                                strUrl === undefined ? 'msg_alert_content' : 'msg_alert_content msg_alert_content_url'
                            }
                        >
                            {strMsg}
                        </div>
                    )}
                    {strHtml !== undefined && (
                        <div id="msg_alert_html" dangerouslySetInnerHTML={{ __html: strHtml }}></div>
                    )}
                </div>
                <div
                    id="msg_alert_ignore_all"
                    onClick={() => {
                        onClickIgnoreAll()
                    }}
                >
                    忽略全部
                </div>
            </div>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <MessageAlert />
    </React.StrictMode>,
    document.getElementById('root')
)
