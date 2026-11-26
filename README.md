# RuleMind — Zero-AI Deterministic Customer Support Platform

A high-performance customer desk and omnichannel chat platform inspired by **MindChat**, engineered with a **100% deterministic rule engine** (zero AI hallucinations) and designed in a **Minimalist Black Theme**.

---

## 🌟 Key Features

1. **Zero-AI Rule Engine ("If Condition → Check Database → Answer That")**:
   - Replaces unpredictable AI hallucinations with precise deterministic decision trees.
   - Extracts order IDs (e.g. `#1042`), emails, product keywords, and discount queries.
   - Queries the store database in sub-milliseconds and returns verified tracking details, inventory counts, or active promotions.

2. **Minimalist Black Theme**:
   - True OLED black (`#060608`), subtle dark zinc borders (`#22222a`), and high-contrast typography.
   - Zero clutter, ultra-clean modern aesthetic.

3. **No WhatsApp Dependency**:
   - Web-native floating widget and storefront embed.
   - Keeps shoppers on your site to drive higher checkout conversion, avoiding third-party WhatsApp Business API fees or restrictions.

4. **Omnichannel Unified Support Inbox**:
   - Consolidates customer chats across Shopify, WordPress, and Custom websites into one single team inbox.
   - Customer 360 CDP: Displays Lifetime Value (LTV), total orders, past order history, and active carts.
   - One-Click Human Takeover: Live agents can pause the bot and chat directly with shoppers.

5. **Store Connectors**:
   - **Shopify**: 1-line script tag for `theme.liquid` + Webhook receiver (`/api/integrations/shopify/webhook`).
   - **WordPress / WooCommerce**: `functions.php` embed snippet + WooCommerce order sync.
   - **Custom Websites**: Universal `<script src="http://localhost:3000/widget.js">` tag.

---

## 🚀 Getting Started

### 1. Start the Server
```bash
cd "C:\Users\kk\.gemini\antigravity\scratch\rulemind-app"
npm start
```
The server will boot on `http://localhost:3000`.

### 2. Access the Web Interfaces
- **Admin Dashboard & Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Demo Storefront (Minimalist Hardware Store)**: [http://localhost:3000/demo-store.html](http://localhost:3000/demo-store.html)
- **Live Rule Engine Simulator**: Located directly on the Overview tab of the homepage.

---

## 📂 Project Architecture

```
rulemind-app/
├── server.js               # Express API server, Webhooks & Static file server
├── ruleEngine.js           # Deterministic Decision & Condition-Action Engine
├── db.js                   # Persistent database layer (Orders, Products, Rules, Customers)
├── data/
│   └── store_db.json       # JSON-persisted store database
└── public/
    ├── index.html          # Main application & admin console (5 views)
    ├── demo-store.html     # Sample e-commerce store with embedded widget
    ├── widget.js           # Standalone embeddable widget for external sites
    ├── css/
    │   └── style.css       # Minimalist Black design system
    └── js/
        └── app.js          # Client-side controller for inbox, rules, and simulator
```

---

## 🔌 Connecting to External Sites

### Custom Website (HTML / React / Vue)
```html
<script src="http://localhost:3000/widget.js" 
        data-server="http://localhost:3000" 
        data-theme="black" 
        async></script>
```

### Shopify Storefront (`theme.liquid`)
```liquid
<script src="http://localhost:3000/widget.js"
  data-server="http://localhost:3000"
  data-source="Shopify"
  data-customer-email="{{ customer.email }}"
  data-customer-name="{{ customer.name }}"
  async></script>
```

### WordPress / WooCommerce (`functions.php`)
```php
add_action('wp_footer', function() {
  ?>
  <script src="http://localhost:3000/widget.js" 
          data-server="http://localhost:3000" 
          data-source="WordPress"></script>
  <?php
});
```
