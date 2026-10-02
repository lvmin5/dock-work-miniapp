Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/entry/entry', text: '录入', icon: 'entry' },
      { pagePath: '/pages/stats/stats', text: '统计', icon: 'stats', center: true },
      { pagePath: '/pages/detail/detail', text: '明细', icon: 'detail' }
    ]
  },

  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.index
      const target = this.data.list[idx]
      wx.switchTab({ url: target.pagePath })
    }
  }
})
