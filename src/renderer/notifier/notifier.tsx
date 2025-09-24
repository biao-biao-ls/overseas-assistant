import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { EMessage } from '../../enum/EMessage'
import { NavButton } from '../components/navButton'


import '../style.css'

const { ipcRenderer } = (window as any)['electron'] as any

const App = (): JSX.Element => {
    const [message, setMessage] = useState('')
    function handleClose(evt: any) {
        ipcRenderer.send(EMessage.EWindowClose, 'notifier')
    }

    useEffect(() => {
        ipcRenderer.invoke('/im/latestMessage').then(latestMessage => {
            setMessage(latestMessage)
        })
    }, [])

    return (
        <div className="notifier-container" id="notifier-container">
            <div className="nav-bar" id="nav-bar">
                <span>最新消息</span>
                <div className="nav-btn-list">
                    <NavButton type="close" onClick={handleClose} />
                </div>
            </div>
            <div className="notifier-wrap" id="notifier-wrap">
                {message}
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
