/**
 * Tab 管理器实现
 * 负责主窗口 Tab 的创建、删除、切换和状态管理
 */

import { EventEmitter } from 'events'
import { 
    ITabManager, 
    TabItem, 
    TabCreateOptions, 
    TabState, 
    TabConfig, 
    TabEvent, 
    TabError, 
    TabErrorType,
    TabDragState
} from '../types'
import { AppUtil } from '../utils/AppUtil'
import { ECommon } from '../enum/ECommon'
import { TabEventManager, TabEventData } from './TabEventManager'

/**
 * Tab 管理器类
 * 实现统一的 Tab 管理功能
 */
export class TabManager extends EventEmitter implements ITabManager {
    /** Tab 管理器实例（单例模式） */
    private static instance: TabManager | null = null
    
    /** Tab 状态管理 */
    private state: TabState
    
    /** Tab 配置 */
    private config: TabConfig
    
    /** Tab ID 计数器，用于生成唯一 ID */
    private tabIdCounter: number = 0

    /** Tab 事件管理器 */
    private eventManager: TabEventManager

    /**
     * 构造函数
     * @param config Tab 配置参数
     */
    constructor(config: TabConfig) {
        super()
        this.config = config
        this.state = this.initializeState()
        this.eventManager = new TabEventManager()
        
        // 设置事件管理器的配置
        this.eventManager.setEventLogging(true)
        this.eventManager.setPerformanceMonitoring(true)
        
        AppUtil.info('TabManager', 'constructor', '初始化 Tab 管理器')
    }

    /**
     * 获取 TabManager 单例实例
     * @param config Tab 配置参数（仅在首次创建时需要）
     * @returns TabManager 实例
     */
    public static getInstance(config?: TabConfig): TabManager {
        if (!TabManager.instance) {
            if (!config) {
                throw new TabError(
                    TabErrorType.INVALID_URL,
                    'TabManager 首次创建时需要提供配置参数'
                )
            }
            TabManager.instance = new TabManager(config)
        }
        return TabManager.instance
    }

    /**
     * 销毁单例实例
     */
    public static destroyInstance(): void {
        if (TabManager.instance) {
            TabManager.instance.destroy()
            TabManager.instance = null
        }
    }

    /**
     * 初始化 Tab 状态
     * @returns 初始化的 Tab 状态
     */
    private initializeState(): TabState {
        const dragState: TabDragState = {
            isDragging: false,
            dragTabId: null,
            dragPreviewElement: null,
            dropIndicatorPosition: null,
            originalPosition: 0
        }

        return {
            tabs: new Map<string, TabItem>(),
            activeTabId: null,
            userCenterTabId: null,
            tabOrder: [],
            dragState
        }
    }

    /**
     * 生成唯一的 Tab ID
     * @param url Tab 对应的 URL
     * @returns 生成的 Tab ID
     */
    private generateTabId(url: string): string {
        const timestamp = Date.now()
        const counter = ++this.tabIdCounter
        const urlHash = this.hashCode(url)
        return `tab_${timestamp}_${counter}_${urlHash}`
    }

    /**
     * 计算字符串哈希值
     * @param str 输入字符串
     * @returns 哈希值
     */
    private hashCode(str: string): number {
        let hash = 0
        if (str.length === 0) return hash
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // 转换为32位整数
        }
        return Math.abs(hash)
    }

    /**
     * 验证 URL 是否有效
     * @param url 要验证的 URL
     * @returns 是否有效
     */
    private isValidUrl(url: string): boolean {
        try {
            new URL(url)
            return true
        } catch {
            return false
        }
    }

    /**
     * 检查是否为用户中心 URL
     * @param url 要检查的 URL
     * @returns 是否为用户中心 URL
     */
    private isUserCenterUrl(url: string): boolean {
        return url === this.config.userCenterUrl || 
               url.includes('/user-center')
    }

    /**
     * 检查是否超过最大 Tab 数量限制
     * @returns 是否超过限制
     */
    private isMaxTabsExceeded(): boolean {
        return this.state.tabs.size >= this.config.maxTabs
    }

    /**
     * 触发 Tab 事件
     * @param event 事件类型
     * @param data 事件数据
     */
    private emitTabEvent(event: TabEvent, data: Partial<TabEventData>): void {
        // 使用事件管理器触发事件
        this.eventManager.emitEvent(event, data)
        
        // 同时触发 EventEmitter 事件（保持向后兼容）
        this.emit(event, data)
    }

    // ==================== ITabManager 接口实现 ====================

    /**
     * 创建新的 Tab
     * @param url Tab 对应的 URL
     * @param options 创建选项
     * @returns 创建的 Tab ID
     */
    public createTab(url: string, options: TabCreateOptions = {}): string {
        const startTime = Date.now()
        AppUtil.info('TabManager', 'createTab', `创建 Tab: ${url}`, options)

        try {
            // 验证 URL
            if (!this.isValidUrl(url)) {
                throw new TabError(TabErrorType.INVALID_URL, `无效的 URL: ${url}`)
            }

            // 检查最大 Tab 数量限制
            if (this.isMaxTabsExceeded()) {
                throw new TabError(
                    TabErrorType.MAX_TABS_EXCEEDED, 
                    `已达到最大 Tab 数量限制: ${this.config.maxTabs}`
                )
            }

            // 生成 Tab ID
            const tabId = this.generateTabId(url)
            const now = Date.now()

            // 检查是否为用户中心 Tab
            const isUserCenter = options.isUserCenter || this.isUserCenterUrl(url)

            // 生成默认标题
            const defaultTitle = this.generateDefaultTitle(url, isUserCenter)

            // 创建 Tab 数据
            const tabItem: TabItem = {
                id: tabId,
                url,
                title: options.title || defaultTitle,
                isActive: false, // 稍后会设置为激活状态
                isPinned: options.isPinned || isUserCenter,
                isUserCenter,
                browserViewId: ECommon.ENone, // 稍后由 BvMgr 设置
                createdAt: now,
                lastActiveAt: now,
                isLoading: true,
                labels: {
                    ...options.labels,
                    creationSource: options.fromWindowOpen ? 'window.open' : 'direct',
                    creationTime: now
                }
            }

            // 添加到状态管理
            this.state.tabs.set(tabId, tabItem)

            // 处理用户中心 Tab
            if (isUserCenter) {
                this.state.userCenterTabId = tabId
            }

            // 处理 Tab 位置
            if (options.position !== 'background') {
                this.insertTabAtPosition(tabId, options.position)
            } else {
                // 'background' 表示添加到末尾但不激活
                this.insertTabAtPosition(tabId, 'last')
            }

            // 自动激活新创建的 Tab（除非明确指定不激活）
            if (options.position !== 'background') {
                this.switchToTab(tabId)
            }

            // 触发创建事件
            this.emitTabEvent(TabEvent.TAB_CREATED, { 
                tabId, 
                tabItem,
                creationTime: Date.now() - startTime
            })

            AppUtil.info('TabManager', 'createTab', `成功创建 Tab: ${tabId}，耗时: ${Date.now() - startTime}ms`)
            return tabId

        } catch (error) {
            AppUtil.error('TabManager', 'createTab', `创建 Tab 失败: ${url}`, error)
            throw error
        }
    }

    /**
     * 生成默认标题
     * @param url URL
     * @param isUserCenter 是否为用户中心
     * @returns 默认标题
     */
    private generateDefaultTitle(url: string, isUserCenter: boolean): string {
        if (isUserCenter) {
            return '用户中心'
        }

        try {
            const urlObj = new URL(url)
            const hostname = urlObj.hostname
            
            // 根据域名生成友好的标题
            if (hostname.includes('lceda.cn')) {
                return 'EDA 专业版'
            } else if (hostname.includes('jlcpcb.com')) {
                return 'JLCPCB'
            } else if (hostname.includes('szlcsc.com')) {
                return '立创商城'
            } else {
                return hostname
            }
        } catch {
            return '新标签页'
        }
    }

    /**
     * 在指定位置插入 Tab
     * @param tabId Tab ID
     * @param position 位置
     */
    private insertTabAtPosition(tabId: string, position?: 'first' | 'last' | number): void {
        const tabOrder = this.state.tabOrder

        if (position === 'first') {
            // 插入到第一个位置（用户中心 Tab 之后）
            const userCenterIndex = this.state.userCenterTabId ? 1 : 0
            tabOrder.splice(userCenterIndex, 0, tabId)
        } else if (position === 'last' || position === undefined) {
            // 插入到最后
            tabOrder.push(tabId)
        } else if (typeof position === 'number') {
            // 插入到指定位置
            const insertIndex = Math.max(0, Math.min(position, tabOrder.length))
            tabOrder.splice(insertIndex, 0, tabId)
        }
    }

    /**
     * 关闭指定的 Tab
     * @param tabId Tab ID
     * @returns 是否成功关闭
     */
    public closeTab(tabId: string): boolean {
        const startTime = Date.now()
        AppUtil.info('TabManager', 'closeTab', `关闭 Tab: ${tabId}`)

        try {
            const tabItem = this.state.tabs.get(tabId)
            if (!tabItem) {
                AppUtil.warn('TabManager', 'closeTab', `Tab 不存在: ${tabId}`)
                return false
            }

            // 检查是否为用户中心 Tab
            if (tabItem.isUserCenter) {
                AppUtil.warn('TabManager', 'closeTab', '不能关闭用户中心 Tab')
                throw new TabError(
                    TabErrorType.USER_CENTER_TAB_CLOSE_DENIED,
                    '用户中心标签页不能被关闭',
                    tabId
                )
            }

            // 检查是否为固定 Tab
            if (tabItem.isPinned && !tabItem.isUserCenter) {
                AppUtil.warn('TabManager', 'closeTab', `固定 Tab 不能关闭: ${tabId}`)
                return false
            }

            // 记录关闭前的状态
            const wasActive = tabItem.isActive
            const orderIndex = this.state.tabOrder.indexOf(tabId)

            // 从状态中移除
            this.state.tabs.delete(tabId)
            if (orderIndex !== -1) {
                this.state.tabOrder.splice(orderIndex, 1)
            }

            // 如果关闭的是当前激活的 Tab，需要切换到其他 Tab
            if (wasActive) {
                this.switchToNearbyTab(orderIndex)
            }

            // 触发关闭事件
            this.emitTabEvent(TabEvent.TAB_CLOSED, { 
                tabId, 
                tabItem,
                wasActive,
                closeTime: Date.now() - startTime
            })

            AppUtil.info('TabManager', 'closeTab', `成功关闭 Tab: ${tabId}，耗时: ${Date.now() - startTime}ms`)
            return true

        } catch (error) {
            AppUtil.error('TabManager', 'closeTab', `关闭 Tab 失败: ${tabId}`, error)
            throw error
        }
    }

    /**
     * 切换到附近的 Tab
     * @param closedIndex 被关闭的 Tab 的索引
     */
    private switchToNearbyTab(closedIndex: number): void {
        const tabOrder = this.state.tabOrder
        if (tabOrder.length === 0) {
            this.state.activeTabId = null
            return
        }

        // 优先选择右边的 Tab，如果没有则选择左边的
        let nextTabId: string
        if (closedIndex < tabOrder.length) {
            nextTabId = tabOrder[closedIndex]
        } else if (closedIndex > 0) {
            nextTabId = tabOrder[closedIndex - 1]
        } else {
            nextTabId = tabOrder[0]
        }

        this.switchToTab(nextTabId)
    }

    /**
     * 切换到指定的 Tab
     * @param tabId Tab ID
     */
    public switchToTab(tabId: string): void {
        const startTime = Date.now()
        AppUtil.info('TabManager', 'switchToTab', `切换到 Tab: ${tabId}`)

        try {
            const tabItem = this.state.tabs.get(tabId)
            if (!tabItem) {
                throw new TabError(TabErrorType.TAB_NOT_FOUND, `Tab 不存在: ${tabId}`, tabId)
            }

            // 如果已经是激活状态，直接返回
            if (this.state.activeTabId === tabId) {
                AppUtil.info('TabManager', 'switchToTab', `Tab 已经是激活状态: ${tabId}`)
                return
            }

            // 记录切换前的状态
            const previousActiveTabId = this.state.activeTabId
            const previousTab = previousActiveTabId ? this.state.tabs.get(previousActiveTabId) : null
            
            // 取消之前激活的 Tab
            if (previousTab) {
                previousTab.isActive = false
            }

            // 激活新的 Tab
            tabItem.isActive = true
            tabItem.lastActiveAt = Date.now()
            this.state.activeTabId = tabId

            // 性能优化：如果启用了切换动画，添加延迟处理
            const switchTime = Date.now() - startTime
            const shouldUseAnimation = this.config.tabSwitchAnimation && switchTime < 100

            // 触发激活事件
            this.emitTabEvent(TabEvent.TAB_ACTIVATED, { 
                tabId, 
                tabItem, 
                previousActiveTabId,
                switchTime,
                useAnimation: shouldUseAnimation
            })

            AppUtil.info('TabManager', 'switchToTab', `成功切换到 Tab: ${tabId}，耗时: ${switchTime}ms`)

        } catch (error) {
            AppUtil.error('TabManager', 'switchToTab', `切换 Tab 失败: ${tabId}`, error)
            throw error
        }
    }

    /**
     * 确保用户中心 Tab 存在，如不存在则创建
     * @returns 用户中心 Tab ID
     */
    public ensureUserCenterTab(): string {
        AppUtil.info('TabManager', 'ensureUserCenterTab', '检查用户中心 Tab 状态')

        // 检查现有的用户中心 Tab
        if (this.state.userCenterTabId) {
            const userCenterTab = this.state.tabs.get(this.state.userCenterTabId)
            if (userCenterTab && userCenterTab.isUserCenter) {
                // 验证用户中心 Tab 的位置是否正确
                this.ensureUserCenterTabPosition(this.state.userCenterTabId)
                AppUtil.info('TabManager', 'ensureUserCenterTab', '用户中心 Tab 已存在且位置正确')
                return this.state.userCenterTabId
            } else {
                // 清理无效的用户中心 Tab 引用
                AppUtil.warn('TabManager', 'ensureUserCenterTab', '发现无效的用户中心 Tab 引用，清理中')
                this.state.userCenterTabId = null
            }
        }

        // 搜索是否有其他用户中心 Tab
        const existingUserCenterTab = this.findExistingUserCenterTab()
        if (existingUserCenterTab) {
            AppUtil.info('TabManager', 'ensureUserCenterTab', `发现现有用户中心 Tab: ${existingUserCenterTab.id}`)
            this.state.userCenterTabId = existingUserCenterTab.id
            this.ensureUserCenterTabPosition(existingUserCenterTab.id)
            return existingUserCenterTab.id
        }

        // 创建新的用户中心 Tab
        AppUtil.info('TabManager', 'ensureUserCenterTab', '创建新的用户中心 Tab')
        const tabId = this.createUserCenterTab()
        
        return tabId
    }

    /**
     * 查找现有的用户中心 Tab
     * @returns 用户中心 Tab 或 null
     */
    private findExistingUserCenterTab(): TabItem | null {
        for (const [tabId, tabItem] of this.state.tabs) {
            if (tabItem.isUserCenter || this.isUserCenterUrl(tabItem.url)) {
                return tabItem
            }
        }
        return null
    }

    /**
     * 创建用户中心 Tab
     * @returns 用户中心 Tab ID
     */
    private createUserCenterTab(): string {
        const tabId = this.createTab(this.config.userCenterUrl, {
            title: '用户中心',
            isUserCenter: true,
            isPinned: true,
            position: 'first'
        })

        // 确保用户中心 Tab 在第一个位置
        this.ensureUserCenterTabPosition(tabId)
        
        return tabId
    }

    /**
     * 确保用户中心 Tab 在正确的位置（第一个位置）
     * @param userCenterTabId 用户中心 Tab ID
     */
    private ensureUserCenterTabPosition(userCenterTabId: string): void {
        const currentIndex = this.state.tabOrder.indexOf(userCenterTabId)
        if (currentIndex === -1) {
            AppUtil.warn('TabManager', 'ensureUserCenterTabPosition', `用户中心 Tab 不在顺序列表中: ${userCenterTabId}`)
            return
        }

        if (currentIndex !== 0) {
            AppUtil.info('TabManager', 'ensureUserCenterTabPosition', `移动用户中心 Tab 到第一个位置: ${currentIndex} -> 0`)
            
            // 移动到第一个位置
            this.state.tabOrder.splice(currentIndex, 1)
            this.state.tabOrder.unshift(userCenterTabId)

            // 触发顺序变更事件
            this.emitTabEvent(TabEvent.TAB_ORDER_CHANGED, {
                tabId: userCenterTabId,
                oldPosition: currentIndex,
                newPosition: 0,
                tabOrder: [...this.state.tabOrder],
                reason: 'user-center-position-fix'
            })
        }
    }

    /**
     * 获取用户中心 Tab ID
     * @returns 用户中心 Tab ID，如不存在返回空字符串
     */
    public getUserCenterTabId(): string {
        // 验证用户中心 Tab 的有效性
        if (this.state.userCenterTabId) {
            const userCenterTab = this.state.tabs.get(this.state.userCenterTabId)
            if (userCenterTab && userCenterTab.isUserCenter) {
                return this.state.userCenterTabId
            } else {
                // 清理无效引用
                AppUtil.warn('TabManager', 'getUserCenterTabId', '发现无效的用户中心 Tab 引用，清理中')
                this.state.userCenterTabId = null
            }
        }

        // 尝试查找现有的用户中心 Tab
        const existingUserCenterTab = this.findExistingUserCenterTab()
        if (existingUserCenterTab) {
            this.state.userCenterTabId = existingUserCenterTab.id
            return existingUserCenterTab.id
        }

        return ''
    }

    /**
     * 获取用户中心 Tab 数据
     * @returns 用户中心 Tab 数据，如不存在返回 null
     */
    public getUserCenterTab(): TabItem | null {
        const userCenterTabId = this.getUserCenterTabId()
        if (!userCenterTabId) {
            return null
        }
        return this.state.tabs.get(userCenterTabId) || null
    }

    /**
     * 检查用户中心 Tab 是否存在
     * @returns 是否存在用户中心 Tab
     */
    public hasUserCenterTab(): boolean {
        return this.getUserCenterTabId() !== ''
    }

    /**
     * 激活用户中心 Tab
     * @returns 是否成功激活
     */
    public activateUserCenterTab(): boolean {
        const userCenterTabId = this.getUserCenterTabId()
        if (!userCenterTabId) {
            AppUtil.warn('TabManager', 'activateUserCenterTab', '用户中心 Tab 不存在')
            return false
        }

        try {
            this.switchToTab(userCenterTabId)
            AppUtil.info('TabManager', 'activateUserCenterTab', '成功激活用户中心 Tab')
            return true
        } catch (error) {
            AppUtil.error('TabManager', 'activateUserCenterTab', '激活用户中心 Tab 失败', error)
            return false
        }
    }

    /**
     * 获取所有 Tab 数据
     * @returns Tab 数据数组
     */
    public getAllTabs(): TabItem[] {
        return this.state.tabOrder
            .map(tabId => this.state.tabs.get(tabId))
            .filter((tab): tab is TabItem => tab !== undefined)
    }

    /**
     * 获取当前激活的 Tab
     * @returns 激活的 Tab 数据，如无激活 Tab 返回 null
     */
    public getActiveTab(): TabItem | null {
        if (!this.state.activeTabId) {
            return null
        }
        return this.state.tabs.get(this.state.activeTabId) || null
    }

    /**
     * 根据 ID 获取 Tab 数据
     * @param tabId Tab ID
     * @returns Tab 数据，如不存在返回 null
     */
    public getTabById(tabId: string): TabItem | null {
        return this.state.tabs.get(tabId) || null
    }

    /**
     * 重新排列 Tab 顺序
     * @param tabId 要移动的 Tab ID
     * @param newPosition 新位置索引
     * @returns 是否成功重排
     */
    public reorderTab(tabId: string, newPosition: number): boolean {
        AppUtil.info('TabManager', 'reorderTab', `重排 Tab: ${tabId} -> ${newPosition}`)

        const tabItem = this.state.tabs.get(tabId)
        if (!tabItem) {
            AppUtil.warn('TabManager', 'reorderTab', `Tab 不存在: ${tabId}`)
            return false
        }

        // 用户中心 Tab 不能移动
        if (tabItem.isUserCenter) {
            AppUtil.warn('TabManager', 'reorderTab', '用户中心 Tab 不能移动')
            throw new TabError(
                TabErrorType.TAB_DRAG_DENIED,
                '用户中心标签页不能被移动',
                tabId
            )
        }

        // 固定 Tab 不能移动（除了用户中心 Tab）
        if (tabItem.isPinned) {
            AppUtil.warn('TabManager', 'reorderTab', `固定 Tab 不能移动: ${tabId}`)
            return false
        }

        const tabOrder = this.state.tabOrder
        const currentIndex = tabOrder.indexOf(tabId)
        if (currentIndex === -1) {
            AppUtil.warn('TabManager', 'reorderTab', `Tab 不在顺序列表中: ${tabId}`)
            return false
        }

        // 计算有效的新位置（考虑用户中心 Tab 和其他固定 Tab 的位置限制）
        const validNewPosition = this.calculateValidPosition(newPosition, tabId)
        
        // 如果位置没有变化，直接返回
        if (currentIndex === validNewPosition) {
            AppUtil.info('TabManager', 'reorderTab', `Tab 位置没有变化: ${tabId}`)
            return true
        }

        // 执行重排
        tabOrder.splice(currentIndex, 1)
        tabOrder.splice(validNewPosition, 0, tabId)

        // 验证用户中心 Tab 仍在第一个位置
        this.validateUserCenterTabPosition()

        // 触发顺序变更事件
        this.emitTabEvent(TabEvent.TAB_ORDER_CHANGED, { 
            tabId, 
            oldPosition: currentIndex, 
            newPosition: validNewPosition,
            tabOrder: [...tabOrder],
            reason: 'user-reorder'
        })

        AppUtil.info('TabManager', 'reorderTab', `成功重排 Tab: ${tabId} (${currentIndex} -> ${validNewPosition})`)
        return true
    }

    /**
     * 计算有效的 Tab 位置
     * @param requestedPosition 请求的位置
     * @param tabId Tab ID
     * @returns 有效的位置
     */
    private calculateValidPosition(requestedPosition: number, tabId: string): number {
        const tabOrder = this.state.tabOrder
        
        // 找到所有固定 Tab 的位置
        const pinnedPositions: number[] = []
        for (let i = 0; i < tabOrder.length; i++) {
            const tab = this.state.tabs.get(tabOrder[i])
            if (tab && tab.isPinned && tab.id !== tabId) {
                pinnedPositions.push(i)
            }
        }

        // 计算最小和最大有效位置
        const minPosition = pinnedPositions.length > 0 ? Math.max(...pinnedPositions) + 1 : 0
        const maxPosition = tabOrder.length - 1

        // 确保位置在有效范围内
        return Math.max(minPosition, Math.min(requestedPosition, maxPosition))
    }

    /**
     * 验证用户中心 Tab 位置
     */
    private validateUserCenterTabPosition(): void {
        if (!this.state.userCenterTabId) {
            return
        }

        const userCenterIndex = this.state.tabOrder.indexOf(this.state.userCenterTabId)
        if (userCenterIndex !== 0) {
            AppUtil.warn('TabManager', 'validateUserCenterTabPosition', 
                `用户中心 Tab 位置异常: ${userCenterIndex}，自动修复中`)
            this.ensureUserCenterTabPosition(this.state.userCenterTabId)
        }
    }

    /**
     * 获取 Tab 顺序数组
     * @returns Tab ID 顺序数组
     */
    public getTabOrder(): string[] {
        return [...this.state.tabOrder]
    }

    /**
     * 处理 window.open 调用
     * @param url 目标 URL
     * @param target 目标窗口名称
     */
    public handleWindowOpen(url: string, target?: string): void {
        AppUtil.info('TabManager', 'handleWindowOpen', `处理 window.open: ${url}`, { target })
        
        try {
            // 验证 URL
            if (!this.isValidUrl(url)) {
                AppUtil.warn('TabManager', 'handleWindowOpen', `无效的 URL: ${url}`)
                return
            }

            // 检查是否为外部链接
            if (this.isExternalLink(url)) {
                AppUtil.info('TabManager', 'handleWindowOpen', `外部链接，使用系统浏览器打开: ${url}`)
                this.openInExternalBrowser(url)
                return
            }

            // 检查是否为特殊目标
            if (target === '_self') {
                // 在当前 Tab 中打开
                const activeTab = this.getActiveTab()
                if (activeTab) {
                    this.navigateTab(activeTab.id, url)
                    return
                }
            }

            // 创建新 Tab
            this.createTab(url, {
                fromWindowOpen: true,
                position: 'last',
                labels: { 
                    source: 'window.open',
                    target: target || '_blank',
                    originalUrl: url
                }
            })

        } catch (error) {
            AppUtil.error('TabManager', 'handleWindowOpen', `处理 window.open 失败: ${url}`, error)
        }
    }

    /**
     * 检查是否为外部链接
     * @param url 要检查的 URL
     * @returns 是否为外部链接
     */
    private isExternalLink(url: string): boolean {
        if (!this.config.allowExternalLinks) {
            return false
        }

        try {
            const urlObj = new URL(url)
            const hostname = urlObj.hostname.toLowerCase()
            
            // 检查是否在白名单中
            return !this.config.externalLinkDomains.some(domain => 
                hostname === domain.toLowerCase() || 
                hostname.endsWith('.' + domain.toLowerCase())
            )
        } catch {
            return true // 无效 URL 视为外部链接
        }
    }

    /**
     * 在外部浏览器中打开链接
     * @param url 要打开的 URL
     */
    private openInExternalBrowser(url: string): void {
        // 这里需要调用 Electron 的 shell.openExternal
        // 暂时记录日志，具体实现将在后续任务中完成
        AppUtil.info('TabManager', 'openInExternalBrowser', `需要在外部浏览器打开: ${url}`)
        
        // TODO: 实现外部浏览器打开逻辑
        // const { shell } = require('electron')
        // shell.openExternal(url)
    }

    /**
     * 导航 Tab 到新 URL
     * @param tabId Tab ID
     * @param url 新 URL
     */
    private navigateTab(tabId: string, url: string): void {
        const tabItem = this.state.tabs.get(tabId)
        if (!tabItem) {
            AppUtil.warn('TabManager', 'navigateTab', `Tab 不存在: ${tabId}`)
            return
        }

        const oldUrl = tabItem.url
        tabItem.url = url
        tabItem.isLoading = true
        tabItem.lastActiveAt = Date.now()

        // 更新标题为加载状态
        const oldTitle = tabItem.title
        tabItem.title = '加载中...'

        AppUtil.info('TabManager', 'navigateTab', `导航 Tab: ${tabId} 从 ${oldUrl} 到 ${url}`)

        // 触发导航事件（自定义事件）
        this.emit('tab:navigate', {
            tabId,
            oldUrl,
            newUrl: url,
            oldTitle
        })
    }

    /**
     * 更新 Tab 标题
     * @param tabId Tab ID
     * @param title 新标题
     */
    public updateTabTitle(tabId: string, title: string): void {
        const tabItem = this.state.tabs.get(tabId)
        if (!tabItem) {
            AppUtil.warn('TabManager', 'updateTabTitle', `Tab 不存在: ${tabId}`)
            return
        }

        const oldTitle = tabItem.title
        tabItem.title = title

        // 触发标题变更事件
        this.emitTabEvent(TabEvent.TAB_TITLE_CHANGED, { 
            tabId, 
            oldTitle, 
            newTitle: title 
        })

        AppUtil.info('TabManager', 'updateTabTitle', `更新 Tab 标题: ${tabId} -> ${title}`)
    }

    /**
     * 设置 Tab 加载状态
     * @param tabId Tab ID
     * @param isLoading 是否正在加载
     */
    public setTabLoading(tabId: string, isLoading: boolean): void {
        const tabItem = this.state.tabs.get(tabId)
        if (!tabItem) {
            AppUtil.warn('TabManager', 'setTabLoading', `Tab 不存在: ${tabId}`)
            return
        }

        tabItem.isLoading = isLoading

        // 触发加载状态事件
        const event = isLoading ? TabEvent.TAB_LOADING_START : TabEvent.TAB_LOADING_END
        this.emitTabEvent(event, { tabId, isLoading })

        AppUtil.info('TabManager', 'setTabLoading', `设置 Tab 加载状态: ${tabId} -> ${isLoading}`)
    }

    /**
     * 销毁 Tab 管理器，清理所有资源
     */
    public destroy(): void {
        AppUtil.info('TabManager', 'destroy', '销毁 Tab 管理器')

        // 销毁事件管理器
        this.eventManager.destroy()

        // 清理所有事件监听器
        this.removeAllListeners()

        // 清理状态
        this.state.tabs.clear()
        this.state.tabOrder = []
        this.state.activeTabId = null
        this.state.userCenterTabId = null
        this.state.dragState = {
            isDragging: false,
            dragTabId: null,
            dragPreviewElement: null,
            dropIndicatorPosition: null,
            originalPosition: 0
        }

        AppUtil.info('TabManager', 'destroy', 'Tab 管理器已销毁')
    }

    // ==================== 内部状态访问方法（用于调试和测试） ====================

    /**
     * 获取内部状态（仅用于调试和测试）
     * @returns Tab 状态
     */
    public getState(): TabState {
        return {
            tabs: new Map(this.state.tabs),
            activeTabId: this.state.activeTabId,
            userCenterTabId: this.state.userCenterTabId,
            tabOrder: [...this.state.tabOrder],
            dragState: { ...this.state.dragState }
        }
    }

    /**
     * 获取配置（仅用于调试和测试）
     * @returns Tab 配置
     */
    public getConfig(): TabConfig {
        return { ...this.config }
    }

    // ==================== 额外的生命周期管理方法 ====================

    /**
     * 批量创建 Tab
     * @param urls URL 数组
     * @param options 创建选项
     * @returns 创建的 Tab ID 数组
     */
    public createMultipleTabs(urls: string[], options: TabCreateOptions = {}): string[] {
        AppUtil.info('TabManager', 'createMultipleTabs', `批量创建 ${urls.length} 个 Tab`)
        
        const tabIds: string[] = []
        const errors: string[] = []

        for (const url of urls) {
            try {
                const tabId = this.createTab(url, {
                    ...options,
                    position: 'background' // 批量创建时不自动激活
                })
                tabIds.push(tabId)
            } catch (error) {
                errors.push(`创建 Tab 失败 (${url}): ${error.message}`)
                AppUtil.error('TabManager', 'createMultipleTabs', `创建 Tab 失败: ${url}`, error)
            }
        }

        if (errors.length > 0) {
            AppUtil.warn('TabManager', 'createMultipleTabs', `批量创建完成，${errors.length} 个失败`, errors)
        }

        return tabIds
    }

    /**
     * 关闭所有 Tab（除了用户中心 Tab）
     * @returns 关闭的 Tab 数量
     */
    public closeAllTabs(): number {
        AppUtil.info('TabManager', 'closeAllTabs', '关闭所有 Tab')
        
        const tabsToClose = this.getAllTabs().filter(tab => !tab.isUserCenter && !tab.isPinned)
        let closedCount = 0

        for (const tab of tabsToClose) {
            try {
                if (this.closeTab(tab.id)) {
                    closedCount++
                }
            } catch (error) {
                AppUtil.error('TabManager', 'closeAllTabs', `关闭 Tab 失败: ${tab.id}`, error)
            }
        }

        AppUtil.info('TabManager', 'closeAllTabs', `成功关闭 ${closedCount} 个 Tab`)
        return closedCount
    }

    /**
     * 关闭其他 Tab（保留指定的 Tab）
     * @param keepTabId 要保留的 Tab ID
     * @returns 关闭的 Tab 数量
     */
    public closeOtherTabs(keepTabId: string): number {
        AppUtil.info('TabManager', 'closeOtherTabs', `关闭除 ${keepTabId} 外的其他 Tab`)
        
        const tabsToClose = this.getAllTabs().filter(tab => 
            tab.id !== keepTabId && !tab.isUserCenter && !tab.isPinned
        )
        let closedCount = 0

        for (const tab of tabsToClose) {
            try {
                if (this.closeTab(tab.id)) {
                    closedCount++
                }
            } catch (error) {
                AppUtil.error('TabManager', 'closeOtherTabs', `关闭 Tab 失败: ${tab.id}`, error)
            }
        }

        AppUtil.info('TabManager', 'closeOtherTabs', `成功关闭 ${closedCount} 个 Tab`)
        return closedCount
    }

    /**
     * 刷新指定的 Tab
     * @param tabId Tab ID
     */
    public refreshTab(tabId: string): void {
        const tabItem = this.state.tabs.get(tabId)
        if (!tabItem) {
            AppUtil.warn('TabManager', 'refreshTab', `Tab 不存在: ${tabId}`)
            return
        }

        AppUtil.info('TabManager', 'refreshTab', `刷新 Tab: ${tabId}`)
        
        // 设置加载状态
        tabItem.isLoading = true
        tabItem.lastActiveAt = Date.now()

        // 触发刷新事件
        this.emit('tab:refresh', { tabId, tabItem })
    }

    /**
     * 复制 Tab
     * @param tabId 要复制的 Tab ID
     * @returns 新 Tab ID
     */
    public duplicateTab(tabId: string): string | null {
        const tabItem = this.state.tabs.get(tabId)
        if (!tabItem) {
            AppUtil.warn('TabManager', 'duplicateTab', `Tab 不存在: ${tabId}`)
            return null
        }

        AppUtil.info('TabManager', 'duplicateTab', `复制 Tab: ${tabId}`)

        try {
            const newTabId = this.createTab(tabItem.url, {
                title: tabItem.title + ' (副本)',
                labels: {
                    ...tabItem.labels,
                    duplicatedFrom: tabId,
                    duplicatedAt: Date.now()
                }
            })

            return newTabId
        } catch (error) {
            AppUtil.error('TabManager', 'duplicateTab', `复制 Tab 失败: ${tabId}`, error)
            return null
        }
    }

    /**
     * 获取 Tab 统计信息
     * @returns Tab 统计信息
     */
    public getTabStats(): {
        total: number
        active: number
        pinned: number
        loading: number
        userCenter: number
    } {
        const tabs = this.getAllTabs()
        
        return {
            total: tabs.length,
            active: tabs.filter(tab => tab.isActive).length,
            pinned: tabs.filter(tab => tab.isPinned).length,
            loading: tabs.filter(tab => tab.isLoading).length,
            userCenter: tabs.filter(tab => tab.isUserCenter).length
        }
    }

    // ==================== 用户中心 Tab 特殊管理功能 ====================

    /**
     * 修复用户中心 Tab 状态
     * 检查并修复用户中心 Tab 的各种异常状态
     * @returns 修复报告
     */
    public repairUserCenterTab(): {
        fixed: boolean
        issues: string[]
        actions: string[]
    } {
        AppUtil.info('TabManager', 'repairUserCenterTab', '开始修复用户中心 Tab 状态')
        
        const issues: string[] = []
        const actions: string[] = []
        let fixed = false

        // 检查用户中心 Tab 是否存在
        const userCenterTabId = this.state.userCenterTabId
        const userCenterTab = userCenterTabId ? this.state.tabs.get(userCenterTabId) : null

        if (!userCenterTab) {
            issues.push('用户中心 Tab 不存在')
            const newTabId = this.ensureUserCenterTab()
            actions.push(`创建新的用户中心 Tab: ${newTabId}`)
            fixed = true
        } else {
            // 检查用户中心 Tab 的属性
            if (!userCenterTab.isUserCenter) {
                issues.push('用户中心 Tab 标记错误')
                userCenterTab.isUserCenter = true
                actions.push('修复用户中心标记')
                fixed = true
            }

            if (!userCenterTab.isPinned) {
                issues.push('用户中心 Tab 未固定')
                userCenterTab.isPinned = true
                actions.push('设置用户中心 Tab 为固定')
                fixed = true
            }

            // 检查位置
            const currentIndex = this.state.tabOrder.indexOf(userCenterTabId)
            if (currentIndex !== 0) {
                issues.push(`用户中心 Tab 位置错误: ${currentIndex}`)
                this.ensureUserCenterTabPosition(userCenterTabId)
                actions.push('修复用户中心 Tab 位置')
                fixed = true
            }

            // 检查 URL
            if (!this.isUserCenterUrl(userCenterTab.url)) {
                issues.push(`用户中心 Tab URL 错误: ${userCenterTab.url}`)
                userCenterTab.url = this.config.userCenterUrl
                actions.push('修复用户中心 Tab URL')
                fixed = true
            }
        }

        const report = { fixed, issues, actions }
        AppUtil.info('TabManager', 'repairUserCenterTab', '修复完成', report)
        
        if (fixed) {
            // 触发修复事件
            this.emit('tab:user-center-repaired', report)
        }

        return report
    }

    /**
     * 监控用户中心 Tab 状态
     * 定期检查用户中心 Tab 的状态并自动修复
     */
    public startUserCenterTabMonitoring(): void {
        AppUtil.info('TabManager', 'startUserCenterTabMonitoring', '开始监控用户中心 Tab 状态')
        
        // 每30秒检查一次用户中心 Tab 状态
        const monitoringInterval = setInterval(() => {
            try {
                const report = this.repairUserCenterTab()
                if (report.fixed) {
                    AppUtil.warn('TabManager', 'monitoring', '检测到用户中心 Tab 异常并已修复', report)
                }
            } catch (error) {
                AppUtil.error('TabManager', 'monitoring', '用户中心 Tab 监控出错', error)
            }
        }, 30000)

        // 保存监控定时器引用（用于清理）
        this.emit('tab:monitoring-started', { interval: monitoringInterval })
    }

    /**
     * 强制重置用户中心 Tab
     * 删除现有的用户中心 Tab 并重新创建
     * @returns 新的用户中心 Tab ID
     */
    public resetUserCenterTab(): string {
        AppUtil.info('TabManager', 'resetUserCenterTab', '强制重置用户中心 Tab')
        
        // 删除现有的用户中心 Tab（如果存在）
        if (this.state.userCenterTabId) {
            const userCenterTab = this.state.tabs.get(this.state.userCenterTabId)
            if (userCenterTab) {
                // 临时允许删除用户中心 Tab
                userCenterTab.isUserCenter = false
                userCenterTab.isPinned = false
                
                try {
                    this.closeTab(this.state.userCenterTabId)
                } catch (error) {
                    // 强制删除
                    this.state.tabs.delete(this.state.userCenterTabId)
                    const orderIndex = this.state.tabOrder.indexOf(this.state.userCenterTabId)
                    if (orderIndex !== -1) {
                        this.state.tabOrder.splice(orderIndex, 1)
                    }
                }
            }
            this.state.userCenterTabId = null
        }

        // 创建新的用户中心 Tab
        const newTabId = this.ensureUserCenterTab()
        
        AppUtil.info('TabManager', 'resetUserCenterTab', `重置完成，新 Tab ID: ${newTabId}`)
        return newTabId
    }

    /**
     * 检查 Tab 管理器的完整性
     * @returns 完整性检查报告
     */
    public checkIntegrity(): {
        isValid: boolean
        errors: string[]
        warnings: string[]
    } {
        const errors: string[] = []
        const warnings: string[] = []

        // 检查用户中心 Tab
        const userCenterTabId = this.state.userCenterTabId
        if (!userCenterTabId) {
            errors.push('缺少用户中心 Tab')
        } else {
            const userCenterTab = this.state.tabs.get(userCenterTabId)
            if (!userCenterTab) {
                errors.push('用户中心 Tab 引用无效')
            } else {
                if (!userCenterTab.isUserCenter) {
                    errors.push('用户中心 Tab 标记错误')
                }
                if (!userCenterTab.isPinned) {
                    warnings.push('用户中心 Tab 未固定')
                }
                
                const position = this.state.tabOrder.indexOf(userCenterTabId)
                if (position !== 0) {
                    errors.push(`用户中心 Tab 位置错误: ${position}`)
                }
            }
        }

        // 检查 Tab 顺序一致性
        for (const tabId of this.state.tabOrder) {
            if (!this.state.tabs.has(tabId)) {
                errors.push(`Tab 顺序中包含不存在的 Tab: ${tabId}`)
            }
        }

        for (const [tabId] of this.state.tabs) {
            if (!this.state.tabOrder.includes(tabId)) {
                errors.push(`Tab 存在但不在顺序列表中: ${tabId}`)
            }
        }

        // 检查激活状态
        const activeTabs = Array.from(this.state.tabs.values()).filter(tab => tab.isActive)
        if (activeTabs.length > 1) {
            errors.push(`多个 Tab 处于激活状态: ${activeTabs.length}`)
        }

        if (this.state.activeTabId && !this.state.tabs.has(this.state.activeTabId)) {
            errors.push(`激活的 Tab 不存在: ${this.state.activeTabId}`)
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    // ==================== 事件管理器访问方法 ====================

    /**
     * 获取事件管理器
     * @returns Tab 事件管理器实例
     */
    public getEventManager(): TabEventManager {
        return this.eventManager
    }

    /**
     * 添加事件监听器（使用事件管理器）
     * @param event 事件类型
     * @param handler 处理函数
     * @param options 监听器选项
     * @returns 监听器 ID
     */
    public addEventListener(
        event: TabEvent, 
        handler: (data: TabEventData) => void,
        options?: { once?: boolean; priority?: number; id?: string }
    ): string {
        return this.eventManager.addEventListener(event, handler, options)
    }

    /**
     * 移除事件监听器（使用事件管理器）
     * @param event 事件类型
     * @param listenerId 监听器 ID 或处理函数
     * @returns 是否成功移除
     */
    public removeEventListener(event: TabEvent, listenerId: string | Function): boolean {
        return this.eventManager.removeEventListener(event, listenerId)
    }

    /**
     * 添加一次性事件监听器
     * @param event 事件类型
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onceEvent(event: TabEvent, handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onceEvent(event, handler, priority)
    }

    /**
     * 获取事件统计信息
     * @param event 事件类型（可选）
     * @returns 事件统计信息
     */
    public getEventStats(event?: TabEvent) {
        return this.eventManager.getEventStats(event)
    }

    /**
     * 获取事件监听器信息
     * @param event 事件类型（可选）
     * @returns 监听器信息
     */
    public getEventListeners(event?: TabEvent) {
        return this.eventManager.getListeners(event)
    }

    /**
     * 清除事件监听器
     * @param event 事件类型（可选，如果不指定则清除所有）
     */
    public clearEventListeners(event?: TabEvent): void {
        this.eventManager.clearListeners(event)
    }

    // ==================== 便捷的事件监听方法 ====================

    /**
     * 监听 Tab 创建事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabCreated(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabCreated(handler, priority)
    }

    /**
     * 监听 Tab 关闭事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabClosed(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabClosed(handler, priority)
    }

    /**
     * 监听 Tab 激活事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabActivated(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabActivated(handler, priority)
    }

    /**
     * 监听 Tab 标题变更事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabTitleChanged(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabTitleChanged(handler, priority)
    }

    /**
     * 监听 Tab 顺序变更事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabOrderChanged(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabOrderChanged(handler, priority)
    }

    /**
     * 监听 Tab 加载开始事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabLoadingStart(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabLoadingStart(handler, priority)
    }

    /**
     * 监听 Tab 加载结束事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabLoadingEnd(handler: (data: TabEventData) => void, priority?: number): string {
        return this.eventManager.onTabLoadingEnd(handler, priority)
    }
}