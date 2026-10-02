const storage = require('../../utils/storage')

Page({
  data: {
    modes: [
      { label: '按日', value: 'day' },
      { label: '按月', value: 'month' },
      { label: '按年', value: 'year' }
    ],
    mode: 'month',
    selectedDate: '',
    selectedMonth: '',
    selectedYear: '',
    containerRows: [],
    foodRows: [],
    hasStats: false,
    totals: {
      amount: '0.00'
    }
  },

  onShow() {
    this.setData({
      selectedDate: this.data.selectedDate || storage.getTodayDate(),
      selectedMonth: this.data.selectedMonth || storage.getCurrentMonth(),
      selectedYear: this.data.selectedYear || storage.getCurrentYear()
    })
    this.refreshStats()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  changeMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode })
    this.refreshStats()
  },

  goRates() {
    wx.navigateTo({ url: '/pages/rates/rates' })
  },

  onDateChange(event) {
    this.setData({ selectedDate: event.detail.value })
    this.refreshStats()
  },

  onMonthChange(event) {
    this.setData({ selectedMonth: event.detail.value })
    this.refreshStats()
  },

  onYearChange(event) {
    this.setData({ selectedYear: event.detail.value })
    this.refreshStats()
  },

  getSelectedPeriod() {
    if (this.data.mode === 'day') {
      return this.data.selectedDate
    }

    if (this.data.mode === 'year') {
      return this.data.selectedYear
    }

    return this.data.selectedMonth
  },

  refreshStats() {
    const mode = this.data.mode
    const selectedPeriod = this.getSelectedPeriod()
    const rates = storage.getRateMap()
    const groups = {}

    storage.getRecords()
      .filter((record) => storage.getPeriodKey(record.date, mode) === selectedPeriod)
      .forEach((record) => {
        const key = `${record.handlingType}_${record.weightType}`
        const rate = rates[record.weightType]
        const billingQuantity = storage.getEffectiveQuantity(record)

        if (!groups[key]) {
          groups[key] = {
            key,
            handlingType: record.handlingType,
            weightType: record.weightType,
            quantity: 0,
            amount: 0
          }
        }

        groups[key].quantity += billingQuantity
        groups[key].amount += billingQuantity * Number(rate ? rate.price : 0)
      })

    const rows = Object.values(groups)
      .sort((left, right) => `${left.handlingType}${left.weightType}`.localeCompare(`${right.handlingType}${right.weightType}`))
      .map((row) => ({
        ...row,
        quantityText: storage.isFloatKind(row.weightType)
          ? row.quantity.toFixed(2)
          : `${Math.floor(row.quantity)}`,
        amountText: storage.formatMoney(row.amount)
      }))

    const totalAmount = rows.reduce(
      (sum, row) => sum + row.amount,
      0
    )

    this.setData({
      containerRows: rows.filter((row) => !storage.isBulkKind(row.weightType)),
      foodRows: rows.filter((row) => storage.isBulkKind(row.weightType)),
      hasStats: rows.length > 0,
      totals: {
        amount: storage.formatMoney(totalAmount)
      }
    })
  }
})
