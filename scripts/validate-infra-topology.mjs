import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

const root = resolve(process.cwd());
const topologyArg = process.argv.find((arg) => arg.startsWith('--topology='));
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));

const topologyPath = resolve(root, topologyArg?.slice('--topology='.length) || 'config/infra-topology.json');
const reportPath = resolve(root, reportArg?.slice('--report='.length) || 'reports/infra-topology-validation.json');

const allowedRegions = new Set(['germany', 'austria', 'slovenia', 'croatia', 'montenegro', 'albania', 'kosova']);
const allowedNodeTypes = new Set(['supernode', 'relay', 'client', 'edge']);
const allowedHttpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const allowedRoutingModes = new Set(['handshake', 'telemetry', 'sync', 'broadcast', 'route']);
const allowedWaves = new Set(['control', 'telemetry', 'sync', 'broadcast', 'route']);
const forbidden = /(\bmock\b|\bfake\b|\bdummy\b|\bsynthetic\b|\bplaceholder\b|\bsimulate\b)/i;

const errors = [];
const warnings = [];

function addError(path, message) {
  errors.push({ path, message });
}

function addWarning(path, message) {
  warnings.push({ path, message });
}

function assert(condition, path, message) {
  if (!condition) addError(path, message);
}

function containsForbidden(value) {
  return typeof value === 'string' && forbidden.test(value);
}

let topology;
try {
  topology = JSON.parse(readFileSync(topologyPath, 'utf8'));
} catch (error) {
  addError('topology', `Unable to read/parse topology JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

if (topology) {
  assert(typeof topology.meta === 'object' && topology.meta !== null, 'meta', 'Missing meta object.');
  assert(Array.isArray(topology.internalApis), 'internalApis', 'internalApis must be an array.');
  assert(typeof topology.mesh === 'object' && topology.mesh !== null, 'mesh', 'Missing mesh object.');
  assert(typeof topology.lora === 'object' && topology.lora !== null, 'lora', 'Missing lora object.');

  if (topology.meta) {
    assert(typeof topology.meta.name === 'string' && topology.meta.name.length > 0, 'meta.name', 'meta.name is required.');
    assert(typeof topology.meta.version === 'string' && topology.meta.version.length > 0, 'meta.version', 'meta.version is required.');
    assert(Array.isArray(topology.meta.sourceOfTruth) && topology.meta.sourceOfTruth.length > 0, 'meta.sourceOfTruth', 'meta.sourceOfTruth must list at least one file.');
  }

  const apiIds = new Set();
  if (Array.isArray(topology.internalApis)) {
    topology.internalApis.forEach((api, index) => {
      const base = `internalApis[${index}]`;
      assert(typeof api.id === 'string' && api.id.length > 0, `${base}.id`, 'API id is required.');
      assert(typeof api.service === 'string' && api.service.length > 0, `${base}.service`, 'API service is required.');
      assert(typeof api.basePath === 'string' && api.basePath.startsWith('/api/'), `${base}.basePath`, 'API basePath must start with /api/.');
      assert(typeof api.path === 'string' && api.path.startsWith('/'), `${base}.path`, 'API path must start with /.');
      assert(allowedHttpMethods.has(api.method), `${base}.method`, `API method must be one of: ${[...allowedHttpMethods].join(', ')}.`);
      assert(typeof api.owner === 'string' && api.owner.length > 0, `${base}.owner`, 'API owner is required.');

      if (apiIds.has(api.id)) addError(`${base}.id`, `Duplicate API id: ${api.id}`);
      apiIds.add(api.id);

      for (const [field, value] of Object.entries(api)) {
        if (containsForbidden(value)) {
          addError(`${base}.${field}`, `Forbidden token detected in API field value: ${value}`);
        }
      }
    });
  }

  if (topology.mesh) {
    assert(typeof topology.mesh.networkId === 'string' && topology.mesh.networkId.length > 0, 'mesh.networkId', 'mesh.networkId is required.');
    assert(Array.isArray(topology.mesh.routingModes), 'mesh.routingModes', 'mesh.routingModes must be an array.');
    assert(Array.isArray(topology.mesh.regions), 'mesh.regions', 'mesh.regions must be an array.');
    assert(Array.isArray(topology.mesh.nodes) && topology.mesh.nodes.length > 0, 'mesh.nodes', 'mesh.nodes must be a non-empty array.');
    assert(Array.isArray(topology.mesh.links), 'mesh.links', 'mesh.links must be an array.');

    if (Array.isArray(topology.mesh.routingModes)) {
      topology.mesh.routingModes.forEach((mode, index) => {
        if (!allowedRoutingModes.has(mode)) {
          addError(`mesh.routingModes[${index}]`, `Unsupported routing mode: ${mode}`);
        }
      });
    }

    if (Array.isArray(topology.mesh.regions)) {
      topology.mesh.regions.forEach((region, index) => {
        if (!allowedRegions.has(region)) {
          addError(`mesh.regions[${index}]`, `Unsupported region: ${region}`);
        }
      });
    }

    const nodeIds = new Set();
    if (Array.isArray(topology.mesh.nodes)) {
      topology.mesh.nodes.forEach((node, index) => {
        const base = `mesh.nodes[${index}]`;
        assert(typeof node.id === 'string' && node.id.length > 0, `${base}.id`, 'Node id is required.');
        assert(typeof node.host === 'string' && node.host.length > 0, `${base}.host`, 'Node host is required.');
        assert(Number.isInteger(node.port) && node.port > 0, `${base}.port`, 'Node port must be a positive integer.');
        assert(allowedRegions.has(node.region), `${base}.region`, `Node region must be one of: ${[...allowedRegions].join(', ')}.`);
        assert(allowedNodeTypes.has(node.type), `${base}.type`, `Node type must be one of: ${[...allowedNodeTypes].join(', ')}.`);

        if (nodeIds.has(node.id)) addError(`${base}.id`, `Duplicate node id: ${node.id}`);
        nodeIds.add(node.id);

        for (const [field, value] of Object.entries(node)) {
          if (containsForbidden(value)) {
            addError(`${base}.${field}`, `Forbidden token detected in node field value: ${value}`);
          }
        }
      });
    }

    if (Array.isArray(topology.mesh.links)) {
      topology.mesh.links.forEach((link, index) => {
        const base = `mesh.links[${index}]`;
        assert(typeof link.from === 'string' && link.from.length > 0, `${base}.from`, 'Link from is required.');
        assert(typeof link.to === 'string' && link.to.length > 0, `${base}.to`, 'Link to is required.');
        assert(typeof link.wave === 'string' && allowedWaves.has(link.wave), `${base}.wave`, `Link wave must be one of: ${[...allowedWaves].join(', ')}.`);

        if (typeof link.from === 'string' && !nodeIds.has(link.from)) {
          addError(`${base}.from`, `Link source node does not exist: ${link.from}`);
        }
        if (typeof link.to === 'string' && !nodeIds.has(link.to)) {
          addError(`${base}.to`, `Link target node does not exist: ${link.to}`);
        }
      });
    }
  }

  if (topology.lora) {
    assert(Number.isInteger(topology.lora.gatewayPort) && topology.lora.gatewayPort > 0, 'lora.gatewayPort', 'lora.gatewayPort must be a positive integer.');
    assert(typeof topology.lora.frequencyMHz === 'number' && topology.lora.frequencyMHz > 0, 'lora.frequencyMHz', 'lora.frequencyMHz must be a positive number.');
    assert(typeof topology.lora.packetEvent === 'string' && topology.lora.packetEvent.length > 0, 'lora.packetEvent', 'lora.packetEvent is required.');
    assert(Array.isArray(topology.lora.requiredPacketFields) && topology.lora.requiredPacketFields.length > 0, 'lora.requiredPacketFields', 'lora.requiredPacketFields must be non-empty array.');
    assert(Array.isArray(topology.lora.verificationSignals) && topology.lora.verificationSignals.length > 0, 'lora.verificationSignals', 'lora.verificationSignals must be non-empty array.');

    const frequency = topology.lora.frequencyMHz;
    if (typeof frequency === 'number' && (frequency < 860 || frequency > 930)) {
      addWarning('lora.frequencyMHz', `Frequency ${frequency}MHz is outside common EU LoRa range.`);
    }

    for (const [field, value] of Object.entries(topology.lora)) {
      if (containsForbidden(value)) {
        addError(`lora.${field}`, `Forbidden token detected in LoRa field value: ${value}`);
      }
    }
  }
}

const report = {
  policy: 'NO_FAKE_EVER',
  generatedAt: new Date().toISOString(),
  topology: relative(root, topologyPath),
  errors,
  warnings,
  errorCount: errors.length,
  warningCount: warnings.length,
  valid: errors.length === 0,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Topology validation: ${report.valid ? 'PASS' : 'FAIL'}`);
console.log(`Errors: ${report.errorCount}, Warnings: ${report.warningCount}`);
console.log(`Report: ${relative(root, reportPath)}`);

if (!report.valid) {
  for (const error of errors.slice(0, 50)) {
    console.log(`ERROR ${error.path}: ${error.message}`);
  }
  process.exitCode = 1;
}