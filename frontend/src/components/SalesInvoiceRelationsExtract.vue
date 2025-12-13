<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Extract Sales Invoice Relations</h1>
      <p class="text-gray-600">Extract SI-SO-SR relations from existing database records</p>
    </div>

    <!-- Control Panel -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <!-- Branch Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Branch</label>
          <select 
            v-model="selectedBranch" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Branch</option>
            <option v-for="branch in branches" :key="branch.id" :value="branch.id">
              {{ branch.name }}
            </option>
          </select>
        </div>

        <!-- Date From -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">From Date</label>
          <input 
            v-model="dateFrom" 
            type="date" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <!-- Date To -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">To Date</label>
          <input 
            v-model="dateTo" 
            type="date" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <!-- Extract Button -->
        <div class="flex items-end">
          <button 
            @click="extractRelations"
            :disabled="!selectedBranch || loading"
            class="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!loading">🔄 Extract Relations</span>
            <span v-else>⏳ Processing...</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Status Message -->
    <div v-if="statusMessage" :class="['rounded-lg p-4 mb-6', statusClass]">
      {{ statusMessage }}
    </div>

    <!-- Results Summary -->
    <div v-if="result && result.summary" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4">Extraction Results</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="bg-blue-50 p-4 rounded">
          <div class="text-sm text-gray-600">Branch</div>
          <div class="text-lg font-bold text-blue-600">{{ result.summary.branch }}</div>
        </div>
        <div class="bg-green-50 p-4 rounded">
          <div class="text-sm text-gray-600">Invoices Processed</div>
          <div class="text-lg font-bold text-green-600">{{ result.summary.invoicesProcessed }}</div>
        </div>
        <div class="bg-purple-50 p-4 rounded">
          <div class="text-sm text-gray-600">Relations Extracted</div>
          <div class="text-lg font-bold text-purple-600">{{ result.summary.relationsExtracted }}</div>
        </div>
        <div class="bg-red-50 p-4 rounded">
          <div class="text-sm text-gray-600">Errors</div>
          <div class="text-lg font-bold text-red-600">{{ result.summary.errors }}</div>
        </div>
        <div class="bg-gray-50 p-4 rounded">
          <div class="text-sm text-gray-600">Duration</div>
          <div class="text-lg font-bold text-gray-600">{{ result.summary.duration }}</div>
        </div>
      </div>
    </div>

    <!-- Relations Table -->
    <div v-if="relations && relations.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-bold text-gray-800">Extracted Relations ({{ relations.length }})</h2>
      </div>
      <div class="relative overflow-auto" style="max-height: 60vh;">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SO Number</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SI Number</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trans Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Receipt</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Name</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(rel, idx) in relations" :key="idx" class="hover:bg-gray-50">
              <td class="px-6 py-4 text-sm text-gray-900">{{ rel.branch_id }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ rel.order_number || '-' }}</td>
              <td class="px-6 py-4 text-sm font-medium text-blue-600">{{ rel.invoice_number }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ rel.trans_date }}</td>
              <td class="px-6 py-4 text-sm font-medium text-purple-600">{{ rel.sales_receipt }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ rel.receipt_date }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ rel.payment_id }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ rel.payment_name }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SalesInvoiceRelationsExtract',
  data() {
    return {
      selectedBranch: '',
      dateFrom: '',
      dateTo: '',
      loading: false,
      statusMessage: '',
      statusClass: '',
      result: null,
      relations: [],
      branches: [
        { id: 'branch_1', name: 'Kantor Pusat' },
        { id: 'branch_2', name: 'Cabang 2' },
        { id: 'branch_3', name: 'Cabang 3' }
      ]
    };
  },
  mounted() {
    // Set default dates (today)
    const today = new Date().toISOString().split('T')[0];
    this.dateTo = today;
    this.dateFrom = today;
  },
  methods: {
    async extractRelations() {
      if (!this.selectedBranch) {
        this.statusMessage = '❌ Please select a branch';
        this.statusClass = 'bg-red-50 border border-red-200 text-red-800';
        return;
      }

      this.loading = true;
      this.statusMessage = '⏳ Extracting relations...';
      this.statusClass = 'bg-blue-50 border border-blue-200 text-blue-800';

      try {
        const params = new URLSearchParams({
          branchId: this.selectedBranch,
          dateFrom: this.dateFrom,
          dateTo: this.dateTo
        });

        const response = await fetch(`/api/sales-invoices/extract-relations?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.result = data;
          this.statusMessage = `✅ ${data.message}`;
          this.statusClass = 'bg-green-50 border border-green-200 text-green-800';
          
          // Fetch the extracted relations
          await this.fetchRelations();
        } else {
          this.statusMessage = `❌ ${data.error || 'Failed to extract relations'}`;
          this.statusClass = 'bg-red-50 border border-red-200 text-red-800';
        }
      } catch (error) {
        this.statusMessage = `❌ Error: ${error.message}`;
        this.statusClass = 'bg-red-50 border border-red-200 text-red-800';
        console.error('Extract error:', error);
      } finally {
        this.loading = false;
      }
    },

    async fetchRelations() {
      try {
        const params = new URLSearchParams({
          branchId: this.selectedBranch,
          dateFrom: this.dateFrom,
          dateTo: this.dateTo,
          limit: 1000
        });

        const response = await fetch(`/api/sales-invoice-relations?${params}`);
        const data = await response.json();

        if (data.success) {
          this.relations = data.data || [];
        }
      } catch (error) {
        console.error('Fetch relations error:', error);
      }
    }
  }
};
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
