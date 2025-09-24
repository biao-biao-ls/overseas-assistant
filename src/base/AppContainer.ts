import { AppBase } from './AppBase'

/**
 * 应用程序容器类
 * 使用单例模式管理应用程序实例，提供全局访问点
 */
export default class AppContainer {
    /** 单例实例 */
    private static m_InstanceObj: AppContainer
    /** 应用程序实例 */
    private m_App!: AppBase

    /**
     * 私有构造函数，防止外部直接实例化
     */
    constructor() {}

    /**
     * 获取容器单例实例
     * @returns AppContainer实例
     */
    public static getInstance(): AppContainer {
        if (this.m_InstanceObj === undefined) {
            this.m_InstanceObj = new AppContainer()
        }
        return this.m_InstanceObj
    }

    /**
     * 获取应用程序实例
     * @returns 当前的应用程序实例
     */
    public static getApp(): AppBase {
        return AppContainer.getInstance().m_App
    }
    
    /**
     * 设置应用程序实例
     * @param app 要设置的应用程序实例
     */
    public static setApp(app: AppBase) {
        AppContainer.getInstance().m_App = app
    }
}
