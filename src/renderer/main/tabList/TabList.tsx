import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { ECommon } from '../../../enum/ECommon'
import { EMessage } from '../../../enum/EMessage'
import TabItem from '../tabItem/tabItem'

import './TabList.css'

const { ipcRenderer } = (window as any)['electron'] as any

export default function TabList(): JSX.Element {
    const [listViewTitle, setListViewTitle] = useState([])
    const [strCurViewId, setCurrentViewId] = useState(ECommon.ENone)

    const handleClose = (strViewId: string) => {
        ipcRenderer.invoke(EMessage.EMainBrowserviewClose, strViewId)
    }

    const handleTabItemClick = (strViewUUID: string) => {
        for (const item of listViewTitle) {
            if (item['id'] === strCurViewId) {
                ipcRenderer.invoke(EMessage.EMainBrowserviewSetTop, strViewUUID)
                return
            }
        }
    }

    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg) => {
            if (msg.msgId === EMessage.ERenderRefreshTab) {
                let dictTabInfo = msg.data
                let listViewTitle = dictTabInfo['bvViewTitle']
                let strTopViewId = dictTabInfo['topViewId']
                setCurrentViewId(strTopViewId)
                setListViewTitle(listViewTitle)
            }
        })
    }, [])
    return (
        <div className="page_tab_list">
            {listViewTitle.map((item: any, nIndex: number) => {
                let bClose = true
                if (item.label && 'close' in item.label) {
                    bClose = item.label.close
                }

                return (
                    <TabItem
                        key={item['id']}
                        id={item['id']}
                        index={nIndex}
                        length={listViewTitle.length}
                        title={item.title}
                        onClick={handleTabItemClick}
                        isActive={item['id'] === strCurViewId}
                        closable={nIndex !== 0 && bClose}
                        onClose={handleClose}
                    />
                )
            })}
        </div>
    )
}
