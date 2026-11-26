// MindChat / RuleMind Controller
const app = {
  currentUser: null,
  activeBotId: 'bot-default',
  bots: [],
  currentDashTab: 'sub-inbox',
  activeConvId: null,
  activeDbTab: 'orders',
  rules: [],
  conversations: [],

  // Wizard state
  wizardData: {
    platform: 'Shopify Storefront',
    botName: 'Apex Minimalist Support',
    rules: []
  },

  init() {
    this.checkAuth();
    this.loadBots();
    this.loadRules();
    this.loadConversations();
    this.loadDatabaseData();
    this.startPolling();
  },

  // -------------------------------------------------------------
  // AUTHENTICATION
  // -------------------------------------------------------------
  checkAuth() {
    const saved = localStorage.getItem('rulemind_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.updateNavUser();
      } catch (e) {}
    }
  },

  updateNavUser() {
    const guestNav = document.getElementById('nav-guest-actions');
    const userNav = document.getElementById('nav-user-actions');

    if (this.currentUser) {
      guestNav.style.display = 'none';
      userNav.classList.add('active');
      document.getElementById('nav-user-name').textContent = this.currentUser.name || 'Merchant';
      document.getElementById('nav-user-avatar').textContent = (this.currentUser.name || 'M').charAt(0).toUpperCase();
    } else {
      guestNav.style.display = 'flex';
      userNav.classList.remove('active');
    }
  },

  openAuthModal(mode = 'login') {
    document.getElementById('modal-auth').classList.add('active');
    this.switchAuthMode(mode);
  },

  closeAuthModal() {
    document.getElementById('modal-auth').classList.remove('active');
  },

  switchAuthMode(mode) {
    const isLogin = mode === 'login';
    document.getElementById('auth-tab-login').classList.toggle('active', isLogin);
    document.getElementById('auth-tab-signup').classList.toggle('active', !isLogin);
    document.getElementById('auth-form-login').style.display = isLogin ? 'block' : 'none';
    document.getElementById('auth-form-signup').style.display = !isLogin ? 'block' : 'none';
  },

  async handleAuth(e, mode) {
    e.preventDefault();
    let email, name;
    if (mode === 'login') {
      email = document.getElementById('login-email').value;
      name = email.split('@')[0];
    } else {
      name = document.getElementById('signup-name').value;
      email = document.getElementById('signup-email').value;
    }

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('rulemind_user', JSON.stringify(this.currentUser));
        this.updateNavUser();
        this.closeAuthModal();
        this.showDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  },

  quickDemoLogin() {
    this.currentUser = {
      name: 'Shopify Merchant',
      email: 'merchant@apex-gear.store',
      token: 'demo-token-123'
    };
    localStorage.setItem('rulemind_user', JSON.stringify(this.currentUser));
    this.updateNavUser();
    this.closeAuthModal();
    this.showDashboard();
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('rulemind_user');
    this.updateNavUser();
    this.showLanding();
  },

  // -------------------------------------------------------------
  // VIEW SWITCHING (Homepage vs Dashboard)
  // -------------------------------------------------------------
  showLanding() {
    document.getElementById('view-homepage').style.display = 'block';
    document.getElementById('view-dashboard').classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showDashboard() {
    if (!this.currentUser) {
      this.openAuthModal('login');
      return;
    }
    document.getElementById('view-homepage').style.display = 'none';
    document.getElementById('view-dashboard').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadConversations();
  },

  scrollToSection(id) {
    this.showLanding();
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  },

  // -------------------------------------------------------------
  // DASHBOARD & MULTI-BOT LOGIC
  // -------------------------------------------------------------
  async loadBots() {
    try {
      const res = await fetch('/api/bots');
      const data = await res.json();
      this.bots = data.bots || [];
      this.renderBotDropdown();
    } catch (e) {
      console.error(e);
    }
  },

  renderBotDropdown() {
    const select = document.getElementById('dash-bot-select');
    if (!select) return;

    select.innerHTML = this.bots.map(b => `
      <option value="${b.id}" ${b.id === this.activeBotId ? 'selected' : ''}>
        ${this.escapeHtml(b.name)}
      </option>
    `).join('');

    const currentBot = this.bots.find(b => b.id === this.activeBotId) || this.bots[0];
    if (currentBot) {
      document.getElementById('dash-bot-platform-badge').textContent = currentBot.store_type || 'Shopify Storefront';
      if (currentBot.stats) {
        document.getElementById('kpi-chats').textContent = currentBot.stats.total_chats;
        document.getElementById('kpi-queries').textContent = currentBot.stats.db_queries;
        document.getElementById('kpi-handoffs').textContent = currentBot.stats.human_handoffs;
      }
    }
  },

  switchActiveBot(botId) {
    this.activeBotId = botId;
    this.renderBotDropdown();
  },

  switchDashTab(subviewId, btn) {
    this.currentDashTab = subviewId;
    document.querySelectorAll('.dash-nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.dash-subview').forEach(v => v.classList.remove('active'));
    document.getElementById(subviewId).classList.add('active');

    if (subviewId === 'sub-inbox') {
      this.refreshInbox();
    } else if (subviewId === 'sub-rules') {
      this.loadRules();
    } else if (subviewId === 'sub-database') {
      this.loadDatabaseData();
    }
  },

  // -------------------------------------------------------------
  // ANIMATED STAR WIZARD ("Say Hi & Start Asking What Bot You Want")
  // -------------------------------------------------------------
  launchStarWizard() {
    document.getElementById('modal-star-wizard').classList.add('active');
    this.setStarSpeech("Hi there! ✨ I'm your RuleMind Architect. Let's create your new custom bot together!");
    this.showWizardStep(1);
  },

  closeStarWizard() {
    document.getElementById('modal-star-wizard').classList.remove('active');
  },

  setStarSpeech(text) {
    const el = document.getElementById('star-speech-text');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = text;
      el.style.opacity = '1';
    }, 150);
  },

  showWizardStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    const stepEl = document.getElementById(`star-step-${stepNum}`);
    if (stepEl) stepEl.classList.add('active');
  },

  selectWizardPlatform(platform, el) {
    this.wizardData.platform = platform;
    document.querySelectorAll('.store-option-card').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  nextWizardStep(stepNum) {
    if (stepNum === 2) {
      this.setStarSpeech(`Great choice! 🛍️ What should we name your new ${this.wizardData.platform} bot?`);
    } else if (stepNum === 3) {
      const nameInput = document.getElementById('wizard-bot-name');
      this.wizardData.botName = nameInput ? nameInput.value.trim() : 'Apex Support';
      this.setStarSpeech(`Love that name! ✨ Now tell me, which database rules and features should this bot have?`);
    }
    this.showWizardStep(stepNum);
  },

  prevWizardStep(stepNum) {
    if (stepNum === 1) {
      this.setStarSpeech("Let's pick your store platform first! 🛍️");
    } else if (stepNum === 2) {
      this.setStarSpeech("You can adjust the bot name here! ✏️");
    }
    this.showWizardStep(stepNum);
  },

  async finishCreateBot() {
    this.setStarSpeech("Woohoo! 🚀 Creating your custom bot and linking it to your store database...");

    const activeRules = [];
    document.querySelectorAll('.wizard-rule-check input:checked').forEach(c => activeRules.push(c.value));
    this.wizardData.rules = activeRules;

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.wizardData.botName || 'New Store Agent',
          store_type: this.wizardData.platform,
          store_name: this.wizardData.botName,
          active_rules: this.wizardData.rules,
          theme: 'black'
        })
      });

      const data = await res.json();
      if (data.success) {
        setTimeout(() => {
          this.setStarSpeech(`All set! 🎉 Your new agent "${data.bot.name}" is live!`);
          setTimeout(() => {
            this.closeStarWizard();
            this.loadBots();
            this.activeBotId = data.bot.id;
            this.showDashboard();
            alert(`🎉 Success! Your new bot "${data.bot.name}" has been created and wired to your database!`);
          }, 1200);
        }, 800);
      }
    } catch (e) {
      console.error(e);
      alert('Error creating bot.');
    }
  },

  // -------------------------------------------------------------
  // TOUR SECTION TABS ON HOMEPAGE
  // -------------------------------------------------------------
  setTourTab(tabKey, btn) {
    document.querySelectorAll('.tour-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const titleEl = document.getElementById('tour-title');
    const descEl = document.getElementById('tour-desc');
    const gridEl = document.getElementById('tour-grid-items');

    if (tabKey === 'dashboard') {
      titleEl.textContent = 'The whole business, at a single glance';
      descEl.textContent = 'Real-time order statuses, database inquiries, and conversion attribution.';
      gridEl.innerHTML = `
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Sub-50ms Lookups</div>
          <div style="font-size:1.8rem; font-weight:800; color:#fff; margin:0.4rem 0;">41ms</div>
          <div style="font-size:0.78rem; color:var(--accent-green);">Instant order retrieval from database</div>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">AI Hallucinations</div>
          <div style="font-size:1.8rem; font-weight:800; color:var(--accent-blue); margin:0.4rem 0;">0.0%</div>
          <div style="font-size:0.78rem; color:var(--text-secondary);">100% verified against store records</div>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Live Automations</div>
          <div style="font-size:1.8rem; font-weight:800; color:#fff; margin:0.4rem 0;">99.2%</div>
          <div style="font-size:0.78rem; color:var(--accent-green);">Orders, inventory, coupons & returns</div>
        </div>
      `;
    } else if (tabKey === 'inbox') {
      titleEl.textContent = 'Omnichannel Unified Support Desk';
      descEl.textContent = 'Shopify customer chats, WooCommerce orders, and custom web visitors in one shared queue.';
      gridEl.innerHTML = `
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Unified Identity</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Merges customer emails, past orders, and notes across channels.</p>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Zero-Lag Delivery</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Real-time bi-directional messaging with live typing signals.</p>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">1-Click Escalation</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Instant human agent takeover when shoppers need personal attention.</p>
        </div>
      `;
    } else if (tabKey === 'rules') {
      titleEl.textContent = 'Precision Decision Engine';
      descEl.textContent = 'If Condition → Query Database → Answer That. Absolute accuracy with zero guesswork.';
      gridEl.innerHTML = `
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-family:monospace; color:var(--accent-green); font-size:0.75rem;">CHECK_ORDER</div>
          <div style="font-weight:700; margin:4px 0;">Order Tracking</div>
          <div style="font-size:0.78rem; color:var(--text-secondary);">Direct SQL lookup of shipping status & carrier.</div>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-family:monospace; color:var(--accent-blue); font-size:0.75rem;">CHECK_PRODUCT</div>
          <div style="font-weight:700; margin:4px 0;">Warehouse Stock</div>
          <div style="font-size:0.78rem; color:var(--text-secondary);">Live inventory counts and backorder status.</div>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-family:monospace; color:#f59e0b; font-size:0.75rem;">CHECK_PROMO</div>
          <div style="font-weight:700; margin:4px 0;">Discount Codes</div>
          <div style="font-size:0.78rem; color:var(--text-secondary);">Validates active vouchers & cart requirements.</div>
        </div>
      `;
    } else if (tabKey === 'customers') {
      titleEl.textContent = 'Customer 360 & Net Lifetime Value';
      descEl.textContent = 'See total spent, repeat purchase frequency, and risk tiers before answering.';
      gridEl.innerHTML = `
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Net LTV Tracking</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Calculates total gross purchases minus returns in real time.</p>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Automated Segmentation</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">VIP buyer tags, first-time shopper badges, and corporate flags.</p>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Return Risk Profiling</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Historical return analysis to prevent abusive return behavior.</p>
        </div>
      `;
    } else if (tabKey === 'connectors') {
      titleEl.textContent = 'Shopify & WordPress Native Integrations';
      descEl.textContent = '1-line liquid embed, WordPress child theme functions, and webhooks.';
      gridEl.innerHTML = `
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Shopify Theme Embed</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Zero manual setup. Paste once inside theme.liquid.</p>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">WooCommerce Hooks</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Synchronizes order completions directly with your DB.</p>
        </div>
        <div style="background:#13131c; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
          <div style="font-weight:700;">Custom Web / React / Vue</div>
          <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:6px;">Single async script tag for any headless frontend.</p>
        </div>
      `;
    }
  },

  // Mock conversation switcher on Hero Mockup
  mockSelect(person) {
    const stream = document.getElementById('mock-chat-stream');
    const title = document.getElementById('mock-chat-title');
    const badge = document.getElementById('mock-chat-badge');

    if (person === 'jane') {
      title.textContent = 'Jane Doe';
      badge.textContent = 'Shopify Storefront';
      stream.innerHTML = `
        <div class="mock-msg user">Hi, where is my order #1042?</div>
        <div class="mock-msg bot">
          📦 <strong>Order #1042 Verified in Database!</strong><br><br>
          • <strong>Customer:</strong> Jane Doe<br>
          • <strong>Status:</strong> Out for Delivery<br>
          • <strong>Carrier:</strong> FedEx Home Delivery<br>
          • <strong>Estimated Delivery:</strong> Today by 5:30 PM<br>
          • <strong>Total:</strong> $108.00
          <div class="mock-card">
            <div style="display:flex; justify-content:space-between; font-weight:700;">
              <span>Tracking: FX-982194821</span>
              <span style="color:var(--accent-green);">ON TIME</span>
            </div>
            <div style="color:var(--text-secondary); font-size:0.72rem; margin-top:4px;">
              1x Minimalist Matte Black Desk Mat, 1x Stealth Keycaps
            </div>
          </div>
        </div>
      `;
    } else if (person === 'alex') {
      title.textContent = 'Alex Smith';
      badge.textContent = 'WooCommerce Store';
      stream.innerHTML = `
        <div class="mock-msg user">Do you have the stealth black keycaps in stock?</div>
        <div class="mock-msg bot">
          🏷️ <strong>Product Verified in Database!</strong><br><br>
          • <strong>Product:</strong> Stealth Black PBT Keycaps Set<br>
          • <strong>Price:</strong> $69.00<br>
          • <strong>Availability:</strong> 🟢 In Stock (Ready to Ship)<br>
          • <strong>Warehouse Qty:</strong> 15 units remaining<br>
          • <strong>SKU:</strong> <code>SKU-002</code>
        </div>
      `;
    } else if (person === 'sarah') {
      title.textContent = 'Sarah Connor';
      badge.textContent = 'Custom Web';
      stream.innerHTML = `
        <div class="mock-msg user">I need to talk to a human agent please.</div>
        <div class="mock-msg bot">
          👨‍💼 <strong>Routing you to a Live Support Agent...</strong><br><br>
          • Queue Status: Next in line<br>
          • Agent Notification: Sent to dashboard<br>
          A specialist is joining this thread right now.
        </div>
      `;
    }
  },

  triggerDemoChat() {
    if (window.RuleMindWidget && window.RuleMindWidget.toggle) {
      window.RuleMindWidget.toggle(true);
    } else {
      window.open('/demo-store.html', '_blank');
    }
  },

  // -------------------------------------------------------------
  // INBOX LOGIC
  // -------------------------------------------------------------
  async loadConversations() {
    try {
      const res = await fetch('/api/inbox/conversations');
      const data = await res.json();
      this.conversations = data.conversations || [];

      const countBadge = document.getElementById('dash-inbox-count');
      if (countBadge) countBadge.textContent = this.conversations.length;

      this.renderConversationList();

      if (this.activeConvId) {
        this.selectConversation(this.activeConvId, false);
      } else if (this.conversations.length > 0) {
        this.selectConversation(this.conversations[0].id, true);
      }
    } catch (err) {
      console.error(err);
    }
  },

  renderConversationList() {
    const listEl = document.getElementById('inbox-conv-list');
    if (!listEl) return;

    if (this.conversations.length === 0) {
      listEl.innerHTML = `
        <li style="padding:2rem 1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
          No customer conversations yet.<br>Test the widget on the demo store to start one!
        </li>
      `;
      return;
    }

    listEl.innerHTML = this.conversations.map(c => {
      const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : { text: 'Session started', timestamp: c.created_at };
      const isActive = c.id === this.activeConvId ? 'active' : '';
      const timeStr = new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const takeoverBadge = c.context && c.context.human_takeover ? '<span class="badge-takeover">Human Active</span>' : '';

      return `
        <li class="conv-item ${isActive}" onclick="app.selectConversation('${c.id}', true)">
          <div class="conv-header">
            <span class="conv-name">${this.escapeHtml(c.customer.name || 'Store Visitor')}</span>
            <span class="conv-time">${timeStr}</span>
          </div>
          <div class="conv-preview">${this.escapeHtml(lastMsg.text)}</div>
          <div class="conv-badges">
            <span class="badge-channel">${c.source || 'Store Web'}</span>
            ${takeoverBadge}
          </div>
        </li>
      `;
    }).join('');
  },

  async selectConversation(convId, scrollToBottom = true) {
    this.activeConvId = convId;
    this.renderConversationList();

    const conv = this.conversations.find(c => c.id === convId);
    if (!conv) return;

    const nameEl = document.getElementById('chat-header-name');
    const emailEl = document.getElementById('chat-header-email');
    const avatarEl = document.getElementById('chat-header-avatar');
    if (nameEl) nameEl.textContent = conv.customer.name || 'Store Visitor';
    if (emailEl) emailEl.textContent = `${conv.customer.email || 'visitor@guest.com'} • Channel: ${conv.source || 'Store Web'}`;
    if (avatarEl) avatarEl.textContent = (conv.customer.name || 'V').charAt(0).toUpperCase();

    const takeoverBtn = document.getElementById('btn-toggle-takeover');
    if (takeoverBtn) {
      if (conv.context && conv.context.human_takeover) {
        takeoverBtn.textContent = 'Release to Auto-Bot';
        takeoverBtn.className = 'btn btn-primary btn-sm';
      } else {
        takeoverBtn.textContent = 'Take Over Conversation';
        takeoverBtn.className = 'btn btn-secondary btn-sm';
      }
    }

    const msgContainer = document.getElementById('chat-messages-container');
    if (msgContainer) {
      msgContainer.innerHTML = conv.messages.map(m => {
        const isUser = m.sender === 'user';
        const isAgent = m.sender === 'agent';
        const senderClass = isUser ? 'user' : (isAgent ? 'agent' : 'bot');
        const senderLabel = isUser ? (conv.customer.name || 'Customer') : (isAgent ? `Support Agent (${m.agentName || 'You'})` : 'RuleMind Engine');
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let ruleDebugHtml = '';
        if (m.matchedRule) {
          ruleDebugHtml = `<div class="msg-rule-debug">⚡ Rule: ${m.matchedRule.name} ${m.dbActionExecuted ? '| DB Query Executed' : ''}</div>`;
        }

        return `
          <div class="msg-row ${senderClass}">
            <div class="msg-meta">
              <span>${senderLabel}</span>
              <span>•</span>
              <span>${timeStr}</span>
            </div>
            <div class="msg-body">${this.formatMarkdown(m.text)}</div>
            ${ruleDebugHtml}
          </div>
        `;
      }).join('');

      if (scrollToBottom) {
        msgContainer.scrollTop = msgContainer.scrollHeight;
      }
    }

    this.updateCustomer360(conv);
  },

  async updateCustomer360(conv) {
    const custName = conv.customer.name || 'Store Visitor';
    const custEmail = conv.customer.email || 'visitor@guest.com';

    const nameEl = document.getElementById('cust-360-name');
    if (!nameEl) return;

    nameEl.textContent = custName;
    document.getElementById('cust-360-email').textContent = custEmail;
    document.getElementById('cust-360-channel').textContent = `Source: ${conv.source || 'Storefront'}`;

    try {
      const res = await fetch('/api/database/orders');
      const data = await res.json();
      const userOrders = data.orders.filter(o => 
        (conv.customer.email && o.customer_email.toLowerCase() === conv.customer.email.toLowerCase()) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(custName.toLowerCase()))
      );

      const totalSpent = userOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      document.getElementById('cust-360-ltv').textContent = `$${totalSpent.toFixed(2)}`;
      document.getElementById('cust-360-orders').textContent = userOrders.length;

      const ordersListEl = document.getElementById('cust-360-orders-list');
      if (userOrders.length === 0) {
        ordersListEl.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted);">No past orders found for this email.</div>`;
      } else {
        ordersListEl.innerHTML = userOrders.map(o => `
          <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:0.65rem;">
            <div style="display:flex; justify-content:space-between; font-weight:600; font-size:0.82rem;">
              <span>Order #${o.order_id}</span>
              <span style="color:var(--accent-green);">$${o.total_price.toFixed(2)}</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
              Status: <strong>${o.status}</strong> (${o.carrier})
            </div>
          </div>
        `).join('');
      }

      const diagEl = document.getElementById('cust-360-diagnostics');
      const lastBotMsg = [...conv.messages].reverse().find(m => m.sender === 'bot');
      if (lastBotMsg && lastBotMsg.matchedRule) {
        diagEl.innerHTML = `
          <strong>Active Rule:</strong> ${lastBotMsg.matchedRule.name}<br>
          <strong>Action Type:</strong> ${lastBotMsg.matchedRule.action_type}<br>
          <strong>DB Query:</strong> ${lastBotMsg.dbQuery || 'None'}<br>
          <strong>State Awaiting:</strong> ${conv.context ? conv.context.awaiting || 'None' : 'None'}
        `;
      } else {
        diagEl.innerHTML = 'No active rule evaluation';
      }
    } catch (e) {
      console.error(e);
    }
  },

  async sendAgentReply() {
    if (!this.activeConvId) {
      alert('Please select a conversation first.');
      return;
    }
    const input = document.getElementById('agent-reply-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    try {
      const res = await fetch(`/api/inbox/conversation/${this.activeConvId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, agentName: 'Support Agent' })
      });
      const data = await res.json();
      if (data.success) {
        this.loadConversations();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async toggleTakeover() {
    if (!this.activeConvId) return;
    const conv = this.conversations.find(c => c.id === this.activeConvId);
    if (!conv) return;

    const currentStatus = conv.context && conv.context.human_takeover;
    const newStatus = !currentStatus;

    try {
      await fetch(`/api/inbox/conversation/${this.activeConvId}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newStatus })
      });
      this.loadConversations();
    } catch (err) {
      console.error(err);
    }
  },

  refreshInbox() {
    this.loadConversations();
  },

  startPolling() {
    setInterval(() => {
      if (this.currentDashTab === 'sub-inbox' && this.currentUser) {
        this.loadConversations();
      }
    }, 4000);
  },

  // -------------------------------------------------------------
  // RULE STUDIO
  // -------------------------------------------------------------
  async loadRules() {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      this.rules = data.rules || [];
      this.renderRulesTable();
    } catch (err) {
      console.error(err);
    }
  },

  renderRulesTable() {
    const tbody = document.getElementById('rules-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.rules.map(rule => {
      const triggersHtml = (rule.triggers || []).map(t => `<span class="trigger-tag">${t}</span>`).join('');
      const actionColor = rule.action_type.startsWith('CHECK') ? 'var(--accent-green)' : 'var(--accent-blue)';

      return `
        <tr>
          <td>
            <label class="toggle-switch">
              <input type="checkbox" ${rule.is_active ? 'checked' : ''} onchange="app.toggleRuleActive('${rule.id}')">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td>
            <div style="font-weight:600; color:#fff;">${this.escapeHtml(rule.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">intent: ${rule.intent}</div>
          </td>
          <td style="max-width:280px;">
            ${triggersHtml || '-'}
            ${rule.pattern ? `<div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">Regex: ${rule.pattern}</div>` : ''}
          </td>
          <td>
            <span style="font-family:monospace; font-size:0.78rem; font-weight:600; color:${actionColor};">
              ${rule.action_type}
            </span>
          </td>
          <td style="max-width:260px; font-size:0.78rem; color:var(--text-secondary);">
            <div style="max-height:45px; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(rule.response_template || '-')}</div>
          </td>
          <td style="text-align:right;">
            <button class="btn btn-secondary btn-sm" onclick="app.deleteRule('${rule.id}')">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async toggleRuleActive(ruleId) {
    try {
      await fetch(`/api/rules/${ruleId}/toggle`, { method: 'POST' });
      this.loadRules();
    } catch (e) {
      console.error(e);
    }
  },

  async deleteRule(ruleId) {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
      this.loadRules();
    } catch (e) {
      console.error(e);
    }
  },

  openNewRuleModal() {
    const name = prompt('Rule Name:');
    if (!name) return;
    const triggers = prompt('Trigger keywords (comma separated):', 'shipping, tracking, package');
    const template = prompt('Response Template (use {{order_id}}, {{status}} etc):', 'Your order details are confirmed in our database.');

    fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        triggers,
        action_type: 'DIRECT_RESPONSE',
        response_template: template
      })
    }).then(() => this.loadRules());
  },

  // -------------------------------------------------------------
  // DATABASE EXPLORER
  // -------------------------------------------------------------
  async loadDatabaseData() {
    try {
      const [ordersRes, productsRes, customersRes, promosRes] = await Promise.all([
        fetch('/api/database/orders'),
        fetch('/api/database/products'),
        fetch('/api/database/customers'),
        fetch('/api/database/promotions')
      ]);

      this.dbStore = {
        orders: (await ordersRes.json()).orders || [],
        products: (await productsRes.json()).products || [],
        customers: (await customersRes.json()).customers || [],
        promotions: (await promosRes.json()).promotions || []
      };

      const cOrders = document.getElementById('count-orders');
      if (cOrders) cOrders.textContent = this.dbStore.orders.length;
      const cProducts = document.getElementById('count-products');
      if (cProducts) cProducts.textContent = this.dbStore.products.length;
      const cCustomers = document.getElementById('count-customers');
      if (cCustomers) cCustomers.textContent = this.dbStore.customers.length;
      const cPromos = document.getElementById('count-promotions');
      if (cPromos) cPromos.textContent = this.dbStore.promotions.length;

      this.renderDbTable(this.activeDbTab);
    } catch (err) {
      console.error(err);
    }
  },

  switchDbTab(tabName, btn) {
    this.activeDbTab = tabName;
    document.querySelectorAll('.db-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderDbTable(tabName);
  },

  renderDbTable(tableType) {
    const tableEl = document.getElementById('db-active-table');
    if (!tableEl || !this.dbStore) return;

    if (tableType === 'orders') {
      tableEl.innerHTML = `
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Carrier & Tracking</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${this.dbStore.orders.map(o => `
            <tr>
              <td style="font-weight:700; color:#fff;">#${o.order_id}</td>
              <td>${this.escapeHtml(o.customer_name)}<div style="font-size:0.75rem; color:var(--text-muted);">${o.customer_email}</div></td>
              <td><span class="badge-channel">${o.source}</span></td>
              <td><span class="brand-badge" style="font-size:0.7rem;">${o.status}</span></td>
              <td style="font-family:monospace; font-size:0.75rem;">${o.carrier} (${o.tracking_code})</td>
              <td style="font-weight:700; color:#fff;">$${o.total_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    } else if (tableType === 'products') {
      tableEl.innerHTML = `
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product Title</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${this.dbStore.products.map(p => `
            <tr>
              <td style="font-family:monospace; font-weight:700;">${p.sku}</td>
              <td style="font-weight:600; color:#fff;">${this.escapeHtml(p.title)}</td>
              <td>${p.category}</td>
              <td><span class="brand-badge">${p.stock_qty} units</span></td>
              <td style="font-weight:700; color:#fff;">$${p.price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    } else if (tableType === 'customers') {
      tableEl.innerHTML = `
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Platform</th>
            <th>Orders</th>
            <th>Lifetime Spend</th>
          </tr>
        </thead>
        <tbody>
          ${this.dbStore.customers.map(c => `
            <tr>
              <td style="font-weight:600; color:#fff;">${this.escapeHtml(c.name)}</td>
              <td>${c.email}</td>
              <td><span class="badge-channel">${c.source}</span></td>
              <td>${c.orders_count}</td>
              <td style="font-weight:700; color:var(--accent-green);">$${c.total_spent.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    } else if (tableType === 'promotions') {
      tableEl.innerHTML = `
        <thead>
          <tr>
            <th>Coupon Code</th>
            <th>Discount Value</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${this.dbStore.promotions.map(p => `
            <tr>
              <td style="font-family:monospace; font-weight:700; color:#fff;">${p.code}</td>
              <td style="font-weight:600; color:var(--accent-green);">${p.discount}</td>
              <td style="color:var(--text-secondary);">${p.description}</td>
              <td><span class="brand-badge" style="font-size:0.7rem;">${p.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      `;
    }
  },

  openAddOrderModal() {
    const orderId = prompt('Enter Order Number:', Math.floor(1050 + Math.random() * 8000));
    if (!orderId) return;
    const name = prompt('Customer Name:', 'Bruce Wayne');
    const email = prompt('Customer Email:', 'bruce@wayne-enterprises.com');

    fetch('/api/database/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: String(orderId),
        customer_name: name || 'Customer',
        customer_email: email || 'customer@example.com',
        source: 'Shopify Storefront',
        status: 'Out for Delivery',
        carrier: 'FedEx Priority',
        tracking_code: `FX-${Math.floor(10000000 + Math.random() * 90000000)}`,
        estimated_delivery: 'Today by 4:00 PM',
        total_price: 199.00,
        currency: 'USD',
        items: [{ title: 'Stealth Black PBT Keycaps Set', qty: 2, price: 69.00 }]
      })
    }).then(() => {
      this.loadDatabaseData();
      alert(`Order #${orderId} added to store database! Try querying it in the chat widget.`);
    });
  },

  async simulateShopifyWebhook() {
    const orderNum = Math.floor(1050 + Math.random() * 8000);
    await fetch('/api/integrations/shopify/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-shopify-topic': 'orders/create' },
      body: JSON.stringify({ order_number: orderNum, customer_name: 'Shopify Buyer', email: `buyer${orderNum}@shopify.com`, total_price: '145.00' })
    });
    alert(`🎉 Shopify Webhook Simulated! Order #${orderNum} added.`);
    this.loadDatabaseData();
  },

  async simulateWooCommerceWebhook() {
    const orderNum = Math.floor(1050 + Math.random() * 8000);
    await fetch('/api/integrations/woocommerce/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-wc-webhook-topic': 'order.created' },
      body: JSON.stringify({ id: orderNum, status: 'completed', total: '89.00', billing: { first_name: 'Woo', last_name: 'Merchant', email: `wc${orderNum}@wp.org` } })
    });
    alert(`🎉 WooCommerce Webhook Simulated! Order #${orderNum} added.`);
    this.loadDatabaseData();
  },

  // -------------------------------------------------------------
  // UTILITIES
  // -------------------------------------------------------------
  formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
