import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { EWnd } from '../../enum/EWnd'
import jlconeLogon from '../../../assets/jlcone-logo.png'

import '../style.css'
import './updateTip.css'
import { EMessage } from '../../enum/EMessage'
import Shadow from '../components/shadow/shadow'
import { ECommon } from '../../enum/ECommon'
import { AppMsg } from '../../base/AppMsg'
import { NormalButton } from '../components/normalButton/NormalButton'

const { ipcRenderer } = (window as any)['electron'] as any

const App = (): JSX.Element => {
    const [locale, setLocale] = useState({} as any)
    const refShadow = useRef(null)
    const [version, setVersion] = useState('1.0.6') // 使用配置文件中的版本

    useEffect(() => {
        // 获取多语言配置
        ipcRenderer.invoke(EMessage.EMainGetLocale).then(langMap => {
            setLocale(langMap)
        })
        
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                refShadow.current?.showShadow(bWin10)
            }
        }, [])
    }, [])

    const handleUpdate = () => {
        console.log('点击了更新按钮')
        ipcRenderer.send('quitAndInstall')
    }

    const handleDelay = () => {
        console.log('点击了稍后更新按钮')
        ipcRenderer.send('delayUpdate')
    }

    return (
        <div className="win_container login_shadow_container">
            <Shadow ref={refShadow}>
                <div className="login_container" id="login_container">
                    <div className="login_nav_bar">
                        <img width="141px" height="30px" src={jlconeLogon} alt="jlcone logo" />
                    </div>

                    <div className="update-content">
                        <div className="update-title">版本更新</div>

                        <div className="jlcone-update-tip">
                            <span>JLCONE</span>&nbsp;
                            <span className="update-tip-version">
                                V<span>{version}</span>
                            </span>
                        </div>

                        <div className="update-message">发现新版本，建议立即更新</div>
                    </div>

                    <div className="jlcone-btn-line">
                        <NormalButton
                            text="立即更新"
                            height="40px"
                            width="160px"
                            rounded={true}
                            type="primary"
                            onClick={handleUpdate}
                        />

                        <NormalButton
                            text="稍后更新"
                            height="40px"
                            width="160px"
                            rounded={true}
                            type="default"
                            onClick={handleDelay}
                        />
                    </div>
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