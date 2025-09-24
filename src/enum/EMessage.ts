export class EMessage {
    // 主进程消息 start  ------------------------------------------
    static EWindowMinimize = '/main/window/minimize'
    static EWindowMaximize = '/main/window/maximize'
    static EWindowClose = '/main/window/close'
    static EWindowOpen = '/main/window/open'
    static EWindowIsMaximize = '/msg/request/isMaximized'
    static EWindowReloadIgnoringCache = '/main/window/reloadIgnoringCache'
    static EMainSettingGetUserConfig = '/main/setting/getUserConfig'
    static EMainGetLocale = '/main/getLocale'
    static EMainGetSystemLanguage = '/main/getSystemLanguage'
    static EMainGetCurrentLanguage = '/main/getCurrentLanguage'
    static EMainHistoryBack = '/main/historyBack'
    static EGoogleLogin = '/google/login'
    static EMainToViewMessage = '/main/to/view/message'
    static EMainFromMainMessage = 'from-main-message'
    static EMainSendAllView = '/main/send/all/view'

    static EAlertOK = '/main/alert/ok'
    static EAlertCancel = '/main/alert/cancel'

    static ESetCurrentHideTask = '/main/setCurrentHideTask'
    static EGetCurrentHideTask = '/main/getCurrentHideTask'
    static EGetAutoStart = '/main/getAutoStart'
    static ESetAutoStart = '/main/setAutoStart'
    static ESetDownloadsPath = '/main/setDownloadsPath'

    // 切换项目时是否提示
    static ESetCurrentAlertEDA = '/main/setCurrentAlertEDA'
    static EGetCurrentAlertEDA = '/main/getCurrentAlertEDA'
    // 退出时是否提示
    static ESetCurrentAlertClose = '/main/setCurrentAlertClose'
    static EGetCurrentAlertClose = '/main/getCurrentAlertClose'

    static ESetCurrentCloseOther = '/main/setCloseOther'
    static EGetCurrentCloseOther = '/main/getCloseOther'

    static EAlertEDACloseOther = '/main/alertEDA/clickCloseOther'
    static EAlertEDAOpenSame = '/main/alertEDA/clickOpenSame'
    // 主进程主窗体切换tab
    static EMainMainSwitchTab = '/main/switchTab'

    static EMainGetCustomInfo = '/main/customerInfo'

    static EMainConfig = '/main/config'
    static EMainGetPerformance = '/main/performance'

    static EMainBrowserviewSetTop = '/main/browser/setTop'
    static EMainBrowserviewClose = '/main/browser/close'

    static EMainRestAssist = '/main/reset'

    static EMainLoginSuccess = '/login/success'
    static ELoadingGotoLogin = '/loading/gotoLogin'
    static ELoadingGogoMain = '/logingo/gogoMain'
    static ELoadingGotoPrepare = '/loading/gotoPrepare'
    static EMainSetUserConfig = '/main/setUserConfig'
    static EMainSetUserConfigWithObj = '/main/setUserConfigWithObj'
    static EMainGetUserConfig = '/main/getUserConfig'

    static EMainAlertOK = '/main/alert/ok'
    static EMainAlertCancel = '/main/alert/cancel'
    static EMainAlertInfo = '/main/alert/info'

    static EMainSettingReset = '/main/setting/reset'
    static EMainSettingGetCurrentWebViewScale = '/msg/request/getCurrentWebViewScale'
    static EMainSettingDownloadsPath = '/main/setting/downloadsPath'

    static EGetWin10 = '/main/getWin10'
    static EGetProxy = '/main/getProxy'
    static EGetDownloadsPath = '/main/getDownloadsPath'
    static EMainBvMgrResetBound = '/main/resetBound'

    static EMainSearchStart = '/main/search/start'
    static EMainSearchNext = '/main/search/next'
    static EMainSearchBack = '/main/search/back'
    static EMainSearchClose = '/main/search/close'

    static EMainDragStart = '/main/drag/start'
    static EMainDragMove = '/main/drag/move'
    static EMainDragEnd = '/main/drag/end'

    static EMainRecordLog = '/main/recordLog'

    static EMainReloadLogin = '/main/reloadLogin'
    static EMainReloadCommon = '/main/reloadCommon'
    static EMainPageZoomIn = './main/zoomIn'
    static EMainPageCtrl = './main/ctrl'
    static EMainPageFailed = './main/page/failed'
    static EMainMsgAlertClickClose = './main/msgAlert/close'
    static EMainMsgAlertClickContent = './main/msgAlert/clickContent'

    static EMainMsgMgrClickContent = './main/msgMgr/clickContent'

    static EMainMsgAlertClickAd = './main/msgAlert/clickAd'
    static EMainMsgAlertIgnoreAll = './main/msgAlert/ignore/all'

    static EMainMsgMgrTab = './main/msgMgr/tab'
    static EMainMsgMgrRead = './main/msgMgr/read'

    static EMainMouseEnterSite = './main/app/mouseEnterSite'
    static EMainMouseLeaveSite = './main/app/mouseLeaveSite'
    static EMainOpenSiteUrl = './main/openSiteUrl'

    static EMainOpenUrlInTab = '/main/openUrlInTab'

    static EMainInsertUnionTab = '/main/insertUnionTab'

    static EMainInsertIndexKey = '/main/insertIndexKey'

    static EMainClickPlatformMsg = '/main/clickPlatformMsg'
    static EMainClickUrl = '/main/clickUrl'

    static EMainPullMsg = '/main/pull/msg'
    static EMainGetMsg = '/main/get/msg'

    static EMainSettingDefault = '/main/setting/default'
    // 主进程消息 end  ------------------------------------------
    // 渲染进程消息 start  ------------------------------------------
    static ESendToRender = '/renderer/'
    static ERenderUpdateSetting = 'updateSetting'

    static ERenderResetSearch = 'resetSearch'
    static ERenderUpdateSearch = 'updateSearch'
    static ERenderSetSearch = 'setSearch'

    static ERenderAlertEDASetAlert = 'alertEDASetAlert'
    static ERenderMainSwitchTab = 'mainSwitchTab'

    static ERenderSyncIsWin10 = 'syncIsWin10'
    static ERenderSyncIsDarwin = 'syncIsDarwin'

    static ERenderUpdateLogin = 'updateLogin'

    static ERenderRefreshTab = 'refreshTab'

    static ERenderMessageAlertContent = 'refreshMsgContent'

    static ERenderUnMaximize = '/window/main/unmaximize'

    static ERenderUpdateMsg = 'updateMsg'

    static ERenderSiteState = 'syncSiteState'

    static ERenderRightButtonCfg = 'sendRightButtonCfg'
    static ERenderLeftSiteCfg = 'sendLeftSiteCfg'

    static ERenderSaveMsg = 'renderSaveMsg'
    static ERenderPullMsg = 'renderPullMsg'
    static ERenderGetMsg = 'renderGetMsg'

    static EPaste = 'renderPaste'

    static EMainToRenderCreateUserLog = 'MainToRenderCreateUserLog'

    static ESetProxy = 'SetProxy'

    static ERenderToMainCloseBvView = 'RenderToMainCloseBvView'
    // 渲染进程消息 end  ------------------------------------------
}
