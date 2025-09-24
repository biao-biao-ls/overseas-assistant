/**
 * Tab BrowserView 管理器
 * 集成 TabManager 和 BrowserView 管理，负责 Tab 和 BrowserView 的关联管理
 */

import { BrowserView, Rectangle, BrowserWindow, RenderProcessGoneDetails } from 'electron'
import { TabManager } from './TabManager'
import { TabEventData } from './TabEventManager'
import { TabItem, TabError, TabErrorType } from '../types'
import { AppUtil } from '../utils/AppUtil'
import { ECommon } from '../enum/ECommon'
import { AppConfig } from '../config/AppConfig'
import { ErrorConfig } from '../config/ErrorConfig'
import { MainWindow } from '../main/window/MainWindow'
import { EWnd } from '../enum/EWnd'
import { webLoadingStateMonitor } from '../utils/WebLoadingStateMonitor'
import { configSyncStateManager } from '../utils/ConfigSyncStateManager'
import { TabLoadingState } from '../types/config'

/**
 * BrowserView 数据接口
 */
interface BrowserViewData {
    /** BrowserView 实例 */
    browserView: BrowserView
    /** 关联的 Tab ID */
    tabId: string
    /** 创建时间 */
    createdAt: number
    /** 是否正在显示 */
    isVisible: boolean
    /** 最后激活时间 */
    lastActiveAt: number
}

/**
 * Tab BrowserView 管理器类
 */
export class TabBrowserViewManager {
    /** TabManager 实例 */
    private tabManager: TabManager | null = null
    
    /** 父窗口 ID */
    private parentWindowId: string
    
    /** BrowserView 映射表 */
    private browserViews: Map<string, BrowserViewData> = new Map()
    
    /** 当前显示的 BrowserView ID */
    private activeBrowserViewId: string | null = null
    
    /** 预加载的 BrowserView */
    private preloadBrowserView: BrowserView | null = null
    
    /** 重载页面的 BrowserView */
    private reloadBrowserView: BrowserView | null = null
    
    /** 错误检查定时器 */
    private errorCheckTimer: number = 0
    
    /** 错误检查间隔（毫秒） */
    private readonly ERROR_CHECK_INTERVAL = 3000

    constructor(parentWindowId: string) {
        this.parentWindowId = parentWindowId
        this.createPreloadBrowserView()
        this.setupLoadingStateMonitor()
        
        AppUtil.info('TabBrowserViewManager', 'constructor', `初始化 Tab BrowserView 管理器: ${parentWindowId}`)
    }

    /**
     * 设置加载状态监控器
     */
    private setupLoadingStateMonitor(): void {
        // 监听加载状态变更
        webLoadingStateMonitor.onStateChange((event) => {
            AppUtil.info('TabBrowserViewManager', 'onLoadingStateChange', 
                `Tab ${event.tabId} 状态变更: ${event.state}`)
            
            // 如果页面就绪，处理待同步的配置
            if (event.state === TabLoadingState.READY) {
                this.handleTabReady(event.tabId)
            }
        })
    }

    /**
     * 初始化管理器
     * @param tabManager TabManager 实例
     */
    public initialize(tabManager: TabManager): void {
        this.tabManager = tabManager
        this.setupTabEventListeners()
        
        AppUtil.info('TabBrowserViewManager', 'initialize', 'Tab BrowserView 管理器初始化完成')
    }

    /**
     * 设置 Tab 事件监听器
     */
    private setupTabEventListeners(): void {
        if (!this.tabManager) {
            return
        }

        // 监听 Tab 创建事件
        this.tabManager.onTabCreated((data: TabEventData) => {
            this.handleTabCreated(data)
        })

        // 监听 Tab 关闭事件
        this.tabManager.onTabClosed((data: TabEventData) => {
            this.handleTabClosed(data)
        })

        // 监听 Tab 激活事件
        this.tabManager.onTabActivated((data: TabEventData) => {
            this.handleTabActivated(data)
        })

        // 监听 Tab 加载状态变化
        this.tabManager.onTabLoadingStart((data: TabEventData) => {
            this.handleTabLoadingStart(data)
        })

        this.tabManager.onTabLoadingEnd((data: TabEventData) => {
            this.handleTabLoadingEnd(data)
        })

        AppUtil.info('TabBrowserViewManager', 'setupTabEventListeners', '设置 Tab 事件监听器完成')
    }

    /**
     * 处理 Tab 创建事件
     * @param data 事件数据
     */
    private handleTabCreated(data: TabEventData): void {
        if (!data.tabId || !data.tabItem) {
            AppUtil.warn('TabBrowserViewManager', 'handleTabCreated', '缺少必要的事件数据')
            return
        }

        AppUtil.info('TabBrowserViewManager', 'handleTabCreated', `为 Tab 创建 BrowserView: ${data.tabId}`)
        
        try {
            this.createBrowserViewForTab(data.tabItem)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'handleTabCreated', `创建 BrowserView 失败: ${data.tabId}`, error)
            
            // 通知 TabManager BrowserView 创建失败
            if (this.tabManager) {
                this.tabManager.setTabLoading(data.tabId, false)
            }
        }
    }

    /**
     * 处理 Tab 关闭事件
     * @param data 事件数据
     */
    private handleTabClosed(data: TabEventData): void {
        if (!data.tabId) {
            AppUtil.warn('TabBrowserViewManager', 'handleTabClosed', '缺少 Tab ID')
            return
        }

        AppUtil.info('TabBrowserViewManager', 'handleTabClosed', `销毁 Tab 的 BrowserView: ${data.tabId}`)
        this.destroyBrowserViewForTab(data.tabId)
    }

    /**
     * 处理 Tab 激活事件
     * @param data 事件数据
     */
    private handleTabActivated(data: TabEventData): void {
        if (!data.tabId) {
            AppUtil.warn('TabBrowserViewManager', 'handleTabActivated', '缺少 Tab ID')
            return
        }

        AppUtil.info('TabBrowserViewManager', 'handleTabActivated', `切换到 Tab 的 BrowserView: ${data.tabId}`)
        this.switchToBrowserView(data.tabId)
    }

    /**
     * 处理 Tab 开始加载事件
     * @param data 事件数据
     */
    private handleTabLoadingStart(data: TabEventData): void {
        if (!data.tabId) {
            return
        }

        const browserViewData = this.browserViews.get(data.tabId)
        if (browserViewData) {
            // 可以在这里添加加载指示器逻辑
            AppUtil.info('TabBrowserViewManager', 'handleTabLoadingStart', `Tab 开始加载: ${data.tabId}`)
        }
    }

    /**
     * 处理 Tab 加载结束事件
     * @param data 事件数据
     */
    private handleTabLoadingEnd(data: TabEventData): void {
        if (!data.tabId) {
            return
        }

        const browserViewData = this.browserViews.get(data.tabId)
        if (browserViewData) {
            // 可以在这里移除加载指示器逻辑
            AppUtil.info('TabBrowserViewManager', 'handleTabLoadingEnd', `Tab 加载完成: ${data.tabId}`)
        }
    }

    /**
     * 为 Tab 创建 BrowserView
     * @param tabItem Tab 数据
     */
    private createBrowserViewForTab(tabItem: TabItem): void {
        // 使用预加载的 BrowserView 或创建新的
        let browserView = this.preloadBrowserView
        if (!browserView) {
            browserView = this.createNewBrowserView()
        } else {
            // 创建新的预加载 BrowserView
            this.preloadBrowserView = this.createNewBrowserView()
        }

        // 设置 BrowserView 的位置和大小
        this.setBrowserViewBounds(browserView)

        // 加载 URL（传入tabId以启用加载状态监控）
        this.loadUrlInBrowserView(browserView, tabItem.url, tabItem.id)

        // 设置事件监听器
        this.setupBrowserViewEventListeners(browserView, tabItem.id)

        // 保存 BrowserView 数据
        const browserViewData: BrowserViewData = {
            browserView,
            tabId: tabItem.id,
            createdAt: Date.now(),
            isVisible: false,
            lastActiveAt: Date.now()
        }

        this.browserViews.set(tabItem.id, browserViewData)

        // 更新 TabManager 中的 BrowserView ID
        if (this.tabManager) {
            const tab = this.tabManager.getTabById(tabItem.id)
            if (tab) {
                tab.browserViewId = this.generateBrowserViewId(tabItem.id)
            }
        }

        AppUtil.info('TabBrowserViewManager', 'createBrowserViewForTab', `成功创建 BrowserView: ${tabItem.id}`)
    }

    /**
     * 处理Tab就绪事件
     */
    private handleTabReady(tabId: string): void {
        AppUtil.info('TabBrowserViewManager', 'handleTabReady', `Tab已就绪: ${tabId}`)
        
        // 这里可以添加Tab就绪后的处理逻辑
        // 例如：注入脚本、设置配置等
    }

    /**
     * 销毁 Tab 的 BrowserView
     * @param tabId Tab ID
     */
    private destroyBrowserViewForTab(tabId: string): void {
        const browserViewData = this.browserViews.get(tabId)
        if (!browserViewData) {
            AppUtil.warn('TabBrowserViewManager', 'destroyBrowserViewForTab', `BrowserView 不存在: ${tabId}`)
            return
        }

        try {
            // 停止加载状态监控
            webLoadingStateMonitor.stopMonitoring(tabId)

            // 从父窗口移除 BrowserView
            const parentWindow = this.getParentWindow()
            if (parentWindow) {
                parentWindow.removeBrowserView(browserViewData.browserView)
            }

            // 销毁 BrowserView
            // browserViewData.browserView.webContents.destroy() // destroy 方法在新版本 Electron 中已移除

            // 从映射表中移除
            this.browserViews.delete(tabId)

            // 如果是当前激活的 BrowserView，清除引用
            if (this.activeBrowserViewId === tabId) {
                this.activeBrowserViewId = null
            }

            AppUtil.info('TabBrowserViewManager', 'destroyBrowserViewForTab', `成功销毁 BrowserView: ${tabId}`)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'destroyBrowserViewForTab', `销毁 BrowserView 失败: ${tabId}`, error)
        }
    }

    /**
     * 切换到指定的 BrowserView
     * @param tabId Tab ID
     */
    private switchToBrowserView(tabId: string): void {
        const startTime = Date.now()
        const browserViewData = this.browserViews.get(tabId)
        if (!browserViewData) {
            AppUtil.warn('TabBrowserViewManager', 'switchToBrowserView', `BrowserView 不存在: ${tabId}`)
            return
        }

        const parentWindow = this.getParentWindow()
        if (!parentWindow) {
            AppUtil.error('TabBrowserViewManager', 'switchToBrowserView', '父窗口不存在')
            return
        }

        try {
            // 执行切换前的准备工作
            this.prepareBrowserViewSwitch(tabId)

            // 隐藏当前的 BrowserView
            if (this.activeBrowserViewId && this.activeBrowserViewId !== tabId) {
                this.hideBrowserView(this.activeBrowserViewId)
            }

            // 显示新的 BrowserView
            this.showBrowserView(tabId, browserViewData)

            // 执行切换后的清理工作
            this.finalizeBrowserViewSwitch(tabId)

            const switchTime = Date.now() - startTime
            AppUtil.info('TabBrowserViewManager', 'switchToBrowserView', 
                `成功切换到 BrowserView: ${tabId}，耗时: ${switchTime}ms`)

        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'switchToBrowserView', `切换 BrowserView 失败: ${tabId}`, error)
            
            // 尝试恢复到之前的状态
            this.recoverFromSwitchError(tabId)
        }
    }

    /**
     * 准备 BrowserView 切换
     * @param targetTabId 目标 Tab ID
     */
    private prepareBrowserViewSwitch(targetTabId: string): void {
        // 暂停当前 BrowserView 的渲染（如果支持）
        if (this.activeBrowserViewId) {
            const currentBrowserViewData = this.browserViews.get(this.activeBrowserViewId)
            if (currentBrowserViewData) {
                try {
                    // 暂停渲染以节省资源
                    currentBrowserViewData.browserView.webContents.setBackgroundThrottling(true)
                } catch (error) {
                    AppUtil.warn('TabBrowserViewManager', 'prepareBrowserViewSwitch', 
                        '设置后台节流失败', error)
                }
            }
        }

        // 预热目标 BrowserView
        const targetBrowserViewData = this.browserViews.get(targetTabId)
        if (targetBrowserViewData) {
            try {
                // 恢复渲染
                targetBrowserViewData.browserView.webContents.setBackgroundThrottling(false)
                
                // 确保 BrowserView 处于正确的状态
                this.ensureBrowserViewReady(targetBrowserViewData)
            } catch (error) {
                AppUtil.warn('TabBrowserViewManager', 'prepareBrowserViewSwitch', 
                    '预热目标 BrowserView 失败', error)
            }
        }
    }

    /**
     * 隐藏 BrowserView
     * @param tabId Tab ID
     */
    private hideBrowserView(tabId: string): void {
        const browserViewData = this.browserViews.get(tabId)
        if (!browserViewData || !browserViewData.isVisible) {
            return
        }

        const parentWindow = this.getParentWindow()
        if (!parentWindow) {
            return
        }

        try {
            // 从父窗口移除 BrowserView
            parentWindow.removeBrowserView(browserViewData.browserView)
            
            // 更新状态
            browserViewData.isVisible = false
            
            // 设置后台节流以节省资源
            browserViewData.browserView.webContents.setBackgroundThrottling(true)

            AppUtil.info('TabBrowserViewManager', 'hideBrowserView', `隐藏 BrowserView: ${tabId}`)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'hideBrowserView', `隐藏 BrowserView 失败: ${tabId}`, error)
        }
    }

    /**
     * 显示 BrowserView
     * @param tabId Tab ID
     * @param browserViewData BrowserView 数据
     */
    private showBrowserView(tabId: string, browserViewData: BrowserViewData): void {
        const parentWindow = this.getParentWindow()
        if (!parentWindow) {
            return
        }

        try {
            // 更新 BrowserView 的位置和大小
            this.setBrowserViewBounds(browserViewData.browserView)

            // 添加到父窗口
            parentWindow.setBrowserView(browserViewData.browserView)
            
            // 更新状态
            browserViewData.isVisible = true
            browserViewData.lastActiveAt = Date.now()
            this.activeBrowserViewId = tabId

            // 恢复渲染
            browserViewData.browserView.webContents.setBackgroundThrottling(false)

            // 聚焦到 BrowserView
            browserViewData.browserView.webContents.focus()

            AppUtil.info('TabBrowserViewManager', 'showBrowserView', `显示 BrowserView: ${tabId}`)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'showBrowserView', `显示 BrowserView 失败: ${tabId}`, error)
            throw error
        }
    }

    /**
     * 完成 BrowserView 切换
     * @param tabId Tab ID
     */
    private finalizeBrowserViewSwitch(tabId: string): void {
        // 触发切换完成事件
        this.emitBrowserViewEvent('switch-completed', {
            tabId,
            timestamp: Date.now()
        })

        // 检查是否需要进行内存清理
        this.checkMemoryUsageAndCleanup()

        // 更新窗口标题
        this.updateWindowTitle(tabId)
    }

    /**
     * 从切换错误中恢复
     * @param failedTabId 失败的 Tab ID
     */
    private recoverFromSwitchError(failedTabId: string): void {
        AppUtil.warn('TabBrowserViewManager', 'recoverFromSwitchError', 
            `尝试从切换错误中恢复: ${failedTabId}`)

        // 尝试恢复到之前的 BrowserView
        if (this.activeBrowserViewId && this.activeBrowserViewId !== failedTabId) {
            try {
                const previousBrowserViewData = this.browserViews.get(this.activeBrowserViewId)
                if (previousBrowserViewData) {
                    this.showBrowserView(this.activeBrowserViewId, previousBrowserViewData)
                }
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'recoverFromSwitchError', 
                    '恢复到之前的 BrowserView 失败', error)
            }
        }

        // 触发错误事件
        this.emitBrowserViewEvent('switch-error', {
            tabId: failedTabId,
            timestamp: Date.now()
        })
    }

    /**
     * 确保 BrowserView 处于就绪状态
     * @param browserViewData BrowserView 数据
     */
    private ensureBrowserViewReady(browserViewData: BrowserViewData): void {
        const webContents = browserViewData.browserView.webContents
        
        // 检查 WebContents 是否已销毁
        if (webContents.isDestroyed()) {
            AppUtil.warn('TabBrowserViewManager', 'ensureBrowserViewReady', 
                `BrowserView WebContents 已销毁: ${browserViewData.tabId}`)
            return
        }

        // 检查是否正在加载
        if (webContents.isLoading()) {
            AppUtil.info('TabBrowserViewManager', 'ensureBrowserViewReady', 
                `BrowserView 正在加载: ${browserViewData.tabId}`)
        }

        // 检查是否崩溃
        if (webContents.isCrashed()) {
            AppUtil.warn('TabBrowserViewManager', 'ensureBrowserViewReady', 
                `BrowserView 已崩溃，尝试重新加载: ${browserViewData.tabId}`)
            
            try {
                webContents.reload()
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'ensureBrowserViewReady', 
                    '重新加载崩溃的 BrowserView 失败', error)
            }
        }
    }

    /**
     * 创建新的 BrowserView
     * @returns BrowserView 实例
     */
    private createNewBrowserView(): BrowserView {
        const browserView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true
            }
        })

        AppUtil.info('TabBrowserViewManager', 'createNewBrowserView', '创建新的 BrowserView')
        return browserView
    }

    /**
     * 创建预加载的 BrowserView
     */
    private createPreloadBrowserView(): void {
        this.preloadBrowserView = this.createNewBrowserView()
        AppUtil.info('TabBrowserViewManager', 'createPreloadBrowserView', '创建预加载 BrowserView')
    }

    /**
     * 设置 BrowserView 的位置和大小
     * @param browserView BrowserView 实例
     */
    private setBrowserViewBounds(browserView: BrowserView): void {
        const parentWindow = this.getParentWindow()
        if (!parentWindow) {
            return
        }

        try {
            const bounds = this.calculateBrowserViewBounds()
            browserView.setBounds(bounds)
            
            AppUtil.info('TabBrowserViewManager', 'setBrowserViewBounds', 'BrowserView 位置设置完成', bounds)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'setBrowserViewBounds', '设置 BrowserView 位置失败', error)
        }
    }

    /**
     * 计算 BrowserView 的位置和大小
     * @returns 位置和大小信息
     */
    private calculateBrowserViewBounds(): Rectangle {
        const parentWindow = this.getParentWindow()
        if (!parentWindow) {
            return { x: 0, y: 0, width: 800, height: 600 }
        }

        const winBounds = parentWindow.getBounds()
        const isMaximized = parentWindow.isMaximized()
        const isWin10Later = AppUtil.isWindow10OrLater()

        // Tab 栏高度
        const tabBarHeight = 46
        
        // 边框和阴影大小
        const borderSize = 2
        const shadowSize = 0

        let bounds: Rectangle

        if (isMaximized) {
            // 最大化窗口
            const adjustedWidth = winBounds.width - 16 // 8 * 2
            const adjustedHeight = winBounds.height - 16 // 8 * 2

            bounds = {
                x: 0,
                y: tabBarHeight,
                width: adjustedWidth,
                height: adjustedHeight - tabBarHeight
            }
        } else {
            // 普通窗口
            if (isWin10Later) {
                bounds = {
                    x: shadowSize,
                    y: shadowSize + tabBarHeight,
                    width: winBounds.width - shadowSize * 2,
                    height: winBounds.height - tabBarHeight - shadowSize * 2
                }
            } else {
                bounds = {
                    x: borderSize,
                    y: tabBarHeight + borderSize,
                    width: winBounds.width - borderSize * 2,
                    height: winBounds.height - tabBarHeight - borderSize * 2
                }
            }
        }

        return bounds
    }

    /**
     * 在 BrowserView 中加载 URL
     * @param browserView BrowserView 实例
     * @param url 要加载的 URL
     * @param tabId Tab ID（用于加载状态监控）
     */
    private loadUrlInBrowserView(browserView: BrowserView, url: string, tabId?: string): void {
        // 如果提供了tabId，开始监控加载状态
        if (tabId) {
            webLoadingStateMonitor.startMonitoring(tabId, url, browserView.webContents)
        }

        browserView.webContents.loadURL(url)
            .then(() => {
                browserView.webContents.clearHistory()
                AppUtil.info('TabBrowserViewManager', 'loadUrlInBrowserView', `URL 加载成功: ${url}`)
            })
            .catch(error => {
                AppUtil.error('TabBrowserViewManager', 'loadUrlInBrowserView', `URL 加载失败: ${url}`, error)
            })
    }

    /**
     * 设置 BrowserView 事件监听器
     * @param browserView BrowserView 实例
     * @param tabId Tab ID
     */
    private setupBrowserViewEventListeners(browserView: BrowserView, tabId: string): void {
        // 监听渲染进程崩溃
        browserView.webContents.on('render-process-gone', (event: Event, details: RenderProcessGoneDetails) => {
            this.handleRenderProcessGone(tabId, details)
        })

        // 监听页面导航
        browserView.webContents.on('will-navigate', (event: Event, newUrl: string) => {
            this.handleWillNavigate(tabId, newUrl, event)
        })

        // 监听页面标题变化
        browserView.webContents.on('page-title-updated', (event: Event, title: string) => {
            this.handlePageTitleUpdated(tabId, title)
        })

        // 监听页面加载完成
        browserView.webContents.on('did-finish-load', () => {
            this.handleDidFinishLoad(tabId)
        })

        AppUtil.info('TabBrowserViewManager', 'setupBrowserViewEventListeners', `设置 BrowserView 事件监听器: ${tabId}`)
    }

    /**
     * 处理渲染进程崩溃
     * @param tabId Tab ID
     * @param details 崩溃详情
     */
    private handleRenderProcessGone(tabId: string, details: RenderProcessGoneDetails): void {
        AppUtil.error('TabBrowserViewManager', 'handleRenderProcessGone', `Tab 渲染进程崩溃: ${tabId}`, details)
        
        // 通知 TabManager 设置错误状态
        if (this.tabManager) {
            this.tabManager.setTabLoading(tabId, false)
        }

        // 可以在这里显示错误页面或重新加载
        this.showErrorPageForTab(tabId, '渲染进程崩溃', details)
    }

    /**
     * 处理页面导航
     * @param tabId Tab ID
     * @param newUrl 新 URL
     * @param event 事件对象
     */
    private handleWillNavigate(tabId: string, newUrl: string, event: Event): void {
        AppUtil.info('TabBrowserViewManager', 'handleWillNavigate', `Tab 导航: ${tabId} -> ${newUrl}`)
        
        // 这里可以添加导航拦截逻辑
        // 例如：检查是否为外部链接，是否需要在新 Tab 中打开等
        
        if (this.tabManager) {
            this.tabManager.setTabLoading(tabId, true)
        }
    }

    /**
     * 处理页面标题更新
     * @param tabId Tab ID
     * @param title 新标题
     */
    private handlePageTitleUpdated(tabId: string, title: string): void {
        AppUtil.info('TabBrowserViewManager', 'handlePageTitleUpdated', `Tab 标题更新: ${tabId} -> ${title}`)
        
        if (this.tabManager) {
            this.tabManager.updateTabTitle(tabId, title)
        }
    }

    /**
     * 处理页面加载完成
     * @param tabId Tab ID
     */
    private handleDidFinishLoad(tabId: string): void {
        AppUtil.info('TabBrowserViewManager', 'handleDidFinishLoad', `Tab 加载完成: ${tabId}`)
        
        if (this.tabManager) {
            this.tabManager.setTabLoading(tabId, false)
        }
    }

    /**
     * 为 Tab 显示错误页面
     * @param tabId Tab ID
     * @param errorType 错误类型
     * @param details 错误详情
     */
    private showErrorPageForTab(tabId: string, errorType: string, details: any): void {
        // 这里可以实现错误页面显示逻辑
        AppUtil.warn('TabBrowserViewManager', 'showErrorPageForTab', `显示错误页面: ${tabId}`, { errorType, details })
        
        // 可以创建一个专门的错误页面 BrowserView
        // 或者加载一个本地的错误页面 HTML
    }

    /**
     * 生成 BrowserView ID
     * @param tabId Tab ID
     * @returns BrowserView ID
     */
    private generateBrowserViewId(tabId: string): string {
        return `bv_${tabId}_${Date.now()}`
    }

    /**
     * 获取父窗口实例
     * @returns 父窗口实例或 null
     */
    private getParentWindow(): BrowserWindow | null {
        try {
            const parentWindow = AppUtil.getExistWnd(this.parentWindowId)
            return parentWindow ? parentWindow.getBrowserWindow() : null
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'getParentWindow', '获取父窗口失败', error)
            return null
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 刷新所有 BrowserView 的位置
     */
    public refreshAllBrowserViewBounds(): void {
        AppUtil.info('TabBrowserViewManager', 'refreshAllBrowserViewBounds', '刷新所有 BrowserView 位置')
        
        for (const [tabId, browserViewData] of this.browserViews) {
            try {
                this.setBrowserViewBounds(browserViewData.browserView)
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'refreshAllBrowserViewBounds', `刷新 BrowserView 位置失败: ${tabId}`, error)
            }
        }
    }

    /**
     * 获取 BrowserView 统计信息
     * @returns 统计信息
     */
    public getBrowserViewStats(): {
        total: number
        visible: number
        active: string | null
    } {
        let visibleCount = 0
        for (const browserViewData of this.browserViews.values()) {
            if (browserViewData.isVisible) {
                visibleCount++
            }
        }

        return {
            total: this.browserViews.size,
            visible: visibleCount,
            active: this.activeBrowserViewId
        }
    }

    /**
     * 获取指定 Tab 的 BrowserView
     * @param tabId Tab ID
     * @returns BrowserView 实例或 null
     */
    public getBrowserViewForTab(tabId: string): BrowserView | null {
        const browserViewData = this.browserViews.get(tabId)
        return browserViewData ? browserViewData.browserView : null
    }

    // ==================== 内存管理和资源释放 ====================

    /**
     * 检查内存使用情况并进行清理
     */
    private checkMemoryUsageAndCleanup(): void {
        const stats = this.getBrowserViewStats()
        const maxBrowserViews = 10 // 最大 BrowserView 数量
        
        if (stats.total > maxBrowserViews) {
            AppUtil.warn('TabBrowserViewManager', 'checkMemoryUsageAndCleanup', 
                `BrowserView 数量超过限制: ${stats.total}/${maxBrowserViews}`)
            
            this.performMemoryCleanup()
        }

        // 检查长时间未使用的 BrowserView
        this.cleanupInactiveBrowserViews()
    }

    /**
     * 执行内存清理
     */
    private performMemoryCleanup(): void {
        AppUtil.info('TabBrowserViewManager', 'performMemoryCleanup', '开始执行内存清理')

        // 获取所有非活跃的 BrowserView，按最后活跃时间排序
        const inactiveBrowserViews = Array.from(this.browserViews.entries())
            .filter(([tabId, data]) => tabId !== this.activeBrowserViewId && !data.isVisible)
            .sort(([, a], [, b]) => a.lastActiveAt - b.lastActiveAt)

        // 清理最旧的 BrowserView
        const cleanupCount = Math.min(3, inactiveBrowserViews.length)
        for (let i = 0; i < cleanupCount; i++) {
            const [tabId, browserViewData] = inactiveBrowserViews[i]
            
            try {
                this.suspendBrowserView(tabId, browserViewData)
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'performMemoryCleanup', 
                    `挂起 BrowserView 失败: ${tabId}`, error)
            }
        }
    }

    /**
     * 清理长时间未使用的 BrowserView
     */
    private cleanupInactiveBrowserViews(): void {
        const now = Date.now()
        const inactiveThreshold = 30 * 60 * 1000 // 30分钟

        for (const [tabId, browserViewData] of this.browserViews) {
            if (tabId === this.activeBrowserViewId) {
                continue
            }

            const inactiveTime = now - browserViewData.lastActiveAt
            if (inactiveTime > inactiveThreshold) {
                AppUtil.info('TabBrowserViewManager', 'cleanupInactiveBrowserViews', 
                    `清理长时间未使用的 BrowserView: ${tabId}，未使用时间: ${Math.round(inactiveTime / 60000)}分钟`)
                
                try {
                    this.suspendBrowserView(tabId, browserViewData)
                } catch (error) {
                    AppUtil.error('TabBrowserViewManager', 'cleanupInactiveBrowserViews', 
                        `挂起 BrowserView 失败: ${tabId}`, error)
                }
            }
        }
    }

    /**
     * 挂起 BrowserView
     * @param tabId Tab ID
     * @param browserViewData BrowserView 数据
     */
    private suspendBrowserView(tabId: string, browserViewData: BrowserViewData): void {
        AppUtil.info('TabBrowserViewManager', 'suspendBrowserView', `挂起 BrowserView: ${tabId}`)

        const webContents = browserViewData.browserView.webContents

        try {
            // 设置后台节流
            webContents.setBackgroundThrottling(true)

            // 暂停音频
            webContents.setAudioMuted(true)

            // 如果支持，可以进一步减少内存使用
            if (webContents.session && webContents.session.clearCache) {
                webContents.session.clearCache()
            }

            // 标记为已挂起
            browserViewData.lastActiveAt = 0 // 标记为已挂起

            AppUtil.info('TabBrowserViewManager', 'suspendBrowserView', `成功挂起 BrowserView: ${tabId}`)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'suspendBrowserView', `挂起 BrowserView 失败: ${tabId}`, error)
            throw error
        }
    }

    /**
     * 恢复挂起的 BrowserView
     * @param tabId Tab ID
     * @param browserViewData BrowserView 数据
     */
    private resumeBrowserView(tabId: string, browserViewData: BrowserViewData): void {
        AppUtil.info('TabBrowserViewManager', 'resumeBrowserView', `恢复 BrowserView: ${tabId}`)

        const webContents = browserViewData.browserView.webContents

        try {
            // 恢复渲染
            webContents.setBackgroundThrottling(false)

            // 恢复音频
            webContents.setAudioMuted(false)

            // 更新最后活跃时间
            browserViewData.lastActiveAt = Date.now()

            AppUtil.info('TabBrowserViewManager', 'resumeBrowserView', `成功恢复 BrowserView: ${tabId}`)
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'resumeBrowserView', `恢复 BrowserView 失败: ${tabId}`, error)
            throw error
        }
    }

    // ==================== BrowserView 状态同步 ====================

    /**
     * 同步 BrowserView 状态到 TabManager
     */
    private syncBrowserViewStateToTabManager(): void {
        if (!this.tabManager) {
            return
        }

        for (const [tabId, browserViewData] of this.browserViews) {
            const tab = this.tabManager.getTabById(tabId)
            if (!tab) {
                continue
            }

            const webContents = browserViewData.browserView.webContents

            try {
                // 同步加载状态
                const isLoading = webContents.isLoading()
                if (tab.isLoading !== isLoading) {
                    this.tabManager.setTabLoading(tabId, isLoading)
                }

                // 同步 URL（如果发生了导航）
                const currentUrl = webContents.getURL()
                if (tab.url !== currentUrl && currentUrl && !currentUrl.startsWith('chrome-error://')) {
                    tab.url = currentUrl
                }

                // 同步标题
                const currentTitle = webContents.getTitle()
                if (tab.title !== currentTitle && currentTitle) {
                    this.tabManager.updateTabTitle(tabId, currentTitle)
                }
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'syncBrowserViewStateToTabManager', 
                    `同步状态失败: ${tabId}`, error)
            }
        }
    }

    /**
     * 更新窗口标题
     * @param tabId 当前激活的 Tab ID
     */
    private updateWindowTitle(tabId: string): void {
        const parentWindow = this.getParentWindow()
        if (!parentWindow) {
            return
        }

        const browserViewData = this.browserViews.get(tabId)
        if (!browserViewData) {
            return
        }

        try {
            const webContents = browserViewData.browserView.webContents
            const title = webContents.getTitle()
            
            if (title) {
                const windowTitle = `${title} - EDA 专业版`
                parentWindow.setTitle(windowTitle)
                
                AppUtil.info('TabBrowserViewManager', 'updateWindowTitle', `更新窗口标题: ${windowTitle}`)
            }
        } catch (error) {
            AppUtil.error('TabBrowserViewManager', 'updateWindowTitle', '更新窗口标题失败', error)
        }
    }

    /**
     * 触发 BrowserView 事件
     * @param eventType 事件类型
     * @param data 事件数据
     */
    private emitBrowserViewEvent(eventType: string, data: any): void {
        // 这里可以集成到事件系统中
        AppUtil.info('TabBrowserViewManager', 'emitBrowserViewEvent', `触发事件: ${eventType}`, data)
        
        // 如果有事件监听器，可以在这里触发
        // this.emit(eventType, data)
    }

    // ==================== 公共方法增强 ====================

    /**
     * 强制同步所有 BrowserView 状态
     */
    public forceSyncAllBrowserViewStates(): void {
        AppUtil.info('TabBrowserViewManager', 'forceSyncAllBrowserViewStates', '强制同步所有 BrowserView 状态')
        this.syncBrowserViewStateToTabManager()
    }

    /**
     * 执行内存清理
     */
    public performManualMemoryCleanup(): void {
        AppUtil.info('TabBrowserViewManager', 'performManualMemoryCleanup', '执行手动内存清理')
        this.performMemoryCleanup()
    }

    /**
     * 获取内存使用统计
     * @returns 内存使用统计
     */
    public getMemoryStats(): {
        totalBrowserViews: number
        activeBrowserViews: number
        suspendedBrowserViews: number
        oldestInactiveTime: number
    } {
        const now = Date.now()
        let activeBrowserViews = 0
        let suspendedBrowserViews = 0
        let oldestInactiveTime = 0

        for (const browserViewData of this.browserViews.values()) {
            if (browserViewData.isVisible) {
                activeBrowserViews++
            } else if (browserViewData.lastActiveAt === 0) {
                suspendedBrowserViews++
            } else {
                const inactiveTime = now - browserViewData.lastActiveAt
                oldestInactiveTime = Math.max(oldestInactiveTime, inactiveTime)
            }
        }

        return {
            totalBrowserViews: this.browserViews.size,
            activeBrowserViews,
            suspendedBrowserViews,
            oldestInactiveTime
        }
    }

    /**
     * 销毁管理器
     */
    public destroy(): void {
        AppUtil.info('TabBrowserViewManager', 'destroy', '销毁 Tab BrowserView 管理器')

        // 销毁所有 BrowserView
        for (const [tabId, browserViewData] of this.browserViews) {
            try {
                // 从父窗口移除
                const parentWindow = this.getParentWindow()
                if (parentWindow) {
                    parentWindow.removeBrowserView(browserViewData.browserView)
                }
                
                // 销毁 WebContents
                // browserViewData.browserView.webContents.destroy() // destroy 方法在新版本 Electron 中已移除
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'destroy', `销毁 BrowserView 失败: ${tabId}`, error)
            }
        }

        // 销毁预加载和重载 BrowserView
        if (this.preloadBrowserView) {
            try {
                // this.preloadBrowserView.webContents.destroy() // destroy 方法在新版本 Electron 中已移除
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'destroy', '销毁预加载 BrowserView 失败', error)
            }
        }

        if (this.reloadBrowserView) {
            try {
                // this.reloadBrowserView.webContents.destroy() // destroy 方法在新版本 Electron 中已移除
            } catch (error) {
                AppUtil.error('TabBrowserViewManager', 'destroy', '销毁重载 BrowserView 失败', error)
            }
        }

        // 清理状态
        this.browserViews.clear()
        this.activeBrowserViewId = null
        this.preloadBrowserView = null
        this.reloadBrowserView = null
        this.tabManager = null

        AppUtil.info('TabBrowserViewManager', 'destroy', 'Tab BrowserView 管理器已销毁')
    }
}