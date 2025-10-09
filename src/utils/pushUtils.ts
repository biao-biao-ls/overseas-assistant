/**
 * WebSocket 推送功能工具方法集合
 */

import { WebSocketMessage, ParsedMessage, MultiLanguageContent, ConnectionStatus } from '../types/push'
import { AppConfig } from '../config/AppConfig'

/**
 * 推送工具类
 * 提供推送功能相关的通用工具方法
 */
export class PushUtils {
    /**
     * 验证 WebSocket 消息格式
     */
    static validateMessage(message: any): message is WebSocketMessage {
        if (!message || typeof message !== 'object') {
            return false
        }

        // 检查消息类型字段
        if (typeof message.messageType !== 'string') {
            return false
        }

        // 心跳消息的特殊格式验证
        const isHeartbeatMessage = message.messageType === 'HEARTBEAT' || message.messageType === 'HEARTBEAT_RESPONSE'

        if (isHeartbeatMessage) {
            // 心跳消息可能有不同的结构，更宽松的验证
            // 只要有 messageType 就认为是有效的心跳消息
            return true
        }

        // 标准消息格式验证
        const hasBasicFields = typeof message.timestamp === 'number' && typeof message.requestId === 'string'

        if (!hasBasicFields) {
            return false
        }

        // 非心跳消息需要 data 和 priority 字段
        return typeof message.priority === 'number' && message.data && typeof message.data === 'object'
    }

    /**
     * 解析 JSON 消息
     */
    static parseJsonMessage(rawMessage: string): any | null {
        try {
            return JSON.parse(rawMessage)
        } catch (error) {
            return null
        }
    }

    /**
     * 生成请求 ID
     */
    static generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * 生成消息 ID
     */
    static generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * 获取当前语言设置
     */
    static getCurrentLanguage(): string {
        try {
            // 从应用配置获取当前语言
            return AppConfig.getCurrentLanguage()
        } catch (error) {
            // 如果获取失败，返回默认语言
            console.warn('获取当前语言失败，使用默认语言:', error)
            return 'en'
        }
    }

    /**
     * 从多语言内容中获取当前语言的文本
     */
    static getLocalizedText(
        multiLanguage: MultiLanguageContent | undefined,
        fallbackTitle?: string,
        fallbackContent?: string
    ): { title: string; content: string } {
        const currentLang = AppConfig.config.language

        if (multiLanguage) {
            // 语言代码映射表 - 将应用语言代码映射到消息数据中的语言键
            // 根据需求：zh-Hant -> hk, ko -> kr, ja -> jp
            const languageMapping: { [key: string]: string[] } = {
                'zh-CN': ['zh-CN', 'cn', 'zh', 'chinese'],
                'hk': ['hk', 'zh-Hant', 'zh-HK', 'traditional-chinese'],
                'en': ['en', 'en-US', 'english'],
                'jp': ['jp', 'ja', 'japanese'],
                'kr': ['kr', 'ko', 'korean'],
                'de': ['de', 'german'],
                'pt': ['pt', 'portuguese'],
                'fr': ['fr', 'french'],
                'es': ['es', 'spanish'],
            }

            // 获取当前语言的可能键值
            const possibleKeys = languageMapping[currentLang] || [currentLang]

            // 尝试匹配语言内容
            for (const key of possibleKeys) {
                if (multiLanguage[key]) {
                    return {
                        title: multiLanguage[key].title || fallbackTitle || '通知',
                        content: multiLanguage[key].content || fallbackContent || '您有新消息',
                    }
                }
            }

            // 如果没有找到当前语言，尝试使用英文作为备选
            const englishKeys = ['en', 'en-US', 'english']
            for (const key of englishKeys) {
                if (multiLanguage[key]) {
                    return {
                        title: multiLanguage[key].title || fallbackTitle || '通知',
                        content: multiLanguage[key].content || fallbackContent || '您有新消息',
                    }
                }
            }

            // 如果英文也没有，使用第一个可用的语言
            const availableKeys = Object.keys(multiLanguage)
            if (availableKeys.length > 0) {
                const firstKey = availableKeys[0]
                const firstLangContent = multiLanguage[firstKey]
                if (firstLangContent) {
                    return {
                        title: firstLangContent.title || fallbackTitle || '通知',
                        content: firstLangContent.content || fallbackContent || '您有新消息',
                    }
                }
            }
        }

        // 使用备选文本
        return {
            title: fallbackTitle || '通知',
            content: fallbackContent || '您有新消息',
        }
    }

    /**
     * 计算重连延迟时间（指数退避算法）
     */
    static calculateReconnectDelay(
        attempt: number,
        baseDelay: number = 1000,
        maxDelay: number = 30000,
        multiplier: number = 1.5,
        jitter: number = 0.1
    ): number {
        // 指数退避
        let delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay)

        // 添加随机抖动，避免雷群效应
        const jitterAmount = delay * jitter
        delay += (Math.random() - 0.5) * 2 * jitterAmount

        return Math.max(delay, baseDelay)
    }

    /**
     * 检查 Token 是否即将过期
     */
    static isTokenExpiringSoon(
        expireTime: number,
        threshold: number = 300000 // 5分钟
    ): boolean {
        const now = Date.now()
        return expireTime - now <= threshold
    }

    /**
     * 格式化时间戳为可读字符串
     */
    static formatTimestamp(timestamp: number): string {
        return new Date(timestamp).toLocaleString('zh-CN')
    }

    /**
     * 计算两个时间戳之间的持续时间
     */
    static calculateDuration(startTime: number, endTime?: number): number {
        return (endTime || Date.now()) - startTime
    }

    /**
     * 格式化持续时间为可读字符串
     */
    static formatDuration(duration: number): string {
        const seconds = Math.floor(duration / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)

        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`
        } else if (minutes > 0) {
            return `${minutes}分钟${seconds % 60}秒`
        } else {
            return `${seconds}秒`
        }
    }

    /**
     * 验证 URL 格式
     */
    static isValidUrl(url: string): boolean {
        try {
            new URL(url)
            return true
        } catch {
            return false
        }
    }

    /**
     * 安全地截断字符串
     */
    static truncateString(str: string, maxLength: number): string {
        if (str.length <= maxLength) {
            return str
        }
        return str.substring(0, maxLength - 3) + '...'
    }

    /**
     * 深度克隆对象
     */
    static deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime()) as unknown as T
        }

        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item)) as unknown as T
        }

        if (typeof obj === 'object') {
            const cloned = {} as T
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key])
                }
            }
            return cloned
        }

        return obj
    }

    /**
     * 防抖函数
     */
    static debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: NodeJS.Timeout

        return (...args: Parameters<T>) => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => func.apply(null, args), delay)
        }
    }

    /**
     * 节流函数
     */
    static throttle<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
        let lastCall = 0

        return (...args: Parameters<T>) => {
            const now = Date.now()
            if (now - lastCall >= delay) {
                lastCall = now
                func.apply(null, args)
            }
        }
    }

    /**
     * 重试执行函数
     */
    static async retry<T>(fn: () => Promise<T>, maxAttempts: number = 3, delay: number = 1000): Promise<T> {
        let lastError: Error

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn()
            } catch (error) {
                lastError = error as Error

                if (attempt === maxAttempts) {
                    throw lastError
                }

                // 等待指定时间后重试
                await new Promise(resolve => setTimeout(resolve, delay * attempt))
            }
        }

        throw lastError!
    }

    /**
     * 获取连接状态的中文描述
     */
    static getConnectionStatusText(status: ConnectionStatus): string {
        switch (status) {
            case ConnectionStatus.DISCONNECTED:
                return '已断开'
            case ConnectionStatus.CONNECTING:
                return '连接中'
            case ConnectionStatus.CONNECTED:
                return '已连接'
            case ConnectionStatus.RECONNECTING:
                return '重连中'
            case ConnectionStatus.ERROR:
                return '连接错误'
            default:
                return '未知状态'
        }
    }

    /**
     * 检查内存使用情况
     */
    static getMemoryUsage(): NodeJS.MemoryUsage {
        return process.memoryUsage()
    }

    /**
     * 格式化内存大小
     */
    static formatMemorySize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB']
        let size = bytes
        let unitIndex = 0

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`
    }
}
