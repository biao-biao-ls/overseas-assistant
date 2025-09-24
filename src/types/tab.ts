/**
 * Tab 管理相关的类型定义
 * 用于主窗口 Tab 优化功能的数据模型和接口定义
 */

/**
 * Tab 事件类型枚举
 * 定义 Tab 生命周期中的各种事件
 */
export enum TabEvent {
    /** Tab 创建事件 */
    TAB_CREATED = 'tab:created',
    /** Tab 关闭事件 */
    TAB_CLOSED = 'tab:closed',
    /** Tab 激活事件 */
    TAB_ACTIVATED = 'tab:activated',
    /** Tab 标题变更事件 */
    TAB_TITLE_CHANGED = 'tab:title-changed',
    /** Tab 顺序变更事件 */
    TAB_ORDER_CHANGED = 'tab:order-changed',
    /** Tab 开始加载事件 */
    TAB_LOADING_START = 'tab:loading-start',
    /** Tab 加载完成事件 */
    TAB_LOADING_END = 'tab:loading-end'
}

/**
 * Tab 错误类型枚举
 * 定义 Tab 操作中可能出现的错误类型
 */
export enum TabErrorType {
    /** Tab 不存在错误 */
    TAB_NOT_FOUND = 'TAB_NOT_FOUND',
    /** 用户中心 Tab 关闭被拒绝错误 */
    USER_CENTER_TAB_CLOSE_DENIED = 'USER_CENTER_TAB_CLOSE_DENIED',
    /** 超过最大 Tab 数量限制错误 */
    MAX_TABS_EXCEEDED = 'MAX_TABS_EXCEEDED',
    /** 无效 URL 错误 */
    INVALID_URL = 'INVALID_URL',
    /** BrowserView 创建失败错误 */
    BROWSER_VIEW_CREATE_FAILED = 'BROWSER_VIEW_CREATE_FAILED',
    /** Tab 拖拽被禁止错误 */
    TAB_DRAG_DENIED = 'TAB_DRAG_DENIED'
}

/**
 * Tab 错误类
 * 用于处理 Tab 操作中的各种错误情况
 */
export class TabError extends Error {
    constructor(
        public type: TabErrorType,
        message: string,
        public tabId?: string
    ) {
        super(message)
        this.name = 'TabError'
    }
}

/**
 * Tab 创建选项接口
 * 定义创建 Tab 时的可选参数
 */
export interface TabCreateOptions {
    /** Tab 标题 */
    title?: string
    /** 是否为用户中心 Tab */
    isUserCenter?: boolean
    /** 是否为固定 Tab */
    isPinned?: boolean
    /** Tab 位置：'first' | 'last' | 'background' | 数字索引 */
    position?: 'first' | 'last' | 'background' | number
    /** 是否来自 window.open 调用 */
    fromWindowOpen?: boolean
    /** 自定义标签数据 */
    labels?: { [key: string]: any }
}

/**
 * Tab 数据项接口
 * 定义单个 Tab 的完整数据结构
 */
export interface TabItem {
    /** Tab 唯一标识符 */
    id: string
    /** Tab 对应的 URL */
    url: string
    /** Tab 显示标题 */
    title: string
    /** 是否为当前激活的 Tab */
    isActive: boolean
    /** 是否为固定 Tab（不可关闭） */
    isPinned: boolean
    /** 是否为用户中心 Tab */
    isUserCenter: boolean
    /** 关联的 BrowserView ID */
    browserViewId: string
    /** Tab 创建时间戳 */
    createdAt: number
    /** 最后激活时间戳 */
    lastActiveAt: number
    /** 是否正在加载 */
    isLoading?: boolean
    /** 自定义标签数据 */
    labels?: { [key: string]: any }
}

/**
 * Tab 拖拽状态接口
 * 定义 Tab 拖拽操作的状态信息
 */
export interface TabDragState {
    /** 是否正在拖拽 */
    isDragging: boolean
    /** 正在拖拽的 Tab ID */
    dragTabId: string | null
    /** 拖拽预览元素 */
    dragPreviewElement: HTMLElement | null
    /** 拖拽指示器位置 */
    dropIndicatorPosition: number | null
    /** 原始位置索引 */
    originalPosition: number
}

/**
 * Tab 状态管理接口
 * 定义 Tab 管理器的内部状态结构
 */
export interface TabState {
    /** Tab 数据映射表 */
    tabs: Map<string, TabItem>
    /** 当前激活的 Tab ID */
    activeTabId: string | null
    /** 用户中心 Tab ID */
    userCenterTabId: string | null
    /** Tab 顺序数组 */
    tabOrder: string[]
    /** 拖拽状态 */
    dragState: TabDragState
}

/**
 * Tab 配置接口
 * 定义 Tab 管理的配置参数
 */
export interface TabConfig {
    /** 用户中心页面 URL */
    userCenterUrl: string
    /** 默认首页 URL */
    defaultIndexUrl: string
    /** 最大 Tab 数量限制 */
    maxTabs: number
    /** 是否启用 Tab 重新排序功能 */
    enableTabReordering: boolean
    /** 是否启用 Tab 切换动画 */
    tabSwitchAnimation: boolean
    /** Tab 切换动画持续时间（毫秒） */
    switchAnimationDuration: number
    /** 是否允许外部链接 */
    allowExternalLinks: boolean
    /** 外部链接域名白名单 */
    externalLinkDomains: string[]
    /** Tab 自动挂起时间（毫秒） */
    tabSuspendTimeout?: number
}