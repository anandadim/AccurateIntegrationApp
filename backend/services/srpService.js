const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { saveInventoryRecords } = require('../models/snjInventoryRepository');
const { saveSalesDetailRecords } = require('../models/snjSalesDetailRepository');
const { saveItemMasterRecords, getItemMasterRecords } = require('../models/snjItemMasterRepository');

const DEFAULT_SRP_BASE_URL = process.env.SNJ_MERCH_BASE_URL || 'https://api-merch-prod.snjsystem.com/api/merch-api';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_SALES_CHUNK_DAYS = 5;
const DEFAULT_SALES_DELAY = 200;
const SALES_DETAIL_ENDPOINT = '/sales-detail/export-data';

let branchesConfigCache = null;

const loadBranchesConfig = (forceReload = false) => {
  if (!branchesConfigCache || forceReload) {
    const configPath = path.join(__dirname, '../config/srp-branches.json');
    if (fs.existsSync(configPath)) {
      branchesConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`✅ Loaded ${branchesConfigCache.branches?.length || 0} SNJ branches from config`);
    } else {
      console.warn('⚠️ srp-branches.json not found, falling back to environment variables');
      branchesConfigCache = { branches: [] };
    }
  }
  return branchesConfigCache;
};

const clearBranchesConfigCache = () => {
  branchesConfigCache = null;
  console.log('🔄 SNJ branch cache cleared');
};

const normalizeCode = (value) => (value != null ? String(value).trim() : null);

const normalizeBranchConfig = (branch = {}) => {
  if (!branch) return null;

  return {
    id: branch.id || null,
    name: branch.name || null,
    baseUrl: branch.baseUrl || DEFAULT_SRP_BASE_URL,
    credentials: branch.credentials || {},
    locationCode: normalizeCode(branch.locationCode),
    storageLocationCode: normalizeCode(branch.storageLocationCode),
    storeCode: normalizeCode(branch.storeCode) || normalizeCode(branch.locationCode),
    active: branch.active !== false,
  };
};

const getActiveBranchConfigs = (forceReload = false) => {
  const config = loadBranchesConfig(forceReload);
  const active = (config.branches || [])
    .filter(branch => branch && branch.active)
    .map(normalizeBranchConfig)
    .filter(Boolean);

  if (active.length > 0) {
    return active;
  }

  const envAppKey = process.env.SRP_APP_KEY;
  const envAppToken = process.env.SRP_APP_TOKEN;

  if (!envAppKey || !envAppToken) {
    return [];
  }

  return [
    normalizeBranchConfig({
      id: 'default',
      name: 'Default SNJ Branch',
      baseUrl: process.env.SNJ_MERCH_BASE_URL || DEFAULT_SRP_BASE_URL,
      credentials: {
        appKey: envAppKey,
        appToken: envAppToken,
      },
      locationCode: process.env.SRP_DEFAULT_LOCATION || null,
      storageLocationCode: null,
      storeCode: process.env.SRP_DEFAULT_STORE_CODE || process.env.SRP_DEFAULT_LOCATION || null,
      active: true,
    }),
  ];
};

const getBranchConfig = (branchId) => {
  const activeBranches = getActiveBranchConfigs();
  const branch = branchId ? activeBranches.find(item => item.id === branchId) : activeBranches[0];

  if (branch) {
    return {
      id: branch.id,
      name: branch.name,
      baseUrl: branch.baseUrl || DEFAULT_SRP_BASE_URL,
      credentials: branch.credentials || {},
      locationCode: branch.locationCode || null,
      storageLocationCode: branch.storageLocationCode || null,
      storeCode: branch.storeCode || null,
    };
  }

  return normalizeBranchConfig({
    id: 'default',
    name: 'Default SNJ Branch',
    baseUrl: DEFAULT_SRP_BASE_URL,
    credentials: {
      appKey: process.env.SRP_APP_KEY,
      appToken: process.env.SRP_APP_TOKEN,
    },
    locationCode: process.env.SRP_DEFAULT_LOCATION,
    storageLocationCode: null,
    storeCode: process.env.SRP_DEFAULT_STORE_CODE || process.env.SRP_DEFAULT_LOCATION || null,
    active: true,
  });
};

const normalizeStoreCode = (value) => (value != null ? String(value).trim() : null);

const parseDateInput = (value, fieldName) => {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }

  return date;
};

const formatDate = (date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const newDate = new Date(date);
  newDate.setUTCDate(newDate.getUTCDate() + days);
  return newDate;
};

const splitDateRange = (startDate, endDate, chunkSizeDays = DEFAULT_SALES_CHUNK_DAYS) => {
  const ranges = [];
  const normalizedChunk = Math.max(1, Number(chunkSizeDays) || DEFAULT_SALES_CHUNK_DAYS);

  let currentStart = new Date(startDate);

  while (currentStart <= endDate) {
    const tentativeEnd = addDays(currentStart, normalizedChunk - 1);
    const currentEnd = tentativeEnd > endDate ? new Date(endDate) : tentativeEnd;

    ranges.push({
      from: new Date(currentStart),
      to: new Date(currentEnd),
    });

    currentStart = addDays(currentEnd, 1);
  }

  return ranges;
};

const delay = (ms) => (ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve());

const normalizeSalesDetailResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('SNJ Merch sales response is not an object');
  }

  if (payload.error) {
    const message = payload.error_message || 'SNJ Merch sales API responded with an error flag';
    const error = new Error(message);
    error.details = payload.errors || null;
    throw error;
  }

  const data = Array.isArray(payload.data) ? payload.data : [];
  const totalRecords = payload.total_records != null ? Number(payload.total_records) : data.length;

  return {
    data,
    totals: payload.totals || null,
    totalRecords,
  };
};

const fetchSalesDetailData = async ({ branchId, storeCode, dateFrom, dateTo }) => {
  const { client, branchConfig } = createApiClient(branchId);

  if (!storeCode) {
    throw new Error('storeCode is required for SNJ sales detail request');
  }

  const params = {
    date_from: dateFrom,
    date_to: dateTo,
    store_code: storeCode,
  };

  console.log('🌐 SNJ Sales Detail Request', {
    baseUrl: branchConfig.baseUrl,
    params,
  });

  try {
    const response = await client.get(SALES_DETAIL_ENDPOINT, { params });
    return normalizeSalesDetailResponse(response.data);
  } catch (error) {
    if (error.response) {
      console.error('❌ SNJ Merch Sales API error', {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error('❌ SNJ Merch sales request failed', error.message);
    }

    const message = error.response?.data?.error_message || error.message || 'Failed to fetch SNJ sales detail data';
    const wrappedError = new Error(message);
    wrappedError.status = error.response?.status;
    wrappedError.response = error.response?.data;
    throw wrappedError;
  }
};

const createApiClient = () => {
  const branchConfig = getBranchConfig();
  const { baseUrl, credentials } = branchConfig;

  if (!credentials?.appKey || !credentials?.appToken) {
    throw new Error('SNJ Merch credentials (appKey/appToken) are missing');
  }

  return {
    branchConfig,
    client: axios.create({
      baseURL: baseUrl,
      headers: {
        'AppKey': credentials.appKey,
        'AppToken': credentials.appToken,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }),
  };
};

const buildItemEnquiryParams = ({ locationCode, articleCodes, page = 1, perPage = DEFAULT_PAGE_SIZE }) => {
  const params = {
    per_page: perPage,
    page,
  };

  if (locationCode) {
    params.location_code = String(locationCode).trim();
  }

  if (Array.isArray(articleCodes) && articleCodes.length > 0) {
    params.article_codes = articleCodes.join(',');
  }

  return params;
};

const normalizeItemEnquiryResponse = (response) => {
  if (!response || typeof response !== 'object') {
    throw new Error('SNJ Merch response is not an object');
  }

  if (response.error) {
    const message = response.error_message || 'SNJ Merch API responded with an error flag';
    const error = new Error(message);
    error.details = response.errors || null;
    throw error;
  }

  if (!response.inventories) {
    throw new Error('SNJ Merch response does not contain "inventories" field');
  }

  const { data = [], current_page, per_page, total, last_page, from, to } = response.inventories;

  return {
    data,
    pagination: {
      currentPage: current_page ?? null,
      perPage: per_page ?? null,
      total: total ?? null,
      lastPage: last_page ?? null,
      from: from ?? null,
      to: to ?? null,
    },
  };
};

const fetchItemEnquiry = async ({ endpoint, branchId, locationCode, articleCodes, page, perPage }) => {
  const { client, branchConfig } = createApiClient(branchId);
  const effectiveLocation = locationCode != null ? String(locationCode).trim() : null;
  const branchLocation = branchConfig.locationCode != null ? String(branchConfig.locationCode).trim() : null;
  const finalLocation = effectiveLocation || branchLocation;

  if (!finalLocation) {
    throw new Error('locationCode is required for SNJ item enquiry');
  }

  const params = buildItemEnquiryParams({
    locationCode: finalLocation,
    articleCodes,
    page,
    perPage,
  });

  console.log('🌐 SNJ Item Enquiry Request', {
    endpoint,
    baseUrl: branchConfig.baseUrl,
    params,
  });

  try {
    const response = await client.get(endpoint, { params });
    return normalizeItemEnquiryResponse(response.data);
  } catch (error) {
    if (error.response) {
      console.error('❌ SNJ Merch API error', {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error('❌ SNJ Merch request failed', error.message);
    }

    const message = error.response?.data?.error_message || error.message || 'Failed to fetch SNJ item enquiry data';
    const wrappedError = new Error(message);
    wrappedError.status = error.response?.status;
    wrappedError.response = error.response?.data;
    throw wrappedError;
  }
};

const fetchItemEnquiryAllPages = async ({ endpoint, branchId, locationCode, articleCodes, perPage = DEFAULT_PAGE_SIZE, maxPages = null, pageDelay = 200 }) => {
  const firstPage = await fetchItemEnquiry({ endpoint, branchId, locationCode, articleCodes, page: 1, perPage });

  const items = [...firstPage.data];
  const pagination = firstPage.pagination;

  const totalPages = pagination.lastPage || 1;

  if (totalPages === 1) {
    return {
      data: items,
      pagination,
      collectedPages: 1,
    };
  }

  const effectiveMaxPages = maxPages ? Math.min(maxPages, totalPages) : totalPages;

  for (let page = 2; page <= effectiveMaxPages; page += 1) {
    const pageResult = await fetchItemEnquiry({ endpoint, branchId, locationCode, articleCodes, page, perPage });
    items.push(...pageResult.data);

    if (pageDelay > 0 && page < effectiveMaxPages) {
      await new Promise(resolve => setTimeout(resolve, pageDelay));
    }
  }

  return {
    data: items,
    pagination: {
      ...pagination,
      collected: items.length,
      collectedPages: effectiveMaxPages,
    },
  };
};

const fetchItemMasterList = async ({
  per_page,
  page,
} = {}) => {
  const { client } = createApiClient();

  const params = {};

  if (per_page != null) {
    params.per_page = per_page;
  }

  if (page != null) {
    params.page = page;
  }

  try {
    console.log('🌐 SNJ Item Master Request', {
      params,
      baseUrl: client.defaults.baseURL,
    });

    const response = await client.get('/item-master/list', { params });

    console.log('✅ SNJ Item Master Response', {
      status: response.status,
      keys: Object.keys(response.data || {}),
      total: response.data?.mdz_article_masters?.total ?? null,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ SNJ Item Master API error', {
        status: error.response.status,
        data: error.response.data,
      });

      const message = error.response.data?.error_message || error.response.data?.message || error.message;
      const wrappedError = new Error(`Item Master API error: ${message}`);
      wrappedError.status = error.response.status;
      wrappedError.response = error.response.data;
      throw wrappedError;
    }

    if (error.request) {
      throw new Error('Item Master API: No response received from server');
    }

    throw new Error(`Item Master API: ${error.message}`);
  }
};

const fetchItemMasterAllPages = async ({
  perPage = DEFAULT_PAGE_SIZE,
  maxPages = null,
  pageDelay = 150,
} = {}) => {
  const collected = [];
  let currentPage = 1;
  let lastPage = 1;
  let total = 0;

  do {
    const response = await fetchItemMasterList({
      per_page: perPage,
      page: currentPage,
    });

    if (!response || response.error) {
      const message = response?.error_message || 'SNJ Item Master API returned an error flag';
      const error = new Error(message);
      error.details = response;
      throw error;
    }

    const master = response.mdz_article_masters || {};
    const data = Array.isArray(master.data) ? master.data : [];
    collected.push(...data);

    total = master.total != null ? Number(master.total) : total;
    lastPage = master.last_page != null ? Number(master.last_page) : lastPage;

    if (maxPages && currentPage >= maxPages) {
      break;
    }

    currentPage += 1;

    if (pageDelay > 0 && currentPage <= lastPage && (!maxPages || currentPage <= maxPages)) {
      await new Promise((resolve) => setTimeout(resolve, pageDelay));
    }
  } while (currentPage <= lastPage);

  return {
    data: collected,
    pagination: {
      total,
      perPage,
      lastPage,
      collectedPages: Math.min(lastPage, maxPages || lastPage),
    },
  };
};

const srpService = {
  getBranches(forceReload = false) {
    const branches = getActiveBranchConfigs(forceReload);

    return branches
      .map(({ id, name, locationCode, storeCode }) => ({
        id,
        name,
        locationCode: locationCode != null ? String(locationCode).trim() : null,
        storeCode: storeCode != null ? String(storeCode).trim() : null,
      }));
  },

  reloadBranches() {
    clearBranchesConfigCache();
    return this.getBranches(true);
  },

  async fetchInventoryByLocation({ branchId = null, locationCode = null, articleCodes = [], page = 1, perPage = DEFAULT_PAGE_SIZE }) {
    return fetchItemEnquiry({
      endpoint: '/item-enquiry/by-location',
      branchId,
      locationCode,
      articleCodes,
      page,
      perPage,
    });
  },

  async fetchInventoryByLocationAllPages({ branchId = null, locationCode = null, articleCodes = [], perPage = DEFAULT_PAGE_SIZE, maxPages = null, pageDelay = 150 }) {
    return fetchItemEnquiryAllPages({
      endpoint: '/item-enquiry/by-location',
      branchId,
      locationCode,
      articleCodes,
      perPage,
      maxPages,
      pageDelay,
    });
  },

  async fetchInventoryByStorageLocation({ branchId = null, locationCode = null, articleCodes = [], page = 1, perPage = DEFAULT_PAGE_SIZE }) {
    return fetchItemEnquiry({
      endpoint: '/item-enquiry/by-storage-location',
      branchId,
      locationCode,
      articleCodes,
      page,
      perPage,
    });
  },

  async fetchInventoryByStorageLocationAllPages({ branchId = null, locationCode = null, articleCodes = [], perPage = DEFAULT_PAGE_SIZE, maxPages = null, pageDelay = 150 }) {
    return fetchItemEnquiryAllPages({
      endpoint: '/item-enquiry/by-storage-location',
      branchId,
      locationCode,
      articleCodes,
      perPage,
      maxPages,
      pageDelay,
    });
  },

  async fetchItemMasterList(options = {}) {
    return fetchItemMasterList(options);
  },

  async fetchItemMasterAllPages(options = {}) {
    return fetchItemMasterAllPages(options);
  },

  async syncItemMaster({
    perPage = DEFAULT_PAGE_SIZE,
    maxPages = null,
    pageDelay = 150,
    truncateBeforeInsert = false,
  } = {}) {
    const fetchResult = await fetchItemMasterAllPages({
      perPage,
      maxPages,
      pageDelay,
    });

    const saveResult = await saveItemMasterRecords(fetchResult.data, {
      truncateBeforeInsert,
    });

    return {
      totals: {
        totalFetched: fetchResult.data.length,
        totalInserted: saveResult.insertedCount,
        totalUpdated: saveResult.updatedCount,
      },
      pagination: fetchResult.pagination,
    };
  },

  async getItemMasterRecords(options = {}) {
    return getItemMasterRecords(options);
  },

  async syncInventory({
    branchId = null,
    locationCode = null,
    articleCodes = [],
    perPage = DEFAULT_PAGE_SIZE,
    maxPages = null,
    pageDelay = 150,
    truncateBeforeInsert = false,
    endpoint = 'by-storage-location',
  }) {
    const normalizedEndpoint = endpoint === 'by-location' ? 'by-location' : 'by-storage-location';

    const activeBranches = getActiveBranchConfigs();

    if (!activeBranches.length) {
      throw new Error('SNJ inventory sync membutuhkan minimal satu cabang aktif di konfigurasi');
    }

    const fetcher = normalizedEndpoint === 'by-location'
      ? this.fetchInventoryByLocationAllPages.bind(this)
      : this.fetchInventoryByStorageLocationAllPages.bind(this);

    const targetBranches = branchId
      ? activeBranches.filter(branch => branch.id === branchId)
      : activeBranches;

    if (!targetBranches.length) {
      throw new Error(`Cabang SNJ dengan ID ${branchId} tidak ditemukan atau tidak aktif`);
    }

    let shouldTruncate = truncateBeforeInsert;
    const branchSummaries = [];
    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const branch of targetBranches) {
      const overrideLocation = locationCode != null ? String(locationCode).trim() : null;
      const branchLocation = branch.locationCode != null ? String(branch.locationCode).trim() : null;
      const effectiveLocation = overrideLocation || branchLocation;

      if (!effectiveLocation) {
        throw new Error(`Cabang ${branch.id} tidak memiliki locationCode dan tidak ada override yang diberikan`);
      }

      const fetchResult = await fetcher({
        branchId: branch.id,
        locationCode: effectiveLocation,
        articleCodes,
        perPage,
        maxPages,
        pageDelay,
      });

      const saveResult = await saveInventoryRecords(fetchResult.data, {
        truncateBeforeInsert: shouldTruncate,
        sourceEndpoint: normalizedEndpoint,
      });

      shouldTruncate = false;

      branchSummaries.push({
        branchId: branch.id,
        branchName: branch.name,
        locationCode: effectiveLocation,
        fetchSummary: {
          totalFetched: fetchResult.data.length,
          pagination: fetchResult.pagination,
        },
        saveSummary: saveResult,
      });

      totalFetched += fetchResult.data.length;
      totalInserted += saveResult.insertedCount;
      totalUpdated += saveResult.updatedCount;
    }

    return {
      totals: {
        branchesProcessed: branchSummaries.length,
        totalFetched,
        totalInserted,
        totalUpdated,
      },
      branches: branchSummaries,
    };
  },

  async fetchSalesDetail({ branchId = null, storeCode, dateFrom, dateTo }) {
    const normalizedStoreCode = normalizeStoreCode(storeCode);

    if (!normalizedStoreCode) {
      throw new Error('storeCode wajib diisi (gunakan "All Stores" untuk semua cabang)');
    }

    const startDate = formatDate(parseDateInput(dateFrom, 'dateFrom'));
    const endDate = formatDate(parseDateInput(dateTo, 'dateTo'));

    if (new Date(startDate) > new Date(endDate)) {
      throw new Error('dateFrom tidak boleh lebih besar daripada dateTo');
    }

    const response = await fetchSalesDetailData({
      branchId,
      storeCode: normalizedStoreCode,
      dateFrom: startDate,
      dateTo: endDate,
    });

    return response;
  },

  async syncSalesDetail({
    branchId = null,
    storeCode,
    dateFrom,
    dateTo,
    chunkSizeDays = DEFAULT_SALES_CHUNK_DAYS,
    delayMs = DEFAULT_SALES_DELAY,
    truncateBeforeInsert = false,
  }) {
    const normalizedStoreCode = normalizeStoreCode(storeCode) || 'All Stores';
    const startDate = parseDateInput(dateFrom, 'dateFrom');
    const endDate = parseDateInput(dateTo, 'dateTo');

    if (startDate > endDate) {
      throw new Error('dateFrom tidak boleh lebih besar daripada dateTo');
    }

    const dateRanges = splitDateRange(startDate, endDate, chunkSizeDays);

    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalsAggregation = null;

    const chunkSummaries = [];
    let shouldTruncate = truncateBeforeInsert;

    for (const range of dateRanges) {
      const from = formatDate(range.from);
      const to = formatDate(range.to);

      const { data, totals } = await fetchSalesDetailData({
        branchId,
        storeCode: normalizedStoreCode,
        dateFrom: from,
        dateTo: to,
      });

      const saveResult = await saveSalesDetailRecords(data, {
        truncateBeforeInsert: shouldTruncate,
        storeCode: normalizedStoreCode,
      });

      shouldTruncate = false;

      totalFetched += data.length;
      totalInserted += saveResult.insertedCount;
      totalUpdated += saveResult.updatedCount;

      if (totals) {
        if (!totalsAggregation) {
          totalsAggregation = { ...totals };
        } else {
          Object.keys(totals).forEach((key) => {
            const value = totals[key];
            if (typeof value === 'number') {
              totalsAggregation[key] = (totalsAggregation[key] || 0) + value;
            }
          });
        }
      }

      chunkSummaries.push({
        dateFrom: from,
        dateTo: to,
        fetched: data.length,
        saveSummary: saveResult,
      });

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }

    return {
      totals: {
        totalFetched,
        totalInserted,
        totalUpdated,
        storeCode: normalizedStoreCode,
        dateRange: {
          from: formatDate(startDate),
          to: formatDate(endDate),
        },
        chunkCount: dateRanges.length,
        aggregatedTotals: totalsAggregation,
      },
      chunks: chunkSummaries,
    };
  },
};

module.exports = srpService;
