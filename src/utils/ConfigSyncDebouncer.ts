/**
 * 配置同步防抖和批处理器
 * 避免频繁的配置同步，优化配置数据的传输效率
 */

import { UserConfig, ConfigUpdateSource } from '../types/config'
import { configLogger } from './ConfigLogger'
import { AppUtil } from './AppUtil'

// 防抖配置
export interface DebounceConfig {
  delay: number // 防抖延迟（毫秒）
  maxWait: number // 最大等待时间（毫秒）
  enableBatching: boolean // 是否启用批处理
  maxBatchSize: number // 最大批处理大小
  enableLogging: boolean // 是否启用日志
}

// 批处理项
export interface BatchItem {
  id: string
  config: Partial<UserConfig>
  source: ConfigUpdateSource
  sourceTabId?: string
  timestamp: number
  priority: number
}

// 防抖结果
export interface DebounceResult {
  success: boolean
  batchId: string
  itemCount: number
  mergedConfig: Partial<UserConfig>
  duration: number
}

export class ConfigSyncDebouncer {
  private static instance: ConfigSyncDebouncer
  private config: DebounceConfig
  private pendingBatch: BatchItem[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private maxWaitTimer: NodeJS.Timeout | null = null
  private batchStartTime: number = 0
  private nextBatchId = 1
  private syncCallback: ((config: Partial<UserConfig>, batchId: string) => Promise<void>) | null = null

  private constructor() {
    this.config = {
      delay: 300, // 300ms防抖延迟
      maxWait: 2000, // 最大等待2秒
      enableBatching: true,
      maxBatchSize: 10,
      enableLogging: true
    }
  }

  // 单例模式
  public static getInstance(): ConfigSyncDebouncer {
    if (!ConfigSyncDebouncer.instance) {
      ConfigSyncDebouncer.instance = new ConfigSyncDebouncer()
    }
    return ConfigSyncDebouncer.instance
  }

  /**
   * 设置同步回调函数
   */
  public setSyncCallback(callback: (config: Partial<UserConfig>, batchId: string) => Promise<void>): void {
    this.syncCallback = callback
  }

  /**
   * 添加配置更新到防抖队列
   */
  public addConfigUpdate(
    config: Partial<UserConfig>,
    source: ConfigUpdateSource,
    sourceTabId?: string,
    priority: number = 0
  ): Promise<DebounceResult> {
    return new Promise((resolve, reject) => {
      try {
        const batchItem: BatchItem = {
          id: this.generateItemId(),
          config,
          source,
          sourceTabId,
          timestamp: Date.now(),
          priority
        }

        // 如果是第一个项目，记录批处理开始时间
        if (this.pendingBatch.length === 0) {
          this.batchStartTime = Date.now()
        }

        // 添加到待处理批次
        this.pendingBatch.push(batchItem)

        // 按优先级排序
        this.sortBatch()

        if (this.config.enableLogging) {
          AppUtil.debug('ConfigSyncDebouncer', 'addConfigUpdate', 
            `添加配置更新到批次: ${batchItem.id}, 来源: ${source}, 当前批次大小: ${this.pendingBatch.length}`)
        }

        // 检查是否需要立即处理
        if (this.shouldProcessImmediately()) {
          this.processImmediately().then(resolve).catch(reject)
          return
        }

        // 设置防抖定时器
        this.setupDebounceTimer(resolve, reject)

        // 设置最大等待定时器
        this.setupMaxWaitTimer(resolve, reject)

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 检查是否应该立即处理
   */
  private shouldProcessImmediately(): boolean {
    // 如果批次已满
    if (this.pendingBatch.length >= this.config.maxBatchSize) {
      return true
    }

    // 如果有高优先级项目
    const hasHighPriority = this.pendingBatch.some(item => item.priority >= 10)
    if (hasHighPriority) {
      return true
    }

    return false
  }

  /**
   * 立即处理批次
   */
  private async processImmediately(): Promise<DebounceResult> {
    this.clearTimers()
    return await this.processBatch()
  }

  /**
   * 设置防抖定时器
   */
  private setupDebounceTimer(
    resolve: (result: DebounceResult) => void,
    reject: (error: Error) => void
  ): void {
    // 清除现有定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const result = await this.processBatch()
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }, this.config.delay)
  }

  /**
   * 设置最大等待定时器
   */
  private setupMaxWaitTimer(
    resolve: (result: DebounceResult) => void,
    reject: (error: Error) => void
  ): void {
    // 如果已经有最大等待定时器，不重复设置
    if (this.maxWaitTimer) {
      return
    }

    this.maxWaitTimer = setTimeout(async () => {
      try {
        const result = await this.processBatch()
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }, this.config.maxWait)
  }

  /**
   * 处理批次
   */
  private async processBatch(): Promise<DebounceResult> {
    const startTime = Date.now()
    const batchId = this.generateBatchId()
    
    try {
      // 清除定时器
      this.clearTimers()

      // 如果没有待处理项目
      if (this.pendingBatch.length === 0) {
        return {
          success: true,
          batchId,
          itemCount: 0,
          mergedConfig: {},
          duration: Date.now() - startTime
        }
      }

      // 获取当前批次
      const currentBatch = [...this.pendingBatch]
      this.pendingBatch = []

      // 合并配置
      const mergedConfig = this.mergeConfigs(currentBatch)

      // 记录批处理日志
      if (this.config.enableLogging) {
        configLogger.logConfigChange(
          'batchProcess',
          'ConfigSyncDebouncer',
          null,
          mergedConfig,
          true,
          `批处理配置同步: ${currentBatch.length} 个项目`,
          undefined,
          Date.now() - this.batchStartTime,
          {
            batchId,
            itemCount: currentBatch.length,
            sources: this.getBatchSources(currentBatch),
            configFields: Object.keys(mergedConfig)
          }
        )
      }

      // 执行同步回调
      if (this.syncCallback) {
        await this.syncCallback(mergedConfig, batchId)
      }

      const result: DebounceResult = {
        success: true,
        batchId,
        itemCount: currentBatch.length,
        mergedConfig,
        duration: Date.now() - startTime
      }

      if (this.config.enableLogging) {
        AppUtil.info('ConfigSyncDebouncer', 'processBatch', 
          `批处理完成: ${batchId}, 项目数: ${currentBatch.length}, 耗时: ${result.duration}ms`)
      }

      return result

    } catch (error) {
      // 记录错误日志
      configLogger.logError('batchProcess', 'ConfigSyncDebouncer', error, { batchId })
      
      AppUtil.error('ConfigSyncDebouncer', 'processBatch', 
        `批处理失败: ${batchId}`, error)

      throw error
    }
  }

  /**
   * 合并配置
   */
  private mergeConfigs(batch: BatchItem[]): Partial<UserConfig> {
    const merged: Partial<UserConfig> = {}
    
    // 按时间戳排序，后面的覆盖前面的
    const sortedBatch = batch.sort((a, b) => a.timestamp - b.timestamp)

    for (const item of sortedBatch) {
      Object.assign(merged, item.config)
    }

    return merged
  }

  /**
   * 获取批次来源统计
   */
  private getBatchSources(batch: BatchItem[]): Record<string, number> {
    const sources: Record<string, number> = {}
    
    for (const item of batch) {
      sources[item.source] = (sources[item.source] || 0) + 1
    }

    return sources
  }

  /**
   * 批次排序
   */
  private sortBatch(): void {
    this.pendingBatch.sort((a, b) => {
      // 首先按优先级排序（高优先级在前）
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      
      // 然后按时间戳排序（早的在前）
      return a.timestamp - b.timestamp
    })
  }

  /**
   * 清除定时器
   */
  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer)
      this.maxWaitTimer = null
    }
  }

  /**
   * 生成项目ID
   */
  private generateItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成批次ID
   */
  private generateBatchId(): string {
    return `batch-${this.nextBatchId++}-${Date.now()}`
  }

  /**
   * 强制处理当前批次
   */
  public async flush(): Promise<DebounceResult | null> {
    if (this.pendingBatch.length === 0) {
      return null
    }

    return await this.processImmediately()
  }

  /**
   * 取消当前批次
   */
  public cancel(): void {
    this.clearTimers()
    this.pendingBatch = []
    
    if (this.config.enableLogging) {
      AppUtil.info('ConfigSyncDebouncer', 'cancel', '当前批次已取消')
    }
  }

  /**
   * 获取防抖状态
   */
  public getDebounceStatus(): {
    hasPendingBatch: boolean
    pendingItemCount: number
    batchStartTime: number
    timeUntilProcess: number
    timeUntilMaxWait: number
  } {
    const now = Date.now()
    
    return {
      hasPendingBatch: this.pendingBatch.length > 0,
      pendingItemCount: this.pendingBatch.length,
      batchStartTime: this.batchStartTime,
      timeUntilProcess: this.debounceTimer ? this.config.delay : 0,
      timeUntilMaxWait: this.maxWaitTimer ? Math.max(0, this.config.maxWait - (now - this.batchStartTime)) : 0
    }
  }

  /**
   * 获取批次统计信息
   */
  public getBatchStats(): {
    pendingItems: number
    sourceDistribution: Record<string, number>
    priorityDistribution: Record<string, number>
    oldestItemAge: number
  } {
    const now = Date.now()
    const sourceDistribution: Record<string, number> = {}
    const priorityDistribution: Record<string, number> = {}
    let oldestTimestamp = now

    for (const item of this.pendingBatch) {
      // 来源分布
      sourceDistribution[item.source] = (sourceDistribution[item.source] || 0) + 1
      
      // 优先级分布
      const priorityKey = item.priority >= 10 ? 'high' : item.priority >= 5 ? 'medium' : 'low'
      priorityDistribution[priorityKey] = (priorityDistribution[priorityKey] || 0) + 1
      
      // 最老项目时间
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp
      }
    }

    return {
      pendingItems: this.pendingBatch.length,
      sourceDistribution,
      priorityDistribution,
      oldestItemAge: this.pendingBatch.length > 0 ? now - oldestTimestamp : 0
    }
  }

  /**
   * 更新防抖配置
   */
  public updateConfig(newConfig: Partial<DebounceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (this.config.enableLogging) {
      AppUtil.info('ConfigSyncDebouncer', 'updateConfig', 
        `防抖配置已更新: ${JSON.stringify(newConfig)}`)
    }
  }

  /**
   * 获取防抖配置
   */
  public getConfig(): DebounceConfig {
    return { ...this.config }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.clearTimers()
    this.pendingBatch = []
    this.syncCallback = null
    
    AppUtil.info('ConfigSyncDebouncer', 'cleanup', '防抖器资源已清理')
  }
}

// 导出单例实例
export const configSyncDebouncer = ConfigSyncDebouncer.getInstance()

// 导出便捷函数
export const debounceConfigSync = (
  config: Partial<UserConfig>,
  source: ConfigUpdateSource,
  sourceTabId?: string,
  priority?: number
) => configSyncDebouncer.addConfigUpdate(config, source, sourceTabId, priority)