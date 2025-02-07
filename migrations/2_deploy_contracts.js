const Voting = artifacts.require("./VotingSystem.sol");

module.exports = function(deployer) {
  deployer.deploy(Voting);
};
