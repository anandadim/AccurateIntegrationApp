const accurateService = require('../services/accurateService');
const salesReceiptModel = require('../models/salesReceiptModel');

// Helper to create date filter object for Accurate API
const createDateFilter = (dateFilterType, fromDate, toDate) => {
  const filterKey = `filter.${dateFilterType}`;
  return {
    [`${filterKey}.op`]: 'BETWEEN',
    [`${filterKey}.val`]: [fromDate, toDate]
  };
};

// Convert various date formats to YYYY-MM-DD
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
  if (dateStr.includes('-') && dateStr.length===10) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
};

const salesReceiptController = {
  // Internal helper to save a batch
  async _saveBatch(items, branchId, branchName){
    let saved=0, errCnt=0;
    for(const item of items){
      try{
        const r=item.d||item;
        if(!r||!r.id){errCnt++;continue;}

        const headerData = {
          receipt_id: r.id,
          receipt_number: r.number,
          branch_id: branchId,
          branch_name: branchName,
          journal_id: r.journalId||null,
          trans_date: convertDate(r.transDate),
          cheque_date: convertDate(r.chequeDate),
          customer_id: r.customerId||r.customer?.customerNo||null,
          customer_name: r.customer?.name||null,
          bank_id: r.bankId||r.bank?.id||null,
          bank_name: r.bank?.name||null,
          total_payment: r.totalPayment||0,
          over_pay: r.overPay||0,
          use_credit: r.useCredit||false,
          payment_method: r.paymentMethod||null,
          cheque_no: r.chequeNo||null,
          description: r.description||null,
          invoice_status: r.detailInvoice?.[0]?.invoice?.status||null,
          created_by: r.createdBy||null,
          opt_lock: r.optLock||0,
          raw_data: r
        };
        const itemsData = (r.detailInvoice||[]).map(di=>({
          invoice_id: di.invoiceId||di.invoice?.id||null,
          invoice_number: di.invoice?.number||null,
          invoice_date: convertDate(di.invoice?.transDate||di.invoice?.transDateView),
          invoice_total: di.invoice?.totalAmount||0,
          invoice_remaining: di.invoice?.owingForPayment||0,
          payment_amount: di.paymentAmount||0,
          discount_amount: di.discountAmount||0,
          paid_amount: di.invoicePayment||0,
          status: di.invoice?.status||null
        }));
        await salesReceiptModel.create(headerData, itemsData);
        saved++;
      }catch(e){
        errCnt++;
        console.error('save error',e.message);
      }
    }
    return {savedCount:saved,errorCount:errCnt};
  },

  // Check sync status – new vs updated vs unchanged
  async checkSyncStatus(req, reply) {
    try {
      const {branchId, dateFrom, dateTo, dateFilterType='createdDate'} = req.query;
      if (!branchId) return reply.code(400).send({error:'branchId is required'});

      const branches = accurateService.getBranches();
      const branch = branches.find(b=>b.id===branchId);
      if (!branch) return reply.code(404).send({error:'Branch not found'});

      const today = new Date().toISOString().split('T')[0];
      const fmt = s => convertDate(s)?.split('-').reverse().join('/') || null; // YYYY-MM-DD -> DD/MM/YYYY
      const fromDate = fmt(dateFrom||today);
      const toDate   = fmt(dateTo||today);
      const filters = createDateFilter(dateFilterType, fromDate, toDate);

      const apiResult = await accurateService.fetchListOnly('sales-receipt', branch.dbId, filters, branchId);
      let allApiItems = [...apiResult.items];
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      if (totalPages>1) {
        for(let p=2;p<=totalPages;p++){
          const pageFilters = {...filters,'sp.page':p};
          const res = await accurateService.fetchListOnly('sales-receipt', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(res.items);
          await new Promise(r=>setTimeout(r,100));
        }
      }

      const dbReceipts = await salesReceiptModel.getExistingForSync(branchId, dateFrom||today, dateTo||today);
      const dbMap = new Map(dbReceipts.map(r=>[r.receipt_id,r]));

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
        summary:{total:allApiItems.length,new:newRecs.length,updated:updatedRecs.length,unchanged:unchangedRecs.length,needSync:newRecs.length+updatedRecs.length,inDatabase:dbReceipts.length},
        receipts:{new:newRecs.slice(0,20),updated:updatedRecs.slice(0,20),hasMore:{new:newRecs.length>20,updated:updatedRecs.length>20}},
        recommendation:(newRecs.length+updatedRecs.length)===0?'up_to_date':'sync_needed'
      });
    }catch(err){
      console.error('Error checkSyncStatus:',err);
      return reply.code(500).send({error:'Internal server error',message:err.message});
    }
  },

  // Sync receipts (non-stream only)
  async syncFromAccurate(req, reply){
    const start = Date.now();
    try{
      console.log('Request body:', req.body);
      const {branchId, dateFrom, dateTo, maxItems, dateFilterType='createdDate', batchSize=50, batchDelay=300} = req.body;
      console.log('Extracted params:', {branchId, dateFrom, dateTo, maxItems, dateFilterType, batchSize, batchDelay});
      if(!branchId) return reply.code(400).send({error:'branchId is required'});
      const branches = accurateService.getBranches();
      const branch = branches.find(b=>b.id===branchId);
      if(!branch) return reply.code(404).send({error:'Branch not found'});
      const today=new Date().toISOString().split('T')[0];

      // Use non-stream method (reliable)
      const result = await accurateService.fetchListWithDetails('sales-receipt', branch.dbId, {maxItems,dateFrom,dateTo,dateFilterType,batchSize:parseInt(batchSize),batchDelay:parseInt(batchDelay)}, branchId);
      if(!result.success) return reply.code(500).send({error:'Failed to fetch'});
      
      // Call _saveBatch directly
      const saveResult = await salesReceiptController._saveBatch(result.items, branchId, branch.name);
      const dur=((Date.now()-start)/1000).toFixed(2);
      return reply.send({success:true,message:`Synced ${saveResult.savedCount} receipts`,summary:{branch:branch.name,fetched:result.items.length,saved:saveResult.savedCount,errors:saveResult.errorCount,duration:`${dur}s`}});
    }catch(err){
      const dur=((Date.now()-start)/1000).toFixed(2);
      console.error('Sync failed',err);
      return reply.code(500).send({error:'Internal server error',message:err.message,duration:`${dur}s`});
    }
  },

  // Get list and detail
  async getReceipts(req, reply){
    try{
      const {branchId,dateFrom,dateTo,customerId,limit=100,offset=0}=req.query;
      const data = await salesReceiptModel.list({branch_id:branchId,date_from:dateFrom,date_to:dateTo,customer_id:customerId,limit:parseInt(limit),offset:parseInt(offset)});
      return reply.send({success:true,count:data.length,data});
    }catch(e){return reply.code(500).send({error:'Internal',message:e.message});}
  },
  async getReceiptById(req, reply){
    try{const {id}=req.params;const rec=await salesReceiptModel.getById(id);if(!rec)return reply.code(404).send({error:'Not found'});return reply.send({success:true,data:rec});}catch(e){return reply.code(500).send({error:'Internal',message:e.message});}
  },
  async getSummary(req, reply){
    try{const {branchId,dateFrom,dateTo}=req.query;const sum=await salesReceiptModel.getSummary({branch_id:branchId,date_from:dateFrom,date_to:dateTo});return reply.send({success:true,data:sum});}catch(e){return reply.code(500).send({error:'Internal',message:e.message});}
  }
};

module.exports = salesReceiptController;
