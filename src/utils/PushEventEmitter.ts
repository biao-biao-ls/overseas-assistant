/**
 * WebSocket 推送功能专用事件发射器
 * 基于 Node.js EventEmitter，添加了类型安全和推送相关的事件处理
 */

import { EventEmitter } from 'events'
import { PushEventType, PushEventData, PushError } from '../types/push'
import { PushError as PushErrorClass } from './PushError'

/**
 * 推送事件发射器类
 * 提供类型安全的事件发射和监听功能
 */
export class PushEventEmitter extends EventEmitter {
  private maxListeners: number = 20

  constructor() {
    super()
    this.setMaxListeners(this.maxListeners)
  }

  /**
   * 发射推送事件
   */
  emitPushEvent(type: PushEventType, data?: any, error?: PushErrorClass): void {
    const eventData: PushEventData = {
      type,
      timestamp: Date.now(),
      data,
      error
    }

    this.emit(type, eventData)
    this.emit('push_event', eventData)
  }

  /**
   * 监听特定类型的推送事件
   */
  onPushEvent(type: PushEventType, listener: (eventData: PushEventData) => void): this {
    return this.on(type, listener)
  }

  /**
   * 监听所有推送事件
   */
  onAnyPushEvent(listener: (eventData: PushEventData) => void): this {
    return this.on('push_event', listener)
  }

  /**
   * 移除特定类型的事件监听器
   */
  offPushEvent(type: PushEventType, listener: (eventData: PushEventData) => void): this {
    return this.off(type, listener)
  }

  /**
   * 移除所有推送事件监听器
   */
  offAllPushEvents(): this {
    this.removeAllListeners()
    return this
  }

  /**
   * 一次性监听推送事件
   */
  oncePushEvent(type: PushEventType, listener: (eventData: PushEventData) => void): this {
    return this.once(type, listener)
  }

  /**
   * 发射连接打开事件
   */
  emitConnectionOpened(data?: any): void {
    this.emitPushEvent(PushEventType.CONNECTION_OPENED, data)
  }

  /**
   * 发射连接关闭事件
   */
  emitConnectionClosed(data?: any): void {
    this.emitPushEvent(PushEventType.CONNECTION_CLOSED, data)
  }

  /**
   * 发射连接错误事件
   */
  emitConnectionError(error: PushErrorClass, data?: any): void {
    this.emitPushEvent(PushEventType.CONNECTION_ERROR, data, error)
  }

  /**
   * 发射消息接收事件
   */
  emitMessageReceived(data: any): void {
    this.emitPushEvent(PushEventType.MESSAGE_RECEIVED, data)
  }

  /**
   * 发射通知显示事件
   */
  emitNotificationShown(data: any): void {
    this.emitPushEvent(PushEventType.NOTIFICATION_SHOWN, data)
  }

  /**
   * 发射通知点击事件
   */
  emitNotificationClicked(data: any): void {
    this.emitPushEvent(PushEventType.NOTIFICATION_CLICKED, data)
  }

  /**
   * 发射 Token 刷新事件
   */
  emitTokenRefreshed(data: any): void {
    this.emitPushEvent(PushEventType.TOKEN_REFRESHED, data)
  }

  /**
   * 发射服务启动事件
   */
  emitServiceStarted(data?: any): void {
    this.emitPushEvent(PushEventType.SERVICE_STARTED, data)
  }

  /**
   * 发射服务停止事件
   */
  emitServiceStopped(data?: any): void {
    this.emitPushEvent(PushEventType.SERVICE_STOPPED, data)
  }

  /**
   * 获取事件统计信息
   */
  getEventStats(): { [eventType: string]: number } {
    const stats: { [eventType: string]: number } = {}
    
    for (const eventType of Object.values(PushEventType)) {
      stats[eventType] = this.listenerCount(eventType)
    }
    
    return stats
  }

  /**
   * 检查是否有特定事件的监听器
   */
  hasListeners(type: PushEventType): boolean {
    return this.listenerCount(type) > 0
  }

  /**
   * 设置最大监听器数量
   */
  setMaxListenersCount(count: number): this {
    this.maxListeners = count
    return this.setMaxListeners(count)
  }

  /**
   * 获取最大监听器数量
   */
  getMaxListenersCount(): number {
    return this.maxListeners
  }

  /**
   * 清理所有监听器并重置状态
   */
  cleanup(): void {
    this.removeAllListeners()
  }
}