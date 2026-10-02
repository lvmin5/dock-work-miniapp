const storage = require('../../utils/storage')

Page({
  data: {
    today: '',
    machineOptions: ['龙1', '龙2', '岸桥', '门机1', '门机2'],
    workOptions: ['装船', '卸船', '装车', '卸车'],
    weightOptions: [],
    filteredWeightOptions: [],
    boxOptions: ['20尺', '40尺'],
    form: {
      machine: '',
      handlingType: '',
      workType: '',
      isBulk: false,
      weightType: '',
      boxType: ''
    },
    quantity: '',
    inputType: 'number',
    showQuantityInput: false,
    showModal: false,
    closedManually: false,
    showBoxType: false,
    canSave: false,
    quantityPlaceholder: '请输入整数',
    quantityTip: '只能输入整数'
  },

  onShow() {
    const { standard, bulk } = storage.getAllKinds()
    this.setData({
      today: storage.getTodayDate(),
      weightOptions: [...standard, ...bulk],
      filteredWeightOptions: standard
    })
    this.refreshInputState()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onDateChange(event) {
    this.setData({ today: event.detail.value })
  },

  chooseOption(event) {
    const { field, value } = event.currentTarget.dataset
    const form = {
      ...this.data.form,
      [field]: value
    }

    if (field === 'workType') {
      if (value === '装车' || value === '卸车') {
        form.handlingType = '提交箱'
        form.isBulk = false
      } else {
        form.handlingType = '装卸船'
        form.isBulk = false
      }
      form.weightType = ''
      form.boxType = ''
    }

    if (field === 'weightType' && !storage.isStandardContainer(value)) {
      form.boxType = ''
    }

    this.setData({ form, closedManually: false })
    this.refreshInputState()
  },

  chooseIsBulk(event) {
    const { isbulk } = event.currentTarget.dataset
    const isBulk = isbulk === 'true'
    const form = {
      ...this.data.form,
      isBulk,
      handlingType: isBulk ? '散货' : '装卸船',
      weightType: '',
      boxType: ''
    }

    this.setData({ form, closedManually: false })
    this.refreshInputState()
  },

  openQuantityModal() {
    this.setData({ showModal: true })
  },

  closeQuantityModal() {
    this.setData({ showModal: false, closedManually: true })
  },

  onQuantityInput(event) {
    this.setData({ quantity: event.detail.value })
    this.refreshInputState()
  },

  refreshInputState() {
    const { form, quantity, closedManually } = this.data
    const isFloatInput = storage.isFloatKind(form.weightType)
    const isStandard = storage.isStandardContainer(form.weightType)
    const { standard, bulk } = storage.getAllKinds()
    const filteredWeightOptions = form.handlingType === '散货' ? bulk : standard
    const hasBaseOptions = Boolean(form.machine && form.handlingType && form.workType && form.weightType)
    const showBoxType = isStandard
    const showQuantityInput = hasBaseOptions && (!isStandard || Boolean(form.boxType))
    const canSave = showQuantityInput && quantity !== ''
    const showModal = showQuantityInput && !closedManually

    this.setData({
      filteredWeightOptions,
      inputType: isFloatInput ? 'digit' : 'number',
      showQuantityInput,
      showBoxType,
      canSave,
      showModal,
      quantityPlaceholder: isFloatInput ? '请输入数量' : '请输入整数',
      quantityTip: isFloatInput ? '可以输入小数' : '只能输入整数'
    })
  },

  validateQuantity() {
    const { form, quantity } = this.data

    if (storage.isFloatKind(form.weightType)) {
      if (!/^\d+(\.\d+)?$/.test(quantity) || Number(quantity) <= 0) {
        return `${form.weightType}数量请输入大于 0 的数字`
      }

      return ''
    }

    if (!/^\d+$/.test(quantity) || Number(quantity) <= 0) {
      return `${form.weightType}数量请输入大于 0 的整数`
    }

    return ''
  },

  saveRecord() {
    if (!this.data.showQuantityInput) {
      const { form } = this.data
      if (storage.isStandardContainer(form.weightType) && !form.boxType) {
        wx.showToast({
          title: '请先选择箱型',
          icon: 'none'
        })
      } else {
        wx.showToast({
          title: '请先选完整',
          icon: 'none'
        })
      }
      return
    }

    const errorMessage = this.validateQuantity()

    if (errorMessage) {
      wx.showToast({
        title: errorMessage,
        icon: 'none'
      })
      return
    }

    const { isBulk, ...recordData } = this.data.form
    storage.addRecord({
      date: this.data.today,
      ...recordData,
      quantity: Number(this.data.quantity)
    })

    this.setData({ quantity: '', showModal: false, closedManually: false })
    this.refreshInputState()

    wx.showToast({
      title: '已保存',
      icon: 'success'
    })
  }
})
