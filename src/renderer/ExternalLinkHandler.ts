/**
 * 外部链接处理器
 * 负责处理外部链接的安全检查和用户确认
 */

/**
 * 链接安全级别
 */
export enum LinkSecurityLevel {
    SAFE = 'safe',           // 安全链接
    CAUTION = 'caution',     // 需要谨慎的链接
    DANGEROUS = 'dangerous'  // 危险链接
}

/**
 * 链接分析结果
 */
export interface LinkAnalysisResult {
    /** 原始 URL */
    originalUrl: string
    /** 解析后的 URL */
    parsedUrl: URL
    /** 安全级别 */
    securityLevel: LinkSecurityLevel
    /** 链接类型 */
    linkType: 'internal' | 'external' | 'special'
    /** 域名信息 */
    domainInfo: {
        hostname: string
        isKnownSafe: boolean
        isBlacklisted: boolean
        reputation: number // 0-100，100为最安全
    }
    /** 警告信息 */
    warnings: string[]
    /** 建议的处理方式 */
    recommendedAction: 'allow' | 'warn' | 'block'
}

/**
 * 外部链接处理器类
 */
export class ExternalLinkHandler {
    /** 安全域名白名单 */
    private safeDomains = new Set([
        // 开发相关
        'github.com',
        'gitlab.com',
        'bitbucket.org',
        'stackoverflow.com',
        'developer.mozilla.org',
        'w3schools.com',
        'codepen.io',
        'jsfiddle.net',
        
        // 文档和学习
        'docs.microsoft.com',
        'docs.google.com',
        'nodejs.org',
        'reactjs.org',
        'vuejs.org',
        'angular.io',
        
        // 工具和服务
        'npmjs.com',
        'yarnpkg.com',
        'cdnjs.com',
        'unpkg.com',
        'jsdelivr.net',
        
        // 设计和资源
        'figma.com',
        'dribbble.com',
        'behance.net',
        'unsplash.com',
        'pexels.com'
    ])

    /** 危险域名黑名单 */
    private dangerousDomains = new Set([
        // 这里可以添加已知的恶意域名
        'malware-example.com',
        'phishing-site.net'
    ])

    /** 内部域名列表 */
    private internalDomains = new Set([
        'lceda.cn',
        'easyeda.com',
        'jlc.com',
        'jlcpcb.com',
        'szlcsc.com'
    ])

    /** 统计信息 */
    private stats = {
        totalAnalyzed: 0,
        safeLinks: 0,
        cautionLinks: 0,
        dangerousLinks: 0,
        blockedLinks: 0,
        allowedLinks: 0
    }

    constructor() {
        // 初始化外部链接处理器
    }

    /**
     * 分析链接安全性
     * @param url 要分析的 URL
     * @returns 链接分析结果
     */
    public analyzeLink(url: string): LinkAnalysisResult {
        this.stats.totalAnalyzed++

        try {
            const parsedUrl = new URL(url, window.location.href)
            const hostname = parsedUrl.hostname.toLowerCase()
            
            // 基础分析
            const linkType = this.determineLinkType(parsedUrl)
            const domainInfo = this.analyzeDomain(hostname)
            const securityLevel = this.determineSecurityLevel(parsedUrl, domainInfo)
            const warnings = this.generateWarnings(parsedUrl, domainInfo, securityLevel)
            const recommendedAction = this.getRecommendedAction(securityLevel, linkType)

            // 更新统计
            this.updateStats(securityLevel, recommendedAction)

            const result: LinkAnalysisResult = {
                originalUrl: url,
                parsedUrl,
                securityLevel,
                linkType,
                domainInfo,
                warnings,
                recommendedAction
            }

            // 链接分析完成
            return result

        } catch (error) {
            // 链接分析失败
            
            // 返回危险级别的默认结果
            return {
                originalUrl: url,
                parsedUrl: new URL('about:blank'),
                securityLevel: LinkSecurityLevel.DANGEROUS,
                linkType: 'external',
                domainInfo: {
                    hostname: 'unknown',
                    isKnownSafe: false,
                    isBlacklisted: false,
                    reputation: 0
                },
                warnings: ['URL 格式无效或无法解析'],
                recommendedAction: 'block'
            }
        }
    }

    /**
     * 确定链接类型
     * @param parsedUrl 解析后的 URL
     * @returns 链接类型
     */
    private determineLinkType(parsedUrl: URL): 'internal' | 'external' | 'special' {
        const hostname = parsedUrl.hostname.toLowerCase()
        const protocol = parsedUrl.protocol.toLowerCase()

        // 检查特殊协议
        if (!['http:', 'https:'].includes(protocol)) {
            return 'special'
        }

        // 检查是否为内部域名
        const currentHostname = window.location.hostname.toLowerCase()
        if (hostname === currentHostname) {
            return 'internal'
        }

        // 检查内部域名列表
        for (const domain of this.internalDomains) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
                return 'internal'
            }
        }

        return 'external'
    }

    /**
     * 分析域名信息
     * @param hostname 主机名
     * @returns 域名信息
     */
    private analyzeDomain(hostname: string): LinkAnalysisResult['domainInfo'] {
        const isKnownSafe = this.isSafeDomain(hostname)
        const isBlacklisted = this.dangerousDomains.has(hostname)
        
        // 计算声誉分数
        let reputation = 50 // 默认中等声誉
        
        if (isKnownSafe) {
            reputation = 90
        } else if (isBlacklisted) {
            reputation = 0
        } else {
            // 基于域名特征计算声誉
            reputation = this.calculateDomainReputation(hostname)
        }

        return {
            hostname,
            isKnownSafe,
            isBlacklisted,
            reputation
        }
    }

    /**
     * 检查是否为安全域名
     * @param hostname 主机名
     * @returns 是否为安全域名
     */
    private isSafeDomain(hostname: string): boolean {
        // 直接匹配
        if (this.safeDomains.has(hostname)) {
            return true
        }

        // 检查子域名
        for (const safeDomain of this.safeDomains) {
            if (hostname.endsWith('.' + safeDomain)) {
                return true
            }
        }

        return false
    }

    /**
     * 计算域名声誉分数
     * @param hostname 主机名
     * @returns 声誉分数 (0-100)
     */
    private calculateDomainReputation(hostname: string): number {
        let score = 50 // 基础分数

        // 域名长度检查
        if (hostname.length > 50) {
            score -= 10 // 过长的域名可能有问题
        }

        // 子域名层级检查
        const parts = hostname.split('.')
        if (parts.length > 4) {
            score -= 15 // 过多的子域名层级
        }

        // 可疑字符检查
        if (/[0-9]{4,}/.test(hostname)) {
            score -= 10 // 包含长数字序列
        }

        if (/[-_]{2,}/.test(hostname)) {
            score -= 5 // 包含连续的连字符或下划线
        }

        // 顶级域名检查
        const tld = parts[parts.length - 1]
        const suspiciousTlds = ['tk', 'ml', 'ga', 'cf', 'click', 'download']
        if (suspiciousTlds.includes(tld)) {
            score -= 20 // 可疑的顶级域名
        }

        // 知名域名后缀检查
        const trustedTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil']
        if (trustedTlds.includes(tld)) {
            score += 10
        }

        return Math.max(0, Math.min(100, score))
    }

    /**
     * 确定安全级别
     * @param parsedUrl 解析后的 URL
     * @param domainInfo 域名信息
     * @returns 安全级别
     */
    private determineSecurityLevel(parsedUrl: URL, domainInfo: LinkAnalysisResult['domainInfo']): LinkSecurityLevel {
        // 黑名单域名直接标记为危险
        if (domainInfo.isBlacklisted) {
            return LinkSecurityLevel.DANGEROUS
        }

        // 已知安全域名
        if (domainInfo.isKnownSafe) {
            return LinkSecurityLevel.SAFE
        }

        // 基于声誉分数判断
        if (domainInfo.reputation >= 80) {
            return LinkSecurityLevel.SAFE
        } else if (domainInfo.reputation >= 40) {
            return LinkSecurityLevel.CAUTION
        } else {
            return LinkSecurityLevel.DANGEROUS
        }
    }

    /**
     * 生成警告信息
     * @param parsedUrl 解析后的 URL
     * @param domainInfo 域名信息
     * @param securityLevel 安全级别
     * @returns 警告信息数组
     */
    private generateWarnings(parsedUrl: URL, domainInfo: LinkAnalysisResult['domainInfo'], securityLevel: LinkSecurityLevel): string[] {
        const warnings: string[] = []

        if (domainInfo.isBlacklisted) {
            warnings.push('此域名在黑名单中，可能存在安全风险')
        }

        if (securityLevel === LinkSecurityLevel.DANGEROUS) {
            warnings.push('此链接被标记为危险，不建议访问')
        }

        if (domainInfo.reputation < 30) {
            warnings.push('此域名声誉较低，请谨慎访问')
        }

        if (parsedUrl.protocol === 'http:') {
            warnings.push('此链接使用不安全的 HTTP 协议')
        }

        // 检查可疑的 URL 模式
        const pathname = parsedUrl.pathname.toLowerCase()
        const suspiciousPatterns = [
            '/download',
            '/install',
            '/setup',
            '.exe',
            '.msi',
            '.dmg',
            '.pkg'
        ]

        for (const pattern of suspiciousPatterns) {
            if (pathname.includes(pattern)) {
                warnings.push('此链接可能指向下载文件，请确认安全性')
                break
            }
        }

        return warnings
    }

    /**
     * 获取建议的处理方式
     * @param securityLevel 安全级别
     * @param linkType 链接类型
     * @returns 建议的处理方式
     */
    private getRecommendedAction(securityLevel: LinkSecurityLevel, linkType: 'internal' | 'external' | 'special'): 'allow' | 'warn' | 'block' {
        if (linkType === 'internal') {
            return 'allow'
        }

        if (linkType === 'special') {
            return 'warn'
        }

        switch (securityLevel) {
            case LinkSecurityLevel.SAFE:
                return 'allow'
            case LinkSecurityLevel.CAUTION:
                return 'warn'
            case LinkSecurityLevel.DANGEROUS:
                return 'block'
            default:
                return 'block'
        }
    }

    /**
     * 更新统计信息
     * @param securityLevel 安全级别
     * @param recommendedAction 建议的处理方式
     */
    private updateStats(securityLevel: LinkSecurityLevel, recommendedAction: 'allow' | 'warn' | 'block'): void {
        switch (securityLevel) {
            case LinkSecurityLevel.SAFE:
                this.stats.safeLinks++
                break
            case LinkSecurityLevel.CAUTION:
                this.stats.cautionLinks++
                break
            case LinkSecurityLevel.DANGEROUS:
                this.stats.dangerousLinks++
                break
        }

        switch (recommendedAction) {
            case 'allow':
                this.stats.allowedLinks++
                break
            case 'block':
                this.stats.blockedLinks++
                break
        }
    }

    /**
     * 添加安全域名
     * @param domain 域名
     */
    public addSafeDomain(domain: string): void {
        this.safeDomains.add(domain.toLowerCase())
        // 添加安全域名
    }

    /**
     * 添加危险域名
     * @param domain 域名
     */
    public addDangerousDomain(domain: string): void {
        this.dangerousDomains.add(domain.toLowerCase())
        // 添加危险域名
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    public getStats(): typeof this.stats {
        return { ...this.stats }
    }

    /**
     * 重置统计信息
     */
    public resetStats(): void {
        this.stats = {
            totalAnalyzed: 0,
            safeLinks: 0,
            cautionLinks: 0,
            dangerousLinks: 0,
            blockedLinks: 0,
            allowedLinks: 0
        }
        // 统计信息已重置
    }
}