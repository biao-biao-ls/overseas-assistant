/**
 * WebSocket 连接管理器
 * 负责 WebSocket 连接的建立、维护、重连和心跳管理
 */

// WebSocket 类型定义（兼容 ws 模块）
interface WebSocketInterface {
    readyState: number
    url: string
    on(event: 'open', listener: () => void): this
    on(event: 'close', listener: (code: number, reason: string) => void): this
    on(event: 'message', listener: (data: Buffer | string) => void): this
    on(event: 'error', listener: (error: Error) => void): this
    send(data: any): void
    close(code?: number, reason?: string): void
    terminate(): void
    removeAllListeners(event?: string): this
}

// 动态导入 WebSocket 模块，兼容 Electron 打包环境
const getWebSocket = (): new (url: string, protocols?: string[], options?: any) => WebSocketInterface => {
    try {
        return require('ws')
    } catch (error) {
        console.error('Failed to load ws module:', error)
        throw new Error('WebSocket module is required but not available')
    }
}
import { EventEmitter } from 'events'
import { ConnectionStatus, ConnectionOptions, MessageType } from '../../types/push'
import { PushError } from '../../utils/PushError'
import {
    WEBSOCKET_CONSTANTS,
    RECONNECT_CONSTANTS,
    MESSAGE_CONSTANTS,
    LOG_CONSTANTS,
    HEARTBEAT_CONSTANTS,
} from '../../config/pushConstants'

// WebSocket 状态常量
const WS_READY_STATE = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
} as const
import { PushLogger } from './PushLogger'
import { PushEventEmitter } from '../../utils/PushEventEmitter'
import { PushUtils } from '../../utils/pushUtils'

/**
 * WebSocket 连接管理器类
 * 继承自 EventEmitter，提供事件驱动的连接管理
 */
export class WebSocketConnection extends EventEmitter {
    private logger: PushLogger
    private pushEventEmitter: PushEventEmitter
    private ws: WebSocketInterface | null = null
    private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
    private currentUrl: string = ''
    private currentToken: string = ''

    // 重连相关
    private reconnectAttempts: number = 0
    private maxReconnectAttempts: number = 5
    private reconnectTimer: NodeJS.Timeout | null = null
    private isReconnecting: boolean = false

    // 心跳相关
    private heartbeatTimer: NodeJS.Timeout | null = null
    private heartbeatInterval: number = HEARTBEAT_CONSTANTS.DEFAULT_INTERVAL
    private lastHeartbeatTime: number = 0
    private heartbeatTimeoutTimer: NodeJS.Timeout | null = null
    private heartbeatFailureCount: number = 0 // 心跳发送失败计数
    
    // 自适应心跳
    private consecutiveCloseCount: number = 0 // 连续关闭次数
    private adaptiveHeartbeatEnabled: boolean = HEARTBEAT_CONSTANTS.ADAPTIVE_HEARTBEAT

    // 连接统计
    private connectTime: number = 0
    private lastMessageTime: number = 0
    private messageCount: number = 0
    private errorCount: number = 0
    private reconnectCount: number = 0

    // 用户信息
    private userId: string = '' // 用户ID，用于心跳消息

    constructor(logger: PushLogger, pushEventEmitter: PushEventEmitter) {
        super()
        this.logger = logger
        this.pushEventEmitter = pushEventEmitter
        this.initializeConnection()
    }

    /**
     * 初始化连接管理器
     */
    private initializeConnection(): void {
        try {
            this.logger.logConnectionEvent('initializeConnection', 'WebSocket 连接管理器初始化开始')

            // 设置最大监听器数量
            this.setMaxListeners(20)

            this.logger.logConnectionEvent('initializeConnection', 'WebSocket 连接管理器初始化完成')
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION,
                'initializeConnection',
                '连接管理器初始化失败',
                error
            )
            throw PushError.connectionError('连接管理器初始化失败', 'INIT_FAILED', error)
        }
    }

    /**
     * 建立 WebSocket 连接
     */
    async connect(url: string, token: string, options?: Partial<ConnectionOptions>): Promise<void> {
        try {
            this.logger.logConnectionEvent('connect', `开始建立 WebSocket 连接: ${url}`)

            // 如果已经连接，先断开
            if (this.isConnected()) {
                await this.disconnect()
            }

            // 更新连接状态
            this.updateConnectionStatus(ConnectionStatus.CONNECTING)

            // 保存连接参数
            this.currentUrl = url
            this.currentToken = token

            // 创建 WebSocket 连接
            await this.createWebSocketConnection(url, token, options)
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'connect', '建立连接失败', error)
            this.updateConnectionStatus(ConnectionStatus.ERROR)
            this.errorCount++

            const pushError = PushError.connectionError('建立 WebSocket 连接失败', 'CONNECT_FAILED', error)
            this.pushEventEmitter.emitConnectionError(pushError)
            throw pushError
        }
    }

    /**
     * 创建 WebSocket 连接
     */
    private async createWebSocketConnection(
        url: string,
        token: string,
        options?: Partial<ConnectionOptions>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // 构建 WebSocket URL，添加 token 参数
                const wsUrl = this.buildWebSocketUrl(url, token)

                // 创建 WebSocket 实例
                const WebSocketClass = getWebSocket()
                this.ws = new WebSocketClass(wsUrl, options?.protocols, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'JLCAssistant/1.0.1',
                        ...options?.headers,
                    },
                    handshakeTimeout: 10000, // 10秒握手超时
                    perMessageDeflate: false, // 禁用压缩以提高性能
                })

                // 设置连接事件监听器
                this.setupWebSocketEventListeners(resolve, reject)
            } catch (error) {
                reject(error)
            }
        })
    }

    /**
     * 构建 WebSocket URL
     */
    private buildWebSocketUrl(baseUrl: string, token: string): string {
        try {
            const url = new URL(baseUrl)

            // 确保使用 WSS 协议
            if (url.protocol === 'http:') {
                url.protocol = 'ws:'
            } else if (url.protocol === 'https:') {
                url.protocol = 'wss:'
            }

            // 添加 token 参数
            const timestamp = Date.now().toString()
            url.searchParams.set('token', token)
            url.searchParams.set('timestamp', timestamp)

            const finalUrl = url.toString()

            // 打印连接信息
            console.log('🔗 [WebSocket连接] 准备建立连接:')
            console.log('🔗 基础URL:', baseUrl)
            console.log('🔗 协议:', url.protocol)
            console.log('🔗 主机:', url.host)
            console.log('🔗 路径:', url.pathname)
            console.log('🔗 Token:', token.substring(0, 20) + '...' + token.substring(token.length - 10))
            console.log('🔗 时间戳:', timestamp, '(' + new Date(parseInt(timestamp)).toISOString() + ')')
            console.log('🔗 完整URL:', finalUrl)
            console.log('='.repeat(80))

            return finalUrl
        } catch (error) {
            console.log('❌ [WebSocket连接] 构建URL失败:', error.message)
            throw PushError.connectionError('构建 WebSocket URL 失败', 'INVALID_URL', error)
        }
    }

    /**
     * 设置 WebSocket 事件监听器
     */
    private setupWebSocketEventListeners(resolve: Function, reject: Function): void {
        if (!this.ws) {
            reject(new Error('WebSocket 实例不存在'))
            return
        }

        // 连接打开事件
        this.ws.on('open', () => {
            this.connectTime = Date.now()
            
            // 详细打印连接成功信息
            console.group('✅ [WebSocket连接] 连接已成功建立!')
            console.log('🔗 连接URL:', this.currentUrl)
            console.log('⏰ 连接时间:', new Date(this.connectTime).toISOString())
            console.log('👤 用户ID:', this.userId || 'unknown_user')
            console.log('🔄 重连次数重置为:', 0)
            console.log('📊 连接状态:', 'CONNECTED')
            console.log('💓 心跳间隔:', this.heartbeatInterval + 'ms')
            console.log('🚀 即将启动心跳保活机制...')
            console.groupEnd()
            
            this.logger.logConnectionEvent('onOpen', 'WebSocket 连接已建立')
            this.reconnectAttempts = 0
            this.consecutiveCloseCount = 0 // 重置连续关闭计数
            this.updateConnectionStatus(ConnectionStatus.CONNECTED)

            // 启动心跳
            this.startHeartbeat()

            // 发射连接打开事件
            this.pushEventEmitter.emitConnectionOpened({
                url: this.currentUrl,
                connectTime: this.connectTime,
            })

            this.emit('connected')
            resolve()
        })

        // 消息接收事件
        this.ws.on('message', (data: Buffer | string) => {
            try {
                this.handleMessage(data)
            } catch (error) {
                this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'onMessage', '处理消息失败', error)
                this.errorCount++
            }
        })

        // 连接关闭事件
        this.ws.on('close', (code: number, reason: string) => {
            this.logger.logConnectionEvent('onClose', `WebSocket 连接已关闭: ${code} ${reason}`)

            this.handleConnectionClose(code, reason)
        })

        // 连接错误事件
        this.ws.on('error', (error: Error) => {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'onError', 'WebSocket 连接错误', error)

            this.errorCount++
            this.updateConnectionStatus(ConnectionStatus.ERROR)

            const pushError = PushError.connectionError('WebSocket 连接错误', 'CONNECTION_ERROR', error)
            this.pushEventEmitter.emitConnectionError(pushError)

            reject(error)
        })

        // 连接超时处理
        setTimeout(() => {
            if (this.connectionStatus === ConnectionStatus.CONNECTING) {
                reject(new Error('WebSocket 连接超时'))
            }
        }, 15000) // 15秒超时
    }

    /**
     * 处理接收到的消息
     */
    private handleMessage(data: Buffer | string): void {
        try {
            const rawMessage = data.toString()
            this.lastMessageTime = Date.now()
            this.messageCount++

            this.logger.logConnectionEvent('handleMessage', '收到 WebSocket 消息', {
                messageLength: rawMessage.length,
                messageCount: this.messageCount,
            })

            // 检查消息大小
            if (rawMessage.length > MESSAGE_CONSTANTS.MAX_MESSAGE_SIZE) {
                throw PushError.messageParseError('消息大小超过限制', 'MESSAGE_TOO_LARGE')
            }

            // 解析消息
            const message = PushUtils.parseJsonMessage(rawMessage)
            if (!message) {
                throw PushError.messageParseError('消息 JSON 解析失败', 'INVALID_JSON')
            }

            // 处理心跳响应 - 支持多种心跳响应格式
            if (
                message.messageType === MessageType.HEARTBEAT_RESPONSE ||
                message.messageType === 'HEARTBEAT_RESPONSE' ||
                message.messageType === 'HEARTBEAT'
            ) {
                this.handleHeartbeatResponse(message)
                return
            }

            // 发射消息接收事件
            this.pushEventEmitter.emitMessageReceived({
                message: message,
                rawMessage: rawMessage,
                timestamp: this.lastMessageTime,
            })

            // 发射给外部监听器
            this.emit('message', message, rawMessage)
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'handleMessage', '处理消息失败', error)
            this.errorCount++

            if (error instanceof PushError) {
                this.pushEventEmitter.emitConnectionError(error)
            }
        }
    }

    /**
     * 处理连接关闭
     */
    private handleConnectionClose(code: number, reason: string): void {
        // 详细的关闭信息分析
        console.group('🔌 [连接关闭] WebSocket连接已关闭')
        console.log('📋 关闭代码:', code)
        console.log('📝 关闭原因:', reason || '无原因')
        console.log('⏱️ 连接持续时间:', this.connectTime ? Date.now() - this.connectTime : 0, 'ms')
        console.log('💓 最后心跳时间:', this.lastHeartbeatTime ? new Date(this.lastHeartbeatTime).toISOString() : '无')
        console.log('📊 发送消息数:', this.messageCount)
        console.log('❌ 错误计数:', this.errorCount)
        console.log('⏰ 心跳间隔:', this.heartbeatInterval + 'ms')
        console.groupEnd()
        
        // 分析关闭原因
        this.analyzeCloseReason(code, reason)
        
        // 停止心跳
        this.stopHeartbeat()

        // 更新连接状态
        this.updateConnectionStatus(ConnectionStatus.DISCONNECTED)

        // 发射连接关闭事件
        this.pushEventEmitter.emitConnectionClosed({
            code: code,
            reason: reason,
            wasClean: code === WEBSOCKET_CONSTANTS.CLOSE_CODES.NORMAL,
        })

        this.emit('disconnected', code, reason)

        // 自适应心跳调整
        if (this.adaptiveHeartbeatEnabled) {
            this.adjustHeartbeatInterval(code)
        }

        // 判断是否需要重连
        if (this.shouldReconnect(code)) {
            this.scheduleReconnect()
        }
        
        console.log('='.repeat(80))
    }

    /**
     * 分析连接关闭原因
     */
    private analyzeCloseReason(code: number, reason: string): void {
        const closeReasons: { [key: number]: string } = {
            1000: '正常关闭 - 服务器或客户端主动关闭',
            1001: '服务器离开 - 服务器关闭或重启',
            1002: '协议错误 - WebSocket协议错误',
            1003: '不支持的数据 - 服务器不支持接收的数据类型',
            1006: '异常关闭 - 连接异常中断（通常是网络问题）',
            1008: '策略违反 - 违反了服务器策略（可能是认证问题）',
            1011: '服务器内部错误 - 服务器遇到意外错误',
            1012: '服务重启 - 服务器正在重启',
            1013: '稍后重试 - 服务器临时不可用'
        }
        
        const analysis = closeReasons[code] || `未知关闭原因 (代码: ${code})`
        console.log('🔍 [关闭分析]', analysis)
        
        // 根据关闭代码给出具体建议
        if (code === 1006) {
            console.log('💡 [建议] 可能是网络问题，建议：')
            console.log('   - 检查网络连接稳定性')
            console.log('   - 减少心跳间隔（当前: ' + this.heartbeatInterval + 'ms）')
            console.log('   - 检查防火墙/代理设置')
            console.log('   - 检查NAT超时设置')
        } else if (code === 1008) {
            console.log('💡 [建议] 可能是认证或格式问题，建议：')
            console.log('   - 检查Token是否有效')
            console.log('   - 验证心跳消息格式是否正确')
            console.log('   - 检查用户ID: ' + (this.userId || 'unknown_user'))
            console.log('   - 验证客户端类型和版本')
        } else if (code === 1011) {
            console.log('💡 [建议] 服务器内部错误，建议：')
            console.log('   - 检查心跳消息格式是否符合服务器要求')
            console.log('   - 联系服务器管理员')
            console.log('   - 稍后重试连接')
        } else if (code === 1000) {
            console.log('💡 [信息] 这是正常的连接关闭，可能原因：')
            console.log('   - 服务器主动关闭连接')
            console.log('   - 应用程序正常退出')
            console.log('   - 连接超时或空闲时间过长')
        }
        
        // 记录心跳相关信息
        const timeSinceLastHeartbeat = this.lastHeartbeatTime ? Date.now() - this.lastHeartbeatTime : 0
        if (timeSinceLastHeartbeat > this.heartbeatInterval * 2) {
            console.log('⚠️ [警告] 距离最后一次心跳时间过长:', timeSinceLastHeartbeat + 'ms')
        }
    }

    /**
     * 自适应调整心跳间隔
     */
    private adjustHeartbeatInterval(closeCode: number): void {
        // 如果是异常关闭（网络问题），增加关闭计数
        if (closeCode === 1006 || closeCode === 1001) {
            this.consecutiveCloseCount++
            
            // 如果连续异常关闭次数较多，减少心跳间隔
            if (this.consecutiveCloseCount >= 2) {
                const oldInterval = this.heartbeatInterval
                this.heartbeatInterval = Math.max(
                    Math.floor(this.heartbeatInterval * 0.8), // 减少20%
                    HEARTBEAT_CONSTANTS.MIN_INTERVAL
                )
                
                if (this.heartbeatInterval !== oldInterval) {
                    console.log('🔧 [自适应心跳] 检测到连续异常关闭，调整心跳间隔:')
                    console.log('   从', oldInterval + 'ms', '调整为', this.heartbeatInterval + 'ms')
                    console.log('   连续关闭次数:', this.consecutiveCloseCount)
                }
            }
        } else if (closeCode === 1000) {
            // 正常关闭，重置计数
            if (this.consecutiveCloseCount > 0) {
                console.log('🔧 [自适应心跳] 检测到正常关闭，重置连续关闭计数')
                this.consecutiveCloseCount = 0
            }
        }
    }

    /**
     * 判断是否应该重连
     */
    private shouldReconnect(closeCode: number): boolean {
        // 正常关闭不重连
        if (closeCode === WEBSOCKET_CONSTANTS.CLOSE_CODES.NORMAL) {
            return false
        }

        // 已达到最大重连次数
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.logConnectionEvent('shouldReconnect', '已达到最大重连次数，停止重连')
            return false
        }

        // 正在重连中
        if (this.isReconnecting) {
            return false
        }

        return true
    }

    /**
     * 安排重连
     */
    private scheduleReconnect(): void {
        if (this.isReconnecting || this.reconnectTimer) {
            return
        }

        this.isReconnecting = true
        this.reconnectAttempts++
        this.reconnectCount++

        const delay = PushUtils.calculateReconnectDelay(
            this.reconnectAttempts,
            RECONNECT_CONSTANTS.INITIAL_DELAY,
            RECONNECT_CONSTANTS.MAX_DELAY,
            RECONNECT_CONSTANTS.BACKOFF_MULTIPLIER,
            RECONNECT_CONSTANTS.JITTER_RANGE
        )

        this.logger.logConnectionEvent(
            'scheduleReconnect',
            `安排重连，第 ${this.reconnectAttempts} 次尝试，延迟 ${delay}ms`
        )

        this.updateConnectionStatus(ConnectionStatus.RECONNECTING)

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.attemptReconnect()
            } catch (error) {
                this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'scheduleReconnect', '重连失败', error)

                // 继续尝试重连
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.isReconnecting = false
                    this.reconnectTimer = null
                    this.scheduleReconnect()
                } else {
                    this.updateConnectionStatus(ConnectionStatus.ERROR)
                    this.isReconnecting = false
                }
            }
        }, delay)
    }

    /**
     * 尝试重连
     */
    private async attemptReconnect(): Promise<void> {
        try {
            this.logger.logConnectionEvent('attemptReconnect', `开始第 ${this.reconnectAttempts} 次重连尝试`)

            // 清理现有连接
            this.cleanupWebSocket()

            // 重新建立连接
            await this.createWebSocketConnection(this.currentUrl, this.currentToken)

            this.logger.logConnectionEvent('attemptReconnect', '重连成功')
            this.isReconnecting = false
            this.reconnectTimer = null
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'attemptReconnect', '重连失败', error)
            throw error
        }
    }

    /**
     * 断开连接
     */
    async disconnect(): Promise<void> {
        try {
            this.logger.logConnectionEvent('disconnect', '开始断开 WebSocket 连接')

            // 停止重连
            this.stopReconnect()

            // 停止心跳
            this.stopHeartbeat()

            // 关闭 WebSocket 连接
            if (this.ws && this.ws.readyState === WS_READY_STATE.OPEN) {
                this.ws.close(WEBSOCKET_CONSTANTS.CLOSE_CODES.NORMAL, '正常关闭')
            }

            // 清理连接
            this.cleanupWebSocket()

            // 更新状态
            this.updateConnectionStatus(ConnectionStatus.DISCONNECTED)

            this.logger.logConnectionEvent('disconnect', 'WebSocket 连接已断开')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'disconnect', '断开连接失败', error)
            throw PushError.connectionError('断开连接失败', 'DISCONNECT_FAILED', error)
        }
    }

    /**
     * 发送消息
     */
    send(message: any): void {
        try {
            if (!this.isConnected()) {
                throw PushError.connectionError('连接未建立，无法发送消息', 'NOT_CONNECTED')
            }

            const messageStr = typeof message === 'string' ? message : JSON.stringify(message)

            // 详细打印发送的消息内容
            console.group('🚀 [WebSocket发送] 准备发送消息到服务器')
            console.log('📋 消息类型:', typeof message === 'object' ? message.messageType : 'string')
            console.log('📏 消息长度:', messageStr.length, '字符')
            console.log('📄 完整消息内容:', messageStr)
            try {
                const parsedForDisplay = JSON.parse(messageStr)
                console.log('📊 格式化消息:', parsedForDisplay)
            } catch (e) {
                console.log('📝 (非JSON格式消息)')
            }
            console.groupEnd()

            this.logger.logConnectionEvent('send', '发送 WebSocket 消息', {
                messageLength: messageStr.length,
                messageType: typeof message === 'object' ? message.messageType : 'unknown',
                messageContent: messageStr.substring(0, 500) + (messageStr.length > 500 ? '...' : '') // 记录前500字符
            })

            this.ws!.send(messageStr)
            
            console.log('✅ [WebSocket发送] 消息已成功发送到服务器')
        } catch (error) {
            console.log('❌ [WebSocket发送] 消息发送失败:', error.message)
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'send', '发送消息失败', error)
            this.errorCount++
            throw error
        }
    }

    /**
     * 发送心跳消息
     * 前端定时发起心跳保活，后端不返回心跳响应
     */
    sendHeartbeat(): void {
        try {
            const now = Date.now()
            const heartbeatId = `heartbeat_${now}`
            const wrapperId = `wrapper_${now}`
            const connectionId = `conn_${now}`

            // 构建符合后端要求的心跳消息格式
            const heartbeatMessage = {
                wrapperId: wrapperId,
                messageId: heartbeatId,
                messageType: 'HEARTBEAT',
                version: '1.0',
                heartbeat: {
                    type: 'HEARTBEAT',
                    messageId: heartbeatId,
                    userId: this.userId || 'unknown_user', // 使用实际用户ID
                    connectionId: connectionId,
                    timestamp: now,
                    heartbeatTime: new Date(now).toISOString(),
                    sequenceNumber: this.messageCount + 1, // 使用消息计数作为序列号
                    clientInfo: {
                        clientType: HEARTBEAT_CONSTANTS.CLIENT_TYPE,
                        clientVersion: HEARTBEAT_CONSTANTS.CLIENT_VERSION,
                        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'JLCAssistant/1.0.1',
                        osInfo: this.getOSInfo(),
                        browserInfo: this.getBrowserInfo(),
                    },
                },
                source: 'client',
                target: 'server',
                timestamp: now,
                createTime: new Date(now).toISOString(),
            }

            // 额外打印心跳消息详情
            console.group('💓 [心跳保活] 准备发送心跳消息')
            console.log('🆔 心跳ID:', heartbeatId)
            console.log('👤 用户ID:', this.userId || 'unknown_user')
            console.log('🔗 连接ID:', connectionId)
            console.log('🔢 序列号:', this.messageCount + 1)
            console.log('⏰ 时间戳:', now, '(' + new Date(now).toISOString() + ')')
            console.groupEnd()
            
            this.send(heartbeatMessage)
            this.lastHeartbeatTime = now
            this.heartbeatFailureCount = 0 // 重置失败计数

            this.logger.logConnectionEvent('sendHeartbeat', '发送心跳保活消息', {
                wrapperId: wrapperId,
                messageId: heartbeatId,
                userId: this.userId,
                timestamp: now,
            })
            
            console.log('💓 [心跳保活] 心跳消息发送完成')

            // 由于后端不返回心跳响应，不设置心跳超时检测
            // 依靠连接状态和其他消息来判断连接健康状况
        } catch (error) {
            this.heartbeatFailureCount++
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'sendHeartbeat', '发送心跳失败', error)

            // 如果连续失败次数过多，可能连接有问题
            if (this.heartbeatFailureCount >= HEARTBEAT_CONSTANTS.MAX_CONSECUTIVE_FAILURES) {
                this.logger.logConnectionEvent(
                    'sendHeartbeat',
                    `心跳连续失败${this.heartbeatFailureCount}次，可能连接异常`
                )

                // 触发连接检查或重连
                if (this.isConnected()) {
                    this.ws!.close(WEBSOCKET_CONSTANTS.CLOSE_CODES.ABNORMAL, '心跳发送连续失败')
                }
            }
        }
    }

    /**
     * 发送消息送达确认 (ACK)
     */
    sendAck(messageId: string, status: 'delivered' | 'failed' = 'delivered'): void {
        try {
            const now = Date.now()
            const ackMessage = {
                messageType: 'ACK',
                data: {
                    messageId: messageId,
                    timestamp: now,
                    status: status
                },
                timestamp: now,
                requestId: `ack_${messageId}_${now}`
            }

            console.log('📨 [消息确认] 准备发送 ACK 消息:')
            console.log('📨 消息ID:', messageId)
            console.log('📨 状态:', status)
            console.log('📨 时间戳:', now, '(' + new Date(now).toISOString() + ')')
            
            this.send(ackMessage)
            
            this.logger.logConnectionEvent('sendAck', '发送消息送达确认', {
                messageId: messageId,
                status: status,
                timestamp: now
            })
            
            console.log('📨 [消息确认] ACK 消息发送完成')
        } catch (error) {
            console.log('❌ [消息确认] ACK 消息发送失败:', error.message)
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'sendAck', '发送 ACK 失败', error)
        }
    }

    /**
     * 发送消息已读回执 (READ_RECEIPT)
     */
    sendReadReceipt(messageId: string): void {
        try {
            const now = Date.now()
            const readReceiptMessage = {
                messageType: 'READ_RECEIPT',
                data: {
                    messageId: messageId,
                    timestamp: now,
                    readTime: new Date(now).toISOString()
                },
                timestamp: now,
                requestId: `read_${messageId}_${now}`
            }

            console.log('👁️ [已读回执] 准备发送 READ_RECEIPT 消息:')
            console.log('👁️ 消息ID:', messageId)
            console.log('👁️ 已读时间:', new Date(now).toISOString())
            console.log('👁️ 时间戳:', now)
            
            this.send(readReceiptMessage)
            
            this.logger.logConnectionEvent('sendReadReceipt', '发送消息已读回执', {
                messageId: messageId,
                readTime: new Date(now).toISOString(),
                timestamp: now
            })
            
            console.log('👁️ [已读回执] READ_RECEIPT 消息发送完成')
        } catch (error) {
            console.log('❌ [已读回执] READ_RECEIPT 消息发送失败:', error.message)
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'sendReadReceipt', '发送 READ_RECEIPT 失败', error)
        }
    }

    /**
     * 处理心跳响应（保留兼容性，但后端通常不返回心跳响应）
     */
    private handleHeartbeatResponse(response: any): void {
        try {
            this.logger.logConnectionEvent('handleHeartbeatResponse', '收到心跳响应（意外）', {
                messageId: response.messageId || response.requestId,
                wrapperId: response.wrapperId,
                timestamp: response.timestamp,
                messageType: response.messageType,
            })

            // 更新最后心跳时间
            this.lastHeartbeatTime = Date.now()

            // 发射心跳响应事件
            this.emit('heartbeat_response', response)

            // 如果响应中包含服务器时间，可以用于时间同步
            if (response.heartbeat && response.heartbeat.timestamp) {
                const serverTime = response.heartbeat.timestamp
                const clientTime = Date.now()
                const timeDiff = Math.abs(serverTime - clientTime)

                if (timeDiff > 5000) {
                    // 时间差超过5秒时记录警告
                    this.logger.logConnectionEvent('handleHeartbeatResponse', '客户端与服务器时间差较大', {
                        serverTime: serverTime,
                        clientTime: clientTime,
                        timeDiff: timeDiff,
                    })
                }
            }
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION,
                'handleHeartbeatResponse',
                '处理心跳响应失败',
                error
            )
        }
    }

    /**
     * 启动心跳保活机制
     */
    private startHeartbeat(): void {
        this.stopHeartbeat() // 先停止现有心跳

        this.logger.logConnectionEvent('startHeartbeat', `启动心跳保活，间隔 ${this.heartbeatInterval}ms`)

        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected()) {
                this.sendHeartbeat()
            } else {
                this.logger.logConnectionEvent('startHeartbeat', '连接已断开，停止发送心跳')
                this.stopHeartbeat()
            }
        }, this.heartbeatInterval)

        // 立即发送一次心跳
        if (this.isConnected()) {
            this.sendHeartbeat()
        }
    }

    /**
     * 停止心跳保活机制
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
            this.logger.logConnectionEvent('stopHeartbeat', '心跳保活已停止')
        }

        this.clearHeartbeatTimeout()
    }

    /**
     * 设置心跳超时检测（由于后端不返回心跳响应，此方法保留但不使用）
     */
    private setHeartbeatTimeout(): void {
        // 由于后端不返回心跳响应，不设置心跳超时检测
        // 依靠 WebSocket 自身的连接状态和其他消息来判断连接健康状况
        this.clearHeartbeatTimeout()
    }

    /**
     * 清除心跳超时检测
     */
    private clearHeartbeatTimeout(): void {
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer)
            this.heartbeatTimeoutTimer = null
        }
    }

    /**
     * 获取浏览器信息
     */
    private getBrowserInfo(): string {
        if (typeof navigator === 'undefined') {
            return 'Electron'
        }

        const userAgent = navigator.userAgent
        if (userAgent.includes('Chrome')) {
            return 'Chrome'
        } else if (userAgent.includes('Firefox')) {
            return 'Firefox'
        } else if (userAgent.includes('Safari')) {
            return 'Safari'
        } else if (userAgent.includes('Edge')) {
            return 'Edge'
        } else {
            return 'Unknown'
        }
    }

    /**
     * 获取操作系统信息
     */
    private getOSInfo(): string {
        if (typeof navigator !== 'undefined') {
            return navigator.platform
        }

        // 在 Node.js/Electron 环境中
        const os = require('os')
        const platform = os.platform()
        const arch = os.arch()

        switch (platform) {
            case 'win32':
                return `Windows ${arch}`
            case 'darwin':
                return `macOS ${arch}`
            case 'linux':
                return `Linux ${arch}`
            default:
                return `${platform} ${arch}`
        }
    }

    /**
     * 设置用户ID
     */
    setUserId(userId: string): void {
        this.userId = userId
        this.logger.logConnectionEvent('setUserId', `设置用户ID: ${userId}`)
    }

    /**
     * 停止重连
     */
    private stopReconnect(): void {
        this.isReconnecting = false

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
            this.logger.logConnectionEvent('stopReconnect', '重连已停止')
        }
    }

    /**
     * 清理 WebSocket 连接
     */
    private cleanupWebSocket(): void {
        if (this.ws) {
            // 移除所有事件监听器
            this.ws.removeAllListeners()

            // 如果连接还在，强制关闭
            if (this.ws.readyState === WS_READY_STATE.OPEN || this.ws.readyState === WS_READY_STATE.CONNECTING) {
                this.ws.terminate()
            }

            this.ws = null
        }
    }

    /**
     * 更新连接状态
     */
    private updateConnectionStatus(status: ConnectionStatus): void {
        if (this.connectionStatus !== status) {
            const oldStatus = this.connectionStatus
            this.connectionStatus = status

            this.logger.logConnectionEvent('updateConnectionStatus', `连接状态变更: ${oldStatus} -> ${status}`)

            this.emit('status_changed', status, oldStatus)
        }
    }

    /**
     * 检查是否已连接
     */
    isConnected(): boolean {
        return (
            this.ws !== null &&
            this.ws.readyState === WS_READY_STATE.OPEN &&
            this.connectionStatus === ConnectionStatus.CONNECTED
        )
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus
    }

    /**
     * 获取连接统计信息
     */
    getConnectionStatistics(): any {
        const now = Date.now()
        const uptime = this.connectTime > 0 ? now - this.connectTime : 0

        return {
            status: this.connectionStatus,
            statusText: PushUtils.getConnectionStatusText(this.connectionStatus),
            isConnected: this.isConnected(),
            url: this.currentUrl,
            connectTime: this.connectTime,
            uptime: uptime,
            formattedUptime: PushUtils.formatDuration(uptime),
            lastMessageTime: this.lastMessageTime,
            lastHeartbeatTime: this.lastHeartbeatTime,
            messageCount: this.messageCount,
            errorCount: this.errorCount,
            reconnectAttempts: this.reconnectAttempts,
            reconnectCount: this.reconnectCount,
            maxReconnectAttempts: this.maxReconnectAttempts,
            heartbeatInterval: this.heartbeatInterval,
            isReconnecting: this.isReconnecting,
        }
    }

    /**
     * 设置心跳间隔
     */
    setHeartbeatInterval(interval: number): void {
        // 限制心跳间隔在合理范围内
        this.heartbeatInterval = Math.max(
            Math.min(interval, HEARTBEAT_CONSTANTS.MAX_INTERVAL),
            HEARTBEAT_CONSTANTS.MIN_INTERVAL
        )

        this.logger.logConnectionEvent('setHeartbeatInterval', `心跳保活间隔设置为 ${this.heartbeatInterval}ms`)

        // 如果正在运行心跳，重新启动
        if (this.heartbeatTimer) {
            this.startHeartbeat()
        }
    }

    /**
     * 设置最大重连次数
     */
    setMaxReconnectAttempts(maxAttempts: number): void {
        this.maxReconnectAttempts = Math.max(maxAttempts, 0)
        this.logger.logConnectionEvent('setMaxReconnectAttempts', `最大重连次数设置为 ${this.maxReconnectAttempts}`)
    }

    /**
     * 重置连接统计
     */
    resetStatistics(): void {
        this.messageCount = 0
        this.errorCount = 0
        this.reconnectCount = 0
        this.reconnectAttempts = 0
        this.logger.logConnectionEvent('resetStatistics', '连接统计已重置')
    }

    /**
     * 销毁连接管理器
     */
    destroy(): void {
        try {
            this.logger.logConnectionEvent('destroy', 'WebSocket 连接管理器销毁开始')

            // 断开连接
            this.disconnect().catch(() => {}) // 忽略断开连接的错误

            // 停止所有定时器
            this.stopReconnect()
            this.stopHeartbeat()

            // 清理 WebSocket
            this.cleanupWebSocket()

            // 移除所有事件监听器
            this.removeAllListeners()

            // 重置状态
            this.connectionStatus = ConnectionStatus.DISCONNECTED
            this.currentUrl = ''
            this.currentToken = ''

            this.logger.logConnectionEvent('destroy', 'WebSocket 连接管理器已销毁')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, 'destroy', '销毁连接管理器失败', error)
        }
    }
}
