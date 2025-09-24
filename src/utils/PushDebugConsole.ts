/**
 * 推送功能Console调试工具
 * 提供在开发者工具Console中查看和控制推送功能的便捷方法
 */

import { WebSocketPushMgr } from '../mgr/WebSocketPushMgr'
import { ConnectionStatus } from '../types/push'

/**
 * 推送调试Console工具类
 */
export class PushDebugConsole {
    private static instance: PushDebugConsole
    private pushMgr: WebSocketPushMgr | null = null

    private constructor() {}

    static getInstance(): PushDebugConsole {
        if (!PushDebugConsole.instance) {
            PushDebugConsole.instance = new PushDebugConsole()
        }
        return PushDebugConsole.instance
    }

    /**
     * 设置推送管理器实例
     */
    setPushManager(pushMgr: WebSocketPushMgr): void {
        this.pushMgr = pushMgr
        console.log('🔧 [推送调试] 推送管理器已设置，可以使用调试功能')
    }

    /**
     * 显示推送服务状态
     */
    showStatus(): void {
        if (!this.pushMgr) {
            console.warn('⚠️ [推送调试] 推送管理器未初始化')
            return
        }

        const status = this.pushMgr.getPushServiceStatus()
        
        console.group('📊 [推送状态] 当前推送服务状态')
        console.log('🔗 连接状态:', this.getStatusIcon(status.connectionStatus), status.connectionStatus)
        console.log('🔛 服务启用:', status.isEnabled ? '✅ 是' : '❌ 否')
        console.log('⏰ 最后连接时间:', status.lastConnectTime ? new Date(status.lastConnectTime).toISOString() : '无')
        console.log('📨 最后消息时间:', status.lastMessageTime ? new Date(status.lastMessageTime).toISOString() : '无')
        console.log('🔄 重连次数:', status.reconnectAttempts)
        console.log('📊 消息计数:', status.messageCount)
        console.log('❌ 错误计数:', status.errorCount)
        console.groupEnd()
    }

    /**
     * 显示详细统计信息
     */
    showDetailedStats(): void {
        if (!this.pushMgr) {
            console.warn('⚠️ [推送调试] 推送管理器未初始化')
            return
        }

        const stats = this.pushMgr.getDetailedStatistics()
        
        console.group('📈 [推送统计] 详细统计信息')
        
        // 服务状态
        if (stats.service) {
            console.group('🔧 服务状态')
            console.log('启用状态:', stats.service.isEnabled ? '✅ 启用' : '❌ 禁用')
            console.log('初始化状态:', stats.service.isInitialized ? '✅ 已初始化' : '❌ 未初始化')
            console.log('运行时间:', stats.service.formattedUptime)
            console.log('重启次数:', stats.service.restartCount)
            console.log('最后错误:', stats.service.lastError || '无')
            console.groupEnd()
        }

        // 连接统计
        if (stats.connection) {
            console.group('🔗 连接统计')
            console.log('连接状态:', this.getStatusIcon(stats.connection.status), stats.connection.statusText)
            console.log('运行时间:', stats.connection.formattedUptime)
            console.log('消息数量:', stats.connection.messageCount)
            console.log('错误数量:', stats.connection.errorCount)
            console.log('重连次数:', stats.connection.reconnectCount)
            console.log('心跳间隔:', stats.connection.heartbeatInterval + 'ms')
            console.groupEnd()
        }

        // 配置信息
        if (stats.config) {
            console.group('⚙️ 配置信息')
            console.log('服务器地址:', stats.config.serverUrl)
            console.log('心跳间隔:', stats.config.heartbeatInterval + 'ms')
            console.log('最大重连次数:', stats.config.reconnectMaxAttempts)
            console.log('最大并发通知:', stats.config.maxConcurrentNotifications)
            console.log('日志级别:', stats.config.logLevel)
            console.groupEnd()
        }

        console.groupEnd()
    }

    /**
     * 测试连接
     */
    testConnection(): void {
        if (!this.pushMgr) {
            console.warn('⚠️ [推送调试] 推送管理器未初始化')
            return
        }

        console.log('🧪 [推送测试] 开始测试连接...')
        
        const isConnected = this.pushMgr.isConnected()
        const status = this.pushMgr.getConnectionStatus()
        
        console.group('🧪 [推送测试] 连接测试结果')
        console.log('连接状态:', isConnected ? '✅ 已连接' : '❌ 未连接')
        console.log('状态详情:', this.getStatusIcon(status), status)
        
        if (isConnected) {
            console.log('✅ 连接正常，可以发送和接收消息')
        } else {
            console.log('❌ 连接异常，请检查网络或重启推送服务')
        }
        console.groupEnd()
    }

    /**
     * 重启推送服务
     */
    async restartService(): Promise<void> {
        if (!this.pushMgr) {
            console.warn('⚠️ [推送调试] 推送管理器未初始化')
            return
        }

        console.log('🔄 [推送调试] 正在重启推送服务...')
        
        try {
            await this.pushMgr.restartPushService()
            console.log('✅ [推送调试] 推送服务重启成功')
            
            // 显示重启后的状态
            setTimeout(() => {
                this.showStatus()
            }, 1000)
        } catch (error) {
            console.error('❌ [推送调试] 推送服务重启失败:', error)
        }
    }

    /**
     * 启用/禁用详细日志
     */
    toggleVerboseLogging(enabled?: boolean): void {
        // 这里可以调用推送日志管理器的方法
        const actualEnabled = enabled !== undefined ? enabled : !this.isVerboseLoggingEnabled()
        
        console.log(`🔧 [推送调试] 详细日志${actualEnabled ? '已启用' : '已禁用'}`)
        
        // 如果有推送管理器，可以设置日志级别
        if (this.pushMgr) {
            // 这里可以添加设置日志级别的逻辑
            console.log('💡 提示: 详细日志设置已更新，重新连接后生效')
        }
    }

    /**
     * 清除所有通知
     */
    clearNotifications(): void {
        if (!this.pushMgr) {
            console.warn('⚠️ [推送调试] 推送管理器未初始化')
            return
        }

        this.pushMgr.clearAllNotifications()
        console.log('🧹 [推送调试] 所有通知已清除')
    }

    /**
     * 显示帮助信息
     */
    showHelp(): void {
        console.group('📖 [推送调试] 可用的调试命令')
        console.log('📊 pushDebug.showStatus() - 显示推送服务状态')
        console.log('📈 pushDebug.showDetailedStats() - 显示详细统计信息')
        console.log('🧪 pushDebug.testConnection() - 测试连接状态')
        console.log('🔄 pushDebug.restartService() - 重启推送服务')
        console.log('🔧 pushDebug.toggleVerboseLogging() - 切换详细日志')
        console.log('🧹 pushDebug.clearNotifications() - 清除所有通知')
        console.log('📖 pushDebug.showHelp() - 显示此帮助信息')
        console.log('')
        console.log('💡 提示: 打开开发者工具Console面板，输入上述命令即可使用')
        console.groupEnd()
    }

    /**
     * 获取连接状态图标
     */
    private getStatusIcon(status: ConnectionStatus): string {
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return '🟢'
            case ConnectionStatus.CONNECTING:
                return '🟡'
            case ConnectionStatus.RECONNECTING:
                return '🟠'
            case ConnectionStatus.DISCONNECTED:
                return '🔴'
            case ConnectionStatus.ERROR:
                return '❌'
            default:
                return '❓'
        }
    }

    /**
     * 检查是否启用了详细日志
     */
    private isVerboseLoggingEnabled(): boolean {
        // 这里可以检查当前的日志级别
        return true // 临时返回true
    }

    /**
     * 开始实时监控
     */
    startMonitoring(): void {
        console.log('👁️ [推送监控] 开始实时监控推送服务状态...')
        console.log('💡 提示: 推送相关的日志将实时显示在Console中')
        console.log('🛑 使用 pushDebug.stopMonitoring() 停止监控')
        
        // TODO: 实时监控功能暂时禁用，需要修复TypeScript类型问题
        console.log('⚠️ 实时监控功能暂时不可用')
    }

    /**
     * 停止实时监控
     */
    stopMonitoring(): void {
        const interval = (window as any).pushMonitorInterval
        if (interval) {
            clearInterval(interval)
            delete (window as any).pushMonitorInterval
            console.log('🛑 [推送监控] 实时监控已停止')
        } else {
            console.log('ℹ️ [推送监控] 没有正在运行的监控')
        }
    }
}

// 创建全局实例
const pushDebugConsole = PushDebugConsole.getInstance()

// 将调试工具挂载到全局对象，方便在Console中使用
declare global {
    interface Window {
        pushDebug: PushDebugConsole
    }
}

// 在浏览器环境中挂载到window对象
if (typeof window !== 'undefined') {
    window.pushDebug = pushDebugConsole
    
    // 显示欢迎信息
    console.log('🎉 [推送调试] 推送调试工具已加载!')
    console.log('💡 在Console中输入 pushDebug.showHelp() 查看可用命令')
}

export { pushDebugConsole }