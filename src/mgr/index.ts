/**
 * 管理器模块统一导出
 */

// Tab 管理相关
export { TabManager } from './TabManager'
export { TabConfigFactory } from './TabConfigFactory'
export { TabEventManager } from './TabEventManager'
export { TabIPCHandler } from './TabIPCHandler'
export { TabBrowserViewManager } from './TabBrowserViewManager'
export type { TabEventData, TabEventListener, EventStats } from './TabEventManager'

// 现有管理器（按需导出）
export { BvMgr } from './BvMgr'
export { BvViewMgr } from './BvViewMgr'
export { BvWindowMgr } from './BvWindowMgr'
export { default as WndMgr } from './WndMgr'