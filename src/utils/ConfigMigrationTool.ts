/**
 * 配置迁移工具
 * 提供配置数据的备份、恢复和批量迁移功能
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { UserConfig } from '../types/config'
import { configCompatibilityManager, MigrationResult } from './ConfigCompatibilityManager'
import { configLogger } from './ConfigLogger'
import { AppUtil } from './AppUtil'

// 备份信息
export interface BackupInfo {
  id: string
  timestamp: number
  version: string
  description: string
  filePath: string
  size: number
  checksum: string
}

// 迁移任务
export interface MigrationTask {
  id: string
  source: string
  target: string
  fromVersion: string
  toVersion: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startTime?: number
  endTime?: number
  error?: string
  result?: MigrationResult
}

// 批量迁移结果
export interface BatchMigrationResult {
  success: boolean
  totalTasks: number
  completedTasks: number
  failedTasks: number
  results: MigrationResult[]
  errors: string[]
  duration: number
}

export class ConfigMigrationTool {
  private static instance: ConfigMigrationTool
  private backupDirectory: string
  private migrationTasks: Map<string, MigrationTask> = new Map()
  private nextTaskId = 1

  private constructor() {
    this.backupDirectory = path.join(AppUtil.getAppDataPath(), 'config-backups')
    this.ensureBackupDirectory()
  }

  // 单例模式
  public static getInstance(): ConfigMigrationTool {
    if (!ConfigMigrationTool.instance) {
      ConfigMigrationTool.instance = new ConfigMigrationTool()
    }
    return ConfigMigrationTool.instance
  }

  /**
   * 确保备份目录存在
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDirectory, { recursive: true })
    } catch (error) {
      configLogger.logError('ensureBackupDirectory', 'ConfigMigrationTool', error)
    }
  }

  /**
   * 创建配置备份
   */
  public async createBackup(
    config: any,
    description: string = '自动备份'
  ): Promise<BackupInfo> {
    try {
      const timestamp = Date.now()
      const backupId = `backup-${timestamp}`
      const version = configCompatibilityManager.detectConfigVersion?.(config) || 'unknown'
      
      // 创建备份数据
      const backupData = {
        id: backupId,
        timestamp,
        version,
        description,
        config,
        metadata: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
          platform: process.platform,
          nodeVersion: process.version
        }
      }
      
      // 生成文件路径
      const fileName = `${backupId}.json`
      const filePath = path.join(this.backupDirectory, fileName)
      
      // 写入备份文件
      const backupJson = JSON.stringify(backupData, null, 2)
      await fs.writeFile(filePath, backupJson, 'utf8')
      
      // 计算校验和
      const checksum = this.calculateChecksum(backupJson)
      
      // 获取文件大小
      const stats = await fs.stat(filePath)
      
      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp,
        version,
        description,
        filePath,
        size: stats.size,
        checksum
      }
      
      configLogger.logInfo('createBackup', 'ConfigMigrationTool',
        `配置备份已创建: ${backupId}`, { filePath, size: stats.size })
      
      return backupInfo
      
    } catch (error) {
      configLogger.logError('createBackup', 'ConfigMigrationTool', error)
      throw new Error(`创建备份失败: ${error.message}`)
    }
  }

  /**
   * 恢复配置备份
   */
  public async restoreBackup(backupId: string): Promise<{ config: any, metadata: any }> {
    try {
      const fileName = `${backupId}.json`
      const filePath = path.join(this.backupDirectory, fileName)
      
      // 检查文件是否存在
      try {
        await fs.access(filePath)
      } catch {
        throw new Error(`备份文件不存在: ${backupId}`)
      }
      
      // 读取备份文件
      const backupJson = await fs.readFile(filePath, 'utf8')
      const backupData = JSON.parse(backupJson)
      
      // 验证备份数据
      if (!backupData.config) {
        throw new Error('备份文件格式无效')
      }
      
      configLogger.logInfo('restoreBackup', 'ConfigMigrationTool',
        `配置备份已恢复: ${backupId}`, { version: backupData.version })
      
      return {
        config: backupData.config,
        metadata: backupData.metadata || {}
      }
      
    } catch (error) {
      configLogger.logError('restoreBackup', 'ConfigMigrationTool', error)
      throw new Error(`恢复备份失败: ${error.message}`)
    }
  }

  /**
   * 列出所有备份
   */
  public async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.backupDirectory)
      const backups: BackupInfo[] = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.backupDirectory, file)
            const backupJson = await fs.readFile(filePath, 'utf8')
            const backupData = JSON.parse(backupJson)
            const stats = await fs.stat(filePath)
            
            backups.push({
              id: backupData.id,
              timestamp: backupData.timestamp,
              version: backupData.version,
              description: backupData.description,
              filePath,
              size: stats.size,
              checksum: this.calculateChecksum(backupJson)
            })
          } catch (error) {
            configLogger.logWarning('listBackups', 'ConfigMigrationTool',
              `跳过无效备份文件: ${file}`, { error: error.message })
          }
        }
      }
      
      // 按时间戳排序（最新的在前）
      return backups.sort((a, b) => b.timestamp - a.timestamp)
      
    } catch (error) {
      configLogger.logError('listBackups', 'ConfigMigrationTool', error)
      return []
    }
  }

  /**
   * 删除备份
   */
  public async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const fileName = `${backupId}.json`
      const filePath = path.join(this.backupDirectory, fileName)
      
      await fs.unlink(filePath)
      
      configLogger.logInfo('deleteBackup', 'ConfigMigrationTool',
        `备份已删除: ${backupId}`)
      
      return true
      
    } catch (error) {
      configLogger.logError('deleteBackup', 'ConfigMigrationTool', error)
      return false
    }
  }

  /**
   * 清理旧备份
   */
  public async cleanupOldBackups(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const backups = await this.listBackups()
      const cutoffTime = Date.now() - maxAge
      let deletedCount = 0
      
      for (const backup of backups) {
        if (backup.timestamp < cutoffTime) {
          const success = await this.deleteBackup(backup.id)
          if (success) {
            deletedCount++
          }
        }
      }
      
      configLogger.logInfo('cleanupOldBackups', 'ConfigMigrationTool',
        `清理了 ${deletedCount} 个旧备份`)
      
      return deletedCount
      
    } catch (error) {
      configLogger.logError('cleanupOldBackups', 'ConfigMigrationTool', error)
      return 0
    }
  }

  /**
   * 创建迁移任务
   */
  public async createMigrationTask(
    source: string,
    target: string,
    fromVersion?: string
  ): Promise<string> {
    try {
      const taskId = `migration-${this.nextTaskId++}-${Date.now()}`
      
      // 读取源配置
      let sourceConfig: any
      if (source.startsWith('backup:')) {
        const backupId = source.replace('backup:', '')
        const restored = await this.restoreBackup(backupId)
        sourceConfig = restored.config
      } else {
        // 假设是文件路径
        const configJson = await fs.readFile(source, 'utf8')
        sourceConfig = JSON.parse(configJson)
      }
      
      // 检测版本
      const detectedVersion = fromVersion || 
        configCompatibilityManager.detectConfigVersion?.(sourceConfig) || 'unknown'
      
      const task: MigrationTask = {
        id: taskId,
        source,
        target,
        fromVersion: detectedVersion,
        toVersion: configCompatibilityManager.getCurrentVersion(),
        status: 'pending',
        progress: 0
      }
      
      this.migrationTasks.set(taskId, task)
      
      configLogger.logInfo('createMigrationTask', 'ConfigMigrationTool',
        `迁移任务已创建: ${taskId}`, { source, target, fromVersion: detectedVersion })
      
      return taskId
      
    } catch (error) {
      configLogger.logError('createMigrationTask', 'ConfigMigrationTool', error)
      throw new Error(`创建迁移任务失败: ${error.message}`)
    }
  }

  /**
   * 执行迁移任务
   */
  public async executeMigrationTask(taskId: string): Promise<MigrationResult> {
    const task = this.migrationTasks.get(taskId)
    if (!task) {
      throw new Error(`迁移任务不存在: ${taskId}`)
    }
    
    try {
      task.status = 'running'
      task.startTime = Date.now()
      task.progress = 0
      
      configLogger.logInfo('executeMigrationTask', 'ConfigMigrationTool',
        `开始执行迁移任务: ${taskId}`)
      
      // 读取源配置
      let sourceConfig: any
      if (task.source.startsWith('backup:')) {
        const backupId = task.source.replace('backup:', '')
        const restored = await this.restoreBackup(backupId)
        sourceConfig = restored.config
      } else {
        const configJson = await fs.readFile(task.source, 'utf8')
        sourceConfig = JSON.parse(configJson)
      }
      
      task.progress = 25
      
      // 创建备份（如果目标文件存在）
      try {
        await fs.access(task.target)
        const existingConfig = JSON.parse(await fs.readFile(task.target, 'utf8'))
        await this.createBackup(existingConfig, `迁移前备份 - ${taskId}`)
      } catch {
        // 目标文件不存在，无需备份
      }
      
      task.progress = 50
      
      // 执行迁移
      const migrationResult = await configCompatibilityManager.migrateConfig(
        sourceConfig,
        task.fromVersion
      )
      
      task.progress = 75
      
      if (migrationResult.success) {
        // 写入迁移后的配置
        const migratedJson = JSON.stringify(migrationResult.migratedConfig, null, 2)
        await fs.writeFile(task.target, migratedJson, 'utf8')
        
        task.status = 'completed'
        task.progress = 100
        task.endTime = Date.now()
        task.result = migrationResult
        
        configLogger.logInfo('executeMigrationTask', 'ConfigMigrationTool',
          `迁移任务完成: ${taskId}`, { 
            duration: task.endTime - task.startTime!,
            appliedRules: migrationResult.appliedRules.length
          })
      } else {
        task.status = 'failed'
        task.error = migrationResult.errors.join('; ')
        task.result = migrationResult
        
        configLogger.logError('executeMigrationTask', 'ConfigMigrationTool',
          new Error(`迁移失败: ${task.error}`), { taskId })
      }
      
      return migrationResult
      
    } catch (error) {
      task.status = 'failed'
      task.error = error.message
      task.endTime = Date.now()
      
      configLogger.logError('executeMigrationTask', 'ConfigMigrationTool', error, { taskId })
      throw error
    }
  }

  /**
   * 批量迁移
   */
  public async batchMigrate(
    sources: Array<{ source: string, target: string, fromVersion?: string }>
  ): Promise<BatchMigrationResult> {
    const startTime = Date.now()
    const results: MigrationResult[] = []
    const errors: string[] = []
    let completedTasks = 0
    let failedTasks = 0
    
    try {
      configLogger.logInfo('batchMigrate', 'ConfigMigrationTool',
        `开始批量迁移: ${sources.length} 个任务`)
      
      // 创建所有迁移任务
      const taskIds: string[] = []
      for (const source of sources) {
        try {
          const taskId = await this.createMigrationTask(
            source.source,
            source.target,
            source.fromVersion
          )
          taskIds.push(taskId)
        } catch (error) {
          errors.push(`创建任务失败 (${source.source}): ${error.message}`)
          failedTasks++
        }
      }
      
      // 执行所有任务
      for (const taskId of taskIds) {
        try {
          const result = await this.executeMigrationTask(taskId)
          results.push(result)
          
          if (result.success) {
            completedTasks++
          } else {
            failedTasks++
            errors.push(`任务 ${taskId} 失败: ${result.errors.join('; ')}`)
          }
        } catch (error) {
          failedTasks++
          errors.push(`任务 ${taskId} 异常: ${error.message}`)
        }
      }
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      const batchResult: BatchMigrationResult = {
        success: failedTasks === 0,
        totalTasks: sources.length,
        completedTasks,
        failedTasks,
        results,
        errors,
        duration
      }
      
      configLogger.logInfo('batchMigrate', 'ConfigMigrationTool',
        `批量迁移完成`, {
          totalTasks: sources.length,
          completedTasks,
          failedTasks,
          duration
        })
      
      return batchResult
      
    } catch (error) {
      configLogger.logError('batchMigrate', 'ConfigMigrationTool', error)
      
      return {
        success: false,
        totalTasks: sources.length,
        completedTasks,
        failedTasks: sources.length - completedTasks,
        results,
        errors: [...errors, `批量迁移异常: ${error.message}`],
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 获取迁移任务状态
   */
  public getMigrationTaskStatus(taskId: string): MigrationTask | null {
    return this.migrationTasks.get(taskId) || null
  }

  /**
   * 获取所有迁移任务
   */
  public getAllMigrationTasks(): MigrationTask[] {
    return Array.from(this.migrationTasks.values())
  }

  /**
   * 取消迁移任务
   */
  public cancelMigrationTask(taskId: string): boolean {
    const task = this.migrationTasks.get(taskId)
    if (!task || task.status === 'completed') {
      return false
    }
    
    task.status = 'failed'
    task.error = '任务已取消'
    task.endTime = Date.now()
    
    configLogger.logInfo('cancelMigrationTask', 'ConfigMigrationTool',
      `迁移任务已取消: ${taskId}`)
    
    return true
  }

  /**
   * 清理迁移任务
   */
  public cleanupMigrationTasks(): number {
    const completedTasks = Array.from(this.migrationTasks.values())
      .filter(task => task.status === 'completed' || task.status === 'failed')
    
    completedTasks.forEach(task => {
      this.migrationTasks.delete(task.id)
    })
    
    configLogger.logInfo('cleanupMigrationTasks', 'ConfigMigrationTool',
      `清理了 ${completedTasks.length} 个已完成的迁移任务`)
    
    return completedTasks.length
  }

  /**
   * 验证配置文件
   */
  public async validateConfigFile(filePath: string): Promise<{
    valid: boolean
    version: string
    issues: string[]
    suggestions: string[]
  }> {
    try {
      const configJson = await fs.readFile(filePath, 'utf8')
      const config = JSON.parse(configJson)
      
      const version = configCompatibilityManager.detectConfigVersion?.(config) || 'unknown'
      const compatibility = configCompatibilityManager.checkCompatibility(config, version)
      
      return {
        valid: compatibility.isCompatible,
        version,
        issues: compatibility.issues,
        suggestions: compatibility.warnings
      }
      
    } catch (error) {
      return {
        valid: false,
        version: 'unknown',
        issues: [`文件读取或解析失败: ${error.message}`],
        suggestions: ['检查文件路径和JSON格式是否正确']
      }
    }
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(data: string): string {
    // 简单的校验和计算（实际项目中可能需要使用更强的哈希算法）
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * 获取迁移统计信息
   */
  public getMigrationStats(): {
    totalBackups: number
    totalTasks: number
    completedTasks: number
    failedTasks: number
    pendingTasks: number
    backupSize: number
  } {
    const tasks = Array.from(this.migrationTasks.values())
    
    return {
      totalBackups: 0, // 需要异步获取，这里简化
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending' || t.status === 'running').length,
      backupSize: 0 // 需要异步计算，这里简化
    }
  }
}

// 导出单例实例
export const configMigrationTool = ConfigMigrationTool.getInstance()

// 导出便捷函数
export const createConfigBackup = (config: any, description?: string) =>
  configMigrationTool.createBackup(config, description)

export const restoreConfigBackup = (backupId: string) =>
  configMigrationTool.restoreBackup(backupId)

export const migrateConfigFile = (source: string, target: string, fromVersion?: string) =>
  configMigrationTool.createMigrationTask(source, target, fromVersion)
    .then(taskId => configMigrationTool.executeMigrationTask(taskId))