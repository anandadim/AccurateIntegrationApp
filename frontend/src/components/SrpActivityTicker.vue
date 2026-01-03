<template>
  <div>
    <button
      v-if="isMinimized"
      class="srp-activity__toggle"
      @click="toggleMinimize"
    >
      {{ logs.length ? '📡 ' + logs.length + ' logs' : '📡 SNJ Activity' }}
    </button>

    <div class="srp-activity" v-else>
      <div class="srp-activity__top">
        <div>
          <strong>Scheduler Activity</strong>
          <div class="srp-activity__status-row">
            <small v-if="logs.length">Last {{ logs.length }} events</small>
            <small v-else>No activity yet</small>
            <small v-if="schedulerError" class="srp-activity__error">{{ schedulerError }}</small>
          </div>
          <span class="srp-activity__badge" :class="`badge-${schedulerBadge}`">
              {{ schedulerBadge.toUpperCase() }}
            </span>
        </div>
        <div class="srp-activity__actions">
          <button class="ghost" @click="openFullLogs">Full Log</button>
          <button
            class="ghost"
            :disabled="isSchedulerToggling"
            @click="toggleSchedulerState"
          >
            {{ schedulerPaused ? '▶' : 'll' }}
          </button>
          <button class="ghost" @click="toggleMinimize">-</button>
        </div>
      </div>

      <div v-if="!logs.length" class="srp-activity__empty">
        Waiting for scheduler activity...
      </div>

      <div
        class="srp-activity__entry"
        v-for="log in logs"
        :key="log.id"
      >
        <span class="srp-activity__icon">{{ resolveIcon(log.dataType) }}</span>
        <div class="srp-activity__content">
          <div class="srp-activity__header">
            <span class="srp-activity__type">{{ formatType(log.dataType) }}</span>
            <span class="srp-activity__status" :class="`status-${log.status}`">{{ log.status }}</span>
            <span class="srp-activity__time">{{ formatTime(log.startedAt) }}</span>
          </div>
          <pre class="srp-activity__body">{{ buildPayload(log) }}</pre>
        </div>
      </div>
    </div>

    <div
      v-if="showFull"
      class="srp-activity__modal"
    >
      <div class="srp-activity__modal-card">
        <div class="srp-activity__modal-head">
          <div>
            <h3>SNJ Scheduler Logs</h3>
            <p>Showing latest {{ fullLogs.length }} entries</p>
          </div>
          <button class="ghost" @click="closeFullLogs">Close</button>
        </div>
        <div class="srp-activity__modal-body">
          <div
            class="srp-activity__modal-entry"
            v-for="log in fullLogs"
            :key="log.id"
          >
            <div class="srp-activity__modal-title">
              <span>{{ formatTime(log.startedAt) }}</span>
              <span>{{ formatType(log.dataType) }}</span>
              <span :class="`status-${log.status}`">{{ log.status }}</span>
              <span>#{{ log.branchId || '—' }}</span>
            </div>
            <pre>{{ buildPayload(log) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import apiService from '../services/apiService'

const POLL_INTERVAL = 10000

const normalizeLog = (log = {}, source = 'srp') => {
  const metadata = typeof log.metadata === 'object' && log.metadata !== null ? log.metadata : {}

  const startedAt =
    log.startedAt ||
    log.started_at ||
    log.createdAt ||
    log.created_at ||
    metadata.startedAt ||
    metadata.started_at ||
    null

  const branchId =
    log.branchId ??
    log.branch_id ??
    metadata.branchId ??
    metadata.branch_id ??
    null

  const branchName =
    log.branchName ??
    log.branch_name ??
    metadata.branchName ??
    metadata.branch_name ??
    null

  const storeCode =
    log.storeCode ??
    log.store_code ??
    metadata.storeCode ??
    metadata.store_code ??
    null

  const targetDate =
    log.targetDate ??
    log.target_date ??
    metadata.targetDate ??
    metadata.target_date ??
    null

  const rowsFetched =
    log.rowsFetched ??
    log.rows_fetched ??
    metadata.rowsFetched ??
    metadata.rows_fetched ??
    metadata.totalFetched ??
    metadata.total_fetched ??
    null

  const errorMessage =
    log.errorMessage ||
    log.error_message ||
    metadata.errorMessage ||
    metadata.error_message ||
    null

  const dataType =
    log.dataType ||
    log.data_type ||
    metadata.dataType ||
    metadata.data_type ||
    null

  return {
    ...log,
    source,
    startedAt,
    branchId,
    branchName,
    storeCode,
    targetDate,
    rowsFetched,
    errorMessage,
    dataType: dataType || 'activity',
  }
}

const sortLogs = (entries) =>
  entries
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0
      return bTime - aTime
    })

export default {
  name: 'SrpActivityTicker',
  setup() {
    const logs = ref([])
    const fullLogs = ref([])
    const error = ref('')
    const isMinimized = ref(false)
    const showFull = ref(false)
    const schedulerStatus = ref(null)
    const schedulerError = ref('')
    const isSchedulerToggling = ref(false)
    let poller = null

    const schedulerPaused = computed(() => Boolean(schedulerStatus.value?.paused))
    const schedulerBadge = computed(() => {
      if (schedulerPaused.value) return 'paused'
      if (schedulerStatus.value?.running) return 'running'
      if (schedulerStatus.value) return 'ready'
      return 'idle'
    })

    const fetchLogs = async () => {
      try {
        const [srpResponse, accurateResponse] = await Promise.all([
          apiService.getSrpLogs({ limit: 20 }),
          apiService.getAccurateLogs({ limit: 20 })
        ])

        const combined = []

        if (srpResponse.success && Array.isArray(srpResponse.data)) {
          combined.push(...srpResponse.data.map((log) => normalizeLog(log, 'srp')))
        } else if (!srpResponse.success) {
          error.value = srpResponse.message || 'Failed to load SRP logs'
        }

        if (accurateResponse.success && Array.isArray(accurateResponse.data)) {
          combined.push(...accurateResponse.data.map((log) => normalizeLog(log, 'accurate')))
        } else if (!accurateResponse.success) {
          console.warn('Failed to load Accurate logs:', accurateResponse.message)
        }

        logs.value = sortLogs(combined).slice(0, 8)
      } catch (err) {
        error.value = err.message
      }
    }

    const fetchSchedulerStatus = async () => {
      try {
        const response = await apiService.getSrpSchedulerStatus()
        if (response.success) {
          schedulerStatus.value = response.data
          schedulerError.value = ''
        } else {
          schedulerError.value = response.message || 'Failed to get scheduler status'
        }
      } catch (err) {
        schedulerError.value = err.message
      }
    }

    const fetchFullLogs = async () => {
      try {
        const [srpResponse, accurateResponse] = await Promise.all([
          apiService.getSrpLogs({ limit: 100 }),
          apiService.getAccurateLogs({ limit: 100 })
        ])

        const combined = []
        if (srpResponse.success && Array.isArray(srpResponse.data)) {
          combined.push(...srpResponse.data.map((log) => normalizeLog(log, 'srp')))
        }
        if (accurateResponse.success && Array.isArray(accurateResponse.data)) {
          combined.push(...accurateResponse.data.map((log) => normalizeLog(log, 'accurate')))
        }

        fullLogs.value = sortLogs(combined)
      } catch (err) {
        console.error('Failed to load full logs', err)
      }
    }

    const toggleMinimize = () => {
      isMinimized.value = !isMinimized.value
    }

    const openFullLogs = async () => {
      await fetchFullLogs()
      showFull.value = true
    }

    const closeFullLogs = () => {
      showFull.value = false
    }

    const toggleSchedulerState = async () => {
      if (isSchedulerToggling.value) return
      isSchedulerToggling.value = true
      try {
        const paused = schedulerStatus.value?.paused
        const response = paused
          ? await apiService.resumeSrpScheduler()
          : await apiService.pauseSrpScheduler()

        if (response.success) {
          schedulerStatus.value = response.data
          schedulerError.value = ''
        } else {
          schedulerError.value = response.message || 'Failed to update scheduler'
        }
      } catch (err) {
        schedulerError.value = err.message
      } finally {
        isSchedulerToggling.value = false
      }
    }

    const formatType = (type) => {
      if (type === 'salesDetail') return 'Sales Detail'
      if (type === 'inventory') return 'Inventory'
      if (type === 'sales-invoice') return 'Sales Invoice'
      if (type === 'sales-receipt') return 'Sales Receipt'
      if (type === 'sales-order') return 'Sales Order'
      return type || 'Activity'
    }

    const resolveIcon = (type) => {
      if (type === 'inventory') return 'SRP'
      if (type === 'salesDetail') return 'SRP'
      if (type === 'sales-invoice') return 'ACC'
      if (type === 'sales-receipt') return 'ACC'
      if (type === 'sales-order') return 'ACC'
      return '🛰️'
    }

    const formatTime = (value) => {
      if (!value) return ''
      const date = new Date(value)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const buildPayload = (log) => {
      const metadata = typeof log.metadata === 'object' && log.metadata !== null ? log.metadata : {}
      const rawTarget = log.targetDate || metadata.targetDate || null
      const target = rawTarget
        ? typeof rawTarget === 'string'
          ? rawTarget
          : new Date(rawTarget).toLocaleDateString('en-CA') // YYYY-MM-DD
        : '—'

      const payload = {
        branch: log.branchName || log.branchId || metadata.branchName || metadata.branchId || '—',
        store: log.storeCode || metadata.storeCode || '—',
        target,
        rows: log.rowsFetched ?? metadata.rowsFetched ?? metadata.totalFetched ?? '—',
      }

      if (metadata && Object.keys(metadata).length) {
        payload.metadata = metadata
      }

      if (log.errorMessage) {
        payload.error = log.errorMessage.split('\n')[0]
      }

      return JSON.stringify(payload, null, 2)
    }

    onMounted(() => {
      fetchLogs()
      fetchSchedulerStatus()
      poller = setInterval(() => {
        fetchLogs()
        fetchSchedulerStatus()
      }, POLL_INTERVAL)
    })

    onUnmounted(() => {
      if (poller) {
        clearInterval(poller)
      }
    })

    return {
      logs,
      fullLogs,
      error,
      isMinimized,
      showFull,
      schedulerStatus,
      schedulerError,
      schedulerPaused,
      schedulerBadge,
      isSchedulerToggling,
      formatType,
      resolveIcon,
      formatTime,
      buildPayload,
      toggleMinimize,
      openFullLogs,
      closeFullLogs,
      toggleSchedulerState,
      fetchSchedulerStatus,
    }
  },
}
</script>

<style scoped>
.srp-activity {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: min(360px, calc(100vw - 32px));
  max-height: 60vh;
  padding: 12px;
  border-radius: 12px;
  background: rgba(13, 18, 33, 0.92);
  color: #d8e2ff;
  box-shadow: 0 20px 60px rgba(5, 6, 19, 0.65);
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 999;
  font-family: 'Fira Code', 'Source Code Pro', Consolas, monospace;
}

.srp-activity__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.srp-activity__status-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.srp-activity__top small {
  display: block;
  color: rgba(255, 255, 255, 0.6);
}

.srp-activity__badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #0e1324;
}

.badge-running {
  background: #6ee7b7;
}

.badge-paused {
  background: #fbbf24;
}

.badge-ready {
  background: #8ea5ff;
}

.badge-idle {
  background: #94a3b8;
}

.srp-activity__error {
  color: #f87171;
}

.srp-activity__actions {
  display: flex;
  gap: 8px;
}

.srp-activity__empty {
  padding: 8px 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  margin-bottom: 10px;
}

.srp-activity__entry + .srp-activity__entry {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.srp-activity__entry {
  display: flex;
  gap: 10px;
}

.srp-activity__icon {
  font-size: 18px;
}

.srp-activity__content {
  flex: 1;
}

.srp-activity__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.4px;
}

.srp-activity__type {
  color: #9be7ff;
  text-transform: uppercase;
}

.srp-activity__status {
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 600;
  text-transform: uppercase;
}

.srp-activity__time {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.6);
}

.srp-activity__body {
  margin: 4px 0 0;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px;
  border-radius: 8px;
  color: #dfe7ff;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status-running {
  background: rgba(255, 214, 102, 0.25);
  color: #ffd666;
}

.status-success {
  background: rgba(110, 231, 183, 0.25);
  color: #6ee7b7;
}

.status-failed {
  background: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

.srp-activity__toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 600;
  background: #11172c;
  color: #d8e2ff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  z-index: 999;
}

.ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #d8e2ff;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}

.ghost:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.srp-activity__modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.srp-activity__modal-card {
  width: min(720px, 100%);
  max-height: 90vh;
  background: #0d1221;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
  color: #d8e2ff;
  display: flex;
  flex-direction: column;
}

.srp-activity__modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.srp-activity__modal-body {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.srp-activity__modal-entry pre {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 10px;
  padding: 10px;
  margin-top: 6px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.srp-activity__modal-title {
  display: flex;
  gap: 10px;
  font-size: 12px;
  align-items: center;
}

.status-timeout {
  background: rgba(255, 171, 92, 0.3);
  color: #ffab5c;
}


::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
