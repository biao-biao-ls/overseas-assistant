/**
 * 配置传输优化器
 * 优化配置数据的传输效率，支持数据压缩、增量更新和智能过滤
 */

import { UserConfig } from '../types/config'
import { configValidator } from './ConfigValidator'
import { AppUtil } from './AppUtil'

// 传输优化配置
export interface TransmissionConfig {
  enableCompression: boolean // 启用数据压缩
  enableIncrementalUpdate: boolean // 启用增量更新
  enableSmartFiltering: boolean // 启用智能过滤
  compressionThreshold: number // 压缩阈值（字节）
  maxPayloadSize: number // 最大载荷大小（字节）
  enableLogging: boolean // 启用日志
}

// 传输数据包
export interface TransmissionPacket {
  id: string
  type: 'full' | 'incremental' | 'compressed'
  timestamp: number
  size: number
  originalSize?: number
  compressionRatio?: number
  data: Partial<UserConfig>
  checksum?: string
}

// 传输结果
export interface TransmissionResult {
  success: boolean
  packetId: string
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  optimizationTime: number
  message?: string
}

export class ConfigTransmissionOptimizer {
  private static instance: ConfigTransmissionOptimizer
  private config: TransmissionConfig
  private lastTransmittedConfig: Partial<UserConfig> | null = null
  private transmissionHistory: TransmissionPacket[] = []
  private nextPacketId = 1

  private constructor() {
    this.config = {
      enableCompression: true,
      enableIncrementalUpdate: true,
      enableSmartFiltering: true,
      compressionThreshold: 1024, // 1KB
      maxPayloadSize: 10 * 1024, // 10KB
      enableLogging: true
    }
  }

  // 单例模式
  public static getInstance(): ConfigTransmissionOptimizer {
    if (!ConfigTransmissionOptimizer.instance) {
      ConfigTransmissionOptimizer.instance = new ConfigTransmissionOptimizer()
    }
    return ConfigTransmissionOptimizer.instance
  }

  /**
   * 优化配置数据传输
   */
  public optimizeTransmission(config: Partial<UserConfig>): TransmissionResult {
    const startTime = Date.now()
    const packetId = this.generatePacketId()

    try {
      // 1. 智能过滤
      let optimizedConfig = config
      if (this.config.enableSmartFiltering) {
        optimizedConfig = this.applySmartFiltering(config)
      }

      // 2. 增量更新
      let isIncremental = false
      if (this.config.enableIncrementalUpdate && this.lastTransmittedConfig) {
        const incrementalConfig = this.createIncrementalUpdate(optimizedConfig)
        if (Object.keys(incrementalConfig).length < Object.keys(optimizedConfig).length) {
          optimizedConfig = incrementalConfig
          isIncremental = true
        }
      }

      // 3. 序列化数据
      const serializedData = JSON.stringify(optimizedConfig)
      const originalSize = Buffer.byteLength(serializedData, 'utf8')

      // 4. 数据压缩
      let finalData = optimizedConfig
      let compressionRatio = 1
      let packetType: 'full' | 'incremental' | 'compressed' = isIncremental ? 'incremental' : 'full'

      if (this.config.enableCompression && originalSize > this.config.compressionThreshold) {
        const compressionResult = this.compressData(optimizedConfig)
        if (compressionResult.success) {
          finalData = compressionResult.data
          compressionRatio = compressionResult.ratio
          packetType = 'compressed'
        }
      }

      // 5. 检查载荷大小
      const finalSize = Buffer.byteLength(JSON.stringify(finalData), 'utf8')
      if (finalSize > this.config.maxPayloadSize) {
        throw new Error(`传输数据过大: ${finalSize} bytes > ${this.config.maxPayloadSize} bytes`)
      }

      // 6. 创建传输数据包
      const packet: TransmissionPacket = {
        id: packetId,
        type: packetType,
        timestamp: Date.now(),
        size: finalSize,
        originalSize,
        compressionRatio,
        data: finalData,
        checksum: this.calculateChecksum(finalData)
      }

      // 7. 记录传输历史
      this.recordTransmission(packet)

      // 8. 更新最后传输的配置
      this.lastTransmittedConfig = { ...this.lastTransmittedConfig, ...config }

      const result: TransmissionResult = {
        success: true,
        packetId,
        originalSize,
        optimizedSize: finalSize,
        compressionRatio,
        optimizationTime: Date.now() - startTime
      }

      if (this.config.enableLogging) {
        AppUtil.info('ConfigTransmissionOptimizer', 'optimizeTransmission', 
          `传输优化完成: ${packetId}, 原始大小: ${originalSize}B, 优化后: ${finalSize}B, 压缩比: ${compressionRatio.toFixed(2)}`)
      }

      return result

    } catch (error) {
      AppUtil.error('ConfigTransmissionOptimizer', 'optimizeTransmission', 
        `传输优化失败: ${packetId}`, error)

      return {
        success: false,
        packetId,
        originalSize: 0,
        optimizedSize: 0,
        compressionRatio: 1,
        optimizationTime: Date.now() - startTime,
        message: error.message
      }
    }
  }

  /**
   * 应用智能过滤
   */
  private applySmartFiltering(config: Partial<UserConfig>): Partial<UserConfig> {
    const filtered: Partial<UserConfig> = {}

    // 过滤掉空值、未定义值和默认值
    for (const [key, value] of Object.entries(config)) {
      if (this.shouldIncludeField(key, value)) {
        filtered[key] = value
      }
    }

    // 过滤掉不必要的数组数据（如果没有变化）
    if (this.lastTransmittedConfig) {
      for (const arrayField of ['countryList', 'languageList', 'rateList']) {
        if (filtered[arrayField] && this.lastTransmittedConfig[arrayField]) {
          if (JSON.stringify(filtered[arrayField]) === JSON.stringify(this.lastTransmittedConfig[arrayField])) {
            delete filtered[arrayField]
          }
        }
      }
    }

    return filtered
  }

  /**
   * 检查字段是否应该包含
   */
  private shouldIncludeField(key: string, value: any): boolean {
    // 排除空值和未定义值
    if (value === null || value === undefined) {
      return false
    }

    // 排除空字符串（除非是有意义的空字符串）
    if (typeof value === 'string' && value.trim() === '' && key !== 'proxyRules') {
      return false
    }

    // 排除空数组
    if (Array.isArray(value) && value.length === 0) {
      return false
    }

    // 排除空对象
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      return false
    }

    // 检查是否为默认值
    const defaultConfig = configValidator.getDefaultConfig()
    if (defaultConfig[key] !== undefined && JSON.stringify(value) === JSON.stringify(defaultConfig[key])) {
      return false
    }

    return true
  }

  /**
   * 创建增量更新
   */
  private createIncrementalUpdate(config: Partial<UserConfig>): Partial<UserConfig> {
    if (!this.lastTransmittedConfig) {
      return config
    }

    const incremental: Partial<UserConfig> = {}

    for (const [key, value] of Object.entries(config)) {
      const lastValue = this.lastTransmittedConfig[key]
      
      // 如果值发生了变化，包含在增量更新中
      if (JSON.stringify(value) !== JSON.stringify(lastValue)) {
        incremental[key] = value
      }
    }

    return incremental
  }

  /**
   * 压缩数据
   */
  private compressData(config: Partial<UserConfig>): { success: boolean, data: any, ratio: number } {
    try {
      // 简单的数据压缩策略
      const compressed = this.simpleCompress(config)
      const originalSize = Buffer.byteLength(JSON.stringify(config), 'utf8')
      const compressedSize = Buffer.byteLength(JSON.stringify(compressed), 'utf8')
      const ratio = originalSize / compressedSize

      return {
        success: ratio > 1.1, // 只有压缩比超过1.1才认为有效
        data: compressed,
        ratio
      }
    } catch (error) {
      return {
        success: false,
        data: config,
        ratio: 1
      }
    }
  }

  /**
   * 简单压缩算法
   */
  private simpleCompress(config: Partial<UserConfig>): any {
    const compressed: any = {}

    for (const [key, value] of Object.entries(config)) {
      // 压缩字符串值
      if (typeof value === 'string') {
        compressed[key] = this.compressString(value)
      }
      // 压缩数组
      else if (Array.isArray(value)) {
        compressed[key] = this.compressArray(value)
      }
      // 压缩对象
      else if (typeof value === 'object' && value !== null) {
        compressed[key] = this.compressObject(value)
      }
      // 其他类型直接保留
      else {
        compressed[key] = value
      }
    }

    return compressed
  }

  /**
   * 压缩字符串
   */
  private compressString(str: string): string {
    // 移除多余的空白字符
    return str.replace(/\s+/g, ' ').trim()
  }

  /**
   * 压缩数组
   */
  private compressArray(arr: any[]): any[] {
    // 移除重复项
    const unique = arr.filter((item, index, self) => 
      index === self.findIndex(t => JSON.stringify(t) === JSON.stringify(item))
    )
    
    return unique
  }

  /**
   * 压缩对象
   */
  private compressObject(obj: any): any {
    const compressed: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        compressed[key] = value
      }
    }
    
    return compressed
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16)
  }

  /**
   * 记录传输历史
   */
  private recordTransmission(packet: TransmissionPacket): void {
    this.transmissionHistory.push(packet)
    
    // 限制历史记录大小
    if (this.transmissionHistory.length > 100) {
      this.transmissionHistory = this.transmissionHistory.slice(-100)
    }
  }

  /**
   * 生成数据包ID
   */
  private generatePacketId(): string {
    return `packet-${this.nextPacketId++}-${Date.now()}`
  }

  /**
   * 获取传输统计信息
   */
  public getTransmissionStats(): {
    totalTransmissions: number
    averageCompressionRatio: number
    averageOptimizationTime: number
    totalBytesSaved: number
    transmissionsByType: Record<string, number>
  } {
    if (this.transmissionHistory.length === 0) {
      return {
        totalTransmissions: 0,
        averageCompressionRatio: 1,
        averageOptimizationTime: 0,
        totalBytesSaved: 0,
        transmissionsByType: {}
      }
    }

    let totalCompressionRatio = 0
    let totalBytesSaved = 0
    const transmissionsByType: Record<string, number> = {}

    for (const packet of this.transmissionHistory) {
      totalCompressionRatio += packet.compressionRatio || 1
      
      if (packet.originalSize && packet.size) {
        totalBytesSaved += packet.originalSize - packet.size
      }
      
      transmissionsByType[packet.type] = (transmissionsByType[packet.type] || 0) + 1
    }

    return {
      totalTransmissions: this.transmissionHistory.length,
      averageCompressionRatio: totalCompressionRatio / this.transmissionHistory.length,
      averageOptimizationTime: 0, // 需要从其他地方获取
      totalBytesSaved,
      transmissionsByType
    }
  }

  /**
   * 获取最近的传输记录
   */
  public getRecentTransmissions(count: number = 10): TransmissionPacket[] {
    return this.transmissionHistory.slice(-count)
  }

  /**
   * 重置传输状态
   */
  public resetTransmissionState(): void {
    this.lastTransmittedConfig = null
    this.transmissionHistory = []
    
    if (this.config.enableLogging) {
      AppUtil.info('ConfigTransmissionOptimizer', 'resetTransmissionState', '传输状态已重置')
    }
  }

  /**
   * 更新传输配置
   */
  public updateConfig(newConfig: Partial<TransmissionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (this.config.enableLogging) {
      AppUtil.info('ConfigTransmissionOptimizer', 'updateConfig', 
        `传输配置已更新: ${JSON.stringify(newConfig)}`)
    }
  }

  /**
   * 获取传输配置
   */
  public getConfig(): TransmissionConfig {
    return { ...this.config }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.transmissionHistory = []
    this.lastTransmittedConfig = null
    
    AppUtil.info('ConfigTransmissionOptimizer', 'cleanup', '传输优化器资源已清理')
  }
}

// 导出单例实例
export const configTransmissionOptimizer = ConfigTransmissionOptimizer.getInstance()

// 导出便捷函数
export const optimizeConfigTransmission = (config: Partial<UserConfig>) =>
  configTransmissionOptimizer.optimizeTransmission(config)