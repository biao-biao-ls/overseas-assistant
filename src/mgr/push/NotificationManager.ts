/**
 * WebSocket 推送通知管理器
 * 负责桌面通知的显示、管理和用户交互处理
 */

import { Notification, shell } from 'electron'
import { NotificationData, PushErrorType } from '../../types/push'
import { PushError } from '../../utils/PushError'
import { NOTIFICATION_CONSTANTS, LOG_CONSTANTS } from '../../config/pushConstants'
import { PushLogger } from './PushLogger'
import { PushEventEmitter } from '../../utils/PushEventEmitter'
import { PushUtils } from '../../utils/pushUtils'
import { AppConfig } from '../../config/AppConfig'
import { AppUtil } from '../../utils/AppUtil'
import { EWnd } from '../../enum/EWnd'

/**
 * 通知项接口
 */
interface NotificationItem {
  id: string
  notification: Notification
  data: NotificationData
  createdTime: number
  isShown: boolean
}

/**
 * 通知管理器类
 * 提供桌面通知的显示、队列管理和用户交互处理
 */
export class NotificationManager {
  private logger: PushLogger
  private eventEmitter: PushEventEmitter
  private activeNotifications: Map<string, NotificationItem> = new Map()
  private notificationQueue: NotificationData[] = []
  private maxConcurrentNotifications: number = 3
  private isProcessingQueue: boolean = false
  private queueProcessTimer: NodeJS.Timeout | null = null
  
  // 通知统计
  private totalNotifications: number = 0
  private shownNotifications: number = 0
  private clickedNotifications: number = 0
  private failedNotifications: number = 0
  private queuedNotifications: number = 0

  constructor(logger: PushLogger, eventEmitter: PushEventEmitter) {
    this.logger = logger
    this.eventEmitter = eventEmitter
    this.initializeNotificationManager()
  }

  /**
   * 初始化通知管理器
   */
  private initializeNotificationManager(): void {
    try {
      this.logger.logNotificationEvent('initializeNotificationManager', '通知管理器初始化开始')
      
      // 检查通知权限
      this.checkNotificationPermission()
      
      // 启动队列处理
      this.startQueueProcessing()
      
      // 监听消息处理器的通知事件
      this.setupMessageEventListeners()
      
      this.logger.logNotificationEvent('initializeNotificationManager', '通知管理器初始化完成')
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'initializeNotificationManager', '通知管理器初始化失败', error)
      throw PushError.notificationError('通知管理器初始化失败', 'INIT_FAILED', error)
    }
  }

  /**
   * 检查通知权限
   */
  private checkNotificationPermission(): void {
    try {
      // 在 Electron 主进程中，通知权限通常是可用的
      // 但我们仍然需要检查系统是否支持通知
      if (!Notification.isSupported()) {
        this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'checkNotificationPermission', '系统不支持桌面通知')
        throw PushError.permissionError('系统不支持桌面通知', 'NOTIFICATION_NOT_SUPPORTED')
      }
      
      this.logger.logNotificationEvent('checkNotificationPermission', '通知权限检查通过')
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'checkNotificationPermission', '通知权限检查失败', error)
      throw error
    }
  }

  /**
   * 设置消息事件监听器
   */
  private setupMessageEventListeners(): void {
    // 监听来自 MessageProcessor 的通知消息
    this.eventEmitter.on('notification_message', (messageData) => {
      this.showNotification({
        messageId: messageData.messageId,  // 传递messageId
        title: messageData.title,
        body: messageData.body,
        url: messageData.url,
        priority: messageData.priority || 0
      })
    })
  }

  /**
   * 显示通知
   */
  async showNotification(data: NotificationData): Promise<void> {
    try {
      this.totalNotifications++
      this.logger.logNotificationEvent('showNotification', '请求显示通知', {
        title: data.title,
        priority: data.priority,
        totalNotifications: this.totalNotifications
      })
      
      // 验证通知数据
      if (!this.validateNotificationData(data)) {
        throw PushError.notificationError('通知数据验证失败', 'INVALID_DATA')
      }
      
      // 检查是否可以立即显示
      if (this.canShowImmediately()) {
        await this.displayNotification(data)
      } else {
        // 添加到队列
        this.addToQueue(data)
      }
      
    } catch (error) {
      this.failedNotifications++
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'showNotification', '显示通知失败', error)
      
      if (error instanceof PushError) {
        this.eventEmitter.emitConnectionError(error)
      } else {
        const pushError = PushError.notificationError('显示通知异常', 'SHOW_ERROR', error)
        this.eventEmitter.emitConnectionError(pushError)
      }
      throw error
    }
  }

  /**
   * 验证通知数据
   */
  private validateNotificationData(data: NotificationData): boolean {
    if (!data.title || typeof data.title !== 'string') {
      this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'validateNotificationData', '通知标题无效')
      return false
    }
    
    if (!data.body || typeof data.body !== 'string') {
      this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'validateNotificationData', '通知内容无效')
      return false
    }
    
    // 检查标题和内容长度
    if (data.title.length > NOTIFICATION_CONSTANTS.MAX_TITLE_LENGTH) {
      this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'validateNotificationData', '通知标题过长')
      data.title = PushUtils.truncateString(data.title, NOTIFICATION_CONSTANTS.MAX_TITLE_LENGTH)
    }
    
    if (data.body.length > NOTIFICATION_CONSTANTS.MAX_BODY_LENGTH) {
      this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'validateNotificationData', '通知内容过长')
      data.body = PushUtils.truncateString(data.body, NOTIFICATION_CONSTANTS.MAX_BODY_LENGTH)
    }
    
    // 验证 URL 格式（如果存在）
    if (data.url && !PushUtils.isValidUrl(data.url)) {
      this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'validateNotificationData', '通知URL格式无效', {
        url: data.url
      })
      data.url = undefined // 移除无效的URL
    }
    
    return true
  }

  /**
   * 检查是否可以立即显示通知
   */
  private canShowImmediately(): boolean {
    return this.activeNotifications.size < this.maxConcurrentNotifications
  }

  /**
   * 实际显示通知
   */
  private async displayNotification(data: NotificationData): Promise<void> {
    try {
      const notificationId = PushUtils.generateMessageId()
      
      // 创建 Electron 通知
      const notification = new Notification({
        title: data.title,
        body: data.body,
        icon: NOTIFICATION_CONSTANTS.ICON_PATH,
        silent: !NOTIFICATION_CONSTANTS.SOUND_ENABLED,
        timeoutType: 'never', // 设置为 'never' 让通知永不自动关闭
        urgency: this.mapPriorityToUrgency(data.priority)
      })
      
      // 创建通知项
      const notificationItem: NotificationItem = {
        id: notificationId,
        notification: notification,
        data: data,
        createdTime: Date.now(),
        isShown: false
      }
      
      // 设置事件监听器
      this.setupNotificationEventListeners(notificationItem)
      
      // 显示通知
      notification.show()
      notificationItem.isShown = true
      this.shownNotifications++
      
      // 添加到活跃通知列表
      this.activeNotifications.set(notificationId, notificationItem)
      
      // 发射通知显示事件
      this.eventEmitter.emitNotificationShown({
        id: notificationId,
        messageId: data.messageId,  // 添加原始消息ID
        title: data.title,
        body: data.body,
        url: data.url,
        timestamp: notificationItem.createdTime
      })
      
      this.logger.logNotificationEvent('displayNotification', '通知已显示', {
        id: notificationId,
        title: data.title,
        activeCount: this.activeNotifications.size
      })
      
      // 设置自动关闭定时器
      this.setAutoCloseTimer(notificationItem)
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'displayNotification', '显示通知失败', error)
      throw error
    }
  }

  /**
   * 设置通知事件监听器
   */
  private setupNotificationEventListeners(item: NotificationItem): void {
    const { notification, data } = item
    
    // 点击事件
    notification.on('click', () => {
      this.handleNotificationClick(item)
    })
    
    // 关闭事件
    notification.on('close', () => {
      this.handleNotificationClose(item)
    })
    
    // 显示事件
    notification.on('show', () => {
      this.logger.logNotificationEvent('onShow', '通知已显示', {
        id: item.id,
        title: data.title
      })
    })
    
    // 失败事件
    notification.on('failed', (error) => {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'onFailed', '通知显示失败', error)
      this.handleNotificationClose(item)
    })
  }

  /**
   * 处理通知点击
   */
  private handleNotificationClick(item: NotificationItem): void {
    try {
      this.clickedNotifications++
      this.logger.logNotificationEvent('handleNotificationClick', '通知被点击', {
        id: item.id,
        title: item.data.title,
        url: item.data.url
      })
      
      // 发射通知点击事件
      this.eventEmitter.emitNotificationClicked({
        id: item.id,
        messageId: item.data.messageId,  // 添加原始消息ID
        title: item.data.title,
        body: item.data.body,
        url: item.data.url,
        timestamp: Date.now()
      })
      
      // 如果有URL，打开链接
      if (item.data.url) {
        this.openNotificationUrl(item.data.url)
      } else {
        // 没有URL时，显示主窗口
        this.showMainWindow()
      }
      
      // 关闭通知
      this.closeNotification(item.id)
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'handleNotificationClick', '处理通知点击失败', error)
    }
  }

  /**
   * 处理通知关闭
   */
  private handleNotificationClose(item: NotificationItem): void {
    try {
      this.logger.logNotificationEvent('handleNotificationClose', '通知已关闭', {
        id: item.id,
        title: item.data.title
      })
      
      // 从活跃通知列表中移除
      this.activeNotifications.delete(item.id)
      
      // 处理队列中的下一个通知
      this.processNotificationQueue()
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'handleNotificationClose', '处理通知关闭失败', error)
    }
  }

  /**
   * 打开通知URL
   */
  private openNotificationUrl(url: string): void {
    try {
      this.logger.logNotificationEvent('openNotificationUrl', '通过 window.open 在主窗口新tab中打开通知URL', { url })
      
      // 获取主窗口
      const mainWindow = AppUtil.getCreateWnd(EWnd.EMain) as any
      if (mainWindow && mainWindow.getBrowserWindow) {
        // 显示主窗口并置顶
        mainWindow.showPanel(true)
        mainWindow.getBrowserWindow().moveTop()
        
        // 添加推送消息标识参数，使用与 NIMMsg.onClickUrl 相同的机制
        const urlWithFlag = url + (url.includes('?') ? '&' : '?') + 'jlcone-push-notification=1'
        
        this.logger.logNotificationEvent('openNotificationUrl', '通过 window.open 处理推送消息URL', { 
          originalUrl: url,
          urlWithFlag: urlWithFlag 
        })
        
        // 在主窗口的 webContents 中执行 window.open，这样会触发 handleWindowOpen 处理
        const webContents = mainWindow.getBrowserWindow().webContents
        webContents.executeJavaScript(`
          console.log('NotificationManager window.open 执行:', '${urlWithFlag}');
          window.open('${urlWithFlag}', '_blank');
        `)
          .then(() => {
            this.logger.logNotificationEvent('openNotificationUrl', '成功通过 window.open 打开推送消息URL', { url })
          })
          .catch((error) => {
            this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'openNotificationUrl', '通过 window.open 打开URL失败，使用回退方案', error)
            // 回退方案：直接调用 handleCreateNewTab
            if (mainWindow.handleCreateNewTab) {
              mainWindow.handleCreateNewTab(url)
            } else {
              // 最终回退：外部浏览器
              shell.openExternal(url)
            }
          })
      } else {
        // 如果主窗口不可用，回退到外部浏览器打开
        this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'openNotificationUrl', '主窗口不可用，使用外部浏览器打开')
        shell.openExternal(url).catch(error => {
          this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'openNotificationUrl', '打开URL失败', error)
        })
      }
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'openNotificationUrl', '打开URL异常', error)
      // 异常情况下回退到外部浏览器
      try {
        shell.openExternal(url).catch(err => {
          this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'openNotificationUrl', '回退打开URL也失败', err)
        })
      } catch (fallbackError) {
        this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'openNotificationUrl', '回退打开URL异常', fallbackError)
      }
    }
  }

  /**
   * 显示主窗口
   */
  private showMainWindow(): void {
    try {
      this.logger.logNotificationEvent('showMainWindow', '显示主窗口')
      
      // 使用现有的 AppUtil 方法显示主窗口
      const mainWindow = AppUtil.getCreateWnd(EWnd.EMain)
      if (mainWindow) {
        mainWindow.showPanel(true)
      }
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'showMainWindow', '显示主窗口失败', error)
    }
  }

  /**
   * 映射优先级到紧急程度
   */
  private mapPriorityToUrgency(priority: number): 'normal' | 'critical' | 'low' {
    if (priority >= 3) {
      return 'critical'
    } else if (priority >= 1) {
      return 'normal'
    } else {
      return 'low'
    }
  }

  /**
   * 设置自动关闭定时器
   */
  private setAutoCloseTimer(item: NotificationItem): void {
    // 注释掉自动关闭逻辑，让通知保持显示直到用户手动关闭
    // setTimeout(() => {
    //   if (this.activeNotifications.has(item.id)) {
    //     this.closeNotification(item.id)
    //   }
    // }, NOTIFICATION_CONSTANTS.DEFAULT_TIMEOUT)
  }

  /**
   * 添加通知到队列
   */
  private addToQueue(data: NotificationData): void {
    // 按优先级插入队列
    this.insertNotificationByPriority(data)
    this.queuedNotifications++
    
    this.logger.logNotificationEvent('addToQueue', '通知已添加到队列', {
      title: data.title,
      priority: data.priority,
      queueSize: this.notificationQueue.length
    })
  }

  /**
   * 按优先级插入通知
   */
  private insertNotificationByPriority(data: NotificationData): void {
    let insertIndex = this.notificationQueue.length
    
    // 找到合适的插入位置（优先级高的在前面）
    for (let i = 0; i < this.notificationQueue.length; i++) {
      if (data.priority > this.notificationQueue[i].priority) {
        insertIndex = i
        break
      }
    }
    
    this.notificationQueue.splice(insertIndex, 0, data)
  }

  /**
   * 启动队列处理
   */
  private startQueueProcessing(): void {
    if (this.queueProcessTimer) {
      return
    }
    
    this.logger.logNotificationEvent('startQueueProcessing', '启动通知队列处理')
    
    this.queueProcessTimer = setInterval(() => {
      this.processNotificationQueue()
    }, 1000) // 每秒检查一次队列
  }

  /**
   * 停止队列处理
   */
  private stopQueueProcessing(): void {
    if (this.queueProcessTimer) {
      clearInterval(this.queueProcessTimer)
      this.queueProcessTimer = null
      this.logger.logNotificationEvent('stopQueueProcessing', '通知队列处理已停止')
    }
  }

  /**
   * 处理通知队列
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return
    }
    
    this.isProcessingQueue = true
    
    try {
      // 处理队列中的通知，直到达到最大并发数
      while (this.notificationQueue.length > 0 && this.canShowImmediately()) {
        const notificationData = this.notificationQueue.shift()!
        await this.displayNotification(notificationData)
      }
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'processNotificationQueue', '处理通知队列失败', error)
    } finally {
      this.isProcessingQueue = false
    }
  }

  /**
   * 关闭指定通知
   */
  closeNotification(notificationId: string): void {
    try {
      const item = this.activeNotifications.get(notificationId)
      if (!item) {
        return
      }
      
      this.logger.logNotificationEvent('closeNotification', '关闭通知', {
        id: notificationId,
        title: item.data.title
      })
      
      // 关闭 Electron 通知
      item.notification.close()
      
      // 从活跃列表中移除
      this.activeNotifications.delete(notificationId)
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'closeNotification', '关闭通知失败', error)
    }
  }

  /**
   * 关闭所有通知
   */
  clearAllNotifications(): void {
    try {
      this.logger.logNotificationEvent('clearAllNotifications', `关闭所有通知，共 ${this.activeNotifications.size} 个`)
      
      // 关闭所有活跃通知
      for (const [id, item] of this.activeNotifications) {
        try {
          item.notification.close()
        } catch (error) {
          this.logger.warn(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'clearAllNotifications', '关闭单个通知失败', error)
        }
      }
      
      // 清空活跃通知列表
      this.activeNotifications.clear()
      
      // 清空队列
      this.notificationQueue = []
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'clearAllNotifications', '关闭所有通知失败', error)
    }
  }

  /**
   * 设置最大并发通知数
   */
  setMaxConcurrentNotifications(max: number): void {
    this.maxConcurrentNotifications = Math.max(max, 1)
    this.logger.logNotificationEvent('setMaxConcurrentNotifications', `最大并发通知数设置为 ${this.maxConcurrentNotifications}`)
  }

  /**
   * 获取通知统计信息
   */
  getNotificationStatistics(): any {
    return {
      totalNotifications: this.totalNotifications,
      shownNotifications: this.shownNotifications,
      clickedNotifications: this.clickedNotifications,
      failedNotifications: this.failedNotifications,
      queuedNotifications: this.queuedNotifications,
      activeNotifications: this.activeNotifications.size,
      queuedInQueue: this.notificationQueue.length,
      maxConcurrentNotifications: this.maxConcurrentNotifications,
      isProcessingQueue: this.isProcessingQueue,
      clickRate: this.shownNotifications > 0 ? (this.clickedNotifications / this.shownNotifications * 100).toFixed(2) + '%' : '0%',
      successRate: this.totalNotifications > 0 ? (this.shownNotifications / this.totalNotifications * 100).toFixed(2) + '%' : '0%',
      failureRate: this.totalNotifications > 0 ? (this.failedNotifications / this.totalNotifications * 100).toFixed(2) + '%' : '0%'
    }
  }

  /**
   * 重置通知统计
   */
  resetStatistics(): void {
    this.totalNotifications = 0
    this.shownNotifications = 0
    this.clickedNotifications = 0
    this.failedNotifications = 0
    this.queuedNotifications = 0
    
    this.logger.logNotificationEvent('resetStatistics', '通知统计已重置')
  }

  /**
   * 销毁通知管理器
   */
  destroy(): void {
    try {
      this.logger.logNotificationEvent('destroy', '通知管理器销毁开始')
      
      // 停止队列处理
      this.stopQueueProcessing()
      
      // 关闭所有通知
      this.clearAllNotifications()
      
      // 移除事件监听器
      this.eventEmitter.removeAllListeners('notification_message')
      
      // 重置状态
      this.isProcessingQueue = false
      this.resetStatistics()
      
      this.logger.logNotificationEvent('destroy', '通知管理器已销毁')
      
    } catch (error) {
      this.logger.error(LOG_CONSTANTS.COMPONENT_NAMES.NOTIFICATION_MGR, 'destroy', '销毁通知管理器失败', error)
    }
  }
}