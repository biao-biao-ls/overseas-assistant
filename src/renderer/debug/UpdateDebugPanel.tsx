import React, { useState, useEffect } from 'react'
import { ipcRenderer } from 'electron'
import { AppMsg } from '../../base/AppMsg'
import { EMessage } from '../../enum/EMessage'
import { ECommon } from '../../enum/ECommon'

interface UpdateDebugInfo {
    checkTime: string
    requestUrl: string
    requestBody: any
    responseData: any
    error: string | null
    currentVersion: string
    platform: string
}

export const UpdateDebugPanel: React.FC = () => {
    const [debugInfo, setDebugInfo] = useState<UpdateDebugInfo | null>(null)
    const [isChecking, setIsChecking] = useState(false)

    useEffect(() => {
        // 监听调试信息
        const handleMessage = (event: any, msg: AppMsg) => {
            if (msg.msgId === 'update-debug-info') {
                setDebugInfo(msg.data)
                setIsChecking(false)
            } else if (msg.msgId === 'checking-for-update') {
                setIsChecking(true)
            } else if (msg.msgId === 'update-available' || msg.msgId === 'update-not-available' || msg.msgId === 'updateError') {
                setIsChecking(false)
            }
        }

        window[ECommon.ElectronEventListener]?.onMainMsg(handleMessage)

        return () => {
            // 清理监听器
        }
    }, [])

    const handleCheckUpdate = () => {
        setIsChecking(true)
        setDebugInfo(null)
        ipcRenderer.send('checkForUpdates')
    }

    const handleTestElectronUpdater = () => {
        setIsChecking(true)
        // 直接调用 electron-updater 的检查更新
        ipcRenderer.send('test-electron-updater')
    }

    return (
        <div style={{ 
            position: 'fixed', 
            top: '10px', 
            right: '10px', 
            background: 'rgba(0,0,0,0.8)', 
            color: 'white', 
            padding: '15px', 
            borderRadius: '8px',
            fontSize: '12px',
            maxWidth: '400px',
            zIndex: 9999
        }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>🔧 更新调试面板</h3>
            
            <div style={{ marginBottom: '10px' }}>
                <button 
                    onClick={handleCheckUpdate}
                    disabled={isChecking}
                    style={{
                        background: '#2196F3',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: isChecking ? 'not-allowed' : 'pointer',
                        marginRight: '8px'
                    }}
                >
                    {isChecking ? '检查中...' : '🔍 检查更新 (API)'}
                </button>
                
                <button 
                    onClick={handleTestElectronUpdater}
                    disabled={isChecking}
                    style={{
                        background: '#FF9800',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: isChecking ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isChecking ? '检查中...' : '⚡ 测试 electron-updater'}
                </button>
            </div>

            {debugInfo && (
                <div style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    padding: '10px', 
                    borderRadius: '4px',
                    marginTop: '10px'
                }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#FFC107' }}>📊 调试信息</h4>
                    
                    <div><strong>检查时间:</strong> {debugInfo.checkTime}</div>
                    <div><strong>当前版本:</strong> {debugInfo.currentVersion}</div>
                    <div><strong>平台:</strong> {debugInfo.platform}</div>
                    <div><strong>请求URL:</strong> {debugInfo.requestUrl}</div>
                    
                    {debugInfo.error ? (
                        <div style={{ color: '#f44336', marginTop: '8px' }}>
                            <strong>❌ 错误:</strong> {debugInfo.error}
                        </div>
                    ) : (
                        debugInfo.responseData && (
                            <div style={{ marginTop: '8px' }}>
                                <strong>✅ 响应:</strong>
                                <pre style={{ 
                                    background: 'rgba(0,0,0,0.3)', 
                                    padding: '8px', 
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                }}>
                                    {JSON.stringify(debugInfo.responseData, null, 2)}
                                </pre>
                            </div>
                        )
                    )}
                </div>
            )}

            <div style={{ 
                marginTop: '10px', 
                fontSize: '10px', 
                color: '#ccc',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                paddingTop: '8px'
            }}>
                💡 提示: 此面板仅在开发环境显示
            </div>
        </div>
    )
}

export default UpdateDebugPanel