import { AppUtil } from './AppUtil'

/**
 * macOS 兼容性工具类
 * 专门处理不同版本 macOS 的兼容性问题
 */
export class MacOSCompatibility {
    /**
     * 获取 macOS 版本信息
     */
    public static getMacOSVersion(): { major: number; minor: number; patch: number } | null {
        if (process.platform !== 'darwin') {
            return null
        }

        try {
            const osVersion = require('os').release()
            const darwinVersion = parseInt(osVersion.split('.')[0])
            
            // Darwin 版本到 macOS 版本的映射
            // Darwin 19.x = macOS 10.15 (Catalina)
            // Darwin 20.x = macOS 11.x (Big Sur)
            // Darwin 21.x = macOS 12.x (Monterey)
            // Darwin 22.x = macOS 13.x (Ventura)
            
            if (darwinVersion >= 20) {
                // macOS 11+ (Big Sur 及更新版本)
                const macOSMajor = darwinVersion - 9
                return { major: macOSMajor, minor: 0, patch: 0 }
            } else {
                // macOS 10.x
                const macOSMinor = darwinVersion - 4
                return { major: 10, minor: macOSMinor, patch: 0 }
            }
        } catch (error) {
            AppUtil.error('MacOSCompatibility', 'getMacOSVersion', '获取 macOS 版本失败', error)
            return null
        }
    }

    /**
     * 检查是否为旧版 macOS (10.15 及更早版本)
     */
    public static isOldMacOS(): boolean {
        const version = this.getMacOSVersion()
        if (!version) return false
        
        return version.major < 11 && (version.major < 10 || version.minor <= 15)
    }

    /**
     * 检查是否为非常旧的 macOS (10.14 及更早版本)
     */
    public static isVeryOldMacOS(): boolean {
        const version = this.getMacOSVersion()
        if (!version) return false
        
        return version.major < 10 || (version.major === 10 && version.minor <= 14)
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
     * 清理旧版 macOS 的更新缓存
     */
    public static async clearOldMacOSCache(): Promise<void> {
        if (!this.isOldMacOS()) {
            return
        }

        try {
            const { app } = require('electron')
            const path = require('path')
            const fs = require('fs')

            // 确保 app 已经初始化
            if (!app.isReady()) {
                AppUtil.warn('MacOSCompatibility', 'clearOldMacOSCache', 'App is not ready yet, skipping cache cleanup')
                return
            }

            const cachePaths = [
                path.join(app.getPath('userData'), 'updater'),
                path.join(app.getPath('userData'), 'JLCONE-updater'),
                path.join(app.getPath('userData'), 'Caches'),
                path.join(require('os').tmpdir(), 'electron-updater'),
                path.join(require('os').tmpdir(), 'JLCONE-updater')
            ]

            for (const cachePath of cachePaths) {
                if (fs.existsSync(cachePath)) {
                    try {
                        fs.rmSync(cachePath, { recursive: true, force: true })
                        AppUtil.info('MacOSCompatibility', 'clearOldMacOSCache', `已清除缓存: ${cachePath}`)
                    } catch (error) {
                        AppUtil.warn('MacOSCompatibility', 'clearOldMacOSCache', `清除缓存失败: ${cachePath}`, error)
                    }
                }
            }
        } catch (error) {
            AppUtil.error('MacOSCompatibility', 'clearOldMacOSCache', '清理缓存失败', error)
        }
    }

    /**
     * 记录 macOS 兼容性信息
     */
    public static logCompatibilityInfo(): void {
        const version = this.getMacOSVersion()
        const config = this.getUpdaterConfig()
        
        console.log('🍎 macOS 兼容性信息:', {
            version: version,
            isOldMacOS: this.isOldMacOS(),
            isVeryOldMacOS: this.isVeryOldMacOS(),
            updaterConfig: config,
            installTimeout: this.getInstallTimeout()
        })

        AppUtil.info('MacOSCompatibility', 'logCompatibilityInfo', 'macOS兼容性配置', {
            version,
            config
        })
    }
}