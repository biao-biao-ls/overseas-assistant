import { app, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { AppUtil } from '../utils/AppUtil'
import { AppConfig } from '../config/AppConfig'
import { CacheConfig } from '../config/CacheConfig'

/**
 * 登录页面缓存管理器
 * 负责缓存登录页面资源，提升加载速度和离线可用性
 */
export class LoginCacheMgr {
    private static instance: LoginCacheMgr
    private cacheDir: string
    private cacheMetaFile: string
    
    constructor() {
        this.cacheDir = path.join(app.getPath('userData'), 'login-cache')
        this.cacheMetaFile = path.join(this.cacheDir, 'cache-meta.json')
        this.ensureCacheDir()
    }
    
    static getInstance(): LoginCacheMgr {
        if (!LoginCacheMgr.instance) {
            LoginCacheMgr.instance = new LoginCacheMgr()
        }
        return LoginCacheMgr.instance
    }
    
    /**
     * 确保缓存目录存在
     */
    private ensureCacheDir(): void {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true })
                AppUtil.info('LoginCacheMgr', 'ensureCacheDir', '创建缓存目录成功')
            }
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'ensureCacheDir', '创建缓存目录失败', error)
        }
    }
    
    /**
     * 初始化缓存配置
     */
    async initCache(): Promise<void> {
        try {
            // 强制禁用登录页面缓存以避免404资源加载问题
            AppUtil.info('LoginCacheMgr', 'initCache', '登录页面缓存已禁用，跳过初始化')
            return
            
            // 检查缓存是否启用
            if (!CacheConfig.isCacheEnabled()) {
                AppUtil.info('LoginCacheMgr', 'initCache', '缓存已禁用，跳过初始化')
                return
            }
            
            // 验证缓存配置
            if (!CacheConfig.validateConfig()) {
                AppUtil.warn('LoginCacheMgr', 'initCache', '缓存配置无效，重置为默认值')
                CacheConfig.resetToDefault()
            }
            
            // 设置缓存策略
            await this.setupCachePolicy()
            
            // 预缓存登录页面
            await this.precacheLoginPage()
            
            AppUtil.info('LoginCacheMgr', 'initCache', '缓存初始化完成')
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'initCache', '缓存初始化失败', error)
        }
    }
    
    /**
     * 设置缓存策略
     */
    private async setupCachePolicy(): Promise<void> {
        const ses = session.defaultSession
        
        // 注意：Electron 的 session 没有 setCacheSize 方法
        // 缓存大小通过其他方式管理，这里记录配置信息
        const maxCacheSize = CacheConfig.getMaxCacheSize()
        AppUtil.info('LoginCacheMgr', 'setupCachePolicy', `配置最大缓存大小: ${maxCacheSize} bytes`)
        
        // 配置缓存策略
        ses.webRequest.onBeforeRequest((details, callback) => {
            const url = details.url
            
            // 对登录相关资源启用缓存
            if (this.isLoginRelatedUrl(url)) {
                // 缓存策略已应用，无需日志输出
            }
            
            callback({})
        })
        
        // 设置响应头缓存策略 - 禁用登录页面缓存
        ses.webRequest.onHeadersReceived((details, callback) => {
            const url = details.url
            const responseHeaders = details.responseHeaders || {}
            
            if (this.isLoginRelatedUrl(url)) {
                // 禁用登录页面缓存，强制从服务器获取最新资源
                responseHeaders['Cache-Control'] = ['no-cache, no-store, must-revalidate']
                responseHeaders['Pragma'] = ['no-cache']
                responseHeaders['Expires'] = ['0']
            }
            
            callback({ responseHeaders })
        })
    }
    
    /**
     * 判断是否为登录相关URL
     */
    private isLoginRelatedUrl(url: string): boolean {
        const loginDomains = [
            'passport.jlcpcb.com',
            'testpassport.jlcpcb.com',
            'dev-passport.jlcpcb.com',
            'fat-temp-passport.jlcpcb.com'
        ]
        
        return loginDomains.some(domain => url.includes(domain)) ||
               url.includes('/login') ||
               url.includes('/auth/') ||
               url.includes('static') && (url.includes('.css') || url.includes('.js') || url.includes('.png') || url.includes('.jpg'))
    }
    
    /**
     * 预缓存登录页面
     */
    async precacheLoginPage(): Promise<void> {
        try {
            const loginUrl = AppConfig.getLoginUrlWithTimeStamp(false) // 不带时间戳
            const cacheKey = this.getCacheKey(loginUrl)
            
            // 检查缓存是否有效
            if (await this.isCacheValid(cacheKey)) {
                AppUtil.info('LoginCacheMgr', 'precacheLoginPage', '登录页面缓存有效，跳过预缓存')
                return
            }
            
            // 预加载登录页面到缓存
            await this.cacheLoginPage(loginUrl, cacheKey)
            
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'precacheLoginPage', '预缓存登录页面失败', error)
        }
    }
    
    /**
     * 缓存登录页面（增强错误处理和超时机制）
     */
    private async cacheLoginPage(url: string, cacheKey: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { net } = require('electron')
            const request = net.request(url)
            
            // 设置超时机制
            const timeout = setTimeout(() => {
                request.abort()
                reject(new Error('请求超时'))
            }, 30000) // 30秒超时
            
            let data = ''
            let dataSize = 0
            const maxSize = 10 * 1024 * 1024 // 10MB 最大限制
            
            request.on('response', (response) => {
                // 检查响应状态
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    clearTimeout(timeout)
                    reject(new Error(`HTTP错误: ${response.statusCode}`))
                    return
                }
                
                response.on('data', (chunk) => {
                    dataSize += chunk.length
                    if (dataSize > maxSize) {
                        clearTimeout(timeout)
                        request.abort()
                        reject(new Error('响应数据过大'))
                        return
                    }
                    data += chunk.toString()
                })
                
                response.on('end', async () => {
                    clearTimeout(timeout)
                    try {
                        // 异步保存页面内容到缓存
                        const cacheFile = path.join(this.cacheDir, `${cacheKey}.html`)
                        await fs.promises.writeFile(cacheFile, data, 'utf-8')
                        
                        // 更新缓存元数据
                        const cacheExpiry = CacheConfig.getLoginCacheExpiry()
                        await this.updateCacheMeta(cacheKey, {
                            url,
                            cachedAt: Date.now(),
                            expiresAt: Date.now() + cacheExpiry,
                            size: data.length
                        })
                        
                        AppUtil.info('LoginCacheMgr', 'cacheLoginPage', `登录页面缓存成功: ${cacheKey}`)
                        resolve()
                    } catch (error) {
                        AppUtil.error('LoginCacheMgr', 'cacheLoginPage', '保存缓存失败', error)
                        reject(error)
                    }
                })
                
                response.on('error', (error) => {
                    clearTimeout(timeout)
                    AppUtil.error('LoginCacheMgr', 'cacheLoginPage', '响应流错误', error)
                    reject(error)
                })
            })
            
            request.on('error', (error) => {
                clearTimeout(timeout)
                AppUtil.error('LoginCacheMgr', 'cacheLoginPage', '请求登录页面失败', error)
                reject(error)
            })
            
            request.on('abort', () => {
                clearTimeout(timeout)
                reject(new Error('请求被中止'))
            })
            
            try {
                request.end()
            } catch (error) {
                clearTimeout(timeout)
                reject(error)
            }
        })
    }
    
    /**
     * 获取缓存的登录页面
     */
    async getCachedLoginPage(url: string): Promise<string | null> {
        try {
            const cacheKey = this.getCacheKey(url)
            
            if (!(await this.isCacheValid(cacheKey))) {
                return null
            }
            
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.html`)
            
            if (fs.existsSync(cacheFile)) {
                const content = fs.readFileSync(cacheFile, 'utf-8')
                AppUtil.info('LoginCacheMgr', 'getCachedLoginPage', `使用缓存的登录页面: ${cacheKey}`)
                return content
            }
            
            return null
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'getCachedLoginPage', '获取缓存页面失败', error)
            return null
        }
    }
    
    /**
     * 检查缓存是否有效
     */
    private async isCacheValid(cacheKey: string): Promise<boolean> {
        try {
            const meta = this.getCacheMeta()
            const cacheInfo = meta[cacheKey]
            
            if (!cacheInfo) {
                return false
            }
            
            // 检查是否过期
            if (Date.now() > cacheInfo.expiresAt) {
                AppUtil.info('LoginCacheMgr', 'isCacheValid', `缓存已过期: ${cacheKey}`)
                await this.removeCacheItem(cacheKey)
                return false
            }
            
            // 检查文件是否存在
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.html`)
            if (!fs.existsSync(cacheFile)) {
                AppUtil.warn('LoginCacheMgr', 'isCacheValid', `缓存文件不存在: ${cacheFile}`)
                delete meta[cacheKey]
                this.saveCacheMeta(meta)
                return false
            }
            
            return true
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'isCacheValid', '检查缓存有效性失败', error)
            return false
        }
    }
    
    /**
     * 生成缓存键
     */
    private getCacheKey(url: string): string {
        // 移除查询参数和时间戳，生成稳定的缓存键
        const urlObj = new URL(url)
        const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`
        return Buffer.from(baseUrl).toString('base64').replace(/[/+=]/g, '_')
    }
    
    /**
     * 获取缓存元数据
     */
    private getCacheMeta(): Record<string, any> {
        try {
            if (fs.existsSync(this.cacheMetaFile)) {
                const content = fs.readFileSync(this.cacheMetaFile, 'utf-8')
                return JSON.parse(content)
            }
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'getCacheMeta', '读取缓存元数据失败', error)
        }
        return {}
    }
    
    /**
     * 更新缓存元数据（异步版本）
     */
    private async updateCacheMeta(cacheKey: string, info: any): Promise<void> {
        try {
            const meta = this.getCacheMeta()
            meta[cacheKey] = info
            await this.saveCacheMeta(meta)
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'updateCacheMeta', '更新缓存元数据失败', error)
        }
    }
    
    /**
     * 保存缓存元数据（异步版本）
     */
    private async saveCacheMeta(meta: Record<string, any>): Promise<void> {
        try {
            const content = JSON.stringify(meta, null, 2)
            await fs.promises.writeFile(this.cacheMetaFile, content, 'utf-8')
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'saveCacheMeta', '异步保存缓存元数据失败', error)
            
            // 尝试同步保存作为备用方案
            try {
                fs.writeFileSync(this.cacheMetaFile, JSON.stringify(meta, null, 2), 'utf-8')
                AppUtil.info('LoginCacheMgr', 'saveCacheMeta', '使用同步方式保存成功')
            } catch (syncError) {
                AppUtil.error('LoginCacheMgr', 'saveCacheMeta', '同步保存也失败', syncError)
                throw syncError
            }
        }
    }
    
    /**
     * 移除缓存项
     */
    private async removeCacheItem(cacheKey: string): Promise<void> {
        try {
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.html`)
            
            if (fs.existsSync(cacheFile)) {
                fs.unlinkSync(cacheFile)
            }
            
            const meta = this.getCacheMeta()
            delete meta[cacheKey]
            this.saveCacheMeta(meta)
            
            AppUtil.info('LoginCacheMgr', 'removeCacheItem', `移除缓存项: ${cacheKey}`)
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'removeCacheItem', '移除缓存项失败', error)
        }
    }
    
    /**
     * 清理过期缓存
     */
    async cleanExpiredCache(): Promise<void> {
        try {
            const meta = this.getCacheMeta()
            const now = Date.now()
            const expiredKeys: string[] = []
            
            for (const [key, info] of Object.entries(meta)) {
                if ((info as any).expiresAt < now) {
                    expiredKeys.push(key)
                }
            }
            
            for (const key of expiredKeys) {
                await this.removeCacheItem(key)
            }
            
            AppUtil.info('LoginCacheMgr', 'cleanExpiredCache', `清理了 ${expiredKeys.length} 个过期缓存项`)
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'cleanExpiredCache', '清理过期缓存失败', error)
        }
    }
    
    /**
     * 设置缓存过期时间
     */
    setCacheExpiry(expiry: number): void {
        CacheConfig.setLoginCacheExpiry(expiry)
        AppUtil.info('LoginCacheMgr', 'setCacheExpiry', `设置缓存过期时间: ${expiry}ms`)
    }
    
    /**
     * 获取缓存统计信息
     */
    getCacheStats(): { totalItems: number; totalSize: number; oldestCache: number } {
        try {
            const meta = this.getCacheMeta()
            const items = Object.values(meta) as any[]
            
            const totalItems = items.length
            const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0)
            const oldestCache = items.length > 0 ? Math.min(...items.map(item => item.cachedAt)) : 0
            
            return { totalItems, totalSize, oldestCache }
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'getCacheStats', '获取缓存统计失败', error)
            return { totalItems: 0, totalSize: 0, oldestCache: 0 }
        }
    }
    
    /**
     * 强制刷新缓存
     */
    async refreshCache(): Promise<void> {
        try {
            AppUtil.info('LoginCacheMgr', 'refreshCache', '开始强制刷新缓存')
            
            // 清理所有缓存
            await this.clearAllCache()
            
            // 重新预缓存
            await this.precacheLoginPage()
            
            AppUtil.info('LoginCacheMgr', 'refreshCache', '缓存刷新完成')
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'refreshCache', '刷新缓存失败', error)
        }
    }
    
    /**
     * 清理所有缓存
     */
    async clearAllCache(): Promise<void> {
        try {
            if (fs.existsSync(this.cacheDir)) {
                const files = fs.readdirSync(this.cacheDir)
                for (const file of files) {
                    const filePath = path.join(this.cacheDir, file)
                    try {
                        fs.unlinkSync(filePath)
                    } catch (fileError) {
                        AppUtil.warn('LoginCacheMgr', 'clearAllCache', `删除文件失败: ${filePath}`, fileError)
                    }
                }
            }
            
            // 同时清理 Electron 的内置缓存
            try {
                await session.defaultSession.clearCache()
                AppUtil.info('LoginCacheMgr', 'clearAllCache', '清理 Electron 内置缓存完成')
            } catch (sessionError) {
                AppUtil.warn('LoginCacheMgr', 'clearAllCache', '清理 Electron 缓存失败', sessionError)
            }
            
            AppUtil.info('LoginCacheMgr', 'clearAllCache', '清理所有缓存完成')
        } catch (error) {
            AppUtil.error('LoginCacheMgr', 'clearAllCache', '清理缓存失败', error)
        }
    }
}