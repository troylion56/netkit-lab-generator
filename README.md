# Kathara Lab Generator (IDC)

Editor visuale per costruire topologie di rete e generare automaticamente tutti
i file di un laboratorio [Kathara](https://www.kathara.org/) (lab.conf, `.startup`,
`etc/frr/*`, `etc/bind/*`, `resolv.conf`, regole NAT/iptables...), sullo stile di
[Netkit Lab Generator](https://github.com/KatharaFramework/Netkit-Lab-Generator)
ma aggiornato alle convenzioni usate negli esami IDC (FRR al posto di Quagga).

Nessuna installazione richiesta: è un'app statica (HTML/CSS/JS puro, nessuna
dipendenza esterna, nessun bundler, nessun modulo ES6). Funziona su
Windows/Linux/macOS aprendo semplicemente `index.html` con doppio click nel
browser — anche su un PC nuovo senza nulla installato (niente Python, Node o
server locale richiesto). In alternativa puoi comunque servirla con un server
statico qualsiasi (es. `python -m http.server 8934` dentro `netkit-lab-generator`),
ma non è necessario.

## Come si usa

1. **Aggiungi dispositivi e reti** con i pulsanti `+ Router`, `+ Host`, `+ Rete`
   in alto. Trascina i nodi sulla mappa per posizionarli.
2. **Collega**: attiva il pulsante "🔗 Collega", poi clicca prima un
   dispositivo e poi una rete (o viceversa) per creare un'interfaccia. Ripeti
   per collegare più dispositivi alla stessa rete (dominio di collisione).
3. **Configura**: seleziona un dispositivo per aprire il pannello a destra e
   imposta IP delle interfacce, rotte statiche/di default, protocolli di
   routing (RIP, OSPF, BGP), ruolo DNS (root / autoritativo / resolver), NAT
   e port-forwarding. Le spunte abilitano/disabilitano le sezioni corrispondenti.
4. **Genera**: clicca "⬇ Genera lab (.zip)" per scaricare l'intera cartella
   del laboratorio, pronta per essere estratta e lanciata con `kathara lstart`.

Usa il menu "Esempio" per caricare una topologia già configurata: un ottimo
punto di partenza per capire come si compila il pannello delle proprietà. I
file generati da tutti gli esempi sono stati verificati riga per riga contro
la soluzione ufficiale dell'esame corrispondente:

- **Palabra** (2023-12-18): BGP + RIP + DNS (root/autoritativo/resolver)
- **Patchwork** (2024-01-22): fabric datacenter spine/leaf con BGP unnumbered
  ed EVPN/VXLAN, bridge L2 di accesso, OSPF + RIP + BGP con policy di
  local-preference, DNS, web server
- **Desconocida** (2023-11-27): RIP + BGP su più AS con filtri di prefisso
  (`ip prefix-list` con `deny`) per bloccare in modo permanente l'instradamento
  di un prefisso su un link specifico
- **Incognita** (2023-11-27): RIP + BGP su tre AS multi-homed, con **iBGP tra i
  due border router dello stesso AS** (vicino con lo stesso AS del router,
  sull'indirizzo del link condiviso) oltre alle sessioni eBGP verso gli altri
  AS, e filtri di prefisso per impedire in modo permanente che un prefisso
  specifico passi da un secondo link ridondante
- **Falling Asleep** (2022-11-12): RIP + OSPF con una rotta statica dichiarata
  in frr.conf e redistribuita in OSPF, e un annuncio forzato in RIP
- **Clouds** (2022-11-04): OSPF multi-area con backbone + tre aree stub,
  costo per interfaccia, network statement aggregati su supernet
- **T2C1** (2021-11-29): OSPF interno ad AS1 (3 router) + eBGP a catena tra
  6 AS a router singolo, con `redistribute bgp` in OSPF
- **Red Baron** (2020-12-18): eBGP con policy cliente/provider/peer — prefix-list
  in modalità "consenti solo elencati" per non fare da transito gratuito tra
  due provider/peer
- **Pear to Pear** (2022-11-28): stesso scenario cliente/provider/peer, ma con
  un router che mischia entrambe le modalità di filtro (blocca/consenti) sui
  suoi tre vicini con relazioni diverse
- **Butterfly** (2013-12-20): AS con RIP interno senza iBGP (route learned via
  RIP announced individually in BGP), e traffic engineering per-singolo-prefisso
  con route-map + access-list (`match ip address`), per instradare reti diverse
  su link diversi senza toccare le altre rotte dello stesso vicino
- **Garden Umbrella** (2013-12-20): blocco totale di un vicino su un link
  (filtro "blocca elencati" con `any` come prefisso, cioè `deny any`) e lo
  stesso traffic engineering per-prefisso di Butterfly su due percorsi
  ridondanti
- **Butterfly 2017** (2017-11-24): RIP e OSPF collegati da rotte statiche
  shell (non dichiarate in frr.conf); il lato RIP le inietta con la direttiva
  `route`, il lato OSPF con `redistribute kernel` (diverso da `redistribute
  static`, che richiede invece che la rotta sia dichiarata "in frr.conf")
- **Exapus** (2024-01-15): come Patchwork ma con **tre tenant (VNI/VLAN)
  condivisi sugli stessi leaf e switch di accesso** — bridge e VTEP con più
  VLAN contemporaneamente, porte trunk (tutte le VLAN) o di accesso (una sola)

Il pulsante "Salva JSON" / "Carica JSON" permette di salvare la topologia e
riprendere il lavoro in un secondo momento (non è il lab già generato, ma il
progetto editabile).

## Cosa FUNZIONA

- Indirizzamento IP per interfaccia, rotte statiche e rotta di default. Una
  rotta statica può essere dichiarata "in frr.conf" (una riga globale `ip
  route`, di proprietà di zebra) invece che come comando shell, così da poter
  essere ripresa da "redistribute static" su RIP/OSPF/BGP — per una rotta
  statica shell (non dichiarata in frr.conf) usa invece "redistribute kernel",
  disponibile su tutti e tre i protocolli
- RIP (redistribute connected/bgp/ospf/static/kernel, più annunci forzati con
  la direttiva `route <cidr>`, indipendenti dalla tabella di routing)
- OSPF (area e costo per interfaccia, redistribute, aree stub con `area <id>
  stub`, network statement manuali per accorpare più subnet in una supernet)
- BGP standard (vicini iBGP/eBGP, reti annunciate, route-map per preferenze
  di **MED in uscita** o di **local-preference in entrata**, pulsante "Rileva
  vicini dai collegamenti" che propone automaticamente i vicini in base ai
  dispositivi collegati e al loro AS). Ogni route-map può opzionalmente
  restringere l'effetto a **prefissi specifici** (campo "solo per prefissi",
  genera un `access-list` + `match ip address`) invece che a tutte le rotte
  del vicino — utile per instradare reti diverse su link diversi
- Filtri di prefisso per vicino BGP (`ip prefix-list`, in entrata e/o in
  uscita), in due modalità: **"blocca elencati"** (`deny` sui prefissi
  indicati + `permit any` finale, per bloccare del tutto un prefisso su un
  link anche come backup) o **"consenti solo elencati"** (solo `permit` sui
  prefissi indicati, tutto il resto è implicitamente negato — per le policy
  cliente/provider/peer: non ri-annunciare a un provider/peer le rotte
  imparate da un altro provider/peer. Scrivi `any` come prefisso per un
  "permit any" incondizionato verso i clienti)
- BGP "fabric": peering **unnumbered** su interfaccia (peer-group "TOR",
  tipico di una fabric spine/leaf), con address-family `l2vpn evpn` — genera
  `etc/frr/bgpd.conf` al posto del frr.conf integrato
- **VTEP VXLAN** (loopback + una o più interfacce vxlan/tenant + bridge
  condiviso, ruolo leaf in una fabric EVPN — supporta più VNI/VLAN
  contemporaneamente sullo stesso leaf) e **bridge L2 di accesso** (uno
  switch con una VLAN o più: ogni porta è trunk, oppure di accesso/untagged
  per una singola VLAN, così più tenant possono condividere lo stesso switch)
- Immagine Kathara per dispositivo (`[image]="kathara/frr"`, ecc.) e altre
  direttive extra di `lab.conf` (es. `[sysctl]=...`, `[ipv6]=True`)
- DNS con bind9: root server, server autoritativo per una zona (con record
  aggiuntivi), resolver ricorsivo (con `allow-recursion` su un CIDR a scelta),
  client con `resolv.conf`. Le identità dei root server vengono rilevate
  automaticamente se lasci vuoti i campi corrispondenti.
- NAT/MASQUERADE e regole DNAT (anche con più target per il load balancing,
  come negli esercizi con `--match statistic --mode random`)
- Web server (Apache): genera `var/www/html/index.html` e l'avvio del servizio

## Cosa NON funziona

Non è (e non vuole essere) coperto da un form strutturato dedicato:

- **IPv6**: puoi attivare `[ipv6]=True` in lab.conf dal campo "direttive
  extra", ma non c'è un form per indirizzi/rotte/vicini IPv6 — vanno scritti
  a mano in "comandi extra" / "frr.conf extra"
- **STP** e altre feature avanzate dei bridge L2 (solo VLAN trunk/access sono
  supportate nel form; spanning-tree, bonding, ecc. no)
- **SDN/OpenFlow**, controller esterni, Open vSwitch avanzato
- **MPLS**, L3VPN/L2VPN (a parte l'EVPN/VXLAN "fabric" già supportato)
- **VRRP/HSRP/keepalived** e altri meccanismi di alta affidabilità
- **DHCP** (server o client)
- **Routing multicast** (PIM, IGMP)
- **IPSec/VPN** tunnel
- **QoS/traffic shaping** (`tc`, ecc.) e tuning kernel oltre ai semplici
  `sysctl` in lab.conf
- Demoni di routing diversi da FRR (Quagga, BIRD, ecc.) o immagini Kathara
  diverse da quelle standard con software aggiuntivo preinstallato
- Qualunque scenario "one-off" molto specifico di un singolo esame che non
  rientri nei pattern sopra

Per tutto questo, ogni dispositivo ha due caselle di testo libero pensate
apposta per non dover modificare il generatore:

- **Comandi extra (.startup)**: righe di shell aggiunte in coda allo startup
  (prima dell'avvio dei servizi) — usale per qualunque comando non coperto
  dai controlli sopra.
- **frr.conf extra**: righe aggiunte in coda alla configurazione FRR — usale
  per route-map avanzate, prefix-list, IS-IS, ecc. (solo in modalità BGP
  standard: in modalità "fabric" il dispositivo usa `bgpd.conf` invece di
  `frr.conf`).

In questo modo qualunque comando visto a lezione può comunque essere inserito
senza dover modificare il generatore — ma non c'è un pulsante dedicato con
validazione per queste funzionalità: vanno scritte a mano, come faresti in
uno startup Kathara normale.

## Struttura del codice

- `js/model.js` — modello dati e funzioni di supporto per IP/CIDR
- `js/generator.js` — traduce il modello nei file Kathara (lab.conf, startup,
  frr.conf/daemons, bind9, resolv.conf, iptables)
- `js/canvas.js` — editor SVG drag&drop della topologia
- `js/inspector.js` — pannello delle proprietà
- `js/zip.js` — writer ZIP client-side (nessuna libreria esterna)
- `js/presets.js` — esempi precaricati (Palabra, Patchwork, Desconocida, Incognita, Falling Asleep, Clouds, T2C1, Red Baron, Pear to Pear, Butterfly, Garden Umbrella, Butterfly 2017, Exapus)
