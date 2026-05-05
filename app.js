const express = require('express');
const session = require('express-session');
let Web3 = require('web3');
Web3 = Web3 && Web3.default ? Web3.default : Web3;
const fs = require("fs");
const path = require('path');
const multer = require('multer');

// Set up Express
const app = express();

// Set up session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
      cb(null, file.originalname); 
  }
});
const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Make user and role-switch info available in all views
app.use((req, res, next) => {
  const currentUser = req.session.user || null;
  res.locals.user = currentUser;
  if (currentUser && currentUser.email) {
    const users = loadUsers();
    const email = currentUser.email.toLowerCase().trim();
    const hasBuyerAccount = users.some(u => (u.email || '').toLowerCase().trim() === email && u.role === 'buyer');
    const hasSellerAccount = users.some(u => (u.email || '').toLowerCase().trim() === email && u.role === 'seller');
    res.locals.hasBuyerAccount = hasBuyerAccount;
    res.locals.hasSellerAccount = hasSellerAccount;
    res.locals.canSwitchRole = hasBuyerAccount && hasSellerAccount;
    if (currentUser.role === 'buyer') {
      res.locals.switchRoleTarget = 'seller';
    } else if (currentUser.role === 'seller') {
      res.locals.switchRoleTarget = 'buyer';
    } else {
      res.locals.switchRoleTarget = hasSellerAccount ? 'seller' : (hasBuyerAccount ? 'buyer' : null);
    }
  } else {
    res.locals.hasBuyerAccount = false;
    res.locals.hasSellerAccount = false;
    res.locals.canSwitchRole = false;
    res.locals.switchRoleTarget = null;
  }
  next();
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port: http://localhost:${PORT}/`));

// Global variables
var account = '';
var userRole = '';
var currentUserId = null;
var noOfProducts = 0;
var loading = true;  
var addObj = null;
var addFunc = null;
var addEnabled = null;
var listOfProducts = [];   

const WEB3_PROVIDER = process.env.WEB3_PROVIDER || 'http://localhost:7545';
const LOYALTY_TOKENS_PER_ETHER = Number(process.env.LOYALTY_TOKENS_PER_ETHER || 10);

function getWeb3() {
  return new Web3(WEB3_PROVIDER);
}

function getProductArtifactPath() {
  const artifactPathPublic = path.join(__dirname, 'public', 'build', 'ProductContract.json');
  const artifactPathDefault = path.join(__dirname, 'build', 'contracts', 'ProductContract.json');
  return fs.existsSync(artifactPathPublic) ? artifactPathPublic : artifactPathDefault;
}

function getEscrowArtifactPath() {
  const artifactPathPublic = path.join(__dirname, 'public', 'build', 'SimpleEscrow.json');
  const artifactPathDefault = path.join(__dirname, 'build', 'contracts', 'SimpleEscrow.json');
  return fs.existsSync(artifactPathPublic) ? artifactPathPublic : artifactPathDefault;
}

function getOrderBookArtifactPath() {
  const artifactPathPublic = path.join(__dirname, 'public', 'build', 'OrderBook.json');
  const artifactPathDefault = path.join(__dirname, 'build', 'contracts', 'OrderBook.json');
  return fs.existsSync(artifactPathPublic) ? artifactPathPublic : artifactPathDefault;
}

async function getContractFromArtifact(artifact, web3) {
  const networkId = await web3.eth.net.getId();
  const networks = artifact.networks || {};
  const network = networks[String(networkId)];
  if (!network || !network.address) {
    const available = Object.keys(networks);
    throw new Error(
      `Contract not deployed to network ${networkId}. Available networks: ${available.length ? available.join(', ') : 'none'}`
    );
  }
  const contract = new web3.eth.Contract(artifact.abi, network.address);
  return { contract, address: network.address, networkId };
}

async function getChainId() {
  try {
    const web3 = getWeb3();
    const id = await web3.eth.getChainId();
    return String(id);
  } catch (err) {
    console.error('getChainId error:', err);
    return '';
  }
}

async function getOrderBookContract() {
  const artifactPath = getOrderBookArtifactPath();
  if (!fs.existsSync(artifactPath)) {
    throw new Error('OrderBook contract not found. Run truffle migrate --reset --network development');
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  const web3 = getWeb3();
  const { contract } = await getContractFromArtifact(artifact, web3);
  return { contract, web3 };
}

function getLoyaltyArtifactPath() {
  const artifactPathPublic = path.join(__dirname, 'public', 'build', 'LoyaltyToken.json');
  const artifactPathDefault = path.join(__dirname, 'build', 'contracts', 'LoyaltyToken.json');
  return fs.existsSync(artifactPathPublic) ? artifactPathPublic : artifactPathDefault;
}

async function getLoyaltyContract() {
  const artifactPath = getLoyaltyArtifactPath();
  if (!fs.existsSync(artifactPath)) {
    throw new Error('Loyalty contract artifact not found. Run truffle compile & migrate.');
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  const web3 = getWeb3();
  const { contract } = await getContractFromArtifact(artifact, web3);
  return { contract, web3 };
}

// ==================== TEST ROUTES ====================

// Simple test route
app.get('/test-pay', (req, res) => {
    res.send(`
        <html>
        <body style="padding:20px;">
            <h1>Quick Test</h1>
            <button onclick="test()">Test /get-contract-abi</button>
            <div id="result"></div>
            <script>
                async function test() {
                    const res = await fetch('/get-contract-abi');
                    const text = await res.text();
                    document.getElementById('result').innerHTML = 
                        '<h3>Response (' + res.status + '):</h3><pre>' + 
                        text.substring(0, 500) + '</pre>';
                }
            </script>
        </body>
        </html>
    `);
});

// Get contract ABI for frontend
app.get('/get-contract-abi', async (req, res) => {
    try {
        console.log('🔍 GET /get-contract-abi called');
        
        const artifactPathPublic = path.join(__dirname, 'public', 'build', 'ProductContract.json');
        const artifactPathDefault = path.join(__dirname, 'build', 'contracts', 'ProductContract.json');
        const artifactPath = fs.existsSync(artifactPathPublic)
          ? artifactPathPublic
          : artifactPathDefault;

        console.log('Looking for contract at:', artifactPath);

        if (!fs.existsSync(artifactPath)) {
          console.error('❌ Contract file not found at:', artifactPathPublic, 'or', artifactPathDefault);
          return res.status(404).json({
            error: 'Contract not found',
            message: 'Run: truffle migrate --reset --network development',
            path: artifactPath
          });
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath));
        const web3 = getWeb3();
        const { address: contractAddress, networkId } = await getContractFromArtifact(artifact, web3);
        
        console.log('✅ Found contract at:', contractAddress);
        
        res.json({
          success: true,
          abi: artifact.abi,
          address: contractAddress,
          networkId: String(networkId)
        });
        
    } catch (error) {
        console.error('❌ Error in /get-contract-abi:', error);
        res.status(500).json({ 
            error: 'Server error',
            message: error.message,
            stack: error.stack
        });
    }
});

// Get escrow ABI + bytecode for frontend deployment
app.get('/get-escrow-abi', async (req, res) => {
    try {
        const artifactPath = getEscrowArtifactPath();

        if (!fs.existsSync(artifactPath)) {
          return res.status(404).json({
            error: 'Escrow contract not found',
            message: 'Run: truffle migrate --reset --network development',
            path: artifactPath
          });
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath));
        res.json({
          success: true,
          abi: artifact.abi,
          bytecode: artifact.bytecode
        });
    } catch (error) {
        console.error('❌ Error in /get-escrow-abi:', error);
        res.status(500).json({
          error: 'Server error',
          message: error.message
        });
    }
});

// Get seller address for a product
app.get('/get-product-seller/:productId', (req, res) => {
  try {
    const productId = Number(req.params.productId);
    (async () => {
      // Prefer on-chain seller mapping (authoritative for escrow payouts)
      try {
        const artifactPath = getProductArtifactPath();
        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath));
          const web3 = getWeb3();
          const { contract } = await getContractFromArtifact(artifact, web3);
          const sellerAddress = await contract.methods.getProductSeller(productId).call();
          if (sellerAddress && normalizeAddress(sellerAddress) !== '0x0000000000000000000000000000000000000000') {
            return res.json({ success: true, sellerUserId: null, sellerAddress });
          }
        }
      } catch (err) {
        // Fall back to local mapping
      }

      const creator = getProductCreator(productId);
      if (!creator) {
        return res.status(404).json({ error: 'Seller not found for product' });
      }

      const users = loadUsers();
      const seller = users.find(u => u.id === creator.creatorUserId);
      if (!seller || !seller.metamaskAddress) {
        return res.status(404).json({ error: 'Seller address not found' });
      }

      return res.json({
        success: true,
        sellerUserId: seller.id,
        sellerAddress: seller.metamaskAddress
      });
    })();
  } catch (error) {
    console.error('get-product-seller error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== MAIN ROUTES ====================

// Home page route
app.get('/', async(req, res) => {   
    console.log("home page - loading products");
    console.log("Current user session:", req.session.user || 'No user');
    
    try {
      // Always try to load from chain
      const loaded = await fetchProductsFromChain();
      if (loaded) {
        listOfProducts = loaded;
        noOfProducts = loaded.length;
        loading = false;
        console.log(`Loaded ${noOfProducts} products from chain`);
      }
      
      const currentUser = req.session.user || null;
      const cartItems = req.session.cartItems || [];
      
      // Calculate available stock considering cart items
      const displayProducts = (listOfProducts || []).map(p => {
        const canEdit = currentUser && currentUser.role === 'seller' && canEditProduct(p.id, currentUser.id);
        
        // Check if product is in cart
        const cartItem = cartItems.find(item => item.id === p.id);
        const inCartQuantity = cartItem ? cartItem.quantity : 0;
        const availableStock = p.stock - inCartQuantity;
        
        return {
          ...p,
          canEdit: canEdit,
          canDelete: canEdit,
          availableStock: availableStock > 0 ? availableStock : 0,
          inCartQuantity: inCartQuantity
        };
      });
      
      res.render('ecommerce/index', {
        acct: account,
        role: currentUser ? currentUser.role : '',
        userId: currentUser ? currentUser.id : null,
        cnt: noOfProducts,
        products: displayProducts,
        loading: loading,
        addObject : JSON.stringify(addObj),
        addFunction : addFunc,
        addStatus : addEnabled,
        isSeller: currentUser && currentUser.role === 'seller',
        isBuyer: currentUser && currentUser.role === 'buyer',
        user: currentUser,
        cartItems: cartItems
      });
    } catch (error) {
        console.error('Error in home route:', error);
        res.status(500).send('Server error');
    }
});

// Web3 connection data endpoint
app.post('/web3ConnectData', express.json(), async (req, res) => {
  try {
    const { productDataRead, contractAddress, acct, nProducts } = req.body;
    console.log('Web3 connect data received');
    console.log('Account:', acct);
    console.log('Contract:', contractAddress);
    
    noOfProducts = nProducts || 0;
    account = acct || '';
    
    // Get user from session or find by metamask address
    const currentUser = req.session.user;
    if (currentUser) {
      userRole = currentUser.role;
      currentUserId = currentUser.id;
    } else if (acct) {
      // Try to find user by metamask address
      const users = loadUsers();
      const user = users.find(u => u.metamaskAddress && 
        u.metamaskAddress.toLowerCase() === acct.toLowerCase());
      if (user) {
        userRole = user.role;
        currentUserId = user.id;
        // Store in session
        req.session.user = user;
      }
    }
    
    
    if (productDataRead && Array.isArray(productDataRead)) {
      listOfProducts = [];
      for (let i = 0; i < productDataRead.length; i++) {
        const item = productDataRead[i];
        const info = item && item.productInfo;
        if (info) {
          const productData = {        
            id: Number(info.id) || (i + 1),
            productInfo: formatProductInfo(info),
            ownership: [],
            vaccinations: [],
            training: [],
          };
          listOfProducts.push(productData);
        }
      }
      noOfProducts = listOfProducts.length;
    }
    
    loading = false;
    
    res.json({
      success: true,
      data: listOfProducts,
      userRole: userRole,
      userId: currentUserId,
      message: 'Connected successfully'
    });
  } catch (error) {
      console.error('Error in web3ConnectData:', error);
      res.status(500).json({
          success: false,
          message: error.message
      });
  }
});

// Product detail page
app.get('/product/:id', async (req, res) => {
  try {
      const productId = req.params.id;
      console.log("Getting product:", productId);
      
      let product = await fetchProductById(productId);
      if (!product) {
        return res.status(404).send("Product not found");
      }
      
      const currentUser = req.session.user || {};
      const isSeller = currentUser.role === 'seller';
      const canEdit = isSeller && canEditProduct(productId, currentUser.id);
      
      // Check if product is in cart
      const cartItems = req.session.cartItems || [];
      const cartItem = cartItems.find(item => item.id.toString() === productId.toString());
      const inCartQuantity = cartItem ? cartItem.quantity : 0;
      const availableStock = product.stock - inCartQuantity;
      
      res.render('ecommerce/product', {
        acct: account, 
        role: currentUser.role, 
        productData: product, 
        isCreator: canEdit,
        loading: false,
        isSeller: isSeller,
        isBuyer: currentUser.role === 'buyer',
        user: currentUser,
        cartItems: cartItems,
        inCartQuantity: inCartQuantity,
        availableStock: availableStock > 0 ? availableStock : 0
      });
  }
  catch (error) {
      console.error('Error finding product:', error); 
      res.status(500).send('Error finding Product: ' + error.message);
  }
});

// Add product page - SELLER ONLY
app.get('/addProduct', (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can add products. Please register as a seller.');
  }
  const cartItems = req.session.cartItems || [];
  
  res.render('ecommerce/editProduct', {
    acct: account, 
    isEdit: false, 
    product: null,
    user: currentUser,
    cartItems: cartItems,
    isSeller: true
  });   
});

// Edit product page - SELLER ONLY (and only their own products)
app.get('/editProduct/:id', async (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can edit products.');
  }
  
  const productId = req.params.id;
  
  // Check if user is the creator of this product
  if (!canEditProduct(productId, currentUser.id)) {
    return res.status(403).send('You can only edit products that you created.');
  }
  
  const product = await fetchProductById(productId);
  if (!product) return res.status(404).send('Product not found');
  const cartItems = req.session.cartItems || [];
  
  res.render('ecommerce/editProduct', { 
    acct: account, 
    isEdit: true, 
    product: product,
    user: currentUser,
    cartItems: cartItems,
    isSeller: true
  });
});

// Add product POST - SELLER ONLY
app.post('/addProduct', upload.single('image'), async (req, res) => {
  try {
      const currentUser = req.session.user;
      if (!currentUser || currentUser.role !== 'seller') {
        return res.status(403).send('Only sellers can add products.');
      }
      
      const { productId, name, category, price, stock, description } = req.body;
      const resolvedCategory = category || '';
      const image = req.file ? req.file.filename : '';
      
      if (!name || !price) {
          return res.status(400).json({ error: 'Missing required fields' });
      }

      // Blockchain write
      const artifactPath = getProductArtifactPath();
      if (!fs.existsSync(artifactPath)) {
        return res.status(500).send('Contract not deployed. Run truffle migrate first.');
      }
      
      const artifact = JSON.parse(fs.readFileSync(artifactPath));
      const web3 = getWeb3();
      const { contract } = await getContractFromArtifact(artifact, web3);
      const accounts = await web3.eth.getAccounts();
      if (!accounts || accounts.length === 0) {
        return res.status(500).send('No accounts available from Ganache');
      }
      
      const from = accounts[0];
      const priceWei = web3.utils.toWei(String(price), 'ether');
      const qty = parseInt(stock) || 1;

      // Register product on-chain
      await contract.methods.registerProduct(name, image, priceWei, qty).send({ from, gas: 3000000 });

      // Get new product id
      const newId = await contract.methods.productCount().call();
      
      // Use updateProduct instead of addProductInfo
      await contract.methods.updateProduct(
        newId,                    // uint _id
        name,                     // string memory _name  
        image,                    // string memory _img
        priceWei,                 // uint256 _price
        qty,                      // uint256 _stock
        resolvedCategory,         // string memory _category
        description || ''         // string memory _description
      ).send({ from, gas: 3000000 });

      // Record the product creator
      const creatorAddress = currentUser.metamaskAddress || from;
      recordProductCreator(Number(newId), creatorAddress, currentUser.id);
      // Persist seller address on-chain so escrow always pays the listing seller.
      try {
        await contract.methods.setProductSeller(Number(newId), creatorAddress).send({ from, gas: 3000000 });
      } catch (err) {
        console.error('Failed to set product seller on-chain:', err.message || err);
      }

      // Refresh product list
      const refreshed = await fetchProductsFromChain();
      if (refreshed && refreshed.length) {
        listOfProducts = refreshed;
        noOfProducts = refreshed.length;
        loading = false;
      }

      console.log(`Product ${name} added by seller ${currentUser.name}`);
      res.redirect('/');
  } catch (error) {
    console.error('Error in product registration:', error);
    res.status(500).send('Error adding Product: ' + error.message);
  }
});

// Edit product POST - SELLER ONLY (their own products)
app.post('/editProduct/:id', upload.single('image'), async (req, res) => {
  try {
      const currentUser = req.session.user;
      if (!currentUser || currentUser.role !== 'seller') {
        return res.status(403).send('Only sellers can edit products.');
      }
      
      const productId = req.params.id;
      
      // Check if user is the creator
      if (!canEditProduct(productId, currentUser.id)) {
        return res.status(403).send('You can only edit products that you created.');
      }
      
      const { name, category, price, description, stock, gender, dob } = req.body;
      const resolvedCategory = category || '';
      
      // Get the image
      let image = null;
      if (req.file) {
        image = req.file.filename;
      } else {
        // If no new image, get existing one
        const existingProduct = await fetchProductById(productId);
        if (existingProduct && existingProduct.productInfo && existingProduct.productInfo.img) {
          image = existingProduct.productInfo.img;
        }
      }
      
      if (!name || !price) {
        return res.status(400).send('Product name and price are required');
      }

      const artifactPath = getProductArtifactPath();
      if (!fs.existsSync(artifactPath)) {
        return res.status(500).send('Contract not deployed. Run truffle migrate first.');
      }
      
      const artifact = JSON.parse(fs.readFileSync(artifactPath));
      const web3 = getWeb3();
      const { contract } = await getContractFromArtifact(artifact, web3);
      const accounts = await web3.eth.getAccounts();
      if (!accounts || accounts.length === 0) {
        return res.status(500).send('No accounts available from Ganache');
      }
      
      const from = accounts[0];
      const priceWei = web3.utils.toWei(String(price), 'ether');
      const qty = parseInt(stock) || 1;

      console.log(`Updating product ${productId}: ${name}, Price: ${priceWei} wei, Image: ${image}`);
      
      // Use the updateProduct function
      await contract.methods.updateProduct(
        productId,      // uint _id
        name,          // string memory _name
        image || '',   // string memory _img
        priceWei,      // uint256 _price
        qty,           // uint256 _stock
        resolvedCategory, // string memory _category
        description || '' // string memory _description
      ).send({ from, gas: 3000000 });

      // Refresh product list
      try {
        const refreshed = await fetchProductsFromChain();
        if (refreshed && refreshed.length) {
          listOfProducts = refreshed;
          noOfProducts = refreshed.length;
          loading = false;
        }
      } catch (refreshErr) {
        console.error('Error refreshing products after edit:', refreshErr);
      }

      console.log(`Product ${productId} updated by seller ${currentUser.name}`);
      res.redirect(`/product/${productId}`);
  } catch (error) {
    console.error('Error editing product:', error);
    res.status(500).send('Error editing product: ' + error.message);
  }
});

// Delete product - SELLER ONLY (their own products)
app.post('/deleteProduct/:id', async (req, res) => {
  try {
      const currentUser = req.session.user;
      if (!currentUser || currentUser.role !== 'seller') {
        return res.status(403).json({ error: 'Only sellers can delete products.' });
      }
      
      const productId = req.params.id;
      
      // Check if user is the creator
      if (!canEditProduct(productId, currentUser.id)) {
        return res.status(403).json({ error: 'You can only delete products that you created.' });
      }

      // Verify product exists on-chain before deleting
      const existingProduct = await fetchProductById(productId);
      if (!existingProduct || Number(existingProduct.id) === 0) {
        const refreshed = await fetchProductsFromChain();
        if (refreshed && refreshed.length) {
          listOfProducts = refreshed;
          noOfProducts = refreshed.length;
        } else {
          listOfProducts = [];
          noOfProducts = 0;
        }
        return res.status(404).json({ error: 'Product not found on chain.' });
      }
      
      const artifactPath = getProductArtifactPath();
      if (!fs.existsSync(artifactPath)) {
        return res.status(500).json({ error: 'Contract not deployed.' });
      }
      
      const artifact = JSON.parse(fs.readFileSync(artifactPath));
      const web3 = getWeb3();
      const { contract } = await getContractFromArtifact(artifact, web3);
      const accounts = await web3.eth.getAccounts();
      if (!accounts || accounts.length === 0) {
        return res.status(500).json({ error: 'No accounts available.' });
      }
      
      const from = accounts[0];
      
      await contract.methods.deleteProduct(productId).send({ from, gas: 3000000 });
      
      // Refresh product list
      const refreshed = await fetchProductsFromChain();
      if (refreshed && refreshed.length) {
        listOfProducts = refreshed;
        noOfProducts = refreshed.length;
      } else {
        listOfProducts = [];
        noOfProducts = 0;
      }

      console.log(`Product ${productId} deleted by seller ${currentUser.name}`);
      res.redirect('/');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error deleting product: ' + error.message });
  }
});

// ==================== CART & CHECKOUT ROUTES ====================

// View cart page - BUYER ONLY
app.get('/cart', (req, res) => {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'buyer') {
        return res.status(403).send('Only buyers can view cart. Please register as a buyer.');
    }
    
    // Get cart items from session (or empty array)
    const cartItems = req.session.cartItems || [];
    
    res.render('ecommerce/cart', {
        acct: account, 
        cartItems: cartItems,
        user: currentUser,
        isBuyer: true
    });
});

// Add to cart - BUYER ONLY (with stock validation)
app.post('/add-to-cart/:id', async (req, res) => {
    try {
        const currentUser = req.session.user;
        if (!currentUser || currentUser.role !== 'buyer') {
            return res.status(403).send('Only buyers can add to cart.');
        }
        
        const productId = req.params.id;
        console.log("Adding product to cart:", productId);
        
        let product = await fetchProductById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        
        // Initialize cart in session
        if (!req.session.cartItems) {
            req.session.cartItems = [];
        }
        
        // Check if product already in cart
        const existingIndex = req.session.cartItems.findIndex(item => 
            item.id.toString() === productId.toString()
        );
        
        // Calculate available stock considering what's already in cart
        const currentInCart = existingIndex >= 0 ? req.session.cartItems[existingIndex].quantity : 0;
        const availableStock = product.stock - currentInCart;
        
        if (availableStock <= 0) {
            return res.status(400).send('Product is out of stock or already at maximum quantity in cart');
        }
        
        if (existingIndex >= 0) {
            // Increase quantity if already in cart
            req.session.cartItems[existingIndex].quantity += 1;
        } else {
            // Add new item to cart
            req.session.cartItems.push({
                id: product.id,
                name: product.productInfo.name,
                price: parseFloat(product.productInfo.price || 0),
                img: product.productInfo.img || 'book.webp',
                quantity: 1,
                stock: product.stock || 1,
                productId: productId
            });
        }
        
        // Save session
        req.session.save();
        
        console.log(`Product ${productId} added to cart for user ${currentUser.name}`);
        res.redirect(`/product/${productId}`);
        
    } catch (error) {
        console.error('Error in cart route:', error); 
        res.status(500).send('Error adding to cart: ' + error.message);
    }
});

// Remove from cart
app.post('/remove-from-cart/:id', (req, res) => {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'buyer') {
        return res.status(403).send('Only buyers can remove from cart.');
    }
    
    const productId = req.params.id;
    
    if (req.session.cartItems) {
        req.session.cartItems = req.session.cartItems.filter(item => 
            item.id.toString() !== productId.toString()
        );
        req.session.save();
    }
    
    res.redirect('/cart');
});

// Update cart quantity
app.post('/update-cart-quantity/:id', (req, res) => {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'buyer') {
        return res.status(403).json({ error: 'Only buyers can update cart.' });
    }
    
    const productId = req.params.id;
    const { quantity } = req.body;
    const newQuantity = parseInt(quantity);
    
    if (isNaN(newQuantity) || newQuantity < 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
    }
    
    if (req.session.cartItems) {
        const itemIndex = req.session.cartItems.findIndex(item => 
            item.id.toString() === productId.toString()
        );
        
        if (itemIndex >= 0) {
            if (newQuantity === 0) {
                // Remove item if quantity is 0
                req.session.cartItems.splice(itemIndex, 1);
            } else {
                // Update quantity
                req.session.cartItems[itemIndex].quantity = newQuantity;
            }
            req.session.save();
        }
    }
    
    res.redirect('/cart');
});

// Single product purchase (legacy)
app.post('/buyProduct/:id', (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'buyer') {
    return res.status(403).send('Only buyers can purchase products.');
  }
  
  try {
      const productId = req.params.id;
      console.log(productId) 
      const { productCost } = req.body;
      const resolvedCost = productCost;
      if (!productId  || !resolvedCost) {
        return res.status(400).json({ 
            error: 'Missing required fields' 
        });
      } 
        addFunc = "purchaseProduct";
      addEnabled = true;
        addObj = { productId: productId, productCost: resolvedCost };  
      res.redirect('/');  
  }catch (error) {
    console.error('Error in product id for buy product:', error);
    res.status(500).send('Error buying Product ');
  }
});

// ==================== PAYMENT API ROUTES ====================

// Clear cart after purchase
app.post('/clear-cart', (req, res) => {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'buyer') {
        return res.status(403).json({ error: 'Only buyers can clear cart' });
    }
    
    if (req.session.cartItems) {
        req.session.cartItems = [];
        req.session.save();
    }
    res.json({ success: true });
});

// Batch purchase endpoint
app.post('/checkout', express.json(), async (req, res) => {
    try {
        const currentUser = req.session.user;
        if (!currentUser || currentUser.role !== 'buyer') {
            return res.status(403).json({ error: 'Only buyers can checkout' });
        }
        
        const { items } = req.body; // Array of {id, quantity, escrowAddress}
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items to purchase' });
        }
        
        // Load contract
        const artifactPath = path.join(__dirname, 'build', 'contracts', 'ProductContract.json');
        const artifact = JSON.parse(fs.readFileSync(artifactPath));
        const web3 = getWeb3();
        const { contract } = await getContractFromArtifact(artifact, web3);
        const accounts = await web3.eth.getAccounts();
        const from = accounts[0];
        
        const results = [];
        const createdOrders = [];
        
        // Purchase each item
        for (const item of items) {
            const product = await fetchProductById(item.id);
            if (!product) {
                results.push({ id: item.id, success: false, error: 'Product not found' });
                continue;
            }
            
            if (product.stock < item.quantity) {
                results.push({ id: item.id, success: false, error: 'Insufficient stock' });
                continue;
            }
            
            try {
                // Purchase one at a time
                for (let i = 0; i < item.quantity; i++) {
                    await contract.methods.purchaseProduct(item.id)
                        .send({
                            from: from,
                            value: web3.utils.toWei(product.productInfo.price, 'ether'),
                            gas: 3000000
                        });
                }
                
                // Resolve seller info and create order record
                const { creator, seller } = resolveSellerForProduct(item.id);
                const resolvedSellerId = seller ? seller.id : (creator ? creator.creatorUserId : null);
                const order = await createOrder(
                  item.id,
                  currentUser.id,
                  resolvedSellerId,
                  product.productInfo.name,
                  product.productInfo.price,
                  item.quantity,
                  seller ? seller.name : 'Unknown Seller'
                );
                
                createdOrders.push(order);
                results.push({ id: item.id, success: true });
                
            } catch (error) {
                results.push({ id: item.id, success: false, error: error.message });
            }
        }
        
        // Clear cart if all successful
        const allSuccess = results.every(r => r.success);
        if (allSuccess && req.session.cartItems) {
            req.session.cartItems = [];
            req.session.save();
        }
        
        res.json({ 
            success: allSuccess, 
            results: results,
            orders: createdOrders,
            message: allSuccess ? 'Purchase completed' : 'Some items failed to purchase'
        });
        
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

    // Create order records after client-side blockchain purchase
    app.post('/create-orders-from-cart', express.json(), async (req, res) => {
      try {
        const currentUser = req.session.user;
        if (!currentUser || currentUser.role !== 'buyer') {
          return res.status(403).json({ error: 'Only buyers can create orders' });
        }

        const { items } = req.body; // Array of {id, quantity}
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'No items provided' });
        }

        const createdOrders = [];

        for (const item of items) {
          const product = await fetchProductById(item.id);
          if (!product) {
            continue;
          }

          const { creator, seller } = resolveSellerForProduct(item.id);
          if (!creator) {
            continue;
          }

          const order = await createOrder(
            item.id,
            currentUser.id,
            seller ? seller.id : creator.creatorUserId,
            product.productInfo.name,
            product.productInfo.price,
            item.quantity,
            seller ? seller.name : 'Unknown Seller',
            item.escrowAddress || null
          );

          createdOrders.push(order);
        }

        res.json({
          success: true,
          orders: createdOrders,
          message: 'Order records created'
        });
      } catch (error) {
        console.error('create-orders-from-cart error:', error);
        res.status(500).json({ error: error.message });
      }
    });

// Remove multiple items from cart
app.post('/remove-multiple-from-cart', express.json(), (req, res) => {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'buyer') {
        return res.status(403).json({ error: 'Only buyers can modify cart' });
    }
    
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds)) {
        return res.status(400).json({ error: 'Invalid item IDs' });
    }
    
    if (req.session.cartItems) {
        req.session.cartItems = req.session.cartItems.filter(item => 
            !itemIds.includes(item.id)
        );
        req.session.save();
    }
    
    res.json({ success: true, remaining: req.session.cartItems?.length || 0 });
});

// ==================== USER MANAGEMENT ROUTES ====================

// Register page - choose seller or buyer
app.get('/register', (req, res) => {
  res.render('ecommerce/register', { 
    acct: account, 
    error: null,
    defaultRole: 'buyer',
    pageTitle: 'User Registration',
    heading: 'Create Account',
    user: req.session.user || null
  });
});

app.get('/register-seller', (req, res) => {
  res.render('ecommerce/register', {
    acct: account,
    error: null,
    defaultRole: 'seller',
    pageTitle: 'Seller Registration',
    heading: 'Create Seller Account',
    user: req.session.user || null
  });
});

app.post('/register', (req, res) => {
  try {
    const { name, email, password, role, metamaskAddress } = req.body;
    
    if (!name || !email || !password || !role || !metamaskAddress) {
      return res.render('ecommerce/register', { 
        acct: account, 
        error: 'All fields are required',
        defaultRole: role || 'buyer',
        pageTitle: role === 'seller' ? 'Seller Registration' : 'User Registration',
        heading: role === 'seller' ? 'Create Seller Account' : 'Create Account',
        user: req.session.user || null
      });
    }
    
    // Validate role
    if (!['seller', 'buyer'].includes(role)) {
      return res.render('ecommerce/register', { 
        acct: account, 
        error: 'Please select either Seller or Buyer role',
        defaultRole: role || 'buyer',
        pageTitle: role === 'seller' ? 'Seller Registration' : 'User Registration',
        heading: role === 'seller' ? 'Create Seller Account' : 'Create Account',
        user: req.session.user || null
      });
    }
    
    const users = loadUsers();
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if email already exists for the same role
    if (users.find(u => (u.email || '').toLowerCase().trim() === normalizedEmail && u.role === role)) {
      return res.render('ecommerce/register', { 
        acct: account, 
        error: 'Email already registered',
        defaultRole: role || 'buyer',
        pageTitle: role === 'seller' ? 'Seller Registration' : 'User Registration',
        heading: role === 'seller' ? 'Create Seller Account' : 'Create Account',
        user: req.session.user || null
      });
    }
    
    // Allow re-using a MetaMask address when the email is the same
    const existingMetamaskUser = users.find(u => u.metamaskAddress &&
      u.metamaskAddress.toLowerCase() === metamaskAddress.toLowerCase());
    if (existingMetamaskUser) {
      const existingEmail = (existingMetamaskUser.email || '').trim().toLowerCase();
      if (existingEmail !== normalizedEmail) {
        return res.render('ecommerce/register', { 
          acct: account, 
          error: 'MetaMask address already registered',
          defaultRole: role || 'buyer',
          pageTitle: role === 'seller' ? 'Seller Registration' : 'User Registration',
          heading: role === 'seller' ? 'Create Seller Account' : 'Create Account',
          user: req.session.user || null
        });
      }
    }
    
    const id = users.length ? (users[users.length-1].id + 1) : 1;
    const newUser = { 
      id, 
      name, 
      email: normalizedEmail, 
      password, 
      role: role,
      metamaskAddress: metamaskAddress,
      createdAt: Date.now() 
    };
    
    users.push(newUser);
    saveUsers(users);
    
    // Set session
    req.session.user = newUser;
    account = metamaskAddress;
    userRole = role;
    currentUserId = id;
    
    console.log(`New ${role} registered: ${name} (${email})`);
    res.redirect('/');
  } catch (err) {
    console.error('register error:', err);
    res.render('ecommerce/register', { 
      acct: account, 
      error: 'Server error during registration',
      defaultRole: 'buyer',
      pageTitle: 'User Registration',
      heading: 'Create Account',
      user: req.session.user || null
    });
  }
});

// Switch role for same email account
app.post('/switch-role', (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || !currentUser.email) {
    return res.redirect('/login');
  }

  const targetRole = req.body.role;
  if (!['buyer', 'seller'].includes(targetRole)) {
    return res.status(400).send('Invalid role');
  }

  const users = loadUsers();
  const normalizedEmail = currentUser.email.toLowerCase().trim();
  const targetUser = users.find(u => (u.email || '').toLowerCase().trim() === normalizedEmail && u.role === targetRole);
  if (!targetUser) {
    return res.status(403).send('Target role account not found');
  }

  req.session.user = targetUser;
  account = targetUser.metamaskAddress || '';
  userRole = targetUser.role || '';
  currentUserId = targetUser.id;

  const redirectTo = targetUser.role === 'buyer' ? '/' : '/profile';
  res.redirect(redirectTo);
});

// Login page
app.get('/login', (req, res) => {
  res.render('ecommerce/login', { 
    acct: account, 
    error: null,
    user: req.session.user || null,
    defaultRole: 'buyer',
    pageTitle: 'Buyer Login',
    heading: 'Buyer Login'
  });
});

app.get('/login-seller', (req, res) => {
  res.render('ecommerce/login', { 
    acct: account, 
    error: null,
    user: req.session.user || null,
    defaultRole: 'seller',
    pageTitle: 'Seller Login',
    heading: 'Seller Login'
  });
});

app.post('/login', (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.render('ecommerce/login', { 
        acct: account, 
        error: 'Email and password required',
        user: req.session.user || null,
        defaultRole: role || 'buyer',
        pageTitle: role === 'seller' ? 'Seller Login' : 'Buyer Login',
        heading: role === 'seller' ? 'Seller Login' : 'Buyer Login'
      });
    }
    
    const users = loadUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const matches = users.filter(u => (u.email || '').toLowerCase().trim() === normalizedEmail && u.password === password);
    let user = null;
    if (role && ['buyer', 'seller'].includes(role)) {
      user = matches.find(u => u.role === role) || null;
    }
    if (!user) {
      user = matches.find(u => u.role === 'buyer') || matches[0];
    }
    
    if (!user) {
      return res.render('ecommerce/login', { 
        acct: account, 
        error: 'Invalid email or password',
        user: req.session.user || null,
        defaultRole: role || 'buyer',
        pageTitle: role === 'seller' ? 'Seller Login' : 'Buyer Login',
        heading: role === 'seller' ? 'Seller Login' : 'Buyer Login'
      });
    }
    
    // Set session
    req.session.user = user;
    account = user.metamaskAddress || '';
    userRole = user.role || '';
    currentUserId = user.id;
    
    console.log(`User logged in: ${user.name} (${user.role})`);
    res.redirect('/');
  } catch (err) {
    console.error('login error:', err);
    res.render('ecommerce/login', { 
      acct: account, 
      error: 'Server error during login',
      user: req.session.user || null,
      defaultRole: 'buyer',
      pageTitle: 'Buyer Login',
      heading: 'Buyer Login'
    });
  }
});

// Logout
app.get('/logout', (req, res) => {
  console.log(`User logged out: ${req.session.user?.name || 'Unknown'}`);
  req.session.destroy();
  account = '';
  userRole = '';
  currentUserId = null;
  res.redirect('/');
});

// Profile page
app.get('/profile', async (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser) {
    return res.redirect('/login');
  }

  const userProducts = listOfProducts.filter(p =>
    canEditProduct(p.id, currentUser.id)
  );
  const orders = await loadOrdersFromChain();
  const sellerOrders = orders.filter(order => Number(order.sellerId) === Number(currentUser.id));
  const totalEarned = sellerOrders.reduce((sum, order) => {
    const price = Number(order.price) || 0;
    const qty = Number(order.quantity) || 1;
    return sum + (price * qty);
  }, 0);

  res.render('ecommerce/profile', {
    acct: account,
    user: currentUser,
    isSeller: currentUser.role === 'seller',
    isBuyer: currentUser.role === 'buyer',
    cartItems: req.session.cartItems || [],
    products: userProducts,
    productCount: userProducts.length,
    sellerOrderCount: sellerOrders.length,
    totalEarned: totalEarned
  });
});

// Payment (escrow) page
app.get('/payment', (req, res) => {
  const currentUser = req.session.user || null;
  res.render('ecommerce/payment', {
    acct: account,
    user: currentUser,
    isSeller: currentUser && currentUser.role === 'seller',
    isBuyer: currentUser && currentUser.role === 'buyer'
  });
});

// Dashboard - different for sellers and buyers
app.get('/dashboard', async (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser) {
    return res.redirect('/login');
  }
  
  if (currentUser.role === 'seller') {
    // Show seller dashboard with their products
    const userProducts = listOfProducts.filter(p => 
      canEditProduct(p.id, currentUser.id)
    );

    const orders = await loadOrdersFromChain();
    const sellerOrders = orders.filter(order => Number(order.sellerId) === Number(currentUser.id));
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const yearMs = 365 * 24 * 60 * 60 * 1000;

    const getOrderAmount = (order) => {
      const price = Number(order.price) || 0;
      const qty = Number(order.quantity) || 1;
      return price * qty;
    };

    const sumSince = (ms) => sellerOrders.reduce((sum, order) => {
      const createdAt = Number(order.createdAt) || 0;
      if (createdAt >= now - ms) {
        return sum + getOrderAmount(order);
      }
      return sum;
    }, 0);

    const weeklySales = sumSince(weekMs);
    const monthlySales = sumSince(monthMs);
    const yearlySales = sumSince(yearMs);

    const productLookup = new Map(
      (listOfProducts || []).map(product => [String(product.id), product])
    );
    const categoryCounts = sellerOrders.reduce((acc, order) => {
      const product = productLookup.get(String(order.productId));
      const category = (product && product.productInfo && product.productInfo.category) ?
        product.productInfo.category : 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const topCategoryEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCategoryEntry ? topCategoryEntry[0] : 'No sales yet';

    const buyerIds = new Set(sellerOrders.map(order => order.buyerId));
    const sellerProductIds = new Set(sellerOrders.map(order => String(order.productId)));
    const alsoBoughtCounts = {};
    orders.forEach(order => {
      if (!buyerIds.has(order.buyerId)) return;
      if (sellerProductIds.has(String(order.productId))) return;
      const name = order.productName || 'Unknown Item';
      alsoBoughtCounts[name] = (alsoBoughtCounts[name] || 0) + 1;
    });
    const alsoBought = Object.entries(alsoBoughtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    res.render('ecommerce/sellerDashboard', {
      acct: account,
      user: currentUser,
      cartItems: req.session.cartItems || [],
      products: userProducts,
      productCount: userProducts.length,
      sellerOrderCount: sellerOrders.length,
      weeklySales: weeklySales,
      monthlySales: monthlySales,
      yearlySales: yearlySales,
      totalSales: sellerOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
      topCategory: topCategory,
      alsoBought: alsoBought
    });
  } else if (currentUser.role === 'buyer') {
    // Show buyer dashboard
    res.render('ecommerce/buyerDashboard', {
      acct: account,
      user: currentUser
    });
  } else {
    res.redirect('/');
  }
});

// Update wallet in session and server state
app.post('/update-wallet', express.json(), (req, res) => {
  try {
    const newAccount = (req.body && req.body.account) ? String(req.body.account).trim() : '';
    account = newAccount || '';

    if (req.session.user) {
      const currentUser = req.session.user;
      const users = loadUsers();
      const conflict = users.find(u => u.metamaskAddress &&
        u.metamaskAddress.toLowerCase() === newAccount.toLowerCase() &&
        u.id !== currentUser.id);

      if (!conflict) {
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx >= 0) {
          users[idx].metamaskAddress = newAccount;
          saveUsers(users);
        }
        req.session.user = { ...currentUser, metamaskAddress: newAccount };
      }
    }

    res.json({ success: true, account: account });
  } catch (error) {
    console.error('update-wallet error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add metadata routes (seller only)
app.get('/addMetadata/:id', (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can add metadata.');
  }
  
  const productId = req.params.id;
  
  if (!canEditProduct(productId, currentUser.id)) {
    return res.status(403).send('You can only add metadata to your own products.');
  }
  const cartItems = req.session.cartItems || [];
  
  res.render('ecommerce/addMetadata', { 
    acct: account, 
    productId: productId, 
    role: currentUser.role,
    user: currentUser,
    cartItems: cartItems,
    isSeller: true
  }); 
});

// Add history routes (seller only)
app.get('/addHistory/:id', (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can add history.');
  }
  
  const productId = req.params.id;
  
  if (!canEditProduct(productId, currentUser.id)) {
    return res.status(403).send('You can only add history to your own products.');
  }
  
  res.render('ecommerce/addHistory', { 
    acct: account, 
    productId: productId, 
    role: currentUser.role,
    user: currentUser,
    isSeller: true
  }); 
});

// Add ownership routes (seller only)
app.get('/addOwnership/:id', (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can add ownership records.');
  }
  
  const productId = req.params.id;
  
  if (!canEditProduct(productId, currentUser.id)) {
    return res.status(403).send('You can only add ownership records to your own products.');
  }
  
  res.render('ecommerce/addOwnership', { 
    acct: account, 
    productId: productId, 
    role: currentUser.role,
    user: currentUser,
    isSeller: true
  }); 
});

// ==================== ORDER MANAGEMENT ROUTES ====================

// View buyer orders
app.get('/my-orders', async (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'buyer') {
    return res.status(403).send('Only buyers can view orders.');
  }
  
  const orders = await loadOrdersFromChain();
  const buyerOrders = orders.filter(order => order.buyerId === currentUser.id);
  
    res.render('ecommerce/buyer-orders', {
      acct: account,
      user: currentUser,
      orders: buyerOrders,
      isBuyer: true,
      cartItems: req.session.cartItems || [],
      chainId: await getChainId()
    });
  });

// View seller orders
app.get('/seller-orders', async (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can view orders.');
  }
  
  const orders = await loadOrdersFromChain();
  const sellerOrders = orders.filter(order => Number(order.sellerId) === Number(currentUser.id) && order.orderStatus !== 'Completed');
  const cartItems = req.session.cartItems || [];
  
  res.render('ecommerce/seller-orders', {
    acct: account,
    user: currentUser,
    orders: sellerOrders,
    cartItems: cartItems,
    isSeller: true
  });
});

// View seller sales history (completed orders)
app.get('/sales-history', async (req, res) => {
  const currentUser = req.session.user;
  if (!currentUser || currentUser.role !== 'seller') {
    return res.status(403).send('Only sellers can view sales history.');
  }

  const orders = await loadOrdersFromChain();
  const completedOrders = orders.filter(order => order.orderStatus === 'Completed');
  const cartItems = req.session.cartItems || [];

  res.render('ecommerce/sales-history', {
    acct: account,
    user: currentUser,
    orders: completedOrders,
    cartItems: cartItems,
    isSeller: true
  });
});

// Seller accepts an order
app.post('/seller-accept-order/:orderId', express.json(), async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can accept orders.' });
    }

    const { orderId } = req.params;
    const { contract, web3 } = await getOrderBookContract();
    const accounts = await web3.eth.getAccounts();
    await contract.methods.sellerAccept(orderId).send({ from: accounts[0], gas: 3000000 });

    const orders = await loadOrdersFromChain();
    const order = orders.find(o => o.id === orderId);

    res.json({
      success: true,
      order: order,
      message: 'Order accepted. Payment is held until delivery is confirmed.'
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seller declines an order
app.post('/seller-decline-order/:orderId', express.json(), async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can decline orders.' });
    }

    const { orderId } = req.params;
    const { contract, web3 } = await getOrderBookContract();
    const accounts = await web3.eth.getAccounts();
    await contract.methods.sellerDecline(orderId, 'The seller did not accept your order')
      .send({ from: accounts[0], gas: 3000000 });

    const orders = await loadOrdersFromChain();
    const order = orders.find(o => o.id === orderId);

    res.json({
      success: true,
      order: order,
      message: 'Order declined. Refund issued to buyer.'
    });
  } catch (error) {
    console.error('Error declining order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update delivery status
app.post('/update-delivery-status/:orderId', express.json(), async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can update delivery status.' });
    }
    
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['Waiting to be shipped', 'Shipping', 'Delivering', 'Delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const statusMap = {
      'Waiting to be shipped': 0,
      'Shipping': 1,
      'Delivering': 2,
      'Delivered': 3
    };

    const statusEnum = statusMap[status];
    if (typeof statusEnum === 'undefined') {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { contract, web3 } = await getOrderBookContract();
    const accounts = await web3.eth.getAccounts();
    await contract.methods.updateDeliveryStatus(orderId, statusEnum)
      .send({ from: accounts[0], gas: 3000000 });

    const orders = await loadOrdersFromChain();
    const order = orders.find(o => o.id === orderId);
    
    res.json({ 
      success: true, 
      order: order,
      message: `Delivery status updated to ${status}`
    });
    
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm order received (buyer side)
app.post('/confirm-order-received/:orderId', express.json(), async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || currentUser.role !== 'buyer') {
      return res.status(403).json({ error: 'Only buyers can confirm receipt.' });
    }
    
    const { orderId } = req.params;
    
    const orders = await loadOrdersFromChain();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const escrowAddr = (order.escrowAddress || '').toLowerCase();
    if (escrowAddr && escrowAddr !== '0x0000000000000000000000000000000000000000') {
      const escrowArtifactPath = getEscrowArtifactPath();
      if (!fs.existsSync(escrowArtifactPath)) {
        return res.status(500).json({ error: 'Escrow contract artifact not found' });
      }
      const escrowArtifact = JSON.parse(fs.readFileSync(escrowArtifactPath));
      const web3 = getWeb3();
      const escrow = new web3.eth.Contract(escrowArtifact.abi, escrowAddr);
      const status = await escrow.methods.status().call();

      // SimpleEscrow.Status.Released == 3
      if (Number(status) !== 3) {
        return res.status(400).json({ error: 'Escrow not released on-chain. Please confirm delivery in escrow first.' });
      }
    }

    const { contract, web3 } = await getOrderBookContract();
    const accounts = await web3.eth.getAccounts();
    await contract.methods.confirmReceived(orderId)
      .send({ from: accounts[0], gas: 3000000 });

    const updatedOrders = await loadOrdersFromChain();
    const updatedOrder = updatedOrders.find(o => o.id === orderId);
    const loyaltyResult = updatedOrder
      ? await awardLoyaltyTokensForOrder(updatedOrder, currentUser.metamaskAddress)
      : null;
    const loyaltyMessage = loyaltyResult?.message ? ` ${loyaltyResult.message}` : '';
    
    res.json({ 
      success: true, 
      order: updatedOrder,
      message: `Order confirmed as received${loyaltyMessage}`,
      loyalty: loyaltyResult
    });
    
  } catch (error) {
      console.error('Error confirming order:', error);
      res.status(500).json({ error: error.message });
  }
});

app.get('/loyalty-balance', async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || !currentUser.metamaskAddress) {
      return res.json({ success: false, message: 'Connect your wallet to view loyalty balance' });
    }

    const { contract, web3 } = await getLoyaltyContract();
    const balance = await contract.methods.balanceOf(currentUser.metamaskAddress).call();
    const balanceStr = typeof balance === 'bigint' ? balance.toString() : String(balance);
    const balanceEth = Number(web3.utils.fromWei(balanceStr, 'ether'));
    
    // Subtract redeemed tokens
    const redeemedTokens = getTotalRedeemedTokens(currentUser.metamaskAddress);
    const availableBalance = Math.max(0, balanceEth - redeemedTokens);
    
    res.json({
      success: true,
      balance: availableBalance.toString(),
      total: balanceEth.toString(),
      redeemed: redeemedTokens,
      raw: balanceStr
    });
  } catch (error) {
    console.error('loyalty-balance error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to read loyalty balance'
    });
  }
});

// Apply loyalty tokens for discount at checkout
// NOTE: Token discounts reduce the seller's payment as a platform incentive to encourage loyalty program participation
const TOKEN_ETH_VALUE = 0.01; // 1 token = 0.01 ETH discount
app.post('/apply-loyalty-discount', express.json(), async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || !currentUser.metamaskAddress) {
      return res.status(400).json({ success: false, message: 'User not authenticated' });
    }

    const { tokensToUse, cartTotal } = req.body;
    const tokensNum = Number(tokensToUse) || 0;
    const totalNum = Number(cartTotal) || 0;

    if (tokensNum < 0 || totalNum <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid tokens or total' });
    }

    // Get user's current token balance
    const { contract, web3 } = await getLoyaltyContract();
    const balance = await contract.methods.balanceOf(currentUser.metamaskAddress).call();
    const balanceStr = typeof balance === 'bigint' ? balance.toString() : String(balance);
    const balanceEth = Number(web3.utils.fromWei(balanceStr, 'ether'));
    
    // Subtract already redeemed tokens
    const redeemedTokens = getTotalRedeemedTokens(currentUser.metamaskAddress);
    const availableBalance = balanceEth - redeemedTokens;

    // Validate user has enough tokens
    if (tokensNum > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient loyalty tokens. You have ${availableBalance.toFixed(2)} tokens available.`
      });
    }

    // Calculate discount (seller incentive)
    const discountAmount = tokensNum * TOKEN_ETH_VALUE;
    const maxDiscount = totalNum * 0.5; // Max 50% discount
    const actualDiscount = Math.min(discountAmount, maxDiscount);
    const newTotal = Math.max(0, totalNum - actualDiscount);

    res.json({
      success: true,
      tokensUsed: tokensNum,
      discountAmount: actualDiscount,
      originalTotal: totalNum,
      newTotal: newTotal,
      message: `Applied ${tokensNum} tokens for ${actualDiscount.toFixed(3)} ETH discount (seller incentive)`,
      discountType: 'seller_incentive'
    });
  } catch (error) {
    console.error('apply-loyalty-discount error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to apply loyalty discount'
    });
  }
});

// Redeem (burn) loyalty tokens after successful purchase
app.post('/redeem-loyalty-tokens', express.json(), async (req, res) => {
  try {
    const currentUser = req.session.user;
    if (!currentUser || !currentUser.metamaskAddress) {
      return res.status(400).json({ success: false, message: 'User not authenticated' });
    }

    const { tokensToRedeem, orderId } = req.body;
    const tokensNum = Number(tokensToRedeem) || 0;

    if (tokensNum <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid token amount' });
    }

    // Record the redemption
    recordTokenRedemption(currentUser.metamaskAddress, tokensNum, orderId);

    res.json({
      success: true,
      tokensRedeemed: tokensNum,
      message: `${tokensNum} loyalty tokens redeemed and removed from your balance`
    });
  } catch (error) {
    console.error('redeem-loyalty-tokens error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to redeem loyalty tokens'
    });
  }
});

// Provide escrow address for a given order ID (used when the frontend did not receive it)
app.get('/order-escrow/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const orders = await loadOrdersFromChain();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      success: true,
      escrowAddress: order.escrowAddress || null
    });
  } catch (error) {
    console.error('Error fetching escrow address for order:', error);
    res.status(500).json({
      error: 'Failed to retrieve escrow address',
      message: error.message
    });
  }
});

// Simple health/debug endpoint for front-end network alignment
app.get('/chain-id', async (req, res) => {
  try {
    const chainId = await getChainId();
    res.json({ success: true, chainId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug escrow contract state (helps diagnose "Held"/failed releases)
app.get('/debug-escrow/:address', async (req, res) => {
  try {
    const addr = String(req.params.address || '').trim();
    if (!addr) return res.status(400).json({ error: 'Escrow address required' });

    const escrowArtifactPath = getEscrowArtifactPath();
    if (!fs.existsSync(escrowArtifactPath)) {
      return res.status(500).json({ error: 'Escrow contract artifact not found' });
    }

    const escrowArtifact = JSON.parse(fs.readFileSync(escrowArtifactPath));
    const web3 = getWeb3();
    const escrow = new web3.eth.Contract(escrowArtifact.abi, addr);

    const [seller, buyer, amount, status] = await Promise.all([
      escrow.methods.seller().call(),
      escrow.methods.buyer().call(),
      escrow.methods.amount().call(),
      escrow.methods.status().call()
    ]);

    res.json({
      success: true,
      address: addr,
      seller,
      buyer,
      amount: String(amount),
      status: String(status)
    });
  } catch (error) {
    console.error('debug-escrow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function formatProductInfo(productInfo) {
  if (!productInfo) return {};
  
  return {
    id: productInfo.id || '0',
    name: productInfo.name || '',

    price: productInfo.price || '0',
    status: productInfo.status || '1',
    img: productInfo.img || '',
    category: productInfo.category || '',
    description: productInfo.description || ''
  };
}

async function fetchProductsFromChain() {
  try {
    const artifactPath = getProductArtifactPath();
    console.log('Looking for contract at:', artifactPath);
    
    if (!fs.existsSync(artifactPath)) {
      console.log('ERROR: Contract not found at:', artifactPath);
      console.log('Run: truffle migrate --reset');
      return [];
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath));
    const web3 = getWeb3();
    const { contract, address: contractAddress } = await getContractFromArtifact(artifact, web3);
    console.log('Contract address:', contractAddress);

    const accounts = await web3.eth.getAccounts();
    console.log('Available Ganache accounts:', accounts.length);

    if (!accounts || accounts.length === 0) {
      console.log('No accounts from Ganache. Is Ganache running on port 7545?');
      return [];
    }

    // Get product count
    const count = await contract.methods.productCount().call();
    console.log('Total products in contract:', count);
    
    const products = [];
    for (let i = 1; i <= Number(count); i++) {
      try {
        const productData = await contract.methods.getProduct(i).call();
        const id = Number(productData[0]);
        const name = productData[1];
        const img = productData[2];
        const priceWei = productData[3];
        const stock = Number(productData[4]);
        
        if (id === 0) continue; // Skip deleted
        
        let category = '';
        let description = '';
        let status = 1;
        
        try {
          const infoData = await contract.methods.getProductInfo(i).call();
          category = infoData[2] || '';
          description = infoData[3] || '';
          status = Number(infoData[5]) || 1;
        } catch (infoErr) {
          // Ignore if no detailed info
        }
        
        const priceEth = web3.utils.fromWei(priceWei || '0', 'ether');
        
        products.push({
          id: id,
          stock: stock,
          productInfo: {
            id: id.toString(),
            name: name || '',
            img: img || '',
            category: category,
            description: description,
            price: priceEth,
            status: status
          }
        });
      } catch (err) {
        console.log(`Skipping product ${i}:`, err.message);
      }
    }
    
    console.log(`Loaded ${products.length} products`);
    return products;
  } catch (err) {
    console.error('Error loading products:', err.message);
    return [];
  }
}

async function fetchProductById(productId) {
  const existing = listOfProducts.find(p => p.id.toString() === productId.toString());
  if (existing) return existing;
  
  try {
    // Use the same path as fetchProductsFromChain
    const artifactPath = getProductArtifactPath();
    if (!fs.existsSync(artifactPath)) {
      console.log('Contract artifact not found for fetchProductById');
      return null;
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath));
    const web3 = getWeb3();
    const { contract } = await getContractFromArtifact(artifact, web3);

    const productData = await contract.methods.getProduct(productId).call();
    const id = Number(productData[0]);
    const name = productData[1];
    const img = productData[2];
    const priceWei = productData[3];
    const stock = Number(productData[4]);
    
    let category = '';
    let description = '';
    let status = 1;
    
    try {
      const infoData = await contract.methods.getProductInfo(productId).call();
      category = infoData[2] || '';
      description = infoData[3] || '';
      status = Number(infoData[5]) || 1;
    } catch (infoErr) {
      console.log('Could not get detailed info:', infoErr);
    }
    
    const priceEth = web3.utils.fromWei(priceWei, 'ether');
    
    return {
      id: id,
      stock: stock,
      productInfo: {
        id: id.toString(),
        name: name,
        img: img,
        category: category,
        description: description,
        price: priceEth,
        status: status
      }
    };
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return null;
  }
}

// --- User persistence ---
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const productCreatorsFilePath = path.join(__dirname, 'data', 'product-creators.json');
const loyaltyAwardsFilePath = path.join(__dirname, 'data', 'loyalty-awards.json');

function loadUsers() {
  try {
    if (!fs.existsSync(usersFilePath)) return [];
    const raw = fs.readFileSync(usersFilePath);
    return JSON.parse(raw);
  } catch (err) {
    console.error('loadUsers error:', err);
    return [];
  }
}

function saveUsers(users) {
  try {
    const dir = path.dirname(usersFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    return true;
  } catch (err) {
    console.error('saveUsers error:', err);
    return false;
  }
}

function loadProductCreators() {
  try {
    if (!fs.existsSync(productCreatorsFilePath)) return [];
    const raw = fs.readFileSync(productCreatorsFilePath);
    return JSON.parse(raw);
  } catch (err) {
    console.error('loadProductCreators error:', err);
    return [];
  }
}

function saveProductCreators(creators) {
  try {
    const dir = path.dirname(productCreatorsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(productCreatorsFilePath, JSON.stringify(creators, null, 2));
    return true;
  } catch (err) {
    console.error('saveProductCreators error:', err);
    return false;
  }
}

function loadLoyaltyAwards() {
  try {
    if (!fs.existsSync(loyaltyAwardsFilePath)) return [];
    const raw = fs.readFileSync(loyaltyAwardsFilePath);
    return JSON.parse(raw);
  } catch (err) {
    console.error('loadLoyaltyAwards error:', err);
    return [];
  }
}

function saveLoyaltyAwards(awards) {
  try {
    const dir = path.dirname(loyaltyAwardsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(loyaltyAwardsFilePath, JSON.stringify(awards, null, 2));
    return true;
  } catch (err) {
    console.error('saveLoyaltyAwards error:', err);
    return false;
  }
}

function hasLoyaltyAward(orderId) {
  if (!orderId) return false;
  const awards = loadLoyaltyAwards();
  return awards.some(a => a.orderId === orderId);
}

function markLoyaltyAward(orderId, buyerAddress, amountWei) {
  if (!orderId) return;
  const awards = loadLoyaltyAwards();
  awards.push({
    orderId: orderId,
    buyerAddress: buyerAddress || null,
    amountWei: String(amountWei || '0'),
    mintedAt: Date.now()
  });
  saveLoyaltyAwards(awards);
}

function recordProductCreator(productId, creatorAddress, creatorUserId) {
  const creators = loadProductCreators();
  const existing = creators.find(c => c.productId === productId);
  if (!existing) {
    creators.push({ 
      productId, 
      creatorAddress, 
      creatorUserId: creatorUserId, 
      createdAt: Date.now() 
    });
    saveProductCreators(creators);
    return;
  }

  const normalizedExistingAddr = normalizeAddress(existing.creatorAddress);
  const normalizedNewAddr = normalizeAddress(creatorAddress);
  const shouldUpdate =
    (creatorUserId && Number(existing.creatorUserId) !== Number(creatorUserId)) ||
    (normalizedNewAddr && normalizedExistingAddr !== normalizedNewAddr);

  if (shouldUpdate) {
    existing.creatorAddress = creatorAddress || existing.creatorAddress;
    existing.creatorUserId = creatorUserId || existing.creatorUserId;
    existing.createdAt = Date.now();
    saveProductCreators(creators);
  }
}

function getProductCreator(productId) {
  const creators = loadProductCreators();
  const idNum = Number(productId);
  return creators.find(c => Number(c.productId) === idNum);
}

function calculateLoyaltyTokens(price, quantity) {
  const priceNum = Number(price) || 0;
  const qty = Math.max(1, Number(quantity) || 1);
  const tokensFromPrice = Math.round(priceNum * LOYALTY_TOKENS_PER_ETHER);
  const baseTokens = Math.max(1, tokensFromPrice);
  return baseTokens * qty;
}

async function awardLoyaltyTokensForOrder(order, buyerAddress) {
  if (!order || !buyerAddress) {
    return { success: false, message: 'Missing order or wallet data for loyalty reward' };
  }

  if (hasLoyaltyAward(order.id)) {
    return { success: true, alreadyAwarded: true, message: 'Loyalty tokens already credited for this order' };
  }

  const tokensToMint = calculateLoyaltyTokens(order.price, order.quantity);
  if (tokensToMint <= 0) {
    return { success: false, message: 'Calculated zero loyalty tokens' };
  }

  try {
    const { contract, web3 } = await getLoyaltyContract();
    const accounts = await web3.eth.getAccounts();
    const amountWei = web3.utils.toWei(String(tokensToMint), 'ether');

    await contract.methods.mint(normalizeAddress(buyerAddress), amountWei).send({
      from: accounts[0],
      gas: 3000000
    });

    markLoyaltyAward(order.id, buyerAddress, amountWei);

    return {
      success: true,
      amountTokens: tokensToMint,
      amountWei,
      message: `Earned ${tokensToMint} MST for this order`
    };
  } catch (error) {
    console.error('awardLoyaltyTokensForOrder error:', error);
    return { success: false, message: error.message || 'Failed to mint loyalty tokens' };
  }
}
// --- Loyalty token persistence ---
const loyaltyRedemptionsFilePath = path.join(__dirname, 'data', 'loyalty-redemptions.json');

function loadLoyaltyRedemptions() {
  try {
    if (!fs.existsSync(loyaltyRedemptionsFilePath)) return [];
    const raw = fs.readFileSync(loyaltyRedemptionsFilePath);
    return JSON.parse(raw);
  } catch (err) {
    console.error('loadLoyaltyRedemptions error:', err);
    return [];
  }
}

function saveLoyaltyRedemptions(redemptions) {
  try {
    const dir = path.dirname(loyaltyRedemptionsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(loyaltyRedemptionsFilePath, JSON.stringify(redemptions, null, 2));
    return true;
  } catch (err) {
    console.error('saveLoyaltyRedemptions error:', err);
    return false;
  }
}

function getTotalRedeemedTokens(buyerAddress) {
  const redemptions = loadLoyaltyRedemptions();
  const normalizedAddr = normalizeAddress(buyerAddress);
  const total = redemptions
    .filter(r => normalizeAddress(r.buyerAddress) === normalizedAddr)
    .reduce((sum, r) => sum + (Number(r.tokensRedeemed) || 0), 0);
  return total;
}

function recordTokenRedemption(buyerAddress, tokensRedeemed, orderId) {
  const redemptions = loadLoyaltyRedemptions();
  redemptions.push({
    buyerAddress: normalizeAddress(buyerAddress),
    tokensRedeemed: Number(tokensRedeemed),
    orderId: orderId || null,
    redeemedAt: Date.now()
  });
  saveLoyaltyRedemptions(redemptions);
}

function normalizeAddress(address) {
  return (address || '').toLowerCase().trim();
}
function resolveSellerForProduct(productId) {
  const creator = getProductCreator(productId);
  if (!creator) return { creator: null, seller: null };

  const users = loadUsers();
  let seller = null;

  if (creator.creatorUserId) {
    seller = users.find(u => u.id === creator.creatorUserId) || null;
  }

  if (!seller && creator.creatorAddress) {
    const creatorAddr = normalizeAddress(creator.creatorAddress);
    seller = users.find(u => normalizeAddress(u.metamaskAddress) === creatorAddr) || null;
  }

  if (!creator.creatorUserId && seller) {
    const creators = loadProductCreators();
    const idx = creators.findIndex(c => Number(c.productId) === Number(productId));
    if (idx >= 0) {
      creators[idx].creatorUserId = seller.id;
      saveProductCreators(creators);
    }
  }

  return { creator, seller };
}

function canEditProduct(productId, userId) {
  const creator = getProductCreator(productId);
  if (!creator || !userId) return false;
  const users = loadUsers();
  const user = users.find(u => u.id === userId);
  if (Number(creator.creatorUserId) === Number(userId)) return true;
  if (user && creator.creatorAddress && user.metamaskAddress) {
    return normalizeAddress(creator.creatorAddress) === normalizeAddress(user.metamaskAddress);
  }

  return false;
}

// ==================== ORDER MANAGEMENT FUNCTIONS ====================

async function loadOrdersFromChain() {
  try {
    const { contract } = await getOrderBookContract();
    const count = Number(await contract.methods.getOrderCount().call());

    const orderStatusMap = ['Paid', 'Accepted', 'Declined', 'Completed'];
    const deliveryStatusMap = ['Waiting to be shipped', 'Shipping', 'Delivering', 'Delivered', 'Declined'];
    const escrowStatusMap = ['Held', 'Released', 'Refunded'];

    // Load ProductContract once (used to resolve on-chain seller wallet)
    let productContract = null;
    try {
      const artifactPath = getProductArtifactPath();
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath));
        const web3 = getWeb3();
        const { contract: c } = await getContractFromArtifact(artifact, web3);
        productContract = c;
      }
    } catch (err) {
      productContract = null;
    }

    const orders = [];
    for (let i = 0; i < count; i++) {
      const key = await contract.methods.getOrderKeyAt(i).call();
      const o = await contract.methods.getOrder(key).call();
      // Seller wallet: prefer on-chain ProductContract mapping, then fall back to local user mapping.
      let sellerAddress = null;
      try {
        if (productContract) {
          const addr = await productContract.methods.getProductSeller(Number(o.productId)).call();
          if (addr && normalizeAddress(addr) !== '0x0000000000000000000000000000000000000000') {
            sellerAddress = addr;
          }
        }
      } catch (err) {
        // ignore and fall back
      }
      if (!sellerAddress) {
        const { creator, seller: resolvedSeller } = resolveSellerForProduct(Number(o.productId));
        sellerAddress = resolvedSeller
          ? resolvedSeller.metamaskAddress
          : creator
            ? creator.creatorAddress
            : null;
      }

      orders.push({
        id: o.id,
        productId: Number(o.productId),
        buyerId: Number(o.buyerId),
        sellerId: Number(o.sellerId),
        productName: o.productName,
        price: o.price,
        quantity: Number(o.quantity),
        sellerName: o.sellerName,
        escrowAddress: o.escrowAddress,
        orderStatus: orderStatusMap[Number(o.orderStatus)] || 'Paid',
        sellerDecision: o.sellerDecision,
        sellerDecisionAt: Number(o.sellerDecisionAt) ? Number(o.sellerDecisionAt) * 1000 : null,
        deliveryStatus: deliveryStatusMap[Number(o.deliveryStatus)] || 'Waiting to be shipped',
        escrowStatus: escrowStatusMap[Number(o.escrowStatus)] || 'Held',
        escrowReleasedAt: Number(o.escrowReleasedAt) ? Number(o.escrowReleasedAt) * 1000 : null,
        refundMessage: o.refundMessage || null,
        createdAt: Number(o.createdAt) * 1000,
        statusUpdatedAt: Number(o.statusUpdatedAt) * 1000,
        buyerConfirmedAt: Number(o.buyerConfirmedAt) ? Number(o.buyerConfirmedAt) * 1000 : null
      });
      orders[orders.length - 1].sellerAddress = sellerAddress;
    }

    return orders;
  } catch (err) {
    console.error('loadOrdersFromChain error:', err);
    return [];
  }
}

async function createOrder(productId, buyerId, sellerId, productName, price, quantity, sellerName, escrowAddress) {
  const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const { contract, web3 } = await getOrderBookContract();
  const accounts = await web3.eth.getAccounts();

  await contract.methods.createOrder(
    orderId,
    Number(productId),
    Number(buyerId),
    Number(sellerId),
    productName,
    String(price),
    Number(quantity),
    sellerName,
    escrowAddress || '0x0000000000000000000000000000000000000000'
  ).send({ from: accounts[0], gas: 3000000 });

  try {
    await contract.methods.sellerAccept(orderId).send({ from: accounts[0], gas: 3000000 });
  } catch (err) {
    console.error('Auto-accept order failed:', err);
  }

  return {
    id: orderId,
    productId: Number(productId),
    buyerId: Number(buyerId),
    sellerId: Number(sellerId),
    productName: productName,
    price: String(price),
    quantity: Number(quantity),
    sellerName: sellerName,
    escrowAddress: escrowAddress || null,
    orderStatus: 'Accepted',
    sellerDecision: 'Accepted',
    sellerDecisionAt: Date.now(),
    deliveryStatus: 'Waiting to be shipped',
    escrowStatus: 'Held',
    escrowReleasedAt: null,
    refundMessage: null,
    createdAt: Date.now(),
    statusUpdatedAt: Date.now(),
    buyerConfirmedAt: null
  };
}

console.log("✅ Server started on port", PORT);
console.log("🌐 Test contract at: http://localhost:" + PORT + "/test-pay");
console.log("🛒 Cart page: http://localhost:" + PORT + "/cart");


