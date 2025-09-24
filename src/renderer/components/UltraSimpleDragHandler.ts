/**
 * 超简化拖拽处理器
 * 最基础的实现，专注解决核心问题
 */

export class UltraSimpleDragHandler {
    private container: HTMLElement | null = null
    private onReorder: ((from: number, to: number) => void) | null = null
    private setUserReordering: ((reordering: boolean) => void) | null = null
    private dragData: {
        isDragging: boolean
        element: HTMLElement | null
        startIndex: number
        startX: number
        startY: number
    } = {
        isDragging: false,
        element: null,
        startIndex: -1,
        startX: 0,
        startY: 0
    }

    public initialize(
        container: HTMLElement, 
        onReorder: (from: number, to: number) => void,
        setUserReordering?: (reordering: boolean) => void
    ) {
        this.container = container
        this.onReorder = onReorder
        this.setUserReordering = setUserReordering

        // 初始化超简化拖拽处理器
        
        // 直接监听容器的鼠标事件
        container.addEventListener('mousedown', this.onMouseDown)
        document.addEventListener('mousemove', this.onMouseMove)
        document.addEventListener('mouseup', this.onMouseUp)
    }

    private onMouseDown = (event: MouseEvent) => {
        // 鼠标按下
        
        // 查找被点击的 Tab
        const target = event.target as HTMLElement
        const tabElement = target.closest('div') as HTMLElement
        
        if (!tabElement || !this.container) return
        
        // 检查是否是 Tab 元素，排除 div_drag
        if (!tabElement.className.includes('tab_item') || tabElement.className.includes('div_drag')) {
            // 不是可拖拽的Tab元素
            return
        }

        // 获取所有子元素
        const allChildren = Array.from(this.container.children) as HTMLElement[]
        const index = allChildren.indexOf(tabElement)

        // 找到Tab元素

        // 第一个tab不能拖拽
        if (index <= 0) {
            // 第一个Tab不能拖拽
            return
        }

        // 记录拖拽数据
        this.dragData = {
            isDragging: false, // 还没开始拖拽
            element: tabElement,
            startIndex: index,
            startX: event.clientX,
            startY: event.clientY
        }

        // 准备拖拽
        event.preventDefault()
    }

    private onMouseMove = (event: MouseEvent) => {
        if (!this.dragData.element) return

        const deltaX = event.clientX - this.dragData.startX
        const deltaY = event.clientY - this.dragData.startY
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        // 开始拖拽
        if (!this.dragData.isDragging && distance > 5) {
            this.dragData.isDragging = true
            
            // 增强拖拽视觉效果
            this.dragData.element.style.opacity = '0.7'
            this.dragData.element.style.transform = 'scale(1.05)'
            this.dragData.element.style.zIndex = '1000'
            this.dragData.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
            this.dragData.element.style.transition = 'none' // 禁用过渡动画
            document.body.style.cursor = 'grabbing'
            
            // 立即设置用户重排状态，阻止自动刷新
            if (this.setUserReordering) {
                this.setUserReordering(true)
                // 设置用户重排状态为true
            }
            
            // 检查当前Tab数量
            const currentTabCount = this.container ? this.container.children.length : 0
            // 开始拖拽
        }

        // 拖拽过程中的视觉反馈
        if (this.dragData.isDragging && this.dragData.element) {
            const deltaX = event.clientX - this.dragData.startX
            const deltaY = event.clientY - this.dragData.startY
            
            // 添加轻微的位移效果
            this.dragData.element.style.transform = `scale(1.05) translate(${deltaX * 0.1}px, ${deltaY * 0.1}px)`
            
            // 计算当前应该插入的位置并显示指示器
            this.showDropIndicator(event)
        }
    }

    private showDropIndicator(event: MouseEvent) {
        if (!this.container) return

        const newIndex = this.calculateNewIndex(event)
        const allChildren = Array.from(this.container.children) as HTMLElement[]
        
        // 移除之前的指示器
        const existingIndicator = this.container.querySelector('.drop-indicator')
        if (existingIndicator) {
            existingIndicator.remove()
        }

        if (newIndex >= 0 && newIndex < allChildren.length && newIndex !== this.dragData.startIndex) {
            const targetElement = allChildren[newIndex]
            
            // 确保目标元素是tab元素，不是div_drag
            if (targetElement && targetElement.className.includes('tab_item') && !targetElement.className.includes('div_drag')) {
                // 创建拖放指示器
                const indicator = document.createElement('div')
                indicator.className = 'drop-indicator'
                indicator.style.cssText = `
                    position: absolute;
                    width: 2px;
                    height: 100%;
                    background-color: #007acc;
                    z-index: 1001;
                    pointer-events: none;
                `
                
                const containerRect = this.container.getBoundingClientRect()
                const targetRect = targetElement.getBoundingClientRect()
                
                indicator.style.left = `${targetRect.left - containerRect.left}px`
                indicator.style.top = '0px'
                
                this.container.appendChild(indicator)
            }
        }
    }

    private onMouseUp = (event: MouseEvent) => {
        // 鼠标释放

        if (!this.dragData.element) return

        let didReorder = false

        if (this.dragData.isDragging) {
            // 计算新位置
            const newIndex = this.calculateNewIndex(event)
            
            // 拖拽完成

            // 执行重排
            if (newIndex !== this.dragData.startIndex && newIndex > 0 && this.onReorder) {
                // 执行重排
                
                didReorder = true
                // 立即执行，不延迟
                this.onReorder(this.dragData.startIndex, newIndex)
            }
        }

        // 清理拖拽效果
        if (this.dragData.element) {
            this.dragData.element.style.opacity = ''
            this.dragData.element.style.transform = ''
            this.dragData.element.style.zIndex = ''
            this.dragData.element.style.boxShadow = ''
            this.dragData.element.style.transition = ''
        }
        
        // 清理全局样式
        document.body.style.cursor = ''
        
        // 移除拖放指示器
        if (this.container) {
            const indicator = this.container.querySelector('.drop-indicator')
            if (indicator) {
                indicator.remove()
            }
        }
        
        // 如果没有执行重排，需要重置用户重排状态
        if (this.dragData.isDragging && this.setUserReordering && !didReorder) {
            // 拖拽取消，重置用户重排状态
            this.setUserReordering(false)
        }
        
        this.dragData = {
            isDragging: false,
            element: null,
            startIndex: -1,
            startX: 0,
            startY: 0
        }
    }

    private calculateNewIndex(event: MouseEvent): number {
        if (!this.container) return -1

        const containerRect = this.container.getBoundingClientRect()
        const mouseX = event.clientX - containerRect.left

        const allChildren = Array.from(this.container.children) as HTMLElement[]
        
        // 过滤出真正的tab元素，排除div_drag
        const tabElements = allChildren.filter(child => 
            child.className.includes('tab_item') && !child.className.includes('div_drag')
        )
        
        // 计算新位置
        
        // 简单的位置计算，只考虑tab元素
        for (let i = 1; i < tabElements.length; i++) { // 从 1 开始，第一个tab不能移动
            const tab = tabElements[i]
            const tabRect = tab.getBoundingClientRect()
            const tabCenter = tabRect.left + tabRect.width / 2 - containerRect.left

            if (mouseX < tabCenter) {
                // 返回在原始children数组中的索引
                return allChildren.indexOf(tab)
            }
        }

        // 如果拖到最后，返回最后一个tab的位置（不是div_drag的位置）
        const lastTab = tabElements[tabElements.length - 1]
        return lastTab ? allChildren.indexOf(lastTab) : tabElements.length - 1
    }

    public destroy() {
        // 销毁处理器
        
        if (this.container) {
            this.container.removeEventListener('mousedown', this.onMouseDown)
        }
        document.removeEventListener('mousemove', this.onMouseMove)
        document.removeEventListener('mouseup', this.onMouseUp)
        
        this.container = null
        this.onReorder = null
    }
}