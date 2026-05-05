/* 
 I declare that this code was written by me.  
 I will not copy or allow others to copy my code.  
 I understand that copying code is considered as plagiarism. 
  
 Student Name: Team 5 (evenly distributed):
 Student ID: 24037830, 24028806, 24018346, 24024636​, 24038263, 24036948
 Class: C373-C003
 Date created: 30/1/2026
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProductContract {
    enum ProductStatus { Available, Sold, Deleted }

    struct ProductInformation {
        string id;
        string name;
        string category;
        string description;
        string img;
        ProductStatus status;
    }

    struct Product {
        uint256 id;
        string name;
        string img;
        uint256 price;
        uint256 stock;
        uint256 status;
        ProductInformation info;
    }

    uint256 public productCount;
    mapping(uint256 => Product) public products;
    // Seller wallet for each product (used for escrow payouts).
    mapping(uint256 => address) public productSeller;

    event ProductRegistered(uint256 indexed id, string name, address indexed creator);
    event ProductPurchased(uint256 indexed id, address indexed buyer, uint256 amount);
    event ProductSellerSet(uint256 indexed id, address indexed seller);

    function registerProduct(
        string memory _name,
        string memory _img,
        uint256 _price,
        uint256 _stock
    ) public {
        productCount++;
        products[productCount] = Product({
            id: productCount,
            name: _name,
            img: _img,
            price: _price,
            stock: _stock,
            status: uint256(ProductStatus.Available),
            info: ProductInformation("", _name, "", "", _img, ProductStatus.Available)
        });
        productSeller[productCount] = msg.sender;
        emit ProductRegistered(productCount, _name, msg.sender);
        emit ProductSellerSet(productCount, msg.sender);
    }

    function setProductSeller(uint256 _id, address _seller) public {
        require(products[_id].id != 0, "Product not found");
        require(_seller != address(0), "invalid seller");
        productSeller[_id] = _seller;
        emit ProductSellerSet(_id, _seller);
    }

    function getProductSeller(uint256 _id) public view returns (address) {
        require(products[_id].id != 0, "Product not found");
        return productSeller[_id];
    }

    function updateProduct(
        uint256 _id,
        string memory _name,
        string memory _img,
        uint256 _price,
        uint256 _stock,
        string memory _category,
        string memory _description
    ) public {
        require(products[_id].id != 0, "Product not found");
        Product storage p = products[_id];
        p.name = _name;
        p.img = _img;
        p.price = _price;
        p.stock = _stock;
        if (p.status != uint256(ProductStatus.Deleted)) {
            p.status = uint256(ProductStatus.Available);
        }
        p.info = ProductInformation("", _name, _category, _description, _img, ProductStatus(p.status));
    }

    function deleteProduct(uint256 _id) public {
        require(products[_id].id != 0, "Product not found");
        products[_id].id = 0;
        products[_id].status = uint256(ProductStatus.Deleted);
        products[_id].info.status = ProductStatus.Deleted;
    }

    function setProductStock(uint256 _id, uint256 _stock) public {
        require(products[_id].id != 0, "Product not found");
        products[_id].stock = _stock;
        if (_stock == 0) {
            products[_id].status = uint256(ProductStatus.Sold);
            products[_id].info.status = ProductStatus.Sold;
        } else if (products[_id].status != uint256(ProductStatus.Deleted)) {
            products[_id].status = uint256(ProductStatus.Available);
            products[_id].info.status = ProductStatus.Available;
        }
    }

    function getProduct(uint256 _id)
        public
        view
        returns (
            uint256,
            string memory,
            string memory,
            uint256,
            uint256,
            uint256
        )
    {
        Product memory p = products[_id];
        return (p.id, p.name, p.img, p.price, p.stock, p.status);
    }

    function getProductInfo(uint256 _id)
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            string memory,
            string memory,
            uint8
        )
    {
        ProductInformation memory info = products[_id].info;
        return (info.id, info.name, info.category, info.description, info.img, uint8(info.status));
    }

    function purchaseProduct(uint256 _id) public payable {
        Product storage p = products[_id];
        require(p.id != 0, "Product not found");
        require(p.stock > 0, "Out of stock");
        require(msg.value >= p.price, "Insufficient payment");

        p.stock -= 1;
        if (p.stock == 0) {
            p.status = uint256(ProductStatus.Sold);
            p.info.status = ProductStatus.Sold;
        }

        emit ProductPurchased(_id, msg.sender, msg.value);
    }

    // Escrow-based purchase: stock update without direct payment
    function purchaseProductEscrow(uint256 _id, uint256 _quantity) public {
        require(_quantity > 0, "Invalid quantity");
        Product storage p = products[_id];
        require(p.id != 0, "Product not found");
        require(p.stock >= _quantity, "Out of stock");

        p.stock -= _quantity;
        if (p.stock == 0) {
            p.status = uint256(ProductStatus.Sold);
            p.info.status = ProductStatus.Sold;
        }

        emit ProductPurchased(_id, msg.sender, 0);
    }
}
