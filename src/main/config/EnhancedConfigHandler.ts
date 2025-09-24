/**
 * 增强的配置处理器
 * 集成配置验证器、状态管理器和Tab状态管理，提供智能配置同步
 */

import { ipcMain, IpcMainEvent } from 'electron'
import { UserConfig, ConfigOperationResult, ConfigUpdateSource, TabLoadingState } from '../../types/config'
import { configValidator } from '../../utils/ConfigValidator'
import { configStateManager } from '../../utils/ConfigStateManager'
import { configUpdateQueue } from '../../utils/ConfigUpdateQueue'
import { configSyncStateManager } from '../../utils/ConfigSyncStateManager'
import { configEventManager, ConfigEventType } from '../../utils/ConfigEventManager'
import { configResultFactory } from '../../utils/ConfigResultFactory'
import { multiTabConfigBroadcaster } from '../../utils/MultiTabConfigBroadcaster'
import { configLogger } from '../../utils/ConfigLogger'
import { AppConfig } from '../../config/AppConfig'
import { AppUtil } from '../../utils/AppUtil'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'

export class EnhancedConfigHandler {
  private static instance: EnhancedConfigHandler
  private initialized = false
  private updateAllViewCallback: ((obj: any) => void) | null = null

  private constructor() {
    this.setupEventListeners()
  }

  // 单例模式
  public static getInstance(): EnhancedConfigHandler {
    if (!EnhancedConfigHandler.instance) {
      EnhancedConfigHandler.instance = new EnhancedConfigHandler()
    }
    return EnhancedConfigHandler.instance
  }

  /**
   * 初始化配置处理器
   */
  public initialize(updateAllViewCallback: (obj: any) => void): void {
    if (this.initialized) {
      return
    }

    this.updateAllViewCallback = updateAllViewCallback
    this.registerIPCHandlers()
    this.initializeConfigState()
    this.initialized = true

    AppUtil.info('EnhancedConfigHandler', 'initialize', '增强配置处理器已初始化')
  }

  /**
   * 注册IPC处理器
   */
  private registerIPCHandlers(): void {
    // 处理配置对象更新
    AppUtil.ipcMainOn(EMessage.EMainSetUserConfigWithObj, this.handleSetUserConfigWithObj.bind(this))

    // 处理单个配置项更新
    AppUtil.ipcMainOn(EMessage.EMainSetUserConfig, this.handleSetUserConfig.bind(this))

    // 处理配置获取请求
    AppUtil.ipcMainHandle(EMessage.EMainGetUserConfig, this.handleGetUserConfig.bind(this))

    // 处理配置重置请求
    AppUtil.ipcMainHandle('config-reset', this.handleConfigReset.bind(this))

    // 处理Tab状态更新
    AppUtil.ipcMainOn('tab-loading-state-change', this.handleTabLoadingStateChange.bind(this))

    // 处理Tab注册
    AppUtil.ipcMainOn('tab-register', this.handleTabRegister.bind(this))

    // 处理Tab注销
    AppUtil.ipcMainOn('tab-unregister', this.handleTabUnregister.bind(this))

    AppUtil.info('EnhancedConfigHandler', 'registerIPCHandlers', 'IPC处理器已注册')
  }

  /**
   * 初始化配置状态
   */
  private initializeConfigState(): void {
    try {
      // 从AppConfig加载当前配置
      const currentConfig = AppConfig.config || {}

      // 初始化配置状态管理器
      const result = configStateManager.initializeConfig(currentConfig)

      if (!result.success) {
        AppUtil.error('EnhancedConfigHandler', 'initializeConfigState',
          `配置状态初始化失败: ${result.message}`)
      }
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'initializeConfigState',
        '配置状态初始化异常', error)
    }
  }

  /**
   * 处理配置对象更新
   */
  private async handleSetUserConfigWithObj(event: IpcMainEvent, dictConfig: { [key: string]: any }): Promise<void> {
    if (dictConfig && dictConfig.language && dictConfig.source !== 'setting-window') {
      delete dictConfig.language
    }
    if (dictConfig && !dictConfig.language) {
      dictConfig.language = AppConfig.config.language
    }
    const startTime = Date.now()
    const operationId = configLogger.startOperation('handleSetUserConfigWithObj', 'EnhancedConfigHandler', {
      configFields: Object.keys(dictConfig),
      senderUrl: event.sender.getURL()
    })

    try {
      AppUtil.info('EnhancedConfigHandler', 'handleSetUserConfigWithObj',
        `收到配置更新请求, 字段: ${Object.keys(dictConfig).join(', ')}`)

      // 确定配置来源
      const source = this.determineConfigSource(event)
      const sourceTabId = this.extractTabId(event)

      // 记录请求日志
      configLogger.logDebug('handleSetUserConfigWithObj', 'EnhancedConfigHandler',
        '处理配置更新请求', {
        source,
        sourceTabId,
        configFields: Object.keys(dictConfig),
        operationId
      })

      // 将配置更新加入队列
      const queueResult = await configUpdateQueue.enqueue(
        dictConfig as Partial<UserConfig>,
        source,
        sourceTabId,
        source === ConfigUpdateSource.SETTING_WINDOW ? 10 : 5 // 设置窗口优先级更高
      )

      if (!queueResult.success) {
        const errorMessage = `配置更新队列失败: ${queueResult.message}`
        configLogger.endOperation(
          operationId, 'handleSetUserConfigWithObj', 'EnhancedConfigHandler',
          false, startTime, errorMessage, [queueResult.message || '']
        )
        AppUtil.error('EnhancedConfigHandler', 'handleSetUserConfigWithObj', errorMessage)
        return
      }

      // 处理配置更新
      await this.processConfigUpdate(dictConfig as Partial<UserConfig>, source, sourceTabId)

      // 记录成功日志
      configLogger.endOperation(
        operationId, 'handleSetUserConfigWithObj', 'EnhancedConfigHandler',
        true, startTime, '配置更新处理完成'
      )

    } catch (error) {
      // 记录错误日志
      configLogger.logError('handleSetUserConfigWithObj', 'EnhancedConfigHandler', error, { operationId })
      configLogger.endOperation(
        operationId, 'handleSetUserConfigWithObj', 'EnhancedConfigHandler',
        false, startTime, `配置更新处理异常: ${error.message}`, [error.message]
      )

      AppUtil.error('EnhancedConfigHandler', 'handleSetUserConfigWithObj',
        '配置更新处理异常', error)
    }
  }

  /**
   * 处理单个配置项更新
   */
  private async handleSetUserConfig(event: IpcMainEvent, configData: { key: string, value: any }): Promise<void> {
    try {
      const partialConfig = { [configData.key]: configData.value } as Partial<UserConfig>
      await this.handleSetUserConfigWithObj(event, partialConfig)
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'handleSetUserConfig',
        '单个配置项更新处理异常', error)
    }
  }

  /**
   * 处理配置获取请求
   */
  private async handleGetUserConfig(): Promise<ConfigOperationResult> {
    try {
      const config = configStateManager.getConfig()

      if (!config) {
        return configResultFactory.configNotFoundError()
      }

      return configResultFactory.success('配置获取成功', config)
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'handleGetUserConfig',
        '配置获取处理异常', error)
      return configResultFactory.fromError(error)
    }
  }

  /**
   * 处理配置重置请求
   */
  private async handleConfigReset(): Promise<ConfigOperationResult> {
    try {
      const result = configStateManager.resetConfig()

      if (result.success && result.data) {
        // 更新AppConfig
        AppConfig.setUserConfigWithObject(result.data, true)

        // 通知所有视图
        this.notifyAllViews({
          type: 'config-reset',
          data: result.data
        })
      }

      return result
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'handleConfigReset',
        '配置重置处理异常', error)
      return configResultFactory.fromError(error)
    }
  }

  /**
   * 处理Tab加载状态变更
   */
  private handleTabLoadingStateChange(event: IpcMainEvent, data: { tabId: string, state: TabLoadingState }): void {
    try {
      configSyncStateManager.setTabLoadingState(data.tabId, data.state)

      AppUtil.info('EnhancedConfigHandler', 'handleTabLoadingStateChange',
        `Tab ${data.tabId} 状态变更为: ${data.state}`)
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'handleTabLoadingStateChange',
        'Tab状态变更处理异常', error)
    }
  }

  /**
   * 处理Tab注册
   */
  private handleTabRegister(event: IpcMainEvent, tabInfo: any): void {
    try {
      configSyncStateManager.registerTab(tabInfo)

      AppUtil.info('EnhancedConfigHandler', 'handleTabRegister',
        `Tab已注册: ${tabInfo.id}`)
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'handleTabRegister',
        'Tab注册处理异常', error)
    }
  }

  /**
   * 处理Tab注销
   */
  private handleTabUnregister(event: IpcMainEvent, tabId: string): void {
    try {
      configSyncStateManager.unregisterTab(tabId)

      AppUtil.info('EnhancedConfigHandler', 'handleTabUnregister',
        `Tab已注销: ${tabId}`)
    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'handleTabUnregister',
        'Tab注销处理异常', error)
    }
  }

  /**
   * 处理配置更新的核心逻辑
   */
  private async processConfigUpdate(
    config: Partial<UserConfig>,
    source: ConfigUpdateSource,
    sourceTabId?: string
  ): Promise<void> {
    try {
      // 获取当前配置的关键字段
      const currentConfig = configStateManager.getConfig()
      const oldKeyFields = currentConfig ? {
        country: currentConfig.country,
        language: currentConfig.language,
        rate: currentConfig.rate
      } : {}

      // 更新配置状态
      const updateResult = configStateManager.updateConfig(config)

      if (!updateResult.success) {
        AppUtil.error('EnhancedConfigHandler', 'processConfigUpdate',
          `配置状态更新失败: ${updateResult.message}`)
        return
      }
      // 更新AppConfig（保持向后兼容）
      AppConfig.setUserConfigWithObject(config, true)

      // 检测关键字段变更
      const changes = updateResult.data || {}
      const hasKeyFieldChanges = this.hasKeyFieldChanges(oldKeyFields, changes)

      if (hasKeyFieldChanges) {
        // 智能同步到所有视图
        await this.smartSyncToAllViews(changes, source, sourceTabId)
      }

      AppUtil.info('EnhancedConfigHandler', 'processConfigUpdate',
        `配置更新处理完成, 变更字段: ${Object.keys(changes).join(', ')}, 有关键变更: ${hasKeyFieldChanges}`)

    } catch (error) {
      AppUtil.error('EnhancedConfigHandler', 'processConfigUpdate',
        '配置更新处理异常', error)
    }
  }

  /**
   * 智能同步到所有视图
   */
  private async smartSyncToAllViews(
    changes: Partial<UserConfig>,
    source: ConfigUpdateSource,
    sourceTabId?: string
  ): Promise<void> {
    try {
      AppUtil.info('EnhancedConfigHandler', 'smartSyncToAllViews',
        `开始智能同步, 来源: ${source}, 源Tab: ${sourceTabId || 'unknown'}`)

      // 使用多Tab配置广播器进行智能广播
      const broadcastResult = await multiTabConfigBroadcaster.broadcastConfig(
        changes,
        sourceTabId,
        {
          skipSourceTab: true,
          onlyReadyTabs: false, // 允许处理未就绪的Tab
          enablePendingQueue: true,
          maxRetries: 3
        }
      )

      // 通知其他窗口（设置窗口等）
      this.notifyAllViews({
        type: 'setting-update',
        data: {
          country: changes.country,
          language: changes.language,
          rate: changes.rate
        }
      })

      // 记录广播结果
      AppUtil.info('EnhancedConfigHandler', 'smartSyncToAllViews',
        `智能同步完成: 总数${broadcastResult.totalTabs}, 成功${broadcastResult.successCount}, 失败${broadcastResult.failedCount}, 跳过${broadcastResult.skippedCount}, 待处理${broadcastResult.pendingCount}`)

      // 如果有失败的Tab，记录错误
      if (broadcastResult.failedCount > 0) {
        AppUtil.warn('EnhancedConfigHandler', 'smartSyncToAllViews',
          `部分Tab同步失败: ${broadcastResult.failedTabs.join(', ')}`)
      }

    } catch (error) {
      configEventManager.emitConfigSyncFailure(error.message, changes, 'EnhancedConfigHandler')
      throw error
    }
  }



  /**
   * 通知所有视图
   */
  private notifyAllViews(message: any): void {
    if (this.updateAllViewCallback) {
      this.updateAllViewCallback(message)
    }
  }

  /**
   * 检查是否有关键字段变更
   */
  private hasKeyFieldChanges(oldFields: any, changes: Partial<UserConfig>): boolean {
    const keyFields = ['country', 'language', 'rate']

    for (const field of keyFields) {
      if (changes[field] !== undefined && changes[field] !== oldFields[field]) {
        return true
      }
    }

    return false
  }

  /**
   * 确定配置来源
   */
  private determineConfigSource(event: IpcMainEvent): ConfigUpdateSource {
    // 根据发送者信息判断来源
    const senderUrl = event.sender.getURL()

    if (senderUrl.includes('setting')) {
      return ConfigUpdateSource.SETTING_WINDOW
    } else if (senderUrl.includes('http')) {
      return ConfigUpdateSource.WEB_TAB
    } else {
      return ConfigUpdateSource.SYSTEM
    }
  }

  /**
   * 提取Tab ID
   */
  private extractTabId(event: IpcMainEvent): string | undefined {
    // 这里应该根据实际的Tab管理逻辑来提取Tab ID
    // 暂时返回undefined，需要与Tab管理器集成
    return undefined
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听配置更新事件
    configEventManager.on(ConfigEventType.CONFIG_UPDATED, (eventData) => {
      AppUtil.info('EnhancedConfigHandler', 'onConfigUpdated',
        `配置更新事件: ${Object.keys(eventData.changes || {}).join(', ')}`)
    })

    // 监听配置同步事件
    configEventManager.on(ConfigEventType.CONFIG_SYNC_SUCCESS, (eventData) => {
      AppUtil.info('EnhancedConfigHandler', 'onConfigSyncSuccess',
        `配置同步成功: ${eventData.source}`)
    })

    configEventManager.on(ConfigEventType.CONFIG_SYNC_FAILURE, (eventData) => {
      AppUtil.error('EnhancedConfigHandler', 'onConfigSyncFailure',
        `配置同步失败: ${eventData.error}, 来源: ${eventData.source}`)
    })
  }

  /**
   * 获取处理器状态
   */
  public getStatus(): {
    initialized: boolean
    configLoaded: boolean
    queueStatus: any
    tabStats: any
  } {
    return {
      initialized: this.initialized,
      configLoaded: configStateManager.isConfigLoaded(),
      queueStatus: configUpdateQueue.getQueueStatus(),
      tabStats: configSyncStateManager.getStateStats()
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    configSyncStateManager.cleanup()
    configUpdateQueue.clearQueue()
    this.initialized = false

    AppUtil.info('EnhancedConfigHandler', 'cleanup', '配置处理器资源已清理')
  }
}

// 导出单例实例
export const enhancedConfigHandler = EnhancedConfigHandler.getInstance()