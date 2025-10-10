/**
 * 增强配置管理 React Hook
 * 提供类型安全的配置状态管理和操作方法
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { UserConfig, ConfigOperationResult } from '../../types/config'
import { enhancedSettingConfigHandler, ConfigSaveState } from './EnhancedSettingConfigHandler'

// 配置状态接口
export interface ConfigState {
  // 配置数据
  country: string
  countryList: any[]
  language: string
  languageList: any[]
  rate: string
  rateList: any[]
  hideToTask: boolean
  autoStart: boolean
  openOrderNotification: boolean
  openMarketActivityNotification: boolean
  openCoummunityMessageNotification: boolean
  username: string
  
  // 状态标志
  loading: boolean
  saving: boolean
  error: string | null
  saveState: ConfigSaveState
  
  // 代理配置
  proxyRules: string
}

// Hook返回值接口
export interface UseEnhancedConfigReturn {
  // 状态
  config: ConfigState
  
  // 操作方法
  updateField: (field: keyof ConfigState, value: any) => void
  saveConfig: () => Promise<void>
  resetConfig: () => Promise<void>
  refreshConfig: () => Promise<void>
  
  // 工具方法
  hasUnsavedChanges: () => boolean
  getValidationErrors: () => string[]
  clearError: () => void
}

export function useEnhancedConfig(): UseEnhancedConfigReturn {
  // 配置状态
  const [config, setConfig] = useState<ConfigState>({
    country: '',
    countryList: [],
    language: '',
    languageList: [],
    rate: '',
    rateList: [],
    hideToTask: true,
    autoStart: false,
    openOrderNotification: true,
    openMarketActivityNotification: true,
    openCoummunityMessageNotification: true,
    username: '',
    loading: false,
    saving: false,
    error: null,
    saveState: ConfigSaveState.IDLE,
    proxyRules: ''
  })

  // 原始配置（用于检测变更）
  const originalConfigRef = useRef<Partial<ConfigState>>({})
  
  // 保存状态监听器清理函数
  const saveStateListenerCleanupRef = useRef<(() => void) | null>(null)

  /**
   * 更新配置字段
   */
  const updateField = useCallback((field: keyof ConfigState, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
      error: null // 清除错误状态
    }))
  }, [])

  /**
   * 加载配置
   */
  const loadConfig = useCallback(async () => {
    try {
      setConfig(prev => ({ ...prev, loading: true, error: null }))

      // 获取用户配置
      const configResult = await enhancedSettingConfigHandler.getUserConfig()
      
      if (configResult.success && configResult.data) {
        const formattedConfig = enhancedSettingConfigHandler.formatConfigForDisplay(configResult.data)
        
        setConfig(prev => ({
          ...prev,
          ...formattedConfig,
          loading: false
        }))
        
        // 保存原始配置
        originalConfigRef.current = { ...formattedConfig }
      } else {
        throw new Error(configResult.message || '配置加载失败')
      }

      // 获取代理配置
      const { ipcRenderer } = (window as any)['electron'] as any
      const proxyResult = await ipcRenderer.invoke('EGetProxy')
      const proxyRules = proxyResult?.proxyRules || ''
      
      setConfig(prev => ({ ...prev, proxyRules }))
      originalConfigRef.current.proxyRules = proxyRules

    } catch (error) {
      // 加载配置失败
      setConfig(prev => ({
        ...prev,
        loading: false,
        error: error.message || '配置加载失败'
      }))
    }
  }, [])

  /**
   * 保存配置
   */
  const saveConfig = useCallback(async () => {
    try {
      setConfig(prev => ({ ...prev, saving: true, error: null }))

      // 创建配置对象
      const configToSave = enhancedSettingConfigHandler.createConfigObject({
        country: config.country,
        language: config.language,
        rate: config.rate,
        hideToTask: config.hideToTask,
        autoStart: config.autoStart,
        openOrderNotification: config.openOrderNotification,
        openMarketActivityNotification: config.openMarketActivityNotification,
        openCoummunityMessageNotification: config.openCoummunityMessageNotification
      })

      // 保存配置并关闭窗口
      await enhancedSettingConfigHandler.saveConfigAndClose(configToSave, config.proxyRules)

    } catch (error) {
      // 保存配置失败
      setConfig(prev => ({
        ...prev,
        saving: false,
        error: error.message || '配置保存失败'
      }))
    }
  }, [config])

  /**
   * 重置配置
   */
  const resetConfig = useCallback(async () => {
    try {
      setConfig(prev => ({ ...prev, loading: true, error: null }))

      const result = await enhancedSettingConfigHandler.resetConfig()
      
      if (result.success) {
        // 重新加载配置
        await loadConfig()
      } else {
        throw new Error(result.message || '配置重置失败')
      }

    } catch (error) {
      // 重置配置失败
      setConfig(prev => ({
        ...prev,
        loading: false,
        error: error.message || '配置重置失败'
      }))
    }
  }, [loadConfig])

  /**
   * 刷新配置
   */
  const refreshConfig = useCallback(async () => {
    await loadConfig()
  }, [loadConfig])

  /**
   * 检查是否有未保存的变更
   */
  const hasUnsavedChanges = useCallback(() => {
    const current = {
      country: config.country,
      language: config.language,
      rate: config.rate,
      hideToTask: config.hideToTask,
      autoStart: config.autoStart,
      openOrderNotification: config.openOrderNotification,
      openMarketActivityNotification: config.openMarketActivityNotification,
      openCoummunityMessageNotification: config.openCoummunityMessageNotification,
      proxyRules: config.proxyRules
    }

    const original = originalConfigRef.current

    return Object.keys(current).some(key => 
      current[key] !== original[key]
    )
  }, [config])

  /**
   * 获取验证错误
   */
  const getValidationErrors = useCallback(() => {
    const errors = enhancedSettingConfigHandler.getValidationErrors()
    return errors.map(error => `${error.field}: ${error.message}`)
  }, [])

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setConfig(prev => ({ ...prev, error: null }))
    enhancedSettingConfigHandler.clearValidationErrors()
  }, [])

  /**
   * 设置保存状态监听器
   */
  useEffect(() => {
    const cleanup = enhancedSettingConfigHandler.onSaveStateChange((saveState) => {
      setConfig(prev => ({
        ...prev,
        saveState,
        saving: saveState === ConfigSaveState.SAVING
      }))
    })

    saveStateListenerCleanupRef.current = cleanup

    return () => {
      if (saveStateListenerCleanupRef.current) {
        saveStateListenerCleanupRef.current()
      }
    }
  }, [])

  /**
   * 初始化加载配置
   */
  useEffect(() => {
    loadConfig()
    
    // 清理函数
    return () => {
      enhancedSettingConfigHandler.cleanup()
    }
  }, [loadConfig])

  /**
   * 监听窗口关闭事件，检查未保存的变更
   */
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        event.preventDefault()
        event.returnValue = '您有未保存的配置变更，确定要离开吗？'
        return event.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  return {
    config,
    updateField,
    saveConfig,
    resetConfig,
    refreshConfig,
    hasUnsavedChanges,
    getValidationErrors,
    clearError
  }
}

// 导出配置字段类型（用于类型安全）
export type ConfigField = keyof ConfigState