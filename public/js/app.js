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
    botType: 'E-Commerce Customer Support',
    platform: 'Shopify',
    botName: 'Apex Minimalist Support',
    rules: ['rule-order-track', 'rule-product-stock', 'rule-return-refund', 'rule-discounts', 'rule-human-escalate']
  },

  activeApiLang: 'curl',

  init() {
    this.checkAuth();
    this.loadBots();
    this.loadRules();
    this.loadConversations();
    this.loadDatabaseData();
    this.startPolling();
    this.initGalaxyCanvas();
    this.initMockChatLoop();
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
    this.showBotsStack();
  },

  scrollToSection(id) {
    this.showLanding();
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  },

  // -------------------------------------------------------------
  // STACK OF BOTS & BOT DETAIL MANAGEMENT
  // -------------------------------------------------------------
  currentDetailBotId: null,
  activeBotDetailTab: 'unanswered',

  async loadBots() {
    try {
      const res = await fetch('/api/bots');
      const data = await res.json();
      this.bots = data.bots || [];
      this.renderBotsStack();
      this.updateBotsCountBadge();
    } catch (e) {
      console.error('Error loading bots:', e);
    }
  },

  updateBotsCountBadge() {
    const badge = document.getElementById('dash-bots-count-badge');
    if (badge) {
      const count = this.bots.length;
      badge.textContent = `● ${count} ${count === 1 ? 'Bot' : 'Bots'} Active`;
    }
  },

  showBotsStack() {
    this.currentDetailBotId = null;
    const stackView = document.getElementById('view-bots-stack');
    const detailView = document.getElementById('view-bot-detail');
    if (stackView) stackView.style.display = 'block';
    if (detailView) detailView.style.display = 'none';
    this.loadBots();
  },

  renderBotsStack() {
    const grid = document.getElementById('bots-stack-grid');
    if (!grid) return;

    if (!this.bots || this.bots.length === 0) {
      grid.innerHTML = `
        <div class="bot-empty-state">
          <div style="font-size:3.5rem; margin-bottom:1rem;">🤖</div>
          <h2 style="font-size:1.8rem; font-weight:800; color:#fff; margin-bottom:0.75rem;">No Bots Created Yet</h2>
          <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 2rem; font-size:0.95rem; line-height:1.6;">
            Create your first zero-AI deterministic bot. It connects directly to Shopify, WooCommerce, or your custom store database.
          </p>
          <button class="btn-new-bot-glow" style="margin:0 auto;" onclick="app.launchStarWizard()">
            <span>✨</span>
            <span>+ Create New Bot</span>
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.bots.map(b => {
      const qaCount = (b.custom_qa && b.custom_qa.length) || 0;
      const unansCount = (b.unanswered_questions && b.unanswered_questions.filter(q => q.status !== 'resolved').length) || 0;
      const restockCount = (b.restock_requests && b.restock_requests.length) || 0;

      let platformIcon = '💻';
      if ((b.store_type || '').includes('Shopify')) platformIcon = '🛍️';
      else if ((b.store_type || '').includes('WordPress')) platformIcon = '🌐';

      return `
        <div class="bot-stack-card" onclick="app.openBotDetail('${b.id}')">
          <div>
            <div class="bot-stack-card-top">
              <div class="bot-stack-name">${this.escapeHtml(b.name)}</div>
              <span class="bot-platform-badge">${platformIcon} ${this.escapeHtml(b.store_type || 'Custom Web')}</span>
            </div>

            <div class="bot-stack-purpose">
              ${this.escapeHtml(b.purpose || 'Order Tracking, Stock Check & Customer Service')}
            </div>

            <div class="bot-metrics-row">
              <div class="bot-metric-chip">
                <span>💬</span>
                <span><strong>${qaCount}</strong> Q&A Pairs</span>
              </div>
              <div class="bot-metric-chip ${unansCount > 0 ? 'alert' : ''}">
                <span>❓</span>
                <span><strong>${unansCount}</strong> Unanswered</span>
              </div>
              <div class="bot-metric-chip">
                <span>📦</span>
                <span><strong>${restockCount}</strong> Restock Reqs</span>
              </div>
            </div>
          </div>

          <div class="bot-stack-card-footer">
            <div class="bot-status-pill">
              <span class="bot-status-dot"></span>
              <span>Connected & Active</span>
            </div>
            <button class="bot-open-btn" onclick="event.stopPropagation(); app.openBotDetail('${b.id}')">
              <span>Open Studio</span>
              <span>→</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async openBotDetail(botId) {
    this.currentDetailBotId = botId;
    this.activeBotId = botId;
    const stackView = document.getElementById('view-bots-stack');
    const detailView = document.getElementById('view-bot-detail');

    if (stackView) stackView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    await this.loadBotDetail(botId);
  },

  async loadBotDetail(botId) {
    try {
      const res = await fetch(`/api/bots/${botId}`);
      const data = await res.json();
      if (!data.success || !data.bot) {
        alert('Bot details could not be loaded.');
        return;
      }

      const bot = data.bot;
      // Update header details
      const nameEl = document.getElementById('detail-bot-name');
      const badgeEl = document.getElementById('detail-bot-platform-badge');
      const purposeEl = document.getElementById('detail-bot-purpose');

      if (nameEl) nameEl.textContent = bot.name;
      if (badgeEl) {
        let icon = '💻';
        if ((bot.store_type || '').includes('Shopify')) icon = '🛍️';
        else if ((bot.store_type || '').includes('WordPress')) icon = '🌐';
        badgeEl.textContent = `${icon} ${bot.store_type || 'Custom Website'}`;
      }
      if (purposeEl) purposeEl.textContent = `Purpose: ${bot.purpose || 'Order Tracking, Stock Check & Customer Service'}`;

      // Update Tab Badges
      const unansCount = (bot.unanswered_questions || []).filter(q => q.status !== 'resolved').length;
      const qaCount = (bot.custom_qa || []).length;
      const restockCount = (bot.restock_requests || []).length;

      const bUnans = document.getElementById('badge-unanswered-count');
      const bQa = document.getElementById('badge-qa-count');
      const bRestock = document.getElementById('badge-restock-count');

      if (bUnans) bUnans.textContent = unansCount;
      if (bQa) bQa.textContent = qaCount;
      if (bRestock) bRestock.textContent = restockCount;

      // Render Tab Contents
      this.renderUnansweredList(bot);
      this.renderQAList(bot);
      this.renderRestockTable(bot);
      this.renderIntegrationGuide(bot);

    } catch (e) {
      console.error('Error fetching bot details:', e);
    }
  },

  switchBotDetailTab(tabName) {
    this.activeBotDetailTab = tabName;
    const tabs = ['unanswered', 'qa', 'restock', 'integration'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pane = document.getElementById(`pane-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) pane.classList.toggle('active', t === tabName);
    });
  },

  // 1. Unanswered Questions Renderer
  renderUnansweredList(bot) {
    const container = document.getElementById('detail-unanswered-list');
    if (!container) return;

    const list = bot.unanswered_questions || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div style="background:#09090d; border:1px dashed #232332; border-radius:var(--radius-md); padding:3.5rem 2rem; text-align:center;">
          <div style="font-size:2.2rem; margin-bottom:0.75rem;">🎉</div>
          <div style="font-weight:700; color:#fff; font-size:1.1rem; margin-bottom:0.25rem;">No Unanswered Questions!</div>
          <div style="font-size:0.85rem; color:var(--text-muted); max-width:400px; margin:0 auto;">
            Your bot is answering every shopper query with precision rules and database records. When a customer asks a question without an answer, it will appear here.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(q => {
      const isResolved = q.status === 'resolved';
      const timeStr = q.timestamp ? new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';

      return `
        <div class="unanswered-item-card ${isResolved ? 'resolved' : ''}">
          <div class="unanswered-header">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span style="font-size:0.82rem; font-weight:600; color:#fff;">👤 ${this.escapeHtml(q.customer || 'Guest Shopper')}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">• ${timeStr}</span>
            </div>
            <div>
              ${isResolved 
                ? '<span class="brand-badge" style="color:var(--accent-green); background:#062615;">✓ Answer Added to Bot</span>' 
                : '<span class="brand-badge" style="color:#fb7185; background:#2c0c14; border-color:#5c1824;">● Awaiting Answer</span>'}
            </div>
          </div>

          <div class="unanswered-question-box">
            "${this.escapeHtml(q.question)}"
          </div>

          ${!isResolved ? `
            <div class="unanswered-answer-form">
              <input type="text" id="answer-input-${q.id}" class="auth-input" style="flex:1;" placeholder="Type the answer your bot should give for this question...">
              <button class="btn-pill btn-pill-primary" style="font-size:0.8rem; white-space:nowrap;" onclick="app.resolveUnanswered('${q.id}')">
                ✨ Save Answer to Bot
              </button>
            </div>
          ` : `
            <div style="font-size:0.78rem; color:var(--text-muted);">
              This question has been answered and added to the bot's permanent Custom Q&A database.
            </div>
          `}
        </div>
      `;
    }).join('');
  },

  async resolveUnanswered(qId) {
    const input = document.getElementById(`answer-input-${qId}`);
    const answer = input ? input.value.trim() : '';
    if (!answer) {
      alert('Please enter an answer to teach the bot.');
      return;
    }

    try {
      const res = await fetch(`/api/bots/${this.currentDetailBotId}/unanswered/${qId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
      });
      const data = await res.json();
      if (data.success) {
        alert('✨ Success! The answer has been saved and your bot will now answer this question automatically!');
        this.loadBotDetail(this.currentDetailBotId);
      }
    } catch (e) {
      console.error(e);
      alert('Error saving answer.');
    }
  },

  // 2. Q&A Manager Renderer
  renderQAList(bot) {
    const container = document.getElementById('detail-qa-list');
    if (!container) return;

    const list = bot.custom_qa || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div style="background:#09090d; border:1px dashed #232332; border-radius:var(--radius-md); padding:3.5rem 2rem; text-align:center;">
          <div style="font-size:2.2rem; margin-bottom:0.75rem;">💬</div>
          <div style="font-weight:700; color:#fff; font-size:1.1rem; margin-bottom:0.25rem;">No Custom Q&A Pairs Added Yet</div>
          <div style="font-size:0.85rem; color:var(--text-muted); max-width:400px; margin:0 auto 1.5rem;">
            Add store-specific answers to FAQs (e.g. shipping zones, warranty, materials) so your bot can answer instantly.
          </div>
          <button class="btn-pill btn-pill-primary" style="font-size:0.82rem;" onclick="app.toggleAddQAForm(true)">
            + Add First Question & Answer
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(qa => `
      <div class="qa-card-item">
        <div style="flex:1;">
          <div class="qa-question-text">Q: ${this.escapeHtml(qa.question)}</div>
          <div class="qa-answer-text">A: ${this.escapeHtml(qa.answer)}</div>
        </div>
        <button class="btn-pill btn-pill-secondary" style="font-size:0.75rem; border-color:#381c22; color:#f87171;" onclick="app.deleteQA('${qa.id}')">
          ✕ Delete
        </button>
      </div>
    `).join('');
  },

  toggleAddQAForm(show) {
    const form = document.getElementById('form-add-qa');
    if (!form) return;
    if (show === undefined) {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    } else {
      form.style.display = show ? 'block' : 'none';
    }
    if (form.style.display === 'block') {
      const qInput = document.getElementById('input-new-question');
      if (qInput) qInput.focus();
    }
  },

  async saveNewQA() {
    const qInput = document.getElementById('input-new-question');
    const aInput = document.getElementById('input-new-answer');
    const question = qInput ? qInput.value.trim() : '';
    const answer = aInput ? aInput.value.trim() : '';

    if (!question || !answer) {
      alert('Please enter both a question and an answer.');
      return;
    }

    try {
      const res = await fetch(`/api/bots/${this.currentDetailBotId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer })
      });
      const data = await res.json();
      if (data.success) {
        if (qInput) qInput.value = '';
        if (aInput) aInput.value = '';
        this.toggleAddQAForm(false);
        this.loadBotDetail(this.currentDetailBotId);
      }
    } catch (e) {
      console.error(e);
      alert('Error saving Q&A.');
    }
  },

  async deleteQA(qaId) {
    if (!confirm('Are you sure you want to remove this Q&A from this bot?')) return;
    try {
      await fetch(`/api/bots/${this.currentDetailBotId}/qa/${qaId}`, { method: 'DELETE' });
      this.loadBotDetail(this.currentDetailBotId);
    } catch (e) {
      console.error(e);
    }
  },

  // 3. Restock Requests Renderer
  renderRestockTable(bot) {
    const tbody = document.getElementById('detail-restock-tbody');
    if (!tbody) return;

    const list = bot.restock_requests || [];
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">
            No restock requests yet. When customers query out-of-stock items, the bot registers their inquiry here.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(r => {
      const timeStr = r.requested_at ? new Date(r.requested_at).toLocaleDateString() : 'Today';
      return `
        <tr>
          <td>
            <div style="font-weight:700; color:#fff;">${this.escapeHtml(r.product_title || r.sku)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">SKU: ${this.escapeHtml(r.sku)}</div>
          </td>
          <td>${this.escapeHtml(r.customer_email || 'guest@store.com')}</td>
          <td>
            <span class="brand-badge" style="background:#1d1836; color:#c084fc; border-color:#3b2d6b;">
              🔥 ${r.count || 1} Shoppers
            </span>
          </td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${timeStr}</td>
          <td>
            <span class="brand-badge" style="background:#2e1017; color:#fb7185; border-color:#5c1c28;">
              Out of Stock
            </span>
          </td>
          <td>
            <button class="btn-pill btn-pill-secondary" style="font-size:0.75rem;" onclick="alert('Notification alert sent to inventory manager for ${this.escapeHtml(r.product_title)}!')">
              Notify Warehouse
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 4. Platform Integration Guide Renderer
  renderIntegrationGuide(bot) {
    const container = document.getElementById('detail-integration-content');
    if (!container) return;

    const serverUrl = window.location.origin;
    const isShopify = (bot.store_type || '').includes('Shopify');
    const isWp = (bot.store_type || '').includes('WordPress');

    if (isShopify) {
      container.innerHTML = `
        <div style="background:#09090d; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1.75rem; margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="font-weight:700; font-size:1.05rem; color:#fff;">🛍️ Shopify theme.liquid Integration</div>
            <span class="brand-badge">🟢 Webhooks & Inventory Sync Active</span>
          </div>

          <p style="font-size:0.86rem; color:var(--text-secondary); line-height:1.6; margin-bottom:1.5rem;">
            Your bot is linked to your Shopify Storefront. It automatically checks inventory levels, verifies customer order numbers, and tracks live FedEx/DHL shipments directly against your store database with <strong>0% AI hallucinations</strong>.
          </p>

          <!-- Step-by-Step Instructions -->
          <div style="margin-bottom:1.5rem;">
            <div style="font-weight:700; font-size:0.92rem; color:#fff; margin-bottom:0.75rem;">
              📋 Step-by-Step Plugin Guide for Shopify
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">1</div>
              <div class="step-content">
                Open your <strong>Shopify Admin</strong> dashboard and go to <strong>Online Store → Themes</strong>.
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">2</div>
              <div class="step-content">
                Next to your active theme, click the <strong>&quot;...&quot;</strong> (Actions) button and select <strong>Edit code</strong>.
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">3</div>
              <div class="step-content">
                In the left file navigator under <strong>Layout</strong>, click to open <code>theme.liquid</code>.
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">4</div>
              <div class="step-content">
                Scroll to the bottom of <code>theme.liquid</code> and paste the snippet below right above the closing <code>&lt;/body&gt;</code> tag:
              </div>
            </div>
          </div>

          <!-- Code Snippet -->
          <div class="code-header-bar">
            <span>Shopify theme.liquid snippet</span>
            <button class="btn-copy-mini" onclick="app.copyCode('detail-shopify-code')">Copy Snippet</button>
          </div>
          <div class="code-box" id="detail-shopify-code" style="margin-top:0;">&lt;!-- RuleMind Bot Integration for ${this.escapeHtml(bot.name)} --&gt;
&lt;script src="${serverUrl}/widget.js"
  data-server="${serverUrl}"
  data-bot-id="${bot.id}"
  data-source="Shopify Storefront"
  data-customer-email="{{ customer.email }}"
  data-customer-name="{{ customer.name }}"
  async&gt;&lt;/script&gt;</div>

          <!-- Step 5 & 6 -->
          <div style="margin-top:1.25rem;">
            <div class="instruction-step">
              <div class="step-num-badge">5</div>
              <div class="step-content">
                <strong>Real-Time Order & Inventory Sync:</strong> In Shopify Admin, navigate to <strong>Settings → Notifications → Webhooks</strong>. Click <strong>Create webhook</strong>, select Event: <code>orders/create</code>, and paste your webhook endpoint URL:
                <div style="margin-top:0.35rem; font-family:var(--font-mono); font-size:0.75rem; color:#93c5fd; background:#06060a; padding:0.4rem 0.75rem; border-radius:4px; border:1px solid #1c1c28;">
                  ${serverUrl}/api/integrations/shopify/webhook
                </div>
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">6</div>
              <div class="step-content">
                Click <strong>Save</strong> in Shopify. The bot widget is now live on your storefront! When shoppers ask about order numbers or stock, it verifies your database and replies in under 50ms.
              </div>
            </div>
          </div>

          <!-- Connection Keys & Direct DB Explanation -->
          <div style="background:#050508; border:1px solid #1a1a24; border-radius:8px; padding:1.25rem; margin-top:1.5rem;">
            <div style="font-weight:700; font-size:0.88rem; color:#fff; margin-bottom:0.75rem;">
              🔑 Connection Keys & Database Direct Query Routing
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; font-size:0.8rem;">
              <div>
                <span style="color:var(--text-muted); display:block;">Bot ID:</span>
                <code style="color:#a7f3d0;">${bot.id}</code>
              </div>
              <div>
                <span style="color:var(--text-muted); display:block;">Orders Database Table:</span>
                <span style="color:#ffffff;">Live Shopify Orders Sync</span>
              </div>
              <div>
                <span style="color:var(--text-muted); display:block;">Inventory Query Method:</span>
                <span style="color:#ffffff;">Sub-50ms Exact Match</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (isWp) {
      container.innerHTML = `
        <div style="background:#09090d; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1.75rem; margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="font-weight:700; font-size:1.05rem; color:#fff;">🌐 WordPress / WooCommerce Integration</div>
            <span class="brand-badge">🟢 WooCommerce Webhook Sync Active</span>
          </div>

          <p style="font-size:0.86rem; color:var(--text-secondary); line-height:1.6; margin-bottom:1.5rem;">
            Your bot is connected to WooCommerce. It executes direct SQL/REST lookups against orders, stock levels, and promotional discount codes with <strong>0% AI hallucinations</strong>.
          </p>

          <!-- Step-by-Step Instructions -->
          <div style="margin-bottom:1.5rem;">
            <div style="font-weight:700; font-size:0.92rem; color:#fff; margin-bottom:0.75rem;">
              📋 Step-by-Step Plugin Guide for WordPress
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">1</div>
              <div class="step-content">
                Log in to your <strong>WordPress WP-Admin</strong> dashboard.
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">2</div>
              <div class="step-content">
                Go to <strong>Appearance → Theme File Editor</strong> (or use the free <em>WPCode</em> plugin).
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">3</div>
              <div class="step-content">
                Open your theme's <code>functions.php</code> file.
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">4</div>
              <div class="step-content">
                Paste the PHP code snippet below at the bottom of <code>functions.php</code>:
              </div>
            </div>
          </div>

          <!-- Code Snippet -->
          <div class="code-header-bar">
            <span>functions.php snippet</span>
            <button class="btn-copy-mini" onclick="app.copyCode('detail-wp-code')">Copy PHP Snippet</button>
          </div>
          <div class="code-box" id="detail-wp-code" style="margin-top:0;">// RuleMind Bot Integration for ${this.escapeHtml(bot.name)}
add_action('wp_footer', function() {
  ?&gt;
  &lt;script src="${serverUrl}/widget.js" 
          data-server="${serverUrl}" 
          data-bot-id="${bot.id}"
          data-source="WordPress / WooCommerce"&gt;&lt;/script&gt;
  &lt;?php
});</div>

          <!-- Step 5 & 6 -->
          <div style="margin-top:1.25rem;">
            <div class="instruction-step">
              <div class="step-num-badge">5</div>
              <div class="step-content">
                <strong>WooCommerce Database Webhook Sync:</strong> In WP-Admin, navigate to <strong>WooCommerce → Settings → Advanced → Webhooks</strong>. Click <strong>Add webhook</strong>, set Status: <code>Active</code>, Topic: <code>Order created</code>, and Delivery URL:
                <div style="margin-top:0.35rem; font-family:var(--font-mono); font-size:0.75rem; color:#93c5fd; background:#06060a; padding:0.4rem 0.75rem; border-radius:4px; border:1px solid #1c1c28;">
                  ${serverUrl}/api/integrations/woocommerce/webhook
                </div>
              </div>
            </div>

            <div class="instruction-step">
              <div class="step-num-badge">6</div>
              <div class="step-content">
                Click <strong>Save Webhook</strong>. Your WordPress bot is ready to check orders, inventory, and promotions in real time!
              </div>
            </div>
          </div>

          <!-- Connection Keys -->
          <div style="background:#050508; border:1px solid #1a1a24; border-radius:8px; padding:1.25rem; margin-top:1.5rem;">
            <div style="font-weight:700; font-size:0.88rem; color:#fff; margin-bottom:0.75rem;">
              🔑 Connection Keys & Database Sync Details
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; font-size:0.8rem;">
              <div>
                <span style="color:var(--text-muted); display:block;">Bot ID:</span>
                <code style="color:#a7f3d0;">${bot.id}</code>
              </div>
              <div>
                <span style="color:var(--text-muted); display:block;">WooCommerce Orders:</span>
                <span style="color:#ffffff;">Direct Webhook & DB Hook</span>
              </div>
              <div>
                <span style="color:var(--text-muted); display:block;">Product Catalog:</span>
                <span style="color:#ffffff;">Real-time Stock Querying</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      const dbConfig = bot.db_config || {};
      container.innerHTML = `
        <div style="background:#09090d; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1.75rem; margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="font-weight:700; font-size:1.05rem; color:#fff;">💻 Custom Website & Database Access</div>
            <span class="brand-badge">🟢 Direct DB Queries Enabled</span>
          </div>

          <p style="font-size:0.86rem; color:var(--text-secondary); line-height:1.6; margin-bottom:1.5rem;">
            Plug into custom HTML websites, React, Vue, Next.js, or query the bot directly via REST API with your database credentials.
          </p>

          <!-- Database Configuration Cards -->
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; margin-bottom:1.5rem;">
            <div style="background:#050508; border:1px solid #1a1a24; border-radius:6px; padding:0.85rem;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Database Type</div>
              <div style="font-weight:700; color:#fff; font-size:0.9rem; margin-top:2px;">${this.escapeHtml(dbConfig.db_type || 'Custom PostgreSQL / MySQL')}</div>
            </div>
            <div style="background:#050508; border:1px solid #1a1a24; border-radius:6px; padding:0.85rem;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Database Endpoint</div>
              <div style="font-weight:700; color:#fff; font-size:0.9rem; margin-top:2px;">${this.escapeHtml(dbConfig.endpoint || serverUrl + '/api/database')}</div>
            </div>
            <div style="background:#050508; border:1px solid #1a1a24; border-radius:6px; padding:0.85rem;">
              <div style="font-size:0.75rem; color:var(--text-muted);">Access Token</div>
              <div style="font-weight:700; color:#fff; font-size:0.9rem; margin-top:2px; font-family:var(--font-mono);">${this.escapeHtml(dbConfig.api_key || 'rm_live_key_' + bot.id.substring(0, 8))}</div>
            </div>
          </div>

          <!-- Step-by-Step Instructions -->
          <div style="margin-bottom:1.5rem;">
            <div style="font-weight:700; font-size:0.92rem; color:#fff; margin-bottom:0.75rem;">
              📋 Step-by-Step Option 1: Universal HTML Script Embed
            </div>
            <div class="instruction-step">
              <div class="step-num-badge">1</div>
              <div class="step-content">
                Copy the script tag below and paste it before the closing <code>&lt;/body&gt;</code> tag on any webpage:
              </div>
            </div>
          </div>

          <div class="code-header-bar">
            <span>HTML Embed Tag</span>
            <button class="btn-copy-mini" onclick="app.copyCode('detail-custom-code')">Copy Script</button>
          </div>
          <div class="code-box" id="detail-custom-code" style="margin-top:0;">&lt;script src="${serverUrl}/widget.js" 
  data-server="${serverUrl}" 
  data-bot-id="${bot.id}" 
  data-theme="black" 
  async&gt;&lt;/script&gt;</div>

          <div style="margin:2rem 0 0.75rem;">
            <div style="font-weight:700; font-size:0.92rem; color:#fff; margin-bottom:0.75rem;">
              📋 Step-by-Step Option 2: Direct REST API Access
            </div>
            <div class="instruction-step">
              <div class="step-num-badge">2</div>
              <div class="step-content">
                Send a <code>POST</code> request to <code>${serverUrl}/api/chat/message</code> with your <code>botId</code>:
              </div>
            </div>
          </div>

          <div class="code-header-bar">
            <span>Terminal (cURL)</span>
            <button class="btn-copy-mini" onclick="app.copyCode('detail-custom-curl')">Copy cURL</button>
          </div>
          <div class="code-box" id="detail-custom-curl" style="margin-top:0; font-size:0.75rem;">curl -X POST ${serverUrl}/api/chat/message \\
  -H "Content-Type: application/json" \\
  -d '{
    "botId": "${bot.id}",
    "message": "Where is order #1042?",
    "customer": { "name": "Jane Doe", "email": "jane@example.com" }
  }'</div>
        </div>
      `;
    }
  },

  async verifyBotDb(botId) {
    try {
      const res = await fetch(`/api/bots/${botId}/verify-db`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const titleEl = document.getElementById('verify-banner-title');
        const subEl = document.getElementById('verify-banner-sub');
        const stampEl = document.getElementById('verify-banner-stamp');

        if (titleEl) titleEl.textContent = '🟢 Database Verified & Fully Accessible';
        if (subEl) subEl.textContent = `Direct query test passed: ${data.details.products_accessible} products, ${data.details.orders_accessible} orders accessible in ${data.details.latency_ms}ms with 0% AI hallucinations!`;
        if (stampEl) stampEl.textContent = `Verified: ${new Date().toLocaleTimeString()}`;
        alert('⚡ Database Connection Verified! Deterministic rule engine is communicating live with your store data.');
      }
    } catch (e) {
      console.error(e);
      alert('Error verifying database.');
    }
  },

  openWidgetForBot(botId) {
    this.activeBotId = botId;
    if (window.RuleMindWidget) {
      if (window.RuleMindWidget.setBotId) window.RuleMindWidget.setBotId(botId);
      if (window.RuleMindWidget.open) window.RuleMindWidget.open();
    } else {
      const widgetBtn = document.querySelector('.rm-launcher');
      if (widgetBtn) widgetBtn.click();
    }
  },

  async deleteCurrentBot() {
    if (!this.currentDetailBotId) return;
    if (!confirm('Are you sure you want to delete this bot from your stack?')) return;

    try {
      await fetch(`/api/bots/${this.currentDetailBotId}`, { method: 'DELETE' });
      alert('Bot deleted successfully.');
      this.showBotsStack();
    } catch (e) {
      console.error(e);
      alert('Error deleting bot.');
    }
  },

  // -------------------------------------------------------------
  // ANIMATED STAR WIZARD ("Say Hi & Start Asking What Bot You Want")
  // -------------------------------------------------------------
  launchStarWizard() {
    document.getElementById('modal-star-wizard').classList.add('active');
    this.wizardData = {
      botName: 'Apex Minimalist Assistant',
      botPurpose: 'Order Tracking, Stock Check & Customer Service',
      platform: 'Shopify',
      customQA: [],
      fallbackMessage: "I'm sorry, I don't have an exact answer for that yet. Would you like me to look up an order in our store database or connect you to our support specialist?",
      dbConfig: {}
    };

    const nameInput = document.getElementById('wizard-bot-name');
    const purposeInput = document.getElementById('wizard-bot-purpose');
    const fallbackInput = document.getElementById('wizard-bot-fallback');

    if (nameInput) nameInput.value = this.wizardData.botName;
    if (purposeInput) purposeInput.value = this.wizardData.botPurpose;
    if (fallbackInput) fallbackInput.value = this.wizardData.fallbackMessage;

    // Initialize 2 default custom Q&A rows
    const qaContainer = document.getElementById('wizard-qa-container');
    if (qaContainer) {
      qaContainer.innerHTML = '';
      this.addWizardQARow('Do you ship internationally?', 'Yes! We ship worldwide via FedEx and DHL in 3-7 business days.');
      this.addWizardQARow('What materials are used for the keycaps?', 'Our keycaps are crafted from thick double-shot PBT plastic with stealth dark legends.');
    }

    this.setStarSpeech("Hi there! ✨ I'm your RuleMind Architect. Let's create your new database-powered bot together! First, what is your bot's name?");
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

    // Update Stepper Progress Track Fill
    const fillEl = document.getElementById('stepper-progress-fill');
    if (fillEl) fillEl.style.width = `${stepNum * 20}%`;

    // Update Stepper Nodes
    for (let i = 1; i <= 5; i++) {
      const node = document.getElementById(`stepper-node-${i}`);
      if (!node) continue;
      const bubble = node.querySelector('.step-bubble');
      node.classList.remove('active', 'completed');
      if (i < stepNum) {
        node.classList.add('completed');
        if (bubble) bubble.textContent = '✓';
      } else if (i === stepNum) {
        node.classList.add('active');
        if (bubble) bubble.textContent = i;
      } else {
        if (bubble) bubble.textContent = i;
      }
    }

    // Update Counter & Titles
    const counterEl = document.getElementById('wizard-step-counter');
    if (counterEl) counterEl.textContent = `STEP ${stepNum} OF 5`;

    const titles = {
      1: { t: 'Decide Bot Name & Identity', s: 'Give your bot a name for your store and customer chat widget.' },
      2: { t: 'Bot Purpose & Website Database Questions', s: 'Define your bot purpose and what store database inquiries it handles.' },
      3: { t: 'Extra Questions & Unknown Fallback', s: 'Add store Q&A rules and decide what to show when a question is unknown.' },
      4: { t: 'Select Integration Platform', s: 'Where do you want to plug this bot in? Shopify, WordPress, or Custom Web.' },
      5: { t: 'Step-by-Step Instructions & Database Access', s: `Plug "${this.wizardData.botName || 'your bot'}" directly into ${this.wizardData.platform || 'Shopify'}.` }
    };
    if (titles[stepNum]) {
      const titleEl = document.getElementById('wizard-title-display');
      const subEl = document.getElementById('wizard-subtitle-display');
      if (titleEl) titleEl.textContent = titles[stepNum].t;
      if (subEl) subEl.textContent = titles[stepNum].s;
    }
  },

  selectWizardPurpose(purpose, el) {
    this.wizardData.botPurpose = purpose;
    const input = document.getElementById('wizard-bot-purpose');
    if (input) input.value = purpose;
    document.querySelectorAll('#star-step-2 .store-option-card').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  selectWizardPlatform(platform, el) {
    this.wizardData.platform = platform;
    document.querySelectorAll('#star-step-4 .store-option-card').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');

    const badge = document.getElementById('wizard-platform-badge');
    if (badge) badge.textContent = platform;

    this.updateWizardPlatformView();
  },

  addWizardQARow(q = '', a = '') {
    const container = document.getElementById('wizard-qa-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'wizard-qa-row';
    row.innerHTML = `
      <button type="button" class="btn-remove-qa" onclick="this.parentElement.remove()">✕</button>
      <input type="text" class="auth-input input-qa-q" placeholder="Customer Question (e.g. Do you ship to Australia?)" value="${this.escapeHtml(q)}">
      <input type="text" class="auth-input input-qa-a" placeholder="Exact Deterministic Bot Answer" value="${this.escapeHtml(a)}">
    `;
    container.appendChild(row);
  },

  updateWizardPlatformView() {
    const isShopify = this.wizardData.platform === 'Shopify';
    const isWp = this.wizardData.platform === 'WordPress';
    const isCustom = this.wizardData.platform === 'Custom Web & API';

    const pShopify = document.getElementById('wizard-panel-shopify');
    const pWp = document.getElementById('wizard-panel-wordpress');
    const pCustom = document.getElementById('wizard-panel-custom');

    if (pShopify) pShopify.style.display = isShopify ? 'block' : 'none';
    if (pWp) pWp.style.display = isWp ? 'block' : 'none';
    if (pCustom) pCustom.style.display = isCustom ? 'block' : 'none';

    const origin = window.location.origin;

    const shopifyCode = document.getElementById('wizard-code-shopify');
    if (shopifyCode) {
      shopifyCode.textContent = `<!-- RuleMind Bot Integration for Shopify -->\n<script src="${origin}/widget.js"\n  data-server="${origin}"\n  data-source="Shopify Storefront"\n  data-customer-email="{{ customer.email }}"\n  data-customer-name="{{ customer.name }}"\n  async></script>`;
    }

    const wpCode = document.getElementById('wizard-code-wp');
    if (wpCode) {
      wpCode.textContent = `// RuleMind Bot Integration for WordPress / WooCommerce\nadd_action('wp_footer', function() {\n  ?>\n  <script src="${origin}/widget.js" \n          data-server="${origin}" \n          data-source="WordPress / WooCommerce" \n          async></script>\n  <?php\n});`;
    }

    const customCode = document.getElementById('wizard-code-custom');
    if (customCode) {
      customCode.textContent = `<script src="${origin}/widget.js" \n        data-server="${origin}" \n        data-theme="black" \n        async></script>`;
    }

    const apiCode = document.getElementById('wizard-api-code');
    if (apiCode) {
      apiCode.textContent = `curl -X POST ${origin}/api/chat/message \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "message": "Where is order #1042?",\n    "customer": { "name": "Jane Doe", "email": "jane@example.com" }\n  }'`;
    }

    const dbEndpointInput = document.getElementById('wizard-db-endpoint');
    if (dbEndpointInput) {
      dbEndpointInput.value = `${origin}/api/database`;
    }

    const whShopify = document.getElementById('wizard-webhook-shopify');
    if (whShopify) whShopify.textContent = `${origin}/api/integrations/shopify/webhook`;

    const whWp = document.getElementById('wizard-webhook-wp');
    if (whWp) whWp.textContent = `${origin}/api/integrations/woocommerce/webhook`;

    const titleEl = document.getElementById('wizard-instructions-title');
    const subEl = document.getElementById('wizard-instructions-sub');
    if (isShopify) {
      if (titleEl) titleEl.textContent = 'How to Plug Your Bot into Shopify';
      if (subEl) subEl.textContent = 'Step-by-step instructions to embed your bot in theme.liquid and sync orders & inventory:';
    } else if (isWp) {
      if (titleEl) titleEl.textContent = 'How to Plug Your Bot into WordPress / WooCommerce';
      if (subEl) subEl.textContent = 'Step-by-step instructions to add your bot to functions.php and sync WooCommerce:';
    } else {
      if (titleEl) titleEl.textContent = 'How to Plug Into Custom Website & Database REST API';
      if (subEl) subEl.textContent = 'Database credentials form, HTML embed tag, and full REST API access:';
    }
  },

  nextWizardStep(stepNum) {
    if (stepNum === 2) {
      const nameInput = document.getElementById('wizard-bot-name');
      this.wizardData.botName = (nameInput && nameInput.value.trim()) || 'Apex Assistant';
      this.setStarSpeech(`"${this.wizardData.botName}" is a great name! 🎯 Now, what is the purpose of this bot, and what questions about your website should it answer using the database?`);
    } else if (stepNum === 3) {
      const purposeInput = document.getElementById('wizard-bot-purpose');
      this.wizardData.botPurpose = (purposeInput && purposeInput.value.trim()) || 'Order Tracking, Stock Check & Customer Service';
      this.setStarSpeech(`Let's add any extra questions & answers for your store, and decide what to display when a question isn't known yet! 💬`);
    } else if (stepNum === 4) {
      // Gather Q&As and Fallback
      this.wizardData.customQA = [];
      document.querySelectorAll('#wizard-qa-container .wizard-qa-row').forEach(row => {
        const q = row.querySelector('.input-qa-q').value.trim();
        const a = row.querySelector('.input-qa-a').value.trim();
        if (q && a) {
          this.wizardData.customQA.push({ question: q, answer: a });
        }
      });
      const fbInput = document.getElementById('wizard-bot-fallback');
      this.wizardData.fallbackMessage = (fbInput && fbInput.value.trim()) || "I'm sorry, I don't have an exact answer for that yet.";
      this.setStarSpeech(`Where would you like to plug "${this.wizardData.botName}" in? Choose your website platform! 🔌`);
    } else if (stepNum === 5) {
      this.updateWizardPlatformView();
      this.setStarSpeech(`Here are your exact step-by-step instructions to plug "${this.wizardData.botName}" into ${this.wizardData.platform} with database access! 🚀`);
    }
    this.showWizardStep(stepNum);
  },

  prevWizardStep(stepNum) {
    if (stepNum === 1) {
      this.setStarSpeech("Step 1: Decide the name of your bot. ✨");
    } else if (stepNum === 2) {
      this.setStarSpeech(`What is the purpose of "${this.wizardData.botName}", and what website questions should it answer? 📦`);
    } else if (stepNum === 3) {
      this.setStarSpeech("Teach your bot extra questions and fallback answers for your store! 💬");
    } else if (stepNum === 4) {
      this.setStarSpeech("Which website platform do you want to integrate with? 🔌");
    }
    this.showWizardStep(stepNum);
  },

  async finishCreateBot() {
    this.setStarSpeech(`Woohoo! 🚀 Creating "${this.wizardData.botName}" with deterministic database connectivity...`);

    // Extract DB config if custom website
    let dbConfig = null;
    if (this.wizardData.platform === 'Custom Web & API') {
      const dbType = document.getElementById('wizard-db-type')?.value || 'PostgreSQL';
      const dbEndpoint = document.getElementById('wizard-db-endpoint')?.value || 'http://localhost:3000/api/database';
      const dbKey = document.getElementById('wizard-db-key')?.value || 'rm_live_key';
      dbConfig = { db_type: dbType, endpoint: dbEndpoint, api_key: dbKey, status: 'verified' };
    }

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.wizardData.botName,
          store_type: this.wizardData.platform,
          purpose: this.wizardData.botPurpose,
          custom_qa: this.wizardData.customQA,
          fallback_message: this.wizardData.fallbackMessage,
          db_config: dbConfig,
          theme: 'black'
        })
      });

      const data = await res.json();
      if (data.success && data.bot) {
        setTimeout(() => {
          this.setStarSpeech(`All set! 🎉 Your new agent "${data.bot.name}" is created and added to your Stack of Bots!`);
          setTimeout(() => {
            this.closeStarWizard();
            this.loadBots();
            this.openBotDetail(data.bot.id);
          }, 1000);
        }, 600);
      } else {
        alert('Failed to create bot: ' + (data.error || 'Server error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error creating bot.');
    }
  },

  // Switch API tabs in Dashboard
  switchApiTab(lang, btn) {
    this.activeApiLang = lang;
    document.querySelectorAll('.dash-subview .api-tab-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const filenameEl = document.getElementById('api-snippet-filename');
    const codeEl = document.getElementById('code-api-snippet');

    if (lang === 'curl') {
      if (filenameEl) filenameEl.textContent = 'Terminal (cURL)';
      if (codeEl) codeEl.textContent = `curl -X POST http://localhost:3000/api/chat/message \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Where is order #1042?","source":"Custom App"}'`;
    } else if (lang === 'js') {
      if (filenameEl) filenameEl.textContent = 'JavaScript (Fetch API)';
      if (codeEl) codeEl.textContent = `// Query RuleMind Bot & Store Database
const res = await fetch('http://localhost:3000/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Where is order #1042?',
    customer: { name: 'Customer', email: 'shopper@store.com' }
  })
});
const data = await res.json();
console.log('Bot Reply:', data.reply);
console.log('DB Query:', data.dbQuery);
console.log('Order Data:', data.richCard);`;
    } else if (lang === 'python') {
      if (filenameEl) filenameEl.textContent = 'Python (requests)';
      if (codeEl) codeEl.textContent = `# Query RuleMind Bot & Store Database
import requests

response = requests.post('http://localhost:3000/api/chat/message', json={
    'message': 'Where is order #1042?',
    'customer': {'name': 'Customer', 'email': 'shopper@store.com'}
})
data = response.json()
print("Answer:", data['reply'])
print("SQL Ran:", data['dbQuery'])`;
    }
  },

  // Switch API tabs in Wizard
  switchWizardApiTab(lang, btn) {
    document.querySelectorAll('#wizard-panel-custom .api-tab-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const filenameEl = document.getElementById('wizard-api-filename');
    const codeEl = document.getElementById('wizard-api-code');
    const origin = window.location.origin;

    if (lang === 'curl') {
      if (filenameEl) filenameEl.textContent = 'cURL Terminal';
      if (codeEl) codeEl.textContent = `curl -X POST ${origin}/api/chat/message \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "message": "Where is order #1042?",\n    "customer": { "name": "Jane Doe", "email": "jane@example.com" }\n  }'`;
    } else if (lang === 'js') {
      if (filenameEl) filenameEl.textContent = 'JavaScript (Fetch)';
      if (codeEl) codeEl.textContent = `// Query Bot & Live Database\nconst response = await fetch('${origin}/api/chat/message', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    message: 'Where is order #1042?',\n    customer: { name: 'Jane Doe', email: 'jane@example.com' }\n  })\n});\nconst result = await response.json();\nconsole.log(result.reply, result.dbQuery);`;
    } else if (lang === 'python') {
      if (filenameEl) filenameEl.textContent = 'Python (requests)';
      if (codeEl) codeEl.textContent = `import requests\n\nr = requests.post('${origin}/api/chat/message', json={\n    'message': 'Where is order #1042?',\n    'customer': {'name': 'Jane Doe', 'email': 'jane@example.com'}\n})\nprint(r.json())`;
    }
  },

  copyCode(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.textContent || el.innerText || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text.trim())
        .then(() => alert('Snippet copied to clipboard!'))
        .catch(() => this.fallbackCopy(text));
    } else {
      this.fallbackCopy(text);
    }
  },

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('Snippet copied to clipboard!');
    } catch (e) {
      alert('Please copy manually');
    }
    document.body.removeChild(ta);
  },

  copyActiveApiSnippet() {
    this.copyCode('code-api-snippet');
  },

  copyWizardApiCode() {
    this.copyCode('wizard-api-code');
  },

  async finishCreateBot() {
    this.setStarSpeech(`Woohoo! 🚀 Creating and configuring "${this.wizardData.botName}" with live database connectivity...`);

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.wizardData.botName || 'New Store Agent',
          store_type: this.wizardData.platform,
          store_name: this.wizardData.botName,
          bot_type: this.wizardData.botType,
          active_rules: ['rule-order-track', 'rule-product-stock', 'rule-return-refund', 'rule-discounts', 'rule-human-escalate'],
          theme: 'black'
        })
      });

      const data = await res.json();
      if (data.success) {
        setTimeout(() => {
          this.setStarSpeech(`All set! 🎉 Your new agent "${data.bot.name}" is created and wired to your database!`);
          setTimeout(() => {
            this.closeStarWizard();
            this.loadBots();
            this.activeBotId = data.bot.id;
            this.showDashboard();
            alert(`🎉 Success! Your new bot "${data.bot.name}" has been created!`);
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
    if (!stream) return;

    // Highlight active queue item
    document.querySelectorAll('.mockup-queue-col .queue-item').forEach((item, idx) => {
      item.classList.remove('active');
      if (person === 'jane' && idx === 0) item.classList.add('active');
      if (person === 'alex' && idx === 1) item.classList.add('active');
      if (person === 'sarah' && idx === 2) item.classList.add('active');
    });

    const profileAvatar = document.querySelector('.mockup-profile-col .profile-avatar-row img');
    const profileName = document.querySelector('.mockup-profile-col .profile-avatar-row div div:first-child');
    const profileSub = document.querySelector('.mockup-profile-col .profile-avatar-row div div:last-child');
    const profileLtv = document.querySelectorAll('.mockup-profile-col .profile-kpi-box div:last-child')[0];
    const profileOrders = document.querySelectorAll('.mockup-profile-col .profile-kpi-box div:last-child')[1];

    if (person === 'jane') {
      if (title) title.textContent = 'Jane Doe';
      if (badge) badge.textContent = 'Shopify Storefront';
      if (profileAvatar) profileAvatar.src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80';
      if (profileName) profileName.textContent = 'Jane Doe';
      if (profileSub) profileSub.textContent = 'Verified Shopify Shopper';
      if (profileLtv) profileLtv.textContent = '$342.00';
      if (profileOrders) profileOrders.textContent = '3 Orders';

      stream.innerHTML = `
        <div class="mock-msg user">Hi, where is my order #1042?</div>
        <div class="mock-msg bot">
          📦 <strong>Order #1042 Verified in Database!</strong><br><br>
          • <strong>Customer:</strong> Jane Doe<br>
          • <strong>Status:</strong> <span style="color:var(--accent-green); font-weight:600;">Out for Delivery</span><br>
          • <strong>Carrier:</strong> FedEx Express Delivery<br>
          • <strong>Estimated Delivery:</strong> Today by 5:30 PM<br>
          • <strong>Total:</strong> $108.00

          <div class="mock-card">
            <div style="display:flex; justify-content:space-between; align-items:center; font-weight:700; margin-bottom:6px;">
              <span style="font-size:0.78rem;">Tracking: FX-982194821</span>
              <span style="color:var(--accent-green); font-size:0.68rem; border:1px solid rgba(16,185,129,0.3); padding:2px 7px; border-radius:12px; background:rgba(16,185,129,0.1);">ON TIME</span>
            </div>
            <div class="mock-product-row">
              <img src="https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=120&h=120&q=80" class="mock-product-thumb" alt="Desk Mat">
              <div style="flex:1;">
                <div style="font-weight:600; font-size:0.8rem; color:#fff;">Minimalist Matte Black Desk Mat</div>
                <div style="font-size:0.7rem; color:var(--text-secondary);">Qty: 1 • SKU-001 • $48.00</div>
              </div>
            </div>
            <div class="mock-product-row">
              <img src="https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=120&h=120&q=80" class="mock-product-thumb" alt="Keycaps">
              <div style="flex:1;">
                <div style="font-weight:600; font-size:0.8rem; color:#fff;">Stealth Black PBT Keycaps Set</div>
                <div style="font-size:0.7rem; color:var(--text-secondary);">Qty: 1 • SKU-002 • $60.00</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (person === 'alex') {
      if (title) title.textContent = 'Alex Smith';
      if (badge) badge.textContent = 'WooCommerce Store';
      if (profileAvatar) profileAvatar.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80';
      if (profileName) profileName.textContent = 'Alex Smith';
      if (profileSub) profileSub.textContent = 'WooCommerce Customer';
      if (profileLtv) profileLtv.textContent = '$195.00';
      if (profileOrders) profileOrders.textContent = '2 Orders';

      stream.innerHTML = `
        <div class="mock-msg user">Do you have the stealth black keycaps in stock?</div>
        <div class="mock-msg bot">
          🏷️ <strong>Product Verified in Store Inventory!</strong><br><br>
          • <strong>Product:</strong> Stealth Black PBT Keycaps Set<br>
          • <strong>Price:</strong> $69.00<br>
          • <strong>Availability:</strong> <span style="color:var(--accent-green); font-weight:700;">🟢 In Stock (Ready to Ship)</span><br>
          • <strong>Warehouse Qty:</strong> 15 units remaining<br>
          • <strong>SKU:</strong> <code>SKU-002</code>
          
          <div class="mock-card">
            <div class="mock-product-row">
              <img src="https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=120&h=120&q=80" class="mock-product-thumb" alt="Keycaps">
              <div style="flex:1;">
                <div style="font-weight:600; font-size:0.8rem; color:#fff;">Stealth Black PBT Keycaps Set</div>
                <div style="font-size:0.7rem; color:var(--accent-green);">Warehouse A • Fast Dispatch</div>
              </div>
              <button class="btn-pill btn-pill-primary" style="font-size:0.72rem; padding:0.35rem 0.75rem;" onclick="app.triggerDemoChat()">Order Now</button>
            </div>
          </div>
        </div>
      `;
    } else if (person === 'sarah') {
      if (title) title.textContent = 'Sarah Connor';
      if (badge) badge.textContent = 'Custom Web Store';
      if (profileAvatar) profileAvatar.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80';
      if (profileName) profileName.textContent = 'Sarah Connor';
      if (profileSub) profileSub.textContent = 'High-Value Shopper';
      if (profileLtv) profileLtv.textContent = '$520.00';
      if (profileOrders) profileOrders.textContent = '4 Orders';

      stream.innerHTML = `
        <div class="mock-msg user">Are there any active promo codes for first-time orders?</div>
        <div class="mock-msg bot">
          🎉 <strong>Active Store Discount Rules Verified!</strong><br><br>
          • <strong>Code:</strong> <code>WELCOME10</code><br>
          • <strong>Discount:</strong> 10% Off Orders over $50<br>
          • <strong>Status:</strong> Active & Valid Storewide

          <div class="mock-card" style="background:#131226; border-color:rgba(168,85,247,0.35);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:#c084fc; font-size:0.85rem;">PROMO VOUCHER: WELCOME10</div>
                <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Applied automatically at checkout</div>
              </div>
              <span class="pill-badge-mint">10% OFF</span>
            </div>
          </div>
        </div>
      `;
    }
  },

  // Automated gentle chat loop on hero mockup
  initMockChatLoop() {
    const sequence = ['jane', 'alex', 'sarah'];
    let idx = 0;
    this.mockLoopInterval = setInterval(() => {
      const home = document.getElementById('view-homepage');
      if (home && home.style.display !== 'none') {
        idx = (idx + 1) % sequence.length;
        this.mockSelect(sequence[idx]);
      }
    }, 6500);
  },

  // Subtle 60fps Galaxy Particle Canvas
  initGalaxyCanvas() {
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const count = Math.min(Math.floor((width * height) / 18000), 75);
    const colors = [
      'rgba(129, 140, 248, ', // indigo
      'rgba(192, 132, 252, ', // violet
      'rgba(56, 189, 248, ',  // starlight cyan
      'rgba(255, 255, 255, '  // pure star
    ];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.6,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.6 + 0.2,
        dAlpha: (Math.random() * 0.01 + 0.005) * (Math.random() < 0.5 ? 1 : -1)
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      // Draw faint connections
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 85) {
            const lineAlpha = (1 - dist / 85) * 0.12;
            ctx.strokeStyle = `rgba(129, 140, 248, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        else if (p.y > height) p.y = 0;

        p.alpha += p.dAlpha;
        if (p.alpha <= 0.15 || p.alpha >= 0.85) p.dAlpha *= -1;

        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(render);
    }

    render();
  },

  triggerDemoChat() {
    if (window.RuleMindWidget && window.RuleMindWidget.toggle) {
      window.RuleMindWidget.toggle(true);
    } else {
      window.open('/demo-store.html', '_blank');
    }
  },

  toggleVideoPlay() {
    const video = document.getElementById('hero-demo-video');
    const btn = document.getElementById('btn-video-play');
    if (!video || !btn) return;
    if (video.paused) {
      video.play();
      btn.innerHTML = '❚❚ Pause';
    } else {
      video.pause();
      btn.innerHTML = '▶ Play';
    }
  },

  toggleVideoMute() {
    const video = document.getElementById('hero-demo-video');
    const btn = document.getElementById('btn-video-mute');
    if (!video || !btn) return;
    video.muted = !video.muted;
    btn.innerHTML = video.muted ? '🔇 Unmute' : '🔊 Mute';
  },

  runQuerySim(type, btnEl) {
    if (btnEl) {
      document.querySelectorAll('.query-sim-btn').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    const terminalEl = document.getElementById('sim-terminal-body');
    const statusBadge = document.getElementById('sim-status-badge');
    const jsonBody = document.getElementById('sim-json-body');
    if (!terminalEl || !jsonBody) return;

    if (statusBadge) {
      statusBadge.innerHTML = '⚡ QUERYING DATABASE...';
      statusBadge.style.color = '#f59e0b';
    }

    if (type === 'order') {
      terminalEl.innerHTML = `
        <span style="color:#64748b;">// 1. Incoming shopper question:</span><br>
        <span style="color:#fff;">"Where is my order #1042?"</span><br><br>
        <span style="color:#64748b;">// 2. Deterministic SQL Query executed:</span><br>
        <span class="sim-sql-kw">SELECT</span> id, status, carrier, tracking_number, items, total_usd<br>
        <span class="sim-sql-kw">FROM</span> orders <br>
        <span class="sim-sql-kw">WHERE</span> order_number = <span class="sim-sql-str">'1042'</span> <span class="sim-sql-kw">AND</span> customer_id = <span class="sim-sql-str">'cust_992'</span>;
      `;
      jsonBody.textContent = `{\n  "order_id": 1042,\n  "customer": "Jane Doe",\n  "status": "out_for_delivery",\n  "carrier": "FedEx Express",\n  "tracking": "FX-982194821",\n  "items": [\n    { "name": "Minimalist Matte Black Desk Mat", "qty": 1, "price": 48.00 },\n    { "name": "Stealth Black PBT Keycaps Set", "qty": 1, "price": 60.00 }\n  ],\n  "total": 108.00,\n  "eta": "Today by 5:30 PM"\n}`;
    } else if (type === 'stock') {
      terminalEl.innerHTML = `
        <span style="color:#64748b;">// 1. Incoming shopper question:</span><br>
        <span style="color:#fff;">"Is the Stealth Black PBT Keycaps Set in stock?"</span><br><br>
        <span style="color:#64748b;">// 2. Warehouse REST & SQL Inventory Query:</span><br>
        <span class="sim-sql-kw">SELECT</span> sku, product_name, stock_qty, warehouse_shelf, reorder_point<br>
        <span class="sim-sql-kw">FROM</span> inventory_items<br>
        <span class="sim-sql-kw">WHERE</span> sku = <span class="sim-sql-str">'SKU-002'</span>;
      `;
      jsonBody.textContent = `{\n  "sku": "SKU-002",\n  "product_name": "Stealth Black PBT Keycaps Set",\n  "stock_qty": 34,\n  "status": "in_stock",\n  "warehouse_shelf": "W3-B12",\n  "ships_in": "24 hours"\n}`;
    } else if (type === 'policy') {
      terminalEl.innerHTML = `
        <span style="color:#64748b;">// 1. Incoming shopper question:</span><br>
        <span style="color:#fff;">"What is your return policy?"</span><br><br>
        <span style="color:#64748b;">// 2. Rule evaluation: rule_code = 'RETURN_POLICY_30D'</span><br>
        <span class="sim-sql-kw">SELECT</span> rule_key, condition_type, action_payload<br>
        <span class="sim-sql-kw">FROM</span> store_rules<br>
        <span class="sim-sql-kw">WHERE</span> rule_key = <span class="sim-sql-str">'RETURN_POLICY_30D'</span> <span class="sim-sql-kw">AND</span> active = <span class="sim-sql-num">1</span>;
      `;
      jsonBody.textContent = `{\n  "rule_key": "RETURN_POLICY_30D",\n  "title": "30-Day Hassle-Free Returns",\n  "conditions": { "order_within_days": 30, "unopened_seal": true },\n  "return_portal_url": "https://mind-chat-323j.vercel.app/returns",\n  "refund_method": "original_payment_method"\n}`;
    }

    setTimeout(() => {
      if (statusBadge) {
        statusBadge.innerHTML = '⚡ 38ms EXECUTION (ZERO-AI)';
        statusBadge.style.color = '#10b981';
      }
    }, 150);
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

// Expose globally to window
window.app = app;
window.RuleMindApp = app;

// Delegated click listener fallback
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action === 'login') app.openAuthModal('login');
  else if (action === 'signup') app.openAuthModal('signup');
  else if (action === 'dashboard') app.showDashboard();
  else if (action === 'logout') app.logout();
  else if (action === 'demo') app.triggerDemoChat();
});

// Robust DOM initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}
