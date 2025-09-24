/**
 * 配置同步状态管理器
 * 跟踪每个Tab的加载状态，管理待同步配置队列和Tab就绪检测
 */

import { TabLoadingState, TabInfo, UserConfig } from '../types/config'
import { configEventManager, ConfigEventType } from './ConfigEventManager'
import { AppUtil } from './AppUtil'

// Tab状态变更事件数据
export interface TabStateChangeEvent {
  tabId: string
  oldState: TabLoadingState
  newState: TabLoadingState
  timestamp: number
}

// 待同步配置项
export interface PendingConfigSync {
  config: Partial<UserConfig>
  timestamp: number
  retryCount: number
  maxRetries: number
}

export class ConfigSyncStateManager {
  private static instance: ConfigSyncStateManager
  private tabStates: Map<string, TabLoadingState> = new Map()
  private tabInfos: Map<string, TabInfo> = new Map()
  private pendingConfigs: Map<string, PendingConfigSync> = new Map()
  private stateChangeListeners: Array<(event: TabStateChangeEvent) => void> = []
  private readyCheckTimeouts: Map<string, NodeJS.Timeout> = new Map()
  
  // 配置参数
  private readonly DEFAULT_READY_TIMEOUT = 30000 // 30秒
  private readonly MAX_SYNC_RETRIES = 3
  private readonly RETRY_DELAY = 1000 // 1秒

  private constructor() {
    // 监听配置事件，用于清理过期数据
    this.setupEventListeners()
  }

  // 单例模式
  public static getInstance(): ConfigSyncStateManager {
    if (!ConfigSyncStateManager.instance) {
      ConfigSyncStateManager.instance = new ConfigSyncStateManager()
    }
    return ConfigSyncStateManager.instance
  }

  /**
   * 设置Tab加载状态
   */
  public setTabLoadingState(tabId: string, state: TabLoadingState): void {
    const oldState = this.tabStates.get(tabId) || TabLoadingState.LOADING
    
    if (oldState !== state) {
      this.tabStates.set(tabId, state)
      
      // 更新Tab信息中的状态
      const tabInfo = this.tabInfos.get(tabId)
      if (tabInfo) {
        tabInfo.loadingState = state
        this.tabInfos.set(tabId, tabInfo)
      }

      // 发布状态变更事件
      const event: TabStateChangeEvent = {
        tabId,
        oldState,
        newState: state,
        timestamp: Date.now()
      }
      
      this.notifyStateChangeListeners(event)

      AppUtil.info('ConfigSyncStateManager', 'setTabLoadingState', 
        `Tab ${tabId} 状态变更: ${oldState} -> ${state}`)

      // 如果Tab变为就绪状态，处理待同步的配置
      if (state === TabLoadingState.READY) {
        this.handleTabReady(tabId)
      }

      // 如果Tab出错或超时，清理相关数据
      if (state === TabLoadingState.ERROR || state === TabLoadingState.TIMEOUT) {
        this.handleTabError(tabId)
      }
    }
  }

  /**
   * 获取Tab加载状态
   */
  public getTabLoadingState(tabId: string): TabLoadingState {
    return this.tabStates.get(tabId) || TabLoadingState.LOADING
  }

  /**
   * 检查Tab是否准备好接收配置
   */
  public isTabReadyForConfig(tabId: string): boolean {
    const state = this.getTabLoadingState(tabId)
    return state === TabLoadingState.READY
  }

  /**
   * 添加待同步的配置
   */
  public addPendingConfigSync(tabId: string, config: Partial<UserConfig>): void {
    const existing = this.pendingConfigs.get(tabId)
    
    const pendingSync: PendingConfigSync = {
      config: { ...existing?.config, ...config }, // 合并配置
      timestamp: Date.now(),
      retryCount: existing?.retryCount || 0,
      maxRetries: this.MAX_SYNC_RETRIES
    }

    this.pendingConfigs.set(tabId, pendingSync)

    AppUtil.info('ConfigSyncStateManager', 'addPendingConfigSync', 
      `Tab ${tabId} 添加待同步配置, 字段: ${Object.keys(config).join(', ')}`)

    // 如果Tab已经就绪，立即尝试同步
    if (this.isTabReadyForConfig(tabId)) {
      this.processPendingConfigSync(tabId)
    }
  }

  /**
   * 获取待同步的配置
   */
  public getPendingConfigSync(tabId: string): Partial<UserConfig> | null {
    const pending = this.pendingConfigs.get(tabId)
    return pending ? pending.config : null
  }

  /**
   * 清除待同步的配置
   */
  public clearPendingConfigSync(tabId: string): void {
    if (this.pendingConfigs.has(tabId)) {
      this.pendingConfigs.delete(tabId)
      AppUtil.info('ConfigSyncStateManager', 'clearPendingConfigSync', 
        `Tab ${tabId} 待同步配置已清除`)
    }
  }

  /**
   * 注册Tab信息
   */
  public registerTab(tabInfo: TabInfo): void {
    this.tabInfos.set(tabInfo.id, tabInfo)
    this.setTabLoadingState(tabInfo.id, tabInfo.loadingState)
    
    AppUtil.info('ConfigSyncStateManager', 'registerTab', 
      `Tab已注册: ${tabInfo.id}, URL: ${tabInfo.url}`)
  }

  /**
   * 注销Tab
   */
  public unregisterTab(tabId: string): void {
    this.tabStates.delete(tabId)
    this.tabInfos.delete(tabId)
    this.clearPendingConfigSync(tabId)
    this.clearReadyCheckTimeout(tabId)
    
    AppUtil.info('ConfigSyncStateManager', 'unregisterTab', `Tab已注销: ${tabId}`)
  }

  /**
   * 获取Tab信息
   */
  public getTabInfo(tabId: string): TabInfo | null {
    return this.tabInfos.get(tabId) || null
  }

  /**
   * 获取所有Tab信息
   */
  public getAllTabInfos(): TabInfo[] {
    return Array.from(this.tabInfos.values())
  }

  /**
   * 获取就绪的Tab列表
   */
  public getReadyTabs(): TabInfo[] {
    return this.getAllTabInfos().filter(tab => 
      tab.loadingState === TabLoadingState.READY
    )
  }

  /**
   * 获取需要配置同步的Tab列表
   */
  public getTabsNeedingSync(): TabInfo[] {
    return this.getAllTabInfos().filter(tab => 
      tab.needsConfigSync && tab.loadingState === TabLoadingState.READY
    )
  }

  /**
   * 等待Tab就绪
   */
  public waitForTabReady(tabId: string, timeout: number = this.DEFAULT_READY_TIMEOUT): Promise<boolean> {
    return new Promise((resolve) => {
      // 如果已经就绪，立即返回
      if (this.isTabReadyForConfig(tabId)) {
        resolve(true)
        return
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.clearReadyCheckTimeout(tabId)
        this.setTabLoadingState(tabId, TabLoadingState.TIMEOUT)
        resolve(false)
      }, timeout)

      this.readyCheckTimeouts.set(tabId, timeoutId)

      // 监听状态变更
      const stateChangeListener = (event: TabStateChangeEvent) => {
        if (event.tabId === tabId && event.newState === TabLoadingState.READY) {
          this.clearReadyCheckTimeout(tabId)
          this.removeStateChangeListener(stateChangeListener)
          resolve(true)
        } else if (event.tabId === tabId && 
                  (event.newState === TabLoadingState.ERROR || event.newState === TabLoadingState.TIMEOUT)) {
          this.clearReadyCheckTimeout(tabId)
          this.removeStateChangeListener(stateChangeListener)
          resolve(false)
        }
      }

      this.addStateChangeListener(stateChangeListener)
    })
  }

  /**
   * 批量等待多个Tab就绪
   */
  public async waitForMultipleTabsReady(
    tabIds: string[], 
    timeout: number = this.DEFAULT_READY_TIMEOUT
  ): Promise<{ ready: string[], failed: string[] }> {
    const promises = tabIds.map(async (tabId) => {
      const isReady = await this.waitForTabReady(tabId, timeout)
      return { tabId, isReady }
    })

    const results = await Promise.all(promises)
    
    const ready = results.filter(r => r.isReady).map(r => r.tabId)
    const failed = results.filter(r => !r.isReady).map(r => r.tabId)

    return { ready, failed }
  }

  /**
   * 处理Tab就绪事件
   */
  private handleTabReady(tabId: string): void {
    // 处理待同步的配置
    this.processPendingConfigSync(tabId)
    
    // 清理就绪检查超时
    this.clearReadyCheckTimeout(tabId)
  }

  /**
   * 处理Tab错误事件
   */
  private handleTabError(tabId: string): void {
    // 清理就绪检查超时
    this.clearReadyCheckTimeout(tabId)
    
    // 检查是否需要重试待同步的配置
    const pending = this.pendingConfigs.get(tabId)
    if (pending && pending.retryCount < pending.maxRetries) {
      // 增加重试次数
      pending.retryCount++
      this.pendingConfigs.set(tabId, pending)
      
      AppUtil.warn('ConfigSyncStateManager', 'handleTabError', 
        `Tab ${tabId} 配置同步将重试, 当前重试次数: ${pending.retryCount}`)
      
      // 延迟重试
      setTimeout(() => {
        if (this.isTabReadyForConfig(tabId)) {
          this.processPendingConfigSync(tabId)
        }
      }, this.RETRY_DELAY)
    } else if (pending) {
      // 超过最大重试次数，清除待同步配置
      this.clearPendingConfigSync(tabId)
      AppUtil.error('ConfigSyncStateManager', 'handleTabError', 
        `Tab ${tabId} 配置同步重试次数已达上限，已清除待同步配置`)
    }
  }

  /**
   * 处理待同步配置
   */
  private processPendingConfigSync(tabId: string): void {
    const pending = this.pendingConfigs.get(tabId)
    if (!pending) {
      return
    }

    try {
      // 这里应该调用实际的配置同步逻辑
      // 由于我们在状态管理器中，这里只是发布事件
      configEventManager.emit(ConfigEventType.CONFIG_SYNC_START, {
        config: pending.config,
        source: `Tab-${tabId}`
      })

      // 清除待同步配置
      this.clearPendingConfigSync(tabId)

      AppUtil.info('ConfigSyncStateManager', 'processPendingConfigSync', 
        `Tab ${tabId} 待同步配置已处理`)

    } catch (error) {
      AppUtil.error('ConfigSyncStateManager', 'processPendingConfigSync', 
        `Tab ${tabId} 配置同步处理失败`, error)
    }
  }

  /**
   * 处理待处理的同步（别名方法）
   */
  public processPendingSyncs(): void {
    for (const tabId of this.pendingConfigs.keys()) {
      if (this.isTabReadyForConfig(tabId)) {
        this.processPendingConfigSync(tabId)
      }
    }
  }

  /**
   * 广播配置更新到所有就绪的Tab
   */
  public broadcastConfigUpdate(config: Partial<UserConfig>): void {
    const readyTabs = this.getReadyTabs()
    for (const tab of readyTabs) {
      this.addPendingConfigSync(tab.id, config)
    }
    AppUtil.info('ConfigSyncStateManager', 'broadcastConfigUpdate', 
      `配置更新已广播到 ${readyTabs.length} 个就绪Tab`)
  }

  /**
   * 获取所有Tab状态
   */
  public getAllTabStates(): Map<string, TabLoadingState> {
    return new Map(this.tabStates)
  }

  /**
   * 获取Tab状态（别名方法）
   */
  public getTabState(tabId: string): TabLoadingState {
    return this.getTabLoadingState(tabId)
  }

  /**
   * 移除Tab（别名方法）
   */
  public removeTab(tabId: string): void {
    this.unregisterTab(tabId)
  }

  /**
   * 清理就绪检查超时
   */
  private clearReadyCheckTimeout(tabId: string): void {
    const timeoutId = this.readyCheckTimeouts.get(tabId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.readyCheckTimeouts.delete(tabId)
    }
  }

  /**
   * 添加状态变更监听器
   */
  public addStateChangeListener(listener: (event: TabStateChangeEvent) => void): void {
    this.stateChangeListeners.push(listener)
  }

  /**
   * 添加状态变更监听器（别名方法）
   */
  public onStateChange(listener: (event: TabStateChangeEvent) => void): void {
    this.addStateChangeListener(listener)
  }

  /**
   * 移除状态变更监听器
   */
  public removeStateChangeListener(listener: (event: TabStateChangeEvent) => void): void {
    const index = this.stateChangeListeners.indexOf(listener)
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1)
    }
  }

  /**
   * 通知状态变更监听器
   */
  private notifyStateChangeListeners(event: TabStateChangeEvent): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        AppUtil.error('ConfigSyncStateManager', 'notifyStateChangeListeners', 
          '状态变更监听器执行失败', error)
      }
    })
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听配置同步成功事件，更新Tab的最后同步时间
    configEventManager.on(ConfigEventType.CONFIG_SYNC_SUCCESS, (eventData) => {
      if (eventData.source && eventData.source.startsWith('Tab-')) {
        const tabId = eventData.source.replace('Tab-', '')
        const tabInfo = this.getTabInfo(tabId)
        if (tabInfo) {
          tabInfo.lastConfigSync = Date.now()
          tabInfo.configSyncRetries = 0
          this.tabInfos.set(tabId, tabInfo)
        }
      }
    })

    // 监听配置同步失败事件，增加重试计数
    configEventManager.on(ConfigEventType.CONFIG_SYNC_FAILURE, (eventData) => {
      if (eventData.source && eventData.source.startsWith('Tab-')) {
        const tabId = eventData.source.replace('Tab-', '')
        const tabInfo = this.getTabInfo(tabId)
        if (tabInfo) {
          tabInfo.configSyncRetries++
          this.tabInfos.set(tabId, tabInfo)
        }
      }
    })
  }

  /**
   * 获取状态统计信息
   */
  public getStateStats(): {
    totalTabs: number
    tabsByState: Record<string, number>
    pendingConfigsCount: number
    readyTabsCount: number
    tabsNeedingSyncCount: number
  } {
    const tabsByState: Record<string, number> = {}
    let readyTabsCount = 0
    let tabsNeedingSyncCount = 0

    // 统计各状态的Tab数量
    for (const state of this.tabStates.values()) {
      tabsByState[state] = (tabsByState[state] || 0) + 1
      if (state === TabLoadingState.READY) {
        readyTabsCount++
      }
    }

    // 统计需要同步的Tab数量
    for (const tabInfo of this.tabInfos.values()) {
      if (tabInfo.needsConfigSync && tabInfo.loadingState === TabLoadingState.READY) {
        tabsNeedingSyncCount++
      }
    }

    return {
      totalTabs: this.tabStates.size,
      tabsByState,
      pendingConfigsCount: this.pendingConfigs.size,
      readyTabsCount,
      tabsNeedingSyncCount
    }
  }

  /**
   * 清理所有数据
   */
  public cleanup(): void {
    // 清理所有超时
    for (const timeoutId of this.readyCheckTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    
    this.tabStates.clear()
    this.tabInfos.clear()
    this.pendingConfigs.clear()
    this.readyCheckTimeouts.clear()
    this.stateChangeListeners = []
    
    AppUtil.info('ConfigSyncStateManager', 'cleanup', '所有Tab状态数据已清理')
  }

  /**
   * 强制设置Tab为就绪状态（用于测试或特殊情况）
   */
  public forceTabReady(tabId: string): void {
    this.setTabLoadingState(tabId, TabLoadingState.READY)
    AppUtil.warn('ConfigSyncStateManager', 'forceTabReady', 
      `Tab ${tabId} 已强制设置为就绪状态`)
  }

  /**
   * 检查Tab是否存在
   */
  public hasTab(tabId: string): boolean {
    return this.tabInfos.has(tabId)
  }

  /**
   * 更新Tab信息
   */
  public updateTabInfo(tabId: string, updates: Partial<TabInfo>): void {
    const existing = this.tabInfos.get(tabId)
    if (existing) {
      const updated = { ...existing, ...updates }
      this.tabInfos.set(tabId, updated)
      
      // 如果更新了加载状态，同步更新状态映射
      if (updates.loadingState) {
        this.setTabLoadingState(tabId, updates.loadingState)
      }
    }
  }
}

// 导出单例实例
export const configSyncStateManager = ConfigSyncStateManager.getInstance()