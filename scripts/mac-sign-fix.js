const { execSync } = require('child_process');
const path = require('path');

/**
 * 自定义 macOS 签名函数，处理时间戳服务问题
 */
async function customMacSign(configuration) {
    const appPath = configuration.path;
    const identity = configuration.identity || '463A94D2F6206E2F33F0B38DF49528C70CED36E8';
    
    console.log(`🔐 开始自定义签名: ${appPath}`);
    
    try {
        // 使用不带时间戳的签名命令
        const signCommand = [
            'codesign',
            '--sign', identity,
            '--force',
            '--options', 'runtime',
            '--entitlements', path.resolve(__dirname, '../mas/entitlements.mas.plist'),
            `"${appPath}"`
        ].join(' ');
        
        console.log(`执行签名命令: ${signCommand}`);
        execSync(signCommand, { stdio: 'inherit' });
        
        console.log('✅ 签名完成');
        
        // 验证签名
        const verifyCommand = `codesign --verify --verbose "${appPath}"`;
        console.log(`验证签名: ${verifyCommand}`);
        execSync(verifyCommand, { stdio: 'inherit' });
        
        console.log('✅ 签名验证通过');
        
    } catch (error) {
        console.error('❌ 签名失败:', error.message);
        throw error;
    }
}

module.exports = customMacSign;