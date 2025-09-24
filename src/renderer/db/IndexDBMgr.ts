const DBName = 'MsgDB'
const StoreName = 'MsgStore'
const DBVersion = 1
const ReadWrite = 'readwrite'
// 前端页面数据库
export class IndexDBMgr {
    private m_db: IDBDatabase
    // life start ---------------------------------------------------------
    constructor() {}
    init() {
        this.createIndexDB()
    }
    // life end ---------------------------------------------------------
    // state start ---------------------------------------------------------
    // state end ---------------------------------------------------------
    // check start ---------------------------------------------------------
    // check end ---------------------------------------------------------
    // data start ---------------------------------------------------------
    // data end ---------------------------------------------------------
    // action start ---------------------------------------------------------
    createIndexDB() {
        let strDBName = DBName
        let nVersion = DBVersion
        let strStoreName = StoreName

        let indexedDB = window.indexedDB

        const request = indexedDB.open(strDBName, nVersion)
        request.onsuccess = event => {
            this.m_db = (event.target as any).result

            // 成功打开数据库
        }

        request.onerror = event => {
            // 打开数据库失败
        }

        request.onupgradeneeded = event => {
            // 数据库创建或升级的时候会触发
            this.m_db = (event.target as any).result

            if (!this.m_db.objectStoreNames.contains(strStoreName)) {
                let objectStore = this.m_db.createObjectStore(strStoreName)
            }
        }
    }
    public saveData(strKey: string, data) {
        this.getData(strKey).then(findData => {
            if (findData) {
                this.updateData(strKey, data)
            } else {
                this.addData(strKey, data)
            }
        })
    }

    private addData(strKey: string, data) {
        return new Promise((resolve, reject) => {
            let store = this.m_db.transaction([StoreName], ReadWrite).objectStore(StoreName)
            let request = store.add(data, strKey)

            request.onsuccess = event => {
                // 添加数据成功
                resolve(event)
            }

            request.onerror = event => {
                // 添加数据失败
                reject(event)
            }
        })
    }
    public deleteData(strStoreName, strId) {
        let request = this.m_db.transaction([strStoreName], ReadWrite).objectStore(strStoreName).delete(strId)

        request.onsuccess = () => {
            // 数据删除成功
        }

        request.onerror = event => {
            // 数据删除失败
        }
    }

    public getData(strKey: string) {
        return new Promise((resolve, reject) => {
            let transaction = this.m_db.transaction([StoreName])
            let objectStore = transaction.objectStore(StoreName)
            let request = objectStore.get(strKey)

            request.onsuccess = event => {
                // 获取数据成功
                resolve((event.target as any).result)
            }
            request.onerror = event => {
                // 查询失败
            }
        })
    }

    public updateData(strKey: string, data) {
        let request = this.m_db
            .transaction([StoreName], ReadWrite) // 事务对象
            .objectStore(StoreName) // 仓库对象
            .put(data, strKey)

        request.onsuccess = event => {
            // 数据更新成功
        }

        request.onerror = event => {
            // 数据更新失败
        }
    }

    public cursorHandle(funHandle: Function) {
        return new Promise((resolve, reject) => {
            let transaction = this.m_db.transaction([StoreName])
            let objectStore = transaction.objectStore(StoreName)
            let listResult: any[] = []
            objectStore.openCursor().onsuccess = e => {
                const cursor = (e.target as any).result
                if (cursor) {
                    if (funHandle) {
                        let bResult = funHandle(cursor.value)
                        if (bResult) {
                            listResult.push(cursor.value)
                        }
                    }
                    cursor.continue()
                } else {
                    resolve(listResult)
                }
            }
        })
    }
    // action end ---------------------------------------------------------
    // callback start ---------------------------------------------------------
    // callback end ---------------------------------------------------------
    // update start ---------------------------------------------------------
    // update end ---------------------------------------------------------
}
