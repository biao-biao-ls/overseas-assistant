/**
 * window.open 拦截器
 * 在渲染进程中拦截 window.open 调用，转发给主进程处理
 */

import { TabIPCClient } from './TabIPCClient'
import { ExternalLinkHandler, LinkSecurityLevel, LinkAnalysisResult } from './ExternalLinkHandler'

/**
 * window.open 拦截器类
 */
export class WindowOpenInterceptor {
    /** IPC 客户端 */
    private ipcClient: TabIPCClient | null = null
    
    /** 外部链接处理器 */
    private linkHandler: ExternalLinkHandler
    
    /** 原始的 window.open 函数 */
    private originalWindowOpen: typeof window.open | null = null
    
    /** 是否已安装拦截器 */
    private installed: boolean = false
    
    /** 拦截统计 */
    private interceptStats = {
        totalCalls: 0,
        interceptedCalls: 0,
        passedThroughCalls: 0,
        lastInterceptTime: 0
    }

    constructor(ipcClient: TabIPCClient) {
        this.ipcClient = ipcClient
        this.linkHandler = new ExternalLinkHandler()
        // 初始化window.open拦截器
    }

    /**
     * 安装 window.open 拦截器
     */
    public install(): void {
        if (this.installed) {
            // window.open拦截器已经安装
            return
        }

        // 保存原始的 window.open 函数
        this.originalWindowOpen = window.open.bind(window)

        // 替换 window.open 函数
        window.open = this.interceptWindowOpen.bind(this)

        this.installed = true
        // window.open拦截器安装完成
    }

    /**
     * 卸载 window.open 拦截器
     */
    public uninstall(): void {
        if (!this.installed || !this.originalWindowOpen) {
            // window.open拦截器未安装或原始函数不存在
            return
        }

        // 恢复原始的 window.open 函数
        window.open = this.originalWindowOpen
        this.originalWindowOpen = null
        this.installed = false

        // window.open拦截器卸载完成
    }

    /**
     * 拦截 window.open 调用
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     * @returns 窗口对象或 null
     */
    private interceptWindowOpen(url?: string | URL, target?: string, features?: string): Window | null {
        this.interceptStats.totalCalls++
        this.interceptStats.lastInterceptTime = Date.now()

        // window.open调用被拦截

        // 如果没有 URL，使用原始函数
        if (!url) {
            this.interceptStats.passedThroughCalls++
            return this.originalWindowOpen!(url, target, features)
        }

        const urlString = url.toString()

        // 检查是否应该拦截此调用
        if (this.shouldIntercept(urlString, target)) {
            this.interceptStats.interceptedCalls++
            
            // 发送到主进程处理
            this.handleInterceptedCall(urlString, target, features)
            
            // 返回一个模拟的窗口对象
            return this.createMockWindow(urlString)
        } else {
            this.interceptStats.passedThroughCalls++
            
            // 使用原始函数处理
            return this.originalWindowOpen!(url, target, features)
        }
    }

    /**
     * 判断是否应该拦截 window.open 调用
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @returns 是否应该拦截
     */
    private shouldIntercept(url: string, target?: string): boolean {
        try {
            // 解析 URL
            const urlObj = new URL(url, window.location.href)
            
            // 检查协议
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                // 非HTTP(S)协议，不拦截
                return false
            }

            // 检查目标
            if (target === '_self') {
                // 目标为_self，不拦截
                return false
            }

            // 检查是否为下载链接
            if (this.isDownloadLink(url)) {
                // 下载链接，不拦截
                return false
            }

            // 检查是否为特殊链接（如 mailto:, tel: 等）
            if (this.isSpecialLink(url)) {
                // 特殊链接，不拦截
                return false
            }

            // 检查是否为内部页面
            if (this.isInternalPage(urlObj)) {
                // 内部页面，拦截处理
                return true
            }

            // 检查是否为允许的外部域名
            if (this.isAllowedExternalDomain(urlObj)) {
                // 允许的外部域名，拦截处理
                return true
            }

            // 其他外部链接，在系统浏览器中打开
            // 外部链接，拦截处理
            return true

        } catch (error) {
            // 解析URL失败，不拦截
            return false
        }
    }

    /**
     * 检查是否为内部页面
     * @param urlObj URL 对象
     * @returns 是否为内部页面
     */
    private isInternalPage(urlObj: URL): boolean {
        const currentHost = window.location.hostname
        const targetHost = urlObj.hostname
        
        // 同域名
        if (currentHost === targetHost) {
            return true
        }

        // 检查是否为内部子域名
        const internalDomains = [
            'lceda.cn',
            'easyeda.com',
            'jlc.com',
            'jlcpcb.com'
        ]

        for (const domain of internalDomains) {
            if (targetHost === domain || targetHost.endsWith('.' + domain)) {
                return true
            }
        }

        return false
    }

    /**
     * 检查是否为允许的外部域名
     * @param urlObj URL 对象
     * @returns 是否为允许的外部域名
     */
    private isAllowedExternalDomain(urlObj: URL): boolean {
        const allowedDomains = [
            'github.com',
            'gitee.com',
            'stackoverflow.com',
            'developer.mozilla.org',
            'w3schools.com'
        ]

        const targetHost = urlObj.hostname.toLowerCase()
        
        return allowedDomains.some(domain => 
            targetHost === domain || targetHost.endsWith('.' + domain)
        )
    }

    /**
     * 检查是否为特殊链接
     * @param url URL
     * @returns 是否为特殊链接
     */
    private isSpecialLink(url: string): boolean {
        const specialProtocols = [
            'mailto:',
            'tel:',
            'sms:',
            'ftp:',
            'file:',
            'data:',
            'blob:'
        ]

        const lowerUrl = url.toLowerCase()
        return specialProtocols.some(protocol => lowerUrl.startsWith(protocol))
    }

    /**
     * 检查是否为下载链接
     * @param url URL
     * @returns 是否为下载链接
     */
    private isDownloadLink(url: string): boolean {
        const downloadExtensions = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.zip', '.rar', '.7z', '.tar', '.gz',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
            '.mp3', '.mp4', '.avi', '.mov', '.wmv',
            '.exe', '.msi', '.dmg', '.deb', '.rpm'
        ]

        const lowerUrl = url.toLowerCase()
        return downloadExtensions.some(ext => lowerUrl.includes(ext))
    }

    /**
     * 处理被拦截的 window.open 调用
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private async handleInterceptedCall(url: string, target?: string, features?: string): Promise<void> {
        if (!this.ipcClient) {
            // IPC客户端不存在
            return
        }

        try {
            // 解析 URL 以确定处理方式
            const urlObj = new URL(url, window.location.href)
            const linkType = this.determineLinkType(urlObj)

            // 处理链接

            switch (linkType) {
                case 'internal':
                    // 内部页面，在新 Tab 中打开
                    await this.handleInternalLink(url, target, features)
                    break
                
                case 'external-allowed':
                    // 允许的外部域名，在新 Tab 中打开
                    await this.handleAllowedExternalLink(url, target, features)
                    break
                
                case 'external-blocked':
                    // 被阻止的外部链接，在系统浏览器中打开
                    await this.handleBlockedExternalLink(url, target, features)
                    break
                
                default:
                    // 默认处理
                    await this.handleDefaultLink(url, target, features)
                    break
            }
        } catch (error) {
            // 处理拦截的链接失败
            
            // 如果处理失败，回退到原始函数
            this.fallbackToOriginal(url, target, features)
        }
    }

    /**
     * 确定链接类型
     * @param urlObj URL 对象
     * @returns 链接类型
     */
    private determineLinkType(urlObj: URL): 'internal' | 'external-allowed' | 'external-blocked' {
        if (this.isInternalPage(urlObj)) {
            return 'internal'
        }
        
        if (this.isAllowedExternalDomain(urlObj)) {
            return 'external-allowed'
        }
        
        return 'external-blocked'
    }

    /**
     * 处理内部链接
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private async handleInternalLink(url: string, target?: string, features?: string): Promise<void> {
        // 处理内部链接
        
        const result = await this.ipcClient.handleWindowOpen(url, target, features)
        
        if (!result.success) {
            // 处理内部链接失败
            this.fallbackToOriginal(url, target, features)
        }
    }

    /**
     * 处理允许的外部链接
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private async handleAllowedExternalLink(url: string, target?: string, features?: string): Promise<void> {
        // 处理允许的外部链接
        
        // 显示确认对话框
        const userConfirmed = await this.showExternalLinkConfirmation(url)
        
        if (userConfirmed) {
            const result = await this.ipcClient.handleWindowOpen(url, target, features)
            
            if (!result.success) {
                // 处理允许的外部链接失败
                this.fallbackToOriginal(url, target, features)
            }
        } else {
            // 用户取消打开外部链接
        }
    }

    /**
     * 处理被阻止的外部链接
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private async handleBlockedExternalLink(url: string, target?: string, features?: string): Promise<void> {
        // 处理被阻止的外部链接
        
        // 使用外部链接处理器分析链接
        const analysis = this.linkHandler.analyzeLink(url)
        
        // 根据分析结果决定处理方式
        switch (analysis.recommendedAction) {
            case 'allow':
                // 直接允许
                const allowResult = await this.ipcClient!.handleWindowOpen(url, target, features)
                if (!allowResult.success) {
                    this.fallbackToOriginal(url, target, features)
                }
                break
                
            case 'warn':
                // 显示警告并询问用户
                const userChoice = await this.showSmartExternalLinkWarning(analysis)
                await this.handleUserChoice(userChoice, url, target, features)
                break
                
            case 'block':
                // 显示阻止信息
                await this.showBlockedLinkNotification(analysis)
                break
        }
    }

    /**
     * 显示智能外部链接警告
     * @param analysis 链接分析结果
     * @returns 用户选择
     */
    private async showSmartExternalLinkWarning(analysis: LinkAnalysisResult): Promise<'open-external' | 'open-internal' | 'cancel'> {
        return new Promise((resolve) => {
            const { originalUrl, securityLevel, warnings, domainInfo } = analysis
            
            let message = `即将打开外部链接：\n${originalUrl}\n\n`
            message += `安全级别：${this.getSecurityLevelText(securityLevel)}\n`
            message += `域名声誉：${domainInfo.reputation}/100\n\n`
            
            if (warnings.length > 0) {
                message += '注意事项：\n'
                warnings.forEach((warning: string, index: number) => {
                    message += `${index + 1}. ${warning}\n`
                })
                message += '\n'
            }
            
            message += '请选择处理方式：\n'
            message += '确定：在系统浏览器中打开（推荐）\n'
            message += '取消：不打开此链接'
            
            const choice = confirm(message)
            resolve(choice ? 'open-external' : 'cancel')
        })
    }

    /**
     * 显示被阻止链接的通知
     * @param analysis 链接分析结果
     */
    private async showBlockedLinkNotification(analysis: LinkAnalysisResult): Promise<void> {
        const { originalUrl, warnings } = analysis
        
        let message = `出于安全考虑，已阻止打开以下链接：\n${originalUrl}\n\n`
        
        if (warnings.length > 0) {
            message += '阻止原因：\n'
            warnings.forEach((warning: string, index: number) => {
                message += `${index + 1}. ${warning}\n`
            })
        }
        
        alert(message)
    }

    /**
     * 处理用户选择
     * @param choice 用户选择
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private async handleUserChoice(choice: string, url: string, target?: string, features?: string): Promise<void> {
        switch (choice) {
            case 'open-external':
                this.openInSystemBrowser(url)
                break
            
            case 'open-internal':
                const result = await this.ipcClient!.handleWindowOpen(url, target, features)
                if (!result.success) {
                    this.fallbackToOriginal(url, target, features)
                }
                break
            
            case 'cancel':
            default:
                // 用户取消打开链接
                break
        }
    }

    /**
     * 获取安全级别文本
     * @param level 安全级别
     * @returns 安全级别文本
     */
    private getSecurityLevelText(level: LinkSecurityLevel): string {
        switch (level) {
            case LinkSecurityLevel.SAFE:
                return '安全'
            case LinkSecurityLevel.CAUTION:
                return '需要谨慎'
            case LinkSecurityLevel.DANGEROUS:
                return '危险'
            default:
                return '未知'
        }
    }

    /**
     * 处理默认链接
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private async handleDefaultLink(url: string, target?: string, features?: string): Promise<void> {
        // 处理默认链接
        
        if (!this.ipcClient) {
            // IPC客户端不存在
            return
        }
        
        const result = await this.ipcClient.handleWindowOpen(url, target, features)
        
        if (!result.success) {
            // 处理默认链接失败
            this.fallbackToOriginal(url, target, features)
        }
    }

    /**
     * 显示外部链接确认对话框
     * @param url 目标 URL
     * @returns 用户是否确认
     */
    private async showExternalLinkConfirmation(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            const confirmed = confirm(`即将打开外部链接：\n${url}\n\n是否继续？`)
            resolve(confirmed)
        })
    }

    /**
     * 显示外部链接警告对话框
     * @param url 目标 URL
     * @returns 用户选择
     */
    private async showExternalLinkWarning(url: string): Promise<'open-external' | 'open-internal' | 'cancel'> {
        return new Promise((resolve) => {
            const message = `检测到外部链接：\n${url}\n\n为了您的安全，建议在系统浏览器中打开。\n\n请选择：`
            const choice = confirm(message + '\n\n确定：在系统浏览器中打开\n取消：不打开')
            
            if (choice) {
                resolve('open-external')
            } else {
                resolve('cancel')
            }
        })
    }

    /**
     * 在系统浏览器中打开链接
     * @param url 目标 URL
     */
    private openInSystemBrowser(url: string): void {
        // 在系统浏览器中打开
        
        // 创建一个临时的 a 标签来触发系统浏览器打开
        const tempLink = document.createElement('a')
        tempLink.href = url
        tempLink.target = '_blank'
        tempLink.rel = 'noopener noreferrer'
        
        // 添加到 DOM 并点击
        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
    }

    /**
     * 回退到原始 window.open 函数
     * @param url 目标 URL
     * @param target 目标窗口名称
     * @param features 窗口特性
     */
    private fallbackToOriginal(url: string, target?: string, features?: string): void {
        // 回退到原始window.open
        
        if (this.originalWindowOpen) {
            this.originalWindowOpen(url, target, features)
        }
    }

    /**
     * 创建模拟的窗口对象
     * @param url 目标 URL
     * @returns 模拟的窗口对象
     */
    private createMockWindow(url: string): Window {
        // 创建一个简单的模拟窗口对象
        const mockWindow = {
            closed: false,
            location: { href: url },
            close: () => {
                mockWindow.closed = true
                // 模拟窗口关闭
            },
            focus: () => {
                // 模拟窗口获得焦点
            },
            blur: () => {
                // 模拟窗口失去焦点
            },
            postMessage: (message: any, targetOrigin: string) => {
                // 模拟窗口postMessage
            }
        }

        return mockWindow as Window
    }

    /**
     * 获取拦截统计信息
     * @returns 拦截统计信息
     */
    public getInterceptStats() {
        return { ...this.interceptStats }
    }

    /**
     * 重置拦截统计
     */
    public resetInterceptStats(): void {
        this.interceptStats = {
            totalCalls: 0,
            interceptedCalls: 0,
            passedThroughCalls: 0,
            lastInterceptTime: 0
        }
    }

    /**
     * 检查拦截器是否已安装
     * @returns 是否已安装
     */
    public isInstalled(): boolean {
        return this.installed
    }

    /**
     * 销毁拦截器
     */
    public destroy(): void {
        // 销毁window.open拦截器
        
        // 卸载拦截器
        this.uninstall()
        
        // 清理引用
        this.ipcClient = null
        
        // window.open拦截器已销毁
    }
}