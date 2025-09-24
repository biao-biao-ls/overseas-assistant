const { version } = require('./package.json')
const { resolve } = require('path')

const versionArr = version.split('-')
const bundleShortVersion = versionArr[0]
const bundleVersion = versionArr[1]

const config = {
    asar: true,
    productName: 'JLCONE',
    appId: 'com.jlcpcb.www',
    'directories': {
        'output': 'package',
        'buildResources': 'res',
    },
    icon: resolve(__dirname, './assets/YourAppIcon.icns'),

    publish: {
        // 需要结合 const { autoUpdater } = require('electron-updater'); 使用
        provider: 'generic', // 指定服务器类型，generic 通用服务器，也可以是 github 等
        url: '', // 线上服务器地址
    },
    asarUnpack: '***.{node,dll}',
    'files': ['./build/**/*'],
    mac: {
        target: [
            {
                target: 'mas',
                arch: 'x64'
            }
        ],
        icon: resolve(__dirname, './assets/YourAppIcon.icns'),
        hardenedRuntime: true,
        entitlements: 'mas/entitlements.mas.plist',
        entitlementsInherit: 'mas/entitlements.mas.inherit.plist',
        provisioningProfile: 'mas/macdistributionprofile.provisionprofile',
        // bundleVersion: bundleVersion,
        // bundleShortVersion: bundleShortVersion,
        // artifactName: '${productName}-${version}-${arch}.${ext}',
        extendInfo: {
            ElectronTeamID: 'FPD7225NBW',
            ITSAppUsesNonExemptEncryption: false,
        },
        // asarUnpack: ['**/*.node'],
    },
    mas: {
        type: 'distribution',
        hardenedRuntime: false,
        icon: resolve(__dirname, './assets/YourAppIcon.icns'),
        // gatekeeperAssess: false,
        entitlements: 'mas/entitlements.mas.plist',
        entitlementsInherit: 'mas/entitlements.mas.inherit.plist',
        entitlementsLoginHelper: 'mas/entitlements.mas.loginhelper.plist',
        provisioningProfile: 'mas/macdistributionprofile.provisionprofile',
        identity: 'Jialichuang(Hong Kong) co., Limited (FPD7225NBW)',
        extendInfo: {
            ElectronTeamID: 'FPD7225NBW',
            ITSAppUsesNonExemptEncryption: false,
        },
    },

    dmg: {
        icon: resolve(__dirname, './assets/YourAppIcon.icns'),
        iconSize: 100,
        sign: false,
        'contents': [
            {
                'x': 410,
                'y': 150,
                'type': 'link',
                'path': '/Applications',
            },
            {
                'x': 130,
                'y': 150,
                'type': 'file',
            },
        ],
    },
}
module.exports = config
