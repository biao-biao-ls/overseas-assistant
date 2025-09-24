/**
 * Tab 渲染器组件
 * 负责渲染 Tab 列表和处理用户交互
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { TabItem, ITabRenderer } from '../../types'
import { TabIPCClient } from '../TabIPCClient'
import { TabInteractionHandler, TabInteractionEvent } from './TabInteractionHandler'
import { TabDragHandler, TabDragEvent } from './TabDragHandler'
import './TabRenderer.css'
import './TabContextMenu.css'
import './TabDrag.css'

/**
 * Tab 渲染器属性接口
 */
interface TabRendererProps {
    /** IPC 客户端实例 */
    ipcClient: TabIPCClient
    /** 是否启用拖拽重排 */
    enableReordering?: boolean
    /** 是否启用切换动画 */
    enableAnimation?: boolean
    /** 动画持续时间（毫秒） */
    animationDuration?: number
    /** 自定义样式类名 */
    className?: string
}

/**
 * Tab 渲染器组件
 */
export const TabRenderer: React.FC<TabRendererProps> = ({
    ipcClient,
    enableReordering = true,
    enableAnimation = true,
    animationDuration = 300,
    className = ''
}) => {
    // 状态管理
    const [tabs, setTabs] = useState<TabItem[]>([])
    const [activeTabId, setActiveTabId] = useState<string | null>(null)
    const [userCenterTabId, setUserCenterTabId] = useState<string | null>(null)
    const [tabOrder, setTabOrder] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState<{ [tabId: string]: boolean }>({})

    // 引用
    const tabListRef = useRef<HTMLDivElement>(null)
    const interactionHandlerRef = useRef<TabInteractionHandler | null>(null)
    const dragHandlerRef = useRef<TabDragHandler | null>(null)

    // 初始化 IPC 客户端回调和交互处理器
    useEffect(() => {
        // 创建交互处理器
        const interactionHandler = new TabInteractionHandler(ipcClient, {
            enableKeyboardNavigation: true,
            enableContextMenu: true,
            enableMiddleClickClose: true
        })
        interactionHandlerRef.current = interactionHandler

        // 创建拖拽处理器
        const dragHandler = new TabDragHandler(ipcClient, {
            dragThreshold: 5,
            animationDuration: animationDuration,
            enableDragPreview: true,
            enableDropIndicator: true,
            enableAutoScroll: true
        })
        dragHandlerRef.current = dragHandler

        // 设置交互事件监听器
        interactionHandler.addEventListener(TabInteractionEvent.CLICK, (data) => {
            // Tab点击事件
        })

        interactionHandler.addEventListener(TabInteractionEvent.DOUBLE_CLICK, (data) => {
            // Tab双击事件
            // 可以在这里添加双击行为，比如重命名 Tab
        })

        interactionHandler.addEventListener(TabInteractionEvent.RIGHT_CLICK, (data) => {
            // Tab右键点击事件
        })

        interactionHandler.addEventListener(TabInteractionEvent.HOVER, (data) => {
            // Tab悬停事件
            // 可以在这里显示 Tab 预览
        })

        // 设置拖拽事件监听器
        dragHandler.addEventListener(TabDragEvent.DRAG_START, (data) => {
            // 拖拽开始
            if (tabListRef.current) {
                tabListRef.current.classList.add('tab-list--dragging')
            }
        })

        dragHandler.addEventListener(TabDragEvent.DRAG_MOVE, (data) => {
            // 拖拽移动
        })

        dragHandler.addEventListener(TabDragEvent.DROP, (data) => {
            // 拖拽完成
        })

        dragHandler.addEventListener(TabDragEvent.DRAG_END, (data) => {
            // 拖拽结束
            if (tabListRef.current) {
                tabListRef.current.classList.remove('tab-list--dragging')
            }
        })

        // 设置 Tab 状态更新回调
        ipcClient.setTabStateUpdateCallback((data) => {
            // 收到Tab状态更新
            setTabs(data.tabs)
            setActiveTabId(data.activeTabId)
            setUserCenterTabId(data.userCenterTabId)
            setTabOrder(data.tabOrder)
            
            // 更新交互处理器的 Tab 数据
            interactionHandler.updateTabs(data.tabs, data.userCenterTabId)
            
            // 更新拖拽处理器的 Tab 数据
            dragHandler.updateTabs(data.tabs, data.tabOrder, data.userCenterTabId)
        })

        // 设置 Tab 加载状态更新回调
        ipcClient.setTabLoadingUpdateCallback((tabId, isLoadingState) => {
            setIsLoading(prev => ({
                ...prev,
                [tabId]: isLoadingState
            }))
        })

        // 设置 Tab 标题更新回调
        ipcClient.setTabTitleUpdateCallback((tabId, title) => {
            setTabs(prevTabs => 
                prevTabs.map(tab => 
                    tab.id === tabId ? { ...tab, title } : tab
                )
            )
        })

        // 设置 Tab 顺序更新回调
        ipcClient.setTabOrderUpdateCallback((newTabOrder) => {
            setTabOrder(newTabOrder)
        })

        return () => {
            // 清理回调
            ipcClient.setTabStateUpdateCallback(() => {})
            ipcClient.setTabLoadingUpdateCallback(() => {})
            ipcClient.setTabTitleUpdateCallback(() => {})
            ipcClient.setTabOrderUpdateCallback(() => {})
            
            // 销毁交互处理器
            interactionHandler.destroy()
            interactionHandlerRef.current = null
            
            // 销毁拖拽处理器
            dragHandler.destroy()
            dragHandlerRef.current = null
        }
    }, [ipcClient])

    // Tab 点击处理（使用交互处理器）
    const handleTabClick = useCallback((tabId: string, event?: React.MouseEvent) => {
        if (interactionHandlerRef.current) {
            interactionHandlerRef.current.handleTabClick(tabId, event?.nativeEvent)
        }
    }, [])

    // Tab 关闭处理（使用交互处理器）
    const handleTabClose = useCallback((tabId: string, event: React.MouseEvent) => {
        event.stopPropagation() // 阻止冒泡到 Tab 点击事件
        
        if (interactionHandlerRef.current) {
            interactionHandlerRef.current.handleTabClose(tabId, event.nativeEvent)
        }
    }, [])

    // 鼠标事件处理
    const handleTabMouseEvent = useCallback((tabId: string, event: React.MouseEvent) => {
        if (interactionHandlerRef.current) {
            interactionHandlerRef.current.handleMouseEvent(tabId, event.nativeEvent as MouseEvent)
        }
    }, [])

    // 获取排序后的 Tab 列表
    const getSortedTabs = useCallback(() => {
        if (tabOrder.length === 0) {
            return tabs
        }

        const sortedTabs: TabItem[] = []
        const tabMap = new Map(tabs.map(tab => [tab.id, tab]))

        // 按照 tabOrder 排序
        for (const tabId of tabOrder) {
            const tab = tabMap.get(tabId)
            if (tab) {
                sortedTabs.push(tab)
            }
        }

        // 添加不在 tabOrder 中的 Tab（如果有的话）
        for (const tab of tabs) {
            if (!tabOrder.includes(tab.id)) {
                sortedTabs.push(tab)
            }
        }

        return sortedTabs
    }, [tabs, tabOrder])

    // 渲染单个 Tab
    const renderTab = useCallback((tab: TabItem, index: number) => {
        const isActive = tab.id === activeTabId
        const isUserCenter = tab.id === userCenterTabId
        const isTabLoading = isLoading[tab.id] || false

        const tabClassName = [
            'tab-item',
            isActive ? 'tab-item--active' : '',
            isUserCenter ? 'tab-item--user-center' : '',
            isTabLoading ? 'tab-item--loading' : '',
            enableAnimation ? 'tab-item--animated' : ''
        ].filter(Boolean).join(' ')

        return (
            <div
                key={tab.id}
                className={tabClassName}
                onClick={(e) => handleTabClick(tab.id, e)}
                onMouseDown={(e) => handleTabMouseDown(tab.id, e)}
                onMouseEnter={(e) => handleTabMouseEvent(tab.id, e)}
                onMouseLeave={(e) => handleTabMouseEvent(tab.id, e)}
                onContextMenu={(e) => {
                    e.preventDefault()
                    handleTabMouseEvent(tab.id, e)
                }}
                style={{
                    animationDuration: enableAnimation ? `${animationDuration}ms` : undefined
                }}
                data-tab-id={tab.id}
                data-tab-index={index}
            >
                {/* Tab 图标 */}
                <div className="tab-item__icon">
                    {isTabLoading ? (
                        <div className="tab-item__loading-spinner" />
                    ) : (
                        <div className="tab-item__favicon" />
                    )}
                </div>

                {/* Tab 标题 */}
                <div className="tab-item__title" title={tab.title}>
                    {tab.title}
                </div>

                {/* Tab 关闭按钮 */}
                {!isUserCenter && (
                    <button
                        className="tab-item__close-button"
                        onClick={(e) => handleTabClose(tab.id, e)}
                        title="关闭标签页"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path
                                d="M6 4.586L10.293.293a1 1 0 011.414 1.414L7.414 6l4.293 4.293a1 1 0 01-1.414 1.414L6 7.414l-4.293 4.293a1 1 0 01-1.414-1.414L4.586 6 .293 1.707A1 1 0 011.707.293L6 4.586z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                )}

                {/* 用户中心 Tab 固定图标 */}
                {isUserCenter && (
                    <div className="tab-item__pin-icon" title="固定标签页">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path
                                d="M8 2V1a1 1 0 00-1-1H5a1 1 0 00-1 1v1H2a1 1 0 000 2h1v5a1 1 0 001 1h4a1 1 0 001-1V4h1a1 1 0 000-2H8z"
                                fill="currentColor"
                            />
                        </svg>
                    </div>
                )}
            </div>
        )
    }, [activeTabId, userCenterTabId, isLoading, enableAnimation, animationDuration, handleTabClick, handleTabClose])

    // Tab 鼠标按下处理（拖拽开始）
    const handleTabMouseDown = useCallback((tabId: string, event: React.MouseEvent) => {
        if (!enableReordering) {
            return
        }

        // 只处理左键
        if (event.button !== 0) {
            return
        }

        // 使用拖拽处理器
        if (dragHandlerRef.current && tabListRef.current) {
            const tabElement = event.currentTarget as HTMLElement
            dragHandlerRef.current.startDrag(
                tabId, 
                event.nativeEvent as MouseEvent, 
                tabElement, 
                tabListRef.current
            )
        }

        // 阻止默认行为
        event.preventDefault()
    }, [enableReordering])

    // 这些方法现在由 TabDragHandler 处理，保留空实现以避免错误
    const handleMouseMove = useCallback(() => {}, [])
    const handleMouseUp = useCallback(() => {}, [])

    // 渲染组件
    const sortedTabs = getSortedTabs()

    return (
        <div className={`tab-renderer ${className}`}>
            {/* 临时调试信息 */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{ 
                    position: 'absolute', 
                    top: '50px', 
                    left: '10px', 
                    background: 'rgba(0,0,0,0.8)', 
                    color: 'white', 
                    padding: '10px', 
                    fontSize: '12px',
                    zIndex: 10000,
                    borderRadius: '4px'
                }}>
                    <div>Tab 数量: {tabs.length}</div>
                    <div>活跃 Tab: {activeTabId}</div>
                    <div>用户中心 Tab: {userCenterTabId}</div>
                    <div>Tab 顺序: {tabOrder.join(', ')}</div>
                    <div>排序后 Tab 数量: {sortedTabs.length}</div>
                </div>
            )}
            
            <div 
                ref={tabListRef}
                className="tab-list"
                style={{
                    '--animation-duration': enableAnimation ? `${animationDuration}ms` : '0ms'
                } as React.CSSProperties}
            >
                {sortedTabs.length === 0 ? (
                    <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>
                        正在加载 Tab...
                    </div>
                ) : (
                    sortedTabs.map((tab, index) => renderTab(tab, index))
                )}
                
                {/* 拖拽指示器现在由 TabDragHandler 管理 */}
            </div>
        </div>
    )
}

export default TabRenderer