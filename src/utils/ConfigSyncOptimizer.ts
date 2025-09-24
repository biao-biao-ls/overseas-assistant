/**
 * 配置同步优化器
 * 优化配置同步性能和效率
 */

export interface SyncOptimizationConfig {
  batchSize: number;
  debounceDelay: number;
  maxRetries: number;
  retryDelay: number;
  enableCompression: boolean;
  enableDelta: boolean;
  enableDebounce?: boolean;
  enableBatching?: boolean;
  enableSmartMerging?: boolean;
  batch?: any;
  debounce?: any;
}

export interface SyncOperation {
  id: string;
  type: 'update' | 'delete' | 'create';
  data: any;
  timestamp: number;
  priority: number;
}

export interface OptimizationMetrics {
  operationsProcessed: number;
  operationsBatched: number;
  averageBatchSize: number;
  compressionRatio: number;
  deltaReductionRatio: number;
  optimizationRate?: number;
  totalUpdates?: number;
}

export class ConfigSyncOptimizer {
  private config: SyncOptimizationConfig;
  private pendingOperations: SyncOperation[] = [];
  private processingQueue: SyncOperation[] = [];
  private metrics: OptimizationMetrics;

  constructor(config: Partial<SyncOptimizationConfig> = {}) {
    this.config = {
      batchSize: 10,
      debounceDelay: 100,
      maxRetries: 3,
      retryDelay: 1000,
      enableCompression: true,
      enableDelta: true,
      ...config
    };

    this.metrics = {
      operationsProcessed: 0,
      operationsBatched: 0,
      averageBatchSize: 0,
      compressionRatio: 1.0,
      deltaReductionRatio: 1.0
    };
  }

  /**
   * 添加同步操作
   */
  addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp'>): void {
    const syncOp: SyncOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now()
    };

    this.pendingOperations.push(syncOp);
    this.optimizeOperations();
  }

  /**
   * 获取待处理的操作批次
   */
  getNextBatch(): SyncOperation[] {
    const batchSize = Math.min(this.config.batchSize, this.processingQueue.length);
    const batch = this.processingQueue.splice(0, batchSize);
    
    if (batch.length > 0) {
      this.updateMetrics(batch);
    }

    return batch;
  }

  /**
   * 优化操作队列
   */
  private optimizeOperations(): void {
    // 去重操作
    this.deduplicateOperations();
    
    // 合并相似操作
    this.mergeOperations();
    
    // 按优先级排序
    this.sortByPriority();
    
    // 移动到处理队列
    this.processingQueue.push(...this.pendingOperations);
    this.pendingOperations = [];
  }

  /**
   * 去重操作
   */
  private deduplicateOperations(): void {
    const operationMap = new Map<string, SyncOperation>();
    
    for (const operation of this.pendingOperations) {
      const key = this.getOperationKey(operation);
      const existing = operationMap.get(key);
      
      if (!existing || operation.timestamp > existing.timestamp) {
        operationMap.set(key, operation);
      }
    }
    
    this.pendingOperations = Array.from(operationMap.values());
  }

  /**
   * 合并相似操作
   */
  private mergeOperations(): void {
    // 简单实现：按类型分组
    const grouped = new Map<string, SyncOperation[]>();
    
    for (const operation of this.pendingOperations) {
      const key = operation.type;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(operation);
    }
    
    // 这里可以添加更复杂的合并逻辑
    this.pendingOperations = Array.from(grouped.values()).flat();
  }

  /**
   * 按优先级排序
   */
  private sortByPriority(): void {
    this.pendingOperations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取操作键值
   */
  private getOperationKey(operation: SyncOperation): string {
    return `${operation.type}_${JSON.stringify(operation.data)}`;
  }

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新指标
   */
  private updateMetrics(batch: SyncOperation[]): void {
    this.metrics.operationsProcessed += batch.length;
    this.metrics.operationsBatched++;
    this.metrics.averageBatchSize = 
      this.metrics.operationsProcessed / this.metrics.operationsBatched;
  }

  /**
   * 获取优化指标
   */
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置优化器
   */
  reset(): void {
    this.pendingOperations = [];
    this.processingQueue = [];
    this.metrics = {
      operationsProcessed: 0,
      operationsBatched: 0,
      averageBatchSize: 0,
      compressionRatio: 1.0,
      deltaReductionRatio: 1.0
    };
  }

  /**
   * 获取配置
   */
  getConfig(): SyncOptimizationConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SyncOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 优化配置更新
   */
  optimizeConfigUpdate(config: any, source?: string, tabId?: string, priority?: number): void {
    this.addOperation({
      type: 'update',
      data: config,
      priority: priority || 1
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): OptimizationMetrics {
    return this.getMetrics();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.reset();
  }
}

// 导出单例实例
export const configSyncOptimizer = new ConfigSyncOptimizer()