/**
 * Tab 配置工厂
 * 用于创建和管理 Tab 配置
 */

import { TabConfig } from '../types'
import { AppConfig } from '../config/AppConfig'

/**
 * Tab 配置工厂类
 */
export class TabConfigFactory {
    /**
     * 创建默认的 Tab 配置
     * @returns 默认 Tab 配置
     */
    public static createDefaultConfig(): TabConfig {
        return {
            // 用户中心页面 URL
            userCenterUrl: this.getUserCenterUrl(),
            
            // 默认首页 URL
            defaultIndexUrl: this.getDefaultIndexUrl(),
            
            // 最大 Tab 数量限制
            maxTabs: 20,
            
            // 是否启用 Tab 重新排序功能
            enableTabReordering: true,
            
            // 是否启用 Tab 切换动画
            tabSwitchAnimation: true,
            
            // Tab 切换动画持续时间（毫秒）
            switchAnimationDuration: 300,
            
            // 是否允许外部链接
            allowExternalLinks: true,
            
            // 外部链接域名白名单
            externalLinkDomains: this.getExternalLinkDomains(),
            
            // Tab 自动挂起时间（30分钟）
            tabSuspendTimeout: 30 * 60 * 1000
        }
    }

    /**
     * 创建自定义 Tab 配置
     * @param customConfig 自定义配置选项
     * @returns 合并后的 Tab 配置
     */
    public static createCustomConfig(customConfig: Partial<TabConfig>): TabConfig {
        const defaultConfig = this.createDefaultConfig()
        return {
            ...defaultConfig,
            ...customConfig
        }
    }

    /**
     * 获取用户中心 URL
     * @returns 用户中心 URL
     */
    private static getUserCenterUrl(): string {
        const indexUrl = AppConfig.getIndexUrl()
        if (indexUrl) {
            // 从主页 URL 构建用户中心 URL
            const url = new URL(indexUrl)
            url.hash = '#/user-center'
            return url.toString()
        }
        
        // 如果没有配置主页 URL，使用默认值
        return 'https://lceda.cn/#/user-center'
    }

    /**
     * 获取默认首页 URL
     * @returns 默认首页 URL
     */
    private static getDefaultIndexUrl(): string {
        return AppConfig.getIndexUrl() || 'https://lceda.cn/'
    }

    /**
     * 获取外部链接域名白名单
     * @returns 域名白名单数组
     */
    private static getExternalLinkDomains(): string[] {
        return [
            'lceda.cn',
            'easyeda.com',
            'jlc.com',
            'jlcpcb.com',
            'szlcsc.com',
            'github.com',
            'gitee.com'
        ]
    }

    /**
     * 验证 Tab 配置的有效性
     * @param config 要验证的配置
     * @returns 验证结果和错误信息
     */
    public static validateConfig(config: TabConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = []

        // 验证 URL 格式
        try {
            new URL(config.userCenterUrl)
        } catch {
            errors.push('用户中心 URL 格式无效')
        }

        try {
            new URL(config.defaultIndexUrl)
        } catch {
            errors.push('默认首页 URL 格式无效')
        }

        // 验证数值范围
        if (config.maxTabs <= 0 || config.maxTabs > 100) {
            errors.push('最大 Tab 数量必须在 1-100 之间')
        }

        if (config.switchAnimationDuration < 0 || config.switchAnimationDuration > 2000) {
            errors.push('切换动画持续时间必须在 0-2000ms 之间')
        }

        if (config.tabSuspendTimeout && config.tabSuspendTimeout < 60000) {
            errors.push('Tab 挂起时间不能少于 1 分钟')
        }

        // 验证域名白名单
        for (const domain of config.externalLinkDomains) {
            if (!domain || typeof domain !== 'string') {
                errors.push('外部链接域名白名单包含无效项')
                break
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }
}