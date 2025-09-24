import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import './InputBox.css'

interface Props {
    className?: string
    initialValue?: string
    handleChange?: Function
    placeHolder?: string
    unit?: string
    inputType?: 'text' | 'number'
    min?: string
    max?: string
    readOnly?: boolean
}

const InputBox = forwardRef((props: Props, ref: any) => {
    const { className, initialValue, handleChange, placeHolder, unit, inputType, ...restProps } = props
    const [inputValue, setInputValue] = useState(initialValue ? initialValue : '')
    function onChange(e) {
        handleChange && handleChange(e)
        setInputValue(e.target.value)
    }
    function setValue(strValue: string) {
        // 不进行回调
        setInputValue(strValue)
    }
    function getValue() {
        return inputValue
    }
    useImperativeHandle(ref, () => ({
        setValue,
        getValue,
    }))

    return (
        <>
            <div className="input_container">
                <input
                    spellCheck="false"
                    autoComplete="off"
                    className={`input_input ${className}`}
                    placeholder={placeHolder}
                    value={inputValue}
                    onChange={onChange}
                    type={inputType}
                    {...restProps}
                />
                <div className="input_unit">{unit}</div>
            </div>
        </>
    )
})
export default InputBox
