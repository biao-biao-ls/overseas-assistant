/**
 * Tab IPC 客户端
 * 渲染进程中用于与主进程进行 Tab 相关通信的客户端
 */

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
    MainToRendererMessage,
    RendererToMainMessage,
    TabCreateOptions,
    TabItem
} from '../types'

// 获取 ipcRenderer，与 app.tsx 保持一致的获取方式
function getIpcRenderer() {
    const electron = (window as any)['electron']
    if (!electron?.ipcRenderer) {
        throw new Error('IPC Renderer 不可用。请确保 electron 已正确加载。')
    }
    return electron.ipcRenderer
}

/**
 * Tab 状态更新回调函数类型
 */
export type TabStateUpdateCallback = (data: {
    tabs: TabItem[]
    activeTabId: string | null
    userCenterTabId: string | null
    tabOrder: string[]
}) => void

/**
 * Tab 加载状态更新回调函数类型
 */
export type TabLoadingUpdateCallback = (tabId: string, isLoading: boolean) => void

/**
 * Tab 标题更新回调函数类型
 */
export type TabTitleUpdateCallback = (tabId: string, title: string) => void

/**
 * Tab 顺序更新回调函数类型
 */
export type TabOrderUpdateCallback = (tabOrder: string[]) => void

/**
 * Tab IPC 客户端类
 */
export class TabIPCClient {
    /** 是否已初始化 */
    private initialized: boolean = false
    
    /** Tab 状态更新回调 */
    private tabStateUpdateCallback: TabStateUpdateCallback | null = null
    
    /** Tab 加载状态更新回调 */
    private tabLoadingUpdateCallback: TabLoadingUpdateCallback | null = null
    
    /** Tab 标题更新回调 */
    private tabTitleUpdateCallback: TabTitleUpdateCallback | null = null
    
    /** Tab 顺序更新回调 */
    private tabOrderUpdateCallback: TabOrderUpdateCallback | null = null
    
    /** 消息统计 */
    private messageStats: Map<string, { sent: number; received: number; lastTime: number }> = new Map()

    constructor() {
        // 初始化Tab IPC客户端
    }

    /**
     * 初始化 IPC 客户端
     */
    public initialize(): void {
        if (this.initialized) {
            // IPC客户端已经初始化
            return
        }

        try {
            // 开始初始化Tab IPC客户端
            
            // 检查 IPC 是否可用
            const ipcRenderer = getIpcRenderer()
            // IPC Renderer可用
            
            this.setupMessageListener()
            this.initialized = true

            // Tab IPC客户端初始化完成
            
            // 立即请求 Tab 状态更新
            this.requestTabStateUpdate()
        } catch (error) {
            // Tab IPC客户端初始化失败
            throw error
        }
    }

    /**
     * 请求 Tab 状态更新
     */
    private async requestTabStateUpdate(): Promise<void> {
        try {
            // 请求Tab状态更新
            const ipcRenderer = getIpcRenderer()
            
            // 发送请求获取当前 Tab 状态
            const response = await ipcRenderer.invoke('tab:get-state')
            // 收到Tab状态响应
            
            if (response && response.tabs) {
                // 手动触发状态更新回调
                if (this.tabStateUpdateCallback) {
                    this.tabStateUpdateCallback({
                        tabs: response.tabs,
                        activeTabId: response.activeTabId,
                        userCenterTabId: response.userCenterTabId,
                        tabOrder: response.tabOrder || []
                    })
                }
            }
        } catch (error) {
            // 请求Tab状态更新失败
        }
    }

    /**
     * 设置消息监听器
     */
    private setupMessageListener(): void {
        const ipcRenderer = getIpcRenderer()
        
        // 设置消息监听器
        
        ipcRenderer.on(TabIPCChannels.MAIN_TO_RENDERER, (event, message: MainToRendererMessage) => {
            this.handleMainProcessMessage(message)
        })

        // 设置主进程消息监听器完成
    }

    /**
     * 处理主进程消息
     * @param message 主进程消息
     */
    private handleMainProcessMessage(message: MainToRendererMessage): void {
        try {
            this.updateMessageStats(message.type, 'received')
            
            // 收到主进程消息

            switch (message.type) {
                case TabIPCMessageType.TAB_UPDATE:
                    this.handleTabUpdate(message as TabUpdateMessage)
                    break
                
                case TabIPCMessageType.TAB_LOADING:
                    this.handleTabLoading(message as TabLoadingMessage)
                    break
                
                case TabIPCMessageType.TAB_TITLE_UPDATE:
                    this.handleTabTitleUpdate(message as TabTitleUpdateMessage)
                    break
                
                case TabIPCMessageType.TAB_ORDER_UPDATE:
                    this.handleTabOrderUpdate(message as TabOrderUpdateMessage)
                    break
                
                default:
                    // 未知的消息类型
            }
        } catch (error) {
            // 处理主进程消息失败
        }
    }

    /**
     * 处理 Tab 状态更新消息
     * @param message Tab 状态更新消息
     */
    private handleTabUpdate(message: TabUpdateMessage): void {
        if (this.tabStateUpdateCallback) {
            this.tabStateUpdateCallback(message.payload)
        }
    }

    /**
     * 处理 Tab 加载状态消息
     * @param message Tab 加载状态消息
     */
    private handleTabLoading(message: TabLoadingMessage): void {
        if (this.tabLoadingUpdateCallback) {
            const { tabId, isLoading } = message.payload
            this.tabLoadingUpdateCallback(tabId, isLoading)
        }
    }

    /**
     * 处理 Tab 标题更新消息
     * @param message Tab 标题更新消息
     */
    private handleTabTitleUpdate(message: TabTitleUpdateMessage): void {
        if (this.tabTitleUpdateCallback) {
            const { tabId, title } = message.payload
            this.tabTitleUpdateCallback(tabId, title)
        }
    }

    /**
     * 处理 Tab 顺序更新消息
     * @param message Tab 顺序更新消息
     */
    private handleTabOrderUpdate(message: TabOrderUpdateMessage): void {
        if (this.tabOrderUpdateCallback) {
            this.tabOrderUpdateCallback(message.payload.tabOrder)
        }
    }

    /**
     * 发送消息到主进程
     * @param message 消息内容
     * @returns 主进程响应
     */
    private async sendMessageToMain(message: RendererToMainMessage): Promise<any> {
        try {
            this.updateMessageStats(message.type, 'sent')
            
            // 发送消息到主进程
            
            const ipcRenderer = getIpcRenderer()
            const response = await ipcRenderer.invoke(TabIPCChannels.RENDERER_TO_MAIN, message)
            
            // 收到主进程响应
            
            return response
        } catch (error) {
            // 发送消息到主进程失败
            throw error
        }
    }

    // ==================== Tab 操作方法 ====================

    /**
     * 创建新的 Tab
     * @param url Tab URL
     * @param options 创建选项
     * @returns 创建结果
     */
    public async createTab(url: string, options?: TabCreateOptions): Promise<{ success: boolean; tabId?: string; error?: string }> {
        const message: TabActionMessage = {
            type: TabIPCMessageType.TAB_ACTION,
            action: TabActionType.CREATE,
            payload: { url, options }
        }

        return this.sendMessageToMain(message)
    }

    /**
     * 关闭 Tab
     * @param tabId Tab ID
     * @returns 关闭结果
     */
    public async closeTab(tabId: string): Promise<{ success: boolean; error?: string }> {
        const message: TabActionMessage = {
            type: TabIPCMessageType.TAB_ACTION,
            action: TabActionType.CLOSE,
            payload: { tabId }
        }

        return this.sendMessageToMain(message)
    }

    /**
     * 切换到指定 Tab
     * @param tabId Tab ID
     * @returns 切换结果
     */
    public async switchToTab(tabId: string): Promise<{ success: boolean; error?: string }> {
        const message: TabActionMessage = {
            type: TabIPCMessageType.TAB_ACTION,
            action: TabActionType.SWITCH,
            payload: { tabId }
        }

        return this.sendMessageToMain(message)
    }

    /**
     * 重新排列 Tab 顺序
     * @param tabId Tab ID
     * @param newPosition 新位置
     * @returns 重排结果
     */
    public async reorderTab(tabId: string, newPosition: number): Promise<{ success: boolean; error?: string }> {
        const message: TabReorderMessage = {
            type: TabIPCMessageType.TAB_REORDER,
            payload: { tabId, newPosition }
        }

        return this.sendMessageToMain(message)
    }

    /**
     * 更新 Tab 标题
     * @param tabId Tab ID
     * @param title 新标题
     * @returns 更新结果
     */
    public async updateTabTitle(tabId: string, title: string): Promise<{ success: boolean; error?: string }> {
        const message: TabActionMessage = {
            type: TabIPCMessageType.TAB_ACTION,
            action: TabActionType.UPDATE_TITLE,
            payload: { tabId, title }
        }

        return this.sendMessageToMain(message)
    }

    /**
     * 处理 window.open 调用
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     * @returns 处理结果
     */
    public async handleWindowOpen(url: string, target?: string, features?: string): Promise<{ success: boolean; error?: string }> {
        const message: WindowOpenMessage = {
            type: TabIPCMessageType.WINDOW_OPEN,
            payload: { url, target, features }
        }

        return this.sendMessageToMain(message)
    }

    // ==================== 回调设置方法 ====================

    /**
     * 设置 Tab 状态更新回调
     * @param callback 回调函数
     */
    public setTabStateUpdateCallback(callback: TabStateUpdateCallback): void {
        this.tabStateUpdateCallback = callback
    }

    /**
     * 设置 Tab 加载状态更新回调
     * @param callback 回调函数
     */
    public setTabLoadingUpdateCallback(callback: TabLoadingUpdateCallback): void {
        this.tabLoadingUpdateCallback = callback
    }

    /**
     * 设置 Tab 标题更新回调
     * @param callback 回调函数
     */
    public setTabTitleUpdateCallback(callback: TabTitleUpdateCallback): void {
        this.tabTitleUpdateCallback = callback
    }

    /**
     * 设置 Tab 顺序更新回调
     * @param callback 回调函数
     */
    public setTabOrderUpdateCallback(callback: TabOrderUpdateCallback): void {
        this.tabOrderUpdateCallback = callback
    }

    // ==================== 工具方法 ====================

    /**
     * 更新消息统计
     * @param messageType 消息类型
     * @param direction 方向（发送或接收）
     */
    private updateMessageStats(messageType: string, direction: 'sent' | 'received'): void {
        const stats = this.messageStats.get(messageType) || { sent: 0, received: 0, lastTime: 0 }
        stats[direction]++
        stats.lastTime = Date.now()
        this.messageStats.set(messageType, stats)
    }

    /**
     * 获取消息统计信息
     * @returns 消息统计信息
     */
    public getMessageStats(): Map<string, { sent: number; received: number; lastTime: number }> {
        return new Map(this.messageStats)
    }

    /**
     * 清除消息统计
     */
    public clearMessageStats(): void {
        this.messageStats.clear()
    }

    /**
     * 销毁 IPC 客户端
     */
    public destroy(): void {
        // 销毁Tab IPC客户端

        try {
            // 移除消息监听器
            const ipcRenderer = getIpcRenderer()
            ipcRenderer.removeAllListeners(TabIPCChannels.MAIN_TO_RENDERER)
        } catch (error) {
            // 移除消息监听器失败
        }

        // 清理回调
        this.tabStateUpdateCallback = null
        this.tabLoadingUpdateCallback = null
        this.tabTitleUpdateCallback = null
        this.tabOrderUpdateCallback = null

        // 清理状态
        this.initialized = false
        this.messageStats.clear()

        // Tab IPC客户端已销毁
    }
}