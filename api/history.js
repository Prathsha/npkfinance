const { fetchMarket, sendJson } = require("../lib/market");

module.exports = async function handler(req, res) {
  try {
    const parsed = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    const symbol = String(parsed.searchParams.get("symbol") || "AAPL").toUpperCase();
    const range = String(parsed.searchParams.get("range") || "1Y").toUpperCase();
    sendJson(res, 200, await fetchMarket(symbol, range));
  } catch (error) {
    sendJson(res, 502, { error: error.message || "Market data unavailable" });
  }
};
