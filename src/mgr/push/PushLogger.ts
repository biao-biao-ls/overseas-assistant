/**
 * WebSocket 推送功能专用日志管理器
 * 集成到现有的 AppUtil 日志系统，提供推送功能专用的日志记录
 */

import { getLogger, Logger } from 'log4js'
import { LogLevel } from '../../types/push'
import { PushError } from '../../utils/PushError'
import { LOG_CONSTANTS } from '../../config/pushConstants'
import { AppUtil } from '../../utils/AppUtil'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 推送日志管理器类
 * 提供推送功能专用的日志记录和管理功能
 */
export class PushLogger {
  private logger: Logger
  private logLevel: LogLevel = LogLevel.INFO
  private logFilePath: string
  private lastRotationCheck: number = 0
  private enableConsoleOutput: boolean = true // 启用Console输出

  constructor() {
    // 创建专用的推送日志记录器
    this.logger = getLogger('push')
    this.logFilePath = this.getLogFilePath()
    this.initializeLogger()
  }

  /**
   * 初始化日志记录器
   */
  private initializeLogger(): void {
    try {
      // 确保日志目录存在
      this.ensureLogDirectory()
      
      // 设置日志级别
      this.setLogLevel(this.logLevel)
      
      this.info(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'initializeLogger', '推送日志管理器初始化完成')
    } catch (error) {
      // 如果推送日志初始化失败，使用 AppUtil 记录错误
      AppUtil.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'initializeLogger', '推送日志管理器初始化失败', error)
    }
  }

  /**
   * 获取日志文件路径
   */
  private getLogFilePath(): string {
    // 使用应用数据目录下的 logs/push 子目录
    const appDataPath = process.env.APPDATA || process.env.HOME || '.'
    return path.join(appDataPath, 'JLCAssistant', 'logs', 'push')
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        fs.mkdirSync(this.logFilePath, { recursive: true })
      }
    } catch (error) {
      AppUtil.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'ensureLogDirectory', '创建日志目录失败', error)
    }
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level
    
    // 将自定义日志级别映射到 log4js 级别
    const log4jsLevel = this.mapToLog4jsLevel(level)
    this.logger.level = log4jsLevel
  }

  /**
   * 将自定义日志级别映射到 log4js 级别
   */
  private mapToLog4jsLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug'
      case LogLevel.INFO:
        return 'info'
      case LogLevel.WARN:
        return 'warn'
      case LogLevel.ERROR:
        return 'error'
      default:
        return 'info'
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(component: string, action: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${component}] [${action}] ${message}`
  }

  /**
   * 记录调试信息
   */
  debug(component: string, action: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formattedMessage = this.formatMessage(component, action, message)
      this.logger.debug(formattedMessage)
      
      if (data) {
        this.logger.debug('数据详情:', data)
      }
      
      // Console输出 - 调试信息
      if (this.enableConsoleOutput) {
        console.debug(`🔍 [推送调试] [${component}] ${action}: ${message}`, data || '')
      }
      
      // 同时使用 AppUtil 记录，保持一致性
      AppUtil.info(component, action, `[DEBUG] ${message}`, data)
    }
  }

  /**
   * 记录信息
   */
  info(component: string, action: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedMessage = this.formatMessage(component, action, message)
      this.logger.info(formattedMessage)
      
      if (data) {
        this.logger.info('数据详情:', data)
      }
      
      // Console输出 - 信息
      if (this.enableConsoleOutput) {
        console.info(`ℹ️ [推送信息] [${component}] ${action}: ${message}`, data || '')
      }
      
      // 同时使用 AppUtil 记录
      AppUtil.info(component, action, message, data)
    }
  }

  /**
   * 记录警告
   */
  warn(component: string, action: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formattedMessage = this.formatMessage(component, action, message)
      this.logger.warn(formattedMessage)
      
      if (data) {
        this.logger.warn('数据详情:', data)
      }
      
      // Console输出 - 警告
      if (this.enableConsoleOutput) {
        console.warn(`⚠️ [推送警告] [${component}] ${action}: ${message}`, data || '')
      }
      
      // 同时使用 AppUtil 记录
      AppUtil.warn(component, action, message, data)
    }
  }

  /**
   * 记录错误
   */
  error(component: string, action: string, message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formattedMessage = this.formatMessage(component, action, message)
      this.logger.error(formattedMessage)
      
      if (error) {
        if (error instanceof PushError) {
          // 推送专用错误的详细记录
          const errorDetails = {
            type: error.type,
            code: error.code,
            details: error.details,
            timestamp: error.timestamp,
            stack: error.stack
          }
          this.logger.error('推送错误详情:', errorDetails)
          
          // Console输出 - 推送错误
          if (this.enableConsoleOutput) {
            console.error(`❌ [推送错误] [${component}] ${action}: ${message}`, errorDetails)
          }
        } else if (error instanceof Error) {
          const errorInfo = {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
          this.logger.error('错误详情:', errorInfo)
          
          // Console输出 - 一般错误
          if (this.enableConsoleOutput) {
            console.error(`❌ [推送错误] [${component}] ${action}: ${message}`, errorInfo)
          }
        } else {
          this.logger.error('错误数据:', error)
          
          // Console输出 - 其他错误
          if (this.enableConsoleOutput) {
            console.error(`❌ [推送错误] [${component}] ${action}: ${message}`, error)
          }
        }
      } else {
        // Console输出 - 无错误对象
        if (this.enableConsoleOutput) {
          console.error(`❌ [推送错误] [${component}] ${action}: ${message}`)
        }
      }
      
      // 同时使用 AppUtil 记录
      AppUtil.error(component, action, message, error)
    }
  }

  /**
   * 记录推送错误
   */
  logPushError(component: string, action: string, pushError: PushError): void {
    this.error(component, action, pushError.getDetailedDescription(), pushError)
  }

  /**
   * 记录连接事件
   */
  logConnectionEvent(action: string, message: string, data?: any): void {
    this.info(LOG_CONSTANTS.COMPONENT_NAMES.CONNECTION, action, message, data)
  }

  /**
   * 记录消息处理事件
   */
  logMessageEvent(action: string, message: string, data?: any): void {
    this.info(LOG_CONSTANTS.COMPONENT_NAMES.MESSAGE_PROCESSOR, action, message, data)
  }

  /**
   * 记录通知事件
   */
  logNotificationEvent(action: string, message: string, data?: any): void {
    this.info(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, action, message, data)
  }

  /**
   * 记录 Token 事件
   */
  logTokenEvent(action: string, message: string, data?: any): void {
    this.info(LOG_CONSTANTS.COMPONENT_NAMES.TOKEN_MGR, action, message, data)
  }

  /**
   * 记录性能指标
   */
  logPerformance(component: string, action: string, duration: number, data?: any): void {
    const message = `性能指标 - 耗时: ${duration}ms`
    this.info(component, action, message, data)
  }

  /**
   * 记录统计信息
   */
  logStatistics(component: string, action: string, stats: any): void {
    this.info(component, action, '统计信息', stats)
  }

  /**
   * 判断是否应该记录指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levelOrder = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    }
    
    return levelOrder[level] >= levelOrder[this.logLevel]
  }

  /**
   * 获取当前日志级别
   */
  getLogLevel(): LogLevel {
    return this.logLevel
  }

  /**
   * 启用/禁用Console输出
   */
  setConsoleOutput(enabled: boolean): void {
    this.enableConsoleOutput = enabled
    const status = enabled ? '已启用' : '已禁用'
    console.log(`🔧 [推送日志] Console输出${status}`)
  }

  /**
   * 检查Console输出是否启用
   */
  isConsoleOutputEnabled(): boolean {
    return this.enableConsoleOutput
  }

  /**
   * 检查并轮转日志文件
   */
  rotateLogFile(): void {
    try {
      const now = Date.now()
      
      // 检查是否需要进行轮转检查
      if (now - this.lastRotationCheck < LOG_CONSTANTS.LOG_ROTATION_CHECK_INTERVAL) {
        return
      }
      
      this.lastRotationCheck = now
      
      // 获取当前日志文件信息
      const logFiles = this.getLogFiles()
      
      for (const logFile of logFiles) {
        const filePath = path.join(this.logFilePath, logFile)
        const stats = fs.statSync(filePath)
        
        // 检查文件大小
        if (stats.size > LOG_CONSTANTS.MAX_LOG_FILE_SIZE) {
          this.rotateFile(filePath)
        }
      }
      
      // 清理旧的日志文件
      this.cleanupOldLogFiles()
      
    } catch (error) {
      this.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'rotateLogFile', '日志轮转失败', error)
    }
  }

  /**
   * 获取日志文件列表
   */
  private getLogFiles(): string[] {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return []
      }
      
      return fs.readdirSync(this.logFilePath)
        .filter(file => file.endsWith('.log'))
        .sort()
    } catch (error) {
      this.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'getLogFiles', '获取日志文件列表失败', error)
      return []
    }
  }

  /**
   * 轮转单个日志文件
   */
  private rotateFile(filePath: string): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const rotatedPath = `${filePath}.${timestamp}`
      
      fs.renameSync(filePath, rotatedPath)
      
      this.info(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'rotateFile', `日志文件已轮转: ${path.basename(rotatedPath)}`)
    } catch (error) {
      this.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'rotateFile', '轮转日志文件失败', error)
    }
  }

  /**
   * 清理旧的日志文件
   */
  private cleanupOldLogFiles(): void {
    try {
      const logFiles = this.getLogFiles()
      const rotatedFiles = logFiles.filter(file => file.includes('.log.'))
      
      if (rotatedFiles.length > LOG_CONSTANTS.MAX_LOG_FILES) {
        // 按时间排序，删除最旧的文件
        rotatedFiles.sort()
        const filesToDelete = rotatedFiles.slice(0, rotatedFiles.length - LOG_CONSTANTS.MAX_LOG_FILES)
        
        for (const file of filesToDelete) {
          const filePath = path.join(this.logFilePath, file)
          fs.unlinkSync(filePath)
          this.info(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'cleanupOldLogFiles', `已删除旧日志文件: ${file}`)
        }
      }
    } catch (error) {
      this.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'cleanupOldLogFiles', '清理旧日志文件失败', error)
    }
  }

  /**
   * 获取日志统计信息
   */
  getLogStatistics(): any {
    try {
      const logFiles = this.getLogFiles()
      let totalSize = 0
      
      for (const file of logFiles) {
        const filePath = path.join(this.logFilePath, file)
        const stats = fs.statSync(filePath)
        totalSize += stats.size
      }
      
      return {
        logLevel: this.logLevel,
        logFilePath: this.logFilePath,
        totalFiles: logFiles.length,
        totalSize: totalSize,
        formattedSize: this.formatFileSize(totalSize),
        lastRotationCheck: this.lastRotationCheck
      }
    } catch (error) {
      this.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'getLogStatistics', '获取日志统计信息失败', error)
      return null
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 清理所有日志文件
   */
  clearAllLogs(): void {
    try {
      const logFiles = this.getLogFiles()
      
      for (const file of logFiles) {
        const filePath = path.join(this.logFilePath, file)
        fs.unlinkSync(filePath)
      }
      
      this.info(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'clearAllLogs', `已清理 ${logFiles.length} 个日志文件`)
    } catch (error) {
      this.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'clearAllLogs', '清理日志文件失败', error)
    }
  }

  /**
   * 销毁日志管理器
   */
  destroy(): void {
    try {
      // 执行最后一次日志轮转检查
      this.rotateLogFile()
      
      this.info(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'destroy', '推送日志管理器已销毁')
    } catch (error) {
      AppUtil.error(LOG_CONSTANTS.COMPONENT_NAMES.LOGGER, 'destroy', '销毁推送日志管理器失败', error)
    }
  }
}