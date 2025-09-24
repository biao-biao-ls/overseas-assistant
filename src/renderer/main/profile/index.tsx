import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { AppMsg } from '../../../base/AppMsg'
import { ECommon } from '../../../enum/ECommon'
import { EMessage } from '../../../enum/EMessage'
import { ASSIT_VERSION } from '../../../main/config'

import './profile.css'

const { ipcRenderer } = (window as any)['electron'] as any

export default function Profile(): JSX.Element {
    const [customerInfo, setCustomerInfo] = useState(null)
    useEffect(() => {
        ipcRenderer.invoke(EMessage.EMainGetCustomInfo).then(data => {
            setCustomerInfo(data)
        })
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderUpdateLogin) {
                setCustomerInfo(msg.data)
            }
        }, [])
    }, [])
    return (
        <div className="customer_info">
            <div id="customer_info_version">{`v${ASSIT_VERSION}`}</div>
        </div>
    )
}
