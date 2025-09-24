/**
 * 渲染进程推送调试工具初始化
 * 确保推送调试工具在前端页面中可用
 */

import { pushDebugConsole } from '../utils/PushDebugConsole'

/**
 * 初始化推送调试工具
 */
function initPushDebugConsole(): void {
    // 确保在DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupPushDebug)
    } else {
        setupPushDebug()
    }
}

/**
 * 设置推送调试工具
 */
function setupPushDebug(): void {
    try {
        // 挂载到全局对象 (已在PushDebugConsole.ts中处理)
        // (window as any).pushDebug = pushDebugConsole
        
        // 添加一些便捷的全局方法
        (window as any).showPushStatus = () => {
            pushDebugConsole.showStatus()
        }
        (window as any).showPushStats = () => {
            pushDebugConsole.showDetailedStats()
        }
        (window as any).testPushConnection = () => {
            pushDebugConsole.testConnection()
        }
        (window as any).restartPushService = () => {
            pushDebugConsole.restartService()
        }
        
        // 显示欢迎信息
        console.log('%c🎉 推送调试工具已加载!', 'color: #4CAF50; font-size: 14px; font-weight: bold;')
        console.log('%c💡 快速命令:', 'color: #2196F3; font-weight: bold;')
        console.log('  • showPushStatus() - 查看推送状态')
        console.log('  • showPushStats() - 查看详细统计')
        console.log('  • testPushConnection() - 测试连接')
        console.log('  • restartPushService() - 重启服务')
        console.log('  • pushDebug.showHelp() - 查看所有命令')
        
        // 添加CSS样式美化Console输出
        addConsoleStyles()
        
        // 监听推送相关事件
        setupPushEventListeners()
        
    } catch (error) {
        console.error('❌ 推送调试工具初始化失败:', error)
    }
}

/**
 * 添加Console样式
 */
function addConsoleStyles(): void {
    // 定义Console样式
    const styles = `
        .push-debug-info { color: #4CAF50; }
        .push-debug-warn { color: #FF9800; }
        .push-debug-error { color: #F44336; }
        .push-debug-success { color: #8BC34A; }
    `
    
    // 将样式注入到页面
    const styleElement = document.createElement('style')
    styleElement.textContent = styles
    document.head.appendChild(styleElement)
}

/**
 * 设置推送事件监听器
 */
function setupPushEventListeners(): void {
    // 监听IPC消息
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const electronAPI = (window as any).electronAPI
        
        // 监听推送状态更新
        electronAPI.onPushStatusUpdate?.((status: any) => {
            console.log('📊 [推送状态更新]', status)
        })
        
        // 监听推送消息
        electronAPI.onPushMessage?.((message: any) => {
            console.log('📨 [推送消息]', message)
        })
        
        // 监听推送错误
        electronAPI.onPushError?.((error: any) => {
            console.error('❌ [推送错误]', error)
        })
    }
}

/**
 * 添加键盘快捷键
 */
function addKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
        const pushDebug = (window as any).pushDebug
        if (!pushDebug) return
        
        // Ctrl+Shift+P: 显示推送状态
        if (event.ctrlKey && event.shiftKey && event.key === 'P') {
            event.preventDefault()
            pushDebug.showStatus()
        }
        
        // Ctrl+Shift+D: 显示详细统计
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault()
            pushDebug.showDetailedStats()
        }
        
        // Ctrl+Shift+T: 测试连接
        if (event.ctrlKey && event.shiftKey && event.key === 'T') {
            event.preventDefault()
            pushDebug.testConnection()
        }
        
        // Ctrl+Shift+R: 重启推送服务
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault()
            pushDebug.restartService()
        }
    })
    
    // 显示快捷键提示
    console.log('%c⌨️ 推送调试快捷键:', 'color: #9C27B0; font-weight: bold;')
    console.log('  • Ctrl+Shift+P - 显示推送状态')
    console.log('  • Ctrl+Shift+D - 显示详细统计')
    console.log('  • Ctrl+Shift+T - 测试连接')
    console.log('  • Ctrl+Shift+R - 重启推送服务')
}

// 自动初始化
initPushDebugConsole()

// 添加键盘快捷键
addKeyboardShortcuts()

// 导出工具函数
export {
    initPushDebugConsole,
    setupPushDebug,
    pushDebugConsole
}