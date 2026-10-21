// Ready-made topology presets. "Palabra" reproduces the 2023-12-18 IDC exam
// (RIP inside each AS, BGP between ASes, DNS root/authoritative/resolver chain)
// so it doubles as a self-check for the generator.


function buildPalabraPreset() {
  const model = newModel();
  model.labName = "palabra";
  model.description = "IDC - Terza prova intermedia del 18-12-2023 'PALABRA' (BGP+RIP+DNS)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const D = net("D", 260, 120);
  const C = net("C", 120, 260);
  const A = net("A", 120, 420);
  const B = net("B", 300, 420);
  const G = net("G", 620, 120);
  const F = net("F", 460, 260);
  const H = net("H", 460, 420);
  const E = net("E", 300, 560);
  const I = net("I", 780, 260);
  const K = net("K", 780, 420);
  const J = net("J", 940, 420);

  function router(name, as, x, y) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.routing.rip.enabled = true;
    d.routing.rip.networks = `${as === 1 ? "1" : as === 2 ? "2" : "3"}.0.0.0/8`;
    d.routing.rip.redistribute = { connected: true, bgp: true, ospf: false, static: false };
    d.routing.bgp.enabled = true;
    model.devices.push(d);
    return d;
  }
  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip, cidr });
    return dev.interfaces.length - 1;
  }

  const as1r1 = router("as1r1", 1, 60, 60);
  addIf(as1r1, D, "10.20.0.1", 30);
  addIf(as1r1, C, "1.0.0.1", 24);

  const as1r2 = router("as1r2", 1, 60, 340);
  addIf(as1r2, A, "1.1.0.1", 24);
  addIf(as1r2, C, "1.0.0.2", 24);
  addIf(as1r2, B, "10.20.1.1", 30);

  const as2r1 = router("as2r1", 2, 420, 60);
  addIf(as2r1, D, "10.20.0.2", 30);
  addIf(as2r1, G, "20.30.0.1", 30);
  addIf(as2r1, F, "2.0.0.1", 24);

  const as2r2 = router("as2r2", 2, 420, 340);
  addIf(as2r2, B, "10.20.1.2", 30);
  addIf(as2r2, F, "2.0.0.2", 24);
  addIf(as2r2, H, "20.30.1.1", 30);
  addIf(as2r2, E, "2.1.0.1", 24);

  const as3r1 = router("as3r1", 3, 780, 60);
  addIf(as3r1, G, "20.30.0.2", 30);
  addIf(as3r1, I, "3.0.0.1", 24);

  const as3r2 = router("as3r2", 3, 780, 340);
  addIf(as3r2, H, "20.30.1.2", 30);
  addIf(as3r2, I, "3.0.0.2", 24);
  addIf(as3r2, K, "3.2.0.1", 24);
  addIf(as3r2, J, "3.1.0.1", 24);

  // BGP networks announced + eBGP/iBGP neighbors
  as1r1.routing.bgp.networks = "1.0.0.0/8, 10.20.0.0/30";
  as1r1.routing.bgp.neighbors = [
    { ip: "10.20.0.2", remoteAs: 2, description: "Router as2r1", routeMapOut: true, metric: 20 },
    { ip: "1.0.0.2", remoteAs: 1, description: "Router as1r2 (iBGP)", routeMapOut: false, metric: 20 },
  ];

  as1r2.routing.bgp.networks = "1.0.0.0/8, 10.20.1.0/30";
  as1r2.routing.bgp.neighbors = [
    { ip: "10.20.1.2", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20 },
    { ip: "1.0.0.1", remoteAs: 1, description: "Router as1r1 (iBGP)", routeMapOut: false, metric: 20 },
  ];

  as2r1.routing.bgp.networks = "2.0.0.0/8, 10.20.0.0/30, 20.30.0.0/30";
  as2r1.routing.bgp.neighbors = [
    { ip: "10.20.0.1", remoteAs: 1, description: "Router as1r1", routeMapOut: false, metric: 20 },
    { ip: "2.0.0.2", remoteAs: 2, description: "Router as2r2 (iBGP)", routeMapOut: false, metric: 20 },
    { ip: "20.30.0.2", remoteAs: 3, description: "Router as3r1", routeMapOut: false, metric: 20 },
  ];

  as2r2.routing.bgp.networks = "2.0.0.0/8, 10.20.1.0/30, 20.30.1.0/30";
  as2r2.routing.bgp.neighbors = [
    { ip: "10.20.1.1", remoteAs: 1, description: "Router as1r2", routeMapOut: false, metric: 20 },
    { ip: "2.0.0.1", remoteAs: 2, description: "Router as2r1 (iBGP)", routeMapOut: false, metric: 20 },
    { ip: "20.30.1.2", remoteAs: 3, description: "Router as3r2", routeMapOut: false, metric: 20 },
  ];

  as3r1.routing.bgp.networks = "3.0.0.0/8, 20.30.0.0/30";
  as3r1.routing.bgp.neighbors = [
    { ip: "3.0.0.2", remoteAs: 3, description: "Router as3r2 (iBGP)", routeMapOut: false, metric: 20 },
    { ip: "20.30.0.1", remoteAs: 2, description: "Router as2r1", routeMapOut: false, metric: 20 },
  ];

  as3r2.routing.bgp.networks = "3.0.0.0/8, 20.30.1.0/30";
  as3r2.routing.bgp.neighbors = [
    { ip: "3.0.0.1", remoteAs: 3, description: "Router as3r1 (iBGP)", routeMapOut: false, metric: 20 },
    { ip: "20.30.1.1", remoteAs: 2, description: "Router as2r2", routeMapOut: true, metric: 20 },
  ];

  // Every router resolves DNS via "local"
  for (const r of [as1r1, as1r2, as2r1, as2r2, as3r1, as3r2]) {
    r.resolvConf = { mode: "custom", nameserver: "3.2.0.2" };
  }

  // Hosts: root, net, local, pc
  const root = newDevice("host", "root");
  root.x = 60;
  root.y = 560;
  addIf(root, A, "1.1.0.2", 24);
  root.defaultRoute = { enabled: true, via: "1.1.0.1", iface: 0 };
  root.dns = {
    role: "root",
    hostname: "ROOT-SERVER.",
    zone: "",
    records: [],
    delegations: [{ subdomain: "net", nsName: "dns.net.", nsIp: "2.1.0.2" }],
    rootServer: { name: "", ip: "" },
    allowRecursion: true,
  };
  root.resolvConf = { mode: "empty", nameserver: "" };
  model.devices.push(root);

  const netHost = newDevice("host", "net");
  netHost.x = 300;
  netHost.y = 680;
  addIf(netHost, E, "2.1.0.2", 24);
  netHost.defaultRoute = { enabled: true, via: "2.1.0.1", iface: 0 };
  netHost.dns = {
    role: "authoritative",
    hostname: "dns.net.",
    zone: "net",
    records: [{ name: "pc.net.", ip: "3.1.0.2" }],
    delegations: [],
    rootServer: { name: "ROOT-SERVER.", ip: "1.1.0.2" },
    allowRecursion: true,
  };
  netHost.resolvConf = { mode: "empty", nameserver: "" };
  model.devices.push(netHost);

  const local = newDevice("host", "local");
  local.x = 780;
  local.y = 560;
  addIf(local, K, "3.2.0.2", 24);
  local.defaultRoute = { enabled: true, via: "3.2.0.1", iface: 0 };
  local.dns = {
    role: "resolver",
    hostname: "local.",
    zone: "",
    records: [],
    delegations: [],
    rootServer: { name: "ROOT-SERVER.", ip: "1.1.0.2" },
    allowRecursion: true,
  };
  local.resolvConf = { mode: "empty", nameserver: "" };
  model.devices.push(local);

  const pc = newDevice("host", "pc");
  pc.x = 940;
  pc.y = 560;
  addIf(pc, J, "3.1.0.2", 24);
  pc.defaultRoute = { enabled: true, via: "3.1.0.1", iface: 0 };
  pc.resolvConf = { mode: "custom", nameserver: "3.2.0.2" };
  model.devices.push(pc);

  return model;
}

function buildPatchworkPreset() {
  const model = newModel();
  model.labName = "patchwork";
  model.description = "IDC - Esame del 22-01-2024 'patchwork' (fabric VXLAN/EVPN, OSPF+RIP+BGP, DNS)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const A = net("A", 260, 80);
  const B = net("B", 480, 80);
  const C = net("C", 260, 220);
  const D = net("D", 480, 220);
  const E = net("E", 140, 340);
  const F = net("F", 600, 340);
  const G = net("G", 60, 460);
  const H = net("H", 680, 460);
  const T = net("T", 780, 380);
  const R = net("R", 780, 540);
  const I = net("I", 1020, 260);
  const M = net("M", 1140, 340);
  const S = net("S", 900, 460);
  const O = net("O", 1060, 120);
  const L = net("L", 1200, 220);
  const N = net("N", 1260, 420);
  const P = net("P", 500, 620);
  const Q = net("Q", 260, 620);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function fabricDevice(name, as, routerId, x, y) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.routing.bgp.enabled = true;
    d.routing.bgp.mode = "fabric";
    d.routing.bgp.routerId = routerId;
    d.labConfExtra = '[sysctl]="net.ipv4.fib_multipath_hash_policy=1"\n[ipv6]=True';
    model.devices.push(d);
    return d;
  }

  // Datacenter fabric: two spines, two leaves, BGP unnumbered + EVPN
  const spine1 = fabricDevice("spine1", 64512, "192.168.0.3", 260, 20);
  const i0 = addIf(spine1, A, "", 30);
  const i1 = addIf(spine1, B, "", 30);
  spine1.routing.bgp.fabricInterfaces = { [i0]: true, [i1]: true };

  const spine2 = fabricDevice("spine2", 64512, "192.168.0.4", 480, 20);
  const j0 = addIf(spine2, C, "", 30);
  const j1 = addIf(spine2, D, "", 30);
  spine2.routing.bgp.fabricInterfaces = { [j0]: true, [j1]: true };

  const leaf1 = fabricDevice("leaf1", 64513, "192.168.0.1", 140, 220);
  const l1a = addIf(leaf1, A, "", 30);
  const l1c = addIf(leaf1, C, "", 30);
  const l1e = addIf(leaf1, E, "", 24);
  leaf1.routing.bgp.fabricInterfaces = { [l1a]: true, [l1c]: true };
  leaf1.routing.bgp.fabricRedistributeLoopback = true;
  leaf1.routing.bgp.fabricAdvertiseAllVni = true;
  leaf1.vtep = { enabled: true, loopbackIp: "192.168.0.1", entries: [{ vni: "7100", vlan: "100" }], trunkIfaces: String(l1e) };

  const leaf2 = fabricDevice("leaf2", 64514, "192.168.0.2", 600, 220);
  const l2b = addIf(leaf2, B, "", 30);
  const l2d = addIf(leaf2, D, "", 30);
  const l2f = addIf(leaf2, F, "", 24);
  leaf2.routing.bgp.fabricInterfaces = { [l2b]: true, [l2d]: true };
  leaf2.routing.bgp.fabricRedistributeLoopback = true;
  leaf2.routing.bgp.fabricAdvertiseAllVni = true;
  leaf2.vtep = { enabled: true, loopbackIp: "192.168.0.2", entries: [{ vni: "7100", vlan: "100" }], trunkIfaces: String(l2f) };

  // L2 access switches carrying the tenant VLAN between the leaves and the tenant containers
  const s1 = newDevice("host", "s1");
  s1.x = 140;
  s1.y = 400;
  const s1e = addIf(s1, E, "", 24);
  const s1g = addIf(s1, G, "", 24);
  s1.bridge = { enabled: true, vlans: "100", portVlan: { [s1g]: "100" } };
  model.devices.push(s1);

  const s2 = newDevice("host", "s2");
  s2.x = 600;
  s2.y = 400;
  const s2f = addIf(s2, F, "", 24);
  const s2h = addIf(s2, H, "", 24);
  s2.bridge = { enabled: true, vlans: "100", portVlan: { [s2h]: "100" } };
  model.devices.push(s2);

  // Tenant containers, both on 2.0.0.0/24 despite being on different leaves
  const ws = newDevice("host", "ws");
  ws.x = 20;
  ws.y = 520;
  addIf(ws, G, "2.0.0.2", 24);
  ws.defaultRoute = { enabled: true, via: "2.0.0.1", iface: 0 };
  ws.customStartup = "ip link set dev eth0 mtu 1450";
  ws.webserver = {
    enabled: true,
    html: "<html>\n    <head>\n        <title>Ws</title>\n    </head>\n    <body>\n        <pre>\n                                             \n                 Pagina web di Ws\n                 \n                 La prego prof, sia buono nella valutazione :)\n                                             \n        </pre>\n    </body>\n</html>\n",
  };
  model.devices.push(ws);

  const as2r1 = newDevice("router", "as2r1");
  as2r1.as = 2;
  as2r1.x = 680;
  as2r1.y = 520;
  addIf(as2r1, H, "2.0.0.1", 24);
  addIf(as2r1, T, "5.1.2.2", 30);
  addIf(as2r1, R, "5.2.3.1", 30);
  as2r1.customStartup = "ip link set dev eth0 mtu 1450";
  as2r1.routing.bgp.enabled = true;
  as2r1.routing.bgp.networks = "2.0.0.0/8, 5.1.2.0/30, 5.2.3.0/30";
  as2r1.routing.bgp.neighbors = [
    { ip: "5.2.3.2", remoteAs: 3, description: "Router as3r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "5.1.2.1", remoteAs: 1, description: "Router as1r3", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];
  model.devices.push(as2r1);

  // AS1 (OSPF internally, BGP only on the border router as1r3)
  function as1Router(name, x, y) {
    const d = newDevice("router", name);
    d.as = 1;
    d.x = x;
    d.y = y;
    d.routing.ospf.enabled = true;
    model.devices.push(d);
    return d;
  }

  const as1r1 = as1Router("as1r1", 1020, 120);
  const r1i = addIf(as1r1, I, "1.0.0.1", 30);
  const r1o = addIf(as1r1, O, "1.1.0.1", 24);
  const r1l = addIf(as1r1, L, "1.0.0.5", 30);
  as1r1.routing.ospf.perInterface = { [r1i]: { area: "0.0.0.0" }, [r1o]: { area: "0.0.0.0" }, [r1l]: { area: "0.0.0.0" } };
  as1r1.routing.ospf.redistribute.connected = true;

  const as1r2 = as1Router("as1r2", 1200, 340);
  const r2m = addIf(as1r2, M, "1.0.0.9", 30);
  const r2l = addIf(as1r2, L, "1.0.0.6", 30);
  const r2n = addIf(as1r2, N, "1.2.0.1", 24);
  as1r2.routing.ospf.perInterface = { [r2m]: { area: "0.0.0.0" }, [r2l]: { area: "0.0.0.0" }, [r2n]: { area: "0.0.0.0" } };
  as1r2.routing.ospf.redistribute.connected = true;

  const as1r3 = as1Router("as1r3", 1020, 380);
  const r3i = addIf(as1r3, I, "1.0.0.2", 30);
  const r3m = addIf(as1r3, M, "1.0.0.10", 30);
  const r3s = addIf(as1r3, S, "5.1.3.1", 30);
  const r3t = addIf(as1r3, T, "5.1.2.1", 30);
  as1r3.routing.ospf.perInterface = { [r3i]: { area: "0.0.0.0" }, [r3m]: { area: "0.0.0.0" }, [r3s]: { area: "0.0.0.0" }, [r3t]: { area: "0.0.0.0" } };
  as1r3.routing.ospf.redistribute.connected = true;
  as1r3.routing.ospf.redistribute.bgp = true;
  as1r3.routing.bgp.enabled = true;
  as1r3.routing.bgp.networks = "1.0.0.0/8, 5.1.2.0/30, 5.1.3.0/30";
  as1r3.routing.bgp.neighbors = [
    { ip: "5.1.2.2", remoteAs: 2, description: "Router as2r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "5.1.3.2", remoteAs: 3, description: "Router as3r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const it = newDevice("host", "it");
  it.x = 1060;
  it.y = 40;
  addIf(it, O, "1.1.0.2", 24);
  it.defaultRoute = { enabled: true, via: "1.1.0.1", iface: 0 };
  it.dns = {
    role: "authoritative",
    hostname: "dns.it.",
    zone: "it",
    records: [{ name: "uniroma3.it.", ip: "2.0.0.2" }],
    delegations: [],
    rootServer: { name: "ROOT-SERVER.", ip: "3.3.0.2" },
    allowRecursion: true,
    allowRecursionCidr: "0.0.0.0/0",
  };
  it.resolvConf = { mode: "empty", nameserver: "" };
  model.devices.push(it);

  const pc1 = newDevice("host", "pc1");
  pc1.x = 1260;
  pc1.y = 500;
  addIf(pc1, N, "1.2.0.2", 24);
  pc1.defaultRoute = { enabled: true, via: "1.2.0.1", iface: 0 };
  pc1.resolvConf = { mode: "custom", nameserver: "1.2.0.3" };
  model.devices.push(pc1);

  const local = newDevice("host", "local");
  local.x = 1340;
  local.y = 420;
  addIf(local, N, "1.2.0.3", 24);
  local.defaultRoute = { enabled: true, via: "1.2.0.1", iface: 0 };
  local.dns = {
    role: "resolver",
    hostname: "local.",
    zone: "",
    records: [],
    delegations: [],
    rootServer: { name: "ROOT-SERVER.", ip: "3.3.0.2" },
    allowRecursion: true,
    allowRecursionCidr: "1.2.0.0/24",
  };
  local.resolvConf = { mode: "empty", nameserver: "" };
  model.devices.push(local);

  // AS3 (RIP internally, BGP on as3r1 with a local-preference policy favouring the AS1 link)
  const as3r1 = newDevice("router", "as3r1");
  as3r1.as = 3;
  as3r1.x = 780;
  as3r1.y = 620;
  addIf(as3r1, R, "5.2.3.2", 30);
  addIf(as3r1, S, "5.1.3.2", 30);
  addIf(as3r1, P, "3.0.0.1", 30);
  as3r1.routing.rip.enabled = true;
  as3r1.routing.rip.networks = "3.0.0.0/8";
  as3r1.routing.rip.redistribute = { connected: true, bgp: true, ospf: false, static: false };
  as3r1.routing.bgp.enabled = true;
  as3r1.routing.bgp.networks = "3.0.0.0/8, 5.2.3.0/30, 5.1.3.0/30";
  as3r1.routing.bgp.neighbors = [
    { ip: "5.2.3.1", remoteAs: 2, description: "Router as2r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    {
      ip: "5.1.3.1",
      remoteAs: 1,
      description: "Router as1r3",
      routeMapOut: false,
      metric: 20,
      routeMapIn: true,
      localPref: 150,
    },
  ];
  model.devices.push(as3r1);

  const as3r2 = newDevice("router", "as3r2");
  as3r2.as = 3;
  as3r2.x = 500;
  as3r2.y = 620;
  addIf(as3r2, Q, "3.3.0.1", 24);
  addIf(as3r2, P, "3.0.0.2", 30);
  as3r2.routing.rip.enabled = true;
  as3r2.routing.rip.networks = "3.0.0.0/8";
  as3r2.routing.rip.redistribute = { connected: true, bgp: false, ospf: false, static: false };
  model.devices.push(as3r2);

  const root = newDevice("host", "root");
  root.x = 260;
  root.y = 620;
  addIf(root, Q, "3.3.0.2", 24);
  root.defaultRoute = { enabled: true, via: "3.3.0.1", iface: 0 };
  root.dns = {
    role: "root",
    hostname: "ROOT-SERVER.",
    zone: "",
    records: [],
    delegations: [{ subdomain: "it", nsName: "dns.it.", nsIp: "1.1.0.2" }],
    rootServer: { name: "", ip: "" },
    allowRecursion: true,
    allowRecursionCidr: "0.0.0.0/0",
  };
  root.resolvConf = { mode: "empty", nameserver: "" };
  model.devices.push(root);

  return model;
}

function buildDesconocidaPreset() {
  const model = newModel();
  model.labName = "desconocida";
  model.description = "IDC - Prima prova intermedia del 27-11-2023 'DESCONOCIDA' (RIP + BGP con filtri di prefisso)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const D = net("D", 260, 80);
  const C = net("C", 100, 220);
  const B = net("B", 100, 400);
  const A = net("A", 100, 580);
  const G = net("G", 500, 80);
  const F = net("F", 340, 220);
  const H = net("H", 620, 400);
  const I = net("I", 740, 80);
  const J = net("J", 900, 220);
  const E = net("E", 900, 400);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function ripRouter(name, as, x, y, ripNetwork) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.routing.rip.enabled = true;
    d.routing.rip.networks = ripNetwork;
    d.routing.rip.redistribute = { connected: true, bgp: false, ospf: false, static: false };
    model.devices.push(d);
    return d;
  }

  // AS1: single exit point (as1r1), pure RIP stub chain behind it
  const as1r1 = ripRouter("as1r1", 1, 60, 20, "1.0.0.0/8");
  as1r1.routing.rip.redistribute.bgp = true;
  addIf(as1r1, D, "10.0.0.1", 30);
  addIf(as1r1, C, "1.3.0.1", 24);
  as1r1.routing.bgp.enabled = true;
  as1r1.routing.bgp.networks = "1.0.0.0/8, 10.0.0.0/30";
  as1r1.routing.bgp.neighbors = [{ ip: "10.0.0.2", remoteAs: 2, description: "Router as2r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  const as1r2 = ripRouter("as1r2", 1, 60, 220, "1.0.0.0/8");
  as1r2.routing.rip.redistribute.bgp = true;
  addIf(as1r2, B, "1.2.0.2", 24);
  addIf(as1r2, C, "1.3.0.2", 24);

  const as1r3 = ripRouter("as1r3", 1, 60, 400, "1.0.0.0/8");
  as1r3.routing.rip.redistribute.bgp = true;
  addIf(as1r3, A, "1.1.0.3", 24);
  addIf(as1r3, B, "1.2.0.3", 24);

  const as1r4 = ripRouter("as1r4", 1, 60, 580, "1.0.0.0/8");
  addIf(as1r4, A, "1.1.0.4", 24);

  // AS2: two border routers, as2r1 filters out 3.2.0.0/24 towards/through G
  const as2r1 = ripRouter("as2r1", 2, 340, 20, "2.0.0.0/16");
  as2r1.routing.bgp.enabled = true;
  as2r1.routing.bgp.noEbgpRequiresPolicy = false; // this router needs explicit policies -> prefix-lists on every eBGP neighbor
  as2r1.routing.bgp.networks = "2.0.0.0/8, 10.0.0.0/30, 20.0.0.8/30";
  addIf(as2r1, D, "10.0.0.2", 30);
  addIf(as2r1, G, "20.0.0.9", 30);
  addIf(as2r1, F, "2.0.0.13", 24);
  as2r1.routing.bgp.neighbors = [
    {
      ip: "20.0.0.10",
      remoteAs: 3,
      description: "Router as3r1",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      // AS2 never allows sending packets addressed to 3.2.0.0/24 through link G, even as a backup
      prefixListIn: { enabled: true, mode: "deny", prefixes: "3.2.0.0/24" },
      prefixListOut: { enabled: true, mode: "deny", prefixes: "" },
    },
    {
      ip: "10.0.0.1",
      remoteAs: 1,
      description: "Router as1r1",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      prefixListIn: { enabled: true, mode: "deny", prefixes: "" },
      prefixListOut: { enabled: true, mode: "deny", prefixes: "" },
    },
  ];

  const as2r2 = ripRouter("as2r2", 2, 500, 400, "2.0.0.0/16");
  as2r2.routing.rip.redistribute.bgp = true;
  as2r2.routing.bgp.enabled = true;
  as2r2.routing.bgp.networks = "2.0.0.0/8, 20.0.0.16/30";
  addIf(as2r2, H, "20.0.0.17", 30);
  addIf(as2r2, F, "2.0.0.14", 24);
  as2r2.routing.bgp.neighbors = [
    { ip: "2.0.0.13", remoteAs: 2, description: "Router as2r2 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "20.0.0.18", remoteAs: 3, description: "Router as3r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  // AS3: two border routers, as3r1 filters out 1.0.0.0/8 towards/through G
  const as3r1 = ripRouter("as3r1", 3, 740, 20, "3.0.0.0/8");
  as3r1.routing.rip.redistribute.bgp = true;
  as3r1.routing.bgp.enabled = true;
  as3r1.routing.bgp.noEbgpRequiresPolicy = false;
  as3r1.routing.bgp.networks = "3.0.0.0/24, 3.1.0.0/24, 3.2.0.0/24, 20.0.0.8/30";
  addIf(as3r1, G, "20.0.0.10", 30);
  addIf(as3r1, I, "3.0.0.1", 24);
  as3r1.routing.bgp.neighbors = [
    {
      ip: "20.0.0.9",
      remoteAs: 2,
      description: "Router as2r1",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      // AS3 never allows sending packets addressed to 1.0.0.0/8 through link G, even as a backup
      prefixListIn: { enabled: true, mode: "deny", prefixes: "1.0.0.0/8" },
      prefixListOut: { enabled: false, mode: "deny", prefixes: "" },
    },
    { ip: "3.0.0.2", remoteAs: 3, description: "Router as3r2 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as3r2 = ripRouter("as3r2", 3, 900, 20, "3.0.0.0/8");
  as3r2.routing.rip.redistribute.bgp = true;
  as3r2.routing.bgp.enabled = true;
  as3r2.routing.bgp.networks = "3.0.0.0/24, 3.1.0.0/24, 3.2.0.0/24, 20.0.0.16/30";
  addIf(as3r2, I, "3.0.0.2", 24);
  addIf(as3r2, J, "3.1.0.2", 24);
  addIf(as3r2, H, "20.0.0.18", 30);
  as3r2.routing.bgp.neighbors = [
    { ip: "20.0.0.17", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "3.0.0.1", remoteAs: 3, description: "Router as3r1 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as3r3 = ripRouter("as3r3", 3, 900, 220, "3.0.0.0/8");
  addIf(as3r3, J, "3.1.0.3", 24);
  addIf(as3r3, E, "3.2.0.3", 24);

  const as3r4 = ripRouter("as3r4", 3, 900, 400, "3.0.0.0/8");
  addIf(as3r4, E, "3.2.0.4", 24);

  return model;
}

function buildIncognitaPreset() {
  const model = newModel();
  model.labName = "incognita";
  model.description = "IDC - Prima prova intermedia del 27-11-2023 'INCOGNITA' (RIP + BGP con iBGP tra border router dello stesso AS, filtri di prefisso)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const A = net("A", 40, 20);
  const B = net("B", 40, 220);
  const C = net("C", 220, 220);
  const D = net("D", 400, 20);
  const G = net("G", 600, 20);
  const F = net("F", 400, 300);
  const I = net("I", 750, 300);
  const H = net("H", 550, 480);
  const J = net("J", 750, 480);
  const E = net("E", 900, 620);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function ripRouter(name, as, x, y, ripNetwork) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.routing.rip.enabled = true;
    d.routing.rip.networks = ripNetwork;
    model.devices.push(d);
    return d;
  }

  // AS1: single exit point (as1r1), pure RIP stub chain behind it -- no iBGP needed (only one border router).
  const as1r1 = ripRouter("as1r1", 1, 220, -60, "1.0.0.0/8");
  as1r1.routing.rip.redistribute.bgp = true;
  addIf(as1r1, D, "10.0.0.1", 30);
  addIf(as1r1, C, "1.3.0.1", 24);
  as1r1.routing.bgp.enabled = true;
  as1r1.routing.bgp.networks = "1.0.0.0/8, 10.0.0.0/30";
  as1r1.routing.bgp.neighbors = [{ ip: "10.0.0.2", remoteAs: 2, description: "Router as2r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  const as1r2 = ripRouter("as1r2", 1, 220, 140, "1.0.0.0/8");
  addIf(as1r2, B, "1.2.0.2", 24);
  addIf(as1r2, C, "1.3.0.2", 24);

  const as1r3 = ripRouter("as1r3", 1, 40, 140, "1.0.0.0/8");
  addIf(as1r3, A, "1.1.0.3", 24);
  addIf(as1r3, B, "1.2.0.3", 24);

  const as1r4 = ripRouter("as1r4", 1, 40, -60, "1.0.0.0/8");
  addIf(as1r4, A, "1.1.0.1", 24);

  // AS2: two border routers (as2r1 towards AS1/AS3 via F, as2r2 towards AS3 via I) -- iBGP peering between them on their shared LAN G.
  const as2r1 = ripRouter("as2r1", 2, 450, -60, "2.0.0.0/16");
  as2r1.routing.rip.redistribute.bgp = true;
  addIf(as2r1, D, "10.0.0.2", 30);
  addIf(as2r1, G, "2.0.0.1", 24);
  addIf(as2r1, F, "20.0.0.13", 30);
  as2r1.routing.bgp.enabled = true;
  as2r1.routing.bgp.networks = "2.0.0.0/8, 10.0.0.0/30, 20.0.0.12/30";
  as2r1.routing.bgp.neighbors = [
    { ip: "10.0.0.1", remoteAs: 1, description: "Router as1r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "2.0.0.2", remoteAs: 2, description: "Router as2r2 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "20.0.0.14", remoteAs: 3, description: "Router as3r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as2r2 = ripRouter("as2r2", 2, 650, 140, "2.0.0.0/16");
  as2r2.routing.rip.redistribute.bgp = true;
  addIf(as2r2, G, "2.0.0.2", 24);
  addIf(as2r2, I, "20.0.0.21", 30);
  as2r2.routing.bgp.enabled = true;
  as2r2.routing.bgp.networks = "2.0.0.0/8, 20.0.0.20/30";
  as2r2.routing.bgp.neighbors = [
    { ip: "2.0.0.1", remoteAs: 2, description: "Router as2r1 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    {
      ip: "20.0.0.22",
      remoteAs: 3,
      description: "Router as3r2",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      // AS2 never allows sending packets addressed to 3.2.0.0/24 through link I, even if link F was down.
      prefixListIn: { enabled: true, mode: "deny", prefixes: "3.2.0.0/24" },
      prefixListOut: { enabled: true, mode: "deny", prefixes: "" },
    },
  ];

  // AS3: two border routers (as3r1 towards AS2 via F, as3r2 towards AS2 via I) -- iBGP peering between them on their shared LAN H.
  const as3r1 = ripRouter("as3r1", 3, 450, 260, "3.0.0.0/8");
  as3r1.routing.rip.redistribute.bgp = true;
  addIf(as3r1, H, "3.0.0.1", 24);
  addIf(as3r1, F, "20.0.0.14", 30);
  as3r1.routing.bgp.enabled = true;
  as3r1.routing.bgp.networks = "3.0.0.0/24, 3.1.0.0/24, 3.2.0.0/24, 20.0.0.12/30";
  as3r1.routing.bgp.neighbors = [
    { ip: "20.0.0.13", remoteAs: 2, description: "Router as2r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "3.0.0.2", remoteAs: 3, description: "Router as3r2 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as3r2 = ripRouter("as3r2", 3, 650, 400, "3.0.0.0/8");
  as3r2.routing.rip.redistribute.bgp = true;
  addIf(as3r2, I, "20.0.0.22", 30);
  addIf(as3r2, J, "3.1.0.2", 24);
  addIf(as3r2, H, "3.0.0.2", 24);
  as3r2.routing.bgp.enabled = true;
  as3r2.routing.bgp.networks = "3.0.0.0/24, 3.1.0.0/24, 3.2.0.0/24, 20.0.0.20/30";
  as3r2.routing.bgp.neighbors = [
    {
      ip: "20.0.0.21",
      remoteAs: 2,
      description: "Router as2r2",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      // AS3 never allows sending packets addressed to 1.0.0.0/8 through link I, even if link F was down.
      prefixListIn: { enabled: true, mode: "deny", prefixes: "1.0.0.0/8" },
      prefixListOut: { enabled: true, mode: "deny", prefixes: "" },
    },
    { ip: "3.0.0.1", remoteAs: 3, description: "Router as3r1 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as3r3 = ripRouter("as3r3", 3, 850, 400, "3.0.0.0/8");
  addIf(as3r3, J, "3.1.0.3", 24);
  addIf(as3r3, E, "3.2.0.3", 24);

  const as3r4 = ripRouter("as3r4", 3, 850, 600, "3.0.0.0/8");
  addIf(as3r4, E, "3.2.0.4", 24);

  return model;
}

function buildFallingAsleepPreset() {
  const model = newModel();
  model.labName = "fallingasleep";
  model.description = "IDC - Prima prova intermedia del 12-11-2022 'FALLING ASLEEP' (RIP + OSPF, rotta statica redistribuita)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const D = net("D", 260, 60);
  const C = net("C", 60, 180);
  const B = net("B", 60, 340);
  const A = net("A", 60, 500);
  const G = net("G", 500, 60);
  const F = net("F", 340, 200);
  const I = net("I", 700, 200);
  const H = net("H", 500, 340);
  const J = net("J", 700, 460);
  const E = net("E", 500, 580);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function ripRouter(name, x, y, redistConnected) {
    const d = newDevice("router", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.rip.enabled = true;
    d.routing.rip.networks = "1.0.0.0/8";
    d.routing.rip.redistribute.connected = redistConnected;
    model.devices.push(d);
    return d;
  }
  function ospfRouter(name, x, y) {
    const d = newDevice("router", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.ospf.enabled = true;
    d.routing.ospf.redistribute.connected = true;
    model.devices.push(d);
    return d;
  }

  const r1 = ripRouter("r1", 60, 20, true);
  addIf(r1, D, "10.0.0.1", 30);
  addIf(r1, C, "1.3.0.1", 24);
  r1.staticRoutes = [{ destination: "20.0.0.0/8", via: "10.0.0.2", iface: 0, declareInFrr: false }];
  r1.routing.rip.forceAnnounce = "20.0.0.0/8";

  const r2 = ripRouter("r2", 60, 200, false);
  addIf(r2, B, "1.2.0.2", 24);
  addIf(r2, C, "1.3.0.2", 24);

  const r3 = ripRouter("r3", 60, 380, false);
  addIf(r3, A, "1.1.0.3", 24);
  addIf(r3, B, "1.2.0.3", 24);

  const www = newDevice("host", "www");
  www.x = 60;
  www.y = 560;
  www.image = "kathara/base";
  addIf(www, A, "1.1.0.1", 24);
  www.defaultRoute = { enabled: true, via: "1.1.0.3", iface: 0 };
  www.webserver = { enabled: true, html: "<!DOCTYPE html>\n<html>\n    <body>\n        <pre>Hello World</pre>\n    </body>\n</html>\n" };

  const r4 = ospfRouter("r4", 260, 200);
  const r4d = addIf(r4, D, "10.0.0.2", 30);
  const r4g = addIf(r4, G, "20.0.0.9", 30);
  const r4f = addIf(r4, F, "20.0.0.13", 30);
  r4.routing.ospf.perInterface = { [r4g]: { area: "0.0.0.0" }, [r4f]: { area: "0.0.0.0" } }; // eth0/D stays outside the OSPF area, matching "network 20.0.0.0/8"
  r4.routing.ospf.redistribute.static = true;
  r4.staticRoutes = [{ destination: "1.0.0.0/8", via: "10.0.0.1", iface: r4d, declareInFrr: true }];

  const r5 = ospfRouter("r5", 500, 20);
  const r5g = addIf(r5, G, "20.0.0.10", 30);
  const r5i = addIf(r5, I, "20.0.0.21", 30);
  r5.routing.ospf.perInterface = { [r5g]: { area: "0.0.0.0" }, [r5i]: { area: "0.0.0.0" } };

  const r6 = ospfRouter("r6", 340, 380);
  const r6h = addIf(r6, H, "20.0.0.17", 30);
  const r6f = addIf(r6, F, "20.0.0.14", 30);
  r6.routing.ospf.perInterface = { [r6h]: { area: "0.0.0.0" }, [r6f]: { area: "0.0.0.0" } };

  const r7 = ospfRouter("r7", 700, 340);
  const r7i = addIf(r7, I, "20.0.0.22", 30);
  const r7j = addIf(r7, J, "20.0.0.25", 30);
  const r7h = addIf(r7, H, "20.0.0.18", 30);
  r7.routing.ospf.perInterface = { [r7i]: { area: "0.0.0.0" }, [r7j]: { area: "0.0.0.0" }, [r7h]: { area: "0.0.0.0" } };

  const r8 = ospfRouter("r8", 700, 560);
  const r8j = addIf(r8, J, "20.0.0.26", 30);
  const r8e = addIf(r8, E, "20.0.1.6", 24);
  r8.routing.ospf.perInterface = { [r8j]: { area: "0.0.0.0" }, [r8e]: { area: "0.0.0.0" } };

  const pc = newDevice("host", "pc");
  pc.x = 500;
  pc.y = 700;
  pc.image = "kathara/base";
  addIf(pc, E, "20.0.1.2", 24);
  pc.defaultRoute = { enabled: true, via: "20.0.1.6", iface: 0 };

  model.devices.push(www, pc);

  return model;
}

function buildCloudsPreset() {
  const model = newModel();
  model.labName = "clouds";
  model.description = "IDC - Prova intermedia del 04-11-2022 'CLOUDS' (OSPF multi-area con aree stub)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const A = net("A", 60, 60);
  const B = net("B", 60, 220);
  const C = net("C", 340, 220);
  const D = net("D", 500, 60);
  const F = net("F", 500, 220);
  const E = net("E", 340, 380);
  const G = net("G", 500, 500);
  const H = net("H", 660, 380);
  const L = net("L", 820, 220);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function ospfRouter(name, x, y, stubAreas, manualNetworks) {
    const d = newDevice("router", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.ospf.enabled = true;
    d.routing.ospf.stubAreas = stubAreas;
    d.routing.ospf.manualNetworks = manualNetworks;
    model.devices.push(d);
    return d;
  }

  const b012 = ospfRouter(
    "b012",
    280,
    350,
    "1.1.1.1, 2.2.2.2",
    "100.0.0.0/16 area 0.0.0.0\n110.10.0.0/16 area 1.1.1.1\n120.20.0.0/16 area 2.2.2.2"
  );
  const b012g = addIf(b012, G, "100.0.3.1", 24);
  addIf(b012, B, "110.10.1.10", 24);
  addIf(b012, E, "100.0.1.1", 24);
  addIf(b012, C, "120.20.1.20", 24);
  b012.routing.ospf.perInterface = { [b012g]: { area: "0.0.0.0", cost: 80 } };

  const b02 = ospfRouter("b02", 500, 350, "2.2.2.2", "100.0.0.0/16 area 0.0.0.0\n120.20.0.0/16 area 2.2.2.2");
  addIf(b02, E, "100.0.1.2", 24);
  addIf(b02, F, "120.20.2.20", 24);
  addIf(b02, H, "100.0.2.1", 24);
  const b02g = addIf(b02, G, "100.0.3.3", 24);
  b02.routing.ospf.perInterface = { [b02g]: { area: "0.0.0.0", cost: 80 } };

  const b03 = ospfRouter("b03", 720, 350, "3.3.3.3", "100.0.0.0/16 area 0.0.0.0\n130.30.0.0/16 area 3.3.3.3");
  const b03g = addIf(b03, G, "100.0.3.2", 24);
  addIf(b03, H, "100.0.2.2", 24);
  addIf(b03, L, "130.30.1.30", 24);
  b03.routing.ospf.perInterface = { [b03g]: { area: "0.0.0.0", cost: 80 } };

  const r11 = ospfRouter("r11", 60, 220, "1.1.1.1", "110.10.0.0/16 area 1.1.1.1");
  addIf(r11, B, "110.10.1.11", 24);
  addIf(r11, A, "110.10.2.1", 24);

  const r12 = ospfRouter("r12", 60, 20, "1.1.1.1", "110.10.0.0/16 area 1.1.1.1");
  addIf(r12, A, "110.10.2.12", 24);

  const r21 = ospfRouter("r21", 340, 60, "2.2.2.2", "120.20.0.0/16 area 2.2.2.2");
  addIf(r21, C, "120.20.1.2", 24);
  addIf(r21, F, "120.20.2.2", 24);
  addIf(r21, D, "120.20.3.2", 24);

  const r31 = ospfRouter("r31", 820, 60, "3.3.3.3", "130.30.0.0/16 area 3.3.3.3");
  addIf(r31, L, "130.30.1.3", 24);

  return model;
}

function buildT2c1Preset() {
  const model = newModel();
  model.labName = "t2c1";
  model.description = "IDC - Second Intermediate Test T2C1 (29-11-2021): OSPF interno ad AS1 + eBGP a catena tra 6 AS a router singolo";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const D = net("D", 260, 60);
  const C = net("C", 60, 180);
  const B = net("B", 60, 340);
  const A = net("A", 60, 500);
  const G = net("G", 620, 60);
  const F = net("F", 380, 220);
  const E = net("E", 260, 340);
  const I = net("I", 820, 220);
  const H = net("H", 620, 340);
  const J = net("J", 820, 460);
  const K = net("K", 820, 600);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function bgpRouter(name, as, x, y, importCheck) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.routing.bgp.enabled = true;
    d.routing.bgp.noEbgpRequiresPolicy = true;
    d.routing.bgp.noNetworkImportCheck = importCheck;
    model.devices.push(d);
    return d;
  }

  const as1r1 = bgpRouter("as1r1", 1, 60, 20, true);
  const r1d = addIf(as1r1, D, "10.0.0.1", 30);
  const r1c = addIf(as1r1, C, "1.3.0.1", 24);
  as1r1.routing.ospf.enabled = true;
  as1r1.routing.ospf.perInterface = { [r1c]: { area: "0.0.0.0" } };
  as1r1.routing.ospf.redistribute = { connected: true, bgp: true, rip: false, static: false };
  as1r1.routing.bgp.networks = "1.0.0.0/8, 10.0.0.0/30";
  as1r1.routing.bgp.neighbors = [
    { ip: "10.0.0.2", remoteAs: 2, description: "Router as2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "1.3.0.2", remoteAs: 1, description: "Router as1r2 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as1r2 = bgpRouter("as1r2", 1, 60, 220, true);
  const r2b = addIf(as1r2, B, "1.2.0.2", 24);
  const r2c = addIf(as1r2, C, "1.3.0.2", 24);
  addIf(as1r2, E, "10.0.0.5", 30);
  as1r2.routing.ospf.enabled = true;
  as1r2.routing.ospf.perInterface = { [r2b]: { area: "0.0.0.0" }, [r2c]: { area: "0.0.0.0" } };
  as1r2.routing.ospf.redistribute = { connected: true, bgp: true, rip: false, static: false };
  as1r2.routing.bgp.networks = "1.0.0.0/8, 10.0.0.4/30";
  as1r2.routing.bgp.neighbors = [
    { ip: "10.0.0.6", remoteAs: 3, description: "Router as3", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "1.3.0.1", remoteAs: 1, description: "Router as1r1 (iBGP)", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as1r3 = newDevice("router", "as1r3");
  as1r3.as = 1;
  as1r3.x = 60;
  as1r3.y = 420;
  const r3a = addIf(as1r3, A, "1.1.0.3", 24);
  const r3b = addIf(as1r3, B, "1.2.0.3", 24);
  as1r3.routing.ospf.enabled = true;
  as1r3.routing.ospf.perInterface = { [r3a]: { area: "0.0.0.0" }, [r3b]: { area: "0.0.0.0" } };
  as1r3.routing.ospf.redistribute.connected = true;
  model.devices.push(as1r3);

  const as2 = bgpRouter("as2", 2, 380, 20, false);
  addIf(as2, D, "10.0.0.2", 30);
  addIf(as2, G, "10.0.0.9", 30);
  addIf(as2, F, "10.0.0.13", 30);
  as2.routing.bgp.networks = "10.0.0.0/30, 10.0.0.8/30, 10.0.0.12/30";
  as2.routing.bgp.neighbors = [
    { ip: "10.0.0.1", remoteAs: 1, description: "Router as1r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.10", remoteAs: 5, description: "Router as5", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.14", remoteAs: 3, description: "Router as3", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as3 = bgpRouter("as3", 3, 380, 260, false);
  addIf(as3, E, "10.0.0.6", 30);
  addIf(as3, F, "10.0.0.14", 30);
  addIf(as3, H, "10.0.0.17", 30);
  as3.routing.bgp.networks = "10.0.0.4/30, 10.0.0.16/30, 10.0.0.12/30";
  as3.routing.bgp.neighbors = [
    { ip: "10.0.0.5", remoteAs: 1, description: "Router as1r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.13", remoteAs: 2, description: "Router as2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.18", remoteAs: 4, description: "Router as4", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as5 = bgpRouter("as5", 5, 620, 20, false);
  addIf(as5, G, "10.0.0.10", 30);
  addIf(as5, I, "10.0.0.21", 30);
  as5.routing.bgp.networks = "10.0.0.20/30, 10.0.0.8/30";
  as5.routing.bgp.neighbors = [
    { ip: "10.0.0.9", remoteAs: 2, description: "Router as2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.22", remoteAs: 4, description: "Router as4", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as4 = bgpRouter("as4", 4, 820, 340, false);
  addIf(as4, I, "10.0.0.22", 30);
  addIf(as4, J, "10.0.0.25", 30);
  addIf(as4, H, "10.0.0.18", 30);
  as4.routing.bgp.networks = "10.0.0.20/30, 10.0.0.16/30, 10.0.0.24/30";
  as4.routing.bgp.neighbors = [
    { ip: "10.0.0.17", remoteAs: 3, description: "Router as3", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.21", remoteAs: 5, description: "Router as5", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "10.0.0.26", remoteAs: 6, description: "Router as6", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const as6 = bgpRouter("as6", 6, 820, 500, false);
  addIf(as6, J, "10.0.0.26", 30);
  addIf(as6, K, "6.0.0.6", 24);
  as6.routing.bgp.networks = "6.0.0.0/24, 10.0.0.24/30";
  as6.routing.bgp.neighbors = [{ ip: "10.0.0.25", remoteAs: 4, description: "Router as4", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  const pc1 = newDevice("host", "pc1");
  pc1.x = 60;
  pc1.y = 580;
  addIf(pc1, A, "1.1.0.1", 24);
  pc1.defaultRoute = { enabled: true, via: "1.1.0.3", iface: 0 };
  model.devices.push(pc1);

  const pc2 = newDevice("host", "pc2");
  pc2.x = 820;
  pc2.y = 680;
  addIf(pc2, K, "6.0.0.2", 24);
  pc2.defaultRoute = { enabled: true, via: "6.0.0.6", iface: 0 };
  model.devices.push(pc2);

  return model;
}

function buildRedBaronPreset() {
  const model = newModel();
  model.labName = "redbaron";
  model.description = "IDC - Prova intermedia 'RED-BARON' (18-12-2020): eBGP con policy cliente/provider/peer (prefix-list allowlist)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const C = net("C", 60, 20);
  const G = net("G", 380, 20);
  const P = net("P", 700, 20);
  const E = net("E", 60, 180);
  const L = net("L", 700, 180);
  const B = net("B", 60, 340);
  const F = net("F", 380, 340);
  const N = net("N", 700, 340);
  const D = net("D", 60, 500);
  const H = net("H", 700, 500);
  const A = net("A", 60, 640);
  const M = net("M", 700, 640);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  const permitAny = () => ({ enabled: true, mode: "permit", prefixes: "any" });
  const permitList = (prefixes) => ({ enabled: true, mode: "permit", prefixes });

  function bgpRouter(name, as, x, y) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.routing.bgp.enabled = true;
    d.routing.bgp.noEbgpRequiresPolicy = true;
    d.routing.bgp.noNetworkImportCheck = false;
    model.devices.push(d);
    return d;
  }

  const r1 = bgpRouter("r1", 1, 60, 20);
  addIf(r1, C, "100.1.0.1", 16);
  addIf(r1, G, "101.202.0.3", 24);
  addIf(r1, E, "50.10.1.2", 24);
  r1.routing.bgp.networks = "100.1.0.0/16, 50.10.1.0/24, 101.202.0.0/24";
  r1.routing.bgp.neighbors = [
    { ip: "101.202.0.1", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "50.10.1.4", remoteAs: 10, description: "Router as10r10", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const r2 = bgpRouter("r2", 2, 380, 20);
  addIf(r2, G, "101.202.0.1", 24);
  addIf(r2, P, "200.2.0.3", 16);
  addIf(r2, L, "50.20.2.2", 24);
  r2.routing.bgp.networks = "200.2.0.0/16, 50.20.2.0/24, 101.202.0.0/24";
  r2.routing.bgp.neighbors = [
    { ip: "101.202.0.3", remoteAs: 1, description: "Router as1r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "50.20.2.4", remoteAs: 20, description: "Router as20r20", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  // r10: customer of AS1, peer of AS20, provider of AS100 -- must not leak between its provider and its peer
  const r10 = bgpRouter("r10", 10, 60, 200);
  addIf(r10, B, "100.10.0.1", 16);
  addIf(r10, E, "50.10.1.4", 24);
  addIf(r10, F, "110.220.0.3", 24);
  addIf(r10, D, "50.100.10.2", 24);
  r10.routing.bgp.networks = "100.10.0.0/16, 50.10.1.0/24, 110.220.0.0/24, 50.100.10.0/24";
  const ownPlusCustomer10 = "100.10.0.0/16, 50.100.10.0/24, 100.100.0.0/16";
  r10.routing.bgp.neighbors = [
    { ip: "110.220.0.1", remoteAs: 20, description: "Router as20r20", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitList(ownPlusCustomer10) },
    { ip: "50.10.1.2", remoteAs: 1, description: "Router as1r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitList(ownPlusCustomer10) },
    { ip: "50.100.10.4", remoteAs: 100, description: "Router as100r100", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitAny() },
  ];

  // r20: customer of AS2, peer of AS10, provider of AS200 -- same shape as r10, mirrored
  const r20 = bgpRouter("r20", 20, 700, 200);
  addIf(r20, F, "110.220.0.1", 24);
  addIf(r20, L, "50.20.2.4", 24);
  addIf(r20, N, "200.20.0.3", 16);
  addIf(r20, H, "50.200.20.2", 24);
  r20.routing.bgp.networks = "200.20.0.0/16, 50.20.2.0/24, 110.220.0.0/24, 50.200.20.0/24";
  const ownPlusCustomer20 = "200.20.0.0/16, 50.200.20.0/24, 200.200.0.0/16";
  r20.routing.bgp.neighbors = [
    { ip: "50.20.2.2", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitList(ownPlusCustomer20) },
    { ip: "50.200.20.4", remoteAs: 200, description: "Router as200r200", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitAny() },
    { ip: "110.220.0.3", remoteAs: 10, description: "Router as10r10", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitList(ownPlusCustomer20) },
  ];

  const r100 = bgpRouter("r100", 100, 60, 380);
  addIf(r100, A, "100.100.0.1", 16);
  addIf(r100, D, "50.100.10.4", 24);
  r100.routing.bgp.networks = "100.100.0.0/16, 50.100.10.0/24";
  r100.routing.bgp.neighbors = [{ ip: "50.100.10.2", remoteAs: 10, description: "Router as10r10", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  const r200 = bgpRouter("r200", 200, 700, 380);
  addIf(r200, H, "50.200.20.4", 24);
  addIf(r200, M, "200.200.0.3", 16);
  r200.routing.bgp.networks = "200.200.0.0/16, 50.200.20.0/24";
  r200.routing.bgp.neighbors = [{ ip: "50.200.20.2", remoteAs: 20, description: "Router as20r20", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  return model;
}

function buildPearToPearPreset() {
  const model = newModel();
  model.labName = "peartopear";
  model.description = "IDC - Prova intermedia 'PEAR TO PEAR' (28-11-2022): BGP cliente/provider/peer con filtri misti deny/permit su un router con 3 relazioni diverse";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const C = net("C", 40, 20);
  const G = net("G", 320, 20);
  const P = net("P", 700, 20);
  const E = net("E", 40, 180);
  const L = net("L", 480, 180);
  const Q = net("Q", 780, 180);
  const B = net("B", 40, 340);
  const F = net("F", 260, 340);
  const H = net("H", 480, 340);
  const R = net("R", 940, 340);
  const D = net("D", 40, 500);
  const M = net("M", 620, 500);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  const permitAny = () => ({ enabled: true, mode: "permit", prefixes: "any" });
  const permitList = (prefixes) => ({ enabled: true, mode: "permit", prefixes });
  const denyList = (prefixes) => ({ enabled: true, mode: "deny", prefixes });

  function bgpRouter(name, as, x, y, noEbgpRequiresPolicy) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.bgp.enabled = true;
    d.routing.bgp.noEbgpRequiresPolicy = noEbgpRequiresPolicy;
    d.routing.bgp.noNetworkImportCheck = false;
    model.devices.push(d);
    return d;
  }

  const r1 = bgpRouter("r1", 1, 40, 20, true);
  addIf(r1, C, "100.1.0.1", 16);
  addIf(r1, G, "50.1.2.1", 24);
  addIf(r1, E, "50.1.10.1", 24);
  r1.routing.bgp.networks = "100.1.0.0/16, 50.1.2.0/24, 50.1.10.0/24";
  r1.routing.bgp.neighbors = [
    { ip: "50.1.10.10", remoteAs: 10, description: "Router as10r10", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "50.1.2.2", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const r2 = bgpRouter("r2", 2, 480, 20, true);
  addIf(r2, G, "50.1.2.2", 24);
  addIf(r2, P, "100.2.0.2", 16);
  addIf(r2, Q, "50.2.88.2", 24);
  addIf(r2, L, "50.2.20.2", 24);
  r2.routing.bgp.networks = "50.1.2.0/24, 100.2.0.0/16, 50.2.88.0/24, 50.2.20.0/24";
  r2.routing.bgp.neighbors = [
    { ip: "50.1.2.1", remoteAs: 1, description: "Router as1r1", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "50.2.88.88", remoteAs: 137, description: "Router as137b03", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "50.2.20.20", remoteAs: 20, description: "Router as20r20", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  // r10: customer of AS1, peer of AS200, provider of AS100 -- three simultaneous relationships,
  // mixes both filter styles: allow-list towards the peer, block-list towards the provider.
  const r10 = bgpRouter("r10", 10, 40, 200, true);
  addIf(r10, B, "100.10.0.10", 16);
  addIf(r10, E, "50.1.10.10", 24);
  addIf(r10, F, "50.10.200.10", 24);
  addIf(r10, D, "50.10.100.10", 24);
  r10.routing.bgp.networks = "100.10.0.0/16, 50.1.10.0/24, 50.10.200.0/24, 50.10.100.0/24";
  r10.routing.bgp.neighbors = [
    {
      ip: "50.1.10.1",
      remoteAs: 1,
      description: "Router as1r1",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      prefixListIn: permitAny(),
      prefixListOut: denyList("50.10.200.0/24, 100.200.0.0/16"),
    },
    {
      ip: "50.10.200.200",
      remoteAs: 200,
      description: "Router as200r200",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      prefixListIn: permitList("100.200.0.0/16"),
      prefixListOut: permitList("100.10.0.0/16, 100.100.0.0/16, 50.10.100.0/24"),
    },
    {
      ip: "50.10.100.100",
      remoteAs: 100,
      description: "Router as100r100",
      routeMapOut: false,
      metric: 20,
      routeMapIn: false,
      localPref: 150,
      prefixListIn: permitAny(),
      prefixListOut: permitAny(),
    },
  ];

  const r20 = bgpRouter("r20", 20, 480, 200, true);
  addIf(r20, H, "50.20.200.20", 24);
  addIf(r20, L, "50.2.20.20", 24);
  addIf(r20, net("N", 620, 240), "100.20.0.20", 16);
  r20.routing.bgp.networks = "50.20.200.0/24, 50.2.20.0/24, 100.20.0.0/16";
  r20.routing.bgp.neighbors = [
    { ip: "50.2.20.2", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
    { ip: "50.20.200.200", remoteAs: 200, description: "Router as200r200", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 },
  ];

  const r100 = bgpRouter("r100", 100, 40, 380, true);
  addIf(r100, D, "100.100.0.100", 16);
  addIf(r100, net("A", 40, 420), "50.10.100.100", 24);
  r100.routing.bgp.networks = "100.100.0.0/16, 50.10.100.0/24";
  r100.routing.bgp.neighbors = [{ ip: "50.10.100.10", remoteAs: 10, description: "Router as10r10", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  // r200: customer of AS20, peer of AS10 -- allow-list towards both.
  const r200 = bgpRouter("r200", 200, 480, 380, false);
  addIf(r200, H, "50.20.200.200", 24);
  addIf(r200, M, "100.200.0.200", 16);
  addIf(r200, F, "50.10.200.200", 24);
  r200.routing.bgp.networks = "50.20.200.0/24, 100.200.0.0/16, 50.10.200.0/24";
  r200.routing.bgp.neighbors = [
    { ip: "50.20.200.20", remoteAs: 20, description: "Router as20r20", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitList("100.200.0.0/16") },
    { ip: "50.10.200.10", remoteAs: 10, description: "Router as10r10", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150, prefixListIn: permitAny(), prefixListOut: permitList("100.200.0.0/16") },
  ];

  const b03 = bgpRouter("b03", 137, 780, 200, true);
  addIf(b03, Q, "50.2.88.88", 24);
  addIf(b03, R, "193.204.0.88", 15);
  b03.routing.bgp.networks = "50.2.88.0/24, 193.204.0.0/15";
  b03.routing.bgp.neighbors = [{ ip: "50.2.88.2", remoteAs: 2, description: "Router as2r2", routeMapOut: false, metric: 20, routeMapIn: false, localPref: 150 }];

  return model;
}

function buildButterflyPreset() {
  const model = newModel();
  model.labName = "butterfly";
  model.description = "ICN - Esame 'Butterfly' (20-12-2013): eBGP + RIP interno ad AS100 senza iBGP, ingegneria del traffico per-prefisso con route-map + access-list";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const A = net("A", 40, 20);
  const B = net("B", 40, 220);
  const C = net("C", 260, 340);
  const D = net("D", 260, 220);
  const E = net("E", 260, 20);
  const F = net("F", 480, 220);
  const G = net("G", 700, 20);
  const H = net("H", 700, 220);
  const I = net("I", 700, 340);
  const J = net("J", 940, 20);
  const K = net("K", 940, 220);
  const L = net("L", 1120, 20);
  const M = net("M", 1120, 120);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function bgpRouter(name, as, x, y) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.bgp.enabled = true;
    d.routing.bgp.noEbgpRequiresPolicy = true;
    d.routing.bgp.noNetworkImportCheck = true;
    model.devices.push(d);
    return d;
  }
  const nb = (ip, remoteAs, description, extra = {}) => ({
    ip,
    remoteAs,
    description,
    routeMapOut: false,
    metric: 20,
    routeMapOutMatch: "",
    routeMapIn: false,
    localPref: 150,
    routeMapInMatch: "",
    ...extra,
  });

  const as10r1 = bgpRouter("as10r1", 10, 20, 20);
  addIf(as10r1, A, "10.20.0.10", 24);
  addIf(as10r1, E, "10.50.0.10", 24);
  as10r1.routing.bgp.networks = "10.20.0.0/24, 10.50.0.0/24";
  as10r1.routing.bgp.neighbors = [
    nb("10.20.0.20", 20, "Router as20r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "100.1.0.0/24, 100.2.0.0/24" }),
    nb("10.50.0.50", 50, "Router as50r1"),
  ];

  const as20r1 = bgpRouter("as20r1", 20, 40, 220);
  addIf(as20r1, B, "20.30.0.20", 24);
  addIf(as20r1, D, "20.50.0.20", 24);
  addIf(as20r1, A, "10.20.0.20", 24);
  as20r1.routing.bgp.networks = "20.30.0.0/24, 20.50.0.0/24, 10.20.0.0/24";
  as20r1.routing.bgp.neighbors = [
    nb("20.30.0.30", 30, "Router as30r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "100.2.0.0/24" }),
    nb("20.50.0.50", 50, "Router as50r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "100.1.0.0/24" }),
    nb("10.20.0.10", 10, "Router as10r1"),
  ];

  const as30r1 = bgpRouter("as30r1", 30, 40, 380);
  addIf(as30r1, C, "30.50.0.30", 24);
  addIf(as30r1, B, "20.30.0.30", 24);
  as30r1.routing.bgp.networks = "30.50.0.0/24, 20.30.0.0/24";
  as30r1.routing.bgp.neighbors = [nb("30.50.0.50", 50, "Router as50r1"), nb("20.30.0.20", 20, "Router as20r1")];

  const as40r1 = bgpRouter("as40r1", 40, 480, 20);
  addIf(as40r1, F, "40.50.0.40", 24);
  addIf(as40r1, G, "40.100.0.40", 24);
  as40r1.routing.bgp.networks = "40.50.0.0/24, 40.100.0.0/24";
  as40r1.routing.bgp.neighbors = [nb("40.50.0.50", 50, "Router as50r1"), nb("40.100.0.1", 100, "Router as100r1")];

  const as50r1 = bgpRouter("as50r1", 50, 480, 220);
  addIf(as50r1, I, "50.100.0.50", 24);
  addIf(as50r1, H, "50.100.1.50", 24);
  addIf(as50r1, F, "40.50.0.50", 24);
  addIf(as50r1, E, "10.50.0.50", 24);
  addIf(as50r1, D, "20.50.0.50", 24);
  addIf(as50r1, C, "30.50.0.50", 24);
  as50r1.routing.bgp.networks = "10.50.0.0/24, 20.50.0.0/24, 30.50.0.0/24, 40.50.0.0/24, 50.100.1.0/24, 50.100.0.0/24";
  const as100Deny = { enabled: true, mode: "deny", prefixes: "100.0.0.0/8, 100.1.0.0/24, 100.2.0.0/24" };
  as50r1.routing.bgp.neighbors = [
    nb("10.50.0.10", 10, "Router as10r1"),
    nb("20.50.0.20", 20, "Router as20r1"),
    nb("30.50.0.30", 30, "Router as30r1"),
    nb("40.50.0.40", 40, "Router as40r1"),
    // Deny AS100's own prefixes on the direct H/I links so all AS100-bound traffic is forced through AS40 (link F/G) instead.
    nb("50.100.1.1", 100, "Router as100r1", { prefixListIn: { ...as100Deny } }),
    nb("50.100.0.1", 100, "Router as100r3", { prefixListIn: { ...as100Deny } }),
  ];

  function ripAs100Router(name, x, y) {
    const d = newDevice("router", name);
    d.as = 100;
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.rip.enabled = true;
    d.routing.rip.networks = "100.0.0.0/8";
    d.routing.rip.redistribute.connected = false;
    model.devices.push(d);
    return d;
  }

  const as100r1 = ripAs100Router("as100r1", 940, 20);
  as100r1.routing.rip.redistribute.bgp = true;
  addIf(as100r1, J, "100.0.1.1", 30);
  addIf(as100r1, G, "40.100.0.1", 24);
  addIf(as100r1, H, "50.100.1.1", 24);
  as100r1.routing.bgp.enabled = true;
  as100r1.routing.bgp.noEbgpRequiresPolicy = true;
  as100r1.routing.bgp.noNetworkImportCheck = true;
  as100r1.routing.bgp.networks = "40.100.0.0/24, 50.100.1.0/24, 100.0.0.0/8, 100.1.0.0/24, 100.2.0.0/24";
  as100r1.routing.bgp.neighbors = [nb("40.100.0.40", 40, "Router as40r1"), nb("50.100.1.50", 50, "Router as50r1")];

  const as100r2 = ripAs100Router("as100r2", 1120, 220);
  addIf(as100r2, K, "100.0.2.1", 30);
  addIf(as100r2, J, "100.0.1.2", 30);
  addIf(as100r2, L, "100.1.0.1", 24);
  addIf(as100r2, M, "100.2.0.1", 24);

  const as100r3 = ripAs100Router("as100r3", 940, 380);
  as100r3.routing.rip.redistribute.bgp = true;
  addIf(as100r3, K, "100.0.2.2", 30);
  addIf(as100r3, I, "50.100.0.1", 24);
  as100r3.routing.bgp.enabled = true;
  as100r3.routing.bgp.noEbgpRequiresPolicy = true;
  as100r3.routing.bgp.noNetworkImportCheck = true;
  as100r3.routing.bgp.networks = "50.100.0.0/24, 100.0.0.0/8, 100.1.0.0/24, 100.2.0.0/24";
  as100r3.routing.bgp.neighbors = [nb("50.100.0.50", 50, "Router as50r1")];

  return model;
}

function buildGardenUmbrellaPreset() {
  const model = newModel();
  model.labName = "gardenumbrella";
  model.description = "ICN - Esame 'Garden Umbrella' (20-12-2013): eBGP a maglia + RIP in AS6, blocco totale di un vicino su un link e traffic engineering per-prefisso su due percorsi ridondanti";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const A = net("A", 40, 20);
  const B = net("B", 260, 20);
  const C = net("C", 40, 220);
  const D = net("D", 480, 20);
  const E = net("E", 260, 220);
  const F = net("F", 700, 220);
  const G = net("G", 700, 20);
  const H = net("H", 920, 220);
  const I = net("I", 1140, 20);
  const J = net("J", 1140, 220);
  const K = net("K", 1360, 20);
  const L = net("L", 1360, 220);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function bgpRouter(name, as, x, y) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.bgp.enabled = true;
    d.routing.bgp.noEbgpRequiresPolicy = true;
    d.routing.bgp.noNetworkImportCheck = false; // only AS6's aggregate announcement needs this
    model.devices.push(d);
    return d;
  }
  const nb = (ip, remoteAs, description, extra = {}) => ({
    ip,
    remoteAs,
    description,
    routeMapOut: false,
    metric: 20,
    routeMapOutMatch: "",
    routeMapIn: false,
    localPref: 150,
    routeMapInMatch: "",
    ...extra,
  });

  const as1r1 = bgpRouter("as1r1", 1, 20, 20);
  addIf(as1r1, A, "1.2.0.1", 24);
  addIf(as1r1, B, "1.3.0.1", 24);
  as1r1.routing.bgp.networks = "1.2.0.0/24, 1.3.0.0/24";
  as1r1.routing.bgp.neighbors = [
    nb("1.2.0.2", 2, "Router as2r1"),
    // Block everything from as3r1 over link B so all traffic (including to AS6) is forced via AS2 instead.
    nb("1.3.0.3", 3, "Router as3r1", { prefixListIn: { enabled: true, mode: "deny", prefixes: "any" } }),
  ];

  const as2r1 = bgpRouter("as2r1", 2, 40, 220);
  addIf(as2r1, C, "2.3.0.2", 24);
  addIf(as2r1, A, "1.2.0.2", 24);
  as2r1.routing.bgp.networks = "1.2.0.0/24, 2.3.0.0/24";
  as2r1.routing.bgp.neighbors = [nb("1.2.0.1", 1, "Router as1r1"), nb("2.3.0.3", 3, "Router as3r1")];

  const as3r1 = bgpRouter("as3r1", 3, 260, 220);
  addIf(as3r1, E, "3.5.0.3", 24);
  addIf(as3r1, D, "3.4.0.3", 24);
  addIf(as3r1, B, "1.3.0.3", 24);
  addIf(as3r1, C, "2.3.0.3", 24);
  as3r1.routing.bgp.networks = "1.3.0.0/24, 2.3.0.0/24, 3.4.0.0/24, 3.5.0.0/24";
  as3r1.routing.bgp.neighbors = [
    nb("1.3.0.1", 1, "Router as1r1"),
    nb("2.3.0.2", 2, "Router as2r1"),
    nb("3.4.0.4", 4, "Router as4r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "6.1.0.0/24" }),
    nb("3.5.0.5", 5, "Router as5r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "6.2.0.0/24" }),
  ];

  const as4r1 = bgpRouter("as4r1", 4, 700, 20);
  addIf(as4r1, G, "4.6.0.4", 24);
  addIf(as4r1, D, "3.4.0.4", 24);
  addIf(as4r1, F, "4.5.0.4", 24);
  as4r1.routing.bgp.networks = "3.4.0.0/24, 4.5.0.0/24, 4.6.0.0/24";
  as4r1.routing.bgp.neighbors = [
    nb("3.4.0.3", 3, "Router as3r1"),
    nb("4.5.0.5", 5, "Router as5r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "6.1.0.0/24" }),
    nb("4.6.0.6", 6, "Router as6r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "6.2.0.0/24" }),
  ];

  const as5r1 = bgpRouter("as5r1", 5, 480, 220);
  addIf(as5r1, H, "5.6.0.5", 24);
  addIf(as5r1, F, "4.5.0.5", 24);
  addIf(as5r1, E, "3.5.0.5", 24);
  as5r1.routing.bgp.networks = "3.5.0.0/24, 4.5.0.0/24, 5.6.0.0/24";
  as5r1.routing.bgp.neighbors = [
    nb("3.5.0.3", 3, "Router as3r1"),
    nb("4.5.0.4", 4, "Router as4r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "6.2.0.0/24" }),
    nb("5.6.0.6", 6, "Router as6r1", { routeMapIn: true, localPref: 150, routeMapInMatch: "6.1.0.0/24" }),
  ];

  const as6r1 = bgpRouter("as6r1", 6, 920, 20);
  addIf(as6r1, I, "6.0.0.1", 30);
  addIf(as6r1, G, "4.6.0.6", 24);
  addIf(as6r1, H, "5.6.0.6", 24);
  as6r1.routing.rip.enabled = true;
  as6r1.routing.rip.networks = "6.0.0.0/8";
  as6r1.routing.rip.redistribute = { connected: true, bgp: true, ospf: false, static: false };
  as6r1.routing.bgp.noNetworkImportCheck = true;
  as6r1.routing.bgp.networks = "4.6.0.0/24, 5.6.0.0/24, 6.0.0.0/8, 6.1.0.0/24, 6.2.0.0/24";
  as6r1.routing.bgp.neighbors = [nb("4.6.0.4", 4, "Router as4r1"), nb("5.6.0.5", 5, "Router as5r1")];

  function ripOnlyRouter(name, x, y) {
    const d = newDevice("router", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.rip.enabled = true;
    d.routing.rip.networks = "6.0.0.0/8";
    d.routing.rip.redistribute.connected = false;
    model.devices.push(d);
    return d;
  }
  const as6r2 = ripOnlyRouter("as6r2", 1140, 20);
  addIf(as6r2, J, "6.0.0.5", 30);
  addIf(as6r2, I, "6.0.0.2", 30);
  addIf(as6r2, K, "6.1.0.1", 24);

  const as6r3 = ripOnlyRouter("as6r3", 1140, 220);
  addIf(as6r3, J, "6.0.0.6", 30);
  addIf(as6r3, L, "6.2.0.1", 24);

  return model;
}

function buildButterfly2017Preset() {
  const model = newModel();
  model.labName = "butterfly2017";
  model.description = "ICN - Esame 'Butterfly' (24-11-2017): RIP + OSPF collegati da rotte statiche, con 'redistribute kernel' per iniettare una rotta statica shell (non dichiarata in frr.conf)";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const C = net("C", 60, 20);
  const D = net("D", 260, 20);
  const A = net("A", 160, 140);
  const B = net("B", 160, 300);
  const E = net("E", 260, 300);
  const F = net("F", 460, 160);
  const G = net("G", 660, 20);
  const H = net("H", 860, 20);
  const L = net("L", 660, 300);
  const M = net("M", 760, 160);
  const I = net("I", 860, 300);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function ripRouter(name, x, y) {
    const d = newDevice("router", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.rip.enabled = true;
    d.routing.rip.networks = "20.0.0.0/16";
    d.routing.rip.redistribute.connected = false; // connected subnets already fall inside the "network" statement
    model.devices.push(d);
    return d;
  }
  function ospfRouter(name, x, y) {
    const d = newDevice("router", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.ospf.enabled = true;
    model.devices.push(d);
    return d;
  }

  const r1 = ripRouter("r1", 60, 140);
  addIf(r1, C, "20.0.0.1", 24);
  addIf(r1, D, "20.0.1.1", 24);
  addIf(r1, A, "20.0.2.1", 24);

  const r2 = ripRouter("r2", 260, 140);
  addIf(r2, D, "20.0.1.2", 24);
  const r2f = addIf(r2, F, "10.0.0.1", 30);
  addIf(r2, E, "20.0.3.1", 24);
  r2.routing.rip.redistribute.connected = true; // the F link to the OSPF side falls outside 20.0.0.0/16
  // Force-announce the OSPF side's aggregate via RIP's own "route" directive; the actual forwarding path
  // is a plain kernel static route (not declared in frr.conf), matching the official solution exactly.
  r2.routing.rip.forceAnnounce = "30.0.0.0/16";
  r2.staticRoutes = [{ destination: "30.0.0.0/16", via: "10.0.0.2", iface: r2f, declareInFrr: false }];

  const r3 = ripRouter("r3", 160, 300);
  addIf(r3, B, "20.0.4.2", 24);
  addIf(r3, A, "20.0.2.2", 24);
  addIf(r3, E, "20.0.3.2", 24);

  const r4 = ripRouter("r4", 60, 300);
  addIf(r4, C, "20.0.0.2", 24);
  addIf(r4, B, "20.0.4.1", 24);

  const r5 = ospfRouter("r5", 460, 20);
  const r5f = addIf(r5, F, "10.0.0.2", 30);
  addIf(r5, G, "30.0.0.1", 24);
  addIf(r5, L, "30.0.4.1", 24);
  r5.routing.ospf.manualNetworks = "30.0.0.0/16 area 0.0.0.0"; // single supernet covering G+L, matching the official solution
  r5.routing.ospf.redistribute.connected = true; // the F link to the RIP side falls outside 30.0.0.0/16
  r5.routing.ospf.redistribute.kernel = true; // pulls in the plain shell static route below (not declared in frr.conf)
  r5.staticRoutes = [{ destination: "20.0.0.0/16", via: "10.0.0.1", iface: r5f, declareInFrr: false }];

  const r6 = ospfRouter("r6", 660, 140);
  addIf(r6, G, "30.0.0.2", 24);
  addIf(r6, H, "30.0.1.1", 24);
  addIf(r6, M, "30.0.2.1", 24);
  r6.routing.ospf.manualNetworks = "30.0.0.0/16 area 0.0.0.0";

  const r7 = ospfRouter("r7", 860, 140);
  const r7h = addIf(r7, H, "30.0.1.2", 24);
  addIf(r7, I, "30.0.3.1", 24);
  r7.routing.ospf.manualNetworks = "30.0.0.0/16 area 0.0.0.0";
  r7.routing.ospf.perInterface = { [r7h]: { cost: 100 } };

  const r8 = ospfRouter("r8", 760, 300);
  const r8l = addIf(r8, L, "30.0.4.2", 24);
  addIf(r8, M, "30.0.2.2", 24);
  addIf(r8, I, "30.0.3.2", 24);
  r8.routing.ospf.manualNetworks = "30.0.0.0/16 area 0.0.0.0";
  r8.routing.ospf.perInterface = { [r8l]: { cost: 100 } };

  return model;
}

function buildExapusPreset() {
  const model = newModel();
  model.labName = "exapus";
  model.description = "IDC - Quarta prova intermedia del 15-01-2024 'exapus': fabric VXLAN/EVPN con tre tenant (VNI/VLAN) condivisi sugli stessi leaf e switch di accesso";

  const net = (name, x, y) => {
    const n = newNetwork(name);
    n.x = x;
    n.y = y;
    model.networks.push(n);
    return n;
  };
  const A = net("A", 260, 20);
  const B = net("B", 500, 20);
  const C = net("C", 260, 140);
  const D = net("D", 500, 140);
  const E = net("E", 140, 280);
  const F = net("F", 340, 280);
  const G = net("G", 620, 280);
  const H = net("H", 60, 420);
  const I = net("I", 260, 420);
  const J = net("J", 400, 420);
  const K = net("K", 560, 420);
  const L = net("L", 700, 420);

  function addIf(dev, network, ip, cidr) {
    dev.interfaces.push({ network: network.id, ip: ip || "", cidr: cidr || 24 });
    return dev.interfaces.length - 1;
  }
  function fabricDevice(name, as, routerId, x, y) {
    const d = newDevice("router", name);
    d.as = as;
    d.x = x;
    d.y = y;
    d.image = "kathara/frr";
    d.routing.bgp.enabled = true;
    d.routing.bgp.mode = "fabric";
    d.routing.bgp.routerId = routerId;
    d.labConfExtra = '[sysctl]="net.ipv4.fib_multipath_hash_policy=1"\n[ipv6]=True';
    model.devices.push(d);
    return d;
  }
  const tenants = [
    { vni: "7100", vlan: "100" },
    { vni: "7200", vlan: "200" },
    { vni: "7300", vlan: "300" },
  ];

  const spine1 = fabricDevice("spine1", 64512, "", 260, -100);
  const sp1a = addIf(spine1, A, "", 30);
  const sp1b = addIf(spine1, B, "", 30);
  spine1.routing.bgp.fabricInterfaces = { [sp1a]: true, [sp1b]: true };

  const spine2 = fabricDevice("spine2", 64512, "", 500, -100);
  const sp2c = addIf(spine2, C, "", 30);
  const sp2d = addIf(spine2, D, "", 30);
  spine2.routing.bgp.fabricInterfaces = { [sp2c]: true, [sp2d]: true };

  const leaf1 = fabricDevice("leaf1", 64513, "", 140, 140);
  const l1a = addIf(leaf1, A, "", 30);
  const l1c = addIf(leaf1, C, "", 30);
  const l1f = addIf(leaf1, F, "", 24); // eth2 -> s2
  const l1e = addIf(leaf1, E, "", 24); // eth3 -> s1
  leaf1.routing.bgp.fabricInterfaces = { [l1a]: true, [l1c]: true };
  leaf1.routing.bgp.fabricRedistributeLoopback = true;
  leaf1.routing.bgp.fabricAdvertiseAllVni = true;
  leaf1.vtep = { enabled: true, loopbackIp: "192.168.0.1", entries: tenants.map((t) => ({ ...t })), trunkIfaces: `${l1f}, ${l1e}` };

  const leaf2 = fabricDevice("leaf2", 64514, "", 620, 140);
  const l2b = addIf(leaf2, B, "", 30);
  const l2d = addIf(leaf2, D, "", 30);
  const l2g = addIf(leaf2, G, "", 24);
  leaf2.routing.bgp.fabricInterfaces = { [l2b]: true, [l2d]: true };
  leaf2.routing.bgp.fabricRedistributeLoopback = true;
  leaf2.routing.bgp.fabricAdvertiseAllVni = true;
  leaf2.vtep = { enabled: true, loopbackIp: "192.168.0.2", entries: tenants.map((t) => ({ ...t })), trunkIfaces: String(l2g) };

  // s1 carries tenant 1 (H, shared by two containers) and tenant 2 (I); its uplink is trunk for all three VLANs.
  const s1 = newDevice("host", "s1");
  s1.x = 60;
  s1.y = 300;
  s1.image = "kathara/base";
  addIf(s1, E, "", 24); // eth0: uplink to leaf1 (trunk)
  const s1i = addIf(s1, I, "", 24); // eth1: tenant 2 access
  const s1h = addIf(s1, H, "", 24); // eth2: tenant 1 access
  s1.bridge = { enabled: true, vlans: "100, 200, 300", portVlan: { [s1i]: "200", [s1h]: "100" } };
  model.devices.push(s1);

  // s2 carries only tenant 3, but its uplink is still trunk for all three VLANs (over-provisioned, like the leaf uplinks).
  const s2 = newDevice("host", "s2");
  s2.x = 260;
  s2.y = 300;
  s2.image = "kathara/base";
  addIf(s2, F, "", 24); // eth0: uplink to leaf1 (trunk)
  const s2j = addIf(s2, J, "", 24); // eth1: tenant 3 access
  s2.bridge = { enabled: true, vlans: "100, 200, 300", portVlan: { [s2j]: "300" } };
  model.devices.push(s2);

  // s3 carries tenant 2 (L) and tenant 1 (K).
  const s3 = newDevice("host", "s3");
  s3.x = 620;
  s3.y = 300;
  s3.image = "kathara/base";
  addIf(s3, G, "", 24); // eth0: uplink to leaf2 (trunk)
  const s3l = addIf(s3, L, "", 24); // eth1: tenant 2 access
  const s3k = addIf(s3, K, "", 24); // eth2: tenant 1 access
  s3.bridge = { enabled: true, vlans: "100, 200, 300", portVlan: { [s3l]: "200", [s3k]: "100" } };
  model.devices.push(s3);

  function container(name, network, ip, x, y) {
    const d = newDevice("host", name);
    d.x = x;
    d.y = y;
    d.image = "kathara/base";
    addIf(d, network, ip, 24);
    d.customStartup = "ip link set dev eth0 mtu 1450";
    d.webserver = { enabled: true, html: `<html>\n  <body>\n    <h1>${name}</h1>\n  </body>\n</html>\n` };
    model.devices.push(d);
    return d;
  }
  container("c_1_1", H, "100.0.0.1", 20, 460);
  container("c_1_2", H, "100.0.0.2", 100, 460);
  container("c_2_1", I, "200.0.0.1", 260, 460);
  container("c_3_1", J, "250.0.0.1", 400, 460);
  container("c_1_3", K, "100.0.0.3", 560, 460);
  container("c_2_2", L, "200.0.0.2", 700, 460);

  return model;
}

const PRESETS = {
  palabra: { label: "Esempio esame: Palabra (BGP + RIP + DNS)", build: buildPalabraPreset },
  patchwork: { label: "Esempio esame: Patchwork (fabric VXLAN/EVPN + OSPF/RIP/BGP + DNS)", build: buildPatchworkPreset },
  desconocida: { label: "Esempio esame: Desconocida (RIP + BGP con filtri di prefisso)", build: buildDesconocidaPreset },
  incognita: { label: "Esempio esame: Incognita (RIP + BGP con iBGP tra border router dello stesso AS)", build: buildIncognitaPreset },
  fallingasleep: { label: "Esempio esame: Falling Asleep (RIP + OSPF, rotta statica redistribuita)", build: buildFallingAsleepPreset },
  clouds: { label: "Esempio esame: Clouds (OSPF multi-area con aree stub)", build: buildCloudsPreset },
  t2c1: { label: "Esempio esame: T2C1 (OSPF interno + eBGP a catena tra 6 AS)", build: buildT2c1Preset },
  redbaron: { label: "Esempio esame: Red Baron (BGP cliente/provider/peer con prefix-list allowlist)", build: buildRedBaronPreset },
  peartopear: { label: "Esempio esame: Pear to Pear (BGP cliente/provider/peer, filtri misti deny/permit)", build: buildPearToPearPreset },
  butterfly: { label: "Esempio esame: Butterfly (traffic engineering per-prefisso con route-map + access-list)", build: buildButterflyPreset },
  gardenumbrella: { label: "Esempio esame: Garden Umbrella (blocco totale vicino + traffic engineering ridondante)", build: buildGardenUmbrellaPreset },
  butterfly2017: { label: "Esempio esame: Butterfly 2017 (redistribute kernel: rotta statica shell in RIP/OSPF)", build: buildButterfly2017Preset },
  exapus: { label: "Esempio esame: Exapus (fabric VXLAN/EVPN multi-tenant su leaf e bridge condivisi)", build: buildExapusPreset },
};
