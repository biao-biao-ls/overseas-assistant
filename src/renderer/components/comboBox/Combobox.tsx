import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import './Combobox.css'

import '../../style.css'

interface Props {
    title: string
    selectType: string
    onChange: Function
    listCfg: { [key: string]: unknown }[]
}
const ComboBox = forwardRef((props: Props, ref: any) => {
    const { title, selectType, onChange, listCfg } = props
    let dictAllCfg = {}
    for (const dictCfg of listCfg) {
        dictAllCfg[(dictCfg as any).cfg.toString()] = dictCfg
    }
    const [boxWidth, setBoxWidth] = useState(0)
    const [boxheight, setBoxHeight] = useState(0)
    const [expand, setExpand] = useState(false)
    const [boxX, setBoxX] = useState(0)
    const [boxY, setBoxY] = useState(0)
    const [currentSelect, setCurrentSelect] = useState('')
    const [currentSelectName, setCurrentSelectName] = useState('')
    const selectInput = useRef(null)
    const selectList = useRef(null)
    const handleChangeTypeValue = strValue => {
        setSelectId(strValue)
        setExpand(false)
        onChange(selectType, strValue)
    }
    const onMouseClickSelect = () => {
        const selectElement = selectInput.current as HTMLSelectElement
        const rect = selectElement.getBoundingClientRect()
        setBoxWidth(rect.width)
        // 统计列表个数
        let nSize = Math.min(Object.keys(listCfg).length, 10) * 20
        setBoxHeight(nSize)
        setBoxX(rect.x)
        setBoxY(rect.y + rect.height)

        setExpand(!expand)
    }
    useImperativeHandle(ref, () => ({
        close,
        setSelectId,
    }))
    const setSelectId = (strId: string) => {
        console.log('ComboBox setSelectId 调用:', {
            selectType,
            strId,
            hasConfig: !!dictAllCfg[strId],
            configName: dictAllCfg[strId]?.name,
            allKeys: Object.keys(dictAllCfg)
        })
        
        setCurrentSelect(strId)
        
        if (dictAllCfg[strId]) {
            setCurrentSelectName(dictAllCfg[strId].name as string)
            console.log('ComboBox 设置显示名称:', dictAllCfg[strId].name)
        } else {
            console.log('ComboBox 警告: 未找到配置', strId)
            // 设置一个默认值或空字符串
            setCurrentSelectName(strId || '')
        }
    }
    const close = () => {
        setExpand(false)
    }

    document.body.addEventListener('mousedown', e => {
        // 如果点击的不是下拉框或下拉框的选项，则关闭下拉框
        if (
            !ReactDOM.findDOMNode(selectInput.current)?.contains(e.target as Node) &&
            !ReactDOM.findDOMNode(selectList.current)?.contains(e.target as Node)
        ) {
            if (expand) {
                close()
            }
        }
    })

    return (
        <>
            <div className="comboBox_item">
                <span className="comboBox_item_name">{title}</span>
                <div
                    className={`comboBox_item_select_wrap ${expand ? 'select_down' : 'select_up'}`}
                    onMouseDown={() => {
                        onMouseClickSelect()
                    }}
                >
                    <div className="comboBox_item_content">{currentSelectName}</div>
                    <input
                        ref={selectInput}
                        className={expand ? 'comboBox_item_select_up' : 'comboBox_item_select_down'}
                        placeholder={title}
                        type="button"
                    />
                </div>
            </div>
            <div
                ref={selectList}
                className="comboBox_list"
                style={{
                    width: boxWidth + 'px',
                    height: boxheight + 'px',
                    left: boxX + 'px',
                    top: boxY + 'px',
                    display: expand ? 'block' : 'none',
                }}
            >
                {listCfg.map((item, nIndex) => {
                    return (
                        <option
                            key={nIndex}
                            tabIndex={nIndex}
                            value={item.name.toString()}
                            onMouseDown={() => {
                                handleChangeTypeValue(item.cfg.toString())
                            }}
                            className={
                                currentSelect === item.cfg.toString()
                                    ? 'comboBox_list_item_selected'
                                    : 'comboBox_list_item_normal'
                            }
                        >
                            {item.name.toString()}
                        </option>
                    )
                })}
            </div>
        </>
    )
})

export default ComboBox
