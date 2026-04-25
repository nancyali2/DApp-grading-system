/**
 * check_network.js — Verify your Ethereum network connection
 *
 * Run before deploying to confirm Ganache is reachable and accounts are funded.
 *
 * Usage:
 *   truffle exec scripts/check_network.js
 */

module.exports = async function(callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const netId    = await web3.eth.net.getId();
    const block    = await web3.eth.getBlockNumber();

    console.log("\n=== Ethereum Network Status ===");
    console.log("Network ID      :", netId);
    console.log("Latest Block    :", block);
    console.log("Accounts found  :", accounts.length);

    const toEth = (wei) => {
      const w = typeof wei === 'bigint' ? wei : BigInt(wei);
      return (Number(w) / 1e18).toFixed(4);
    };

    console.log("\nAccount Balances:");
    for (let i = 0; i < Math.min(accounts.length, 6); i++) {
      const bal = await web3.eth.getBalance(accounts[i]);
      console.log(`  [${i}] ${accounts[i]}  ${toEth(bal)} ETH`);
    }

    const roles = ["Admin (contract deployer)", "Instructor", "Teaching Assistant",
                   "Student 1", "Student 2", "Student 3"];
    console.log("\nRole Assignment for Demo:");
    roles.forEach((r, i) => console.log(`  accounts[${i}] → ${r}`));
    console.log("\n✓ Network check complete. Ready to deploy.\n");
  } catch(err) {
    console.error("✗ Network check failed:", err.message);
    console.error("  Is Ganache running on the port in truffle-config.js?");
  }
  callback();
};
