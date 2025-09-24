/**
 * 网页配置同步助手
 * 为嵌入网页提供配置同步功能，支持环境检测和错误处理
 */

import { UserConfig } from '../types/config'

// 配置同步选项
export interface WebConfigSyncOptions {
  enableValidation?: boolean
  enableLogging?: boolean
  retryOnFailure?: boolean
  maxRetries?: number
  retryDelay?: number
}

// 同步结果
export interface WebSyncResult {
  success: boolean
  message?: string
  errors?: string[]
  retryCount?: number
}

// 环境检测结果
export interface WebEnvironment {
  hasElectron: boolean
  hasAppClient: boolean
  hasSetUserConfigWithObj: boolean
  hasGetUserConfig: boolean
  electronVersion?: string
}

export class WebConfigSyncHelper {
  private static instance: WebConfigSyncHelper
  private options: WebConfigSyncOptions
  private environment: WebEnvironment | null = null
  private configChangeListeners: Array<(config: Partial<UserConfig>) => void> = []

  private constructor() {
    this.options = {
      enableValidation: true,
      enableLogging: true,
      retryOnFailure: true,
      maxRetries: 3,
      retryDelay: 1000
    }
    
    this.detectEnvironment()
    this.setupConfigChangeListener()
  }

  // 单例模式
  public static getInstance(): WebConfigSyncHelper {
    if (!WebConfigSyncHelper.instance) {
      WebConfigSyncHelper.instance = new WebConfigSyncHelper()
    }
    return WebConfigSyncHelper.instance
  }

  /**
   * 检测运行环境
   */
  private detectEnvironment(): void {
    try {
      const win = window as any
      
      this.environment = {
        hasElectron: typeof win.electron !== 'undefined',
        hasAppClient: typeof win.appClient !== 'undefined',
        hasSetUserConfigWithObj: typeof win.appClient?.setUserConfigWithObj === 'function',
        hasGetUserConfig: typeof win.appClient?.getUserConfig === 'function',
        electronVersion: win.process?.versions?.electron
      }

      // 环境检测完成
    } catch (error) {
      this.environment = {
        hasElectron: false,
        hasAppClient: false,
        hasSetUserConfigWithObj: false,
        hasGetUserConfig: false
      }

      // 环境检测失败，使用默认值
    }
  }

  /**
   * 检查是否在Electron环境中
   */
  public checkElectronEnvironment(): boolean {
    if (!this.environment) {
      this.detectEnvironment()
    }
    
    return this.environment?.hasElectron && this.environment?.hasAppClient || false
  }

  /**
   * 获取环境信息
   */
  public getEnvironment(): WebEnvironment {
    if (!this.environment) {
      this.detectEnvironment()
    }
    return this.environment!
  }

  /**
   * 验证配置数据
   */
  private validateConfig(config: Partial<UserConfig>): { isValid: boolean, errors: string[] } {
    const errors: string[] = []

    if (!config || typeof config !== 'object') {
      errors.push('配置必须是对象类型')
      return { isValid: false, errors }
    }

    if (Object.keys(config).length === 0) {
      errors.push('配置不能为空')
      return { isValid: false, errors }
    }

    // 验证字段类型
    if (config.country !== undefined && typeof config.country !== 'string') {
      errors.push('country 必须是字符串类型')
    }

    if (config.language !== undefined && typeof config.language !== 'string') {
      errors.push('language 必须是字符串类型')
    }

    if (config.rate !== undefined && typeof config.rate !== 'string') {
      errors.push('rate 必须是字符串类型')
    }

    return { isValid: errors.length === 0, errors }
  }

  /**
   * 同步配置到Electron
   */
  public async syncToElectron(
    config: Partial<UserConfig>, 
    options?: Partial<WebConfigSyncOptions>
  ): Promise<WebSyncResult> {
    const effectiveOptions = { ...this.options, ...options }
    let retryCount = 0

    const attemptSync = async (): Promise<WebSyncResult> => {
      try {
        // 环境检查
        if (!this.checkElectronEnvironment()) {
          return {
            success: false,
            message: '当前环境不支持配置同步到Electron',
            errors: ['Not in Electron environment or appClient not available']
          }
        }

        // 配置验证
        if (effectiveOptions.enableValidation) {
          const validation = this.validateConfig(config)
          if (!validation.isValid) {
            return {
              success: false,
              message: '配置验证失败',
              errors: validation.errors
            }
          }
        }

        // 开始同步配置

        // 调用Electron API
        const win = window as any
        if (win.appClient && win.appClient.setUserConfigWithObj) {
          win.appClient.setUserConfigWithObj(config)
          
          return {
            success: true,
            message: '配置同步成功',
            retryCount
          }
        } else {
          throw new Error('setUserConfigWithObj method not available')
        }

      } catch (error) {
        // 同步失败，准备重试

        // 重试逻辑
        if (effectiveOptions.retryOnFailure && retryCount < (effectiveOptions.maxRetries || 3)) {
          retryCount++
          
          // 重试同步操作

          // 延迟重试
          await new Promise(resolve => setTimeout(resolve, effectiveOptions.retryDelay || 1000))
          return await attemptSync()
        }

        return {
          success: false,
          message: `配置同步失败: ${error.message}`,
          errors: [error.message],
          retryCount
        }
      }
    }

    return await attemptSync()
  }

  /**
   * 从Electron获取配置
   */
  public async getFromElectron(): Promise<{ success: boolean, config?: UserConfig, message?: string }> {
    try {
      // 环境检查
      if (!this.checkElectronEnvironment()) {
        return {
          success: false,
          message: '当前环境不支持从Electron获取配置'
        }
      }

      const win = window as any
      if (win.appClient && win.appClient.getUserConfig) {
        const config = await win.appClient.getUserConfig()
        
        // 从Electron获取配置成功

        return {
          success: true,
          config,
          message: '配置获取成功'
        }
      } else {
        throw new Error('getUserConfig method not available')
      }

    } catch (error) {
      // 获取配置失败

      return {
        success: false,
        message: `配置获取失败: ${error.message}`
      }
    }
  }

  /**
   * 批量同步配置字段
   */
  public async syncFields(
    fields: Array<{ key: keyof UserConfig, value: any }>,
    options?: Partial<WebConfigSyncOptions>
  ): Promise<WebSyncResult> {
    const config: Partial<UserConfig> = {}
    
    for (const field of fields) {
      (config as any)[field.key] = field.value
    }

    return await this.syncToElectron(config, options)
  }

  /**
   * 同步单个配置字段
   */
  public async syncField<K extends keyof UserConfig>(
    key: K, 
    value: UserConfig[K],
    options?: Partial<WebConfigSyncOptions>
  ): Promise<WebSyncResult> {
    const config = { [key]: value } as Partial<UserConfig>
    return await this.syncToElectron(config, options)
  }

  /**
   * 设置配置变更监听器
   */
  private setupConfigChangeListener(): void {
    try {
      const win = window as any
      
      // 监听来自Electron的配置变更
      if (win.appClient && win.appClient.fromMainMessage) {
        win.appClient.fromMainMessage((data: any) => {
          if (data.type === 'setting-update' && data.data) {
            this.notifyConfigChange(data.data)
          }
        })
      }
    } catch (error) {
      // 设置配置变更监听器失败
    }
  }

  /**
   * 注册配置变更监听器
   */
  public onConfigChange(callback: (config: Partial<UserConfig>) => void): () => void {
    this.configChangeListeners.push(callback)

    // 返回取消监听的函数
    return () => {
      const index = this.configChangeListeners.indexOf(callback)
      if (index > -1) {
        this.configChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * 通知配置变更
   */
  private notifyConfigChange(config: Partial<UserConfig>): void {
    // 配置变更通知

    this.configChangeListeners.forEach(callback => {
      try {
        callback(config)
      } catch (error) {
        // 配置变更回调执行失败
      }
    })
  }

  /**
   * 更新同步选项
   */
  public updateOptions(newOptions: Partial<WebConfigSyncOptions>): void {
    this.options = { ...this.options, ...newOptions }
    
    // 选项更新完成
  }

  /**
   * 获取当前选项
   */
  public getOptions(): WebConfigSyncOptions {
    return { ...this.options }
  }

  /**
   * 创建便捷的同步函数
   */
  public createSyncFunction(): (config: Partial<UserConfig>) => Promise<WebSyncResult> {
    return (config: Partial<UserConfig>) => this.syncToElectron(config)
  }

  /**
   * 创建兼容的旧版函数
   */
  public createLegacySync(): (config: Record<string, any>) => void {
    return (config: Record<string, any>) => {
      if (this.checkElectronEnvironment()) {
        const win = window as any
        if (win.appClient && win.appClient.setUserConfigWithObj) {
          win.appClient.setUserConfigWithObj(config)
        }
      }
    }
  }

  /**
   * 获取同步统计信息
   */
  public getStats(): {
    environment: WebEnvironment
    listenersCount: number
    options: WebConfigSyncOptions
  } {
    return {
      environment: this.getEnvironment(),
      listenersCount: this.configChangeListeners.length,
      options: this.getOptions()
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.configChangeListeners = []
    this.environment = null
  }
}

// 导出单例实例
export const webConfigSyncHelper = WebConfigSyncHelper.getInstance()

// 导出便捷函数
export const syncConfigToElectron = (config: Partial<UserConfig>) => 
  webConfigSyncHelper.syncToElectron(config)

export const checkHelperEnv = () => 
  webConfigSyncHelper.checkElectronEnvironment()

export const onElectronConfigChange = (callback: (config: Partial<UserConfig>) => void) =>
  webConfigSyncHelper.onConfigChange(callback)