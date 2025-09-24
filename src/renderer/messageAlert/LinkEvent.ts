class LinkEvent {
    private m_funAlertClick: Function
    private m_strUUID: string
    constructor() { 
        this.init()
    }
    init() {
        this.listenLinkClick()
        this.listenWindowOpen()
    }

    setAlertFun(funClick: Function) {
        this.m_funAlertClick = funClick
    }
    setUUID(strUUID) {
        this.m_strUUID = strUUID
    }
    private emitClick() {
        if (this.m_funAlertClick) {
            this.m_funAlertClick(this.m_strUUID)
        }
    }
    listenLinkClick() {
        document.body.addEventListener('click', event => {
            var target = event.target || event.srcElement
            if ((target as any).nodeName.toLocaleLowerCase() === 'a') {
                this.emitClick()
            }
        })
    }

    listenWindowOpen() {
        var orgOpen = window.open
        window.open = function (...args) {
            args[0] = this.formatNavigatedUrl(args[0], this.getQueryVariable(args[0]))
            return orgOpen(...args)
        }.bind(this)
    }

    listenWindowLocation() {
        //因为window.location方法为原生属性，不允许重写
        //使用 Object.defineProperty以及Proxy都不能监听到set行为
        //只能是进行全局调用$formatNavigatedUrl进行已有url替换
    }
}

export default LinkEvent
