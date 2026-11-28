const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const db = require('./db');
const RuleEngine = require('./ruleEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configured to allow Shopify, WordPress, and Custom domains
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static assets locally
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Fallback for root path locally
app.get('/', (req, res, next) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next();
  });
});

// Health check endpoint for /api
app.get('/api', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'RuleMind Engine API', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'RuleMind Engine API', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------------
// CHAT API
// -------------------------------------------------------------
app.post('/api/chat/message', (req, res) => {
  try {
    const { conversationId, botId = 'bot-default', message, source = 'web', customer = {} } = req.body;
    const convId = conversationId || `conv-${uuidv4().substring(0, 8)}`;

    let conv = db.getConversationById(convId);
    if (!conv) {
      conv = {
        id: convId,
        bot_id: botId,
        source: source, // 'shopify', 'wordpress', 'custom_web'
        customer: {
          name: customer.name || 'Store Visitor',
          email: customer.email || 'visitor@guest.com',
          ip: req.ip || '127.0.0.1',
          ...customer
        },
        context: {
          awaiting: null,
          human_takeover: false,
          botId: botId
        },
        messages: [],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } else {
      if (botId) conv.bot_id = botId;
      if (!conv.context) conv.context = {};
      conv.context.botId = conv.bot_id;
    }

    // Record customer message
    const userMsgObj = {
      id: `msg-${uuidv4().substring(0, 8)}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString()
    };
    conv.messages.push(userMsgObj);

    // Process through Rule Engine
    const result = RuleEngine.processMessage(message, {
      ...conv.context,
      botId: conv.bot_id || botId,
      customer: conv.customer
    });

    // Update conversation context if state changed
    if (result.contextUpdates) {
      conv.context = { ...conv.context, ...result.contextUpdates };
    }

    // Record bot response
    const botMsgObj = {
      id: `msg-${uuidv4().substring(0, 8)}`,
      sender: 'bot',
      text: result.reply,
      matchedRule: result.matchedRule,
      dbActionExecuted: result.dbActionExecuted,
      dbQuery: result.dbQuery || null,
      richCard: result.richCard || null,
      quickReplies: result.quickReplies || [],
      timestamp: new Date().toISOString()
    };
    conv.messages.push(botMsgObj);
    conv.updated_at = new Date().toISOString();

    db.saveConversation(conv);

    return res.json({
      success: true,
      conversationId: conv.id,
      reply: result.reply,
      matchedRule: result.matchedRule,
      dbActionExecuted: result.dbActionExecuted,
      dbQuery: result.dbQuery || null,
      richCard: result.richCard || null,
      quickReplies: result.quickReplies || [],
      context: conv.context
    });
  } catch (err) {
    console.error('Error processing chat message:', err);
    return res.status(500).json({ success: false, error: 'Internal engine error' });
  }
});

// -------------------------------------------------------------
// RULES API (Rule Studio)
// -------------------------------------------------------------
app.get('/api/rules', (req, res) => {
  res.json({ success: true, rules: db.getRules() });
});

app.post('/api/rules', (req, res) => {
  const { name, intent, trigger_type, triggers, pattern, action_type, response_template, fallback_template, prompt_missing, quick_replies } = req.body;
  if (!name || !action_type) {
    return res.status(400).json({ success: false, error: 'Rule name and action_type are required' });
  }

  const newRule = {
    id: `rule-${uuidv4().substring(0, 8)}`,
    name,
    intent: intent || 'custom',
    trigger_type: trigger_type || 'keywords',
    triggers: Array.isArray(triggers) ? triggers : (triggers || '').split(',').map(s => s.trim()).filter(Boolean),
    pattern: pattern || null,
    action_type,
    response_template: response_template || '',
    fallback_template: fallback_template || '',
    prompt_missing: prompt_missing || '',
    quick_replies: Array.isArray(quick_replies) ? quick_replies : (quick_replies || '').split(',').map(s => s.trim()).filter(Boolean),
    is_active: true
  };

  db.saveRule(newRule);
  res.json({ success: true, rule: newRule });
});

app.put('/api/rules/:id', (req, res) => {
  const rule = db.saveRule({ id: req.params.id, ...req.body });
  res.json({ success: true, rule });
});

app.delete('/api/rules/:id', (req, res) => {
  db.deleteRule(req.params.id);
  res.json({ success: true, deleted: true });
});

app.post('/api/rules/:id/toggle', (req, res) => {
  const rule = db.toggleRule(req.params.id);
  res.json({ success: true, rule });
});

// -------------------------------------------------------------
// INBOX & AGENT CONSOLE API
// -------------------------------------------------------------
app.get('/api/inbox/conversations', (req, res) => {
  const convs = db.getConversations();
  res.json({ success: true, conversations: convs });
});

app.get('/api/inbox/conversation/:id', (req, res) => {
  const conv = db.getConversationById(req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });
  res.json({ success: true, conversation: conv });
});

app.post('/api/inbox/conversation/:id/reply', (req, res) => {
  const { text, agentName = 'Support Specialist' } = req.body;
  const conv = db.getConversationById(req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

  const agentMsg = {
    id: `msg-${uuidv4().substring(0, 8)}`,
    sender: 'agent',
    agentName,
    text,
    timestamp: new Date().toISOString()
  };

  conv.messages.push(agentMsg);
  conv.context.human_takeover = true;
  conv.updated_at = new Date().toISOString();
  db.saveConversation(conv);

  res.json({ success: true, message: agentMsg, conversation: conv });
});

app.post('/api/inbox/conversation/:id/takeover', (req, res) => {
  const { enabled } = req.body;
  const conv = db.getConversationById(req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

  conv.context.human_takeover = Boolean(enabled);
  conv.updated_at = new Date().toISOString();
  db.saveConversation(conv);

  res.json({ success: true, human_takeover: conv.context.human_takeover });
});

// -------------------------------------------------------------
// BOTS API (Multi-bot Management & Detail View)
// -------------------------------------------------------------
app.get('/api/bots', (req, res) => {
  res.json({ success: true, bots: db.getBots() });
});

app.get('/api/bots/:id', (req, res) => {
  const bot = db.getBotById(req.params.id);
  if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
  res.json({ success: true, bot });
});

app.post('/api/bots', (req, res) => {
  const { name, store_type, store_name, purpose, custom_qa, fallback_message, db_config, active_rules, theme } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Bot name is required' });
  }

  const botId = `bot-${uuidv4().substring(0, 8)}`;
  const normalizedPlatform = store_type || 'Custom Website';
  
  const initialQA = Array.isArray(custom_qa) ? custom_qa.map(q => ({
    id: `qa-${uuidv4().substring(0, 8)}`,
    question: q.question,
    answer: q.answer
  })) : [];

  const newBot = {
    id: botId,
    name,
    store_type: normalizedPlatform,
    store_name: store_name || name,
    theme: theme || 'black',
    status: 'active',
    purpose: purpose || 'Order Tracking, Stock Check & Customer Service',
    fallback_message: fallback_message || "I'm sorry, I don't have an exact answer for that yet. Would you like me to look up an order or connect you to our support team?",
    integration_status: 'connected',
    created_at: new Date().toISOString(),
    rules_count: (active_rules && active_rules.length) || 6,
    active_rules: active_rules || ['rule-order-track', 'rule-return-refund', 'rule-product-stock', 'rule-discounts', 'rule-human-escalate'],
    custom_qa: initialQA,
    unanswered_questions: [],
    restock_requests: [],
    db_config: db_config || {
      db_type: normalizedPlatform.includes('Shopify') ? 'Shopify Storefront API' : (normalizedPlatform.includes('WordPress') ? 'WooCommerce REST API' : 'Custom PostgreSQL / MySQL'),
      endpoint: 'http://localhost:3000/api/database',
      api_key: `key_${botId.substring(0, 8)}`,
      status: 'verified'
    },
    stats: {
      total_chats: 0,
      db_queries: 0,
      accuracy_rate: '100%',
      human_handoffs: 0
    }
  };

  db.saveBot(newBot);
  res.json({ success: true, bot: newBot });
});

app.delete('/api/bots/:id', (req, res) => {
  db.deleteBot(req.params.id);
  res.json({ success: true, deleted: true });
});

// Bot Custom Q&A Management
app.post('/api/bots/:id/qa', (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ success: false, error: 'Both question and answer are required' });
  }
  const added = db.addBotQA(req.params.id, { question, answer });
  if (!added) return res.status(404).json({ success: false, error: 'Bot not found' });
  res.json({ success: true, qa: added });
});

app.delete('/api/bots/:id/qa/:qaId', (req, res) => {
  const ok = db.deleteBotQA(req.params.id, req.params.qaId);
  res.json({ success: ok });
});

// Bot Unanswered Questions Log
app.get('/api/bots/:id/unanswered', (req, res) => {
  const bot = db.getBotById(req.params.id);
  if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
  res.json({ success: true, unanswered: bot.unanswered_questions || [] });
});

app.post('/api/bots/:id/unanswered/:qId/resolve', (req, res) => {
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ success: false, error: 'Answer is required' });
  const resolved = db.resolveUnansweredQuestion(req.params.id, req.params.qId, answer);
  if (!resolved) return res.status(404).json({ success: false, error: 'Question not found' });
  res.json({ success: true, resolved });
});

// Bot Restock Requests
app.get('/api/bots/:id/restock-requests', (req, res) => {
  const bot = db.getBotById(req.params.id);
  if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
  res.json({ success: true, restock_requests: bot.restock_requests || [] });
});

// Bot Database Access Verification
app.post('/api/bots/:id/verify-db', (req, res) => {
  const bot = db.getBotById(req.params.id);
  if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
  
  const orders = db.getOrders();
  const products = db.getProducts();
  res.json({
    success: true,
    status: 'connected',
    verified_at: new Date().toISOString(),
    details: {
      platform: bot.store_type,
      database_type: (bot.db_config && bot.db_config.db_type) || 'Store Database',
      orders_accessible: orders.length,
      products_accessible: products.length,
      latency_ms: 18,
      inventory_sync: 'Active & Real-Time'
    }
  });
});

// -------------------------------------------------------------
// AUTH API (Demo Session)
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = {
    name: email ? email.split('@')[0] : 'Store Merchant',
    email: email || 'merchant@rulemind.app',
    token: `token-${uuidv4().substring(0, 12)}`
  };
  res.json({ success: true, user });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, store_name } = req.body;
  const user = {
    name: name || 'Store Merchant',
    email: email || 'merchant@rulemind.app',
    store_name: store_name || 'My Store',
    token: `token-${uuidv4().substring(0, 12)}`
  };
  res.json({ success: true, user });
});

// -------------------------------------------------------------
// DATABASE EXPLORER API
// -------------------------------------------------------------
app.get('/api/database/orders', (req, res) => {
  res.json({ success: true, orders: db.getOrders() });
});

app.post('/api/database/orders', (req, res) => {
  const order = req.body;
  if (!order.order_id || !order.customer_name) {
    return res.status(400).json({ success: false, error: 'Missing required order fields' });
  }
  const created = db.addOrder({
    created_at: new Date().toISOString(),
    ...order
  });
  res.json({ success: true, order: created });
});

app.get('/api/database/products', (req, res) => {
  res.json({ success: true, products: db.getProducts() });
});

app.get('/api/database/customers', (req, res) => {
  res.json({ success: true, customers: db.getCustomers() });
});

app.get('/api/database/promotions', (req, res) => {
  res.json({ success: true, promotions: db.getPromotions() });
});

app.post('/api/database/reset', (req, res) => {
  const initial = db.resetDefaults();
  res.json({ success: true, message: 'Database reset to default seed', data: initial });
});

// -------------------------------------------------------------
// WEBHOOK INTEGRATIONS (Shopify & WordPress Sync)
// -------------------------------------------------------------
app.post('/api/integrations/shopify/webhook', (req, res) => {
  const topic = req.headers['x-shopify-topic'] || 'orders/create';
  const orderData = req.body;

  if (topic === 'orders/create' || topic === 'orders/updated') {
    const formatted = {
      order_id: String(orderData.id || orderData.order_number || Math.floor(1000 + Math.random() * 9000)),
      customer_name: (orderData.customer && `${orderData.customer.first_name} ${orderData.customer.last_name}`) || orderData.customer_name || 'Shopify Customer',
      customer_email: (orderData.customer && orderData.customer.email) || orderData.email || 'customer@shopify.store',
      source: 'Shopify',
      status: orderData.fulfillment_status === 'fulfilled' ? 'Shipped' : 'Processing',
      carrier: 'FedEx Expedited',
      tracking_code: orderData.tracking_number || `FX-${Math.floor(10000000 + Math.random() * 90000000)}`,
      estimated_delivery: 'In 2-3 business days',
      total_price: parseFloat(orderData.total_price || 99.00),
      currency: orderData.currency || 'USD',
      items: orderData.line_items ? orderData.line_items.map(it => ({ title: it.title, qty: it.quantity, price: parseFloat(it.price) })) : [{ title: 'Shopify Cart Item', qty: 1, price: 99.00 }],
      created_at: new Date().toISOString()
    };

    db.addOrder(formatted);
    return res.json({ success: true, synced_order: formatted });
  }

  res.json({ success: true, received: true });
});

app.post('/api/integrations/woocommerce/webhook', (req, res) => {
  const event = req.headers['x-wc-webhook-topic'] || 'order.created';
  const orderData = req.body;

  const formatted = {
    order_id: String(orderData.id || Math.floor(1000 + Math.random() * 9000)),
    customer_name: (orderData.billing && `${orderData.billing.first_name} ${orderData.billing.last_name}`) || 'WooCommerce Customer',
    customer_email: (orderData.billing && orderData.billing.email) || 'customer@wordpress.org',
    source: 'WordPress / WooCommerce',
    status: orderData.status === 'completed' ? 'Delivered' : 'Shipped',
    carrier: 'DHL Express',
    tracking_code: `DHL-${Math.floor(10000000 + Math.random() * 90000000)}`,
    estimated_delivery: 'In 1-2 business days',
    total_price: parseFloat(orderData.total || 75.00),
    currency: orderData.currency || 'USD',
    items: orderData.line_items ? orderData.line_items.map(it => ({ title: it.name, qty: it.quantity, price: parseFloat(it.price) })) : [{ title: 'WooCommerce Item', qty: 1, price: 75.00 }],
    created_at: new Date().toISOString()
  };

  db.addOrder(formatted);
  res.json({ success: true, synced_order: formatted });
});

// Catch-all route handler so unmatched requests return clean JSON instead of hanging
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'ENDPOINT_NOT_FOUND',
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl
  });
});

// Global error handler so requests never hang in serverless
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// Start standalone server when run directly (e.g. node server.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 RuleMind Server running on http://localhost:${PORT}`);
    console.log(`⚡ Zero-AI Deterministic Rule & DB Engine ready`);
    console.log(`🔌 Connectors ready for Shopify, WordPress & Custom Web`);
    console.log(`====================================================`);
  });
}

module.exports = app;
