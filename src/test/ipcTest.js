/**
 * IPC通信测试脚本
 * 用于验证推送调试工具的IPC处理器是否正确注册
 */

// 在Console中运行此脚本来测试IPC通信
(function() {
    console.log('🧪 [IPC测试] 开始测试推送调试工具的IPC通信...')
    
    // 测试函数
    async function testIPC() {
        const tests = [
            {
                name: '获取推送状态',
                channel: 'get-push-service-status',
                expectedFields: ['connectionStatus', 'isEnabled']
            },
            {
                name: '获取推送统计',
                channel: 'get-push-service-stats',
                expectedFields: ['service', 'connection']
            }
        ]
        
        for (const test of tests) {
            try {
                console.log(`🔍 [测试] ${test.name}...`)
                
                // 检查是否有electron对象
                if (!window.electron || !window.electron.ipcRenderer) {
                    console.error('❌ electron.ipcRenderer 不可用')
                    continue
                }
                
                const startTime = Date.now()
                const response = await window.electron.ipcRenderer.invoke(test.channel)
                const duration = Date.now() - startTime
                
                console.log(`⏱️ [性能] ${test.name} 耗时: ${duration}ms`)
                
                if (response && response.success) {
                    console.log(`✅ [成功] ${test.name}`)
                    console.log('📊 [数据]', response.data)
                    
                    // 验证预期字段
                    if (test.expectedFields) {
                        const missingFields = test.expectedFields.filter(field => 
                            !(field in response.data)
                        )
                        
                        if (missingFields.length > 0) {
                            console.warn(`⚠️ [警告] 缺少预期字段: ${missingFields.join(', ')}`)
                        } else {
                            console.log(`✅ [验证] 所有预期字段都存在`)
                        }
                    }
                } else {
                    console.error(`❌ [失败] ${test.name}:`, response?.error || '未知错误')
                }
                
            } catch (error) {
                console.error(`💥 [异常] ${test.name}:`, error)
                
                // 分析错误类型
                if (error.message.includes('No handler registered')) {
                    console.error('🔧 [建议] IPC处理器未注册，请检查主进程中的setupPushServiceIPC()方法')
                } else if (error.message.includes('timeout')) {
                    console.error('🔧 [建议] IPC调用超时，请检查主进程是否响应')
                } else {
                    console.error('🔧 [建议] 未知错误，请检查Console中的详细错误信息')
                }
            }
            
            // 测试间隔
            await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        console.log('🏁 [完成] IPC通信测试完成')
    }
    
    // 运行测试
    testIPC().catch(error => {
        console.error('💥 [测试失败]', error)
    })
    
    // 提供手动测试方法
    window.testPushIPC = testIPC
    console.log('💡 [提示] 可以随时运行 testPushIPC() 来重新测试')
})()