/**
 * WebSocket 消息处理器
 * 负责消息的解析、验证、路由和多语言处理
 */

import {
    WebSocketMessage,
    ParsedMessage,
    MessageHandler,
    MessageType,
    MultiLanguageContent,
    PushErrorType,
} from '../../types/push'
import { PushError } from '../../utils/PushError'
import { MESSAGE_CONSTANTS, LOG_CONSTANTS } from '../../config/pushConstants'
import { PushLogger } from './PushLogger'
import { PushEventEmitter } from '../../utils/PushEventEmitter'
import { PushUtils } from '../../utils/pushUtils'
import { AppConfig } from '../../config/AppConfig'

/**
 * 消息处理器类
 * 提供消息解析、验证、路由和处理功能
 */
export class MessageProcessor {
    private logger: PushLogger
    private eventEmitter: PushEventEmitter
    private messageHandlers: Map<string, MessageHandler[]> = new Map()
    private messageQueue: ParsedMessage[] = []
    private isProcessing: boolean = false
    private processingTimer: NodeJS.Timeout | null = null

    // 消息统计
    private totalMessages: number = 0
    private processedMessages: number = 0
    private failedMessages: number = 0
    private queuedMessages: number = 0
    private lastProcessTime: number = 0

    constructor(logger: PushLogger, eventEmitter: PushEventEmitter) {
        this.logger = logger
        this.eventEmitter = eventEmitter
        this.initializeMessageProcessor()
    }

    /**
     * 初始化消息处理器
     */
    private initializeMessageProcessor(): void {
        try {
            this.logger.logMessageEvent('initializeMessageProcessor', '消息处理器初始化开始')

            // 注册默认消息处理器
            this.registerDefaultHandlers()

            // 启动消息处理循环
            this.startMessageProcessing()

            this.logger.logMessageEvent('initializeMessageProcessor', '消息处理器初始化完成')
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'initializeMessageProcessor',
                '消息处理器初始化失败',
                error
            )
            throw PushError.messageParseError('消息处理器初始化失败', 'INIT_FAILED', error)
        }
    }

    /**
     * 注册默认消息处理器
     */
    private registerDefaultHandlers(): void {
        // 注册通知消息处理器
        this.registerHandler(MessageType.NOTIFICATION, async message => {
            try {
                this.logger.logMessageEvent('handleNotificationMessage', '处理通知消息', {
                    messageId: message.data.messageId,
                    requestId: message.requestId,
                })

                // 获取本地化内容
                const localizedContent = this.getLocalizedContent(message.data)

                // 发射通知事件，由 NotificationManager 处理
                this.eventEmitter.emit('notification_message', {
                    messageId: message.data.messageId,
                    title: localizedContent.title,
                    body: localizedContent.content,
                    url: this.processUrlWithLanguage(message.data.url),
                    priority: message.priority,
                    timestamp: message.timestamp,
                    requestId: message.requestId,
                })
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleNotificationMessage',
                    '处理通知消息失败',
                    error
                )
                throw error
            }
        })

        // 注册心跳消息处理器
        this.registerHandler(MessageType.HEARTBEAT, async message => {
            try {
                this.logger.logMessageEvent('handleHeartbeatMessage', '处理心跳消息', {
                    requestId: message.requestId,
                })

                // 发射心跳事件
                this.eventEmitter.emit('heartbeat_message', message)
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleHeartbeatMessage',
                    '处理心跳消息失败',
                    error
                )
                throw error
            }
        })

        // 注册心跳响应处理器
        this.registerHandler(MessageType.HEARTBEAT_RESPONSE, async message => {
            try {
                this.logger.logMessageEvent('handleHeartbeatResponseMessage', '处理心跳响应消息', {
                    requestId: message.requestId,
                })

                // 发射心跳响应事件
                this.eventEmitter.emit('heartbeat_response_message', message)
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleHeartbeatResponseMessage',
                    '处理心跳响应消息失败',
                    error
                )
                throw error
            }
        })

        // 注册 ACK 消息处理器
        this.registerHandler(MessageType.ACK, async message => {
            try {
                this.logger.logMessageEvent('handleAckMessage', '处理消息送达确认', {
                    messageId: message.data.messageId,
                    status: message.data.status,
                    requestId: message.requestId,
                })

                // 发射 ACK 事件
                this.eventEmitter.emit('ack_message', {
                    messageId: message.data.messageId,
                    status: message.data.status,
                    timestamp: message.data.timestamp || message.timestamp,
                    requestId: message.requestId,
                })
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleAckMessage',
                    '处理 ACK 消息失败',
                    error
                )
                throw error
            }
        })

        // 注册 READ_RECEIPT 消息处理器
        this.registerHandler(MessageType.READ_RECEIPT, async message => {
            try {
                this.logger.logMessageEvent('handleReadReceiptMessage', '处理消息已读回执', {
                    messageId: message.data.messageId,
                    readTime: message.data.readTime,
                    requestId: message.requestId,
                })

                // 发射 READ_RECEIPT 事件
                this.eventEmitter.emit('read_receipt_message', {
                    messageId: message.data.messageId,
                    readTime: message.data.readTime,
                    timestamp: message.data.timestamp || message.timestamp,
                    requestId: message.requestId,
                })
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleReadReceiptMessage',
                    '处理 READ_RECEIPT 消息失败',
                    error
                )
                throw error
            }
        })

        // 注册连接确认消息处理器
        this.registerHandler('CONNECTION_ACK', async message => {
            try {
                this.logger.logMessageEvent('handleConnectionAckMessage', '处理连接确认消息', {
                    requestId: message.requestId,
                    data: message.data,
                })

                // 发射连接确认事件
                this.eventEmitter.emit('connection_ack_message', {
                    message: typeof message.data === 'string' ? message.data : message.data.message || '连接已确认',
                    timestamp: message.timestamp,
                    requestId: message.requestId,
                })
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleConnectionAckMessage',
                    '处理连接确认消息失败',
                    error
                )
                throw error
            }
        })

        // 注册系统消息处理器
        this.registerHandler('SYSTEM_MESSAGE', async message => {
            try {
                this.logger.logMessageEvent('handleSystemMessage', '处理系统消息', {
                    requestId: message.requestId,
                    messageType: message.messageType,
                })

                // 发射系统消息事件
                this.eventEmitter.emit('system_message', message)
            } catch (error) {
                this.logger.error(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'handleSystemMessage',
                    '处理系统消息失败',
                    error
                )
                throw error
            }
        })
    }

    /**
     * 处理原始消息
     */
    async processMessage(rawMessage: string): Promise<void> {
        try {
            this.totalMessages++
            this.logger.logMessageEvent('processMessage', '开始处理消息', {
                messageLength: rawMessage.length,
                totalMessages: this.totalMessages,
                rawMessagePreview: rawMessage.substring(0, 100), // 添加消息预览用于调试
            })

            // 解析消息
            const parsedMessage = this.parseMessage(rawMessage)
            if (!parsedMessage) {
                throw PushError.messageParseError('消息解析失败', 'PARSE_FAILED')
            }

            this.logger.logMessageEvent('processMessage', '消息解析成功', {
                messageType: parsedMessage.messageType,
                hasData: !!parsedMessage.data,
                dataKeys: parsedMessage.data ? Object.keys(parsedMessage.data) : [],
                timestamp: parsedMessage.timestamp,
                requestId: parsedMessage.requestId,
            })

            // 验证消息
            if (!this.validateMessage(parsedMessage)) {
                throw PushError.messageParseError('消息验证失败', 'VALIDATION_FAILED')
            }

            // 添加到处理队列
            this.addToQueue(parsedMessage)

            this.logger.logMessageEvent('processMessage', '消息处理完成', {
                messageType: parsedMessage.messageType,
                priority: parsedMessage.priority,
                queueSize: this.messageQueue.length,
            })
        } catch (error) {
            this.failedMessages++
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'processMessage', '处理消息失败', {
                error: error,
                rawMessageLength: rawMessage.length,
                rawMessagePreview: rawMessage.substring(0, 200),
            })

            if (error instanceof PushError) {
                this.eventEmitter.emitConnectionError(error)
            } else {
                const pushError = PushError.messageParseError('消息处理异常', 'PROCESSING_ERROR', error)
                this.eventEmitter.emitConnectionError(pushError)
            }
        }
    }

    /**
     * 解析原始消息
     */
    private parseMessage(rawMessage: string): ParsedMessage | null {
        try {
            // 检查消息大小
            if (rawMessage.length > MESSAGE_CONSTANTS.MAX_MESSAGE_SIZE) {
                throw PushError.messageParseError('消息大小超过限制', 'MESSAGE_TOO_LARGE')
            }

            // 解析 JSON
            const messageObj = PushUtils.parseJsonMessage(rawMessage)
            if (!messageObj) {
                throw PushError.messageParseError('JSON 解析失败', 'INVALID_JSON')
            }

            // 验证基本结构
            if (!PushUtils.validateMessage(messageObj)) {
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'parseMessage',
                    '消息格式验证失败，但尝试继续解析',
                    {
                        messageType: messageObj.messageType,
                        hasTimestamp: !!messageObj.timestamp,
                        hasRequestId: !!messageObj.requestId,
                        hasData: !!messageObj.data,
                    }
                )
            }

            // 构建解析后的消息
            const parsedMessage: ParsedMessage = {
                messageType: messageObj.messageType,
                data: messageObj.data || messageObj, // 如果没有 data 字段，使用整个消息对象
                priority: messageObj.priority != null ? messageObj.priority : 0, // 处理 null 值
                timestamp: messageObj.timestamp || Date.now(),
                requestId: messageObj.requestId || messageObj.messageId || PushUtils.generateRequestId(),
            }

            return parsedMessage
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'parseMessage', '解析消息失败', {
                error: error,
                rawMessage: rawMessage.substring(0, 200), // 只记录前200个字符
            })
            return null
        }
    }

    /**
     * 验证解析后的消息
     */
    private validateMessage(message: ParsedMessage): boolean {
        try {
            // 检查必需字段
            if (!message.messageType || typeof message.messageType !== 'string') {
                this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'validateMessage', '消息类型无效')
                return false
            }

            // 心跳消息的宽松验证
            const isHeartbeatMessage =
                message.messageType === MessageType.HEARTBEAT ||
                message.messageType === MessageType.HEARTBEAT_RESPONSE ||
                message.messageType === 'HEARTBEAT' ||
                message.messageType === 'HEARTBEAT_RESPONSE'

            if (isHeartbeatMessage) {
                // 心跳消息只需要有消息类型即可
                return true
            }

            // 系统消息（如 CONNECTION_ACK）的特殊处理
            const isSystemMessage =
                message.messageType === 'CONNECTION_ACK' ||
                message.messageType === 'CONNECTION_ERROR' ||
                message.messageType === 'SYSTEM_MESSAGE'

            if (isSystemMessage) {
                // 系统消息的 data 可以是字符串或对象
                return true
            }

            // 非心跳、非系统消息的严格验证
            if (!message.data || typeof message.data !== 'object') {
                this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'validateMessage', '消息数据无效', {
                    messageType: message.messageType,
                    dataType: typeof message.data,
                    hasData: !!message.data,
                })
                return false
            }

            if (typeof message.priority !== 'number') {
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'validateMessage',
                    '消息优先级无效，使用默认值'
                )
                message.priority = 0 // 设置默认优先级
            }

            if (typeof message.timestamp !== 'number') {
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'validateMessage',
                    '消息时间戳无效，使用当前时间'
                )
                message.timestamp = Date.now() // 设置当前时间
            }

            // 检查时间戳合理性（不能太旧或太新）
            const now = Date.now()
            const timeDiff = Math.abs(now - message.timestamp)
            if (timeDiff > 24 * 60 * 60 * 1000) {
                // 24小时
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'validateMessage',
                    '消息时间戳异常，但继续处理',
                    {
                        timestamp: message.timestamp,
                        timeDiff: timeDiff,
                    }
                )
            }

            // 根据消息类型进行特定验证
            return this.validateMessageByType(message)
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'validateMessage', '验证消息失败', error)
            return false
        }
    }

    /**
     * 根据消息类型进行特定验证
     */
    private validateMessageByType(message: ParsedMessage): boolean {
        switch (message.messageType) {
            case MessageType.NOTIFICATION:
                return this.validateNotificationMessage(message)

            case MessageType.HEARTBEAT:
            case MessageType.HEARTBEAT_RESPONSE:
                return this.validateHeartbeatMessage(message)

            case 'CONNECTION_ACK':
            case 'CONNECTION_ERROR':
            case 'SYSTEM_MESSAGE':
                return this.validateSystemMessage(message)

            default:
                // 未知消息类型，记录警告但不拒绝
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'validateMessageByType',
                    '未知消息类型，但允许处理',
                    {
                        messageType: message.messageType,
                    }
                )
                return true
        }
    }

    /**
     * 验证通知消息
     */
    private validateNotificationMessage(message: ParsedMessage): boolean {
        const data = message.data

        // 检查消息ID
        if (!data.messageId || typeof data.messageId !== 'string') {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'validateNotificationMessage',
                '通知消息缺少消息ID'
            )
            return false
        }

        // 检查是否有标题和内容（英文或多语言）
        const hasEnglishContent = data.titleEn && data.contentEn
        const hasMultiLanguageContent = data.multiLanguage && typeof data.multiLanguage === 'object'

        if (!hasEnglishContent && !hasMultiLanguageContent) {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'validateNotificationMessage',
                '通知消息缺少内容'
            )
            return false
        }

        // 验证 URL 格式（如果存在）- 宽松验证，不阻止消息处理
        if (data.url && !PushUtils.isValidUrl(data.url)) {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'validateNotificationMessage',
                '通知消息URL格式可能无效，但继续处理',
                {
                    url: data.url,
                }
            )
            // 不返回 false，继续处理消息
        }

        return true
    }

    /**
     * 验证心跳消息
     */
    private validateHeartbeatMessage(message: ParsedMessage): boolean {
        // 心跳消息结构简单，基本验证已足够
        return true
    }

    /**
     * 验证系统消息
     */
    private validateSystemMessage(message: ParsedMessage): boolean {
        // 系统消息的 data 可以是字符串或对象，都是有效的
        return true
    }

    /**
     * 添加消息到处理队列
     */
    private addToQueue(message: ParsedMessage): void {
        // 检查队列大小
        if (this.messageQueue.length >= MESSAGE_CONSTANTS.QUEUE_MAX_SIZE) {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'addToQueue',
                '消息队列已满，丢弃最旧的消息'
            )
            this.messageQueue.shift() // 移除最旧的消息
        }

        // 按优先级插入消息
        this.insertMessageByPriority(message)
        this.queuedMessages++

        this.logger.logMessageEvent('addToQueue', '消息已添加到队列', {
            messageType: message.messageType,
            priority: message.priority,
            queueSize: this.messageQueue.length,
        })
    }

    /**
     * 按优先级插入消息
     */
    private insertMessageByPriority(message: ParsedMessage): void {
        let insertIndex = this.messageQueue.length

        // 找到合适的插入位置（优先级高的在前面）
        for (let i = 0; i < this.messageQueue.length; i++) {
            if (message.priority > this.messageQueue[i].priority) {
                insertIndex = i
                break
            }
        }

        this.messageQueue.splice(insertIndex, 0, message)
    }

    /**
     * 启动消息处理循环
     */
    private startMessageProcessing(): void {
        if (this.processingTimer) {
            return
        }

        this.logger.logMessageEvent('startMessageProcessing', '启动消息处理循环')

        this.processingTimer = setInterval(() => {
            this.processMessageQueue()
        }, 100) // 每100ms处理一次队列
    }

    /**
     * 停止消息处理循环
     */
    private stopMessageProcessing(): void {
        if (this.processingTimer) {
            clearInterval(this.processingTimer)
            this.processingTimer = null
            this.logger.logMessageEvent('stopMessageProcessing', '消息处理循环已停止')
        }
    }

    /**
     * 处理消息队列
     */
    private async processMessageQueue(): Promise<void> {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return
        }

        this.isProcessing = true

        try {
            // 批量处理消息
            const batchSize = Math.min(MESSAGE_CONSTANTS.BATCH_SIZE, this.messageQueue.length)
            const messagesToProcess = this.messageQueue.splice(0, batchSize)

            for (const message of messagesToProcess) {
                try {
                    await this.routeMessage(message)
                    this.processedMessages++
                } catch (error) {
                    this.failedMessages++
                    this.logger.error(
                        LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                        'processMessageQueue',
                        '处理消息失败',
                        error
                    )
                }
            }

            this.lastProcessTime = Date.now()
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'processMessageQueue',
                '处理消息队列失败',
                error
            )
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * 路由消息到相应的处理器
     */
    private async routeMessage(message: ParsedMessage): Promise<void> {
        try {
            this.logger.logMessageEvent('routeMessage', '路由消息', {
                messageType: message.messageType,
                requestId: message.requestId,
            })

            const handlers = this.messageHandlers.get(message.messageType)
            if (!handlers || handlers.length === 0) {
                this.logger.warn(
                    LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                    'routeMessage',
                    '没有找到消息处理器',
                    {
                        messageType: message.messageType,
                    }
                )
                return
            }

            // 并行执行所有处理器
            const promises = handlers.map(handler => this.executeHandler(handler, message))
            await Promise.allSettled(promises)
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'routeMessage', '路由消息失败', error)
            throw error
        }
    }

    /**
     * 执行消息处理器
     */
    private async executeHandler(handler: MessageHandler, message: ParsedMessage): Promise<void> {
        try {
            const startTime = Date.now()
            await handler(message)
            const duration = Date.now() - startTime

            this.logger.logPerformance(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'executeHandler', duration, {
                messageType: message.messageType,
            })
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'executeHandler',
                '执行消息处理器失败',
                error
            )
            throw error
        }
    }

    /**
     * 注册消息处理器
     */
    registerHandler(messageType: string, handler: MessageHandler): void {
        try {
            if (!this.messageHandlers.has(messageType)) {
                this.messageHandlers.set(messageType, [])
            }

            this.messageHandlers.get(messageType)!.push(handler)

            this.logger.logMessageEvent('registerHandler', '注册消息处理器', {
                messageType: messageType,
                handlerCount: this.messageHandlers.get(messageType)!.length,
            })
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'registerHandler',
                '注册消息处理器失败',
                error
            )
            throw error
        }
    }

    /**
     * 移除消息处理器
     */
    removeHandler(messageType: string, handler: MessageHandler): void {
        try {
            const handlers = this.messageHandlers.get(messageType)
            if (!handlers) {
                return
            }

            const index = handlers.indexOf(handler)
            if (index !== -1) {
                handlers.splice(index, 1)

                this.logger.logMessageEvent('removeHandler', '移除消息处理器', {
                    messageType: messageType,
                    handlerCount: handlers.length,
                })
            }

            // 如果没有处理器了，删除整个条目
            if (handlers.length === 0) {
                this.messageHandlers.delete(messageType)
            }
        } catch (error) {
            this.logger.error(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'removeHandler',
                '移除消息处理器失败',
                error
            )
        }
    }

    /**
     * 根据当前语言处理跳转URL
     */
    private processUrlWithLanguage(url: string): string {
        try {
            if (!url) {
                return url
            }

            // 获取当前语言
            const currentLang = AppConfig.config.language

            // 如果是英语，不做处理
            if (!currentLang || currentLang === 'en') {
                return url
            }

            // 解析URL
            const urlObj = new URL(url)
            const pathname = urlObj.pathname

            // 检查路径是否以 /user-center 或 /checkout 开头
            if (pathname.startsWith('/user-center') || pathname.startsWith('/checkout')) {
                // 需要将语言插入到 /user-center 或 /checkout 后面
                const segments = pathname.split('/')
                const firstSegment = segments[1] // user-center 或 checkout

                if (segments.length === 2) {
                    // 路径只有 /user-center 或 /checkout
                    urlObj.pathname = `/${firstSegment}/${currentLang}`
                } else {
                    // 路径有更多部分，如 /user-center/about
                    segments.splice(2, 0, currentLang) // 在第二个位置插入语言
                    urlObj.pathname = segments.join('/')
                }
            } else {
                // 其他路径，将语言作为访问路径开头
                if (pathname === '/') {
                    // 根路径
                    urlObj.pathname = `/${currentLang}`
                } else {
                    // 其他路径，如 /about
                    urlObj.pathname = `/${currentLang}${pathname}`
                }
            }

            return urlObj.toString()
        } catch (error) {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'processUrlWithLanguage',
                'URL处理失败，返回原URL',
                {
                    url: url,
                    error: error,
                }
            )
            return url
        }
    }

    /**
     * 获取本地化内容
     */
    private getLocalizedContent(data: any): { title: string; content: string } {
        try {
            // 使用工具方法获取本地化文本
            return PushUtils.getLocalizedText(data.multiLanguage, data.titleEn, data.contentEn)
        } catch (error) {
            this.logger.warn(
                LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR,
                'getLocalizedContent',
                '获取本地化内容失败',
                error
            )

            // 返回默认内容
            return {
                title: data.titleEn || '通知',
                content: data.contentEn || '您有新消息',
            }
        }
    }

    /**
     * 获取消息处理统计信息
     */
    getMessageStatistics(): any {
        const now = Date.now()
        const uptime = this.lastProcessTime > 0 ? now - this.lastProcessTime : 0

        return {
            totalMessages: this.totalMessages,
            processedMessages: this.processedMessages,
            failedMessages: this.failedMessages,
            queuedMessages: this.queuedMessages,
            currentQueueSize: this.messageQueue.length,
            isProcessing: this.isProcessing,
            lastProcessTime: this.lastProcessTime,
            formattedLastProcessTime:
                this.lastProcessTime > 0 ? PushUtils.formatTimestamp(this.lastProcessTime) : '从未处理',
            registeredHandlers: Array.from(this.messageHandlers.keys()),
            handlerCounts: Object.fromEntries(
                Array.from(this.messageHandlers.entries()).map(([type, handlers]) => [type, handlers.length])
            ),
            successRate:
                this.totalMessages > 0 ? ((this.processedMessages / this.totalMessages) * 100).toFixed(2) + '%' : '0%',
            failureRate:
                this.totalMessages > 0 ? ((this.failedMessages / this.totalMessages) * 100).toFixed(2) + '%' : '0%',
        }
    }

    /**
     * 清空消息队列
     */
    clearMessageQueue(): void {
        const queueSize = this.messageQueue.length
        this.messageQueue = []

        this.logger.logMessageEvent('clearMessageQueue', `已清空消息队列，清除 ${queueSize} 条消息`)
    }

    /**
     * 重置消息统计
     */
    resetStatistics(): void {
        this.totalMessages = 0
        this.processedMessages = 0
        this.failedMessages = 0
        this.queuedMessages = 0
        this.lastProcessTime = 0

        this.logger.logMessageEvent('resetStatistics', '消息处理统计已重置')
    }

    /**
     * 销毁消息处理器
     */
    destroy(): void {
        try {
            this.logger.logMessageEvent('destroy', '消息处理器销毁开始')

            // 停止消息处理
            this.stopMessageProcessing()

            // 清空消息队列
            this.clearMessageQueue()

            // 清除所有处理器
            this.messageHandlers.clear()

            // 重置状态
            this.isProcessing = false
            this.resetStatistics()

            this.logger.logMessageEvent('destroy', '消息处理器已销毁')
        } catch (error) {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, 'destroy', '销毁消息处理器失败', error)
        }
    }
}
