// Reads ?page=&limit= and returns safe numbers
const getPaging = (query, defaultLimit = 10) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};
const pageMeta = (total, page, limit) => ({ total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
export { getPaging, pageMeta };
