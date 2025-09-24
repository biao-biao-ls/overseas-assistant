/**
 * 配置状态管理器
 * 管理配置的加载、错误和更新状态，提供状态变更通知机制
 */

import { UserConfig, ConfigState, ConfigOperationResult } from '../types/config'
import { configValidator } from './ConfigValidator'
import { configEventManager, ConfigEventType } from './ConfigEventManager'
import { configLogger } from './ConfigLogger'
import { AppUtil } from './AppUtil'

export class ConfigStateManager {
  private static instance: ConfigStateManager
  private state: ConfigState
  private listeners: Array<(state: ConfigState) => void> = []

  private constructor() {
    this.state = {
      config: null,
      loading: false,
      error: null,
      lastUpdated: undefined
    }
  }

  // 单例模式
  public static getInstance(): ConfigStateManager {
    if (!ConfigStateManager.instance) {
      ConfigStateManager.instance = new ConfigStateManager()
    }
    return ConfigStateManager.instance
  }

  /**
   * 获取当前配置状态
   */
  public getState(): ConfigState {
    return { ...this.state }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): UserConfig | null {
    return this.state.config
  }

  /**
   * 获取当前配置（别名方法）
   */
  public getCurrentConfig(): UserConfig | null {
    return this.getConfig()
  }

  /**
   * 设置加载状态
   */
  public setLoading(loading: boolean): void {
    if (this.state.loading !== loading) {
      this.state = {
        ...this.state,
        loading
      }
      this.notifyListeners()
      
      AppUtil.info('ConfigStateManager', 'setLoading', `加载状态变更: ${loading}`)
    }
  }

  /**
   * 设置错误状态
   */
  public setError(error: string | null): void {
    if (this.state.error !== error) {
      this.state = {
        ...this.state,
        error
      }
      this.notifyListeners()
      
      if (error) {
        // 发布配置错误事件
        configEventManager.emitConfigError(error, 'ConfigStateManager')
        AppUtil.error('ConfigStateManager', 'setError', `错误状态设置: ${error}`)
      } else {
        AppUtil.info('ConfigStateManager', 'setError', '错误状态已清除')
      }
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<UserConfig>): ConfigOperationResult {
    const startTime = Date.now()
    const operationId = configLogger.startOperation('updateConfig', 'ConfigStateManager', { 
      configFields: Object.keys(config) 
    })

    try {
      // 验证配置
      const validationResult = configValidator.validateConfig(config)
      if (!validationResult.isValid) {
        const errorMessage = `配置验证失败: ${validationResult.errors.join(', ')}`
        this.setError(errorMessage)
        
        // 记录失败日志
        configLogger.endOperation(
          operationId, 'updateConfig', 'ConfigStateManager', false, startTime,
          errorMessage, validationResult.errors
        )
        
        return {
          success: false,
          message: errorMessage,
          errors: validationResult.errors
        }
      }

      // 记录警告
      if (validationResult.warnings.length > 0) {
        configLogger.logWarning('updateConfig', 'ConfigStateManager', 
          `配置警告: ${validationResult.warnings.join(', ')}`, { warnings: validationResult.warnings })
        AppUtil.warn('ConfigStateManager', 'updateConfig', `配置警告: ${validationResult.warnings.join(', ')}`)
      }

      // 清理配置数据
      const sanitizedConfig = configValidator.sanitizeConfig(config)

      // 合并配置
      const currentConfig = this.state.config || configValidator.getDefaultConfig()
      const mergedConfig = configValidator.mergeConfigs(currentConfig, sanitizedConfig)

      // 检测变更
      const changes = configValidator.detectChanges(currentConfig, sanitizedConfig)
      const hasChanges = Object.keys(changes).length > 0

      // 记录配置变更日志
      // configLogger.logConfigChange(
      //   'updateConfig',
      //   'ConfigStateManager',
      //   currentConfig,
      //   mergedConfig,
      //   true,
      //   hasChanges ? '配置更新成功' : '配置无变更',
      //   undefined,
      //   Date.now() - startTime,
      //   { 
      //     operationId,
      //     hasChanges,
      //     changedFields: Object.keys(changes),
      //     configSummary: configValidator.getConfigSummary(changes)
      //   }
      // )

      // 更新状态
      this.state = {
        ...this.state,
        config: mergedConfig as UserConfig,
        error: null,
        lastUpdated: Date.now()
      }

      this.notifyListeners()

      // 发布配置更新事件
      if (hasChanges) {
        configEventManager.emitConfigUpdated(changes, mergedConfig as UserConfig, 'ConfigStateManager')
      }

      // 记录成功日志
      // configLogger.endOperation(
      //   operationId, 'updateConfig', 'ConfigStateManager', true, startTime,
      //   hasChanges ? '配置更新成功' : '配置无变更'
      // )

      // AppUtil.info('ConfigStateManager', 'updateConfig', 
      //   `配置更新成功, 变更字段: ${Object.keys(changes).join(', ')}, 摘要: ${configValidator.getConfigSummary(changes)}`)

      return {
        success: true,
        message: hasChanges ? '配置更新成功' : '配置无变更',
        data: changes
      }
    } catch (error) {
      const errorMessage = `配置更新失败: ${error.message}`
      this.setError(errorMessage)
      
      // 记录错误日志
      configLogger.logError('updateConfig', 'ConfigStateManager', error, { operationId })
      configLogger.endOperation(
        operationId, 'updateConfig', 'ConfigStateManager', false, startTime,
        errorMessage, [error.message]
      )
      
      AppUtil.error('ConfigStateManager', 'updateConfig', errorMessage, error)
      
      return {
        success: false,
        message: errorMessage
      }
    }
  }

  /**
   * 重置配置到默认值
   */
  public resetConfig(): ConfigOperationResult {
    try {
      const defaultConfig = configValidator.getDefaultConfig()
      
      this.state = {
        ...this.state,
        config: defaultConfig,
        error: null,
        lastUpdated: Date.now()
      }

      this.notifyListeners()

      // 发布配置重置事件
      configEventManager.emitConfigReset(defaultConfig, 'ConfigStateManager')

      AppUtil.info('ConfigStateManager', 'resetConfig', '配置已重置为默认值')

      return {
        success: true,
        message: '配置已重置为默认值',
        data: defaultConfig
      }
    } catch (error) {
      const errorMessage = `配置重置失败: ${error.message}`
      this.setError(errorMessage)
      AppUtil.error('ConfigStateManager', 'resetConfig', errorMessage, error)
      
      return {
        success: false,
        message: errorMessage
      }
    }
  }

  /**
   * 初始化配置
   */
  public initializeConfig(config: Partial<UserConfig>): ConfigOperationResult {
    try {
      this.setLoading(true)
      
      // 获取默认配置
      const defaultConfig = configValidator.getDefaultConfig()
      
      // 合并用户配置和默认配置
      const mergedConfig = configValidator.mergeConfigs(defaultConfig, config)
      
      // 验证合并后的配置
      const validationResult = configValidator.validateConfig(mergedConfig)
      if (!validationResult.isValid) {
        throw new Error(`配置初始化验证失败: ${validationResult.errors.join(', ')}`)
      }

      // 清理配置
      const sanitizedConfig = configValidator.sanitizeConfig(mergedConfig)

      this.state = {
        config: sanitizedConfig as UserConfig,
        loading: false,
        error: null,
        lastUpdated: Date.now()
      }

      this.notifyListeners()

      // 发布配置加载事件
      configEventManager.emitConfigLoaded(sanitizedConfig as UserConfig, 'ConfigStateManager')

      AppUtil.info('ConfigStateManager', 'initializeConfig', 
        `配置初始化成功, 摘要: ${configValidator.getConfigSummary(sanitizedConfig)}`)

      return {
        success: true,
        message: '配置初始化成功',
        data: sanitizedConfig
      }
    } catch (error) {
      const errorMessage = `配置初始化失败: ${error.message}`
      this.setError(errorMessage)
      this.setLoading(false)
      AppUtil.error('ConfigStateManager', 'initializeConfig', errorMessage, error)
      
      return {
        success: false,
        message: errorMessage
      }
    }
  }

  /**
   * 获取配置字段值
   */
  public getConfigValue<K extends keyof UserConfig>(key: K): UserConfig[K] | undefined {
    return this.state.config?.[key]
  }

  /**
   * 设置单个配置字段
   */
  public setConfigValue<K extends keyof UserConfig>(key: K, value: UserConfig[K]): ConfigOperationResult {
    const partialConfig = { [key]: value } as Partial<UserConfig>
    return this.updateConfig(partialConfig)
  }

  /**
   * 检查配置是否已加载
   */
  public isConfigLoaded(): boolean {
    return this.state.config !== null
  }

  /**
   * 检查是否有错误
   */
  public hasError(): boolean {
    return this.state.error !== null
  }

  /**
   * 检查是否正在加载
   */
  public isLoading(): boolean {
    return this.state.loading
  }

  /**
   * 清除错误状态
   */
  public clearError(): void {
    this.setError(null)
  }

  /**
   * 注册状态变更监听器
   */
  public addListener(listener: (state: ConfigState) => void): void {
    this.listeners.push(listener)
    AppUtil.info('ConfigStateManager', 'addListener', `监听器已注册, 当前监听器数量: ${this.listeners.length}`)
  }

  /**
   * 注册配置变更监听器（别名方法）
   */
  public onConfigChange(listener: (state: ConfigState) => void): void {
    this.addListener(listener)
  }

  /**
   * 移除状态变更监听器
   */
  public removeListener(listener: (state: ConfigState) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
      AppUtil.info('ConfigStateManager', 'removeListener', `监听器已移除, 当前监听器数量: ${this.listeners.length}`)
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const state = this.getState()
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        AppUtil.error('ConfigStateManager', 'notifyListeners', '监听器执行失败', error)
      }
    })
  }

  /**
   * 获取状态统计信息
   */
  public getStateStats(): {
    hasConfig: boolean
    isLoading: boolean
    hasError: boolean
    listenersCount: number
    lastUpdated?: number
    configFieldsCount?: number
  } {
    return {
      hasConfig: this.state.config !== null,
      isLoading: this.state.loading,
      hasError: this.state.error !== null,
      listenersCount: this.listeners.length,
      lastUpdated: this.state.lastUpdated,
      configFieldsCount: this.state.config ? Object.keys(this.state.config).length : undefined
    }
  }

  /**
   * 导出配置用于备份
   */
  public exportConfig(): UserConfig | null {
    return this.state.config ? { ...this.state.config } : null
  }

  /**
   * 从备份导入配置
   */
  public importConfig(config: UserConfig): ConfigOperationResult {
    return this.updateConfig(config)
  }
}

// 导出单例实例
export const configStateManager = ConfigStateManager.getInstance()