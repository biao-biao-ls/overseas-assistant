export interface LoginSuccessInfo {
    code: number
    message: string
    data: CustomerInfo
    loadUrls: LoadUrls
    CustomerInfoWnd: any

    siteCfg: any
    buttonCfg: any
}

interface CustomerInfo {
    'imUserInfoId': string
    'customerCode': string
    'consumerId': string
    'casAccountCode': string
    'neteaseAccId': string
    'neteaseToken': string
    'imUserStatus': string
    'imCurrentVersion': string
    'casModifyTime': any
    'integralLevel': string
    'basicPoint': string
    'bonusPoint': string
    'rmbPoint': string
    'createTime': number
    'updateTime': number
    'createTimeStr': string
    'userIp': string
    'deviceInfo': string
    'cpuId': string
    'mainBoardId': string
    'deviceInfoEx': any
}

interface LoadUrls {
    'loadIndexUrl': string
    'loadErpUrl': string
    'loadBackPwdUrl': string
    'logoutUrl': [
        {
            'findUrl': string
            'replaceUrl': string
        }
    ]
    'bill': string
    'payUrls': string[]
    'promptUrl': string
    'showUrl': string
    'domainUrls': string[]
    'loadJlcUrls': string[]
    'gerberListUrl': string
    'gerberFileUploadUrl': string
    'gerberFileUploadStatusUrl': string
    'aboutUrl': string
    'backgroundBlackList': string[]
}
