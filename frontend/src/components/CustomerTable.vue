<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Customers</h1>
      <p class="text-gray-600">Synced customer records</p>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="relative overflow-auto" style="max-height:70vh;">
        <table class="min-w-full divide-y divide-gray-200" style="min-width:768px;">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount Cat</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="cust in customers" :key="cust.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 text-sm text-gray-900">{{ cust.customer_id }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ cust.customer_no }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ cust.name }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ cust.phone || '-' }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ cust.discount_cat_id || '-' }}</td>
              <td class="px-6 py-4 text-sm text-gray-900">{{ cust.category_id || '-' }}</td>
            </tr>
            <tr v-if="!loading && customers.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">No data</td>
            </tr>
            <tr v-if="loading">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">Loading...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CustomerTable',
  props: {
    customers: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  }
}
</script>
