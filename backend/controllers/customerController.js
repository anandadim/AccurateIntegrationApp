const accurateService = require('../services/accurateService');
const customerModel = require('../models/customerModel');

const customerController = {
  // Check sync status between Accurate vs DB (simple new/updated detection)
  async checkSyncStatus(request, reply) {
    try {
      const { branchId } = request.query;
      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      // Get branch credentials
      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      // Fetch full customer list from Accurate (max 1000 per page)
      const apiFirst = await accurateService.fetchDataWithFilter('customer/list', branch.dbId, { 'sp.pageSize': 1000 }, branchId);
      const totalRows = apiFirst.sp?.rowCount || apiFirst.d?.length || 0;
      const pageSize = apiFirst.sp?.pageSize || 1000;
      const totalPages = Math.ceil(totalRows / pageSize);
      let apiCustomers = [...apiFirst.d];
      for (let p = 2; p <= totalPages; p++) {
        const pageRes = await accurateService.fetchDataWithFilter('customer/list', branch.dbId, { 'sp.pageSize': 1000, 'sp.page': p }, branchId);
        apiCustomers = apiCustomers.concat(pageRes.d);
        await new Promise(r => setTimeout(r, 100));
      }

      // DB existing
      const dbCustomers = await customerModel.getExistingForSync(branchId);
      const dbMap = new Map(dbCustomers.map(c => [parseInt(c.customer_id), c]));

      let newCount = 0;
      let updated = 0;
      apiCustomers.forEach(c => {
        const db = dbMap.get(c.id);
        if (!db) {
          newCount++;
        } else {
          // Use updatedDate comparison if provided
          if (c.updatedDate && new Date(c.updatedDate) > new Date(db.updated_at)) {
            updated++;
          }
        }
      });
      const unchanged = apiCustomers.length - newCount - updated;

      return reply.send({
        success: true,
        summary: {
          total: apiCustomers.length,
          new: newCount,
          updated,
          unchanged,
          needSync: newCount + updated
        }
      });
    } catch (err) {
      console.error('checkSyncStatus error:', err);
      return reply.code(500).send({ error: err.message });
    }
  },

  // Sync customers smart (new+updated)
  async syncSmart(request, reply) {
    try {
      let { branchId, mode = 'missing', batchSize = 50, batchDelay = 300 } = request.query;
      batchSize = parseInt(batchSize, 10) || 50;
      batchDelay = parseInt(batchDelay, 10) || 300;
      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }
      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      if (!branch) return reply.code(404).send({ error: 'Branch not found' });

      // Fetch customers ID list (all pages) – lightweight payload
      const listResult = await accurateService.fetchAllPagesWithFilter(
        'customer/list',
        branch.dbId,
        { fields: 'id,updatedDate,modifiedDate,createdDate,lastUpdate' },
        branchId
      );
      const apiListRaw = listResult.items;
      let apiList = [];
      if (Array.isArray(apiListRaw)) {
        apiList = apiListRaw;
      } else if (apiListRaw && typeof apiListRaw === 'object') {
        if (Array.isArray(apiListRaw.d)) apiList = apiListRaw.d;
        else if (Array.isArray(apiListRaw.data)) apiList = apiListRaw.data;
        else if (Array.isArray(apiListRaw.items)) apiList = apiListRaw.items;
      }

      // Determine IDs to sync
      let customersToSync = apiList;
      if (mode === 'missing') {
        const dbCustomers = await customerModel.getExistingForSync(branchId);
        const dbMap = new Map(dbCustomers.map(c => [parseInt(c.customer_id), c]));
        customersToSync = apiList.filter(c => {
          const db = dbMap.get(c.id);
          if (!db) return true;
          if (c.updatedDate) return new Date(c.updatedDate) > new Date(db.updated_at);
          return false;
        });
      }

      // Fetch details and save in batches
      let saved = 0, errors = 0;
      const detailBatchSize = Math.min(batchSize, 50);
      for (let i = 0; i < customersToSync.length; i += detailBatchSize) {
        const batch = customersToSync.slice(i, i + detailBatchSize);
        const detailPromises = batch.map(c =>
          accurateService.fetchDetail('customer', c.id, branch.dbId, branchId)
            .catch(err => ({ error: err }))
        );
        const details = await Promise.all(detailPromises);
        const valid = details.filter(d => d && !d.error && d.d);
        const failed = details.filter(d => d && d.error);
        if (failed.length > 0) {
          console.warn(`Batch ${Math.floor(i/detailBatchSize) + 1}: ${failed.length} detail fetch failed`, failed.map(f => f.error?.message).slice(0, 3));
        }
        const saveResult = await customerController._saveBatch(valid, branchId);
        saved += saveResult.saved;
        errors += saveResult.errors + failed.length;
        if (i + detailBatchSize < customersToSync.length && batchDelay > 0) {
          await new Promise(r => setTimeout(r, batchDelay));
        }
      }

      return reply.send({ success: true, saved, errors });
    } catch (err) {
      console.error('syncSmart error', err);
      return reply.code(500).send({ error: err.message });
    }
  },

  async _saveBatch(detailResponses, branchId) {
    let saved = 0, errors = 0;
    for (const res of detailResponses) {
      try {
        const d = res.d;
        if (!d || !d.id) {
          console.warn('Skipping record without id', d);
          errors++;
          continue;
        }
        const salesman_id = d.salesman?.id || d.salesmanList?.[0]?.id || d.defaultSalesmanId || null;
        const salesman_name = d.salesman?.name || d.salesmanList?.[0]?.name || null;
        
        if (!salesman_id || !salesman_name) {
          console.warn(`Customer ${d.id} missing salesman:`, {
            salesman_id,
            salesman_name,
            has_salesman: !!d.salesman,
            has_salesmanList: !!d.salesmanList,
            defaultSalesmanId: d.defaultSalesmanId
          });
        }
        
        // Parse dates from API (format: DD/MM/YYYY HH:MM:SS)
        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          try {
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const dateObj = new Date(`${year}-${month}-${day}T${timePart}`);
            return isNaN(dateObj.getTime()) ? null : dateObj;
          } catch (e) {
            return null;
          }
        };
        
        const customerData = {
          customer_id: d.id,
          customer_no: d.customerNo || d.custNo || null,
          name: d.name || d.customerName || null,
          discount_cat_id: d.discountCategoryId || d.priceCategoryId || null,
          category_name: d.customerCategory?.name || d.category?.name || 'Umum',
          salesman_id,
          salesman_name,
          phone: d.phone || d.mobilePhone || null,
          branch_id: branchId,
          created_date: parseDate(d.createDate),
          updated_date: parseDate(d.lastUpdate),
          suspended: d.suspended || false,
          raw_data: d
        };
        await customerModel.create(customerData);
        saved++;
      } catch (e) {
        errors++;
        console.error('saveBatch customer error', e.message);
      }
    }
    return { saved, errors };
  },

  // Get customers list from DB
  async getCustomers(request, reply) {
    try {
      const { branchId, limit = 100, offset = 0 } = request.query;
      const data = await customerModel.list({ branch_id: branchId, limit: parseInt(limit), offset: parseInt(offset) });
      return reply.send({ success: true, count: data.length, data });
    } catch (err) {
      console.error('getCustomers error', err);
      return reply.code(500).send({ error: err.message });
    }
  },

  async getCustomerById(request, reply) {
    try {
      const { id } = request.params;
      const customer = await customerModel.getById(id);
      if (!customer) return reply.code(404).send({ error: 'Customer not found' });
      return reply.send({ success: true, data: customer });
    } catch (err) {
      console.error('getCustomerById', err);
      return reply.code(500).send({ error: err.message });
    }
  }
};

module.exports = customerController;
