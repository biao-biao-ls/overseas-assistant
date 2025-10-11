#!/usr/bin/env node

/**
 * 更新兼容性测试脚本
 * 用于测试不同版本 macOS 上的更新功能
 */

const os = require('os')
const path = require('path')
const fs = require('fs')

console.log('🧪 JLCONE 更新兼容性测试')
console.log('=' .repeat(50))

// 获取系统信息
const platform = os.platform()
const arch = os.arch()
const release = os.release()

console.log('📊 系统信息:')
console.log(`  平台: ${platform}`)
console.log(`  架构: ${arch}`)
console.log(`  内核版本: ${release}`)

if (platform === 'darwin') {
    // 解析 macOS 版本
    const darwinVersion = parseInt(release.split('.')[0])
    let macOSVersion = ''
    
    if (darwinVersion >= 20) {
        const macOSMajor = darwinVersion - 9
        macOSVersion = `macOS ${macOSMajor}.x`
    } else {
        const macOSMinor = darwinVersion - 4
        macOSVersion = `macOS 10.${macOSMinor}`
    }
    
    console.log(`  macOS 版本: ${macOSVersion}`)
    
    // 兼容性分析
    const isOld = darwinVersion <= 19
    const isVeryOld = darwinVersion <= 18
    
    console.log('\n🔍 兼容性分析:')
    console.log(`  是否为旧版 macOS: ${isOld ? '是' : '否'}`)
    console.log(`  是否为非常旧版 macOS: ${isVeryOld ? '是' : '否'}`)
    
    // 推荐配置
    console.log('\n⚙️ 推荐的 electron-updater 配置:')
    if (isVeryOld) {
        console.log('  autoDownload: false (禁用自动下载)')
        console.log('  autoInstallOnAppQuit: true (退出时安装)')
        console.log('  allowDowngrade: true (允许降级)')
        console.log('  安装超时: 15秒')
        console.log('  ⚠️  建议使用 electron-updater@4.6.5')
    } else if (isOld) {
        console.log('  autoDownload: false (禁用自动下载)')
        console.log('  autoInstallOnAppQuit: true (退出时安装)')
        console.log('  allowDowngrade: false')
        console.log('  安装超时: 10秒')
        console.log('  ⚠️  建议使用 electron-updater@4.6.5')
    } else {
        console.log('  autoDownload: true (启用自动下载)')
        console.log('  autoInstallOnAppQuit: false')
        console.log('  安装超时: 5秒')
        console.log('  ✅ 可以使用最新版本的 electron-updater')
    }
    
    // 检查缓存目录
    console.log('\n📁 检查更新缓存目录:')
    const { app } = require('electron')
    const userDataPath = app ? app.getPath('userData') : path.join(os.homedir(), 'Library', 'Application Support', 'JLCONE')
    
    const cachePaths = [
        path.join(userDataPath, 'updater'),
        path.join(userDataPath, 'JLCONE-updater'),
        path.join(userDataPath, 'Caches'),
        path.join(os.tmpdir(), 'electron-updater'),
        path.join(os.tmpdir(), 'JLCONE-updater')
    ]
    
    cachePaths.forEach(cachePath => {
        const exists = fs.existsSync(cachePath)
        console.log(`  ${cachePath}: ${exists ? '存在' : '不存在'}`)
        
        if (exists && isOld) {
            console.log(`    ⚠️  建议清除此缓存目录`)
        }
    })
    
    // 测试建议
    console.log('\n🧪 测试建议:')
    console.log('1. 清除所有更新缓存')
    console.log('2. 使用兼容版本的 electron-updater')
    console.log('3. 启用详细日志记录')
    console.log('4. 测试手动下载模式')
    console.log('5. 验证安装权限')
    
    if (isOld) {
        console.log('\n⚠️  旧版 macOS 特别注意事项:')
        console.log('- 禁用自动下载，改为手动触发')
        console.log('- 增加安装超时时间')
        console.log('- 使用强制退出安装模式')
        console.log('- 定期清理更新缓存')
        console.log('- 考虑降级到 electron-updater@4.6.5')
    }
    
} else {
    console.log('\n💡 此脚本主要用于 macOS 兼容性测试')
    console.log('   其他平台请参考标准的 electron-updater 配置')
}

console.log('\n' + '=' .repeat(50))
console.log('测试完成！')