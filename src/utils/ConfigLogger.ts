/**
 * 配置变更日志系统
 * 记录所有配置变更操作，提供审计日志功能和性能监控
 */

import { UserConfig } from '../types/config'
import { AppUtil } from './AppUtil'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 日志条目接口
export interface ConfigLogEntry {
  id: string
  timestamp: number
  level: LogLevel
  operation: string
  source: string
  userId?: string
  sessionId?: string
  
  // 配置变更相关
  oldConfig?: Partial<UserConfig>
  newConfig?: Partial<UserConfig>
  changes?: Partial<UserConfig>
  
  // 操作结果
  success: boolean
  message?: string
  errors?: string[]
  
  // 性能信息
  duration?: number
  
  // 上下文信息
  context?: Record<string, any>
}

// 日志配置
export interface LoggerConfig {
  enabled: boolean
  level: LogLevel
  maxFileSize: number // bytes
  maxFiles: number
  logToFile: boolean
  logToConsole: boolean
  includeStackTrace: boolean
  enablePerformanceMonitoring: boolean
  sensitiveFields: string[]
}

// 性能统计
export interface PerformanceStats {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageDuration: number
  operationsByType: Record<string, number>
  errorsByType: Record<string, number>
}

export class ConfigLogger {
  private static instance: ConfigLogger
  private config: LoggerConfig
  private logEntries: ConfigLogEntry[] = []
  private logFilePath: string
  private currentLogFile: string
  private nextLogId = 1
  private sessionId: string
  private performanceStats: PerformanceStats

  private constructor() {
    this.config = {
      enabled: true,
      level: LogLevel.INFO,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      logToFile: true,
      logToConsole: true,
      includeStackTrace: false,
      enablePerformanceMonitoring: true,
      sensitiveFields: ['password', 'token', 'secret', 'key']
    }

    this.sessionId = this.generateSessionId()
    this.setupLogPaths()
    this.initializePerformanceStats()
  }

  // 单例模式
  public static getInstance(): ConfigLogger {
    if (!ConfigLogger.instance) {
      ConfigLogger.instance = new ConfigLogger()
    }
    return ConfigLogger.instance
  }

  /**
   * 设置日志路径
   */
  private setupLogPaths(): void {
    try {
      const userDataPath = app?.getPath('userData') || process.cwd()
      this.logFilePath = path.join(userDataPath, 'logs')
      
      // 确保日志目录存在
      if (!fs.existsSync(this.logFilePath)) {
        fs.mkdirSync(this.logFilePath, { recursive: true })
      }

      this.currentLogFile = path.join(this.logFilePath, `config-${this.getDateString()}.log`)
    } catch (error) {
      console.error('ConfigLogger: Failed to setup log paths:', error)
      this.config.logToFile = false
    }
  }

  /**
   * 初始化性能统计
   */
  private initializePerformanceStats(): void {
    this.performanceStats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      operationsByType: {},
      errorsByType: {}
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成日志ID
   */
  private generateLogId(): string {
    return `log-${this.nextLogId++}-${Date.now()}`
  }

  /**
   * 获取日期字符串
   */
  private getDateString(): string {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  /**
   * 清理敏感信息
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sanitized = { ...data }
    
    for (const field of this.config.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***'
      }
    }

    return sanitized
  }

  /**
   * 记录配置变更
   */
  public logConfigChange(
    operation: string,
    source: string,
    oldConfig: Partial<UserConfig> | null,
    newConfig: Partial<UserConfig>,
    success: boolean,
    message?: string,
    errors?: string[],
    duration?: number,
    context?: Record<string, any>
  ): void {
    if (!this.config.enabled) {
      return
    }

    try {
      // 计算变更
      const changes = this.calculateChanges(oldConfig, newConfig)

      // 创建日志条目
      const logEntry: ConfigLogEntry = {
        id: this.generateLogId(),
        timestamp: Date.now(),
        level: success ? LogLevel.INFO : LogLevel.ERROR,
        operation,
        source,
        sessionId: this.sessionId,
        oldConfig: this.sanitizeData(oldConfig),
        newConfig: this.sanitizeData(newConfig),
        changes: this.sanitizeData(changes),
        success,
        message,
        errors,
        duration,
        context: this.sanitizeData(context)
      }

      // 添加到内存日志
      this.logEntries.push(logEntry)

      // 更新性能统计
      this.updatePerformanceStats(logEntry)

      // 写入文件
      if (this.config.logToFile) {
        this.writeToFile(logEntry)
      }

      // 输出到控制台
      if (this.config.logToConsole) {
        this.writeToConsole(logEntry)
      }

      // 清理旧日志
      this.cleanupOldLogs()

    } catch (error) {
      console.error('ConfigLogger: Failed to log config change:', error)
    }
  }

  /**
   * 记录配置操作开始
   */
  public startOperation(operation: string, source: string, context?: Record<string, any>): string {
    const operationId = this.generateLogId()
    
    if (this.config.enablePerformanceMonitoring) {
      this.logConfigChange(
        `${operation}-start`,
        source,
        null,
        {},
        true,
        `操作开始: ${operation}`,
        undefined,
        undefined,
        { ...context, operationId }
      )
    }

    return operationId
  }

  /**
   * 记录配置操作结束
   */
  public endOperation(
    operationId: string,
    operation: string,
    source: string,
    success: boolean,
    startTime: number,
    message?: string,
    errors?: string[],
    context?: Record<string, any>
  ): void {
    const duration = Date.now() - startTime

    this.logConfigChange(
      `${operation}-end`,
      source,
      null,
      {},
      success,
      message || `操作完成: ${operation}`,
      errors,
      duration,
      { ...context, operationId }
    )
  }

  /**
   * 记录错误
   */
  public logError(
    operation: string,
    source: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    this.logConfigChange(
      operation,
      source,
      null,
      {},
      false,
      `操作失败: ${error.message}`,
      [error.message, ...(this.config.includeStackTrace ? [error.stack || ''] : [])],
      undefined,
      context
    )
  }

  /**
   * 记录警告
   */
  public logWarning(
    operation: string,
    source: string,
    message: string,
    context?: Record<string, any>
  ): void {
    const logEntry: ConfigLogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level: LogLevel.WARN,
      operation,
      source,
      sessionId: this.sessionId,
      success: true,
      message,
      context: this.sanitizeData(context)
    }

    this.logEntries.push(logEntry)

    if (this.config.logToFile) {
      this.writeToFile(logEntry)
    }

    if (this.config.logToConsole) {
      this.writeToConsole(logEntry)
    }
  }

  /**
   * 记录调试信息
   */
  public logDebug(
    operation: string,
    source: string,
    message: string,
    context?: Record<string, any>
  ): void {
    if (this.config.level !== LogLevel.DEBUG) {
      return
    }

    const logEntry: ConfigLogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level: LogLevel.DEBUG,
      operation,
      source,
      sessionId: this.sessionId,
      success: true,
      message,
      context: this.sanitizeData(context)
    }

    this.logEntries.push(logEntry)

    if (this.config.logToConsole) {
      this.writeToConsole(logEntry)
    }
  }

  /**
   * 记录信息
   */
  public logInfo(
    operation: string,
    source: string,
    message: string,
    context?: Record<string, any>
  ): void {
    const logEntry: ConfigLogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level: LogLevel.INFO,
      operation,
      source,
      sessionId: this.sessionId,
      success: true,
      message,
      context: this.sanitizeData(context)
    }

    this.logEntries.push(logEntry)

    if (this.config.logToFile) {
      this.writeToFile(logEntry)
    }

    if (this.config.logToConsole) {
      this.writeToConsole(logEntry)
    }
  }

  /**
   * 设置日志级别
   */
  public setLogLevel(level: LogLevel): void {
    this.config.level = level
  }

  /**
   * 计算配置变更
   */
  private calculateChanges(
    oldConfig: Partial<UserConfig> | null,
    newConfig: Partial<UserConfig>
  ): Partial<UserConfig> {
    if (!oldConfig) {
      return newConfig
    }

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
   * 更新性能统计
   */
  private updatePerformanceStats(logEntry: ConfigLogEntry): void {
    if (!this.config.enablePerformanceMonitoring) {
      return
    }

    this.performanceStats.totalOperations++

    if (logEntry.success) {
      this.performanceStats.successfulOperations++
    } else {
      this.performanceStats.failedOperations++
    }

    // 更新操作类型统计
    this.performanceStats.operationsByType[logEntry.operation] = 
      (this.performanceStats.operationsByType[logEntry.operation] || 0) + 1

    // 更新错误类型统计
    if (!logEntry.success && logEntry.errors) {
      for (const error of logEntry.errors) {
        this.performanceStats.errorsByType[error] = 
          (this.performanceStats.errorsByType[error] || 0) + 1
      }
    }

    // 更新平均持续时间
    if (logEntry.duration) {
      const totalDuration = this.performanceStats.averageDuration * (this.performanceStats.totalOperations - 1)
      this.performanceStats.averageDuration = (totalDuration + logEntry.duration) / this.performanceStats.totalOperations
    }
  }

  /**
   * 写入文件
   */
  private writeToFile(logEntry: ConfigLogEntry): void {
    try {
      // 检查文件大小
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile)
        if (stats.size > this.config.maxFileSize) {
          this.rotateLogFile()
        }
      }

      const logLine = this.formatLogEntry(logEntry) + '\n'
      fs.appendFileSync(this.currentLogFile, logLine, 'utf8')

    } catch (error) {
      console.error('ConfigLogger: Failed to write to file:', error)
    }
  }

  /**
   * 写入控制台
   */
  private writeToConsole(logEntry: ConfigLogEntry): void {
    const formattedLog = this.formatLogEntry(logEntry)
    
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(formattedLog)
        break
      case LogLevel.WARN:
        console.warn(formattedLog)
        break
      case LogLevel.DEBUG:
        console.debug(formattedLog)
        break
      default:
        console.log(formattedLog)
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(logEntry: ConfigLogEntry): string {
    const timestamp = new Date(logEntry.timestamp).toISOString()
    const level = logEntry.level.toUpperCase()
    
    const parts = [
      `[${timestamp}]`,
      `[${level}]`,
      `[${logEntry.operation}]`,
      `[${logEntry.source}]`,
      logEntry.message || ''
    ]

    if (logEntry.changes && Object.keys(logEntry.changes).length > 0) {
      parts.push(`Changes: ${JSON.stringify(logEntry.changes)}`)
    }

    if (logEntry.duration) {
      parts.push(`Duration: ${logEntry.duration}ms`)
    }

    if (logEntry.errors && logEntry.errors.length > 0) {
      parts.push(`Errors: ${logEntry.errors.join(', ')}`)
    }

    return parts.filter(Boolean).join(' ')
  }

  /**
   * 轮转日志文件
   */
  private rotateLogFile(): void {
    try {
      const dateString = this.getDateString()
      const timestamp = Date.now()
      const rotatedFile = path.join(this.logFilePath, `config-${dateString}-${timestamp}.log`)
      
      if (fs.existsSync(this.currentLogFile)) {
        fs.renameSync(this.currentLogFile, rotatedFile)
      }

      this.currentLogFile = path.join(this.logFilePath, `config-${dateString}.log`)

    } catch (error) {
      console.error('ConfigLogger: Failed to rotate log file:', error)
    }
  }

  /**
   * 清理旧日志
   */
  private cleanupOldLogs(): void {
    try {
      // 清理内存中的旧日志（保留最近1000条）
      if (this.logEntries.length > 1000) {
        this.logEntries = this.logEntries.slice(-1000)
      }

      // 清理旧的日志文件
      const files = fs.readdirSync(this.logFilePath)
      const logFiles = files
        .filter(file => file.startsWith('config-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logFilePath, file),
          stats: fs.statSync(path.join(this.logFilePath, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())

      // 删除超过最大文件数的旧文件
      if (logFiles.length > this.config.maxFiles) {
        const filesToDelete = logFiles.slice(this.config.maxFiles)
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path)
        }
      }

    } catch (error) {
      console.error('ConfigLogger: Failed to cleanup old logs:', error)
    }
  }

  /**
   * 获取日志条目
   */
  public getLogEntries(
    filter?: {
      level?: LogLevel
      operation?: string
      source?: string
      success?: boolean
      startTime?: number
      endTime?: number
    }
  ): ConfigLogEntry[] {
    let entries = [...this.logEntries]

    if (filter) {
      entries = entries.filter(entry => {
        if (filter.level && entry.level !== filter.level) return false
        if (filter.operation && entry.operation !== filter.operation) return false
        if (filter.source && entry.source !== filter.source) return false
        if (filter.success !== undefined && entry.success !== filter.success) return false
        if (filter.startTime && entry.timestamp < filter.startTime) return false
        if (filter.endTime && entry.timestamp > filter.endTime) return false
        return true
      })
    }

    return entries
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): PerformanceStats {
    return { ...this.performanceStats }
  }

  /**
   * 导出日志
   */
  public exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logEntries, null, 2)
    } else {
      // CSV格式
      const headers = ['timestamp', 'level', 'operation', 'source', 'success', 'message', 'duration']
      const rows = this.logEntries.map(entry => [
        new Date(entry.timestamp).toISOString(),
        entry.level,
        entry.operation,
        entry.source,
        entry.success.toString(),
        entry.message || '',
        entry.duration?.toString() || ''
      ])

      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }
  }

  /**
   * 清空日志
   */
  public clearLogs(): void {
    this.logEntries = []
    this.initializePerformanceStats()
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (newConfig.logToFile !== undefined && newConfig.logToFile) {
      this.setupLogPaths()
    }
  }

  /**
   * 获取配置
   */
  public getConfig(): LoggerConfig {
    return { ...this.config }
  }

  /**
   * 获取日志统计信息
   */
  public getLogStats(): {
    totalEntries: number
    entriesByLevel: Record<string, number>
    entriesByOperation: Record<string, number>
    entriesBySource: Record<string, number>
    sessionId: string
    logFilePath: string
  } {
    const entriesByLevel: Record<string, number> = {}
    const entriesByOperation: Record<string, number> = {}
    const entriesBySource: Record<string, number> = {}

    for (const entry of this.logEntries) {
      entriesByLevel[entry.level] = (entriesByLevel[entry.level] || 0) + 1
      entriesByOperation[entry.operation] = (entriesByOperation[entry.operation] || 0) + 1
      entriesBySource[entry.source] = (entriesBySource[entry.source] || 0) + 1
    }

    return {
      totalEntries: this.logEntries.length,
      entriesByLevel,
      entriesByOperation,
      entriesBySource,
      sessionId: this.sessionId,
      logFilePath: this.currentLogFile
    }
  }
}

// 导出单例实例
export const configLogger = ConfigLogger.getInstance()

// 导出便捷函数
export const logConfigChange = (
  operation: string,
  source: string,
  oldConfig: Partial<UserConfig> | null,
  newConfig: Partial<UserConfig>,
  success: boolean,
  message?: string,
  errors?: string[],
  duration?: number,
  context?: Record<string, any>
) => configLogger.logConfigChange(operation, source, oldConfig, newConfig, success, message, errors, duration, context)

export const logConfigError = (operation: string, source: string, error: Error, context?: Record<string, any>) =>
  configLogger.logError(operation, source, error, context)

export const logConfigWarning = (operation: string, source: string, message: string, context?: Record<string, any>) =>
  configLogger.logWarning(operation, source, message, context)