const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0
});

const noIncomeTaxStates = new Set(["TX", "FL", "WA"]);
const stateTaxRates = { NY: 0.055, CA: 0.064, TX: 0, FL: 0, WA: 0 };

const baseBudget = [
  { name: "Rent", type: "Need", planned: 0, actual: 0, color: "#7c3aed" },
  { name: "Groceries", type: "Need", planned: 0, actual: 0, color: "#0f766e" },
  { name: "Transportation", type: "Need", planned: 0, actual: 0, color: "#a855f7" },
  { name: "Utilities", type: "Need", planned: 0, actual: 0, color: "#ca8a04" },
  { name: "Dining out", type: "Want", planned: 0, actual: 0, color: "#db2777" },
  { name: "Subscriptions", type: "Want", planned: 0, actual: 0, color: "#6d28d9" },
  { name: "Emergency fund", type: "Goal", planned: 0, actual: 0, color: "#16a34a" },
  { name: "Brokerage investing", type: "Investment", planned: 0, actual: 0, color: "#8b5cf6" }
];

const stockProfiles = {
  AAPL: { name: "Apple Inc.", price: 214.38, change: 1.16 },
  MSFT: { name: "Microsoft Corp.", price: 502.14, change: 0.82 },
  NVDA: { name: "NVIDIA Corp.", price: 158.24, change: 2.31 },
  ULTA: { name: "Ulta Beauty Inc.", price: 427.2, change: 0.68 },
  ELF: { name: "e.l.f. Beauty Inc.", price: 128.3, change: 1.84 },
  EL: { name: "Estee Lauder Companies", price: 92.15, change: -0.22 },
  COTY: { name: "Coty Inc.", price: 10.4, change: 0.51 },
  VTI: { name: "Vanguard Total Stock Market ETF", price: 318.62, change: 0.44 },
  QQQ: { name: "Invesco QQQ Trust", price: 552.48, change: 0.91 },
  VOO: { name: "Vanguard S&P 500 ETF", price: 569.22, change: 0.39 }
};

const beautyStocks = [
  { symbol: "ULTA", label: "Ulta Beauty", risk: "Beauty retail" },
  { symbol: "ELF", label: "e.l.f. Beauty", risk: "Beauty growth" },
  { symbol: "EL", label: "Estee Lauder", risk: "Prestige cosmetics" },
  { symbol: "COTY", label: "Coty", risk: "Fragrance and cosmetics" }
];

const moverUniverse = [
  "NVDA", "AVGO", "AMD", "MSFT", "AAPL", "META", "GOOGL", "AMZN", "NFLX", "PLTR", "TSLA", "COST", "LLY", "JPM", "V", "VOO", "QQQ", "VTI"
];
const localSearchIndex = [
  { symbol: "AAPL", name: "Apple Inc.", type: "Equity" },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "Equity" },
  { symbol: "NVDA", name: "NVIDIA Corp.", type: "Equity" },
  { symbol: "ULTA", name: "Ulta Beauty Inc.", type: "Equity" },
  { symbol: "ELF", name: "e.l.f. Beauty Inc.", type: "Equity" },
  { symbol: "EL", name: "Estee Lauder Companies", type: "Equity" },
  { symbol: "COTY", name: "Coty Inc.", type: "Equity" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Equity" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Equity" },
  { symbol: "META", name: "Meta Platforms", type: "Equity" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity" },
  { symbol: "AMD", name: "Advanced Micro Devices", type: "Equity" }
];

const defaultState = {
  income: {
    weeklyPay: 0,
    state: "NY",
    filing: "single",
    frequency: "weekly",
    retirement: 0,
    health: 0,
    cashSavings: 0,
    emergencyTarget: 0
  },
  budget: baseBudget,
  portfolio: [],
  tradeCash: 0,
  selectedStock: "AAPL",
  selectedRange: "1Y"
};

let state = loadState();
let currentSeries = [];
let stockChartPoints = [];
let moversLoaded = false;
let currentQuote = null;
let refreshTimer = null;
let suggestionTimer = null;
let marketRefreshInFlight = false;
let stockRequestId = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem("for-nethra-finance-v3-zero");
    if (saved) return normalizeState(JSON.parse(saved));
    return clone(defaultState);
  } catch {
    return clone(defaultState);
  }
}

function normalizeState(value) {
  const purpleBudget = (value.budget || clone(baseBudget)).map((item) => {
    const match = baseBudget.find((base) => base.name === item.name);
    return match ? { ...item, color: match.color } : item;
  });
  const income = { ...clone(defaultState.income), ...(value.income || {}) };
  if (!income.weeklyPay && income.salary) {
    income.weeklyPay = Math.round(Number(income.salary || 0) / 52);
  }
  income.frequency = "weekly";
  return {
    ...clone(defaultState),
    ...value,
    income,
    budget: purpleBudget,
    portfolio: value.portfolio || clone(defaultState.portfolio),
    tradeCash: Number(value.tradeCash || 0)
  };
}

function saveState() {
  localStorage.setItem("for-nethra-finance-v3-zero", JSON.stringify(state));
}

function calculateTaxes(input) {
  const salary = (Number(input.weeklyPay) || 0) * 52;
  const deductions = (Number(input.retirement) || 0) + (Number(input.health) || 0);
  const taxable = Math.max(0, salary - deductions);
  const standardDeduction = input.filing === "married" ? 29200 : 14600;
  const federalTaxable = Math.max(0, taxable - standardDeduction);
  const federal = federalTaxable * 0.14;
  const stateRate = Object.prototype.hasOwnProperty.call(stateTaxRates, input.state) ? stateTaxRates[input.state] : 0.05;
  const stateTax = taxable * stateRate;
  const payroll = salary * 0.0765;
  const netAnnual = Math.max(0, salary - federal - stateTax - payroll - deductions);
  return {
    grossAnnual: salary,
    grossMonthly: salary / 12,
    federal,
    stateTax,
    payroll,
    deductions,
    netAnnual,
    netMonthly: netAnnual / 12,
    netWeekly: netAnnual / 52,
    noStateIncomeTax: noIncomeTaxStates.has(input.state)
  };
}

function totals() {
  const tax = calculateTaxes(state.income);
  const planned = sum(state.budget, "planned");
  const actual = sum(state.budget, "actual");
  const goals = state.budget.filter((item) => item.type === "Goal").reduce((total, item) => total + Number(item.planned || 0), 0);
  const investBudget = getInvestBudget();
  const investedThisMonth = state.portfolio.reduce((total, item) => total + Number(item.monthContribution || 0), 0);
  const investAvailable = Math.max(0, investBudget - investedThisMonth + Number(state.tradeCash || 0));
  const portfolioCost = state.portfolio.reduce((total, item) => total + Number(item.costBasis || 0), 0);
  const portfolioValue = state.portfolio.reduce((total, item) => total + Number(item.shares || 0) * Number(item.currentPrice || 0), 0);
  const cashSavings = Number(state.income.cashSavings || 0);
  return {
    tax,
    planned,
    actual,
    goals,
    investBudget,
    investedThisMonth,
    investAvailable,
    portfolioCost,
    portfolioValue,
    cashSavings,
    remaining: tax.netMonthly - planned,
    netWorth: cashSavings + portfolioValue,
    portfolioGain: portfolioValue - portfolioCost
  };
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function getInvestBudget() {
  const found = state.budget.find((item) => item.type === "Investment" || /brokerage|invest/i.test(item.name));
  return found ? Number(found.planned || 0) : 0;
}

function route() {
  const page = (location.hash || "#overview").replace("#", "");
  const active = document.querySelector(`[data-page="${page}"]`) ? page : "overview";
  document.querySelectorAll(".page").forEach((node) => node.classList.toggle("active", node.dataset.page === active));
  document.querySelectorAll(".top-nav a").forEach((node) => node.classList.toggle("active", node.dataset.route === active));
  syncRangeTabs();
  renderAll();
}

function wireIncome() {
  const form = document.querySelector("#incomeForm");
  Object.entries(state.income).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  form.addEventListener("input", () => {
    const data = new FormData(form);
    state.income = { ...state.income, ...Object.fromEntries(data.entries()) };
    saveState();
    renderAll();
  });
}

function renderOverview() {
  const t = totals();
  const budgetPct = t.tax.netMonthly > 0 ? t.planned / t.tax.netMonthly : 0;
  const needs = state.budget.filter((item) => item.type === "Need").reduce((total, item) => total + Number(item.planned || 0), 0);
  const wants = state.budget.filter((item) => item.type === "Want").reduce((total, item) => total + Number(item.planned || 0), 0);
  const returnPct = t.portfolioCost > 0 ? t.portfolioGain / t.portfolioCost : 0;

  text("#overviewSurplus", usd.format(t.remaining));
  text("#overviewSurplusHint", t.remaining < 0 ? "Budget exceeds estimated take-home" : "After planned spending and goals");
  text("#overviewNet", usd.format(t.tax.netMonthly));
  text("#overviewBudget", usd.format(t.planned));
  text("#overviewBudgetPercent", `${percent.format(budgetPct)} of take-home`);
  text("#overviewInvestable", usd.format(t.investAvailable));
  text("#overviewNetWorth", usd.format(t.netWorth));
  text("#overviewStatus", t.remaining < 0 ? "Review" : "On track");
  text("#overviewPaycheck", usd.format(t.tax.netWeekly));
  text("#overviewNeedsWants", `${usd.format(needs)} / ${usd.format(wants)}`);
  text("#overviewPortfolioReturn", percent.format(returnPct));

  drawBarChart("#cashFlowChart", [
    { label: "Take-home", value: t.tax.netMonthly, color: "#7c3aed" },
    { label: "Budgeted", value: t.planned, color: "#a855f7" },
    { label: "Investable", value: t.investAvailable, color: "#8b5cf6" },
    { label: "Surplus", value: Math.max(0, t.remaining), color: "#16a34a" }
  ]);

  const mix = groupedBudget();
  drawDonutChart("#budgetMixChart", mix);
  renderLegend("#budgetMixLegend", mix);
}

function renderIncome() {
  const t = totals();
  const tax = t.tax;
  const rows = [
    ["Gross weekly pay", tax.grossAnnual / 52],
    ["Gross annualized income", tax.grossAnnual],
    ["Gross monthly income", tax.grossMonthly],
    ["Estimated federal taxes", -tax.federal],
    ["Estimated state taxes", -tax.stateTax],
    ["Estimated payroll taxes", -tax.payroll],
    ["Estimated deductions", -tax.deductions],
    ["Estimated net monthly", tax.netMonthly],
    ["Estimated net weekly", tax.netWeekly]
  ];
  if (tax.noStateIncomeTax) rows.splice(4, 0, ["State tax note", "No broad state income tax assumed"]);
  document.querySelector("#incomeResults").innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${typeof value === "number" ? usd.format(value) : value}</dd></div>`)
    .join("");

  text("#incomeFederal", usd.format(tax.federal));
  text("#incomePayroll", usd.format(tax.payroll));
  const months = t.planned > 0 ? t.cashSavings / t.planned : 0;
  text("#incomeEmergencyMonths", `${months.toFixed(1)} months`);
}

function renderBudget() {
  const list = document.querySelector("#budgetList");
  const template = document.querySelector("#budgetItemTemplate");
  const t = totals();
  list.innerHTML = "";

  state.budget.forEach((item, index) => {
    const node = template.content.cloneNode(true);
    const planned = Number(item.planned || 0);
    const actual = Number(item.actual || 0);
    const remaining = planned - actual;
    const pct = t.tax.netMonthly > 0 ? planned / t.tax.netMonthly : 0;
    node.querySelector(".category-dot").style.background = item.color;
    node.querySelector(".category-name").textContent = item.name;
    node.querySelector(".category-type").textContent = item.type;
    node.querySelector(".planned-input").value = planned;
    node.querySelector(".actual-input").value = actual;
    node.querySelector(".percent-pill").textContent = percent.format(pct);
    const pill = node.querySelector(".remaining-pill");
    pill.textContent = remaining >= 0 ? `${usd.format(remaining)} left` : `${usd.format(Math.abs(remaining))} over`;
    pill.classList.toggle("over", remaining < 0);
    node.querySelector(".remove-budget").disabled = state.budget.length <= 1;

    node.querySelector(".planned-input").addEventListener("input", (event) => {
      state.budget[index].planned = Number(event.target.value);
      saveState();
      renderAll();
    });
    node.querySelector(".actual-input").addEventListener("input", (event) => {
      state.budget[index].actual = Number(event.target.value);
      saveState();
      renderAll();
    });
    node.querySelector(".remove-budget").addEventListener("click", () => removeBudgetCategory(index));
    list.appendChild(node);
  });

  text("#budgetPlanned", usd.format(t.planned));
  text("#budgetActual", usd.format(t.actual));
  text("#budgetRemaining", usd.format(t.remaining));
  text("#budgetGoals", usd.format(t.goals + t.investBudget));
  text("#budgetPlannedPct", `${percent.format(t.tax.netMonthly > 0 ? t.planned / t.tax.netMonthly : 0)} of take-home`);
  text("#budgetActualPct", `${percent.format(t.tax.netMonthly > 0 ? t.actual / t.tax.netMonthly : 0)} of take-home`);
  text("#budgetHealth", t.remaining < 0 ? "Over plan" : "Healthy");

  const mix = groupedBudget();
  drawDonutChart("#budgetPercentChart", mix);
  document.querySelector("#budgetStack").innerHTML = mix
    .map((item) => {
      const share = t.tax.netMonthly > 0 ? item.value / t.tax.netMonthly : 0;
      return `<div class="stack-row"><span><i style="background:${item.color}"></i>${item.label}</span><strong>${percent.format(share)}</strong><div><b style="width:${Math.min(100, share * 100)}%;background:${item.color}"></b></div></div>`;
    })
    .join("");
}

function removeBudgetCategory(index) {
  if (state.budget.length <= 1) return;
  state.budget.splice(index, 1);
  saveState();
  renderAll();
}

function groupedBudget() {
  const colors = { Need: "#7c3aed", Want: "#db2777", Goal: "#16a34a", Investment: "#8b5cf6" };
  const groups = new Map();
  state.budget.forEach((item) => {
    const key = item.type;
    const current = groups.get(key) || { label: key, value: 0, color: colors[key] || item.color };
    current.value += Number(item.planned || 0);
    groups.set(key, current);
  });
  return Array.from(groups.values());
}

async function lookupStock(symbol, range, options = {}) {
  if (marketRefreshInFlight && options.silent) return;
  marketRefreshInFlight = true;
  const requestId = ++stockRequestId;
  const clean = (symbol || "AAPL").trim().toUpperCase();
  const requestedRange = range || state.selectedRange || "1Y";
  state.selectedStock = clean;
  state.selectedRange = requestedRange;
  saveState();
  if (!options.silent) renderStockShell(clean);

  try {
    const quote = await fetchMarketHistory(clean, requestedRange);
    if (requestId !== stockRequestId) return;
    if (!quote.series || !quote.series.length) throw new Error("No chart values");
    currentQuote = quote;
    currentSeries = quote.series;
    updateStock(clean, requestedRange, quote.name || clean, Number(quote.price), Number(quote.change), `${quote.source || "Market"} data refreshed just now. Prices may be delayed by the source.`);
  } catch (error) {
    if (requestId !== stockRequestId) return;
    currentQuote = null;
    currentSeries = [];
    showStockUnavailable(clean, error.message);
  } finally {
    if (requestId === stockRequestId) {
      renderInvesting();
      renderNetWorth();
      marketRefreshInFlight = false;
    }
  }
}

function renderStockShell(symbol) {
  const known = stockProfiles[symbol];
  syncRangeTabs();
  text("#stockName", known ? known.name : `${symbol} Equity`);
  text("#stockMeta", `${symbol} · loading market data`);
  text("#stockPrice", "...");
  text("#stockChange", "...");
  text("#marketSource", "Refreshing live/delayed market data...");
  stockChartPoints = drawEmptyChart("#stockChart", "Loading market data...");
  setupStockTooltip();
}

function updateStock(symbol, range, name, price, change, source) {
  syncRangeTabs();
  stockProfiles[symbol] = { name, price, change };
  state.portfolio = state.portfolio.map((item) => item.symbol === symbol ? { ...item, name, currentPrice: price } : item);
  saveState();
  text("#stockName", name);
  text("#stockMeta", `${symbol} · ${range} performance`);
  text("#stockPrice", usd2.format(price));
  const changeNode = document.querySelector("#stockChange");
  changeNode.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  changeNode.className = change >= 0 ? "positive" : "negative";
  text("#marketSource", source);
  stockChartPoints = drawLineChart("#stockChart", currentSeries, change >= 0 ? "#16a34a" : "#dc2626") || [];
  setupStockTooltip();
}

function syncRangeTabs() {
  document.querySelectorAll("#rangeTabs button").forEach((node) => {
    node.classList.toggle("active", node.dataset.range === state.selectedRange);
  });
}

function showStockUnavailable(symbol, message) {
  text("#stockName", stockProfiles[symbol] ? stockProfiles[symbol].name : `${symbol} Equity`);
  text("#stockMeta", `${symbol} · market data unavailable`);
  text("#stockPrice", "No data");
  const changeNode = document.querySelector("#stockChange");
  changeNode.textContent = "--";
  changeNode.className = "";
  text("#marketSource", `No dummy data shown. Start the Node server with outbound internet or try again. ${message || ""}`.trim());
  stockChartPoints = drawEmptyChart("#stockChart", "No live market data");
  setupStockTooltip();
}

async function fetchMarketHistory(symbol, range) {
  if (location.protocol === "http:" || location.protocol === "https:") {
    const local = await fetchJson(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&t=${Date.now()}`, 6000);
    if (local && local.series && local.series.length) return local;
  }
  throw new Error("Use the Node server, not a plain static server, for market data.");
}

async function fetchJson(url, timeoutMs) {
  const timeout = new Promise((resolve, reject) => {
    window.setTimeout(() => reject(new Error("JSON request timed out")), timeoutMs || 3200);
  });
  const request = fetch(url, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error("JSON request failed");
    return response.json();
  });
  return Promise.race([request, timeout]);
}

function renderInvesting() {
  const t = totals();
  const symbol = state.selectedStock;
  const profile = currentQuote && currentQuote.symbol === symbol
    ? { name: currentQuote.name || symbol, price: Number(currentQuote.price), change: Number(currentQuote.change || 0) }
    : null;
  const amount = Number(document.querySelector("#investAmount").value || 0);
  const scenario = Number(document.querySelector("#scenarioReturn").value || 0);
  const shares = profile && profile.price > 0 ? amount / profile.price : 0;
  const saleCash = Number(state.tradeCash || 0);
  document.querySelector(".available-cash span").textContent = saleCash > 0
    ? `Available this month, incl. ${usd.format(saleCash)} from sales`
    : "Available this month";
  text("#availableInvestCash", usd.format(t.investAvailable));
  text("#estimatedShares", profile ? shares.toFixed(4) : "--");
  text("#scenarioValue", profile ? usd.format(amount * (1 + scenario / 100)) : "--");
  text("#scenarioReturnLabel", `${scenario}%`);
  document.querySelector("#addInvestment").disabled = !profile;
  document.querySelector("#sellInvestment").disabled = !profile || !state.portfolio.some((item) => item.symbol === symbol);

  document.querySelector("#holdingList").innerHTML = state.portfolio.length
    ? state.portfolio.map((item) => {
      const value = Number(item.shares) * Number(item.currentPrice || 0);
      const gain = value - Number(item.costBasis || 0);
      return `<div class="holding-row">
        <div class="holding-title"><strong>${item.symbol}</strong><span>${item.name}</span></div>
        <div class="holding-stat"><small>Shares</small><strong>${Number(item.shares).toFixed(4)}</strong></div>
        <div class="holding-stat"><small>Value</small><strong>${usd.format(value)}</strong></div>
        <div class="holding-stat"><small>Gain</small><strong class="${gain >= 0 ? "positive" : "negative"}">${usd.format(gain)}</strong></div>
        <div class="holding-actions">
          <button class="mini-secondary" type="button" data-sell-symbol="${item.symbol}">Sell $100</button>
          <button class="mini-danger" type="button" data-remove-symbol="${item.symbol}">Remove from portfolio</button>
        </div>
      </div>`;
    }).join("")
    : `<div class="empty-state">Nethra has not added investments yet.</div>`;

  renderResearchIdeas();
}

function renderResearchIdeas() {
  document.querySelector("#beautyWatchlist").innerHTML = beautyStocks
    .map((item) => stockButton(item.symbol, item.label, item.risk))
    .join("");
  const moverNode = document.querySelector("#moverWatchlist");
  if (!moversLoaded && !moverNode.dataset.loading) {
    moverNode.dataset.loading = "true";
    moverNode.innerHTML = `<div class="empty-state">Checking last-month movers...</div>`;
    loadMonthlyMovers();
    return;
  }
}

function stockButton(symbol, label, risk) {
  return `<button data-symbol="${symbol}"><strong>${symbol}</strong><span>${label}</span><small>${risk}</small></button>`;
}

async function showStockSuggestions(query) {
  const box = document.querySelector("#stockSuggestions");
  const clean = query.trim();
  if (!clean) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const results = await searchStocks(clean);
  if (!results.length) {
    box.innerHTML = `<div class="suggestion-empty">No matches found</div>`;
    box.hidden = false;
    return;
  }
  box.innerHTML = results
    .slice(0, 6)
    .map((item) => `<button type="button" data-symbol="${item.symbol}"><strong>${item.symbol}</strong><span>${item.name}</span><small>${item.type || "Stock"}</small></button>`)
    .join("");
  box.hidden = false;
}

async function searchStocks(query) {
  try {
    const response = await fetchJson(`/api/search?q=${encodeURIComponent(query)}&t=${Date.now()}`, 3500);
    if (response.results && response.results.length) return response.results;
  } catch {
    // Fall back to bundled symbol aliases for common searches like "apple".
  }
  const lower = query.toLowerCase();
  return localSearchIndex.filter((item) => (
    item.symbol.toLowerCase().includes(lower) || item.name.toLowerCase().includes(lower)
  ));
}

function selectStockSuggestion(symbol) {
  document.querySelector("#tickerInput").value = symbol;
  document.querySelector("#stockSuggestions").hidden = true;
  lookupStock(symbol, state.selectedRange);
}

async function loadMonthlyMovers() {
  const moverNode = document.querySelector("#moverWatchlist");
  try {
    const response = await fetchJson(`/api/movers?t=${Date.now()}`, 9000);
    const top = (response.movers || [])
      .filter((item) => Number.isFinite(item.move))
      .sort((a, b) => b.move - a.move)
      .slice(0, 5)
      .map((item) => ({ symbol: item.symbol, label: item.label, risk: `${item.move >= 0 ? "+" : ""}${item.move.toFixed(1)}% last month` }));
    if (!top.length) throw new Error("No mover data");
    moverNode.innerHTML = top.map((item) => stockButton(item.symbol, item.label, item.risk)).join("");
  } catch (error) {
    moverNode.innerHTML = `<div class="empty-state">No dummy movers shown. Live mover data is unavailable right now.</div>`;
  }
  moverNode.dataset.loading = "";
  moversLoaded = true;
}

function addInvestment() {
  const symbol = state.selectedStock;
  const profile = currentQuote && currentQuote.symbol === symbol
    ? { name: currentQuote.name || symbol, price: Number(currentQuote.price) }
    : null;
  if (!profile || !profile.price) {
    alert("Market price is unavailable, so Nethra cannot invest against dummy data.");
    return;
  }
  const amount = Math.max(0, Number(document.querySelector("#investAmount").value || 0));
  const t = totals();
  if (amount <= 0 || amount > t.investAvailable) {
    alert(`Nethra has ${usd.format(t.investAvailable)} available to invest this month.`);
    return;
  }
  const shares = amount / profile.price;
  const cashUsed = Math.min(Number(state.tradeCash || 0), amount);
  const budgetUsed = amount - cashUsed;
  state.tradeCash = Math.max(0, Number(state.tradeCash || 0) - cashUsed);
  const existing = state.portfolio.find((item) => item.symbol === symbol);
  if (existing) {
    existing.shares = Number(existing.shares) + shares;
    existing.costBasis = Number(existing.costBasis || 0) + amount;
    existing.currentPrice = profile.price;
    existing.monthContribution = Number(existing.monthContribution || 0) + budgetUsed;
  } else {
    state.portfolio.push({
      symbol,
      name: profile.name,
      shares,
      costBasis: amount,
      currentPrice: profile.price,
      monthContribution: budgetUsed
    });
  }
  saveState();
  renderAll();
}

function sellSelectedInvestment() {
  const amount = Math.max(0, Number(document.querySelector("#investAmount").value || 0));
  if (amount <= 0) return;
  const symbol = state.selectedStock;
  const holding = state.portfolio.find((item) => item.symbol === symbol);
  if (!holding) {
    alert(`${symbol} is not in Nethra's portfolio yet.`);
    return;
  }
  sellHolding(symbol, amount);
}

function sellHolding(symbol, amount) {
  const index = state.portfolio.findIndex((item) => item.symbol === symbol);
  if (index === -1) return;
  const holding = state.portfolio[index];
  const price = Number(holding.currentPrice || 0);
  const value = Number(holding.shares || 0) * price;
  if (!price || !value) return;
  const sellValue = Math.min(amount, value);
  const shareReduction = sellValue / price;
  const costReduction = Number(holding.costBasis || 0) * (sellValue / value);
  holding.shares = Math.max(0, Number(holding.shares || 0) - shareReduction);
  holding.costBasis = Math.max(0, Number(holding.costBasis || 0) - costReduction);
  holding.monthContribution = Math.max(0, Number(holding.monthContribution || 0) - sellValue);
  state.tradeCash = Number(state.tradeCash || 0) + sellValue;
  if (holding.shares <= 0.00001) state.portfolio.splice(index, 1);
  saveState();
  renderAll();
}

function removeHolding(symbol) {
  const holding = state.portfolio.find((item) => item.symbol === symbol);
  if (holding) {
    state.tradeCash = Number(state.tradeCash || 0) + Number(holding.shares || 0) * Number(holding.currentPrice || 0);
  }
  state.portfolio = state.portfolio.filter((item) => item.symbol !== symbol);
  saveState();
  renderAll();
}

function renderNetWorth() {
  const t = totals();
  const gainPct = t.portfolioCost > 0 ? t.portfolioGain / t.portfolioCost : 0;
  text("#netWorthTotal", usd.format(t.netWorth));
  text("#netWorthChange", `${percent.format(gainPct)} portfolio return`);
  text("#netWorthCash", usd.format(t.cashSavings));
  text("#netWorthInvested", usd.format(t.portfolioValue));
  text("#netWorthCost", usd.format(t.portfolioCost));
  text("#netWorthGain", usd.format(t.portfolioGain));
  text("#netWorthGainPct", percent.format(gainPct));

  const parts = [
    { label: "Cash savings", value: t.cashSavings, color: "#7c3aed" },
    { label: "Invested value", value: t.portfolioValue, color: "#8b5cf6" }
  ];
  drawDonutChart("#netWorthChart", parts);
  renderLegend("#netWorthLegend", parts);

  const monthlyAdd = state.budget
    .filter((item) => item.type === "Goal" || item.type === "Investment")
    .reduce((total, item) => total + Number(item.planned || 0), 0);
  const trend = Array.from({ length: 12 }, (_, index) => ({
    label: `M${index + 1}`,
    value: t.netWorth + monthlyAdd * index + t.portfolioValue * (Math.pow(1.004, index) - 1)
  }));
  drawLineChart("#netWorthTrendChart", trend, "#7c3aed");
}

function renderLegend(selector, data) {
  document.querySelector(selector).innerHTML = data
    .map((item) => `<div class="legend-row"><span><i style="background:${item.color}"></i>${item.label}</span><strong>${usd.format(item.value)}</strong></div>`)
    .join("");
}

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setupCanvas(selector) {
  const canvas = document.querySelector(selector);
  if (!canvas || !canvas.offsetParent) return null;
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(300, Math.round(bounds.width || canvas.parentElement.clientWidth || canvas.clientWidth || 300));
  const height = Number(canvas.getAttribute("height")) || canvas.clientHeight || 240;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = "100%";
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function drawBarChart(selector, data) {
  const setup = setupCanvas(selector);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const pad = 36;
  const max = Math.max(...data.map((item) => item.value), 1);
  const gap = 18;
  const barWidth = Math.max(24, (width - pad * 2 - gap * (data.length - 1)) / data.length);
  ctx.strokeStyle = "#e5e7eb";
  for (let i = 0; i < 4; i += 1) {
    const y = pad + i * ((height - pad * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }
  data.forEach((item, index) => {
    const x = pad + index * (barWidth + gap);
    const barHeight = (item.value / max) * (height - pad * 2);
    const y = height - pad - barHeight;
    ctx.fillStyle = item.color;
    roundRect(ctx, x, y, barWidth, Math.max(4, barHeight), 10);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.fillText(item.label, x, height - 11);
  });
}

function drawDonutChart(selector, data) {
  const setup = setupCanvas(selector);
  if (!setup) return;
  const { ctx, width, height } = setup;
  const total = data.reduce((value, item) => value + Math.max(0, item.value), 0) || 1;
  const radius = Math.min(width, height) / 2 - 18;
  const cx = width / 2;
  const cy = height / 2;
  let start = -Math.PI / 2;
  data.forEach((item) => {
    const end = start + (Math.max(0, item.value) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.arc(cx, cy, radius * 0.6, end, start, true);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    start = end;
  });
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.52, 0, Math.PI * 2);
  ctx.fill();
}

function drawLineChart(selector, data, color) {
  const setup = setupCanvas(selector);
  if (!setup || !data.length) return [];
  const { ctx, width, height } = setup;
  const pad = 34;
  const values = data.map((item) => Number(item.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  ctx.strokeStyle = "#e5e7eb";
  for (let i = 0; i < 4; i += 1) {
    const y = pad + i * ((height - pad * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }
  const points = data.map((item, index) => {
    const x = pad + (index / Math.max(1, data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((item.value - min) / span) * (height - pad * 2);
    return { x, y, label: item.label, value: item.value };
  });
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(pad, height - pad);
  ctx.closePath();
  ctx.fillStyle = chartFill(color);
  ctx.fill();
  return points;
}

function drawEmptyChart(selector, message) {
  const setup = setupCanvas(selector);
  if (!setup) return [];
  const { ctx, width, height } = setup;
  ctx.strokeStyle = "#e9d5ff";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = 34 + i * ((height - 68) / 3);
    ctx.beginPath();
    ctx.moveTo(34, y);
    ctx.lineTo(width - 34, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#6b21a8";
  ctx.font = "800 15px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
  ctx.fillStyle = "#64748b";
  ctx.font = "700 12px Inter, sans-serif";
  ctx.fillText("No generated prices", width / 2, height / 2 + 22);
  ctx.textAlign = "left";
  return [];
}

function chartFill(color) {
  if (color.charAt(0) !== "#") return "rgba(124,58,237,0.1)";
  const hex = color.slice(1);
  const full = hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex;
  const value = parseInt(full, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},0.1)`;
}

function setupStockTooltip() {
  const canvas = document.querySelector("#stockChart");
  const tooltip = document.querySelector("#stockTooltip");
  if (!canvas || !tooltip || canvas.dataset.tooltipReady === "true") return;
  canvas.dataset.tooltipReady = "true";
  canvas.addEventListener("mousemove", (event) => {
    if (!stockChartPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (window.devicePixelRatio || 1) / rect.width;
    const scaleY = canvas.height / (window.devicePixelRatio || 1) / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const nearest = stockChartPoints.reduce((best, point) => (
      Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best
    ), stockChartPoints[0]);
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(rect.width - 92, Math.max(8, nearest.x / scaleX - 46))}px`;
    tooltip.style.top = `${Math.max(8, nearest.y / scaleY - 58)}px`;
    tooltip.innerHTML = `<strong>${usd2.format(nearest.value)}</strong><span>${nearest.label}</span>`;
  });
  canvas.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderAll() {
  renderOverview();
  renderIncome();
  renderBudget();
  renderInvesting();
  renderNetWorth();
}

function wireEvents() {
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", renderAll);
  window.setInterval(() => {
    if (document.querySelector("#page-investing").classList.contains("active")) {
      lookupStock(state.selectedStock, state.selectedRange, { silent: true });
    }
  }, 1000);
  document.querySelector("#resetDemo").addEventListener("click", () => {
    state = clone(defaultState);
    saveState();
    Object.entries(state.income).forEach(([key, value]) => {
      const field = document.querySelector("#incomeForm").elements[key];
      if (field) field.value = value;
    });
    lookupStock(state.selectedStock, state.selectedRange);
    route();
  });
  document.querySelector("#saveSnapshot").addEventListener("click", () => {
    saveState();
    const button = document.querySelector("#saveSnapshot");
    button.textContent = "Saved";
    setTimeout(() => { button.textContent = "Save"; }, 1200);
  });
  document.querySelector("#addCategory").addEventListener("click", () => {
    state.budget.push({ name: "New category", type: "Want", planned: 0, actual: 0, color: "#64748b" });
    saveState();
    renderAll();
  });
  document.querySelector("#copyMonth").addEventListener("click", () => {
    state.budget = state.budget.map((item) => ({ ...item, actual: 0 }));
    saveState();
    renderAll();
  });
  document.querySelector("#resetBudget").addEventListener("click", () => {
    state.budget = clone(baseBudget);
    saveState();
    renderAll();
  });
  document.querySelector("#lookupStock").addEventListener("click", () => lookupStock(document.querySelector("#tickerInput").value, state.selectedRange));
  document.querySelector("#tickerInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      document.querySelector("#stockSuggestions").hidden = true;
      lookupStock(document.querySelector("#tickerInput").value, state.selectedRange);
    }
    if (event.key === "Escape") document.querySelector("#stockSuggestions").hidden = true;
  });
  document.querySelector("#tickerInput").addEventListener("input", (event) => {
    window.clearTimeout(suggestionTimer);
    suggestionTimer = window.setTimeout(() => showStockSuggestions(event.target.value), 180);
  });
  document.querySelector("#stockSuggestions").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-symbol]");
    if (button) selectStockSuggestion(button.dataset.symbol);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-box")) {
      document.querySelector("#stockSuggestions").hidden = true;
    }
  });
  document.querySelector("#rangeTabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    document.querySelectorAll("#rangeTabs button").forEach((node) => node.classList.toggle("active", node === button));
    lookupStock(state.selectedStock, button.dataset.range);
  });
  document.querySelector("#investAmount").addEventListener("input", renderInvesting);
  document.querySelector("#scenarioReturn").addEventListener("input", renderInvesting);
  document.querySelector("#addInvestment").addEventListener("click", addInvestment);
  document.querySelector("#sellInvestment").addEventListener("click", sellSelectedInvestment);
  document.querySelector("#holdingList").addEventListener("click", (event) => {
    const sellButton = event.target.closest("button[data-sell-symbol]");
    if (sellButton) {
      sellHolding(sellButton.dataset.sellSymbol, 100);
      return;
    }
    const removeButton = event.target.closest("button[data-remove-symbol]");
    if (removeButton) removeHolding(removeButton.dataset.removeSymbol);
  });
  document.querySelector("#page-investing").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-symbol]");
    if (!button) return;
    document.querySelector("#tickerInput").value = button.dataset.symbol;
    lookupStock(button.dataset.symbol, state.selectedRange);
  });
}

wireIncome();
wireEvents();
route();
lookupStock(state.selectedStock, state.selectedRange);
