import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import './RadioButtonGroup.css'

import imgChecked from '../../../../assets/eda-radio-check.svg'
import imgUnChecked from '../../../../assets/eda-radio-uncheck.svg'
import { type } from 'os'

interface Props {
    dictSelect: { label: string; value: any }[]
    defaultSelect?: string
    onClick?: Function
    direction?: string
}
const RadioButtonGroup = forwardRef((props: Props, ref: any) => {
    let { dictSelect, defaultSelect, onClick, direction = 'row' } = props
    if (!defaultSelect) {
        defaultSelect = dictSelect[0].value
    }

    const [currentSelect, setCurrentSelect] = useState(defaultSelect)

    const onClickRaioButton = (strKey: string) => {
        setCurrentSelect(strKey)
        if (onClick) {
            onClick(strKey)
        }
    }
    const setSelectId = strSelectId => {
        // 不进行回调
        setCurrentSelect(strSelectId)
    }
    useImperativeHandle(ref, () => ({
        setSelectId,
    }))
    return (
        <>
            <div className="div_radio_select" style={{ 'flexDirection': direction === 'row' ? 'row' : 'column' }}>
                {dictSelect.map(item => {
                    return (
                        <div
                            key={item.value.toString()}
                            className={`div_radio ${direction === 'row' ? 'div_radio_row' : 'div_radio_column'}`}
                        >
                            <div
                                className="div_radio_image"
                                onClick={() => {
                                    onClickRaioButton(item.value)
                                }}
                            >
                                <img
                                    className="radio_image"
                                    alt=""
                                    src={item.value === currentSelect ? imgChecked : imgUnChecked}
                                />
                            </div>
                            <div
                                className="div_radio_text"
                                onClick={() => {
                                    onClickRaioButton(item.value)
                                }}
                            >
                                {item.label}
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )
})
export default RadioButtonGroup
