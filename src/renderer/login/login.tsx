import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { EWnd } from '../../enum/EWnd'
import loadingIcon from '../../../assets/eda-loading.svg'

import btnMiniNormal from '../../../assets/btn-minimize.svg'
import btnMiniHover from '../../../assets/btn-minimize-hover.svg'
import btnCloseNormal from '../../../assets/btn-wnd-close.svg'
import btnCloseHover from '../../../assets/btn-wnd-close-hover.svg'

import '../style.css'
import './login.css'
import { SvgButton } from '../components/svgButton/svgButton'
import { EMessage } from '../../enum/EMessage'
import Shadow from '../components/shadow/shadow'
import { ECommon } from '../../enum/ECommon'
import { AppMsg } from '../../base/AppMsg'

const { ipcRenderer } = (window as any)['electron'] as any

const App = (): JSX.Element => {
    const IconOutSize = '36px'
    const [showBorder, setBorder] = useState(true)
    const refShadow = useRef(null)
    const [uiStrReason, setUIStrReason] = useState('')
    const [uiListOperate, setUIListOperate] = useState([])

    function handleMini(evt: any) {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.ELoign)
    }
    function handleClose(evt: any) {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.ELoign)
    }
    const onClickSetting = () => {
        // 打开设置窗口
        ipcRenderer.send('checkForUpdates', EWnd.ESetting)
    }
    const onClickClean = () => {
        // 强制刷新
        ipcRenderer.send(EMessage.EWindowReloadIgnoringCache, EWnd.ELoign)
    }
    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            // 收到主进程消息
            if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                setBorder(!bWin10)
                refShadow.current.showShadow(bWin10)
            } else if (msg.msgId === EMessage.EMainToRenderCreateUserLog) {
                let strReason = msg.data['reason'] as string
                let listOperate = msg.data['operate'] as string[]

                setUIStrReason(strReason)
                setUIListOperate(listOperate)
            }
        }, [])
    })
    return (
        <div className="win_container login_shadow_container">
            <Shadow ref={refShadow}>
                <div className="login_container" id="login_container">
                    <div className="loading_log">
                        <div className="loading_reason"> {uiStrReason}</div>
                        <br />
                        {uiListOperate.map((strItem: string, nIndex: number) => {
                            return (
                                <div className="loading_operate" key={nIndex}>
                                    {strItem}
                                </div>
                            )
                        })}
                    </div>

                    <div className="login_loading_container">
                        <div className="login_loading">
                            <img className="img_bg" src={loadingIcon} alt=""></img>
                        </div>
                    </div>
                    <div className="login_nav_bar">
                        <div className="login_navbar_left_bg"></div>
                        <div className="nav-title">
                            {/* <div className="history-_back">
                                <SvgButton
                                    normalIcon={historyBack}
                                    hoverIcon={historyBack}
                                    outSize="24px"
                                    imgSize="24px"
                                    onClick={() => {
                                        ipcRenderer.send(EMessage.EMainHistoryBack)
                                    }}
                                />
                            </div> */}
                        </div>
                        <div className="nav_btn_list_login">
                            {/* <SvgButton
                                normalIcon={cleanIconNormal}
                                hoverIcon={cleanIconHover}
                                onClick={onClickClean}
                                outSize="45px"
                                imgSize="20px"
                            />
                            <SvgButton
                                normalIcon={btnSettingNormal}
                                hoverIcon={btnSettingHover}
                                onClick={onClickSetting}
                                outSize="45px"
                                imgSize="20px"
                            /> */}
                            <SvgButton
                                normalIcon={btnMiniNormal}
                                hoverIcon={btnMiniHover}
                                onClick={handleMini}
                                outSize={IconOutSize}
                                imgSize="24px"
                            />

                            <SvgButton
                                normalIcon={btnCloseNormal}
                                hoverIcon={btnCloseHover}
                                onClick={handleClose}
                                outSize={IconOutSize}
                                imgSize="24px"
                            />
                            {/* <NavButton type="minimize" onClick={handleMini} /> */}
                            {/* <NavButton type="close" onClick={handleClose} /> */}
                        </div>
                    </div>
                    <div className="login_frame"></div>
                </div>
            </Shadow>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
)
