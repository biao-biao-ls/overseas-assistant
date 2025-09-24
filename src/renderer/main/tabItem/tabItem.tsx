import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import { SvgButton } from '../../components/svgButton/svgButton'
import './tabItem.css'

import btnCloseNormal from '../../../../assets/btn-close-bg-gray.png'
import btnCloseHover from '../../../../assets/btn-close-bg.png'

interface Props {
    id: string
    index: number
    length: number
    title: string
    onClick: (id: string) => void
    isActive?: boolean
    closable?: boolean
    onClose?: (id: string) => void
}
const TabItem = forwardRef((props: Props, ref: any) => {
    const { id, title, onClick, isActive = false, closable = true, onClose, index, length } = props
    const onClickClose = () => {
        onClose && onClose(id)
    }

    return (
        <div className={isActive ? 'sub_tab_item_active' : 'sub_tab_item'} onClick={() => onClick(id)} title={title}>
            {/* <img src={icon} alt="嘉立创小助手icon" className="tab-item-icon" /> */}
            <div className="sub_tab_content" style={{ width: closable ? 'calc(100% - 28px)' : '' }}>
                {isActive && <div className="sub_tab_line"></div>}
                <div
                    className={isActive ? 'sub_tab_item_text_active' : 'sub_tab_item_text'}
                    style={{
                        width: title.length > 8 ? '120px' : 'auto',
                    }}
                >
                    {!title ? 'about:blank' : title}
                </div>
            </div>
            {closable && (
                <SvgButton
                    normalIcon={isActive ? btnCloseHover : btnCloseNormal}
                    hoverIcon={btnCloseHover}
                    onClick={onClickClose}
                    outSize="16px"
                    imgSize="13px"
                />
            )}
            {/* 右分割线 */}
            {index !== length - 1 && (
                <div className="div_spreator">
                    <div className="sub_tab_spreator"></div>
                </div>
            )}
        </div>
    )
})
export default TabItem
