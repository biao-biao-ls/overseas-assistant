/**
 * 配置兼容性管理器
 * 处理新旧配置格式的兼容性，确保向后兼容
 */

import { UserConfig } from '../types/config'
import { configLogger } from './ConfigLogger'
import { configValidator } from './ConfigValidator'

// 配置版本信息
export interface ConfigVersion {
  version: string
  timestamp: number
  description: string
}

// 配置迁移规则
export interface MigrationRule {
  fromVersion: string
  toVersion: string
  migrate: (oldConfig: any) => Partial<UserConfig>
  validate?: (config: any) => boolean
}

// 兼容性检查结果
export interface CompatibilityResult {
  isCompatible: boolean
  needsMigration: boolean
  currentVersion: string
  targetVersion: string
  issues: string[]
  warnings: string[]
}

// 迁移结果
export interface MigrationResult {
  success: boolean
  originalConfig: any
  migratedConfig: Partial<UserConfig>
  fromVersion: string
  toVersion: string
  appliedRules: string[]
  warnings: string[]
  errors: string[]
}

export class ConfigCompatibilityManager {
  private static instance: ConfigCompatibilityManager
  private currentVersion = '2.0.0'
  private migrationRules: Map<string, MigrationRule[]> = new Map()
  private deprecatedFields: Map<string, { since: string, replacement?: string, removeIn?: string }> = new Map()

  private constructor() {
    this.initializeMigrationRules()
    this.initializeDeprecatedFields()
  }

  // 单例模式
  public static getInstance(): ConfigCompatibilityManager {
    if (!ConfigCompatibilityManager.instance) {
      ConfigCompatibilityManager.instance = new ConfigCompatibilityManager()
    }
    return ConfigCompatibilityManager.instance
  }

  /**
   * 初始化迁移规则
   */
  private initializeMigrationRules(): void {
    // 从1.0.0到1.1.0的迁移
    this.addMigrationRule({
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      migrate: (oldConfig) => {
        const newConfig: Partial<UserConfig> = { ...oldConfig }
        
        // 重命名字段
        if ('lang' in oldConfig) {
          newConfig.language = oldConfig.lang
          delete (newConfig as any).lang
        }
        
        return newConfig
      }
    })

    // 从1.1.0到1.2.0的迁移
    this.addMigrationRule({
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      migrate: (oldConfig) => {
        const newConfig: Partial<UserConfig> = { ...oldConfig }
        
        // 添加默认值
        if (!('autoStart' in newConfig)) {
          newConfig.autoStart = false
        }
        
        return newConfig
      }
    })

    // 从1.2.0到2.0.0的迁移（重大版本更新）
    this.addMigrationRule({
      fromVersion: '1.2.0',
      toVersion: '2.0.0',
      migrate: (oldConfig) => {
        const newConfig: Partial<UserConfig> = {}
        
        // 保留兼容的字段
        const compatibleFields = ['country', 'language', 'rate', 'hideToTask', 'autoStart']
        compatibleFields.forEach(field => {
          if (field in oldConfig) {
            newConfig[field] = oldConfig[field]
          }
        })
        
        // 处理已移除的字段
        if ('oldTheme' in oldConfig) {
          configLogger.logWarning('migrate', 'ConfigCompatibilityManager', 
            '字段 oldTheme 已在2.0.0版本中移除')
        }
        
        return newConfig
      },
      validate: (config) => {
        // 验证迁移后的配置
        return configValidator.validateConfig(config).isValid
      }
    })
  }

  /**
   * 初始化已弃用字段
   */
  private initializeDeprecatedFields(): void {
    this.deprecatedFields.set('lang', {
      since: '1.1.0',
      replacement: 'language',
      removeIn: '2.0.0'
    })
    
    this.deprecatedFields.set('oldTheme', {
      since: '1.5.0',
      removeIn: '2.0.0'
    })
    
    this.deprecatedFields.set('legacyMode', {
      since: '1.8.0',
      removeIn: '2.1.0'
    })
  }

  /**
   * 添加迁移规则
   */
  public addMigrationRule(rule: MigrationRule): void {
    const key = `${rule.fromVersion}->${rule.toVersion}`
    
    if (!this.migrationRules.has(rule.fromVersion)) {
      this.migrationRules.set(rule.fromVersion, [])
    }
    
    this.migrationRules.get(rule.fromVersion)!.push(rule)
    
    configLogger.logDebug('addMigrationRule', 'ConfigCompatibilityManager',
      `添加迁移规则: ${key}`)
  }

  /**
   * 检查配置兼容性
   */
  public checkCompatibility(config: any, configVersion?: string): CompatibilityResult {
    const detectedVersion = configVersion || this.detectConfigVersion(config)
    const issues: string[] = []
    const warnings: string[] = []
    
    try {
      // 检查版本兼容性
      const isCompatible = this.isVersionCompatible(detectedVersion)
      const needsMigration = detectedVersion !== this.currentVersion
      
      // 检查已弃用字段
      this.checkDeprecatedFields(config, warnings)
      
      // 检查不支持的字段
      this.checkUnsupportedFields(config, issues)
      
      // 检查数据类型兼容性
      this.checkTypeCompatibility(config, issues)
      
      return {
        isCompatible,
        needsMigration,
        currentVersion: detectedVersion,
        targetVersion: this.currentVersion,
        issues,
        warnings
      }
      
    } catch (error) {
      configLogger.logError('checkCompatibility', 'ConfigCompatibilityManager', error)
      
      return {
        isCompatible: false,
        needsMigration: true,
        currentVersion: detectedVersion,
        targetVersion: this.currentVersion,
        issues: [`兼容性检查失败: ${error.message}`],
        warnings
      }
    }
  }

  /**
   * 迁移配置
   */
  public async migrateConfig(config: any, fromVersion?: string): Promise<MigrationResult> {
    const startVersion = fromVersion || this.detectConfigVersion(config)
    const appliedRules: string[] = []
    const warnings: string[] = []
    const errors: string[] = []
    
    try {
      let currentConfig = { ...config }
      let currentVersion = startVersion
      
      configLogger.logDebug('migrateConfig', 'ConfigCompatibilityManager',
        `开始配置迁移: ${startVersion} -> ${this.currentVersion}`)
      
      // 获取迁移路径
      const migrationPath = this.getMigrationPath(startVersion, this.currentVersion)
      
      if (migrationPath.length === 0) {
        // 无需迁移
        return {
          success: true,
          originalConfig: config,
          migratedConfig: currentConfig,
          fromVersion: startVersion,
          toVersion: this.currentVersion,
          appliedRules: [],
          warnings: ['配置已是最新版本，无需迁移'],
          errors: []
        }
      }
      
      // 逐步应用迁移规则
      for (const rule of migrationPath) {
        try {
          const ruleKey = `${rule.fromVersion}->${rule.toVersion}`
          
          // 验证迁移前配置（如果有验证函数）
          if (rule.validate && !rule.validate(currentConfig)) {
            throw new Error(`迁移前配置验证失败: ${ruleKey}`)
          }
          
          // 应用迁移
          const migratedConfig = rule.migrate(currentConfig)
          
          // 合并迁移结果
          currentConfig = { ...currentConfig, ...migratedConfig }
          currentVersion = rule.toVersion
          appliedRules.push(ruleKey)
          
          configLogger.logDebug('migrateConfig', 'ConfigCompatibilityManager',
            `应用迁移规则: ${ruleKey}`, { 
              before: Object.keys(config),
              after: Object.keys(currentConfig)
            })
          
        } catch (error) {
          errors.push(`迁移规则 ${rule.fromVersion}->${rule.toVersion} 失败: ${error.message}`)
          configLogger.logError('migrateConfig', 'ConfigCompatibilityManager', error, {
            rule: `${rule.fromVersion}->${rule.toVersion}`
          })
        }
      }
      
      // 最终验证
      const validation = configValidator.validateConfig(currentConfig)
      if (!validation.isValid) {
        warnings.push(`迁移后配置验证警告: ${validation.errors.join(', ')}`)
      }
      
      // 检查已弃用字段
      this.checkDeprecatedFields(currentConfig, warnings)
      
      const success = errors.length === 0
      
      configLogger.logInfo('migrateConfig', 'ConfigCompatibilityManager',
        `配置迁移${success ? '成功' : '失败'}`, {
          fromVersion: startVersion,
          toVersion: currentVersion,
          appliedRules: appliedRules.length,
          warnings: warnings.length,
          errors: errors.length
        })
      
      return {
        success,
        originalConfig: config,
        migratedConfig: currentConfig,
        fromVersion: startVersion,
        toVersion: currentVersion,
        appliedRules,
        warnings,
        errors
      }
      
    } catch (error) {
      configLogger.logError('migrateConfig', 'ConfigCompatibilityManager', error)
      
      return {
        success: false,
        originalConfig: config,
        migratedConfig: config,
        fromVersion: startVersion,
        toVersion: startVersion,
        appliedRules,
        warnings,
        errors: [`迁移过程异常: ${error.message}`]
      }
    }
  }

  /**
   * 检测配置版本
   */
  public detectConfigVersion(config: any): string {
    // 如果配置中有版本信息
    if (config._version) {
      return config._version
    }
    
    // 根据字段特征推断版本
    if ('lang' in config && !('language' in config)) {
      return '1.0.0' // 使用旧的lang字段
    }
    
    if ('language' in config && !('autoStart' in config)) {
      return '1.1.0' // 有language但没有autoStart
    }
    
    if ('autoStart' in config && 'oldTheme' in config) {
      return '1.2.0' // 有autoStart和已弃用的oldTheme
    }
    
    // 默认为当前版本
    return this.currentVersion
  }

  /**
   * 检查版本兼容性
   */
  private isVersionCompatible(version: string): boolean {
    try {
      const [major, minor, patch] = version.split('.').map(Number)
      const [currentMajor] = this.currentVersion.split('.').map(Number)
      
      // 主版本号相同或更低才兼容
      return major <= currentMajor
      
    } catch (error) {
      configLogger.logWarning('isVersionCompatible', 'ConfigCompatibilityManager',
        `版本格式无效: ${version}`)
      return false
    }
  }

  /**
   * 获取迁移路径
   */
  private getMigrationPath(fromVersion: string, toVersion: string): MigrationRule[] {
    if (fromVersion === toVersion) {
      return []
    }
    
    const path: MigrationRule[] = []
    let currentVersion = fromVersion
    
    // 简单的线性迁移路径查找
    while (currentVersion !== toVersion) {
      const rules = this.migrationRules.get(currentVersion)
      if (!rules || rules.length === 0) {
        configLogger.logWarning('getMigrationPath', 'ConfigCompatibilityManager',
          `找不到从版本 ${currentVersion} 的迁移规则`)
        break
      }
      
      // 选择第一个可用的迁移规则
      const rule = rules[0]
      path.push(rule)
      currentVersion = rule.toVersion
      
      // 防止无限循环
      if (path.length > 10) {
        configLogger.logError('getMigrationPath', 'ConfigCompatibilityManager',
          new Error('迁移路径过长，可能存在循环'))
        break
      }
    }
    
    return path
  }

  /**
   * 检查已弃用字段
   */
  private checkDeprecatedFields(config: any, warnings: string[]): void {
    for (const [field, info] of this.deprecatedFields.entries()) {
      if (field in config) {
        let warning = `字段 '${field}' 已在版本 ${info.since} 中弃用`
        
        if (info.replacement) {
          warning += `，请使用 '${info.replacement}' 替代`
        }
        
        if (info.removeIn) {
          warning += `，将在版本 ${info.removeIn} 中移除`
        }
        
        warnings.push(warning)
      }
    }
  }

  /**
   * 检查不支持的字段
   */
  private checkUnsupportedFields(config: any, issues: string[]): void {
    const supportedFields = new Set([
      'country', 'language', 'rate', 'hideToTask', 'autoStart',
      '_version', '_timestamp' // 元数据字段
    ])
    
    for (const field of Object.keys(config)) {
      if (!supportedFields.has(field) && !this.deprecatedFields.has(field)) {
        issues.push(`不支持的字段: '${field}'`)
      }
    }
  }

  /**
   * 检查类型兼容性
   */
  private checkTypeCompatibility(config: any, issues: string[]): void {
    const typeChecks = {
      country: 'string',
      language: 'string',
      rate: 'string',
      hideToTask: 'boolean',
      autoStart: 'boolean'
    }
    
    for (const [field, expectedType] of Object.entries(typeChecks)) {
      if (field in config && typeof config[field] !== expectedType) {
        issues.push(`字段 '${field}' 类型不匹配，期望 ${expectedType}，实际 ${typeof config[field]}`)
      }
    }
  }

  /**
   * 创建向后兼容的配置包装器
   */
  public createCompatibilityWrapper(config: Partial<UserConfig>): any {
    const wrapper = { ...config }
    
    // 添加版本信息
    wrapper._version = this.currentVersion
    wrapper._timestamp = Date.now()
    
    // 为向后兼容添加已弃用字段的别名
    if (config.language && !wrapper.lang) {
      wrapper.lang = config.language // 向后兼容
    }
    
    return wrapper
  }

  /**
   * 清理配置中的兼容性字段
   */
  public cleanupCompatibilityFields(config: any): Partial<UserConfig> {
    const cleaned = { ...config }
    
    // 移除元数据字段
    delete cleaned._version
    delete cleaned._timestamp
    
    // 移除已弃用字段
    for (const field of this.deprecatedFields.keys()) {
      delete cleaned[field]
    }
    
    return cleaned
  }

  /**
   * 获取当前版本
   */
  public getCurrentVersion(): string {
    return this.currentVersion
  }

  /**
   * 获取支持的版本列表
   */
  public getSupportedVersions(): string[] {
    const versions = new Set([this.currentVersion])
    
    // 收集所有迁移规则中的版本
    for (const rules of this.migrationRules.values()) {
      rules.forEach(rule => {
        versions.add(rule.fromVersion)
        versions.add(rule.toVersion)
      })
    }
    
    return Array.from(versions).sort()
  }

  /**
   * 获取已弃用字段信息
   */
  public getDeprecatedFields(): Map<string, { since: string, replacement?: string, removeIn?: string }> {
    return new Map(this.deprecatedFields)
  }

  /**
   * 获取迁移规则信息
   */
  public getMigrationRules(): Array<{ from: string, to: string, description?: string }> {
    const rules: Array<{ from: string, to: string, description?: string }> = []
    
    for (const [fromVersion, ruleList] of this.migrationRules.entries()) {
      ruleList.forEach(rule => {
        rules.push({
          from: rule.fromVersion,
          to: rule.toVersion,
          description: `从 ${rule.fromVersion} 迁移到 ${rule.toVersion}`
        })
      })
    }
    
    return rules
  }

  /**
   * 验证配置是否需要迁移
   */
  public needsMigration(config: any): boolean {
    const version = this.detectConfigVersion(config)
    return version !== this.currentVersion
  }

  /**
   * 获取配置兼容性报告
   */
  public getCompatibilityReport(config: any): {
    version: string
    isLatest: boolean
    isCompatible: boolean
    deprecatedFields: string[]
    unsupportedFields: string[]
    migrationPath: string[]
    recommendations: string[]
  } {
    const version = this.detectConfigVersion(config)
    const compatibility = this.checkCompatibility(config, version)
    const migrationPath = this.getMigrationPath(version, this.currentVersion)
    
    const deprecatedFields = Object.keys(config).filter(field => 
      this.deprecatedFields.has(field)
    )
    
    const supportedFields = new Set([
      'country', 'language', 'rate', 'hideToTask', 'autoStart'
    ])
    const unsupportedFields = Object.keys(config).filter(field => 
      !supportedFields.has(field) && !this.deprecatedFields.has(field) && !field.startsWith('_')
    )
    
    const recommendations: string[] = []
    
    if (compatibility.needsMigration) {
      recommendations.push(`建议将配置从版本 ${version} 升级到 ${this.currentVersion}`)
    }
    
    if (deprecatedFields.length > 0) {
      recommendations.push(`建议移除已弃用字段: ${deprecatedFields.join(', ')}`)
    }
    
    if (unsupportedFields.length > 0) {
      recommendations.push(`建议移除不支持字段: ${unsupportedFields.join(', ')}`)
    }
    
    return {
      version,
      isLatest: version === this.currentVersion,
      isCompatible: compatibility.isCompatible,
      deprecatedFields,
      unsupportedFields,
      migrationPath: migrationPath.map(rule => `${rule.fromVersion}->${rule.toVersion}`),
      recommendations
    }
  }
}

// 导出单例实例
export const configCompatibilityManager = ConfigCompatibilityManager.getInstance()

// 导出便捷函数
export const checkConfigCompatibility = (config: any, version?: string) =>
  configCompatibilityManager.checkCompatibility(config, version)

export const migrateConfig = (config: any, fromVersion?: string) =>
  configCompatibilityManager.migrateConfig(config, fromVersion)

export const needsConfigMigration = (config: any) =>
  configCompatibilityManager.needsMigration(config)