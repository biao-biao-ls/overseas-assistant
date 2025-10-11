import { AppConfig } from '../config/AppConfig'
import { AppUtil } from '../utils/AppUtil'

/**
 * 更新检查响应接口
 */
export interface UpdateCheckResponse {
    success: boolean
    code: number
    message: string | null
    data: {
        bizKey: string
        deleteFlag: null
        createTime: null
        platform: string
        versionCode: string
        forceUpdate: boolean
        updateContent: string
        updateUrl: string
        versionStatus: number
        fileAccessId: null
        fileName: null
    }
}

/**
 * 更新信息接口
 */
export interface UpdateInfo {
    hasUpdate: boolean
    forceUpdate: boolean
    version: string
    updateContent: string
    updateUrl: string
    platform: string
}

/**
 * 更新服务类
 * 负责检查版本更新和处理更新逻辑
 */
export class UpdateService {
    private static instance: UpdateService

    public static getInstance(): UpdateService {
        if (!UpdateService.instance) {
            UpdateService.instance = new UpdateService()
        }
        return UpdateService.instance
    }

    /**
     * 检查更新
     * @returns Promise<UpdateInfo>
     */
    public async checkForUpdates(): Promise<UpdateInfo> {
        const currentVersion = this.getCurrentVersion()
        const platform = this.getCurrentPlatform()
        const envConfig = AppConfig.getEnvConfig()
        const checkUrl = `${envConfig.PCB_BASE_URL}/api/overseas-core-platform/baseDataConfig/checkUpdate`

        const requestBody = {
            platform: platform,
            versionCode: '0',
        }

        // 创建调试信息对象
        const debugInfo = {
            checkTime: new Date().toLocaleString('zh-CN'),
            requestUrl: checkUrl,
            requestBody: requestBody,
            responseData: null as any,
            error: null as string | null,
            currentVersion: currentVersion,
            platform: platform,
        }

        try {
            AppUtil.info('UpdateService', 'checkForUpdates', `检查更新: ${checkUrl}, 平台: ${platform}`)

            const response = await fetch(checkUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'JLCONE-Desktop',
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const result: UpdateCheckResponse = await response.json()
            debugInfo.responseData = result

            if (!result.success || result.code !== 200) {
                throw new Error(`API Error: ${result.message || 'Unknown error'}`)
            }

            const updateInfo = this.parseUpdateResponse(result)
            AppUtil.info('UpdateService', 'checkForUpdates', `更新检查结果:`, updateInfo)

            // 发送调试信息到渲染进程
            this.sendDebugInfo(debugInfo)

            return updateInfo
        } catch (error) {
            debugInfo.error = error instanceof Error ? error.message : String(error)
            AppUtil.error('UpdateService', 'checkForUpdates', '检查更新失败', error)

            // 发送调试信息到渲染进程（包含错误信息）
            this.sendDebugInfo(debugInfo)

            return {
                hasUpdate: false,
                forceUpdate: false,
                version: '',
                updateContent: '',
                updateUrl: '',
                platform: this.getCurrentPlatform(),
            }
        }
    }

    /**
     * 发送调试信息到渲染进程
     * @param debugInfo 调试信息
     */
    private sendDebugInfo(debugInfo: any): void {
        try {
            // 通过 AppUtil 发送消息到当前窗口
            const { AppUtil } = require('../utils/AppUtil')
            const { EMessage } = require('../enum/EMessage')
            const { AppMsg } = require('../base/AppMsg')

            const currentWindow = AppUtil.getCurrentShowWnd()
            const mainWindow = AppUtil.getExistWnd(currentWindow)

            if (mainWindow && mainWindow.getBrowserWindow) {
                mainWindow
                    .getBrowserWindow()
                    .webContents.send(EMessage.ESendToRender, new AppMsg('update-debug-info', debugInfo))
                console.log('🔍 已发送调试信息到渲染进程')
            }
        } catch (error) {
            console.error('❌ 发送调试信息失败:', error)
        }
    }

    /**
     * 解析更新响应
     * @param response
     * @returns UpdateInfo
     */
    private parseUpdateResponse(response: UpdateCheckResponse): UpdateInfo {
        const { data } = response
        const currentVersion = this.getCurrentVersion()
        const hasUpdate = this.compareVersions(data.versionCode, currentVersion) > 0

        return {
            hasUpdate,
            forceUpdate: data.forceUpdate,
            version: data.versionCode,
            updateContent: data.updateContent,
            updateUrl: data.updateUrl,
            platform: data.platform,
        }
    }

    /**
     * 获取当前平台
     * @returns string
     */
    private getCurrentPlatform(): string {
        switch (process.platform) {
            case 'win32':
                return 'windows'
            case 'darwin':
                // 区分 M 系列芯片和 Intel 芯片的 macOS
                return process.arch === 'arm64' ? 'macos(m)' : 'macos(intel)'
            case 'linux':
                return 'linux'
            default:
                return 'windows' // 默认返回 windows
        }
    }

    /**
     * 获取当前版本
     * @returns string
     */
    public getCurrentVersion(): string {
        try {
            // 优先从 AppConfig.config 中获取版本号
            const configVersion = AppConfig.getUserConfig('version') as string
            if (configVersion) {
                AppUtil.info('UpdateService', 'getCurrentVersion', `从配置获取版本: ${configVersion}`)
                return configVersion
            }

            // 备用方案：从 package.json 获取版本
            const packageJson = require('../../package.json')
            const packageVersion = packageJson.version || '1.0.0'
            AppUtil.info('UpdateService', 'getCurrentVersion', `从package.json获取版本: ${packageVersion}`)
            return packageVersion
        } catch (error) {
            AppUtil.error('UpdateService', 'getCurrentVersion', '获取当前版本失败', error)
            return '1.0.0'
        }
    }

    /**
     * 比较版本号
     * @param version1
     * @param version2
     * @returns number 1: version1 > version2, 0: equal, -1: version1 < version2
     */
    private compareVersions(version1: string, version2: string): number {
        const v1Parts = version1.split('.').map(Number)
        const v2Parts = version2.split('.').map(Number)

        const maxLength = Math.max(v1Parts.length, v2Parts.length)

        for (let i = 0; i < maxLength; i++) {
            const v1Part = v1Parts[i] || 0
            const v2Part = v2Parts[i] || 0

            if (v1Part > v2Part) return 1
            if (v1Part < v2Part) return -1
        }

        return 0
    }

    /**
     * 获取 electron-updater 的 Feed URL
     * @returns string
     */
    public getFeedURL(): string {
        // 开发环境下检查是否有本地调试配置
        if (AppConfig.isProcessDev()) {
            try {
                // 动态导入调试配置，避免构建时的模块找不到警告
                const debugConfig = eval('require')('../debug-update-config')
                if (debugConfig.DEBUG_UPDATE_CONFIG?.enabled) {
                    const localUrl = debugConfig.DEBUG_UPDATE_CONFIG.localServer
                    AppUtil.info('UpdateService', 'getFeedURL', `使用本地调试服务器: ${localUrl}`)
                    console.log('🔧 使用本地调试更新服务器:', localUrl)
                    return localUrl
                }
            } catch (error) {
                // 调试配置不存在，使用正常配置
                AppUtil.info('UpdateService', 'getFeedURL', '未找到本地调试配置，使用正常更新服务器')
            }
        }

        const envConfig = AppConfig.getEnvConfig()

        if (process.platform === 'darwin') {
            const isARM = process.arch === 'arm64'
            return isARM
                ? `${envConfig.ASSETS_URL}/app_version/package/mac/arm`
                : `${envConfig.ASSETS_URL}/app_version/package/mac/intel`
        } else {
            return `${envConfig.ASSETS_URL}/app_version/package/windows`
        }
    }
}
