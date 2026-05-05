/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Lim Xuan Zheng, Winks
 Student ID: 24018346 , 24028806
 Class: C373-C003
 Date created: 30/1/2026
 */

const LoyaltyToken = artifacts.require("LoyaltyToken");

contract("LoyaltyToken", (accounts) => {
  const [owner, seller, buyer] = accounts;

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

  it("should mint loyalty tokens", async () => {
    const loyaltyToken = await LoyaltyToken.new();
    await loyaltyToken.setController(owner, { from: owner });
    await loyaltyToken.mint(buyer, 1000, { from: owner });

    const balance = await loyaltyToken.balanceOf(buyer);
    assert.equal(balance.toNumber(), 1000);
  });

  it("should transfer loyalty tokens", async () => {
    const loyaltyToken = await LoyaltyToken.new();
    await loyaltyToken.setController(owner, { from: owner });
    await loyaltyToken.mint(buyer, 1000, { from: owner });
    await loyaltyToken.transfer(seller, 500, { from: buyer });

    const buyerBalance = await loyaltyToken.balanceOf(buyer);
    const sellerBalance = await loyaltyToken.balanceOf(seller);

    assert.equal(buyerBalance.toNumber(), 500);
    assert.equal(sellerBalance.toNumber(), 500);
  });

  it("should not allow non-controller to mint", async () => {
    const loyaltyToken = await LoyaltyToken.new();
    await loyaltyToken.setController(owner, { from: owner });

    await expectRevert(
      loyaltyToken.mint(buyer, 1, { from: seller }),
      "LoyaltyToken: controller only"
    );
  });

  it("should allow approve + transferFrom and reduce allowance", async () => {
    const loyaltyToken = await LoyaltyToken.new();
    await loyaltyToken.setController(owner, { from: owner });
    await loyaltyToken.mint(buyer, 1000, { from: owner });

    await loyaltyToken.approve(seller, 300, { from: buyer });
    await loyaltyToken.transferFrom(buyer, seller, 200, { from: seller });

    const buyerBalance = await loyaltyToken.balanceOf(buyer);
    const sellerBalance = await loyaltyToken.balanceOf(seller);
    const remaining = await loyaltyToken.allowance(buyer, seller);

    assert.equal(buyerBalance.toNumber(), 800);
    assert.equal(sellerBalance.toNumber(), 200);
    assert.equal(remaining.toNumber(), 100);
  });

  it("should revert transfers when balance is insufficient", async () => {
    const loyaltyToken = await LoyaltyToken.new();
    await loyaltyToken.setController(owner, { from: owner });
    await loyaltyToken.mint(buyer, 100, { from: owner });

    await expectRevert(
      loyaltyToken.transfer(seller, 101, { from: buyer }),
      "insufficient balance"
    );

    const buyerBalance = await loyaltyToken.balanceOf(buyer);
    const sellerBalance = await loyaltyToken.balanceOf(seller);
    assert.equal(buyerBalance.toNumber(), 100);
    assert.equal(sellerBalance.toNumber(), 0);
  });
});
