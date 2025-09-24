import { ELogLevel } from '../../enum/ECommon'
import { EMessage } from '../../enum/EMessage'

const funLog = window.console.log
const funInfo = window.console.info
const funWarn = window.console.warn
const funError = window.console.error

funWarn('加载ViewFinishload开始 -----------------------------')

window['listPreventContextMenu'] = []
HTMLDivElement.prototype.addEventListener = function (
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
) {
    if (type === 'contextmenu') {
        window['listPreventContextMenu'].push(this)
        funLog('右键菜单', this)
    }
    EventTarget.prototype.addEventListener.call(this, type, callback, options)
}

// 创建右键菜单
if (!window['hasListenContextmenu']) {
    window['hasListenContextmenu'] = true
    window.addEventListener('contextmenu', e => {
        funLog('[viewFinishload.ts] contextmenu cb e: \n', e)
        const isCanvas = ((e as any).path ?? []).some(item => {
            if (item.nodeName === 'CANVAS') {
                return true
            }
        })
        if (isCanvas) {
            return
        }
        let anchorUrl = ''
        ;((e as any).path ?? []).some(item => {
            if (item.nodeName === 'A') {
                anchorUrl = item.href
                return true
            }
        })

        const selectionStr = window.getSelection().toString()

        for (const obj of e.composedPath()) {
            if (window['listPreventContextMenu'].indexOf(obj) >= 0) {
                // 该控件已经注册了右键菜单事件
                return
            }
        }

        window['__assitEventHandle__'].handleContextMenu(
            e.view.location.href,
            e.view.location.href,
            anchorUrl,
            selectionStr
        )
    })
}

function handleLog(strHref: string, message?: any, strLogType?: string, ...optionalParams: any[]) {
    try {
        if (window.top['__assitEventHandle__']) {
            window.top['__assitEventHandle__'].handleLog(strHref, message, strLogType, optionalParams)
        }
    } catch (error) {
        switch (strLogType) {
            case ELogLevel.log:
                funLog('no Send log', message, optionalParams)
                break
            case ELogLevel.info:
                funInfo('no Send log', message, optionalParams)
                break
            case ELogLevel.warn:
                funWarn('no Send log', message, optionalParams)
                break
            case ELogLevel.error:
                funError('no Send log', message, optionalParams)
                break

            default:
                break
        }
    }
}

function parseKey(evt: KeyboardEvent) {
    let keyStr = ''
    if (evt.ctrlKey) {
        keyStr += 'ctrl+'
    }
    if (evt.shiftKey) {
        keyStr += 'shift+'
    }
    if (evt.altKey) {
        keyStr += 'alt+'
    }
    if (['Contron', 'Alt', 'Shift'].includes(evt.key)) {
        return keyStr.substring(0, keyStr.length - 1)
    }
    return (keyStr += evt.key)
}

window.addEventListener('keydown', evt => {
    if (evt.ctrlKey) {
        if (window['__assitEventHandle__']) {
            window['__assitEventHandle__'].handleCtrlDown(true)
        }
    }

    const keyStr = parseKey(evt)

    if (window['__assitEventHandle__']) {
        window['__assitEventHandle__'].handleKeydown(keyStr)
    }
})
window.addEventListener('keyup', evt => {
    if (!evt.ctrlKey) {
        if (window['__assitEventHandle__']) {
            window['__assitEventHandle__'].handleCtrlDown(false)
        }
    }
})

window['onmousewheel'] = (event: WheelEvent) => {
    // 发送设置
    if (event['wheelDeltaY'] > 0) {
        // 缩小
        if (window['__assitEventHandle__']) {
            window['__assitEventHandle__'].handleZoomIn(true)
        }
    } else {
        if (window['__assitEventHandle__']) {
            window['__assitEventHandle__'].handleZoomIn(false)
        }
    }
}

let MaxLength = 1024
// window.console.log = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funLog(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.log, strParam)
//     } catch (error) {}
// }
// window.console.info = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funInfo(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.info, strParam)
//     } catch (error) {}
// }
// window.console.warn = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funWarn(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.warn, strParam)
//     } catch (error) {}
// }

// window.console.error = (message?: any, ...optionalParams: any[]) => {
//     try {
//         funError(message, optionalParams)
//         let strMsg = JSON.stringify(message)
//         let strParam = JSON.stringify(optionalParams)
//         if (strMsg.length >= MaxLength || strParam.length >= MaxLength) {
//             return
//         }
//         handleLog(window.location.href, strMsg, ELogLevel.error, strParam)
//     } catch (error) {}
// }

if (window.top['__assitEventHandle__'] && window.top['__assitEventHandle__'].onMainMsg) {
    window.top['__assitEventHandle__'].onMainMsg((event, msg) => {
        // funLog('msg', msg)
        // funLog(selectInput)
        if (msg.msgId === EMessage.EPaste) {
            let active = document.activeElement
            // funLog('active', active)
            if (active instanceof HTMLInputElement) {
                const lastValue = active.value
                active.value = msg.data
                const event = new Event('input', { bubbles: true })
                // hack React15
                ;(event as any).simulated = true
                // hack React16 内部定义了descriptor拦截value，此处重置状态
                const tracker = (active as any)._valueTracker
                if (tracker) {
                    tracker.setValue(lastValue)
                }
                active.dispatchEvent(event)
            }
        }
    })
}
window.alert = (message: string) => {
    if (window.top['__assitEventHandle__'] && window.top['__assitEventHandle__']['electronAlert']) {
        window.top['__assitEventHandle__'].electronAlert(message)
    }
}

function closeBvView() {
    console.log(window.top['appClient'])
    if (window.top['appClient']) {
        window.top['appClient'].closeBvView()
    }
}
let funClose = window.close.prototype
window.close = () => {
    closeBvView()
    funClose()
}

funWarn('加载ViewFinishload结束 -----------------------------')
