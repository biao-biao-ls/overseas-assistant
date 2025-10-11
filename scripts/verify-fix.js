#!/usr/bin/env node

/**
 * 验证 macOS 更新修复是否正确应用
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 验证 macOS 更新修复...')
console.log('=' .repeat(50))

let allChecksPass = true

// 检查文件是否存在
const requiredFiles = [
    'src/utils/MacOSCompatibility.ts',
    'src/utils/UpdateLogger.ts',
    'scripts/test-update-compatibility.js',
    'MACOS_UPDATE_FIX.md'
]

console.log('📁 检查必需文件:')
requiredFiles.forEach(file => {
    const exists = fs.existsSync(file)
    console.log(`  ${file}: ${exists ? '✅' : '❌'}`)
    if (!exists) allChecksPass = false
})

// 检查 package.json 中的版本
console.log('\n📦 检查依赖版本:')
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const electronUpdaterVersion = packageJson.dependencies['electron-updater']
    
    console.log(`  electron-updater: ${electronUpdaterVersion}`)
    if (electronUpdaterVersion === '^4.6.5') {
        console.log('  ✅ electron-updater 版本正确')
    } else {
        console.log('  ❌ electron-updater 版本不正确，应该是 ^4.6.5')
        allChecksPass = false
    }
    
    // 检查测试脚本
    const testScript = packageJson.scripts['test:update-compatibility']
    if (testScript === 'node scripts/test-update-compatibility.js') {
        console.log('  ✅ 测试脚本配置正确')
    } else {
        console.log('  ❌ 测试脚本配置不正确')
        allChecksPass = false
    }
} catch (error) {
    console.log('  ❌ 无法读取 package.json')
    allChecksPass = false
}

// 检查主进程文件中的关键修改
console.log('\n🔧 检查主进程修改:')
try {
    const mainContent = fs.readFileSync('src/main/main.ts', 'utf8')
    
    const checks = [
        {
            name: 'MacOSCompatibility 导入',
            pattern: /import.*MacOSCompatibility.*from/,
            required: true
        },
        {
            name: 'UpdateLogger 导入',
            pattern: /import.*UpdateLogger.*from/,
            required: true
        },
        {
            name: 'MacOSCompatibility.getUpdaterConfig()',
            pattern: /MacOSCompatibility\.getUpdaterConfig\(\)/,
            required: true
        },
        {
            name: 'UpdateLogger.logSystemInfo()',
            pattern: /UpdateLogger\.logSystemInfo\(\)/,
            required: true
        },
        {
            name: 'MacOSCompatibility.isOldMacOS()',
            pattern: /MacOSCompatibility\.isOldMacOS\(\)/,
            required: true
        },
        {
            name: 'UpdateLogger.logUpdateError',
            pattern: /UpdateLogger\.logUpdateError/,
            required: true
        }
    ]
    
    checks.forEach(check => {
        const found = check.pattern.test(mainContent)
        console.log(`  ${check.name}: ${found ? '✅' : '❌'}`)
        if (check.required && !found) allChecksPass = false
    })
} catch (error) {
    console.log('  ❌ 无法读取 src/main/main.ts')
    allChecksPass = false
}

// 检查渲染进程文件中的修改
console.log('\n🖥️  检查渲染进程修改:')
try {
    const rendererContent = fs.readFileSync('src/renderer/updateTip/updateTip.tsx', 'utf8')
    
    const checks = [
        {
            name: 'isOldMacOS 函数',
            pattern: /const isOldMacOS = \(\) => \{/,
            required: true
        },
        {
            name: '旧版 macOS 处理逻辑',
            pattern: /if \(isOldMacOS\(\)\)/,
            required: true
        }
    ]
    
    checks.forEach(check => {
        const found = check.pattern.test(rendererContent)
        console.log(`  ${check.name}: ${found ? '✅' : '❌'}`)
        if (check.required && !found) allChecksPass = false
    })
} catch (error) {
    console.log('  ❌ 无法读取 src/renderer/updateTip/updateTip.tsx')
    allChecksPass = false
}

// 检查工具类文件
console.log('\n🛠️  检查工具类:')
try {
    const macOSCompatContent = fs.readFileSync('src/utils/MacOSCompatibility.ts', 'utf8')
    const updateLoggerContent = fs.readFileSync('src/utils/UpdateLogger.ts', 'utf8')
    
    const macOSChecks = [
        'getMacOSVersion',
        'isOldMacOS',
        'isVeryOldMacOS',
        'getUpdaterConfig',
        'getInstallTimeout',
        'clearOldMacOSCache'
    ]
    
    const loggerChecks = [
        'logSystemInfo',
        'logUpdaterConfig',
        'logUpdateEvent',
        'logUpdateError',
        'exportLogs'
    ]
    
    console.log('  MacOSCompatibility 方法:')
    macOSChecks.forEach(method => {
        const found = macOSCompatContent.includes(method)
        console.log(`    ${method}: ${found ? '✅' : '❌'}`)
        if (!found) allChecksPass = false
    })
    
    console.log('  UpdateLogger 方法:')
    loggerChecks.forEach(method => {
        const found = updateLoggerContent.includes(method)
        console.log(`    ${method}: ${found ? '✅' : '❌'}`)
        if (!found) allChecksPass = false
    })
} catch (error) {
    console.log('  ❌ 无法读取工具类文件')
    allChecksPass = false
}

// 最终结果
console.log('\n' + '=' .repeat(50))
if (allChecksPass) {
    console.log('🎉 所有检查通过！macOS 更新修复已正确应用')
    console.log('\n📋 下一步:')
    console.log('1. 在 2019年 macOS Intel 机器上测试')
    console.log('2. 运行: npm run test:update-compatibility')
    console.log('3. 构建应用: npm run build && npm run package:mac')
    console.log('4. 验证更新功能是否正常工作')
} else {
    console.log('❌ 部分检查失败，请检查上述错误')
    process.exit(1)
}

console.log('\n✨ 验证完成！')