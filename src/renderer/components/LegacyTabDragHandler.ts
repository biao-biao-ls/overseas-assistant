/**
 * 旧版 Tab 系统的拖拽处理器
 * 为现有的 Tab 系统添加拖拽重排功能
 */

/**
 * 拖拽状态接口
 */
interface LegacyDragState {
    isDragging: boolean
    dragElement: HTMLElement | null
    dragPreview: HTMLElement | null
    dropIndicator: HTMLElement | null
    startPosition: { x: number; y: number }
    dragThreshold: number
    originalIndex: number
    currentIndex: number
}

/**
 * 旧版 Tab 拖拽处理器
 */
export class LegacyTabDragHandler {
    private dragState: LegacyDragState
    private tabContainer: HTMLElement | null = null
    private onReorderCallback: ((fromIndex: number, toIndex: number) => void) | null = null
    private setUserReordering: ((reordering: boolean) => void) | null = null

    constructor() {
        this.dragState = {
            isDragging: false,
            dragElement: null,
            dragPreview: null,
            dropIndicator: null,
            startPosition: { x: 0, y: 0 },
            dragThreshold: 5,
            originalIndex: -1,
            currentIndex: -1
        }

        this.setupGlobalEventListeners()
        console.log('LegacyTabDragHandler', '初始化旧版拖拽处理器')
    }

    /**
     * 设置全局事件监听器
     */
    private setupGlobalEventListeners(): void {
        document.addEventListener('mousemove', (event) => {
            // 处理拖拽移动，包括检查是否应该开始拖拽
            if (this.dragState.isDragging || this.dragState.dragElement) {
                this.handleDragMove(event)
            }
        })

        document.addEventListener('mouseup', (event) => {
            // 处理拖拽结束，包括纯点击事件
            if (this.dragState.isDragging || this.dragState.dragElement) {
                this.handleDragEnd(event)
            }
        })
    }

    /**
     * 初始化拖拽容器
     * @param container Tab 容器元素
     * @param onReorder 重排回调函数
     */
    public initialize(
        container: HTMLElement, 
        onReorder: (fromIndex: number, toIndex: number) => void,
        setUserReordering?: (reordering: boolean) => void
    ): void {
        this.tabContainer = container
        this.onReorderCallback = onReorder
        this.setUserReordering = setUserReordering

        // 为所有 Tab 元素添加拖拽事件监听器
        this.setupTabEventListeners()
    }

    /**
     * 设置 Tab 事件监听器
     */
    private setupTabEventListeners(): void {
        if (!this.tabContainer) {
            console.error('LegacyTabDragHandler', 'Tab 容器不存在，无法设置事件监听器')
            return
        }

        console.log('LegacyTabDragHandler', '设置事件监听器', {
            container: this.tabContainer,
            containerClassName: this.tabContainer.className,
            childrenCount: this.tabContainer.children.length
        })

        // 移除之前的监听器（如果存在）
        this.tabContainer.removeEventListener('mousedown', this.handleMouseDown)

        // 使用事件委托处理所有 Tab 的鼠标事件
        this.tabContainer.addEventListener('mousedown', this.handleMouseDown)
        
        // 添加一个测试监听器确认事件绑定成功
        this.tabContainer.addEventListener('click', (e) => {
            console.log('LegacyTabDragHandler', '容器点击事件触发', {
                target: e.target,
                targetClassName: (e.target as HTMLElement).className
            })
        })

        console.log('LegacyTabDragHandler', '事件监听器设置完成')
    }

    /**
     * 处理鼠标按下事件
     */
    private handleMouseDown = (event: MouseEvent) => {
        console.log('LegacyTabDragHandler', '鼠标按下事件触发', {
            target: event.target,
            targetClassName: (event.target as HTMLElement).className,
            targetTagName: (event.target as HTMLElement).tagName
        })

        // 如果点击的是关闭按钮，不处理拖拽
        if ((event.target as HTMLElement).closest('.tab_icon_close')) {
            console.log('LegacyTabDragHandler', '点击了关闭按钮，不处理拖拽')
            return
        }

        // 查找最近的 Tab 元素，尝试多种选择器
        let tabElement = (event.target as HTMLElement).closest('[class*="tab_item"]') as HTMLElement
        
        if (!tabElement) {
            // 尝试其他选择器
            tabElement = (event.target as HTMLElement).closest('div') as HTMLElement
            if (tabElement && !tabElement.className.includes('tab_item')) {
                tabElement = null
            }
        }
        
        if (!tabElement) {
            console.log('LegacyTabDragHandler', '未找到 Tab 元素，尝试查找父元素')
            // 打印容器中的所有子元素
            if (this.tabContainer) {
                console.log('LegacyTabDragHandler', '容器中的子元素:', 
                    Array.from(this.tabContainer.children).map(child => ({
                        tagName: child.tagName,
                        className: child.className
                    }))
                )
            }
            return
        }

        console.log('LegacyTabDragHandler', '找到 Tab 元素:', {
            className: tabElement.className,
            tagName: tabElement.tagName,
            textContent: tabElement.textContent?.trim()
        })

        // 记录点击信息，用于区分点击和拖拽
        this.dragState.startPosition = { x: event.clientX, y: event.clientY }

        if (this.canDragTab(tabElement)) {
            // 不立即开始拖拽，等待鼠标移动
            this.dragState.dragElement = tabElement
            console.log('LegacyTabDragHandler', '准备拖拽，等待鼠标移动')
            
            // 阻止默认行为，避免文本选择等
            event.preventDefault()
        }
    }

    /**
     * 检查 Tab 是否可以拖拽
     * @param tabElement Tab 元素
     * @returns 是否可以拖拽
     */
    private canDragTab(tabElement: HTMLElement): boolean {
        if (!this.tabContainer) return false

        // 获取所有 Tab 元素（排除调试面板和其他非 Tab 元素）
        const allTabs = Array.from(this.tabContainer.children).filter(child => 
            child.classList.toString().includes('tab_item')
        )
        
        const tabIndex = allTabs.indexOf(tabElement)
        
        console.log('LegacyTabDragHandler', '检查拖拽权限', { 
            tabIndex, 
            totalTabs: allTabs.length,
            className: tabElement.className 
        })
        
        if (tabIndex === 0) {
            console.log('LegacyTabDragHandler', '用户中心 Tab 不能拖拽')
            return false
        }

        if (tabIndex === -1) {
            console.log('LegacyTabDragHandler', 'Tab 元素不在容器中')
            return false
        }

        return true
    }

    /**
     * 开始拖拽（已废弃，现在使用 startDragFromMove）
     * @param tabElement Tab 元素
     * @param event 鼠标事件
     */
    private startDrag(tabElement: HTMLElement, event: MouseEvent): void {
        // 这个方法现在只是为了兼容，实际拖拽从 startDragFromMove 开始
        console.log('LegacyTabDragHandler', 'startDrag 被调用，但拖拽将从鼠标移动开始')
        event.preventDefault()
    }

    /**
     * 处理拖拽移动
     * @param event 鼠标事件
     */
    private handleDragMove(event: MouseEvent): void {
        // 如果还没有开始拖拽，但有拖拽元素，检查是否应该开始拖拽
        if (!this.dragState.isDragging && this.dragState.dragElement) {
            const distance = Math.sqrt(
                Math.pow(event.clientX - this.dragState.startPosition.x, 2) +
                Math.pow(event.clientY - this.dragState.startPosition.y, 2)
            )

            console.log('LegacyTabDragHandler', '检查拖拽距离', { 
                distance, 
                threshold: this.dragState.dragThreshold,
                shouldStartDrag: distance >= this.dragState.dragThreshold
            })

            if (distance >= this.dragState.dragThreshold) {
                // 开始拖拽
                console.log('LegacyTabDragHandler', '距离超过阈值，开始拖拽')
                this.startDragFromMove(event)
            }
            return
        }

        if (!this.dragState.isDragging || !this.dragState.dragElement) return

        // 创建拖拽预览（如果还没有）
        if (!this.dragState.dragPreview) {
            this.createDragPreview(event)
        }

        // 更新拖拽预览位置
        this.updateDragPreview(event)

        // 计算并更新插入位置
        const newIndex = this.calculateDropPosition(event)
        if (newIndex !== this.dragState.currentIndex) {
            this.dragState.currentIndex = newIndex
            this.updateDropIndicator(newIndex)
        }
    }

    /**
     * 从鼠标移动开始拖拽
     * @param event 鼠标事件
     */
    private startDragFromMove(event: MouseEvent): void {
        if (!this.dragState.dragElement) return

        const allTabs = Array.from(this.tabContainer?.children || []).filter(child => 
            child.classList.toString().includes('tab_item')
        )
        const originalIndex = allTabs.indexOf(this.dragState.dragElement)

        this.dragState.isDragging = true
        this.dragState.originalIndex = originalIndex
        this.dragState.currentIndex = originalIndex

        // 立即设置用户重排状态，阻止自动刷新
        if (this.setUserReordering) {
            this.setUserReordering(true)
            console.log('LegacyTabDragHandler', '设置用户重排状态为 true')
        }

        // 添加拖拽样式
        document.body.classList.add('tab-dragging')
        this.dragState.dragElement.classList.add('tab-item--dragging')

        // 创建拖拽指示器
        this.createDropIndicator()

        console.log('LegacyTabDragHandler', '开始拖拽', { originalIndex })
    }

    /**
     * 创建拖拽预览
     * @param event 鼠标事件
     */
    private createDragPreview(event: MouseEvent): void {
        if (!this.dragState.dragElement) return

        const preview = this.dragState.dragElement.cloneNode(true) as HTMLElement
        preview.classList.add('tab-drag-preview')
        preview.style.position = 'fixed'
        preview.style.pointerEvents = 'none'
        preview.style.zIndex = '10000'
        preview.style.opacity = '0.8'
        preview.style.transform = 'rotate(5deg)'
        preview.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'

        // 设置初始位置
        const rect = this.dragState.dragElement.getBoundingClientRect()
        preview.style.left = `${event.clientX - rect.width / 2}px`
        preview.style.top = `${event.clientY - rect.height / 2}px`
        preview.style.width = `${rect.width}px`
        preview.style.height = `${rect.height}px`

        document.body.appendChild(preview)
        this.dragState.dragPreview = preview
    }

    /**
     * 更新拖拽预览位置
     * @param event 鼠标事件
     */
    private updateDragPreview(event: MouseEvent): void {
        if (!this.dragState.dragPreview) return

        const rect = this.dragState.dragPreview.getBoundingClientRect()
        this.dragState.dragPreview.style.left = `${event.clientX - rect.width / 2}px`
        this.dragState.dragPreview.style.top = `${event.clientY - rect.height / 2}px`
    }

    /**
     * 创建拖拽指示器
     */
    private createDropIndicator(): void {
        if (!this.tabContainer) return

        const indicator = document.createElement('div')
        indicator.className = 'tab-drop-indicator'
        indicator.style.position = 'absolute'
        indicator.style.top = '0'
        indicator.style.bottom = '0'
        indicator.style.width = '3px'
        indicator.style.backgroundColor = '#007bff'
        indicator.style.zIndex = '1000'
        indicator.style.display = 'none'
        indicator.style.borderRadius = '2px'
        indicator.style.boxShadow = '0 0 8px rgba(0, 123, 255, 0.5)'

        this.tabContainer.appendChild(indicator)
        this.dragState.dropIndicator = indicator
    }

    /**
     * 计算拖拽位置
     * @param event 鼠标事件
     * @returns 插入位置索引
     */
    private calculateDropPosition(event: MouseEvent): number {
        if (!this.tabContainer) return -1

        const containerRect = this.tabContainer.getBoundingClientRect()
        const relativeX = event.clientX - containerRect.left

        // 获取所有 Tab 元素（排除拖拽元素和指示器）
        const tabElements = Array.from(this.tabContainer.children).filter(
            child => child !== this.dragState.dragElement && 
                    child !== this.dragState.dropIndicator &&
                    child.classList.toString().includes('tab_item')
        ) as HTMLElement[]

        console.log('LegacyTabDragHandler', '计算插入位置', { 
            relativeX, 
            tabElementsCount: tabElements.length 
        })

        let dropPosition = 1 // 不能插入到第一个位置（用户中心 Tab）

        for (let i = 1; i < tabElements.length; i++) { // 从 1 开始，跳过用户中心 Tab
            const tabElement = tabElements[i]
            if (!tabElement) continue

            const tabRect = tabElement.getBoundingClientRect()
            const tabCenterX = tabRect.left + tabRect.width / 2 - containerRect.left

            console.log('LegacyTabDragHandler', `Tab ${i} 中心位置`, { 
                tabCenterX, 
                relativeX,
                className: tabElement.className 
            })

            if (relativeX < tabCenterX) {
                dropPosition = i
                break
            }
            dropPosition = i + 1
        }

        console.log('LegacyTabDragHandler', '计算得出插入位置', dropPosition)
        return dropPosition
    }

    /**
     * 更新拖拽指示器
     * @param dropPosition 插入位置
     */
    private updateDropIndicator(dropPosition: number): void {
        if (!this.dragState.dropIndicator || !this.tabContainer) return

        // 获取所有 Tab 元素（排除拖拽元素和指示器）
        const tabElements = Array.from(this.tabContainer.children).filter(
            child => child !== this.dragState.dragElement && 
                    child !== this.dragState.dropIndicator &&
                    child.classList.toString().includes('tab_item')
        ) as HTMLElement[]

        const containerRect = this.tabContainer.getBoundingClientRect()
        let leftPosition = 0

        console.log('LegacyTabDragHandler', '更新指示器位置', { 
            dropPosition, 
            tabElementsLength: tabElements.length 
        })

        if (dropPosition >= tabElements.length) {
            // 插入到最后
            const lastTab = tabElements[tabElements.length - 1]
            if (lastTab) {
                const rect = lastTab.getBoundingClientRect()
                leftPosition = rect.right - containerRect.left
                console.log('LegacyTabDragHandler', '插入到最后', { leftPosition })
            }
        } else {
            // 插入到指定位置
            const targetTab = tabElements[dropPosition]
            if (targetTab) {
                const rect = targetTab.getBoundingClientRect()
                leftPosition = rect.left - containerRect.left
                console.log('LegacyTabDragHandler', `插入到位置 ${dropPosition}`, { leftPosition })
            }
        }

        this.dragState.dropIndicator.style.left = `${leftPosition}px`
        this.dragState.dropIndicator.style.display = 'block'
    }

    /**
     * 处理拖拽结束
     * @param event 鼠标事件
     */
    private handleDragEnd(event: MouseEvent): void {
        const wasActuallyDragging = this.dragState.isDragging
        const { originalIndex, currentIndex, dragElement } = this.dragState

        let didReorder = false

        // 清理拖拽状态
        this.cleanup()

        if (wasActuallyDragging) {
            // 如果位置发生变化，触发重排回调
            if (currentIndex !== -1 && currentIndex !== originalIndex && this.onReorderCallback) {
                didReorder = true
                console.log('LegacyTabDragHandler', '拖拽完成，重排 Tab', { originalIndex, currentIndex })
                this.onReorderCallback(originalIndex, currentIndex)
            }
        } else if (dragElement) {
            // 这是一个点击事件，不是拖拽
            console.log('LegacyTabDragHandler', '检测到点击事件，触发 Tab 切换')
            
            // 触发点击事件（模拟原始的点击行为）
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: event.clientX,
                clientY: event.clientY
            })
            
            // 延迟一点触发，确保拖拽状态已清理
            setTimeout(() => {
                dragElement.dispatchEvent(clickEvent)
            }, 10)
        }

        // 如果拖拽了但没有重排，需要重置用户重排状态
        if (wasActuallyDragging && this.setUserReordering && !didReorder) {
            console.log('LegacyTabDragHandler', '拖拽取消，重置用户重排状态')
            this.setUserReordering(false)
        }
    }

    /**
     * 清理拖拽状态
     */
    private cleanup(): void {
        // 移除拖拽样式
        document.body.classList.remove('tab-dragging')

        if (this.dragState.dragElement) {
            this.dragState.dragElement.classList.remove('tab-item--dragging')
        }

        // 移除拖拽预览
        if (this.dragState.dragPreview) {
            try {
                document.body.removeChild(this.dragState.dragPreview)
            } catch (e) {
                console.warn('LegacyTabDragHandler', '移除拖拽预览失败', e)
            }
        }

        // 移除拖拽指示器
        if (this.dragState.dropIndicator && this.tabContainer) {
            try {
                this.tabContainer.removeChild(this.dragState.dropIndicator)
            } catch (e) {
                console.warn('LegacyTabDragHandler', '移除拖拽指示器失败', e)
            }
        }

        // 重置状态
        this.dragState = {
            isDragging: false,
            dragElement: null,
            dragPreview: null,
            dropIndicator: null,
            startPosition: { x: 0, y: 0 },
            dragThreshold: 5,
            originalIndex: -1,
            currentIndex: -1
        }

        console.log('LegacyTabDragHandler', '拖拽状态已清理')
    }

    /**
     * 更新 Tab 列表（当 Tab 发生变化时调用）
     */
    public updateTabs(): void {
        // 重新设置事件监听器
        this.setupTabEventListeners()
    }

    /**
     * 销毁拖拽处理器
     */
    public destroy(): void {
        this.cleanup()
        
        // 移除事件监听器
        if (this.tabContainer) {
            this.tabContainer.removeEventListener('mousedown', this.handleMouseDown)
        }
        
        this.tabContainer = null
        this.onReorderCallback = null
        console.log('LegacyTabDragHandler', '销毁旧版拖拽处理器')
    }
}