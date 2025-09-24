const os = require('os')
import si from './utils/systemInfoWrapper'
import CryptoJS from 'crypto-js'
import Store from 'electron-store'

/**
 * 加密
 * @param base64Text 
 * @param hexKey 
 * @returns hexText
 */
export function enCrypto(base64Text: string, hexKey: string) {
    const wordArray = CryptoJS.enc.Base64.parse(base64Text)
    const encrypt = CryptoJS.AES.encrypt(wordArray, CryptoJS.enc.Hex.parse(hexKey), {
        // iv: CryptoJS.enc.Utf8.parse(iv),
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    })
    // 默认转成 Hax
    return encrypt.ciphertext.toString().toUpperCase()
}

/**
 * 解密
 * @param haxWord 
 * @param hexKey 
 * @returns haxText
 */
export function deCrypto(haxWord: string, hexKey: string) {
    const wordArray = CryptoJS.enc.Hex.parse(haxWord)
    const base64Text = CryptoJS.enc.Base64.stringify(wordArray)

    const result = CryptoJS.AES.decrypt(base64Text, CryptoJS.enc.Hex.parse(hexKey), {
        // iv: CryptoJS.enc.Utf8.parse(iv),
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    })
    // 默认转成 Hax
    return result.toString()
}

// const option = {
//     name: 'deviceInfo',
//     fileExtension: 'json',
//     cwd: app.getPath('userData'),
//     encryptionKey: 'aes-256-cbc', //对配置文件进行加密
//     clearInvalidConfig: true, // 发生 SyntaxError  则清空配置,
// }
// const store = new Store(option)
// console.log(`app.getPath('userData')`, app.getPath('userData'))
/** 将用户设备信息保存到 本地文件 中 */
export function storeUserDeviceInfo(updateStore: boolean = false) {
    const store = new Store()
    const promise = new Promise(resolve => {
        if (store.get('config_version') !== '1.0' || !store.get('device_info') || updateStore) {
            const sysInfo = new SysInfo()
            sysInfo.getAll().then(() => {
                const device_info = {
                    hostName: sysInfo.hostName,
                    HardDisk: sysInfo.HardDisk,
                    OsInfo: sysInfo.OsInfo,
                    UUID: sysInfo.UUID,
                    network_adapter: sysInfo.network_adapter,
                    processor: sysInfo.processor,
                    system: sysInfo.system,
                }
                // store.set('device_info', device_info)
                store.set('device_info', CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(device_info))))
                store.set('config_version', '1.0')
                resolve(0)
            })
        } else {
            resolve(0)
        }
    })
    return promise
}



export class SysInfo {
    hostName = ''
    /** 主板信息 */
    system = {
        /** 设备信息类型 */
        device_info_type: 'system',
        /** 主板类型 */
        chassis_type: 'Desktop',
        /** 制造商 */
        manufacturer: '',
        /** 产品名 */
        product_name: '',
        /** 序列号 */
        serial_number: '',
        /** UUID */
        uuid: '',
    }
    /** CPU 信息 */
    processor = {
        /** 设备信息类型 */
        device_info_type: 'processor',
        /** CPU ID */
        cpu_id: '',
        /** 制造商 */
        manufacturer: '',
        /** 产品名 */
        product_name: '',
    }
    /** 网络适配器信息 */
    network_adapter = {
        /** 设备信息类型 */
        device_info_type: 'network_adapter',
        /** MAC 地址 */
        mac_address: '',
        /** 制造商 */
        manufacturer: 'Not Specified',
        /** 产品名 */
        product_name: 'Not Specified',
    }
    /** 操作系统信息 */
    OsInfo = {
        /** 设备信息类型 */
        device_info_type: 'OsInfo',
        /** 是否运行与虚拟机内 */
        IsInsideVM: 'false',
        /** 语言 ID，暂定：中国中文='2052' */
        LangID: '2052',
        /** OS 安装时间，这个 JS 应该是拿不到 */
        OSInstallDate: '',
        /** OS 版本 */
        OSVersion: '',
        /** 32/64 位（获取的不对，废弃） */
        Bit: '',
        /** 操作系统版本信息（JSON 字符串） */
        OSVersionInformation: '',
    }
    /** 硬盘信息 */
    HardDisk = {
        /** 设备信息类型 */
        device_info_type: 'HardDisk',
        /** 第一个硬盘的序列号 */
        serialNumber: '',
    }
    /** 每次生成设备信息都会创建一个 UUID */
    UUID = {
        /** 设备信息类型 */
        device_info_type: 'UUID',
        UUID: '',
    }
    /** 操作系统版本信息一 */
    VersionInfo = {
        /** 64操作系统， */
        AMD64: true,
        /** 服务器操作系统，写死 */
        WindowsServer: false,
        /** OS 主版本号 */
        MajorVersion: 0,
        /** OS 次版本号 */
        MinorVersion: 0,
        /** Service Pack 主版本号，写死 */
        ServicePackMajor: 1,
        /** Service Pack 次版本号，写死 */
        ServicePackMinor: 0,
        /** 产品类型，写死 */
        ProductType: 1,
        /** SuiteName，写死 */
        SuiteName: 0,
        /** 操作系统版本描述 */
        WinVersionDescription: '',
        /** 操作系统版本代码，写死 */
        WinVersionCode: 999999,
    }
    /** 操作系统版本信息2，以兼容模式运行时获取的版本信息与 VersionInfo 不同 */
    Compatibility = {
        /** OS 主版本号 */
        MajorVersion: 0,
        /** OS 次版本号 */
        MinorVersion: 0,
        /** OS 内部版本号 */
        BuildNumber: 0,
        /** OS 平台 ID，不知道是什么东西 */
        PlatformId: 0,
        /** Service Pack 版本信息 */
        CSDVersion: '',
        /** 操作系统版本描述 */
        WinVersionDescription: '',
        /** 操作系统版本代码，先用 999999 代替吧 */
        WinVersionCode: 999999,
    }

    /** 重新获得所有设备信息 */
    getAll() {
        this.UUID.UUID = getUid()
        const p1 = new Promise(resolve => {
            si.system().then(data => {
                // 存疑，baseboard 上没有 uuid，只能取这里的 uuid 了
                this.system.uuid = data.uuid || 'unknown-uuid'
                // 获得的数据可能不真实
                this.OsInfo.IsInsideVM = data.virtual + ''
                resolve(0)
            }).catch((error) => {
                // 获取系统信息失败
                resolve(0)
            })
        })

        const p2 = new Promise(resolve => {
            si.baseboard().then(data => {
                this.system.manufacturer = data.manufacturer
                // 存疑，这里的 system 指的是主板吗？
                this.system.product_name = data.model
                this.system.serial_number = data.serial
                resolve(0)
            }).catch(() => {
                resolve(0)
            })
        })
        const p3 = new Promise(resolve => {
            si.cpu().then(data => {
                this.processor.manufacturer = data.manufacturer
                this.processor.product_name = `${data.manufacturer} ${data.brand} CPU @ ${data.speed}GHz`
                resolve(0)
            }).catch(() => {
                resolve(0)
            })
        })
        const p4 = new Promise(resolve => {
            // 测试发现能获取收到很多网卡信息。有叫 controller 的，有叫 adapter 的，分不清哪个是真网卡，这里暂时先取第一个
            si.networkInterfaces().then(data => {
                this.network_adapter.mac_address = (data[0]?.mac + '').replaceAll(':', '').toUpperCase()
                this.network_adapter.product_name = data[0]?.ifaceName
                resolve(0)
            }).catch(() => {
                resolve(0)
            })
        })
        const p5 = new Promise(resolve => {
            si.diskLayout().then(data => {
                this.HardDisk.serialNumber = data[0].serialNum
                resolve(0)
            }).catch(() => {
                resolve(0)
            })
        })
        const p6 = new Promise(resolve => {
            si.osInfo().then(data => {
                this.hostName = data.hostname
                this.OsInfo.Bit = `${/64/.test(data.arch) ? '64' : '32'}bit`
                this.OsInfo.OSVersion = `${data.distro} ${data.release}`
                this.Compatibility.MajorVersion = +(data.release + '').split('.')[0]
                this.Compatibility.MinorVersion = +(data.release + '').split('.')[1]
                this.Compatibility.BuildNumber = +data.build
                this.Compatibility.CSDVersion = data.servicepack
                this.Compatibility.WinVersionDescription = data.distro
                this.VersionInfo.AMD64 = /64/.test(data.arch)
                this.VersionInfo.MajorVersion = +(data.release + '').split('.')[0]
                this.VersionInfo.MinorVersion = +(data.release + '').split('.')[1]
                this.VersionInfo.WinVersionDescription = data.distro
                const OSVersionInformation = {
                    Compatibility: this.Compatibility,
                    VersionInfo: this.VersionInfo,
                }
                this.OsInfo.OSVersionInformation = JSON.stringify(OSVersionInformation)
                resolve(0)
            }).catch(() => {
                resolve(0)
            })
        })
        const p7 = new Promise(resolve => {
            si.uuid().then(data => {
                // 拿不到 cpu id，只能取这里的 uuid 了
                this.processor.cpu_id = data.os + ''
                resolve(0)
            }).catch(() => {
                resolve(0)
            })
        })
        return Promise.all([p1, p2, p3, p4, p5, p6, p7])
    }
}

/** 随机生成 UUID */
function getUid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

/** 操作系统版本信息 */
interface OSVersionInformation {
    VersionInfo: ''
    Compatibility: ''
}

/** 老版小助手定义的系统编号 */
const WinVersionCode = {
    'Windows 2000': 0,
    'Windows XP': 1,
    'Windows XP Professional x64 Edition': 2,
    'Windows Server 2003': 3,
    'Windows Home Server': 4,
    'Windows Server 2003 R2': 5,
    'Windows VISTA': 6,
    'Windows Server 2008': 7,
    'Windows Server 2008 R2': 8,
    'Windows 7': 9,
    'Windows Server 2012': 10,
    'Windows 8': 11,
    'Windows Server 2012 R2': 12,
    'Windows 8.1': 13,
    'Windows 10': 14,
    'Windows Server 2016|2019': 15,
    'Windows UNKNOWN': 999999,
}

export function parseKey(evt: KeyboardEvent) {
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
