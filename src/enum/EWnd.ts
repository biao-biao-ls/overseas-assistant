export class EWnd {

    static ELoign: string = 'login'
    static EUpdateTip: string = 'updateTip'
    static EMain: string = 'main'
    static ESetting: string = 'setting'
    static EAlert: string = 'alert'
    static EAlertClose: string = 'alertClose'
    static EAlertEDA: string = 'alertEDA'
    static EMessageAlert: string = 'messageAlert'
    static EMsessageMgr: string = 'messageMgr'
    static ELauncher: string = 'launcher'

    static listMainWnd = [EWnd.ELoign, EWnd.EMain]
}

export class EWndFunction {
    // 界面窗口
    static EUI = 'ui'
    // 设置窗口
    static ESetting = 'setting'
    // 提示窗口
    static EAlert = 'alert'
    // 消息提示窗口
    static EMsg = 'msg'
}

export class EWndPrimary {
    // 最基础
    public static EBase = 0
    // 最底层
    public static EBg = 1
    // 主菜单
    public static EInterface = 2
    // 直接覆盖在上层
    public static EStackTop = 3

    // 单独显示
    public static EOnly = 90
    public static EEffect = 97
    public static EControl = 98
    public static ERecharge = 99
    // 警示类
    public static EAlert = 100
}

export class EWndCfg {
    static EWndName = 'wndName'
    static EWndFunction = 'wndFunction'
    static EWndRes = 'wndRes'
    static EWndPrimary = 'wndPrimary'
    static EWndLogicClass = 'wndLogicClass'
    static EWindowCfg = 'windowCfg'
}
