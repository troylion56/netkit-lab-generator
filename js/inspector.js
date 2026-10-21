// Property inspector: renders a form for the selected device/network and
// writes changes back into the model via simple dotted-path get/set.


function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] ?? {}), obj);
  target[last] = value;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Restricts a plain IPv4 text input to digits and dots, at most 4 groups
// (3 dots), each group clamped to 0-255 (so the range is 0.0.0.0 - 255.255.255.255).
// Mutates el.value in place and preserves the caret position.
function sanitizeIpInput(el) {
  const before = el.value;
  const caret = el.selectionStart;
  let parts = before.replace(/[^\d.]/g, "").split(".");
  if (parts.length > 4) parts = parts.slice(0, 4);
  parts = parts.map((p) => {
    p = p.slice(0, 3);
    return p !== "" && Number(p) > 255 ? "255" : p;
  });
  const after = parts.join(".");
  if (after !== before) {
    el.value = after;
    const pos = Math.max(0, caret - (before.length - after.length));
    el.setSelectionRange(pos, pos);
  }
}

class Inspector {
  constructor(rootEl, model, onChange) {
    this.root = rootEl;
    this.model = model;
    this.onChange = onChange;
    this.selected = null;
    this.root.addEventListener("input", (e) => this._onInput(e));
    this.root.addEventListener("change", (e) => this._onInput(e));
    this.root.addEventListener("click", (e) => this._onClick(e));
  }

  setModel(model) {
    this.model = model;
  }

  show(selected) {
    this.selected = selected;
    this.render();
  }

  _device() {
    return this.selected && this.selected.kind === "device" ? findDevice(this.model, this.selected.id) : null;
  }
  _network() {
    return this.selected && this.selected.kind === "network" ? findNetwork(this.model, this.selected.id) : null;
  }

  render() {
    const d = this._device();
    const n = this._network();
    if (d) this.root.innerHTML = this._renderDevice(d);
    else if (n) this.root.innerHTML = this._renderNetwork(n);
    else this.root.innerHTML = `<p class="hint">Seleziona un router, un host o una rete per modificarne le proprietà.<br><br>Usa i pulsanti in alto per aggiungere elementi, oppure attiva "Collega" e clicca prima un dispositivo poi una rete (o viceversa) per creare un collegamento.</p>`;
  }

  _networkOptions(selectedId) {
    return this.model.networks
      .map((net) => `<option value="${net.id}" ${net.id === selectedId ? "selected" : ""}>${esc(net.name)}</option>`)
      .join("");
  }

  _ifaceOptions(device, selectedIdx) {
    return device.interfaces
      .map((iface, idx) => {
        const net = findNetwork(this.model, iface.network);
        return `<option value="${idx}" ${String(idx) === String(selectedIdx) ? "selected" : ""}>${ethName(idx)} (${net ? esc(net.name) : "?"}${iface.ip ? " " + esc(iface.ip) : ""})</option>`;
      })
      .join("");
  }

  _renderNetwork(net) {
    const peers = peersOnNetwork(this.model, net.id, null);
    return `
      <div class="panel-section">
        <h3>Rete / dominio di collisione</h3>
        <label>Nome (usato in lab.conf)
          <input data-field="name" data-kind="network" value="${esc(net.name)}">
        </label>
        <h4>Dispositivi collegati</h4>
        <ul class="peer-list">
          ${peers.map((p) => `<li>${esc(p.device.name)} — ${ethName(p.ifaceIndex)}${p.iface.ip ? " " + esc(p.iface.ip) + "/" + p.iface.cidr : " <em>(IP non assegnato)</em>"}</li>`).join("") || "<li><em>nessuno</em></li>"}
        </ul>
        <button class="danger" data-action="delete-network">Elimina rete</button>
      </div>`;
  }

  _renderDevice(d) {
    return `
      <div class="panel-section">
        <h3>${d.type === "router" ? "Router" : "Host"}</h3>
        <label>Nome (hostname Kathara)
          <input data-field="name" data-kind="device" value="${esc(d.name)}">
        </label>
        <label>AS (per BGP, opzionale)
          <input data-field="as" data-kind="device" data-type="number" value="${esc(d.as)}">
        </label>
        <label>Immagine Kathara (opzionale)
          <input data-field="image" data-kind="device" value="${esc(d.image)}" placeholder="es. kathara/frr, kathara/base">
        </label>
      </div>

      ${this._renderInterfaces(d)}
      ${this._renderStaticRoutes(d)}
      ${d.type === "router" ? this._renderRip(d) : ""}
      ${d.type === "router" ? this._renderOspf(d) : ""}
      ${d.type === "router" ? this._renderBgp(d) : ""}
      ${this._renderBridge(d)}
      ${this._renderVtep(d)}
      ${this._renderDns(d)}
      ${this._renderResolvConf(d)}
      ${this._renderNat(d)}
      ${this._renderWebserver(d)}

      <div class="panel-section">
        <h3>Comandi extra (.startup)</h3>
        <p class="hint">Aggiunti in coda allo startup, prima dell'avvio dei servizi. Usali per VLAN, tuning TCP o qualunque comando non coperto dai controlli sopra.</p>
        <textarea data-field="customStartup" data-kind="device" rows="4">${esc(d.customStartup)}</textarea>
      </div>
      ${d.type === "router" ? `
      <div class="panel-section">
        <h3>frr.conf extra</h3>
        <p class="hint">Righe aggiunte in coda a frr.conf (es. route-map, prefix-list, isis...).</p>
        <textarea data-field="customFrrConf" data-kind="device" rows="4">${esc(d.customFrrConf)}</textarea>
      </div>` : ""}
      <div class="panel-section">
        <h3>Direttive extra lab.conf</h3>
        <p class="hint">Una direttiva per riga, nella forma <code>[opzione]=valore</code> (verrà anteposto automaticamente il nome del dispositivo). Esempi: <code>[sysctl]="net.ipv4.fib_multipath_hash_policy=1"</code>, <code>[ipv6]=True</code>, <code>[image]=kathara/frr</code>.</p>
        <textarea data-field="labConfExtra" data-kind="device" rows="3" placeholder='[sysctl]="net.ipv4.fib_multipath_hash_policy=1"&#10;[ipv6]=True'>${esc(d.labConfExtra)}</textarea>
      </div>

      <div class="panel-section">
        <h3>Note</h3>
        <textarea data-field="notes" data-kind="device" rows="2" placeholder="Promemoria personale, non esportato">${esc(d.notes)}</textarea>
      </div>

      <div class="panel-section">
        <button class="danger" data-action="delete-device">Elimina dispositivo</button>
      </div>`;
  }

  _renderInterfaces(d) {
    const rows = d.interfaces
      .map(
        (iface, idx) => `
        <tr>
          <td>${ethName(idx)}</td>
          <td><select data-list="interfaces" data-index="${idx}" data-field="network">${this._networkOptions(iface.network)}</select></td>
          <td><input data-list="interfaces" data-index="${idx}" data-field="ip" data-type="ip" value="${esc(iface.ip)}" placeholder="es. 10.0.0.1"></td>
          <td>/<input data-list="interfaces" data-index="${idx}" data-field="cidr" data-type="number" value="${esc(iface.cidr)}" style="width:3.5em"></td>
          <td><button class="danger small" data-action="remove-interface" data-index="${idx}">✕</button></td>
        </tr>`
      )
      .join("");
    return `
      <div class="panel-section">
        <h3>Interfacce</h3>
        <table class="mini-table">
          <thead><tr><th>eth</th><th>rete</th><th>IP</th><th>prefisso</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5"><em>nessuna — usa "Collega" sulla mappa</em></td></tr>`}</tbody>
        </table>
        <button data-action="add-interface" ${this.model.networks.length ? "" : "disabled"}>+ Aggiungi interfaccia</button>
      </div>`;
  }

  _renderStaticRoutes(d) {
    const rows = d.staticRoutes
      .map(
        (r, idx) => `
        <tr>
          <td><input data-list="staticRoutes" data-index="${idx}" data-field="destination" value="${esc(r.destination)}" placeholder="es. 4.0.0.0/8"></td>
          <td><input data-list="staticRoutes" data-index="${idx}" data-field="via" data-type="ip" value="${esc(r.via)}" placeholder="next-hop"></td>
          <td><select data-list="staticRoutes" data-index="${idx}" data-field="iface"><option value="">(auto)</option>${this._ifaceOptions(d, r.iface)}</select></td>
          <td>${d.type === "router" ? `<label class="checkbox nowrap"><input type="checkbox" data-list="staticRoutes" data-index="${idx}" data-field="declareInFrr" ${r.declareInFrr ? "checked" : ""}> in frr.conf</label>` : ""}</td>
          <td><button class="danger small" data-action="remove-static-route" data-index="${idx}">✕</button></td>
        </tr>`
      )
      .join("");
    return `
      <div class="panel-section">
        <h3>Rotte statiche</h3>
        <table class="mini-table">
          <thead><tr><th>destinazione</th><th>via</th><th>dev</th><th></th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5"><em>nessuna</em></td></tr>`}</tbody>
        </table>
        <button data-action="add-static-route">+ Aggiungi rotta</button>
        ${d.type === "router" ? `<p class="hint">"in frr.conf" dichiara la rotta come <code>ip route</code> globale in frr.conf (di proprietà di zebra) invece che come comando shell: necessario per poterla redistribuire con "redistribute static" in RIP/OSPF/BGP. Se disattivo, resta solo nella tabella di routing del kernel.</p>` : ""}
        <hr>
        <label class="checkbox"><input type="checkbox" data-field="defaultRoute.enabled" data-kind="device" ${d.defaultRoute.enabled ? "checked" : ""}> Rotta di default</label>
        <div class="${d.defaultRoute.enabled ? "" : "collapsed"}">
          <label>Via <input data-field="defaultRoute.via" data-kind="device" data-type="ip" value="${esc(d.defaultRoute.via)}"></label>
          <label>Interfaccia <select data-field="defaultRoute.iface" data-kind="device"><option value="">(auto)</option>${this._ifaceOptions(d, d.defaultRoute.iface)}</select></label>
        </div>
      </div>`;
  }

  _renderRip(d) {
    const rip = d.routing.rip;
    return `
      <div class="panel-section">
        <h3><label class="checkbox"><input type="checkbox" data-field="routing.rip.enabled" data-kind="device" ${rip.enabled ? "checked" : ""}> RIP (IGP a vettore distanza)</label></h3>
        <div class="${rip.enabled ? "" : "collapsed"}">
          <label>Reti annunciate (CIDR, separate da virgola)
            <input data-field="routing.rip.networks" data-kind="device" value="${esc(rip.networks)}" placeholder="es. 10.0.0.0/8">
          </label>
          <div class="checkbox-row">
            <label class="checkbox"><input type="checkbox" data-field="routing.rip.redistribute.connected" data-kind="device" ${rip.redistribute.connected ? "checked" : ""}> redistribute connected</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.rip.redistribute.bgp" data-kind="device" ${rip.redistribute.bgp ? "checked" : ""}> redistribute bgp</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.rip.redistribute.ospf" data-kind="device" ${rip.redistribute.ospf ? "checked" : ""}> redistribute ospf</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.rip.redistribute.static" data-kind="device" ${rip.redistribute.static ? "checked" : ""}> redistribute static</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.rip.redistribute.kernel" data-kind="device" ${rip.redistribute.kernel ? "checked" : ""}> redistribute kernel</label>
          </div>
          <label>Annunci forzati (direttiva "route", CIDR separati da virgola)
            <input data-field="routing.rip.forceAnnounce" data-kind="device" value="${esc(rip.forceAnnounce)}" placeholder="es. 20.0.0.0/8">
          </label>
          <p class="hint">Fa annunciare a RIP quella rete indipendentemente dalla tabella di routing (utile insieme a una rotta statica verso una rete OSPF/esterna). A differenza di "redistribute static" non richiede che la rotta sia dichiarata in frr.conf, ma nemmeno la installa: se serve anche per l'inoltro dei pacchetti aggiungi comunque una rotta statica. "redistribute kernel" invece riprende le rotte statiche aggiunte come comando shell (non dichiarate in frr.conf) — usalo al posto di "redistribute static" quando la rotta statica NON è marcata "in frr.conf".</p>
        </div>
      </div>`;
  }

  _renderOspf(d) {
    const ospf = d.routing.ospf;
    const ifaceRows = d.interfaces
      .map((iface, idx) => {
        const cfg = ospf.perInterface[idx] || { area: "", cost: "" };
        return `
        <tr>
          <td>${ethName(idx)}</td>
          <td><input data-list="ospfIface" data-index="${idx}" data-field="area" value="${esc(cfg.area)}" placeholder="es. 0.0.0.0" style="width:6em"></td>
          <td><input data-list="ospfIface" data-index="${idx}" data-field="cost" data-type="number" value="${esc(cfg.cost)}" style="width:4em"></td>
        </tr>`;
      })
      .join("");
    return `
      <div class="panel-section">
        <h3><label class="checkbox"><input type="checkbox" data-field="routing.ospf.enabled" data-kind="device" ${ospf.enabled ? "checked" : ""}> OSPF (IGP link-state)</label></h3>
        <div class="${ospf.enabled ? "" : "collapsed"}">
          <p class="hint">Imposta l'area (obbligatoria per attivare OSPF sull'interfaccia) e opzionalmente il costo per ogni interfaccia.</p>
          <table class="mini-table">
            <thead><tr><th>eth</th><th>area</th><th>costo</th></tr></thead>
            <tbody>${ifaceRows || `<tr><td colspan="3"><em>nessuna interfaccia</em></td></tr>`}</tbody>
          </table>
          <div class="checkbox-row">
            <label class="checkbox"><input type="checkbox" data-field="routing.ospf.redistribute.connected" data-kind="device" ${ospf.redistribute.connected ? "checked" : ""}> redistribute connected</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.ospf.redistribute.bgp" data-kind="device" ${ospf.redistribute.bgp ? "checked" : ""}> redistribute bgp</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.ospf.redistribute.rip" data-kind="device" ${ospf.redistribute.rip ? "checked" : ""}> redistribute rip</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.ospf.redistribute.static" data-kind="device" ${ospf.redistribute.static ? "checked" : ""}> redistribute static</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.ospf.redistribute.kernel" data-kind="device" ${ospf.redistribute.kernel ? "checked" : ""}> redistribute kernel</label>
          </div>
          <p class="hint">OSPF non ha una direttiva equivalente a "route" di RIP per forzare un annuncio: per iniettare una rotta statica aggiunta come comando shell (non "in frr.conf") usa "redistribute kernel"; per una rotta dichiarata "in frr.conf" usa invece "redistribute static".</p>
          <label>Aree stub (ID separati da virgola)
            <input data-field="routing.ospf.stubAreas" data-kind="device" value="${esc(ospf.stubAreas)}" placeholder="es. 1.1.1.1, 2.2.2.2">
          </label>
          <p class="hint">Genera una riga <code>area &lt;id&gt; stub</code> per ciascuna: va ripetuta su ogni router che ha un'interfaccia in quell'area (compresi gli ABR).</p>
          <label>Network statement manuali (avanzato, opzionale)
            <textarea data-field="routing.ospf.manualNetworks" data-kind="device" rows="3" placeholder="100.0.0.0/16 area 0.0.0.0&#10;110.10.0.0/16 area 1.1.1.1">${esc(ospf.manualNetworks)}</textarea>
          </label>
          <p class="hint">Una riga "&lt;CIDR&gt; area &lt;id&gt;" per network statement: se compilato sostituisce quelli calcolati automaticamente dalle interfacce sopra, utile per accorpare più subnet sotto un'unica supernet come <code>100.0.0.0/16</code>.</p>
        </div>
      </div>`;
  }

  _renderBgp(d) {
    const bgp = d.routing.bgp;
    const modeHeader = `
        <h3><label class="checkbox"><input type="checkbox" data-field="routing.bgp.enabled" data-kind="device" ${bgp.enabled ? "checked" : ""}> BGP (EGP)</label></h3>
        <div class="${bgp.enabled ? "" : "collapsed"}">
          <label>Modalità
            <select data-field="routing.bgp.mode" data-kind="device">
              <option value="standard" ${bgp.mode === "standard" ? "selected" : ""}>Standard (vicini con IP)</option>
              <option value="fabric" ${bgp.mode === "fabric" ? "selected" : ""}>Fabric datacenter (BGP unnumbered, EVPN)</option>
            </select>
          </label>`;
    if (bgp.mode === "fabric") {
      return `
      <div class="panel-section">
        ${modeHeader}
          <p class="hint">Peering "unnumbered" su link IPv6 link-local, tramite peer-group "TOR" (tipico di fabric spine-leaf con overlay EVPN). Spunta le interfacce che collegano gli spine/leaf.</p>
          <label>Router ID <input data-field="routing.bgp.routerId" data-kind="device" data-type="ip" value="${esc(bgp.routerId)}" placeholder="es. 192.168.0.1"></label>
          <table class="mini-table">
            <thead><tr><th>eth</th><th>rete</th><th>peer-group TOR</th></tr></thead>
            <tbody>${
              d.interfaces
                .map((iface, idx) => {
                  const net = findNetwork(this.model, iface.network);
                  return `<tr><td>${ethName(idx)}</td><td>${net ? esc(net.name) : "?"}</td><td><input type="checkbox" data-fabric-iface="${idx}" ${bgp.fabricInterfaces[idx] ? "checked" : ""}></td></tr>`;
                })
                .join("") || `<tr><td colspan="3"><em>nessuna interfaccia</em></td></tr>`
            }</tbody>
          </table>
          <label class="checkbox"><input type="checkbox" data-field="routing.bgp.fabricRedistributeLoopback" data-kind="device" ${bgp.fabricRedistributeLoopback ? "checked" : ""}> redistribute connected (solo loopback) — tipico dei leaf</label>
          <label class="checkbox"><input type="checkbox" data-field="routing.bgp.fabricAdvertiseAllVni" data-kind="device" ${bgp.fabricAdvertiseAllVni ? "checked" : ""}> advertise-all-vni (EVPN) — tipico dei leaf con VTEP</label>
          <p class="hint">Genera <code>etc/frr/bgpd.conf</code> al posto di frr.conf integrato, come nei laboratori con fabric spine/leaf.</p>
        </div>
      </div>`;
    }

    const rows = bgp.neighbors
      .map(
        (nb, idx) => `
        <div class="neighbor-card">
          <div class="neighbor-card-row">
            <input class="neighbor-ip" data-list="neighbors" data-index="${idx}" data-field="ip" data-type="ip" value="${esc(nb.ip)}" placeholder="IP vicino">
            <input class="neighbor-as" data-list="neighbors" data-index="${idx}" data-field="remoteAs" data-type="number" value="${esc(nb.remoteAs)}" placeholder="AS">
            <input class="neighbor-desc" data-list="neighbors" data-index="${idx}" data-field="description" value="${esc(nb.description)}" placeholder="descrizione">
            <button class="danger small" data-action="remove-neighbor" data-index="${idx}">✕</button>
          </div>
          <div class="filter-row">
            <label class="checkbox nowrap"><input type="checkbox" data-list="neighbors" data-index="${idx}" data-field="routeMapOut" ${nb.routeMapOut ? "checked" : ""}> MED out</label>
            <input class="narrow" data-list="neighbors" data-index="${idx}" data-field="metric" data-type="number" value="${esc(nb.metric)}" ${nb.routeMapOut ? "" : "disabled"}>
            <input data-list="neighbors" data-index="${idx}" data-field="routeMapOutMatch" value="${esc(nb.routeMapOutMatch)}" placeholder="solo per prefissi (opz.)" ${nb.routeMapOut ? "" : "disabled"}>
          </div>
          <div class="filter-row">
            <label class="checkbox nowrap"><input type="checkbox" data-list="neighbors" data-index="${idx}" data-field="routeMapIn" ${nb.routeMapIn ? "checked" : ""}> local-pref in</label>
            <input class="narrow" data-list="neighbors" data-index="${idx}" data-field="localPref" data-type="number" value="${esc(nb.localPref)}" ${nb.routeMapIn ? "" : "disabled"}>
            <input data-list="neighbors" data-index="${idx}" data-field="routeMapInMatch" value="${esc(nb.routeMapInMatch)}" placeholder="solo per prefissi (opz.)" ${nb.routeMapIn ? "" : "disabled"}>
          </div>
        </div>`
      )
      .join("");
    const modeOptions = (selected) => `
      <option value="deny" ${selected !== "permit" ? "selected" : ""}>blocca elencati</option>
      <option value="permit" ${selected === "permit" ? "selected" : ""}>consenti solo elencati</option>`;
    const filterRows = bgp.neighbors
      .map((nb, idx) => {
        const pin = nb.prefixListIn || { enabled: false, mode: "deny", prefixes: "" };
        const pout = nb.prefixListOut || { enabled: false, mode: "deny", prefixes: "" };
        return `
        <div class="neighbor-filter">
          <strong>${esc(nb.ip) || "(IP mancante)"}</strong>
          <div class="filter-row">
            <label class="checkbox nowrap"><input type="checkbox" data-list="neighbors" data-index="${idx}" data-field="prefixListIn.enabled" ${pin.enabled ? "checked" : ""}> in</label>
            <select data-list="neighbors" data-index="${idx}" data-field="prefixListIn.mode" ${pin.enabled ? "" : "disabled"}>${modeOptions(pin.mode)}</select>
            <input data-list="neighbors" data-index="${idx}" data-field="prefixListIn.prefixes" value="${esc(pin.prefixes)}" placeholder="CIDR separati da virgola, o 'any'" ${pin.enabled ? "" : "disabled"}>
          </div>
          <div class="filter-row">
            <label class="checkbox nowrap"><input type="checkbox" data-list="neighbors" data-index="${idx}" data-field="prefixListOut.enabled" ${pout.enabled ? "checked" : ""}> out</label>
            <select data-list="neighbors" data-index="${idx}" data-field="prefixListOut.mode" ${pout.enabled ? "" : "disabled"}>${modeOptions(pout.mode)}</select>
            <input data-list="neighbors" data-index="${idx}" data-field="prefixListOut.prefixes" value="${esc(pout.prefixes)}" placeholder="CIDR separati da virgola, o 'any'" ${pout.enabled ? "" : "disabled"}>
          </div>
        </div>`;
      })
      .join("");
    return `
      <div class="panel-section">
        ${modeHeader}
          <label>Reti annunciate (CIDR, separate da virgola)
            <input data-field="routing.bgp.networks" data-kind="device" value="${esc(bgp.networks)}" placeholder="es. 1.0.0.0/8">
          </label>
          <div class="checkbox-row">
            <label class="checkbox"><input type="checkbox" data-field="routing.bgp.noEbgpRequiresPolicy" data-kind="device" ${bgp.noEbgpRequiresPolicy ? "checked" : ""}> no bgp ebgp-requires-policy</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.bgp.noNetworkImportCheck" data-kind="device" ${bgp.noNetworkImportCheck ? "checked" : ""}> no bgp network import-check</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.bgp.debug" data-kind="device" ${bgp.debug ? "checked" : ""}> debug bgp keepalives/updates</label>
          </div>
          <p class="hint">Se disattivi "no bgp ebgp-requires-policy", FRR richiede una policy (route-map o prefix-list) esplicita su ogni vicino eBGP: usa i filtri qui sotto anche solo come "permit any" per soddisfare il requisito.</p>
          <div class="checkbox-row">
            <label class="checkbox"><input type="checkbox" data-field="routing.bgp.redistribute.connected" data-kind="device" ${bgp.redistribute.connected ? "checked" : ""}> redistribute connected</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.bgp.redistribute.static" data-kind="device" ${bgp.redistribute.static ? "checked" : ""}> redistribute static</label>
            <label class="checkbox"><input type="checkbox" data-field="routing.bgp.redistribute.kernel" data-kind="device" ${bgp.redistribute.kernel ? "checked" : ""}> redistribute kernel</label>
          </div>
          <h4>Vicini</h4>
          ${rows || `<p class="hint"><em>nessun vicino</em></p>`}
          <button data-action="add-neighbor">+ Aggiungi vicino</button>
          <button data-action="detect-neighbors">Rileva vicini dai collegamenti</button>
          <p class="hint">"MED out" rende quel percorso <em>meno</em> preferito agli occhi del vicino: usalo per instradare il traffico <strong>in ingresso</strong> lontano da quel link. "local-pref in" alza la preferenza di quel vicino per te stesso: usalo per instradare il traffico <strong>in uscita</strong> verso quel link. Il campo "solo per prefissi" (CIDR separati da virgola) limita l'effetto a specifiche destinazioni invece che a tutte le rotte del vicino — utile per preferire un percorso diverso per reti diverse (es. instradare il traffico per due sottoreti su due link differenti), genera un <code>access-list</code> e un <code>match ip address</code> nel route-map.</p>
          <h4>Filtri di prefisso (prefix-list)</h4>
          ${filterRows || `<p class="hint"><em>nessun vicino</em></p>`}
          <p class="hint">"Blocca elencati" genera <code>deny &lt;prefisso&gt;</code> per ognuno dei prefissi indicati seguito da <code>permit any</code>: usalo per bloccare del tutto un prefisso su quel vicino, anche come backup (es. "non instradare mai il traffico per X attraverso questo link"). "Consenti solo elencati" genera solo <code>permit &lt;prefisso&gt;</code> (nessuna riga finale, tutto il resto è implicitamente negato): usalo per le policy cliente/provider/peer, cioè per non ri-annunciare a un provider o peer le rotte imparate da un altro provider o peer. Scrivi <code>any</code> come prefisso per un "permit any" incondizionato (tipico verso i clienti).</p>
        </div>
      </div>`;
  }

  _renderDns(d) {
    const dns = d.dns;
    let roleFields = "";
    if (dns.role === "root") {
      const rows = dns.delegations
        .map(
          (del, idx) => `
          <tr>
            <td><input data-list="delegations" data-index="${idx}" data-field="subdomain" value="${esc(del.subdomain)}" placeholder="es. net"></td>
            <td><input data-list="delegations" data-index="${idx}" data-field="nsName" value="${esc(del.nsName)}" placeholder="es. dns.net."></td>
            <td><input data-list="delegations" data-index="${idx}" data-field="nsIp" data-type="ip" value="${esc(del.nsIp)}" placeholder="IP"></td>
            <td><button class="danger small" data-action="remove-delegation" data-index="${idx}">✕</button></td>
          </tr>`
        )
        .join("");
      roleFields = `
        <label>Hostname DNS di questo root server (FQDN)
          <input data-field="dns.hostname" data-kind="device" value="${esc(dns.hostname)}" placeholder="es. ROOT-SERVER.">
        </label>
        <h4>Delegazioni (zone figlie)</h4>
        <table class="mini-table">
          <thead><tr><th>sottodominio</th><th>NS</th><th>IP</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4"><em>nessuna</em></td></tr>`}</tbody>
        </table>
        <button data-action="add-delegation">+ Aggiungi delegazione</button>
        <button data-action="detect-delegations">Rileva zone autoritative</button>`;
    } else if (dns.role === "authoritative") {
      const rows = dns.records
        .map(
          (rec, idx) => `
          <tr>
            <td><input data-list="records" data-index="${idx}" data-field="name" value="${esc(rec.name)}" placeholder="es. pc.net."></td>
            <td><input data-list="records" data-index="${idx}" data-field="ip" value="${esc(rec.ip)}" placeholder="IP"></td>
            <td><button class="danger small" data-action="remove-record" data-index="${idx}">✕</button></td>
          </tr>`
        )
        .join("");
      roleFields = `
        <label>Hostname DNS di questo name server (FQDN)
          <input data-field="dns.hostname" data-kind="device" value="${esc(dns.hostname)}" placeholder="es. dns.net.">
        </label>
        <label>Zona autoritativa
          <input data-field="dns.zone" data-kind="device" value="${esc(dns.zone)}" placeholder="es. net">
        </label>
        <label>Root server (per la hint zone "." — lascia vuoto per rilevarlo automaticamente)
          <input data-field="dns.rootServer.name" data-kind="device" value="${esc(dns.rootServer.name)}" placeholder="nome FQDN">
          <input data-field="dns.rootServer.ip" data-kind="device" value="${esc(dns.rootServer.ip)}" placeholder="IP">
        </label>
        <h4>Record aggiuntivi nella zona</h4>
        <table class="mini-table">
          <thead><tr><th>nome (FQDN)</th><th>IP</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="3"><em>nessuno</em></td></tr>`}</tbody>
        </table>
        <button data-action="add-record">+ Aggiungi record</button>`;
    } else if (dns.role === "resolver") {
      roleFields = `
        <label>Hostname (informativo)
          <input data-field="dns.hostname" data-kind="device" value="${esc(dns.hostname)}" placeholder="es. local.">
        </label>
        <label>Root server (per la hint zone "." — lascia vuoto per rilevarlo automaticamente)
          <input data-field="dns.rootServer.name" data-kind="device" value="${esc(dns.rootServer.name)}" placeholder="nome FQDN">
          <input data-field="dns.rootServer.ip" data-kind="device" value="${esc(dns.rootServer.ip)}" placeholder="IP">
        </label>
        <label class="checkbox"><input type="checkbox" data-field="dns.allowRecursion" data-kind="device" ${dns.allowRecursion ? "checked" : ""}> allow-recursion</label>
        <div class="${dns.allowRecursion ? "" : "collapsed"}">
          <label>CIDR autorizzato <input data-field="dns.allowRecursionCidr" data-kind="device" value="${esc(dns.allowRecursionCidr)}" placeholder="es. 0.0.0.0/0 oppure 1.2.0.0/24"></label>
        </div>`;
    }
    return `
      <div class="panel-section">
        <h3>DNS (bind9)</h3>
        <label>Ruolo
          <select data-field="dns.role" data-kind="device">
            <option value="none" ${dns.role === "none" ? "selected" : ""}>Nessuno</option>
            <option value="root" ${dns.role === "root" ? "selected" : ""}>Root server</option>
            <option value="authoritative" ${dns.role === "authoritative" ? "selected" : ""}>Autoritativo per una zona</option>
            <option value="resolver" ${dns.role === "resolver" ? "selected" : ""}>Resolver ricorsivo</option>
          </select>
        </label>
        ${roleFields}
      </div>`;
  }

  _renderResolvConf(d) {
    const r = d.resolvConf;
    return `
      <div class="panel-section">
        <h3>/etc/resolv.conf</h3>
        <label>Modalità
          <select data-field="resolvConf.mode" data-kind="device">
            <option value="none" ${r.mode === "none" ? "selected" : ""}>Non generare il file</option>
            <option value="empty" ${r.mode === "empty" ? "selected" : ""}>File vuoto (per server DNS locali)</option>
            <option value="custom" ${r.mode === "custom" ? "selected" : ""}>Nameserver specifico</option>
          </select>
        </label>
        <div class="${r.mode === "custom" ? "" : "collapsed"}">
          <label>IP del resolver <input data-field="resolvConf.nameserver" data-kind="device" value="${esc(r.nameserver)}"></label>
        </div>
      </div>`;
  }

  _renderNat(d) {
    const nat = d.nat;
    const rows = nat.dnatRules
      .map((rule, idx) => {
        const targetsStr = rule.targets.map((t) => `${t.ip}:${t.port}${t.probability ? ":" + t.probability : ""}`).join(", ");
        return `
        <tr>
          <td><input data-list="dnatRules" data-index="${idx}" data-field="destIp" value="${esc(rule.destIp)}" placeholder="IP pubblico"></td>
          <td><select data-list="dnatRules" data-index="${idx}" data-field="proto"><option ${rule.proto === "tcp" ? "selected" : ""}>tcp</option><option ${rule.proto === "udp" ? "selected" : ""}>udp</option></select></td>
          <td><input data-list="dnatRules" data-index="${idx}" data-field="dport" data-type="number" value="${esc(rule.dport)}" style="width:4em"></td>
          <td><input data-list="dnatRules" data-index="${idx}" data-field="targets" value="${esc(targetsStr)}" placeholder="ip:port, ip:port"></td>
          <td><button class="danger small" data-action="remove-dnat" data-index="${idx}">✕</button></td>
        </tr>`;
      })
      .join("");
    return `
      <div class="panel-section">
        <h3><label class="checkbox"><input type="checkbox" data-field="nat.enabled" data-kind="device" ${nat.enabled ? "checked" : ""}> NAT / port forwarding</label></h3>
        <div class="${nat.enabled ? "" : "collapsed"}">
          <label>Interfaccia di uscita (MASQUERADE)
            <select data-field="nat.masqueradeIface" data-kind="device"><option value="">(nessuna)</option>${this._ifaceOptions(d, nat.masqueradeIface)}</select>
          </label>
          <label class="checkbox"><input type="checkbox" data-field="nat.enableForwarding" data-kind="device" ${nat.enableForwarding ? "checked" : ""}> ip_forward=1</label>
          <h4>Regole DNAT (port forwarding / load balancing)</h4>
          <p class="hint">Elenca i target come "ip:porta" separati da virgola. Con più target il traffico viene distribuito in parti uguali (statistic random), come negli esercizi di load balancing.</p>
          <table class="mini-table">
            <thead><tr><th>IP dest.</th><th>proto</th><th>porta</th><th>target</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5"><em>nessuna</em></td></tr>`}</tbody>
          </table>
          <button data-action="add-dnat">+ Aggiungi regola</button>
        </div>
      </div>`;
  }

  _renderBridge(d) {
    const bridge = d.bridge;
    const vlans = parseCidrList(bridge.vlans);
    const roleOptions = (idx) => {
      const current = bridge.portVlan[idx];
      const opts = [`<option value="" ${current === undefined || current === "" ? "selected" : ""}>trunk (tutte le VLAN)</option>`];
      for (const v of vlans) {
        opts.push(`<option value="${v}" ${String(current) === String(v) ? "selected" : ""}>accesso VLAN ${v}</option>`);
      }
      return opts.join("");
    };
    const rows = d.interfaces
      .map((iface, idx) => {
        const net = findNetwork(this.model, iface.network);
        return `<tr><td>${ethName(idx)}</td><td>${net ? esc(net.name) : "?"}</td><td><select data-list="bridgePortVlan" data-index="${idx}" data-field="value">${roleOptions(idx)}</select></td></tr>`;
      })
      .join("");
    return `
      <div class="panel-section">
        <h3><label class="checkbox"><input type="checkbox" data-field="bridge.enabled" data-kind="device" ${bridge.enabled ? "checked" : ""}> Bridge L2 (switch di accesso VLAN)</label></h3>
        <div class="${bridge.enabled ? "" : "collapsed"}">
          <p class="hint">Tutte le interfacce del dispositivo vengono aggiunte a un bridge Linux (come gli switch di accesso "s1"/"s2"/"s3" negli esercizi VXLAN). Per ogni interfaccia scegli se è una porta di accesso (untagged, una singola VLAN) o trunk (tagged, tutte le VLAN elencate) — utile quando lo stesso switch porta più tenant. Il dispositivo non avrà indirizzi IP di livello 3.</p>
          <label>VLAN presenti su questo bridge (separate da virgola)
            <input data-field="bridge.vlans" data-kind="device" value="${esc(bridge.vlans)}" placeholder="es. 100 oppure 100, 200, 300">
          </label>
          <table class="mini-table">
            <thead><tr><th>eth</th><th>rete</th><th>ruolo</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3"><em>nessuna interfaccia</em></td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
  }

  _renderVtep(d) {
    const vtep = d.vtep;
    const entryRows = vtep.entries
      .map(
        (e, idx) => `
        <tr>
          <td><input data-list="vtepEntries" data-index="${idx}" data-field="vni" data-type="number" value="${esc(e.vni)}" placeholder="es. 7100"></td>
          <td><input data-list="vtepEntries" data-index="${idx}" data-field="vlan" data-type="number" value="${esc(e.vlan)}" placeholder="es. 100"></td>
          <td><button class="danger small" data-action="remove-vtep-entry" data-index="${idx}">✕</button></td>
        </tr>`
      )
      .join("");
    const trunkSet = new Set(parseCidrList(vtep.trunkIfaces));
    const trunkRows = d.interfaces
      .map((iface, idx) => {
        const net = findNetwork(this.model, iface.network);
        return `<label class="checkbox nowrap"><input type="checkbox" data-action="toggle-vtep-trunk" data-index="${idx}" ${trunkSet.has(String(idx)) ? "checked" : ""}> ${ethName(idx)} (${net ? esc(net.name) : "?"})</label>`;
      })
      .join(" ");
    return `
      <div class="panel-section">
        <h3><label class="checkbox"><input type="checkbox" data-field="vtep.enabled" data-kind="device" ${vtep.enabled ? "checked" : ""}> VTEP VXLAN (leaf datacenter)</label></h3>
        <div class="${vtep.enabled ? "" : "collapsed"}">
          <p class="hint">Crea una loopback e, per ogni tenant (VNI/VLAN), un'interfaccia VXLAN: tutte condividono lo stesso bridge e le stesse interfacce trunk locali, come nei leaf multi-tenant degli esercizi EVPN.</p>
          <label>IP loopback (VTEP) <input data-field="vtep.loopbackIp" data-kind="device" data-type="ip" value="${esc(vtep.loopbackIp)}" placeholder="es. 192.168.0.1"></label>
          <h4>Tenant (VNI / VLAN)</h4>
          <table class="mini-table">
            <thead><tr><th>VNI</th><th>VLAN</th><th></th></tr></thead>
            <tbody>${entryRows || `<tr><td colspan="3"><em>nessun tenant</em></td></tr>`}</tbody>
          </table>
          <button data-action="add-vtep-entry">+ Aggiungi tenant</button>
          <h4>Interfacce trunk verso gli switch di accesso</h4>
          <div class="checkbox-row">${trunkRows || "<em>nessuna interfaccia</em>"}</div>
        </div>
      </div>`;
  }

  _renderWebserver(d) {
    const ws = d.webserver;
    return `
      <div class="panel-section">
        <h3><label class="checkbox"><input type="checkbox" data-field="webserver.enabled" data-kind="device" ${ws.enabled ? "checked" : ""}> Web server (Apache)</label></h3>
        <div class="${ws.enabled ? "" : "collapsed"}">
          <p class="hint">Genera <code>var/www/html/index.html</code> e avvia Apache all'startup.</p>
          <label>Contenuto index.html
            <textarea data-field="webserver.html" data-kind="device" rows="4">${esc(ws.html)}</textarea>
          </label>
        </div>
      </div>`;
  }

  // ---------- event handling ----------

  _onInput(evt) {
    const t = evt.target;
    if (t.matches("[data-fabric-iface]")) {
      const d = this._device();
      if (d) {
        d.routing.bgp.fabricInterfaces[Number(t.getAttribute("data-fabric-iface"))] = t.checked;
        this.onChange();
      }
      return;
    }
    if (!t.matches("[data-field]")) return;
    if (t.getAttribute("data-type") === "ip") sanitizeIpInput(t);
    const d = this._device();
    const n = this._network();
    const kind = t.getAttribute("data-kind");
    const list = t.getAttribute("data-list");
    const field = t.getAttribute("data-field");
    const rawValue = t.type === "checkbox" ? t.checked : t.value;
    const value = t.getAttribute("data-type") === "number" && rawValue !== "" ? Number(rawValue) : rawValue;

    if (list) {
      const idx = Number(t.getAttribute("data-index"));
      this._updateListField(d, list, idx, field, value);
    } else if (kind === "network" && n) {
      setPath(n, field, value);
    } else if (kind === "device" && d) {
      setPath(d, field, value);
    }
    this.onChange();
    // Re-render for changes that affect conditional sections / derived labels.
    const needsRerender = [
      "dns.role",
      "dns.allowRecursion",
      "routing.rip.enabled",
      "routing.ospf.enabled",
      "routing.bgp.enabled",
      "routing.bgp.mode",
      "nat.enabled",
      "bridge.enabled",
      "vtep.enabled",
      "webserver.enabled",
      "defaultRoute.enabled",
      "resolvConf.mode",
    ];
    const neighborTogglesNeedingRerender = ["routeMapOut", "routeMapIn", "prefixListIn.enabled", "prefixListOut.enabled"];
    // Interfaces: the "network" <select> can re-render immediately (it's not typed
    // character-by-character). The "ip"/"cidr" text fields only re-render on "change"
    // (blur/commit) — re-rendering on every "input" keystroke would recreate the DOM
    // input and steal focus after each character.
    const interfaceNeedsRerender = list === "interfaces" && (field === "network" || evt.type === "change");
    if (needsRerender.includes(field) || interfaceNeedsRerender || (list === "neighbors" && neighborTogglesNeedingRerender.includes(field))) {
      this.render();
    }
  }

  _updateListField(device, listName, idx, field, value) {
    if (!device) return;
    if (listName === "interfaces") {
      const iface = device.interfaces[idx];
      if (!iface) return;
      if (field === "cidr") iface.cidr = value === "" ? "" : Number(value);
      else iface[field] = value;
    } else if (listName === "staticRoutes") {
      device.staticRoutes[idx][field] = value;
    } else if (listName === "neighbors") {
      setPath(device.routing.bgp.neighbors[idx], field, value);
    } else if (listName === "delegations") {
      device.dns.delegations[idx][field] = value;
    } else if (listName === "records") {
      device.dns.records[idx][field] = value;
    } else if (listName === "dnatRules") {
      const rule = device.nat.dnatRules[idx];
      if (field === "targets") {
        rule.targets = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const [ip, port, probability] = s.split(":").map((x) => x.trim());
            return { ip, port, probability: probability || "" };
          });
      } else {
        rule[field] = value;
      }
    } else if (listName === "ospfIface") {
      const perInterface = device.routing.ospf.perInterface;
      perInterface[idx] = perInterface[idx] || { area: "", cost: "" };
      perInterface[idx][field] = value;
    } else if (listName === "vtepEntries") {
      device.vtep.entries[idx][field] = value;
    } else if (listName === "bridgePortVlan") {
      if (value === "") delete device.bridge.portVlan[idx];
      else device.bridge.portVlan[idx] = value;
    }
  }

  _onClick(evt) {
    const t = evt.target.closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    const idx = t.hasAttribute("data-index") ? Number(t.getAttribute("data-index")) : null;
    const d = this._device();
    const n = this._network();

    switch (action) {
      case "delete-device":
        if (d) {
          this.model.devices = this.model.devices.filter((x) => x.id !== d.id);
          this.selected = null;
          this.onChange();
          this.render();
        }
        break;
      case "delete-network":
        if (n) {
          this.model.networks = this.model.networks.filter((x) => x.id !== n.id);
          for (const dev of this.model.devices) dev.interfaces = dev.interfaces.filter((i) => i.network !== n.id);
          this.selected = null;
          this.onChange();
          this.render();
        }
        break;
      case "add-interface":
        if (d && this.model.networks[0]) {
          d.interfaces.push({ network: this.model.networks[0].id, ip: "", cidr: 24 });
          this.onChange();
          this.render();
        }
        break;
      case "remove-interface":
        if (d) {
          d.interfaces.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "add-static-route":
        if (d) {
          d.staticRoutes.push({ destination: "", via: "", iface: "", declareInFrr: false });
          this.onChange();
          this.render();
        }
        break;
      case "remove-static-route":
        if (d) {
          d.staticRoutes.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "add-neighbor":
        if (d) {
          d.routing.bgp.neighbors.push({
            ip: "",
            remoteAs: "",
            description: "",
            routeMapOut: false,
            metric: 20,
            routeMapOutMatch: "",
            routeMapIn: false,
            localPref: 150,
            routeMapInMatch: "",
            prefixListIn: { enabled: false, mode: "deny", prefixes: "" },
            prefixListOut: { enabled: false, mode: "deny", prefixes: "" },
          });
          this.onChange();
          this.render();
        }
        break;
      case "remove-neighbor":
        if (d) {
          d.routing.bgp.neighbors.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "detect-neighbors":
        if (d) {
          this._detectNeighbors(d);
          this.onChange();
          this.render();
        }
        break;
      case "add-delegation":
        if (d) {
          d.dns.delegations.push({ subdomain: "", nsName: "", nsIp: "" });
          this.onChange();
          this.render();
        }
        break;
      case "remove-delegation":
        if (d) {
          d.dns.delegations.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "detect-delegations":
        if (d) {
          this._detectDelegations(d);
          this.onChange();
          this.render();
        }
        break;
      case "add-record":
        if (d) {
          d.dns.records.push({ name: "", ip: "" });
          this.onChange();
          this.render();
        }
        break;
      case "remove-record":
        if (d) {
          d.dns.records.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "add-dnat":
        if (d) {
          d.nat.dnatRules.push({ destIp: "", proto: "tcp", dport: "", targets: [] });
          this.onChange();
          this.render();
        }
        break;
      case "remove-dnat":
        if (d) {
          d.nat.dnatRules.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "add-vtep-entry":
        if (d) {
          d.vtep.entries.push({ vni: "", vlan: "" });
          this.onChange();
          this.render();
        }
        break;
      case "remove-vtep-entry":
        if (d) {
          d.vtep.entries.splice(idx, 1);
          this.onChange();
          this.render();
        }
        break;
      case "toggle-vtep-trunk":
        if (d) {
          const set = new Set(parseCidrList(d.vtep.trunkIfaces));
          if (t.checked) set.add(String(idx));
          else set.delete(String(idx));
          d.vtep.trunkIfaces = [...set].join(", ");
          this.onChange();
        }
        break;
    }
  }

  _detectNeighbors(device) {
    const existing = new Set(device.routing.bgp.neighbors.map((n) => n.ip));
    for (const iface of device.interfaces) {
      const peers = peersOnNetwork(this.model, iface.network, device.id);
      for (const p of peers) {
        if (!p.iface.ip || existing.has(p.iface.ip)) continue;
        if (p.device.type !== "router" || !p.device.as) continue;
        const isIbgp = String(p.device.as) === String(device.as);
        device.routing.bgp.neighbors.push({
          ip: p.iface.ip,
          remoteAs: p.device.as,
          description: `Router ${p.device.name}${isIbgp ? " (iBGP)" : ""}`,
          routeMapOut: false,
          metric: 20,
          routeMapOutMatch: "",
          routeMapIn: false,
          localPref: 150,
          routeMapInMatch: "",
          prefixListIn: { enabled: false, mode: "deny", prefixes: "" },
          prefixListOut: { enabled: false, mode: "deny", prefixes: "" },
        });
        existing.add(p.iface.ip);
      }
    }
  }

  _detectDelegations(rootDevice) {
    const existing = new Set(rootDevice.dns.delegations.map((x) => x.subdomain));
    for (const dev of this.model.devices) {
      if (dev.dns.role === "authoritative" && dev.dns.zone && !existing.has(dev.dns.zone)) {
        rootDevice.dns.delegations.push({
          subdomain: dev.dns.zone,
          nsName: dev.dns.hostname,
          nsIp: dev.interfaces[0] ? dev.interfaces[0].ip : "",
        });
        existing.add(dev.dns.zone);
      }
    }
  }
}
