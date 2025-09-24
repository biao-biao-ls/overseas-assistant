/**
 * 增强的设置窗口组件
 * 集成新的错误处理和状态管理机制，提供更好的用户体验
 */

import React, { useRef, useEffect } from 'react'
import { SvgButton } from '../components/svgButton/svgButton'
import btnCloseNormal from '../../../assets/btn-wnd-close.svg'
import btnCloseHover from '../../../assets/btn-wnd-close-hover.svg'
import ComboBox from '../components/comboBox/Combobox'
import RadioButtonGroup from '../components/radioButtonGroup/RadioButtonGroup'
import { NormalButton } from '../components/normalButton/NormalButton'
import Shadow from '../components/shadow/shadow'
import { useEnhancedConfig } from './useEnhancedConfig'
import { ConfigSaveState } from './EnhancedSettingConfigHandler'
import { EMessage } from '../../enum/EMessage'
import { EWnd } from '../../enum/EWnd'
import { AppMsg } from '../../base/AppMsg'
import { ECommon } from '../../enum/ECommon'

import './setting.css'

const { ipcRenderer } = (window as any)['electron'] as any

const EnhancedSetting: React.FC = () => {
  // 使用增强配置Hook
  const {
    config,
    updateField,
    saveConfig,
    resetConfig,
    refreshConfig,
    hasUnsavedChanges,
    getValidationErrors,
    clearError
  } = useEnhancedConfig()

  // 组件引用
  const refProxy = useRef<any>(null)
  const refCountry = useRef<any>(null)
  const refLanguage = useRef<any>(null)
  const refRate = useRef<any>(null)
  const refExitRadio = useRef<any>(null)
  const refAutoStart = useRef<any>(null)
  const refShadow = useRef<any>(null)

  // 本地状态
  const [isDarwin, setIsDarwin] = React.useState(false)
  const [locale, setLocale] = React.useState<any>({})

  /**
   * 关闭窗口
   */
  const handleClose = () => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm('您有未保存的配置变更，确定要关闭吗？')
      if (!confirmed) {
        return
      }
    }
    ipcRenderer.send(EMessage.EWindowClose, EWnd.ESetting)
  }

  /**
   * 处理配置字段变更
   */
  const handleFieldChange = (field: string, value: any) => {
    updateField(field as any, value)
    clearError() // 清除错误状态
  }

  /**
   * 确认保存配置
   */
  const handleConfirm = async () => {
    try {
      await saveConfig()
    } catch (error) {
      // 保存配置失败
    }
  }

  /**
   * 取消操作
   */
  const handleCancel = () => {
    handleClose()
  }

  /**
   * 重置配置
   */
  const handleReset = async () => {
    const confirmed = window.confirm('确定要重置所有配置到默认值吗？此操作不可撤销。')
    if (confirmed) {
      try {
        await resetConfig()
      } catch (error) {
        // 重置配置失败
      }
    }
  }

  /**
   * 退出登录
   */
  const handleSignOut = () => {
    ipcRenderer.send(EMessage.EMainToViewMessage, { type: 'jlcone-logout' })
  }

  /**
   * 同步组件状态
   */
  const syncComponentStates = () => {
    if (refCountry.current && config.country) {
      refCountry.current.setSelectId(config.country)
    }
    if (refLanguage.current && config.language) {
      refLanguage.current.setSelectId(config.language)
    }
    if (refRate.current && config.rate) {
      refRate.current.setSelectId(config.rate)
    }
    if (refExitRadio.current) {
      refExitRadio.current.setSelectId(config.hideToTask)
    }
    if (refAutoStart.current) {
      refAutoStart.current.setSelectId(config.autoStart)
    }
    if (refProxy.current && config.proxyRules !== undefined) {
      refProxy.current.setValue(config.proxyRules)
    }
  }

  /**
   * 获取保存按钮状态
   */
  const getSaveButtonState = () => {
    if (config.saving) {
      return { disabled: true, text: locale.locale_saving || '保存中...' }
    }
    if (config.saveState === ConfigSaveState.SUCCESS) {
      return { disabled: false, text: locale.locale_saved || '已保存' }
    }
    if (hasUnsavedChanges()) {
      return { disabled: false, text: locale.locale_17 || 'Save' }
    }
    return { disabled: true, text: locale.locale_17 || 'Save' }
  }

  /**
   * 渲染错误信息
   */
  const renderErrorMessage = () => {
    if (!config.error) return null

    return (
      <div className="error-message" style={{ 
        color: 'red', 
        fontSize: '12px', 
        marginBottom: '10px',
        padding: '8px',
        backgroundColor: '#ffebee',
        border: '1px solid #ffcdd2',
        borderRadius: '4px'
      }}>
        {config.error}
        <button 
          onClick={clearError}
          style={{ 
            marginLeft: '10px', 
            background: 'none', 
            border: 'none', 
            color: 'red', 
            cursor: 'pointer' 
          }}
        >
          ×
        </button>
      </div>
    )
  }

  /**
   * 渲染验证错误
   */
  const renderValidationErrors = () => {
    const errors = getValidationErrors()
    if (errors.length === 0) return null

    return (
      <div className="validation-errors" style={{ 
        color: 'orange', 
        fontSize: '12px', 
        marginBottom: '10px' 
      }}>
        <ul>
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    )
  }

  /**
   * 渲染加载状态
   */
  const renderLoadingOverlay = () => {
    if (!config.loading) return null

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div>加载中...</div>
      </div>
    )
  }

  // 设置IPC监听器
  useEffect(() => {
    const handleMainMessage = (event: any, msg: AppMsg) => {
      if (msg.msgId === EMessage.ERenderUpdateSetting) {
        refreshConfig()
      } else if (msg.msgId === EMessage.ERenderSyncIsWin10) {
        const isWin10 = msg.data
        if (refShadow.current) {
          refShadow.current.showShadow(isWin10)
        }
      } else if (msg.msgId === EMessage.ERenderSyncIsDarwin) {
        setIsDarwin(msg.data)
      }
    }

    window[ECommon.ElectronEventListener]?.onMainMsg(handleMainMessage)

    // 获取本地化信息
    ipcRenderer.invoke(EMessage.EMainGetLocale).then((langMap: any) => {
      setLocale(langMap)
    })

    return () => {
      // 清理监听器
    }
  }, [refreshConfig])

  // 同步组件状态
  useEffect(() => {
    syncComponentStates()
  }, [config.country, config.language, config.rate, config.hideToTask, config.autoStart, config.proxyRules])

  // 准备选项数据
  const exitOptions = [
    { value: true, label: locale.locale_2 || '最小化到系统托盘' },
    { value: false, label: locale.locale_3 || '直接退出程序' },
  ]

  const autoStartOptions = [
    { value: true, label: locale.locale_5 || '开启' },
    { value: false, label: locale.locale_6 || '关闭' },
  ]

  const saveButtonState = getSaveButtonState()

  return (
    <div className="win_container" style={{ position: 'relative' }}>
      <Shadow ref={refShadow}>
        <div className="setting_container">
          <div className="setting_nav_bar">
            <div className="nav-title">
              <span>{locale.i18n_shared_739 || '设置'}</span>
            </div>
            <div className="nav_btn_list_setting">
              <SvgButton
                outSize="45px"
                imgSize="28px"
                normalIcon={btnCloseNormal}
                hoverIcon={btnCloseHover}
                onClick={handleClose}
              />
            </div>
          </div>
          
          <div className="setting_content">
            {/* 错误信息 */}
            {renderErrorMessage()}
            {renderValidationErrors()}

            {/* 国家 */}
            <div className="div_setting_item_row">
              <div className="div_scale_comboBox">
                <ComboBox
                  ref={refCountry}
                  title={locale.i18n_shared_772 || '国家/地区'}
                  selectType="country"
                  onChange={(type: string, value: string) => {
                    handleFieldChange('country', value)
                  }}
                  listCfg={config.countryList}
                />
              </div>
            </div>

            {/* 语言 */}
            <div className="div_setting_item_row">
              <div className="div_scale_comboBox">
                <ComboBox
                  ref={refLanguage}
                  title={locale.i18n_shared_882 || '语言'}
                  selectType="language"
                  onChange={(type: string, value: string) => {
                    handleFieldChange('language', value)
                  }}
                  listCfg={config.languageList}
                />
              </div>
            </div>

            {/* 汇率 */}
            <div className="div_setting_item_row">
              <div className="div_scale_comboBox">
                <ComboBox
                  ref={refRate}
                  title={locale.i18n_shared_883 || '货币'}
                  selectType="rate"
                  onChange={(type: string, value: string) => {
                    handleFieldChange('rate', value)
                  }}
                  listCfg={config.rateList}
                />
              </div>
            </div>

            {/* 退出程序 */}
            {!isDarwin && (
              <div className="div_setting_item_row div_setting_item_row_start">
                <div className="comboBox_item_name">{locale.locale_1 || '点击关闭按钮时'}</div>
                <div className="div_setting_col">
                  <RadioButtonGroup
                    ref={refExitRadio}
                    direction="col"
                    dictSelect={exitOptions}
                    onClick={(value: boolean) => {
                      handleFieldChange('hideToTask', value)
                    }}
                  />
                </div>
              </div>
            )}

            {/* 开机自启 */}
            <div className="div_setting_item_row">
              <div className="comboBox_item_name">{locale.locale_4 || '开机自启动'}</div>
              <div className="div_setting_col">
                <RadioButtonGroup
                  ref={refAutoStart}
                  direction="row"
                  dictSelect={autoStartOptions}
                  onClick={(value: boolean) => {
                    handleFieldChange('autoStart', value)
                  }}
                />
              </div>
            </div>

            {/* 版本信息 */}
            <div className="div_setting_item_row">
              <div className="comboBox_item_name">{locale.locale_12 || '版本'}</div>
              <div className="div_setting_col">
                <span className="span_form_label">{locale.locale_36 || '当前版本'}</span>
              </div>
            </div>

            {/* 用户信息 */}
            <div className="div_setting_item_row">
              <div className="comboBox_item_name">{locale.locale_14 || '当前用户'}</div>
              <div className="div_setting_col div_setting_inline">
                <span className="span_form_label">{config.username}</span>
                <NormalButton
                  text={locale.locale_15 || 'Sign Out'}
                  height="32px"
                  width="80px"
                  plain={true}
                  type="text"
                  onClick={handleSignOut}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="div_button_wrap">
              <div className="div_button">
                <NormalButton
                  text={locale.locale_reset || '重置'}
                  height="40px"
                  width="80px"
                  rounded={true}
                  type="text"
                  onClick={handleReset}
                  disabled={config.loading || config.saving}
                />
                <NormalButton
                  text={locale.locale_16 || 'Cancel'}
                  height="40px"
                  width="120px"
                  rounded={true}
                  onClick={handleCancel}
                  disabled={config.saving}
                />
                <NormalButton
                  text={saveButtonState.text}
                  height="40px"
                  width="120px"
                  rounded={true}
                  type="primary"
                  onClick={handleConfirm}
                  disabled={saveButtonState.disabled || config.loading}
                />
              </div>
            </div>
          </div>
        </div>
      </Shadow>
      
      {/* 加载遮罩 */}
      {renderLoadingOverlay()}
    </div>
  )
}

export default EnhancedSetting