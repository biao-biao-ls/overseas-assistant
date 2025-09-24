export class AppMsg {
    public msgId: string
    public data: any
    constructor(strMsgId: string, data?: any) {
        this.msgId = strMsgId
        this.data = data
    }
}
