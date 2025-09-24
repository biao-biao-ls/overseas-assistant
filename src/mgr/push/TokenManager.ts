/**
 * WebSocket 推送功能 Token 管理器
 * 负责获取、缓存、刷新和管理 WebSocket 连接所需的认证 token
 */

import { TokenInfo, PushErrorType } from '../../types/push'
import { PushError } from '../../utils/PushError'
import { TOKEN_CONSTANTS, API_CONSTANTS } from '../../config/pushConstants'
import { PushLogger } from './PushLogger'
import { PushEventEmitter } from '../../utils/PushEventEmitter'
import { PushUtils } from '../../utils/pushUtils'
import { AppConfig } from '../../config/AppConfig'
import { AppUtil } from '../../utils/AppUtil'
import { LoginStateMgr } from '../LoginStateMgr'
import * as https from 'https'
import * as http from 'http'

/**
 * Token 管理器类
 * 提供 WebSocket 推送功能所需的 token 获取和管理功能
 */
export class TokenManager {
    private logger: PushLogger
    private eventEmitter: PushEventEmitter
    private currentToken: TokenInfo | null = null
    private refreshTimer: NodeJS.Timeout | null = null
    private isRefreshing: boolean = false
    private refreshPromise: Promise<string> | null = null
    private loginStateMgr: LoginStateMgr

    constructor(logger: PushLogger, eventEmitter: PushEventEmitter) {
        this.logger = logger
        this.eventEmitter = eventEmitter
        this.loginStateMgr = LoginStateMgr.getInstance()
        this.initializeTokenManager()
    }

    /**
     * 初始化 Token 管理器
     */
    private initializeTokenManager(): void {
        try {
            this.logger.logTokenEvent('initializeTokenManager', 'Token 管理器初始化开始')

            // 尝试从缓存加载 token
            this.loadTokenFromCache()

            this.logger.logTokenEvent('initializeTokenManager', 'Token 管理器初始化完成')
        } catch (error) {
            this.logger.error('TokenManager', 'initializeTokenManager', 'Token 管理器初始化失败', error)
            throw PushError.tokenError('Token 管理器初始化失败', 'INIT_FAILED', error)
        }
    }

    /**
     * 获取有效的 token
     * 如果当前 token 无效或即将过期，会自动刷新
     */
    async getToken(): Promise<string> {
        try {
            // 检查当前 token 是否有效
            if (this.isTokenValid()) {
                this.logger.logTokenEvent('getToken', '使用缓存的有效 token')
                return this.currentToken!.token
            }

            // 如果正在刷新，等待刷新完成
            if (this.isRefreshing && this.refreshPromise) {
                this.logger.logTokenEvent('getToken', '等待正在进行的 token 刷新')
                return await this.refreshPromise
            }

            // 刷新 token
            return await this.refreshToken()
        } catch (error) {
            this.logger.logPushError('TokenManager', 'getToken', error as PushError)
            throw error
        }
    }

    /**
     * 刷新 token
     */
    async refreshToken(): Promise<string> {
        // 防止重复刷新
        if (this.isRefreshing && this.refreshPromise) {
            return await this.refreshPromise
        }

        this.isRefreshing = true
        this.refreshPromise = this.performTokenRefresh()

        try {
            const token = await this.refreshPromise
            return token
        } finally {
            this.isRefreshing = false
            this.refreshPromise = null
        }
    }

    /**
     * 执行实际的 token 刷新操作
     */
    private async performTokenRefresh(): Promise<string> {
        try {
            this.logger.logTokenEvent('performTokenRefresh', '开始刷新 token')

            // 获取新的 token
            const tokenInfo = await this.fetchTokenFromAPI()

            // 更新当前 token
            this.currentToken = tokenInfo

            // 保存到缓存
            this.saveTokenToCache()

            // 安排下次刷新
            this.scheduleTokenRefresh()

            // 发射 token 刷新事件
            this.eventEmitter.emitTokenRefreshed({
                token: tokenInfo.token,
                expireTime: tokenInfo.expireTime,
                refreshTime: tokenInfo.refreshTime,
            })

            this.logger.logTokenEvent('performTokenRefresh', 'Token 刷新成功', {
                expireTime: new Date(tokenInfo.expireTime).toISOString(),
                refreshTime: new Date(tokenInfo.refreshTime).toISOString(),
            })

            return tokenInfo.token
        } catch (error) {
            this.logger.error('TokenManager', 'performTokenRefresh', 'Token 刷新失败', error)
            throw PushError.tokenError('Token 刷新失败', 'REFRESH_FAILED', error)
        }
    }

    /**
     * 从 API 获取新的 token
     */
    private async fetchTokenFromAPI(): Promise<TokenInfo> {
        const envConfig = AppConfig.getEnvConfig()
        const apiUrl = `${envConfig.IM_URL}${API_CONSTANTS.TOKEN_ENDPOINT}`

        try {
            this.logger.logTokenEvent('fetchTokenFromAPI', `从 API 获取 token: ${apiUrl}`)

            // 获取 customerCode，支持多种来源
            let customerCode = this.getCustomerCode()
            
            if (!customerCode) {
                // 尝试重新获取登录状态
                this.logger.logTokenEvent('fetchTokenFromAPI', '首次获取 customerCode 失败，尝试重新获取登录状态')
                await this.refreshLoginState()
                customerCode = this.getCustomerCode()
                
                if (!customerCode) {
                    const error = new Error('无法获取用户的 customerCode，请重新登录')
                    this.logger.error('TokenManager', 'fetchTokenFromAPI', '获取 customerCode 失败', {
                        loginState: this.loginStateMgr.getCurrentState(),
                        userConfig: {
                            customerCode: AppConfig.getUserConfig('customerCode'),
                            hasDefaultConfig: !!AppConfig.config?.customerCode
                        }
                    })
                    
                    // 通知需要重新登录
                    this.handleLoginRequired()
                    throw error
                }
            }

            this.logger.logTokenEvent('fetchTokenFromAPI', `使用 customerCode 获取 token`, {
                customerCode: customerCode,
                source: this.getCustomerCodeSource(),
            })

            // 构建请求参数，将 customerCode 作为 userId 传递
            const requestUrl = `${apiUrl}?userId=${encodeURIComponent(customerCode)}`

            // 打印请求URL用于调试
            this.logger.logTokenEvent('fetchTokenFromAPI', `请求URL: ${requestUrl}`, {
                requestUrl: requestUrl,
                customerCode: customerCode,
            })

            const response = await this.makeHttpRequest(requestUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: API_CONSTANTS.REQUEST_TIMEOUT,
            })

            this.logger.logTokenEvent('fetchTokenFromAPI', 'API 响应接收完成', {
                success: response.success,
                statusCode: response.statusCode,
            })

            if (!response.success) {
                throw new Error(`API 请求失败: ${response.statusCode} ${response.statusMessage}`)
            }

            const json = response.data
            const res = JSON.parse(json)

            this.logger.logTokenEvent('fetchTokenFromAPI', 'API 响应解析完成', {
                hasData: !!res.data,
                hasToken: !!(res.data && res.data.token),
            })

            if (!res.data || !res.data.token) {
                throw new Error('API 响应中缺少 token 字段')
            }

            // 处理过期时间
            res.data.expireTime = new Date(res.data.expiresAt).getTime()

            // 计算过期时间和刷新时间
            const now = Date.now()
            const expireTime = res.data.expireTime || now + 24 * 60 * 60 * 1000 // 默认24小时
            const refreshTime = expireTime - TOKEN_CONSTANTS.REFRESH_RETRY_DELAY

            this.logger.logTokenEvent('fetchTokenFromAPI', 'Token 信息处理完成', {
                expireTime: new Date(expireTime).toISOString(),
                refreshTime: new Date(refreshTime).toISOString(),
            })

            // 打印 token 用于调试
            console.log('获取到的 token:', res.data.token)

            return {
                token: res.data.token,
                expireTime,
                refreshTime,
            }
        } catch (error) {
            this.logger.error('TokenManager', 'fetchTokenFromAPI', 'API 请求失败', error)
            throw PushError.tokenError('从 API 获取 token 失败', 'API_REQUEST_FAILED', error)
        }
    }

    /**
     * 发起 HTTP 请求
     */
    private makeHttpRequest(url: string, options: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url)
            const isHttps = urlObj.protocol === 'https:'
            const httpModule = isHttps ? https : http

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: options.timeout || API_CONSTANTS.REQUEST_TIMEOUT,
            }

            const req = httpModule.request(requestOptions, res => {
                let data = ''

                res.on('data', chunk => {
                    data += chunk
                })

                res.on('end', () => {
                    resolve({
                        success: res.statusCode! >= 200 && res.statusCode! < 300,
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        data: data,
                        headers: res.headers,
                    })
                })
            })

            req.on('error', error => {
                reject(error)
            })

            req.on('timeout', () => {
                req.destroy()
                reject(new Error('请求超时'))
            })

            if (options.data) {
                req.write(options.data)
            }

            req.end()
        })
    }

    /**
     * 检查当前 token 是否有效
     */
    isTokenValid(): boolean {
        if (!this.currentToken) {
            return false
        }

        const now = Date.now()

        // 检查是否过期
        if (now >= this.currentToken.expireTime) {
            this.logger.logTokenEvent('isTokenValid', 'Token 已过期')
            return false
        }

        // 检查最小有效期
        if (this.currentToken.expireTime - now < TOKEN_CONSTANTS.MIN_VALID_DURATION) {
            this.logger.logTokenEvent('isTokenValid', 'Token 剩余有效期不足')
            return false
        }

        return true
    }

    /**
     * 检查 token 是否即将过期
     */
    isTokenExpiringSoon(): boolean {
        if (!this.currentToken) {
            return true
        }

        return PushUtils.isTokenExpiringSoon(this.currentToken.expireTime, TOKEN_CONSTANTS.REFRESH_RETRY_DELAY)
    }

    /**
     * 安排 token 刷新
     */
    private scheduleTokenRefresh(): void {
        // 清除现有的定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer)
            this.refreshTimer = null
        }

        if (!this.currentToken) {
            return
        }

        const now = Date.now()
        const refreshTime = this.currentToken.refreshTime
        const delay = Math.max(refreshTime - now, 1000) // 至少延迟1秒

        this.refreshTimer = setTimeout(async () => {
            try {
                await this.refreshToken()
            } catch (error) {
                this.logger.error('TokenManager', 'scheduleTokenRefresh', '定时刷新 token 失败', error)

                // 重试机制
                setTimeout(() => {
                    this.scheduleTokenRefresh()
                }, TOKEN_CONSTANTS.REFRESH_RETRY_DELAY)
            }
        }, delay)

        this.logger.logTokenEvent('scheduleTokenRefresh', `已安排 token 刷新`, {
            refreshTime: new Date(refreshTime).toISOString(),
            delay: delay,
        })
    }

    /**
     * 从缓存加载 token
     */
    private loadTokenFromCache(): void {
        try {
            // 这里可以从 electron-store 或其他持久化存储加载
            // 暂时不实现持久化，每次启动都重新获取
            this.logger.logTokenEvent('loadTokenFromCache', '暂不支持 token 缓存加载')
        } catch (error) {
            this.logger.warn('TokenManager', 'loadTokenFromCache', '从缓存加载 token 失败', error)
        }
    }

    /**
     * 保存 token 到缓存
     */
    private saveTokenToCache(): void {
        try {
            if (!this.currentToken) {
                return
            }

            // 这里可以保存到 electron-store 或其他持久化存储
            // 出于安全考虑，暂时不持久化 token
            this.logger.logTokenEvent('saveTokenToCache', '暂不支持 token 缓存保存')
        } catch (error) {
            this.logger.warn('TokenManager', 'saveTokenToCache', '保存 token 到缓存失败', error)
        }
    }

    /**
     * 清除当前 token
     */
    clearToken(): void {
        try {
            this.logger.logTokenEvent('clearToken', '清除当前 token')

            // 清除定时器
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer)
                this.refreshTimer = null
            }

            // 清除 token
            this.currentToken = null

            // 重置状态
            this.isRefreshing = false
            this.refreshPromise = null
        } catch (error) {
            this.logger.error('TokenManager', 'clearToken', '清除 token 失败', error)
        }
    }

    /**
     * 获取 token 信息
     */
    getTokenInfo(): TokenInfo | null {
        return this.currentToken ? PushUtils.deepClone(this.currentToken) : null
    }

    /**
     * 获取 token 统计信息
     */
    getTokenStatistics(): any {
        const tokenInfo = this.getTokenInfo()

        if (!tokenInfo) {
            return {
                hasToken: false,
                isValid: false,
                isExpiringSoon: false,
            }
        }

        const now = Date.now()

        return {
            hasToken: true,
            isValid: this.isTokenValid(),
            isExpiringSoon: this.isTokenExpiringSoon(),
            expireTime: tokenInfo.expireTime,
            refreshTime: tokenInfo.refreshTime,
            timeUntilExpiry: tokenInfo.expireTime - now,
            timeUntilRefresh: tokenInfo.refreshTime - now,
            formattedExpireTime: PushUtils.formatTimestamp(tokenInfo.expireTime),
            formattedRefreshTime: PushUtils.formatTimestamp(tokenInfo.refreshTime),
        }
    }

    /**
     * 强制刷新 token
     */
    async forceRefresh(): Promise<string> {
        this.logger.logTokenEvent('forceRefresh', '强制刷新 token')

        // 清除当前 token
        this.clearToken()

        // 重新获取
        return await this.getToken()
    }

    /**
     * 获取 customerCode，支持多种来源
     * 优先级：LoginStateMgr > AppConfig > 默认配置
     */
    private getCustomerCode(): string | null {
        try {
            // 1. 优先从 LoginStateMgr 获取（适用于重新登录的情况）
            const userInfo = this.loginStateMgr.getUserInfo()
            if (userInfo?.userInfo?.customerCode) {
                this.logger.logTokenEvent('getCustomerCode', '从 LoginStateMgr 获取 customerCode')
                return userInfo.userInfo.customerCode
            }

            // 2. 从 AppConfig 用户配置获取（适用于登录未过期的情况）
            const configCustomerCode = AppConfig.getUserConfig('customerCode') as string
            if (configCustomerCode) {
                this.logger.logTokenEvent('getCustomerCode', '从 AppConfig 用户配置获取 customerCode')
                return configCustomerCode
            }

            // 3. 从 AppConfig 默认配置获取
            const defaultCustomerCode = AppConfig.config?.customerCode
            if (defaultCustomerCode) {
                this.logger.logTokenEvent('getCustomerCode', '从 AppConfig 默认配置获取 customerCode')
                return defaultCustomerCode
            }

            // 4. 尝试从 LoginStateMgr 的 userId 获取（备用方案）
            if (userInfo?.userId) {
                this.logger.logTokenEvent('getCustomerCode', '使用 LoginStateMgr 的 userId 作为 customerCode')
                return userInfo.userId
            }

            this.logger.logTokenEvent('getCustomerCode', '所有来源都无法获取 customerCode')
            return null
        } catch (error) {
            this.logger.error('TokenManager', 'getCustomerCode', '获取 customerCode 失败', error)
            return null
        }
    }

    /**
     * 重新获取登录状态
     */
    private async refreshLoginState(): Promise<void> {
        try {
            this.logger.logTokenEvent('refreshLoginState', '开始重新获取登录状态')
            
            // 触发登录状态管理器重新加载状态
            const currentState = this.loginStateMgr.getCurrentState()
            this.logger.logTokenEvent('refreshLoginState', '当前登录状态', {
                isLoggedIn: currentState.isLoggedIn,
                hasUserInfo: !!currentState.userInfo,
                hasUserId: !!currentState.userId,
                expiresAt: currentState.expiresAt,
                timeUntilExpiry: currentState.expiresAt ? currentState.expiresAt - Date.now() : 0
            })
            
            // 如果状态已过期，不进行任何操作
            if (currentState.expiresAt && Date.now() > currentState.expiresAt) {
                this.logger.logTokenEvent('refreshLoginState', '登录状态已过期')
                return
            }
            
        } catch (error) {
            this.logger.error('TokenManager', 'refreshLoginState', '重新获取登录状态失败', error)
        }
    }
    
    /**
     * 处理需要重新登录的情况
     */
    private handleLoginRequired(): void {
        try {
            this.logger.logTokenEvent('handleLoginRequired', '通知应用需要重新登录')
            
            // 通过IPC通知渲染进程显示登录提示
            const AppContainer = require('../../base/AppContainer').default
            const app = AppContainer.getApp()
            
            if (app) {
                const wndMgr = app.getWndMgr()
                if (wndMgr) {
                    // 获取主窗口并发送登录过期消息
                    const mainWindows = wndMgr.getAllWnd()
                    mainWindows.forEach(wnd => {
                        try {
                            const browserWindow = wnd?.getBrowserWindow()
                            if (browserWindow && !browserWindow.isDestroyed() && browserWindow.webContents && !browserWindow.webContents.isDestroyed()) {
                                browserWindow.webContents.send('login-required', {
                                    reason: 'token_refresh_failed',
                                    message: '登录状态已过期，请重新登录'
                                })
                            }
                        } catch (error) {
                            this.logger.error('TokenManager', 'handleLoginRequired', '发送登录提示消息失败', error)
                        }
                    })
                }
            }
            
        } catch (error) {
            this.logger.error('TokenManager', 'handleLoginRequired', '处理登录要求失败', error)
        }
    }

    /**
     * 获取 customerCode 的来源信息（用于日志记录）
     */
    private getCustomerCodeSource(): string {
        try {
            const userInfo = this.loginStateMgr.getUserInfo()
            if (userInfo?.userInfo?.customerCode) {
                return 'LoginStateMgr.userInfo'
            }

            const configCustomerCode = AppConfig.getUserConfig('customerCode') as string
            if (configCustomerCode) {
                return 'AppConfig.userConfig'
            }

            const defaultCustomerCode = AppConfig.config?.customerCode
            if (defaultCustomerCode) {
                return 'AppConfig.defaultConfig'
            }

            if (userInfo?.userId) {
                return 'LoginStateMgr.userId'
            }

            return 'unknown'
        } catch (error) {
            return 'error'
        }
    }

    /**
     * 销毁 Token 管理器
     */
    destroy(): void {
        try {
            this.logger.logTokenEvent('destroy', 'Token 管理器销毁开始')

            // 清除定时器
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer)
                this.refreshTimer = null
            }

            // 清除 token
            this.currentToken = null

            // 重置状态
            this.isRefreshing = false
            this.refreshPromise = null

            this.logger.logTokenEvent('destroy', 'Token 管理器已销毁')
        } catch (error) {
            this.logger.error('TokenManager', 'destroy', 'Token 管理器销毁失败', error)
        }
    }
}
