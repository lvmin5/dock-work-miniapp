const storage = require('../../utils/storage')

Page({
  data: {
    records: [],
    filteredRecords: [],
    machineOptions: ['龙1', '龙2', '岸桥', '门机1', '门机2'],
    workOptions: ['装船', '卸船', '装车', '卸车'],
    boxOptions: ['20尺', '40尺'],
    showEditor: false,
    editingId: '',
    editForm: {
      date: '',
      machine: '',
      handlingType: '',
      workType: '',
      isBulk: false,
      weightType: '',
      boxType: ''
    },
    filteredEditWeightOptions: [],
    showEditBoxType: false,
    showEditQuantityInput: true,
    editQuantity: '',
    editInputType: 'number',
    editQuantityPlaceholder: '请输入整数',
    editQuantityTip: '只能输入整数',
    startDate: '',
    endDate: '',
    hasFilter: false
  },

  onShow() {
    this.loadRecords()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  loadRecords() {
    const records = storage.getRecords().map((record) => ({
      ...record,
      quantityText: storage.formatQuantity(record.weightType, record.quantity)
    }))

    this.setData({ records }, () => {
      this.applyFilter()
    })
  },

  onStartDateChange(event) {
    this.setData({ startDate: event.detail.value }, () => {
      this.applyFilter()
    })
  },

  onEndDateChange(event) {
    this.setData({ endDate: event.detail.value }, () => {
      this.applyFilter()
    })
  },

  clearFilter() {
    this.setData({ startDate: '', endDate: '' }, () => {
      this.applyFilter()
    })
  },

  applyFilter() {
    const { records, startDate, endDate } = this.data
    let filtered = records

    if (startDate) {
      filtered = filtered.filter((r) => r.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= endDate)
    }

    this.setData({
      filteredRecords: filtered,
      hasFilter: Boolean(startDate || endDate)
    })
  },

  exportFile() {
    const { filteredRecords, startDate, endDate } = this.data

    if (filteredRecords.length === 0) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' })
      return
    }

    const rates = storage.getRateMap()
    const headers = ['日期', '机械号', '装卸类型', '作业类型', '吉重/散货', '箱型', '数量', '单价(元)', '金额(元)']
    const rows = filteredRecords.map((record) => {
      const rate = rates[record.weightType] || {}
      const billingQty = storage.getEffectiveQuantity(record)
      const amount = (billingQty * Number(rate.price || 0)).toFixed(2)
      return [
        record.date,
        record.machine,
        record.handlingType,
        record.workType,
        record.weightType,
        record.boxType || '-',
        record.quantityText,
        rate.price != null ? Number(rate.price).toFixed(2) : '-',
        amount
      ]
    })

    const htmlRows = rows.map((row) =>
      '<tr>' + row.map((cell) => `<td>${cell}</td>`).join('') + '</tr>'
    ).join('')

    const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]>
<xml>
  <x:ExcelWorkbook>
    <x:ExcelWorksheets>
      <x:ExcelWorksheet>
        <x:Name>明细</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet>
    </x:ExcelWorksheets>
  </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  table { border-collapse: collapse; font-size: 13pt; }
  th, td { border: 1px solid #888; padding: 4px 8px; text-align: center; }
  th { background: #cfe8e0; color: #0f4c46; font-weight: bold; }
</style>
</head>
<body>
  <table border="1">
    <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
    ${htmlRows}
  </table>
</body>
</html>`

    const fs = wx.getFileSystemManager()
    const fileName = `明细导出_${startDate || '全部'}_${endDate || '全部'}.xls`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`

    try {
      fs.writeFileSync(filePath, htmlContent, 'utf8')

      wx.showActionSheet({
        itemList: ['打开文件', '分享文件'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.openDocument({
              filePath,
              fileType: 'xls',
              showMenu: true,
              success: () => {
                wx.showToast({ title: '导出成功', icon: 'success' })
              },
              fail: (err) => {
                console.error('openDocument fail', err)
                wx.showToast({ title: '打开文件失败', icon: 'none' })
              }
            })
          } else if (res.tapIndex === 1) {
            wx.shareFileMessage({
              filePath,
              fileName,
              fail: (err) => {
                console.error('shareFileMessage fail', err)
                wx.showToast({ title: '分享失败', icon: 'none' })
              }
            })
          }
        }
      })
    } catch (error) {
      console.error('export fail', error)
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  backupData() {
    const records = storage.getRecords()

    if (records.length === 0) {
      wx.showToast({ title: '没有可备份的数据', icon: 'none' })
      return
    }

    const payload = {
      app: 'dock-work-miniapp',
      type: 'dock-work-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      count: records.length,
      records
    }

    const fs = wx.getFileSystemManager()
    const stamp = storage.getTodayDate().replace(/-/g, '')
    const fileName = `明细备份_${stamp}.json`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`

    try {
      fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8')

      wx.showModal({
        title: '备份重要提示',
        content: '清理手机内存时本地备份文件也会被删除。请务必先将备份文件分享到微信「文件传输助手」或好友处保存。',
        confirmText: '去分享',
        cancelText: '打开文件',
        success: (modal) => {
          if (modal.confirm) {
            wx.shareFileMessage({
              filePath,
              fileName,
              fail: (err) => {
                console.error('shareFileMessage fail', err)
                wx.showToast({ title: '分享失败', icon: 'none' })
              }
            })
          } else {
            wx.openDocument({
              filePath,
              fileType: 'json',
              showMenu: true,
              fail: () => wx.showToast({ title: '无法打开，建议分享保存', icon: 'none' })
            })
          }
        }
      })
    } catch (error) {
      console.error('backup fail', error)
      wx.showToast({ title: '备份失败', icon: 'none' })
    }
  },

  importData() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (chooseResult) => {
        const chosenFile = chooseResult.tempFiles[0]
        const fs = wx.getFileSystemManager()

        fs.readFile({
          filePath: chosenFile.path,
          encoding: 'utf8',
          success: (readResult) => {
            let payload

            try {
              payload = JSON.parse(readResult.data)
            } catch (error) {
              wx.showToast({ title: '不是有效的备份文件', icon: 'none' })
              return
            }

            if (!payload || payload.type !== 'dock-work-backup' || !Array.isArray(payload.records)) {
              wx.showToast({ title: '文件格式不正确', icon: 'none' })
              return
            }

            if (payload.records.length === 0) {
              wx.showToast({ title: '备份文件中没有记录', icon: 'none' })
              return
            }

            wx.showModal({
              title: '确认导入',
              content: `检测到 ${payload.records.length} 条备份记录，将与现有明细合并，重复记录会自动跳过。确定导入吗？`,
              confirmText: '导入',
              success: (modal) => {
                if (!modal.confirm) return

                const result = storage.mergeRecords(payload.records)
                this.loadRecords()

                wx.showModal({
                  title: '导入完成',
                  content: `成功导入 ${result.added} 条，跳过重复/无效 ${result.skipped} 条，当前共 ${result.total} 条。`,
                  showCancel: false
                })
              }
            })
          },
          fail: () => {
            wx.showToast({ title: '读取文件失败', icon: 'none' })
          }
        })
      }
    })
  },

  startEdit(event) {
    const editingId = event.currentTarget.dataset.id
    const record = this.data.records.find((item) => item.id === editingId)

    if (!record) {
      return
    }

    const isBulk = record.handlingType === '散货'

    this.setData({
      showEditor: true,
      editingId,
      editForm: {
        date: record.date,
        machine: record.machine,
        handlingType: record.handlingType,
        workType: record.workType,
        isBulk,
        weightType: record.weightType,
        boxType: record.boxType
      },
      editQuantity: `${record.quantity}`
    })
    this.refreshEditState()
  },

  cancelEdit() {
    this.setData({
      showEditor: false,
      editingId: '',
      editQuantity: ''
    })
  },

  onEditDateChange(event) {
    this.setData({
      editForm: {
        ...this.data.editForm,
        date: event.detail.value
      }
    })
  },

  chooseEditOption(event) {
    const { field, value } = event.currentTarget.dataset
    const editForm = {
      ...this.data.editForm,
      [field]: value
    }

    if (field === 'workType') {
      if (value === '装车' || value === '卸车') {
        editForm.handlingType = '提交箱'
        editForm.isBulk = false
      } else {
        editForm.handlingType = '装卸船'
        editForm.isBulk = false
      }
      editForm.weightType = ''
      editForm.boxType = ''
    }

    if (field === 'weightType' && !storage.isStandardContainer(value)) {
      editForm.boxType = ''
    }

    this.setData({ editForm })
    this.refreshEditState()
  },

  chooseEditIsBulk(event) {
    const { isbulk } = event.currentTarget.dataset
    const isBulk = isbulk === 'true'
    const editForm = {
      ...this.data.editForm,
      isBulk,
      handlingType: isBulk ? '散货' : '装卸船',
      weightType: '',
      boxType: ''
    }

    this.setData({ editForm })
    this.refreshEditState()
  },

  onEditQuantityInput(event) {
    this.setData({ editQuantity: event.detail.value })
  },

  refreshEditState() {
    const { editForm } = this.data
    const isFloatInput = storage.isFloatKind(editForm.weightType)
    const isStandard = storage.isStandardContainer(editForm.weightType)
    const { standard, bulk } = storage.getAllKinds()
    const filteredEditWeightOptions = editForm.handlingType === '散货' ? bulk : standard
    const showEditQuantityInput = Boolean(editForm.weightType) && (!isStandard || Boolean(editForm.boxType))

    this.setData({
      filteredEditWeightOptions,
      showEditBoxType: isStandard,
      showEditQuantityInput,
      editInputType: isFloatInput ? 'digit' : 'number',
      editQuantityPlaceholder: isFloatInput ? '请输入数量' : '请输入整数',
      editQuantityTip: isFloatInput ? '可以输入小数' : '只能输入整数'
    })
  },

  validateEditingRecord() {
    const { editForm, editQuantity } = this.data
    const isFloatInput = storage.isFloatKind(editForm.weightType)
    const isStandard = storage.isStandardContainer(editForm.weightType)

    if (!editForm.date || !editForm.machine || !editForm.handlingType || !editForm.workType || !editForm.weightType) {
      return '请选完整'
    }

    if (isStandard && !editForm.boxType) {
      return '请选择箱型'
    }

    if (isFloatInput) {
      return /^\d+(\.\d+)?$/.test(editQuantity) && Number(editQuantity) > 0
        ? ''
        : `${editForm.weightType}数量请输入大于 0 的数字`
    }

    return /^\d+$/.test(editQuantity) && Number(editQuantity) > 0
      ? ''
      : `${editForm.weightType}数量请输入大于 0 的整数`
  },

  saveEditingRecord() {
    const errorMessage = this.validateEditingRecord()

    if (errorMessage) {
      wx.showToast({
        title: errorMessage,
        icon: 'none'
      })
      return
    }

    const { isBulk, ...recordData } = this.data.editForm
    storage.updateRecord(this.data.editingId, {
      ...recordData,
      quantity: Number(this.data.editQuantity)
    })

    this.loadRecords()
    this.cancelEdit()

    wx.showToast({
      title: '已修改',
      icon: 'success'
    })
  },

  deleteEditingRecord() {
    wx.showModal({
      title: '删除明细',
      content: '确定删除这条记录吗？',
      confirmColor: '#b64235',
      success: (result) => {
        if (!result.confirm) {
          return
        }

        storage.deleteRecord(this.data.editingId)
        this.loadRecords()
        this.cancelEdit()
      }
    })
  }
})
