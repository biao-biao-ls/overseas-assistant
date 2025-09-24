/**
 * 标签页加载监控器
 * 监控标签页的加载状态和性能
 */

export interface TabLoadingState {
  tabId: string;
  isLoading: boolean;
  loadStartTime?: number;
  loadEndTime?: number;
  loadDuration?: number;
  error?: string;
}

export interface LoadingMetrics {
  averageLoadTime: number;
  totalLoads: number;
  failedLoads: number;
  successRate: number;
}

export class TabLoadingMonitor {
  private tabStates: Map<string, TabLoadingState> = new Map();
  private loadingHistory: TabLoadingState[] = [];
  private maxHistorySize = 100;

  /**
   * 开始监控标签页加载
   */
  startLoading(tabId: string): void {
    const state: TabLoadingState = {
      tabId,
      isLoading: true,
      loadStartTime: Date.now()
    };
    
    this.tabStates.set(tabId, state);
  }

  /**
   * 结束标签页加载监控
   */
  endLoading(tabId: string, error?: string): void {
    const state = this.tabStates.get(tabId);
    if (!state) return;

    const endTime = Date.now();
    const updatedState: TabLoadingState = {
      ...state,
      isLoading: false,
      loadEndTime: endTime,
      loadDuration: state.loadStartTime ? endTime - state.loadStartTime : 0,
      error
    };

    this.tabStates.set(tabId, updatedState);
    this.addToHistory(updatedState);
  }

  /**
   * 获取标签页加载状态
   */
  getTabState(tabId: string): TabLoadingState | undefined {
    return this.tabStates.get(tabId);
  }

  /**
   * 获取所有标签页状态
   */
  getAllTabStates(): Map<string, TabLoadingState> {
    return new Map(this.tabStates);
  }

  /**
   * 获取加载指标
   */
  getLoadingMetrics(): LoadingMetrics {
    const completedLoads = this.loadingHistory.filter(state => !state.isLoading);
    const failedLoads = completedLoads.filter(state => state.error);
    
    const totalLoadTime = completedLoads.reduce((sum, state) => 
      sum + (state.loadDuration || 0), 0);

    return {
      averageLoadTime: completedLoads.length > 0 ? totalLoadTime / completedLoads.length : 0,
      totalLoads: completedLoads.length,
      failedLoads: failedLoads.length,
      successRate: completedLoads.length > 0 ? 
        (completedLoads.length - failedLoads.length) / completedLoads.length : 0
    };
  }

  /**
   * 清理标签页状态
   */
  removeTab(tabId: string): void {
    this.tabStates.delete(tabId);
  }

  /**
   * 清理所有状态
   */
  clear(): void {
    this.tabStates.clear();
    this.loadingHistory = [];
  }

  private addToHistory(state: TabLoadingState): void {
    this.loadingHistory.push({ ...state });
    
    if (this.loadingHistory.length > this.maxHistorySize) {
      this.loadingHistory.shift();
    }
  }

  /**
   * 初始化监控器
   */
  initialize(): void {
    // 初始化逻辑
    this.clear();
  }

  /**
   * 状态变更监听器
   */
  onStateChange(callback: (tabId: string, state: TabLoadingState) => void): void {
    // 这里可以添加状态变更监听逻辑
    // 简单实现，实际项目中可能需要更复杂的事件系统
  }

  /**
   * 开始监控
   */
  startMonitoring(tabId?: string, webContents?: any, url?: string): void {
    // 开始监控逻辑
    if (tabId) {
      this.startLoading(tabId);
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring(tabId?: string): void {
    // 停止监控逻辑
    if (tabId) {
      this.endLoading(tabId);
    }
  }

  /**
   * 获取Tab加载信息
   */
  getTabLoadingInfo(tabId: string): TabLoadingState | undefined {
    return this.getTabState(tabId);
  }

  /**
   * 强制设置Tab为就绪状态
   */
  forceReady(tabId: string): void {
    this.endLoading(tabId);
  }

  /**
   * 获取监控统计信息
   */
  getMonitoringStats(): LoadingMetrics {
    return this.getLoadingMetrics();
  }

  /**
   * 获取配置（占位方法）
   */
  getConfig(): any {
    return {
      maxHistorySize: this.maxHistorySize
    };
  }

  /**
   * 更新配置（占位方法）
   */
  updateConfig(config: any): void {
    if (config.maxHistorySize) {
      this.maxHistorySize = config.maxHistorySize;
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clear();
  }
}

// 导出单例实例
export const tabLoadingMonitor = new TabLoadingMonitor()