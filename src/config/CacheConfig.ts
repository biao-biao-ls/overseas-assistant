import { AppConfig } from './AppConfig'
import { AppUtil } from '../utils/AppUtil'

/**
 * 缓存配置管理
 */
export class CacheConfig {
    // 默认缓存配置
    private static readonly DEFAULT_CONFIG = {
        // 缓存过期时间（毫秒）
        loginCacheExpiry: 24 * 60 * 60 * 1000, // 24小时
        
        // 最大缓存大小（字节）
        maxCacheSize: 50 * 1024 * 1024, // 50MB
        
        // 是否启用缓存 - 禁用登录页面缓存以避免404资源加载问题
        enableCache: false,
        
        // 缓存清理间隔（毫秒）
        cleanupInterval: 60 * 60 * 1000, // 1小时
        
        // 预缓存延迟时间（毫秒）
        precacheDelay: 2000, // 2秒
        
        // 缓存重试次数
        cacheRetryCount: 3,
        
        // 缓存重试间隔（毫秒）
        cacheRetryInterval: 1000, // 1秒
    }
    
    /**
     * 获取登录缓存过期时间
     */
    static getLoginCacheExpiry(): number {
        const expiry = AppConfig.getUserConfig('loginCacheExpiry') as number
        if (expiry === undefined) {
            AppUtil.info('CacheConfig', 'getLoginCacheExpiry', '使用默认缓存过期时间')
            AppConfig.setUserConfig('loginCacheExpiry', CacheConfig.DEFAULT_CONFIG.loginCacheExpiry)
            return CacheConfig.DEFAULT_CONFIG.loginCacheExpiry
        }
        return expiry
    }
    
    /**
     * 设置登录缓存过期时间
     */
    static setLoginCacheExpiry(expiry: number): void {
        if (expiry < 60 * 1000) { // 最小1分钟
            AppUtil.warn('CacheConfig', 'setLoginCacheExpiry', '缓存过期时间不能小于1分钟')
            return
        }
        
        if (expiry > 7 * 24 * 60 * 60 * 1000) { // 最大7天
            AppUtil.warn('CacheConfig', 'setLoginCacheExpiry', '缓存过期时间不能大于7天')
            return
        }
        
        AppConfig.setUserConfig('loginCacheExpiry', expiry)
        AppUtil.info('CacheConfig', 'setLoginCacheExpiry', `设置缓存过期时间: ${expiry}ms`)
    }
    
    /**
     * 获取最大缓存大小
     */
    static getMaxCacheSize(): number {
        const size = AppConfig.getUserConfig('maxCacheSize') as number
        if (size === undefined) {
            AppConfig.setUserConfig('maxCacheSize', CacheConfig.DEFAULT_CONFIG.maxCacheSize)
            return CacheConfig.DEFAULT_CONFIG.maxCacheSize
        }
        return size
    }
    
    /**
     * 设置最大缓存大小
     */
    static setMaxCacheSize(size: number): void {
        if (size < 10 * 1024 * 1024) { // 最小10MB
            AppUtil.warn('CacheConfig', 'setMaxCacheSize', '缓存大小不能小于10MB')
            return
        }
        
        AppConfig.setUserConfig('maxCacheSize', size)
        AppUtil.info('CacheConfig', 'setMaxCacheSize', `设置最大缓存大小: ${size} bytes`)
    }
    
    /**
     * 是否启用缓存
     */
    static isCacheEnabled(): boolean {
        const enabled = AppConfig.getUserConfig('enableCache') as boolean
        if (enabled === undefined) {
            AppConfig.setUserConfig('enableCache', CacheConfig.DEFAULT_CONFIG.enableCache)
            return CacheConfig.DEFAULT_CONFIG.enableCache
        }
        return enabled
    }
    
    /**
     * 设置是否启用缓存
     */
    static setCacheEnabled(enabled: boolean): void {
        AppConfig.setUserConfig('enableCache', enabled)
        AppUtil.info('CacheConfig', 'setCacheEnabled', `设置缓存启用状态: ${enabled}`)
    }
    
    /**
     * 获取缓存清理间隔
     */
    static getCleanupInterval(): number {
        const interval = AppConfig.getUserConfig('cleanupInterval') as number
        if (interval === undefined) {
            AppConfig.setUserConfig('cleanupInterval', CacheConfig.DEFAULT_CONFIG.cleanupInterval)
            return CacheConfig.DEFAULT_CONFIG.cleanupInterval
        }
        return interval
    }
    
    /**
     * 设置缓存清理间隔
     */
    static setCleanupInterval(interval: number): void {
        if (interval < 5 * 60 * 1000) { // 最小5分钟
            AppUtil.warn('CacheConfig', 'setCleanupInterval', '清理间隔不能小于5分钟')
            return
        }
        
        AppConfig.setUserConfig('cleanupInterval', interval)
        AppUtil.info('CacheConfig', 'setCleanupInterval', `设置缓存清理间隔: ${interval}ms`)
    }
    
    /**
     * 获取预缓存延迟时间
     */
    static getPrecacheDelay(): number {
        const delay = AppConfig.getUserConfig('precacheDelay') as number
        if (delay === undefined) {
            AppConfig.setUserConfig('precacheDelay', CacheConfig.DEFAULT_CONFIG.precacheDelay)
            return CacheConfig.DEFAULT_CONFIG.precacheDelay
        }
        return delay
    }
    
    /**
     * 设置预缓存延迟时间
     */
    static setPrecacheDelay(delay: number): void {
        if (delay < 0) {
            AppUtil.warn('CacheConfig', 'setPrecacheDelay', '预缓存延迟时间不能为负数')
            return
        }
        
        AppConfig.setUserConfig('precacheDelay', delay)
        AppUtil.info('CacheConfig', 'setPrecacheDelay', `设置预缓存延迟时间: ${delay}ms`)
    }
    
    /**
     * 获取缓存重试次数
     */
    static getCacheRetryCount(): number {
        const count = AppConfig.getUserConfig('cacheRetryCount') as number
        if (count === undefined) {
            AppConfig.setUserConfig('cacheRetryCount', CacheConfig.DEFAULT_CONFIG.cacheRetryCount)
            return CacheConfig.DEFAULT_CONFIG.cacheRetryCount
        }
        return count
    }
    
    /**
     * 设置缓存重试次数
     */
    static setCacheRetryCount(count: number): void {
        if (count < 0 || count > 10) {
            AppUtil.warn('CacheConfig', 'setCacheRetryCount', '重试次数应在0-10之间')
            return
        }
        
        AppConfig.setUserConfig('cacheRetryCount', count)
        AppUtil.info('CacheConfig', 'setCacheRetryCount', `设置缓存重试次数: ${count}`)
    }
    
    /**
     * 获取缓存重试间隔
     */
    static getCacheRetryInterval(): number {
        const interval = AppConfig.getUserConfig('cacheRetryInterval') as number
        if (interval === undefined) {
            AppConfig.setUserConfig('cacheRetryInterval', CacheConfig.DEFAULT_CONFIG.cacheRetryInterval)
            return CacheConfig.DEFAULT_CONFIG.cacheRetryInterval
        }
        return interval
    }
    
    /**
     * 设置缓存重试间隔
     */
    static setCacheRetryInterval(interval: number): void {
        if (interval < 100) { // 最小100ms
            AppUtil.warn('CacheConfig', 'setCacheRetryInterval', '重试间隔不能小于100ms')
            return
        }
        
        AppConfig.setUserConfig('cacheRetryInterval', interval)
        AppUtil.info('CacheConfig', 'setCacheRetryInterval', `设置缓存重试间隔: ${interval}ms`)
    }
    
    /**
     * 重置所有缓存配置为默认值
     */
    static resetToDefault(): void {
        for (const [key, value] of Object.entries(CacheConfig.DEFAULT_CONFIG)) {
            AppConfig.setUserConfig(key, value)
        }
        AppUtil.info('CacheConfig', 'resetToDefault', '重置缓存配置为默认值')
    }
    
    /**
     * 获取所有缓存配置
     */
    static getAllConfig(): Record<string, any> {
        return {
            loginCacheExpiry: CacheConfig.getLoginCacheExpiry(),
            maxCacheSize: CacheConfig.getMaxCacheSize(),
            enableCache: CacheConfig.isCacheEnabled(),
            cleanupInterval: CacheConfig.getCleanupInterval(),
            precacheDelay: CacheConfig.getPrecacheDelay(),
            cacheRetryCount: CacheConfig.getCacheRetryCount(),
            cacheRetryInterval: CacheConfig.getCacheRetryInterval(),
        }
    }
    
    /**
     * 验证缓存配置
     */
    static validateConfig(): boolean {
        try {
            const expiry = CacheConfig.getLoginCacheExpiry()
            const maxSize = CacheConfig.getMaxCacheSize()
            const cleanupInterval = CacheConfig.getCleanupInterval()
            const precacheDelay = CacheConfig.getPrecacheDelay()
            const retryCount = CacheConfig.getCacheRetryCount()
            const retryInterval = CacheConfig.getCacheRetryInterval()
            
            // 验证各项配置的合理性
            if (expiry < 60 * 1000 || expiry > 7 * 24 * 60 * 60 * 1000) {
                AppUtil.error('CacheConfig', 'validateConfig', '缓存过期时间配置无效')
                return false
            }
            
            if (maxSize < 10 * 1024 * 1024) {
                AppUtil.error('CacheConfig', 'validateConfig', '最大缓存大小配置无效')
                return false
            }
            
            if (cleanupInterval < 5 * 60 * 1000) {
                AppUtil.error('CacheConfig', 'validateConfig', '清理间隔配置无效')
                return false
            }
            
            if (precacheDelay < 0) {
                AppUtil.error('CacheConfig', 'validateConfig', '预缓存延迟配置无效')
                return false
            }
            
            if (retryCount < 0 || retryCount > 10) {
                AppUtil.error('CacheConfig', 'validateConfig', '重试次数配置无效')
                return false
            }
            
            if (retryInterval < 100) {
                AppUtil.error('CacheConfig', 'validateConfig', '重试间隔配置无效')
                return false
            }
            
            AppUtil.info('CacheConfig', 'validateConfig', '缓存配置验证通过')
            return true
        } catch (error) {
            AppUtil.error('CacheConfig', 'validateConfig', '缓存配置验证失败', error)
            return false
        }
    }
}