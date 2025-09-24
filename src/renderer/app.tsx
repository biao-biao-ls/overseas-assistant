import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import loadingIcon from '../../assets/eda-loading.svg'
import historyBack from '../../assets/jlcone/back.svg'
import historyBackHover from '../../assets/jlcone/back_hover.svg'
import btnSettingNormal from '../../assets/btn-setting.svg'
import btnSettingHover from '../../assets/btn-setting-hover.svg'
import btnMiniNormal from '../../assets/btn-minimize.svg'
import btnMiniHover from '../../assets/btn-minimize-hover.svg'
import btnUnmaximizeNormal from '../../assets/btn-unmaximize.svg'
import btnUnmaximizeHover from '../../assets/btn-unmaximize-hover.svg'
import btnCloseNormal from '../../assets/btn-wnd-close.svg'
import btnCloseHover from '../../assets/btn-wnd-close-hover.svg'

import './style.css'
import './main/main.css'
import { EWnd } from '../enum/EWnd'
import { SvgButton } from './components/svgButton/svgButton'
import { EMessage } from '../enum/EMessage'
import { AppMsg } from '../base/AppMsg'
import { ECommon, HomeUrls } from '../enum/ECommon'
import Shadow from './components/shadow/shadow'
import config from '../res/config.json'
import { debounce } from '../utils'
import { TabRenderer } from './components/TabRenderer'
import { TabIPCClient } from './TabIPCClient'
import { LegacyTabDragHandler } from './components/LegacyTabDragHandler'
import { SimpleDragHandler } from './components/SimpleDragHandler'
import { DirectDragHandler } from './components/DirectDragHandler'
import { UltraSimpleDragHandler } from './components/UltraSimpleDragHandler'
import { ErrorBoundary } from './components/ErrorBoundary'

const { ipcRenderer } = (window as any)['electron'] as any

const IconOutSize = '36px'

const App = (): JSX.Element => {
    const [isMaximized, setUIIsMaximized] = useState(true)
    const [showBorder, setBorder] = useState(true)

    const [isDarwin, setIsDarwin] = useState(false)
    const [uiStrReason, setUIStrReason] = useState('')
    const [uiListOperate, setUIListOperate] = useState([])

    // 新的 Tab 系统相关状态
    const [tabIpcClient] = useState(() => new TabIPCClient())
    const [useNewTabSystem, setUseNewTabSystem] = useState(false) // 默认使用旧系统

    // 旧系统拖拽处理器
    const [legacyDragHandler] = useState(() => new LegacyTabDragHandler())
    const [simpleDragHandler] = useState(() => new SimpleDragHandler())
    const [directDragHandler] = useState(() => new DirectDragHandler())
    const [ultraSimpleDragHandler] = useState(() => new UltraSimpleDragHandler())
    const [dragMode, setDragMode] = useState<'legacy' | 'simple' | 'direct' | 'ultra'>('ultra') // 默认使用超简化拖拽
    const tabBoxRef = useRef<HTMLDivElement>(null)

    const setIsMaximized = (bMax: boolean) => {
        if (bMax === isMaximized) {
            return
        }
        setUIIsMaximized(bMax)
        ipcRenderer.invoke(EMessage.EGetWin10).then((bWin10: boolean) => {
            setBorder(!bWin10 && !bMax)
            if (refShadow.current) {
                refShadow.current.showShadow(bWin10 && !bMax)
            }
        })
    }

    window.addEventListener('keydown', evt => {
        if (evt.ctrlKey) {
            ipcRenderer.send(EMessage.EMainPageCtrl, true)
        }
    })
    window.addEventListener('keyup', evt => {
        if (!evt.ctrlKey) {
            ipcRenderer.send(EMessage.EMainPageCtrl, false)
        }
    })

    const refShadow = useRef<{ showShadow: (show: boolean) => void } | null>(null)
    const [listViewTitle, setListViewTitle] = useState([])
    const [strCurViewId, setCurrentViewId] = useState(ECommon.ENone)
    const [isUserReordering, setIsUserReordering] = useState(false) // 标记用户是否正在重排
    const isUserReorderingRef = useRef(false) // 立即生效的重排状态跟踪

    // 创建一个同时更新state和ref的函数
    const setUserReorderingState = (reordering: boolean) => {
        isUserReorderingRef.current = reordering
        setIsUserReordering(reordering)
    }
    let isHasHome = false

    /**
     * 处理主进程发送的消息
     */
    const handleMainMessage = (_event: any, msg: AppMsg) => {
        switch (msg.msgId) {
            case EMessage.ERenderSyncIsWin10:
                handleWin10Sync(msg.data)
                break
            case EMessage.ERenderSyncIsDarwin:
                setIsDarwin(msg.data)
                break
            case EMessage.EMainToRenderCreateUserLog:
                handleUserLog(msg.data)
                break
            case EMessage.ERenderRefreshTab:
                handleRefreshTab(msg.data)
                break
            default:
                // 忽略未处理的消息类型
                break
        }
    }

    /**
     * 处理Win10系统同步消息
     */
    const handleWin10Sync = (isWin10: boolean) => {
        setBorder(!isWin10 && !isMaximized)
        if (refShadow.current) {
            refShadow.current.showShadow(isWin10 && !isMaximized)
        }
    }

    /**
     * 处理用户日志消息
     */
    const handleUserLog = (logData: any) => {
        const reason = logData['reason'] as string
        const operations = logData['operate'] as string[]
        setUIStrReason(reason)
        setUIListOperate(operations)
    }

    /**
     * 处理标签页刷新消息
     */
    const handleRefreshTab = (tabInfo: any) => {
        try {
            const isImmediateSync = tabInfo.reason && tabInfo.reason.includes('immediate')

            // 如果是立即同步（用户主动操作），跳过重排检查
            // 如果用户正在重排，暂时跳过自动刷新
            if (!isImmediateSync && (isUserReordering || isUserReorderingRef.current)) {
                // 用户正在重排Tab，跳过自动刷新
                return
            }

            const viewTitles = tabInfo['bvViewTitle'] || []
            const topViewId = tabInfo['topViewId']

            console.log('App', 'Tab数据处理', {
                tabInfo,
                viewTitlesLength: viewTitles.length,
                viewTitles: viewTitles.map((item: any, idx: number) => ({
                    idx,
                    id: item?.id,
                    title: item?.title,
                    hasId: !!item?.id,
                    hasTitle: !!item?.title,
                })),
                topViewId,
                reason: tabInfo.reason,
                isImmediateSync,
            })

            // 过滤掉无效的项
            const validViewTitles = viewTitles.filter((item: any) => item && item.id && item.title)

            console.log('App', '过滤后的有效Tab', {
                originalLength: viewTitles.length,
                validLength: validViewTitles.length,
                validTitles: validViewTitles.map(item => ({ id: item.id, title: item.title })),
            })

            const regex = /\/user-center\/?$/i
            const homePage = validViewTitles.find((item: any) => regex.test(item.id))

            if (!homePage && !isHasHome) {
                isHasHome = true
                // 根据当前有效语言动态构建跳转链接
                ipcRenderer
                    .invoke(EMessage.EMainGetCurrentLanguage)
                    .then(currentLanguage => {
                        console.log('🔍 语言路径调试:', {
                            原始值: currentLanguage,
                            类型: typeof currentLanguage,
                            真值: !!currentLanguage,
                            '=== "hk"': currentLanguage === 'hk',
                            '!== "en"': currentLanguage !== 'en',
                            条件结果: currentLanguage && currentLanguage !== 'en',
                        })

                        let languagePath = ''
                        // 除了英语之外的小语种都要添加语言路径
                        if (currentLanguage && currentLanguage !== 'en') {
                            languagePath = `${currentLanguage}/`
                            console.log('✅ 设置语言路径:', languagePath)
                        } else {
                            console.log(
                                '❌ 语言路径为空，原因:',
                                !currentLanguage ? '语言为空/null/undefined' : '语言是英语'
                            )
                        }

                        const url = `${HomeUrls[config.env]}/user-center/${languagePath}`
                        console.log('🌐 最终URL:', url)
                        console.log('📋 URL构建详情:', {
                            baseUrl: HomeUrls[config.env],
                            env: config.env,
                            languagePath: languagePath,
                            完整URL: url,
                        })

                        window.open(url, '_blank')
                    })
                    .catch(error => {
                        console.error('❌ 获取语言失败:', error)
                        // 如果获取语言失败，使用默认链接
                        const fallbackUrl = `${HomeUrls[config.env]}/user-center/`
                        console.log('🔄 使用默认URL:', fallbackUrl)
                        window.open(fallbackUrl, '_blank')
                    })
            }

            // 立即更新当前视图ID，特别是对于用户主动操作
            if (topViewId && (isImmediateSync || topViewId !== strCurViewId)) {
                setCurrentViewId(topViewId)
            }

            // 对视图标题进行排序
            validViewTitles.sort((a: any, b: any) => {
                if (a.id === homePage?.id) {
                    return -1 // 将主页视图置顶
                } else if (b.id === topViewId) {
                    return 1 // 将当前视图置顶
                }
                return 0
            })

            console.log('App', '自动刷新 Tab 列表', {
                oldCount: listViewTitle.length,
                newCount: validViewTitles.length,
                isUserReordering,
                oldTitles: listViewTitle.map(item => item?.title),
                newTitles: validViewTitles.map(item => item?.title),
                willOverride:
                    JSON.stringify(listViewTitle.map(item => item?.title)) !==
                    JSON.stringify(validViewTitles.map(item => item?.title)),
            })

            // 如果用户正在重排，不要覆盖Tab列表（除非是立即同步）
            if (isImmediateSync || (!isUserReordering && !isUserReorderingRef.current)) {
                setListViewTitle(validViewTitles)

                if (isImmediateSync) {
                    console.log('App', '立即同步更新Tab列表', {
                        reason: tabInfo.reason,
                        newCount: validViewTitles.length,
                        topViewId,
                    })
                }
            } else {
                console.log('App', '用户正在重排，跳过自动更新Tab列表', {
                    isUserReordering,
                    isUserReorderingRef: isUserReorderingRef.current,
                })
            }

            // 更新拖拽处理器（如果使用旧系统）
            if (!useNewTabSystem && (isImmediateSync || !isUserReordering)) {
                const updateDelay = isImmediateSync ? 50 : 200 // 立即同步时减少延迟
                setTimeout(() => {
                    if (tabBoxRef.current) {
                        console.log('App', '更新拖拽处理器，Tab 数量:', validViewTitles.length)

                        // 根据模式更新拖拽处理器
                        switch (dragMode) {
                            case 'direct':
                                // 直接拖拽处理器不需要更新
                                break
                            case 'simple':
                                simpleDragHandler.update()
                                break
                            case 'legacy':
                                legacyDragHandler.initialize(
                                    tabBoxRef.current,
                                    handleTabReorder,
                                    setUserReorderingState
                                )
                                break
                        }
                    }
                }, updateDelay)
            }
        } catch (error) {
            // 处理标签页刷新消息失败
            // 如果用户正在重排，不要清空Tab列表
            if (!isUserReordering && !isUserReorderingRef.current) {
                // 设置空数组作为后备
                setListViewTitle([])
            } else {
                // 用户正在重排，跳过错误后备处理
            }
        }
    }

    useEffect(() => {
        window[ECommon.ElectronEventListener].onMainMsg(debounce(handleMainMessage, 100))
        ipcRenderer.invoke(EMessage.EWindowIsMaximize, EWnd.EMain).then((isMax: boolean) => {
            setIsMaximized(isMax)
        })

        // 请求初始Tab数据
        // 应用启动，请求初始Tab数据
        // 这里应该有一个请求Tab数据的IPC调用，但我们先添加日志来确认

        // 初始化新的 Tab 系统
        if (useNewTabSystem) {
            tabIpcClient.initialize()
        } else {
            // 延迟初始化旧系统的拖拽功能，确保 DOM 已渲染
            setTimeout(() => {
                if (tabBoxRef.current) {
                    console.log('App', '初始化拖拽处理器', {
                        dragMode,
                        container: tabBoxRef.current,
                        children: Array.from(tabBoxRef.current.children).map(child => ({
                            tagName: child.tagName,
                            className: child.className,
                            textContent: child.textContent?.trim(),
                        })),
                    })

                    // 根据模式选择拖拽处理器
                    switch (dragMode) {
                        case 'ultra':
                            ultraSimpleDragHandler.initialize(
                                tabBoxRef.current,
                                handleTabReorder,
                                setUserReorderingState
                            )
                            break
                        case 'direct':
                            directDragHandler.initialize(tabBoxRef.current, handleTabReorder, setUserReorderingState)
                            break
                        case 'simple':
                            simpleDragHandler.initialize(tabBoxRef.current, handleTabReorder, setUserReorderingState)
                            break
                        case 'legacy':
                            legacyDragHandler.initialize(tabBoxRef.current, handleTabReorder, setUserReorderingState)
                            break
                    }

                    // 添加一个简单的测试事件监听器
                    tabBoxRef.current.addEventListener('click', e => {
                        console.log('App', 'Tab 容器点击事件', {
                            target: e.target,
                            targetClassName: (e.target as HTMLElement).className,
                        })
                    })
                }
            }, 500) // 给更多时间让 Tab 元素渲染完成
        }

        return () => {
            // 清理 Tab IPC 客户端
            if (useNewTabSystem) {
                tabIpcClient.destroy()
            } else {
                legacyDragHandler.destroy()
                simpleDragHandler.destroy()
                directDragHandler.destroy()
                ultraSimpleDragHandler.destroy()
            }
        }
    }, [])

    // 监听 listViewTitle 变化
    useEffect(() => {
        console.log('App', 'listViewTitle 状态变化', {
            count: listViewTitle.length,
            titles: listViewTitle.map(item => item?.title),
            isUserReordering,
        })
    }, [listViewTitle, isUserReordering])

    /**
     * 监听窗口最大化状态变化
     */
    const handleAppUnmaximize = (_evt: any, isMaxed: boolean) => {
        setIsMaximized(isMaxed)
    }
    window[ECommon.ElectronEventListener]?.onAppUnmaximize(handleAppUnmaximize)

    const onClickSetting = () => {
        ipcRenderer.send(EMessage.EWindowOpen, EWnd.ESetting)
    }

    const getShowMin = () => {
        return !(isDarwin && isMaximized)
    }

    const handleMini = () => {
        ipcRenderer.send(EMessage.EWindowMinimize, EWnd.EMain)
        ipcRenderer.send(EMessage.EMainBvMgrResetBound)
    }

    const handleMaxi = () => {
        ipcRenderer.invoke(EMessage.EWindowMaximize, EWnd.EMain).then((isMax: boolean) => {
            setIsMaximized(isMax)
            ipcRenderer.send(EMessage.EMainBvMgrResetBound)
        })
    }

    const handleHide = () => {
        ipcRenderer.send(EMessage.EWindowClose, EWnd.EMain)
    }

    const getTabClass = (id: string) => {
        if (id === strCurViewId) {
            return 'tab_item_active'
        }
        const currentIndex = listViewTitle.findIndex((item: any) => item && item.id === strCurViewId)
        const idIndex = listViewTitle.findIndex((item: any) => item && item.id === id)
        return idIndex > currentIndex ? 'tab_item_right' : 'tab_item_left'
    }

    const handleClose = (viewId: string) => {
        ipcRenderer.invoke(EMessage.EMainBrowserviewClose, viewId)
    }

    const handleTabItemClick = (viewId: string) => {
        const item = listViewTitle.find((item: any) => item && item.id === strCurViewId)
        if (item) {
            // 立即更新本地tab状态，提供即时反馈
            setCurrentViewId(viewId)

            // 通知主进程切换tab
            ipcRenderer.invoke(EMessage.EMainBrowserviewSetTop, viewId)
        }
    }

    /**
     * 处理 Tab 重排
     * @param fromIndex 原始位置
     * @param toIndex 目标位置
     */
    const handleTabReorder = (fromIndex: number, toIndex: number) => {
        console.log('App', '处理 Tab 重排', {
            fromIndex,
            toIndex,
            listViewTitleLength: listViewTitle.length,
            isUserReordering,
            isUserReorderingRef: isUserReorderingRef.current,
            currentTabs: listViewTitle.map((item, index) => ({
                index,
                id: item?.id,
                title: item?.title,
            })),
            callStack: new Error().stack,
        })

        // 设置用户重排标志，阻止自动刷新
        setUserReorderingState(true)

        // 检查基本有效性
        if (fromIndex < 0 || toIndex < 0) {
            console.warn('App', '索引为负数', { fromIndex, toIndex })
            setIsUserReordering(false)
            return
        }

        // 检查Tab列表状态
        const validTabs = listViewTitle.filter((item: any) => item && item.id)
        console.log('App', 'Tab列表状态检查', {
            listViewTitleLength: listViewTitle.length,
            validTabsLength: validTabs.length,
            fromIndex,
            toIndex,
            listViewTitle: listViewTitle.map((item, idx) => ({
                idx,
                id: item?.id,
                title: item?.title,
                valid: !!(item && item.id),
            })),
        })

        if (listViewTitle.length === 0) {
            console.warn('App', 'Tab列表完全为空，尝试从DOM重建')

            // 尝试从DOM中重建Tab列表
            const tabContainer = document.querySelector('.tab_box') as HTMLElement
            if (tabContainer) {
                const tabElements = Array.from(tabContainer.children) as HTMLElement[]
                console.log('App', 'DOM中的Tab元素', {
                    count: tabElements.length,
                    elements: tabElements.map((el, idx) => ({
                        idx,
                        className: el.className,
                        textContent: el.textContent?.trim(),
                        hasTabClass: el.className.includes('tab_item'),
                    })),
                })

                if (tabElements.length > 0) {
                    console.log('App', 'DOM中有Tab元素但状态为空，直接操作DOM实现重排')

                    // 过滤出真正的tab元素，排除div_drag
                    const realTabElements = tabElements.filter(
                        el => el.className.includes('tab_item') && !el.className.includes('div_drag')
                    )

                    console.log('App', '过滤后的真实Tab元素', {
                        originalCount: tabElements.length,
                        realTabCount: realTabElements.length,
                        realTabs: realTabElements.map((el, idx) => ({
                            idx,
                            className: el.className,
                            textContent: el.textContent?.trim(),
                        })),
                    })

                    // 直接操作DOM实现重排，绕过React状态，确保不影响div_drag
                    if (
                        fromIndex >= 0 &&
                        toIndex >= 0 &&
                        fromIndex < realTabElements.length &&
                        toIndex < realTabElements.length
                    ) {
                        const draggedElement = realTabElements[fromIndex]
                        const targetElement = realTabElements[toIndex]

                        if (draggedElement && targetElement && draggedElement !== targetElement) {
                            console.log('App', '执行DOM重排', {
                                fromIndex,
                                toIndex,
                                draggedTitle: draggedElement.textContent?.trim(),
                                targetTitle: targetElement.textContent?.trim(),
                            })

                            // 找到div_drag元素，确保它保持在最后
                            const divDragElement = tabContainer.querySelector('.div_drag')

                            // 执行DOM重排
                            if (fromIndex < toIndex) {
                                // 向后移动
                                targetElement.parentNode?.insertBefore(draggedElement, targetElement.nextSibling)
                            } else {
                                // 向前移动
                                targetElement.parentNode?.insertBefore(draggedElement, targetElement)
                            }

                            // 确保div_drag始终在最后
                            if (divDragElement && divDragElement.parentNode) {
                                divDragElement.parentNode.appendChild(divDragElement)
                            }

                            console.log('App', 'DOM重排完成，div_drag已确保在最后位置')
                        }
                    }

                    setUserReorderingState(false)
                    return
                }
            }

            console.warn('App', 'DOM中也没有Tab元素，跳过重排操作')
            setUserReorderingState(false)
            return
        }

        // 调整索引范围（基于实际数组长度）
        const adjustedFromIndex = Math.min(Math.max(fromIndex, 0), listViewTitle.length - 1)
        const adjustedToIndex = Math.min(Math.max(toIndex, 0), listViewTitle.length - 1)

        if (adjustedFromIndex !== fromIndex || adjustedToIndex !== toIndex) {
            console.log('App', '调整索引范围', {
                original: { fromIndex, toIndex },
                adjusted: { fromIndex: adjustedFromIndex, toIndex: adjustedToIndex },
                listViewTitleLength: listViewTitle.length,
            })
        }

        // 使用调整后的索引
        const finalFromIndex = adjustedFromIndex
        const finalToIndex = adjustedToIndex

        // 更新本地状态
        const newListViewTitle = [...listViewTitle]
        const movedItem = newListViewTitle[finalFromIndex]

        console.log('App', '移动的项目', {
            fromIndex: finalFromIndex,
            toIndex: finalToIndex,
            movedItem: { id: movedItem?.id, title: movedItem?.title },
            listLength: newListViewTitle.length,
        })

        // 确保移动的项存在
        if (!movedItem) {
            console.warn('App', '要移动的 Tab 项不存在', {
                fromIndex: finalFromIndex,
                listLength: newListViewTitle.length,
                availableItems: newListViewTitle.map((item, index) => ({ index, title: item?.title })),
            })
            setIsUserReordering(false) // 重置标志
            return
        }

        // 执行重排
        newListViewTitle.splice(finalFromIndex, 1)
        newListViewTitle.splice(finalToIndex, 0, movedItem)

        console.log('App', '重排后的 Tab 列表', {
            before: listViewTitle.map(item => item?.title),
            after: newListViewTitle.map(item => item?.title),
        })

        // 强制触发状态更新
        setListViewTitle([...newListViewTitle])

        // 验证状态是否真的更新了
        setTimeout(() => {
            console.log('App', '状态更新后验证', {
                currentState: listViewTitle.map(item => item?.title),
                expected: newListViewTitle.map(item => item?.title),
            })
        }, 100)

        // 延迟清除用户重排标志，允许自动刷新恢复
        setTimeout(() => {
            console.log('App', '清除用户重排标志，恢复自动刷新')
            setUserReorderingState(false)
        }, 2000) // 2秒后恢复自动刷新

        // 通知主进程更新 Tab 顺序
        // 这里可以添加与主进程的通信逻辑
        // ipcRenderer.send(EMessage.EMainTabReorder, { fromIndex, toIndex })
    }
    const [currentHoverId, setCurrentHoverId] = useState('')
    return (
        <div className="win_container">
            <Shadow ref={refShadow}>
                <div className={showBorder ? 'main_container_border' : 'main_container'}>
                    <div className="app_nav_bar">
                        <div className="div_left">
                            <div className="history-_back">
                                <SvgButton
                                    normalIcon={historyBack}
                                    hoverIcon={historyBackHover}
                                    outSize="24px"
                                    imgSize="24px"
                                    onClick={() => {
                                        ipcRenderer.send(EMessage.EMainHistoryBack)
                                    }}
                                />
                            </div>
                            <div className="tab_box" ref={tabBoxRef}>
                                <ErrorBoundary
                                    fallback={
                                        <div style={{ padding: '10px', color: '#666', fontSize: '12px' }}>
                                            Tab 加载出错，请刷新页面重试
                                        </div>
                                    }
                                >
                                    {useNewTabSystem ? (
                                        <TabRenderer
                                            ipcClient={tabIpcClient}
                                            enableReordering={true}
                                            enableAnimation={true}
                                            animationDuration={300}
                                            className="new-tab-system"
                                        />
                                    ) : (
                                        // 保留旧的 Tab 系统作为后备
                                        <>
                                            {listViewTitle
                                                .filter((item: any) => item && item.id) // 过滤掉空值和无效项
                                                .map((item: any, nIndex: number) => {
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => handleTabItemClick(item.id)}
                                                            className={`${getTabClass(item.id)}${
                                                                item.id === currentHoverId ? ' tab_item_hover' : ''
                                                            }`}
                                                            onMouseEnter={() => {
                                                                nIndex >= 1 && setCurrentHoverId(item.id)
                                                            }}
                                                            onMouseLeave={() => {
                                                                nIndex >= 1 && setCurrentHoverId('')
                                                            }}
                                                            style={{
                                                                width: `${
                                                                    100 /
                                                                    listViewTitle.filter(item => item && item.id).length
                                                                }%`,
                                                            }}
                                                            title={item.title || ''}
                                                        >
                                                            <div className="tab_text">{item.title || '未命名'}</div>
                                                            {nIndex >= 1 && (
                                                                <div
                                                                    className="tab_icon_close"
                                                                    onClick={e => {
                                                                        e.stopPropagation()
                                                                        handleClose(item.id)
                                                                    }}
                                                                >
                                                                    <SvgButton
                                                                        normalIcon={btnCloseNormal}
                                                                        hoverIcon={btnCloseHover}
                                                                        outSize="14px"
                                                                        imgSize="14px"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            <div className="div_drag" />
                                        </>
                                    )}
                                </ErrorBoundary>
                            </div>
                        </div>

                        <div className="div_right">
                            <div className="nav_btn_list">
                                <SvgButton
                                    normalIcon={btnSettingNormal}
                                    hoverIcon={btnSettingHover}
                                    onClick={onClickSetting}
                                    outSize={IconOutSize}
                                    imgSize="24px"
                                />
                                {getShowMin() && (
                                    <SvgButton
                                        normalIcon={btnMiniNormal}
                                        hoverIcon={btnMiniHover}
                                        onClick={handleMini}
                                        outSize={IconOutSize}
                                        imgSize="24px"
                                    />
                                )}

                                <SvgButton
                                    normalIcon={btnUnmaximizeNormal}
                                    hoverIcon={btnUnmaximizeHover}
                                    onClick={() => {
                                        handleMaxi()
                                    }}
                                    outSize={IconOutSize}
                                    imgSize="24px"
                                />

                                <SvgButton
                                    normalIcon={btnCloseNormal}
                                    hoverIcon={btnCloseHover}
                                    onClick={handleHide}
                                    outSize={IconOutSize}
                                    imgSize="24px"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="main_loading_container">
                        <div className="loading_log">
                            <div className="loading_reason"> {uiStrReason}</div>
                            <br />
                            {uiListOperate.map((strItem: string, nIndex: number) => {
                                return (
                                    <div className="loading_operate" key={nIndex}>
                                        {strItem}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="main_loading">
                            <img className="img_bg" src={loadingIcon} alt=""></img>
                        </div>
                    </div>
                </div>
            </Shadow>
        </div>
    )
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
)
