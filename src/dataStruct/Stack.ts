export default class Stack<T> {
    private m_listArray: Array<T> = []
    private m_nMaxCount: number
    constructor(nMax: number) {
        this.m_nMaxCount = nMax
    }

    public getCount(): number {
        return this.m_listArray.length
    }

    public clear() {
        this.m_listArray = []
    }

    public contains(item: T): boolean {
        return this.m_listArray.indexOf(item) >= 0
    }
    public top(): T | undefined {
        if (this.m_listArray.length <= 0) return undefined
        return this.m_listArray[this.m_listArray.length - 1]
    }

    public pop(): T | undefined {
        if (this.m_listArray.length <= 0) return undefined
        return this.m_listArray.pop()
    }

    public push(item: T) {
        this.m_listArray.push(item)
        if (this.getCount() >= this.m_nMaxCount) {
            this.m_listArray.splice(0, 1)
        }
    }

    public getArray(): T[] {
        return this.m_listArray
    }
    public getEasyCopyArray() {
        return JSON.parse(JSON.stringify(this.m_listArray))
    }

    public toString(): string {
        let result: string = ''
        for (let item of this.m_listArray) {
            result += item + ''
        }
        return result
    }
}
