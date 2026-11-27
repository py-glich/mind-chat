/**
 * RuleMind Embeddable Chat Widget
 * Minimalist Black Theme • Zero-AI Deterministic Rule Engine
 * Compatible with: Shopify, WordPress / WooCommerce, Custom HTML Websites
 */
(function() {
  if (window.RuleMindWidget) return;

  // 1. Detect script attributes
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.includes('widget.js')) return scripts[i];
    }
    return null;
  })();

  const SERVER_URL = (currentScript && currentScript.getAttribute('data-server')) || window.location.origin;
  let currentBotId = (currentScript && currentScript.getAttribute('data-bot-id')) || 'bot-default';
  const STORE_SOURCE = (currentScript && currentScript.getAttribute('data-source')) || 'Storefront Web';
  const CUST_NAME = (currentScript && currentScript.getAttribute('data-customer-name')) || 'Store Visitor';
  const CUST_EMAIL = (currentScript && currentScript.getAttribute('data-customer-email')) || 'visitor@store.com';

  const STORAGE_KEY = 'rulemind_conv_id';
  let conversationId = localStorage.getItem(STORAGE_KEY) || null;
  let isOpen = false;

  // 2. Inject CSS
  const style = document.createElement('style');
  style.id = 'rulemind-widget-styles';
  style.textContent = `
    .rm-widget-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Launcher Button */
    .rm-launcher {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #090a14;
      color: #ffffff;
      border: 1px solid rgba(139, 92, 246, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8), 0 0 18px rgba(99, 102, 241, 0.25);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

    .rm-launcher:hover {
      transform: scale(1.06);
      border-color: rgba(168, 85, 247, 0.6);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.9), 0 0 25px rgba(99, 102, 241, 0.45);
    }

    .rm-launcher-icon {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 0.2s ease;
    }

    .rm-launcher .rm-status-dot {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      background: #10b981;
      border: 2px solid #090a14;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }

    /* Chat Window */
    .rm-chat-box {
      position: absolute;
      bottom: 74px;
      right: 0;
      width: 380px;
      height: 560px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 110px);
      background: #090a14;
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 30px rgba(99, 102, 241, 0.15);
      opacity: 0;
      transform: translateY(12px) scale(0.97);
      pointer-events: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .rm-chat-box.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    .rm-header {
      padding: 14px 18px;
      background: #0e1020;
      border-bottom: 1px solid rgba(139, 92, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rm-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rm-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4338ca 0%, #7c3aed 100%);
      color: #ffffff;
      border: 1px solid rgba(168, 85, 247, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
    }

    .rm-title-group h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
    }

    .rm-subtitle {
      font-size: 11px;
      color: #a5b4fc;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rm-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .rm-close-btn:hover {
      color: #ffffff;
      background: #1e2038;
    }

    /* Message Body */
    .rm-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #07070d;
    }

    .rm-msg {
      max-width: 82%;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
      animation: rmFade 0.2s ease forwards;
    }

    @keyframes rmFade {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .rm-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 14px 14px 2px 14px;
      border: 1px solid rgba(168, 85, 247, 0.3);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }

    .rm-msg.bot {
      align-self: flex-start;
      background: #0f1022;
      color: #e2e8f0;
      padding: 12px 14px;
      border-radius: 14px 14px 14px 2px;
      border: 1px solid rgba(139, 92, 246, 0.2);
    }

    .rm-msg.agent {
      align-self: flex-start;
      background: #0d281e;
      color: #ffffff;
      padding: 12px 14px;
      border-radius: 14px 14px 14px 2px;
      border: 1px solid #10b981;
    }

    .rm-rule-badge {
      font-size: 10px;
      color: #a5b4fc;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: monospace;
    }

    /* Cards */
    .rm-card {
      background: #0c0d18;
      border: 1px solid rgba(139, 92, 246, 0.22);
      border-radius: 10px;
      padding: 12px;
      margin-top: 8px;
    }

    .rm-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .rm-status-pill {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 10px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #10b981;
      font-weight: 600;
      text-transform: uppercase;
    }

    /* Quick Reply Chips */
    .rm-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .rm-chip {
      background: #121428;
      border: 1px solid rgba(139, 92, 246, 0.25);
      color: #cbd5e1;
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .rm-chip:hover {
      background: #1a1d38;
      color: #ffffff;
      border-color: rgba(168, 85, 247, 0.45);
    }

    /* Footer Input */
    .rm-footer {
      padding: 12px;
      background: #0e1020;
      border-top: 1px solid rgba(139, 92, 246, 0.18);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rm-input {
      flex: 1;
      background: #070812;
      border: 1px solid rgba(139, 92, 246, 0.22);
      border-radius: 8px;
      padding: 10px 12px;
      color: #ffffff;
      font-size: 13px;
      font-family: inherit;
    }

    .rm-input:focus {
      outline: none;
      border-color: #818cf8;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
    }

    .rm-send-btn {
      background: linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #7c3aed 100%);
      color: #ffffff;
      border: 1px solid rgba(168, 85, 247, 0.3);
      border-radius: 8px;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .rm-send-btn:hover {
      filter: brightness(1.1);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
    }

    .rm-watermark {
      text-align: center;
      font-size: 10px;
      color: #818cf8;
      padding: 4px;
      background: #0b0c18;
      border-top: 1px solid rgba(139, 92, 246, 0.15);
    }
  `;
  document.head.appendChild(style);

  // 3. Create DOM Elements
  const root = document.createElement('div');
  root.className = 'rm-widget-root';
  root.innerHTML = `
    <!-- Floating Launcher -->
    <div class="rm-launcher" id="rm-launcher" title="Support Chat">
      <svg class="rm-launcher-icon" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <div class="rm-status-dot"></div>
    </div>

    <!-- Chat Box -->
    <div class="rm-chat-box" id="rm-chat-box">
      <!-- Header -->
      <div class="rm-header">
        <div class="rm-header-info">
          <div class="rm-avatar">RM</div>
          <div class="rm-title-group">
            <h4>RuleMind Support</h4>
            <div class="rm-subtitle">
              <span>●</span> Connected: ${STORE_SOURCE}
            </div>
          </div>
        </div>
        <button class="rm-close-btn" id="rm-close-btn">&times;</button>
      </div>

      <!-- Messages Stream -->
      <div class="rm-body" id="rm-body">
        <div class="rm-msg bot">
          👋 Welcome to our store support desk! I am powered by deterministic store rules and live database lookups.<br><br>
          How can I help you today?
          <div class="rm-quick-replies">
            <button class="rm-chip" onclick="RuleMindWidget.send('Track order #1042')">📦 Track Order #1042</button>
            <button class="rm-chip" onclick="RuleMindWidget.send('Return Policy')">🔄 Return Policy</button>
            <button class="rm-chip" onclick="RuleMindWidget.send('Check desk mat stock')">🏷️ Check Stock</button>
            <button class="rm-chip" onclick="RuleMindWidget.send('Active discount codes')">🎉 Promo Codes</button>
            <button class="rm-chip" onclick="RuleMindWidget.send('Speak to human representative')">👨‍💼 Human Agent</button>
          </div>
        </div>
      </div>

      <!-- Footer Input -->
      <form class="rm-footer" id="rm-form">
        <input type="text" class="rm-input" id="rm-input" placeholder="Type order #, product, or question..." autocomplete="off">
        <button type="submit" class="rm-send-btn">Send</button>
      </form>

      <div class="rm-watermark">
        ⚡ Zero-AI Deterministic Rule Engine
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // 4. Widget Logic
  const launcher = document.getElementById('rm-launcher');
  const chatBox = document.getElementById('rm-chat-box');
  const closeBtn = document.getElementById('rm-close-btn');
  const form = document.getElementById('rm-form');
  const input = document.getElementById('rm-input');
  const body = document.getElementById('rm-body');

  function toggle(open) {
    isOpen = (typeof open === 'boolean') ? open : !isOpen;
    chatBox.classList.toggle('open', isOpen);
    if (isOpen) {
      setTimeout(() => input.focus(), 150);
    }
  }

  launcher.addEventListener('click', () => toggle());
  closeBtn.addEventListener('click', () => toggle(false));

  function appendMessage(sender, text, options = {}) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `rm-msg ${sender}`;

    // Markdown simple parse
    let parsedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    msgDiv.innerHTML = parsedText;

    // Rule info badge
    if (options.matchedRule) {
      const badge = document.createElement('div');
      badge.className = 'rm-rule-badge';
      badge.innerHTML = `⚡ Rule: ${options.matchedRule.name}`;
      msgDiv.appendChild(badge);
    }

    // Rich Cards (e.g. Order Tracking)
    if (options.richCard && options.richCard.type === 'order') {
      const order = options.richCard.data;
      const card = document.createElement('div');
      card.className = 'rm-card';
      card.innerHTML = `
        <div class="rm-card-header">
          <span>Order #${order.order_id}</span>
          <span class="rm-status-pill">${order.status}</span>
        </div>
        <div style="font-size:11px; color:#a1a1aa; line-height:1.4;">
          <strong>Carrier:</strong> ${order.carrier}<br>
          <strong>Tracking:</strong> <code>${order.tracking_code}</code><br>
          <strong>Est. Delivery:</strong> ${order.estimated_delivery}
        </div>
      `;
      msgDiv.appendChild(card);
    }

    // Quick Replies
    if (options.quickReplies && options.quickReplies.length > 0) {
      const qrDiv = document.createElement('div');
      qrDiv.className = 'rm-quick-replies';
      options.quickReplies.forEach(qr => {
        const btn = document.createElement('button');
        btn.className = 'rm-chip';
        btn.type = 'button';
        btn.textContent = qr;
        btn.onclick = () => sendMessage(qr);
        qrDiv.appendChild(btn);
      });
      msgDiv.appendChild(qrDiv);
    }

    body.appendChild(msgDiv);
    body.scrollTop = body.scrollHeight;
  }

  async function sendMessage(text) {
    const msg = (text || input.value).trim();
    if (!msg) return;

    if (!text) input.value = '';

    appendMessage('user', msg);

    try {
      const res = await fetch(`${SERVER_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId,
          botId: currentBotId,
          message: msg,
          source: STORE_SOURCE,
          customer: {
            name: CUST_NAME,
            email: CUST_EMAIL
          }
        })
      });

      const data = await res.json();
      if (data.conversationId) {
        conversationId = data.conversationId;
        localStorage.setItem(STORAGE_KEY, conversationId);
      }

      appendMessage('bot', data.reply, {
        matchedRule: data.matchedRule,
        richCard: data.richCard,
        quickReplies: data.quickReplies
      });

    } catch (err) {
      console.error('RuleMind send error:', err);
      appendMessage('bot', '⚠️ Connection error. Please ensure the RuleMind backend is running.');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Global API
  window.RuleMindWidget = {
    toggle,
    open: () => { if (!isOpen) toggle(); },
    close: () => { if (isOpen) toggle(); },
    send: sendMessage,
    setBotId: (id) => { currentBotId = id; }
  };
})();
