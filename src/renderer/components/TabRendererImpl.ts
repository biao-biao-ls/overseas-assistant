/**
 * Tab 渲染器实现类
 * 实现 ITabRenderer 接口，提供程序化的 Tab 渲染控制
 */

import { ITabRenderer, TabItem } from '../../types'
import { TabIPCClient } from '../TabIPCClient'

/**
 * Tab 渲染器实现类
 */
export class TabRendererImpl implements ITabRenderer {
    /** IPC 客户端 */
    private ipcClient: TabIPCClient
    
    /** 当前 Tab 数据 */
    private tabs: TabItem[] = []
    
    /** 当前激活的 Tab ID */
    private activeTabId: string | null = null
    
    /** 用户中心 Tab ID */
    private userCenterTabId: string | null = null
    
    /** Tab 顺序 */
    private tabOrder: string[] = []
    
    /** 渲染回调函数 */
    private renderCallback: ((tabs: TabItem[]) => void) | null = null
    
    /** 标题更新回调函数 */
    private titleUpdateCallback: ((tabId: string, title: string) => void) | null = null
    
    /** 激活状态更新回调函数 */
    private activeUpdateCallback: ((tabId: string) => void) | null = null

    constructor(ipcClient: TabIPCClient) {
        this.ipcClient = ipcClient
        this.setupIPCCallbacks()
    }

    /**
     * 设置 IPC 回调
     */
    private setupIPCCallbacks(): void {
        // 设置 Tab 状态更新回调
        this.ipcClient.setTabStateUpdateCallback((data) => {
            this.tabs = data.tabs
            this.activeTabId = data.activeTabId
            this.userCenterTabId = data.userCenterTabId
            this.tabOrder = data.tabOrder
            
            // 触发渲染更新
            this.renderTabs(this.tabs)
        })

        // 设置 Tab 标题更新回调
        this.ipcClient.setTabTitleUpdateCallback((tabId, title) => {
            this.updateTabTitle(tabId, title)
        })

        // 设置 Tab 加载状态更新回调
        this.ipcClient.setTabLoadingUpdateCallback((tabId, isLoading) => {
            this.handleTabLoadingUpdate(tabId, isLoading)
        })

        // 设置 Tab 顺序更新回调
        this.ipcClient.setTabOrderUpdateCallback((newTabOrder) => {
            this.tabOrder = newTabOrder
            this.renderTabs(this.tabs)
        })
    }

    /**
     * 处理 Tab 加载状态更新
     * @param tabId Tab ID
     * @param isLoading 是否正在加载
     */
    private handleTabLoadingUpdate(tabId: string, isLoading: boolean): void {
        // 更新内部状态
        const tab = this.tabs.find(t => t.id === tabId)
        if (tab) {
            tab.isLoading = isLoading
        }

        // 显示或隐藏加载指示器
        if (isLoading) {
            this.showLoadingIndicator(tabId)
        } else {
            this.hideLoadingIndicator(tabId)
        }
    }

    /**
     * 获取排序后的 Tab 列表
     * @returns 排序后的 Tab 列表
     */
    private getSortedTabs(): TabItem[] {
        if (this.tabOrder.length === 0) {
            return this.tabs
        }

        const sortedTabs: TabItem[] = []
        const tabMap = new Map(this.tabs.map(tab => [tab.id, tab]))

        // 按照 tabOrder 排序
        for (const tabId of this.tabOrder) {
            const tab = tabMap.get(tabId)
            if (tab) {
                sortedTabs.push(tab)
            }
        }

        // 添加不在 tabOrder 中的 Tab（如果有的话）
        for (const tab of this.tabs) {
            if (!this.tabOrder.includes(tab.id)) {
                sortedTabs.push(tab)
            }
        }

        return sortedTabs
    }

    // ==================== ITabRenderer 接口实现 ====================

    /**
     * 渲染 Tab 列表
     * @param tabs Tab 数据数组
     */
    public renderTabs(tabs: TabItem[]): void {
        this.tabs = tabs
        const sortedTabs = this.getSortedTabs()
        
        if (this.renderCallback) {
            this.renderCallback(sortedTabs)
        }

        // 渲染Tab列表
    }

    /**
     * 更新指定 Tab 的标题
     * @param tabId Tab ID
     * @param title 新标题
     */
    public updateTabTitle(tabId: string, title: string): void {
        // 更新内部状态
        const tab = this.tabs.find(t => t.id === tabId)
        if (tab) {
            tab.title = title
        }

        if (this.titleUpdateCallback) {
            this.titleUpdateCallback(tabId, title)
        }

        // 更新Tab标题
    }

    /**
     * 设置激活的 Tab
     * @param tabId Tab ID
     */
    public setActiveTab(tabId: string): void {
        // 更新内部状态
        this.tabs.forEach(tab => {
            tab.isActive = tab.id === tabId
        })
        this.activeTabId = tabId

        if (this.activeUpdateCallback) {
            this.activeUpdateCallback(tabId)
        }

        // 设置激活Tab
    }

    // ==================== 用户交互处理 ====================

    /**
     * 处理 Tab 点击事件
     * @param tabId Tab ID
     */
    public async onTabClick(tabId: string): Promise<void> {
        if (tabId === this.activeTabId) {
            return // 已经是激活状态
        }

        try {
            const result = await this.ipcClient.switchToTab(tabId)
            if (!result.success) {
                // 切换Tab失败
            }
        } catch (error) {
            // 切换Tab出错
        }
    }

    /**
     * 处理 Tab 关闭事件
     * @param tabId Tab ID
     */
    public async onTabClose(tabId: string): Promise<void> {
        // 检查是否为用户中心 Tab
        if (tabId === this.userCenterTabId) {
            // 用户中心Tab不能关闭
            return
        }

        try {
            const result = await this.ipcClient.closeTab(tabId)
            if (!result.success) {
                // 关闭Tab失败
            }
        } catch (error) {
            // 关闭Tab出错
        }
    }

    // ==================== 拖拽相关方法 ====================

    /**
     * 处理 Tab 拖拽开始事件
     * @param tabId Tab ID
     * @param event 鼠标事件
     */
    public onTabDragStart(tabId: string, event: MouseEvent): void {
        // 检查是否为用户中心 Tab
        if (tabId === this.userCenterTabId) {
            // 用户中心Tab不能拖拽
            return
        }

        // 开始拖拽Tab
        
        // 这里可以添加拖拽开始的视觉效果
        document.body.classList.add('tab-dragging')
    }

    /**
     * 处理 Tab 拖拽移动事件
     * @param event 鼠标事件
     */
    public onTabDragMove(event: MouseEvent): void {
        // 计算拖拽位置并更新指示器
        // 拖拽移动
    }

    /**
     * 处理 Tab 拖拽结束事件
     * @param event 鼠标事件
     */
    public async onTabDragEnd(event: MouseEvent): Promise<void> {
        // 结束拖拽Tab
        
        // 移除拖拽样式
        document.body.classList.remove('tab-dragging')
        this.hideDropIndicator()
    }

    /**
     * 显示拖拽指示器
     * @param position 指示器位置
     */
    public showDropIndicator(position: number): void {
        // 显示拖拽指示器
        
        // 这里可以添加显示拖拽指示器的逻辑
        const indicator = document.querySelector('.tab-drop-indicator') as HTMLElement
        if (indicator) {
            indicator.style.display = 'block'
            indicator.style.left = `${position * 200}px` // 假设每个 Tab 宽度为 200px
        }
    }

    /**
     * 隐藏拖拽指示器
     */
    public hideDropIndicator(): void {
        // 隐藏拖拽指示器
        
        const indicator = document.querySelector('.tab-drop-indicator') as HTMLElement
        if (indicator) {
            indicator.style.display = 'none'
        }
    }

    // ==================== 加载状态处理 ====================

    /**
     * 显示 Tab 加载指示器
     * @param tabId Tab ID
     */
    public showLoadingIndicator(tabId: string): void {
        // 显示加载指示器
        
        // 这里可以添加显示加载指示器的逻辑
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement
        if (tabElement) {
            tabElement.classList.add('tab-item--loading')
        }
    }

    /**
     * 隐藏 Tab 加载指示器
     * @param tabId Tab ID
     */
    public hideLoadingIndicator(tabId: string): void {
        // 隐藏加载指示器
        
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement
        if (tabElement) {
            tabElement.classList.remove('tab-item--loading')
        }
    }

    // ==================== 回调设置方法 ====================

    /**
     * 设置渲染回调函数
     * @param callback 回调函数
     */
    public setRenderCallback(callback: (tabs: TabItem[]) => void): void {
        this.renderCallback = callback
    }

    /**
     * 设置标题更新回调函数
     * @param callback 回调函数
     */
    public setTitleUpdateCallback(callback: (tabId: string, title: string) => void): void {
        this.titleUpdateCallback = callback
    }

    /**
     * 设置激活状态更新回调函数
     * @param callback 回调函数
     */
    public setActiveUpdateCallback(callback: (tabId: string) => void): void {
        this.activeUpdateCallback = callback
    }

    // ==================== 工具方法 ====================

    /**
     * 获取当前 Tab 数据
     * @returns 当前 Tab 数据
     */
    public getCurrentTabs(): TabItem[] {
        return [...this.tabs]
    }

    /**
     * 获取当前激活的 Tab ID
     * @returns 激活的 Tab ID
     */
    public getActiveTabId(): string | null {
        return this.activeTabId
    }

    /**
     * 获取用户中心 Tab ID
     * @returns 用户中心 Tab ID
     */
    public getUserCenterTabId(): string | null {
        return this.userCenterTabId
    }

    /**
     * 销毁渲染器，清理资源
     */
    public destroy(): void {
        // 销毁Tab渲染器
        
        // 清理回调
        this.renderCallback = null
        this.titleUpdateCallback = null
        this.activeUpdateCallback = null
        
        // 清理状态
        this.tabs = []
        this.activeTabId = null
        this.userCenterTabId = null
        this.tabOrder = []
        
        // 清理 DOM 样式
        document.body.classList.remove('tab-dragging')
        this.hideDropIndicator()
    }
}