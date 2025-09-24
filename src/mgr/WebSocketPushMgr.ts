/**
 * WebSocket 推送功能主管理器
 * 统一管理推送功能的所有组件，提供对外接口
 */

import { ConnectionStatus, PushServiceStatus, PushConfig, PushEventType } from '../types/push'
import { PushError } from '../utils/PushError'
import { DEFAULT_PUSH_CONFIG, API_CONSTANTS, LOG_CONSTANTS } from '../config/pushConstants'
import { PushLogger, TokenManager, WebSocketConnection, MessageProcessor, NotificationManager } from './push'
import { PushEventEmitter } from '../utils/PushEventEmitter'
import { PushUtils } from '../utils/pushUtils'
import { AppConfig } from '../config/AppConfig'
import { AppUtil } from '../utils/AppUtil'
// Removed circular import - pushDebugConsole will be set externally

/**
 * WebSocket 推送主管理器类
 * 作为推送功能的统一入口和协调中心
 */
export class WebSocketPushMgr {
    private logger: PushLogger
    private eventEmitter: PushEventEmitter
    private tokenManager: TokenManager
    private connection: WebSocketConnection
    private messageProcessor: MessageProcessor
    private notificationManager: NotificationManager

    private config: PushConfig
    private isEnabled: boolean = false
    private isInitialized: boolean = false
    private isStarting: boolean = false
    private isStopping: boolean = false

    // 服务状态
    private startTime: number = 0
    private lastErrorTime: number = 0
    private lastError: PushError | null = null
    private restartCount: number = 0

    constructor(config?: Partial<PushConfig>) {
        try {
            // 合并配置
            this.config = { ...DEFAULT_PUSH_CONFIG, ...config }

            // 初始化事件发射器
            this.eventEmitter = new PushEventEmitter()

            // 初始化日志管理器
            this.logger = new PushLogger()
            this.logger.setLogLevel(this.config.logLevel)

            // 初始化所有组件
            this.initializeComponents()

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'constructor', 'WebSocket 推送管理器创建完成')
            this.isInitialized = true
            
            // 调试工具将在外部设置
        } catch (error) {
            AppUtil.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'constructor', 'WebSocket 推送管理器创建失败', error)
            throw PushError.connectionError('推送管理器初始化失败', 'INIT_FAILED', error)
        }
    }

    /**
     * 初始化所有组件
     */
    private initializeComponents(): void {
        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'initializeComponents', '开始初始化推送组件')

            // 初始化 Token 管理器
            this.tokenManager = new TokenManager(this.logger, this.eventEmitter)

            // 初始化 WebSocket 连接管理器
            this.connection = new WebSocketConnection(this.logger, this.eventEmitter)
            this.setupConnectionEventListeners()

            // 初始化消息处理器
            this.messageProcessor = new MessageProcessor(this.logger, this.eventEmitter)
            this.setupMessageEventListeners()

            // 初始化通知管理器
            this.notificationManager = new NotificationManager(this.logger, this.eventEmitter)

            // 设置全局错误处理
            this.setupGlobalErrorHandling()

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'initializeComponents', '推送组件初始化完成')
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'initializeComponents',
                '初始化推送组件失败',
                error
            )
            throw error
        }
    }

    /**
     * 设置连接事件监听器
     */
    private setupConnectionEventListeners(): void {
        // 监听连接状态变化
        this.connection.on('status_changed', (newStatus: ConnectionStatus, oldStatus: ConnectionStatus) => {
            this.logger.info(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'onConnectionStatusChanged',
                `连接状态变化: ${oldStatus} -> ${newStatus}`
            )
        })

        // 监听连接成功
        this.connection.on('connected', () => {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'onConnected', 'WebSocket 连接已建立')
            this.eventEmitter.emitServiceStarted({
                timestamp: Date.now(),
                connectionStatus: ConnectionStatus.CONNECTED,
            })
        })

        // 监听连接断开
        this.connection.on('disconnected', (code: number, reason: string) => {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'onDisconnected',
                `WebSocket 连接已断开: ${code} ${reason}`
            )
        })

        // 监听消息接收
        this.connection.on('message', (message: any, rawMessage: string) => {
            this.handleReceivedMessage(message, rawMessage)
        })
    }

    /**
     * 设置消息事件监听器
     */
    private setupMessageEventListeners(): void {
        // 监听心跳消息
        this.eventEmitter.on('heartbeat_message', message => {
            this.logger.debug(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'onHeartbeatMessage', '收到心跳消息')
        })

        // 监听心跳响应
        this.eventEmitter.on('heartbeat_response_message', message => {
            this.logger.debug(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'onHeartbeatResponse', '收到心跳响应')
        })

        // 监听连接确认消息
        this.eventEmitter.on('connection_ack_message', data => {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'onConnectionAck', '收到连接确认消息', {
                message: data.message,
                requestId: data.requestId,
            })
        })

        // 监听系统消息
        this.eventEmitter.on('system_message', message => {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'onSystemMessage', '收到系统消息', {
                messageType: message.messageType,
                requestId: message.requestId,
            })
        })

        // 监听通知显示事件，自动发送ACK确认
        this.eventEmitter.onPushEvent(PushEventType.NOTIFICATION_SHOWN, eventData => {
            const messageId = eventData.data?.messageId
            const title = eventData.data?.title

            if (messageId) {
                this.logger.info(
                    LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                    'onNotificationShown',
                    '通知已显示，发送ACK确认',
                    {
                        messageId: messageId,
                        title: title,
                    }
                )

                try {
                    this.sendMessageAck(messageId, 'delivered')
                } catch (error) {
                    this.logger.error(
                        LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                        'onNotificationShown',
                        '发送ACK确认失败',
                        error
                    )
                }
            } else {
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                    'onNotificationShown',
                    '通知显示事件缺少messageId，无法发送ACK'
                )
            }
        })

        // 监听通知点击事件，自动发送READ_RECEIPT
        this.eventEmitter.onPushEvent(PushEventType.NOTIFICATION_CLICKED, eventData => {
            const messageId = eventData.data?.messageId
            const title = eventData.data?.title

            if (messageId) {
                this.logger.info(
                    LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                    'onNotificationClicked',
                    '通知被点击，发送READ_RECEIPT',
                    {
                        messageId: messageId,
                        title: title,
                    }
                )

                try {
                    this.sendMessageReadReceipt(messageId)
                } catch (error) {
                    this.logger.error(
                        LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                        'onNotificationClicked',
                        '发送READ_RECEIPT失败',
                        error
                    )
                }
            } else {
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                    'onNotificationClicked',
                    '通知点击事件缺少messageId，无法发送READ_RECEIPT'
                )
            }
        })
    }

    /**
     * 设置全局错误处理
     */
    private setupGlobalErrorHandling(): void {
        // 监听推送错误事件
        this.eventEmitter.onPushEvent(PushEventType.CONNECTION_ERROR, eventData => {
            this.handlePushError(eventData.error! as PushError)
        })

        // 监听未捕获的异常
        process.on('uncaughtException', error => {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'uncaughtException', '未捕获的异常', error)
        })

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'unhandledRejection', '未处理的 Promise 拒绝', {
                reason,
                promise,
            })
        })
    }

    /**
     * 处理接收到的消息
     */
    private async handleReceivedMessage(message: any, rawMessage: string): Promise<void> {
        try {
            // 将消息传递给消息处理器
            await this.messageProcessor.processMessage(rawMessage)
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'handleReceivedMessage',
                '处理接收消息失败',
                error
            )
        }
    }

    /**
     * 处理推送错误
     */
    private handlePushError(error: PushError): void {
        this.lastError = error
        this.lastErrorTime = Date.now()

        this.logger.logPushError(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'handlePushError', error)

        // 根据错误类型决定是否重启服务
        if (error.isRetryable() && this.isEnabled) {
            const delay = error.getRetryDelay()
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'handlePushError', `将在 ${delay}ms 后重试`)

            setTimeout(() => {
                if (this.isEnabled) {
                    this.restartPushService()
                }
            }, delay)
        }
    }

    /**
     * 启动推送服务
     */
    async startPushService(): Promise<void> {
        if (this.isStarting || this.isEnabled) {
            this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'startPushService', '推送服务已在运行或正在启动')
            return
        }

        this.isStarting = true

        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'startPushService', '开始启动推送服务')

            // 检查初始化状态
            if (!this.isInitialized) {
                throw PushError.connectionError('推送管理器未初始化', 'NOT_INITIALIZED')
            }

            // 获取服务器配置
            const serverUrl = this.getWebSocketServerUrl()
            if (!serverUrl) {
                throw PushError.connectionError('无法获取 WebSocket 服务器地址', 'NO_SERVER_URL')
            }

            // 获取认证 Token
            const token = await this.tokenManager.getToken()

            // 设置用户ID（从token或配置中获取）
            const userId = this.getUserIdFromToken(token) || 'unknown_user'
            this.connection.setUserId(userId)

            // 建立 WebSocket 连接
            await this.connection.connect(serverUrl, token)

            // 设置连接参数
            this.connection.setHeartbeatInterval(this.config.heartbeatInterval)
            this.connection.setMaxReconnectAttempts(this.config.reconnectMaxAttempts)

            // 标记服务已启动
            this.isEnabled = true
            this.startTime = Date.now()

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'startPushService', '推送服务启动成功')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'startPushService', '启动推送服务失败', error)

            if (error instanceof PushError) {
                throw error
            } else {
                throw PushError.connectionError('启动推送服务异常', 'START_ERROR', error)
            }
        } finally {
            this.isStarting = false
        }
    }

    /**
     * 停止推送服务
     */
    async stopPushService(): Promise<void> {
        if (this.isStopping || !this.isEnabled) {
            this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'stopPushService', '推送服务已停止或正在停止')
            return
        }

        this.isStopping = true

        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'stopPushService', '开始停止推送服务')

            // 标记服务已停止
            this.isEnabled = false

            // 断开 WebSocket 连接
            await this.connection.disconnect()

            // 清除所有通知
            this.notificationManager.clearAllNotifications()

            // 清除 Token
            this.tokenManager.clearToken()

            // 发射服务停止事件
            this.eventEmitter.emitServiceStopped({
                timestamp: Date.now(),
                uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
            })

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'stopPushService', '推送服务已停止')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'stopPushService', '停止推送服务失败', error)
            throw PushError.connectionError('停止推送服务异常', 'STOP_ERROR', error)
        } finally {
            this.isStopping = false
        }
    }

    /**
     * 重启推送服务
     */
    async restartPushService(): Promise<void> {
        try {
            this.restartCount++
            this.logger.info(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'restartPushService',
                `重启推送服务，第 ${this.restartCount} 次`
            )

            // 先停止服务
            await this.stopPushService()

            // 等待一段时间后重新启动
            await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay))

            // 重新启动服务
            await this.startPushService()

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'restartPushService', '推送服务重启成功')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'restartPushService', '重启推送服务失败', error)
            throw error
        }
    }

    /**
     * 从 Token 中提取用户ID
     */
    private getUserIdFromToken(token: string): string | null {
        try {
            // 如果是 JWT token，解析获取用户ID
            if (token && token.includes('.')) {
                const payload = token.split('.')[1]
                const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
                return decoded.userId || decoded.sub || decoded.user_id || null
            }
            return null
        } catch (error) {
            this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'getUserIdFromToken', '解析token失败', error)
            return null
        }
    }

    /**
     * 获取 WebSocket 服务器 URL
     */
    private getWebSocketServerUrl(): string {
        try {
            const envConfig = AppConfig.getEnvConfig()
            const baseUrl = envConfig.IM_URL

            if (!baseUrl) {
                throw new Error('无法获取基础服务器地址')
            }

            // 构建 WebSocket URL
            const wsUrl = baseUrl.replace(/^https?:/, 'wss:') + API_CONSTANTS.WEBSOCKET_ENDPOINT

            this.logger.info(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'getWebSocketServerUrl',
                `WebSocket 服务器地址: ${wsUrl}`
            )
            // return 'ws://localhost:8080'
            return wsUrl
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'getWebSocketServerUrl',
                '获取 WebSocket 服务器地址失败',
                error
            )
            throw error
        }
    }

    /**
     * 检查服务是否已连接
     */
    isConnected(): boolean {
        return this.connection && this.connection.isConnected()
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus(): ConnectionStatus {
        return this.connection ? this.connection.getConnectionStatus() : ConnectionStatus.DISCONNECTED
    }

    /**
     * 获取推送服务状态
     */
    getPushServiceStatus(): PushServiceStatus {
        const connectionStatus = this.getConnectionStatus()
        const connectionStats = this.connection ? this.connection.getConnectionStatistics() : null

        return {
            connectionStatus: connectionStatus,
            isEnabled: this.isEnabled,
            lastConnectTime: connectionStats?.connectTime,
            lastMessageTime: connectionStats?.lastMessageTime,
            reconnectAttempts: connectionStats?.reconnectAttempts || 0,
            messageCount: connectionStats?.messageCount || 0,
            errorCount: connectionStats?.errorCount || 0,
        }
    }

    /**
     * 获取详细统计信息
     */
    getDetailedStatistics(): any {
        const now = Date.now()
        const uptime = this.startTime > 0 ? now - this.startTime : 0

        return {
            // 服务状态
            service: {
                isEnabled: this.isEnabled,
                isInitialized: this.isInitialized,
                isStarting: this.isStarting,
                isStopping: this.isStopping,
                startTime: this.startTime,
                uptime: uptime,
                formattedUptime: PushUtils.formatDuration(uptime),
                restartCount: this.restartCount,
                lastErrorTime: this.lastErrorTime,
                lastError: this.lastError ? this.lastError.getShortDescription() : null,
            },

            // 连接统计
            connection: this.connection ? this.connection.getConnectionStatistics() : null,

            // Token 统计
            token: this.tokenManager ? this.tokenManager.getTokenStatistics() : null,

            // 消息统计
            message: this.messageProcessor ? this.messageProcessor.getMessageStatistics() : null,

            // 通知统计
            notification: this.notificationManager ? this.notificationManager.getNotificationStatistics() : null,

            // 日志统计
            log: this.logger ? this.logger.getLogStatistics() : null,

            // 配置信息
            config: {
                serverUrl: this.getWebSocketServerUrl(),
                heartbeatInterval: this.config.heartbeatInterval,
                reconnectMaxAttempts: this.config.reconnectMaxAttempts,
                maxConcurrentNotifications: this.config.maxConcurrentNotifications,
                logLevel: this.config.logLevel,
            },
        }
    }

    /**
     * 发送消息送达确认 (ACK)
     */
    sendMessageAck(messageId: string, status: 'delivered' | 'failed' = 'delivered'): void {
        try {
            if (!this.isEnabled || !this.connection) {
                throw PushError.connectionError('推送服务未启用或连接未建立', 'SERVICE_NOT_AVAILABLE')
            }

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'sendMessageAck', '发送消息送达确认', {
                messageId,
                status,
            })

            this.connection.sendAck(messageId, status)
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'sendMessageAck', '发送消息送达确认失败', error)
            throw error
        }
    }

    /**
     * 发送消息已读回执 (READ_RECEIPT)
     */
    sendMessageReadReceipt(messageId: string): void {
        try {
            if (!this.isEnabled || !this.connection) {
                throw PushError.connectionError('推送服务未启用或连接未建立', 'SERVICE_NOT_AVAILABLE')
            }

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'sendMessageReadReceipt', '发送消息已读回执', {
                messageId,
            })

            this.connection.sendReadReceipt(messageId)
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR,
                'sendMessageReadReceipt',
                '发送消息已读回执失败',
                error
            )
            throw error
        }
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<PushConfig>): void {
        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'updateConfig', '更新推送配置', newConfig)

            // 合并新配置
            this.config = { ...this.config, ...newConfig }

            // 更新各组件配置
            if (newConfig.logLevel) {
                this.logger.setLogLevel(newConfig.logLevel)
            }

            if (newConfig.heartbeatInterval && this.connection) {
                this.connection.setHeartbeatInterval(newConfig.heartbeatInterval)
            }

            if (newConfig.reconnectMaxAttempts && this.connection) {
                this.connection.setMaxReconnectAttempts(newConfig.reconnectMaxAttempts)
            }

            if (newConfig.maxConcurrentNotifications && this.notificationManager) {
                this.notificationManager.setMaxConcurrentNotifications(newConfig.maxConcurrentNotifications)
            }

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'updateConfig', '推送配置更新完成')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'updateConfig', '更新推送配置失败', error)
            throw error
        }
    }

    /**
     * 强制刷新 Token
     */
    async refreshToken(): Promise<void> {
        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'refreshToken', '强制刷新 Token')

            const newToken = await this.tokenManager.forceRefresh()

            // 如果连接已建立，需要重新连接以使用新 Token
            if (this.isConnected()) {
                const serverUrl = this.getWebSocketServerUrl()
                const userId = this.getUserIdFromToken(newToken) || 'unknown_user'
                this.connection.setUserId(userId)
                await this.connection.connect(serverUrl, newToken)
            }

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'refreshToken', 'Token 刷新完成')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'refreshToken', 'Token 刷新失败', error)
            throw error
        }
    }

    /**
     * 清除所有通知
     */
    clearAllNotifications(): void {
        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'clearAllNotifications', '清除所有通知')

            if (this.notificationManager) {
                this.notificationManager.clearAllNotifications()
            }
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'clearAllNotifications', '清除通知失败', error)
        }
    }

    /**
     * 重置所有统计信息
     */
    resetAllStatistics(): void {
        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'resetAllStatistics', '重置所有统计信息')

            // 重置各组件统计
            if (this.connection) {
                this.connection.resetStatistics()
            }

            if (this.messageProcessor) {
                this.messageProcessor.resetStatistics()
            }

            if (this.notificationManager) {
                this.notificationManager.resetStatistics()
            }

            // 重置服务统计
            this.restartCount = 0
            this.lastErrorTime = 0
            this.lastError = null

            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'resetAllStatistics', '统计信息重置完成')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'resetAllStatistics', '重置统计信息失败', error)
        }
    }

    /**
     * 销毁推送管理器
     */
    async destroy(): Promise<void> {
        try {
            this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'destroy', 'WebSocket 推送管理器销毁开始')

            // 停止推送服务
            if (this.isEnabled) {
                await this.stopPushService()
            }

            // 销毁所有组件
            if (this.notificationManager) {
                this.notificationManager.destroy()
            }

            if (this.messageProcessor) {
                this.messageProcessor.destroy()
            }

            if (this.connection) {
                this.connection.destroy()
            }

            if (this.tokenManager) {
                this.tokenManager.destroy()
            }

            if (this.eventEmitter) {
                this.eventEmitter.cleanup()
            }

            // 重置状态
            this.isEnabled = false
            this.isInitialized = false
            this.isStarting = false
            this.isStopping = false
            this.startTime = 0

            if (this.logger) {
                this.logger.info(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'destroy', 'WebSocket 推送管理器已销毁')
                this.logger.destroy()
            }
        } catch (error) {
            AppUtil.error(LOG_CONSTANTS.COMPONENT_NAMES.PUSH_MGR, 'destroy', '销毁推送管理器失败', error)
        }
    }
}
