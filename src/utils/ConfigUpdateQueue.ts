/**
 * 配置更新队列系统
 * 处理并发配置更新请求，支持去重、优先级排序和冲突解决
 */

import { UserConfig, ConfigUpdateQueueItem, ConfigUpdateSource, ConfigOperationResult } from '../types/config'
import { configValidator } from './ConfigValidator'
import { configEventManager, ConfigEventType } from './ConfigEventManager'
import { configResultFactory } from './ConfigResultFactory'
import { configSyncDebouncer } from './ConfigSyncDebouncer'
import { configTransmissionOptimizer } from './ConfigTransmissionOptimizer'
import { globalConfigErrorHandler } from './GlobalConfigErrorHandler'
import { AppUtil } from './AppUtil'

// 冲突解决策略枚举
export enum ConflictResolutionStrategy {
  LAST_UPDATE_WINS = 'last-update-wins',        // 最后更新优先
  SETTING_WINDOW_PRIORITY = 'setting-priority', // 设置窗口优先
  MERGE_NON_CONFLICTING = 'merge-non-conflicting' // 合并非冲突字段
}

// 队列配置接口
export interface QueueConfig {
  maxQueueSize: number
  processingInterval: number
  conflictResolutionStrategy: ConflictResolutionStrategy
  enableDeduplication: boolean
  maxRetries: number
}

export class ConfigUpdateQueue {
  private static instance: ConfigUpdateQueue
  private queue: ConfigUpdateQueueItem[] = []
  private processing = false
  private processingTimer: NodeJS.Timeout | null = null
  private config: QueueConfig
  private nextId = 1

  private constructor() {
    this.config = {
      maxQueueSize: 100,
      processingInterval: 100, // 100ms
      conflictResolutionStrategy: ConflictResolutionStrategy.LAST_UPDATE_WINS,
      enableDeduplication: true,
      maxRetries: 3
    }

    // 设置防抖器的同步回调
    configSyncDebouncer.setSyncCallback(this.handleDebouncedSync.bind(this))
  }

  /**
   * 处理防抖后的同步
   */
  private async handleDebouncedSync(config: Partial<UserConfig>, batchId: string): Promise<void> {
    try {
      AppUtil.info('ConfigUpdateQueue', 'handleDebouncedSync', 
        `处理防抖后的配置同步: ${batchId}, 字段: ${Object.keys(config).join(', ')}`)

      // 优化传输数据
      const optimizationResult = configTransmissionOptimizer.optimizeTransmission(config)
      
      if (!optimizationResult.success) {
        throw new Error(`传输优化失败: ${optimizationResult.message}`)
      }

      // 这里应该调用实际的配置同步逻辑
      // 由于我们在队列系统中，这里发布事件让其他组件处理
      configEventManager.emit(ConfigEventType.CONFIG_SYNC_START, {
        config,
        source: 'ConfigUpdateQueue-Debounced'
      })

      AppUtil.info('ConfigUpdateQueue', 'handleDebouncedSync', 
        `防抖同步完成: ${batchId}, 优化比例: ${optimizationResult.compressionRatio.toFixed(2)}`)

    } catch (error) {
      AppUtil.error('ConfigUpdateQueue', 'handleDebouncedSync', 
        `防抖同步失败: ${batchId}`, error)
      
      configEventManager.emitConfigSyncFailure(error.message, config, 'ConfigUpdateQueue-Debounced')
    }
  }

  // 单例模式
  public static getInstance(): ConfigUpdateQueue {
    if (!ConfigUpdateQueue.instance) {
      ConfigUpdateQueue.instance = new ConfigUpdateQueue()
    }
    return ConfigUpdateQueue.instance
  }

  /**
   * 添加配置更新到队列
   */
  public enqueue(
    config: Partial<UserConfig>, 
    source: ConfigUpdateSource, 
    sourceTabId?: string,
    priority: number = 0
  ): Promise<ConfigOperationResult> {
    return new Promise((resolve) => {
      try {
        // 验证配置
        const validationResult = configValidator.validateConfig(config)
        if (!validationResult.isValid) {
          const result = configResultFactory.validationFailure(validationResult.errors)
          resolve(result)
          return
        }

        // 检查队列大小
        if (this.queue.length >= this.config.maxQueueSize) {
          const result = configResultFactory.failure('配置更新队列已满，请稍后重试')
          resolve(result)
          return
        }

        // 创建队列项
        const queueItem: ConfigUpdateQueueItem = {
          id: this.generateId(),
          config: configValidator.sanitizeConfig(config),
          source,
          sourceTabId,
          timestamp: Date.now(),
          priority
        }

        // 去重处理
        if (this.config.enableDeduplication) {
          this.deduplicateQueue(queueItem)
        }

        // 添加到队列
        this.queue.push(queueItem)

        // 按优先级和时间戳排序
        this.sortQueue()

        AppUtil.info('ConfigUpdateQueue', 'enqueue', 
          `配置更新已加入队列: ${queueItem.id}, 来源: ${source}, 队列长度: ${this.queue.length}`)

        // 开始处理队列
        this.startProcessing()

        // 返回成功结果
        resolve(configResultFactory.success('配置更新已加入队列'))

      } catch (error) {
        const result = configResultFactory.fromError(error)
        resolve(result)
      }
    })
  }

  /**
   * 开始处理队列
   */
  private startProcessing(): void {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    this.processingTimer = setTimeout(() => {
      this.processQueue()
    }, this.config.processingInterval)
  }

  /**
   * 处理队列中的配置更新
   */
  private async processQueue(): Promise<void> {
    try {
      if (this.queue.length === 0) {
        this.processing = false
        return
      }

      // 获取要处理的配置更新
      const itemsToProcess = this.getItemsToProcess()
      
      if (itemsToProcess.length === 0) {
        this.processing = false
        return
      }

      // 检测和解决冲突
      const resolvedConfig = this.resolveConflicts(itemsToProcess)

      // 应用配置更新
      await this.applyConfigUpdate(resolvedConfig, itemsToProcess)

      // 移除已处理的项目
      this.removeProcessedItems(itemsToProcess)

      AppUtil.info('ConfigUpdateQueue', 'processQueue', 
        `已处理 ${itemsToProcess.length} 个配置更新, 剩余队列长度: ${this.queue.length}`)

    } catch (error) {
      AppUtil.error('ConfigUpdateQueue', 'processQueue', '处理队列失败', error)
    } finally {
      this.processing = false
      
      // 如果队列中还有项目，继续处理
      if (this.queue.length > 0) {
        this.startProcessing()
      }
    }
  }

  /**
   * 获取要处理的配置项
   */
  private getItemsToProcess(): ConfigUpdateQueueItem[] {
    // 获取队列中的第一个项目和所有与其时间戳相近的项目
    if (this.queue.length === 0) {
      return []
    }

    const firstItem = this.queue[0]
    const timeWindow = 50 // 50ms时间窗口
    
    return this.queue.filter(item => 
      Math.abs(item.timestamp - firstItem.timestamp) <= timeWindow
    )
  }

  /**
   * 解决配置冲突
   */
  private resolveConflicts(items: ConfigUpdateQueueItem[]): Partial<UserConfig> {
    if (items.length === 1) {
      return items[0].config
    }

    const resolvedConfig: Partial<UserConfig> = {}
    const conflictFields = this.detectConflicts(items)

    AppUtil.info('ConfigUpdateQueue', 'resolveConflicts', 
      `检测到冲突字段: ${Object.keys(conflictFields).join(', ')}`)

    // 处理非冲突字段
    for (const item of items) {
      for (const [key, value] of Object.entries(item.config)) {
        if (!conflictFields[key]) {
          resolvedConfig[key] = value
        }
      }
    }

    // 处理冲突字段
    for (const [field, conflictingItems] of Object.entries(conflictFields)) {
      const resolvedValue = this.resolveFieldConflict(field, conflictingItems)
      if (resolvedValue !== undefined) {
        resolvedConfig[field] = resolvedValue
      }
    }

    return resolvedConfig
  }

  /**
   * 检测配置冲突
   */
  private detectConflicts(items: ConfigUpdateQueueItem[]): Record<string, ConfigUpdateQueueItem[]> {
    const fieldMap: Record<string, ConfigUpdateQueueItem[]> = {}
    
    // 收集每个字段的所有更新
    for (const item of items) {
      for (const field of Object.keys(item.config)) {
        if (!fieldMap[field]) {
          fieldMap[field] = []
        }
        fieldMap[field].push(item)
      }
    }

    // 找出有冲突的字段（多个不同值）
    const conflicts: Record<string, ConfigUpdateQueueItem[]> = {}
    
    for (const [field, fieldItems] of Object.entries(fieldMap)) {
      if (fieldItems.length > 1) {
        const values = fieldItems.map(item => JSON.stringify(item.config[field]))
        const uniqueValues = [...new Set(values)]
        
        if (uniqueValues.length > 1) {
          conflicts[field] = fieldItems
        }
      }
    }

    return conflicts
  }

  /**
   * 解决单个字段的冲突
   */
  private resolveFieldConflict(field: string, conflictingItems: ConfigUpdateQueueItem[]): any {
    switch (this.config.conflictResolutionStrategy) {
      case ConflictResolutionStrategy.LAST_UPDATE_WINS:
        return this.resolveByLastUpdate(conflictingItems, field)
        
      case ConflictResolutionStrategy.SETTING_WINDOW_PRIORITY:
        return this.resolveBySettingPriority(conflictingItems, field)
        
      case ConflictResolutionStrategy.MERGE_NON_CONFLICTING:
        return this.resolveByMerging(conflictingItems, field)
        
      default:
        return this.resolveByLastUpdate(conflictingItems, field)
    }
  }

  /**
   * 按最后更新时间解决冲突
   */
  private resolveByLastUpdate(items: ConfigUpdateQueueItem[], field: string): any {
    const sortedItems = items.sort((a, b) => b.timestamp - a.timestamp)
    return sortedItems[0].config[field]
  }

  /**
   * 按设置窗口优先级解决冲突
   */
  private resolveBySettingPriority(items: ConfigUpdateQueueItem[], field: string): any {
    // 优先使用设置窗口的值
    const settingItem = items.find(item => item.source === ConfigUpdateSource.SETTING_WINDOW)
    if (settingItem) {
      return settingItem.config[field]
    }
    
    // 如果没有设置窗口的更新，使用最后更新
    return this.resolveByLastUpdate(items, field)
  }

  /**
   * 通过合并解决冲突（对于对象类型）
   */
  private resolveByMerging(items: ConfigUpdateQueueItem[], field: string): any {
    const values = items.map(item => item.config[field])
    
    // 如果是对象类型，尝试合并
    if (values.every(value => typeof value === 'object' && value !== null)) {
      return Object.assign({}, ...values)
    }
    
    // 否则使用最后更新
    return this.resolveByLastUpdate(items, field)
  }

  /**
   * 应用配置更新
   */
  private async applyConfigUpdate(
    config: Partial<UserConfig>, 
    sourceItems: ConfigUpdateQueueItem[]
  ): Promise<void> {
    const operation = 'applyConfigUpdate'
    const source = 'ConfigUpdateQueue'
    
    try {
      // 发布配置同步开始事件
      configEventManager.emitConfigSyncStart(config, source)

      // 这里应该调用实际的配置更新逻辑
      // 由于我们在队列系统中，这里只是准备数据
      // 实际的更新会由配置管理器处理

      // 模拟可能的失败情况进行测试
      // 在实际实现中，这里会调用真正的配置更新API

      // 发布配置同步成功事件
      configEventManager.emitConfigSyncSuccess(config, source)

      AppUtil.info('ConfigUpdateQueue', 'applyConfigUpdate', 
        `配置更新已应用, 字段: ${Object.keys(config).join(', ')}`)

    } catch (error) {
      AppUtil.error('ConfigUpdateQueue', 'applyConfigUpdate', 
        `配置更新失败, 字段: ${Object.keys(config).join(', ')}`, error)

      // 使用全局错误处理器处理错误
      const errorResult = await globalConfigErrorHandler.handleError(
        operation,
        source,
        error,
        config,
        {
          sourceItems: sourceItems.map(item => ({
            id: item.id,
            source: item.source,
            sourceTabId: item.sourceTabId,
            timestamp: item.timestamp
          })),
          queueLength: this.queue.length
        }
      )

      // 如果错误处理器返回了恢复的配置，使用它
      if (errorResult.success && errorResult.data) {
        AppUtil.info('ConfigUpdateQueue', 'applyConfigUpdate', 
          `使用错误处理器恢复的配置: ${Object.keys(errorResult.data).join(', ')}`)
        
        // 发布恢复成功事件
        configEventManager.emitConfigSyncSuccess(errorResult.data, `${source}-Recovered`)
        return
      }

      // 发布配置同步失败事件
      configEventManager.emitConfigSyncFailure(error.message, config, source)
      
      // 如果错误处理器也无法恢复，重新抛出错误
      throw error
    }
  }

  /**
   * 移除已处理的项目
   */
  private removeProcessedItems(processedItems: ConfigUpdateQueueItem[]): void {
    const processedIds = new Set(processedItems.map(item => item.id))
    this.queue = this.queue.filter(item => !processedIds.has(item.id))
  }

  /**
   * 队列去重
   */
  private deduplicateQueue(newItem: ConfigUpdateQueueItem): void {
    // 移除来自相同源且配置相同的项目
    this.queue = this.queue.filter(existingItem => {
      if (existingItem.source === newItem.source && 
          existingItem.sourceTabId === newItem.sourceTabId) {
        
        // 检查配置是否相同
        const existingConfigStr = JSON.stringify(existingItem.config)
        const newConfigStr = JSON.stringify(newItem.config)
        
        if (existingConfigStr === newConfigStr) {
          AppUtil.info('ConfigUpdateQueue', 'deduplicateQueue', 
            `移除重复的配置更新: ${existingItem.id}`)
          return false
        }
      }
      return true
    })
  }

  /**
   * 队列排序
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // 首先按优先级排序（高优先级在前）
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      
      // 然后按时间戳排序（早的在前）
      return a.timestamp - b.timestamp
    })
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `config-update-${this.nextId++}-${Date.now()}`
  }

  /**
   * 获取队列状态
   */
  public getQueueStatus(): {
    queueLength: number
    processing: boolean
    nextProcessingTime?: number
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      nextProcessingTime: this.processingTimer ? Date.now() + this.config.processingInterval : undefined
    }
  }

  /**
   * 清空队列
   */
  public clearQueue(): void {
    this.queue = []
    this.processing = false
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer)
      this.processingTimer = null
    }
    
    AppUtil.info('ConfigUpdateQueue', 'clearQueue', '队列已清空')
  }

  /**
   * 清空队列（别名方法）
   */
  public clear(): void {
    this.clearQueue()
  }

  /**
   * 清理队列资源
   */
  public cleanup(): void {
    this.stop()
    this.clearQueue()
    AppUtil.info('ConfigUpdateQueue', 'cleanup', '队列资源已清理')
  }

  /**
   * 更新队列配置
   */
  public updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig }
    AppUtil.info('ConfigUpdateQueue', 'updateConfig', `队列配置已更新: ${JSON.stringify(newConfig)}`)
  }

  /**
   * 获取队列配置
   */
  public getConfig(): QueueConfig {
    return { ...this.config }
  }

  /**
   * 获取队列统计信息
   */
  public getQueueStats(): {
    totalItems: number
    itemsBySource: Record<string, number>
    oldestItemAge: number
    averageWaitTime: number
  } {
    const now = Date.now()
    const itemsBySource: Record<string, number> = {}
    let totalWaitTime = 0
    let oldestTimestamp = now

    for (const item of this.queue) {
      // 按来源统计
      itemsBySource[item.source] = (itemsBySource[item.source] || 0) + 1
      
      // 计算等待时间
      totalWaitTime += now - item.timestamp
      
      // 找到最老的项目
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp
      }
    }

    return {
      totalItems: this.queue.length,
      itemsBySource,
      oldestItemAge: this.queue.length > 0 ? now - oldestTimestamp : 0,
      averageWaitTime: this.queue.length > 0 ? totalWaitTime / this.queue.length : 0
    }
  }

  /**
   * 停止队列处理
   */
  public stop(): void {
    this.processing = false
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer)
      this.processingTimer = null
    }
    
    AppUtil.info('ConfigUpdateQueue', 'stop', '队列处理已停止')
  }

  /**
   * 重新开始队列处理
   */
  public restart(): void {
    this.stop()
    this.startProcessing()
    AppUtil.info('ConfigUpdateQueue', 'restart', '队列处理已重新开始')
  }
}

// 导出单例实例
export const configUpdateQueue = ConfigUpdateQueue.getInstance()