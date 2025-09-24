import { app, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { ECommon, ErpUrls } from '../enum/ECommon'
import { AppUtil } from '../utils/AppUtil'
import { exec } from 'child_process'
import AppContainer from '../base/AppContainer'
import { ASSIT_VERSION } from '../main/config'
import countryList from '../utils/countries.json'
import languageList from '../utils/languages.json'
import rateList from '../utils/rates.json'
import locales from '../utils/locales.json'
import { removeLangSegment } from '../utils'

/**
 * 调试配置类
 * 用于控制开发环境下的调试功能
 */
export class DebugConfig {
    /** 是否在开发环境下打开开发者工具 */
    static DebugOpenDev = false
}

/**
 * 标签页键值枚举
 * 定义不同业务模块的标签页标识符
 */
export class ETabKey {
    /** ERP首页标识 */
    static EErpIndex = 'erpIndex'
    /** SMT模块标识 */
    static ESmt = 'smt'
    /** SMT首页标识 */
    static ESmtHome = 'smtHome'
    /** EDA专业版标识 */
    static EEDAPro = 'edaPro'
    /** FA模块标识 */
    static EFA = 'FA'
    /** FA首页标识 */
    static EFAIndex = 'FAIndex'
    /** SMT匹配页面标识 */
    static ESmtMatch = 'smtMatch'
    /** SMT订单结算标识 */
    static ESmtOrderSettlement = 'smtOrder'
}
/**
 * URL匹配类型枚举
 * 定义URL匹配的不同方式
 */
export class EMatchType {
    /** 正则表达式匹配 */
    static EReg = 'reg'
    /** 精确匹配 */
    static EEqual = 'equal'
}
/**
 * 应用程序配置类
 * 包含应用程序的各种配置参数和常量
 */
export class AppConfig {
    /** 支持的多语言列表 */
    static languages = ['en', 'ar', 'ru', 'hk', 'pt', 'fr', 'es', 'kr', 'de', 'jp']

    /**
     * 获取系统语言设置
     * 根据 Electron 的系统语言设置，映射到支持的语言范围
     * 若不在支持范围内，则默认为英语
     */
    static getSystemLanguage(): string {
        try {
            // 获取系统语言
            const systemLocale = app.getLocale().toLowerCase()
            
            // 语言映射表，将系统语言代码映射到应用支持的语言代码
            const languageMap: { [key: string]: string } = {
                'en': 'en',
                'en-us': 'en',
                'en-gb': 'en',
                'zh-tw': 'hk',
                'zh-hk': 'hk',
                'zh-mo': 'hk',
                'pt': 'pt',
                'pt-br': 'pt',
                'pt-pt': 'pt',
                'fr': 'fr',
                'fr-fr': 'fr',
                'fr-ca': 'fr',
                'es': 'es',
                'es-es': 'es',
                'es-mx': 'es',
                'ko': 'kr',
                'ko-kr': 'kr',
                'de': 'de',
                'de-de': 'de',
                'ja': 'jp',  // 特殊处理：系统的 ja 映射到应用的 jp
                'ja-jp': 'jp'
            }

            // 首先尝试完整匹配
            if (languageMap[systemLocale]) {
                return languageMap[systemLocale]
            }

            // 尝试匹配语言前缀（如 zh-cn -> zh）
            const languagePrefix = systemLocale.split('-')[0]
            if (languageMap[languagePrefix]) {
                return languageMap[languagePrefix]
            }

            // 如果都不匹配，返回默认英语
            return 'en'
        } catch (error) {
            AppUtil.error('AppConfig', 'getSystemLanguage', '获取系统语言失败，使用默认英语', error)
            return 'en'
        }
    }

    /** 是否使用BrowserView组件 */
    static UseBrowserView = true

    /** Chrome错误页面标识 */
    static ChromeErrorPage = 'chrome-error'

    /** 支持的缩放比例列表 */
    static listScale = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500]

    /** GPU是否正常工作 */
    static GpuNormal = true
    /** 是否启用Chromium日志 */
    static ChromiumLog = false
    /** 是否启用硬件加速 */
    static HardAccerlation = true
    /** 是否启用单例锁 */
    static SingleLock = true

    /** 应用程序密钥（正式环境） - NIM 功能已移除 */
    // static AppKey = '57813e0b271a2ca22f3f1ab69be9c9b5'

    /** 应用用户账户ID - NIM 功能已移除 */
    // static AppUserAccid = 'lceda_1652410475826 '
    /** 应用用户令牌 - NIM 功能已移除 */
    // static AppUserToken = '3b6c5b2a4b8b7211e90c2624201fc6ae'

    /** 测试管理员账户ID - NIM 功能已移除 */
    // static AppTestManagerAccid = 'lceda_1646191453043'

    /** 配置保存原因字典 */
    static dictReason = {}

    static DefaultConfig = {
        version: '1.0.0',
        platform: process.platform,
        'virtualMachine': false,
        'checkVirtualMachine': true,
        'alertClose': false,
        'alertEDA': false,
        'closeOther': false,
        'erpUrl': '',
        'readAutoRun': false,
        'hideToTask': process.platform === 'darwin' ? false : true,
        'autoStart': true,
        openOrderNotification: true,
        openMarketActivityNotification: true,
        openCoummunityMessageNotification: true,
        country: '26B47E32-C4A1-4830-8B96-958A30897EA2',
        countryList,
        language: 'en', // 默认英语
        languageList: languageList,
        rate: '36812d96-3345-471a-bb59-c0143dfa8836',
        rateList,
        username: '',
        customerCode: '',
        locales,
    }

    static getTabUrlLabel(strUrl: string) {
        let newStr = ''
        const quoteIndex = strUrl.indexOf('?')
        if (quoteIndex > -1) {
            newStr = strUrl.slice(0, quoteIndex)
        } else {
            newStr = strUrl
        }
        for (const lang of AppConfig.languages) {
            newStr = removeLangSegment(newStr, lang)
        }
        if (newStr.endsWith('/')) {
            newStr = newStr.slice(0, -1)
        }
        return newStr
    }

    static getLocale() {
        const lang = AppConfig.config.language || 'en'
        const localeMap = locales
        return localeMap[lang] || localeMap['en']
    }
    /** 浏览器预加载 JS */
    static BrowserPreLoadJSPath = path.join(__dirname, '../build/browserPreload.js')
    /** 窗口预加载 JS */
    static preloadJSPath = path.join(__dirname, '../build/preload.js')
    /** 网页预加载 JS */
    static viewPreloadJSPath = path.join(__dirname, '../build/viewPreload.js')
    /** 网页加载完 JS */
    static viewFinishLoadJSPath = fs.readFileSync(path.join(__dirname, '../build/viewFinishLoad.js')).toString('utf-8')
    /** 网页内嵌 iframe 加载 JS */
    static framePreloadJs = fs.readFileSync(path.join(__dirname, '../build/framePreload.js')).toString('utf-8')
    /** icon */
    static TrayIconPath = app.isPackaged
        ? path.join(
              __dirname,
              process.platform === 'darwin' ? '../../../res/jlcAssistantTray.png' : './assets/jlcAssistant512.png'
          )
        : path.join(
              __dirname,
              process.platform === 'darwin' ? '../assets/jlcAssistantTray.png' : '../assets/jlcAssistant512.png'
          )
    static NavIconPath = app.isPackaged
        ? path.join(
              __dirname,
              process.platform === 'darwin' ? '../../../assets/jlcAssistant512.png' : './assets/jlcAssistant512.png'
          )
        : path.join(
              __dirname,
              process.platform === 'darwin' ? '../assets/jlcAssistant512.png' : '../assets/jlcAssistant512.png'
          )

    static config: any
    static exeConfigPath =
        process.env.NODE_ENV === 'development'
            ? path.join(__dirname, '/res/config.json')
            : path.join(__dirname, '../../../res/config.json')

    static exeCrtPath =
        process.env.NODE_ENV === 'development'
            ? path.join(__dirname, '/res/jlc.crt')
            : path.join(__dirname, '../../../res/jlc.crt')

    // 不能使用config.json会和electron-store冲突
    static userConfigPath = path.join(app.getPath('userData'), '/userConfig.json')
    static regListPath = path.join(app.getPath('userData'), '/run.reg')

    static DBPath = path.join(app.getPath('userData'), '/assist.db')
    static erpLoginHtml = path.join(app.getPath('userData'), '/erpLogin.html')
    static EditorUrl = 'https://pro.lceda.cn/editor?cll=trace'
    static isEditorUrl(strUrl: string) {
        return AppConfig.getTabKeyFromCfg(strUrl) === ETabKey.EEDAPro
    }

    static isIndexUrl(strUrl: string) {
        return AppConfig.getTabKeyFromCfg(strUrl) === ETabKey.EErpIndex
    }

    // 路径从长到短进行匹配
    static listTabKey: string[][] = [
        ['http://my.jlcpcb.com:8500/user-center/orders', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://test.jlc.com/consumer/index.do', ETabKey.EErpIndex, EMatchType.EEqual],
        // 第3个为等匹配
        ['https://www.jlc.com/integrated/', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://test.jlc.com/integrated/', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://www.jlc.com/integrated', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://test.jlc.com/integrated', ETabKey.EErpIndex, EMatchType.EEqual],

        // 更换网址
        ['https://www.jlc.com/integratedweb/', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://test.jlc.com/integratedweb/', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://www.jlc.com/integratedweb', ETabKey.EErpIndex, EMatchType.EEqual],
        ['https://test.jlc.com/integratedweb', ETabKey.EErpIndex, EMatchType.EEqual],

        ['https://devpro.lceda.cn/editor', ETabKey.EEDAPro],
        ['https://pro.lceda.cn/editor', ETabKey.EEDAPro],

        ['https://www.jlcfa.com/G2', ETabKey.EFAIndex, EMatchType.EEqual],
        ['https://www.jlcfa.com/', ETabKey.EFAIndex, EMatchType.EEqual],
        ['https://www.jlcfa.com/', ETabKey.EFA],
        ['https://3dcart.jlc.com/fa', ETabKey.EFA],

        // 去掉规则
        // ['https://jlcsmt.com/order/order-settlement', ETabType.ESmtOrderSettlement],
        // ['https://jlcsmt.com/order/smt-order-lceda', ETabType.ESmtMatch],
        // ['https://jlcsmt.com/home', ETabType.ESmtHome],
        // ['https://jlcsmt.com', ETabType.ESmt],

        // ['https://test.jlcsmt.com/order/order-settlement', ETabType.ESmtOrderSettlement],
        // ['https://test.jlcsmt.com/order/smt-order-lceda', ETabType.ESmtMatch],
        // ['https://test.jlcsmt.com/home', ETabType.ESmtHome],
        // ['https://test.jlcsmt.com', ETabType.ESmt],
    ]
    static listIndexKeyWord = ['integrated', 'integratedweb']

    static insertUnionTab(strUrl: string, strTabType: string) {
        if (!strUrl || !strTabType) {
            AppUtil.error('AppConfig', 'insertUnionTab', `插入唯一tab失败${strUrl},${strTabType}`)
            return
        }
        AppUtil.info('AppConfig', 'insertUnionTab', `修改前配置个数` + AppConfig.listTabKey.length)
        let nFindIndex = -1
        for (let nIndex = 0; nIndex < AppConfig.listTabKey.length; nIndex++) {
            let listCfg = AppConfig.listTabKey[nIndex] as string[]
            if (strUrl.startsWith(listCfg[0])) {
                // 这个url匹配到，在这之前加入
                nFindIndex = nIndex
            }
        }
        // 放最后面
        if (nFindIndex <= 0) {
            AppConfig.listTabKey = AppConfig.listTabKey.concat([[strUrl, strTabType]])
        } else if (nFindIndex === AppConfig.listTabKey.length - 1) {
            AppConfig.listTabKey = AppConfig.listTabKey.concat([[strUrl, strTabType]])
        } else {
            let listNew = AppConfig.listTabKey
                .slice(0, nFindIndex)
                .concat([[strUrl, strTabType]])
                .concat(AppConfig.listTabKey.slice(nFindIndex))
            AppConfig.listTabKey = listNew
        }
        AppUtil.info('AppConfig', 'insertUnionTab', `修改后配置个数` + AppConfig.listTabKey.length)
        AppConfig.dictUnionTabKey[strTabType] = 1

        // console.log(AppConfig.listTabKey)
    }

    static insertIndexKey(strKey: string) {
        AppUtil.info('AppConfig', 'insertIndexKey', `修改前配置个数` + AppConfig.listIndexKeyWord.length)
        if (AppConfig.listIndexKeyWord.indexOf(strKey) < 0) {
            AppConfig.listIndexKeyWord.push(strKey)
        }
        AppUtil.info('AppConfig', 'insertIndexKey', `修改后配置个数` + AppConfig.listIndexKeyWord.length)
    }

    static listCloseBv = ['https://test.jlcsmt.com/lcsc/settlement', 'https://jlcsmt.com/lcsc/settlement']
    static dictUnionTabKey = {
        [ETabKey.EErpIndex]: 1,
        [ETabKey.ESmt]: 1,
        [ETabKey.ESmtHome]: 1,
        [ETabKey.EEDAPro]: 1,
        [ETabKey.EFAIndex]: 1,
    }

    static isTabKeyUnion(strKey: string | undefined) {
        return strKey in AppConfig.dictUnionTabKey
    }
    static hasIndexKey(strUrl: string | undefined): boolean {
        if (!strUrl) {
            return false
        }
        for (const strTest of this.listIndexKeyWord) {
            let reg = new RegExp(strTest)
            if (reg.test(strUrl)) {
                return true
            }
        }
        return false
    }

    static dictUnCloseTabKey = {
        [ETabKey.EErpIndex]: 1,
    }
    static isTabKeyUnClose(strKey: string | undefined) {
        return strKey in AppConfig.dictUnCloseTabKey
    }

    static getTabKeyFromCfg(strUrl: string | undefined): string {
        let strRaw = strUrl.split('?')[0]
        for (const listCheck of AppConfig.listTabKey) {
            if (listCheck[2] === EMatchType.EEqual) {
                // 是等匹配
                if (strRaw === listCheck[0]) {
                    return listCheck[1]
                }
            } else {
                // 正则匹配
                if (strRaw.startsWith(listCheck[0])) {
                    // 包含白名单
                    return listCheck[1]
                }
            }
        }
        return ECommon.ENone
    }

    // export const UAT_CONFIG = {
    //     loginUrl: `,
    // }
    // export const PRO_CONFIG = {
    //     loginUrl: `https://passport.jlc.com/login?service=https%3A%2F%2Fhelper.jlc.com%2Fcas%2FrealLogin.html%3Ff%3Djlc_helper%26ui%3Dpchelper`,
    // }
    // APP_KEY=7bdd86d5d214f6ac7533c2f461230a4b
    static Env = ECommon.EPro

    static DESKey = '__jDlog_'

    static isDev() {
        return (
            AppConfig.Env === ECommon.EINNER ||
            AppConfig.Env === ECommon.EUAT ||
            AppConfig.Env === ECommon.EDEV ||
            process.env.NODE_ENV === 'development'
        )
    }
    static isProcessDev() {
        return process.env.NODE_ENV === 'development'
    }

    static getEnvConfig() {
        if (AppConfig.Env === ECommon.EUAT) {
            return {
                client_id: 'f47ac10b58cc4372a5670e02b2c3d480',
                CAS_BASE_URL: 'https://testpassport.jlcpcb.com',
                PCB_BASE_URL: 'https://test.jlcpcb.com',
                ASSETS_URL: 'https://test-static.jlcpcb.com',
                IM_URL: 'https://test-im.jlcpcb.com',
            }
        } else if (AppConfig.Env === ECommon.ELOCAL) {
            return {
                client_id: 'f47ac10b58cc4372a5670e02b2c3d479',
                 CAS_BASE_URL: 'https://dev-passport.jlcpcb.com',
                PCB_BASE_URL: 'https://dev.jlcpcb.com', // pcb域名
                ASSETS_URL: 'https://dev-static.jlcpcb.com',
                IM_URL: 'https://dev-im.jlcpcb.com',
            }
        } else if (AppConfig.Env === ECommon.EDEV) {
            return {
                client_id: 'SFDSFSFDDSFS2',
                CAS_BASE_URL: 'https://dev-passport.jlcpcb.com',
                PCB_BASE_URL: 'https://dev.jlcpcb.com', // pcb域名
                ASSETS_URL: 'https://dev-static.jlcpcb.com',
                IM_URL: 'https://dev-im.jlcpcb.com',
            }
        } else if (AppConfig.Env === ECommon.EFAT) {
            return {
                client_id: 'f47ac10b58cc4372a5670e02b2c3d479',
                CAS_BASE_URL: 'https://fat-temp-passport.jlcpcb.com',
                PCB_BASE_URL: 'https://fat.jlcpcb.com',
                ASSETS_URL: 'https://fat-static.jlcpcb.com',
                IM_URL: 'https://fat-im.jlcpcb.com',
            }
        } else {
            return {
                client_id: 'f47ac10b58cc4372a5670e02b2c3d479',
                CAS_BASE_URL: 'https://passport.jlcpcb.com',
                PCB_BASE_URL: 'https://jlcpcb.com',
                ASSETS_URL: 'https://static.jlcpcb.com',
                IM_URL: 'https://im.jlcpcb.com',
            }
        }
    }

    static loginUrl = ''

    static getPrepareUrlWithTimeStamp(bWith = true) {
        const envConfig = AppConfig.getEnvConfig()
        const strUrl = `${envConfig.PCB_BASE_URL}/loading`
        if (bWith) {
            return AppUtil.addUrlTimestamp(strUrl)
        } else {
            return strUrl
        }
    }

    static getLoginUrlWithTimeStamp(bWith = true) {
        const envConfig = AppConfig.getEnvConfig()
        const loginUrl = AppConfig.loginUrl
        if (!loginUrl) {
            const url = encodeURIComponent(`${envConfig.PCB_BASE_URL}?platform=desktop`)
            AppConfig.loginUrl = `${envConfig.CAS_BASE_URL}/#/login?client_id=${envConfig.client_id}&redirect_url=${url}`
            // AppConfig.loginUrl = `${envConfig.PCB_BASE_URL}/user-center/jlcone-loading`
        }
        return AppUtil.addUrlTimestamp(AppConfig.loginUrl)
    }

    static saveConfig(strReason: string) {
        if (strReason in this.dictReason) {
            return
        }
        AppConfig.dictReason[strReason] = 1
    }
    static onTimeSave() {
        // 保存配置文件
        if (!AppConfig.config) {
            AppUtil.error('AppConfig', 'saveConfig', '没有配置内容')
            return
        }
        let strData = JSON.stringify(AppConfig.config)
        let strReason = JSON.stringify(AppConfig.dictReason)
        // AppUtil.info('AppConfig', '保存配置', strReason, strData)

        try {
            fs.writeFileSync(AppConfig.userConfigPath, strData, 'utf-8')
        } catch (error) {
            if (error) {
                AppUtil.error('AppConfig', 'saveConfig', '保存配置失败', error)
            } else {
                AppUtil.info('AppConfig', 'saveConfig', '保存配置成功:' + strReason)
            }
        }

        AppConfig.dictReason = {}
    }
    static getWebViewScale(strWndType: string) {
        if (strWndType === ECommon.ENone) {
            return 100
        }
        if (!AppConfig.config) {
            // this.resetUserConfig('没有配置')
            return 100
        }
        if (!AppConfig.config['scale']) {
            // this.resetUserConfig('没有窗体配置')
            return 100
        }
        if (!(strWndType in AppConfig.config['scale'])) {
            // this.resetUserConfig(strWndType + '页面不在窗体设置中')
            return 100
        }
        return AppConfig.config['scale'][strWndType]
    }
    static getCurrentWebViewScale() {
        let strCurrentWnd = AppUtil.getCurrentShowWnd()
        if (!strCurrentWnd) {
            return 100
        }
        return this.getWebViewScale(strCurrentWnd)
    }
    static setCurrentWebViewScale(nScale: number) {
        let strCurrentWnd = AppUtil.getCurrentShowWnd()
        if (!strCurrentWnd) {
            AppUtil.error('AppConfig', 'setScale', '没有当前窗体')
            return
        }
        if (!AppConfig.config) {
            AppUtil.error('AppConfig', 'setScale', '没有配置')
            // this.resetUserConfig('没有配置')
            return
        }
        if (!AppConfig.config['scale']) {
            AppUtil.error('AppConfig', 'setScale', '没有窗体配置')
            // this.resetUserConfig('没有窗体配置')
            return
        }
        AppConfig.config['scale'][strCurrentWnd] = nScale
        this.saveConfig(`保存窗体缩放：${strCurrentWnd} => ${nScale}`)
    }
    static resetUserConfig(strReason: string) {
        console.log('🔄 resetUserConfig 被调用:', strReason)
        console.log('📊 调用栈:', new Error().stack)
        console.log('📊 重置前的配置状态:', {
            hasUpdateInfo: !!AppConfig.config?.updateInfo,
            updateInfo: AppConfig.config?.updateInfo,
            version: AppConfig.config?.version,
            currentLanguage: AppConfig.config?.language
        })
        
        // 保存重要的动态配置
        const preservedConfig = {
            updateInfo: AppConfig.config?.updateInfo,
            userLanguage: AppConfig.config?.userLanguage, // 保留用户修改的语言
            // 可以添加其他需要保留的配置
        }
        
        const envConfig = AppConfig.getEnvConfig()
        AppUtil.warn('AppConfig', 'resetConfig', `恢复默认配置:${strReason}`)
        // 设置默认语言为英语
        AppConfig.DefaultConfig.language = 'en' // 默认英语
        // 语言列表不包含"跟随系统"选项
        AppConfig.DefaultConfig.languageList = languageList
        // 根据系统语言设置ERP URL
        AppConfig.DefaultConfig.erpUrl = AppConfig.getIndexUrl()
        AppConfig.config = JSON.parse(JSON.stringify(AppConfig.DefaultConfig))
        
        // 恢复重要的动态配置
        if (preservedConfig.updateInfo) {
            console.log('🔄 恢复 updateInfo:', preservedConfig.updateInfo)
            AppConfig.config.updateInfo = preservedConfig.updateInfo
        }
        
        if (preservedConfig.userLanguage) {
            console.log('🔄 恢复 userLanguage:', preservedConfig.userLanguage)
            AppConfig.config.userLanguage = preservedConfig.userLanguage
            
            // 如果有用户修改的语言，使用它而不是默认语言
            const effectiveLanguage = this.getEffectiveLanguage()
            AppConfig.config.language = effectiveLanguage
            console.log('🔄 根据用户修改的语言重新设置有效语言:', effectiveLanguage)
        }
        
        console.log('resetUserConfig: 重置后的配置', {
            language: AppConfig.config.language,
            getCurrentLanguage: AppConfig.getCurrentLanguage(),
            hasUpdateInfo: !!AppConfig.config.updateInfo,
            updateInfo: AppConfig.config.updateInfo
        })
        this.saveConfig('重置配置')
        this.refreshAutoStart()

        // 重置代理
        session.defaultSession.setProxy({})
        session.defaultSession.forceReloadProxyConfig()

        this.setConfigVersion(ASSIT_VERSION)
    }
    static getUserConfig(strConfig: string): unknown {
        if (!AppConfig.config) {
            return undefined
        }
        return AppConfig.config[strConfig]
    }
    /**
     * 获取有效的语言配置
     * 优先级：用户修改的语言 > 系统语言 > 英语
     */
    static getEffectiveLanguage(): string {
        // 1. 用户修改的语言优先
        const userLanguage = this.config.userLanguage
        if (userLanguage && this.languages.includes(userLanguage)) {
            return userLanguage
        }
        
        // 2. 系统语言
        const systemLanguage = this.getSystemLanguage()
        if (this.languages.includes(systemLanguage)) {
            return systemLanguage
        }
        
        // 3. 默认英语
        return 'en'
    }
    

    
    static setUserConfigWithObject(dictConfig: { [key: string]: unknown }, bSave: boolean = true) {
        console.log('🔧 setUserConfigWithObject 调用:', {
            dictConfig,
            bSave,
            hasConfig: !!AppConfig.config,
            currentLanguage: AppConfig.config?.language
        })
        
        if (!AppConfig.config) {
            this.resetUserConfig(`保存用户配置时重置:${JSON.stringify(dictConfig)}`)
        }
        
        // 创建配置副本用于处理
        const processedConfig = { ...dictConfig }
        
        // 简化的语言配置保护
        if ('language' in processedConfig) {
            const newLanguage = processedConfig.language as string
            const isFromSettingWindow = processedConfig.__source === 'setting-window'
            const isSystemInit = processedConfig.__source === 'system-init'
            
            if (isFromSettingWindow) {
                // 设置窗口修改：保存为用户语言
                console.log('✅ 设置窗口语言更新:', newLanguage)
                AppConfig.config.userLanguage = newLanguage
                this.saveConfig('用户在设置窗口修改语言')
                delete processedConfig.language // 不更新 language 字段
            } else if (isSystemInit) {
                // 系统初始化：允许设置 language
                console.log('✅ 系统初始化语言:', newLanguage)
            } else {
                // 其他来源：拦截
                console.log('🔒 拦截非授权语言修改:', newLanguage, '来源:', processedConfig.__source || '未知')
                delete processedConfig.language
            }
        }
        
        // 移除内部标记
        if (processedConfig.__source) {
            delete processedConfig.__source
        }
        
        // 应用配置更新
        for (const strConfig in processedConfig) {
            if (Object.prototype.hasOwnProperty.call(processedConfig, strConfig)) {
                console.log(`📝 更新配置: ${strConfig} = ${processedConfig[strConfig]}`)
                AppConfig.config[strConfig] = processedConfig[strConfig]
            }
        }
        
        console.log('📊 配置更新后:', {
            language: AppConfig.config.language,
            updatedKeys: Object.keys(processedConfig)
        })
        
        AppConfig.onTimeSave()
        if (bSave) {
            this.saveConfig(`保存用户配置:${JSON.stringify(processedConfig)}`)
        }
    }
    static setUserConfig(strConfig: string, strValue: unknown, bSave: boolean = true) {
        if (!AppConfig.config) {
            console.log(`⚠️  AppConfig.config 为空，需要重置配置: ${strConfig} = ${strValue}`)
            this.resetUserConfig(`保存用户配置时重置:${strConfig}, ${strValue}`)
        }
        
        console.log(`📝 设置配置: ${strConfig} = ${JSON.stringify(strValue)}`)
        AppConfig.config[strConfig] = strValue
        AppConfig.onTimeSave()
        if (bSave) {
            this.saveConfig(`保存用户配置:${strConfig}, ${strValue}`)
        }
    }

    static hasReadAutoRun() {
        let bReadAutoRun = AppConfig.getUserConfig('readAutoRun')
        if (bReadAutoRun === undefined) {
            AppUtil.warn('AppConfig', 'hasReadAutoRun', '添加默认配置')
            AppConfig.setUserConfig('autoRun', false)
        }
        return bReadAutoRun
    }

    static setReadAutoRun(bReadAutoRun) {
        AppConfig.setUserConfig('readAutoRun', bReadAutoRun)
    }

    static isHideToTask() {
        let bHideToTask = AppConfig.getUserConfig('hideToTask')

        if (bHideToTask === undefined) {
            AppUtil.warn('AppConfig', 'isHideToTask', '添加默认配置')
            AppConfig.setUserConfig('hideToTask', true)
        }
        return AppConfig.getUserConfig('hideToTask')
    }

    static setHideToTask(bHideToTask: boolean) {
        AppConfig.setUserConfig('hideToTask', bHideToTask)
    }

    static isAutoStart(): boolean {
        let bAutoStart = AppConfig.getUserConfig('autoStart')
        if (bAutoStart === undefined) {
            AppUtil.warn('AppConfig', 'autoStart', '添加默认配置')
            AppConfig.setUserConfig('autoStart', true)
        }
        return AppConfig.getUserConfig('autoStart') as boolean
    }
    static setAutoStart(bAutoStart: boolean) {
        AppConfig.setUserConfig('autoStart', bAutoStart)
        AppConfig.refreshAutoStart()
    }
    static setProxy(dictProxy: { [key: string]: unknown }) {
        AppConfig.setUserConfig('proxyRules', dictProxy)
    }
    static getProxy() {
        let strProxyRules = AppConfig.getUserConfig('proxyRules')
        if (strProxyRules === undefined) {
            AppUtil.warn('AppConfig', 'proxyRules', '添加默认配置')
            AppConfig.setUserConfig('proxyRules', {})
        }
        return AppConfig.getUserConfig('proxyRules') as { [key: string]: unknown }
    }
    static readAutoStartFromRegdit() {
        if (AppConfig.hasReadAutoRun()) {
            // 已经读取，不提示
            return
        }
        // 设置已经读取
        AppConfig.setReadAutoRun(true)
        // 读取注册表是否启动
        let bReadRegAutoStart = false
        // 先使用electron检查
        let strExe = process.execPath
        // if (process.platform === 'win32') {
        //     try {
        //         execSync(
        //             `regedit /e ${AppConfig.regListPath} HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`
        //         )
        //         let strData = fs.readFileSync(AppConfig.regListPath, 'utf16le')
        //         AppUtil.info('AppConfig', 'readAutoStartFromRegdit', '读取配置表信息：' + strData)
        //         let listData = strData.split('\r\n')

        //         for (const strLine of listData) {
        //             if (/JLCONE/.test(strLine)) {
        //                 bReadRegAutoStart = true
        //                 AppUtil.info('AppConfig', '读取系统导出注册表', '开机自动启动：' + bReadRegAutoStart)
        //                 break
        //             }
        //         }
        //     } catch (error) {}
        // }
        let dictData = app.getLoginItemSettings({
            path: strExe,
        })
        if (dictData) {
            let listLaunchItems = dictData.launchItems
            if (listLaunchItems && listLaunchItems.length > 0) {
                for (const dictItem of listLaunchItems) {
                    if (/JLCONE/i.test(dictItem['path']) && dictItem['enabled'] === true) {
                        bReadRegAutoStart = true
                    }
                }
            }
        }

        AppUtil.info('AppConfig', '读取注册表', '开机自动启动：' + bReadRegAutoStart)
        AppUtil.info('AppConfig', '设置', '设置开机自动启动：' + (bReadRegAutoStart || AppConfig.isAutoStart()))

        // 注册表
        if (bReadRegAutoStart || AppConfig.isAutoStart()) {
            // 注册表为启动
            this.setAutoStart(true)
        } else {
            this.setAutoStart(false)
        }
        this.refreshAutoStart()
    }
    static refreshAutoStart() {
        // 刷新自动启动，以配置文件为准
        let bAutoStart = AppConfig.isAutoStart()
        let strExe = process.execPath
        // electron 设置
        app.setLoginItemSettings({
            openAtLogin: bAutoStart,
            openAsHidden: false,
            name: 'JLCPcAssit',
            path: strExe,
        })
        if (process.platform === 'win32') {
            // windows
            if (bAutoStart) {
                exec(
                    `REG ADD "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v JLCPcAssit /t REG_SZ /d "${strExe}" /f`,
                    err => {
                        // AppUtil.info('AppConfig', 'refreshAutoStart', 'add HKEY_CURRENT_USER fail', err)
                    }
                )

                exec(
                    `REG ADD "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v JLCPcAssit /t REG_SZ /d "${strExe}" /f`,
                    err => {
                        // AppUtil.info('AppConfig', 'refreshAutoStart', 'add HKEY_LOCAL_MACHINE fail', err)
                    }
                )
                exec(
                    `REG ADD "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run" /v JLCPcAssit /t REG_SZ /d "${strExe}" /f`,
                    err => {
                        // AppUtil.info('AppConfig', 'refreshAutoStart', 'add HKEY_LOCAL_MACHINE\\WOW6432Node fail', err)
                    }
                )
            } else {
                exec('REG DELETE "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v JLCPcAssit  /f', err => {
                    // AppUtil.info('AppConfig', 'refreshAutoStart', 'delete HKEY_CURRENT_USER fail', err)
                })
                exec(`REG DELETE "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v JLCPcAssit  /f`, err => {
                    // AppUtil.info('AppConfig', 'refreshAutoStart', 'delete HKEY_LOCAL_MACHINE fail', err)
                })
                exec(
                    'REG DELETE "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run" /v JLCPcAssit /f',
                    err => {
                        // AppUtil.info('AppConfig', 'refreshAutoStart', 'delete HKEY_LOCAL_MACHINE\\WOW6432Node fail', err)
                    }
                )
            }
        }
    }

    static isAlertClose() {
        let bAlertClose = AppConfig.getUserConfig('alertClose')
        if (bAlertClose === undefined) {
            AppUtil.warn('AppConfig', 'isAlertClose', '添加默认配置alertClose')
            AppConfig.setUserConfig('alertClose', true)
        }
        return AppConfig.getUserConfig('alertClose')
    }
    static setAlertClose(bAlertClose: boolean) {
        AppConfig.setUserConfig('alertClose', bAlertClose)
    }

    static isAlertEDA() {
        let bAlertEDA = AppConfig.getUserConfig('alertEDA')
        if (bAlertEDA === undefined) {
            AppUtil.warn('AppConfig', 'isAlertEDA', '添加默认配置alertEDA')
            AppConfig.setUserConfig('alertEDA', true)
        }
        return AppConfig.getUserConfig('alertEDA')
    }
    static setAlertEDA(bAlertEDA: boolean) {
        AppConfig.setUserConfig('alertEDA', bAlertEDA)
    }

    static isCloseCur(): boolean {
        let bHideToTask = AppConfig.getUserConfig('closeOther')

        if (bHideToTask === undefined) {
            AppUtil.warn('AppConfig', 'isHideToTask', '添加默认配置closeOther')
            AppConfig.setUserConfig('isCloseOther', true)
        }
        return AppConfig.getUserConfig('closeOther') as boolean
    }
    static setCloseCur(bCloseOther: boolean) {
        AppConfig.setUserConfig('closeOther', bCloseOther)
    }

    static isCheckVirtualMachine() {
        let bCheckVM = AppConfig.getUserConfig('checkVirtualMachine')
        if (bCheckVM === undefined) {
            AppUtil.warn('AppConfig', 'isCheckVirtualMachine', '添加默认配置checkVirtualMachine')
            AppConfig.setUserConfig('checkVirtualMachine', false)
        }
        return AppConfig.getUserConfig('checkVirtualMachine')
    }

    static setCheckVirtualMachine(bCheckVM: boolean) {
        AppConfig.setUserConfig('checkVirtualMachine', bCheckVM)
    }

    static isVirtualMachine() {
        // if (!AppConfig.isCheckVirtualMachine()) {
        //     // 检测

        //     try {
        //         let strResult = execSync('systeminfo', { encoding: 'utf-8' })
        //         AppConfig.setCheckVirtualMachine(true)
        //         const listSentense = strResult.split('\\r\\n').filter(line => !!line.trim())
        //         for (const strData of listSentense) {
        //             if (/Hyper-V/.test(strData)) {
        //                 AppConfig.setVirtualMachine(false)
        //                 AppUtil.error('Apputil', 'exec isVirtualMachine', '不是虚拟机')
        //             }
        //         }
        //     } catch (error) {
        //         AppConfig.setCheckVirtualMachine(true)
        //         AppConfig.setVirtualMachine(true)
        //         AppUtil.error('Apputil', 'exec isVirtualMachine', '检查是否是虚拟机失败', error)
        //     }
        // }
        return AppConfig.isCfgVirtualMachine()
    }
    private static isCfgVirtualMachine() {
        let bCheckVM = AppConfig.getUserConfig('virtualMachine')
        if (bCheckVM === undefined) {
            AppUtil.warn('AppConfig', 'isVirtualMachine', '添加默认配置isVirtualMachine')
            AppConfig.setUserConfig('virtualMachine', true)
        }
        return AppConfig.getUserConfig('virtualMachine')
    }

    static setVirtualMachine(bVM: boolean) {
        AppConfig.setUserConfig('virtualMachine', bVM)
    }

    static setDownloadsPath(strPath: string) {
        AppConfig.setUserConfig('downloadsPath', strPath)
    }

    static getDownloadsPath() {
        let strPath = AppConfig.getUserConfig('downloadsPath')
        if (strPath === undefined) {
            AppUtil.warn('AppConfig', 'downloadsPath', '添加默认配置downloadsPath')
            AppConfig.setUserConfig('downloadsPath', app.getPath('downloads'))
        }
        return AppConfig.getUserConfig('downloadsPath') as string
    }

    /**
     * 获取当前有效语言
     * 新的优先级：用户修改的语言 > 系统语言 > 英语
     */
    static getCurrentLanguage(): string {
        return this.getEffectiveLanguage()
    }

    static getIndexUrl(language?: string) {
        // 语言优先级：参数 > 当前有效语言
        const currentLanguage = language || AppConfig.getCurrentLanguage()
        return ErpUrls.getUrl(AppConfig.Env, currentLanguage)
    }

    static getConfigVersion(): string | undefined {
        let strSaveVersion = AppConfig.getUserConfig('save_version') as string
        return strSaveVersion
    }
    static setConfigVersion(strVerion: string) {
        AppConfig.setUserConfig('save_version', strVerion)
    }

    static checkVersion() {
        let strFileVersion = AppConfig.getConfigVersion()
        let nFileVersionNum = AppUtil.getVersionNum(strFileVersion)
        let nAppVersionNum = AppUtil.getVersionNum(ASSIT_VERSION)

        if (nFileVersionNum >= nAppVersionNum) {
            // 当前文件版本号超过应用版本号
            return
        }
        // 5.0.79处理
        if (nFileVersionNum < AppUtil.getVersionNum('5.0.79')) {
            // 设置为同时打开
            AppConfig.setCloseCur(false)
            // 设置为不提醒
            AppConfig.setAlertEDA(false)
            AppConfig.setConfigVersion('5.0.79')
            nFileVersionNum = AppUtil.getVersionNum('5.0.79')
        }
        // 当前最新版本
        AppConfig.setConfigVersion(ASSIT_VERSION)
    }
}
