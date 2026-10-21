// Data model + IP/CIDR helper functions for the Kathara Lab Generator.

let __idCounter = 1;
function uid(prefix = "id") {
  return `${prefix}_${(__idCounter++).toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- IP / CIDR helpers ----------

function ipToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(int) {
  return [24, 16, 8, 0].map((shift) => (int >>> shift) & 0xff).join(".");
}

function isValidIp(ip) {
  return ipToInt(ip) !== null;
}

function cidrToMaskInt(cidr) {
  if (cidr <= 0) return 0;
  if (cidr >= 32) return 0xffffffff >>> 0;
  return (0xffffffff << (32 - cidr)) >>> 0;
}

// Returns "network/cidr" string for a given host ip + prefix length.
function networkCidr(ip, cidr) {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return null;
  const mask = cidrToMaskInt(Number(cidr));
  const netInt = (ipInt & mask) >>> 0;
  return `${intToIp(netInt)}/${cidr}`;
}

function networkAddress(ip, cidr) {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return null;
  const mask = cidrToMaskInt(Number(cidr));
  return intToIp((ipInt & mask) >>> 0);
}

// Very small validator for "a.b.c.d/n" or "a.b.c.d" (defaults /32) strings, comma-separated lists.
function parseCidrList(text) {
  if (!text) return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- Model factories ----------

function newNetwork(name = "") {
  return {
    id: uid("net"),
    name: name || nextNetworkName(),
    x: 300,
    y: 200,
  };
}

let __netLetterCounter = 0;
function nextNetworkName() {
  // A, B, C ... Z, AA, AB ...
  let n = __netLetterCounter++;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function newDevice(type = "router", name = "") {
  return {
    id: uid("dev"),
    type, // 'router' | 'host'
    name: name || (type === "router" ? "r" + Math.floor(Math.random() * 900 + 100) : "pc" + Math.floor(Math.random() * 900 + 100)),
    as: "",
    x: 100,
    y: 100,
    image: "", // optional Kathara image override, e.g. "kathara/frr" -> device[image]="kathara/frr" in lab.conf
    interfaces: [], // { network: networkId, ip: "", cidr: 24 }
    routing: {
      rip: {
        enabled: false,
        networks: "",
        redistribute: { connected: true, bgp: false, ospf: false, static: false, kernel: false },
        forceAnnounce: "", // CIDRs (comma separated) forced into RIP via the "route <cidr>" directive, regardless of the RIB
      },
      ospf: {
        enabled: false,
        // "kernel" redistributes plain shell "ip route add" routes (not owned by FRR) -- use this instead of
        // "static" when the route was NOT declared inside frr.conf (see staticRoutes[].declareInFrr below).
        redistribute: { connected: false, bgp: false, rip: false, static: false, kernel: false },
        perInterface: {}, // ifaceIndex -> {area, cost}
        stubAreas: "", // area IDs (comma separated) declared as "area <id> stub" -- must be repeated on every router with an interface in that area
        manualNetworks: "", // one "<CIDR> area <id>" per line; overrides the network statements auto-computed from perInterface when non-empty (e.g. to aggregate several subnets under one supernet)
      },
      bgp: {
        enabled: false,
        mode: "standard", // standard | fabric (unnumbered EVPN, spine/leaf datacenter fabric)
        noEbgpRequiresPolicy: true,
        noNetworkImportCheck: true,
        debug: true,
        // neighbors: { ip, remoteAs, description,
        //   routeMapOut, metric, routeMapOutMatch, routeMapIn, localPref, routeMapInMatch,
        //     -- routeMap*Match (comma-separated CIDRs) restricts the metric/local-preference change to only
        //     those destination prefixes (via an access-list + "match ip address"), e.g. to prefer a path only
        //     for specific destinations while leaving everything else unaffected. Empty = applies to all routes.
        //   prefixListIn: { enabled, mode: "deny"|"permit", prefixes },  -- "deny": block listed prefixes, allow the rest; "permit": allow only the listed prefixes (implicit deny-all), e.g. for customer/provider/peer transit policy. Use "any" as a prefix entry for an unconditional permit-any.
        //   prefixListOut: { enabled, mode, prefixes } }
        neighbors: [],
        networks: "",
        redistribute: { connected: false, static: false, kernel: false },
        // fabric mode only:
        routerId: "",
        fabricInterfaces: {}, // ifaceIndex -> bool, which links run BGP unnumbered peer-group TOR
        fabricAdvertiseAllVni: false, // leaf: "advertise-all-vni" in the l2vpn evpn address-family
        fabricRedistributeLoopback: false, // leaf: redistribute connected route-map LOOPBACKS (match interface lo)
      },
    },
    staticRoutes: [], // { destination, via, iface, declareInFrr }: declareInFrr writes a top-level "ip route" line
    // in frr.conf (so zebra owns it and "redistribute static" can pick it up) instead of a plain shell "ip route add"
    defaultRoute: { enabled: false, via: "", iface: "" },
    dns: {
      role: "none", // none | root | authoritative | resolver
      hostname: "", // FQDN used in DNS records, e.g. "dns.net." or "ROOT-SERVER."
      zone: "", // authoritative only, e.g. "net"
      records: [], // authoritative: { name, ip }
      delegations: [], // root only: { subdomain, nsName, nsIp }
      rootServer: { name: "", ip: "" }, // authoritative/resolver: identity of the root server for the hint zone
      allowRecursion: true, // resolver only: whether to emit an allow-recursion line at all
      allowRecursionCidr: "0.0.0.0/0", // resolver only: the CIDR allowed to recurse
    },
    resolvConf: { mode: "none", nameserver: "" }, // none | empty | custom
    nat: {
      enabled: false,
      masqueradeIface: "",
      enableForwarding: true,
      dnatRules: [], // { destIp, proto, dport, targets: [{ip, port, probability}] }
    },
    bridge: {
      // L2 access switch bridging all interfaces into one or more VLANs (like s1/s2/s3 in the
      // "patchwork"/"exapus" exams): every interface is added to the bridge. An interface either
      // carries a single VLAN untagged (access port, listed in portVlan) or, if not listed, is a
      // tagged trunk port carrying every VLAN in `vlans` (e.g. the uplink towards the VXLAN fabric).
      enabled: false,
      vlans: "", // VLAN IDs present on this bridge, comma separated, e.g. "100" or "100, 200, 300"
      portVlan: {}, // ifaceIndex -> single VLAN ID for that access/untagged port
    },
    vtep: {
      // VXLAN VTEP role for a leaf switch: one loopback-based VXLAN tunnel endpoint per tenant
      // (entries), bridged together with the local trunk interface(s) towards the access
      // switches/tenant containers (e.g. multiple tenants sharing the same leaf in "exapus").
      enabled: false,
      loopbackIp: "",
      entries: [], // { vni, vlan } one per tenant sharing this leaf
      trunkIfaces: "", // ifaceIndex values (comma separated) of the local tagged interfaces joining the tenant bridge(s)
    },
    webserver: {
      enabled: false,
      html: "<html>\n  <body>\n    <h1>It works!</h1>\n  </body>\n</html>\n",
    },
    labConfExtra: "", // raw extra lab.conf directives for this device, one per line, e.g. [sysctl]="net.ipv4.fib_multipath_hash_policy=1" or [ipv6]=True
    customStartup: "",
    customFrrConf: "",
    notes: "",
  };
}

function newModel() {
  return {
    labName: "lab",
    description: "",
    devices: [],
    networks: [],
  };
}

// ---------- Query helpers ----------

function getInterfaceIndex(device, networkId) {
  return device.interfaces.findIndex((i) => i.network === networkId);
}

function ethName(index) {
  return `eth${index}`;
}

// Devices (with their interface) attached to a given network, excluding one device.
function peersOnNetwork(model, networkId, excludeDeviceId) {
  const out = [];
  for (const d of model.devices) {
    if (d.id === excludeDeviceId) continue;
    const idx = getInterfaceIndex(d, networkId);
    if (idx !== -1) out.push({ device: d, iface: d.interfaces[idx], ifaceIndex: idx });
  }
  return out;
}

function allInterfacesFlat(model) {
  const out = [];
  for (const d of model.devices) {
    d.interfaces.forEach((iface, idx) => {
      const net = model.networks.find((n) => n.id === iface.network);
      out.push({ device: d, iface, ifaceIndex: idx, network: net });
    });
  }
  return out;
}

function findDevice(model, id) {
  return model.devices.find((d) => d.id === id);
}
function findNetwork(model, id) {
  return model.networks.find((n) => n.id === id);
}

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}
