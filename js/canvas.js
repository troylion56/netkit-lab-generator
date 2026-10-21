// SVG-based drag & drop topology editor.


const SVG_NS = "http://www.w3.org/2000/svg";

class TopologyCanvas {
  constructor(svgEl, model, opts) {
    this.svg = svgEl;
    this.model = model;
    this.onSelect = opts.onSelect || (() => {});
    this.onChange = opts.onChange || (() => {});
    this.selected = null; // { kind: 'device'|'network', id }
    this.linkMode = false;
    this.linkSource = null;
    this.drag = null; // { kind, id, startX, startY, moved }

    this.svg.addEventListener("mousedown", this._onMouseDown.bind(this));
    window.addEventListener("mousemove", this._onMouseMove.bind(this));
    window.addEventListener("mouseup", this._onMouseUp.bind(this));
    window.addEventListener("keydown", this._onKeyDown.bind(this));
  }

  setModel(model) {
    this.model = model;
    this.selected = null;
    this.render();
  }

  setLinkMode(on) {
    this.linkMode = on;
    this.linkSource = null;
    this.render();
  }

  select(kind, id) {
    this.selected = kind ? { kind, id } : null;
    this.render();
    this.onSelect(this.selected);
  }

  deleteSelected() {
    if (!this.selected) return;
    if (this.selected.kind === "device") {
      this.model.devices = this.model.devices.filter((d) => d.id !== this.selected.id);
    } else if (this.selected.kind === "network") {
      this.model.networks = this.model.networks.filter((n) => n.id !== this.selected.id);
      for (const d of this.model.devices) {
        d.interfaces = d.interfaces.filter((i) => i.network !== this.selected.id);
      }
    }
    this.selected = null;
    this.render();
    this.onChange();
    this.onSelect(null);
  }

  _svgPoint(evt) {
    const rect = this.svg.getBoundingClientRect();
    const vb = this.svg.viewBox.baseVal;
    const x = ((evt.clientX - rect.left) / rect.width) * vb.width + vb.x;
    const y = ((evt.clientY - rect.top) / rect.height) * vb.height + vb.y;
    return { x, y };
  }

  _onMouseDown(evt) {
    const target = evt.target.closest("[data-kind]");
    if (!target) {
      this.select(null);
      return;
    }
    const kind = target.getAttribute("data-kind");
    const id = target.getAttribute("data-id");

    if (this.linkMode) {
      this._handleLinkClick(kind, id);
      return;
    }

    this.select(kind, id);
    const pos = this._svgPoint(evt);
    const obj = kind === "device" ? findDevice(this.model, id) : findNetwork(this.model, id);
    this.drag = { kind, id, offsetX: pos.x - obj.x, offsetY: pos.y - obj.y, moved: false };
  }

  _onMouseMove(evt) {
    if (!this.drag) return;
    const pos = this._svgPoint(evt);
    const obj = this.drag.kind === "device" ? findDevice(this.model, this.drag.id) : findNetwork(this.model, this.drag.id);
    if (!obj) return;
    obj.x = Math.round(pos.x - this.drag.offsetX);
    obj.y = Math.round(pos.y - this.drag.offsetY);
    this.drag.moved = true;
    this.render();
  }

  _onMouseUp() {
    if (this.drag && this.drag.moved) this.onChange();
    this.drag = null;
  }

  _onKeyDown(evt) {
    if ((evt.key === "Delete" || evt.key === "Backspace") && this.selected) {
      const activeTag = document.activeElement && document.activeElement.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
      evt.preventDefault();
      this.deleteSelected();
    }
    if (evt.key === "Escape" && this.linkMode) {
      this.linkSource = null;
      this.render();
    }
  }

  _handleLinkClick(kind, id) {
    if (!this.linkSource) {
      this.linkSource = { kind, id };
      this.render();
      return;
    }
    const a = this.linkSource;
    const b = { kind, id };
    if (a.kind === b.kind) {
      // same kind clicked twice: restart selection from the new one
      this.linkSource = b;
      this.render();
      return;
    }
    const device = a.kind === "device" ? findDevice(this.model, a.id) : findDevice(this.model, b.id);
    const network = a.kind === "network" ? findNetwork(this.model, a.id) : findNetwork(this.model, b.id);
    this.linkSource = null;
    if (device && network) {
      if (!device.interfaces.some((i) => i.network === network.id)) {
        device.interfaces.push({ network: network.id, ip: "", cidr: 24 });
        this.onChange();
      }
      // Select the device so its new interface (IP entry) is immediately visible,
      // and so an already-open panel (e.g. the network we just linked) doesn't go stale.
      this.select("device", device.id);
      return;
    }
    this.render();
  }

  render() {
    const svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const edgesLayer = document.createElementNS(SVG_NS, "g");
    const nodesLayer = document.createElementNS(SVG_NS, "g");
    svg.appendChild(edgesLayer);
    svg.appendChild(nodesLayer);

    // edges
    for (const d of this.model.devices) {
      d.interfaces.forEach((iface, idx) => {
        const net = findNetwork(this.model, iface.network);
        if (!net) return;
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", d.x);
        line.setAttribute("y1", d.y);
        line.setAttribute("x2", net.x);
        line.setAttribute("y2", net.y);
        line.setAttribute("class", "edge");
        edgesLayer.appendChild(line);

        const mx = d.x + (net.x - d.x) * 0.28;
        const my = d.y + (net.y - d.y) * 0.28;
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", mx);
        label.setAttribute("y", my);
        label.setAttribute("class", "edge-label");
        label.textContent = `eth${idx}${iface.ip ? " " + iface.ip + "/" + iface.cidr : ""}`;
        edgesLayer.appendChild(label);
      });
    }

    // link-mode preview line
    if (this.linkMode && this.linkSource) {
      const src =
        this.linkSource.kind === "device" ? findDevice(this.model, this.linkSource.id) : findNetwork(this.model, this.linkSource.id);
      if (src) {
        const g = document.createElementNS(SVG_NS, "circle");
        g.setAttribute("cx", src.x);
        g.setAttribute("cy", src.y);
        g.setAttribute("r", 26);
        g.setAttribute("class", "link-source-ring");
        nodesLayer.appendChild(g);
      }
    }

    // networks
    for (const net of this.model.networks) {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("data-kind", "network");
      g.setAttribute("data-id", net.id);
      g.setAttribute("class", "node network" + (this._isSelected("network", net.id) ? " selected" : ""));
      const ell = document.createElementNS(SVG_NS, "ellipse");
      ell.setAttribute("cx", net.x);
      ell.setAttribute("cy", net.y);
      ell.setAttribute("rx", 44);
      ell.setAttribute("ry", 28);
      g.appendChild(ell);
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", net.x);
      text.setAttribute("y", net.y + 5);
      text.setAttribute("text-anchor", "middle");
      text.textContent = net.name;
      g.appendChild(text);
      nodesLayer.appendChild(g);
    }

    // devices
    for (const d of this.model.devices) {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("data-kind", "device");
      g.setAttribute("data-id", d.id);
      g.setAttribute("class", "node device " + d.type + (this._isSelected("device", d.id) ? " selected" : ""));
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", d.x - 34);
      rect.setAttribute("y", d.y - 22);
      rect.setAttribute("width", 68);
      rect.setAttribute("height", 44);
      rect.setAttribute("rx", d.type === "router" ? 22 : 6);
      g.appendChild(rect);
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", d.x);
      text.setAttribute("y", d.y + 4);
      text.setAttribute("text-anchor", "middle");
      text.textContent = d.name;
      g.appendChild(text);
      if (d.as) {
        const asText = document.createElementNS(SVG_NS, "text");
        asText.setAttribute("x", d.x);
        asText.setAttribute("y", d.y - 28);
        asText.setAttribute("text-anchor", "middle");
        asText.setAttribute("class", "as-label");
        asText.textContent = `AS${d.as}`;
        g.appendChild(asText);
      }
      const badges = [];
      if (d.routing.rip.enabled) badges.push("RIP");
      if (d.routing.ospf.enabled) badges.push("OSPF");
      if (d.routing.bgp.enabled) badges.push("BGP");
      if (d.dns.role !== "none") badges.push("DNS:" + d.dns.role);
      if (d.nat.enabled) badges.push("NAT");
      if (badges.length) {
        const badgeText = document.createElementNS(SVG_NS, "text");
        badgeText.setAttribute("x", d.x);
        badgeText.setAttribute("y", d.y + 34);
        badgeText.setAttribute("text-anchor", "middle");
        badgeText.setAttribute("class", "badge-label");
        badgeText.textContent = badges.join(" · ");
        g.appendChild(badgeText);
      }
      nodesLayer.appendChild(g);
    }
  }

  _isSelected(kind, id) {
    return this.selected && this.selected.kind === kind && this.selected.id === id;
  }
}
