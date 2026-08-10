import { adminFetch } from './backend/services/shopifyService.js';
import { env } from './backend/config/env.js';
if (!env.adminAccessToken) {
  console.error('No admin token');
  process.exit(1);
}
const q = `query introspectDiscountBasic { __type(name: "DiscountCodeBasicInput") { name inputFields { name type { kind name ofType { kind name ofType { kind name }}}}}}`;
adminFetch(q).then(data => { console.log(JSON.stringify(data, null, 2)); }).catch(err => { console.error(err.message); process.exit(1); });
