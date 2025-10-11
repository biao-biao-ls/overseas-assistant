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
        console.log('🔄 更新提示组件初始化')
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
            } else if (msg.msgId === 'dev-update-simulation') {
                console.log('🔧 开发环境更新模拟:', msg.data.message)
            } else if (msg.msgId === 'update-installing') {
                console.log('🚀 更新安装中:', msg.data.message)
                setIsDownloading(true) // 显示安装状态
            } else if (msg.msgId === 'update-install-error') {
                console.error('❌ 更新安装失败:', msg.data.message)
                setIsDownloading(false)
                // 可以在这里显示错误提示给用户
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
        console.log('🔄 用户点击更新按钮')
        console.log('📊 当前状态:', {
            isDownloading,
            downloadProgress,
            updateInfo
        })
        
        // 添加用户反馈
        if (isDownloading) {
            console.log('⚠️ 正在下载中，请等待下载完成')
            return
        }
        
        // 发送更新安装请求
        console.log('📤 发送 quitAndInstall 事件到主进程')
        ipcRenderer.send('quitAndInstall')
        
        // 添加超时处理，如果5秒内没有响应，显示提示
        setTimeout(() => {
            console.log('⏰ 更新安装可能需要一些时间，请耐心等待...')
        }, 5000)
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
            if (downloadProgress === 100) {
                return locale.locale_installing || '正在安装...'
            }
            return `${locale.locale_downloading || '下载中'} ${Math.round(downloadProgress)}%`
        }
        return locale.locale_23 || '立即更新'
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
