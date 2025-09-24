/**
 * Tab IPC 通信相关的类型定义
 * 定义主进程和渲染进程之间的 Tab 状态同步消息格式
 */

import { TabItem, TabCreateOptions } from './tab'

/**
 * IPC 消息类型枚举
 * 定义 Tab 相关的 IPC 消息类型
 */
export enum TabIPCMessageType {
    // 主进程 -> 渲染进程
    /** Tab 状态更新消息 */
    TAB_UPDATE = 'TAB_UPDATE',
    /** Tab 加载状态消息 */
    TAB_LOADING = 'TAB_LOADING',
    /** Tab 标题更新消息 */
    TAB_TITLE_UPDATE = 'TAB_TITLE_UPDATE',
    /** Tab 顺序更新消息 */
    TAB_ORDER_UPDATE = 'TAB_ORDER_UPDATE',

    // 渲染进程 -> 主进程
    /** Tab 操作请求消息 */
    TAB_ACTION = 'TAB_ACTION',
    /** window.open 处理请求消息 */
    WINDOW_OPEN = 'WINDOW_OPEN',
    /** Tab 拖拽重排请求消息 */
    TAB_REORDER = 'TAB_REORDER'
}

/**
 * Tab 操作类型枚举
 * 定义渲染进程可以请求的 Tab 操作类型
 */
export enum TabActionType {
    /** 创建 Tab */
    CREATE = 'CREATE',
    /** 关闭 Tab */
    CLOSE = 'CLOSE',
    /** 切换 Tab */
    SWITCH = 'SWITCH',
    /** 重新排序 Tab */
    REORDER = 'REORDER',
    /** 更新 Tab 标题 */
    UPDATE_TITLE = 'UPDATE_TITLE'
}

// 主进程 -> 渲染进程的消息类型

/**
 * Tab 状态更新消息
 * 主进程向渲染进程发送完整的 Tab 状态信息
 */
export interface TabUpdateMessage {
    type: TabIPCMessageType.TAB_UPDATE
    payload: {
        /** 所有 Tab 数据 */
        tabs: TabItem[]
        /** 当前激活的 Tab ID */
        activeTabId: string | null
        /** 用户中心 Tab ID */
        userCenterTabId: string | null
        /** Tab 顺序数组 */
        tabOrder: string[]
    }
}

/**
 * Tab 加载状态消息
 * 主进程向渲染进程发送 Tab 加载状态变更
 */
export interface TabLoadingMessage {
    type: TabIPCMessageType.TAB_LOADING
    payload: {
        /** Tab ID */
        tabId: string
        /** 是否正在加载 */
        isLoading: boolean
    }
}

/**
 * Tab 标题更新消息
 * 主进程向渲染进程发送 Tab 标题变更
 */
export interface TabTitleUpdateMessage {
    type: TabIPCMessageType.TAB_TITLE_UPDATE
    payload: {
        /** Tab ID */
        tabId: string
        /** 新标题 */
        title: string
    }
}

/**
 * Tab 顺序更新消息
 * 主进程向渲染进程发送 Tab 顺序变更
 */
export interface TabOrderUpdateMessage {
    type: TabIPCMessageType.TAB_ORDER_UPDATE
    payload: {
        /** 新的 Tab 顺序数组 */
        tabOrder: string[]
    }
}

// 渲染进程 -> 主进程的消息类型

/**
 * Tab 操作请求消息
 * 渲染进程向主进程发送 Tab 操作请求
 */
export interface TabActionMessage {
    type: TabIPCMessageType.TAB_ACTION
    action: TabActionType
    payload: {
        /** Tab ID（可选，用于关闭、切换等操作） */
        tabId?: string
        /** URL（可选，用于创建操作） */
        url?: string
        /** 新位置（可选，用于重排操作） */
        newPosition?: number
        /** 创建选项（可选，用于创建操作） */
        options?: TabCreateOptions
        /** 新标题（可选，用于标题更新操作） */
        title?: string
    }
}

/**
 * window.open 处理请求消息
 * 渲染进程向主进程发送 window.open 处理请求
 */
export interface WindowOpenMessage {
    type: TabIPCMessageType.WINDOW_OPEN
    payload: {
        /** 目标 URL */
        url: string
        /** 目标窗口名称（可选） */
        target?: string
        /** 窗口特性字符串（可选） */
        features?: string
    }
}

/**
 * Tab 拖拽重排请求消息
 * 渲染进程向主进程发送 Tab 拖拽重排请求
 */
export interface TabReorderMessage {
    type: TabIPCMessageType.TAB_REORDER
    payload: {
        /** 要移动的 Tab ID */
        tabId: string
        /** 新位置索引 */
        newPosition: number
    }
}

/**
 * 联合类型：所有主进程到渲染进程的消息
 */
export type MainToRendererMessage = 
    | TabUpdateMessage
    | TabLoadingMessage
    | TabTitleUpdateMessage
    | TabOrderUpdateMessage

/**
 * 联合类型：所有渲染进程到主进程的消息
 */
export type RendererToMainMessage = 
    | TabActionMessage
    | WindowOpenMessage
    | TabReorderMessage

/**
 * IPC 通道名称常量
 * 定义 Tab 相关的 IPC 通道名称
 */
export const TabIPCChannels = {
    /** 主进程到渲染进程的 Tab 消息通道 */
    MAIN_TO_RENDERER: 'tab:main-to-renderer',
    /** 渲染进程到主进程的 Tab 消息通道 */
    RENDERER_TO_MAIN: 'tab:renderer-to-main'
} as const