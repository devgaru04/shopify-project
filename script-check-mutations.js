const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), 'backend', '.env') });
const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const shop = process.env.SHOP;
const apiVersion = process.env.API_VERSION || '2026-07';
if (!adminToken || !shop) {
  console.error('Missing SHOP or token');
  process.exit(1);
}
const body = JSON.stringify({ query: 'query { __schema { mutationType { fields { name } } } }' });
const options = {
  hostname: `${shop}.myshopify.com`,
  path: `/admin/api/${apiVersion}/graphql.json`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Shopify-Access-Token': adminToken,
  },
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.errors) {
        console.error(JSON.stringify(json.errors, null, 2));
      }
      const names = json.data.__schema?.mutationType?.fields?.map((f) => f.name) || [];
      const relevant = names.filter((n) => /comment|tag|discount/i.test(n));
      console.log('relevant:');
      console.log(relevant.join('\n'));
      console.log('total', names.length);
    } catch (e) {
      console.error('parse error', e.message, data);
    }
  });
});
req.on('error', (err) => console.error(err.message));
req.write(body);
req.end();
