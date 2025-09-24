import { BrowserWindow, ipcMain } from 'electron'
import { AppMsg } from '../base/AppMsg'
import { AppConfig } from '../config/AppConfig'
import { EMessage } from '../enum/EMessage'
import { BaseNIMDB, QueryOption } from './BaseNIMDB'
import { NIMMsg } from './NIMMgr'

// 小助手侧消息数据库
export class ClientIndexDBMgr extends BaseNIMDB {
    private m_dbBrowserWindow: BrowserWindow
    private m_funPullMsgResolve: Function | undefined = undefined
    private m_dictGetMsgResolve: { [key: string]: Function } = {}
    // life start ---------------------------------------------------------
    init(): void {
        // 启动一个BrowserWindow
        this.m_dbBrowserWindow = new BrowserWindow({
            width: 0,
            height: 0,
            show: false,
            movable: false,
            fullscreen: false,
            webPreferences: {
                preload: AppConfig.preloadJSPath,
                nodeIntegration: true,
            },
        })
        this.m_dbBrowserWindow.loadFile('build/db.html')
        // this.m_dbBrowserWindow.webContents.openDevTools({ mode: 'undocked' })

        ipcMain.on(EMessage.EMainPullMsg, (event, listMsg: any[]) => {
            if (this.m_funPullMsgResolve) {
                this.m_funPullMsgResolve(listMsg)
            }
            this.m_funPullMsgResolve = undefined
        })

        ipcMain.on(EMessage.EMainGetMsg, (event, strMsgId: string, msg: any) => {
            let cb = this.m_dictGetMsgResolve[strMsgId]
            delete this.m_dictGetMsgResolve[strMsgId]
            if (cb) {
                cb(msg)
            }
        })
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    saveMsg(msg: NIMMsg): void {
        let dictNewData = {
            msgId: msg.getUUID(),
            scene: msg.getRawValue('scene'),
            fromUser: msg.getRawValue('from'),
            toUser: msg.getRawValue('to'),
            rawMsg: JSON.stringify(msg.getRawMsg()),
            time: msg.getTime(),
            state: msg.getState(),
        }

        this.m_dbBrowserWindow.webContents.send(
            EMessage.ESendToRender,
            new AppMsg(EMessage.ERenderSaveMsg, {
                'id': msg.getUUID(),
                'msg': dictNewData,
            })
        )
    }
    pullMsg(queryOption: QueryOption): Promise<{ [key: string]: unknown }[]> {
        return new Promise((resolve, reject) => {
            this.m_funPullMsgResolve = resolve
            this.m_dbBrowserWindow.webContents.send(
                EMessage.ESendToRender,
                new AppMsg(EMessage.ERenderPullMsg, queryOption)
            )
        })
    }
    getMsg(strMsgId: string): Promise<{ [key: string]: unknown }> {
        return new Promise((resolve, reject) => {
            this.m_dictGetMsgResolve[strMsgId] = resolve
            this.m_dbBrowserWindow.webContents.send(
                EMessage.ESendToRender,
                new AppMsg(EMessage.ERenderGetMsg, strMsgId)
            )
        })
    }

    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    openDev() {
        this.m_dbBrowserWindow?.webContents?.openDevTools({ mode: 'undocked' })
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
