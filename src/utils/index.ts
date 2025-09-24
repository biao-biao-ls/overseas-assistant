/**
 * 防抖函数 - 在指定时间内多次调用只执行最后一次
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @param immediate 是否立即执行第一次调用
 * @returns 防抖后的函数
 */
export function debounce(func: Function, delay: number, immediate: boolean = false): Function {
    let timer: NodeJS.Timeout | null = null

    return function (...args: any[]) {
        const context = this
        const callNow = immediate && !timer

        // 清除之前的定时器
        if (timer) {
            clearTimeout(timer)
        }

        // 立即执行模式（第一次触发时立即执行）
        if (callNow) {
            func.apply(context, args)
        }

        // 设置新的定时器
        timer = setTimeout(() => {
            if (!immediate) {
                func.apply(context, args)
            }
            timer = null // 执行完成后清除标记
        }, delay)
    }
}

/**
 * 从URL字符串中移除语言段
 * @param str 原始URL字符串
 * @param lang 要移除的语言代码
 * @returns 移除语言段后的URL字符串
 */
export function removeLangSegment(str: string, lang: string): string {
    // 转义语言代码中的特殊字符
    const escapedLang = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // 创建匹配 /lang/ 或 /lang 结尾的正则表达式
    const regex = new RegExp(`\\/${escapedLang}\\/|\\/${escapedLang}(?=$|\\?)`, 'g')

    // 替换匹配到的部分
    return str.replace(regex, '/').replace(/\/{2,}/g, '/')
}