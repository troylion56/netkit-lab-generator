
let model = newModel();

const svg = document.getElementById("topologySvg");
const inspectorEl = document.getElementById("inspector");
const statusText = document.getElementById("statusText");
const labNameInput = document.getElementById("labNameInput");
const linkModeHint = document.getElementById("linkModeHint");
const presetSelect = document.getElementById("presetSelect");

function setStatus(msg) {
  statusText.textContent = msg;
}

const inspector = new Inspector(inspectorEl, model, () => {
  canvas.render();
  setStatus("Modifiche salvate nel modello locale (non ancora esportate).");
});

const canvas = new TopologyCanvas(svg, model, {
  onSelect: (sel) => inspector.show(sel),
  onChange: () => setStatus("Modifiche salvate nel modello locale (non ancora esportate)."),
});

function loadModel(newM) {
  model = newM;
  labNameInput.value = model.labName || "lab";
  canvas.setModel(model);
  inspector.setModel(model);
  inspector.show(null);
  canvas.render();
}

// ---- toolbar wiring ----

document.getElementById("btnAddRouter").addEventListener("click", () => {
  const d = newDevice("router");
  d.x = 120 + Math.random() * 200;
  d.y = 120 + Math.random() * 200;
  model.devices.push(d);
  canvas.render();
  canvas.select("device", d.id);
  setStatus(`Router "${d.name}" aggiunto.`);
});

document.getElementById("btnAddHost").addEventListener("click", () => {
  const d = newDevice("host");
  d.x = 120 + Math.random() * 200;
  d.y = 120 + Math.random() * 200;
  model.devices.push(d);
  canvas.render();
  canvas.select("device", d.id);
  setStatus(`Host "${d.name}" aggiunto.`);
});

document.getElementById("btnAddNetwork").addEventListener("click", () => {
  const n = newNetwork();
  n.x = 300 + Math.random() * 200;
  n.y = 300 + Math.random() * 200;
  model.networks.push(n);
  canvas.render();
  canvas.select("network", n.id);
  setStatus(`Rete "${n.name}" aggiunta.`);
});

const btnLinkMode = document.getElementById("btnLinkMode");
btnLinkMode.addEventListener("click", () => {
  const on = !btnLinkMode.classList.contains("active");
  btnLinkMode.classList.toggle("active", on);
  linkModeHint.classList.toggle("hidden", !on);
  canvas.setLinkMode(on);
  setStatus(on ? "Modalità collegamento attiva." : "Modalità collegamento disattivata.");
});

document.getElementById("btnDelete").addEventListener("click", () => {
  canvas.deleteSelected();
  inspector.show(null);
  setStatus("Elemento eliminato.");
});

labNameInput.addEventListener("input", () => {
  model.labName = labNameInput.value.trim() || "lab";
});

document.getElementById("btnNew").addEventListener("click", () => {
  if (!confirm("Creare un nuovo laboratorio vuoto? Le modifiche non salvate andranno perse.")) return;
  loadModel(newModel());
  setStatus("Nuovo laboratorio vuoto creato.");
});

for (const [key, preset] of Object.entries(PRESETS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = preset.label;
  presetSelect.appendChild(opt);
}
presetSelect.addEventListener("change", () => {
  const key = presetSelect.value;
  if (!key) return;
  if (!confirm("Caricare l'esempio? Le modifiche non salvate andranno perse.")) {
    presetSelect.value = "";
    return;
  }
  loadModel(PRESETS[key].build());
  presetSelect.value = "";
  setStatus(`Esempio "${PRESETS[key].label}" caricato.`);
});

document.getElementById("btnSaveJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${model.labName || "lab"}.json`);
  setStatus("Topologia salvata come JSON.");
});

document.getElementById("loadJsonInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    loadModel(parsed);
    setStatus(`Topologia caricata da ${file.name}.`);
  } catch (err) {
    alert("File JSON non valido: " + err.message);
  }
  e.target.value = "";
});

document.getElementById("btnExportZip").addEventListener("click", () => {
  try {
    const errors = validateModel(model);
    if (errors.length) {
      alert("Attenzione, alcuni problemi rilevati:\n\n" + errors.join("\n") + "\n\nIl file verrà comunque generato.");
    }
    const files = generateFiles(model);
    const zip = new ZipWriter();
    for (const [path, content] of Object.entries(files)) zip.file(path, content);
    const blob = zip.generateBlob();
    downloadBlob(blob, `${model.labName || "lab"}.zip`);
    setStatus(`Lab generato: ${Object.keys(files).length} file in ${model.labName}.zip`);
  } catch (err) {
    console.error(err);
    alert("Errore durante la generazione: " + err.message);
  }
});

function validateModel(m) {
  const errors = [];
  const names = new Set();
  for (const d of m.devices) {
    if (!d.name || !/^[a-z][a-z0-9_-]*$/i.test(d.name)) errors.push(`Nome dispositivo non valido: "${d.name}"`);
    if (names.has(d.name)) errors.push(`Nome dispositivo duplicato: "${d.name}"`);
    names.add(d.name);
    if (!d.interfaces.length) errors.push(`"${d.name}" non ha interfacce collegate.`);
    for (const iface of d.interfaces) {
      if (iface.ip && !/^\d{1,3}(\.\d{1,3}){3}$/.test(iface.ip)) errors.push(`IP non valido su "${d.name}": ${iface.ip}`);
    }
    if (d.routing.bgp.enabled && !d.as) errors.push(`"${d.name}" ha BGP attivo ma nessun AS impostato.`);
  }
  const netNames = new Set();
  for (const n of m.networks) {
    if (netNames.has(n.name)) errors.push(`Nome rete duplicato: "${n.name}"`);
    netNames.add(n.name);
  }
  return errors;
}

// initial state: empty canvas, ready to use
loadModel(model);
setStatus("Pronto. Aggiungi dispositivi e reti, oppure carica l'esempio Palabra dal menu in alto.");
