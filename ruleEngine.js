const db = require('./db');

class RuleEngine {
  /**
   * Process incoming customer message against database rules
   * @param {string} message - Raw message from customer
   * @param {object} context - Session context (conversation history, customer data, state)
   */
  static processMessage(message, context = {}) {
    const rawText = String(message || '').trim();
    const lowerText = rawText.toLowerCase();
    const rules = db.getRules().filter(r => r.is_active).sort((a, b) => a.priority - b.priority);

    // Context continuation (e.g. user was prompted for order number in previous message)
    if (context.awaiting === 'order_id') {
      const orderMatch = rawText.match(/\b\d{3,8}\b/) || rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const queryValue = orderMatch ? orderMatch[0] : rawText;
      const orderRule = rules.find(r => r.id === 'rule-order-track') || rules.find(r => r.action_type === 'CHECK_ORDER');
      
      if (orderRule) {
        return this.executeOrderLookup(orderRule, queryValue, rawText);
      }
    }

    // Context continuation for human takeover
    if (context.human_takeover) {
      return {
        reply: "Your message has been added to the agent queue. A live team member will respond shortly.",
        matchedRule: { id: 'live-human-mode', name: 'Live Agent Queue Active', action_type: 'ESCALATE_HUMAN' },
        dbActionExecuted: false,
        quickReplies: ['Cancel human request', 'Track Order'],
        contextUpdates: { human_takeover: true }
      };
    }

    // Check Bot Specific Custom Q&A first
    const bot = context.botId ? db.getBotById(context.botId) : (db.getBots()[0] || null);
    if (bot && bot.custom_qa && Array.isArray(bot.custom_qa)) {
      for (const qa of bot.custom_qa) {
        if (!qa || !qa.question) continue;
        const qLower = qa.question.toLowerCase().trim();
        const keywords = qLower.split(/[\s,?]+/).filter(w => w.length > 3 && !['what', 'when', 'where', 'have', 'does', 'with', 'about', 'your'].includes(w));
        const matchedKeyword = keywords.length > 0 && keywords.some(k => lowerText.includes(k));
        
        if (lowerText.includes(qLower) || qLower.includes(lowerText) || matchedKeyword) {
          return {
            reply: qa.answer,
            matchedRule: { id: qa.id, name: `Custom Q&A: "${qa.question}"`, action_type: 'CUSTOM_QA' },
            dbActionExecuted: false,
            quickReplies: ['Ask another question', 'Track Order', 'Speak to Agent'],
            contextUpdates: {}
          };
        }
      }
    }

    // 1. Evaluate rules by priority
    for (const rule of rules) {
      let isMatch = false;
      let extractedEntity = null;

      // Pattern check (e.g. regex for order number #1042 or 1042)
      if (rule.pattern) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          const match = rawText.match(regex);
          if (match) {
            isMatch = true;
            extractedEntity = match[1] || match[0];
          }
        } catch (e) {
          console.error(`Regex error for rule ${rule.id}:`, e);
        }
      }

      // Keyword check
      if (!isMatch && Array.isArray(rule.triggers)) {
        for (const trigger of rule.triggers) {
          const t = trigger.toLowerCase().trim();
          if (lowerText.includes(t)) {
            isMatch = true;
            break;
          }
        }
      }

      // Exact match check
      if (!isMatch && rule.trigger_type === 'exact' && rule.triggers) {
        if (rule.triggers.some(t => t.toLowerCase().trim() === lowerText)) {
          isMatch = true;
        }
      }

      // If matched, execute corresponding Action
      if (isMatch) {
        return this.executeRuleAction(rule, rawText, lowerText, extractedEntity, context);
      }
    }

    // 2. Fallback if no rule matched (Log as Unanswered Question)
    if (bot && rawText.length > 2) {
      db.addUnansweredQuestion(bot.id, {
        question: rawText,
        customer: (context.customer && context.customer.email) || context.customerEmail || 'Guest Shopper'
      });
    }

    const customFallback = (bot && bot.fallback_message) ||
      "I'm sorry, I don't have an exact answer for that yet. Would you like me to check an order in our store database or connect you to our support specialist?";

    return {
      reply: customFallback,
      matchedRule: null,
      isUnanswered: true,
      dbActionExecuted: false,
      quickReplies: ['📦 Track Order #1042', '🔄 Return Policy', '🏷️ Product Stock', '🎉 Discount Codes', '👨‍💼 Speak to Agent'],
      contextUpdates: {}
    };
  }

  static executeRuleAction(rule, rawText, lowerText, extractedEntity, context) {
    switch (rule.action_type) {
      case 'CHECK_ORDER': {
        // Extract order ID or email
        let queryValue = extractedEntity;
        if (!queryValue) {
          const numberMatch = rawText.match(/\b\d{4,8}\b/);
          const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (numberMatch) queryValue = numberMatch[0];
          else if (emailMatch) queryValue = emailMatch[0];
        }

        if (!queryValue) {
          return {
            reply: rule.prompt_missing || "Please provide your 4-digit order number (e.g. #1042) or checkout email address.",
            matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
            dbActionExecuted: false,
            quickReplies: rule.quick_replies || ['Try #1042', 'Try #1043'],
            contextUpdates: { awaiting: 'order_id' }
          };
        }

        return this.executeOrderLookup(rule, queryValue, rawText);
      }

      case 'CHECK_PRODUCT': {
        // Extract product name
        let productQuery = rawText;
        const stopWords = ['stock', 'price', 'check', 'do you have', 'is', 'available', 'for', 'the', 'cost', 'inventory'];
        let cleanQuery = lowerText;
        stopWords.forEach(w => {
          cleanQuery = cleanQuery.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
        });
        cleanQuery = cleanQuery.trim();
        if (cleanQuery.length > 2) productQuery = cleanQuery;

        const product = db.findProduct(productQuery);
        if (product) {
          const isOutOfStock = !product.in_stock || product.stock_qty <= 0;
          const stockStatus = !isOutOfStock ? '🟢 In Stock (Ready to Ship)' : '🔴 Temporarily Out of Stock';
          let formatted = (rule.response_template || '')
            .replace(/{{title}}/g, product.title)
            .replace(/{{price}}/g, product.price.toFixed(2))
            .replace(/{{stock_status}}/g, stockStatus)
            .replace(/{{stock_qty}}/g, product.stock_qty)
            .replace(/{{sku}}/g, product.sku);

          if (isOutOfStock) {
            const targetBotId = context.botId || (db.getBots()[0] && db.getBots()[0].id);
            if (targetBotId) {
              db.addRestockRequest(targetBotId, {
                sku: product.sku,
                product_title: product.title,
                customer_email: (context.customer && context.customer.email) || 'guest@store.com'
              });
            }
            formatted += '\n\n🔔 *A restock request has been automatically logged for this product in your bot dashboard.*';
          }

          return {
            reply: formatted,
            matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
            dbActionExecuted: true,
            dbQuery: `SELECT * FROM products WHERE sku LIKE '%${productQuery}%' OR title LIKE '%${productQuery}%'`,
            richCard: {
              type: 'product',
              data: product
            },
            quickReplies: ['Check Another Product', 'Current Discounts', 'Track Order'],
            contextUpdates: { awaiting: null }
          };
        } else {
          let fallback = (rule.fallback_template || "Product not found.")
            .replace(/{{query}}/g, productQuery || rawText);

          return {
            reply: fallback,
            matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
            dbActionExecuted: true,
            dbQuery: `SELECT * FROM products WHERE query='${productQuery}' (0 results)`,
            quickReplies: ['Desk Mat', 'Keycaps', 'Light Bar', 'Speak to Agent'],
            contextUpdates: { awaiting: null }
          };
        }
      }

      case 'CHECK_PROMOTION': {
        const promos = db.getPromotions().filter(p => p.status === 'Active');
        const promoListStr = promos.map(p => `• **${p.code}** — **${p.discount}** (${p.description})`).join('\n');
        let formatted = (rule.response_template || '')
          .replace(/{{promotions_list}}/g, promoListStr);

        return {
          reply: formatted,
          matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
          dbActionExecuted: true,
          dbQuery: `SELECT * FROM promotions WHERE status = 'Active'`,
          richCard: {
            type: 'promotions',
            data: promos
          },
          quickReplies: rule.quick_replies || ['Browse Products', 'Track Order'],
          contextUpdates: { awaiting: null }
        };
      }

      case 'ESCALATE_HUMAN': {
        return {
          reply: rule.response_template || "Connecting you to a human agent...",
          matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
          dbActionExecuted: true,
          dbQuery: `UPDATE conversations SET human_takeover = true, status = 'queued'`,
          quickReplies: rule.quick_replies || ['Cancel', 'Track Order'],
          contextUpdates: { human_takeover: true, awaiting: null }
        };
      }

      case 'DIRECT_RESPONSE':
      default: {
        return {
          reply: rule.response_template || "Got it. Let us know if you need more details.",
          matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
          dbActionExecuted: false,
          quickReplies: rule.quick_replies || ['Track Order', 'Speak to Agent'],
          contextUpdates: { awaiting: null }
        };
      }
    }
  }

  static executeOrderLookup(rule, queryValue, rawText) {
    const order = db.findOrder(queryValue);

    if (order) {
      const itemsList = order.items.map(it => `  • ${it.qty}x ${it.title} ($${it.price.toFixed(2)})`).join('\n');
      let formatted = (rule.response_template || '')
        .replace(/{{order_id}}/g, order.order_id)
        .replace(/{{customer_name}}/g, order.customer_name)
        .replace(/{{status}}/g, order.status)
        .replace(/{{carrier}}/g, order.carrier)
        .replace(/{{tracking_code}}/g, order.tracking_code)
        .replace(/{{estimated_delivery}}/g, order.estimated_delivery)
        .replace(/{{total_price}}/g, order.total_price.toFixed(2))
        .replace(/{{items_list}}/g, itemsList);

      return {
        reply: formatted,
        matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
        dbActionExecuted: true,
        dbQuery: `SELECT * FROM orders WHERE order_id = '${order.order_id}' OR customer_email = '${order.customer_email}'`,
        richCard: {
          type: 'order',
          data: order
        },
        quickReplies: ['Return Policy', 'Speak to Agent', 'Track Another Order'],
        contextUpdates: { awaiting: null, active_order_id: order.order_id }
      };
    } else {
      let fallback = (rule.fallback_template || "Order not found in database.")
        .replace(/{{query}}/g, queryValue);

      return {
        reply: fallback,
        matchedRule: { id: rule.id, name: rule.name, action_type: rule.action_type },
        dbActionExecuted: true,
        dbQuery: `SELECT * FROM orders WHERE query = '${queryValue}' (0 results)`,
        quickReplies: ['Try #1042', 'Try #1043', 'Speak to Agent'],
        contextUpdates: { awaiting: 'order_id' }
      };
    }
  }
}

module.exports = RuleEngine;
