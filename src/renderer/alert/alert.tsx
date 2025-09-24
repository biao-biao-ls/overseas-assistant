import React, { Fragment, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import './alert.css'

import { NormalButton } from '../components/normalButton/NormalButton'
import { SvgButton } from '../components/svgButton/svgButton'

import btnMinimizeNormal from '../../../assets/eda-minimize-normal.svg'
import btnCloseNormal from '../../../assets/eda-close-normal.svg'
import btnMinimizeHover from '../../../assets/eda-minimize-hover.svg'
import btnCloseHover from '../../../assets/eda-close-hover.svg'

import imgAlert from '../../../assets/eda-alert.svg'

import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppMsg } from '../../base/AppMsg'
import { ECommon } from '../../enum/ECommon'
import Shadow from '../components/shadow/shadow'

const { ipcRenderer } = (window as any)['electron'] as any

const App = (): JSX.Element => {
    const [title, setTitle] = useState('警告')
    const [listInfo, setInfo] = useState([])
    const [isConfirm, setIsConfirm] = useState(false)
    const refShadow = useRef(null)
    const [showBorder, setBorder] = useState(true)
    // 窗体逻辑
    const onClickMinimize = () => {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.EAlert)
    }
    const onClickClose = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EAlert)
    }
    const onClickOK = () => {
        ipcRenderer.send(EMessage.EAlertOK)
    }
    const onClickCancel = () => {
        ipcRenderer.send(EMessage.EAlertCancel)
    }
    const refreshByData = dictInfo => {
        if (dictInfo) {
            let strTitle = dictInfo['title']
            setTitle(strTitle)
            let strInfo = dictInfo['info']
            setInfo(strInfo)
            let bConfirm = dictInfo['confirm']
            setIsConfirm(bConfirm)
        }
    }

    useEffect(() => {
        // 第一次刷新
        ipcRenderer.invoke(EMessage.EMainAlertInfo).then(data => {
            refreshByData(data)
        })
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderUpdateSetting) {
                refreshByData(msg.data)
            } else if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                setBorder(!bWin10)
                refShadow.current.showShadow(bWin10)
            }
        })
    }, [])
    return (
        <Shadow ref={refShadow}>
            <div className="alert_container">
                <div className="alert_nav_bar">
                    <div className="nav-title">
                        <span>{title}</span>
                    </div>
                    <div className="nav_btn_list_eda">
                        <SvgButton
                            outSize="45px"
                            normalIcon={btnMinimizeNormal}
                            hoverIcon={btnMinimizeHover}
                            onClick={() => {
                                onClickMinimize()
                            }}
                        />
                        <SvgButton
                            outSize="45px"
                            normalIcon={btnCloseNormal}
                            hoverIcon={btnCloseHover}
                            onClick={() => {
                                onClickClose()
                            }}
                        />
                    </div>
                </div>
                <div className={showBorder ? 'alert_content_border' : 'alert_content'}>
                    <div className="div_alert">
                        <div className="div_alert_image">
                            <img className="img_alert" src={imgAlert} alt="" />
                        </div>
                        <div className="div_alert_text">
                            {listInfo.map((strContent, nIndex) => {
                                return (
                                    <React.Fragment key={nIndex}>
                                        {strContent}
                                        <br />
                                    </React.Fragment>
                                )
                            })}
                        </div>
                    </div>
                    {/* 确认 取消 */}
                    {isConfirm && (
                        <div className="div_button_confirm">
                            <NormalButton
                                text="确认"
                                onClick={() => {
                                    onClickOK()
                                }}
                            ></NormalButton>
                            <NormalButton
                                text="取消"
                                onClick={() => {
                                    onClickCancel()
                                }}
                            ></NormalButton>
                        </div>
                    )}
                    {!isConfirm && (
                        <div className="div_button_alert">
                            <NormalButton
                                text="确定"
                                onClick={() => {
                                    onClickOK()
                                }}
                            ></NormalButton>
                        </div>
                    )}
                </div>
            </div>
        </Shadow>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
)
