const { fetchMarket, moverUniverse, names, sendJson } = require("../lib/market");

module.exports = async function handler(req, res) {
  try {
    const rows = await Promise.all(moverUniverse.map(async (symbol) => {
      try {
        const result = await fetchMarket(symbol, "1M");
        return {
          symbol,
          label: result.name || names[symbol] || symbol,
          move: result.change
        };
      } catch (error) {
        return null;
      }
    }));
    const movers = rows.filter(Boolean).sort((a, b) => b.move - a.move).slice(0, 5);
    if (!movers.length) throw new Error("No mover data");
    sendJson(res, 200, { movers });
  } catch (error) {
    sendJson(res, 502, { error: error.message || "Movers unavailable" });
  }
};
