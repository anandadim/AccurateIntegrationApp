const accurateService = require('../services/accurateService');
const purchaseOrderModel = require('../models/purchaseOrderModel');

// Helper: Build date filter for Accurate API (BETWEEN)
const createDateFilter = (field, from, to) => ({
  [`filter.${field}.op`]: 'BETWEEN',
  [`filter.${field}.val`]: [from, to]
});

// Convert various Accurate date strings to YYYY-MM-DD
const convertDate = (str) => {
  if (!str) return null;
  if (str.includes(' ')) {
    // Format "22 Nov 2025"
    const [d, m, y] = str.split(' ');
    const map = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    return `${y}-${map[m] || m}-${d.padStart(2,'0')}`;
  }
  if (str.includes('/')) {
    // Format DD/MM/YYYY
    const [d,m,y] = str.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  if (str.includes('-') && str.length === 10) return str;
  const date = new Date(str);
  return isNaN(date) ? null : date.toISOString().split('T')[0];
};

const purchaseOrderController = {
  // Internal saver
  async _saveBatch(items, branchId, branchName){
    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for(const item of items){
      try{
        const d = item.d || item; // Accurate wraps detail inside d sometimes
        
        if(!d || !d.id){
          const errorMsg = `Skipping item with no ID`;
          console.warn(`⚠️  ${errorMsg}`);
          errors.push({ order: 'unknown', error: errorMsg });
          errorCount++;
          continue;
        }

        const headerData = {
          order_id: d.id,
          order_number: d.number,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(d.transDate),
          ship_date: convertDate(d.shipDate),
          vendor_id: d.vendor?.id || null,
          vendor_no: d.vendor?.vendorNo || null,
          vendor_name: d.vendor?.name || null,
          description: d.description || null,
          currency_code: d.currency?.code || null,
          rate: d.rate || null,
          sub_total: d.subTotal || 0,
          tax_amount: d.tax1Amount || 0,
          total_amount: d.totalAmount || 0,
          approval_status: d.approvalStatus || null,
          status_name: d.status || null,
          payment_term_id: d.paymentTermId || null,
          created_by: d.createdBy || null,
          opt_lock: parseInt(d.optLock || 0),
          raw_data: d
        };

        const itemsData = (d.detailItem || []).map(di => ({
          item_id: di.itemId || di.item?.id || null,
          item_no: di.item?.no || null,
          item_name: di.detailName || di.item?.name || null,
          quantity: di.quantity || 0,
          unit_id: di.itemUnitId || null,
          unit_name: di.itemUnit?.name || null,
          unit_price: di.unitPrice || 0,
          total_price: di.totalPrice || 0,
          tax_rate: di.tax1?.rate || null,
          warehouse_id: di.defaultWarehousePurchaseInvoice?.id || null,
          warehouse_name: di.defaultWarehousePurchaseInvoice?.name || null,
          notes: di.detailNotes || null
        }));

        await purchaseOrderModel.create(headerData, itemsData);
        savedCount++;
        
        if (savedCount % 10 === 0) {
          process.stdout.write(`💾 Saved: ${savedCount}\r`);
        }
      }catch(err){
        const orderNum = item.d?.id || item.id || 'unknown';
        console.error(`❌ Error saving order ${orderNum}:`, err.message);
        errors.push({ order: orderNum, error: err.message });
        errorCount++;
      }
    }

    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n⚠️  Error Details:`);
      errors.forEach(e => console.log(`   - ${e.order}: ${e.error}`));
    } else if (errors.length > 5) {
      console.log(`\n⚠️  ${errors.length} errors occurred. First 5:`);
      errors.slice(0, 5).forEach(e => console.log(`   - ${e.order}: ${e.error}`));
    }

    return {savedCount, errorCount};
  },

  // Check sync status similar 
  async checkSyncStatus(req, reply){
    try{
      const {branchId, dateFrom, dateTo, dateFilterType='transDate'} = req.query;
      if(!branchId) return reply.code(400).send({error:'branchId is required'});

      const branches = accurateService.getBranches();
      const branch = branches.find(b=>b.id===branchId);
      if(!branch) return reply.code(404).send({error:'Branch not found'});

      const today = new Date().toISOString().split('T')[0];
      
      console.log(`🔍 Checking sync status for ${branch.name} (Purchase Order)...`);
      console.log(`📅 Date Filter:`, {
        filterType: dateFilterType,
        from: dateFrom || today,
        to: dateTo || today
      });

      const fmt = s=>convertDate(s)?.split('-').reverse().join('/') || null; // YYYY-MM-DD -> DD/MM/YYYY
      const fromDate = fmt(dateFrom||today);
      const toDate   = fmt(dateTo||today);
      const filters = createDateFilter(dateFilterType, fromDate, toDate);

      const apiRes = await accurateService.fetchListOnly('purchase-order', branch.dbId, filters, branchId);
      let allApi = [...apiRes.items];
      const totalPages = Math.ceil(apiRes.pagination.rowCount / apiRes.pagination.pageSize);
      
      console.log(`📄 Calculated: ${totalPages} total pages (${apiRes.pagination.rowCount} rows)`);
      
      if(totalPages>1){
        console.log(`📄 Fetching ${totalPages - 1} more pages...`);
        for(let p=2;p<=totalPages;p++){
          const pageFilters = {...filters,'sp.page':p};
          const r = await accurateService.fetchListOnly('purchase-order', branch.dbId, pageFilters, branchId);
          allApi = allApi.concat(r.items);
          await new Promise(r=>setTimeout(r,100));
        }
      }

      console.log(`📊 API: ${allApi.length} orders`);
      if (allApi.length > 0) {
        console.log(`📊 Sample API order IDs:`, allApi.slice(0, 5).map(o => o.id));
      }

      const dbOrders = await purchaseOrderModel.getExistingForSync(branchId, dateFrom||today, dateTo||today);
      
      console.log(`💾 DB: ${dbOrders.length} orders`);
      if (dbOrders.length > 0) {
        console.log(`💾 Sample DB order IDs:`, dbOrders.slice(0, 5).map(o => o.order_id));
      }

      const dbMap = new Map(dbOrders.map(o=>[parseInt(o.order_id), o]));
      
      const newArr=[], 
            updArr=[], 
            unchArr=[];
      
      for(const api of allApi){
        const db = dbMap.get(api.id);
        if(!db){ 
          newArr.push({id:api.id, number:api.number, optLock:api.optLock}); 
        } else {
          const apiOpt = parseInt(api.optLock||0);
          const dbOpt = parseInt(db.opt_lock||0);
          if(apiOpt>dbOpt) {
            updArr.push({id:api.id, number:api.number, optLock:api.optLock, dbOptLock:db.opt_lock});
          } else {
            unchArr.push({id:api.id, number:api.number});
          }
        }
      }

      const needSync = newArr.length + updArr.length;

      console.log(`✅ Check complete: ${newArr.length} new, ${updArr.length} updated, ${unchArr.length} unchanged`);

      return reply.send({
        success:true,
        branch:{
          id:branch.id,
          name:branch.name,
          dbId:branch.dbId
        },
        dateRange:{
          from:dateFrom||today,
          to:dateTo||today,
          filterType:dateFilterType
        },
        summary:{
          total:allApi.length,
          new:newArr.length,
          updated:updArr.length,
          unchanged:unchArr.length,
          needSync:needSync,
          //newArr.length+updArr.length,
          inDatabase:dbOrders.length
        },
        orders:{
          new:newArr.slice(0,20),
          updated:updArr.slice(0,20),
          hasMore:{
            new:newArr.length>20,
            updated:updArr.length>20
          }
        },
        recommendation:(newArr.length+updArr.length)===0?'up_to_date':'sync_needed'
      });

    }catch(err){
      console.error('checkSyncStatus PO', err);
      return reply.code(500).send({error:'Internal server error', message:err.message});
    }
  },

  // Sync orders (non-stream)
  async syncFromAccurate(req, reply){
    const start = Date.now();
    try{
      const {branchId, dateFrom, dateTo, maxItems, dateFilterType='transDate', batchSize=50, batchDelay=300} = req.body;
      if(!branchId) return reply.code(400).send({error:'branchId is required'});
      const branches = accurateService.getBranches();
      const branch = branches.find(b=>b.id===branchId);
      if(!branch) return reply.code(404).send({error:'Branch not found'});

      const result = await accurateService.fetchListWithDetails('purchase-order', branch.dbId, {maxItems,dateFrom,dateTo,dateFilterType,batchSize:parseInt(batchSize),batchDelay:parseInt(batchDelay)}, branchId);
      if(!result.success) return reply.code(500).send({error:'Failed to fetch'});

      const saveRes = await purchaseOrderController._saveBatch(result.items, branchId, branch.name);
      const dur=((Date.now()-start)/1000).toFixed(2);
      return reply.send({success:true,message:`Synced ${saveRes.savedCount} purchase orders`,summary:{branch:branch.name,fetched:result.items.length,saved:saveRes.savedCount,errors:saveRes.errorCount,duration:`${dur}s`}});
    }catch(err){
      const dur=((Date.now()-start)/1000).toFixed(2);
      console.error('Sync PO failed', err);
      return reply.code(500).send({error:'Internal server error', message:err.message, duration:`${dur}s`});
    }
  },

  // List orders
  async getOrders(req, reply){
    try{
      const {branchId, dateFrom, dateTo, vendorNo, limit=100, offset=0} = req.query;
      const data = await purchaseOrderModel.list({branch_id:branchId,date_from:dateFrom,date_to:dateTo,vendor_no:vendorNo,limit:parseInt(limit),offset:parseInt(offset)});
      return reply.send({success:true,count:data.length,data});
    }catch(err){
      return reply.code(500).send({error:'Internal', message:err.message});
    }
  },

  async getOrderById(req, reply){
    try{
      const {id} = req.params;
      const order = await purchaseOrderModel.getById(id);
      if(!order) return reply.code(404).send({error:'Not found'});
      return reply.send({success:true,data:order});
    }catch(err){return reply.code(500).send({error:'Internal',message:err.message});}
  },

  async getSummary(request, reply) {
    try {
      const { branchId, dateFrom, dateTo } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo
      };

      const summary = await purchaseOrderModel.getSummary(filters);

      return reply.send({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error in getSummary:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
};

module.exports = purchaseOrderController;
