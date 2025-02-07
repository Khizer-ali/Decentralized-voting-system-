module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // Localhost for Ganache
      port: 7545,        // Default Ganache port
      network_id: "5777",   // Match any network id
    },
  },

  // Configure Solidity compiler version and optimization
  compilers: {
    solc: {
      version: "0.8.0", // Fetch a specific Solidity version from solc-bin
      settings: {       // Optional settings to optimize contract deployment
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
