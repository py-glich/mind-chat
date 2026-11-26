const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'store_db.json');

// Initial seed data representing real-world Shopify / WooCommerce store
const INITIAL_DATA = {
  rules: [
    {
      id: 'rule-order-track',
      name: 'Order Tracking & Status',
      intent: 'order_status',
      trigger_type: 'keywords',
      triggers: ['track', 'order', 'status', 'where is my order', 'shipping', 'delivery update', 'package', 'tracking'],
      pattern: '(?:order|#|tracking)?\\s*([0-9]{4,8})',
      action_type: 'CHECK_ORDER',
      db_table: 'orders',
      lookup_field: 'order_id',
      response_template: '📦 **Order #{{order_id}} Found!**\n\n' +
        '• **Customer:** {{customer_name}}\n' +
        '• **Status:** {{status}}\n' +
        '• **Carrier:** {{carrier}}\n' +
        '• **Tracking Number:** `{{tracking_code}}`\n' +
        '• **Estimated Delivery:** {{estimated_delivery}}\n' +
        '• **Total:** ${{total_price}}\n\n' +
        '**Items Ordered:**\n{{items_list}}\n\n' +
        'Need to change shipping address or report an issue?',
      fallback_template: '⚠️ **Order Not Found in Database**\n\n' +
        'We checked the store database but could not find an order matching "**{{query}}**".\n\n' +
        '💡 **Tips:**\n' +
        '• Enter your 4-digit order number (e.g. **#1042** or **1043**)\n' +
        '• Or enter the email address used at checkout.',
      prompt_missing: '🔍 **Look up your Order:**\n\nPlease enter your **Order Number** (e.g. **#1042**) or the **Email Address** you used at checkout.',
      quick_replies: ['Try #1042', 'Try #1043', 'Speak with Agent', 'Return Policy'],
      priority: 1,
      is_active: true
    },
    {
      id: 'rule-return-refund',
      name: 'Returns & Refund Policy',
      intent: 'return_policy',
      trigger_type: 'keywords',
      triggers: ['return', 'refund', 'exchange', 'money back', 'send back', 'cancel order', 'return item'],
      action_type: 'DIRECT_RESPONSE',
      response_template: '🔄 **Return & Refund Policy:**\n\n' +
        '• **Window:** 30 days from delivery date.\n' +
        '• **Condition:** Items must be in original condition with tags and packaging intact.\n' +
        '• **Refund Processing:** Issued back to your original payment method within 3–5 business days of receipt.\n' +
        '• **Return Fee:** Free prepaid return label for all domestic orders!\n\n' +
        'To initiate a return right now, please provide your **Order #** or type **"human agent"**.',
      quick_replies: ['Start a Return', 'Track Order', 'Speak with Agent'],
      priority: 2,
      is_active: true
    },
    {
      id: 'rule-product-stock',
      name: 'Product Stock & Price Check',
      intent: 'product_lookup',
      trigger_type: 'keywords',
      triggers: ['stock', 'price', 'cost', 'available', 'inventory', 'buy', 'desk mat', 'keycaps', 'light bar', 'cable organizer'],
      action_type: 'CHECK_PRODUCT',
      db_table: 'products',
      lookup_field: 'sku_or_title',
      response_template: '🏷️ **Product In Database:**\n\n' +
        '• **Product:** {{title}}\n' +
        '• **Price:** ${{price}}\n' +
        '• **Availability:** {{stock_status}}\n' +
        '• **Warehouse Qty:** {{stock_qty}} units remaining\n' +
        '• **SKU:** `{{sku}}`\n\n' +
        'Would you like a checkout link or have questions about specs?',
      fallback_template: '🔍 We checked our current inventory catalog but couldn\'t find an exact match for "{{query}}".\n\nHere are some of our popular available items:\n• Minimalist Matte Black Desk Mat ($39.00)\n• Stealth Black PBT Keycaps ($69.00)\n• Ultra-slim Monitor Light Bar ($89.00)',
      quick_replies: ['Check Desk Mat', 'Check Keycaps', 'Check Promo Codes'],
      priority: 3,
      is_active: true
    },
    {
      id: 'rule-discounts',
      name: 'Discounts & Coupon Codes',
      intent: 'promotions',
      trigger_type: 'keywords',
      triggers: ['discount', 'coupon', 'promo', 'code', 'voucher', 'sale', 'deal', 'offer'],
      action_type: 'CHECK_PROMOTION',
      db_table: 'promotions',
      response_template: '🎉 **Active Store Coupons & Deals:**\n\n' +
        '{{promotions_list}}\n\n' +
        '👉 Apply these codes at checkout on your Shopify or WordPress store.',
      quick_replies: ['Apply WELCOME10', 'Browse Products', 'Track Order'],
      priority: 4,
      is_active: true
    },
    {
      id: 'rule-human-escalate',
      name: 'Live Agent Escalation',
      intent: 'human_takeover',
      trigger_type: 'keywords',
      triggers: ['human', 'agent', 'person', 'representative', 'support team', 'talk to someone', 'operator', 'real person', 'help me'],
      action_type: 'ESCALATE_HUMAN',
      response_template: '👨‍💼 **Routing you to a Live Support Agent...**\n\n' +
        'Your conversation has been flagged in our **Unified Support Desk**.\n\n' +
        '• **Queue Status:** Next in line\n' +
        '• **Average Response Time:** ~2 minutes\n' +
        '• **Agent Notification:** Sent\n\n' +
        'Please describe your request below and an agent will join this thread.',
      quick_replies: ['Never mind, check order', 'Store Hours'],
      priority: 5,
      is_active: true
    },
    {
      id: 'rule-business-hours',
      name: 'Store Hours & Contact',
      intent: 'business_hours',
      trigger_type: 'keywords',
      triggers: ['hours', 'open', 'timing', 'phone', 'contact info', 'email address', 'location', 'where are you'],
      action_type: 'DIRECT_RESPONSE',
      response_template: '🕒 **Store Hours & Contact Info:**\n\n' +
        '• **Online Store:** Open 24/7/365\n' +
        '• **Support Desk:** Monday – Friday, 8:00 AM – 7:00 PM EST\n' +
        '• **Email:** support@yourstore.com\n' +
        '• **Fulfillment Hub:** Austin, Texas, USA\n\n' +
        'All orders ship Monday through Friday before 3:00 PM EST.',
      quick_replies: ['Track Order', 'Return Policy', 'Speak with Agent'],
      priority: 6,
      is_active: true
    }
  ],
  orders: [
    {
      order_id: '1042',
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      source: 'Shopify',
      status: 'Out for Delivery',
      carrier: 'FedEx Home Delivery',
      tracking_code: 'FX-982194821',
      estimated_delivery: 'Today by 5:30 PM',
      total_price: 108.00,
      currency: 'USD',
      items: [
        { title: 'Minimalist Matte Black Desk Mat', qty: 1, price: 39.00 },
        { title: 'Stealth Black PBT Keycaps Set', qty: 1, price: 69.00 }
      ],
      created_at: '2026-11-23T10:15:00Z',
      shipping_address: '742 Evergreen Terrace, Springfield, OR'
    },
    {
      order_id: '1043',
      customer_name: 'Alex Smith',
      customer_email: 'alex.smith@gmail.com',
      source: 'WordPress / WooCommerce',
      status: 'Shipped',
      carrier: 'DHL Express',
      tracking_code: 'DHL-48821901',
      estimated_delivery: 'Tomorrow, 2:00 PM',
      total_price: 89.00,
      currency: 'USD',
      items: [
        { title: 'Ultra-slim OLED Monitor Light Bar', qty: 1, price: 89.00 }
      ],
      created_at: '2026-11-24T14:22:00Z',
      shipping_address: '100 Sunset Blvd, Los Angeles, CA'
    },
    {
      order_id: '1044',
      customer_name: 'Sarah Connor',
      customer_email: 'sarah.c@techcorp.io',
      source: 'Custom Website',
      status: 'Processing in Fulfillment Hub',
      carrier: 'UPS Ground',
      tracking_code: '1Z999AA10123456784',
      estimated_delivery: 'Dispatching within 24 hours',
      total_price: 58.00,
      currency: 'USD',
      items: [
        { title: 'Minimalist Matte Black Desk Mat', qty: 1, price: 39.00 },
        { title: 'Magnetic Matte Cable Sorter', qty: 1, price: 19.00 }
      ],
      created_at: '2026-11-25T08:45:00Z',
      shipping_address: '450 Silicon Ave, Austin, TX'
    },
    {
      order_id: '1045',
      customer_name: 'Michael Scott',
      customer_email: 'michael@dundermifflin.com',
      source: 'Shopify',
      status: 'Delivered',
      carrier: 'USPS Priority Mail',
      tracking_code: '9405511206214309871234',
      estimated_delivery: 'Delivered Yesterday at 11:32 AM',
      total_price: 19.00,
      currency: 'USD',
      items: [
        { title: 'Magnetic Matte Cable Sorter', qty: 1, price: 19.00 }
      ],
      created_at: '2026-11-20T16:00:00Z',
      shipping_address: '1725 Slough Ave, Scranton, PA'
    }
  ],
  products: [
    {
      sku: 'SKU-001',
      title: 'Minimalist Matte Black Desk Mat',
      category: 'Desk Accessories',
      price: 39.00,
      stock_qty: 42,
      in_stock: true,
      description: 'Waterproof, microfiber ultra-smooth surface with anti-slip rubber base. 900x400mm.'
    },
    {
      sku: 'SKU-002',
      title: 'Stealth Black PBT Keycaps Set',
      category: 'Keyboards',
      price: 69.00,
      stock_qty: 15,
      in_stock: true,
      description: 'Double-shot thick PBT cherry profile keycaps with dark-on-dark stealth legends.'
    },
    {
      sku: 'SKU-003',
      title: 'Ultra-slim OLED Monitor Light Bar',
      category: 'Lighting',
      price: 89.00,
      stock_qty: 0,
      in_stock: false,
      description: 'Asymmetric optical design prevents screen glare. Touch dimming with wireless dial.'
    },
    {
      sku: 'SKU-004',
      title: 'Magnetic Matte Cable Sorter',
      category: 'Organization',
      price: 19.00,
      stock_qty: 88,
      in_stock: true,
      description: 'Neodymium magnetic base keeps charging cables neatly anchored to your desk edge.'
    }
  ],
  customers: [
    {
      id: 'cust-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1 (555) 234-5678',
      total_spent: 342.00,
      orders_count: 3,
      source: 'Shopify',
      tags: ['VIP Customer', 'Repeat Buyer'],
      notes: 'Prefers matte black accessories.'
    },
    {
      id: 'cust-2',
      name: 'Alex Smith',
      email: 'alex.smith@gmail.com',
      phone: '+1 (555) 987-6543',
      total_spent: 89.00,
      orders_count: 1,
      source: 'WordPress',
      tags: ['New Customer'],
      notes: 'Inquired about monitor lighting.'
    },
    {
      id: 'cust-3',
      name: 'Sarah Connor',
      email: 'sarah.c@techcorp.io',
      phone: '+1 (555) 443-1290',
      total_spent: 198.00,
      orders_count: 2,
      source: 'Custom Website',
      tags: ['Corporate Account'],
      notes: 'Bulk inquiries.'
    }
  ],
  promotions: [
    {
      code: 'WELCOME10',
      discount: '10% OFF',
      min_spend: 0,
      status: 'Active',
      description: '10% discount on your entire first order'
    },
    {
      code: 'BLACKFRIDAY',
      discount: '25% OFF',
      min_spend: 50,
      status: 'Active',
      description: '25% off all accessories with orders above $50'
    },
    {
      code: 'FREESHIP',
      discount: 'FREE SHIPPING',
      min_spend: 30,
      status: 'Active',
      description: 'Free expedited courier delivery on orders above $30'
    }
  ],
  bots: [
    {
      id: 'bot-default',
      name: 'Primary E-Commerce Agent (Old Bot)',
      store_type: 'Shopify Storefront',
      store_name: 'Apex Minimalist Gear',
      theme: 'black',
      status: 'active',
      created_at: '2026-11-20T12:00:00Z',
      rules_count: 6,
      active_rules: ['rule-order-track', 'rule-return-refund', 'rule-product-stock', 'rule-discounts', 'rule-human-escalate', 'rule-business-hours'],
      stats: {
        total_chats: 128,
        db_queries: 247,
        accuracy_rate: '100%',
        human_handoffs: 3
      }
    }
  ],
  conversations: []
};

// Load or initialize DB
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading DB file, reinitializing...', err);
  }
  saveDB(INITIAL_DATA);
  return INITIAL_DATA;
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving DB file:', err);
    return false;
  }
}

// Helpers
const db = {
  getRules: () => loadDB().rules || [],
  
  saveRule: (rule) => {
    const data = loadDB();
    const existingIndex = data.rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      data.rules[existingIndex] = { ...data.rules[existingIndex], ...rule };
    } else {
      data.rules.push({
        id: rule.id || `rule-${Date.now()}`,
        priority: data.rules.length + 1,
        is_active: true,
        ...rule
      });
    }
    saveDB(data);
    return rule;
  },

  deleteRule: (id) => {
    const data = loadDB();
    data.rules = data.rules.filter(r => r.id !== id);
    saveDB(data);
    return true;
  },

  toggleRule: (id) => {
    const data = loadDB();
    const rule = data.rules.find(r => r.id === id);
    if (rule) {
      rule.is_active = !rule.is_active;
      saveDB(data);
      return rule;
    }
    return null;
  },

  getOrders: () => loadDB().orders || [],

  findOrder: (query) => {
    if (!query) return null;
    const data = loadDB();
    const cleanQuery = String(query).replace(/[#]/g, '').trim().toLowerCase();
    
    return data.orders.find(o => 
      o.order_id.toLowerCase() === cleanQuery ||
      o.customer_email.toLowerCase() === cleanQuery ||
      (o.tracking_code && o.tracking_code.toLowerCase() === cleanQuery)
    ) || null;
  },

  addOrder: (order) => {
    const data = loadDB();
    data.orders.unshift(order);
    saveDB(data);
    return order;
  },

  getProducts: () => loadDB().products || [],

  findProduct: (query) => {
    if (!query) return null;
    const data = loadDB();
    const q = query.toLowerCase();
    
    return data.products.find(p => 
      p.sku.toLowerCase() === q ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    ) || null;
  },

  getPromotions: () => loadDB().promotions || [],

  getCustomers: () => loadDB().customers || [],

  findCustomer: (query) => {
    if (!query) return null;
    const data = loadDB();
    const q = query.toLowerCase();
    return data.customers.find(c => 
      c.email.toLowerCase() === q ||
      c.name.toLowerCase().includes(q)
    ) || null;
  },

  getConversations: () => loadDB().conversations || [],

  getBots: () => {
    const data = loadDB();
    if (!data.bots || data.bots.length === 0) {
      data.bots = INITIAL_DATA.bots || [];
      saveDB(data);
    }
    return data.bots;
  },

  getBotById: (id) => {
    const data = loadDB();
    return (data.bots || []).find(b => b.id === id) || null;
  },

  saveBot: (bot) => {
    const data = loadDB();
    if (!data.bots) data.bots = [];
    const idx = data.bots.findIndex(b => b.id === bot.id);
    if (idx >= 0) {
      data.bots[idx] = { ...data.bots[idx], ...bot };
    } else {
      data.bots.unshift(bot);
    }
    saveDB(data);
    return bot;
  },

  deleteBot: (id) => {
    const data = loadDB();
    if (!data.bots) return false;
    data.bots = data.bots.filter(b => b.id !== id);
    saveDB(data);
    return true;
  },

  getConversationById: (id) => {
    const data = loadDB();
    return data.conversations.find(c => c.id === id) || null;
  },

  saveConversation: (conv) => {
    const data = loadDB();
    const idx = data.conversations.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      data.conversations[idx] = conv;
    } else {
      data.conversations.unshift(conv);
    }
    saveDB(data);
    return conv;
  },

  resetDefaults: () => {
    saveDB(INITIAL_DATA);
    return INITIAL_DATA;
  }
};

module.exports = db;
