export class Queue<T> {
	protected m_listArray: Array<T> = []
	private m_nMaxCount: number
	private m_funDelete: Function
	constructor(nCount: number = 1000) {
		this.m_nMaxCount = nCount
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

	public dequeue(): T | undefined {
		if (this.m_listArray.length <= 0) return undefined
		let result: T = this.m_listArray[0]
		this.m_listArray.splice(0, 1)
		return result
	}

	public enqueue(item: T) {
		if (this.getCount() >= this.m_nMaxCount) {
			if (this.m_funDelete) {
				this.m_funDelete(this.dequeue())
			}
		}
		this.m_listArray.push(item)
	}

	public peek(): T | undefined {
		if (this.m_listArray.length <= 0) return undefined
		let result: T = this.m_listArray[0]
		return result
	}
	public getArray(): T[] {
		return this.m_listArray
	}
	registerOnDelete(funDelete: (T) => void) {
		this.m_funDelete = funDelete
	}
}
