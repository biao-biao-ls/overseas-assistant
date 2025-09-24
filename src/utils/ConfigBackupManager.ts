/**
 * 配置备份管理器
 * 提供配置的备份、恢复、版本管理和导入导出功能
 */

import { UserConfig, ConfigOperationResult } from '../types/config'
import { configValidator } from './ConfigValidator'
import { configResultFactory } from './ConfigResultFactory'
import { configLogger } from './ConfigLogger'
import { AppUtil } from './AppUtil'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// 备份元数据接口
export interface BackupMetadata {
  id: string
  timestamp: number
  version: string
  description?: string
  source: string
  configHash: string
  size: number
  tags?: string[]
}

// 备份项接口
export interface ConfigBackup {
  metadata: BackupMetadata
  config: UserConfig
}

// 备份配置接口
export interface BackupConfig {
  enableAutoBackup: boolean
  backupInterval: number // 毫秒
  maxBackupFiles: number
  compressionEnabled: boolean
  encryptionEnabled: boolean
  backupOnConfigChange: boolean
  retentionDays: number
}

export class ConfigBackupManager {
  private static instance: ConfigBackupManager
  private config: BackupConfig
  private backupPath: string
  private metadataPath: string
  private backups: Map<string, BackupMetadata> = new Map()
  private autoBackupTimer: NodeJS.Timeout | null = null

  private constructor() {
    this.config = {
      enableAutoBackup: true,
      backupInterval: 30 * 60 * 1000, // 30分钟
      maxBackupFiles: 50,
      compressionEnabled: true,
      encryptionEnabled: false,
      backupOnConfigChange: true,
      retentionDays: 30
    }

    this.setupPaths()
    this.loadBackupMetadata()
    this.startAutoBackup()
  }

  // 单例模式
  public static getInstance(): ConfigBackupManager {
    if (!ConfigBackupManager.instance) {
      ConfigBackupManager.instance = new ConfigBackupManager()
    }
    return ConfigBackupManager.instance
  }

  /**
   * 设置路径
   */
  private setupPaths(): void {
    try {
      const userDataPath = app?.getPath('userData') || process.cwd()
      this.backupPath = path.join(userDataPath, 'config-backups')
      this.metadataPath = path.join(this.backupPath, 'metadata.json')

      // 确保备份目录存在
      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true })
      }

      AppUtil.info('ConfigBackupManager', 'setupPaths', 
        `备份路径已设置: ${this.backupPath}`)

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'setupPaths', '设置备份路径失败', error)
      this.config.enableAutoBackup = false
    }
  }

  /**
   * 创建配置备份
   */
  public async createBackup(
    config: UserConfig,
    description?: string,
    source: string = 'manual',
    tags?: string[]
  ): Promise<ConfigOperationResult<BackupMetadata>> {
    try {
      // 验证配置
      const validationResult = configValidator.validateConfig(config)
      if (!validationResult.isValid) {
        return {
          success: false,
          message: '配置验证失败',
          errors: validationResult.errors
        }
      }

      // 生成备份元数据
      const metadata: BackupMetadata = {
        id: this.generateBackupId(),
        timestamp: Date.now(),
        version: this.getConfigVersion(config),
        description,
        source,
        configHash: this.calculateConfigHash(config),
        size: JSON.stringify(config).length,
        tags
      }

      // 创建备份对象
      const backup: ConfigBackup = {
        metadata,
        config: { ...config }
      }

      // 保存备份文件
      await this.saveBackupFile(backup)

      // 更新元数据
      this.backups.set(metadata.id, metadata)
      await this.saveBackupMetadata()

      // 清理旧备份
      await this.cleanupOldBackups()

      // 记录日志
      // configLogger.logConfigChange(
      //   'backup-created', 
      //   source, 
      //   null, 
      //   config, 
      //   true, 
      //   '备份操作完成', 
      //   undefined, 
      //   undefined, 
      //   {
      //     backupId: metadata.id,
      //     description,
      //     tags
      //   }
      // )

      AppUtil.info('ConfigBackupManager', 'createBackup', 
        `配置备份已创建: ${metadata.id}, 来源: ${source}`)

      return {
        success: true,
        message: '备份操作完成',
        data: metadata
      }

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'createBackup', '创建配置备份失败', error)
      return {
        success: false,
        message: `创建配置备份失败: ${error.message}`
      }
    }
  }

  /**
   * 恢复配置备份
   */
  public async restoreBackup(backupId: string): Promise<ConfigOperationResult<UserConfig>> {
    try {
      // 检查备份是否存在
      const metadata = this.backups.get(backupId)
      if (!metadata) {
        return configResultFactory.failure<UserConfig>(`备份不存在: ${backupId}`)
      }

      // 加载备份文件
      const backup = await this.loadBackupFile(backupId)
      if (!backup) {
        return configResultFactory.failure<UserConfig>(`无法加载备份文件: ${backupId}`)
      }

      // 验证备份配置
      const validationResult = configValidator.validateConfig(backup.config)
      if (!validationResult.isValid) {
        AppUtil.warn('ConfigBackupManager', 'restoreBackup', 
          `备份配置验证失败: ${backupId}`, validationResult.errors)
        
        // 尝试修复配置
        const repairedConfig = configValidator.repairConfig(backup.config)
        if (repairedConfig) {
          backup.config = repairedConfig as UserConfig
          AppUtil.info('ConfigBackupManager', 'restoreBackup', 
            `备份配置已修复: ${backupId}`)
        } else {
          return configResultFactory.validationFailure(validationResult.errors) as ConfigOperationResult<UserConfig>
        }
      }

      // 记录恢复日志
      configLogger.logConfigChange(
        'backup-restored', 
        'ConfigBackupManager', 
        null, 
        backup.config, 
        true, 
        '备份恢复完成',
        undefined,
        undefined,
        {
          backupId,
          originalTimestamp: metadata.timestamp,
          restoredAt: Date.now()
        }
      )

      AppUtil.info('ConfigBackupManager', 'restoreBackup', 
        `配置备份已恢复: ${backupId}, 时间: ${new Date(metadata.timestamp).toISOString()}`)

      return configResultFactory.success<UserConfig>('备份恢复完成', backup.config)

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'restoreBackup', 
        `恢复配置备份失败: ${backupId}`, error)
      return configResultFactory.systemError(error) as ConfigOperationResult<UserConfig>
    }
  }

  /**
   * 获取备份列表
   */
  public getBackupList(
    limit?: number,
    source?: string,
    tags?: string[]
  ): BackupMetadata[] {
    let backupList = Array.from(this.backups.values())

    // 按来源过滤
    if (source) {
      backupList = backupList.filter(backup => backup.source === source)
    }

    // 按标签过滤
    if (tags && tags.length > 0) {
      backupList = backupList.filter(backup => 
        backup.tags && tags.some(tag => backup.tags!.includes(tag))
      )
    }

    // 按时间戳降序排序
    backupList.sort((a, b) => b.timestamp - a.timestamp)

    // 限制数量
    if (limit && limit > 0) {
      backupList = backupList.slice(0, limit)
    }

    return backupList
  }

  /**
   * 删除备份
   */
  public async deleteBackup(backupId: string): Promise<ConfigOperationResult> {
    try {
      // 检查备份是否存在
      const metadata = this.backups.get(backupId)
      if (!metadata) {
        return configResultFactory.failure(`备份不存在: ${backupId}`)
      }

      // 删除备份文件
      const backupFilePath = this.getBackupFilePath(backupId)
      if (fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath)
      }

      // 从元数据中移除
      this.backups.delete(backupId)
      await this.saveBackupMetadata()

      AppUtil.info('ConfigBackupManager', 'deleteBackup', 
        `配置备份已删除: ${backupId}`)

      return configResultFactory.success('备份删除完成')

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'deleteBackup', 
        `删除配置备份失败: ${backupId}`, error)
      return configResultFactory.systemError(error)
    }
  }

  /**
   * 导出备份
   */
  public async exportBackup(
    backupId: string,
    exportPath: string
  ): Promise<ConfigOperationResult> {
    try {
      // 加载备份
      const backup = await this.loadBackupFile(backupId)
      if (!backup) {
        return configResultFactory.failure(`备份不存在: ${backupId}`)
      }

      // 创建导出数据
      const exportData = {
        exportedAt: Date.now(),
        exportVersion: '1.0',
        backup
      }

      // 写入导出文件
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8')

      AppUtil.info('ConfigBackupManager', 'exportBackup', 
        `配置备份已导出: ${backupId} -> ${exportPath}`)

      return configResultFactory.success('备份导出完成')

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'exportBackup', 
        `导出配置备份失败: ${backupId}`, error)
      return configResultFactory.systemError(error)
    }
  }

  /**
   * 导入备份
   */
  public async importBackup(
    importPath: string,
    description?: string
  ): Promise<ConfigOperationResult<BackupMetadata>> {
    try {
      // 读取导入文件
      if (!fs.existsSync(importPath)) {
        return configResultFactory.failure<BackupMetadata>(`导入文件不存在: ${importPath}`)
      }

      const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'))
      
      // 验证导入数据格式
      if (!importData.backup || !importData.backup.config) {
        return configResultFactory.failure<BackupMetadata>('导入文件格式无效')
      }

      const { backup } = importData

      // 创建新的备份
      const result = await this.createBackup(
        backup.config,
        description || `导入备份: ${backup.metadata?.description || ''}`,
        'import',
        ['imported', ...(backup.metadata?.tags || [])]
      )

      if (result.success) {
        AppUtil.info('ConfigBackupManager', 'importBackup', 
          `配置备份已导入: ${importPath} -> ${result.data?.id}`)
      }

      return result

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'importBackup', 
        `导入配置备份失败: ${importPath}`, error)
      return configResultFactory.systemError(error) as ConfigOperationResult<BackupMetadata>
    }
  }

  /**
   * 保存备份文件
   */
  private async saveBackupFile(backup: ConfigBackup): Promise<void> {
    const filePath = this.getBackupFilePath(backup.metadata.id)
    const data = JSON.stringify(backup, null, 2)
    
    fs.writeFileSync(filePath, data, 'utf8')
  }

  /**
   * 加载备份文件
   */
  private async loadBackupFile(backupId: string): Promise<ConfigBackup | null> {
    try {
      const filePath = this.getBackupFilePath(backupId)
      
      if (!fs.existsSync(filePath)) {
        return null
      }

      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'loadBackupFile', 
        `加载备份文件失败: ${backupId}`, error)
      return null
    }
  }

  /**
   * 获取备份文件路径
   */
  private getBackupFilePath(backupId: string): string {
    return path.join(this.backupPath, `${backupId}.json`)
  }

  /**
   * 加载备份元数据
   */
  private loadBackupMetadata(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const data = fs.readFileSync(this.metadataPath, 'utf8')
        const metadata = JSON.parse(data)
        
        for (const [id, meta] of Object.entries(metadata)) {
          this.backups.set(id, meta as BackupMetadata)
        }

        AppUtil.info('ConfigBackupManager', 'loadBackupMetadata', 
          `已加载 ${this.backups.size} 个备份元数据`)
      }
    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'loadBackupMetadata', 
        '加载备份元数据失败', error)
    }
  }

  /**
   * 保存备份元数据
   */
  private async saveBackupMetadata(): Promise<void> {
    try {
      const metadata = Object.fromEntries(this.backups.entries())
      fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2), 'utf8')
    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'saveBackupMetadata', 
        '保存备份元数据失败', error)
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const now = Date.now()
      const retentionTime = this.config.retentionDays * 24 * 60 * 60 * 1000
      const backupList = Array.from(this.backups.values())

      // 按时间戳排序
      backupList.sort((a, b) => b.timestamp - a.timestamp)

      let deletedCount = 0

      // 删除超过数量限制的备份
      if (backupList.length > this.config.maxBackupFiles) {
        const toDelete = backupList.slice(this.config.maxBackupFiles)
        for (const backup of toDelete) {
          await this.deleteBackup(backup.id)
          deletedCount++
        }
      }

      // 删除超过保留期的备份
      for (const backup of backupList) {
        if (now - backup.timestamp > retentionTime) {
          await this.deleteBackup(backup.id)
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        AppUtil.info('ConfigBackupManager', 'cleanupOldBackups', 
          `已清理 ${deletedCount} 个旧备份`)
      }

    } catch (error) {
      AppUtil.error('ConfigBackupManager', 'cleanupOldBackups', 
        '清理旧备份失败', error)
    }
  }

  /**
   * 开始自动备份
   */
  private startAutoBackup(): void {
    if (!this.config.enableAutoBackup) {
      return
    }

    this.autoBackupTimer = setInterval(async () => {
      try {
        // 这里应该获取当前配置并创建备份
        // 由于我们在备份管理器中，这里只是示例
        const currentConfig = configValidator.getDefaultConfig()
        await this.createBackup(currentConfig, '自动备份', 'auto', ['auto'])
      } catch (error) {
        AppUtil.error('ConfigBackupManager', 'startAutoBackup', 
          '自动备份失败', error)
      }
    }, this.config.backupInterval)

    AppUtil.info('ConfigBackupManager', 'startAutoBackup', 
      `自动备份已启动, 间隔: ${this.config.backupInterval}ms`)
  }

  /**
   * 停止自动备份
   */
  public stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
      
      AppUtil.info('ConfigBackupManager', 'stopAutoBackup', '自动备份已停止')
    }
  }

  /**
   * 生成备份ID
   */
  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取配置版本
   */
  private getConfigVersion(config: UserConfig): string {
    // 这里可以根据配置内容生成版本号
    // 简单实现：使用时间戳
    return new Date().toISOString().split('T')[0]
  }

  /**
   * 计算配置哈希
   */
  private calculateConfigHash(config: UserConfig): string {
    // 简单的哈希实现
    const configStr = JSON.stringify(config, Object.keys(config).sort())
    let hash = 0
    
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16)
  }

  /**
   * 获取备份统计信息
   */
  public getBackupStats(): {
    totalBackups: number
    totalSize: number
    backupsBySource: Record<string, number>
    oldestBackup?: BackupMetadata
    newestBackup?: BackupMetadata
    averageSize: number
  } {
    const backupList = Array.from(this.backups.values())
    const backupsBySource: Record<string, number> = {}
    let totalSize = 0
    let oldestBackup: BackupMetadata | undefined
    let newestBackup: BackupMetadata | undefined

    for (const backup of backupList) {
      // 按来源统计
      backupsBySource[backup.source] = (backupsBySource[backup.source] || 0) + 1
      
      // 累计大小
      totalSize += backup.size
      
      // 找到最老和最新的备份
      if (!oldestBackup || backup.timestamp < oldestBackup.timestamp) {
        oldestBackup = backup
      }
      if (!newestBackup || backup.timestamp > newestBackup.timestamp) {
        newestBackup = backup
      }
    }

    return {
      totalBackups: backupList.length,
      totalSize,
      backupsBySource,
      oldestBackup,
      newestBackup,
      averageSize: backupList.length > 0 ? totalSize / backupList.length : 0
    }
  }

  /**
   * 更新备份配置
   */
  public updateConfig(newConfig: Partial<BackupConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }

    // 如果自动备份设置发生变化，重新启动
    if (oldConfig.enableAutoBackup !== this.config.enableAutoBackup ||
        oldConfig.backupInterval !== this.config.backupInterval) {
      this.stopAutoBackup()
      this.startAutoBackup()
    }

    AppUtil.info('ConfigBackupManager', 'updateConfig', 
      `备份配置已更新: ${JSON.stringify(newConfig)}`)
  }

  /**
   * 获取备份配置
   */
  public getConfig(): BackupConfig {
    return { ...this.config }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopAutoBackup()
    this.backups.clear()
    
    AppUtil.info('ConfigBackupManager', 'cleanup', '备份管理器资源已清理')
  }
}

// 导出单例实例
export const configBackupManager = ConfigBackupManager.getInstance()

// 导出便捷函数
export const createConfigBackup = (
  config: UserConfig,
  description?: string,
  source?: string,
  tags?: string[]
) => configBackupManager.createBackup(config, description, source, tags)

export const restoreConfigBackup = (backupId: string) => 
  configBackupManager.restoreBackup(backupId)

export const getConfigBackupList = (limit?: number, source?: string, tags?: string[]) => 
  configBackupManager.getBackupList(limit, source, tags)