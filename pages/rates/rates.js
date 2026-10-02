const storage = require('../../utils/storage')

Page({
  data: {
    rates: [],
    newKind: {
      kind: '',
      price: '',
      unit: '',
      inputType: 'integer'
    }
  },

  onShow() {
    this.setData({ rates: storage.getRates() })
  },

  onPriceInput(event) {
    const { kind } = event.currentTarget.dataset
    const { value } = event.detail
    const rates = this.data.rates.map((rate) => (
      rate.kind === kind ? { ...rate, price: value } : rate
    ))

    this.setData({ rates })
    storage.saveRates(rates)
  },

  onNewKindInput(event) {
    const { field } = event.currentTarget.dataset
    const { value } = event.detail
    this.setData({
      'newKind.kind': this.data.newKind.kind,
      'newKind.price': this.data.newKind.price,
      'newKind.unit': this.data.newKind.unit,
      'newKind.inputType': this.data.newKind.inputType,
      [`newKind.${field}`]: value
    })
  },

  onInputTypeChange(event) {
    const { type } = event.currentTarget.dataset
    this.setData({ 'newKind.inputType': type })
  },

  addCustomKind() {
    const { newKind } = this.data

    if (!newKind.kind || !newKind.kind.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }

    if (!newKind.unit || !newKind.unit.trim()) {
      wx.showToast({ title: '请输入单位', icon: 'none' })
      return
    }

    const existingKinds = storage.getCustomKinds()
    const fixedKinds = ['吉', '重', '粮食', '移箱']
    const kindName = newKind.kind.trim()

    if (fixedKinds.includes(kindName)) {
      wx.showToast({ title: '名称与固定选项重复', icon: 'none' })
      return
    }

    const existingIndex = existingKinds.findIndex((k) => k.kind === kindName)
    if (existingIndex !== -1) {
      if (existingKinds[existingIndex].archived) {
        existingKinds[existingIndex] = {
          ...existingKinds[existingIndex],
          archived: false,
          unit: newKind.unit.trim(),
          inputType: newKind.inputType
        }
        storage.saveCustomKinds(existingKinds)

        const priceValue = newKind.price ? Number(newKind.price) : 0
        const rates = storage.getRates()
        const rateIndex = rates.findIndex((r) => r.kind === kindName)
        if (rateIndex !== -1) {
          rates[rateIndex] = { ...rates[rateIndex], price: priceValue }
          storage.saveRates(rates)
        }

        this.setData({
          rates: storage.getRates(),
          newKind: {
            kind: '',
            price: '',
            unit: '',
            inputType: 'integer'
          }
        })

        wx.showToast({ title: '已恢复使用', icon: 'success' })
        return
      } else {
        wx.showToast({ title: '名称已存在', icon: 'none' })
        return
      }
    }

    const kindData = {
      kind: kindName,
      unit: newKind.unit.trim(),
      inputType: newKind.inputType,
      archived: false
    }

    const updatedKinds = [...existingKinds, kindData]
    storage.saveCustomKinds(updatedKinds)

    const priceValue = newKind.price ? Number(newKind.price) : 0
    const rates = storage.getRates()
    const rateIndex = rates.findIndex((r) => r.kind === kindData.kind)
    if (rateIndex !== -1) {
      rates[rateIndex] = { ...rates[rateIndex], price: priceValue }
    }
    storage.saveRates(rates)

    this.setData({
      rates: storage.getRates(),
      newKind: {
        kind: '',
        price: '',
        unit: '',
        inputType: 'integer'
      }
    })

    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  deleteCustomKind(event) {
    const { kind } = event.currentTarget.dataset

    wx.showModal({
      title: '删除选项',
      content: `确定删除「${kind}」吗？历史明细数据将保留。`,
      success: (result) => {
        if (!result.confirm) {
          return
        }

        const customKinds = storage.getCustomKinds()
        const updatedKinds = customKinds.map((k) =>
          k.kind === kind ? { ...k, archived: true } : k
        )
        storage.saveCustomKinds(updatedKinds)

        this.setData({ rates: storage.getRates() })
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
})
