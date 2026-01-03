const srpService = require('../services/srpService');

const itemMasterController = {
  async getList(req, reply) {
    try {
      const {
        search,
        entity_code,
        article_code,
        gtin_code,
        article_description,
        division_name,
        department_name,
        category_name,
        keyword,
        article_uom,
        article_creation_date,
        per_page,
        page,
      } = req.query || {};

      const result = await srpService.fetchItemMasterList({
        branchId: req.query?.branchId || null,
        search,
        entity_code,
        article_code,
        gtin_code,
        article_description,
        division_name,
        department_name,
        category_name,
        keyword,
        article_uom,
        article_creation_date,
        per_page: per_page ? Number(per_page) : undefined,
        page: page ? Number(page) : undefined,
      });

      const statusCode = result?.error ? 400 : 200;
      reply.status(statusCode).send(result);
    } catch (error) {
      console.error('Failed to fetch item master data', error);
      const status = error.status || 500;
      reply.status(status).send({
        error: true,
        error_message: error.message || 'Failed to fetch item master data',
        details: error.response || error.details || null,
        mdz_article_masters: [],
      });
    }
  },
};

module.exports = itemMasterController;
