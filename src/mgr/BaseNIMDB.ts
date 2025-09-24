import { NIMMsg } from './NIMMgr'

export interface QueryOption {
    startTime?: number
    endTime?: number
    limit?: number
    listFlag?: number[]
    order?: string
}

export abstract class BaseNIMDB {
    protected m_bInit: boolean = false

    // life start ---------------------------------------------------------
    abstract init(): void
    isInit() {
        return this.m_bInit
    }
    abstract saveMsg(msg: NIMMsg): void
    abstract pullMsg(queryOption: QueryOption): Promise<{ [key: string]: unknown }[]>
    abstract getMsg(strMsgId: string): Promise<{ [key: string]: unknown } | undefined>
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
