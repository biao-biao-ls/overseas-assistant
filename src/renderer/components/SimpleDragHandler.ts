/**
 * 简化版拖拽处理器
 * 用于快速修复拖拽功能问题
 */

export class SimpleDragHandler {
    private container: HTMLElement | null = null
    private isDragging = false
    private dragElement: HTMLElement | null = null
    private startX = 0
    private startY = 0
    private onReorder: ((from: number, to: number) => void) | null = null
    private setUserReordering: ((reordering: boolean) => void) | null = null

    constructor() {
        this.setupGlobalListeners()
    }

    private setupGlobalListeners() {
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.dragElement) {
                this.handleMove(e)
            }
        })

        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.handleEnd(e)
            }
        })
    }

    public initialize(
        container: HTMLElement, 
        onReorder: (from: number, to: number) => void,
        setUserReordering?: (reordering: boolean) => void
    ) {
        this.container = container
        this.onReorder = onReorder
        this.setUserReordering = setUserReordering

        console.log('SimpleDragHandler', '初始化简化拖拽处理器')

        // 直接为每个 Tab 添加事件监听器
        this.updateTabListeners()
    }

    private updateTabListeners() {
        if (!this.container) return

        // 使用事件委托，在容器上监听所有鼠标事件
        this.container.addEventListener('mousedown', this.handleContainerMouseDown)
        
        console.log('SimpleDragHandler', '设置容器事件监听器完成')
    }

    private handleContainerMouseDown = (event: MouseEvent) => {
        // 查找被点击的 Tab 元素
        const tabElement = (event.target as HTMLElement).closest('[class*="tab_item"]') as HTMLElement
        
        if (!tabElement || !this.container) {
            return
        }

        // 获取 Tab 索引
        const tabs = Array.from(this.container.querySelectorAll('[class*="tab_item"]'))
        const index = tabs.indexOf(tabElement)

        console.log('SimpleDragHandler', 'Tab 鼠标按下:', index, tabElement.textContent?.trim())
        
        // 第一个 Tab（用户中心）不能拖拽
        if (index === 0) {
            console.log('SimpleDragHandler', '用户中心 Tab 不能拖拽')
            return
        }

        if (index === -1) {
            console.log('SimpleDragHandler', 'Tab 元素不在容器中')
            return
        }

        this.handleStart(event, tabElement, index)
    }

    private handleStart(event: MouseEvent, element: HTMLElement, index: number) {
        console.log('SimpleDragHandler', '开始拖拽准备:', index)
        
        this.dragElement = element
        this.startX = event.clientX
        this.startY = event.clientY
        
        event.preventDefault()
    }

    private handleMove(event: MouseEvent) {
        if (!this.dragElement) return

        const deltaX = event.clientX - this.startX
        const deltaY = event.clientY - this.startY
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (!this.isDragging && distance > 5) {
            // 开始拖拽
            this.isDragging = true
            this.dragElement.style.opacity = '0.5'
            this.dragElement.style.transform = 'scale(0.95)'
            document.body.style.cursor = 'grabbing'
            
            // 立即设置用户重排状态，阻止自动刷新
            if (this.setUserReordering) {
                this.setUserReordering(true)
                console.log('SimpleDragHandler', '设置用户重排状态为 true')
            }
            
            console.log('SimpleDragHandler', '开始拖拽')
        }

        if (this.isDragging) {
            // 这里可以添加更多拖拽效果
            console.log('SimpleDragHandler', '拖拽中...', { deltaX, deltaY })
        }
    }

    private handleEnd(event: MouseEvent) {
        console.log('SimpleDragHandler', '拖拽结束')

        let didReorder = false

        if (this.isDragging && this.dragElement && this.container) {
            // 计算新位置
            const newIndex = this.calculateNewPosition(event)
            const oldIndex = this.getElementIndex(this.dragElement)

            console.log('SimpleDragHandler', '拖拽完成:', { oldIndex, newIndex })

            if (newIndex !== -1 && newIndex !== oldIndex && this.onReorder) {
                didReorder = true
                this.onReorder(oldIndex, newIndex)
            }
        }

        // 如果拖拽了但没有重排，需要重置用户重排状态
        if (this.isDragging && this.setUserReordering && !didReorder) {
            console.log('SimpleDragHandler', '拖拽取消，重置用户重排状态')
            this.setUserReordering(false)
        }

        // 清理状态
        if (this.dragElement) {
            this.dragElement.style.opacity = ''
            this.dragElement.style.transform = ''
        }
        
        document.body.style.cursor = ''
        this.isDragging = false
        this.dragElement = null
    }

    private getElementIndex(element: HTMLElement): number {
        if (!this.container) return -1
        
        const tabs = Array.from(this.container.querySelectorAll('[class*="tab_item"]'))
        return tabs.indexOf(element)
    }

    private calculateNewPosition(event: MouseEvent): number {
        if (!this.container) return -1

        const containerRect = this.container.getBoundingClientRect()
        const relativeX = event.clientX - containerRect.left

        const tabs = this.container.querySelectorAll('[class*="tab_item"]')
        
        for (let i = 1; i < tabs.length; i++) { // 从 1 开始，跳过用户中心 Tab
            const tab = tabs[i] as HTMLElement
            const tabRect = tab.getBoundingClientRect()
            const tabCenter = tabRect.left + tabRect.width / 2 - containerRect.left

            if (relativeX < tabCenter) {
                return i
            }
        }

        return tabs.length - 1
    }

    public update() {
        // 简化拖拽处理器使用事件委托，不需要重新绑定事件
        // 只需要记录一下更新即可
        console.log('SimpleDragHandler', '更新拖拽处理器')
        
        if (this.container) {
            const tabs = this.container.querySelectorAll('[class*="tab_item"]')
            console.log('SimpleDragHandler', '当前 Tab 数量:', tabs.length)
        }
    }

    public destroy() {
        console.log('SimpleDragHandler', '销毁简化拖拽处理器')
        
        // 移除事件监听器
        if (this.container) {
            this.container.removeEventListener('mousedown', this.handleContainerMouseDown)
        }
        
        this.container = null
        this.onReorder = null
        this.isDragging = false
        this.dragElement = null
    }
}