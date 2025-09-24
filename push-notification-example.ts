/**
 * 推送消息新标签页功能使用示例
 * 
 * 这个文件展示了如何创建和处理带有链接的推送消息
 */

import { NIMMsg } from './src/mgr/NIMMgr'
import { AppUtil } from './src/utils/AppUtil'
import { EWnd } from './src/enum/EWnd'
import { MainWindow } from './src/main/window/MainWindow'

/**
 * 创建一个带有链接的推送消息示例
 */
function createPushNotificationExample() {
    // 模拟推送消息数据
    const mockPushData = {
        time: Date.now(),
        title: '新功能发布通知',
        content: '点击查看最新功能详情',
        url: 'https://jlcpcb.com/features/new-release',
        html: undefined // 纯文本消息
    }

    // 创建 NIMMsg 实例（实际使用中会通过 fromRawMsg 方法创建）
    // 这里仅作为示例展示数据结构
    console.log('推送消息数据结构示例:', mockPushData)
}

/**
 * 模拟点击推送消息的处理流程
 */
function simulateClickPushNotification() {
    const exampleUrl = 'https://jlcpcb.com/user-center/orders'
    
    AppUtil.info('PushNotificationExample', 'simulateClick', `模拟点击推送消息: ${exampleUrl}`)
    
    // 获取主窗口
    const mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
    if (!mainWindow) {
        AppUtil.error('PushNotificationExample', 'simulateClick', '主窗口不存在')
        return
    }

    // 显示主窗口并置顶
    mainWindow.showPanel(true)
    mainWindow.getBrowserWindow().moveTop()
    
    // 使用TabManager创建新标签页
    const tabManager = mainWindow.getTabManager()
    if (tabManager) {
        AppUtil.info('PushNotificationExample', 'simulateClick', '使用TabManager创建新标签页')
        
        tabManager.createTab(exampleUrl, {
            fromWindowOpen: false,
            position: 'last',
            labels: { 
                source: 'push-notification',
                messageId: 'example-msg-' + Date.now(),
                title: '推送消息示例',
                originalUrl: exampleUrl
            }
        })
    } else {
        AppUtil.warn('PushNotificationExample', 'simulateClick', 'TabManager不可用，使用回退方法')
        mainWindow.handleCreateNewTab(exampleUrl, true)
    }
}

/**
 * 验证推送消息功能是否正常工作
 */
function validatePushNotificationFeature() {
    const mainWindow = AppUtil.getExistWnd(EWnd.EMain) as MainWindow
    
    if (!mainWindow) {
        console.error('❌ 主窗口不存在，无法验证推送消息功能')
        return false
    }
    
    const tabManager = mainWindow.getTabManager()
    if (!tabManager) {
        console.warn('⚠️ TabManager不可用，将使用回退方法')
        return true // 仍然可以工作，只是使用回退方法
    }
    
    console.log('✅ 推送消息功能验证通过')
    return true
}

// 导出示例函数
export {
    createPushNotificationExample,
    simulateClickPushNotification,
    validatePushNotificationFeature
}

/**
 * 使用说明：
 * 
 * 1. 当收到推送消息时，消息数据会包含以下字段：
 *    - title: 消息标题
 *    - content: 消息内容
 *    - url: 跳转链接（可选）
 *    - html: HTML内容（可选）
 * 
 * 2. 用户点击推送消息后，会触发以下流程：
 *    - 调用 NIMMsg.onClickUrl() 方法
 *    - 显示并置顶主窗口
 *    - 使用 TabManager 创建新标签页
 *    - 加载推送消息中的链接
 * 
 * 3. 新创建的标签页会包含以下标识：
 *    - source: 'push-notification' - 标识来源
 *    - messageId: 消息唯一ID
 *    - title: 消息标题
 *    - originalUrl: 原始链接
 * 
 * 4. 如果 TabManager 不可用，系统会自动回退到 handleCreateNewTab 方法
 */