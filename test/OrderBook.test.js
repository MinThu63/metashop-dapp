/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Lim Xuan Zheng, Winks
 Student ID: 24018346 , 24028806
 Class: C373-C003
 Date created: 30/1/2026
 */

const OrderBook = artifacts.require("OrderBook");

contract("OrderBook", (accounts) => {
  const [owner, seller, buyer] = accounts;

  function asNumber(value) {
    if (value && typeof value === "object" && typeof value.toNumber === "function") {
      return value.toNumber();
    }
    return Number(value);
  }

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

  it("should create an order", async () => {
    const orderBook = await OrderBook.new();
    await orderBook.createOrder(
      "ORDER_001",
      1,
      2,
      1,
      "Test Product",
      "100",
      2,
      "Test Seller",
      accounts[3],
      { from: owner }
    );

    const orderCount = await orderBook.getOrderCount();
    assert.equal(orderCount.toNumber(), 1);
  });

  it("should accept order and update delivery", async () => {
    const orderBook = await OrderBook.new();
    await orderBook.createOrder(
      "ORDER_001",
      1,
      2,
      1,
      "Test Product",
      "100",
      2,
      "Test Seller",
      accounts[3],
      { from: owner }
    );

    await orderBook.sellerAccept("ORDER_001", { from: owner });
    await orderBook.updateDeliveryStatus("ORDER_001", 3, { from: owner }); // Delivered

    const orderKey = await orderBook.getOrderKeyAt(0);
    const order = await orderBook.getOrder(orderKey);
    assert.equal(asNumber(order.orderStatus), 1); // Accepted
    assert.equal(asNumber(order.deliveryStatus), 3); // Delivered
  });

  it("should not allow duplicate order IDs", async () => {
    const orderBook = await OrderBook.new();
    await orderBook.createOrder(
      "ORDER_DUP",
      1,
      2,
      1,
      "Test Product",
      "100",
      1,
      "Test Seller",
      accounts[3],
      { from: owner }
    );

    await expectRevert(
      orderBook.createOrder(
        "ORDER_DUP",
        1,
        2,
        1,
        "Test Product",
        "100",
        1,
        "Test Seller",
        accounts[3],
        { from: owner }
      ),
      "order exists"
    );
  });

  it("should decline order and store refund details", async () => {
    const orderBook = await OrderBook.new();
    await orderBook.createOrder(
      "ORDER_DECLINE",
      10,
      20,
      30,
      "Decline Product",
      "55",
      1,
      "Decline Seller",
      accounts[4],
      { from: owner }
    );

    await orderBook.sellerDecline("ORDER_DECLINE", "Out of stock", { from: owner });

    const orderKey = await orderBook.getOrderKeyAt(0);
    const order = await orderBook.getOrder(orderKey);
    assert.equal(asNumber(order.orderStatus), 2); // Declined
    assert.equal(asNumber(order.deliveryStatus), 4); // Declined
    assert.equal(asNumber(order.escrowStatus), 2); // Refunded
    assert.equal(order.sellerDecision, "Declined");
    assert.equal(order.refundMessage, "Out of stock");
    assert(asNumber(order.sellerDecisionAt) > 0);
    assert(asNumber(order.statusUpdatedAt) >= asNumber(order.createdAt));
  });

  it("should complete order and release escrow on buyer confirmation", async () => {
    const orderBook = await OrderBook.new();
    await orderBook.createOrder(
      "ORDER_COMPLETE",
      1,
      2,
      1,
      "Complete Product",
      "100",
      2,
      "Complete Seller",
      accounts[3],
      { from: owner }
    );

    await orderBook.sellerAccept("ORDER_COMPLETE", { from: owner });
    await orderBook.updateDeliveryStatus("ORDER_COMPLETE", 3, { from: owner }); // Delivered
    await orderBook.confirmReceived("ORDER_COMPLETE", { from: owner });

    const orderKey = await orderBook.getOrderKeyAt(0);
    const order = await orderBook.getOrder(orderKey);
    assert.equal(asNumber(order.orderStatus), 3); // Completed
    assert.equal(asNumber(order.escrowStatus), 1); // Released
    assert(asNumber(order.buyerConfirmedAt) > 0);
    assert(asNumber(order.escrowReleasedAt) > 0);
    assert(asNumber(order.statusUpdatedAt) >= asNumber(order.createdAt));
  });
});
