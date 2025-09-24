/**
 * Tab 拖拽处理器
 * 负责处理 Tab 的拖拽重排功能
 */

import { TabItem } from '../../types'
import { TabIPCClient } from '../TabIPCClient'

/**
 * 拖拽状态接口
 */
interface DragState {
    /** 是否正在拖拽 */
    isDragging: boolean
    /** 拖拽的 Tab ID */
    dragTabId: string | null
    /** 拖拽的 Tab 数据 */
    dragTab: TabItem | null
    /** 拖拽开始位置 */
    startPosition: { x: number; y: number }
    /** 当前鼠标位置 */
    currentPosition: { x: number; y: number }
    /** 拖拽预览元素 */
    dragPreview: HTMLElement | null
    /** 拖拽指示器元素 */
    dropIndicator: HTMLElement | null
    /** 目标插入位置 */
    dropPosition: number
    /** 原始位置 */
    originalPosition: number
    /** Tab 容器元素 */
    tabContainer: HTMLElement | null
}

/**
 * 拖拽事件类型
 */
export enum TabDragEvent {
    DRAG_START = 'drag-start',
    DRAG_MOVE = 'drag-move',
    DRAG_END = 'drag-end',
    DROP = 'drop'
}

/**
 * 拖拽事件数据
 */
export interface TabDragEventData {
    tabId: string
    event: TabDragEvent
    position?: { x: number; y: number }
    dropPosition?: number
    originalPosition?: number
    tab?: TabItem
}

/**
 * 拖拽事件监听器
 */
export type TabDragListener = (data: TabDragEventData) => void

/**
 * Tab 拖拽处理器类
 */
export class TabDragHandler {
    /** IPC 客户端 */
    private ipcClient: TabIPCClient
    
    /** 当前 Tab 数据 */
    private tabs: Map<string, TabItem> = new Map()
    
    /** Tab 顺序 */
    private tabOrder: string[] = []
    
    /** 用户中心 Tab ID */
    private userCenterTabId: string | null = null
    
    /** 拖拽状态 */
    private dragState: DragState = this.createInitialDragState()
    
    /** 事件监听器 */
    private listeners: Map<TabDragEvent, TabDragListener[]> = new Map()
    
    /** 配置选项 */
    private options = {
        dragThreshold: 5, // 拖拽阈值（像素）
        animationDuration: 300, // 动画持续时间（毫秒）
        enableDragPreview: true, // 启用拖拽预览
        enableDropIndicator: true, // 启用拖拽指示器
        enableAutoScroll: true, // 启用自动滚动
        scrollSpeed: 10, // 滚动速度
        scrollZone: 50 // 滚动区域大小（像素）
    }

    constructor(ipcClient: TabIPCClient, options?: Partial<typeof TabDragHandler.prototype.options>) {
        this.ipcClient = ipcClient
        
        if (options) {
            this.options = { ...this.options, ...options }
        }
        
        this.setupGlobalEventListeners()
        console.log('TabDragHandler', '初始化拖拽处理器')
    }

    /**
     * 创建初始拖拽状态
     * @returns 初始拖拽状态
     */
    private createInitialDragState(): DragState {
        return {
            isDragging: false,
            dragTabId: null,
            dragTab: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            dragPreview: null,
            dropIndicator: null,
            dropPosition: -1,
            originalPosition: -1,
            tabContainer: null
        }
    }

    /**
     * 设置全局事件监听器
     */
    private setupGlobalEventListeners(): void {
        // 全局鼠标移动事件
        document.addEventListener('mousemove', (event) => {
            if (this.dragState.isDragging) {
                this.handleDragMove(event)
            }
        })

        // 全局鼠标释放事件
        document.addEventListener('mouseup', (event) => {
            if (this.dragState.isDragging) {
                this.handleDragEnd(event)
            }
        })

        // 防止默认拖拽行为
        document.addEventListener('dragstart', (event) => {
            if (this.dragState.isDragging) {
                event.preventDefault()
            }
        })
    }

    /**
     * 更新 Tab 数据
     * @param tabs Tab 数据数组
     * @param tabOrder Tab 顺序
     * @param userCenterTabId 用户中心 Tab ID
     */
    public updateTabs(tabs: TabItem[], tabOrder: string[], userCenterTabId: string | null): void {
        this.tabs.clear()
        tabs.forEach(tab => {
            this.tabs.set(tab.id, tab)
        })
        this.tabOrder = [...tabOrder]
        this.userCenterTabId = userCenterTabId
    }

    /**
     * 开始拖拽
     * @param tabId Tab ID
     * @param event 鼠标事件
     * @param tabElement Tab 元素
     * @param containerElement 容器元素
     */
    public startDrag(tabId: string, event: MouseEvent, tabElement: HTMLElement, containerElement: HTMLElement): void {
        const tab = this.tabs.get(tabId)
        if (!tab) {
            console.warn('TabDragHandler', 'Tab 不存在', { tabId })
            return
        }

        // 检查是否为用户中心 Tab
        if (tabId === this.userCenterTabId) {
            console.warn('TabDragHandler', '用户中心 Tab 不能拖拽')
            return
        }

        // 检查是否为固定 Tab
        if (tab.isPinned && !tab.isUserCenter) {
            console.warn('TabDragHandler', '固定 Tab 不能拖拽')
            return
        }

        // 初始化拖拽状态
        const originalPosition = this.tabOrder.indexOf(tabId)
        this.dragState = {
            isDragging: true,
            dragTabId: tabId,
            dragTab: tab,
            startPosition: { x: event.clientX, y: event.clientY },
            currentPosition: { x: event.clientX, y: event.clientY },
            dragPreview: null,
            dropIndicator: null,
            dropPosition: originalPosition,
            originalPosition,
            tabContainer: containerElement
        }

        // 创建拖拽预览
        if (this.options.enableDragPreview) {
            this.createDragPreview(tabElement, event)
        }

        // 创建拖拽指示器
        if (this.options.enableDropIndicator) {
            this.createDropIndicator(containerElement)
        }

        // 添加拖拽样式
        document.body.classList.add('tab-dragging')
        tabElement.classList.add('tab-item--dragging')

        // 触发拖拽开始事件
        this.emitDragEvent({
            tabId,
            event: TabDragEvent.DRAG_START,
            position: this.dragState.startPosition,
            originalPosition,
            tab
        })

        console.log('TabDragHandler', '开始拖拽', { tabId, originalPosition })
    }

    /**
     * 创建拖拽预览
     * @param tabElement Tab 元素
     * @param event 鼠标事件
     */
    private createDragPreview(tabElement: HTMLElement, event: MouseEvent): void {
        const preview = tabElement.cloneNode(true) as HTMLElement
        preview.classList.add('tab-drag-preview')
        preview.style.position = 'fixed'
        preview.style.pointerEvents = 'none'
        preview.style.zIndex = '10000'
        preview.style.opacity = '0.8'
        preview.style.transform = 'rotate(5deg)'
        preview.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        
        // 设置初始位置
        const rect = tabElement.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        
        preview.style.left = `${event.clientX - offsetX}px`
        preview.style.top = `${event.clientY - offsetY}px`
        preview.style.width = `${rect.width}px`
        preview.style.height = `${rect.height}px`

        document.body.appendChild(preview)
        this.dragState.dragPreview = preview
    }

    /**
     * 创建拖拽指示器
     * @param containerElement 容器元素
     */
    private createDropIndicator(containerElement: HTMLElement): void {
        const indicator = document.createElement('div')
        indicator.className = 'tab-drop-indicator'
        indicator.style.position = 'absolute'
        indicator.style.top = '0'
        indicator.style.bottom = '0'
        indicator.style.width = '2px'
        indicator.style.backgroundColor = '#007bff'
        indicator.style.zIndex = '1000'
        indicator.style.display = 'none'
        indicator.style.transition = `left ${this.options.animationDuration}ms ease`

        containerElement.appendChild(indicator)
        this.dragState.dropIndicator = indicator
    }

    /**
     * 处理拖拽移动
     * @param event 鼠标事件
     */
    private handleDragMove(event: MouseEvent): void {
        if (!this.dragState.isDragging || !this.dragState.dragTabId) {
            return
        }

        // 更新当前位置
        this.dragState.currentPosition = { x: event.clientX, y: event.clientY }

        // 检查是否超过拖拽阈值
        const distance = this.calculateDistance(this.dragState.startPosition, this.dragState.currentPosition)
        if (distance < this.options.dragThreshold) {
            return
        }

        // 更新拖拽预览位置
        this.updateDragPreview(event)

        // 计算拖拽位置
        const dropPosition = this.calculateDropPosition(event)
        if (dropPosition !== this.dragState.dropPosition) {
            this.dragState.dropPosition = dropPosition
            this.updateDropIndicator(dropPosition)
        }

        // 处理自动滚动
        if (this.options.enableAutoScroll) {
            this.handleAutoScroll(event)
        }

        // 触发拖拽移动事件
        this.emitDragEvent({
            tabId: this.dragState.dragTabId,
            event: TabDragEvent.DRAG_MOVE,
            position: this.dragState.currentPosition,
            dropPosition,
            tab: this.dragState.dragTab!
        })
    }

    /**
     * 更新拖拽预览位置
     * @param event 鼠标事件
     */
    private updateDragPreview(event: MouseEvent): void {
        if (!this.dragState.dragPreview) {
            return
        }

        const preview = this.dragState.dragPreview
        const rect = preview.getBoundingClientRect()
        const offsetX = rect.width / 2
        const offsetY = rect.height / 2

        preview.style.left = `${event.clientX - offsetX}px`
        preview.style.top = `${event.clientY - offsetY}px`
    }

    /**
     * 计算拖拽位置
     * @param event 鼠标事件
     * @returns 拖拽位置索引
     */
    private calculateDropPosition(event: MouseEvent): number {
        if (!this.dragState.tabContainer) {
            return -1
        }

        const containerRect = this.dragState.tabContainer.getBoundingClientRect()
        const relativeX = event.clientX - containerRect.left

        // 获取所有 Tab 元素
        const tabElements = this.dragState.tabContainer.querySelectorAll('.tab-item:not(.tab-item--dragging)')
        
        // 计算插入位置
        let dropPosition = 0
        for (let i = 0; i < tabElements.length; i++) {
            const tabElement = tabElements[i] as HTMLElement
            const tabRect = tabElement.getBoundingClientRect()
            const tabCenterX = tabRect.left + tabRect.width / 2 - containerRect.left

            if (relativeX < tabCenterX) {
                dropPosition = i
                break
            }
            dropPosition = i + 1
        }

        // 考虑用户中心 Tab 的位置限制
        if (this.userCenterTabId) {
            const userCenterIndex = this.tabOrder.indexOf(this.userCenterTabId)
            if (userCenterIndex >= 0) {
                dropPosition = Math.max(dropPosition, userCenterIndex + 1)
            }
        }

        return dropPosition
    }

    /**
     * 更新拖拽指示器
     * @param dropPosition 拖拽位置
     */
    private updateDropIndicator(dropPosition: number): void {
        if (!this.dragState.dropIndicator || !this.dragState.tabContainer) {
            return
        }

        const indicator = this.dragState.dropIndicator
        const tabElements = this.dragState.tabContainer.querySelectorAll('.tab-item:not(.tab-item--dragging)')

        if (dropPosition >= tabElements.length) {
            // 插入到最后
            const lastTab = tabElements[tabElements.length - 1] as HTMLElement
            if (lastTab) {
                const rect = lastTab.getBoundingClientRect()
                const containerRect = this.dragState.tabContainer.getBoundingClientRect()
                indicator.style.left = `${rect.right - containerRect.left}px`
            }
        } else {
            // 插入到指定位置
            const targetTab = tabElements[dropPosition] as HTMLElement
            if (targetTab) {
                const rect = targetTab.getBoundingClientRect()
                const containerRect = this.dragState.tabContainer.getBoundingClientRect()
                indicator.style.left = `${rect.left - containerRect.left}px`
            }
        }

        indicator.style.display = 'block'
    }

    /**
     * 处理自动滚动
     * @param event 鼠标事件
     */
    private handleAutoScroll(event: MouseEvent): void {
        if (!this.dragState.tabContainer) {
            return
        }

        const containerRect = this.dragState.tabContainer.getBoundingClientRect()
        const scrollLeft = this.dragState.tabContainer.scrollLeft
        const scrollWidth = this.dragState.tabContainer.scrollWidth
        const clientWidth = this.dragState.tabContainer.clientWidth

        // 检查是否需要向左滚动
        if (event.clientX - containerRect.left < this.options.scrollZone && scrollLeft > 0) {
            this.dragState.tabContainer.scrollLeft = Math.max(0, scrollLeft - this.options.scrollSpeed)
        }
        // 检查是否需要向右滚动
        else if (containerRect.right - event.clientX < this.options.scrollZone && scrollLeft < scrollWidth - clientWidth) {
            this.dragState.tabContainer.scrollLeft = Math.min(scrollWidth - clientWidth, scrollLeft + this.options.scrollSpeed)
        }
    }

    /**
     * 处理拖拽结束
     * @param event 鼠标事件
     */
    private async handleDragEnd(event: MouseEvent): Promise<void> {
        if (!this.dragState.isDragging || !this.dragState.dragTabId) {
            return
        }

        const { dragTabId, dropPosition, originalPosition, dragTab } = this.dragState

        // 清理拖拽状态
        this.cleanupDragState()

        // 检查是否需要重排
        if (dropPosition !== -1 && dropPosition !== originalPosition) {
            try {
                const result = await this.ipcClient.reorderTab(dragTabId, dropPosition)
                if (result.success) {
                    // 触发拖拽完成事件
                    this.emitDragEvent({
                        tabId: dragTabId,
                        event: TabDragEvent.DROP,
                        position: { x: event.clientX, y: event.clientY },
                        dropPosition,
                        originalPosition,
                        tab: dragTab!
                    })
                } else {
                    console.error('TabDragHandler', '重排 Tab 失败', result.error)
                }
            } catch (error) {
                console.error('TabDragHandler', '重排 Tab 出错', error)
            }
        }

        // 触发拖拽结束事件
        this.emitDragEvent({
            tabId: dragTabId,
            event: TabDragEvent.DRAG_END,
            position: { x: event.clientX, y: event.clientY },
            dropPosition,
            originalPosition,
            tab: dragTab!
        })

        console.log('TabDragHandler', '拖拽结束', { dragTabId, dropPosition, originalPosition })
    }

    /**
     * 清理拖拽状态
     */
    private cleanupDragState(): void {
        // 移除拖拽样式
        document.body.classList.remove('tab-dragging')
        
        // 移除拖拽中的 Tab 样式
        const draggingTab = document.querySelector('.tab-item--dragging')
        if (draggingTab) {
            draggingTab.classList.remove('tab-item--dragging')
        }

        // 移除拖拽预览
        if (this.dragState.dragPreview) {
            document.body.removeChild(this.dragState.dragPreview)
        }

        // 移除拖拽指示器
        if (this.dragState.dropIndicator && this.dragState.tabContainer) {
            this.dragState.tabContainer.removeChild(this.dragState.dropIndicator)
        }

        // 重置拖拽状态
        this.dragState = this.createInitialDragState()
    }

    /**
     * 计算两点之间的距离
     * @param point1 点1
     * @param point2 点2
     * @returns 距离
     */
    private calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
        const deltaX = point2.x - point1.x
        const deltaY = point2.y - point1.y
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    }

    /**
     * 触发拖拽事件
     * @param data 事件数据
     */
    private emitDragEvent(data: TabDragEventData): void {
        const listeners = this.listeners.get(data.event) || []
        listeners.forEach(listener => {
            try {
                listener(data)
            } catch (error) {
                console.error('TabDragHandler', '拖拽事件监听器执行出错', error)
            }
        })
    }

    // ==================== 公共方法 ====================

    /**
     * 添加拖拽事件监听器
     * @param event 事件类型
     * @param listener 监听器函数
     */
    public addEventListener(event: TabDragEvent, listener: TabDragListener): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event)!.push(listener)
    }

    /**
     * 移除拖拽事件监听器
     * @param event 事件类型
     * @param listener 监听器函数
     */
    public removeEventListener(event: TabDragEvent, listener: TabDragListener): void {
        const listeners = this.listeners.get(event)
        if (listeners) {
            const index = listeners.indexOf(listener)
            if (index !== -1) {
                listeners.splice(index, 1)
            }
        }
    }

    /**
     * 检查是否正在拖拽
     * @returns 是否正在拖拽
     */
    public isDragging(): boolean {
        return this.dragState.isDragging
    }

    /**
     * 获取当前拖拽的 Tab ID
     * @returns 拖拽的 Tab ID
     */
    public getDragTabId(): string | null {
        return this.dragState.dragTabId
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
     * 取消当前拖拽
     */
    public cancelDrag(): void {
        if (this.dragState.isDragging) {
            console.log('TabDragHandler', '取消拖拽')
            this.cleanupDragState()
        }
    }

    /**
     * 销毁拖拽处理器
     */
    public destroy(): void {
        console.log('TabDragHandler', '销毁拖拽处理器')

        // 取消当前拖拽
        this.cancelDrag()

        // 清理状态
        this.tabs.clear()
        this.tabOrder = []
        this.userCenterTabId = null
        this.listeners.clear()
    }
}