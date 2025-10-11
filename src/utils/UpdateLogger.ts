import { AppUtil } from './AppUtil'
import { MacOSCompatibility } from './MacOSCompatibility'

/**
 * 更新日志记录器
 * 专门用于记录和调试更新过程中的问题
 */
export class UpdateLogger {
    private static logEntries: Array<{
        timestamp: string
        level: 'info' | 'warn' | 'error'
        category: string
        message: string
        data?: any
    }> = []

    /**
     * 记录信息日志
     */
    public static info(category: string, message: string, data?: any): void {
        this.addLog('info', category, message, data)
        AppUtil.info('UpdateLogger', category, message, data)
    }

    /**
     * 记录警告日志
     */
    public static warn(category: string, message: string, data?: any): void {
        this.addLog('warn', category, message, data)
        AppUtil.warn('UpdateLogger', category, message, data)
    }

    /**
     * 记录错误日志
     */
    public static error(category: string, message: string, data?: any): void {
        this.addLog('error', category, message, data)
        AppUtil.error('UpdateLogger', category, message, data)
    }

    /**
     * 添加日志条目
     */
    private static addLog(level: 'info' | 'warn' | 'error', category: string, message: string, data?: any): void {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data
        }

        this.logEntries.push(entry)
        
        // 保持最近 100 条日志
        if (this.logEntries.length > 100) {
            this.logEntries.shift()
        }

        // 控制台输出
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️'
        console.log(`${prefix} [${category}] ${message}`, data ? data : '')
    }

    /**
     * 记录系统兼容性信息
     */
    public static logSystemInfo(): void {
        const systemInfo = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            osRelease: require('os').release()
        }

        if (process.platform === 'darwin') {
            const macOSVersion = MacOSCompatibility.getMacOSVersion()
            const isOld = MacOSCompatibility.isOldMacOS()
            const isVeryOld = MacOSCompatibility.isVeryOldMacOS()
            
            systemInfo['macOSVersion'] = macOSVersion
            systemInfo['isOldMacOS'] = isOld
            systemInfo['isVeryOldMacOS'] = isVeryOld
        }

        this.info('system', '系统信息', systemInfo)
    }

    /**
     * 记录更新器配置信息
     */
    public static logUpdaterConfig(autoUpdater: any): void {
        const config = {
            autoDownload: autoUpdater.autoDownload,
            autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
            allowPrerelease: autoUpdater.allowPrerelease,
            allowDowngrade: autoUpdater.allowDowngrade,
            feedURL: autoUpdater.getFeedURL ? autoUpdater.getFeedURL() : 'unknown'
        }

        this.info('updater-config', '更新器配置', config)
    }

    /**
     * 记录更新事件
     */
    public static logUpdateEvent(eventName: string, data?: any): void {
        this.info('update-event', `更新事件: ${eventName}`, data)
    }

    /**
     * 记录更新错误
     */
    public static logUpdateError(error: Error, context?: string): void {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context: context || 'unknown',
            timestamp: new Date().toISOString()
        }

        this.error('update-error', '更新错误', errorInfo)
    }

    /**
     * 获取所有日志条目
     */
    public static getAllLogs(): typeof UpdateLogger.logEntries {
        return [...this.logEntries]
    }

    /**
     * 获取错误日志
     */
    public static getErrorLogs(): typeof UpdateLogger.logEntries {
        return this.logEntries.filter(entry => entry.level === 'error')
    }

    /**
     * 导出日志到文件
     */
    public static async exportLogs(): Promise<string> {
        try {
            const { app } = require('electron')
            const path = require('path')
            const fs = require('fs')

            // 确保 app 已经初始化
            if (!app.isReady()) {
                throw new Error('App is not ready yet, cannot export logs')
            }

            const logsDir = path.join(app.getPath('userData'), 'logs')
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true })
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const filename = `update-logs-${timestamp}.json`
            const filepath = path.join(logsDir, filename)

            const exportData = {
                exportTime: new Date().toISOString(),
                systemInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    electronVersion: process.versions.electron,
                    osRelease: require('os').release()
                },
                logs: this.logEntries
            }

            fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2))
            
            this.info('export', `日志已导出到: ${filepath}`)
            return filepath
        } catch (error) {
            this.error('export', '导出日志失败', error)
            throw error
        }
    }

    /**
     * 清除所有日志
     */
    public static clearLogs(): void {
        this.logEntries = []
        this.info('system', '日志已清除')
    }
}