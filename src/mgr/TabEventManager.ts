/**
 * Tab 事件管理器
 * 负责 Tab 相关事件的发布、订阅和处理
 */

import { EventEmitter } from 'events'
import { TabEvent, TabItem } from '../types'
import { AppUtil } from '../utils/AppUtil'

/**
 * Tab 事件数据接口
 */
export interface TabEventData {
    /** 事件时间戳 */
    timestamp: number
    /** 事件源 Tab ID */
    tabId?: string
    /** Tab 数据 */
    tabItem?: TabItem
    /** 额外的事件数据 */
    [key: string]: any
}

/**
 * 事件监听器接口
 */
export interface TabEventListener {
    /** 监听器 ID */
    id: string
    /** 事件类型 */
    event: TabEvent
    /** 处理函数 */
    handler: (data: TabEventData) => void
    /** 创建时间 */
    createdAt: number
    /** 是否只执行一次 */
    once?: boolean
    /** 优先级（数字越大优先级越高） */
    priority?: number
}

/**
 * 事件统计信息
 */
export interface EventStats {
    /** 事件类型 */
    event: TabEvent
    /** 触发次数 */
    count: number
    /** 最后触发时间 */
    lastTriggered: number
    /** 平均处理时间（毫秒） */
    avgProcessingTime: number
    /** 监听器数量 */
    listenerCount: number
}

/**
 * Tab 事件管理器类
 */
export class TabEventManager extends EventEmitter {
    /** 事件监听器映射 */
    private eventListeners: Map<TabEvent, TabEventListener[]> = new Map()
    
    /** 事件统计信息 */
    private eventStats: Map<TabEvent, EventStats> = new Map()
    
    /** 监听器 ID 计数器 */
    private listenerIdCounter: number = 0
    
    /** 是否启用事件日志 */
    private enableEventLogging: boolean = true
    
    /** 是否启用性能监控 */
    private enablePerformanceMonitoring: boolean = true

    constructor() {
        super()
        this.initializeEventStats()
        AppUtil.info('TabEventManager', 'constructor', '初始化 Tab 事件管理器')
    }

    /**
     * 初始化事件统计信息
     */
    private initializeEventStats(): void {
        // 为所有事件类型初始化统计信息
        Object.values(TabEvent).forEach(event => {
            this.eventStats.set(event, {
                event,
                count: 0,
                lastTriggered: 0,
                avgProcessingTime: 0,
                listenerCount: 0
            })
        })
    }

    /**
     * 生成监听器 ID
     * @returns 唯一的监听器 ID
     */
    private generateListenerId(): string {
        return `listener_${Date.now()}_${++this.listenerIdCounter}`
    }

    /**
     * 添加事件监听器
     * @param event 事件类型
     * @param handler 处理函数
     * @param options 监听器选项
     * @returns 监听器 ID
     */
    public addEventListener(
        event: TabEvent, 
        handler: (data: TabEventData) => void,
        options: {
            once?: boolean
            priority?: number
            id?: string
        } = {}
    ): string {
        const listenerId = options.id || this.generateListenerId()
        
        const listener: TabEventListener = {
            id: listenerId,
            event,
            handler,
            createdAt: Date.now(),
            once: options.once || false,
            priority: options.priority || 0
        }

        // 获取或创建事件监听器列表
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, [])
        }
        
        const eventListeners = this.eventListeners.get(event)!
        eventListeners.push(listener)
        
        // 按优先级排序（优先级高的在前面）
        eventListeners.sort((a, b) => (b.priority || 0) - (a.priority || 0))

        // 更新统计信息
        const stats = this.eventStats.get(event)!
        stats.listenerCount = eventListeners.length

        // 同时注册到 EventEmitter
        super.on(event, handler)

        if (this.enableEventLogging) {
            AppUtil.info('TabEventManager', 'addEventListener', 
                `添加事件监听器: ${event}`, { listenerId, priority: options.priority })
        }

        return listenerId
    }

    /**
     * 移除事件监听器
     * @param event 事件类型
     * @param listenerId 监听器 ID 或处理函数
     * @returns 是否成功移除
     */
    public removeEventListener(event: TabEvent, listenerId: string | Function): boolean {
        const eventListeners = this.eventListeners.get(event)
        if (!eventListeners) {
            return false
        }

        let removedIndex = -1
        let removedListener: TabEventListener | null = null

        if (typeof listenerId === 'string') {
            // 按 ID 查找
            removedIndex = eventListeners.findIndex(listener => listener.id === listenerId)
        } else {
            // 按处理函数查找
            removedIndex = eventListeners.findIndex(listener => listener.handler === listenerId)
        }

        if (removedIndex !== -1) {
            removedListener = eventListeners[removedIndex]
            eventListeners.splice(removedIndex, 1)

            // 从 EventEmitter 中移除
            super.off(event, removedListener.handler)

            // 更新统计信息
            const stats = this.eventStats.get(event)!
            stats.listenerCount = eventListeners.length

            if (this.enableEventLogging) {
                AppUtil.info('TabEventManager', 'removeEventListener', 
                    `移除事件监听器: ${event}`, { listenerId: removedListener.id })
            }

            return true
        }

        return false
    }

    /**
     * 触发事件
     * @param event 事件类型
     * @param data 事件数据
     */
    public emitEvent(event: TabEvent, data: Partial<TabEventData> = {}): void {
        const startTime = Date.now()
        
        // 构建完整的事件数据
        const eventData: TabEventData = {
            timestamp: startTime,
            ...data
        }

        if (this.enableEventLogging) {
            AppUtil.info('TabEventManager', 'emitEvent', `触发事件: ${event}`, eventData)
        }

        // 获取事件监听器
        const eventListeners = this.eventListeners.get(event) || []
        const listenersToRemove: string[] = []

        // 执行监听器
        for (const listener of eventListeners) {
            try {
                const handlerStartTime = Date.now()
                listener.handler(eventData)
                
                if (this.enablePerformanceMonitoring) {
                    const handlerTime = Date.now() - handlerStartTime
                    if (handlerTime > 10) { // 超过10ms记录警告
                        AppUtil.warn('TabEventManager', 'emitEvent', 
                            `事件处理器执行时间过长: ${event}`, { 
                                listenerId: listener.id, 
                                time: handlerTime 
                            })
                    }
                }

                // 如果是一次性监听器，标记为待移除
                if (listener.once) {
                    listenersToRemove.push(listener.id)
                }
            } catch (error) {
                AppUtil.error('TabEventManager', 'emitEvent', 
                    `事件处理器执行出错: ${event}`, { 
                        listenerId: listener.id, 
                        error 
                    })
            }
        }

        // 移除一次性监听器
        for (const listenerId of listenersToRemove) {
            this.removeEventListener(event, listenerId)
        }

        // 同时触发 EventEmitter 事件
        super.emit(event, eventData)

        // 更新统计信息
        const stats = this.eventStats.get(event)!
        stats.count++
        stats.lastTriggered = startTime
        
        if (this.enablePerformanceMonitoring) {
            const processingTime = Date.now() - startTime
            stats.avgProcessingTime = (stats.avgProcessingTime * (stats.count - 1) + processingTime) / stats.count
        }
    }

    /**
     * 添加一次性事件监听器
     * @param event 事件类型
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onceEvent(event: TabEvent, handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(event, handler, { once: true, priority })
    }

    /**
     * 获取事件统计信息
     * @param event 事件类型（可选）
     * @returns 事件统计信息
     */
    public getEventStats(event?: TabEvent): EventStats | EventStats[] {
        if (event) {
            return this.eventStats.get(event) || {
                event,
                count: 0,
                lastTriggered: 0,
                avgProcessingTime: 0,
                listenerCount: 0
            }
        }
        
        return Array.from(this.eventStats.values())
    }

    /**
     * 获取事件监听器信息
     * @param event 事件类型（可选）
     * @returns 监听器信息
     */
    public getListeners(event?: TabEvent): TabEventListener[] | Map<TabEvent, TabEventListener[]> {
        if (event) {
            return this.eventListeners.get(event) || []
        }
        
        return new Map(this.eventListeners)
    }

    /**
     * 清除所有事件监听器
     * @param event 事件类型（可选，如果不指定则清除所有）
     */
    public clearListeners(event?: TabEvent): void {
        if (event) {
            const eventListeners = this.eventListeners.get(event) || []
            for (const listener of eventListeners) {
                super.off(event, listener.handler)
            }
            this.eventListeners.delete(event)
            
            // 重置统计信息
            const stats = this.eventStats.get(event)!
            stats.listenerCount = 0
            
            AppUtil.info('TabEventManager', 'clearListeners', `清除事件监听器: ${event}`)
        } else {
            // 清除所有监听器
            for (const [eventType, eventListeners] of this.eventListeners) {
                for (const listener of eventListeners) {
                    super.off(eventType, listener.handler)
                }
            }
            this.eventListeners.clear()
            
            // 重置所有统计信息
            this.initializeEventStats()
            
            AppUtil.info('TabEventManager', 'clearListeners', '清除所有事件监听器')
        }
    }

    /**
     * 设置事件日志开关
     * @param enabled 是否启用
     */
    public setEventLogging(enabled: boolean): void {
        this.enableEventLogging = enabled
        AppUtil.info('TabEventManager', 'setEventLogging', `事件日志: ${enabled ? '启用' : '禁用'}`)
    }

    /**
     * 设置性能监控开关
     * @param enabled 是否启用
     */
    public setPerformanceMonitoring(enabled: boolean): void {
        this.enablePerformanceMonitoring = enabled
        AppUtil.info('TabEventManager', 'setPerformanceMonitoring', `性能监控: ${enabled ? '启用' : '禁用'}`)
    }

    /**
     * 销毁事件管理器
     */
    public destroy(): void {
        AppUtil.info('TabEventManager', 'destroy', '销毁 Tab 事件管理器')
        
        // 清除所有监听器
        this.clearListeners()
        
        // 移除所有 EventEmitter 监听器
        this.removeAllListeners()
        
        // 清理统计信息
        this.eventStats.clear()
    }

    // ==================== 便捷方法 ====================

    /**
     * 监听 Tab 创建事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabCreated(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_CREATED, handler, { priority })
    }

    /**
     * 监听 Tab 关闭事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabClosed(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_CLOSED, handler, { priority })
    }

    /**
     * 监听 Tab 激活事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabActivated(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_ACTIVATED, handler, { priority })
    }

    /**
     * 监听 Tab 标题变更事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabTitleChanged(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_TITLE_CHANGED, handler, { priority })
    }

    /**
     * 监听 Tab 顺序变更事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabOrderChanged(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_ORDER_CHANGED, handler, { priority })
    }

    /**
     * 监听 Tab 加载开始事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabLoadingStart(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_LOADING_START, handler, { priority })
    }

    /**
     * 监听 Tab 加载结束事件
     * @param handler 处理函数
     * @param priority 优先级
     * @returns 监听器 ID
     */
    public onTabLoadingEnd(handler: (data: TabEventData) => void, priority?: number): string {
        return this.addEventListener(TabEvent.TAB_LOADING_END, handler, { priority })
    }
}