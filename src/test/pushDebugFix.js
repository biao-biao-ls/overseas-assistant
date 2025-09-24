/**
 * 推送调试工具快速修复脚本
 * 用于诊断和修复常见的推送调试问题
 */

// 在Console中运行此脚本来自动诊断和修复问题
(function() {
    console.log('🔧 [快速修复] 推送调试工具诊断和修复脚本')
    console.log('=' .repeat(60))
    
    // 诊断步骤
    const diagnosticSteps = [
        {
            name: '检查全局对象',
            test: () => {
                const results = {
                    pushDebug: typeof window.pushDebug,
                    showPushStatus: typeof window.showPushStatus,
                    showPushStats: typeof window.showPushStats,
                    electron: typeof window.electron
                }
                
                console.log('🔍 [诊断] 全局对象检查:', results)
                
                const missing = Object.entries(results)
                    .filter(([key, type]) => type === 'undefined')
                    .map(([key]) => key)
                
                if (missing.length > 0) {
                    console.warn('⚠️ [问题] 缺少全局对象:', missing.join(', '))
                    return false
                }
                
                console.log('✅ [通过] 所有全局对象都存在')
                return true
            }
        },
        
        {
            name: '测试IPC通信',
            test: async () => {
                try {
                    if (!window.electron || !window.electron.ipcRenderer) {
                        console.error('❌ [失败] electron.ipcRenderer 不可用')
                        return false
                    }
                    
                    console.log('🔍 [测试] 测试IPC调试接口...')
                    const response = await window.electron.ipcRenderer.invoke('debug-push-ipc')
                    
                    if (response && response.success) {
                        console.log('✅ [通过] IPC通信正常')
                        console.log('📊 [信息] 已注册的处理器:', response.data.registeredHandlers)
                        return true
                    } else {
                        console.error('❌ [失败] IPC调试接口响应异常:', response)
                        return false
                    }
                } catch (error) {
                    console.error('❌ [失败] IPC通信测试失败:', error.message)
                    
                    if (error.message.includes('No handler registered')) {
                        console.log('💡 [建议] IPC处理器未注册，可能需要重启应用')
                    }
                    
                    return false
                }
            }
        },
        
        {
            name: '测试推送状态获取',
            test: async () => {
                try {
                    if (typeof window.showPushStatus !== 'function') {
                        console.error('❌ [失败] showPushStatus 函数不存在')
                        return false
                    }
                    
                    console.log('🔍 [测试] 测试推送状态获取...')
                    await window.showPushStatus()
                    console.log('✅ [通过] 推送状态获取正常')
                    return true
                } catch (error) {
                    console.error('❌ [失败] 推送状态获取失败:', error.message)
                    return false
                }
            }
        }
    ]
    
    // 修复方法
    const fixMethods = {
        reloadDebugTools: () => {
            console.log('🔄 [修复] 尝试重新加载推送调试工具...')
            
            // 清除现有的全局对象
            delete window.pushDebug
            delete window.showPushStatus
            delete window.showPushStats
            
            // 尝试重新初始化（如果有初始化函数的话）
            if (typeof window.initPushDebugTools === 'function') {
                window.initPushDebugTools()
                console.log('✅ [修复] 推送调试工具已重新加载')
            } else {
                console.log('⚠️ [修复] 无法自动重新加载，请刷新页面')
            }
        },
        
        showManualFix: () => {
            console.group('🛠️ [手动修复] 推送调试工具修复指南')
            console.log('1. 刷新页面 (F5 或 Ctrl+R)')
            console.log('2. 检查preload脚本是否正确加载')
            console.log('3. 确认应用已正确初始化推送服务')
            console.log('4. 如果问题持续，请重启应用')
            console.log('')
            console.log('🔍 调试命令:')
            console.log('  • pushDebug.debugIPC() - 检查IPC状态')
            console.log('  • pushDebug.showHelp() - 显示帮助')
            console.groupEnd()
        }
    }
    
    // 运行诊断
    async function runDiagnostics() {
        console.log('🚀 [开始] 运行诊断测试...')
        
        let passedTests = 0
        const totalTests = diagnosticSteps.length
        
        for (const step of diagnosticSteps) {
            try {
                console.log(`\n🔍 [测试] ${step.name}...`)
                const result = await step.test()
                
                if (result) {
                    passedTests++
                }
            } catch (error) {
                console.error(`💥 [异常] ${step.name} 测试异常:`, error)
            }
        }
        
        console.log('\n📊 [结果] 诊断完成')
        console.log(`✅ 通过: ${passedTests}/${totalTests}`)
        console.log(`❌ 失败: ${totalTests - passedTests}/${totalTests}`)
        
        if (passedTests === totalTests) {
            console.log('🎉 [成功] 推送调试工具工作正常！')
        } else {
            console.log('⚠️ [问题] 发现问题，尝试自动修复...')
            
            // 尝试自动修复
            fixMethods.reloadDebugTools()
            
            // 显示手动修复指南
            setTimeout(() => {
                fixMethods.showManualFix()
            }, 1000)
        }
    }
    
    // 提供手动修复方法
    window.fixPushDebug = {
        runDiagnostics,
        reloadTools: fixMethods.reloadDebugTools,
        showHelp: fixMethods.showManualFix
    }
    
    console.log('💡 [提示] 可用的修复命令:')
    console.log('  • fixPushDebug.runDiagnostics() - 运行完整诊断')
    console.log('  • fixPushDebug.reloadTools() - 重新加载调试工具')
    console.log('  • fixPushDebug.showHelp() - 显示修复指南')
    console.log('')
    
    // 自动运行诊断
    runDiagnostics()
})()