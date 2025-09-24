import { IpcRendererEvent } from 'electron'
import { EMessage } from '../../enum/EMessage'
const { contextBridge, ipcRenderer } = require('electron')

/**
 * /////////////////////////////////////////////////////////////////////////////////
 * //
 * //                           预加载暴露变量到 window
 * //
 * /////////////////////////////////////////////////////////////////////////////////
 */
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
            ipcRenderer.on(channel, listener)
        },
        removeAllListeners: (channel: string) => {
            ipcRenderer.removeAllListeners(channel)
        },
        invoke: (channel: string, ...args: any[]) => {
            return ipcRenderer.invoke(channel, ...args)
        },
        send: (channel: string, ...args: any[]) => {
            ipcRenderer.send(channel, ...args)
        }
    },
})

contextBridge.exposeInMainWorld('_Electron_Event_Listener_', {
    onAppUnmaximize,
    onUpdateMsgs,
    onMainMsg,
})

// 暴露推送调试工具API
contextBridge.exposeInMainWorld('pushDebugAPI', {
    // 获取推送服务状态
    getPushStatus: () => {
        return ipcRenderer.invoke('get-push-service-status')
    },
    // 获取推送服务统计
    getPushStats: () => {
        return ipcRenderer.invoke('get-push-service-stats')
    },
    // 重启推送服务
    restartPushService: () => {
        return ipcRenderer.invoke('restart-push-service')
    },
    // 清除推送通知
    clearPushNotifications: () => {
        return ipcRenderer.invoke('clear-push-notifications')
    },
    // 监听推送状态更新
    onPushStatusUpdate: (callback: (status: any) => void) => {
        ipcRenderer.on('push-service-status-reply', (event, response) => {
            callback(response.data)
        })
    },
    // 监听推送统计更新
    onPushStatsUpdate: (callback: (stats: any) => void) => {
        ipcRenderer.on('push-service-stats-reply', (event, response) => {
            callback(response.data)
        })
    }
})

// 初始化推送调试工具 - 直接在preload中初始化，确保在所有页面中可用
function initPushDebugInPreload() {
    // 等待DOM加载完成
    const initDebugTools = () => {
        // 创建推送调试工具对象
        const pushDebug = {
            // 显示推送状态
            showStatus: async () => {
                try {
                    const response = await ipcRenderer.invoke('get-push-service-status')
                    if (response?.success) {
                        const status = response.data
                        console.group('📊 [推送状态] 当前推送服务状态')
                        console.log('🔗 连接状态:', status.connectionStatus)
                        console.log('🔛 服务启用:', status.isEnabled ? '✅ 是' : '❌ 否')
                        console.log('⏰ 最后连接时间:', status.lastConnectTime ? new Date(status.lastConnectTime).toISOString() : '无')
                        console.log('📨 最后消息时间:', status.lastMessageTime ? new Date(status.lastMessageTime).toISOString() : '无')
                        console.log('🔄 重连次数:', status.reconnectAttempts)
                        console.log('📊 消息计数:', status.messageCount)
                        console.log('❌ 错误计数:', status.errorCount)
                        console.groupEnd()
                    } else {
                        console.error('❌ 获取推送状态失败:', response?.error)
                    }
                } catch (error) {
                    console.error('❌ 获取推送状态异常:', error)
                }
            },
            
            // 显示详细统计
            showDetailedStats: async () => {
                try {
                    const response = await ipcRenderer.invoke('get-push-service-stats')
                    if (response?.success) {
                        console.group('📈 [推送统计] 详细统计信息')
                        console.log(response.data)
                        console.groupEnd()
                    } else {
                        console.error('❌ 获取推送统计失败:', response?.error)
                    }
                } catch (error) {
                    console.error('❌ 获取推送统计异常:', error)
                }
            },
            
            // 重启推送服务
            restartService: async () => {
                try {
                    console.log('🔄 [推送调试] 正在重启推送服务...')
                    const response = await ipcRenderer.invoke('restart-push-service')
                    if (response?.success) {
                        console.log('✅ [推送调试] 推送服务重启成功')
                    } else {
                        console.error('❌ [推送调试] 推送服务重启失败:', response?.error)
                    }
                } catch (error) {
                    console.error('❌ [推送调试] 推送服务重启异常:', error)
                }
            },
            
            // 清除通知
            clearNotifications: async () => {
                try {
                    const response = await ipcRenderer.invoke('clear-push-notifications')
                    if (response?.success) {
                        console.log('🧹 [推送调试] 所有通知已清除')
                    } else {
                        console.error('❌ [推送调试] 清除通知失败:', response?.error)
                    }
                } catch (error) {
                    console.error('❌ [推送调试] 清除通知异常:', error)
                }
            },
            
            // 调试IPC通信
            debugIPC: async () => {
                try {
                    console.log('🔍 [IPC调试] 正在检查IPC处理器状态...')
                    
                    const response = await ipcRenderer.invoke('debug-push-ipc')
                    
                    if (response?.success) {
                        console.group('🔧 [IPC调试] IPC处理器状态')
                        console.log('📋 已注册的处理器:', response.data.registeredHandlers)
                        console.log('📊 推送管理器状态:', response.data.pushManagerStatus)
                        console.log('⏰ 检查时间:', new Date(response.data.timestamp).toISOString())
                        console.groupEnd()
                    } else {
                        console.error('❌ IPC调试失败:', response?.error || '未知错误')
                    }
                } catch (error) {
                    console.error('❌ IPC调试异常:', error)
                    console.log('💡 [提示] 这可能表示IPC处理器未正确注册')
                }
            },
            
            // 显示帮助
            showHelp: () => {
                console.group('📖 [推送调试] 可用的调试命令')
                console.log('📊 pushDebug.showStatus() - 显示推送服务状态')
                console.log('📈 pushDebug.showDetailedStats() - 显示详细统计信息')
                console.log('🔄 pushDebug.restartService() - 重启推送服务')
                console.log('🧹 pushDebug.clearNotifications() - 清除所有通知')
                console.log('🔍 pushDebug.debugIPC() - 调试IPC通信状态')
                console.log('📖 pushDebug.showHelp() - 显示此帮助信息')
                console.log('')
                console.log('💡 提示: 打开开发者工具Console面板，输入上述命令即可使用')
                console.groupEnd()
            }
        }
        
        // 暴露到全局对象
        contextBridge.exposeInMainWorld('pushDebug', pushDebug)
        contextBridge.exposeInMainWorld('showPushStatus', pushDebug.showStatus)
        contextBridge.exposeInMainWorld('showPushStats', pushDebug.showDetailedStats)
        
        // 显示欢迎信息
        setTimeout(() => {
            console.log('%c🎉 推送调试工具已加载!', 'color: #4CAF50; font-size: 14px; font-weight: bold;')
            console.log('%c💡 快速命令:', 'color: #2196F3; font-weight: bold;')
            console.log('  • showPushStatus() - 查看推送状态')
            console.log('  • showPushStats() - 查看详细统计')
            console.log('  • pushDebug.restartService() - 重启服务')
            console.log('  • pushDebug.showHelp() - 查看所有命令')
        }, 2000)
    }
    
    // 在DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDebugTools)
    } else {
        initDebugTools()
    }
}

// 调用初始化函数
initPushDebugInPreload()

/**
 * /////////////////////////////////////////////////////////////////////////////////
 * //
 * //                                 暴露一些事件
 * //
 * /////////////////////////////////////////////////////////////////////////////////
 */


function onAppUnmaximize(listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    ipcRenderer.removeAllListeners(EMessage.ERenderUnMaximize)
    ipcRenderer.on(EMessage.ERenderUnMaximize, listener)
}

function onUpdateMsgs(listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    ipcRenderer.removeAllListeners('/im/updateMsg')
    ipcRenderer.on('/im/updateMsg', listener)
}

function onMainMsg(listener: (event: IpcRendererEvent, ...args: any[]) => void) {
    ipcRenderer.on(EMessage.ESendToRender, listener)
}
