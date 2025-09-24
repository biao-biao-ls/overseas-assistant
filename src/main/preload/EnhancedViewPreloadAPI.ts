/**
 * 增强的预加载脚本配置API
 * 提供类型安全的配置操作接口，支持参数验证和错误处理
 */

import { ipcRenderer } from 'electron'
import { UserConfig, ConfigOperationResult } from '../../types/config'
import { EMessage } from '../../enum/EMessage'

// API响应接口
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  errors?: string[]
  timestamp: number
}

// 配置更新选项
export interface ConfigUpdateOptions {
  validate?: boolean
  silent?: boolean
  source?: string
}

// 环境检查结果
export interface EnvironmentCheck {
  isElectron: boolean
  hasAppClient: boolean
  version?: string
}

export class EnhancedViewPreloadAPI {
  private static instance: EnhancedViewPreloadAPI
  private initialized = false
  private environmentCheck: EnvironmentCheck | null = null

  private constructor() {
    this.performEnvironmentCheck()
  }

  // 单例模式
  public static getInstance(): EnhancedViewPreloadAPI {
    if (!EnhancedViewPreloadAPI.instance) {
      EnhancedViewPreloadAPI.instance = new EnhancedViewPreloadAPI()
    }
    return EnhancedViewPreloadAPI.instance
  }

  /**
   * 执行环境检查
   */
  private performEnvironmentCheck(): void {
    try {
      this.environmentCheck = {
        isElectron: typeof window !== 'undefined' && 
                   typeof (window as any).electron !== 'undefined',
        hasAppClient: typeof window !== 'undefined' && 
                     typeof (window as any).appClient !== 'undefined',
        version: process?.versions?.electron
      }
    } catch (error) {
      this.environmentCheck = {
        isElectron: false,
        hasAppClient: false
      }
    }
  }

  /**
   * 检查Electron环境
   */
  public checkElectronEnvironment(): EnvironmentCheck {
    if (!this.environmentCheck) {
      this.performEnvironmentCheck()
    }
    return this.environmentCheck!
  }

  /**
   * 验证配置参数
   */
  private validateConfigParams(config: Record<string, any>): APIResponse<null> {
    try {
      // 基本类型检查
      if (!config || typeof config !== 'object') {
        return {
          success: false,
          message: '配置参数必须是对象类型',
          errors: ['Invalid config parameter type'],
          timestamp: Date.now()
        }
      }

      // 检查空对象
      if (Object.keys(config).length === 0) {
        return {
          success: false,
          message: '配置参数不能为空',
          errors: ['Empty config object'],
          timestamp: Date.now()
        }
      }

      // 验证已知字段类型
      const validationErrors: string[] = []

      if (config.country !== undefined && typeof config.country !== 'string') {
        validationErrors.push('country 必须是字符串类型')
      }

      if (config.language !== undefined && typeof config.language !== 'string') {
        validationErrors.push('language 必须是字符串类型')
      }

      if (config.rate !== undefined && typeof config.rate !== 'string') {
        validationErrors.push('rate 必须是字符串类型')
      }

      if (config.username !== undefined && typeof config.username !== 'string') {
        validationErrors.push('username 必须是字符串类型')
      }

      if (config.customerCode !== undefined && typeof config.customerCode !== 'string') {
        validationErrors.push('customerCode 必须是字符串类型')
      }

      // 验证布尔类型字段
      const booleanFields = [
        'hideToTask', 'autoStart', 'openOrderNotification',
        'openMarketActivityNotification', 'openCoummunityMessageNotification'
      ]

      for (const field of booleanFields) {
        if (config[field] !== undefined && typeof config[field] !== 'boolean') {
          validationErrors.push(`${field} 必须是布尔类型`)
        }
      }

      // 验证数组类型字段
      const arrayFields = ['countryList', 'languageList', 'rateList']
      for (const field of arrayFields) {
        if (config[field] !== undefined && !Array.isArray(config[field])) {
          validationErrors.push(`${field} 必须是数组类型`)
        }
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          message: '配置参数验证失败',
          errors: validationErrors,
          timestamp: Date.now()
        }
      }

      return {
        success: true,
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        message: `参数验证异常: ${error.message}`,
        errors: [error.message],
        timestamp: Date.now()
      }
    }
  }

  /**
   * 清理配置参数
   */
  private sanitizeConfigParams(config: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    // 只保留已知的配置字段
    const knownFields = [
      'country', 'language', 'rate', 'username', 'customerCode',
      'countryList', 'languageList', 'rateList',
      'hideToTask', 'autoStart', 'openOrderNotification',
      'openMarketActivityNotification', 'openCoummunityMessageNotification',
      '__source'  // 保留来源标记
    ]

    for (const field of knownFields) {
      if (config.hasOwnProperty(field) && config[field] !== undefined) {
        // 字符串类型去除首尾空格
        if (typeof config[field] === 'string') {
          sanitized[field] = config[field].trim()
        } else {
          sanitized[field] = config[field]
        }
      }
    }

    return sanitized
  }

  /**
   * 增强的配置设置方法
   */
  public async setUserConfigWithObj(
    config: Record<string, any>,
    options: ConfigUpdateOptions = {}
  ): Promise<APIResponse<ConfigOperationResult>> {
    try {
      // 环境检查
      const envCheck = this.checkElectronEnvironment()
      if (!envCheck.isElectron) {
        return {
          success: false,
          message: '当前环境不支持配置同步',
          errors: ['Not in Electron environment'],
          timestamp: Date.now()
        }
      }

      // 参数验证
      if (options.validate !== false) {
        const validationResult = this.validateConfigParams(config)
        if (!validationResult.success) {
          return {
            success: false,
            message: validationResult.message,
            errors: validationResult.errors,
            timestamp: Date.now()
          }
        }
      }

      // 清理参数
      const sanitizedConfig = this.sanitizeConfigParams(config)

      // 记录日志（非静默模式）
      if (!options.silent) {
        console.log('Enhanced setUserConfigWithObj:', {
          original: config,
          sanitized: sanitizedConfig,
          options,
          timestamp: new Date().toISOString()
        })
      }

      // 发送到主进程
      ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, sanitizedConfig)

      // 返回成功响应
      return {
        success: true,
        message: '配置更新请求已发送',
        data: {
          success: true,
          message: '配置更新请求已发送',
          data: sanitizedConfig
        },
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('Enhanced setUserConfigWithObj error:', error)
      
      return {
        success: false,
        message: `配置更新异常: ${error.message}`,
        errors: [error.message],
        timestamp: Date.now()
      }
    }
  }

  /**
   * 增强的配置获取方法
   */
  public async getUserConfig(): Promise<APIResponse<UserConfig>> {
    try {
      // 环境检查
      const envCheck = this.checkElectronEnvironment()
      if (!envCheck.isElectron) {
        return {
          success: false,
          message: '当前环境不支持配置获取',
          errors: ['Not in Electron environment'],
          timestamp: Date.now()
        }
      }

      // 调用主进程获取配置
      const result = await ipcRenderer.invoke(EMessage.EMainGetUserConfig)

      if (result && result.success) {
        return {
          success: true,
          data: result.data,
          message: '配置获取成功',
          timestamp: Date.now()
        }
      } else {
        return {
          success: false,
          message: result?.message || '配置获取失败',
          errors: result?.errors,
          timestamp: Date.now()
        }
      }

    } catch (error) {
      console.error('Enhanced getUserConfig error:', error)
      
      return {
        success: false,
        message: `配置获取异常: ${error.message}`,
        errors: [error.message],
        timestamp: Date.now()
      }
    }
  }

  /**
   * 批量配置更新
   */
  public async batchUpdateConfig(
    updates: Array<{ field: keyof UserConfig, value: any }>,
    options: ConfigUpdateOptions = {}
  ): Promise<APIResponse<ConfigOperationResult>> {
    try {
      // 构建配置对象
      const config: Record<string, any> = {}
      for (const update of updates) {
        config[update.field] = update.value
      }

      // 调用单个配置更新方法
      return await this.setUserConfigWithObj(config, options)

    } catch (error) {
      console.error('Batch update config error:', error)
      
      return {
        success: false,
        message: `批量配置更新异常: ${error.message}`,
        errors: [error.message],
        timestamp: Date.now()
      }
    }
  }

  /**
   * 配置字段更新
   */
  public async updateConfigField<K extends keyof UserConfig>(
    field: K,
    value: UserConfig[K],
    options: ConfigUpdateOptions = {}
  ): Promise<APIResponse<ConfigOperationResult>> {
    const config = { [field]: value }
    return await this.setUserConfigWithObj(config, options)
  }

  /**
   * 监听配置变更
   */
  public onConfigChange(callback: (config: Partial<UserConfig>) => void): () => void {
    const handler = (event: any, data: any) => {
      if (data.type === 'setting-update' && data.data) {
        callback(data.data)
      }
    }

    ipcRenderer.on(EMessage.EMainFromMainMessage, handler)

    // 返回取消监听的函数
    return () => {
      ipcRenderer.off(EMessage.EMainFromMainMessage, handler)
    }
  }

  /**
   * 获取API状态信息
   */
  public getAPIStatus(): {
    initialized: boolean
    environment: EnvironmentCheck
    timestamp: number
  } {
    return {
      initialized: this.initialized,
      environment: this.checkElectronEnvironment(),
      timestamp: Date.now()
    }
  }

  /**
   * 创建兼容的旧版API
   */
  public createLegacyAPI(): {
    setUserConfigWithObj: (dict: Record<string, any>) => void
    getUserConfig: () => Promise<any>
  } {
    return {
      setUserConfigWithObj: (dict: Record<string, any>) => {
        // 兼容旧版本，直接调用不带错误处理
        console.log('Legacy setUserConfigWithObj:', dict)
        ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, dict)
      },
      getUserConfig: async () => {
        try {
          const result = await this.getUserConfig()
          return result.success ? result.data : null
        } catch (error) {
          console.error('Legacy getUserConfig error:', error)
          return null
        }
      }
    }
  }

  /**
   * 初始化API
   */
  public initialize(): void {
    if (this.initialized) {
      return
    }

    this.performEnvironmentCheck()
    this.initialized = true

    console.log('Enhanced ViewPreload API initialized:', {
      environment: this.environmentCheck,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.initialized = false
    this.environmentCheck = null
  }
}

// 导出单例实例
export const enhancedViewPreloadAPI = EnhancedViewPreloadAPI.getInstance()