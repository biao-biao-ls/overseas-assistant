/**
 * 遗留配置API包装器
 * 提供向后兼容的配置接口，确保现有代码继续工作
 */

import { UserConfig, ConfigOperationResult } from '../types/config'
import { ConfigStateManager } from './ConfigStateManager'
import { ConfigCompatibilityManager } from './ConfigCompatibilityManager'
import { configLogger } from './ConfigLogger'

// 遗留配置接口（1.x版本）
export interface LegacyUserConfig {
  country?: string
  lang?: string // 已弃用，使用language
  language?: string
  rate?: string
  hideToTask?: boolean
  autoStart?: boolean
  oldTheme?: string // 已弃用
  [key: string]: any
}

// 遗留API响应格式
export interface LegacyApiResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

export class LegacyConfigAPI {
  private static instance: LegacyConfigAPI
  private configStateManager: ConfigStateManager
  private configCompatibilityManager: ConfigCompatibilityManager

  private constructor() {
    this.configStateManager = ConfigStateManager.getInstance()
    this.configCompatibilityManager = ConfigCompatibilityManager.getInstance()
  }

  // 单例模式
  public static getInstance(): LegacyConfigAPI {
    if (!LegacyConfigAPI.instance) {
      LegacyConfigAPI.instance = new LegacyConfigAPI()
    }
    return LegacyConfigAPI.instance
  }

  /**
   * 遗留的获取配置方法（同步）
   * @deprecated 使用 configStateManager.getConfig() 替代
   */
  public getUserConfig(): LegacyUserConfig {
    try {
      const currentConfig = this.configStateManager.getConfig()
      const legacyConfig = this.convertToLegacyFormat(currentConfig)
      
      configLogger.logWarning('getUserConfig', 'LegacyConfigAPI',
        '使用了已弃用的同步配置获取方法')
      
      return legacyConfig
    } catch (error) {
      configLogger.logError('getUserConfig', 'LegacyConfigAPI', error)
      return {}
    }
  }

  /**
   * 遗留的设置配置方法（同步）
   * @deprecated 使用 configStateManager.updateConfig() 替代
   */
  public setUserConfig(config: LegacyUserConfig): boolean {
    try {
      configLogger.logWarning('setUserConfig', 'LegacyConfigAPI',
        '使用了已弃用的同步配置设置方法', { config })
      
      // 转换为新格式
      const modernConfig = this.convertFromLegacyFormat(config)
      
      // 异步调用但返回同步结果（不推荐）
      const result = this.configStateManager.updateConfig(modernConfig)
      if (!result.success) {
        configLogger.logError('setUserConfig', 'LegacyConfigAPI',
          new Error(result.errors?.join(', ') || '配置更新失败'))
      }
      
      return true // 遗留API总是返回true
      
    } catch (error) {
      configLogger.logError('setUserConfig', 'LegacyConfigAPI', error)
      return false
    }
  }

  /**
   * 遗留的异步获取配置方法
   * @deprecated 使用 configStateManager.getConfig() 替代
   */
  public async getUserConfigAsync(): Promise<LegacyApiResponse> {
    try {
      const currentConfig = this.configStateManager.getConfig()
      const legacyConfig = this.convertToLegacyFormat(currentConfig)
      
      configLogger.logWarning('getUserConfigAsync', 'LegacyConfigAPI',
        '使用了已弃用的异步配置获取方法')
      
      return {
        success: true,
        data: legacyConfig,
        message: 'Configuration retrieved successfully'
      }
      
    } catch (error: any) {
      configLogger.logError('getUserConfigAsync', 'LegacyConfigAPI', error)
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve configuration'
      }
    }
  }

  /**
   * 遗留的异步设置配置方法
   * @deprecated 使用 configStateManager.updateConfig() 替代
   */
  public async setUserConfigAsync(config: LegacyUserConfig): Promise<LegacyApiResponse> {
    try {
      configLogger.logWarning('setUserConfigAsync', 'LegacyConfigAPI',
        '使用了已弃用的异步配置设置方法', { config })
      
      // 检查兼容性
      const compatibility = this.configCompatibilityManager.checkCompatibility(config)
      if (!compatibility.isCompatible) {
        return {
          success: false,
          error: `配置不兼容: ${compatibility.issues.join(', ')}`,
          message: 'Configuration is not compatible'
        }
      }
      
      // 迁移配置（如果需要）
      let finalConfig = config
      if (compatibility.needsMigration) {
        const migration = await this.configCompatibilityManager.migrateConfig(config)
        if (!migration.success) {
          return {
            success: false,
            error: `配置迁移失败: ${migration.errors.join(', ')}`,
            message: 'Configuration migration failed'
          }
        }
        finalConfig = migration.migratedConfig
      }
      
      // 转换为新格式
      const modernConfig = this.convertFromLegacyFormat(finalConfig)
      
      // 更新配置
      const result = this.configStateManager.updateConfig(modernConfig)
      
      if (result.success) {
        return {
          success: true,
          data: this.convertToLegacyFormat(result.data || {}),
          message: 'Configuration updated successfully'
        }
      } else {
        return {
          success: false,
          error: result.errors?.join(', '),
          message: 'Failed to update configuration'
        }
      }
      
    } catch (error: any) {
      configLogger.logError('setUserConfigAsync', 'LegacyConfigAPI', error)
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to update configuration'
      }
    }
  }

  /**
   * 遗留的批量设置配置方法
   * @deprecated 使用 configStateManager.updateConfig() 替代
   */
  public async setUserConfigBatch(configs: LegacyUserConfig[]): Promise<LegacyApiResponse> {
    try {
      configLogger.logWarning('setUserConfigBatch', 'LegacyConfigAPI',
        '使用了已弃用的批量配置设置方法', { count: configs.length })
      
      const results: any[] = []
      const errors: string[] = []
      
      for (let i = 0; i < configs.length; i++) {
        const config = configs[i]
        try {
          const result = await this.setUserConfigAsync(config)
          results.push(result)
          
          if (!result.success) {
            errors.push(`配置 ${i}: ${result.error}`)
          }
        } catch (error: any) {
          errors.push(`配置 ${i}: ${error.message}`)
        }
      }
      
      const successCount = results.filter(r => r.success).length
      
      return {
        success: errors.length === 0,
        data: {
          total: configs.length,
          success: successCount,
          failed: configs.length - successCount,
          results
        },
        error: errors.length > 0 ? errors.join('; ') : undefined,
        message: `批量更新完成: ${successCount}/${configs.length} 成功`
      }
      
    } catch (error: any) {
      configLogger.logError('setUserConfigBatch', 'LegacyConfigAPI', error)
      
      return {
        success: false,
        error: error.message,
        message: 'Batch update failed'
      }
    }
  }

  /**
   * 遗留的配置重置方法
   * @deprecated 使用 configStateManager.resetConfig() 替代
   */
  public async resetUserConfig(): Promise<LegacyApiResponse> {
    try {
      configLogger.logWarning('resetUserConfig', 'LegacyConfigAPI',
        '使用了已弃用的配置重置方法')
      
      const result = await this.configStateManager.resetConfig()
      
      return {
        success: result.success,
        data: result.success ? this.convertToLegacyFormat(result.data || {}) : undefined,
        error: result.errors?.join(', '),
        message: result.success ? 'Configuration reset successfully' : 'Failed to reset configuration'
      }
      
    } catch (error: any) {
      configLogger.logError('resetUserConfig', 'LegacyConfigAPI', error)
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to reset configuration'
      }
    }
  }

  /**
   * 遗留的配置验证方法
   * @deprecated 使用 configValidator.validateConfig() 替代
   */
  public validateUserConfig(config: LegacyUserConfig): { valid: boolean, errors: string[] } {
    try {
      configLogger.logWarning('validateUserConfig', 'LegacyConfigAPI',
        '使用了已弃用的配置验证方法')
      
      const modernConfig = this.convertFromLegacyFormat(config)
      const validation = this.configCompatibilityManager.checkCompatibility(modernConfig)
      
      return {
        valid: validation.isCompatible,
        errors: [...validation.issues, ...validation.warnings]
      }
      
    } catch (error: any) {
      configLogger.logError('validateUserConfig', 'LegacyConfigAPI', error)
      
      return {
        valid: false,
        errors: [error.message]
      }
    }
  }

  /**
   * 转换为遗留格式
   */
  private convertToLegacyFormat(modernConfig: Partial<UserConfig>): LegacyUserConfig {
    const legacyConfig: LegacyUserConfig = { ...modernConfig }
    
    // 添加向后兼容字段
    if (modernConfig.language) {
      legacyConfig.lang = modernConfig.language // 向后兼容
    }
    
    return legacyConfig
  }

  /**
   * 从遗留格式转换
   */
  private convertFromLegacyFormat(legacyConfig: LegacyUserConfig): Partial<UserConfig> {
    const modernConfig: Partial<UserConfig> = {}
    
    // 复制兼容字段
    if (legacyConfig.country !== undefined) modernConfig.country = legacyConfig.country
    if (legacyConfig.rate !== undefined) modernConfig.rate = legacyConfig.rate
    if (legacyConfig.hideToTask !== undefined) modernConfig.hideToTask = legacyConfig.hideToTask
    if (legacyConfig.autoStart !== undefined) modernConfig.autoStart = legacyConfig.autoStart
    
    // 处理语言字段（优先使用新字段）
    if (legacyConfig.language !== undefined) {
      modernConfig.language = legacyConfig.language
    } else if (legacyConfig.lang !== undefined) {
      modernConfig.language = legacyConfig.lang
      configLogger.logWarning('convertFromLegacyFormat', 'LegacyConfigAPI',
        '使用了已弃用的 lang 字段，建议使用 language')
    }
    
    // 忽略已弃用字段
    if (legacyConfig.oldTheme !== undefined) {
      configLogger.logWarning('convertFromLegacyFormat', 'LegacyConfigAPI',
        '忽略已弃用的 oldTheme 字段')
    }
    
    return modernConfig
  }

  /**
   * 获取API使用统计
   */
  public getUsageStats(): {
    deprecatedCalls: number
    migrationCount: number
    compatibilityIssues: number
  } {
    // 这里可以实现统计逻辑
    return {
      deprecatedCalls: 0,
      migrationCount: 0,
      compatibilityIssues: 0
    }
  }

  /**
   * 获取迁移建议
   */
  public getMigrationSuggestions(): string[] {
    return [
      '建议使用 configStateManager.getConfig() 替代 getUserConfig()',
      '建议使用 configStateManager.updateConfig() 替代 setUserConfig()',
      '建议使用 language 字段替代已弃用的 lang 字段',
      '建议移除 oldTheme 等已弃用字段',
      '建议使用异步API以获得更好的性能和错误处理'
    ]
  }
}

// 导出单例实例
export const legacyConfigAPI = LegacyConfigAPI.getInstance()

// 导出遗留API函数（全局兼容）
export const getUserConfig = () => legacyConfigAPI.getUserConfig()
export const setUserConfig = (config: LegacyUserConfig) => legacyConfigAPI.setUserConfig(config)
export const getUserConfigAsync = () => legacyConfigAPI.getUserConfigAsync()
export const setUserConfigAsync = (config: LegacyUserConfig) => legacyConfigAPI.setUserConfigAsync(config)
export const resetUserConfig = () => legacyConfigAPI.resetUserConfig()
export const validateUserConfig = (config: LegacyUserConfig) => legacyConfigAPI.validateUserConfig(config)

// 兼容性警告
if (typeof window !== 'undefined') {
  // 在浏览器环境中添加全局方法（向后兼容）
  (window as any).getUserConfig = getUserConfig;
  (window as any).setUserConfig = setUserConfig;
  (window as any).getUserConfigAsync = getUserConfigAsync;
  (window as any).setUserConfigAsync = setUserConfigAsync;
  
  // 检测到遗留配置API的使用，建议迁移到新的配置管理系统
}