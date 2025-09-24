/**
 * WebSocket 推送功能专用错误类
 */

import { PushError as IPushError, PushErrorType } from '../types/push'

/**
 * 推送功能专用错误类
 * 继承自 Error，添加了推送相关的错误信息
 */
export class PushError extends Error implements IPushError {
  public readonly type: PushErrorType
  public readonly code?: string
  public readonly details?: any
  public readonly timestamp: number

  constructor(
    type: PushErrorType,
    message: string,
    code?: string,
    details?: any
  ) {
    super(message)
    
    this.name = 'PushError'
    this.type = type
    this.code = code
    this.details = details
    this.timestamp = Date.now()

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PushError)
    }
  }

  /**
   * 创建连接错误
   */
  static connectionError(message: string, code?: string, details?: any): PushError {
    return new PushError(PushErrorType.CONNECTION_ERROR, message, code, details)
  }

  /**
   * 创建 Token 错误
   */
  static tokenError(message: string, code?: string, details?: any): PushError {
    return new PushError(PushErrorType.TOKEN_ERROR, message, code, details)
  }

  /**
   * 创建消息解析错误
   */
  static messageParseError(message: string, code?: string, details?: any): PushError {
    return new PushError(PushErrorType.MESSAGE_PARSE_ERROR, message, code, details)
  }

  /**
   * 创建通知错误
   */
  static notificationError(message: string, code?: string, details?: any): PushError {
    return new PushError(PushErrorType.NOTIFICATION_ERROR, message, code, details)
  }

  /**
   * 创建网络错误
   */
  static networkError(message: string, code?: string, details?: any): PushError {
    return new PushError(PushErrorType.NETWORK_ERROR, message, code, details)
  }

  /**
   * 创建权限错误
   */
  static permissionError(message: string, code?: string, details?: any): PushError {
    return new PushError(PushErrorType.PERMISSION_ERROR, message, code, details)
  }

  /**
   * 将错误转换为 JSON 对象
   */
  toJSON(): object {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }

  /**
   * 获取错误的简短描述
   */
  getShortDescription(): string {
    return `[${this.type}] ${this.message}`
  }

  /**
   * 获取错误的详细描述
   */
  getDetailedDescription(): string {
    let description = `[${this.type}] ${this.message}`
    
    if (this.code) {
      description += ` (Code: ${this.code})`
    }
    
    if (this.details) {
      description += ` Details: ${JSON.stringify(this.details)}`
    }
    
    return description
  }

  /**
   * 检查是否为可重试的错误
   */
  isRetryable(): boolean {
    switch (this.type) {
      case PushErrorType.NETWORK_ERROR:
      case PushErrorType.CONNECTION_ERROR:
        return true
      case PushErrorType.TOKEN_ERROR:
        // Token 错误通常可以通过刷新 token 重试
        return this.code !== 'INVALID_CREDENTIALS'
      case PushErrorType.MESSAGE_PARSE_ERROR:
      case PushErrorType.NOTIFICATION_ERROR:
      case PushErrorType.PERMISSION_ERROR:
        return false
      default:
        return false
    }
  }

  /**
   * 获取建议的重试延迟时间（毫秒）
   */
  getRetryDelay(): number {
    switch (this.type) {
      case PushErrorType.NETWORK_ERROR:
        return 5000 // 5秒
      case PushErrorType.CONNECTION_ERROR:
        return 3000 // 3秒
      case PushErrorType.TOKEN_ERROR:
        return 2000 // 2秒
      default:
        return 1000 // 1秒
    }
  }
}