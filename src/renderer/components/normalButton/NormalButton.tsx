import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import './NormalButton.css'

const MaxWord = 6
interface Props {
    rounded?: boolean
    plain?: boolean
    text: string
    type?: string
    onClick?: Function
    height?: string
    width?: string
    className?: string
    children?: React.ReactNode
    disabled?: boolean
}

export function NormalButton(props: Props): JSX.Element {
    const { text, onClick, height = '28px', width = '100px', className = '', rounded, plain, type = 'default', disabled = false } = props
    const [uiWidth, setUIWidth] = useState('100px')
    const [btnHeight, setHeight] = useState('28px')

    const onClickButton = () => {
        if (onClick && !disabled) {
            onClick()
        }
    }
    useEffect(() => {
        if (text.length <= MaxWord) {
            setUIWidth(width)
        } else {
            setUIWidth(`${12 * text.length + 24}px `)
        }
        setHeight(height)
    }, [])

    return (
        <>
            <div
                className={`${'div_button_white'} ${rounded ? 'div_button_rounded' : ''} ${
                    plain ? 'div_button_plain' : ''
                } div_button_${type} ${disabled ? 'div_button_disabled' : ''} ${className}`}
                style={{ 'width': uiWidth, 'height': btnHeight, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                    onClickButton()
                }}
            >
                {props.children ? <div className="div_button_children">{props.children}</div> : null}

                {text}
            </div>
        </>
    )
}
