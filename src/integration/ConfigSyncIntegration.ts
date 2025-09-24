/**
 * 配置同步集成管理器
 * 统一管理所有配置同步组件的集成和协调
 */

import { UserConfig, ConfigUpdateSource, TabLoadingState } from '../types/config'
import { configStateManager } from '../utils/ConfigStateManager'
import { configSyncStateManager } from '../utils/ConfigSyncStateManager'
import { configUpdateQueue } from '../utils/ConfigUpdateQueue'
import { configValidator } from '../utils/ConfigValidator'
import { configLogger, LogLevel } from '../utils/ConfigLogger'
import { tabLoadingMonitor } from '../utils/TabLoadingMonitor'
import { configSyncOptimizer } from '../utils/ConfigSyncOptimizer'
import { configCompatibilityManager } from '../utils/ConfigCompatibilityManager'
import { legacyConfigAPI } from '../utils/LegacyConfigAPI'
import { configMigrationTool } from '../utils/ConfigMigrationTool'

// 集成配置
export interface IntegrationConfig {
  enableOptimization: boolean
  enableCompatibilityMode: boolean
  enableLegacyAPI: boolean
  enableAutoMigration: boolean
  enableTabMonitoring: boolean
  enableLogging: boolean
  maxRetries: number
  retryDelay: number
}

// 集成状态
export interface IntegrationStatus {
  initialized: boolean
  componentsReady: boolean
  activeConnections: number
  lastSyncTime: number
  errorCount: number
  performanceMetrics: {
    avgSyncTime: number
    successRate: number
    optimizationRate: number
  }
}

// 端到端测试结果
export interface E2ETestResult {
  testName: string
  success: boolean
  duration: number
  steps: Array<{
    name: string
    success: boolean
    duration: number
    error?: string
  }>
  error?: string
  metrics?: any
}

export class ConfigSyncIntegration {
  private static instance: ConfigSyncIntegration
  private config: IntegrationConfig
  private status: IntegrationStatus
  private isInitialized = false
  private eventListeners: Map<string, Function[]> = new Map()

  private constructor() {
    this.config = {
      enableOptimization: true,
      enableCompatibilityMode: true,
      enableLegacyAPI: true,
      enableAutoMigration: true,
      enableTabMonitoring: true,
      enableLogging: true,
      maxRetries: 3,
      retryDelay: 1000
    }

    this.status = {
      initialized: false,
      componentsReady: false,
      activeConnections: 0,
      lastSyncTime: 0,
      errorCount: 0,
      performanceMetrics: {
        avgSyncTime: 0,
        successRate: 0,
        optimizationRate: 0
      }
    }
  }

  // 单例模式
  public static getInstance(): ConfigSyncIntegration {
    if (!ConfigSyncIntegration.instance) {
      ConfigSyncIntegration.instance = new ConfigSyncIntegration()
    }
    return ConfigSyncIntegration.instance
  }

  /**
   * 初始化集成系统
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      configLogger.logInfo('initialize', 'ConfigSyncIntegration', '开始初始化配置同步集成系统')

      // 1. 初始化核心组件
      await this.initializeCoreComponents()

      // 2. 设置组件间的事件监听
      this.setupComponentEventListeners()

      // 3. 初始化Tab监控（如果启用）
      if (this.config.enableTabMonitoring) {
        tabLoadingMonitor.initialize()
      }

      // 4. 初始化优化器（如果启用）
      if (this.config.enableOptimization) {
        configSyncOptimizer.updateConfig({
          enableDebounce: true,
          enableBatching: true,
          enableSmartMerging: true
        })
      }

      // 5. 设置兼容性模式（如果启用）
      if (this.config.enableCompatibilityMode) {
        await this.setupCompatibilityMode()
      }

      // 6. 验证组件就绪状态
      await this.verifyComponentsReady()

      this.status.initialized = true
      this.status.componentsReady = true
      this.isInitialized = true

      configLogger.logInfo('initialize', 'ConfigSyncIntegration', '配置同步集成系统初始化完成')

    } catch (error) {
      configLogger.logError('initialize', 'ConfigSyncIntegration', error)
      throw new Error(`集成系统初始化失败: ${error.message}`)
    }
  }

  /**
   * 初始化核心组件
   */
  private async initializeCoreComponents(): Promise<void> {
    // 配置状态管理器已经是单例，无需特殊初始化
    
    // 重置所有组件状态
    configUpdateQueue.clear()
    configSyncStateManager.cleanup()
    
    // 设置日志级别
    if (this.config.enableLogging) {
      configLogger.setLogLevel(LogLevel.DEBUG)
    }
  }

  /**
   * 设置组件间事件监听
   */
  private setupComponentEventListeners(): void {
    // 监听配置状态变更
    configStateManager.onConfigChange((event) => {
      this.handleConfigChange(event)
    })

    // 监听Tab状态变更
    if (this.config.enableTabMonitoring) {
      tabLoadingMonitor.onStateChange((event) => {
        this.handleTabStateChange(event)
      })
    }

    // 监听配置同步状态变更
    configSyncStateManager.onStateChange?.((event) => {
      this.handleSyncStateChange(event.tabId, event.newState)
    })
  }

  /**
   * 设置兼容性模式
   */
  private async setupCompatibilityMode(): Promise<void> {
    // 检查是否有需要迁移的配置
    if (this.config.enableAutoMigration) {
      try {
        const currentConfig = configStateManager.getCurrentConfig()
        if (configCompatibilityManager.needsMigration(currentConfig)) {
          configLogger.logInfo('setupCompatibilityMode', 'ConfigSyncIntegration',
            '检测到需要迁移的配置，开始自动迁移')
          
          const migration = await configCompatibilityManager.migrateConfig(currentConfig)
          if (migration.success) {
            await configStateManager.updateConfig(migration.migratedConfig)
            configLogger.logInfo('setupCompatibilityMode', 'ConfigSyncIntegration',
              '配置自动迁移完成')
          }
        }
      } catch (error) {
        configLogger.logWarning('setupCompatibilityMode', 'ConfigSyncIntegration',
          '自动迁移失败，将继续使用现有配置', { error: error.message })
      }
    }
  }

  /**
   * 验证组件就绪状态
   */
  private async verifyComponentsReady(): Promise<void> {
    const checks = [
      { name: 'ConfigStateManager', check: () => configStateManager !== null },
      { name: 'ConfigValidator', check: () => configValidator !== null },
      { name: 'ConfigLogger', check: () => configLogger !== null },
      { name: 'ConfigUpdateQueue', check: () => configUpdateQueue !== null },
      { name: 'ConfigSyncStateManager', check: () => configSyncStateManager !== null }
    ]

    if (this.config.enableTabMonitoring) {
      checks.push({ name: 'TabLoadingMonitor', check: () => tabLoadingMonitor !== null })
    }

    if (this.config.enableOptimization) {
      checks.push({ name: 'ConfigSyncOptimizer', check: () => configSyncOptimizer !== null })
    }

    for (const { name, check } of checks) {
      if (!check()) {
        throw new Error(`组件未就绪: ${name}`)
      }
    }
  }

  /**
   * 处理配置变更事件
   */
  private handleConfigChange(event: any): void {
    try {
      this.status.lastSyncTime = Date.now()
      
      // 广播配置变更到所有Tab
      this.broadcastConfigChange(event)
      
      // 触发自定义事件
      this.emitEvent('configChange', event)
      
    } catch (error) {
      this.status.errorCount++
      configLogger.logError('handleConfigChange', 'ConfigSyncIntegration', error)
    }
  }

  /**
   * 处理Tab状态变更事件
   */
  private handleTabStateChange(event: any): void {
    try {
      if (event.state === TabLoadingState.READY) {
        // Tab就绪，处理待同步配置
        configSyncStateManager.processPendingSyncs()
      }
      
      // 触发自定义事件
      this.emitEvent('tabStateChange', event)
      
    } catch (error) {
      this.status.errorCount++
      configLogger.logError('handleTabStateChange', 'ConfigSyncIntegration', error)
    }
  }

  /**
   * 处理同步状态变更事件
   */
  private handleSyncStateChange(tabId: string, state: any): void {
    try {
      // 更新活跃连接数
      this.updateActiveConnections()
      
      // 触发自定义事件
      this.emitEvent('syncStateChange', { tabId, state })
      
    } catch (error) {
      this.status.errorCount++
      configLogger.logError('handleSyncStateChange', 'ConfigSyncIntegration', error)
    }
  }

  /**
   * 广播配置变更
   */
  private async broadcastConfigChange(event: any): Promise<void> {
    if (!this.config.enableOptimization) {
      // 直接广播
      configSyncStateManager.broadcastConfigUpdate(event.changes)
    } else {
      // 使用优化器
      await configSyncOptimizer.optimizeConfigUpdate(
        event.changes,
        event.source,
        event.sourceTabId,
        5 // 默认优先级
      )
    }
  }

  /**
   * 更新活跃连接数
   */
  private updateActiveConnections(): void {
    const allTabs = configSyncStateManager.getAllTabStates()
    this.status.activeConnections = Object.keys(allTabs).length
  }

  /**
   * 统一配置更新接口
   */
  public async updateConfig(
    config: Partial<UserConfig>,
    source: ConfigUpdateSource,
    sourceTabId?: string
  ): Promise<{ success: boolean, error?: string }> {
    try {
      // 1. 验证配置
      const validation = configValidator.validateConfig(config)
      if (!validation.isValid) {
        return {
          success: false,
          error: `配置验证失败: ${validation.errors.join(', ')}`
        }
      }

      // 2. 兼容性检查
      if (this.config.enableCompatibilityMode) {
        const compatibility = configCompatibilityManager.checkCompatibility(config)
        if (!compatibility.isCompatible) {
          return {
            success: false,
            error: `配置不兼容: ${compatibility.issues.join(', ')}`
          }
        }

        // 自动迁移（如果需要）
        if (compatibility.needsMigration && this.config.enableAutoMigration) {
          const migration = await configCompatibilityManager.migrateConfig(config)
          if (migration.success) {
            config = migration.migratedConfig
          } else {
            return {
              success: false,
              error: `配置迁移失败: ${migration.errors.join(', ')}`
            }
          }
        }
      }

      // 3. 更新配置
      const result = configStateManager.updateConfig(config)
      
      if (result.success) {
        // 更新性能指标
        this.updatePerformanceMetrics(true)
      } else {
        this.status.errorCount++
        this.updatePerformanceMetrics(false)
      }

      return result

    } catch (error) {
      this.status.errorCount++
      configLogger.logError('updateConfig', 'ConfigSyncIntegration', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取当前配置
   */
  public getCurrentConfig(): Partial<UserConfig> {
    return configStateManager.getCurrentConfig()
  }

  /**
   * 注册Tab
   */
  public registerTab(tabId: string, webContents: any, url: string): void {
    try {
      // 注册到同步状态管理器
      configSyncStateManager.setTabLoadingState(tabId, TabLoadingState.LOADING)
      
      // 开始监控Tab加载（如果启用）
      if (this.config.enableTabMonitoring) {
        tabLoadingMonitor.startMonitoring(tabId, webContents, url)
      }
      
      this.updateActiveConnections()
      
      configLogger.logDebug('registerTab', 'ConfigSyncIntegration',
        `Tab已注册: ${tabId}`, { url })
      
    } catch (error) {
      configLogger.logError('registerTab', 'ConfigSyncIntegration', error)
    }
  }

  /**
   * 注销Tab
   */
  public unregisterTab(tabId: string): void {
    try {
      // 停止监控
      if (this.config.enableTabMonitoring) {
        tabLoadingMonitor.stopMonitoring(tabId)
      }
      
      // 从同步状态管理器移除
      configSyncStateManager.removeTab(tabId)
      
      this.updateActiveConnections()
      
      configLogger.logDebug('unregisterTab', 'ConfigSyncIntegration',
        `Tab已注销: ${tabId}`)
      
    } catch (error) {
      configLogger.logError('unregisterTab', 'ConfigSyncIntegration', error)
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(success: boolean): void {
    // 简化的性能指标更新
    const currentRate = this.status.performanceMetrics.successRate
    const newRate = success ? 
      (currentRate * 0.9 + 1 * 0.1) : 
      (currentRate * 0.9 + 0 * 0.1)
    
    this.status.performanceMetrics.successRate = newRate
    
    if (this.config.enableOptimization) {
      const stats = configSyncOptimizer.getStats()
      this.status.performanceMetrics.optimizationRate = stats.optimizationRate
    }
  }

  /**
   * 运行端到端测试
   */
  public async runE2ETests(): Promise<E2ETestResult[]> {
    const results: E2ETestResult[] = []

    // 测试1: 基本配置同步
    results.push(await this.testBasicConfigSync())

    // 测试2: 多Tab配置同步
    results.push(await this.testMultiTabSync())

    // 测试3: 配置验证和错误处理
    results.push(await this.testConfigValidation())

    // 测试4: Tab加载状态监控
    if (this.config.enableTabMonitoring) {
      results.push(await this.testTabLoadingMonitoring())
    }

    // 测试5: 配置优化
    if (this.config.enableOptimization) {
      results.push(await this.testConfigOptimization())
    }

    // 测试6: 兼容性和迁移
    if (this.config.enableCompatibilityMode) {
      results.push(await this.testCompatibilityAndMigration())
    }

    return results
  }

  /**
   * 测试基本配置同步
   */
  private async testBasicConfigSync(): Promise<E2ETestResult> {
    const testName = '基本配置同步测试'
    const startTime = Date.now()
    const steps: Array<{ name: string, success: boolean, duration: number, error?: string }> = []

    try {
      // 步骤1: 更新配置
      const step1Start = Date.now()
      const config = { country: 'US', language: 'en' }
      const result = await this.updateConfig(config, ConfigUpdateSource.SETTING_WINDOW)
      steps.push({
        name: '更新配置',
        success: result.success,
        duration: Date.now() - step1Start,
        error: result.error
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      // 步骤2: 验证配置
      const step2Start = Date.now()
      const currentConfig = this.getCurrentConfig()
      const configMatches = currentConfig.country === 'US' && currentConfig.language === 'en'
      steps.push({
        name: '验证配置',
        success: configMatches,
        duration: Date.now() - step2Start,
        error: configMatches ? undefined : '配置不匹配'
      })

      if (!configMatches) {
        throw new Error('配置验证失败')
      }

      return {
        testName,
        success: true,
        duration: Date.now() - startTime,
        steps
      }

    } catch (error) {
      return {
        testName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error.message
      }
    }
  }

  /**
   * 测试多Tab配置同步
   */
  private async testMultiTabSync(): Promise<E2ETestResult> {
    const testName = '多Tab配置同步测试'
    const startTime = Date.now()
    const steps: Array<{ name: string, success: boolean, duration: number, error?: string }> = []

    try {
      // 步骤1: 注册多个Tab
      const step1Start = Date.now()
      const mockWebContents = { getURL: () => 'https://example.com' }
      this.registerTab('tab1', mockWebContents, 'https://example1.com')
      this.registerTab('tab2', mockWebContents, 'https://example2.com')
      steps.push({
        name: '注册Tab',
        success: true,
        duration: Date.now() - step1Start
      })

      // 步骤2: 设置Tab为就绪状态
      const step2Start = Date.now()
      configSyncStateManager.setTabLoadingState('tab1', TabLoadingState.READY)
      configSyncStateManager.setTabLoadingState('tab2', TabLoadingState.READY)
      steps.push({
        name: '设置Tab就绪',
        success: true,
        duration: Date.now() - step2Start
      })

      // 步骤3: 从一个Tab更新配置
      const step3Start = Date.now()
      const config = { country: 'CN', language: 'zh' }
      const result = await this.updateConfig(config, ConfigUpdateSource.SETTING_WINDOW, 'tab1')
      steps.push({
        name: '更新配置',
        success: result.success,
        duration: Date.now() - step3Start,
        error: result.error
      })

      // 步骤4: 验证配置已广播到其他Tab
      const step4Start = Date.now()
      await new Promise(resolve => setTimeout(resolve, 100)) // 等待异步广播
      const tab2State = configSyncStateManager.getTabState('tab2')
      const hasPendingSync = configSyncStateManager.getPendingConfigSync('tab2') !== null
      steps.push({
        name: '验证配置广播',
        success: hasPendingSync,
        duration: Date.now() - step4Start,
        error: hasPendingSync ? undefined : '配置未广播到其他Tab'
      })

      // 清理
      this.unregisterTab('tab1')
      this.unregisterTab('tab2')

      return {
        testName,
        success: steps.every(step => step.success),
        duration: Date.now() - startTime,
        steps
      }

    } catch (error) {
      return {
        testName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error.message
      }
    }
  }

  /**
   * 测试配置验证
   */
  private async testConfigValidation(): Promise<E2ETestResult> {
    const testName = '配置验证测试'
    const startTime = Date.now()
    const steps: Array<{ name: string, success: boolean, duration: number, error?: string }> = []

    try {
      // 步骤1: 测试有效配置
      const step1Start = Date.now()
      const validConfig = { country: 'US', language: 'en' }
      const validResult = await this.updateConfig(validConfig, ConfigUpdateSource.SETTING_WINDOW)
      steps.push({
        name: '有效配置测试',
        success: validResult.success,
        duration: Date.now() - step1Start,
        error: validResult.error
      })

      // 步骤2: 测试无效配置
      const step2Start = Date.now()
      const invalidConfig = { country: 123, language: null } as any
      const invalidResult = await this.updateConfig(invalidConfig, ConfigUpdateSource.SETTING_WINDOW)
      steps.push({
        name: '无效配置测试',
        success: !invalidResult.success, // 应该失败
        duration: Date.now() - step2Start,
        error: invalidResult.success ? '无效配置被接受' : undefined
      })

      return {
        testName,
        success: steps.every(step => step.success),
        duration: Date.now() - startTime,
        steps
      }

    } catch (error) {
      return {
        testName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error.message
      }
    }
  }

  /**
   * 测试Tab加载监控
   */
  private async testTabLoadingMonitoring(): Promise<E2ETestResult> {
    const testName = 'Tab加载监控测试'
    const startTime = Date.now()
    const steps: Array<{ name: string, success: boolean, duration: number, error?: string }> = []

    try {
      // 步骤1: 开始监控Tab
      const step1Start = Date.now()
      const mockWebContents = {
        getURL: () => 'https://example.com',
        on: () => {},
        off: () => {}
      }
      tabLoadingMonitor.startMonitoring('test-tab', mockWebContents as any, 'https://example.com')
      const monitoringInfo = tabLoadingMonitor.getTabLoadingInfo('test-tab')
      steps.push({
        name: '开始监控',
        success: monitoringInfo !== null,
        duration: Date.now() - step1Start,
        error: monitoringInfo ? undefined : '监控未启动'
      })

      // 步骤2: 强制设置为就绪状态
      const step2Start = Date.now()
      tabLoadingMonitor.forceReady('test-tab')
      const readyInfo = tabLoadingMonitor.getTabLoadingInfo('test-tab')
      const isReady = readyInfo && !readyInfo.isLoading
      steps.push({
        name: '设置就绪状态',
        success: isReady,
        duration: Date.now() - step2Start,
        error: isReady ? undefined : 'Tab未设置为就绪状态'
      })

      // 清理
      tabLoadingMonitor.stopMonitoring('test-tab')

      return {
        testName,
        success: steps.every(step => step.success),
        duration: Date.now() - startTime,
        steps
      }

    } catch (error) {
      return {
        testName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error.message
      }
    }
  }

  /**
   * 测试配置优化
   */
  private async testConfigOptimization(): Promise<E2ETestResult> {
    const testName = '配置优化测试'
    const startTime = Date.now()
    const steps: Array<{ name: string, success: boolean, duration: number, error?: string }> = []

    try {
      // 步骤1: 快速连续更新配置
      const step1Start = Date.now()
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          configSyncOptimizer.optimizeConfigUpdate(
            { country: `country-${i}` },
            ConfigUpdateSource.SETTING_WINDOW,
            'test-tab',
            5
          )
        )
      }
      await Promise.all(promises)
      steps.push({
        name: '批量配置更新',
        success: true,
        duration: Date.now() - step1Start
      })

      // 步骤2: 检查优化效果
      const step2Start = Date.now()
      const stats = configSyncOptimizer.getStats()
      const hasOptimization = stats.optimizationRate > 0
      steps.push({
        name: '检查优化效果',
        success: hasOptimization,
        duration: Date.now() - step2Start,
        error: hasOptimization ? undefined : '未检测到优化效果'
      })

      return {
        testName,
        success: steps.every(step => step.success),
        duration: Date.now() - startTime,
        steps,
        metrics: stats
      }

    } catch (error) {
      return {
        testName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error.message
      }
    }
  }

  /**
   * 测试兼容性和迁移
   */
  private async testCompatibilityAndMigration(): Promise<E2ETestResult> {
    const testName = '兼容性和迁移测试'
    const startTime = Date.now()
    const steps: Array<{ name: string, success: boolean, duration: number, error?: string }> = []

    try {
      // 步骤1: 测试旧格式配置
      const step1Start = Date.now()
      const legacyConfig = { lang: 'en', country: 'US' } // 使用旧的lang字段
      const compatibility = configCompatibilityManager.checkCompatibility(legacyConfig)
      steps.push({
        name: '兼容性检查',
        success: compatibility.isCompatible,
        duration: Date.now() - step1Start,
        error: compatibility.isCompatible ? undefined : compatibility.issues.join(', ')
      })

      // 步骤2: 测试配置迁移
      const step2Start = Date.now()
      if (compatibility.needsMigration) {
        const migration = await configCompatibilityManager.migrateConfig(legacyConfig)
        steps.push({
          name: '配置迁移',
          success: migration.success,
          duration: Date.now() - step2Start,
          error: migration.success ? undefined : migration.errors.join(', ')
        })
      } else {
        steps.push({
          name: '配置迁移',
          success: true,
          duration: Date.now() - step2Start,
          error: '无需迁移'
        })
      }

      return {
        testName,
        success: steps.every(step => step.success),
        duration: Date.now() - startTime,
        steps
      }

    } catch (error) {
      return {
        testName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error.message
      }
    }
  }

  /**
   * 事件发射器
   */
  private emitEvent(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName) || []
    listeners.forEach(listener => {
      try {
        listener(data)
      } catch (error) {
        configLogger.logError('emitEvent', 'ConfigSyncIntegration', error)
      }
    })
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(eventName: string, listener: Function): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, [])
    }
    
    this.eventListeners.get(eventName)!.push(listener)
    
    // 返回移除监听器的函数
    return () => {
      const listeners = this.eventListeners.get(eventName)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  /**
   * 获取集成状态
   */
  public getStatus(): IntegrationStatus {
    return { ...this.status }
  }

  /**
   * 获取集成配置
   */
  public getConfig(): IntegrationConfig {
    return { ...this.config }
  }

  /**
   * 更新集成配置
   */
  public updateIntegrationConfig(newConfig: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    configLogger.logInfo('updateIntegrationConfig', 'ConfigSyncIntegration',
      '集成配置已更新', { newConfig })
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // 检查初始化状态
      if (!this.status.initialized) {
        issues.push('集成系统未初始化')
      }

      // 检查组件状态
      if (!this.status.componentsReady) {
        issues.push('组件未就绪')
      }

      // 检查错误率
      if (this.status.errorCount > 10) {
        issues.push('错误数量过多')
        recommendations.push('检查日志以识别错误模式')
      }

      // 检查性能指标
      if (this.status.performanceMetrics.successRate < 0.9) {
        issues.push('成功率过低')
        recommendations.push('检查配置验证和网络连接')
      }

      // 检查活跃连接
      if (this.status.activeConnections === 0) {
        recommendations.push('当前没有活跃的Tab连接')
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations
      }

    } catch (error) {
      return {
        healthy: false,
        issues: [`健康检查失败: ${error.message}`],
        recommendations: ['重启集成系统']
      }
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    try {
      // 清理所有组件
      configUpdateQueue.cleanup()
      configSyncStateManager.cleanup()
      tabLoadingMonitor.cleanup()
      configSyncOptimizer.cleanup()

      // 清理事件监听器
      this.eventListeners.clear()

      // 重置状态
      this.status.initialized = false
      this.status.componentsReady = false
      this.status.activeConnections = 0
      this.isInitialized = false

      configLogger.logInfo('cleanup', 'ConfigSyncIntegration', '集成系统已清理')

    } catch (error) {
      configLogger.logError('cleanup', 'ConfigSyncIntegration', error)
    }
  }
}

// 导出单例实例
export const configSyncIntegration = ConfigSyncIntegration.getInstance()

// 导出便捷函数
export const initializeConfigSync = () => configSyncIntegration.initialize()
export const updateUserConfig = (config: Partial<UserConfig>, source: ConfigUpdateSource, sourceTabId?: string) =>
  configSyncIntegration.updateConfig(config, source, sourceTabId)
export const registerConfigTab = (tabId: string, webContents: any, url: string) =>
  configSyncIntegration.registerTab(tabId, webContents, url)
export const unregisterConfigTab = (tabId: string) =>
  configSyncIntegration.unregisterTab(tabId)
export const runConfigE2ETests = () => configSyncIntegration.runE2ETests()