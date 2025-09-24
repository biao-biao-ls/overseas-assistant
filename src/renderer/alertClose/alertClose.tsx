import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { SvgButton } from '../components/svgButton/svgButton'
import btnCloseNormal from '../../../assets/btn-wnd-close.svg'
import btnCloseHover from '../../../assets/btn-wnd-close-hover.svg'

import imgAlert from '../../../assets/eda-alert.svg'

import './alertClose.css'
import { EWnd } from '../../enum/EWnd'
import RadioButtonGroup from '../components/radioButtonGroup/RadioButtonGroup'
import CheckButton from '../components/checkButton/CheckButton'
import { NormalButton } from '../components/normalButton/NormalButton'
import { EMessage } from '../../enum/EMessage'
import Shadow from '../components/shadow/shadow'
import { ECommon } from '../../enum/ECommon'

const { ipcRenderer } = (window as any)['electron'] as any

const AlertClose = (): JSX.Element => {
    const [hideToTask, setHideToTask] = useState(true)
    const [alertClose, setAlertClose] = useState(true)
    const [showBorder, setBorder] = useState(true)
    const refRadio = useRef(null)
    const refCheck = useRef(null)
    const refShadow = useRef(null)
    const onClickMinimize = () => {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.EAlertClose)
    }
    const onClickClose = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EAlertClose)
    }
    const onClickConfirm = () => {
        ipcRenderer.send('/msg/alertClose/clickConfirm')
    }
    const onClickCancel = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EAlertClose)
    }

    const onClickRadio = (strGroupName: string, strKey: string) => {}
    const onClickCheck = (bAlertClose: boolean) => {
        setAlertClose(bAlertClose)
        ipcRenderer.send(EMessage.ESetCurrentAlertClose, bAlertClose)
    }

    const [locale, setLocale] = useState({} as any)
    const updateSetting = () => {
        // 初始化配置
        ipcRenderer.invoke(EMessage.EGetCurrentHideTask).then(bHideTask => {
            refRadio.current.setSelectId(bHideTask)
        })

        ipcRenderer.invoke(EMessage.EGetCurrentAlertClose).then(bAlerClose => {
            refCheck.current.setCheck(!bAlerClose)
        })
        ipcRenderer.invoke(EMessage.EGetWin10).then(bWin10 => {
            setBorder(!bWin10)
            refShadow.current.showShadow(bWin10)
        })
        ipcRenderer.invoke(EMessage.EMainGetLocale).then(langMap => {
            setLocale(langMap)
        })
    }
    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg) => {
            if (msg.msgId === EMessage.ERenderUpdateSetting) {
                // console.log('alertClose更新配置')
                updateSetting()
            } else if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                setBorder(!bWin10)
                refShadow.current.showShadow(bWin10)
            }
        })
        updateSetting()
    }, [])

    const dictSelectData = [
        { value: true, label: locale.locale_2 },
        { value: false, label: locale.locale_3 },
    ]
    return (
        <Shadow ref={refShadow}>
            <div className="alert_close_container" id="alert_close_container">
                <div className="alert_close_nav_bar">
                    <div className="nav-title">
                        <span>{locale.locale_18}</span>
                    </div>
                    <div className="nav_btn_list_close">
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
                <div className={'alert_close_content_border'}>
                    {/* 退出程序 */}
                    <div className="div_alert">
                        <div className="div_alert_image">
                            <img className="img_alert" src={imgAlert} alt="" />
                        </div>
                        <div className="div_alert_text">{locale.locale_21}</div>
                    </div>
                    {/* 选择按钮 */}
                    <div className="div_select">
                        <RadioButtonGroup
                            direction="col"
                            ref={refRadio}
                            dictSelect={dictSelectData}
                            onClick={(value: boolean) => {
                                setHideToTask(value)
                                ipcRenderer.send(EMessage.ESetCurrentHideTask, value)
                            }}
                        ></RadioButtonGroup>
                    </div>
                    {/* 不再提醒 */}
                    <div className="div_no_alert">
                        <CheckButton
                            ref={refCheck}
                            text={`${locale.locale_19} (${locale.locale_20})`}
                            onClick={bNoAlert => {
                                onClickCheck(!bNoAlert)
                            }}
                            defaultCheck={!alertClose}
                        ></CheckButton>
                    </div>

                    <div className="div_button_wrap">
                        {/* 确认 取消 */}
                        <div className="div_button">
                            <NormalButton
                                text={locale.locale_16 || 'Cancel'}
                                height="32px"
                                width="100px"
                                rounded={true}
                                onClick={() => {
                                    onClickCancel()
                                }}
                            ></NormalButton>
                            <NormalButton
                                text={locale.locale_17 || 'Save'}
                                height="32px"
                                width="100px"
                                rounded={true}
                                type="primary"
                                onClick={() => {
                                    onClickConfirm()
                                }}
                            ></NormalButton>
                        </div>
                    </div>
                </div>
            </div>
        </Shadow>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <AlertClose />
    </React.StrictMode>,
    document.getElementById('root')
)
