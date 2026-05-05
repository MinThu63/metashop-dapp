/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Lim Xuan Zheng, Winks
 Student ID: 24018346 , 24028806
 Class: C373-C003
 Date created: 30/1/2026
 */

const ProductContract = artifacts.require("ProductContract");

contract("ProductContract", (accounts) => {
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

  it("should register a product", async () => {
    const productContract = await ProductContract.new();
    await productContract.registerProduct("Test Product", "test.jpg", web3.utils.toWei("1", "ether"), 10, { from: seller });

    const product = await productContract.products(1);
    assert.equal(product.name, "Test Product");
    assert.equal(product.stock.toNumber(), 10);
  });

  it("should purchase a product", async () => {
    const productContract = await ProductContract.new();
    await productContract.registerProduct("Test Product", "test.jpg", web3.utils.toWei("1", "ether"), 10, { from: seller });

    await productContract.purchaseProduct(1, { from: buyer, value: web3.utils.toWei("1", "ether") });

    const product = await productContract.products(1);
    assert.equal(product.stock.toNumber(), 9);
  });

  it("should not allow purchase with insufficient payment", async () => {
    const productContract = await ProductContract.new();
    await productContract.registerProduct("Test Product", "test.jpg", web3.utils.toWei("1", "ether"), 10, { from: seller });

    await expectRevert(
      productContract.purchaseProduct(1, { from: buyer, value: web3.utils.toWei("0.5", "ether") }),
      "Insufficient payment"
    );

    const product = await productContract.products(1);
    assert.equal(product.stock.toNumber(), 10);
  });

  it("should purchase via escrow and reduce stock by quantity", async () => {
    const productContract = await ProductContract.new();
    await productContract.registerProduct("Test Product", "test.jpg", web3.utils.toWei("1", "ether"), 10, { from: seller });

    await productContract.purchaseProductEscrow(1, 3, { from: buyer });

    const product = await productContract.products(1);
    assert.equal(product.stock.toNumber(), 7);
    assert.equal(product.status.toNumber(), 0); // Available
  });

  it("should revert escrow purchase when quantity is invalid", async () => {
    const productContract = await ProductContract.new();
    await productContract.registerProduct("Test Product", "test.jpg", web3.utils.toWei("1", "ether"), 10, { from: seller });

    await expectRevert(
      productContract.purchaseProductEscrow(1, 0, { from: buyer }),
      "Invalid quantity"
    );
  });
});
