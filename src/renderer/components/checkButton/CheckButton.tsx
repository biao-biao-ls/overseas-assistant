import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import './CheckButton.css'

import imgChecked from '../../../../assets/eda-check-check.svg'
import imgUnChecked from '../../../../assets/eda-check-uncheck.svg'
import exp from 'constants'

interface Props {
    text: string
    defaultCheck?: boolean
    onClick?: Function
    textClass?: string
}

const CheckButton = forwardRef((props: Props, ref: any) => {
    const { text, defaultCheck: initCheck = false, onClick, textClass } = props
    const [checked, setChecked] = useState(initCheck)
    const onClickCheckButton = bCheck => {
        setChecked(bCheck)
        if (onClick) {
            onClick(bCheck)
        }
    }
    const setCheck = bCheck => {
        // 不进行回调
        setChecked(bCheck)
    }
    useImperativeHandle(ref, () => ({
        setCheck,
    }))
    return (
        <>
            <div className="div_check">
                <div
                    className="div_check_image"
                    onClick={() => {
                        onClickCheckButton(!checked)
                    }}
                >
                    <img className="check_image" alt="" src={checked ? imgChecked : imgUnChecked} />
                </div>
                <div
                    className={textClass ? 'div_check_text ' + textClass : 'div_check_text'}
                    onClick={() => {
                        onClickCheckButton(!checked)
                    }}
                >
                    {text}
                </div>
            </div>
        </>
    )
})
export default CheckButton
