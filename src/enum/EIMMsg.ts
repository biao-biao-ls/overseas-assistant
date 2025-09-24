import { ECommon } from './ECommon'

export class EMsgMgrType {
    static EAll = '全部消息'
    static EUnread = '未读消息'
    static listTab = [EMsgMgrType.EAll, EMsgMgrType.EUnread]
}

export class EBusinessMsgType {
    //审单确认通知
    static EOrderConfirm = 'orderConfirm'
    // 钢网 PDF 确认
    static ESteelPdfCoinfirm = 'steelPdfConfirm'
    // 确认生成稿？
    static EPdfConfirm = 'pdfConfirm'
    // 助手公告
    static ESystemInfo = 'systemInfo'
    // 发货通知
    static EExpressInfo = 'expressInfo'
    // QC 缺数
    static EQcInfo = 'qcInfo'
    // 确认生成稿？
    static EFileConfirm = 'fileConfirm'
    // 自动扣款
    static EAutoPay = 'autoPay'

    static dictTypeName = {
        [EBusinessMsgType.EOrderConfirm]: '审单确认通知',
        [EBusinessMsgType.ESteelPdfCoinfirm]: '钢网PDF确认',
        [EBusinessMsgType.EPdfConfirm]: '确认生成稿',
        [EBusinessMsgType.ESystemInfo]: '助手公告',
        [EBusinessMsgType.EExpressInfo]: '发货通知',
        [EBusinessMsgType.EFileConfirm]: 'QC缺数',
        [EBusinessMsgType.EAutoPay]: '自动扣款',
    }
    static dictTypeContentElement = {
        [EBusinessMsgType.EOrderConfirm]: 'audit_result',
        [EBusinessMsgType.ESteelPdfCoinfirm]: 'audit_result',
        [EBusinessMsgType.EPdfConfirm]: 'audit_result',
        [EBusinessMsgType.ESystemInfo]: 'title',
        [EBusinessMsgType.EExpressInfo]: 'title',
        [EBusinessMsgType.EFileConfirm]: 'title',
        [EBusinessMsgType.EAutoPay]: 'title',
    }

    static listAll = [
        EBusinessMsgType.EOrderConfirm,
        EBusinessMsgType.ESteelPdfCoinfirm,
        EBusinessMsgType.EPdfConfirm,
        EBusinessMsgType.ESystemInfo,
        EBusinessMsgType.EExpressInfo,
        EBusinessMsgType.EFileConfirm,
        EBusinessMsgType.EAutoPay,
    ]
    static getTitleName(strMessageType: string) {
        if (strMessageType in EBusinessMsgType.dictTypeName) {
            return EBusinessMsgType.dictTypeName[strMessageType]
        }
        return '嘉立创下单助手消息'
    }

    static getContentElementByType(strMessageType: string) {
        if (strMessageType in EBusinessMsgType.dictTypeName) {
            return EBusinessMsgType.dictTypeContentElement[strMessageType]
        }
        return ECommon.ENone
    }
}
export class EBusinessMsgContent {
    // 等待确认订单
    static EWaitConfirmOrder = 'wait_confirm_order'
    // pcb文件
    static EPcbFile = 'pcb_file'

    static EMessageNewType = 'message_new_type'

    static EAuditResult = 'audit_result'
    static EHtmlContent = 'html_content'

    static EMsgType = 'msg_type'
    static EMsgId = 'msg_id'
    static ECustomerCode = 'customer_code'
    static EContent = 'content'
    static ESendTime = 'send_time'
    static ELocalTime = 'local_time'
    static EOrderId = 'order_id'
    static EOrderType = 'order_type'
    static EOrderTime = 'order_time'
    static EUrl = 'url'
    static ETitle = 'title'

    static EExpireTime = 'expire_time'
}
