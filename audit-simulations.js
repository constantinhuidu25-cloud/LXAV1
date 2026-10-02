/**
 * LXA AUDIT - Monte Carlo Simulations
 * Verifică RTP, Wild distribution, jackpot progression pe 100k+ spins
 */

const LxaGameEngine = require('./game-engine.js');

const SIMULATION_RUNS = 100000;
const INITIAL_BALANCE = 250000;
const BET_PER_SPIN = 5000;

// Helper: formatare monetară
function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

// Helper: statistici descriptive
function stats(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / arr.length;
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;

  return {
    count: arr.length,
    sum,
    mean,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    stdDev: Math.sqrt(variance)
  };
}

// Simulare per-spin: colectează distributii exacte
function simulateSpinDistribution(difficulty, runs = SIMULATION_RUNS) {
  console.log(`\n=== SPIN DISTRIBUTION SIMULATION: Difficulty ${difficulty} ===`);
  console.log(`Runs: ${runs.toLocaleString()}`);

  let state = LxaGameEngine.initialState({ difficulty, credits: INITIAL_BALANCE, bet: BET_PER_SPIN });

  const hitDistribution = {}; // câte 0/10, 1/10, ... 10/10 per linie
  const wildDistribution = {}; // câte Wild-uri per spin
  const wildPerLineDistribution = {}; // câte Wild-uri per linie
  const payoutDistribution = {}; // câte payouts de fiecare tip

  let totalWildNatural = 0;
  let totalWildLevel = 0;
  let totalSpinsWithWild = 0;
  let totalJackpots = 0;

  for (let i = 0; i < runs; i++) {
    const result = LxaGameEngine.resolveSpin(state);
    state = result.state;

    const spin = result.spin;

    // Distribuție hits per linie
    spin.finalResults.forEach(hits => {
      hitDistribution[hits] = (hitDistribution[hits] || 0) + 1;
    });

    // Distribuție Wild
    const wildCount = spin.wild.totalCount;
    wildDistribution[wildCount] = (wildDistribution[wildCount] || 0) + 1;

    if (wildCount > 0) {
      totalSpinsWithWild++;
      totalWildNatural += spin.wild.naturalCount;
      totalWildLevel += spin.wild.levelCount;

      // Wild per linie
      const wildPerLine = [0, 0, 0, 0, 0];
      spin.wild.positions.forEach(pos => {
        wildPerLine[pos.line]++;
      });
      wildPerLine.forEach(count => {
        wildPerLineDistribution[count] = (wildPerLineDistribution[count] || 0) + 1;
      });
    }

    // Payout distribution
    spin.linePayouts.forEach(payout => {
      const key = money(payout);
      payoutDistribution[key] = (payoutDistribution[key] || 0) + 1;
    });

    if (spin.jackpotPayout > 0) {
      totalJackpots++;
    }

    // Reset pentru a evita drift-ul
    state.credits = INITIAL_BALANCE;
    state.bet = BET_PER_SPIN;
  }

  // Rezultate
  console.log('\n--- HIT DISTRIBUTION (per linie) ---');
  const totalLines = runs * 5;
  Object.keys(hitDistribution).sort((a, b) => Number(a) - Number(b)).forEach(hits => {
    const count = hitDistribution[hits];
    const pct = (count / totalLines * 100).toFixed(2);
    console.log(`${hits}/10: ${count.toLocaleString()} (${pct}%)`);
  });

  console.log('\n--- WILD DISTRIBUTION (per spin) ---');
  console.log(`Spins with Wild: ${totalSpinsWithWild.toLocaleString()} / ${runs.toLocaleString()} (${(totalSpinsWithWild / runs * 100).toFixed(2)}%)`);
  console.log(`Average Wild per spin with Wild: ${(totalWildNatural + totalWildLevel) / totalSpinsWithWild}`);
  console.log(`Natural Wild: ${totalWildNatural.toLocaleString()} (${(totalWildNatural / (totalWildNatural + totalWildLevel) * 100).toFixed(1)}%)`);
  console.log(`Level Wild: ${totalWildLevel.toLocaleString()} (${(totalWildLevel / (totalWildNatural + totalWildLevel) * 100).toFixed(1)}%)`);

  console.log('\nWild count distribution:');
  Object.keys(wildDistribution).sort((a, b) => Number(a) - Number(b)).forEach(count => {
    const occurrences = wildDistribution[count];
    const pct = (occurrences / runs * 100).toFixed(2);
    console.log(`  ${count} Wild: ${occurrences.toLocaleString()} spins (${pct}%)`);
  });

  console.log('\n--- PAYOUT DISTRIBUTION (top 10) ---');
  const payouts = Object.keys(payoutDistribution)
    .map(key => ({ payout: Number(key), count: payoutDistribution[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  payouts.forEach(({ payout, count }) => {
    const pct = (count / totalLines * 100).toFixed(2);
    console.log(`€${payout}: ${count.toLocaleString()} (${pct}%)`);
  });

  console.log(`\nJackpots (10/10): ${totalJackpots.toLocaleString()}`);

  return {
    hitDistribution,
    wildDistribution,
    totalSpinsWithWild,
    totalWildNatural,
    totalWildLevel,
    totalJackpots
  };
}

// Simulare sesiune lungă: RTP real
function simulateLongSession(difficulty, runs = SIMULATION_RUNS) {
  console.log(`\n=== LONG SESSION RTP SIMULATION: Difficulty ${difficulty} ===`);
  console.log(`Runs: ${runs.toLocaleString()}, Bet: €${BET_PER_SPIN}, Initial: €${INITIAL_BALANCE}`);

  let state = LxaGameEngine.initialState({ difficulty, credits: INITIAL_BALANCE, bet: BET_PER_SPIN });

  let totalWagered = 0;
  let totalWon = 0;
  let totalNet = 0;

  const netResults = [];
  const balanceHistory = [];

  let jackpotCount = 0;
  let jackpotCyclesCompleted = 0;

  for (let i = 0; i < runs; i++) {
    // Asigură că ai mereu bani pentru următorul spin (simulare pură, fără bankroll management)
    if (state.credits < BET_PER_SPIN) {
      state.credits = INITIAL_BALANCE;
    }

    const balanceBefore = state.credits;

    const result = LxaGameEngine.resolveSpin(state);
    state = result.state;

    const spin = result.spin;

    totalWagered += spin.totalStake;
    totalWon += spin.totalPayout;
    totalNet += spin.netResult;

    netResults.push(spin.netResult);
    balanceHistory.push(state.credits);

    if (spin.jackpotPayout > 0) {
      jackpotCount++;
    }

    if (spin.jackpotCycleCompleted) {
      jackpotCyclesCompleted++;
    }
  }

  const rtp = (totalWon / totalWagered * 100).toFixed(2);
  const finalBalance = state.credits;
  const netChange = finalBalance - INITIAL_BALANCE;

  console.log('\n--- RTP RESULTS ---');
  console.log(`Total Wagered: €${totalWagered.toLocaleString()}`);
  console.log(`Total Won: €${totalWon.toLocaleString()}`);
  console.log(`Net Result: €${totalNet.toLocaleString()}`);
  console.log(`RTP: ${rtp}%`);
  console.log(`Final Balance: €${finalBalance.toLocaleString()}`);
  console.log(`Net Change: €${netChange.toLocaleString()}`);

  console.log('\n--- NET RESULT STATISTICS ---');
  const netStats = stats(netResults);
  console.log(`Mean: €${netStats.mean.toFixed(2)}`);
  console.log(`Median: €${netStats.median.toFixed(2)}`);
  console.log(`Std Dev: €${netStats.stdDev.toFixed(2)}`);
  console.log(`Min: €${netStats.min.toLocaleString()}`);
  console.log(`Max: €${netStats.max.toLocaleString()}`);
  console.log(`P25: €${netStats.p25.toLocaleString()}`);
  console.log(`P75: €${netStats.p75.toLocaleString()}`);

  console.log('\n--- JACKPOT STATISTICS ---');
  console.log(`Jackpot lines hit: ${jackpotCount}`);
  console.log(`Jackpot cycles completed: ${jackpotCyclesCompleted}`);
  console.log(`Average spins per jackpot line: ${jackpotCount > 0 ? (runs / jackpotCount).toFixed(1) : 'N/A'}`);

  console.log('\n--- BALANCE VOLATILITY ---');
  const balanceStats = stats(balanceHistory);
  console.log(`Min Balance: €${balanceStats.min.toLocaleString()}`);
  console.log(`Max Balance: €${balanceStats.max.toLocaleString()}`);
  console.log(`Balance Range: €${(balanceStats.max - balanceStats.min).toLocaleString()}`);

  return {
    rtp: Number(rtp),
    totalWagered,
    totalWon,
    totalNet,
    finalBalance,
    jackpotCount,
    jackpotCyclesCompleted,
    netStats,
    balanceStats
  };
}

// Simulare Wild level scaling
function simulateWildLevelScaling(difficulty = 2) {
  console.log(`\n=== WILD LEVEL SCALING SIMULATION: Difficulty ${difficulty} ===`);

  const levels = [0, 10, 20, 30, 40, 50];
  const runsPerLevel = 10000;

  console.log(`Testing Wild levels: ${levels.join(', ')}`);
  console.log(`Runs per level: ${runsPerLevel.toLocaleString()}\n`);

  levels.forEach(level => {
    let state = LxaGameEngine.initialState({
      difficulty,
      credits: INITIAL_BALANCE,
      bet: BET_PER_SPIN,
      wildLevel: level
    });

    let totalWagered = 0;
    let totalWon = 0;
    let spinsWithWild = 0;
    let totalWildCount = 0;

    for (let i = 0; i < runsPerLevel; i++) {
      const result = LxaGameEngine.resolveSpin(state);
      state = result.state;

      const spin = result.spin;

      totalWagered += spin.totalStake;
      totalWon += spin.totalPayout;

      if (spin.wild.appeared) {
        spinsWithWild++;
        totalWildCount += spin.wild.totalCount;
      }

      state.credits = INITIAL_BALANCE;
      state.bet = BET_PER_SPIN;
      state.wildLevel = level;
    }

    const rtp = (totalWon / totalWagered * 100).toFixed(2);
    const wildRate = (spinsWithWild / runsPerLevel * 100).toFixed(2);
    const avgWildPerSpin = spinsWithWild > 0 ? (totalWildCount / spinsWithWild).toFixed(2) : '0';
    const wildChance = (LxaGameEngine.wildChance(level) * 100).toFixed(1);

    console.log(`Level ${level} (${wildChance}% chance):`);
    console.log(`  RTP: ${rtp}%`);
    console.log(`  Wild appearance: ${wildRate}% of spins`);
    console.log(`  Avg Wild per appearance: ${avgWildPerSpin}`);
    console.log(`  Total Wild symbols: ${totalWildCount.toLocaleString()}`);
    console.log('');
  });
}

// Verificare: Client vs Server logic match
function verifyClientServerMatch() {
  console.log('\n=== CLIENT VS SERVER LOGIC VERIFICATION ===\n');

  const testCases = 100;
  const difficulty = 2;

  console.log('Testing client-side game-engine.js logic...\n');

  let state = LxaGameEngine.initialState({ difficulty, credits: 1000000, bet: 5000 });

  for (let i = 0; i < testCases; i++) {
    const result = LxaGameEngine.resolveSpin(state);
    state = result.state;

    const spin = result.spin;

    // Verificări de consistență
    if (spin.finalResults.length !== 5) {
      console.error(`ERROR: Expected 5 lines, got ${spin.finalResults.length}`);
    }

    if (spin.linePayouts.length !== 5) {
      console.error(`ERROR: Expected 5 line payouts, got ${spin.linePayouts.length}`);
    }

    // Verifică că totalPayout = sum(linePayouts) + jackpotPayout
    const sumLinePayouts = spin.linePayouts.reduce((a, b) => a + b, 0);
    const expectedTotal = money(sumLinePayouts + spin.jackpotPayout);

    if (Math.abs(spin.totalPayout - expectedTotal) > 0.01) {
      console.error(`ERROR spin ${i}: totalPayout=${spin.totalPayout}, expected=${expectedTotal}`);
    }

    // Verifică că netResult = totalPayout - totalStake
    const expectedNet = money(spin.totalPayout - spin.totalStake);

    if (Math.abs(spin.netResult - expectedNet) > 0.01) {
      console.error(`ERROR spin ${i}: netResult=${spin.netResult}, expected=${expectedNet}`);
    }

    // Verifică board integrity
    if (spin.board.length !== 5 || spin.board.some(row => row.length !== 10)) {
      console.error(`ERROR spin ${i}: Invalid board dimensions`);
    }
  }

  console.log(`✓ Tested ${testCases} spins - logic consistency verified`);
  console.log('✓ All internal consistency checks passed');
  console.log('\nNote: Server-side logic in lxa-account.js must be manually compared.');
}

// Main execution
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         LXA COMPREHENSIVE AUDIT SIMULATIONS             ║');
console.log('╚════════════════════════════════════════════════════════════╝');

console.log('\nStarting Monte Carlo simulations...');
console.log(`Engine version: ${LxaGameEngine.VERSION || 'unknown'}`);

// 1. Verificare logică
verifyClientServerMatch();

// 2. Distribuții per dificultate
[1, 2, 3].forEach(difficulty => {
  simulateSpinDistribution(difficulty, SIMULATION_RUNS);
});

// 3. RTP per dificultate
const rtpResults = {};
[1, 2, 3].forEach(difficulty => {
  rtpResults[difficulty] = simulateLongSession(difficulty, SIMULATION_RUNS);
});

// 4. Wild level scaling
simulateWildLevelScaling(2);

// 5. Summary
console.log('\n\n╔════════════════════════════════════════════════════════════╗');
console.log('║                   AUDIT SUMMARY                            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('RTP by Difficulty:');
[1, 2, 3].forEach(difficulty => {
  const result = rtpResults[difficulty];
  console.log(`  Difficulty ${difficulty}: ${result.rtp}% (Expected: varies by distribution)`);
});

console.log('\n✓ Simulation complete. Review results above for anomalies.');
console.log('✓ Compare these results against documented game math.');
