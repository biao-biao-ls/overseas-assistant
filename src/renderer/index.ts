/**
 * 渲染进程模块统一导出
 */

// Tab IPC 通信相关
export { TabIPCClient } from './TabIPCClient'
export { WindowOpenInterceptor } from './WindowOpenInterceptor'
export { ExternalLinkHandler, LinkSecurityLevel } from './ExternalLinkHandler'
export type { 
    TabStateUpdateCallback, 
    TabLoadingUpdateCallback, 
    TabTitleUpdateCallback, 
    TabOrderUpdateCallback 
} from './TabIPCClient'
export type { LinkAnalysisResult } from './ExternalLinkHandler'

// Tab 渲染组件相关
export { default as TabRenderer } from './components/TabRenderer'
export { TabRendererImpl } from './components/TabRendererImpl'
export { TabInteractionHandler, TabInteractionEvent } from './components/TabInteractionHandler'
export type { TabInteractionEventData, TabInteractionListener } from './components/TabInteractionHandler'
export { TabDragHandler, TabDragEvent } from './components/TabDragHandler'
export type { TabDragEventData, TabDragListener } from './components/TabDragHandler'