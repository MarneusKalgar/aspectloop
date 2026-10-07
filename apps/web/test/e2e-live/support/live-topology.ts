// Fixed approved local topology; not an arbitrary-origin or forwarding configuration.
const webHost = 'localhost';
const webPort = 5173;
const gateHost = '127.0.0.1';
const gatePort = 18080;
const gatewayPort = 8080;
const gatewayOrigin = `http://127.0.0.1:${gatewayPort}`;

export const LIVE_TOPOLOGY = {
  gate: {
    apiOrigin: `http://${webHost}:${gatePort}`,
    graphqlUrl: `http://${gateHost}:${gatePort}/graphql`,
    host: gateHost,
    port: gatePort,
  },
  gateway: {
    graphqlUrl: `${gatewayOrigin}/graphql`,
    hostHeader: `${webHost}:${gatewayPort}`,
    livenessUrl: `${gatewayOrigin}/health`,
    readinessUrl: `${gatewayOrigin}/health/readiness`,
  },
  web: { host: webHost, origin: `http://${webHost}:${webPort}`, port: webPort },
} as const;
