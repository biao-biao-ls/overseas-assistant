# 推送消息新标签页功能测试

## 功能描述
当收到推送消息并点击时，应该在主窗口中打开一个新的标签页加载网页，而不是使用外部浏览器或其他方式。

## 实现方案
1. 修改了 `NIMMsg.onClickUrl()` 方法，使其优先使用 TabManager 创建新标签页
2. 为推送消息添加了特殊的标签标识，包括：
   - `source: 'push-notification'` - 标识来源为推送消息
   - `messageId: this.getUUID()` - 消息的唯一标识
   - `title: this.getTitle() || '推送消息'` - 消息标题
   - `originalUrl: this.m_strUrl` - 原始URL

## 修改的文件
1. `src/mgr/NIMMgr.ts` - 修改了 NIMMsg 类的 onClickUrl 方法
2. `src/main/window/MessageAlertWindow.ts` - 更新了消息弹窗的点击处理逻辑
3. `src/main/window/MessageMgrWindow.ts` - 更新了消息管理器的点击处理逻辑

## 测试步骤
1. 启动应用程序
2. 确保主窗口已打开
3. 触发一个带有链接的推送消息
4. 点击推送消息
5. 验证是否在主窗口中创建了新的标签页
6. 验证新标签页是否正确加载了推送消息中的链接

## 预期结果
- 点击推送消息后，主窗口应该显示并置顶
- 在主窗口中应该创建一个新的标签页
- 新标签页应该加载推送消息中的链接
- 标签页应该有正确的标题和标识

## 回退机制
如果 TabManager 不可用，系统会自动回退到原有的 `handleCreateNewTab` 方法，确保功能的兼容性。