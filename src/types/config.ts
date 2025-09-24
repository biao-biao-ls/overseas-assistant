/**
 * 配置管理相关的类型定义
 * 提供类型安全的配置数据结构和操作接口
 */

// 国家选项接口
export interface CountryOption {
  code: string
  countryName: string
  icon: string
  uuid: string
  hasCheckAddress: any
}

// 语言选项接口
export interface LanguageOption {
  code: string
  name: string
}

// 汇率选项接口
export interface RateOption {
  uuid: string
  afterCountryCode: string
  name?: string
}

// 用户配置接口
export interface UserConfig {
  // 用户信息
  username: string
  customerCode: string
  
  // 地区和语言设置
  country: string
  countryList: CountryOption[]
  language: string
  languageList: LanguageOption[]
  rate: string
  rateList: RateOption[]
  
  // 应用行为配置
  hideToTask: boolean
  autoStart: boolean
  
  // 通知设置
  openOrderNotification: boolean
  openMarketActivityNotification: boolean
  openCoummunityMessageNotification: boolean
  
  // 代理设置
  proxyRules?: string
  
  // 其他配置项（保持向后兼容）
  platform?: string
  virtualMachine?: boolean
  checkVirtualMachine?: boolean
  alertClose?: boolean
  alertEDA?: boolean
  closeOther?: boolean
  erpUrl?: string
  readAutoRun?: boolean
  locales?: Record<string, any>
  scale?: Record<string, number>
  downloadsPath?: string
  save_version?: string
  
  // 兼容性字段（用于配置迁移）
  _version?: string
  _timestamp?: number
  lang?: string
}

// 配置操作结果接口
export interface ConfigOperationResult<T = Partial<UserConfig>> {
  success: boolean
  message?: string
  data?: T
  errors?: string[]
}

// 配置验证结果接口
export interface ConfigValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// 配置状态接口
export interface ConfigState {
  config: UserConfig | null
  loading: boolean
  error: string | null
  lastUpdated?: number
}

// 配置更新来源枚举
export enum ConfigUpdateSource {
  SETTING_WINDOW = 'setting-window',
  WEB_TAB = 'web-tab',
  SYSTEM = 'system'
}

// 配置更新队列项接口
export interface ConfigUpdateQueueItem {
  id: string
  config: Partial<UserConfig>
  source: ConfigUpdateSource
  sourceTabId?: string
  timestamp: number
  priority: number
}

// Tab加载状态枚举
export enum TabLoadingState {
  LOADING = 'loading',
  READY = 'ready',
  ERROR = 'error',
  TIMEOUT = 'timeout'
}

// Tab信息接口
export interface TabInfo {
  id: string
  url: string
  title: string
  isActive: boolean
  browserViewId: string
  needsConfigSync: boolean
  loadingState: TabLoadingState
  lastConfigSync: number
  configSyncRetries: number
}

// 配置API接口
export interface ConfigAPI {
  // 获取用户配置
  getUserConfig(): Promise<ConfigOperationResult>
  
  // 保存用户配置
  setUserConfig(config: Partial<UserConfig>): Promise<ConfigOperationResult>
  
  // 重置配置
  resetConfig(): Promise<ConfigOperationResult>
  
  // 获取代理配置
  getProxyConfig(): Promise<ConfigOperationResult>
  
  // 设置代理配置
  setProxyConfig(proxyRules: string): Promise<ConfigOperationResult>
}

// 配置同步管理器接口
export interface ConfigSyncManager {
  // 注册配置变更监听器
  registerConfigListener(callback: (config: Partial<UserConfig>) => void): void
  
  // 注销配置变更监听器
  unregisterConfigListener(callback: Function): void
  
  // 同步配置到所有窗口
  syncConfigToAllWindows(config: Partial<UserConfig>): Promise<void>
  
  // 同步配置到所有Tab
  syncConfigToAllTabs(config: Partial<UserConfig>): Promise<void>
  
  // 处理来自嵌入网页的配置变更
  handleWebConfigChange(config: Partial<UserConfig>, sourceTabId?: string): Promise<ConfigOperationResult>
  
  // 处理来自设置窗口的配置变更
  handleSettingConfigChange(config: Partial<UserConfig>): Promise<ConfigOperationResult>
  
  // 获取所有活跃的Tab信息
  getActiveTabs(): TabInfo[]
  
  // 检查Tab是否包含需要同步的网页
  isTabSyncRequired(tabId: string): boolean
  
  // 等待Tab网页加载完成
  waitForTabReady(tabId: string, timeout?: number): Promise<boolean>
  
  // 处理并发配置更新
  queueConfigUpdate(config: Partial<UserConfig>, source: ConfigUpdateSource): Promise<ConfigOperationResult>
}

// 配置同步状态管理器接口
export interface ConfigSyncStateManager {
  // 设置Tab加载状态
  setTabLoadingState(tabId: string, state: TabLoadingState): void
  
  // 获取Tab加载状态
  getTabLoadingState(tabId: string): TabLoadingState
  
  // 检查Tab是否准备好接收配置
  isTabReadyForConfig(tabId: string): boolean
  
  // 添加待同步的配置
  addPendingConfigSync(tabId: string, config: Partial<UserConfig>): void
  
  // 获取待同步的配置
  getPendingConfigSync(tabId: string): Partial<UserConfig> | null
  
  // 清除待同步的配置
  clearPendingConfigSync(tabId: string): void
}

// 网页配置同步接口
export interface WebConfigSync {
  // 检查是否在Electron环境中
  checkElectronEnvironment(): boolean
  
  // 同步配置到Electron
  syncToElectron(config: Partial<UserConfig>): void
  
  // 监听来自Electron的配置变更
  listenElectronConfigChange(callback: (config: Partial<UserConfig>) => void): void
}