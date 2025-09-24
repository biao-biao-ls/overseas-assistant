/**
 * 配置操作结果工厂
 * 提供标准化的配置操作结果创建方法
 */

import { ConfigOperationResult, UserConfig } from '../types/config'

export class ConfigResultFactory {
  /**
   * 创建成功结果
   */
  public static success<T = Partial<UserConfig>>(message?: string, data?: T): ConfigOperationResult<T> {
    return {
      success: true,
      message: message || '操作成功',
      data
    }
  }

  /**
   * 创建失败结果
   */
  public static failure<T = Partial<UserConfig>>(message: string, errors?: string[]): ConfigOperationResult<T> {
    return {
      success: false,
      message,
      errors
    }
  }

  /**
   * 创建验证失败结果
   */
  public static validationFailure(errors: string[]): ConfigOperationResult {
    return {
      success: false,
      message: `配置验证失败: ${errors.join(', ')}`,
      errors
    }
  }

  /**
   * 创建网络错误结果
   */
  public static networkError(error?: Error): ConfigOperationResult {
    return {
      success: false,
      message: '网络连接异常，请稍后重试',
      errors: error ? [error.message] : undefined
    }
  }

  /**
   * 创建系统错误结果
   */
  public static systemError(error?: Error): ConfigOperationResult {
    return {
      success: false,
      message: '系统异常，请联系技术支持',
      errors: error ? [error.message] : undefined
    }
  }

  /**
   * 创建超时错误结果
   */
  public static timeoutError(): ConfigOperationResult {
    return {
      success: false,
      message: '操作超时，请稍后重试'
    }
  }

  /**
   * 创建权限错误结果
   */
  public static permissionError(): ConfigOperationResult {
    return {
      success: false,
      message: '权限不足，无法执行此操作'
    }
  }

  /**
   * 创建配置不存在错误结果
   */
  public static configNotFoundError(): ConfigOperationResult {
    return {
      success: false,
      message: '配置不存在或已损坏'
    }
  }

  /**
   * 从异常创建错误结果
   */
  public static fromError(error: Error): ConfigOperationResult {
    return {
      success: false,
      message: error.message,
      errors: [error.message]
    }
  }

  /**
   * 创建配置更新成功结果
   */
  public static configUpdated(changes: Partial<UserConfig>): ConfigOperationResult {
    const changedFields = Object.keys(changes)
    const hasChanges = changedFields.length > 0
    
    return {
      success: true,
      message: hasChanges 
        ? `配置更新成功，变更字段: ${changedFields.join(', ')}` 
        : '配置无变更',
      data: changes
    }
  }

  /**
   * 创建配置重置成功结果
   */
  public static configReset(): ConfigOperationResult {
    return {
      success: true,
      message: '配置已重置为默认值'
    }
  }

  /**
   * 创建配置同步成功结果
   */
  public static configSynced(targetCount: number): ConfigOperationResult {
    return {
      success: true,
      message: `配置已同步到 ${targetCount} 个目标`
    }
  }

  /**
   * 创建部分成功结果
   */
  public static partialSuccess(message: string, successCount: number, totalCount: number): ConfigOperationResult {
    return {
      success: successCount > 0,
      message: `${message} (成功: ${successCount}/${totalCount})`
    }
  }
}

// 导出工厂实例
export const configResultFactory = ConfigResultFactory