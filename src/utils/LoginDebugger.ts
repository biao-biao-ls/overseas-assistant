/**
 * 登录调试工具
 * 用于监控和调试登录窗口循环跳转问题
 */

import { AppUtil } from './AppUtil'

export interface JumpRecord {
    timestamp: number
    type: 'gotoMain' | 'gotoLogin'
    source: string
    params?: any
}

export class LoginDebugger {
    private static instance: LoginDebugger
    private jumpHistory: JumpRecord[] = []
    private isEnabled: boolean = true
    
    private constructor() {
        // 私有构造函数，确保单例
    }
    
    static getInstance(): LoginDebugger {
        if (!LoginDebugger.instance) {
            LoginDebugger.instance = new LoginDebugger()
        }
        return LoginDebugger.instance
    }
    
    /**
     * 启用或禁用调试器
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled
        AppUtil.info('LoginDebugger', 'setEnabled', `调试器${enabled ? '已启用' : '已禁用'}`)
    }
    
    /**
     * 记录跳转事件
     */
    recordJump(type: 'gotoMain' | 'gotoLogin', source: string, params?: any): void {
        if (!this.isEnabled) return
        
        const record: JumpRecord = {
            timestamp: Date.now(),
            type,
            source,
            params: params ? this.sanitizeParams(params) : undefined
        }
        
        this.jumpHistory.push(record)
        
        // 只保留最近50条记录
        if (this.jumpHistory.length > 50) {
            this.jumpHistory = this.jumpHistory.slice(-50)
        }
        
        // 检查是否存在异常模式
        this.analyzeJumpPattern()
        
        AppUtil.info('LoginDebugger', 'recordJump', `记录跳转: ${type}`, {
            source,
            totalJumps: this.jumpHistory.length
        })
    }
    
    /**
     * 清理敏感参数信息
     */
    private sanitizeParams(params: any): any {
        if (!params || typeof params !== 'object') {
            return params
        }
        
        const sanitized = { ...params }
        
        // 移除敏感信息
        const sensitiveKeys = ['token', 'password', 'refreshToken', 'accessToken']
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]'
            }
        })
        
        return sanitized
    }
    
    /**
     * 分析跳转模式，检测异常
     */
    private analyzeJumpPattern(): void {
        if (this.jumpHistory.length < 4) return
        
        const recentJumps = this.jumpHistory.slice(-4)
        const now = Date.now()
        
        // 检查是否在短时间内有多次跳转
        const rapidJumps = recentJumps.filter(jump => now - jump.timestamp < 10000) // 10秒内
        
        if (rapidJumps.length >= 4) {
            // 检查是否存在循环模式
            const hasLoop = this.detectLoopPattern(rapidJumps)
            
            if (hasLoop) {
                AppUtil.warn('LoginDebugger', 'analyzeJumpPattern', '检测到循环跳转模式', {
                    recentJumps: rapidJumps.map(jump => ({
                        type: jump.type,
                        source: jump.source,
                        timestamp: new Date(jump.timestamp).toISOString()
                    }))
                })
                
                // 生成详细报告
                this.generateLoopReport(rapidJumps)
            }
        }
    }
    
    /**
     * 检测循环模式
     */
    private detectLoopPattern(jumps: JumpRecord[]): boolean {
        for (let i = 0; i < jumps.length - 1; i++) {
            const current = jumps[i]
            const next = jumps[i + 1]
            
            // 检查是否存在 A->B->A 的模式
            if (current.type !== next.type) {
                for (let j = i + 2; j < jumps.length; j++) {
                    if (jumps[j].type === current.type) {
                        return true
                    }
                }
            }
        }
        
        return false
    }
    
    /**
     * 生成循环报告
     */
    private generateLoopReport(loopJumps: JumpRecord[]): void {
        const report = {
            detectedAt: new Date().toISOString(),
            jumpCount: loopJumps.length,
            timeSpan: loopJumps[loopJumps.length - 1].timestamp - loopJumps[0].timestamp,
            jumps: loopJumps.map(jump => ({
                type: jump.type,
                source: jump.source,
                timestamp: new Date(jump.timestamp).toISOString(),
                params: jump.params
            })),
            analysis: this.analyzeLoopCause(loopJumps)
        }
        
        AppUtil.error('LoginDebugger', 'generateLoopReport', '循环跳转详细报告', report)
        
        // 可选：将报告保存到文件
        this.saveReportToFile(report)
    }
    
    /**
     * 分析循环原因
     */
    private analyzeLoopCause(jumps: JumpRecord[]): string[] {
        const causes: string[] = []
        
        // 检查跳转频率
        const avgInterval = this.calculateAverageInterval(jumps)
        if (avgInterval < 1000) {
            causes.push('跳转间隔过短，可能存在状态检查逻辑问题')
        }
        
        // 检查跳转来源
        const sources = [...new Set(jumps.map(jump => jump.source))]
        if (sources.length === 1) {
            causes.push(`所有跳转都来自同一来源: ${sources[0]}`)
        }
        
        // 检查参数变化
        const hasParamChanges = jumps.some(jump => jump.params)
        if (!hasParamChanges) {
            causes.push('跳转参数未发生变化，可能是状态同步问题')
        }
        
        return causes
    }
    
    /**
     * 计算平均跳转间隔
     */
    private calculateAverageInterval(jumps: JumpRecord[]): number {
        if (jumps.length < 2) return 0
        
        let totalInterval = 0
        for (let i = 1; i < jumps.length; i++) {
            totalInterval += jumps[i].timestamp - jumps[i - 1].timestamp
        }
        
        return totalInterval / (jumps.length - 1)
    }
    
    /**
     * 保存报告到文件
     */
    private saveReportToFile(report: any): void {
        try {
            const fs = require('fs')
            const path = require('path')
            const { app } = require('electron')
            
            const reportsDir = path.join(app.getPath('userData'), 'debug-reports')
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true })
            }
            
            const filename = `loop-report-${Date.now()}.json`
            const filepath = path.join(reportsDir, filename)
            
            fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8')
            
            AppUtil.info('LoginDebugger', 'saveReportToFile', `报告已保存: ${filepath}`)
        } catch (error) {
            AppUtil.error('LoginDebugger', 'saveReportToFile', '保存报告失败', error)
        }
    }
    
    /**
     * 获取跳转历史
     */
    getJumpHistory(): JumpRecord[] {
        return [...this.jumpHistory]
    }
    
    /**
     * 获取统计信息
     */
    getStatistics(): any {
        const now = Date.now()
        const last24h = this.jumpHistory.filter(jump => now - jump.timestamp < 24 * 60 * 60 * 1000)
        const lastHour = this.jumpHistory.filter(jump => now - jump.timestamp < 60 * 60 * 1000)
        
        const gotoMainCount = this.jumpHistory.filter(jump => jump.type === 'gotoMain').length
        const gotoLoginCount = this.jumpHistory.filter(jump => jump.type === 'gotoLogin').length
        
        return {
            totalJumps: this.jumpHistory.length,
            last24Hours: last24h.length,
            lastHour: lastHour.length,
            gotoMainCount,
            gotoLoginCount,
            averageInterval: this.calculateAverageInterval(this.jumpHistory),
            isEnabled: this.isEnabled
        }
    }
    
    /**
     * 清除历史记录
     */
    clearHistory(): void {
        this.jumpHistory = []
        AppUtil.info('LoginDebugger', 'clearHistory', '跳转历史已清除')
    }
    
    /**
     * 导出调试数据
     */
    exportDebugData(): any {
        return {
            jumpHistory: this.getJumpHistory(),
            statistics: this.getStatistics(),
            exportTime: new Date().toISOString()
        }
    }
}