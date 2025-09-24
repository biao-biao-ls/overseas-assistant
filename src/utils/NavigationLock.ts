/**
 * 导航锁机制
 * 防止登录窗口和主窗口之间的循环跳转
 */

import { AppUtil } from './AppUtil'

export class NavigationLock {
    private static instance: NavigationLock
    private isLocked: boolean = false
    private lockTimeout: NodeJS.Timeout | null = null
    private lastNavigation: { type: string, timestamp: number } | null = null
    
    private constructor() {}
    
    static getInstance(): NavigationLock {
        if (!NavigationLock.instance) {
            NavigationLock.instance = new NavigationLock()
        }
        return NavigationLock.instance
    }
    
    /**
     * 尝试获取导航锁
     * @param navigationType 导航类型 ('gotoLogin' | 'gotoMain')
     * @param lockDuration 锁定持续时间（毫秒）
     * @returns 是否成功获取锁
     */
    tryLock(navigationType: string, lockDuration: number = 5000): boolean {
        const now = Date.now()
        
        // 如果当前已锁定，检查是否可以解锁
        if (this.isLocked) {
            AppUtil.warn('NavigationLock', 'tryLock', `导航已锁定，拒绝 ${navigationType} 操作`)
            return false
        }
        
        // 检查是否是快速重复的相同操作
        if (this.lastNavigation && 
            this.lastNavigation.type === navigationType && 
            now - this.lastNavigation.timestamp < 2000) {
            AppUtil.warn('NavigationLock', 'tryLock', `检测到快速重复的 ${navigationType} 操作，拒绝执行`)
            return false
        }
        
        // 获取锁
        this.isLocked = true
        this.lastNavigation = { type: navigationType, timestamp: now }
        
        // 设置自动解锁
        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout)
        }
        
        this.lockTimeout = setTimeout(() => {
            this.unlock()
        }, lockDuration)
        
        AppUtil.info('NavigationLock', 'tryLock', `成功获取导航锁: ${navigationType}，锁定时间: ${lockDuration}ms`)
        return true
    }
    
    /**
     * 手动解锁
     */
    unlock(): void {
        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout)
            this.lockTimeout = null
        }
        
        this.isLocked = false
        AppUtil.info('NavigationLock', 'unlock', '导航锁已解除')
    }
    
    /**
     * 强制解锁
     */
    forceUnlock(): void {
        this.unlock()
        this.lastNavigation = null
        AppUtil.info('NavigationLock', 'forceUnlock', '导航锁已强制解除')
    }
    
    /**
     * 检查是否已锁定
     */
    isNavigationLocked(): boolean {
        return this.isLocked
    }
    
    /**
     * 获取锁状态信息
     */
    getLockStatus(): any {
        return {
            isLocked: this.isLocked,
            lastNavigation: this.lastNavigation,
            hasTimeout: this.lockTimeout !== null
        }
    }
}