const accurateService = require('../services/accurateService');
const salesReturnModel = require('../models/salesReturnModel');

// Helper: create date filter object for Accurate API
const createDateFilter = (dateFilterType, fromDate, toDate) => {
  const filterKey = `filter.${dateFilterType}`;
  return {
    [`${filterKey}.op`]: 'BETWEEN',
    [`${filterKey}.val`]: [fromDate, toDate]
  };
};

// Convert various date formats (Accurate) to YYYY-MM-DD
const convertDate = (dateStr) => {
  if (!dateStr) return null;

  // Format "DD MMM YYYY"
  if (dateStr.includes(' ')) {
    const parts = dateStr.split(' ');
    if (parts.length === 3) {
      const [day, mon, year] = parts;
      const map = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      return `${year}-${map[mon] || mon}-${day.padStart(2,'0')}`;
    }
  }
  // Format "DD/MM/YYYY"
  if (dateStr.includes('/')) {
    const [d,m,y] = dateStr.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // Already ISO
  if (dateStr.includes('-') && dateStr.length === 10) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
};

const salesReturnController = {
  // Internal: save a batch of returns
  async _saveBatch(items, branchId, branchName){
    let saved = 0, errCnt = 0;
    for(const item of items){
      try{
        const r = item.d || item;
        if(!r || !r.id){ errCnt++; continue; }

        // Header mapping
        const headerData = {
          sales_return_id: r.id,
          return_number: r.number,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(r.transDate || r.transDateView),
          invoice_id: r.invoiceId || r.invoice?.id || null,
          invoice_number: r.invoice?.number || null,
          return_type: r.returnType || null,
          return_amount: r.returnAmount || 0,
          sub_total: r.subTotal || 0,
          cash_discount: r.cashDiscount || 0,
          description: r.description || null,
          approval_status: r.approvalStatus || null,
          customer_id: r.customerId || null,
          po_number: r.invoice?.poNumber || null,
          master_salesman_id: r.masterSalesmanId || null,
          salesman_name: r.detailItem?.[0]?.salesmanList?.[0]?.name || null,
          currency_code: r.currency?.code || null,
          journal_id: r.journalId || null,
          created_by: r.createdBy || null,
          opt_lock: r.optLock || 0,
          raw_data: r
        };

        // Items mapping
        const itemsData = (r.detailItem || []).map(di => ({
          item_id: di.itemId || di.item?.id || null,
          item_no: di.item?.no || null,
          item_name: di.detailName || null,
          quantity: di.quantity || 0,
          unit_name: di.itemUnit?.name || null,
          unit_price: di.unitPrice || 0,
          return_amount: di.returnAmount || 0,
          cogs_gl_account_id: di.item?.cogsGlAccountId || null,
          warehouse_id: di.warehouseId || null,
          warehouse_name: di.warehouse?.name || null,
          cost_item: di.costItem || 0,
          sales_invoice_detail_id: di.salesInvoiceDetailId || null,
          invoice_detail_quantity: di.salesInvoiceDetail?.quantity || null,
          sales_order_id: di.salesOrderId || null,
          return_detail_status: di.returnDetailStatusType || null
        }));

        await salesReturnModel.create(headerData, itemsData);
        saved++;
      }catch(e){
        errCnt++;
        console.error('salesReturn save error', e.message);
      }
    }
    return { savedCount: saved, errorCount: errCnt };
  },

  // GET /sales-returns/check-sync
  async checkSyncStatus(req, reply){
    try{
      const {branchId, dateFrom, dateTo, dateFilterType='createdDate'} = req.query;
      if(!branchId) return reply.code(400).send({error:'branchId is required'});
      const branches = accurateService.getBranches();
      const branch = branches.find(b=>b.id===branchId);
      if(!branch) return reply.code(404).send({error:'Branch not found'});

      const today = new Date().toISOString().split('T')[0];
      const fmt = s => convertDate(s)?.split('-').reverse().join('/') || null; // to DD/MM/YYYY
      const fromDate = fmt(dateFrom || today);
      const toDate = fmt(dateTo || today);
      const filters = createDateFilter(dateFilterType, fromDate, toDate);

      const apiResult = await accurateService.fetchListOnly('sales-return', branch.dbId, filters, branchId);
      let allApiItems = [...apiResult.items];
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      if(totalPages>1){
        for(let p=2;p<=totalPages;p++){
          const pageFilters = {...filters, 'sp.page': p};
          const res = await accurateService.fetchListOnly('sales-return', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(res.items);
          await new Promise(r=>setTimeout(r,100));
        }
      }

      const dbReturns = await salesReturnModel.getExistingForSync(branchId, dateFrom||today, dateTo||today);
      const dbMap = new Map(dbReturns.map(r=>[r.sales_return_id, r]));

      const newRecs=[], updatedRecs=[], unchangedRecs=[];
      for(const api of allApiItems){
        const db = dbMap.get(api.id);
        if(!db){
          newRecs.push({id:api.id, number:api.number, optLock:api.optLock});
        }else{
          const apiOpt = parseInt(api.optLock||0);
          const dbOpt = parseInt(db.opt_lock||0);
          if(apiOpt>dbOpt){
            updatedRecs.push({id:api.id, number:api.number, optLock:api.optLock, dbOptLock:db.opt_lock});
          }else{
            unchangedRecs.push({id:api.id, number:api.number});
          }
        }
      }

      return reply.send({
        success:true,
        branch:{id:branch.id,name:branch.name,dbId:branch.dbId},
        dateRange:{from:dateFrom||today,to:dateTo||today,filterType:dateFilterType},
        summary:{total:allApiItems.length,new:newRecs.length,updated:updatedRecs.length,unchanged:unchangedRecs.length,needSync:newRecs.length+updatedRecs.length,inDatabase:dbReturns.length},
        returns:{new:newRecs.slice(0,20),updated:updatedRecs.slice(0,20),hasMore:{new:newRecs.length>20,updated:updatedRecs.length>20}},
        recommendation:(newRecs.length+updatedRecs.length)===0?'up_to_date':'sync_needed'
      });
    }catch(err){
      console.error('salesReturn checkSyncStatus error', err);
      return reply.code(500).send({error:'Internal server error', message: err.message});
    }
  },

  // POST /sales-returns/sync
  async syncFromAccurate(req, reply){
    const start = Date.now();
    try{
      const {branchId, dateFrom, dateTo, maxItems, dateFilterType='createdDate', batchSize=50, batchDelay=300} = req.body;
      if(!branchId) return reply.code(400).send({error:'branchId is required'});
      const branches = accurateService.getBranches();
      const branch = branches.find(b=>b.id===branchId);
      if(!branch) return reply.code(404).send({error:'Branch not found'});

      const result = await accurateService.fetchListWithDetails('sales-return', branch.dbId, {maxItems,dateFrom,dateTo,dateFilterType,batchSize:parseInt(batchSize),batchDelay:parseInt(batchDelay)}, branchId);
      if(!result.success) return reply.code(500).send({error:'Failed to fetch'});

      const saveResult = await salesReturnController._saveBatch(result.items, branchId, branch.name);
      const dur=((Date.now()-start)/1000).toFixed(2);
      return reply.send({success:true,message:`Synced ${saveResult.savedCount} returns`,summary:{branch:branch.name,fetched:result.items.length,saved:saveResult.savedCount,errors:saveResult.errorCount,duration:`${dur}s`}});
    }catch(err){
      const dur=((Date.now()-start)/1000).toFixed(2);
      console.error('salesReturn sync failed', err);
      return reply.code(500).send({error:'Internal server error',message:err.message,duration:`${dur}s`});
    }
  },

  // GET /sales-returns
  async getReturns(req, reply){
    try{
      const {branchId,dateFrom,dateTo,customerId,limit=100,offset=0} = req.query;
      const data = await salesReturnModel.list({branch_id:branchId,date_from:dateFrom,date_to:dateTo,customer_id:customerId,limit:parseInt(limit),offset:parseInt(offset)});
      return reply.send({success:true,count:data.length,data});
    }catch(e){
      return reply.code(500).send({error:'Internal', message:e.message});
    }
  },

  // GET /sales-returns/:id
  async getReturnById(req, reply){
    try{
      const {id} = req.params;
      const rec = await salesReturnModel.getById(id);
      if(!rec) return reply.code(404).send({error:'Not found'});
      return reply.send({success:true,data:rec});
    }catch(e){
      return reply.code(500).send({error:'Internal', message:e.message});
    }
  },

  // GET /sales-returns/summary/stats
  async getSummary(req, reply){
    try{
      const {branchId,dateFrom,dateTo} = req.query;
      const sum = await salesReturnModel.getSummary({branch_id:branchId,date_from:dateFrom,date_to:dateTo});
      return reply.send({success:true,data:sum});
    }catch(e){
      return reply.code(500).send({error:'Internal', message:e.message});
    }
  }
};

module.exports = salesReturnController;
