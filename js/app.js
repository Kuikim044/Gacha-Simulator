/**
 * GachaOps Orchestration Engine v1.2 - Final Polish Edition
 */

document.addEventListener("DOMContentLoaded", () => {
  const state = {
    config: JSON.parse(JSON.stringify(window.GACHA_CONFIG)),
    simulator: new GachaSimulator(window.GACHA_CONFIG),
    lastPulls: [],
    lastMC: null,
    pullHistory: [],
    mcHistory: []
  };

  // --- Element Selection ---
  const el = {
    rateSettings: document.getElementById("rate-settings"),
    pityToggle: document.getElementById("pity-toggle"),
    pityThreshold: document.getElementById("pity-threshold"),
    pitySsrRate: document.getElementById("pity-ssr-rate"),
    pricePerPull: document.getElementById("price-per-pull"),
    freeRollToggle: document.getElementById("free-roll-toggle"),
    freeInterval: document.getElementById("free-interval"),
    newItemName: document.getElementById("new-item-name"),
    newItemRarity: document.getElementById("new-item-rarity"),
    addItemBtn: document.getElementById("add-item-btn"),
    itemPoolBody: document.getElementById("item-pool-body"),
    validationIndicator: document.getElementById("validation-indicator"),
    
    // Sim
    customPullCount: document.getElementById("custom-pull-count"),
    runCustomSim: document.getElementById("run-custom-sim"),
    pullSummaryStats: document.getElementById("pull-summary-stats"),
    rarityChart: document.getElementById("rarity-chart"),
    rarityAnalyticsBody: document.getElementById("rarity-analytics-body"),
    itemResultsBody: document.getElementById("item-results-body"),
    pullLogConsole: document.getElementById("pull-log-console"),

    // MC
    mcBudget: document.getElementById("mc-budget"),
    mcPrice: document.getElementById("mc-price"),
    mcTrials: document.getElementById("mc-trials"),
    runMcEngine: document.getElementById("run-mc-engine"),
    mcStatsTable: document.getElementById("mc-stats-table"),
    aiInsightContent: document.getElementById("ai-insight-content"),

    // History
    pullHistoryList: document.getElementById("pull-history-list"),
    mcHistoryList: document.getElementById("mc-history-list")
  };

  // --- Initialization ---
  function init() {
    if (state.config.pity.ssrRate === undefined) state.config.pity.ssrRate = 100;
    renderSettings();
    renderItemPool();
    validateConfig();
    setupEventListeners();
  }

  function setupEventListeners() {
    el.pityToggle.addEventListener("change", (e) => { state.config.pity.enabled = e.target.checked; validateConfig(); });
    el.pityThreshold.addEventListener("change", (e) => { state.config.pity.threshold = parseInt(e.target.value) || 80; validateConfig(); });
    el.pitySsrRate.addEventListener("change", (e) => { state.config.pity.ssrRate = parseFloat(e.target.value) || 100; validateConfig(); });
    el.pricePerPull.addEventListener("change", (e) => { state.config.costs.single = parseInt(e.target.value) || 160; validateConfig(); });
    el.freeRollToggle.addEventListener("change", (e) => { state.config.freeRolls.enabled = e.target.checked; validateConfig(); });
    el.freeInterval.addEventListener("change", (e) => { state.config.freeRolls.paidThreshold = parseInt(e.target.value) || 10; validateConfig(); });

    el.addItemBtn.addEventListener("click", () => {
      const name = el.newItemName.value.trim();
      const rarity = el.newItemRarity.value;
      if (!name) return alert("กรุณาระบุชื่อไอเทม");
      state.config.items.push({ id: Date.now(), name, rarity });
      el.newItemName.value = "";
      renderItemPool();
      validateConfig();
    });

    document.querySelectorAll(".quick-pull-btn").forEach(btn => {
      btn.addEventListener("click", () => runSimulation(parseInt(btn.dataset.count)));
    });
    el.runCustomSim.addEventListener("click", () => runSimulation(parseInt(el.customPullCount.value)));
    el.runMcEngine.addEventListener("click", runMonteCarloAnalysis);

    document.getElementById("reset-all-btn").addEventListener("click", () => {
      if(confirm("รีเซ็ตการตั้งค่าและประวัติทั้งหมดหรือไม่?")) location.reload();
    });

    document.getElementById("export-pull-csv").addEventListener("click", exportPullCSV);
    document.getElementById("export-mc-csv").addEventListener("click", exportMCCSV);
  }

  function validateConfig() {
    const totalRate = Object.values(state.config.rates).reduce((a, b) => a + b, 0);
    const raritiesInPool = new Set(state.config.items.map(i => i.rarity));
    const activeRarities = Object.entries(state.config.rates).filter(([r, rate]) => rate > 0).map(([r]) => r);
    const poolsValid = activeRarities.every(r => raritiesInPool.has(r));
    const rateValid = Math.abs(totalRate - 100) < 0.01;
    const isValid = rateValid && poolsValid;
    el.validationIndicator.className = `status-pill ${isValid ? 'valid' : 'invalid'}`;
    el.validationIndicator.textContent = isValid ? "✅ ตั้งค่าถูกต้อง" : (rateValid ? "❌ มีบางระดับไม่มีไอเทม" : "❌ เรตรวมต้องได้ 100%");
    state.simulator.updateConfig(state.config);
    updatePoolCounts();
    return isValid;
  }

  function renderSettings() {
    el.rateSettings.innerHTML = Object.entries(state.config.rates).map(([r, val]) => `
      <div class="input-group">
        <label>เรตดรอป ${r} (%)</label>
        <input type="number" step="0.1" min="0" value="${val}" data-rarity="${r}" class="rate-field">
      </div>
    `).join("");

    document.querySelectorAll(".rate-field").forEach(input => {
      input.addEventListener("change", (e) => {
        // Prevent negative values and sync UI
        const val = Math.max(0, parseFloat(e.target.value) || 0);
        state.config.rates[e.target.dataset.rarity] = val;
        e.target.value = val; 
        validateConfig();
      });
    });
  }

  function renderItemPool() {
    el.itemPoolBody.innerHTML = state.config.items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td><span class="rarity-${item.rarity}">${item.rarity}</span></td>
        <td>
          <button class="ghost-btn edit-item" data-id="${item.id}" style="margin:0; padding:4px 8px; color: var(--accent); border-color: var(--accent);">แก้ไข</button>
          <button class="ghost-btn del-item" data-id="${item.id}" style="margin:0; padding:4px 8px;">ลบ</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".edit-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = state.config.items.find(i => i.id == id);
        if (!item) return;

        const newName = prompt("แก้ไขชื่อไอเทม:", item.name);
        if (newName === null) return; // Cancel

        const newRarity = prompt("แก้ไขระดับ (SSR/SR/R/N):", item.rarity).toUpperCase();
        if (newName.trim() && ["SSR", "SR", "R", "N"].includes(newRarity)) {
          item.name = newName.trim();
          item.rarity = newRarity;
          renderItemPool();
          validateConfig();
        } else if (newName.trim()) {
          alert("ระดับความหายากไม่ถูกต้อง (ต้องเป็น SSR, SR, R หรือ N)");
        }
      });
    });

    document.querySelectorAll(".del-item").forEach(btn => {
      btn.addEventListener("click", () => {
        state.config.items = state.config.items.filter(i => i.id != btn.dataset.id);
        renderItemPool();
        validateConfig();
      });
    });
  }

  function updatePoolCounts() {
    const counts = state.config.items.reduce((acc, i) => { acc[i.rarity]++; return acc; }, { SSR:0, SR:0, R:0, N:0 });
    Object.entries(counts).forEach(([r, count]) => {
      const pCount = document.getElementById(`pool-count-${r.toLowerCase()}`);
      if (pCount) pCount.textContent = `${r}: ${count}`;
    });
  }

  function runSimulation(count) {
    if (!validateConfig()) return alert("การตั้งค่าไม่ถูกต้อง กรุณาตรวจสอบเรตและคลังไอเทม");
    const results = state.simulator.simulateBatch(count);
    state.lastPulls = results;
    renderSimulationAnalytics(results);
    renderPullLog(results);
    const counts = results.reduce((acc, r) => { acc[r.rarity]++; return acc; }, { SSR:0, SR:0, R:0, N:0 });
    const itemsMap = results.reduce((acc, r) => { acc[r.name] = (acc[r.name]||0)+1; return acc; }, {});
    const topItem = Object.entries(itemsMap).sort((a,b)=>b[1]-a[1])[0] || ["-", 0];
    state.pullHistory.unshift({
      time: new Date().toLocaleTimeString(),
      count: results.length,
      rates: {
        SSR: (counts.SSR / results.length * 100).toFixed(1),
        SR: (counts.SR / results.length * 100).toFixed(1),
        R: (counts.R / results.length * 100).toFixed(1),
        N: (counts.N / results.length * 100).toFixed(1)
      },
      topItem: topItem[0],
      pityStatus: state.config.pity.enabled ? "เปิด" : "ปิด"
    });
    if (state.pullHistory.length > 10) state.pullHistory.pop();
    renderHistory();
  }

  function renderSimulationAnalytics(results) {
    const counts = results.reduce((acc, r) => { acc[r.rarity]++; return acc; }, { SSR:0, SR:0, R:0, N:0 });
    const total = results.length;
    el.pullSummaryStats.innerHTML = `
      <div class="summary-card"><span>🎫 จำนวนสุ่มทั้งหมด</span><strong>${total.toLocaleString()}</strong></div>
      <div class="summary-card"><span>💰 จ่ายไปทั้งหมด</span><strong>${(results.filter(r=>r.isPaid).length * state.config.costs.single).toLocaleString()}</strong></div>
      <div class="summary-card"><span>🟡 ได้ SSR</span><strong class="rarity-SSR">${counts.SSR}</strong></div>
      <div class="summary-card"><span>🟣 ได้ SR</span><strong class="rarity-SR">${counts.SR}</strong></div>
    `;
    el.rarityChart.innerHTML = Object.entries(counts).map(([r, c]) => {
      const pct = total > 0 ? (c / total * 100).toFixed(1) : 0;
      const emoji = r === 'SSR' ? '🟡' : r === 'SR' ? '🟣' : r === 'R' ? '🔵' : '⚪';
      return `
        <div class="rarity-tube-container">
          <div class="rarity-tube-info"><span>${emoji} ${r}</span><strong>${c} ชิ้น (${pct}%)</strong></div>
          <div class="rarity-tube-bg"><div class="rarity-tube-fill rarity-${r}" style="width: ${pct}%;"></div></div>
        </div>
      `;
    }).join("");
    el.rarityAnalyticsBody.innerHTML = Object.entries(counts).map(([r, c]) => {
      const target = state.config.rates[r];
      const actual = (c / total * 100);
      const diff = actual - target;
      return `<tr><td><span class="rarity-${r}">${r}</span></td><td>${target.toFixed(1)}%</td><td>${c}</td><td>${actual.toFixed(2)}%</td><td style="color: ${diff >= 0 ? 'var(--success)' : 'var(--danger)'}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%</td></tr>`;
    }).join("");
    const itemsMap = results.reduce((acc, r) => {
      acc[r.name] = acc[r.name] || { rarity: r.rarity, count: 0 };
      acc[r.name].count++;
      return acc;
    }, {});
    el.itemResultsBody.innerHTML = Object.entries(itemsMap).sort((a, b) => b[1].count - a[1].count).map(([name, data]) => `<tr><td>${name}</td><td><span class="rarity-${data.rarity}">${data.rarity}</span></td><td>${data.count}</td><td>${(data.count / total * 100).toFixed(2)}%</td></tr>`).join("");
  }

  function renderPullLog(results) {
    const slice = results.slice(-50).reverse();
    el.pullLogConsole.innerHTML = slice.map(r => `<div class="log-entry">> ${r.isPaid ? '[จ่าย]' : '[ฟรี]'} <span class="rarity-${r.rarity}">${r.rarity.padEnd(3)}</span> | ${r.name.padEnd(20)} | Pity: ${String(r.pityAt).padStart(2)}</div>`).join("");
  }

  function runMonteCarloAnalysis() {
    if (!validateConfig()) return;
    const budget = parseInt(el.mcBudget.value) || 0;
    const price = parseInt(el.mcPrice.value) || 160;
    const trials = parseInt(el.mcTrials.value) || 1000;
    const res = state.simulator.runMonteCarlo(budget, price, trials);
    state.lastMC = res;
    renderMCResults(res);
    generateAIInsight(res);
    state.mcHistory.unshift({
      time: new Date().toLocaleTimeString(),
      trials: trials,
      prob: res.prob.atLeastOneSSR.toFixed(1),
      avgSSR: res.avg.SSR.toFixed(2),
      avgSR: res.avg.SR.toFixed(2),
      avgR: res.avg.R.toFixed(2),
      avgN: res.avg.N.toFixed(2),
      best: res.bounds.bestSSR,
      worst: res.bounds.worstSSR
    });
    if (state.mcHistory.length > 10) state.mcHistory.pop();
    renderHistory();
  }

  function renderMCResults(res) {
    const totalAvg = res.avg.Total;
    const getPct = (val) => totalAvg > 0 ? `(${((val / totalAvg) * 100).toFixed(2)}%)` : "(0%)";
    const rows = [
      ["💵 งบประมาณ", res.meta.budget.toLocaleString()],
      ["🏷️ ราคาต่อโรล", res.meta.price.toLocaleString()],
      ["💳 สุ่มแบบจ่ายเงิน", res.meta.paidPulls + " ครั้ง"],
      ["🎁 สุ่มฟรีเฉลี่ย", res.meta.freePulls.toFixed(1) + " ครั้ง"],
      ["🔄 สุ่มรวมเฉลี่ย", totalAvg.toFixed(1) + " ครั้ง"],
      ["🔁 จำนวนรอบที่จำลอง", res.meta.trials.toLocaleString() + " รอบ"],
      ["💎 โอกาสได้ SSR ≥ 1", `<span class="rarity-SSR">${res.prob.atLeastOneSSR.toFixed(2)}%</span>`],
      ["🧂 โอกาสไม่ได้ SSR เลย", `<span class="rarity-N">${res.prob.zeroSSR.toFixed(2)}%</span>`],
      ["🟡 SSR เฉลี่ย", `<span class="rarity-SSR">${res.avg.SSR.toFixed(2)} ชิ้น ${getPct(res.avg.SSR)}</span>`],
      ["🟣 SR เฉลี่ย", `<span class="rarity-SR">${res.avg.SR.toFixed(2)} ชิ้น ${getPct(res.avg.SR)}</span>`],
      ["🔵 R เฉลี่ย", `<span class="rarity-R">${res.avg.R.toFixed(2)} ชิ้น ${getPct(res.avg.R)}</span>`],
      ["⚪ N เฉลี่ย", `<span class="rarity-N">${res.avg.N.toFixed(2)} ชิ้น ${getPct(res.avg.N)}</span>`],
      ["🏆 ผลลัพธ์ SSR ดีที่สุด", res.bounds.bestSSR],
      ["💀 ผลลัพธ์ SSR แย่ที่สุด", res.bounds.worstSSR]
    ];
    el.mcStatsTable.innerHTML = `<table class="data-table"><tbody>${rows.map(([label, val]) => `<tr><td>${label}</td><td style="text-align:right; font-weight:bold;">${val}</td></tr>`).join("")}</tbody></table>`;
  }

  function generateAIInsight(res) {
    const failRate = res.prob.zeroSSR;
    const warning = failRate > 20 ? `⚠️ คำเตือน: ยังมีโอกาสถึง ${failRate.toFixed(1)}% ที่ผู้เล่นจะใช้งบทั้งหมดโดยไม่ได้ SSR เลยแม้แต่ตัวเดียว` : `✅ ความน่าเชื่อถือ: จากการจำลอง ผู้เล่นมีโอกาสสูงมาก (${res.prob.atLeastOneSSR.toFixed(1)}%) ที่จะได้ SSR อย่างน้อยหนึ่งตัว`;
    const recommendation = failRate > 10 ? "💡 ข้อเสนอแนะ: ควรพิจารณาลดจำนวนการันตี (Pity) หรือเพิ่มเรต SSR พื้นฐานเพื่อลดกรณีที่ผู้เล่นโชคร้ายเกินไป" : "💡 ข้อเสนอแนะ: การปรับสมดุลปัจจุบันดูเหมาะสมกับงบประมาณเป้าหมายแล้ว";
    el.aiInsightContent.innerHTML = `ด้วยงบประมาณ <strong>${res.meta.budget.toLocaleString()}</strong> และราคาต่อโรล <strong>${res.meta.price.toLocaleString()}</strong> ผู้เล่นจะสามารถสุ่มได้ประมาณ <strong>${res.avg.Total.toFixed(0)}</strong> ครั้ง (รวมโรลฟรี)<br><br>จากการจำลอง <strong>${res.meta.trials.toLocaleString()}</strong> รอบ ที่เรต SSR <strong>${state.config.rates.SSR}%</strong> พบว่าโอกาสที่จะได้ SSR อย่างน้อยหนึ่งตัวคือประมาณ <strong>${res.prob.atLeastOneSSR.toFixed(1)}%</strong><br><br>${warning}<br><br>${recommendation}`;
  }

  function renderHistory() {
    el.pullHistoryList.innerHTML = state.pullHistory.map((h, i) => `<div class="history-card" style="flex-direction: column; align-items: stretch; gap: 10px;"><div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--divider); padding-bottom: 8px;"><strong>🕒 ครั้งที่ ${state.pullHistory.length - i}</strong><span style="color:var(--text-muted); font-size:0.8rem;">${h.time}</span></div><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.85rem;"><div>🎫 สุ่ม: <strong>${h.count} ครั้ง</strong></div><div>🛡️ Pity: <strong>${h.pityStatus}</strong></div><div style="grid-column: span 2;">🏆 Top Item: <strong class="rarity-SSR">${h.topItem}</strong></div></div><div style="display: flex; gap: 8px; margin-top: 5px; flex-wrap: wrap;"><span class="rarity-SSR" style="font-size: 0.75rem;">🟡 ${h.rates.SSR}%</span><span class="rarity-SR" style="font-size: 0.75rem;">🟣 ${h.rates.SR}%</span><span class="rarity-R" style="font-size: 0.75rem;">🔵 ${h.rates.R}%</span><span class="rarity-N" style="font-size: 0.75rem;">⚪ ${h.rates.N}%</span></div></div>`).join("");
    el.mcHistoryList.innerHTML = state.mcHistory.map((h, i) => {
      const maxVal = Math.max(h.avgSSR, h.avgSR, h.avgR, h.avgN, 1);
      return `<div class="history-card" style="flex-direction: column; align-items: stretch; gap: 12px;"><div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--divider); padding-bottom: 8px;"><strong>🧪 วิเคราะห์ที่ ${state.mcHistory.length - i}</strong><span style="color:var(--text-muted); font-size:0.8rem;">${h.time}</span></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;"><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 0.8rem;"><div>🔁 รอบ: <strong>${h.trials}</strong></div><div>🟡 SSR: <strong class="rarity-SSR">${h.avgSSR}</strong></div><div>🏆 ดีสุด: <strong>${h.best}</strong></div><div>💀 แย่สุด: <strong>${h.worst}</strong></div></div><div style="height: 60px; display: flex; align-items: flex-end; gap: 4px; padding-top: 10px;"><div class="history-bar rarity-SSR" style="height: ${h.avgSSR/maxVal*100}%; flex:1; background:var(--ssr); position:relative; box-shadow: 0 0 10px rgba(242, 201, 76, 0.3);" title="SSR: ${h.avgSSR}"></div><div class="history-bar rarity-SR" style="height: ${h.avgSR/maxVal*100}%; flex:1; background:var(--sr); position:relative;" title="SR: ${h.avgSR}"></div><div class="history-bar rarity-R" style="height: ${h.avgR/maxVal*100}%; flex:1; background:var(--r); position:relative;" title="R: ${h.avgR}"></div><div class="history-bar rarity-N" style="height: ${h.avgN/maxVal*100}%; flex:1; background:var(--n); position:relative;" title="N: ${h.avgN}"></div></div></div><div style="margin-top: 5px;"><div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;"><span>💎 โอกาสได้ SSR ≥ 1 ตัว</span><strong class="rarity-SSR">${h.prob}%</strong></div><div style="height: 8px; background: var(--bg-dark); border-radius: 4px; overflow: hidden; border: 1px solid var(--panel-border);"><div style="width: ${h.prob}%; height: 100%; background: linear-gradient(90deg, var(--ssr), var(--sr));"></div></div></div></div>`;
    }).join("");
  }

  function exportPullCSV() {
    if (!state.lastPulls.length) return alert("รันการสุ่มก่อนทำการ Export");
    const results = state.lastPulls;
    const counts = results.reduce((acc, r) => { acc[r.rarity]++; return acc; }, { SSR:0, SR:0, R:0, N:0 });
    const total = results.length;
    let csv = "\ufeffครั้งที่,ระดับ,ชื่อไอเทม,ราคาต่อครั้ง,เวลา,จำนวนสุ่มทั้งหมด,SSR %,SR %,R %,N %\n";
    results.forEach((p, index) => {
      csv += `${index + 1},${p.rarity},"${p.name}",${p.isPaid ? state.config.costs.single : 0},${new Date().toISOString()},${total},${(counts.SSR/total*100).toFixed(2)},${(counts.SR/total*100).toFixed(2)},${(counts.R/total*100).toFixed(2)},${(counts.N/total*100).toFixed(2)}\n`;
    });
    downloadFile("gacha_pull_results.csv", csv);
  }

  function exportMCCSV() {
    if (!state.lastMC) return alert("รัน Monte Carlo ก่อนทำการ Export");
    const m = state.lastMC;
    const meta = m.meta;
    let csv = "\ufeffพารามิเตอร์การจำลอง\n";
    csv += `เวลา,${new Date().toISOString()}\nงบประมาณ (บาท),${meta.budget}\nราคาต่อครั้ง (บาท),${meta.price}\nสุ่มที่จ่าย,${meta.paidPulls}\nFree Rolls,${meta.freePulls.toFixed(2)}\nรวมทั้งหมด,${m.avg.Total.toFixed(2)}\nจำนวนการจำลอง,${meta.trials}\nอัตรา SSR (%),${meta.rates.SSR}\nอัตรา SR (%),${meta.rates.SR}\nอัตรา R (%),${meta.rates.R}\nอัตรา N (%),${meta.rates.N}\nPity System,${meta.pity.enabled ? 'เปิด' : 'ปิด'} (Threshold: ${meta.pity.threshold})\nFree Roll Bonus,${meta.freeRolls.enabled ? 'เปิด' : 'ปิด'}\n\nผลลัพธ์\nโอกาสได้ SSR อย่างน้อย 1 ชิ้น (%),${m.prob.atLeastOneSSR.toFixed(2)}\nโอกาสไม่ได้ SSR เลย (%),${m.prob.zeroSSR.toFixed(2)}\nSSR เฉลี่ย,${m.avg.SSR.toFixed(4)}\nSR เฉลี่ย,${m.avg.SR.toFixed(4)}\nR เฉลี่ย,${m.avg.R.toFixed(4)}\nN เฉลี่ย,${m.avg.N.toFixed(4)}\nผลดีที่สุด (SSR),${m.bounds.bestSSR}\nผลแย่ที่สุด (SSR),${m.bounds.worstSSR}\n\nการกระจาย SSR\nจำนวน SSR,จำนวนการจำลอง,เปอร์เซ็นต์ (%)\n`;
    const keys = Object.keys(m.distribution).map(Number).sort((a, b) => a - b);
    keys.forEach(k => {
      const count = m.distribution[k];
      const pct = (count / meta.trials * 100).toFixed(2);
      csv += `${k},${count},${pct}\n`;
    });
    downloadFile("gacha_mc_analysis.csv", csv);
  }

  function downloadFile(name, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }

  init();
});
