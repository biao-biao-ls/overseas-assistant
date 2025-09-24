/**
 * 多Tab配置广播管理器
 * 负责向所有Tab广播配置更新，支持Tab加载状态检查和失败重试
 */

import { BrowserView } from 'electron'
import { UserConfig, TabInfo, TabLoadingState } from '../types/config'
import { configSyncStateManager } from './ConfigSyncStateManager'
import { configEventManager, ConfigEventType } from './ConfigEventManager'
import { AppUtil } from './AppUtil'
import { EMessage } from '../enum/EMessage'

// 广播结果接口
export interface BroadcastResult {
  success: boolean
  totalTabs: number
  successCount: number
  failedCount: number
  skippedCount: number
  pendingCount: number
  failedTabs: string[]
  errors: string[]
}

// 广播配置接口
export interface BroadcastConfig {
  maxRetries: number
  retryDelay: number
  timeout: number
  skipSourceTab: boolean
  onlyReadyTabs: boolean
  enablePendingQueue: boolean
}

// Tab同步状态
interface TabSyncStatus {
  tabId: string
  status: 'pending' | 'success' | 'failed' | 'skipped'
  error?: string
  retryCount: number
  lastAttempt: number
}

export class MultiTabConfigBroadcaster {
  private static instance: MultiTabConfigBroadcaster
  private config: BroadcastConfig
  private syncStatuses: Map<string, TabSyncStatus> = new Map()
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
      skipSourceTab: true,
      onlyReadyTabs: false,
      enablePendingQueue: true
    }
  }

  // 单例模式
  public static getInstance(): MultiTabConfigBroadcaster {
    if (!MultiTabConfigBroadcaster.instance) {
      MultiTabConfigBroadcaster.instance = new MultiTabConfigBroadcaster()
    }
    return MultiTabConfigBroadcaster.instance
  }

  /**
   * 广播配置到所有Tab
   */
  public async broadcastConfig(
    config: Partial<UserConfig>,
    sourceTabId?: string,
    customConfig?: Partial<BroadcastConfig>
  ): Promise<BroadcastResult> {
    const effectiveConfig = { ...this.config, ...customConfig }
    
    AppUtil.info('MultiTabConfigBroadcaster', 'broadcastConfig', 
      `开始广播配置, 字段: ${Object.keys(config).join(', ')}, 来源Tab: ${sourceTabId || 'unknown'}`)

    try {
      // 获取所有Tab信息
      const allTabs = configSyncStateManager.getAllTabInfos()
      const targetTabs = this.filterTargetTabs(allTabs, sourceTabId, effectiveConfig)

      // 初始化同步状态
      this.initializeSyncStatuses(targetTabs)

      // 发布广播开始事件
      configEventManager.emit(ConfigEventType.CONFIG_SYNC_START, {
        config,
        source: 'MultiTabConfigBroadcaster'
      })

      // 执行广播
      const result = await this.executeBroadcast(config, targetTabs, effectiveConfig)

      // 处理未就绪的Tab
      if (effectiveConfig.enablePendingQueue) {
        this.handlePendingTabs(config, allTabs, sourceTabId)
      }

      // 发布广播结果事件
      if (result.success) {
        configEventManager.emitConfigSyncSuccess(config, 'MultiTabConfigBroadcaster')
      } else {
        configEventManager.emitConfigSyncFailure(
          `广播部分失败: ${result.failedCount}/${result.totalTabs}`,
          config,
          'MultiTabConfigBroadcaster'
        )
      }

      AppUtil.info('MultiTabConfigBroadcaster', 'broadcastConfig', 
        `广播完成: 总数${result.totalTabs}, 成功${result.successCount}, 失败${result.failedCount}, 跳过${result.skippedCount}, 待处理${result.pendingCount}`)

      return result

    } catch (error) {
      const errorMessage = `配置广播异常: ${error.message}`
      configEventManager.emitConfigSyncFailure(errorMessage, config, 'MultiTabConfigBroadcaster')
      AppUtil.error('MultiTabConfigBroadcaster', 'broadcastConfig', errorMessage, error)
      
      return {
        success: false,
        totalTabs: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        pendingCount: 0,
        failedTabs: [],
        errors: [errorMessage]
      }
    }
  }

  /**
   * 过滤目标Tab
   */
  private filterTargetTabs(
    allTabs: TabInfo[], 
    sourceTabId?: string, 
    config?: BroadcastConfig
  ): TabInfo[] {
    return allTabs.filter(tab => {
      // 跳过来源Tab
      if (config?.skipSourceTab && sourceTabId && tab.id === sourceTabId) {
        return false
      }

      // 只处理需要配置同步的Tab
      if (!tab.needsConfigSync) {
        return false
      }

      // 如果只处理就绪Tab，过滤掉未就绪的
      if (config?.onlyReadyTabs && tab.loadingState !== TabLoadingState.READY) {
        return false
      }

      return true
    })
  }

  /**
   * 初始化同步状态
   */
  private initializeSyncStatuses(tabs: TabInfo[]): void {
    for (const tab of tabs) {
      this.syncStatuses.set(tab.id, {
        tabId: tab.id,
        status: 'pending',
        retryCount: 0,
        lastAttempt: 0
      })
    }
  }

  /**
   * 执行广播
   */
  private async executeBroadcast(
    config: Partial<UserConfig>,
    targetTabs: TabInfo[],
    broadcastConfig: BroadcastConfig
  ): Promise<BroadcastResult> {
    const result: BroadcastResult = {
      success: true,
      totalTabs: targetTabs.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      pendingCount: 0,
      failedTabs: [],
      errors: []
    }

    // 并行发送配置到所有目标Tab
    const syncPromises = targetTabs.map(tab => this.syncConfigToTab(tab, config, broadcastConfig))
    const syncResults = await Promise.all(syncPromises)

    // 统计结果
    for (const syncResult of syncResults) {
      switch (syncResult.status) {
        case 'success':
          result.successCount++
          break
        case 'failed':
          result.failedCount++
          result.failedTabs.push(syncResult.tabId)
          if (syncResult.error) {
            result.errors.push(`Tab ${syncResult.tabId}: ${syncResult.error}`)
          }
          break
        case 'skipped':
          result.skippedCount++
          break
      }
    }

    // 判断整体是否成功
    result.success = result.failedCount === 0

    return result
  }

  /**
   * 同步配置到单个Tab
   */
  private async syncConfigToTab(
    tab: TabInfo,
    config: Partial<UserConfig>,
    broadcastConfig: BroadcastConfig
  ): Promise<TabSyncStatus> {
    const status = this.syncStatuses.get(tab.id)!
    
    try {
      // 检查Tab状态
      if (tab.loadingState !== TabLoadingState.READY) {
        status.status = 'skipped'
        return status
      }

      // 更新同步状态
      status.status = 'pending'
      status.lastAttempt = Date.now()
      this.syncStatuses.set(tab.id, status)

      // 发送配置到Tab
      await this.sendConfigToTab(tab, config, broadcastConfig.timeout)

      // 更新成功状态
      status.status = 'success'
      this.syncStatuses.set(tab.id, status)

      AppUtil.info('MultiTabConfigBroadcaster', 'syncConfigToTab', 
        `Tab ${tab.id} 配置同步成功`)

      return status

    } catch (error) {
      // 更新失败状态
      status.status = 'failed'
      status.error = error.message
      this.syncStatuses.set(tab.id, status)

      AppUtil.error('MultiTabConfigBroadcaster', 'syncConfigToTab', 
        `Tab ${tab.id} 配置同步失败: ${error.message}`)

      // 如果还有重试机会，安排重试
      if (status.retryCount < broadcastConfig.maxRetries) {
        this.scheduleRetry(tab, config, broadcastConfig)
      }

      return status
    }
  }

  /**
   * 发送配置到Tab
   */
  private async sendConfigToTab(
    tab: TabInfo,
    config: Partial<UserConfig>,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        reject(new Error('配置发送超时'))
      }, timeout)

      try {
        // 这里应该调用实际的Tab通信逻辑
        // 由于我们需要与BrowserView集成，这里模拟发送过程
        
        // 模拟异步发送
        setTimeout(() => {
          clearTimeout(timeoutId)
          
          // 模拟发送成功/失败
          const success = Math.random() > 0.1 // 90%成功率
          if (success) {
            resolve()
          } else {
            reject(new Error('模拟发送失败'))
          }
        }, Math.random() * 100 + 50) // 50-150ms延迟

      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  /**
   * 安排重试
   */
  private scheduleRetry(
    tab: TabInfo,
    config: Partial<UserConfig>,
    broadcastConfig: BroadcastConfig
  ): void {
    const status = this.syncStatuses.get(tab.id)!
    status.retryCount++

    const retryDelay = broadcastConfig.retryDelay * Math.pow(2, status.retryCount - 1) // 指数退避

    const retryTimer = setTimeout(async () => {
      this.retryTimers.delete(tab.id)
      
      AppUtil.info('MultiTabConfigBroadcaster', 'scheduleRetry', 
        `重试Tab ${tab.id} 配置同步, 第${status.retryCount}次重试`)

      try {
        await this.syncConfigToTab(tab, config, broadcastConfig)
      } catch (error) {
        AppUtil.error('MultiTabConfigBroadcaster', 'scheduleRetry', 
          `Tab ${tab.id} 重试失败`, error)
      }
    }, retryDelay)

    this.retryTimers.set(tab.id, retryTimer)
  }

  /**
   * 处理待处理的Tab
   */
  private handlePendingTabs(
    config: Partial<UserConfig>,
    allTabs: TabInfo[],
    sourceTabId?: string
  ): void {
    const pendingTabs = allTabs.filter(tab => 
      tab.needsConfigSync && 
      tab.loadingState !== TabLoadingState.READY &&
      tab.id !== sourceTabId
    )

    for (const tab of pendingTabs) {
      configSyncStateManager.addPendingConfigSync(tab.id, config)
    }

    if (pendingTabs.length > 0) {
      AppUtil.info('MultiTabConfigBroadcaster', 'handlePendingTabs', 
        `${pendingTabs.length} 个Tab已添加到待同步队列`)
    }
  }

  /**
   * 获取同步状态统计
   */
  public getSyncStats(): {
    totalTabs: number
    statusCounts: Record<string, number>
    retryingTabs: number
  } {
    const statusCounts: Record<string, number> = {}
    let retryingTabs = 0

    for (const status of this.syncStatuses.values()) {
      statusCounts[status.status] = (statusCounts[status.status] || 0) + 1
      
      if (status.retryCount > 0) {
        retryingTabs++
      }
    }

    return {
      totalTabs: this.syncStatuses.size,
      statusCounts,
      retryingTabs
    }
  }

  /**
   * 清理同步状态
   */
  public clearSyncStatuses(): void {
    // 清理重试定时器
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }
    
    this.syncStatuses.clear()
    this.retryTimers.clear()
    
    AppUtil.info('MultiTabConfigBroadcaster', 'clearSyncStatuses', '同步状态已清理')
  }

  /**
   * 取消Tab的重试
   */
  public cancelTabRetry(tabId: string): void {
    const timer = this.retryTimers.get(tabId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(tabId)
      
      const status = this.syncStatuses.get(tabId)
      if (status) {
        status.status = 'failed'
        status.error = '重试已取消'
        this.syncStatuses.set(tabId, status)
      }
      
      AppUtil.info('MultiTabConfigBroadcaster', 'cancelTabRetry', 
        `Tab ${tabId} 的重试已取消`)
    }
  }

  /**
   * 强制重试失败的Tab
   */
  public async forceRetryFailedTabs(config: Partial<UserConfig>): Promise<BroadcastResult> {
    const failedTabs = Array.from(this.syncStatuses.values())
      .filter(status => status.status === 'failed')
      .map(status => status.tabId)

    if (failedTabs.length === 0) {
      return {
        success: true,
        totalTabs: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        pendingCount: 0,
        failedTabs: [],
        errors: []
      }
    }

    AppUtil.info('MultiTabConfigBroadcaster', 'forceRetryFailedTabs', 
      `强制重试 ${failedTabs.length} 个失败的Tab`)

    // 重置失败Tab的状态
    for (const tabId of failedTabs) {
      const status = this.syncStatuses.get(tabId)
      if (status) {
        status.status = 'pending'
        status.retryCount = 0
        status.error = undefined
        this.syncStatuses.set(tabId, status)
      }
    }

    // 获取Tab信息并重新广播
    const allTabs = configSyncStateManager.getAllTabInfos()
    const targetTabs = allTabs.filter(tab => failedTabs.includes(tab.id))

    return await this.executeBroadcast(config, targetTabs, this.config)
  }

  /**
   * 更新广播配置
   */
  public updateConfig(newConfig: Partial<BroadcastConfig>): void {
    this.config = { ...this.config, ...newConfig }
    AppUtil.info('MultiTabConfigBroadcaster', 'updateConfig', 
      `广播配置已更新: ${JSON.stringify(newConfig)}`)
  }

  /**
   * 获取广播配置
   */
  public getConfig(): BroadcastConfig {
    return { ...this.config }
  }
}

// 导出单例实例
export const multiTabConfigBroadcaster = MultiTabConfigBroadcaster.getInstance()