import React from 'react'
import ReactDOM from 'react-dom'

import './index.css'

interface Props {
    type: 'close' | 'minimize' | 'maximize' | 'unmaximize' | 'close-gray'
    onClick?: Function
}
export function NavButton(props: Props): JSX.Element {
    const { type, onClick = () => {} } = props
    return <div className={`nav-btn nav-${type}`} onClick={onClick as any}></div>
}
