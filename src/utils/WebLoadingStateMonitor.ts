/**
 * 网页加载状态监控器
 * 监控Tab中网页的加载状态，提供就绪事件检测和超时处理
 */

import { BrowserView, WebContents } from 'electron'
import { TabLoadingState, TabInfo } from '../types/config'
import { configSyncStateManager } from './ConfigSyncStateManager'
import { configLogger } from './ConfigLogger'
import { AppUtil } from './AppUtil'

// 加载状态事件数据
export interface LoadingStateEvent {
  tabId: string
  url: string
  state: TabLoadingState
  timestamp: number
  duration?: number
  error?: string
}

// 监控配置
export interface MonitorConfig {
  loadingTimeout: number // 加载超时时间（毫秒）
  readyCheckInterval: number // 就绪检查间隔（毫秒）
  maxRetries: number // 最大重试次数
  enableLogging: boolean // 是否启用日志
}

// Tab加载信息
interface TabLoadingInfo {
  tabId: string
  url: string
  startTime: number
  state: TabLoadingState
  retryCount: number
  timeoutTimer?: NodeJS.Timeout
  readyCheckTimer?: NodeJS.Timeout
  webContents?: WebContents
}

export class WebLoadingStateMonitor {
  private static instance: WebLoadingStateMonitor
  private config: MonitorConfig
  private loadingTabs: Map<string, TabLoadingInfo> = new Map()
  private stateChangeListeners: Array<(event: LoadingStateEvent) => void> = []

  private constructor() {
    this.config = {
      loadingTimeout: 30000, // 30秒
      readyCheckInterval: 1000, // 1秒
      maxRetries: 3,
      enableLogging: true
    }
  }

  // 单例模式
  public static getInstance(): WebLoadingStateMonitor {
    if (!WebLoadingStateMonitor.instance) {
      WebLoadingStateMonitor.instance = new WebLoadingStateMonitor()
    }
    return WebLoadingStateMonitor.instance
  }

  /**
   * 开始监控Tab的加载状态
   */
  public startMonitoring(tabId: string, url: string, webContents: WebContents): void {
    try {
      // 清理之前的监控
      this.stopMonitoring(tabId)

      const loadingInfo: TabLoadingInfo = {
        tabId,
        url,
        startTime: Date.now(),
        state: TabLoadingState.LOADING,
        retryCount: 0,
        webContents
      }

      this.loadingTabs.set(tabId, loadingInfo)

      // 设置WebContents事件监听器
      this.setupWebContentsListeners(tabId, webContents)

      // 设置超时定时器
      this.setupTimeoutTimer(tabId)

      // 设置就绪检查定时器
      this.setupReadyCheckTimer(tabId)

      // 更新配置同步状态管理器
      configSyncStateManager.setTabLoadingState(tabId, TabLoadingState.LOADING)

      // 发布状态变更事件
      this.emitStateChange({
        tabId,
        url,
        state: TabLoadingState.LOADING,
        timestamp: Date.now()
      })

      if (this.config.enableLogging) {
        AppUtil.info('WebLoadingStateMonitor', 'startMonitoring', 
          `开始监控Tab加载: ${tabId}, URL: ${url}`)
      }

    } catch (error) {
      AppUtil.error('WebLoadingStateMonitor', 'startMonitoring', 
        `监控启动失败: ${tabId}`, error)
      this.handleLoadingError(tabId, error.message)
    }
  }

  /**
   * 停止监控Tab的加载状态
   */
  public stopMonitoring(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    try {
      // 清理定时器
      if (loadingInfo.timeoutTimer) {
        clearTimeout(loadingInfo.timeoutTimer)
      }
      if (loadingInfo.readyCheckTimer) {
        clearTimeout(loadingInfo.readyCheckTimer)
      }

      // 移除WebContents事件监听器
      this.removeWebContentsListeners(loadingInfo.webContents)

      // 从映射表中移除
      this.loadingTabs.delete(tabId)

      if (this.config.enableLogging) {
        AppUtil.info('WebLoadingStateMonitor', 'stopMonitoring', 
          `停止监控Tab加载: ${tabId}`)
      }

    } catch (error) {
      AppUtil.error('WebLoadingStateMonitor', 'stopMonitoring', 
        `监控停止失败: ${tabId}`, error)
    }
  }

  /**
   * 设置WebContents事件监听器
   */
  private setupWebContentsListeners(tabId: string, webContents: WebContents): void {
    // 页面开始加载
    webContents.on('did-start-loading', () => {
      this.handleLoadingStart(tabId)
    })

    // 页面加载完成
    webContents.on('did-finish-load', () => {
      this.handleLoadingFinish(tabId)
    })

    // 页面加载失败
    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      this.handleLoadingFail(tabId, errorDescription, errorCode)
    })

    // DOM内容加载完成
    webContents.on('dom-ready', () => {
      this.handleDOMReady(tabId)
    })

    // 页面标题更新
    webContents.on('page-title-updated', (event, title) => {
      this.handleTitleUpdate(tabId, title)
    })

    // 渲染进程崩溃
    webContents.on('render-process-gone', (event, details) => {
      this.handleRenderProcessGone(tabId, details)
    })

    // 页面无响应
    webContents.on('unresponsive', () => {
      this.handlePageUnresponsive(tabId)
    })

    // 页面恢复响应
    webContents.on('responsive', () => {
      this.handlePageResponsive(tabId)
    })
  }

  /**
   * 移除WebContents事件监听器
   */
  private removeWebContentsListeners(webContents?: WebContents): void {
    if (!webContents || webContents.isDestroyed()) {
      return
    }

    try {
      webContents.removeAllListeners('did-start-loading')
      webContents.removeAllListeners('did-finish-load')
      webContents.removeAllListeners('did-fail-load')
      webContents.removeAllListeners('dom-ready')
      webContents.removeAllListeners('page-title-updated')
      webContents.removeAllListeners('render-process-gone')
      webContents.removeAllListeners('unresponsive')
      webContents.removeAllListeners('responsive')
    } catch (error) {
      AppUtil.warn('WebLoadingStateMonitor', 'removeWebContentsListeners', 
        '移除事件监听器失败', error)
    }
  }

  /**
   * 设置超时定时器
   */
  private setupTimeoutTimer(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    loadingInfo.timeoutTimer = setTimeout(() => {
      this.handleLoadingTimeout(tabId)
    }, this.config.loadingTimeout)
  }

  /**
   * 设置就绪检查定时器
   */
  private setupReadyCheckTimer(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    loadingInfo.readyCheckTimer = setTimeout(() => {
      this.performReadyCheck(tabId)
    }, this.config.readyCheckInterval)
  }

  /**
   * 执行就绪检查
   */
  private performReadyCheck(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo || !loadingInfo.webContents) {
      return
    }

    try {
      const webContents = loadingInfo.webContents

      // 检查WebContents状态
      if (webContents.isDestroyed()) {
        this.handleLoadingError(tabId, 'WebContents已销毁')
        return
      }

      if (webContents.isCrashed()) {
        this.handleLoadingError(tabId, 'WebContents已崩溃')
        return
      }

      // 检查是否正在加载
      if (webContents.isLoading()) {
        // 仍在加载，继续检查
        this.setupReadyCheckTimer(tabId)
        return
      }

      // 检查页面是否可用
      if (this.isPageReady(webContents)) {
        this.handlePageReady(tabId)
      } else {
        // 继续检查
        this.setupReadyCheckTimer(tabId)
      }

    } catch (error) {
      AppUtil.error('WebLoadingStateMonitor', 'performReadyCheck', 
        `就绪检查失败: ${tabId}`, error)
      this.setupReadyCheckTimer(tabId) // 继续检查
    }
  }

  /**
   * 检查页面是否就绪
   */
  private isPageReady(webContents: WebContents): boolean {
    try {
      // 基本检查
      if (webContents.isDestroyed() || webContents.isCrashed() || webContents.isLoading()) {
        return false
      }

      // 检查URL是否有效
      const url = webContents.getURL()
      if (!url || url.startsWith('chrome-error://') || url === 'about:blank') {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 处理加载开始
   */
  private handleLoadingStart(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    loadingInfo.state = TabLoadingState.LOADING
    loadingInfo.startTime = Date.now()

    configSyncStateManager.setTabLoadingState(tabId, TabLoadingState.LOADING)

    this.emitStateChange({
      tabId,
      url: loadingInfo.url,
      state: TabLoadingState.LOADING,
      timestamp: Date.now()
    })

    if (this.config.enableLogging) {
      AppUtil.info('WebLoadingStateMonitor', 'handleLoadingStart', 
        `Tab开始加载: ${tabId}`)
    }
  }

  /**
   * 处理加载完成
   */
  private handleLoadingFinish(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    const duration = Date.now() - loadingInfo.startTime

    // 延迟一点时间再检查就绪状态，确保页面完全加载
    setTimeout(() => {
      this.performReadyCheck(tabId)
    }, 500)

    if (this.config.enableLogging) {
      AppUtil.info('WebLoadingStateMonitor', 'handleLoadingFinish', 
        `Tab加载完成: ${tabId}, 耗时: ${duration}ms`)
    }
  }

  /**
   * 处理加载失败
   */
  private handleLoadingFail(tabId: string, errorDescription: string, errorCode: number): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    const duration = Date.now() - loadingInfo.startTime
    const errorMessage = `加载失败: ${errorDescription} (${errorCode})`

    // 检查是否需要重试
    if (loadingInfo.retryCount < this.config.maxRetries) {
      loadingInfo.retryCount++
      
      if (this.config.enableLogging) {
        AppUtil.warn('WebLoadingStateMonitor', 'handleLoadingFail', 
          `Tab加载失败，准备重试: ${tabId}, 错误: ${errorMessage}, 重试次数: ${loadingInfo.retryCount}`)
      }

      // 延迟重试
      setTimeout(() => {
        this.retryLoading(tabId)
      }, 2000)
    } else {
      // 重试次数用完，标记为错误
      this.handleLoadingError(tabId, errorMessage, duration)
    }
  }

  /**
   * 处理DOM就绪
   */
  private handleDOMReady(tabId: string): void {
    if (this.config.enableLogging) {
      AppUtil.info('WebLoadingStateMonitor', 'handleDOMReady', 
        `Tab DOM就绪: ${tabId}`)
    }

    // DOM就绪后继续检查完整的页面就绪状态
    setTimeout(() => {
      this.performReadyCheck(tabId)
    }, 100)
  }

  /**
   * 处理标题更新
   */
  private handleTitleUpdate(tabId: string, title: string): void {
    // 标题更新处理逻辑
  }

  /**
   * 处理渲染进程崩溃
   */
  private handleRenderProcessGone(tabId: string, details: any): void {
    const errorMessage = `渲染进程崩溃: ${details.reason}`
    this.handleLoadingError(tabId, errorMessage)
  }

  /**
   * 处理页面无响应
   */
  private handlePageUnresponsive(tabId: string): void {
    if (this.config.enableLogging) {
      AppUtil.warn('WebLoadingStateMonitor', 'handlePageUnresponsive', 
        `Tab页面无响应: ${tabId}`)
    }
  }

  /**
   * 处理页面恢复响应
   */
  private handlePageResponsive(tabId: string): void {
    if (this.config.enableLogging) {
      AppUtil.info('WebLoadingStateMonitor', 'handlePageResponsive', 
        `Tab页面恢复响应: ${tabId}`)
    }
  }

  /**
   * 处理加载超时
   */
  private handleLoadingTimeout(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    const duration = Date.now() - loadingInfo.startTime
    this.handleLoadingError(tabId, '加载超时', duration)
  }

  /**
   * 处理页面就绪
   */
  private handlePageReady(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    const duration = Date.now() - loadingInfo.startTime
    loadingInfo.state = TabLoadingState.READY

    // 清理定时器
    if (loadingInfo.timeoutTimer) {
      clearTimeout(loadingInfo.timeoutTimer)
    }
    if (loadingInfo.readyCheckTimer) {
      clearTimeout(loadingInfo.readyCheckTimer)
    }

    // 更新配置同步状态管理器
    configSyncStateManager.setTabLoadingState(tabId, TabLoadingState.READY)

    // 发布状态变更事件
    this.emitStateChange({
      tabId,
      url: loadingInfo.url,
      state: TabLoadingState.READY,
      timestamp: Date.now(),
      duration
    })

    // 记录日志
    configLogger.logConfigChange(
      'pageReady',
      'WebLoadingStateMonitor',
      null,
      {},
      true,
      `Tab页面就绪: ${tabId}`,
      undefined,
      duration,
      { tabId, url: loadingInfo.url }
    )

    if (this.config.enableLogging) {
      AppUtil.info('WebLoadingStateMonitor', 'handlePageReady', 
        `Tab页面就绪: ${tabId}, 耗时: ${duration}ms`)
    }

    // 停止监控（页面已就绪）
    this.stopMonitoring(tabId)
  }

  /**
   * 处理加载错误
   */
  private handleLoadingError(tabId: string, error: string, duration?: number): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo) {
      return
    }

    const actualDuration = duration || (Date.now() - loadingInfo.startTime)
    loadingInfo.state = TabLoadingState.ERROR

    // 清理定时器
    if (loadingInfo.timeoutTimer) {
      clearTimeout(loadingInfo.timeoutTimer)
    }
    if (loadingInfo.readyCheckTimer) {
      clearTimeout(loadingInfo.readyCheckTimer)
    }

    // 更新配置同步状态管理器
    configSyncStateManager.setTabLoadingState(tabId, TabLoadingState.ERROR)

    // 发布状态变更事件
    this.emitStateChange({
      tabId,
      url: loadingInfo.url,
      state: TabLoadingState.ERROR,
      timestamp: Date.now(),
      duration: actualDuration,
      error
    })

    // 记录错误日志
    configLogger.logConfigChange(
      'pageLoadError',
      'WebLoadingStateMonitor',
      null,
      {},
      false,
      `Tab页面加载错误: ${tabId}`,
      [error],
      actualDuration,
      { tabId, url: loadingInfo.url }
    )

    AppUtil.error('WebLoadingStateMonitor', 'handleLoadingError', 
      `Tab加载错误: ${tabId}, 错误: ${error}, 耗时: ${actualDuration}ms`)

    // 停止监控
    this.stopMonitoring(tabId)
  }

  /**
   * 重试加载
   */
  private retryLoading(tabId: string): void {
    const loadingInfo = this.loadingTabs.get(tabId)
    if (!loadingInfo || !loadingInfo.webContents) {
      return
    }

    try {
      // 重新加载页面
      loadingInfo.webContents.reload()
      loadingInfo.startTime = Date.now()

      // 重新设置定时器
      this.setupTimeoutTimer(tabId)
      this.setupReadyCheckTimer(tabId)

      if (this.config.enableLogging) {
        AppUtil.info('WebLoadingStateMonitor', 'retryLoading', 
          `重试加载Tab: ${tabId}, 重试次数: ${loadingInfo.retryCount}`)
      }

    } catch (error) {
      this.handleLoadingError(tabId, `重试加载失败: ${error.message}`)
    }
  }

  /**
   * 发布状态变更事件
   */
  private emitStateChange(event: LoadingStateEvent): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        AppUtil.error('WebLoadingStateMonitor', 'emitStateChange', 
          '状态变更监听器执行失败', error)
      }
    })
  }

  /**
   * 添加状态变更监听器
   */
  public onStateChange(listener: (event: LoadingStateEvent) => void): () => void {
    this.stateChangeListeners.push(listener)

    // 返回取消监听的函数
    return () => {
      const index = this.stateChangeListeners.indexOf(listener)
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * 获取Tab的加载状态
   */
  public getTabLoadingState(tabId: string): TabLoadingState | null {
    const loadingInfo = this.loadingTabs.get(tabId)
    return loadingInfo ? loadingInfo.state : null
  }

  /**
   * 获取所有正在监控的Tab
   */
  public getMonitoringTabs(): string[] {
    return Array.from(this.loadingTabs.keys())
  }

  /**
   * 获取监控统计信息
   */
  public getMonitorStats(): {
    totalTabs: number
    loadingTabs: number
    readyTabs: number
    errorTabs: number
  } {
    let loadingTabs = 0
    let readyTabs = 0
    let errorTabs = 0

    for (const info of this.loadingTabs.values()) {
      switch (info.state) {
        case TabLoadingState.LOADING:
          loadingTabs++
          break
        case TabLoadingState.READY:
          readyTabs++
          break
        case TabLoadingState.ERROR:
          errorTabs++
          break
      }
    }

    return {
      totalTabs: this.loadingTabs.size,
      loadingTabs,
      readyTabs,
      errorTabs
    }
  }

  /**
   * 更新监控配置
   */
  public updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (this.config.enableLogging) {
      AppUtil.info('WebLoadingStateMonitor', 'updateConfig', 
        `监控配置已更新: ${JSON.stringify(newConfig)}`)
    }
  }

  /**
   * 获取监控配置
   */
  public getConfig(): MonitorConfig {
    return { ...this.config }
  }

  /**
   * 清理所有监控
   */
  public cleanup(): void {
    const tabIds = Array.from(this.loadingTabs.keys())
    
    for (const tabId of tabIds) {
      this.stopMonitoring(tabId)
    }

    this.stateChangeListeners = []
    
    AppUtil.info('WebLoadingStateMonitor', 'cleanup', '所有监控已清理')
  }
}

// 导出单例实例
export const webLoadingStateMonitor = WebLoadingStateMonitor.getInstance()