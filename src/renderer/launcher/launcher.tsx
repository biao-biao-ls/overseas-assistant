import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { NavButton } from '../components/navButton'
import icon from '../../../assets/jlcAssistant512.png'

import './launcher.css'
import { EWnd } from '../../enum/EWnd'
import { EMessage } from '../../enum/EMessage'

const { ipcRenderer } = (window as any)['electron'] as any

const App = (): JSX.Element => {
    const envArr = [
        {
            name: 'DEV',
            title: 'DEV环境',
            disable: false,
        },
        {
            name: 'UAT',
            title: 'UAT环境',
            disable: false,
        },
        {
            name: 'PRO',
            title: '生产环境',
            disable: false,
        },
    ]

    function handleMini(evt: any) {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.ELauncher)
    }
    function handleClose(evt: any) {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.ELauncher)
    }

    function handleSelectEnv(envName) {
        ipcRenderer.send('/dev/selectEnv', envName)
    }

    return (
        <div className="launcher-container" id="launcher-container">
            <div className="nav-bar" id="nav-bar">
                <div className="nav-title">
                    <img src={icon} alt="嘉立创小助手icon" className="nav-bar-icon" />
                    <span>JLCONE</span>
                </div>
                <div className="nav-btn-list">
                    <NavButton type="minimize" onClick={handleMini} />
                    <NavButton type="close" onClick={handleClose} />
                </div>
            </div>
            <div className="launcher-wrap" id="launcher-wrap">
                <div className="title">请选择嘉立创下单助手运行环境</div>
                <div className="btn-wrap">
                    {envArr.map((env, index) => {
                        return (
                            <button
                                key={index}
                                className={`eda-btn-extension ${env.disable ? 'disable' : ''}`}
                                disabled={env.disable}
                                onClick={e => {
                                    handleSelectEnv(env.name)
                                }}
                            >
                                {env.title}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
)
