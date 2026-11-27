const app = require('./api/index');
const PORT = process.env.PORT || 3000;

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
