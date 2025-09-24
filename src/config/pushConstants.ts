/**
 * WebSocket 推送功能相关常量定义
 */

import { PushConfig, LogLevel } from '../types/push'

// 默认推送配置
export const DEFAULT_PUSH_CONFIG: PushConfig = {
  serverUrl: '', // 将从 AppConfig 获取
  reconnectMaxAttempts: 5,
  reconnectDelay: 3000, // 3秒
  heartbeatInterval: 60000, // 60秒，1分钟心跳间隔
  tokenRefreshThreshold: 300000, // 5分钟，token过期前刷新
  maxConcurrentNotifications: 3,
  logLevel: LogLevel.INFO
}

// WebSocket 协议相关常量
export const WEBSOCKET_CONSTANTS = {
  PROTOCOL: 'wss',
  READY_STATE: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  },
  CLOSE_CODES: {
    NORMAL: 1000,
    GOING_AWAY: 1001,
    PROTOCOL_ERROR: 1002,
    UNSUPPORTED_DATA: 1003,
    NO_STATUS: 1005,
    ABNORMAL: 1006,
    INVALID_FRAME_PAYLOAD_DATA: 1007,
    POLICY_VIOLATION: 1008,
    MESSAGE_TOO_BIG: 1009,
    MANDATORY_EXTENSION: 1010,
    INTERNAL_ERROR: 1011,
    SERVICE_RESTART: 1012,
    TRY_AGAIN_LATER: 1013,
    BAD_GATEWAY: 1014,
    TLS_HANDSHAKE: 1015
  }
}

// 重连策略常量
export const RECONNECT_CONSTANTS = {
  INITIAL_DELAY: 1000, // 1秒
  MAX_DELAY: 30000, // 30秒
  BACKOFF_MULTIPLIER: 1.5,
  JITTER_RANGE: 0.1 // 10% 随机抖动
}

// 消息处理常量
export const MESSAGE_CONSTANTS = {
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  MESSAGE_TIMEOUT: 10000, // 10秒
  BATCH_SIZE: 10, // 批处理大小
  QUEUE_MAX_SIZE: 100 // 消息队列最大大小
}

// 通知相关常量
export const NOTIFICATION_CONSTANTS = {
  DEFAULT_TIMEOUT: 5000, // 5秒自动关闭
  MAX_TITLE_LENGTH: 100,
  MAX_BODY_LENGTH: 300,
  SOUND_ENABLED: true,
  ICON_PATH: 'assets/jlcAssistant256.ico'
}

// Token 管理常量
export const TOKEN_CONSTANTS = {
  REFRESH_RETRY_ATTEMPTS: 3,
  REFRESH_RETRY_DELAY: 2000, // 2秒
  MIN_VALID_DURATION: 60000, // 1分钟，token最小有效期
  CACHE_KEY: 'websocket_push_token'
}

// 日志相关常量
export const LOG_CONSTANTS = {
  MAX_LOG_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_LOG_FILES: 5,
  LOG_ROTATION_CHECK_INTERVAL: 3600000, // 1小时
  COMPONENT_NAMES: {
    PUSH_MGR: 'WebSocketPushMgr',
    CONNECTION: 'WebSocketConnection',
    TOKEN_MGR: 'TokenManager',
    MESSAGE_PROCESSOR: 'MessageProcessor',
    NOTIFICATION_MGR: 'NotificationManager',
    LOGGER: 'PushLogger'
  }
}

// API 相关常量
export const API_CONSTANTS = {
  TOKEN_ENDPOINT: '/api/overseas-im-platform/websocket/token/getByUserId',
  REFRESH_TOKEN_ENDPOINT: '/api/auth/refresh',
  WEBSOCKET_ENDPOINT: '/api/overseas-im-platform/ws/im',
  REQUEST_TIMEOUT: 10000, // 10秒
  RETRY_ATTEMPTS: 3
}

// 心跳保活常量
export const HEARTBEAT_CONSTANTS = {
  DEFAULT_INTERVAL: 60000, // 60秒，1分钟心跳间隔
  MIN_INTERVAL: 30000, // 最小间隔30秒
  MAX_INTERVAL: 120000, // 最大间隔2分钟
  TIMEOUT_MULTIPLIER: 2.5, // 超时时间倍数（虽然后端不响应，但保留用于连接检测）
  RETRY_ON_SEND_FAILURE: true, // 发送失败时是否重试
  MAX_CONSECUTIVE_FAILURES: 3, // 最大连续失败次数
  CLIENT_TYPE: 'web', // 客户端类型，与后端期望的格式一致
  CLIENT_VERSION: '1.0.0', // 客户端版本，与后端期望的格式一致
  ADAPTIVE_HEARTBEAT: true, // 启用自适应心跳间隔
  CLOSE_ANALYSIS: true // 启用连接关闭分析
}

// 性能监控常量
export const PERFORMANCE_CONSTANTS = {
  MEMORY_CHECK_INTERVAL: 60000, // 1分钟
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
  MEMORY_CRITICAL_THRESHOLD: 200 * 1024 * 1024, // 200MB
  MESSAGE_RATE_WINDOW: 60000, // 1分钟窗口
  MAX_MESSAGE_RATE: 100 // 每分钟最大消息数
}