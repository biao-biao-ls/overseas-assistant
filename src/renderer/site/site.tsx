import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { EMessage } from '../../enum/EMessage'
import './site.css'
import '../style.css'

import imgSiteCloud from '../../../assets/site/site-cloud.png'
import imgSiteJLC from '../../../assets/site/site-jlc.png'
import imgSiteLCSC from '../../../assets/site/site-lcsc.png'
import imgSiteMonkey from '../../../assets/site/site-monkey.png'
import imgSiteZXH from '../../../assets/site/site-zxh.png'
import { ECommon } from '../../enum/ECommon'

import imgDefault from '../../../assets/site/site-jlc.png'
import { AppMsg } from '../../base/AppMsg'

const { ipcRenderer } = (window as any)['electron'] as any

let dictDefaultCfg = {
    '嘉立创': ['嘉立创', 'https://www.jlc.com', 'PCB，SMT，PCBA制造服务', imgSiteJLC],
    '立创商城': ['立创商城', 'https://www.szlcsc.com', '电子元器件供应商', imgSiteLCSC],
    '中信华': ['中信华', 'https://www.zxhgroup.com', 'PCB大批量可月结', imgSiteZXH],
    '嘉立创EDA': ['嘉立创EDA', 'https://lceda.cn', '国产PCB设计工具', imgSiteCloud],
    '嘉立创钢网': ['嘉立创钢网', 'https://www.jlc-gw.com', 'SMT激光钢网制作', imgSiteJLC],
    '嘉立创3D智造': ['嘉立创3D智造', 'https://www.sanweihou.com', '3D打印，金属模型，CNC加工', imgSiteMonkey],
    '嘉立创FA': ['嘉立创FA', 'https://www.jlcfa.com', '一站式设备零部件采购商城', imgSiteJLC],
}

const Site = (): JSX.Element => {
    const [strHoverUrl, setCurrentUrl] = useState(ECommon.ENone)
    const [listSiteCfg, setListSiteCfg] = useState([])
    const onMouseEnterSite = () => {
        ipcRenderer.send(EMessage.EMainMouseEnterSite)
    }
    const onMouseLeaveSite = () => {
        ipcRenderer.send(EMessage.EMainMouseLeaveSite)
    }

    const onMouseEnterItem = strHoverUrl => {
        setCurrentUrl(strHoverUrl)
    }

    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderLeftSiteCfg) {
                let listSiteCfg = msg.data as string[][]
                let listNewCfg = checkCfg(listSiteCfg)
                setListSiteCfg(listNewCfg)
            }
        })
    })
    function checkCfg(listSendCfg: string[][]) {
        let listNewCfg = []
        for (const listItemCfg of listSendCfg) {
            if (listItemCfg[0] in dictDefaultCfg) {
                // 更换图片
                listItemCfg[3] = dictDefaultCfg[listItemCfg[0]][3]
            }
            if (!listItemCfg[3]) {
                listItemCfg[3] = imgDefault
            }
            listNewCfg.push(listItemCfg)
        }

        return listNewCfg
    }

    const onClickSite = strUrl => {
        if (ECommon.isNone(strUrl)) {
            return
        }

        ipcRenderer.send(EMessage.EMainOpenSiteUrl, strUrl)
    }

    return (
        <div
            className="site_container"
            id="site_container"
            onMouseEnter={() => {
                onMouseEnterSite()
            }}
            onMouseLeave={() => {
                onMouseLeaveSite()
            }}
        >
            <div id="site_title">一站式产业互联智能平台</div>
            <div id="site_line">
                <div id="site_line_content"></div>
            </div>
            <div id="site_item_container">
                {listSiteCfg.map((listItem: any[], nIndex: number) => {
                    return (
                        <div
                            className="site_item"
                            style={{
                                height: listItem[0] === '嘉立创零部件商城' ? '80px' : '60px',
                            }}
                            key={nIndex}
                            onMouseEnter={() => {
                                onMouseEnterItem(listItem[1])
                            }}
                            onClick={() => {
                                onClickSite(listItem[1])
                            }}
                        >
                            <div
                                className="site_item_wrap"
                                style={{
                                    marginTop: listItem[0] === '嘉立创零部件商城' ? '-10px' : '0px',
                                }}
                            >
                                <div className="site_item_top">
                                    <div className="site_item_icon">
                                        <img className="img_bg" src={listItem[3]} alt="" />
                                    </div>
                                    <div className="site_item_name">{listItem[0]}</div>
                                </div>

                                <div className="site_item_info" dangerouslySetInnerHTML={{ __html: listItem[2] }}></div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <Site />
    </React.StrictMode>,
    document.getElementById('root')
)
