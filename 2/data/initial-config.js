/**
 * Initial Item Pool and Rates Configuration
 */
window.GACHA_CONFIG = {
  rates: {
    SSR: 1.0,
    SR: 9.0,
    R: 30.0,
    N: 60.0
  },
  pity: {
    enabled: true,
    threshold: 80
  },
  freeRolls: {
    enabled: true,
    paidThreshold: 10,
    freeReward: 1
  },
  costs: {
    single: 160,
    multi: 1600
  },
  items: [
    { id: 1, name: "Excalibur", rarity: "SSR" },
    { id: 2, name: "Aegis Shield", rarity: "SSR" },
    { id: 3, name: "Dragon Slayer", rarity: "SSR" },
    { id: 4, name: "Wind Cutter", rarity: "SR" },
    { id: 5, name: "Iron Plate", rarity: "SR" },
    { id: 6, name: "Magic Wand", rarity: "SR" },
    { id: 7, name: "Steel Sword", rarity: "R" },
    { id: 8, name: "Leather Vest", rarity: "R" },
    { id: 9, name: "Wooden Staff", rarity: "R" },
    { id: 10, name: "Novice Blade", rarity: "N" },
    { id: 11, name: "Cloth Tunic", rarity: "N" },
    { id: 12, name: "Small Potion", rarity: "N" }
  ]
};
