# MetaShop — Decentralized E-Commerce Marketplace

A full-stack blockchain-powered marketplace where buyers and sellers transact using Ethereum smart contracts, escrow-based payments, and a loyalty token reward system. Built as a team project demonstrating real-world application of Web3 technologies in e-commerce.

![Node.js](https://img.shields.io/badge/Node.js-Express%205-green)
![Solidity](https://img.shields.io/badge/Solidity-0.8.19-blue)
![Web3](https://img.shields.io/badge/Web3.js-4.x-orange)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [User Flows](#user-flows)
- [API Routes](#api-routes)
- [Screenshots](#screenshots)
- [Team](#team)

---

## Overview

MetaShop is a decentralized marketplace that replaces traditional payment gateways with Ethereum smart contracts. Every product listing, purchase, and order is verifiable on-chain. The escrow system ensures trustless transactions between strangers — buyers' funds are held securely until delivery is confirmed, protecting both parties.

This project demonstrates:
- **Smart contract development** — Solidity contracts for products, orders, escrow, and tokens
- **Full-stack Web3 integration** — Connecting a Node.js backend to the Ethereum blockchain
- **Secure transaction patterns** — Escrow-based payments with multi-step verification
- **Token economics** — ERC20-like loyalty rewards to incentivize platform usage
- **Role-based access control** — Separate buyer/seller experiences with shared authentication

---

## Key Features

### Blockchain-Powered Commerce
- Products registered and managed on-chain via `ProductContract`
- Immutable order records stored in `OrderBook` smart contract
- Real-time stock tracking synced with the blockchain

### Escrow Payment System
- Each purchase deploys a dedicated `SimpleEscrow` contract
- Buyer funds are held until delivery is confirmed
- Seller can accept or decline orders (auto-refund on decline)
- Neither party can unilaterally access funds — trustless by design

### Loyalty Token Rewards
- Buyers earn `MSLT` (MetaShop Loyalty Token) on every completed purchase
- Token amount scales with purchase value (10 tokens per ETH spent)
- Tokens redeemable for discounts on future purchases
- Full ERC20-compatible implementation with transfer and approval mechanics

### Order Lifecycle Management
- Real-time delivery tracking: Waiting → Shipping → Delivering → Delivered
- Seller dashboard with accept/decline workflow
- Buyer confirmation triggers escrow release + token minting
- Complete audit trail with timestamps for every status change

### Dual-Role Accounts
- Same email can register as both buyer and seller
- One-click role switching without re-authentication
- Separate cart, orders, and dashboards per role

### Seller Analytics Dashboard
- Weekly, monthly, and yearly earnings breakdown
- Top-selling category insights
- Cross-purchase analysis ("What your buyers also bought")
- Product listing management with edit/delete capabilities

### MetaMask Wallet Integration
- Connect wallet directly from the browser
- Automatic wallet sync across sessions
- Account change detection and auto-refresh

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend (EJS + Bootstrap 5)                   │
│         Product Grid │ Cart │ Orders │ Dashboards │ Profile      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                  Express.js Backend (app.js)                     │
│   Authentication │ Cart Logic │ Order Management │ Analytics     │
│                  Session-based auth + MetaMask wallet            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌─────▼──────────┐
    │   JSON Files   │  │  Web3.js   │  │    Ganache     │
    │  (users, logs) │  │ (contract  │  │ (local Ethereum│
    │                │  │  calls)    │  │   testnet)     │
    └────────────────┘  └─────┬──────┘  └─────┬──────────┘
                              │               │
                              └───────┬───────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
  ┌──────▼─────────┐  ┌──────────────▼──────────┐  ┌─────────────▼───┐
  │ProductContract │  │      OrderBook          │  │  SimpleEscrow   │
  │ (Listings &    │  │  (Order tracking &      │  │ (Per-order fund │
  │  inventory)    │  │   delivery status)      │  │   holding)      │
  └────────────────┘  └─────────────────────────┘  └─────────────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   LoyaltyToken    │
                            │  (Buyer rewards)  │
                            └───────────────────┘
```

---

## Smart Contracts

### ProductContract.sol
Manages the product catalog on-chain.

| Function | Description |
|----------|-------------|
| `registerProduct()` | Create a new listing with name, image, price, stock |
| `updateProduct()` | Modify product details including category and description |
| `deleteProduct()` | Soft-delete a product |
| `purchaseProductEscrow()` | Deduct stock for escrow-based purchases |
| `getProductSeller()` | Retrieve the seller's wallet address |

### SimpleEscrow.sol
Handles secure fund holding for individual orders.

| State | Description |
|-------|-------------|
| Unfunded | Contract deployed, awaiting buyer deposit |
| Funded | Buyer has deposited ETH |
| Accepted | Seller accepted the order |
| Released | Delivery confirmed, funds sent to seller |
| Refunded | Buyer refunded (decline or cancellation) |

### OrderBook.sol
Centralized on-chain order tracking.

| Function | Description |
|----------|-------------|
| `createOrder()` | Record a new order with full metadata |
| `sellerAccept()` / `sellerDecline()` | Seller decision with timestamp |
| `updateDeliveryStatus()` | Track shipping progress |
| `confirmReceived()` | Buyer confirms delivery, triggers completion |

### LoyaltyToken.sol
ERC20-compatible reward token.

| Function | Description |
|----------|-------------|
| `mint()` | Award tokens to buyer (controller-only) |
| `transfer()` | Send tokens between addresses |
| `balanceOf()` | Check token balance |
| `approve()` / `transferFrom()` | Standard allowance mechanism |

---

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express 5 | HTTP routing and middleware |
| Templating | EJS | Server-rendered HTML views |
| Styling | Bootstrap 5 + Custom CSS | Responsive UI components |
| Blockchain | Solidity 0.8.19 | Smart contract language |
| Web3 Library | Web3.js 4.x | Blockchain interaction from JS |
| Dev Blockchain | Ganache | Local Ethereum testnet |
| Contract Tooling | Truffle | Compilation, migration, testing |
| Wallet | MetaMask SDK | Browser wallet connection |
| Sessions | express-session | User authentication state |
| File Uploads | Multer | Product image handling |
| Data Storage | JSON files | User accounts, order logs, loyalty records |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Ganache](https://trufflesuite.com/ganache/) (GUI or CLI)
- [Truffle](https://trufflesuite.com/truffle/) (`npm install -g truffle`)
- [MetaMask](https://metamask.io/) browser extension

### Installation

```bash
# Clone the repository
git clone https://github.com/MinThu63/metashop-dapp.git
cd metashop-dapp

# Install dependencies
npm install
```

### Setup Blockchain

```bash
# Start Ganache on port 7545 (GUI or CLI)
ganache-cli --port 7545

# Compile smart contracts
truffle compile

# Deploy contracts to local network
truffle migrate --reset --network development
```

### Run the Application

```bash
# Start the server
node app.js

# Open in browser
# http://localhost:3001
```

### Connect MetaMask

1. Open MetaMask and add a custom network:
   - RPC URL: `http://localhost:7545`
   - Chain ID: `1337`
   - Currency: `ETH`
2. Import a Ganache account using its private key
3. Click "Connect MetaMask" in the app navbar

---

## Project Structure

```
metashop-dapp/
├── app.js                    # Main Express server (routes, middleware, Web3 logic)
├── package.json              # Dependencies and scripts
├── truffle-config.js         # Truffle network and compiler settings
│
├── contracts/                # Solidity smart contracts
│   ├── ProductContract.sol   # Product registry and inventory
│   ├── SimpleEscrow.sol      # Per-order escrow payments
│   ├── OrderBook.sol         # On-chain order tracking
│   ├── LoyaltyToken.sol      # ERC20 loyalty rewards
│   └── Migrations.sol        # Truffle migration helper
│
├── migrations/               # Truffle deployment scripts
│   ├── 1_initial_migration.js
│   ├── 2_deploy_escrow.js
│   ├── 3_deploy_product.js
│   ├── 4_deploy_orderbook.js
│   └── 5_deploy_loyalty.js
│
├── test/                     # Smart contract unit tests
│   ├── ProductContract.test.js
│   ├── SimpleEscrow.test.js
│   ├── OrderBook.test.js
│   └── LoyaltyToken.test.js
│
├── views/ecommerce/          # EJS templates
│   ├── index.ejs             # Home page (product grid)
│   ├── product.ejs           # Product detail
│   ├── cart.ejs              # Shopping cart
│   ├── payment.ejs           # Escrow payment interface
│   ├── buyer-orders.ejs      # Buyer order tracking
│   ├── seller-orders.ejs     # Seller order management
│   ├── sellerDashboard.ejs   # Seller analytics
│   ├── buyerDashboard.ejs    # Buyer quick links
│   ├── profile.ejs           # User profile
│   ├── login.ejs             # Login form
│   ├── register.ejs          # Registration form
│   └── ...
│
├── public/
│   ├── build/                # Compiled contract ABIs (auto-generated)
│   ├── images/               # Product images
│   └── styles.css            # Custom styles
│
└── data/                     # JSON data files
    ├── users.json            # User accounts
    ├── orders.json           # Order records
    ├── product-creators.json # Product-to-seller mapping
    ├── loyalty-awards.json   # Token minting history
    └── loyalty-redemptions.json  # Token redemption logs
```

---

## User Flows

### Buyer Journey

```
Register → Browse Products → Add to Cart → Checkout
    → Fund Escrow (MetaMask) → Wait for Seller Acceptance
    → Track Delivery Status → Confirm Receipt
    → Funds Released to Seller + Loyalty Tokens Earned
```

### Seller Journey

```
Register → Connect Wallet → Add Products (stored on-chain)
    → Receive Orders → Accept/Decline
    → Update Delivery Status (Shipping → Delivering → Delivered)
    → Buyer Confirms → Payment Released from Escrow
    → View Analytics Dashboard
```

### Escrow Payment Flow

```
1. Buyer clicks "Checkout"
2. New SimpleEscrow contract deployed for each order
3. Buyer funds escrow via MetaMask transaction
4. Seller sees order → Accepts (funds held) or Declines (auto-refund)
5. Seller updates delivery status through stages
6. Buyer confirms receipt → Escrow releases funds to seller
7. LoyaltyToken.mint() awards tokens to buyer
```

---

## API Routes

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/register` | User registration |
| GET/POST | `/login` | User login |
| GET | `/logout` | End session |
| POST | `/switch-role` | Toggle buyer/seller role |

### Products
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Home page with all products |
| GET | `/product/:id` | Product detail page |
| POST | `/addProduct` | Create product on-chain (seller) |
| POST | `/editProduct/:id` | Update product (seller) |
| POST | `/deleteProduct/:id` | Remove product (seller) |

### Cart & Checkout
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/cart` | View cart |
| POST | `/add-to-cart/:id` | Add item with stock validation |
| POST | `/checkout` | Process blockchain purchase |
| POST | `/create-orders-from-cart` | Create order records |

### Orders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/my-orders` | Buyer's order history |
| GET | `/seller-orders` | Seller's pending orders |
| POST | `/seller-accept-order/:id` | Accept order |
| POST | `/seller-decline-order/:id` | Decline + refund |
| POST | `/update-delivery-status/:id` | Update shipping status |
| POST | `/confirm-order-received/:id` | Buyer confirms delivery |

### Loyalty System
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/loyalty-balance` | Check token balance |
| POST | `/apply-loyalty-discount` | Use tokens at checkout |
| POST | `/redeem-loyalty-tokens` | Burn tokens for discount |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `WEB3_PROVIDER` | http://localhost:7545 | Ethereum RPC endpoint |
| `LOYALTY_TOKENS_PER_ETHER` | 10 | Tokens awarded per ETH spent |

---

## Running Tests

```bash
# Run smart contract tests
truffle test

# Run specific test file
truffle test test/SimpleEscrow.test.js
```

---

## What I Learned

- Designing and deploying Solidity smart contracts with proper access control
- Implementing escrow patterns for trustless peer-to-peer transactions
- Integrating Web3.js with a traditional web application backend
- Managing blockchain state alongside off-chain data (hybrid architecture)
- Building role-based access control with session management
- Creating responsive, data-driven dashboards with real-time updates
- Working with MetaMask for wallet connection and transaction signing
- Writing unit tests for smart contracts using Truffle's testing framework

---

## Future Improvements

- [ ] Migrate from JSON files to a proper database (PostgreSQL/MongoDB)
- [ ] Add IPFS for decentralized product image storage
- [ ] Implement dispute resolution mechanism in escrow
- [ ] Deploy to Ethereum testnet (Sepolia/Goerli)
- [ ] Add WebSocket support for real-time order notifications
- [ ] Implement product reviews and ratings system
- [ ] Add multi-item escrow to reduce gas costs

---

## Team

Built collaboratively by a team of 6 developers as part of a polytechnic blockchain development module (January 2026).

| Area | Contributors |
|------|-------------|
| OrderBook contract & order management | 2 members |
| LoyaltyToken contract & rewards system | 2 members |
| SimpleEscrow contract & payment flow | 2 members |

---

## License

This project was developed for educational purposes as part of a polytechnic module on blockchain application development.
