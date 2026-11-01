/**
 * Truffle configuration for a local Ganache chain.
 * Solidity is pinned to 0.8.20. Do not change the compiler version casually:
 * the academic contract target and the compiled ABI must stay in lockstep.
 */
module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1337",
      gas: 6721975,
      gasPrice: 20000000000
    }
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "paris"
      }
    }
  },
  mocha: {
    timeout: 20000
  }
};
