const https = require("https");

const names = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corp.",
  NVDA: "NVIDIA Corp.",
  ULTA: "Ulta Beauty Inc.",
  ELF: "e.l.f. Beauty Inc.",
  EL: "Estee Lauder Companies",
  COTY: "Coty Inc.",
  VTI: "Vanguard Total Stock Market ETF",
  QQQ: "Invesco QQQ Trust",
  VOO: "Vanguard S&P 500 ETF",
  AVGO: "Broadcom Inc.",
  AMD: "Advanced Micro Devices",
  META: "Meta Platforms",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  NFLX: "Netflix Inc.",
  PLTR: "Palantir Technologies",
  TSLA: "Tesla Inc.",
  COST: "Costco Wholesale",
  LLY: "Eli Lilly",
  JPM: "JPMorgan Chase",
  V: "Visa Inc."
};

const moverUniverse = ["NVDA", "AVGO", "AMD", "MSFT", "AAPL", "META", "GOOGL", "AMZN", "NFLX", "PLTR", "TSLA", "COST", "LLY", "JPM", "V", "VOO", "QQQ", "VTI"];
const localSearchIndex = Object.entries(names).map(([symbol, name]) => ({
  symbol,
  name,
  type: symbol === "VOO" || symbol === "VTI" || symbol === "QQQ" ? "ETF" : "Equity"
}));

function rangeDays(range) {
  if (range === "1D") return 7;
  if (range === "1W") return 14;
  if (range === "1M") return 45;
  return 390;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function stooqSymbol(symbol) {
  return `${String(symbol || "AAPL").trim().toLowerCase()}.us`;
}

function parseCsv(csv) {
  return csv.trim().split(/\r?\n/).slice(1).map((line) => {
    const parts = line.split(",");
    return { label: parts[0], value: Number(parts[4]) };
  }).filter((item) => item.label && Number.isFinite(item.value));
}

function httpsGetText(requestUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(requestUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 ForNethraFinance/1.0",
        "Accept": "application/json,text/csv,*/*"
      }
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Market source returned ${res.statusCode}`));
          return;
        }
        resolve(body);
      });
    });
    req.setTimeout(timeoutMs || 5000, () => {
      req.destroy(new Error("Market request timed out"));
    });
    req.on("error", reject);
  });
}

function yahooRange(range) {
  if (range === "1D") return { range: "1d", interval: "5m" };
  if (range === "1W") return { range: "5d", interval: "15m" };
  if (range === "1M") return { range: "1mo", interval: "1d" };
  return { range: "1y", interval: "1d" };
}

async function fetchStooq(symbol, range) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - rangeDays(range));
  const requestUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol(symbol))}&i=d&d1=${dateKey(start)}&d2=${dateKey(end)}`;
  return parseCsv(await httpsGetText(requestUrl, 5000));
}

async function fetchYahoo(symbol, range) {
  const mapped = yahooRange(range);
  const requestUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${mapped.range}&interval=${mapped.interval}&includePrePost=false`;
  const json = JSON.parse(await httpsGetText(requestUrl, 5000));
  const result = json.chart && json.chart.result && json.chart.result[0];
  if (!result) throw new Error("No Yahoo chart result");
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  const closes = quote && quote.close ? quote.close : [];
  const times = result.timestamp || [];
  const series = closes.map((close, index) => {
    if (typeof close !== "number") return null;
    const date = times[index] ? new Date(times[index] * 1000) : null;
    return {
      label: date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : String(index + 1),
      value: close
    };
  }).filter(Boolean);
  if (!series.length) throw new Error("No Yahoo quote rows");
  const meta = result.meta || {};
  const price = Number(meta.regularMarketPrice || series[series.length - 1].value);
  const previous = Number(meta.chartPreviousClose || series[0].value);
  return {
    symbol,
    range,
    name: meta.longName || meta.shortName || names[symbol] || symbol,
    price,
    change: previous ? ((price - previous) / previous) * 100 : 0,
    series,
    source: "Yahoo Finance chart"
  };
}

async function fetchMarket(symbol, range) {
  try {
    return await fetchYahoo(symbol, range);
  } catch (yahooError) {
    const series = await fetchStooq(symbol, range);
    if (!series.length) throw yahooError;
    const price = Number(series[series.length - 1].value);
    const previous = Number(series[0].value);
    return {
      symbol,
      range,
      name: names[symbol] || symbol,
      price,
      change: previous ? ((price - previous) / previous) * 100 : 0,
      series,
      source: "Stooq historical quotes"
    };
  }
}

async function searchYahoo(query) {
  const requestUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
  const json = JSON.parse(await httpsGetText(requestUrl, 5000));
  return (json.quotes || [])
    .filter((item) => item.symbol && (item.quoteType === "EQUITY" || item.quoteType === "ETF"))
    .map((item) => ({
      symbol: String(item.symbol).toUpperCase(),
      name: item.shortname || item.longname || item.symbol,
      type: item.quoteType === "ETF" ? "ETF" : "Equity"
    }));
}

async function searchSymbols(query) {
  const clean = String(query || "").trim();
  if (!clean) return [];
  const lower = clean.toLowerCase();
  const local = localSearchIndex.filter((item) => (
    item.symbol.toLowerCase().includes(lower) || item.name.toLowerCase().includes(lower)
  ));
  try {
    const remote = await searchYahoo(clean);
    const merged = [...local, ...remote];
    const seen = new Set();
    return merged.filter((item) => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    }).slice(0, 8);
  } catch (error) {
    return local.slice(0, 8);
  }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

module.exports = {
  fetchMarket,
  moverUniverse,
  names,
  searchSymbols,
  sendJson
};
