/**
 * 错误边界组件
 * 用于捕获和处理 React 组件中的错误
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error?: Error
    errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
        // 更新 state 使下一次渲染能够显示降级后的 UI
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 记录错误信息
        console.error('ErrorBoundary 捕获到错误:', error, errorInfo)
        this.setState({ error, errorInfo })
    }

    render() {
        if (this.state.hasError) {
            // 自定义降级 UI
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div style={{
                    padding: '20px',
                    background: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px',
                    margin: '10px',
                    color: '#856404'
                }}>
                    <h3>出现了一个错误</h3>
                    <details style={{ whiteSpace: 'pre-wrap', fontSize: '12px', marginTop: '10px' }}>
                        <summary>错误详情</summary>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo?.componentStack}
                    </details>
                    <button 
                        onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                        style={{
                            marginTop: '10px',
                            padding: '5px 10px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        重试
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}