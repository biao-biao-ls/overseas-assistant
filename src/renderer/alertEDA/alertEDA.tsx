import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import './alertEDA.css'
import { SvgButton } from '../components/svgButton/svgButton'
import btnMinimizeNormal from '../../../assets/eda-minimize-normal.svg'
import btnCloseNormal from '../../../assets/eda-close-normal.svg'
import btnMinimizeHover from '../../../assets/eda-minimize-hover.svg'
import btnCloseHover from '../../../assets/eda-close-hover.svg'

import imgAlert from '../../../assets/eda-alert.svg'

import { EWnd } from '../../enum/EWnd'
import CheckButton from '../components/checkButton/CheckButton'
import { NormalButton } from '../components/normalButton/NormalButton'
import { EMessage } from '../../enum/EMessage'
import Shadow from '../components/shadow/shadow'
import { ECommon, ETabType } from '../../enum/ECommon'

const { ipcRenderer } = (window as any)['electron'] as any

const AlertEDA = (): JSX.Element => {
    const [alertEDA, setAlertEDA] = useState(true)
    const [showBorder, setBorder] = useState(true)
    const [strCurTab, setCurTab] = useState(ETabType.EEDA)
    const refCheck = useRef(null)
    const refShadow = useRef(null)

    // 窗体逻辑
    const onClickMinimize = () => {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.EAlertEDA)
    }
    const onClickClose = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EAlertEDA)
    }

    const onClickCheck = (bAlertEDA: boolean) => {
        setAlertEDA(bAlertEDA)
        ipcRenderer.send(EMessage.ESetCurrentAlertEDA, bAlertEDA)
    }
    const onClickCloseOther = () => {
        ipcRenderer.send(EMessage.EAlertEDACloseOther)
    }
    const onClickSame = () => {
        ipcRenderer.send(EMessage.EAlertEDAOpenSame)
    }
    const onClickCancel = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EAlertEDA)
    }
    const updateSetting = () => {
        // 初始化配置
        ipcRenderer.invoke(EMessage.EGetCurrentAlertEDA).then(bAlertEDA => {
            refCheck.current.setCheck(!bAlertEDA)
        })
        ipcRenderer.invoke(EMessage.EGetWin10).then(bWin10 => {
            setBorder(!bWin10)
            refShadow.current.showShadow(bWin10)
        })
    }
    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg) => {
            if (msg.msgId === EMessage.ERenderUpdateSetting) {
                updateSetting()
            } else if (msg.msgId === EMessage.ERenderAlertEDASetAlert) {
                setCurTab(msg.data)
            } else if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                setBorder(!bWin10)
                refShadow.current.showShadow(bWin10)
            }
        })
        updateSetting()
    }, [])

    return (
        <Shadow ref={refShadow}>
            <div className="alert_eda_container" id="alert_eda_container">
                <div className="alert_eda_nav_bar">
                    <div className="nav-title">
                        <span>警告</span>
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
                <div className={showBorder ? 'alert_eda_content_border' : 'alert_eda_content'}>
                    <div className="div_alert">
                        <div className="div_alert_image">
                            <img className="img_alert" src={imgAlert} alt="" />
                        </div>
                        <div className="div_alert_text">
                            嘉立创EDA所需内存较多，与其他项目同时启用可能会资源不足异常退出。建议根据自己电脑配置选用不同模式。
                            <br />
                        </div>
                    </div>
                    {/* 选择按钮 */}
                    <div className="div_info">
                        1、16G 及以上内存可同时开启多个项目，
                        <br />
                        2、不足16G建议只开一个，另一个在保存操作后自动关闭。
                        <br />
                    </div>

                    {/* 不再提醒 */}
                    <div className="div_no_alert_eda">
                        <CheckButton
                            ref={refCheck}
                            text="不再提醒（可在设置中修改默认选项）"
                            onClick={bNoAlert => {
                                onClickCheck(!bNoAlert)
                            }}
                            defaultCheck={!alertEDA}
                        ></CheckButton>
                    </div>
                    {/* 确认 取消 */}
                    <div className="div_button">
                        <NormalButton
                            text={'关闭当前并切换项目'}
                            onClick={() => {
                                onClickCloseOther()
                            }}
                        ></NormalButton>
                        <NormalButton
                            text="同时开启项目"
                            onClick={() => {
                                onClickSame()
                            }}
                        ></NormalButton>
                        <NormalButton
                            text="取消"
                            onClick={() => {
                                onClickCancel()
                            }}
                        ></NormalButton>
                    </div>
                </div>
            </div>
        </Shadow>
    )
}
ReactDOM.render(
    <React.StrictMode>
        <AlertEDA />
    </React.StrictMode>,
    document.getElementById('root')
)
