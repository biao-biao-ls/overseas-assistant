/**
 * MainWindow Tab 集成类
 * 负责将新的 Tab 管理系统集成到 MainWindow 中
 */

import { 
    TabManager, 
    TabConfigFactory, 
    TabIPCHandler, 
    TabBrowserViewManager 
} from '../../mgr'
import { TabConfig, TabItem } from '../../types'
import { AppUtil } from '../../utils/AppUtil'
import { AppConfig } from '../../config/AppConfig'
import { EWnd } from '../../enum/EWnd'
import { MainWindow } from './MainWindow'

/**
 * MainWindow Tab 集成类
 */
export class MainWindowTabIntegration {
    /** MainWindow 实例 */
    private mainWindow: MainWindow
    
    /** TabManager 实例 */
    private tabManager: TabManager | null = null
    
    /** IPC 处理器 */
    private ipcHandler: TabIPCHandler | null = null
    
    /** BrowserView 管理器 */
    private browserViewManager: TabBrowserViewManager | null = null
    
    /** 是否已初始化 */
    private initialized: boolean = false
    
    /** 初始化配置 */
    private config: TabConfig

    constructor(mainWindow: MainWindow) {
        this.mainWindow = mainWindow
        this.config = this.createTabConfig()
        
        AppUtil.info('MainWindowTabIntegration', 'constructor', '初始化 MainWindow Tab 集成')
    }

    /**
     * 创建 Tab 配置
     * @returns Tab 配置
     */
    private createTabConfig(): TabConfig {
        const baseConfig = TabConfigFactory.createDefaultConfig()
        
        // 根据 MainWindow 的实际配置调整
        return TabConfigFactory.createCustomConfig({
            ...baseConfig,
            userCenterUrl: this.getUserCenterUrl(),
            defaultIndexUrl: this.getDefaultIndexUrl(),
            maxTabs: 20,
            enableTabReordering: true,
            tabSwitchAnimation: true,
            switchAnimationDuration: 300
        })
    }

    /**
     * 获取用户中心 URL
     * @returns 用户中心 URL
     */
    private getUserCenterUrl(): string {
        const indexUrl = AppConfig.getIndexUrl()
        if (indexUrl) {
            try {
                const url = new URL(indexUrl)
                url.hash = '#/user-center'
                return url.toString()
            } catch (error) {
                AppUtil.warn('MainWindowTabIntegration', 'getUserCenterUrl', '解析主页 URL 失败', error)
            }
        }
        
        // 使用默认值
        return 'https://lceda.cn/#/user-center'
    }

    /**
     * 获取默认首页 URL
     * @returns 默认首页 URL
     */
    private getDefaultIndexUrl(): string {
        return AppConfig.getIndexUrl() || 'https://lceda.cn/'
    }

    /**
     * 初始化 Tab 系统
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            AppUtil.warn('MainWindowTabIntegration', 'initialize', 'Tab 系统已经初始化')
            return
        }

        try {
            AppUtil.info('MainWindowTabIntegration', 'initialize', '开始初始化 Tab 系统')

            // 1. 创建 TabManager
            this.tabManager = TabManager.getInstance(this.config)
            
            // 2. 创建 IPC 处理器
            this.ipcHandler = new TabIPCHandler()
            this.ipcHandler.initialize(this.tabManager)
            
            // 3. 创建 BrowserView 管理器
            this.browserViewManager = new TabBrowserViewManager(EWnd.EMain)
            this.browserViewManager.initialize(this.tabManager)
            
            // 4. 设置事件监听器
            this.setupEventListeners()
            
            // 5. 创建初始 Tab
            await this.createInitialTabs()
            
            this.initialized = true
            AppUtil.info('MainWindowTabIntegration', 'initialize', 'Tab 系统初始化完成')

        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'initialize', 'Tab 系统初始化失败', error)
            throw error
        }
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        if (!this.tabManager) {
            return
        }

        // 监听 Tab 创建事件
        this.tabManager.onTabCreated((data) => {
            AppUtil.info('MainWindowTabIntegration', 'onTabCreated', `Tab 创建: ${data.tabId}`)
            this.syncTabDataToRenderer()
        })

        // 监听 Tab 关闭事件
        this.tabManager.onTabClosed((data) => {
            AppUtil.info('MainWindowTabIntegration', 'onTabClosed', `Tab 关闭: ${data.tabId}`)
            this.syncTabDataToRenderer()
        })

        // 监听 Tab 激活事件
        this.tabManager.onTabActivated((data) => {
            AppUtil.info('MainWindowTabIntegration', 'onTabActivated', `Tab 激活: ${data.tabId}`)
            this.handleTabActivated(data.tabId!, data.tabItem!)
        })

        // 监听 Tab 标题变更事件
        this.tabManager.onTabTitleChanged((data) => {
            AppUtil.info('MainWindowTabIntegration', 'onTabTitleChanged', 
                `Tab 标题变更: ${data.tabId} -> ${data.newTitle}`)
            this.updateWindowTitle(data.newTitle as string)
        })

        // 监听 Tab 顺序变更事件
        this.tabManager.onTabOrderChanged((data) => {
            AppUtil.info('MainWindowTabIntegration', 'onTabOrderChanged', 'Tab 顺序变更')
            this.syncTabDataToRenderer()
        })

        AppUtil.info('MainWindowTabIntegration', 'setupEventListeners', '事件监听器设置完成')
    }

    /**
     * 创建初始 Tab
     */
    private async createInitialTabs(): Promise<void> {
        if (!this.tabManager) {
            throw new Error('TabManager 未初始化')
        }

        AppUtil.info('MainWindowTabIntegration', 'createInitialTabs', '创建初始 Tab')

        try {
            // 1. 确保用户中心 Tab 存在
            const userCenterTabId = this.tabManager.ensureUserCenterTab()
            AppUtil.info('MainWindowTabIntegration', 'createInitialTabs', `用户中心 Tab: ${userCenterTabId}`)

            // 2. 创建默认首页 Tab
            const defaultIndexUrl = this.getDefaultIndexUrl()
            if (defaultIndexUrl && defaultIndexUrl !== this.getUserCenterUrl()) {
                const indexTabId = this.tabManager.createTab(defaultIndexUrl, {
                    title: 'EDA 专业版',
                    position: 'last'
                })
                AppUtil.info('MainWindowTabIntegration', 'createInitialTabs', `默认首页 Tab: ${indexTabId}`)
            }

            // 3. 激活用户中心 Tab（根据需求 1.4）
            this.tabManager.switchToTab(userCenterTabId)

            AppUtil.info('MainWindowTabIntegration', 'createInitialTabs', '初始 Tab 创建完成')

        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'createInitialTabs', '创建初始 Tab 失败', error)
            throw error
        }
    }

    /**
     * 处理 Tab 激活事件
     * @param tabId Tab ID
     * @param tabItem Tab 数据
     */
    private handleTabActivated(tabId: string, tabItem: TabItem): void {
        // 更新当前 Tab 类型（兼容现有逻辑）
        this.updateCurrentTabType(tabItem)
        
        // 同步 Tab 数据到渲染进程
        this.syncTabDataToRenderer()
        
        // 更新窗口标题
        this.updateWindowTitle(tabItem.title)
    }

    /**
     * 更新当前 Tab 类型
     * @param tabItem Tab 数据
     */
    private updateCurrentTabType(tabItem: TabItem): void {
        // 这里需要根据 URL 判断 Tab 类型，兼容现有的 ETabType 枚举
        // 暂时使用默认值，具体逻辑可以根据实际需要调整
        const currentTabType = this.determineTabType(tabItem.url)
        
        // 更新 MainWindow 的当前 Tab 类型（如果有相关方法）
        AppUtil.info('MainWindowTabIntegration', 'updateCurrentTabType', 
            `更新 Tab 类型: ${tabItem.id} -> ${currentTabType}`)
    }

    /**
     * 确定 Tab 类型
     * @param url Tab URL
     * @returns Tab 类型字符串
     */
    private determineTabType(url: string): string {
        try {
            const urlObj = new URL(url)
            const pathname = urlObj.pathname.toLowerCase()
            const hash = urlObj.hash.toLowerCase()

            if (hash.includes('user-center') || pathname.includes('user-center')) {
                return 'user-center'
            } else if (hash.includes('editor') || pathname.includes('editor')) {
                return 'editor'
            } else if (pathname.includes('smt')) {
                return 'smt'
            } else {
                return 'default'
            }
        } catch (error) {
            return 'default'
        }
    }

    /**
     * 同步 Tab 数据到渲染进程
     */
    private syncTabDataToRenderer(): void {
        if (this.ipcHandler) {
            this.ipcHandler.syncTabStateToRenderer()
        }
    }

    /**
     * 更新窗口标题
     * @param title 新标题
     */
    private updateWindowTitle(title: string): void {
        try {
            const windowTitle = `${title} - EDA 专业版`
            this.mainWindow.getBrowserWindow().setTitle(windowTitle)
            
            AppUtil.info('MainWindowTabIntegration', 'updateWindowTitle', `更新窗口标题: ${windowTitle}`)
        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'updateWindowTitle', '更新窗口标题失败', error)
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 获取 TabManager 实例
     * @returns TabManager 实例
     */
    public getTabManager(): TabManager | null {
        return this.tabManager
    }

    /**
     * 获取 BrowserView 管理器
     * @returns BrowserView 管理器
     */
    public getBrowserViewManager(): TabBrowserViewManager | null {
        return this.browserViewManager
    }

    /**
     * 创建新的 Tab
     * @param url Tab URL
     * @param options 创建选项
     * @returns Tab ID
     */
    public async createTab(url: string, options?: any): Promise<string | null> {
        if (!this.tabManager) {
            AppUtil.error('MainWindowTabIntegration', 'createTab', 'TabManager 未初始化')
            return null
        }

        try {
            const tabId = this.tabManager.createTab(url, options)
            AppUtil.info('MainWindowTabIntegration', 'createTab', `创建 Tab: ${tabId}`)
            return tabId
        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'createTab', '创建 Tab 失败', error)
            return null
        }
    }

    /**
     * 关闭 Tab
     * @param tabId Tab ID
     * @returns 是否成功关闭
     */
    public async closeTab(tabId: string): Promise<boolean> {
        if (!this.tabManager) {
            AppUtil.error('MainWindowTabIntegration', 'closeTab', 'TabManager 未初始化')
            return false
        }

        try {
            const result = this.tabManager.closeTab(tabId)
            AppUtil.info('MainWindowTabIntegration', 'closeTab', `关闭 Tab: ${tabId} -> ${result}`)
            return result
        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'closeTab', '关闭 Tab 失败', error)
            return false
        }
    }

    /**
     * 切换到指定 Tab
     * @param tabId Tab ID
     */
    public async switchToTab(tabId: string): Promise<void> {
        if (!this.tabManager) {
            AppUtil.error('MainWindowTabIntegration', 'switchToTab', 'TabManager 未初始化')
            return
        }

        try {
            this.tabManager.switchToTab(tabId)
            AppUtil.info('MainWindowTabIntegration', 'switchToTab', `切换到 Tab: ${tabId}`)
        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'switchToTab', '切换 Tab 失败', error)
        }
    }

    /**
     * 获取所有 Tab 数据
     * @returns Tab 数据数组
     */
    public getAllTabs(): TabItem[] {
        if (!this.tabManager) {
            return []
        }
        return this.tabManager.getAllTabs()
    }

    /**
     * 获取当前激活的 Tab
     * @returns 激活的 Tab 数据
     */
    public getActiveTab(): TabItem | null {
        if (!this.tabManager) {
            return null
        }
        return this.tabManager.getActiveTab()
    }

    /**
     * 处理来自旧系统的 Tab 创建请求
     * @param url URL
     * @param label 标签数据
     * @param reason 创建原因
     * @returns Tab ID
     */
    public handleLegacyTabCreation(url: string, label?: any, reason?: string): string | null {
        if (!this.tabManager) {
            AppUtil.error('MainWindowTabIntegration', 'handleLegacyTabCreation', 'TabManager 未初始化')
            return null
        }

        try {
            const tabId = this.tabManager.createTab(url, {
                labels: label,
                fromWindowOpen: reason === 'window.open'
            })
            
            AppUtil.info('MainWindowTabIntegration', 'handleLegacyTabCreation', 
                `处理旧系统 Tab 创建: ${tabId}`, { url, label, reason })
            
            return tabId
        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'handleLegacyTabCreation', 
                '处理旧系统 Tab 创建失败', error)
            return null
        }
    }

    /**
     * 处理来自旧系统的 Tab 切换请求
     * @param viewId 旧的 View ID
     * @param reason 切换原因
     */
    public handleLegacyTabSwitch(viewId: string, reason?: string): void {
        if (!this.tabManager) {
            AppUtil.error('MainWindowTabIntegration', 'handleLegacyTabSwitch', 'TabManager 未初始化')
            return
        }

        // 这里需要将旧的 viewId 映射到新的 tabId
        // 暂时使用简单的映射逻辑
        const tabId = this.mapViewIdToTabId(viewId)
        if (tabId) {
            this.switchToTab(tabId)
            AppUtil.info('MainWindowTabIntegration', 'handleLegacyTabSwitch', 
                `处理旧系统 Tab 切换: ${viewId} -> ${tabId}`, { reason })
        } else {
            AppUtil.warn('MainWindowTabIntegration', 'handleLegacyTabSwitch', 
                `无法映射 viewId 到 tabId: ${viewId}`)
        }
    }

    /**
     * 映射旧的 View ID 到新的 Tab ID
     * @param viewId 旧的 View ID
     * @returns 新的 Tab ID
     */
    private mapViewIdToTabId(viewId: string): string | null {
        // 这里需要实现 viewId 到 tabId 的映射逻辑
        // 可能需要维护一个映射表或者通过其他方式关联
        
        // 暂时返回 null，具体实现需要根据旧系统的逻辑调整
        return null
    }

    /**
     * 处理窗口大小变化
     */
    public handleWindowResize(): void {
        if (this.browserViewManager) {
            this.browserViewManager.refreshAllBrowserViewBounds()
        }
    }

    /**
     * 处理窗口最大化
     */
    public handleWindowMaximize(): void {
        this.handleWindowResize()
    }

    /**
     * 处理窗口取消最大化
     */
    public handleWindowUnmaximize(): void {
        this.handleWindowResize()
    }

    /**
     * 处理窗口显示状态变化
     * @param isVisible 是否可见
     */
    public handleWindowVisibilityChange(isVisible: boolean): void {
        // 这里可以添加窗口显示状态变化的处理逻辑
        AppUtil.info('MainWindowTabIntegration', 'handleWindowVisibilityChange', 
            `窗口可见性变化: ${isVisible}`)
    }

    /**
     * 获取 Tab 统计信息
     * @returns Tab 统计信息
     */
    public getTabStats(): any {
        if (!this.tabManager) {
            return null
        }
        return this.tabManager.getTabStats()
    }

    /**
     * 执行 Tab 系统健康检查
     * @returns 健康检查报告
     */
    public performHealthCheck(): any {
        if (!this.tabManager) {
            return { isHealthy: false, error: 'TabManager 未初始化' }
        }

        try {
            const integrityReport = this.tabManager.checkIntegrity()
            const tabStats = this.tabManager.getTabStats()
            const browserViewStats = this.browserViewManager?.getBrowserViewStats()

            const healthReport = {
                isHealthy: integrityReport.isValid,
                timestamp: Date.now(),
                tabManager: {
                    integrity: integrityReport,
                    stats: tabStats
                },
                browserViewManager: {
                    stats: browserViewStats
                },
                ipcHandler: {
                    stats: this.ipcHandler?.getMessageStats()
                }
            }

            AppUtil.info('MainWindowTabIntegration', 'performHealthCheck', '健康检查完成', healthReport)
            return healthReport

        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'performHealthCheck', '健康检查失败', error)
            return { isHealthy: false, error: error.message }
        }
    }

    /**
     * 修复 Tab 系统问题
     * @returns 修复报告
     */
    public repairTabSystem(): any {
        if (!this.tabManager) {
            return { fixed: false, error: 'TabManager 未初始化' }
        }

        try {
            AppUtil.info('MainWindowTabIntegration', 'repairTabSystem', '开始修复 Tab 系统')

            // 修复用户中心 Tab
            const userCenterRepair = this.tabManager.repairUserCenterTab()
            
            // 检查完整性
            const integrityCheck = this.tabManager.checkIntegrity()
            
            // 同步状态
            this.syncTabDataToRenderer()

            const repairReport = {
                fixed: userCenterRepair.fixed || !integrityCheck.isValid,
                timestamp: Date.now(),
                userCenterRepair,
                integrityCheck,
                actions: [
                    ...userCenterRepair.actions,
                    '同步状态到渲染进程'
                ]
            }

            AppUtil.info('MainWindowTabIntegration', 'repairTabSystem', '修复完成', repairReport)
            return repairReport

        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'repairTabSystem', '修复失败', error)
            return { fixed: false, error: error.message }
        }
    }

    /**
     * 销毁 Tab 系统
     */
    public destroy(): void {
        AppUtil.info('MainWindowTabIntegration', 'destroy', '销毁 Tab 系统')

        try {
            // 销毁 BrowserView 管理器
            if (this.browserViewManager) {
                this.browserViewManager.destroy()
                this.browserViewManager = null
            }

            // 销毁 IPC 处理器
            if (this.ipcHandler) {
                this.ipcHandler.destroy()
                this.ipcHandler = null
            }

            // 销毁 TabManager
            if (this.tabManager) {
                TabManager.destroyInstance()
                this.tabManager = null
            }

            this.initialized = false
            AppUtil.info('MainWindowTabIntegration', 'destroy', 'Tab 系统已销毁')

        } catch (error) {
            AppUtil.error('MainWindowTabIntegration', 'destroy', '销毁 Tab 系统失败', error)
        }
    }

    /**
     * 检查是否已初始化
     * @returns 是否已初始化
     */
    public isInitialized(): boolean {
        return this.initialized
    }

    /**
     * 获取配置
     * @returns Tab 配置
     */
    public getConfig(): TabConfig {
        return { ...this.config }
    }

    /**
     * 更新配置
     * @param newConfig 新配置
     */
    public updateConfig(newConfig: Partial<TabConfig>): void {
        this.config = { ...this.config, ...newConfig }
        AppUtil.info('MainWindowTabIntegration', 'updateConfig', '更新配置', newConfig)
    }
}