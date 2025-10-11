#!/usr/bin/env node

/**
 * 测试应用启动
 */

const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 测试应用启动...')

// 启动应用
const electronPath = path.join(__dirname, '../node_modules/.bin/electron')
const mainPath = path.join(__dirname, '../build/main.js')

const child = spawn(electronPath, [mainPath], {
    stdio: 'pipe',
    env: {
        ...process.env,
        NODE_ENV: 'development'
    }
})

let output = ''
let hasError = false

child.stdout.on('data', (data) => {
    const text = data.toString()
    output += text
    console.log('📤 stdout:', text.trim())
})

child.stderr.on('data', (data) => {
    const text = data.toString()
    output += text
    console.error('📥 stderr:', text.trim())
    
    // 检查是否有严重错误
    if (text.includes('Error:') || text.includes('TypeError:') || text.includes('ReferenceError:')) {
        hasError = true
    }
})

child.on('close', (code) => {
    console.log(`\n🏁 应用退出，退出码: ${code}`)
    
    if (hasError) {
        console.log('❌ 检测到错误，请检查上面的日志')
        process.exit(1)
    } else if (code === 0) {
        console.log('✅ 应用正常启动和退出')
    } else {
        console.log(`⚠️ 应用异常退出，退出码: ${code}`)
        process.exit(code)
    }
})

child.on('error', (error) => {
    console.error('❌ 启动应用失败:', error)
    process.exit(1)
})

// 5秒后自动关闭应用
setTimeout(() => {
    console.log('⏰ 5秒测试时间到，关闭应用')
    child.kill('SIGTERM')
}, 5000)