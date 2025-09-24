/**
 * Tab 管理器接口定义
 * 定义 Tab 管理器的核心功能接口
 */

import { TabItem, TabCreateOptions, TabEvent } from './tab'

/**
 * Tab 管理器接口
 * 定义统一的 Tab 管理功能
 */
export interface ITabManager {
    // Tab 生命周期管理
    /**
     * 创建新的 Tab
     * @param url Tab 对应的 URL
     * @param options 创建选项
     * @returns 创建的 Tab ID
     */
    createTab(url: string, options?: TabCreateOptions): string

    /**
     * 关闭指定的 Tab
     * @param tabId Tab ID
     * @returns 是否成功关闭
     */
    closeTab(tabId: string): boolean

    /**
     * 切换到指定的 Tab
     * @param tabId Tab ID
     */
    switchToTab(tabId: string): void

    // 特殊 Tab 管理
    /**
     * 确保用户中心 Tab 存在，如不存在则创建
     * @returns 用户中心 Tab ID
     */
    ensureUserCenterTab(): string

    /**
     * 获取用户中心 Tab ID
     * @returns 用户中心 Tab ID，如不存在返回空字符串
     */
    getUserCenterTabId(): string

    // Tab 状态查询
    /**
     * 获取所有 Tab 数据
     * @returns Tab 数据数组
     */
    getAllTabs(): TabItem[]

    /**
     * 获取当前激活的 Tab
     * @returns 激活的 Tab 数据，如无激活 Tab 返回 null
     */
    getActiveTab(): TabItem | null

    /**
     * 根据 ID 获取 Tab 数据
     * @param tabId Tab ID
     * @returns Tab 数据，如不存在返回 null
     */
    getTabById(tabId: string): TabItem | null

    // Tab 顺序管理
    /**
     * 重新排列 Tab 顺序
     * @param tabId 要移动的 Tab ID
     * @param newPosition 新位置索引
     * @returns 是否成功重排
     */
    reorderTab(tabId: string, newPosition: number): boolean

    /**
     * 获取 Tab 顺序数组
     * @returns Tab ID 顺序数组
     */
    getTabOrder(): string[]

    // window.open 处理
    /**
     * 处理 window.open 调用
     * @param url 目标 URL
     * @param target 目标窗口名称
     */
    handleWindowOpen(url: string, target?: string): void

    // 事件处理
    /**
     * 注册事件监听器
     * @param event 事件类型
     * @param handler 事件处理函数
     */
    on(event: TabEvent, handler: Function): void

    /**
     * 移除事件监听器
     * @param event 事件类型
     * @param handler 事件处理函数
     */
    off(event: TabEvent, handler: Function): void

    // 工具方法
    /**
     * 更新 Tab 标题
     * @param tabId Tab ID
     * @param title 新标题
     */
    updateTabTitle(tabId: string, title: string): void

    /**
     * 设置 Tab 加载状态
     * @param tabId Tab ID
     * @param isLoading 是否正在加载
     */
    setTabLoading(tabId: string, isLoading: boolean): void

    /**
     * 销毁 Tab 管理器，清理所有资源
     */
    destroy(): void
}

/**
 * Tab 渲染器接口
 * 定义渲染层 Tab 组件的功能接口
 */
export interface ITabRenderer {
    // 渲染方法
    /**
     * 渲染 Tab 列表
     * @param tabs Tab 数据数组
     */
    renderTabs(tabs: TabItem[]): void

    /**
     * 更新指定 Tab 的标题
     * @param tabId Tab ID
     * @param title 新标题
     */
    updateTabTitle(tabId: string, title: string): void

    /**
     * 设置激活的 Tab
     * @param tabId Tab ID
     */
    setActiveTab(tabId: string): void

    // 用户交互处理
    /**
     * 处理 Tab 点击事件
     * @param tabId Tab ID
     */
    onTabClick(tabId: string): void

    /**
     * 处理 Tab 关闭事件
     * @param tabId Tab ID
     */
    onTabClose(tabId: string): void

    // 拖拽相关方法
    /**
     * 处理 Tab 拖拽开始事件
     * @param tabId Tab ID
     * @param event 鼠标事件
     */
    onTabDragStart(tabId: string, event: MouseEvent): void

    /**
     * 处理 Tab 拖拽移动事件
     * @param event 鼠标事件
     */
    onTabDragMove(event: MouseEvent): void

    /**
     * 处理 Tab 拖拽结束事件
     * @param event 鼠标事件
     */
    onTabDragEnd(event: MouseEvent): void

    /**
     * 显示拖拽指示器
     * @param position 指示器位置
     */
    showDropIndicator(position: number): void

    /**
     * 隐藏拖拽指示器
     */
    hideDropIndicator(): void

    // 加载状态处理
    /**
     * 显示 Tab 加载指示器
     * @param tabId Tab ID
     */
    showLoadingIndicator(tabId: string): void

    /**
     * 隐藏 Tab 加载指示器
     * @param tabId Tab ID
     */
    hideLoadingIndicator(tabId: string): void

    /**
     * 销毁渲染器，清理资源
     */
    destroy(): void
}