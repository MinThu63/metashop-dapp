/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Jolin, Le Dong Khoi​
 Student ID: 24038263 , 24024636
 Class: C373-C003
 Date created: 30/1/2026
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Simple buyer-funded escrow (single order)
contract SimpleEscrow {
    enum Status { Unfunded, Funded, Accepted, Released, Refunded, Declined }

    address public buyer;
    address payable public seller;
    uint256 public amount;
    Status public status;

    event Funded(address indexed buyer, uint256 amount);
    event Accepted(address indexed seller);
    event Declined(address indexed seller);
    event Released(address indexed seller, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);

    constructor(address payable _seller) {
        require(_seller != address(0), "invalid seller");
        seller = _seller;
        status = Status.Unfunded;
    }

    // Buyer funds the escrow (one-time)
    function fund() external payable {
        require(status == Status.Unfunded, "already funded");
        require(msg.value > 0, "no funds sent");
        buyer = msg.sender;
        amount = msg.value;
        status = Status.Funded;
        emit Funded(buyer, amount);
    }

    // Seller accepts the order, funds remain held
    function sellerAccept() external {
        require(status == Status.Funded, "not funded");
        require(msg.sender == seller, "only seller");
        status = Status.Accepted;
        emit Accepted(seller);
    }

    // Seller declines -> refund buyer
    function sellerDecline() external {
        require(status == Status.Funded, "not funded");
        require(msg.sender == seller, "only seller");
        status = Status.Declined;
        payable(buyer).transfer(amount);
        emit Declined(seller);
        emit Refunded(buyer, amount);
    }

    // Buyer or seller confirms delivery -> release to seller
    function confirmDelivery() external {
        require(status == Status.Accepted || status == Status.Funded, "not accepted");
        require(msg.sender == buyer || msg.sender == seller, "only buyer or seller");
        status = Status.Released;
        seller.transfer(amount);
        emit Released(seller, amount);
    }

    // Buyer can request refund if delivery not confirmed
    function refundBuyer() external {
        require(status == Status.Funded, "not funded");
        require(msg.sender == buyer, "only buyer");
        status = Status.Refunded;
        payable(buyer).transfer(amount);
        emit Refunded(buyer, amount);
    }
}
