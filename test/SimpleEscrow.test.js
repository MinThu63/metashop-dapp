/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Lim Xuan Zheng, Winks
 Student ID: 24018346 , 24028806
 Class: C373-C003
 Date created: 30/1/2026
 */

const SimpleEscrow = artifacts.require("SimpleEscrow");

contract("SimpleEscrow", (accounts) => {
  const [buyer, seller, other] = accounts;

  async function expectRevert(promise, expectedMessage) {
    try {
      await promise;
      assert.fail("Expected transaction to revert");
    } catch (error) {
      assert(
        error.message.includes("revert"),
        `Expected "revert", got: ${error.message}`
      );
      if (expectedMessage) {
        assert(
          error.message.includes(expectedMessage),
          `Expected "${expectedMessage}", got: ${error.message}`
        );
      }
    }
  }

  it("should fund escrow", async () => {
    const escrow = await SimpleEscrow.new(seller);
    await escrow.fund({ from: buyer, value: web3.utils.toWei("1", "ether") });

    const status = await escrow.status();
    assert.equal(status.toNumber(), 1); // Funded
  });

  it("should accept escrow and release funds", async () => {
    const escrow = await SimpleEscrow.new(seller);
    await escrow.fund({ from: buyer, value: web3.utils.toWei("1", "ether") });
    await escrow.sellerAccept({ from: seller });
    await escrow.confirmDelivery({ from: buyer });

    const status = await escrow.status();
    assert.equal(status.toNumber(), 3); // Released
  });

  it("should revert when funding with zero value", async () => {
    const escrow = await SimpleEscrow.new(seller);
    await expectRevert(escrow.fund({ from: buyer, value: 0 }), "no funds sent");
  });

  it("should revert when funding twice", async () => {
    const escrow = await SimpleEscrow.new(seller);
    await escrow.fund({ from: buyer, value: web3.utils.toWei("1", "ether") });
    await expectRevert(
      escrow.fund({ from: buyer, value: web3.utils.toWei("1", "ether") }),
      "already funded"
    );
  });

  it("should allow seller to decline and refund buyer", async () => {
    const escrow = await SimpleEscrow.new(seller);
    const amount = BigInt(web3.utils.toWei("1", "ether"));

    await escrow.fund({ from: buyer, value: amount.toString() });
    const buyerBalanceAfterFund = BigInt(await web3.eth.getBalance(buyer));

    await escrow.sellerDecline({ from: seller });

    const status = await escrow.status();
    assert.equal(status.toNumber(), 5); // Declined

    const contractBalance = BigInt(await web3.eth.getBalance(escrow.address));
    assert.equal(contractBalance, 0n);

    const buyerBalanceAfterDecline = BigInt(await web3.eth.getBalance(buyer));
    assert.equal(buyerBalanceAfterDecline - buyerBalanceAfterFund, amount);

    const storedBuyer = await escrow.buyer();
    assert.equal(storedBuyer, buyer);
  });
});
