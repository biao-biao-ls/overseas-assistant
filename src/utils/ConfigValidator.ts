/**
 * 配置验证器
 * 提供配置数据的验证、清理和默认值处理功能
 */

import { UserConfig, ConfigValidationResult, CountryOption, LanguageOption, RateOption } from '../types/config'
import countryList from './countries.json'
import languageList from './languages.json'
import rateList from './rates.json'
import locales from './locales.json'

export class ConfigValidator {
  private static instance: ConfigValidator
  
  // 单例模式
  public static getInstance(): ConfigValidator {
    if (!ConfigValidator.instance) {
      ConfigValidator.instance = new ConfigValidator()
    }
    return ConfigValidator.instance
  }

  /**
   * 验证完整配置对象
   */
  public validateConfig(config: Partial<UserConfig>): ConfigValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!config || typeof config !== 'object') {
      errors.push('配置对象不能为空且必须是对象类型')
      return { isValid: false, errors, warnings }
    }

    // 验证用户信息
    if (config.username !== undefined && typeof config.username !== 'string') {
      errors.push('用户名必须是字符串类型')
    }

    if (config.customerCode !== undefined && typeof config.customerCode !== 'string') {
      errors.push('客户代码必须是字符串类型')
    }

    // 验证地区和语言设置
    if (config.country !== undefined) {
      if (typeof config.country !== 'string') {
        errors.push('国家配置必须是字符串类型')
      } else if (!this.isValidCountryUuid(config.country)) {
        warnings.push(`无效的国家UUID: ${config.country}`)
      }
    }

    if (config.language !== undefined) {
      if (typeof config.language !== 'string') {
        errors.push('语言配置必须是字符串类型')
      } else if (!this.isValidLanguageCode(config.language)) {
        warnings.push(`无效的语言代码: ${config.language}`)
      }
    }

    if (config.rate !== undefined) {
      if (typeof config.rate !== 'string') {
        errors.push('汇率配置必须是字符串类型')
      } else if (!this.isValidRateUuid(config.rate)) {
        warnings.push(`无效的汇率UUID: ${config.rate}`)
      }
    }

    // 验证布尔类型配置
    const booleanFields = [
      'hideToTask', 'autoStart', 'openOrderNotification', 
      'openMarketActivityNotification', 'openCoummunityMessageNotification',
      'virtualMachine', 'checkVirtualMachine', 'alertClose', 'alertEDA', 
      'closeOther', 'readAutoRun'
    ]

    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} 必须是布尔类型`)
      }
    }

    // 验证数组类型配置
    if (config.countryList !== undefined && !Array.isArray(config.countryList)) {
      errors.push('countryList 必须是数组类型')
    }

    if (config.languageList !== undefined && !Array.isArray(config.languageList)) {
      errors.push('languageList 必须是数组类型')
    }

    if (config.rateList !== undefined && !Array.isArray(config.rateList)) {
      errors.push('rateList 必须是数组类型')
    }

    // 验证代理设置
    if (config.proxyRules !== undefined && typeof config.proxyRules !== 'string') {
      errors.push('代理规则必须是字符串类型')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 验证单个配置字段
   */
  public validateField(key: keyof UserConfig, value: any): boolean {
    const tempConfig = { [key]: value } as Partial<UserConfig>
    const result = this.validateConfig(tempConfig)
    return result.isValid
  }

  /**
   * 获取默认配置
   */
  public getDefaultConfig(): UserConfig {
    return {
      platform: process.platform,
      virtualMachine: false,
      checkVirtualMachine: true,
      alertClose: false,
      alertEDA: false,
      closeOther: false,
      erpUrl: '',
      readAutoRun: false,
      hideToTask: process.platform === 'darwin' ? false : true,
      autoStart: false,
      openOrderNotification: true,
      openMarketActivityNotification: true,
      openCoummunityMessageNotification: true,
      country: '26B47E32-C4A1-4830-8B96-958A30897EA2',
      countryList: countryList as unknown as CountryOption[],
      language: 'en',
      languageList: languageList as unknown as LanguageOption[],
      rate: '36812d96-3345-471a-bb59-c0143dfa8836',
      rateList: rateList as unknown as RateOption[],
      username: '',
      customerCode: '',
      locales: locales,
      scale: {},
      downloadsPath: '',
      save_version: ''
    }
  }

  /**
   * 清理和标准化配置数据
   */
  public sanitizeConfig(config: any): Partial<UserConfig> {
    if (!config || typeof config !== 'object') {
      return {}
    }

    const sanitized: Partial<UserConfig> = {}
    const defaultConfig = this.getDefaultConfig()

    // 只保留已知的配置字段
    for (const key in defaultConfig) {
      if (config.hasOwnProperty(key)) {
        const value = config[key]
        
        // 根据字段类型进行清理
        switch (key) {
          case 'username':
          case 'customerCode':
          case 'country':
          case 'language':
          case 'rate':
          case 'proxyRules':
          case 'erpUrl':
          case 'downloadsPath':
          case 'save_version':
            if (typeof value === 'string') {
              sanitized[key] = value.trim()
            }
            break
            
          case 'hideToTask':
          case 'autoStart':
          case 'openOrderNotification':
          case 'openMarketActivityNotification':
          case 'openCoummunityMessageNotification':
          case 'virtualMachine':
          case 'checkVirtualMachine':
          case 'alertClose':
          case 'alertEDA':
          case 'closeOther':
          case 'readAutoRun':
            if (typeof value === 'boolean') {
              sanitized[key] = value
            }
            break
            
          case 'countryList':
          case 'languageList':
          case 'rateList':
            if (Array.isArray(value)) {
              sanitized[key] = value
            }
            break
            
          case 'locales':
          case 'scale':
            if (typeof value === 'object' && value !== null) {
              sanitized[key] = value
            }
            break
            
          default:
            // 对于其他字段，直接复制
            sanitized[key] = value
        }
      }
    }

    return sanitized
  }

  /**
   * 合并配置，新配置覆盖旧配置
   */
  public mergeConfigs(oldConfig: Partial<UserConfig>, newConfig: Partial<UserConfig>): Partial<UserConfig> {
    const merged = { ...oldConfig }
    
    for (const key in newConfig) {
      if (newConfig.hasOwnProperty(key) && newConfig[key] !== undefined) {
        merged[key] = newConfig[key]
      }
    }
    
    return merged
  }

  /**
   * 检测配置变更
   */
  public detectChanges(oldConfig: Partial<UserConfig>, newConfig: Partial<UserConfig>): Partial<UserConfig> {
    const changes: Partial<UserConfig> = {}
    
    for (const key in newConfig) {
      if (newConfig.hasOwnProperty(key)) {
        const oldValue = oldConfig[key]
        const newValue = newConfig[key]
        
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes[key] = newValue
        }
      }
    }
    
    return changes
  }

  /**
   * 验证国家UUID是否有效
   */
  private isValidCountryUuid(uuid: string): boolean {
    return (countryList as any[]).some((country: any) => country.cfg === uuid)
  }

  /**
   * 验证语言代码是否有效
   */
  private isValidLanguageCode(code: string): boolean {
    // "system" 是一个特殊的有效语言代码，表示跟随系统语言
    if (code === 'system') {
      return true
    }
    return (languageList as any[]).some((language: any) => language.cfg === code)
  }

  /**
   * 验证汇率UUID是否有效
   */
  private isValidRateUuid(uuid: string): boolean {
    return (rateList as any[]).some((rate: any) => rate.cfg === uuid)
  }

  /**
   * 获取配置字段的默认值
   */
  public getFieldDefaultValue(key: keyof UserConfig): any {
    const defaultConfig = this.getDefaultConfig()
    return defaultConfig[key]
  }

  /**
   * 检查配置是否包含关键字段
   */
  public hasRequiredFields(config: Partial<UserConfig>): boolean {
    const requiredFields = ['country', 'language', 'rate']
    return requiredFields.every(field => config.hasOwnProperty(field))
  }

  /**
   * 获取配置摘要（用于日志记录）
   */
  public getConfigSummary(config: Partial<UserConfig>): string {
    const summary = {
      country: config.country,
      language: config.language,
      rate: config.rate,
      username: config.username ? '***' : undefined,
      fieldsCount: Object.keys(config).length
    }
    return JSON.stringify(summary)
  }

  /**
   * 修复损坏的配置
   */
  public repairConfig(config: Partial<UserConfig>): Partial<UserConfig> {
    const repairedConfig = { ...config }
    const defaultConfig = this.getDefaultConfig()

    // 修复无效的国家配置
    if (repairedConfig.country && !this.isValidCountryUuid(repairedConfig.country)) {
      repairedConfig.country = defaultConfig.country
    }

    // 修复无效的语言配置
    if (repairedConfig.language && !this.isValidLanguageCode(repairedConfig.language)) {
      repairedConfig.language = defaultConfig.language
    }

    // 修复无效的汇率配置
    if (repairedConfig.rate && !this.isValidRateUuid(repairedConfig.rate)) {
      repairedConfig.rate = defaultConfig.rate
    }

    // 修复缺失的必要字段
    if (!repairedConfig.country) {
      repairedConfig.country = defaultConfig.country
    }
    if (!repairedConfig.language) {
      repairedConfig.language = defaultConfig.language
    }
    if (!repairedConfig.rate) {
      repairedConfig.rate = defaultConfig.rate
    }

    // 清理无效的数据类型
    if (repairedConfig.username && typeof repairedConfig.username !== 'string') {
      delete repairedConfig.username
    }
    if (repairedConfig.customerCode && typeof repairedConfig.customerCode !== 'string') {
      delete repairedConfig.customerCode
    }

    return repairedConfig
  }
}

// 导出单例实例
export const configValidator = ConfigValidator.getInstance()