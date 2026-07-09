// fallinsurance MCP server (stdio)
// Exposes SDK capabilities as MCP tools + resources.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  T0_RULES, PRODUCT_CLASSES, PRODUCT_LABEL, IDD_QUESTIONS,
  PI_MINIMUMS, FOS_LIMITS, IDD_CPD_FLOOR_HOURS,
  computePremium, daysUntil, renewalFlag, pipelineBuckets,
  canBind, compileDemandsAndNeeds,
  complianceSnapshot, lookupT0, META
} from '@ai-native-solutions/fallinsurance-sdk';

const server = new Server(
  { name: 'fallinsurance-mcp', version: META.version },
  { capabilities: { tools: {}, resources: {} } }
);

// ------------------------------------------------------------
// Tools
// ------------------------------------------------------------
const TOOLS = [
  {
    name: 'compute_premium',
    description: 'Compute broker commission, net-to-insurer and total-payable from gross premium, IPT, broker fee and commission percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        gross: { type: 'number', description: 'Gross premium in GBP' },
        ipt:   { type: 'number', description: 'Insurance Premium Tax in GBP (12% std / 20% travel)' },
        fee:   { type: 'number', description: 'Broker fee in GBP' },
        commissionPct: { type: 'number', description: 'Commission percentage (0-100)' }
      },
      required: ['gross']
    }
  },
  {
    name: 'renewal_flag',
    description: 'Return the critical-date bucket for an in-force policy renewal date (7/14/30/60 day ladder).',
    inputSchema: {
      type: 'object',
      properties: {
        renewalDate: { type: 'string', description: 'ISO date YYYY-MM-DD' }
      },
      required: ['renewalDate']
    }
  },
  {
    name: 'pipeline_buckets',
    description: 'Filter a list of policies into renewal buckets (black/critical/red/amber/lapsed/ok).',
    inputSchema: {
      type: 'object',
      properties: {
        policies: { type: 'array', items: { type: 'object' }, description: 'Policy objects with status and renewalDate' }
      },
      required: ['policies']
    }
  },
  {
    name: 'can_bind',
    description: 'Check whether a policy can move to in-force. Requires IPID delivery recorded AND Demands & Needs statement of at least 30 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        policy: { type: 'object', description: 'Policy with ipid.delivered and demandsAndNeeds' }
      },
      required: ['policy']
    }
  },
  {
    name: 'compile_demands_and_needs',
    description: 'Compile an IDD Article 20 / ICOBS 5.2 Demands & Needs statement from structured answers.',
    inputSchema: {
      type: 'object',
      properties: {
        policy:  { type: 'object' },
        client:  { type: 'object' },
        answers: {
          type: 'object',
          properties: {
            coverFor:       { type: 'string' },
            capacity:       { type: 'string' },
            claimsHistory:  { type: 'string' },
            preferences:    { type: 'string' },
            vulnerabilities:{ type: 'string' }
          }
        }
      },
      required: ['answers']
    }
  },
  {
    name: 'compliance_snapshot',
    description: 'One-shot compliance dashboard summary: PI cover status vs MIPRU 3.2.7R, IDD evidence gaps (IPID + D&N), SM&CR CPD floor, CASS 5 model.',
    inputSchema: {
      type: 'object',
      properties: {
        firm:     { type: 'object' },
        advisers: { type: 'array', items: { type: 'object' } },
        policies: { type: 'array', items: { type: 'object' } }
      },
      required: ['firm']
    }
  },
  {
    name: 'lookup_t0_rule',
    description: 'Search 14 canonical UK GI-broker briefings (IDD, IPID, CASS 5, PI, AR vs DA, FOS, cyber, MTAs, premium financing, schemes, ICOBS, customer categories, Consumer Duty).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question' }
      },
      required: ['query']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  let out;
  try {
    switch (name) {
      case 'compute_premium':
        out = computePremium(a);
        break;
      case 'renewal_flag': {
        const days = daysUntil(a.renewalDate);
        out = { renewalDate: a.renewalDate, daysUntilRenewal: days, flag: renewalFlag(days) };
        break;
      }
      case 'pipeline_buckets':
        out = pipelineBuckets(a.policies || []);
        break;
      case 'can_bind':
        out = canBind(a.policy);
        break;
      case 'compile_demands_and_needs':
        out = { statement: compileDemandsAndNeeds(a) };
        break;
      case 'compliance_snapshot':
        out = complianceSnapshot(a);
        break;
      case 'lookup_t0_rule':
        out = lookupT0(a.query) || { rule: null, score: 0, note: 'No T0 rule matched' };
        break;
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
  return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
});

// ------------------------------------------------------------
// Resources — static reference material
// ------------------------------------------------------------
const RESOURCES = [
  { uri: 'fallinsurance://t0-rules',        name: 'T0 rules (14 UK GI briefings)',    mimeType: 'application/json' },
  { uri: 'fallinsurance://product-classes', name: 'Product classes',                  mimeType: 'application/json' },
  { uri: 'fallinsurance://idd-questions',   name: 'IDD Demands & Needs questionnaire',mimeType: 'application/json' },
  { uri: 'fallinsurance://pi-minimums',     name: 'PI minimum cover (MIPRU 3.2.7R)',  mimeType: 'application/json' },
  { uri: 'fallinsurance://fos-limits',      name: 'FOS award limits (DISP 3.7.4R)',   mimeType: 'application/json' }
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  let payload;
  switch (uri) {
    case 'fallinsurance://t0-rules':        payload = T0_RULES; break;
    case 'fallinsurance://product-classes': payload = { classes: PRODUCT_CLASSES, labels: PRODUCT_LABEL }; break;
    case 'fallinsurance://idd-questions':   payload = IDD_QUESTIONS; break;
    case 'fallinsurance://pi-minimums':     payload = { ...PI_MINIMUMS, cpdFloorHours: IDD_CPD_FLOOR_HOURS }; break;
    case 'fallinsurance://fos-limits':      payload = FOS_LIMITS; break;
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
  return {
    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(payload, null, 2) }]
  };
});

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
