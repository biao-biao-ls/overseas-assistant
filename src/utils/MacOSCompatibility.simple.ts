import { AppUtil } from './AppUtil'

/**
 * macOS 兼容性工具类 - 简化版本
 * 专门处理不同版本 macOS 的兼容性问题
 */
export class MacOSCompatibility {
    /**
     * 检查是否为旧版 macOS (10.15 及更早版本)
     */
    public static isOldMacOS(): boolean {
        if (process.platform !== 'darwin') {
            return false
        }

        try {
            const osVersion = require('os').release()
            const darwinVersion = parseInt(osVersion.split('.')[0])
            
            // Darwin 19.x = macOS 10.15 (Catalina)
            // 如果是 Darwin 19 或更早版本，认为是旧版 macOS
            return darwinVersion <= 19
        } catch (error) {
            console.warn('⚠️ 检测 macOS 版本失败:', error.message)
            return false
        }
    }

    /**
     * 检查是否为非常旧的 macOS (10.14 及更早版本)
     */
    public static isVeryOldMacOS(): boolean {
        if (process.platform !== 'darwin') {
            return false
        }

        try {
            const osVersion = require('os').release()
            const darwinVersion = parseInt(osVersion.split('.')[0])
            
            // Darwin 18.x = macOS 10.14 (Mojave)
            return darwinVersion <= 18
        } catch (error) {
            console.warn('⚠️ 检测 macOS 版本失败:', error.message)
            return false
        }
    }

    /**
     * 获取适合当前 macOS 版本的 electron-updater 配置
     */
    public static getUpdaterConfig(): {
        autoDownload: boolean
        autoInstallOnAppQuit: boolean
        allowPrerelease: boolean
        allowDowngrade: boolean
    } {
        const isOld = this.isOldMacOS()
        const isVeryOld = this.isVeryOldMacOS()

        if (isVeryOld) {
            // 非常旧的 macOS 使用最保守的配置
            return {
                autoDownload: false,
                autoInstallOnAppQuit: true,
                allowPrerelease: false,
                allowDowngrade: true
            }
        } else if (isOld) {
            // 旧版 macOS 使用兼容配置
            return {
                autoDownload: false,
                autoInstallOnAppQuit: true,
                allowPrerelease: false,
                allowDowngrade: false
            }
        } else {
            // 新版 macOS 使用标准配置
            return {
                autoDownload: true,
                autoInstallOnAppQuit: false,
                allowPrerelease: false,
                allowDowngrade: false
            }
        }
    }

    /**
     * 获取适合当前 macOS 版本的安装超时时间（毫秒）
     */
    public static getInstallTimeout(): number {
        if (this.isVeryOldMacOS()) {
            return 15000 // 15秒
        } else if (this.isOldMacOS()) {
            return 10000 // 10秒
        } else {
            return 5000  // 5秒
        }
    }

    /**
     * 记录 macOS 兼容性信息
     */
    public static logCompatibilityInfo(): void {
        const config = this.getUpdaterConfig()
        
        console.log('🍎 macOS 兼容性信息:', {
            isOldMacOS: this.isOldMacOS(),
            isVeryOldMacOS: this.isVeryOldMacOS(),
            updaterConfig: config,
            installTimeout: this.getInstallTimeout()
        })

        try {
            AppUtil.info('MacOSCompatibility', 'logCompatibilityInfo', 'macOS兼容性配置', {
                config
            })
        } catch (error) {
            console.warn('⚠️ 记录兼容性信息失败:', error.message)
        }
    }
}