import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { EMessage } from '../../enum/EMessage'
import { NormalButton } from '../components/normalButton/NormalButton'

import './reload.css'
import '../style.css'
import { AppMsg } from '../../base/AppMsg'
import { ECommon } from '../../enum/ECommon'

const LoginReload = (): JSX.Element => {
    const [uiStrReason, setUIStrReason] = useState('')
    const [uiListOperate, setUIListOperate] = useState([])

    const onClickReload = () => {
        // 点击了reload
        if (window['appClient']) {
            window['appClient'].sendMsgToMain(EMessage.EMainReloadLogin)
        }
    }
    useEffect(() => {
        window[ECommon.AssistantEventHandle].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.EMainToRenderCreateUserLog) {
                let strReason = msg.data['reason'] as string
                let listOperate = msg.data['operate'] as string[]

                setUIStrReason(strReason)
                setUIListOperate(listOperate)
            }
        })
    }, [])

    return (
        <>
            <div className="loading_log" style={{ top: '0.5rem' }}>
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
            <div id="login_reload_container">
                <h1>登录页加载失败了</h1>
                <div id="login_reload_btn">
                    <NormalButton
                        text="重新加载"
                        onClick={() => {
                            onClickReload()
                        }}
                    ></NormalButton>
                </div>
            </div>
        </>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <LoginReload />
    </React.StrictMode>,
    document.getElementById('root')
)
