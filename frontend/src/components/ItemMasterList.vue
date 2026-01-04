<template>
  <div class="item-master">
    <div class="item-master__header">
      <h1>Item Master</h1>
      <div class="item-master__filters">
        <input
          v-model="filters.search"
          type="text"
          placeholder="Search by article code or description"
          @keyup.enter="fetchItems"
        />
        <select v-model="filters.entity_code" @change="fetchItems">
          <option value="">All Entities</option>
          <option value="SRN">SRN</option>
          <option value="SNJ">SNJ</option>
          <option value="GFI">GFI</option>
        </select>
        <input
          v-model="filters.article_code"
          type="text"
          placeholder="Article Code"
          @keyup.enter="fetchItems"
        />
        <input
          v-model="filters.article_description"
          type="text"
          placeholder="Description"
          @keyup.enter="fetchItems"
        />
        <button @click="fetchItems">Search</button>
        <button @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="loading" class="item-master__loading">Loading...</div>

    <div v-else-if="error" class="item-master__error">
      <p>{{ error }}</p>
      <button @click="fetchItems">Retry</button>
    </div>

    <div v-else class="item-master__content">
      <div class="item-master__summary">
        <p>
          Showing {{ pagination.from || 0 }}-{{ pagination.to || 0 }} of
          {{ pagination.total }} items
        </p>
      </div>

      <div class="item-master__table">
        <table>
          <thead>
            <tr>
              <th>Article Code</th>
              <th>Description</th>
              <th>Entity</th>
              <th>UoM</th>
              <th>Class</th>
              <th>Department</th>
              <th>Barcodes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.article_code }}</td>
              <td>{{ item.article_description }}</td>
              <td>{{ item.entity_code || '—' }}</td>
              <td>{{ item.base_unit_of_measure || '—' }}</td>
              <td>{{ item.class?.name || '—' }}</td>
              <td>{{ item.department?.name || '—' }}</td>
              <td>
                <span
                  v-for="barcode in item.barcodes"
                  :key="barcode.id"
                  class="barcode"
                >
                  {{ barcode.gtin_code }}
                  <em v-if="barcode.main_ean" class="main">(main)</em>
                </span>
                <span v-if="!item.barcodes?.length">—</span>
              </td>
              <td>
                <span :class="['status', item.is_active ? 'active' : 'inactive']">
                  {{ item.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pagination.last_page > 1" class="item-master__pagination">
        <button
          :disabled="pagination.current_page <= 1"
          @click="goToPage(pagination.current_page - 1)"
        >
          Previous
        </button>
        <span>Page {{ pagination.current_page }} of {{ pagination.last_page }}</span>
        <button
          :disabled="pagination.current_page >= pagination.last_page"
          @click="goToPage(pagination.current_page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'ItemMasterList',
  setup() {
    const items = ref([])
    const loading = ref(false)
    const error = ref('')
    const pagination = reactive({
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: 0,
      from: 0,
      to: 0,
    })

    const filters = reactive({
      search: '',
      entity_code: '',
      article_code: '',
      article_description: '',
      division_name: '',
      department_name: '',
      category_name: '',
      keyword: '',
      article_uom: '',
      article_creation_date: '',
      per_page: 25,
      page: 1,
    })

    const fetchItems = async () => {
      loading.value = true
      error.value = ''
      try {
        const response = await apiService.getItemMasterList({
          ...filters,
          per_page: filters.per_page,
          page: filters.page,
        })

        if (response.error) {
          error.value = response.error_message || 'Failed to fetch items'
          return
        }

        const data = response.mdz_article_masters || {}
        items.value = data.data || []
        Object.assign(pagination, {
          current_page: data.current_page || 1,
          last_page: data.last_page || 1,
          per_page: data.per_page || 25,
          total: data.total || 0,
          from: data.from || 0,
          to: data.to || 0,
        })
      } catch (err) {
        console.error('Error fetching item master:', err)
        error.value = err.message || 'An error occurred while fetching items'
      } finally {
        loading.value = false
      }
    }

    const resetFilters = () => {
      Object.assign(filters, {
        search: '',
        entity_code: '',
        article_code: '',
        article_description: '',
        division_name: '',
        department_name: '',
        category_name: '',
        keyword: '',
        article_uom: '',
        article_creation_date: '',
        per_page: 25,
        page: 1,
      })
      fetchItems()
    }

    const goToPage = (page) => {
      if (page < 1 || page > pagination.last_page) return
      filters.page = page
      fetchItems()
    }

    onMounted(() => {
      fetchItems()
    })

    return {
      items,
      loading,
      error,
      pagination,
      filters,
      fetchItems,
      resetFilters,
      goToPage,
    }
  },
}
</script>

<style scoped>
.item-master {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.item-master__header {
  margin-bottom: 24px;
}

.item-master__header h1 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
}

.item-master__filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.item-master__filters input,
.item-master__filters select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.item-master__filters input[type='text'] {
  min-width: 200px;
}

.item-master__filters button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.item-master__filters button:hover {
  background: #0056b3;
}

.item-master__loading,
.item-master__error {
  text-align: center;
  padding: 40px;
  font-size: 16px;
}

.item-master__error {
  color: #dc3545;
}

.item-master__summary {
  margin-bottom: 16px;
  font-size: 14px;
  color: #666;
}

.item-master__table {
  overflow-x: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.item-master__table table {
  width: 100%;
  border-collapse: collapse;
}

.item-master__table th,
.item-master__table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.item-master__table th {
  background: #f8f9fa;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.item-master__table tbody tr:hover {
  background: #f8f9fa;
}

.barcode {
  display: block;
  font-family: monospace;
  font-size: 12px;
}

.barcode .main {
  color: #28a745;
  font-weight: 600;
}

.status {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status.active {
  background: #d4edda;
  color: #155724;
}

.status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.item-master__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  font-size: 14px;
}

.item-master__pagination button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.item-master__pagination button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #007bff;
}

.item-master__pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
