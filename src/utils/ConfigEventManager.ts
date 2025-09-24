/**
 * 配置事件管理器
 * 管理配置变更的事件通知机制，支持事件的发布和订阅
 */

import { UserConfig } from '../types/config'
import { AppUtil } from './AppUtil'

// 配置事件类型
export enum ConfigEventType {
  CONFIG_LOADED = 'config-loaded',
  CONFIG_UPDATED = 'config-updated',
  CONFIG_RESET = 'config-reset',
  CONFIG_ERROR = 'config-error',
  CONFIG_SYNC_START = 'config-sync-start',
  CONFIG_SYNC_SUCCESS = 'config-sync-success',
  CONFIG_SYNC_FAILURE = 'config-sync-failure'
}

// 配置事件数据接口
export interface ConfigEventData {
  type: ConfigEventType
  config?: Partial<UserConfig>
  changes?: Partial<UserConfig>
  error?: string
  timestamp: number
  source?: string
}

// 事件监听器类型
export type ConfigEventListener = (eventData: ConfigEventData) => void

export class ConfigEventManager {
  private static instance: ConfigEventManager
  private listeners: Map<ConfigEventType, ConfigEventListener[]> = new Map()
  private eventHistory: ConfigEventData[] = []
  private maxHistorySize = 100

  private constructor() {
    // 初始化所有事件类型的监听器数组
    Object.values(ConfigEventType).forEach(eventType => {
      this.listeners.set(eventType, [])
    })
  }

  // 单例模式
  public static getInstance(): ConfigEventManager {
    if (!ConfigEventManager.instance) {
      ConfigEventManager.instance = new ConfigEventManager()
    }
    return ConfigEventManager.instance
  }

  /**
   * 注册事件监听器
   */
  public on(eventType: ConfigEventType, listener: ConfigEventListener): void {
    const listeners = this.listeners.get(eventType) || []
    listeners.push(listener)
    this.listeners.set(eventType, listeners)
    
    AppUtil.info('ConfigEventManager', 'on', 
      `事件监听器已注册: ${eventType}, 当前监听器数量: ${listeners.length}`)
  }

  /**
   * 移除事件监听器
   */
  public off(eventType: ConfigEventType, listener: ConfigEventListener): void {
    const listeners = this.listeners.get(eventType) || []
    const index = listeners.indexOf(listener)
    
    if (index > -1) {
      listeners.splice(index, 1)
      this.listeners.set(eventType, listeners)
      
      AppUtil.info('ConfigEventManager', 'off', 
        `事件监听器已移除: ${eventType}, 当前监听器数量: ${listeners.length}`)
    }
  }

  /**
   * 注册一次性事件监听器
   */
  public once(eventType: ConfigEventType, listener: ConfigEventListener): void {
    const onceListener: ConfigEventListener = (eventData) => {
      listener(eventData)
      this.off(eventType, onceListener)
    }
    this.on(eventType, onceListener)
  }

  /**
   * 发布事件
   */
  public emit(eventType: ConfigEventType, data: Partial<ConfigEventData> = {}): void {
    const eventData: ConfigEventData = {
      type: eventType,
      timestamp: Date.now(),
      ...data
    }

    // 添加到历史记录
    this.addToHistory(eventData)

    // 通知所有监听器
    const listeners = this.listeners.get(eventType) || []
    listeners.forEach(listener => {
      try {
        listener(eventData)
      } catch (error) {
        AppUtil.error('ConfigEventManager', 'emit', 
          `事件监听器执行失败: ${eventType}`, error)
      }
    })

    AppUtil.info('ConfigEventManager', 'emit', 
      `事件已发布: ${eventType}, 通知监听器数量: ${listeners.length}`)
  }

  /**
   * 发布配置加载事件
   */
  public emitConfigLoaded(config: UserConfig, source?: string): void {
    this.emit(ConfigEventType.CONFIG_LOADED, { config, source })
  }

  /**
   * 发布配置更新事件
   */
  public emitConfigUpdated(changes: Partial<UserConfig>, config?: UserConfig, source?: string): void {
    this.emit(ConfigEventType.CONFIG_UPDATED, { changes, config, source })
  }

  /**
   * 发布配置重置事件
   */
  public emitConfigReset(config: UserConfig, source?: string): void {
    this.emit(ConfigEventType.CONFIG_RESET, { config, source })
  }

  /**
   * 发布配置错误事件
   */
  public emitConfigError(error: string, source?: string): void {
    this.emit(ConfigEventType.CONFIG_ERROR, { error, source })
  }

  /**
   * 发布配置同步开始事件
   */
  public emitConfigSyncStart(config: Partial<UserConfig>, source?: string): void {
    this.emit(ConfigEventType.CONFIG_SYNC_START, { config, source })
  }

  /**
   * 发布配置同步成功事件
   */
  public emitConfigSyncSuccess(config: Partial<UserConfig>, source?: string): void {
    this.emit(ConfigEventType.CONFIG_SYNC_SUCCESS, { config, source })
  }

  /**
   * 发布配置同步失败事件
   */
  public emitConfigSyncFailure(error: string, config?: Partial<UserConfig>, source?: string): void {
    this.emit(ConfigEventType.CONFIG_SYNC_FAILURE, { error, config, source })
  }

  /**
   * 获取事件历史记录
   */
  public getEventHistory(): ConfigEventData[] {
    return [...this.eventHistory]
  }

  /**
   * 获取特定类型的事件历史
   */
  public getEventHistoryByType(eventType: ConfigEventType): ConfigEventData[] {
    return this.eventHistory.filter(event => event.type === eventType)
  }

  /**
   * 清除事件历史记录
   */
  public clearEventHistory(): void {
    this.eventHistory = []
    AppUtil.info('ConfigEventManager', 'clearEventHistory', '事件历史记录已清除')
  }

  /**
   * 获取监听器统计信息
   */
  public getListenerStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    this.listeners.forEach((listeners, eventType) => {
      stats[eventType] = listeners.length
    })
    return stats
  }

  /**
   * 移除所有监听器
   */
  public removeAllListeners(eventType?: ConfigEventType): void {
    if (eventType) {
      this.listeners.set(eventType, [])
      AppUtil.info('ConfigEventManager', 'removeAllListeners', 
        `已移除事件类型 ${eventType} 的所有监听器`)
    } else {
      this.listeners.forEach((_, type) => {
        this.listeners.set(type, [])
      })
      AppUtil.info('ConfigEventManager', 'removeAllListeners', '已移除所有事件监听器')
    }
  }

  /**
   * 检查是否有监听器
   */
  public hasListeners(eventType: ConfigEventType): boolean {
    const listeners = this.listeners.get(eventType) || []
    return listeners.length > 0
  }

  /**
   * 获取监听器数量
   */
  public getListenerCount(eventType: ConfigEventType): number {
    const listeners = this.listeners.get(eventType) || []
    return listeners.length
  }

  /**
   * 添加事件到历史记录
   */
  private addToHistory(eventData: ConfigEventData): void {
    this.eventHistory.push(eventData)
    
    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * 设置历史记录最大大小
   */
  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(0, size)
    
    // 如果当前历史记录超过新的限制，进行裁剪
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize)
    }
    
    AppUtil.info('ConfigEventManager', 'setMaxHistorySize', 
      `历史记录最大大小已设置为: ${this.maxHistorySize}`)
  }

  /**
   * 创建事件过滤器
   */
  public createEventFilter(
    eventTypes: ConfigEventType[], 
    callback: ConfigEventListener
  ): ConfigEventListener {
    return (eventData: ConfigEventData) => {
      if (eventTypes.includes(eventData.type)) {
        callback(eventData)
      }
    }
  }

  /**
   * 批量注册事件监听器
   */
  public onMultiple(eventTypes: ConfigEventType[], listener: ConfigEventListener): void {
    eventTypes.forEach(eventType => {
      this.on(eventType, listener)
    })
  }

  /**
   * 批量移除事件监听器
   */
  public offMultiple(eventTypes: ConfigEventType[], listener: ConfigEventListener): void {
    eventTypes.forEach(eventType => {
      this.off(eventType, listener)
    })
  }
}

// 导出单例实例
export const configEventManager = ConfigEventManager.getInstance()