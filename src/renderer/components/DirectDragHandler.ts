/**
 * 直接拖拽处理器
 * 最简化的拖拽实现，专注于解决重排问题
 */

export class DirectDragHandler {
    private container: HTMLElement | null = null
    private onReorder: ((from: number, to: number) => void) | null = null
    private setUserReordering: ((reordering: boolean) => void) | null = null
    private isDragging = false
    private dragElement: HTMLElement | null = null
    private startX = 0
    private startY = 0
    private originalIndex = -1

    public initialize(
        container: HTMLElement, 
        onReorder: (from: number, to: number) => void,
        setUserReordering?: (reordering: boolean) => void
    ) {
        this.container = container
        this.onReorder = onReorder
        this.setUserReordering = setUserReordering

        // 初始化直接拖拽处理器
        this.setupEvents()
    }

    private setupEvents() {
        if (!this.container) return

        // 直接为容器添加事件监听器
        this.container.addEventListener('mousedown', this.handleMouseDown)
        document.addEventListener('mousemove', this.handleMouseMove)
        document.addEventListener('mouseup', this.handleMouseUp)

        // 事件监听器设置完成
    }

    private handleMouseDown = (event: MouseEvent) => {
        console.log('DirectDragHandler', '鼠标按下', event.target)

        // 查找 Tab 元素
        const target = event.target as HTMLElement
        const tabElement = target.closest('[class*="tab_item"]') as HTMLElement

        if (!tabElement || !this.container) {
            console.log('DirectDragHandler', '未找到 Tab 元素')
            return
        }

        // 获取所有 Tab 元素
        const allTabs = Array.from(this.container.querySelectorAll('[class*="tab_item"]'))
        const index = allTabs.indexOf(tabElement)

        console.log('DirectDragHandler', '找到 Tab', {
            index,
            title: tabElement.textContent?.trim(),
            totalTabs: allTabs.length,
            tabElement: tabElement,
            allTabTitles: allTabs.map(tab => tab.textContent?.trim())
        })

        // 第一个 Tab（用户中心）不能拖拽
        if (index === 0) {
            console.log('DirectDragHandler', '用户中心 Tab 不能拖拽')
            return
        }

        if (index === -1) {
            console.log('DirectDragHandler', 'Tab 不在容器中', {
                tabElement: tabElement,
                tabClassName: tabElement.className,
                tabTextContent: tabElement.textContent,
                containerChildren: Array.from(this.container.children).map(child => ({
                    element: child,
                    className: child.className,
                    textContent: child.textContent?.trim()
                }))
            })
            return
        }

        // 开始拖拽准备
        this.dragElement = tabElement
        this.originalIndex = index
        this.startX = event.clientX
        this.startY = event.clientY
        this.isDragging = false // 还没有真正开始拖拽

        console.log('DirectDragHandler', '拖拽准备完成', {
            originalIndex: this.originalIndex,
            startX: this.startX,
            startY: this.startY,
            dragElement: this.dragElement
        })

        event.preventDefault()
    }

    private handleMouseMove = (event: MouseEvent) => {
        if (!this.dragElement) return

        const deltaX = event.clientX - this.startX
        const deltaY = event.clientY - this.startY
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        // 如果还没开始拖拽，检查是否超过阈值
        if (!this.isDragging && distance > 5) {
            this.isDragging = true
            this.dragElement.style.opacity = '0.5'
            this.dragElement.style.transform = 'scale(0.95)'
            document.body.style.cursor = 'grabbing'
            
            // 立即设置用户重排状态，阻止自动刷新
            if (this.setUserReordering) {
                this.setUserReordering(true)
                console.log('DirectDragHandler', '设置用户重排状态为 true')
            }
            
            console.log('DirectDragHandler', '开始拖拽', {
                distance,
                originalIndex: this.originalIndex
            })
        }

        if (this.isDragging) {
            // 可以在这里添加更多拖拽效果
            console.log('DirectDragHandler', '拖拽中...', { deltaX, deltaY })
        }
    }

    private handleMouseUp = (event: MouseEvent) => {
        console.log('DirectDragHandler', '鼠标释放', {
            isDragging: this.isDragging,
            dragElement: !!this.dragElement
        })

        if (!this.dragElement) return

        let didReorder = false

        if (this.isDragging) {
            // 计算新位置
            const newIndex = this.calculateDropPosition(event)
            
            console.log('DirectDragHandler', '拖拽完成', {
                originalIndex: this.originalIndex,
                newIndex: newIndex,
                shouldReorder: newIndex !== -1 && newIndex !== this.originalIndex
            })

            // 如果位置发生变化，执行重排
            if (newIndex !== -1 && newIndex !== this.originalIndex && this.onReorder) {
                didReorder = true
                console.log('DirectDragHandler', '调用重排回调', {
                    from: this.originalIndex,
                    to: newIndex,
                    hasCallback: !!this.onReorder,
                    callbackType: typeof this.onReorder
                })
                
                // 延迟执行，确保状态稳定
                setTimeout(() => {
                    try {
                        if (this.onReorder && this.originalIndex >= 0) {
                            console.log('DirectDragHandler', '执行延迟重排回调', {
                                originalIndex: this.originalIndex,
                                newIndex: newIndex,
                                hasValidIndices: this.originalIndex >= 0 && newIndex >= 0
                            })
                            this.onReorder(this.originalIndex, newIndex)
                            console.log('DirectDragHandler', '重排回调执行完成')
                        } else {
                            console.warn('DirectDragHandler', '跳过重排回调', {
                                hasCallback: !!this.onReorder,
                                originalIndex: this.originalIndex,
                                newIndex: newIndex,
                                reason: this.originalIndex < 0 ? '原始索引无效' : '没有回调函数'
                            })
                        }
                    } catch (error) {
                        console.error('DirectDragHandler', '重排回调执行失败', error)
                    }
                }, 50) // 延迟 50ms 执行
            } else {
                console.log('DirectDragHandler', '不需要重排', {
                    newIndex,
                    originalIndex: this.originalIndex,
                    hasCallback: !!this.onReorder,
                    positionChanged: newIndex !== this.originalIndex,
                    newIndexValid: newIndex !== -1,
                    reason: newIndex === -1 ? '位置计算失败' : 
                           newIndex === this.originalIndex ? '位置没有变化' : 
                           !this.onReorder ? '没有回调函数' : '未知原因'
                })
            }
        } else {
            // 这是一个点击事件
            console.log('DirectDragHandler', '检测到点击事件')
            // 触发点击
            setTimeout(() => {
                this.dragElement?.click()
            }, 10)
        }

        // 如果拖拽了但没有重排，需要重置用户重排状态
        if (this.isDragging && this.setUserReordering && !didReorder) {
            console.log('DirectDragHandler', '拖拽取消，重置用户重排状态')
            this.setUserReordering(false)
        }

        // 清理状态
        this.cleanup()
    }

    private calculateDropPosition(event: MouseEvent): number {
        if (!this.container) return -1

        const containerRect = this.container.getBoundingClientRect()
        const mouseX = event.clientX - containerRect.left

        // 获取所有 Tab 元素（包括正在拖拽的，用于准确计算位置）
        const allTabs = Array.from(this.container.querySelectorAll('[class*="tab_item"]')) as HTMLElement[]

        console.log('DirectDragHandler', '计算插入位置', {
            mouseX,
            containerLeft: containerRect.left,
            tabCount: allTabs.length,
            originalIndex: this.originalIndex
        })

        let newPosition = this.originalIndex // 默认保持原位置

        // 计算应该插入的位置
        for (let i = 0; i < allTabs.length; i++) {
            if (i === 0) continue // 跳过用户中心 Tab
            if (allTabs[i] === this.dragElement) continue // 跳过正在拖拽的元素

            const tab = allTabs[i]
            const tabRect = tab.getBoundingClientRect()
            const tabCenterX = tabRect.left + tabRect.width / 2 - containerRect.left

            console.log('DirectDragHandler', `Tab ${i} 中心位置`, {
                tabIndex: i,
                tabCenterX,
                mouseX,
                shouldInsertBefore: mouseX < tabCenterX,
                tabTitle: tab.textContent?.trim()
            })

            if (mouseX < tabCenterX) {
                newPosition = i
                break
            } else {
                newPosition = i + 1
            }
        }

        // 确保不会插入到用户中心 Tab 之前
        newPosition = Math.max(1, newPosition)
        
        // 如果超出范围，插入到最后
        if (newPosition >= allTabs.length) {
            newPosition = allTabs.length - 1
        }

        console.log('DirectDragHandler', '计算得出新位置', {
            originalIndex: this.originalIndex,
            newPosition,
            willReorder: newPosition !== this.originalIndex
        })

        return newPosition
    }

    private cleanup() {
        console.log('DirectDragHandler', '清理拖拽状态')

        // 恢复样式
        if (this.dragElement) {
            this.dragElement.style.opacity = ''
            this.dragElement.style.transform = ''
        }

        document.body.style.cursor = ''

        // 重置状态
        this.isDragging = false
        this.dragElement = null
        this.originalIndex = -1
        this.startX = 0
        this.startY = 0
    }

    public destroy() {
        console.log('DirectDragHandler', '销毁直接拖拽处理器')

        if (this.container) {
            this.container.removeEventListener('mousedown', this.handleMouseDown)
        }
        document.removeEventListener('mousemove', this.handleMouseMove)
        document.removeEventListener('mouseup', this.handleMouseUp)

        this.cleanup()
        this.container = null
        this.onReorder = null
    }
}