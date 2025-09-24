/**
 * Tab 用户交互处理器
 * 负责处理 Tab 相关的用户交互事件
 */

import { TabItem } from '../../types'
import { TabIPCClient } from '../TabIPCClient'

/**
 * 交互事件类型
 */
export enum TabInteractionEvent {
    CLICK = 'click',
    DOUBLE_CLICK = 'double-click',
    RIGHT_CLICK = 'right-click',
    MIDDLE_CLICK = 'middle-click',
    CLOSE = 'close',
    HOVER = 'hover',
    FOCUS = 'focus',
    BLUR = 'blur'
}

/**
 * 交互事件数据
 */
export interface TabInteractionEventData {
    tabId: string
    event: TabInteractionEvent
    originalEvent?: Event
    timestamp: number
    tab?: TabItem
}

/**
 * 交互事件监听器
 */
export type TabInteractionListener = (data: TabInteractionEventData) => void

/**
 * Tab 用户交互处理器类
 */
export class TabInteractionHandler {
    /** IPC 客户端 */
    private ipcClient: TabIPCClient
    
    /** 当前 Tab 数据 */
    private tabs: Map<string, TabItem> = new Map()
    
    /** 用户中心 Tab ID */
    private userCenterTabId: string | null = null
    
    /** 事件监听器 */
    private listeners: Map<TabInteractionEvent, TabInteractionListener[]> = new Map()
    
    /** 双击检测 */
    private doubleClickState: {
        tabId: string | null
        timestamp: number
        timeout: NodeJS.Timeout | null
    } = {
        tabId: null,
        timestamp: 0,
        timeout: null
    }
    
    /** 悬停状态 */
    private hoverState: {
        tabId: string | null
        timeout: NodeJS.Timeout | null
    } = {
        tabId: null,
        timeout: null
    }
    
    /** 配置选项 */
    private options = {
        doubleClickDelay: 300, // 双击检测延迟（毫秒）
        hoverDelay: 500, // 悬停延迟（毫秒）
        enableKeyboardNavigation: true, // 启用键盘导航
        enableContextMenu: true, // 启用右键菜单
        enableMiddleClickClose: true // 启用中键关闭
    }

    constructor(ipcClient: TabIPCClient, options?: Partial<typeof TabInteractionHandler.prototype.options>) {
        this.ipcClient = ipcClient
        
        if (options) {
            this.options = { ...this.options, ...options }
        }
        
        this.setupKeyboardNavigation()
        console.log('TabInteractionHandler', '初始化用户交互处理器')
    }

    /**
     * 设置键盘导航
     */
    private setupKeyboardNavigation(): void {
        if (!this.options.enableKeyboardNavigation) {
            return
        }

        document.addEventListener('keydown', (event) => {
            this.handleKeyboardEvent(event)
        })
    }

    /**
     * 处理键盘事件
     * @param event 键盘事件
     */
    private handleKeyboardEvent(event: KeyboardEvent): void {
        // Ctrl+Tab / Ctrl+Shift+Tab 切换 Tab
        if (event.ctrlKey && event.key === 'Tab') {
            event.preventDefault()
            
            const tabIds = Array.from(this.tabs.keys())
            if (tabIds.length === 0) {
                return
            }

            const currentActiveTab = Array.from(this.tabs.values()).find(tab => tab.isActive)
            const currentIndex = currentActiveTab ? tabIds.indexOf(currentActiveTab.id) : -1
            
            let nextIndex: number
            if (event.shiftKey) {
                // 向前切换
                nextIndex = currentIndex <= 0 ? tabIds.length - 1 : currentIndex - 1
            } else {
                // 向后切换
                nextIndex = currentIndex >= tabIds.length - 1 ? 0 : currentIndex + 1
            }

            const nextTabId = tabIds[nextIndex]
            if (nextTabId) {
                this.handleTabClick(nextTabId, event)
            }
        }
        
        // Ctrl+W 关闭当前 Tab
        else if (event.ctrlKey && event.key === 'w') {
            event.preventDefault()
            
            const currentActiveTab = Array.from(this.tabs.values()).find(tab => tab.isActive)
            if (currentActiveTab && currentActiveTab.id !== this.userCenterTabId) {
                this.handleTabClose(currentActiveTab.id, event)
            }
        }
        
        // Ctrl+T 创建新 Tab
        else if (event.ctrlKey && event.key === 't') {
            event.preventDefault()
            this.handleNewTabRequest(event)
        }
    }

    /**
     * 更新 Tab 数据
     * @param tabs Tab 数据数组
     * @param userCenterTabId 用户中心 Tab ID
     */
    public updateTabs(tabs: TabItem[], userCenterTabId: string | null): void {
        this.tabs.clear()
        tabs.forEach(tab => {
            this.tabs.set(tab.id, tab)
        })
        this.userCenterTabId = userCenterTabId
    }

    /**
     * 处理 Tab 点击事件
     * @param tabId Tab ID
     * @param originalEvent 原始事件
     */
    public async handleTabClick(tabId: string, originalEvent?: Event): Promise<void> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            console.warn('TabInteractionHandler', 'Tab 不存在', { tabId })
            return
        }

        // 检测双击
        const now = Date.now()
        if (this.doubleClickState.tabId === tabId && 
            now - this.doubleClickState.timestamp < this.options.doubleClickDelay) {
            
            // 触发双击事件
            this.emitInteractionEvent({
                tabId,
                event: TabInteractionEvent.DOUBLE_CLICK,
                originalEvent,
                timestamp: now,
                tab
            })
            
            // 清除双击状态
            if (this.doubleClickState.timeout) {
                clearTimeout(this.doubleClickState.timeout)
            }
            this.doubleClickState = { tabId: null, timestamp: 0, timeout: null }
            return
        }

        // 设置双击检测
        if (this.doubleClickState.timeout) {
            clearTimeout(this.doubleClickState.timeout)
        }
        
        this.doubleClickState = {
            tabId,
            timestamp: now,
            timeout: setTimeout(() => {
                // 单击事件处理
                this.processSingleClick(tabId, originalEvent, tab)
            }, this.options.doubleClickDelay)
        }
    }

    /**
     * 处理单击事件
     * @param tabId Tab ID
     * @param originalEvent 原始事件
     * @param tab Tab 数据
     */
    private async processSingleClick(tabId: string, originalEvent?: Event, tab?: TabItem): Promise<void> {
        // 触发点击事件
        this.emitInteractionEvent({
            tabId,
            event: TabInteractionEvent.CLICK,
            originalEvent,
            timestamp: Date.now(),
            tab
        })

        // 如果不是当前激活的 Tab，切换到该 Tab
        if (!tab?.isActive) {
            try {
                const result = await this.ipcClient.switchToTab(tabId)
                if (!result.success) {
                    console.error('TabInteractionHandler', '切换 Tab 失败', result.error)
                }
            } catch (error) {
                console.error('TabInteractionHandler', '切换 Tab 出错', error)
            }
        }
    }

    /**
     * 处理 Tab 关闭事件
     * @param tabId Tab ID
     * @param originalEvent 原始事件
     */
    public async handleTabClose(tabId: string, originalEvent?: Event): Promise<void> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            console.warn('TabInteractionHandler', 'Tab 不存在', { tabId })
            return
        }

        // 检查是否为用户中心 Tab
        if (tabId === this.userCenterTabId) {
            console.warn('TabInteractionHandler', '用户中心 Tab 不能关闭')
            return
        }

        // 触发关闭事件
        this.emitInteractionEvent({
            tabId,
            event: TabInteractionEvent.CLOSE,
            originalEvent,
            timestamp: Date.now(),
            tab
        })

        try {
            const result = await this.ipcClient.closeTab(tabId)
            if (!result.success) {
                console.error('TabInteractionHandler', '关闭 Tab 失败', result.error)
            }
        } catch (error) {
            console.error('TabInteractionHandler', '关闭 Tab 出错', error)
        }
    }

    /**
     * 处理鼠标事件
     * @param tabId Tab ID
     * @param event 鼠标事件
     */
    public handleMouseEvent(tabId: string, event: MouseEvent): void {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            return
        }

        switch (event.type) {
            case 'click':
                if (event.button === 0) {
                    // 左键点击
                    this.handleTabClick(tabId, event)
                } else if (event.button === 1 && this.options.enableMiddleClickClose) {
                    // 中键点击关闭
                    event.preventDefault()
                    this.handleTabClose(tabId, event)
                    
                    this.emitInteractionEvent({
                        tabId,
                        event: TabInteractionEvent.MIDDLE_CLICK,
                        originalEvent: event,
                        timestamp: Date.now(),
                        tab
                    })
                } else if (event.button === 2 && this.options.enableContextMenu) {
                    // 右键点击
                    this.handleRightClick(tabId, event)
                }
                break
                
            case 'mouseenter':
                this.handleTabHover(tabId, event, true)
                break
                
            case 'mouseleave':
                this.handleTabHover(tabId, event, false)
                break
        }
    }

    /**
     * 处理右键点击
     * @param tabId Tab ID
     * @param event 鼠标事件
     */
    private handleRightClick(tabId: string, event: MouseEvent): void {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            return
        }

        event.preventDefault()

        // 触发右键点击事件
        this.emitInteractionEvent({
            tabId,
            event: TabInteractionEvent.RIGHT_CLICK,
            originalEvent: event,
            timestamp: Date.now(),
            tab
        })

        // 显示上下文菜单
        this.showContextMenu(tabId, event)
    }

    /**
     * 显示上下文菜单
     * @param tabId Tab ID
     * @param event 鼠标事件
     */
    private showContextMenu(tabId: string, event: MouseEvent): void {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            return
        }

        // 创建上下文菜单
        const contextMenu = document.createElement('div')
        contextMenu.className = 'tab-context-menu'
        contextMenu.style.position = 'fixed'
        contextMenu.style.left = `${event.clientX}px`
        contextMenu.style.top = `${event.clientY}px`
        contextMenu.style.zIndex = '10000'

        const menuItems = []

        // 刷新
        menuItems.push({
            label: '刷新',
            action: () => this.refreshTab(tabId)
        })

        // 复制 Tab
        menuItems.push({
            label: '复制标签页',
            action: () => this.duplicateTab(tabId)
        })

        // 关闭其他 Tab
        if (this.tabs.size > 1) {
            menuItems.push({
                label: '关闭其他标签页',
                action: () => this.closeOtherTabs(tabId)
            })
        }

        // 关闭 Tab（用户中心 Tab 除外）
        if (tabId !== this.userCenterTabId) {
            menuItems.push({
                label: '关闭标签页',
                action: () => this.handleTabClose(tabId, event)
            })
        }

        // 创建菜单项
        menuItems.forEach(item => {
            const menuItem = document.createElement('div')
            menuItem.className = 'tab-context-menu-item'
            menuItem.textContent = item.label
            menuItem.onclick = () => {
                item.action()
                document.body.removeChild(contextMenu)
            }
            contextMenu.appendChild(menuItem)
        })

        // 添加到页面
        document.body.appendChild(contextMenu)

        // 点击其他地方关闭菜单
        const closeMenu = (e: Event) => {
            if (!contextMenu.contains(e.target as Node)) {
                document.body.removeChild(contextMenu)
                document.removeEventListener('click', closeMenu)
            }
        }
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu)
        }, 0)
    }

    /**
     * 处理 Tab 悬停
     * @param tabId Tab ID
     * @param event 鼠标事件
     * @param isEnter 是否进入
     */
    private handleTabHover(tabId: string, event: MouseEvent, isEnter: boolean): void {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            return
        }

        if (isEnter) {
            // 清除之前的悬停状态
            if (this.hoverState.timeout) {
                clearTimeout(this.hoverState.timeout)
            }

            this.hoverState = {
                tabId,
                timeout: setTimeout(() => {
                    this.emitInteractionEvent({
                        tabId,
                        event: TabInteractionEvent.HOVER,
                        originalEvent: event,
                        timestamp: Date.now(),
                        tab
                    })
                }, this.options.hoverDelay)
            }
        } else {
            // 清除悬停状态
            if (this.hoverState.timeout) {
                clearTimeout(this.hoverState.timeout)
            }
            this.hoverState = { tabId: null, timeout: null }
        }
    }

    /**
     * 处理新 Tab 请求
     * @param originalEvent 原始事件
     */
    private async handleNewTabRequest(originalEvent?: Event): Promise<void> {
        try {
            const result = await this.ipcClient.createTab('about:blank', {
                title: '新标签页'
            })
            
            if (!result.success) {
                console.error('TabInteractionHandler', '创建新 Tab 失败', result.error)
            }
        } catch (error) {
            console.error('TabInteractionHandler', '创建新 Tab 出错', error)
        }
    }

    /**
     * 刷新 Tab
     * @param tabId Tab ID
     */
    private async refreshTab(tabId: string): Promise<void> {
        // 这里可以发送刷新请求到主进程
        console.log('TabInteractionHandler', '刷新 Tab', { tabId })
    }

    /**
     * 复制 Tab
     * @param tabId Tab ID
     */
    private async duplicateTab(tabId: string): Promise<void> {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            return
        }

        try {
            const result = await this.ipcClient.createTab(tab.url, {
                title: tab.title + ' (副本)'
            })
            
            if (!result.success) {
                console.error('TabInteractionHandler', '复制 Tab 失败', result.error)
            }
        } catch (error) {
            console.error('TabInteractionHandler', '复制 Tab 出错', error)
        }
    }

    /**
     * 关闭其他 Tab
     * @param keepTabId 要保留的 Tab ID
     */
    private async closeOtherTabs(keepTabId: string): Promise<void> {
        const tabsToClose = Array.from(this.tabs.values()).filter(tab => 
            tab.id !== keepTabId && tab.id !== this.userCenterTabId
        )

        for (const tab of tabsToClose) {
            try {
                await this.ipcClient.closeTab(tab.id)
            } catch (error) {
                console.error('TabInteractionHandler', '关闭其他 Tab 失败', error)
            }
        }
    }

    /**
     * 触发交互事件
     * @param data 事件数据
     */
    private emitInteractionEvent(data: TabInteractionEventData): void {
        const listeners = this.listeners.get(data.event) || []
        listeners.forEach(listener => {
            try {
                listener(data)
            } catch (error) {
                console.error('TabInteractionHandler', '事件监听器执行出错', error)
            }
        })
    }

    // ==================== 公共方法 ====================

    /**
     * 添加事件监听器
     * @param event 事件类型
     * @param listener 监听器函数
     */
    public addEventListener(event: TabInteractionEvent, listener: TabInteractionListener): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event)!.push(listener)
    }

    /**
     * 移除事件监听器
     * @param event 事件类型
     * @param listener 监听器函数
     */
    public removeEventListener(event: TabInteractionEvent, listener: TabInteractionListener): void {
        const listeners = this.listeners.get(event)
        if (listeners) {
            const index = listeners.indexOf(listener)
            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * 获取配置选项
     * @returns 配置选项
     */
    public getOptions(): typeof this.options {
        return { ...this.options }
    }

    /**
     * 更新配置选项
     * @param options 新的配置选项
     */
    public updateOptions(options: Partial<typeof this.options>): void {
        this.options = { ...this.options, ...options }
    }

    /**
     * 销毁交互处理器
     */
    public destroy(): void {
        console.log('TabInteractionHandler', '销毁用户交互处理器')

        // 清理定时器
        if (this.doubleClickState.timeout) {
            clearTimeout(this.doubleClickState.timeout)
        }
        if (this.hoverState.timeout) {
            clearTimeout(this.hoverState.timeout)
        }

        // 清理状态
        this.tabs.clear()
        this.listeners.clear()
        this.userCenterTabId = null
        
        this.doubleClickState = { tabId: null, timestamp: 0, timeout: null }
        this.hoverState = { tabId: null, timeout: null }
    }
}