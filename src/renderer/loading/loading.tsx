import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import '../style.css'
import './loading.css'

import loadingIcon from '../../../assets/eda-loading.svg'


const Loading = (): JSX.Element => {
    return (
        <div className="win_container">
            <div className="load_loading_container">
                <div className="load_loading">
                    <img className="img_bg" src={loadingIcon} alt=""></img>
                </div>
            </div>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <Loading />
    </React.StrictMode>,
    document.getElementById('root')
)
