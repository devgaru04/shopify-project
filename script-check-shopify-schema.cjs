const https = require('https');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const shop = process.env.SHOP;
const apiVersion = process.env.API_VERSION || '2026-07';

if (!adminToken || !shop) {
  console.error('Missing SHOP or SHOPIFY_ADMIN_ACCESS_TOKEN');
  process.exit(1);
}

const query = `
query IntrospectShopify {
  __schema {
    mutationType {
      fields {
        name
      }
    }
  }
  discountInput: __type(name: "DiscountCodeBasicInput") {
    name
    inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
  }
  commentEventInput: __type(name: "CommentEventCreateInput") {
    name
    inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
  }
}
`;

const body = JSON.stringify({ query });
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

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (error) {
      console.error('Error parsing response:', error.message);
      console.error(data);
      process.exit(1);
    }
  });
});

req.on('error', err => {
  console.error(err.message);
  process.exit(1);
});
req.write(body);
req.end();
