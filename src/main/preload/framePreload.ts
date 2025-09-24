import { ELogLevel } from '../../enum/ECommon'
import { EMessage } from '../../enum/EMessage'

try {
    if (!window['appClient']) {
        window['appClient'] = window.parent['appClient']
    }

    if (!window['JLC_PC_Assit_Client_Information']) {
        window['JLC_PC_Assit_Client_Information'] = window.parent['JLC_PC_Assit_Client_Information']
    }

    if (!window['__assitEventHandle__']) {
        window['__assitEventHandle__'] = window.parent['__assitEventHandle__']
    }

    window['listPreventContextMenu'] = []

    HTMLDivElement.prototype.addEventListener = function (
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean
    ) {
        if (type === 'contextmenu') {
            window['listPreventContextMenu'] = [].push(this)
        }
        EventTarget.prototype.addEventListener.call(this, type, callback, options)
    }

    const funLog = window.console.log
    const funInfo = window.console.info
    const funWarn = window.console.warn
    const funError = window.console.error

    window.addEventListener('contextmenu', e => {
        funLog('[framePreload.ts] contextmenu cb e: \n', e)
        const isCanvas = ((e as any).path ?? []).some(item => {
            if (item.nodeName === 'CANVAS') {
                return true
            }
        })
        if (isCanvas) {
            return
        }
        const topUrl = e.view.parent.window.top.location.href ?? ''
        let anchorUrl = ''
        ;((e as any).path ?? []).some(item => {
            if (item.nodeName === 'A') {
                anchorUrl = item.href
                return true
            }
        })
        for (const obj of e.composedPath()) {
            // funLog(obj, window['listPreventContextMenu'] = [].indexOf(obj))
            if ((window['listPreventContextMenu'] = [].indexOf(obj) >= 0)) {
                // 该控件已经注册了右键菜单事件
                return
            }
        }

        const selectionStr = window.getSelection().toString()
        window.parent['__assitEventHandle__']?.handleContextMenu?.(
            topUrl,
            e.view.location.href,
            anchorUrl,
            selectionStr
        )
    })

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

    if (window.top['__assitEventHandle__']) {
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
    setInterval(() => {
        if (window.location.href.startsWith('chrome-error')) {
            if (window['__assitEventHandle__']) {
                console.log('$$ BrowserPreload.ts setInterval 30s', window.location.href)
                // :TODO: 处理页面加载失败
                // window['__assitEventHandle__'].handlePageFailed()
            }
        }
    }, 30000)
} catch (error) {}
