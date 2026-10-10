const RECORDS_KEY = 'dock_work_records_v2'
const RATES_KEY = 'dock_work_rates_v2'
const CUSTOM_KINDS_KEY = 'dock_work_custom_kinds'

const DEFAULT_RATES = [
  { kind: '吉', price: 1, unit: '标箱' },
  { kind: '重', price: 1.5, unit: '标箱' },
  { kind: '粮食', price: 0.3, unit: '吨' },
  { kind: '移箱', price: 0.3, unit: '标箱' }
]

const STANDARD_CONTAINER_KINDS = ['吉', '重', '移箱']
const BULK_KINDS = ['粮食']
const FIXED_KINDS = ['吉', '重', '粮食', '移箱']
const FLOAT_KINDS = ['粮食']

function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`
}

function getTodayDate() {
  const date = new Date()
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

function getCurrentMonth() {
  return getTodayDate().slice(0, 7)
}

function getCurrentYear() {
  return getTodayDate().slice(0, 4)
}

function toNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function createId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeRecord(record) {
  const weightType = trimText(record.weightType)
  const isStandardContainer = STANDARD_CONTAINER_KINDS.includes(weightType)

  return {
    id: record.id || createId(),
    date: record.date || getTodayDate(),
    machine: trimText(record.machine),
    handlingType: trimText(record.handlingType),
    workType: trimText(record.workType),
    weightType,
    boxType: isStandardContainer ? trimText(record.boxType) : '',
    quantity: toNumber(record.quantity),
    createdAt: record.createdAt || Date.now()
  }
}

function getRecords() {
  const records = wx.getStorageSync(RECORDS_KEY)

  if (!Array.isArray(records)) {
    return []
  }

  return records
    .map(normalizeRecord)
    .filter((record) => record.machine && record.handlingType && record.workType && record.weightType && record.quantity > 0)
    .sort((left, right) => {
      const dateOrder = right.date.localeCompare(left.date)
      return dateOrder === 0 ? right.createdAt - left.createdAt : dateOrder
    })
}

function saveRecords(records) {
  const normalized = Array.isArray(records) ? records.map(normalizeRecord) : []
  wx.setStorageSync(RECORDS_KEY, normalized)
  return normalized
}

function addRecord(record) {
  const records = getRecords()
  const nextRecord = normalizeRecord({
    ...record,
    id: createId(),
    createdAt: Date.now()
  })

  records.unshift(nextRecord)
  saveRecords(records)
  return nextRecord
}

function mergeRecords(incomingRecords) {
  const existing = getRecords()
  const existingIds = new Set(existing.map((record) => record.id))

  let added = 0
  let skipped = 0
  const merged = [...existing]

  incomingRecords.forEach((record) => {
    const normalized = normalizeRecord(record)
    const isValid = normalized.machine && normalized.handlingType &&
      normalized.workType && normalized.weightType && normalized.quantity > 0

    if (!isValid || existingIds.has(normalized.id)) {
      skipped += 1
      return
    }

    merged.push(normalized)
    existingIds.add(normalized.id)
    added += 1
  })

  saveRecords(merged)
  return { added, skipped, total: merged.length }
}

function deleteRecord(id) {
  const records = getRecords().filter((record) => record.id !== id)
  saveRecords(records)
  return records
}

function updateRecord(id, changes) {
  const records = getRecords()
  const nextRecords = records.map((record) => (
    record.id === id
      ? normalizeRecord({
          ...record,
          ...changes,
          id,
          createdAt: record.createdAt
        })
      : record
  ))

  saveRecords(nextRecords)
  return nextRecords.find((record) => record.id === id)
}

function getRates() {
  const savedRates = wx.getStorageSync(RATES_KEY)
  const rates = Array.isArray(savedRates) ? savedRates : []
  const customKinds = getCustomKinds().filter((ck) => !ck.archived)
  const allDefaults = [
    ...DEFAULT_RATES,
    ...customKinds.map((ck) => ({ kind: ck.kind, price: 0, unit: ck.unit }))
  ]

  return allDefaults.map((defaultRate) => {
    const savedRate = rates.find((rate) => rate.kind === defaultRate.kind)

    return {
      kind: defaultRate.kind,
      price: savedRate ? toNumber(savedRate.price) : defaultRate.price,
      unit: defaultRate.unit,
      isCustom: customKinds.some((ck) => ck.kind === defaultRate.kind)
    }
  })
}

function saveRates(rates) {
  const savedRates = wx.getStorageSync(RATES_KEY)
  const existingRates = Array.isArray(savedRates) ? savedRates : []
  const customKinds = getCustomKinds()
  const allDefaults = [
    ...DEFAULT_RATES,
    ...customKinds.map((ck) => ({ kind: ck.kind, price: 0, unit: ck.unit }))
  ]

  const normalized = allDefaults.map((defaultRate) => {
    const currentRate = Array.isArray(rates) ? rates.find((rate) => rate.kind === defaultRate.kind) : null
    const existingRate = existingRates.find((rate) => rate.kind === defaultRate.kind)

    return {
      kind: defaultRate.kind,
      price: currentRate
        ? toNumber(currentRate.price)
        : (existingRate ? toNumber(existingRate.price) : defaultRate.price),
      unit: defaultRate.unit
    }
  })

  wx.setStorageSync(RATES_KEY, normalized)
  return normalized
}

function getRateMap() {
  const savedRates = wx.getStorageSync(RATES_KEY)
  const rates = Array.isArray(savedRates) ? savedRates : []
  const customKinds = getCustomKinds()
  const allDefaults = [
    ...DEFAULT_RATES,
    ...customKinds.map((ck) => ({ kind: ck.kind, price: 0, unit: ck.unit }))
  ]

  const map = {}
  allDefaults.forEach((defaultRate) => {
    const savedRate = rates.find((rate) => rate.kind === defaultRate.kind)
    map[defaultRate.kind] = {
      kind: defaultRate.kind,
      price: savedRate ? toNumber(savedRate.price) : defaultRate.price,
      unit: defaultRate.unit
    }
  })
  return map
}

function formatQuantity(weightType, quantity) {
  if (FLOAT_KINDS.includes(weightType)) {
    return Number(quantity || 0).toFixed(2)
  }

  return `${Math.floor(Number(quantity || 0))}`
}

function getEffectiveQuantity(record) {
  const quantity = Number(record.quantity || 0)

  if (STANDARD_CONTAINER_KINDS.includes(record.weightType) && record.boxType === '40尺') {
    return quantity * 2
  }

  return quantity
}

function getCustomKinds() {
  const saved = wx.getStorageSync(CUSTOM_KINDS_KEY)
  if (!Array.isArray(saved)) {
    return []
  }
  return saved.map((k) => ({
    kind: k.kind || '',
    unit: k.unit || '',
    inputType: k.inputType || 'integer',
    archived: Boolean(k.archived)
  }))
}

function saveCustomKinds(customKinds) {
  wx.setStorageSync(CUSTOM_KINDS_KEY, customKinds)
  return customKinds
}

function getAllKinds() {
  const customKinds = getCustomKinds().filter((k) => !k.archived)
  const allBulkKinds = [...BULK_KINDS, ...customKinds.map((k) => k.kind)]
  const allKinds = [...FIXED_KINDS, ...customKinds.map((k) => k.kind)]

  return {
    standard: STANDARD_CONTAINER_KINDS,
    bulk: allBulkKinds,
    all: allKinds
  }
}

function isFloatKind(weightType) {
  if (FLOAT_KINDS.includes(weightType)) {
    return true
  }
  const customKinds = getCustomKinds()
  const custom = customKinds.find((k) => k.kind === weightType)
  return custom && custom.inputType === 'float'
}

function isStandardContainer(weightType) {
  return STANDARD_CONTAINER_KINDS.includes(weightType)
}

function isBulkKind(weightType) {
  const { bulk } = getAllKinds()
  if (bulk.includes(weightType)) {
    return true
  }
  const customKinds = getCustomKinds()
  const archived = customKinds.find((k) => k.kind === weightType && k.archived)
  return archived && archived.unit !== '标箱'
}

function formatMoney(amount) {
  return Number(amount || 0).toFixed(2)
}

function getPeriodKey(date, mode) {
  if (mode === 'year') {
    return date.slice(0, 4)
  }

  if (mode === 'month') {
    return date.slice(0, 7)
  }

  return date
}

module.exports = {
  addRecord,
  deleteRecord,
  formatMoney,
  formatQuantity,
  getCurrentMonth,
  getCurrentYear,
  getCustomKinds,
  getAllKinds,
  getEffectiveQuantity,
  getPeriodKey,
  getRateMap,
  getRates,
  getRecords,
  getTodayDate,
  isBulkKind,
  isFloatKind,
  isStandardContainer,
  mergeRecords,
  saveCustomKinds,
  saveRates,
  updateRecord
}
