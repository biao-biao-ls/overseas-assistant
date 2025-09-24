/**
 * 配置性能优化器
 * 基于运行时数据和测试结果动态优化配置同步性能
 */

import { configSyncOptimizer } from './ConfigSyncOptimizer'
import { configLogger } from './ConfigLogger'
import { tabLoadingMonitor } from './TabLoadingMonitor'
import { configSyncIntegration } from '../integration/ConfigSyncIntegration'
import { ConfigUpdateSource, UserConfig } from '../types/config'

// 性能指标
export interface PerformanceMetrics {
  avgSyncTime: number
  successRate: number
  errorRate: number
  throughput: number // 每秒处理的配置更新数
  memoryUsage: number
  cpuUsage: number
  networkLatency: number
}

// 优化建议
export interface OptimizationRecommendation {
  category: 'debounce' | 'batch' | 'retry' | 'memory' | 'network'
  priority: 'high' | 'medium' | 'low'
  description: string
  currentValue: any
  recommendedValue: any
  expectedImprovement: string
}

// 性能配置文件
export interface PerformanceProfile {
  name: string
  description: string
  config: {
    debounceDelay: number
    batchSize: number
    batchTimeout: number
    maxRetries: number
    retryDelay: number
    loadTimeout: number
    enableOptimization: boolean
  }
  targetScenario: string
}

export class ConfigPerformanceOptimizer {
  private static instance: ConfigPerformanceOptimizer
  private metrics: PerformanceMetrics
  private metricsHistory: PerformanceMetrics[] = []
  private optimizationHistory: OptimizationRecommendation[] = []
  private isMonitoring = false
  private monitoringInterval: NodeJS.Timeout | null = null
  
  // 预定义性能配置文件
  private profiles: Map<string, PerformanceProfile> = new Map()

  private constructor() {
    this.metrics = {
      avgSyncTime: 0,
      successRate: 1,
      errorRate: 0,
      throughput: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      networkLatency: 0
    }
    
    this.initializeProfiles()
  }

  // 单例模式
  public static getInstance(): ConfigPerformanceOptimizer {
    if (!ConfigPerformanceOptimizer.instance) {
      ConfigPerformanceOptimizer.instance = new ConfigPerformanceOptimizer()
    }
    return ConfigPerformanceOptimizer.instance
  }

  /**
   * 初始化性能配置文件
   */
  private initializeProfiles(): void {
    // 高性能配置文件
    this.profiles.set('high-performance', {
      name: '高性能',
      description: '优化响应速度，适合实时交互场景',
      config: {
        debounceDelay: 100,
        batchSize: 5,
        batchTimeout: 200,
        maxRetries: 2,
        retryDelay: 500,
        loadTimeout: 5000,
        enableOptimization: true
      },
      targetScenario: '实时配置更新，低延迟要求'
    })

    // 高吞吐量配置文件
    this.profiles.set('high-throughput', {
      name: '高吞吐量',
      description: '优化处理能力，适合批量操作场景',
      config: {
        debounceDelay: 500,
        batchSize: 20,
        batchTimeout: 1000,
        maxRetries: 3,
        retryDelay: 1000,
        loadTimeout: 10000,
        enableOptimization: true
      },
      targetScenario: '批量配置更新，高并发场景'
    })

    // 节能配置文件
    this.profiles.set('power-saving', {
      name: '节能模式',
      description: '优化资源使用，适合移动设备或低功耗场景',
      config: {
        debounceDelay: 1000,
        batchSize: 10,
        batchTimeout: 2000,
        maxRetries: 1,
        retryDelay: 2000,
        loadTimeout: 15000,
        enableOptimization: true
      },
      targetScenario: '移动设备，电池优化'
    })

    // 平衡配置文件
    this.profiles.set('balanced', {
      name: '平衡模式',
      description: '平衡性能和资源使用，适合大多数场景',
      config: {
        debounceDelay: 300,
        batchSize: 10,
        batchTimeout: 500,
        maxRetries: 3,
        retryDelay: 1000,
        loadTimeout: 8000,
        enableOptimization: true
      },
      targetScenario: '通用场景，默认推荐'
    })
  }

  /**
   * 开始性能监控
   */
  public startMonitoring(interval: number = 5000): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, interval)

    configLogger.logConfigChange('startMonitoring', 'ConfigPerformanceOptimizer', 
      null, {}, true, `性能监控已启动，间隔: ${interval}ms`)
  }

  /**
   * 停止性能监控
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    configLogger.logConfigChange('stopMonitoring', 'ConfigPerformanceOptimizer', 
      null, {}, true, '性能监控已停止')
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      // 获取配置同步统计
      const syncStats = configSyncOptimizer.getStats()
      const integrationStatus = configSyncIntegration.getStatus()
      
      // 获取Tab监控统计
      const tabStats = tabLoadingMonitor.getMonitoringStats()
      
      // 获取系统资源使用情况
      const memoryUsage = process.memoryUsage()
      
      // 更新指标
      this.metrics = {
        avgSyncTime: integrationStatus.performanceMetrics.avgSyncTime,
        successRate: integrationStatus.performanceMetrics.successRate,
        errorRate: integrationStatus.errorCount / Math.max(syncStats.totalUpdates, 1),
        throughput: this.calculateThroughput(syncStats),
        memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
        cpuUsage: this.estimateCpuUsage(),
        networkLatency: tabStats.averageLoadTime
      }
      
      // 保存历史记录
      this.metricsHistory.push({ ...this.metrics })
      
      // 限制历史记录长度
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift()
      }
      
      // 检查是否需要优化
      this.checkForOptimizationOpportunities()
      
    } catch (error) {
      configLogger.logError('collectMetrics', 'ConfigPerformanceOptimizer', error)
    }
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(stats: any): number {
    // 简化的吞吐量计算
    const timeWindow = 60000 // 1分钟
    const recentHistory = this.metricsHistory.slice(-12) // 最近12个数据点（1分钟）
    
    if (recentHistory.length < 2) {
      return 0
    }
    
    return stats.totalUpdates / (timeWindow / 1000) // 每秒更新数
  }

  /**
   * 估算CPU使用率
   */
  private estimateCpuUsage(): number {
    // 简化的CPU使用率估算
    // 实际项目中可能需要使用更精确的方法
    const usage = process.cpuUsage()
    return (usage.user + usage.system) / 1000000 // 转换为秒
  }

  /**
   * 检查优化机会
   */
  private checkForOptimizationOpportunities(): void {
    const recommendations: OptimizationRecommendation[] = []
    
    // 检查成功率
    if (this.metrics.successRate < 0.95) {
      recommendations.push({
        category: 'retry',
        priority: 'high',
        description: '成功率过低，建议增加重试次数或延长重试间隔',
        currentValue: configSyncOptimizer.getConfig().batch.maxRetries || 3,
        recommendedValue: Math.min(5, (configSyncOptimizer.getConfig().batch.maxRetries || 3) + 1),
        expectedImprovement: '提高5-10%成功率'
      })
    }
    
    // 检查响应时间
    if (this.metrics.avgSyncTime > 1000) {
      recommendations.push({
        category: 'debounce',
        priority: 'medium',
        description: '平均同步时间过长，建议减少防抖延迟',
        currentValue: configSyncOptimizer.getConfig().debounce.delay,
        recommendedValue: Math.max(100, configSyncOptimizer.getConfig().debounce.delay - 100),
        expectedImprovement: '减少10-20%响应时间'
      })
    }
    
    // 检查内存使用
    if (this.metrics.memoryUsage > 100) { // 100MB
      recommendations.push({
        category: 'memory',
        priority: 'medium',
        description: '内存使用过高，建议减少批处理大小',
        currentValue: configSyncOptimizer.getConfig().batch.maxBatchSize,
        recommendedValue: Math.max(5, configSyncOptimizer.getConfig().batch.maxBatchSize - 5),
        expectedImprovement: '减少20-30%内存使用'
      })
    }
    
    // 检查网络延迟
    if (this.metrics.networkLatency > 5000) {
      recommendations.push({
        category: 'network',
        priority: 'high',
        description: '网络延迟过高，建议增加加载超时时间',
        currentValue: tabLoadingMonitor.getConfig().loadTimeout,
        recommendedValue: Math.min(30000, tabLoadingMonitor.getConfig().loadTimeout + 5000),
        expectedImprovement: '减少超时错误'
      })
    }
    
    // 保存建议
    recommendations.forEach(rec => {
      this.optimizationHistory.push(rec)
    })
    
    // 限制历史记录长度
    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory.splice(0, this.optimizationHistory.length - 50)
    }
    
    // 自动应用高优先级建议
    this.autoApplyRecommendations(recommendations.filter(r => r.priority === 'high'))
  }

  /**
   * 自动应用优化建议
   */
  private autoApplyRecommendations(recommendations: OptimizationRecommendation[]): void {
    for (const rec of recommendations) {
      try {
        switch (rec.category) {
          case 'debounce':
            configSyncOptimizer.updateConfig({
              debounce: {
                ...configSyncOptimizer.getConfig().debounce,
                delay: rec.recommendedValue
              }
            })
            break
            
          case 'batch':
            configSyncOptimizer.updateConfig({
              batch: {
                ...configSyncOptimizer.getConfig().batch,
                maxBatchSize: rec.recommendedValue
              }
            })
            break
            
          case 'retry':
            configSyncOptimizer.updateConfig({
              batch: {
                ...configSyncOptimizer.getConfig().batch,
                maxRetries: rec.recommendedValue
              }
            })
            break
            
          case 'network':
            tabLoadingMonitor.updateConfig({
              loadTimeout: rec.recommendedValue
            })
            break
        }
        
        configLogger.logConfigChange('autoApplyRecommendations', 'ConfigPerformanceOptimizer',
          null, {}, true, `自动应用优化建议: ${rec.description}`, undefined, undefined, {
            category: rec.category,
            from: rec.currentValue,
            to: rec.recommendedValue
          })
          
      } catch (error) {
        configLogger.logError('autoApplyRecommendations', 'ConfigPerformanceOptimizer', error)
      }
    }
  }

  /**
   * 应用性能配置文件
   */
  public applyProfile(profileName: string): boolean {
    const profile = this.profiles.get(profileName)
    if (!profile) {
      configLogger.logWarning('applyProfile', 'ConfigPerformanceOptimizer',
        `性能配置文件不存在: ${profileName}`)
      return false
    }

    try {
      // 应用配置同步优化器设置
      configSyncOptimizer.updateConfig({
        enableDebounce: profile.config.enableOptimization,
        enableBatching: profile.config.enableOptimization,
        debounce: {
          ...configSyncOptimizer.getConfig().debounce,
          delay: profile.config.debounceDelay
        },
        batch: {
          ...configSyncOptimizer.getConfig().batch,
          maxBatchSize: profile.config.batchSize,
          maxWaitTime: profile.config.batchTimeout
        }
      })

      // 应用Tab监控设置
      tabLoadingMonitor.updateConfig({
        loadTimeout: profile.config.loadTimeout,
        maxRetries: profile.config.maxRetries,
        retryDelay: profile.config.retryDelay
      })

      configLogger.logConfigChange('applyProfile', 'ConfigPerformanceOptimizer',
        null, {} as Partial<UserConfig>, true, `已应用性能配置文件: ${profile.name}`, undefined, undefined, { config: profile.config })

      return true

    } catch (error) {
      configLogger.logError('applyProfile', 'ConfigPerformanceOptimizer', error)
      return false
    }
  }

  /**
   * 获取当前性能指标
   */
  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取性能历史
   */
  public getMetricsHistory(limit?: number): PerformanceMetrics[] {
    const history = [...this.metricsHistory]
    return limit ? history.slice(-limit) : history
  }

  /**
   * 获取优化建议
   */
  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    return [...this.optimizationHistory]
  }

  /**
   * 获取可用的性能配置文件
   */
  public getAvailableProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values())
  }

  /**
   * 创建自定义性能配置文件
   */
  public createCustomProfile(
    name: string,
    description: string,
    config: PerformanceProfile['config'],
    targetScenario: string
  ): boolean {
    if (this.profiles.has(name)) {
      configLogger.logWarning('createCustomProfile', 'ConfigPerformanceOptimizer',
        `性能配置文件已存在: ${name}`)
      return false
    }

    const profile: PerformanceProfile = {
      name,
      description,
      config,
      targetScenario
    }

    this.profiles.set(name, profile)

    configLogger.logConfigChange('createCustomProfile', 'ConfigPerformanceOptimizer',
      null, {}, true, `已创建自定义性能配置文件: ${name}`)

    return true
  }

  /**
   * 性能基准测试
   */
  public async runBenchmark(
    testDuration: number = 30000,
    updateFrequency: number = 100
  ): Promise<{
    profile: string
    metrics: PerformanceMetrics
    recommendations: OptimizationRecommendation[]
  }> {
    configLogger.logConfigChange('runBenchmark', 'ConfigPerformanceOptimizer',
      null, {}, true, `开始性能基准测试，持续时间: ${testDuration}ms`)

    const startTime = Date.now()
    const initialMetrics = { ...this.metrics }
    let updateCount = 0

    // 开始监控
    this.startMonitoring(1000)

    try {
      // 模拟配置更新负载
      const testInterval = setInterval(async () => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(testInterval)
          return
        }

        // 模拟配置更新
        try {
          await configSyncIntegration.updateConfig(
            { country: `benchmark-${updateCount++}` },
            ConfigUpdateSource.SETTING_WINDOW,
            `benchmark-tab-${updateCount % 5}`
          )
        } catch (error) {
          // 忽略测试中的错误
        }
      }, updateFrequency)

      // 等待测试完成
      await new Promise(resolve => setTimeout(resolve, testDuration))

      // 收集最终指标
      this.collectMetrics()
      const finalMetrics = { ...this.metrics }

      // 生成建议
      const recommendations = this.generateBenchmarkRecommendations(
        initialMetrics,
        finalMetrics,
        updateCount,
        testDuration
      )

      // 确定最佳配置文件
      const bestProfile = this.determineBestProfile(finalMetrics)

      configLogger.logConfigChange('runBenchmark', 'ConfigPerformanceOptimizer',
        null, {}, true, `基准测试完成，处理了 ${updateCount} 个更新`, undefined, undefined, {
          bestProfile,
          finalMetrics
        })

      return {
        profile: bestProfile,
        metrics: finalMetrics,
        recommendations
      }

    } finally {
      this.stopMonitoring()
    }
  }

  /**
   * 生成基准测试建议
   */
  private generateBenchmarkRecommendations(
    initial: PerformanceMetrics,
    final: PerformanceMetrics,
    updateCount: number,
    duration: number
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = []

    // 分析吞吐量
    const actualThroughput = updateCount / (duration / 1000)
    if (actualThroughput < 10) {
      recommendations.push({
        category: 'batch',
        priority: 'high',
        description: '吞吐量较低，建议增加批处理大小',
        currentValue: configSyncOptimizer.getConfig().batch.maxBatchSize,
        recommendedValue: Math.min(50, configSyncOptimizer.getConfig().batch.maxBatchSize * 2),
        expectedImprovement: '提高50-100%吞吐量'
      })
    }

    // 分析响应时间
    if (final.avgSyncTime > initial.avgSyncTime * 1.5) {
      recommendations.push({
        category: 'debounce',
        priority: 'medium',
        description: '响应时间增长过快，建议优化防抖设置',
        currentValue: configSyncOptimizer.getConfig().debounce.delay,
        recommendedValue: Math.max(50, configSyncOptimizer.getConfig().debounce.delay / 2),
        expectedImprovement: '减少30-50%响应时间'
      })
    }

    // 分析内存使用
    if (final.memoryUsage > initial.memoryUsage * 2) {
      recommendations.push({
        category: 'memory',
        priority: 'high',
        description: '内存使用增长过快，存在内存泄漏风险',
        currentValue: 'current',
        recommendedValue: 'optimized',
        expectedImprovement: '稳定内存使用'
      })
    }

    return recommendations
  }

  /**
   * 确定最佳性能配置文件
   */
  private determineBestProfile(metrics: PerformanceMetrics): string {
    // 基于当前指标确定最适合的配置文件
    if (metrics.avgSyncTime < 200 && metrics.successRate > 0.98) {
      return 'high-performance'
    } else if (metrics.throughput > 50 && metrics.memoryUsage < 50) {
      return 'high-throughput'
    } else if (metrics.memoryUsage < 30 && metrics.cpuUsage < 10) {
      return 'power-saving'
    } else {
      return 'balanced'
    }
  }

  /**
   * 获取性能报告
   */
  public generatePerformanceReport(): {
    summary: {
      currentProfile: string
      overallHealth: 'excellent' | 'good' | 'fair' | 'poor'
      keyMetrics: PerformanceMetrics
    }
    trends: {
      improving: string[]
      declining: string[]
      stable: string[]
    }
    recommendations: OptimizationRecommendation[]
    nextSteps: string[]
  } {
    const currentMetrics = this.getCurrentMetrics()
    const recentHistory = this.getMetricsHistory(10)
    
    // 计算健康状态
    let healthScore = 0
    if (currentMetrics.successRate > 0.95) healthScore += 25
    if (currentMetrics.avgSyncTime < 500) healthScore += 25
    if (currentMetrics.errorRate < 0.05) healthScore += 25
    if (currentMetrics.memoryUsage < 100) healthScore += 25
    
    const overallHealth = 
      healthScore >= 90 ? 'excellent' :
      healthScore >= 70 ? 'good' :
      healthScore >= 50 ? 'fair' : 'poor'
    
    // 分析趋势
    const trends = this.analyzeTrends(recentHistory)
    
    // 获取建议
    const recommendations = this.getOptimizationRecommendations().slice(-5)
    
    // 生成下一步建议
    const nextSteps = this.generateNextSteps(overallHealth, trends, recommendations)
    
    return {
      summary: {
        currentProfile: this.determineBestProfile(currentMetrics),
        overallHealth,
        keyMetrics: currentMetrics
      },
      trends,
      recommendations,
      nextSteps
    }
  }

  /**
   * 分析性能趋势
   */
  private analyzeTrends(history: PerformanceMetrics[]): {
    improving: string[]
    declining: string[]
    stable: string[]
  } {
    if (history.length < 3) {
      return { improving: [], declining: [], stable: ['数据不足'] }
    }

    const recent = history.slice(-3)
    const older = history.slice(-6, -3)
    
    const improving: string[] = []
    const declining: string[] = []
    const stable: string[] = []
    
    const metrics = ['successRate', 'avgSyncTime', 'throughput', 'memoryUsage'] as const
    
    for (const metric of metrics) {
      const recentAvg = recent.reduce((sum, m) => sum + m[metric], 0) / recent.length
      const olderAvg = older.reduce((sum, m) => sum + m[metric], 0) / older.length
      
      const change = (recentAvg - olderAvg) / olderAvg
      
      if (Math.abs(change) < 0.05) {
        stable.push(metric)
      } else if (
        (metric === 'successRate' || metric === 'throughput') && change > 0 ||
        (metric === 'avgSyncTime' || metric === 'memoryUsage') && change < 0
      ) {
        improving.push(metric)
      } else {
        declining.push(metric)
      }
    }
    
    return { improving, declining, stable }
  }

  /**
   * 生成下一步建议
   */
  private generateNextSteps(
    health: string,
    trends: any,
    recommendations: OptimizationRecommendation[]
  ): string[] {
    const steps: string[] = []
    
    if (health === 'poor') {
      steps.push('立即检查系统配置和网络连接')
      steps.push('考虑应用高性能配置文件')
    } else if (health === 'fair') {
      steps.push('应用相关优化建议')
      steps.push('增加监控频率以识别问题')
    }
    
    if (trends.declining.length > 0) {
      steps.push(`关注性能下降指标: ${trends.declining.join(', ')}`)
    }
    
    if (recommendations.length > 0) {
      steps.push('考虑应用最新的优化建议')
    }
    
    if (steps.length === 0) {
      steps.push('系统运行良好，继续监控')
    }
    
    return steps
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopMonitoring()
    this.metricsHistory = []
    this.optimizationHistory = []
    
    configLogger.logConfigChange('cleanup', 'ConfigPerformanceOptimizer',
      null, {}, true, '性能优化器已清理')
  }
}

// 导出单例实例
export const configPerformanceOptimizer = ConfigPerformanceOptimizer.getInstance()

// 导出便捷函数
export const startPerformanceMonitoring = (interval?: number) =>
  configPerformanceOptimizer.startMonitoring(interval)

export const applyPerformanceProfile = (profileName: string) =>
  configPerformanceOptimizer.applyProfile(profileName)

export const runPerformanceBenchmark = (duration?: number, frequency?: number) =>
  configPerformanceOptimizer.runBenchmark(duration, frequency)

export const getPerformanceReport = () =>
  configPerformanceOptimizer.generatePerformanceReport()