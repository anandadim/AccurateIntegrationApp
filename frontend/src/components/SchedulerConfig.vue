<template>
  <div class="scheduler-config">


    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading scheduler configurations...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadConfigs" class="btn btn-primary">Retry</button>
    </div>

    <div v-else class="config-list">
      <!-- Global Pause Warning -->
      <div v-if="globalStatus && globalStatus.paused" class="global-pause-banner">
        <div class="banner-content">
          <span class="banner-icon">⚠️</span>
          <div class="banner-text">
            <h3>Global Pause Active</h3>
            <p>All schedulers are currently paused in memory. This overrides the database settings below. Resume via the Activity Widget to restore normal operation.</p>
          </div>
        </div>
      </div>

      <div v-for="config in configs" :key="config.id" class="config-card">
        <div class="config-header">
          <div class="config-title">
            <span class="config-icon">{{ config.scheduler_name === 'srp' ? '🏪' : '📊' }}</span>
            <h2>{{ config.scheduler_name === 'srp' ? 'SRP Scheduler' : 'Accurate Scheduler' }}</h2>
          </div>
          <div class="config-controls">
            <div class="config-status" :class="{ paused: config.is_paused }">
              {{ config.is_paused ? '⏸️ Paused' : '▶️ Running' }}
            </div>
            <button 
              class="btn-toggle" 
              :class="{ active: !config.is_paused }"
              @click="toggleStatus(config)"
              :disabled="updating === config.id"
            >
              <span class="toggle-slider"></span>
            </button>
          </div>
        </div>

        <p class="config-description">{{ config.description }}</p>

        <div class="config-form">
          <div class="form-group">
            <label>Cron Expression</label>
            <input
              v-model="config.cron_expression"
              type="text"
              class="form-input"
              placeholder="e.g., 0 22 * * *"
            />
            <small class="form-hint">
              Format: minute hour day month weekday
              <br />
              Example: <code>{{ config.scheduler_name === 'srp' ? '/20 * * * = Every 20 minutes' : '0 22 * * * = Every day at 22:00' }}</code> 
            </small>
          </div>

          <div class="form-actions">
            <button
              @click="updateConfig(config)"
              :disabled="updating === config.id"
              class="btn btn-primary"
            >
              {{ updating === config.id ? 'Updating...' : 'Update Schedule' }}
            </button>
            <button
              @click="resetConfig(config)"
              class="btn btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>

        <div class="config-info">
          <div class="info-item">
            <span class="info-label">Last Updated:</span>
            <span class="info-value">{{ formatDate(config.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Cron Expression Reference -->
    <div class="cron-reference">
      <h3>📖 Cron Expression Reference</h3>
      <table class="reference-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Values</th>
            <th>Special Characters</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Minute</td>
            <td>0-59</td>
            <td>* , - /</td>
          </tr>
          <tr>
            <td>Hour</td>
            <td>0-23</td>
            <td>* , - /</td>
          </tr>
          <tr>
            <td>Day of Month</td>
            <td>1-31</td>
            <td>* , - / ? L W</td>
          </tr>
          <tr>
            <td>Month</td>
            <td>1-12 or JAN-DEC</td>
            <td>* , - /</td>
          </tr>
          <tr>
            <td>Day of Week</td>
            <td>0-6 or SUN-SAT</td>
            <td>* , - / ? L #</td>
          </tr>
        </tbody>
      </table>
      <div class="examples">
        <h4>Common Examples:</h4>
        <ul>
          <li><code>*/20 * * * *</code> - Every 20 minutes</li>
          <li><code>0 * * * *</code> - Every hour (at minute 0)</li>
          <li><code>0 22 * * *</code> - Every day at 22:00</li>
          <li><code>0 9,18 * * *</code> - Every day at 09:00 and 18:00</li>
          <li><code>0 9 * * 1-5</code> - Monday to Friday at 09:00</li>
          <li><code>0 0 1 * *</code> - First day of every month at 00:00</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'SchedulerConfig',
  setup() {
    const configs = ref([])
    const loading = ref(true)
    const error = ref(null)
    const updating = ref(null)

    const globalStatus = ref(null)

    const loadConfigs = async () => {
      try {
        loading.value = true
        error.value = null
        
        // Fetch configs and global status in parallel
        const [configResponse, statusResponse] = await Promise.all([
          apiService.get('/scheduler/config'),
          apiService.getSrpSchedulerStatus()
        ])

        configs.value = configResponse.data.map(config => ({
          ...config,
          original_cron: config.cron_expression
        }))
        
        if (statusResponse.success) {
          globalStatus.value = statusResponse.data
        }
      } catch (err) {
        error.value = err.message || 'Failed to load scheduler configurations'
        console.error('Error loading scheduler configs:', err)
      } finally {
        loading.value = false
      }
    }

    const updateConfig = async (config) => {
      try {
        updating.value = config.id
        await apiService.put('/scheduler/config/cron', {
          schedulerName: config.scheduler_name,
          cronExpression: config.cron_expression
        })
        config.original_cron = config.cron_expression
        alert(`✅ ${config.scheduler_name.toUpperCase()} scheduler updated successfully!`)
      } catch (err) {
        error.value = err.message || 'Failed to update scheduler configuration'
        console.error('Error updating scheduler config:', err)
        alert(`❌ Failed to update: ${err.message}`)
        config.cron_expression = config.original_cron
      } finally {
        updating.value = null
      }
    }

    const toggleStatus = async (config) => {
      try {
        updating.value = config.id
        const newStatus = !config.is_paused
        
        await apiService.put('/scheduler/config/status', {
          schedulerName: config.scheduler_name,
          isPaused: newStatus
        })
        
        config.is_paused = newStatus
        // No alert needed for toggle, visual feedback is enough
      } catch (err) {
        console.error('Error updating scheduler status:', err)
        alert(`❌ Failed to update status: ${err.message}`)
      } finally {
        updating.value = null
      }
    }

    const resetConfig = (config) => {
      config.cron_expression = config.original_cron
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    onMounted(() => {
      loadConfigs()
    })

    return {
      configs,
      globalStatus,
      loading,
      error,
      updating,
      loadConfigs,
      updateConfig,
      toggleStatus,
      resetConfig,
      formatDate
    }
  }
}
</script>

<style scoped>
.scheduler-config {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 48px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.config-list {
  display: grid;
  gap: 24px;
  margin-bottom: 32px;
}

.config-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e0e0;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-icon {
  font-size: 24px;
}

.config-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.config-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #e8f5e9;
  color: #2e7d32;
}

.config-status.paused {
  background: #fff3e0;
  color: #e65100;
}

.config-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Toggle Switch */
.btn-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background-color: #e0e0e0;
  border: none;
  cursor: pointer;
  padding: 2px;
  transition: background-color 0.2s ease;
}

.btn-toggle.active {
  background-color: #42b983;
}

.btn-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-slider {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transition: transform 0.2s ease;
  transform: translateX(0);
}

.btn-toggle.active .toggle-slider {
  transform: translateX(20px);
}

.config-description {
  color: #666;
  font-size: 14px;
  margin: 0 0 20px 0;
}

.config-form {
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.form-hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.form-hint code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.form-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #42b983;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3aa876;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.config-info {
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: #666;
}

.info-value {
  color: #333;
  font-weight: 600;
}

.cron-reference {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e0e0e0;
}

.cron-reference h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 16px 0;
}

.reference-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}

.reference-table th,
.reference-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.reference-table th {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  background: #f5f5f5;
}

.reference-table td {
  font-size: 13px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.reference-table td:first-child {
  font-family: inherit;
  font-weight: 600;
  color: #333;
}

.examples h4 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
}

.examples ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.examples li {
  padding: 8px 0;
  font-size: 13px;
  color: #666;
  border-bottom: 1px solid #e0e0e0;
}

.examples li:last-child {
  border-bottom: none;
}

.examples li code {
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #42b983;
}

.global-pause-banner {
  background: #fff3e0;
  border: 1px solid #ffcc80;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.banner-content {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.banner-icon {
  font-size: 24px;
}

.banner-text h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #e65100;
  font-weight: 600;
}

.banner-text p {
  margin: 0;
  font-size: 14px;
  color: #f57c00;
  line-height: 1.4;
}
</style>
