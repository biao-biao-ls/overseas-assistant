import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import './shadow.css'

import loadingIcon from '../../../../assets/eda-loading.svg'

interface Props {
    children: React.ReactNode
}
const Shadow = forwardRef((props: Props, ref: any) => {
    const [shadow, setShadow] = useState(true)
    const showShadow = (bshow: boolean) => {
        setShadow(bshow)
    }
    useImperativeHandle(ref, () => ({
        showShadow,
    }))
    return (
        <>
            <div className="shadow_container">
                {/* <div className="shadow_loading_container">
                    <div className="shadow_loading">
                        <img className="img_bg" src={loadingIcon} alt=""></img>
                    </div>
                </div> */}

                <div className={shadow ? 'shadow_container_box' : 'shadow_container_box_hide'}>
                    <div className="shadow_container_child">{props.children}</div>
                </div>
            </div>
        </>
    )
})
export default Shadow
