const { searchSymbols, sendJson } = require("../lib/market");

module.exports = async function handler(req, res) {
  try {
    const parsed = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    const results = await searchSymbols(parsed.searchParams.get("q") || "");
    sendJson(res, 200, { results });
  } catch (error) {
    sendJson(res, 502, { error: error.message || "Search unavailable" });
  }
};
