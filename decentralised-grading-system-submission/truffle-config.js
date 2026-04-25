/**
 * Truffle Configuration — Decentralised Grading System
 *
 * Networks defined here:
 *   development  — local Ganache instance (used by default)
 *   ropsten      — Ethereum testnet (requires Infura + mnemonic — see instructions below)
 *
 * To deploy:
 *   Local:   truffle migrate --network development
 *   Ropsten: truffle migrate --network ropsten
 *
 * For Ropsten you need:
 *   1. An Infura project ID (free at https://infura.io)
 *   2. A 12-word mnemonic stored in a file called .secret (add .secret to .gitignore!)
 *   3. npm install truffle-hdwallet-provider
 */

// Uncomment for testnet / mainnet deployments:
// const HDWalletProvider = require('truffle-hdwallet-provider');
// const fs = require('fs');
// const mnemonic = fs.readFileSync('.secret').toString().trim();

module.exports = {

  networks: {

    // -----------------------------------------------------------------------
    // Local development — connect to Ganache
    // Start Ganache before running: truffle migrate
    // -----------------------------------------------------------------------
    development: {
      host:       "127.0.0.1",
      port:       7545,        // Default Ganache GUI port. Change to 8545 for ganache-cli.
      network_id: "*",         // Match any network ID
      gas:        6000000,     // Raise gas limit to accommodate complex contract
      gasPrice:   20000000000  // 20 gwei
    },

    // -----------------------------------------------------------------------
    // Ropsten testnet — uncomment and fill in your Infura key to use
    // -----------------------------------------------------------------------
    // ropsten: {
    //   provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/YOUR_INFURA_KEY`),
    //   network_id: 3,
    //   gas:          5500000,
    //   confirmations: 2,
    //   timeoutBlocks: 200,
    //   skipDryRun:    true
    // },

  },

  // Mocha test framework options
  mocha: {
    timeout: 100000,
    reporter: "spec"
  },

  // Solidity compiler settings
  compilers: {
    solc: {
      version: "0.5.0",   // Matches pragma in Grader.sol
      settings: {
        optimizer: {
          enabled: true,
          runs: 200         // Optimise for ~200 calls per function lifetime
        }
      }
    }
  }

};
