import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import jlconeLogon from '../../../assets/jlcone-logo.png'

import '../style.css'
import './updateTip.css'
import { EMessage } from '../../enum/EMessage'
import Shadow from '../components/shadow/shadow'
import { ECommon } from '../../enum/ECommon'
import { AppMsg } from '../../base/AppMsg'
import { NormalButton } from '../components/normalButton/NormalButton'

const { ipcRenderer } = (window as any)['electron'] as any

interface UpdateInfo {
    hasUpdate: boolean
    forceUpdate: boolean
    version: string
    updateContent: string
    updateUrl: string
    platform: string
}

const App = (): JSX.Element => {
    const [locale, setLocale] = useState({} as any)
    const refShadow = useRef(null)
    const [version, setVersion] = useState('1.0.0')
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [isDownloading, setIsDownloading] = useState(false)

    const updateSetting = () => {
        ipcRenderer
            .invoke(EMessage.EMainSettingGetUserConfig)
            .then(dictConfig => {
                const { updateInfo, version: currentVersion } = dictConfig || {}

                if (updateInfo) {
                    setUpdateInfo(updateInfo)
                    if (updateInfo.version) {
                        setVersion(updateInfo.version)
                    }
                } else if (currentVersion) {
                    setVersion(currentVersion)
                }
            })
            .catch(error => {
                console.error('Failed to get configuration:', error)
            })

        ipcRenderer
            .invoke(EMessage.EMainGetLocale)
            .then(langMap => {
                setLocale(langMap)
            })
            .catch(error => {
                console.error('Failed to get language configuration:', error)
            })
    }

    useEffect(() => {
        updateSetting()

        setTimeout(() => {
            updateSetting()
        }, 200)

        const messageHandler = (_event: any, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderUpdateSetting) {
                updateSetting()
            } else if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                refShadow.current.showShadow(bWin10)
            } else if (msg.msgId === 'force-update-available') {
                setUpdateInfo(msg.data)
                if (msg.data && msg.data.version) {
                    setVersion(msg.data.version)
                }
            } else if (msg.msgId === 'update-available') {
                setUpdateInfo(msg.data)
                if (msg.data && msg.data.version) {
                    setVersion(msg.data.version)
                }
            } else if (msg.msgId === 'download-progress') {
                setIsDownloading(true)
                setDownloadProgress(msg.data.percent || 0)
            } else if (msg.msgId === 'update-downloaded') {
                setIsDownloading(false)
                setDownloadProgress(100)
                if (msg.data && msg.data.version) {
                    setUpdateInfo(msg.data)
                    setVersion(msg.data.version)
                }
            }
        }

        ipcRenderer.on(EMessage.ESendToRender, messageHandler)

        if (window[ECommon.ElectronEventListener] && window[ECommon.ElectronEventListener].onMainMsg) {
            window[ECommon.ElectronEventListener].onMainMsg(messageHandler, [])
        }

        return () => {
            ipcRenderer.removeListener(EMessage.ESendToRender, messageHandler)
        }
    }, [])

    const handleUpdate = () => {
        ipcRenderer.send('quitAndInstall')
    }

    const getUpdateTitle = () => {
        if (updateInfo?.forceUpdate) {
            return locale.locale_force_update_title || 'Force Update'
        }
        return locale.locale_update_title || 'Version Update'
    }

    const getUpdateMessage = () => {
        if (updateInfo?.forceUpdate) {
            return (
                locale.locale_force_update_message ||
                'A new version is available and must be updated to continue using the application'
            )
        }
        return locale.locale_update_message || 'A new version is available and it is recommended to update immediately'
    }

    const getUpdateButtonText = () => {
        if (isDownloading) {
            return `${locale.locale_downloading || 'Downloading'} ${Math.round(downloadProgress)}%`
        }
        return locale.locale_23 || 'Update Now'
    }

    return (
        <div className="win_container login_shadow_container">
            <Shadow ref={refShadow}>
                <div className="login_container" id="login_container">
                    <div className="login_nav_bar">
                        <img width="141px" height="30px" src={jlconeLogon} alt="jlcone logo" />
                    </div>

                    <div className="update-content">
                        <div className="update-title">{getUpdateTitle()}</div>

                        <div className="jlcone-update-tip">
                            <span>JLCONE</span>&nbsp;
                            <span className="update-tip-version">
                                V<span>{version}</span>
                            </span>
                        </div>

                        <div className="update-message">{getUpdateMessage()}</div>

                        {updateInfo?.updateContent && (
                            <div className="update-description">
                                <div className="update-description-title">
                                    {locale.locale_update_content || 'Update Content:'}
                                </div>
                                <div className="update-description-content">{updateInfo.updateContent}</div>
                            </div>
                        )}

                        {isDownloading && (
                            <div className="download-progress">
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
                                </div>
                                <div className="progress-text">{Math.round(downloadProgress)}%</div>
                            </div>
                        )}
                    </div>

                    <div className="jlcone-btn-line">
                        <NormalButton
                            text={getUpdateButtonText()}
                            height="40px"
                            width="160px"
                            rounded={true}
                            type="primary"
                            disabled={isDownloading}
                            onClick={handleUpdate}
                        />
                    </div>
                </div>
            </Shadow>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
)
