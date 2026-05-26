/**
 * Core Gacha Simulation Logic v1.1
 */

class GachaSimulator {
  constructor(config) {
    this.updateConfig(config);
    this.pityCounter = 0;
  }

  updateConfig(config) {
    this.rates = { ...config.rates };
    this.items = [...config.items];
    this.pityConfig = { ...config.pity };
    this.freeRollsConfig = { ...config.freeRolls };
    this.costs = { ...config.costs };
  }

  resetPity() {
    this.pityCounter = 0;
  }

  pull(isPaid = true) {
    let rarity;
    this.pityCounter++;

    // Advanced Pity Logic
    if (this.pityConfig.enabled && this.pityCounter >= this.pityConfig.threshold) {
      // Check pity rate probability
      const pityRoll = Math.random() * 100;
      if (pityRoll < this.pityConfig.ssrRate) {
        rarity = "SSR";
        this.resetPity();
      } else {
        rarity = this.sampleRarity();
        if (rarity === "SSR") this.resetPity();
      }
    } else {
      rarity = this.sampleRarity();
      if (rarity === "SSR") this.resetPity();
    }

    const itemPool = this.items.filter(item => item.rarity === rarity);
    if (itemPool.length === 0) {
      // Fallback if no items in rarity pool
      return { id: 0, name: `Fallback ${rarity}`, rarity, pityAt: this.pityCounter, isPaid };
    }
    
    const item = itemPool[Math.floor(Math.random() * itemPool.length)];

    return {
      ...item,
      pityAt: this.pityCounter,
      isPaid
    };
  }

  sampleRarity() {
    const roll = Math.random() * 100;
    let cumulative = 0;
    const order = ["SSR", "SR", "R", "N"];
    for (const r of order) {
      cumulative += this.rates[r];
      if (roll < cumulative) return r;
    }
    return "N";
  }

  simulateBatch(count) {
    const results = [];
    let paidInBatch = 0;

    for (let i = 0; i < count; i++) {
      const res = this.pull(true);
      results.push(res);
      paidInBatch++;

      if (this.freeRollsConfig.enabled && this.freeRollsConfig.paidThreshold > 0 && paidInBatch >= this.freeRollsConfig.paidThreshold) {
        for (let j = 0; j < (this.freeRollsConfig.freeReward || 1); j++) {
          results.push(this.pull(false));
        }
        paidInBatch = 0;
      }
    }
    return results;
  }

  runMonteCarlo(budget, costPerPull, trials) {
    const paidRollsPerTrial = Math.floor(budget / costPerPull);
    let totalCounts = { SSR: 0, SR: 0, R: 0, N: 0 };
    let trialsWithSSR = 0;
    let bestSSR = 0;
    let worstSSR = Infinity;
    let totalRollsWithFree = 0;
    const distribution = {}; // Track SSR count frequency

    for (let t = 0; t < trials; t++) {
      this.resetPity();
      const results = this.simulateBatch(paidRollsPerTrial);
      const counts = results.reduce((acc, r) => {
        acc[r.rarity]++;
        return acc;
      }, { SSR: 0, SR: 0, R: 0, N: 0 });

      Object.keys(totalCounts).forEach(k => totalCounts[k] += counts[k]);
      totalRollsWithFree += results.length;
      
      const ssrCount = counts.SSR;
      distribution[ssrCount] = (distribution[ssrCount] || 0) + 1;

      if (ssrCount > 0) trialsWithSSR++;
      if (ssrCount > bestSSR) bestSSR = ssrCount;
      if (ssrCount < worstSSR) worstSSR = ssrCount;
    }

    const avgSSR = totalCounts.SSR / trials;
    const avgRolls = totalRollsWithFree / trials;

    return {
      avg: {
        SSR: avgSSR,
        SR: totalCounts.SR / trials,
        R: totalCounts.R / trials,
        N: totalCounts.N / trials,
        Total: avgRolls
      },
      prob: {
        atLeastOneSSR: (trialsWithSSR / trials) * 100,
        zeroSSR: ((trials - trialsWithSSR) / trials) * 100
      },
      bounds: {
        bestSSR,
        worstSSR: worstSSR === Infinity ? 0 : worstSSR
      },
      meta: {
        budget,
        price: costPerPull,
        paidPulls: paidRollsPerTrial,
        freePulls: avgRolls - paidRollsPerTrial,
        trials,
        rates: { ...this.rates },
        pity: { ...this.pityConfig },
        freeRolls: { ...this.freeRollsConfig }
      },
      distribution
    };
  }
}

window.GachaSimulator = GachaSimulator;
