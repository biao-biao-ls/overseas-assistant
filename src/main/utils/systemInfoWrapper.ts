/**
 * systeminformation 包装器
 * 处理跨平台兼容性问题，避免 macOS 特定模块在 Windows 下的加载错误
 */

let si: any = null

try {
    // 尝试加载 systeminformation
    si = require('systeminformation')
} catch (error) {
    // systeminformation加载失败，使用降级方案
    
    // 提供降级的 mock 实现
    si = {
        system: () => Promise.resolve({
            uuid: 'mock-uuid',
            virtual: false
        }),
        baseboard: () => Promise.resolve({
            manufacturer: 'Unknown',
            model: 'Unknown',
            serial: 'Unknown'
        }),
        cpu: () => Promise.resolve({
            manufacturer: 'Unknown',
            brand: 'Unknown CPU',
            speed: 0
        }),
        networkInterfaces: () => Promise.resolve([{
            mac: '00:00:00:00:00:00',
            ifaceName: 'Unknown'
        }]),
        diskLayout: () => Promise.resolve([{
            serialNum: 'Unknown'
        }]),
        osInfo: () => Promise.resolve({
            hostname: require('os').hostname(),
            arch: require('os').arch(),
            distro: require('os').type(),
            release: require('os').release(),
            build: '0',
            servicepack: ''
        }),
        uuid: () => Promise.resolve({
            os: 'mock-os-uuid'
        })
    }
}

export default si