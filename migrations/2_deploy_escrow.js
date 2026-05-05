const SimpleEscrow = artifacts.require("SimpleEscrow");

module.exports = function (deployer, network, accounts) {
  // For local testing: deploy with seller = first account
  const seller = accounts && accounts.length ? accounts[0] : "0x0000000000000000000000000000000000000000";
  deployer.deploy(SimpleEscrow, seller);
};
