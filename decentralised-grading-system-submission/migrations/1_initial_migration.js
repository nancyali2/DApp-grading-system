// Migration 1: Deploy the Truffle Migrations tracking contract.
// This is always the first migration — it records which migrations have run on-chain.

const Migrations = artifacts.require("Migrations");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
