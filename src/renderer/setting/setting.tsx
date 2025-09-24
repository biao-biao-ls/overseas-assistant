import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { SvgButton } from '../components/svgButton/svgButton'
import btnCloseNormal from '../../../assets/btn-wnd-close.svg'
import btnCloseHover from '../../../assets/btn-wnd-close-hover.svg'

import './setting.css'
import { EWnd } from '../../enum/EWnd'
import ComboBox from '../components/comboBox/Combobox'
import RadioButtonGroup from '../components/radioButtonGroup/RadioButtonGroup'
import { NormalButton } from '../components/normalButton/NormalButton'
import { EMessage } from '../../enum/EMessage'
import { AppMsg } from '../../base/AppMsg'
import Shadow from '../components/shadow/shadow'
import { ECommon } from '../../enum/ECommon'
import CheckButton from '../components/checkButton/CheckButton'
import { ASSIT_VERSION } from '../../main/config'
import InputBox from '../components/inputBox/InputBox'

const { ipcRenderer } = (window as any)['electron'] as any

const App = (): JSX.Element => {
    const refProxy = useRef(null)
    const refCountry = useRef(null)
    const refLanguage = useRef(null)
    const refRate = useRef(null)
    const refExitRadio = useRef(null)
    const refAutoStart = useRef(null)
    const refOpenOrderNotification = useRef(null)
    const refOpenMarketActivityNotification = useRef(null)
    const refOpenCoummunityMessageNotification = useRef(null)
    const refShadow = useRef(null)
    // 国家
    const [country, setCountry] = useState('')
    // 国家列表
    const [countryList, setCountryList] = useState([])
    // 语言
    const [language, setLanguage] = useState('')
    // 语言列表
    const [languageList, setLanguageList] = useState([])
    // 标记用户是否已经修改过语言设置
    const [hasUserModifiedLanguage, setHasUserModifiedLanguage] = useState(false)
    // 汇率
    const [rate, setRate] = useState('')
    // 汇率列表
    const [rateList, setRateList] = useState([])
    // 退出程序
    const [hideToTask, setUIHideToTask] = useState(true)
    // 是否自启
    const [autoStart, setAutoStart] = useState(true)
    // 桌面提示
    // 是否开启订单通知
    const [openOrderNotification, setOpenOrderNotification] = useState(true)
    // 是否开启市场活动通知
    const [openMarketActivityNotification, setOpenMarketActivityNotification] = useState(true)
    // 是否开启社区消息通知
    const [openCoummunityMessageNotification, setOpenCoummunityMessageNotification] = useState(true)

    const [isDarwin, setIsDarwin] = useState(false)

    // 用户名称
    const [username, setUserName] = useState('')

    const onClickClose = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.ESetting)
    }
    const handleChangeTypeVale = (strType, strValue) => {
        if (strType === 'country') {
            setCountry(strValue)
        } else if (strType === 'rate') {
            setRate(strValue)
        } else if (strType === 'language') {
            setLanguage(strValue)
            setHasUserModifiedLanguage(true) // 标记用户已修改语言
            console.log('Setting: 用户修改语言为', strValue)
        }
    }
    const onClickConfirm = () => {
        const dictConfig = {
            country,
            rate,
            language, // 使用用户选择的语言
            hideToTask,
            autoStart,
            openOrderNotification,
            openMarketActivityNotification,
            openCoummunityMessageNotification,
        }

        console.log('Setting: 保存配置', { language, hasUserModifiedLanguage })

        // 新的语言管理系统：只有用户修改了语言才保存语言配置
        let configToSave = {
            country,
            rate,
            hideToTask,
            autoStart,
            openOrderNotification,
            openMarketActivityNotification,
            openCoummunityMessageNotification,
        }

        // 如果用户修改了语言，单独处理语言配置
        if (hasUserModifiedLanguage) {
            console.log('🔒 用户修改了语言，使用新的语言管理系统保存:', language)
            
            // 语言配置通过专门的配置对象发送
            const languageConfig = {
                language: language,
                __source: 'setting-window', // 严格的来源标记
            }
            
            console.log('Setting: 发送语言配置到主进程', languageConfig)
            ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, languageConfig)
        }

        // 发送其他配置（不包含语言）
        console.log('Setting: 发送其他配置到主进程', configToSave)

        ipcRenderer.send(EMessage.EMainSetUserConfigWithObj, configToSave)
        // 关闭窗口
        ipcRenderer.send(EMessage.EWindowClose, EWnd.ESetting)

        ipcRenderer.send(EMessage.ESetProxy, refProxy.current.getValue())
    }
    const onClickCancel = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.ESetting)
    }

    const [locale, setLocale] = useState({} as any)

    const updateSetting = () => {
        ipcRenderer
            .invoke(EMessage.EMainSettingGetUserConfig)
            .then(dictConfig => {
                console.log('Setting: 收到配置数据', dictConfig)
                const {
                    username,
                    country,
                    countryList,
                    rate,
                    rateList,
                    language,
                    languageList,
                    hideToTask: bHideTask,
                    autoStart: bAutoStart,
                    openOrderNotification: bOpenOrderNotification,
                    openMarketActivityNotification: bOpenMarketActivityNotification,
                    openCoummunityMessageNotification: bOpenCoummunityMessageNotification,
                } = dictConfig || {}

                console.log('Setting: 解析后的数据', {
                    country,
                    countryList: countryList?.length,
                    language,
                    languageList: languageList?.length,
                    rate,
                    rateList: rateList?.length,
                })

                // 设置基础数据
                setCountry(country || '')
                setRate(rate || '')

                // 确保列表数据有效
                const validCountryList = Array.isArray(countryList) ? countryList : []
                const validRateList = Array.isArray(rateList) ? rateList : []
                const validLanguageList = Array.isArray(languageList) ? languageList : [{ cfg: 'en', name: 'English' }]

                setCountryList(validCountryList)
                setRateList(validRateList)
                setLanguageList(validLanguageList)

                // 直接使用配置中的语言，并重置用户修改状态
                const currentLanguage = language || 'en' // 默认英语
                setLanguage(currentLanguage)
                setHasUserModifiedLanguage(false) // 重置用户修改状态
                console.log('Setting: 从配置加载语言', currentLanguage, '重置修改状态为false')

                console.log('Setting: 准备设置选中项', {
                    country,
                    currentLanguage,
                    rate,
                    countryListLength: validCountryList.length,
                    languageListLength: validLanguageList.length,
                    rateListLength: validRateList.length,
                })

                // 延迟设置选中项，确保数据已经加载和组件已经渲染
                setTimeout(() => {
                    try {
                        if (refCountry.current && country && validCountryList.length > 0) {
                            console.log('Setting: 设置国家选中项', country)
                            refCountry.current.setSelectId(country)
                        }
                        
                        // 增强的语言设置逻辑，添加更多调试信息
                        if (refLanguage.current && currentLanguage && validLanguageList.length > 0) {
                            console.log('Setting: 准备设置语言选中项')
                            console.log('   当前语言:', currentLanguage)
                            console.log('   语言列表长度:', validLanguageList.length)
                            console.log('   语言列表:', validLanguageList.map(l => `${l.cfg}-${l.name}`))
                            
                            // 验证语言是否在列表中
                            const languageExists = validLanguageList.find(lang => lang.cfg === currentLanguage)
                            if (languageExists) {
                                console.log('   ✅ 语言在列表中:', languageExists.name)
                                refLanguage.current.setSelectId(currentLanguage)
                                console.log('   ✅ 已调用 setSelectId:', currentLanguage)
                            } else {
                                console.log('   ❌ 语言不在列表中，使用英语作为默认值')
                                refLanguage.current.setSelectId('en')
                                console.log('   ✅ 已调用 setSelectId: en (默认值)')
                            }
                        } else {
                            console.log('Setting: 无法设置语言选中项')
                            console.log('   refLanguage.current:', !!refLanguage.current)
                            console.log('   currentLanguage:', currentLanguage)
                            console.log('   validLanguageList.length:', validLanguageList.length)
                        }
                        
                        if (refRate.current && rate && validRateList.length > 0) {
                            console.log('Setting: 设置汇率选中项', rate)
                            refRate.current.setSelectId(rate)
                        }
                    } catch (error) {
                        console.error('Setting: 设置选中项时出错', error)
                    }
                }, 200)

                setUIHideToTask(bHideTask)
                refExitRadio.current.setSelectId(bHideTask)

                setAutoStart(bAutoStart)
                refAutoStart.current.setSelectId(bAutoStart)

                // setOpenOrderNotification(bOpenOrderNotification)
                // refOpenOrderNotification.current.setCheck(bOpenOrderNotification)
                // setOpenMarketActivityNotification(bOpenMarketActivityNotification)
                // refOpenMarketActivityNotification.current.setCheck(bOpenMarketActivityNotification)
                // setOpenCoummunityMessageNotification(bOpenCoummunityMessageNotification)
                // refOpenCoummunityMessageNotification.current.setCheck(bOpenCoummunityMessageNotification)

                setUserName(username || '')
            })
            .catch(error => {
                console.error('Setting: 获取配置失败', error)
                // 提供默认数据
                setCountryList([])
                setRateList([])
                setLanguageList([{ cfg: 'en', name: 'English' }])
                setLanguage('en')
            })

        ipcRenderer.invoke(EMessage.EGetProxy).then(dictCfg => {
            let strRule = dictCfg['proxyRules']
            if (!strRule) {
                strRule = ''
            }
            refProxy.current.setValue(strRule)
        })

        ipcRenderer.invoke(EMessage.EMainGetLocale).then(langMap => {
            setLocale(langMap)
        })
    }

    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg((event, msg: AppMsg) => {
            if (msg.msgId === EMessage.ERenderUpdateSetting) {
                updateSetting()
            } else if (msg.msgId === EMessage.ERenderSyncIsWin10) {
                let bWin10 = msg.data
                refShadow.current.showShadow(bWin10)
            } else if (msg.msgId === EMessage.ERenderSyncIsDarwin) {
                setIsDarwin(msg.data)
            }
        })

        // 不再从本地存储恢复语言设置，完全依赖主进程配置
        // 语言设置将通过 updateSetting() 从主进程配置中获取

        updateSetting()
    }, [])

    const dictExitData = [
        { value: true, label: locale.locale_2 },
        { value: false, label: locale.locale_3 },
    ]
    const dictAutoData = [
        { value: true, label: locale.locale_5 },
        { value: false, label: locale.locale_6 },
    ]
    const handleUpdateVersion = () => {
        alert(locale.locale_7)
    }

    const handleSignOut = () => {
        ipcRenderer.send(EMessage.EMainToViewMessage, { type: 'jlcone-logout' })
    }

    return (
        <div className="win_container">
            <Shadow ref={refShadow}>
                <div className="setting_container">
                    <div className="setting_nav_bar">
                        <div className="nav-title">
                            <span>{locale.i18n_shared_739}</span>
                        </div>
                        <div className="nav_btn_list_setting">
                            <SvgButton
                                outSize="45px"
                                imgSize="28px"
                                normalIcon={btnCloseNormal}
                                hoverIcon={btnCloseHover}
                                onClick={() => {
                                    onClickClose()
                                }}
                            />
                        </div>
                    </div>
                    <div className="setting_content">
                        {/* 国家 */}
                        <div className="div_setting_item_row">
                            <div className="div_scale_comboBox">
                                <ComboBox
                                    ref={refCountry}
                                    title={locale.i18n_shared_772}
                                    selectType="country"
                                    onChange={(strType, strValue) => {
                                        handleChangeTypeVale(strType, strValue)
                                    }}
                                    listCfg={countryList}
                                ></ComboBox>
                            </div>
                        </div>
                        {/* 语言 */}
                        <div className="div_setting_item_row">
                            <div className="div_scale_comboBox">
                                <ComboBox
                                    ref={refLanguage}
                                    title={locale.i18n_shared_882}
                                    selectType="language"
                                    onChange={(strType, strValue) => {
                                        handleChangeTypeVale(strType, strValue)
                                    }}
                                    listCfg={languageList}
                                ></ComboBox>
                            </div>
                        </div>
                        {/* 汇率 */}
                        <div className="div_setting_item_row">
                            <div className="div_scale_comboBox">
                                <ComboBox
                                    ref={refRate}
                                    title={locale.i18n_shared_883}
                                    selectType="rate"
                                    onChange={(strType, strValue) => {
                                        handleChangeTypeVale(strType, strValue)
                                    }}
                                    listCfg={rateList}
                                ></ComboBox>
                            </div>
                        </div>
                        {/* 退出程序 */}
                        {isDarwin ? (
                            ''
                        ) : (
                            <div className="div_setting_item_row div_setting_item_row_start">
                                <div className="comboBox_item_name">{locale.locale_1}</div>
                                {/* 选择按钮 */}
                                <div className="div_setting_col">
                                    <RadioButtonGroup
                                        ref={refExitRadio}
                                        direction="col"
                                        dictSelect={dictExitData}
                                        onClick={(value: boolean) => {
                                            setUIHideToTask(value)
                                        }}
                                    ></RadioButtonGroup>
                                </div>
                            </div>
                        )}

                        {/* 开启自启 */}
                        <div className="div_setting_item_row ">
                            <div className="comboBox_item_name">{locale.locale_4}</div>
                            <div className="div_setting_col">
                                {/* 选择按钮 */}
                                <RadioButtonGroup
                                    ref={refAutoStart}
                                    direction="row"
                                    dictSelect={dictAutoData}
                                    onClick={(value: boolean) => {
                                        setAutoStart(value)
                                    }}
                                ></RadioButtonGroup>
                            </div>
                        </div>
                        {/* 桌面提示 */}
                        {/* <div className="div_setting_item_row">
                            <div className="comboBox_item_name">{locale.locale_8}</div>
                            <div className="div_setting_col grid-2col">
                                <CheckButton
                                    ref={refOpenOrderNotification}
                                    text={locale.locale_9}
                                    onClick={value => {
                                        setOpenOrderNotification(value)
                                    }}
                                ></CheckButton>

                                <CheckButton
                                    ref={refOpenMarketActivityNotification}
                                    text={locale.locale_10}
                                    onClick={value => {
                                        setOpenMarketActivityNotification(value)
                                    }}
                                ></CheckButton>

                                <CheckButton
                                    ref={refOpenCoummunityMessageNotification}
                                    text={locale.locale_11}
                                    onClick={value => {
                                        setOpenCoummunityMessageNotification(value)
                                    }}
                                ></CheckButton>
                            </div>
                        </div> */}

                        {/* 版本号 */}
                        <div className="div_setting_item_row">
                            <div className="comboBox_item_name">{locale.locale_12}</div>
                            <div className="div_setting_col">
                                <span className="span_form_label">{locale.locale_36}</span>
                                {/* <NormalButton
                                    text={locale.locale_13 || 'Update'}
                                    height="32px"
                                    width="71px"
                                    plain={true}
                                    rounded={true}
                                    type="primary"
                                    onClick={() => {
                                        handleUpdateVersion()
                                    }}
                                ></NormalButton> */}
                            </div>
                        </div>
                        {/* 退出登录 */}
                        <div className="div_setting_item_row">
                            <div className="comboBox_item_name">{locale.locale_14}</div>
                            <div className="div_setting_col div_setting_inline">
                                <span className="span_form_label">{username}</span>
                                <NormalButton
                                    text={locale.locale_15 || 'Sign Out'}
                                    height="32px"
                                    width="80px"
                                    plain={true}
                                    type="text"
                                    onClick={() => {
                                        handleSignOut()
                                    }}
                                ></NormalButton>
                            </div>
                        </div>

                        <div className="div_button_wrap">
                            {/* 确认 取消 */}
                            <div className="div_button">
                                <NormalButton
                                    text={locale.locale_16 || 'Cancel'}
                                    height="40px"
                                    width="120px"
                                    rounded={true}
                                    onClick={() => {
                                        onClickCancel()
                                    }}
                                ></NormalButton>
                                <NormalButton
                                    text={locale.locale_17 || 'Save'}
                                    height="40px"
                                    width="120px"
                                    rounded={true}
                                    type="primary"
                                    onClick={() => {
                                        onClickConfirm()
                                    }}
                                ></NormalButton>
                            </div>
                        </div>
                    </div>
                </div>
            </Shadow>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
)
