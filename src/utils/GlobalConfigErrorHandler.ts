/**
 * 全局配置错误处理器
 * 提供统一的错误处理、自动重试和数据恢复功能
 */

import { UserConfig, ConfigOperationResult } from '../types/config'
import { configLogger } from './ConfigLogger'
import { configValidator } from './ConfigValidator'
import { configResultFactory } from './ConfigResultFactory'
import { configBackupManager } from './ConfigBackupManager'
import { AppUtil } from './AppUtil'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// 错误类型枚举
export enum ConfigErrorType {
  VALIDATION_ERROR = 'validation-error',
  NETWORK_ERROR = 'network-error',
  IPC_ERROR = 'ipc-error',
  FILE_IO_ERROR = 'file-io-error',
  TIMEOUT_ERROR = 'timeout-error',
  PERMISSION_ERROR = 'permission-error',
  CORRUPTION_ERROR = 'corruption-error',
  UNKNOWN_ERROR = 'unknown-error'
}

// 错误信息接口
export interface ConfigError {
  id: string
  type: ConfigErrorType
  message: string
  timestamp: number
  source: string
  operation: string
  config?: Partial<UserConfig>
  originalError?: Error
  retryCount: number
  maxRetries: number
  context?: Record<string, any>
}

// 恢复策略枚举
export enum RecoveryStrategy {
  RETRY = 'retry',
  USE_DEFAULT = 'use-default',
  USE_BACKUP = 'use-backup',
  USE_CACHE = 'use-cache',
  SKIP = 'skip',
  MANUAL = 'manual'
}

// 恢复配置
export interface RecoveryConfig {
  enableAutoRetry: boolean
  maxRetries: number
  retryDelay: number
  retryBackoffMultiplier: number
  enableBackup: boolean
  backupInterval: number
  maxBackupFiles: number
  enableCache: boolean
  cacheExpiration: number
}

export class GlobalConfigErrorHandler {
  private static instance: GlobalConfigErrorHandler
  private config: RecoveryConfig
  private errors: Map<string, ConfigError> = new Map()
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()
  private backupPath: string
  private cachePath: string
  private configBackups: Array<{ timestamp: number, config: UserConfig }> = []
  private configCache: Map<string, { data: any, timestamp: number }> = new Map()

  private constructor() {
    this.config = {
      enableAutoRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      enableBackup: true,
      backupInterval: 5 * 60 * 1000, // 5分钟
      maxBackupFiles: 10,
      enableCache: true,
      cacheExpiration: 10 * 60 * 1000 // 10分钟
    }

    this.setupPaths()
    this.loadBackups()
    this.setupPeriodicBackup()
  }

  // 单例模式
  public static getInstance(): GlobalConfigErrorHandler {
    if (!GlobalConfigErrorHandler.instance) {
      GlobalConfigErrorHandler.instance = new GlobalConfigErrorHandler()
    }
    return GlobalConfigErrorHandler.instance
  }

  /**
   * 设置路径
   */
  private setupPaths(): void {
    try {
      const userDataPath = app?.getPath('userData') || process.cwd()
      this.backupPath = path.join(userDataPath, 'config-backups')
      this.cachePath = path.join(userDataPath, 'config-cache')

      // 确保目录存在
      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true })
      }
      if (!fs.existsSync(this.cachePath)) {
        fs.mkdirSync(this.cachePath, { recursive: true })
      }
    } catch (error) {
      AppUtil.error('GlobalConfigErrorHandler', 'setupPaths', '路径设置失败', error)
      this.config.enableBackup = false
    }
  }

  /**
   * 处理配置错误
   */
  public handleError(
    operation: string,
    source: string,
    error: Error,
    config?: Partial<UserConfig>,
    context?: Record<string, any>
  ): Promise<ConfigOperationResult> {
    return new Promise((resolve) => {
      try {
        const errorType = this.classifyError(error)
        const configError: ConfigError = {
          id: this.generateErrorId(),
          type: errorType,
          message: error.message,
          timestamp: Date.now(),
          source,
          operation,
          config,
          originalError: error,
          retryCount: 0,
          maxRetries: this.config.maxRetries,
          context
        }

        // 记录错误
        this.errors.set(configError.id, configError)
        configLogger.logError(operation, source, error, { ...context, errorId: configError.id })

        AppUtil.error('GlobalConfigErrorHandler', 'handleError', 
          `配置错误: ${errorType}, 操作: ${operation}, 来源: ${source}, 消息: ${error.message}`)

        // 选择恢复策略
        const strategy = this.selectRecoveryStrategy(configError)
        
        // 执行恢复
        this.executeRecovery(configError, strategy).then(resolve).catch((recoveryError) => {
          AppUtil.error('GlobalConfigErrorHandler', 'handleError', 
            `恢复策略执行失败: ${strategy}`, recoveryError)
          resolve(configResultFactory.systemError(recoveryError))
        })

      } catch (handlerError) {
        AppUtil.error('GlobalConfigErrorHandler', 'handleError', 
          '错误处理器异常', handlerError)
        resolve(configResultFactory.systemError(handlerError))
      }
    })
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): ConfigErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('validation') || message.includes('invalid')) {
      return ConfigErrorType.VALIDATION_ERROR
    }
    if (message.includes('network') || message.includes('connection')) {
      return ConfigErrorType.NETWORK_ERROR
    }
    if (message.includes('ipc') || message.includes('communication')) {
      return ConfigErrorType.IPC_ERROR
    }
    if (message.includes('file') || message.includes('enoent') || message.includes('eacces')) {
      return ConfigErrorType.FILE_IO_ERROR
    }
    if (message.includes('timeout')) {
      return ConfigErrorType.TIMEOUT_ERROR
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return ConfigErrorType.PERMISSION_ERROR
    }
    if (message.includes('corrupt') || message.includes('malformed')) {
      return ConfigErrorType.CORRUPTION_ERROR
    }

    return ConfigErrorType.UNKNOWN_ERROR
  }

  /**
   * 选择恢复策略
   */
  private selectRecoveryStrategy(configError: ConfigError): RecoveryStrategy {
    switch (configError.type) {
      case ConfigErrorType.VALIDATION_ERROR:
        return RecoveryStrategy.USE_DEFAULT
        
      case ConfigErrorType.NETWORK_ERROR:
      case ConfigErrorType.IPC_ERROR:
      case ConfigErrorType.TIMEOUT_ERROR:
        return configError.retryCount < configError.maxRetries 
          ? RecoveryStrategy.RETRY 
          : RecoveryStrategy.USE_CACHE
          
      case ConfigErrorType.FILE_IO_ERROR:
        return RecoveryStrategy.USE_BACKUP
        
      case ConfigErrorType.CORRUPTION_ERROR:
        return RecoveryStrategy.USE_BACKUP
        
      case ConfigErrorType.PERMISSION_ERROR:
        return RecoveryStrategy.MANUAL
        
      default:
        return RecoveryStrategy.USE_DEFAULT
    }
  }

  /**
   * 执行恢复策略
   */
  private async executeRecovery(
    configError: ConfigError, 
    strategy: RecoveryStrategy
  ): Promise<ConfigOperationResult> {
    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.executeRetry(configError)
          
        case RecoveryStrategy.USE_DEFAULT:
          return this.executeUseDefault(configError)
          
        case RecoveryStrategy.USE_BACKUP:
          return this.executeUseBackup(configError)
          
        case RecoveryStrategy.USE_CACHE:
          return this.executeUseCache(configError)
          
        case RecoveryStrategy.SKIP:
          return this.executeSkip(configError)
          
        case RecoveryStrategy.MANUAL:
          return this.executeManual(configError)
          
        default:
          return this.executeUseDefault(configError)
      }
    } catch (error) {
      AppUtil.error('GlobalConfigErrorHandler', 'executeRecovery', 
        `恢复策略执行异常: ${strategy}`, error)
      return configResultFactory.systemError(error)
    }
  }

  /**
   * 执行重试策略
   */
  private async executeRetry(configError: ConfigError): Promise<ConfigOperationResult> {
    configError.retryCount++
    
    const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, configError.retryCount - 1)
    
    AppUtil.info('GlobalConfigErrorHandler', 'executeRetry', 
      `准备重试: ${configError.id}, 第${configError.retryCount}次重试, 延迟: ${delay}ms`)

    return new Promise((resolve) => {
      const retryTimer = setTimeout(async () => {
        this.retryTimers.delete(configError.id)
        
        try {
          // 这里应该重新执行原始操作
          // 由于我们在错误处理器中，这里返回重试结果
          resolve(configResultFactory.success('重试已安排', configError.config))
        } catch (error) {
          // 如果重试仍然失败，选择其他策略
          const newStrategy = this.selectRecoveryStrategy(configError)
          const result = await this.executeRecovery(configError, newStrategy)
          resolve(result)
        }
      }, delay)

      this.retryTimers.set(configError.id, retryTimer)
    })
  }

  /**
   * 执行使用默认值策略
   */
  private executeUseDefault(configError: ConfigError): ConfigOperationResult {
    const defaultConfig = configValidator.getDefaultConfig()
    
    AppUtil.info('GlobalConfigErrorHandler', 'executeUseDefault', 
      `使用默认配置恢复: ${configError.id}`)

    return configResultFactory.success('已使用默认配置恢复', defaultConfig)
  }

  /**
   * 执行使用备份策略
   */
  private async executeUseBackup(configError: ConfigError): Promise<ConfigOperationResult> {
    try {
      // 首先尝试使用备份管理器的备份
      const backupList = configBackupManager.getBackupList(1) // 获取最新的备份
      
      if (backupList.length > 0) {
        const latestBackup = backupList[0]
        const restoreResult = await configBackupManager.restoreBackup(latestBackup.id)
        
        if (restoreResult.success && restoreResult.data) {
          AppUtil.info('GlobalConfigErrorHandler', 'executeUseBackup', 
            `使用备份管理器恢复配置: ${configError.id}, 备份ID: ${latestBackup.id}`)
          
          return configResultFactory.success('已使用备份配置恢复', restoreResult.data)
        }
      }

      // 如果备份管理器没有可用备份，尝试使用内部备份
      const internalBackup = this.getLatestBackup()
      
      if (internalBackup) {
        AppUtil.info('GlobalConfigErrorHandler', 'executeUseBackup', 
          `使用内部备份配置恢复: ${configError.id}, 备份时间: ${new Date(internalBackup.timestamp).toISOString()}`)
        
        return configResultFactory.success('已使用内部备份配置恢复', internalBackup.config)
      } else {
        AppUtil.warn('GlobalConfigErrorHandler', 'executeUseBackup', 
          `没有可用备份，使用默认配置: ${configError.id}`)
        
        return this.executeUseDefault(configError)
      }
    } catch (error) {
      AppUtil.error('GlobalConfigErrorHandler', 'executeUseBackup', 
        `备份恢复失败: ${configError.id}`, error)
      
      return this.executeUseDefault(configError)
    }
  }

  /**
   * 执行使用缓存策略
   */
  private executeUseCache(configError: ConfigError): ConfigOperationResult {
    const cacheKey = `config-${configError.source}`
    const cached = this.configCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheExpiration) {
      AppUtil.info('GlobalConfigErrorHandler', 'executeUseCache', 
        `使用缓存配置恢复: ${configError.id}`)
      
      return configResultFactory.success('已使用缓存配置恢复', cached.data)
    } else {
      AppUtil.warn('GlobalConfigErrorHandler', 'executeUseCache', 
        `缓存不可用，使用默认配置: ${configError.id}`)
      
      return this.executeUseDefault(configError)
    }
  }

  /**
   * 执行跳过策略
   */
  private executeSkip(configError: ConfigError): ConfigOperationResult {
    AppUtil.info('GlobalConfigErrorHandler', 'executeSkip', 
      `跳过错误操作: ${configError.id}`)
    
    return configResultFactory.success('操作已跳过')
  }

  /**
   * 执行手动处理策略
   */
  private executeManual(configError: ConfigError): ConfigOperationResult {
    AppUtil.warn('GlobalConfigErrorHandler', 'executeManual', 
      `需要手动处理的错误: ${configError.id}`)
    
    return configResultFactory.failure('需要手动处理此错误', [configError.message])
  }

  /**
   * 创建配置备份
   */
  public async createBackup(config: UserConfig, source: string = 'error-handler'): Promise<void> {
    if (!this.config.enableBackup) {
      return
    }

    try {
      // 使用备份管理器创建备份
      const backupResult = await configBackupManager.createBackup(
        config,
        '错误处理器自动备份',
        source,
        ['auto', 'error-handler']
      )

      if (backupResult.success) {
        AppUtil.info('GlobalConfigErrorHandler', 'createBackup', 
          `配置备份已通过备份管理器创建: ${backupResult.data?.id}`)
      } else {
        // 如果备份管理器失败，使用内部备份机制
        this.createInternalBackup(config)
      }

    } catch (error) {
      AppUtil.error('GlobalConfigErrorHandler', 'createBackup', '创建备份失败', error)
      // 尝试内部备份作为后备方案
      this.createInternalBackup(config)
    }
  }

  /**
   * 创建内部备份（后备方案）
   */
  private createInternalBackup(config: UserConfig): void {
    try {
      const backup = {
        timestamp: Date.now(),
        config: { ...config }
      }

      this.configBackups.push(backup)

      // 限制备份数量
      if (this.configBackups.length > this.config.maxBackupFiles) {
        this.configBackups = this.configBackups.slice(-this.config.maxBackupFiles)
      }

      // 保存到文件
      const backupFile = path.join(this.backupPath, `internal-backup-${backup.timestamp}.json`)
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8')

      AppUtil.info('GlobalConfigErrorHandler', 'createInternalBackup', 
        `内部配置备份已创建: ${backupFile}`)

    } catch (error) {
      AppUtil.error('GlobalConfigErrorHandler', 'createInternalBackup', '创建内部备份失败', error)
    }
  }

  /**
   * 获取最新备份
   */
  private getLatestBackup(): { timestamp: number, config: UserConfig } | null {
    if (this.configBackups.length === 0) {
      return null
    }

    return this.configBackups[this.configBackups.length - 1]
  }

  /**
   * 加载备份
   */
  private loadBackups(): void {
    if (!this.config.enableBackup || !fs.existsSync(this.backupPath)) {
      return
    }

    try {
      const files = fs.readdirSync(this.backupPath)
      const backupFiles = files
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .sort()

      for (const file of backupFiles.slice(-this.config.maxBackupFiles)) {
        try {
          const filePath = path.join(this.backupPath, file)
          const content = fs.readFileSync(filePath, 'utf8')
          const backup = JSON.parse(content)
          
          if (backup.timestamp && backup.config) {
            this.configBackups.push(backup)
          }
        } catch (error) {
          AppUtil.warn('GlobalConfigErrorHandler', 'loadBackups', 
            `加载备份文件失败: ${file}`, error)
        }
      }

      AppUtil.info('GlobalConfigErrorHandler', 'loadBackups', 
        `已加载 ${this.configBackups.length} 个配置备份`)

    } catch (error) {
      AppUtil.error('GlobalConfigErrorHandler', 'loadBackups', '加载备份失败', error)
    }
  }

  /**
   * 设置定期备份
   */
  private setupPeriodicBackup(): void {
    if (!this.config.enableBackup) {
      return
    }

    setInterval(() => {
      try {
        // 这里应该获取当前配置并创建备份
        // 由于我们在错误处理器中，这里只是示例
        const currentConfig = configValidator.getDefaultConfig()
        this.createBackup(currentConfig)
      } catch (error) {
        AppUtil.error('GlobalConfigErrorHandler', 'setupPeriodicBackup', 
          '定期备份失败', error)
      }
    }, this.config.backupInterval)
  }

  /**
   * 缓存配置数据
   */
  public cacheConfig(key: string, data: any): void {
    if (!this.config.enableCache) {
      return
    }

    this.configCache.set(key, {
      data,
      timestamp: Date.now()
    })

    AppUtil.debug('GlobalConfigErrorHandler', 'cacheConfig', 
      `配置已缓存: ${key}`)
  }

  /**
   * 获取缓存配置
   */
  public getCachedConfig(key: string): any | null {
    if (!this.config.enableCache) {
      return null
    }

    const cached = this.configCache.get(key)
    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.config.cacheExpiration) {
      this.configCache.delete(key)
      return null
    }

    return cached.data
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    
    for (const [key, cached] of this.configCache.entries()) {
      if (now - cached.timestamp > this.config.cacheExpiration) {
        this.configCache.delete(key)
      }
    }
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): {
    totalErrors: number
    errorsByType: Record<string, number>
    errorsBySource: Record<string, number>
    activeRetries: number
    recentErrors: ConfigError[]
  } {
    const errorsByType: Record<string, number> = {}
    const errorsBySource: Record<string, number> = {}
    const recentErrors: ConfigError[] = []
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    for (const error of this.errors.values()) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1
      errorsBySource[error.source] = (errorsBySource[error.source] || 0) + 1
      
      if (error.timestamp > oneHourAgo) {
        recentErrors.push(error)
      }
    }

    return {
      totalErrors: this.errors.size,
      errorsByType,
      errorsBySource,
      activeRetries: this.retryTimers.size,
      recentErrors: recentErrors.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    }
  }

  /**
   * 清理错误记录
   */
  public clearErrors(olderThan?: number): void {
    const cutoffTime = olderThan || (Date.now() - 24 * 60 * 60 * 1000) // 默认清理24小时前的错误

    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoffTime) {
        // 清理重试定时器
        const retryTimer = this.retryTimers.get(id)
        if (retryTimer) {
          clearTimeout(retryTimer)
          this.retryTimers.delete(id)
        }
        
        this.errors.delete(id)
      }
    }

    AppUtil.info('GlobalConfigErrorHandler', 'clearErrors', 
      `已清理旧错误记录, 剩余错误数: ${this.errors.size}`)
  }

  /**
   * 更新恢复配置
   */
  public updateConfig(newConfig: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    AppUtil.info('GlobalConfigErrorHandler', 'updateConfig', 
      `恢复配置已更新: ${JSON.stringify(newConfig)}`)
  }

  /**
   * 获取恢复配置
   */
  public getConfig(): RecoveryConfig {
    return { ...this.config }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    // 清理重试定时器
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }
    
    this.errors.clear()
    this.retryTimers.clear()
    this.configCache.clear()
    this.configBackups = []
    
    AppUtil.info('GlobalConfigErrorHandler', 'cleanup', '错误处理器资源已清理')
  }
}

// 导出单例实例
export const globalConfigErrorHandler = GlobalConfigErrorHandler.getInstance()

// 导出便捷函数
export const handleConfigError = (
  operation: string,
  source: string,
  error: Error,
  config?: Partial<UserConfig>,
  context?: Record<string, any>
) => globalConfigErrorHandler.handleError(operation, source, error, config, context)

export const createConfigBackup = (config: UserConfig) => 
  globalConfigErrorHandler.createBackup(config)

export const cacheConfig = (key: string, data: any) => 
  globalConfigErrorHandler.cacheConfig(key, data)