import { app, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { AppUtil } from '../utils/AppUtil'
import { AppConfig } from '../config/AppConfig'
import { EMessage } from '../enum/EMessage'
import AppContainer from '../base/AppContainer'

/**
 * 登录状态信息接口
 */
export interface LoginStateInfo {
    isLoggedIn: boolean
    userId?: string
    username?: string
    email?: string
    token?: string
    refreshToken?: string
    loginMethod?: 'password' | 'google' | 'apple' | 'wechat'
    loginTime?: number
    expiresAt?: number
    userInfo?: any
}

/**
 * 登录状态变化事件
 */
export interface LoginStateChangeEvent {
    type: 'login' | 'logout' | 'refresh' | 'expire'
    oldState: LoginStateInfo
    newState: LoginStateInfo
    timestamp: number
}

/**
 * 登录状态管理器
 * 负责管理用户登录状态，包括状态持久化、自动刷新、过期检测等
 */
export class LoginStateMgr {
    private static instance: LoginStateMgr
    private stateFile: string
    private currentState: LoginStateInfo
    private stateChangeListeners: Array<(event: LoginStateChangeEvent) => void> = []
    private tokenRefreshTimer: NodeJS.Timeout | null = null
    private stateCheckTimer: NodeJS.Timeout | null = null
    
    // 添加锁机制防止竞态条件
    private isCheckingState: boolean = false
    private isSavingState: boolean = false
    private isRefreshingToken: boolean = false
    
    constructor() {
        this.stateFile = path.join(app.getPath('userData'), 'login-state.json')
        this.currentState = this.getDefaultState()
        this.loadState()
        this.startStateMonitoring()
    }
    
    static getInstance(): LoginStateMgr {
        if (!LoginStateMgr.instance) {
            LoginStateMgr.instance = new LoginStateMgr()
        }
        return LoginStateMgr.instance
    }
    
    /**
     * 获取默认登录状态
     */
    private getDefaultState(): LoginStateInfo {
        return {
            isLoggedIn: false,
            loginTime: 0,
            expiresAt: 0
        }
    }
    
    /**
     * 加载持久化的登录状态
     */
    private loadState(): void {
        try {
            if (fs.existsSync(this.stateFile)) {
                const content = fs.readFileSync(this.stateFile, 'utf-8')
                
                // 安全的JSON解析
                let savedState: LoginStateInfo
                try {
                    savedState = JSON.parse(content) as LoginStateInfo
                } catch (parseError) {
                    AppUtil.error('LoginStateMgr', 'loadState', 'JSON解析失败，使用默认状态', parseError)
                    this.currentState = this.getDefaultState()
                    this.saveState() // 重新保存正确的格式
                    return
                }
                
                // 验证状态数据完整性
                if (!this.validateStateData(savedState)) {
                    AppUtil.warn('LoginStateMgr', 'loadState', '状态数据不完整，使用默认状态')
                    this.currentState = this.getDefaultState()
                    this.saveState()
                    return
                }
                
                // 检查状态是否过期
                if (savedState.expiresAt && Date.now() > savedState.expiresAt) {
                    AppUtil.info('LoginStateMgr', 'loadState', '登录状态已过期，重置为默认状态')
                    this.currentState = this.getDefaultState()
                    this.saveState()
                } else {
                    this.currentState = savedState
                    AppUtil.info('LoginStateMgr', 'loadState', '加载登录状态成功', {
                        isLoggedIn: this.currentState.isLoggedIn,
                        username: this.currentState.username,
                        loginMethod: this.currentState.loginMethod
                    })
                }
            }
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'loadState', '加载登录状态失败', error)
            this.currentState = this.getDefaultState()
        }
    }
    
    /**
     * 验证状态数据完整性
     */
    private validateStateData(state: any): boolean {
        return state && 
               typeof state.isLoggedIn === 'boolean' &&
               (state.loginTime === undefined || typeof state.loginTime === 'number') &&
               (state.expiresAt === undefined || typeof state.expiresAt === 'number')
    }
    
    /**
     * 保存登录状态到文件（异步版本，防止阻塞）
     */
    private async saveState(): Promise<void> {
        if (this.isSavingState) {
            return // 防止重复保存
        }
        
        this.isSavingState = true
        try {
            // 创建一个副本，移除敏感信息用于日志
            const stateForLog = { ...this.currentState }
            delete stateForLog.token
            delete stateForLog.refreshToken
            
            const content = JSON.stringify(this.currentState, null, 2)
            
            // 使用异步写入防止阻塞主线程
            await fs.promises.writeFile(this.stateFile, content, 'utf-8')
            AppUtil.info('LoginStateMgr', 'saveState', '保存登录状态成功', stateForLog)
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'saveState', '保存登录状态失败', error)
            
            // 尝试同步保存作为备用方案
            try {
                fs.writeFileSync(this.stateFile, JSON.stringify(this.currentState, null, 2), 'utf-8')
                AppUtil.info('LoginStateMgr', 'saveState', '使用同步方式保存成功')
            } catch (syncError) {
                AppUtil.error('LoginStateMgr', 'saveState', '同步保存也失败', syncError)
            }
        } finally {
            this.isSavingState = false
        }
    }
    
    /**
     * 开始状态监控
     */
    private startStateMonitoring(): void {
        // 优化：根据token剩余时间动态调整检查频率
        const checkInterval = this.getOptimalCheckInterval()
        this.stateCheckTimer = setInterval(() => {
            this.checkLoginState()
        }, checkInterval)
        
        AppUtil.info('LoginStateMgr', 'startStateMonitoring', `开始登录状态监控，检查间隔: ${checkInterval}ms`)
    }
    
    /**
     * 获取最优检查间隔
     */
    private getOptimalCheckInterval(): number {
        if (!this.currentState.isLoggedIn || !this.currentState.expiresAt) {
            return 5 * 60 * 1000 // 未登录时5分钟检查一次
        }
        
        const timeUntilExpiry = this.currentState.expiresAt - Date.now()
        
        if (timeUntilExpiry > 2 * 60 * 60 * 1000) {
            // 超过2小时，每30分钟检查一次
            return 30 * 60 * 1000
        } else if (timeUntilExpiry > 30 * 60 * 1000) {
            // 30分钟到2小时，每10分钟检查一次
            return 10 * 60 * 1000
        } else if (timeUntilExpiry > 5 * 60 * 1000) {
            // 5-30分钟，每2分钟检查一次
            return 2 * 60 * 1000
        } else {
            // 少于5分钟，每分钟检查一次
            return 60 * 1000
        }
    }
    
    /**
     * 停止状态监控
     */
    private stopStateMonitoring(): void {
        if (this.stateCheckTimer) {
            clearInterval(this.stateCheckTimer)
            this.stateCheckTimer = null
        }
        
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer)
            this.tokenRefreshTimer = null
        }
        
        AppUtil.info('LoginStateMgr', 'stopStateMonitoring', '停止登录状态监控')
    }
    
    /**
     * 检查登录状态（添加锁机制防止竞态条件）
     */
    private async checkLoginState(): Promise<void> {
        if (this.isCheckingState) {
            return // 防止重复执行
        }
        
        this.isCheckingState = true
        try {
            if (!this.currentState.isLoggedIn) {
                return
            }
            
            // 检查token是否即将过期
            if (this.currentState.expiresAt) {
                const now = Date.now()
                const timeUntilExpiry = this.currentState.expiresAt - now
                
                // 如果还有30分钟过期，尝试刷新token
                if (timeUntilExpiry > 0 && timeUntilExpiry < 30 * 60 * 1000) {
                    AppUtil.info('LoginStateMgr', 'checkLoginState', 'Token即将过期，尝试刷新')
                    await this.refreshToken()
                } else if (timeUntilExpiry <= 0) {
                    // 已过期，退出登录
                    AppUtil.warn('LoginStateMgr', 'checkLoginState', 'Token已过期，自动退出登录')
                    await this.logout('expire')
                    return
                }
                
                // 动态调整检查间隔
                this.adjustCheckInterval()
            }
            
            // 验证当前登录状态是否有效
            await this.validateLoginState()
            
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'checkLoginState', '检查登录状态失败', error)
        } finally {
            this.isCheckingState = false
        }
    }
    
    /**
     * 动态调整检查间隔
     */
    private adjustCheckInterval(): void {
        const newInterval = this.getOptimalCheckInterval()
        
        if (this.stateCheckTimer) {
            clearInterval(this.stateCheckTimer)
            this.stateCheckTimer = setInterval(() => {
                this.checkLoginState()
            }, newInterval)
            
            AppUtil.info('LoginStateMgr', 'adjustCheckInterval', `调整检查间隔为: ${newInterval}ms`)
        }
    }
    
    /**
     * 验证登录状态是否有效
     */
    private async validateLoginState(): Promise<boolean> {
        try {
            if (!this.currentState.isLoggedIn || !this.currentState.token) {
                return false
            }
            
            // 这里可以调用后端API验证token有效性
            // 暂时通过检查session中的cookie来验证
            const cookies = await session.defaultSession.cookies.get({})
            const hasValidCookie = cookies.some(cookie => 
                cookie.name.includes('token') || 
                cookie.name.includes('session') ||
                cookie.name.includes('auth')
            )
            
            if (!hasValidCookie) {
                AppUtil.warn('LoginStateMgr', 'validateLoginState', '未找到有效的登录cookie，可能已退出登录')
                await this.logout('expire')
                return false
            }
            
            return true
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'validateLoginState', '验证登录状态失败', error)
            return false
        }
    }
    
    /**
     * 刷新token（添加锁机制防止重复刷新）
     */
    private async refreshToken(): Promise<boolean> {
        if (this.isRefreshingToken) {
            return false // 防止重复刷新
        }
        
        this.isRefreshingToken = true
        try {
            if (!this.currentState.refreshToken) {
                AppUtil.warn('LoginStateMgr', 'refreshToken', '没有refresh token，无法刷新')
                return false
            }
            
            // 这里应该调用后端API刷新token
            // 暂时模拟刷新逻辑
            AppUtil.info('LoginStateMgr', 'refreshToken', '开始刷新token')
            
            // 模拟API调用
            // const newTokenInfo = await this.callRefreshTokenAPI(this.currentState.refreshToken)
            
            // 暂时延长过期时间
            const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000 // 延长24小时
            
            const oldState = { ...this.currentState }
            this.currentState.expiresAt = newExpiresAt
            
            await this.saveState()
            this.notifyStateChange('refresh', oldState, this.currentState)
            
            AppUtil.info('LoginStateMgr', 'refreshToken', 'Token刷新成功')
            return true
            
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'refreshToken', 'Token刷新失败', error)
            return false
        } finally {
            this.isRefreshingToken = false
        }
    }
    
    /**
     * 设置登录状态
     */
    async setLoginState(loginInfo: Partial<LoginStateInfo>): Promise<void> {
        try {
            const oldState = { ...this.currentState }
            
            // 更新登录状态
            this.currentState = {
                ...this.currentState,
                ...loginInfo,
                isLoggedIn: true,
                loginTime: Date.now(),
                expiresAt: loginInfo.expiresAt || (Date.now() + 24 * 60 * 60 * 1000) // 默认24小时过期
            }
            
            this.saveState()
            this.notifyStateChange('login', oldState, this.currentState)
            
            // 设置token刷新定时器
            this.scheduleTokenRefresh()
            
            AppUtil.info('LoginStateMgr', 'setLoginState', '设置登录状态成功', {
                username: this.currentState.username,
                loginMethod: this.currentState.loginMethod
            })
            
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'setLoginState', '设置登录状态失败', error)
        }
    }
    
    /**
     * 退出登录
     */
    async logout(reason: 'manual' | 'expire' | 'error' = 'manual'): Promise<void> {
        try {
            const oldState = { ...this.currentState }
            
            // 清理登录状态
            this.currentState = this.getDefaultState()
            
            // 清理session和cookies
            await this.clearSessionData()
            
            this.saveState()
            this.notifyStateChange('logout', oldState, this.currentState)
            
            // 停止token刷新定时器
            if (this.tokenRefreshTimer) {
                clearTimeout(this.tokenRefreshTimer)
                this.tokenRefreshTimer = null
            }
            
            AppUtil.info('LoginStateMgr', 'logout', `退出登录成功，原因: ${reason}`)
            
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'logout', '退出登录失败', error)
        }
    }
    
    /**
     * 清理session数据
     */
    private async clearSessionData(): Promise<void> {
        try {
            // 清理cookies
            const cookies = await session.defaultSession.cookies.get({})
            for (const cookie of cookies) {
                await session.defaultSession.cookies.remove(
                    `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`,
                    cookie.name
                )
            }
            
            // 清理缓存
            await session.defaultSession.clearCache()
            
            // 清理存储数据
            await session.defaultSession.clearStorageData()
            
            AppUtil.info('LoginStateMgr', 'clearSessionData', '清理session数据完成')
            
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'clearSessionData', '清理session数据失败', error)
        }
    }
    
    /**
     * 安排token刷新
     */
    private scheduleTokenRefresh(): void {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer)
        }
        
        if (this.currentState.expiresAt) {
            const now = Date.now()
            const timeUntilRefresh = this.currentState.expiresAt - now - (30 * 60 * 1000) // 提前30分钟刷新
            
            if (timeUntilRefresh > 0) {
                this.tokenRefreshTimer = setTimeout(() => {
                    this.refreshToken()
                }, timeUntilRefresh)
                
                AppUtil.info('LoginStateMgr', 'scheduleTokenRefresh', `安排token刷新，${Math.round(timeUntilRefresh / 60000)}分钟后执行`)
            }
        }
    }
    
    /**
     * 通知状态变化（增强错误处理和安全检查）
     */
    private notifyStateChange(type: LoginStateChangeEvent['type'], oldState: LoginStateInfo, newState: LoginStateInfo): void {
        const event: LoginStateChangeEvent = {
            type,
            oldState,
            newState,
            timestamp: Date.now()
        }
        
        // 通知所有监听器，移除出错的监听器
        const failedListeners: Array<(event: LoginStateChangeEvent) => void> = []
        this.stateChangeListeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                AppUtil.error('LoginStateMgr', 'notifyStateChange', '状态变化监听器执行失败', error)
                failedListeners.push(listener)
            }
        })
        
        // 移除出错的监听器防止内存泄漏
        failedListeners.forEach(listener => {
            this.removeStateChangeListener(listener)
        })
        
        // 发送IPC消息通知渲染进程（增强安全检查）
        try {
            const wndMgr = AppContainer.getApp()?.getWndMgr()
            if (wndMgr) {
                wndMgr.getAllWnd().forEach(wnd => {
                    try {
                        const browserWindow = wnd?.getBrowserWindow()
                        if (browserWindow && !browserWindow.isDestroyed() && browserWindow.webContents && !browserWindow.webContents.isDestroyed()) {
                            browserWindow.webContents.send(EMessage.EMainFromMainMessage, {
                                type: 'loginStateChange',
                                data: event
                            })
                        }
                    } catch (error) {
                        AppUtil.error('LoginStateMgr', 'notifyStateChange', '发送IPC消息失败', error)
                    }
                })
            }
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'notifyStateChange', '获取窗口管理器失败', error)
        }
    }
    
    /**
     * 添加状态变化监听器
     */
    addStateChangeListener(listener: (event: LoginStateChangeEvent) => void): void {
        this.stateChangeListeners.push(listener)
    }
    
    /**
     * 移除状态变化监听器
     */
    removeStateChangeListener(listener: (event: LoginStateChangeEvent) => void): void {
        const index = this.stateChangeListeners.indexOf(listener)
        if (index > -1) {
            this.stateChangeListeners.splice(index, 1)
        }
    }
    
    /**
     * 获取当前登录状态
     */
    getCurrentState(): LoginStateInfo {
        return { ...this.currentState }
    }
    
    /**
     * 检查是否已登录
     */
    isLoggedIn(): boolean {
        return this.currentState.isLoggedIn && 
               (!this.currentState.expiresAt || Date.now() < this.currentState.expiresAt)
    }
    
    /**
     * 获取用户信息
     */
    getUserInfo(): Partial<LoginStateInfo> | null {
        if (!this.isLoggedIn()) {
            return null
        }
        
        return {
            userId: this.currentState.userId,
            username: this.currentState.username,
            email: this.currentState.email,
            loginMethod: this.currentState.loginMethod,
            loginTime: this.currentState.loginTime,
            userInfo: this.currentState.userInfo
        }
    }
    
    /**
     * 获取token
     */
    getToken(): string | null {
        if (!this.isLoggedIn()) {
            return null
        }
        return this.currentState.token || null
    }
    
    /**
     * 更新用户信息
     */
    async updateUserInfo(userInfo: any): Promise<void> {
        try {
            const oldState = { ...this.currentState }
            this.currentState.userInfo = { ...this.currentState.userInfo, ...userInfo }
            
            this.saveState()
            this.notifyStateChange('refresh', oldState, this.currentState)
            
            AppUtil.info('LoginStateMgr', 'updateUserInfo', '更新用户信息成功')
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'updateUserInfo', '更新用户信息失败', error)
        }
    }
    
    /**
     * 获取登录状态统计
     */
    getLoginStats(): any {
        return {
            isLoggedIn: this.currentState.isLoggedIn,
            loginMethod: this.currentState.loginMethod,
            loginTime: this.currentState.loginTime,
            expiresAt: this.currentState.expiresAt,
            timeUntilExpiry: this.currentState.expiresAt ? this.currentState.expiresAt - Date.now() : 0,
            hasToken: !!this.currentState.token,
            hasRefreshToken: !!this.currentState.refreshToken
        }
    }
    
    /**
     * 销毁管理器（增强资源清理）
     */
    destroy(): void {
        try {
            // 停止所有定时器
            this.stopStateMonitoring()
            
            // 清理所有监听器
            this.stateChangeListeners.length = 0
            
            // 重置状态标志
            this.isCheckingState = false
            this.isSavingState = false
            this.isRefreshingToken = false
            
            // 清理单例引用
            LoginStateMgr.instance = null
            
            AppUtil.info('LoginStateMgr', 'destroy', '登录状态管理器已销毁')
        } catch (error) {
            AppUtil.error('LoginStateMgr', 'destroy', '销毁登录状态管理器失败', error)
        }
    }
}