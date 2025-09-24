import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

import './svgButton.css'

import '../../style.css'

interface Props {
    normalIcon: string
    hoverIcon?: string
    onClick?: Function
    outSize?: string
    imgSize?: string
}
export function SvgButton(props: Props): JSX.Element {
    const { onClick = () => {}, normalIcon, hoverIcon, outSize = '20px', imgSize = '20px' } = props
    const onMouseEnter = () => {
        if (hoverIcon === '') {
            ;(refSvg.current as HTMLImageElement).style.display = 'none'
        } else {
            ;(refSvg.current as HTMLImageElement).style.display = 'block'
            ;(refSvg.current as HTMLImageElement).src = hoverIcon
        }
    }
    const onMouseLeave = () => {
        if (normalIcon === '') {
            ;(refSvg.current as HTMLImageElement).style.display = 'none'
        } else {
            ;(refSvg.current as HTMLImageElement).style.display = 'block'
            ;(refSvg.current as HTMLImageElement).src = normalIcon
        }
    }
    const refSvg = useRef(null)
    useEffect(() => {
        onMouseLeave()
    }, [])
    return (
        <div className={`img_btn_container`} style={{ 'width': outSize, 'height': outSize }}>
            <div
                className={`img_btn`}
                onClick={onClick as any}
                style={{ 'width': imgSize, 'height': imgSize, zIndex: 99 }}
                onMouseEnter={() => {
                    onMouseEnter()
                }}
                onMouseLeave={() => {
                    onMouseLeave()
                }}
            >
                <img ref={refSvg} className="img_bg" src={normalIcon} alt=""></img>
            </div>
        </div>
    )
}
