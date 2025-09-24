/**
 * Tab IPC 通信处理器
 * 负责主进程和渲染进程之间的 Tab 状态同步
 */

import { ipcMain, BrowserWindow } from 'electron'
import { 
    TabIPCMessageType, 
    TabActionType, 
    TabActionMessage, 
    WindowOpenMessage, 
    TabReorderMessage,
    TabUpdateMessage,
    TabLoadingMessage,
    TabTitleUpdateMessage,
    TabOrderUpdateMessage,
    TabIPCChannels,
    MainToRendererMessage
} from '../types'
import { TabManager } from './TabManager'
import { TabEventData } from './TabEventManager'
import { AppUtil } from '../utils/AppUtil'
import { EWnd } from '../enum/EWnd'

/**
 * Tab IPC 处理器类
 */
export class TabIPCHandler {
    /** TabManager 实例 */
    private tabManager: TabManager | null = null
    
    /** 是否已初始化 */
    private initialized: boolean = false
    
    /** IPC 消息统计 */
    private messageStats: Map<string, { count: number; lastTime: number }> = new Map()

    constructor() {
        // 初始化 Tab IPC 处理器
    }

    /**
     * 初始化 IPC 处理器
     * @param tabManager TabManager 实例
     */
    public initialize(tabManager: TabManager): void {
        if (this.initialized) {
            return
        }

        this.tabManager = tabManager
        this.setupIPCHandlers()
        this.setupTabEventListeners()
        this.initialized = true
    }

    /**
     * 设置 IPC 消息处理器
     */
    private setupIPCHandlers(): void {
        // 处理渲染进程发送的 Tab 操作请求
        ipcMain.handle(TabIPCChannels.RENDERER_TO_MAIN, async (event, message) => {
            return this.handleRendererMessage(event, message)
        })

        // 处理 Tab 状态获取请求
        ipcMain.handle('tab:get-state', async (event) => {
            return this.handleGetTabState(event)
        })


    }

    /**
     * 处理获取 Tab 状态请求
     * @param event IPC 事件
     * @returns Tab 状态
     */
    private async handleGetTabState(event: Electron.IpcMainInvokeEvent): Promise<any> {
        try {
            if (!this.tabManager) {
                return {
                    success: false,
                    error: 'TabManager 未初始化',
                    tabs: [],
                    activeTabId: null,
                    userCenterTabId: null,
                    tabOrder: []
                }
            }

            const tabs = this.tabManager.getAllTabs()
            const activeTab = this.tabManager.getActiveTab()
            const userCenterTabId = this.tabManager.getUserCenterTabId()
            const tabOrder = this.tabManager.getTabOrder()

            const result = {
                success: true,
                tabs: tabs,
                activeTabId: activeTab?.id || null,
                userCenterTabId: userCenterTabId,
                tabOrder: tabOrder
            }

            return result
        } catch (error) {
            AppUtil.error('TabIPCHandler', 'handleGetTabState', '获取 Tab 状态失败', error)
            return {
                success: false,
                error: error.message,
                tabs: [],
                activeTabId: null,
                userCenterTabId: null,
                tabOrder: []
            }
        }
    }

    /**
     * 设置 Tab 事件监听器
     */
    private setupTabEventListeners(): void {
        if (!this.tabManager) {
            return
        }

        // 监听 Tab 状态变化事件，同步到渲染进程
        this.tabManager.onTabCreated((data: TabEventData) => {
            this.sendTabUpdateToRenderer()
        })

        this.tabManager.onTabClosed((data: TabEventData) => {
            this.sendTabUpdateToRenderer()
        })

        this.tabManager.onTabActivated((data: TabEventData) => {
            this.sendTabUpdateToRenderer()
        })

        this.tabManager.onTabTitleChanged((data: TabEventData) => {
            this.sendTabTitleUpdateToRenderer(data.tabId!, data.newTitle as string)
        })

        this.tabManager.onTabOrderChanged((data: TabEventData) => {
            this.sendTabOrderUpdateToRenderer(data.tabOrder as string[])
        })

        this.tabManager.onTabLoadingStart((data: TabEventData) => {
            this.sendTabLoadingToRenderer(data.tabId!, true)
        })

        this.tabManager.onTabLoadingEnd((data: TabEventData) => {
            this.sendTabLoadingToRenderer(data.tabId!, false)
        })


    }

    /**
     * 处理渲染进程消息
     * @param event IPC 事件
     * @param message 消息内容
     * @returns 处理结果
     */
    private async handleRendererMessage(event: Electron.IpcMainInvokeEvent, message: any): Promise<any> {
        try {
            this.updateMessageStats(message.type)

            switch (message.type) {
                case TabIPCMessageType.TAB_ACTION:
                    return this.handleTabAction(message as TabActionMessage)
                
                case TabIPCMessageType.WINDOW_OPEN:
                    return this.handleWindowOpen(message as WindowOpenMessage)
                
                case TabIPCMessageType.TAB_REORDER:
                    return this.handleTabReorder(message as TabReorderMessage)
                
                default:
                    return { success: false, error: '未知的消息类型' }
            }
        } catch (error) {
            AppUtil.error('TabIPCHandler', 'handleRendererMessage', '处理渲染进程消息失败', error)
            return { success: false, error: error.message }
        }
    }

    /**
     * 处理 Tab 操作消息
     * @param message Tab 操作消息
     * @returns 处理结果
     */
    private handleTabAction(message: TabActionMessage): any {
        if (!this.tabManager) {
            return { success: false, error: 'TabManager 未初始化' }
        }

        const { action, payload } = message

        try {
            switch (action) {
                case TabActionType.CREATE:
                    if (!payload.url) {
                        return { success: false, error: '缺少 URL 参数' }
                    }
                    const tabId = this.tabManager.createTab(payload.url, payload.options)
                    return { success: true, tabId }

                case TabActionType.CLOSE:
                    if (!payload.tabId) {
                        return { success: false, error: '缺少 tabId 参数' }
                    }
                    const closeResult = this.tabManager.closeTab(payload.tabId)
                    return { success: closeResult }

                case TabActionType.SWITCH:
                    if (!payload.tabId) {
                        return { success: false, error: '缺少 tabId 参数' }
                    }
                    this.tabManager.switchToTab(payload.tabId)
                    return { success: true }

                case TabActionType.REORDER:
                    if (!payload.tabId || payload.newPosition === undefined) {
                        return { success: false, error: '缺少 tabId 或 newPosition 参数' }
                    }
                    const reorderResult = this.tabManager.reorderTab(payload.tabId, payload.newPosition)
                    return { success: reorderResult }

                case TabActionType.UPDATE_TITLE:
                    if (!payload.tabId || !payload.title) {
                        return { success: false, error: '缺少 tabId 或 title 参数' }
                    }
                    this.tabManager.updateTabTitle(payload.tabId, payload.title)
                    return { success: true }

                default:
                    return { success: false, error: `未知的操作类型: ${action}` }
            }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    /**
     * 处理 window.open 消息
     * @param message window.open 消息
     * @returns 处理结果
     */
    private handleWindowOpen(message: WindowOpenMessage): any {
        if (!this.tabManager) {
            return { success: false, error: 'TabManager 未初始化' }
        }

        const { url, target } = message.payload

        try {
            this.tabManager.handleWindowOpen(url, target)
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    /**
     * 处理 Tab 重排消息
     * @param message Tab 重排消息
     * @returns 处理结果
     */
    private handleTabReorder(message: TabReorderMessage): any {
        if (!this.tabManager) {
            return { success: false, error: 'TabManager 未初始化' }
        }

        const { tabId, newPosition } = message.payload

        try {
            const result = this.tabManager.reorderTab(tabId, newPosition)
            return { success: result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    /**
     * 发送 Tab 状态更新到渲染进程
     */
    private sendTabUpdateToRenderer(): void {
        if (!this.tabManager) {
            return
        }

        const message: TabUpdateMessage = {
            type: TabIPCMessageType.TAB_UPDATE,
            payload: {
                tabs: this.tabManager.getAllTabs(),
                activeTabId: this.tabManager.getActiveTab()?.id || null,
                userCenterTabId: this.tabManager.getUserCenterTabId() || null,
                tabOrder: this.tabManager.getTabOrder()
            }
        }

        this.sendMessageToRenderer(message)
    }

    /**
     * 发送 Tab 加载状态到渲染进程
     * @param tabId Tab ID
     * @param isLoading 是否正在加载
     */
    private sendTabLoadingToRenderer(tabId: string, isLoading: boolean): void {
        const message: TabLoadingMessage = {
            type: TabIPCMessageType.TAB_LOADING,
            payload: { tabId, isLoading }
        }

        this.sendMessageToRenderer(message)
    }

    /**
     * 发送 Tab 标题更新到渲染进程
     * @param tabId Tab ID
     * @param title 新标题
     */
    private sendTabTitleUpdateToRenderer(tabId: string, title: string): void {
        const message: TabTitleUpdateMessage = {
            type: TabIPCMessageType.TAB_TITLE_UPDATE,
            payload: { tabId, title }
        }

        this.sendMessageToRenderer(message)
    }

    /**
     * 发送 Tab 顺序更新到渲染进程
     * @param tabOrder 新的 Tab 顺序
     */
    private sendTabOrderUpdateToRenderer(tabOrder: string[]): void {
        const message: TabOrderUpdateMessage = {
            type: TabIPCMessageType.TAB_ORDER_UPDATE,
            payload: { tabOrder }
        }

        this.sendMessageToRenderer(message)
    }

    /**
     * 发送消息到渲染进程
     * @param message 消息内容
     */
    private sendMessageToRenderer(message: MainToRendererMessage): void {
        try {
            // 获取主窗口
            const mainWindow = this.getMainWindow()
            if (!mainWindow) {
                return
            }

            // 发送消息到渲染进程
            mainWindow.webContents.send(TabIPCChannels.MAIN_TO_RENDERER, message)
        } catch (error) {
            AppUtil.error('TabIPCHandler', 'sendMessageToRenderer', '发送消息到渲染进程失败', error)
        }
    }

    /**
     * 获取主窗口实例
     * @returns 主窗口实例或 null
     */
    private getMainWindow(): BrowserWindow | null {
        // 这里需要根据项目的实际情况获取主窗口
        // 可能需要从 AppUtil 或其他地方获取
        try {
            const mainWindow = AppUtil.getExistWnd(EWnd.EMain)
            return mainWindow ? mainWindow.getBrowserWindow() : null
        } catch (error) {
            AppUtil.error('TabIPCHandler', 'getMainWindow', '获取主窗口失败', error)
            return null
        }
    }

    /**
     * 更新消息统计
     * @param messageType 消息类型
     */
    private updateMessageStats(messageType: string): void {
        const stats = this.messageStats.get(messageType) || { count: 0, lastTime: 0 }
        stats.count++
        stats.lastTime = Date.now()
        this.messageStats.set(messageType, stats)
    }

    /**
     * 获取消息统计信息
     * @returns 消息统计信息
     */
    public getMessageStats(): Map<string, { count: number; lastTime: number }> {
        return new Map(this.messageStats)
    }

    /**
     * 手动同步 Tab 状态到渲染进程
     */
    public syncTabStateToRenderer(): void {
        this.sendTabUpdateToRenderer()
    }

    /**
     * 销毁 IPC 处理器
     */
    public destroy(): void {
        // 移除 IPC 处理器
        ipcMain.removeHandler(TabIPCChannels.RENDERER_TO_MAIN)

        // 清理状态
        this.tabManager = null
        this.initialized = false
        this.messageStats.clear()
    }
}