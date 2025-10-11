#!/usr/bin/env node

/**
 * 测试更新检查功能
 */

const { spawn } = require('child_process')
const path = require('path')

console.log('🔍 测试更新检查功能...')

// 启动应用
const electronPath = path.join(__dirname, '../node_modules/.bin/electron')
const mainPath = path.join(__dirname, '../build/main.js')

const child = spawn(electronPath, [mainPath], {
    stdio: 'pipe',
    env: {
        ...process.env,
        NODE_ENV: 'production' // 使用生产环境测试更新检查
    }
})

let output = ''
let updateCheckTriggered = false
let updateConfigSet = false

child.stdout.on('data', (data) => {
    const text = data.toString()
    output += text
    console.log('📤 stdout:', text.trim())
    
    // 检查关键日志
    if (text.includes('设置更新源:')) {
        updateConfigSet = true
        console.log('✅ 更新源配置已设置')
    }
    
    if (text.includes('开始检查更新') || text.includes('checking-for-update')) {
        updateCheckTriggered = true
        console.log('✅ 更新检查已触发')
    }
})

child.stderr.on('data', (data) => {
    const text = data.toString()
    output += text
    console.error('📥 stderr:', text.trim())
})

child.on('close', (code) => {
    console.log(`\n🏁 应用退出，退出码: ${code}`)
    
    console.log('\n📊 测试结果:')
    console.log(`  更新源配置: ${updateConfigSet ? '✅' : '❌'}`)
    console.log(`  更新检查触发: ${updateCheckTriggered ? '✅' : '❌'}`)
    
    if (updateConfigSet && updateCheckTriggered) {
        console.log('🎉 更新检查功能正常！')
        process.exit(0)
    } else {
        console.log('❌ 更新检查功能异常，请检查日志')
        process.exit(1)
    }
})

child.on('error', (error) => {
    console.error('❌ 启动应用失败:', error)
    process.exit(1)
})

// 15秒后自动关闭应用
setTimeout(() => {
    console.log('⏰ 15秒测试时间到，关闭应用')
    child.kill('SIGTERM')
}, 15000)