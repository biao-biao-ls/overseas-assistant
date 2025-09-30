export class ECommon {
    static ENone: string = 'None'

    // 开发测试 UAT
    static EUAT = 'UAT'
    // 生产环境 PRO
    static EPro = 'PRO'
    // DEV
    static EDEV = 'DEV'
    // FAT
    static EFAT = 'FAT'
    // LOCAL
    static ELOCAL = 'LOCAL'
    // 内网测试性能用
    static EINNER = '145225C'

    static ElectronEventListener = '_Electron_Event_Listener_'
    static AssistantEventHandle = '__assitEventHandle__'

    static isNone(obj) {
        return obj === undefined || obj === ECommon.ENone || obj === ''
    }
    static isNotNone(obj) {
        return !ECommon.isNone(obj)
    }
}

export class ErpUrls {
    // 基础URL配置
    private static baseUrls = {
        UAT: 'https://test.jlcpcb.com',
        LOCAL: 'https://dev.jlcpcb.com',
        PRO: 'https://jlcpcb.com',
        DEV: 'https://dev.jlcpcb.com',
        FAT: 'https://fat.jlcpcb.com',
        INNER: 'https://jlcpcb.com',
    }

    /**
     * 根据环境和语言获取ERP URL
     * @param env 环境标识
     * @param language 语言代码，默认为 'en'
     * @returns 完整的ERP URL
     */
    static getUrl(env: string, language: string = 'en'): string {
        const baseUrl = this.baseUrls[env] || this.baseUrls.PRO
        let languagePath = ''

        // 处理 "system" 语言：转换为实际的系统语言
        let effectiveLanguage = language
        if (language === 'system') {
            // 动态导入 AppConfig 以避免循环依赖
            try {
                const { AppConfig } = require('../config/AppConfig')
                effectiveLanguage = AppConfig.getSystemLanguage()
            } catch (error) {
                // 如果无法获取系统语言，默认使用英语
                effectiveLanguage = 'en'
            }
        }

        // 除了英语之外的小语种都要添加语言路径
        if (effectiveLanguage && effectiveLanguage !== 'en') {
            languagePath = `${effectiveLanguage}/`
        }

        return `${baseUrl}/user-center/${languagePath}fileManager`
    }

    // 保持向后兼容的静态属性（使用英语作为默认语言）
    static get UAT() {
        return this.getUrl('UAT')
    }
    static get LOCAL() {
        return this.getUrl('LOCAL')
    }
    static get PRO() {
        return this.getUrl('PRO')
    }
    static get DEV() {
        return this.getUrl('DEV')
    }
    static get FAT() {
        return this.getUrl('FAT')
    }
    static get INNER() {
        return this.getUrl('INNER')
    }
}

export class HomeUrls {
    static UAT = 'https://test.jlcpcb.com'
    static LOCAL = 'https://dev.jlcpcb.com'
    static PRO = 'https://jlcpcb.com'
    static DEV = 'https://dev.jlcpcb.com'
    static FAT = 'https://fat.jlcpcb.com'
    static INNER = 'https://jlcpcb.com'
}

export class ETabType {
    static EAssist = 'Assist'
    static EEDA = 'EDA'
    static EFA = 'FA'
    static listAll = [ETabType.EAssist, ETabType.EEDA, ETabType.EFA]
}

export class EBvLabel {
    static title = 'title'
    static tab = 'tab'
}

export class ELogLevel {
    static info = 'info'
    static log = 'log'
    static warn = 'warn'
    static error = 'error'
}
