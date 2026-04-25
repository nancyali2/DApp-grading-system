// Migration 2: Deploy the Grader smart contract.
// Run: truffle migrate --reset
// Make sure Ganache is running and truffle-config.js points to the correct port.

const Grader = artifacts.require("Grader");

module.exports = function(deployer, network, accounts) {
  console.log("Deploying Grader contract...");
  console.log("Network        :", network);
  console.log("Deployer (Admin):", accounts[0]);

  deployer.deploy(Grader, { from: accounts[0] }).then(() => {
    console.log("Grader deployed successfully.");
    console.log("Contract address will be recorded in build/contracts/Grader.json");
  });
};
