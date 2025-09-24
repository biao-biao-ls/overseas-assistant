/**
 * WebSocket 推送功能相关类型定义
 */

// 连接状态枚举
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// 日志级别枚举
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 消息类型枚举
export enum MessageType {
  NOTIFICATION = 'NOTIFICATION',
  HEARTBEAT = 'HEARTBEAT',
  HEARTBEAT_RESPONSE = 'HEARTBEAT_RESPONSE',
  ACK = 'ACK',
  READ_RECEIPT = 'READ_RECEIPT'
}

// 多语言内容接口
export interface MultiLanguageContent {
  [lang: string]: {
    title: string
    content: string
  }
}

// WebSocket 消息数据接口
export interface WebSocketMessageData {
  messageId: string
  titleEn?: string
  contentEn?: string
  url?: string
  multiLanguage?: MultiLanguageContent
}

// WebSocket 消息接口
export interface WebSocketMessage {
  messageType: string
  priority: number
  timestamp: number
  requestId: string
  data: WebSocketMessageData
}

// 解析后的消息接口
export interface ParsedMessage {
  messageType: string
  data: any
  priority: number
  timestamp: number
  requestId?: string
}

// 通知数据接口
export interface NotificationData {
  messageId?: string  // 添加消息ID字段
  title: string
  body: string
  url?: string
  priority: number
  multiLanguage?: MultiLanguageContent
}

// ACK 消息数据接口
export interface AckMessageData {
  messageId: string
  timestamp?: number
  status?: 'delivered' | 'failed'
}

// READ_RECEIPT 消息数据接口
export interface ReadReceiptMessageData {
  messageId: string
  timestamp?: number
  readTime?: string
}

// ACK 消息接口
export interface AckMessage {
  messageType: 'ACK'
  data: AckMessageData
  timestamp?: number
  requestId?: string
}

// READ_RECEIPT 消息接口
export interface ReadReceiptMessage {
  messageType: 'READ_RECEIPT'
  data: ReadReceiptMessageData
  timestamp?: number
  requestId?: string
}

// 推送配置接口
export interface PushConfig {
  serverUrl: string
  reconnectMaxAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
  tokenRefreshThreshold: number
  maxConcurrentNotifications: number
  logLevel: LogLevel
}

// Token 信息接口
export interface TokenInfo {
  token: string
  expireTime: number
  refreshTime: number
}

// 连接选项接口
export interface ConnectionOptions {
  url: string
  token: string
  protocols?: string[]
  headers?: { [key: string]: string }
}

// 推送服务状态接口
export interface PushServiceStatus {
  connectionStatus: ConnectionStatus
  isEnabled: boolean
  lastConnectTime?: number
  lastMessageTime?: number
  reconnectAttempts: number
  messageCount: number
  errorCount: number
}

// 消息处理器接口
export interface MessageHandler {
  (message: ParsedMessage): void | Promise<void>
}

// 推送错误类型
export enum PushErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TOKEN_ERROR = 'TOKEN_ERROR', 
  MESSAGE_PARSE_ERROR = 'MESSAGE_PARSE_ERROR',
  NOTIFICATION_ERROR = 'NOTIFICATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

// 推送错误接口
export interface PushError extends Error {
  type: PushErrorType
  code?: string
  details?: any
  timestamp: number
  
  // 实例方法
  toJSON(): object
  getShortDescription(): string
  getDetailedDescription(): string
  isRetryable(): boolean
  getRetryDelay(): number
}

// 推送事件类型
export enum PushEventType {
  CONNECTION_OPENED = 'connection_opened',
  CONNECTION_CLOSED = 'connection_closed', 
  CONNECTION_ERROR = 'connection_error',
  MESSAGE_RECEIVED = 'message_received',
  NOTIFICATION_SHOWN = 'notification_shown',
  NOTIFICATION_CLICKED = 'notification_clicked',
  TOKEN_REFRESHED = 'token_refreshed',
  SERVICE_STARTED = 'service_started',
  SERVICE_STOPPED = 'service_stopped'
}

// 推送事件数据接口
export interface PushEventData {
  type: PushEventType
  timestamp: number
  data?: any
  error?: PushError
}

// 心跳消息接口
export interface HeartbeatMessage {
  messageType: MessageType.HEARTBEAT
  timestamp: number
  requestId: string
}

// 心跳响应接口
export interface HeartbeatResponse {
  messageType: MessageType.HEARTBEAT_RESPONSE
  timestamp: number
  requestId: string
}

// 推送统计信息接口
export interface PushStatistics {
  totalMessages: number
  notificationMessages: number
  heartbeatMessages: number
  errorMessages: number
  connectionUptime: number
  lastReconnectTime?: number
  averageMessageInterval: number
}