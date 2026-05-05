/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Darius, Winks
 Student ID: 24037830 , 24028806
 Class: C373-C003
 Date created: 30/1/2026
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract OrderBook {
    enum OrderStatus { Paid, Accepted, Declined, Completed }
    enum DeliveryStatus { Waiting, Shipping, Delivering, Delivered, Declined }
    enum EscrowStatus { Held, Released, Refunded }

    struct Order {
        string id;
        uint256 productId;
        uint256 buyerId;
        uint256 sellerId;
        string productName;
        string price;
        uint256 quantity;
        string sellerName;
        address escrowAddress;
        OrderStatus orderStatus;
        DeliveryStatus deliveryStatus;
        EscrowStatus escrowStatus;
        string sellerDecision;
        uint256 sellerDecisionAt;
        string refundMessage;
        uint256 createdAt;
        uint256 statusUpdatedAt;
        uint256 buyerConfirmedAt;
        uint256 escrowReleasedAt;
    }

    mapping(bytes32 => Order) private orders;
    bytes32[] private orderKeys;
    mapping(uint256 => bytes32[]) private sellerOrders;
    mapping(uint256 => bytes32[]) private buyerOrders;

    event OrderCreated(bytes32 indexed orderKey, string orderId, uint256 sellerId, uint256 buyerId);
    event OrderUpdated(bytes32 indexed orderKey);

    function _key(string memory orderId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(orderId));
    }

    function createOrder(
        string memory orderId,
        uint256 productId,
        uint256 buyerId,
        uint256 sellerId,
        string memory productName,
        string memory price,
        uint256 quantity,
        string memory sellerName,
        address escrowAddress
    ) external {
        bytes32 key = _key(orderId);
        require(bytes(orders[key].id).length == 0, "order exists");

        orders[key] = Order({
            id: orderId,
            productId: productId,
            buyerId: buyerId,
            sellerId: sellerId,
            productName: productName,
            price: price,
            quantity: quantity,
            sellerName: sellerName,
            escrowAddress: escrowAddress,
            orderStatus: OrderStatus.Paid,
            deliveryStatus: DeliveryStatus.Waiting,
            escrowStatus: EscrowStatus.Held,
            sellerDecision: "Pending",
            sellerDecisionAt: 0,
            refundMessage: "",
            createdAt: block.timestamp,
            statusUpdatedAt: block.timestamp,
            buyerConfirmedAt: 0,
            escrowReleasedAt: 0
        });

        orderKeys.push(key);
        sellerOrders[sellerId].push(key);
        buyerOrders[buyerId].push(key);

        emit OrderCreated(key, orderId, sellerId, buyerId);
    }

    function sellerAccept(string memory orderId) external {
        bytes32 key = _key(orderId);
        Order storage o = orders[key];
        require(bytes(o.id).length != 0, "order not found");
        o.orderStatus = OrderStatus.Accepted;
        o.sellerDecision = "Accepted";
        o.sellerDecisionAt = block.timestamp;
        o.statusUpdatedAt = block.timestamp;
        emit OrderUpdated(key);
    }

    function sellerDecline(string memory orderId, string memory refundMessage) external {
        bytes32 key = _key(orderId);
        Order storage o = orders[key];
        require(bytes(o.id).length != 0, "order not found");
        o.orderStatus = OrderStatus.Declined;
        o.deliveryStatus = DeliveryStatus.Declined;
        o.escrowStatus = EscrowStatus.Refunded;
        o.sellerDecision = "Declined";
        o.refundMessage = refundMessage;
        o.sellerDecisionAt = block.timestamp;
        o.statusUpdatedAt = block.timestamp;
        emit OrderUpdated(key);
    }

    function updateDeliveryStatus(string memory orderId, DeliveryStatus status) external {
        bytes32 key = _key(orderId);
        Order storage o = orders[key];
        require(bytes(o.id).length != 0, "order not found");
        o.deliveryStatus = status;
        o.statusUpdatedAt = block.timestamp;
        emit OrderUpdated(key);
    }

    function confirmReceived(string memory orderId) external {
        bytes32 key = _key(orderId);
        Order storage o = orders[key];
        require(bytes(o.id).length != 0, "order not found");
        o.orderStatus = OrderStatus.Completed;
        o.escrowStatus = EscrowStatus.Released;
        o.buyerConfirmedAt = block.timestamp;
        o.escrowReleasedAt = block.timestamp;
        o.statusUpdatedAt = block.timestamp;
        emit OrderUpdated(key);
    }

    function getOrder(bytes32 key) external view returns (Order memory) {
        return orders[key];
    }

    function getOrderKeyAt(uint256 index) external view returns (bytes32) {
        return orderKeys[index];
    }

    function getOrderCount() external view returns (uint256) {
        return orderKeys.length;
    }

    function getSellerOrderCount(uint256 sellerId) external view returns (uint256) {
        return sellerOrders[sellerId].length;
    }

    function getSellerOrderKeyAt(uint256 sellerId, uint256 index) external view returns (bytes32) {
        return sellerOrders[sellerId][index];
    }

    function getBuyerOrderCount(uint256 buyerId) external view returns (uint256) {
        return buyerOrders[buyerId].length;
    }

    function getBuyerOrderKeyAt(uint256 buyerId, uint256 index) external view returns (bytes32) {
        return buyerOrders[buyerId][index];
    }
}
