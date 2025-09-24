/**
 * 增强的设置窗口配置处理器
 * 集成新的错误处理和状态管理机制，提供配置保存结果的用户反馈
 */

import { UserConfig, ConfigOperationResult } from '../../types/config'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'

const { ipcRenderer } = (window as any)['electron'] as any

// 配置保存状态
export enum ConfigSaveState {
  IDLE = 'idle',
  SAVING = 'saving',
  SUCCESS = 'success',
  ERROR = 'error'
}

// 配置保存结果回调
export type ConfigSaveCallback = (result: ConfigOperationResult) => void

// 配置验证错误
export interface ConfigValidationError {
  field: string
  message: string
}

export class EnhancedSettingConfigHandler {
  private static instance: EnhancedSettingConfigHandler
  private saveState: ConfigSaveState = ConfigSaveState.IDLE
  private saveCallbacks: ConfigSaveCallback[] = []
  private validationErrors: ConfigValidationError[] = []

  private constructor() {
    this.setupIPCListeners()
  }

  // 单例模式
  public static getInstance(): EnhancedSettingConfigHandler {
    if (!EnhancedSettingConfigHandler.instance) {
      EnhancedSettingConfigHandler.instance = new EnhancedSettingConfigHandler()
    }
    return EnhancedSettingConfigHandler.instance
  }

  /**
   * 设置IPC监听器
   */
  private setupIPCListeners(): void {
    // 监听配置保存结果
    ipcRenderer.on('config-save-result', (event: any, result: ConfigOperationResult) => {
      this.handleConfigSaveResult(result)
    })

    // 监听配置验证结果
    ipcRenderer.on('config-validation-result', (event: any, errors: ConfigValidationError[]) => {
      this.handleConfigValidationResult(errors)
    })
  }

  /**
   * 获取用户配置（增强版）
   */
  public async getUserConfig(): Promise<ConfigOperationResult> {
    try {
      const config = await ipcRenderer.invoke(EMessage.EMainGetUserConfig)
      
      if (config && config.success) {
        return config
      } else {
        return {
          success: false,
          message: config?.message || '配置获取失败'
        }
      }
    } catch (error) {
      // 获取用户配置失败
      return {
        success: false,
        message: `配置获取异常: ${error.message}`
      }
    }
  }

  /**
   * 保存用户配置（增强版）
   */
  public async saveUserConfig(
    config: Partial<UserConfig>,
    callback?: ConfigSaveCallback
  ): Promise<ConfigOperationResult> {
    try {
      // 设置保存状态
      this.setSaveState(ConfigSaveState.SAVING)
      
      // 注册回调
      if (callback) {
        this.addSaveCallback(callback)
      }

      // 客户端验证
      const validationResult = this.validateConfig(config)
      if (!validationResult.isValid) {
        const result: ConfigOperationResult = {
          success: false,
          message: '配置验证失败',
          errors: validationResult.errors
        }
        
        this.setSaveState(ConfigSaveState.ERROR)
        this.notifyCallbacks(result)
        return result
      }

      // 发送配置到主进程
      ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, config)

      // 返回pending状态，实际结果通过回调返回
      return {
        success: true,
        message: '配置保存请求已发送'
      }

    } catch (error) {
      // 保存用户配置失败
      
      const result: ConfigOperationResult = {
        success: false,
        message: `配置保存异常: ${error.message}`
      }
      
      this.setSaveState(ConfigSaveState.ERROR)
      this.notifyCallbacks(result)
      return result
    }
  }

  /**
   * 保存配置并关闭窗口
   */
  public async saveConfigAndClose(
    config: Partial<UserConfig>,
    proxyRules?: string
  ): Promise<void> {
    try {
      // 保存配置
      const result = await this.saveUserConfig(config, (saveResult) => {
        if (saveResult.success) {
          // 保存代理设置
          if (proxyRules !== undefined) {
            ipcRenderer.send(EMessage.ESetProxy, proxyRules)
          }
          
          // 关闭窗口
          ipcRenderer.send(EMessage.EWindowClose, EWnd.ESetting)
        } else {
          // 显示错误信息
          this.showErrorMessage(saveResult.message || '配置保存失败')
        }
      })

      if (!result.success) {
        this.showErrorMessage(result.message || '配置保存失败')
      }

    } catch (error) {
      // 保存配置并关闭窗口失败
      this.showErrorMessage(`操作失败: ${error.message}`)
    }
  }

  /**
   * 重置配置
   */
  public async resetConfig(): Promise<ConfigOperationResult> {
    try {
      this.setSaveState(ConfigSaveState.SAVING)
      
      const result = await ipcRenderer.invoke('config-reset')
      
      if (result.success) {
        this.setSaveState(ConfigSaveState.SUCCESS)
      } else {
        this.setSaveState(ConfigSaveState.ERROR)
      }
      
      return result

    } catch (error) {
      // 重置配置失败
      
      const result: ConfigOperationResult = {
        success: false,
        message: `配置重置异常: ${error.message}`
      }
      
      this.setSaveState(ConfigSaveState.ERROR)
      return result
    }
  }

  /**
   * 客户端配置验证
   */
  private validateConfig(config: Partial<UserConfig>): { isValid: boolean, errors: string[] } {
    const errors: string[] = []

    // 验证必需字段
    if (config.country !== undefined && typeof config.country !== 'string') {
      errors.push('国家配置必须是字符串类型')
    }

    if (config.language !== undefined && typeof config.language !== 'string') {
      errors.push('语言配置必须是字符串类型')
    }

    if (config.rate !== undefined && typeof config.rate !== 'string') {
      errors.push('汇率配置必须是字符串类型')
    }

    // 验证布尔类型字段
    const booleanFields = ['hideToTask', 'autoStart', 'openOrderNotification', 
                          'openMarketActivityNotification', 'openCoummunityMessageNotification']
    
    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} 必须是布尔类型`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 处理配置保存结果
   */
  private handleConfigSaveResult(result: ConfigOperationResult): void {
    if (result.success) {
      this.setSaveState(ConfigSaveState.SUCCESS)
    } else {
      this.setSaveState(ConfigSaveState.ERROR)
    }
    
    this.notifyCallbacks(result)
  }

  /**
   * 处理配置验证结果
   */
  private handleConfigValidationResult(errors: ConfigValidationError[]): void {
    this.validationErrors = errors
    
    if (errors.length > 0) {
      this.setSaveState(ConfigSaveState.ERROR)
      
      const result: ConfigOperationResult = {
        success: false,
        message: '配置验证失败',
        errors: errors.map(e => `${e.field}: ${e.message}`)
      }
      
      this.notifyCallbacks(result)
    }
  }

  /**
   * 设置保存状态
   */
  private setSaveState(state: ConfigSaveState): void {
    this.saveState = state
    
    // 发布状态变更事件
    const event = new CustomEvent('config-save-state-change', {
      detail: { state, timestamp: Date.now() }
    })
    window.dispatchEvent(event)
  }

  /**
   * 添加保存回调
   */
  private addSaveCallback(callback: ConfigSaveCallback): void {
    this.saveCallbacks.push(callback)
  }

  /**
   * 通知所有回调
   */
  private notifyCallbacks(result: ConfigOperationResult): void {
    const callbacks = [...this.saveCallbacks]
    this.saveCallbacks = [] // 清空回调列表
    
    callbacks.forEach(callback => {
      try {
        callback(result)
      } catch (error) {
        // 配置保存回调执行失败
      }
    })
  }

  /**
   * 显示错误信息
   */
  private showErrorMessage(message: string): void {
    // 这里可以集成UI组件显示错误信息
    // 暂时使用alert
    alert(`配置保存失败: ${message}`)
  }

  /**
   * 显示成功信息
   */
  private showSuccessMessage(message: string): void {
    // 这里可以集成UI组件显示成功信息
    // 配置保存成功
  }

  /**
   * 获取当前保存状态
   */
  public getSaveState(): ConfigSaveState {
    return this.saveState
  }

  /**
   * 获取验证错误
   */
  public getValidationErrors(): ConfigValidationError[] {
    return [...this.validationErrors]
  }

  /**
   * 清除验证错误
   */
  public clearValidationErrors(): void {
    this.validationErrors = []
  }

  /**
   * 检查是否正在保存
   */
  public isSaving(): boolean {
    return this.saveState === ConfigSaveState.SAVING
  }

  /**
   * 检查是否有错误
   */
  public hasError(): boolean {
    return this.saveState === ConfigSaveState.ERROR || this.validationErrors.length > 0
  }

  /**
   * 监听保存状态变更
   */
  public onSaveStateChange(callback: (state: ConfigSaveState) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail.state)
    }
    
    window.addEventListener('config-save-state-change', handler as EventListener)
    
    // 返回取消监听的函数
    return () => {
      window.removeEventListener('config-save-state-change', handler as EventListener)
    }
  }

  /**
   * 创建配置对象
   */
  public createConfigObject(formData: {
    country: string
    language: string
    rate: string
    hideToTask: boolean
    autoStart: boolean
    openOrderNotification: boolean
    openMarketActivityNotification: boolean
    openCoummunityMessageNotification: boolean
  }): Partial<UserConfig> {
    return {
      country: formData.country,
      language: formData.language,
      rate: formData.rate,
      hideToTask: formData.hideToTask,
      autoStart: formData.autoStart,
      openOrderNotification: formData.openOrderNotification,
      openMarketActivityNotification: formData.openMarketActivityNotification,
      openCoummunityMessageNotification: formData.openCoummunityMessageNotification
    }
  }

  /**
   * 格式化配置用于显示
   */
  public formatConfigForDisplay(config: Partial<UserConfig>): Record<string, any> {
    return {
      country: config.country || '',
      countryList: config.countryList || [],
      language: config.language || '',
      languageList: config.languageList || [],
      rate: config.rate || '',
      rateList: config.rateList || [],
      hideToTask: config.hideToTask ?? true,
      autoStart: config.autoStart ?? true,
      openOrderNotification: config.openOrderNotification ?? true,
      openMarketActivityNotification: config.openMarketActivityNotification ?? true,
      openCoummunityMessageNotification: config.openCoummunityMessageNotification ?? true,
      username: config.username || ''
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.saveCallbacks = []
    this.validationErrors = []
    this.setSaveState(ConfigSaveState.IDLE)
  }
}

// 导出单例实例
export const enhancedSettingConfigHandler = EnhancedSettingConfigHandler.getInstance()