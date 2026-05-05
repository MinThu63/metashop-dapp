/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Lim Xuan Zheng , Min Thu
 Student ID: 24018346 , 24036948
 Class: C373-C003
 Date created: 30/1/2026
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LoyaltyToken {
    string public name = "MetaShop Loyalty Token";
    string public symbol = "MSLT";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    address public owner;
    address public controller;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ControllerChanged(address indexed previousController, address indexed newController);

    modifier onlyOwner() {
        require(msg.sender == owner, "LoyaltyToken: owner only");
        _;
    }

    modifier onlyController() {
        require(msg.sender == controller, "LoyaltyToken: controller only");
        _;
    }

    constructor() {
        owner = msg.sender;
        controller = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "new owner zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setController(address newController) external onlyOwner {
        require(newController != address(0), "controller zero address");
        emit ControllerChanged(controller, newController);
        controller = newController;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function allowance(address ownerAddress, address spender) external view returns (uint256) {
        return allowances[ownerAddress][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "approve to zero");
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowances[sender][msg.sender];
        require(currentAllowance >= amount, "transfer exceeds allowance");
        allowances[sender][msg.sender] = currentAllowance - amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    function mint(address recipient, uint256 amount) external onlyController {
        require(recipient != address(0), "mint to zero");
        totalSupply += amount;
        balances[recipient] += amount;
        emit Transfer(address(0), recipient, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "transfer from zero");
        require(recipient != address(0), "transfer to zero");
        require(balances[sender] >= amount, "insufficient balance");
        balances[sender] -= amount;
        balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }
}
