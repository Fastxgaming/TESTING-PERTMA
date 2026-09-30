        // ===== KAPAL: MESIN STATUS + BAHAN BAKAR + KEAUSAN MESIN (Tahap 3) & DERMAGA + ANTREAN LABUH (Tahap 4) =====
        // Dimuat setelah 07a-rute-laut.js. Dipakai oleh animateKapalTransfer (07-animasi-kapal.js) dan
        // animateHuluTransfer (11-hulu-upstream.js) lewat fungsi shipDepart / shipSail / shipCallAt / shipReturnHome.
        //
        // MESIN STATUS (satu kapal selalu tepat di SATU status; transisi di luar tabel SHIP_ST.to dicatat ke konsol):
        //   standby -> [servis ->] [queue ->] loading -> unberthing -> sailing -> [queue ->] berthing -> unloading
        //   -> unberthing -> sailing -> [queue ->] berthing -> [servis ->] standby
        // Status hanya ada di memori (shipRt), tidak masuk save - sama seperti busyIds: kapal selalu mulai standby saat game dimuat.
        // Yang DISIMPAN di objek kapal: fuelL (liter di tangki), banPct (= kondisi mesin, dipakai tab Armada), odometer.
        //
        // DERMAGA: dikunci per NODE dermaga (field `berth`, satu sumber data dari Tahap 1), bukan per depo -
        // dua depo yang berbagi satu node (mis. TBBM Perak & Depo LPG Gresik = SBb) memakai dermaga fisik yang sama.
        // Slot dipakai saat muat, sandar, bongkar, dan lepas sandar. Kapal yang parkir (standby) menambat di luar dermaga kerja,
        // jadi tidak menghabiskan slot. Antrean labuh = FIFO per dermaga.
        const SHIP_ST = {
            standby:    { label: 'Standby (tambat)', icon: 'fa-anchor',           cls: 'text-emerald-400', to: ['queue', 'loading', 'servis'] },
            queue:      { label: 'Antre labuh',      icon: 'fa-hourglass-half',   cls: 'text-amber-400',   to: ['loading', 'berthing'] },
            loading:    { label: 'Muat di dermaga',  icon: 'fa-arrow-up-from-bracket', cls: 'text-sky-400', to: ['unberthing'] },
            unberthing: { label: 'Lepas sandar',     icon: 'fa-water',            cls: 'text-cyan-300',    to: ['sailing'] },
            sailing:    { label: 'Berlayar',         icon: 'fa-ship',             cls: 'text-cyan-400',    to: ['queue', 'berthing'] },
            berthing:   { label: 'Sandar',           icon: 'fa-anchor-circle-check', cls: 'text-teal-300', to: ['unloading', 'servis', 'standby'] },
            unloading:  { label: 'Bongkar muatan',   icon: 'fa-arrow-down-to-bracket', cls: 'text-sky-300', to: ['unberthing'] },
            servis:     { label: 'Servis mesin',     icon: 'fa-screwdriver-wrench', cls: 'text-orange-400', to: ['standby'] }
        };

        // ---- Waktu (detik NYATA, ikut berhenti saat game dijeda karena memakai pausableDelay) ----
        const SHIP_LOAD_SEC = 20, SHIP_UNBERTH_SEC = 8, SHIP_BERTH_SEC = 6, SHIP_SERVICE_SEC = 30;
        // ---- Bahan bakar (MGO/marine diesel non-subsidi) ----
        const HARGA_BBM_KAPAL = 14000;   // Rp/liter
        const SHIP_TANK_KM = 3000;       // tangki muat sejauh ±3.000 km pelayaran penuh
        const SHIP_FUEL_RESERVE = 1.15;  // bunker = kebutuhan pergi-pulang + cadangan 15%
        const SHIP_IDLE_FRAC = 0.10;     // mesin menyala saat antre labuh / ditahan cuaca = 10% konsumsi jelajah
        // Konsumsi liter per km menurut kelas kapal (dari harga beli): kecil, sedang, besar, raksasa.
        const SHIP_TIER = [
            { maxPrice: 20e9,     burn: 35,  nama: 'Kecil' },
            { maxPrice: 110e9,    burn: 70,  nama: 'Sedang' },
            { maxPrice: 310e9,    burn: 100, nama: 'Besar' },
            { maxPrice: Infinity, burn: 130, nama: 'Raksasa' }
        ];
        // ---- Keausan mesin: banPct pada kapal = KONDISI MESIN (tab Armada menampilkannya begitu) ----
        const SHIP_WEAR_PER_KM = 100 / 12000; // 0% tiap ±12.000 km pelayaran
        const SHIP_SERVICE_AT = 30;           // servis otomatis di dermaga bila kondisi <= 30%
        const SHIP_SERVICE_RATE = 0.015;      // biaya servis = 1,5% harga kapal
        // Mesin aus makin boros (maks +30% BBM) dan makin lambat (maks -15% kecepatan) pada kondisi 0%.
        const shipCond = t => Math.max(0, Math.min(100, t.banPct == null ? 100 : t.banPct));
        const shipFuelMult = t => 1 + 0.30 * (100 - shipCond(t)) / 100;
        const shipSpeedKmh = t => AVG_SHIP_SPEED_KMH * (1 - 0.15 * (100 - shipCond(t)) / 100);
        function shipSpec(t) {
            const p = t.price || 10e9, tier = SHIP_TIER.find(x => p <= x.maxPrice);
            return { burn: tier.burn, tank: tier.burn * SHIP_TANK_KM, tier: tier.nama };
        }
        function shipEnsure(t) {
            if (!t || t.kelas !== 'kapal') return t;
            if (typeof t.fuelL !== 'number' || !isFinite(t.fuelL)) t.fuelL = 0;
            if (typeof t.odometer !== 'number') t.odometer = 0;
            if (typeof t.banPct !== 'number') t.banPct = 100;
            return t;
        }
        const shipServiceCost = t => Math.max(5e6, Math.round((t.price || 10e9) * SHIP_SERVICE_RATE / 1e6) * 1e6);

        // ---- Status runtime ----
        const shipRt = new Map();
        function shipRtOf(id) {
            let r = shipRt.get(id);
            if (!r) { r = { state: 'standby', since: vNow(), at: null, node: null }; shipRt.set(id, r); }
            return r;
        }
        function shipSetState(ship, next, info) {
            const r = shipRtOf(ship.id), cur = r.state;
            if (cur !== next && !SHIP_ST[cur].to.includes(next)) console.error(`[kapal] transisi tidak sah ${ship.id}: ${cur} -> ${next}`);
            r.state = next; r.since = vNow();
            if (info) Object.assign(r, info);
            shipRefreshMarker(ship.id);
            shipStageSync(ship, next, r);
            shipUiSoon();
        }
        // Lencana kecil di bawah ikon kapal (tanpa perlu ikon ditekan): ANTRE LABUH / MEMUAT / LEPAS SANDAR / SANDAR /
        // BONGKAR / SERVIS + hitung mundur. Berlayar & standby = tanpa lencana. Mesin lencananya ada di 07-animasi-kapal.js.
        function shipStageSync(ship, st, r) {
            if (typeof setTruckStage !== 'function') return;
            const M = {
                queue:      { txt: 'ANTRE LABUH', kind: 'antre' },
                loading:    { txt: 'MEMUAT', kind: 'muat', sec: SHIP_LOAD_SEC },
                unberthing: { txt: 'LEPAS SANDAR', kind: 'lepas', sec: SHIP_UNBERTH_SEC },
                berthing:   { txt: 'SANDAR', kind: 'sandar', sec: SHIP_BERTH_SEC },
                unloading:  { txt: 'BONGKAR', kind: 'bongkar', sec: r.sec || UNLOAD_SECONDS_KAPAL },
                servis:     { txt: 'SERVIS', kind: 'servis', sec: SHIP_SERVICE_SEC }
            };
            const m = M[st];
            if (!m) { clearTruckStage(ship.id); return; }
            let ll = shipParkLL(ship.id) || r.ll;
            if (!ll) { const h = stageHostMarker(ship.id); if (h) { const p = h.getLatLng(); ll = [p.lat, p.lng]; } }
            if (!ll) return;
            setTruckStage(ship.id, m.txt, m.kind, m.sec == null ? null : m.sec, ll, '#06b6d4', true);
        }
        const shipStateLabel = id => { const r = shipRtOf(id); return SHIP_ST[r.state].label + (r.at ? ' · ' + r.at : ''); };
        // Kapal dianggap "selesai misi" (dipanggil di catch/finally): lepas semua slot & antrean, kembali standby.
        function shipAbort(ship) {
            berthPurge(ship.id);
            const r = shipRtOf(ship.id);
            if (r.state !== 'standby') { r.state = 'standby'; r.since = vNow(); r.node = null; r.at = null; }
            if (typeof clearTruckStage === 'function') clearTruckStage(ship.id);
            shipRefreshMarker(ship.id); shipUiSoon();
        }

        // ---- Rencana pelayaran: bahan bakar, biaya bunker, servis ----
        // from = tempat muat (sekaligus pangkalan pulang), to = tujuan bongkar. Kembalikan {err} bila tidak layak.
        function shipPlan(ship, from, to) {
            shipEnsure(ship);
            const r = seaRoute(from, to);
            if (!r) return { err: `Tidak ada lajur laut dari ${from.nama} ke ${to.nama}.` };
            const sp = shipSpec(ship), mult = shipFuelMult(ship), km = r.km * 2;
            const needL = Math.ceil(km * sp.burn * mult * SHIP_FUEL_RESERVE);
            if (needL > sp.tank) return { err: `Pelayaran pergi-pulang ±${Math.round(km)} km melebihi jangkauan tangki ${ship.id} (${fmtN(sp.tank)} L).` };
            const bunkerL = Math.max(0, needL - Math.floor(ship.fuelL));
            const bunkerCost = bunkerL * HARGA_BBM_KAPAL;
            const svcCost = shipCond(ship) <= SHIP_SERVICE_AT ? shipServiceCost(ship) : 0;
            return { km, oneWayKm: r.km, needL, bunkerL, bunkerCost, svcCost, cost: bunkerCost + svcCost, speed: shipSpeedKmh(ship), burn: sp.burn, mult };
        }
        // Isi tangki sampai cukup untuk pergi-pulang (dipanggil saat Surat Jalan ditandatangani / konfirmasi berangkat).
        function shipBunker(ship, plan) {
            if (!plan || plan.err || companyCash < plan.cost) return false;
            if (plan.bunkerL > 0) {
                ship.fuelL = Math.round((ship.fuelL + plan.bunkerL) * 10) / 10;
                companyCash -= plan.bunkerCost; totalExpense += plan.bunkerCost;
                addFinanceLog(`Bunker MGO kapal ${ship.id} (${fmtN(plan.bunkerL)} L @ ${formatRupiah(HARGA_BBM_KAPAL)})`, -plan.bunkerCost);
                addLog(`BUNKER: ${ship.id} mengisi ${fmtN(plan.bunkerL)} L solar laut (${formatRupiah(plan.bunkerCost)}) untuk pelayaran pergi-pulang ±${Math.round(plan.km)} km.`, 'info', 'truck');
                updateCashDisplay();
            }
            return true;
        }
        function shipPlanText(plan) {
            return `bunker ${fmtN(plan.bunkerL)} L = ${formatRupiah(plan.bunkerCost)}${plan.svcCost ? ' + servis mesin ' + formatRupiah(plan.svcCost) : ''}`;
        }
        // Konsumsi & keausan untuk satu ruas pelayaran yang sudah selesai (dipanggil dari shipSail).
        function shipApplyLeg(ship, km, mult, stallMs) {
            const sp = shipSpec(ship), speed = shipSpeedKmh(ship);
            const idleL = (stallMs || 0) * GAME_SPEED / 3600000 * speed * sp.burn * mult * SHIP_IDLE_FRAC; // ditahan cuaca: mesin tetap menyala
            const burnL = km * sp.burn * mult + idleL;
            ship.fuelL = Math.max(0, Math.round((ship.fuelL - burnL) * 10) / 10);
            ship.odometer = Math.round((ship.odometer + km) * 10) / 10;
            ship.banPct = Math.max(0, Math.round((shipCond(ship) - km * SHIP_WEAR_PER_KM) * 10) / 10);
            return burnL;
        }
        function shipIdleBurn(ship, waitMs) {
            if (!(waitMs > 0)) return 0;
            const sp = shipSpec(ship), L = waitMs * GAME_SPEED / 3600000 * shipSpeedKmh(ship) * sp.burn * shipFuelMult(ship) * SHIP_IDLE_FRAC;
            ship.fuelL = Math.max(0, Math.round((ship.fuelL - L) * 10) / 10);
            return L;
        }

        // ================= DERMAGA & ANTREAN LABUH (Tahap 4) =================
        // Jumlah slot sandar per NODE dermaga. Default 1. Ubah/tambah di sini kalau ingin dermaga lebih besar.
        const BERTH_SLOTS = { TBb: 2, SBb: 2 };   // Kilang Tuban (pusat) & Surabaya/Gresik = 2 slot
        const berthSlots = node => BERTH_SLOTS[node] || 1;
        const berths = new Map();                 // node -> { using: Map(shipId -> {purpose, since}), queue: [waiter] }
        const berthOf = node => { let b = berths.get(node); if (!b) { b = { using: new Map(), queue: [] }; berths.set(node, b); } return b; };
        const BERTH_PURPOSE = { muat: 'muat', sandar: 'sandar/bongkar', pulang: 'sandar pulang' };

        // Minta satu slot. Resolve dengan lama menunggu (ms virtual). onWait dipanggil bila harus antre.
        function berthAcquire(node, ship, purpose, onWait) {
            const b = berthOf(node);
            if (b.using.size < berthSlots(node) && !b.queue.length) {
                b.using.set(ship.id, { purpose, since: vNow() });
                shipUiSoon();
                return Promise.resolve(0);
            }
            return new Promise(resolve => {
                const w = { id: ship.id, purpose, since: vNow(), resolve: () => resolve(vNow() - w.since) };
                b.queue.push(w);
                if (onWait) onWait(w);
                shipUiSoon();
            });
        }
        function berthRelease(node, shipId) {
            const b = berths.get(node); if (!b) return;
            b.using.delete(shipId);
            while (b.queue.length && b.using.size < berthSlots(node)) {
                const w = b.queue.shift();
                b.using.set(w.id, { purpose: w.purpose, since: vNow() });
                w.resolve();
            }
            shipUiSoon();
        }
        // Buang kapal dari semua dermaga & antrean (misi gagal / dibatalkan).
        function berthPurge(shipId) {
            berths.forEach((b, node) => {
                b.queue = b.queue.filter(w => w.id !== shipId);
                if (b.using.has(shipId)) berthRelease(node, shipId);
            });
        }
        // Dipanggil saat game dimuat ulang: antrean sesi lama dilepas supaya misi lama tidak menggantung selamanya.
        function shipOpsReset() {
            berths.forEach(b => { const q = b.queue; b.queue = []; q.forEach(w => w.resolve()); });
            berths.clear(); shipRt.clear(); shipUiSoon();
        }

        // ================= ALUR MISI (dipakai kedua penerbangan kapal) =================
        // Servis mesin di dermaga bila kondisi <= ambang. Selalu berakhir di standby. true bila servis dilakukan.
        async function shipServiceIfNeeded(ship, ent) {
            if (shipCond(ship) > SHIP_SERVICE_AT) return false;
            const cost = shipServiceCost(ship), before = shipCond(ship);
            companyCash -= cost; totalExpense += cost;
            addFinanceLog(`Servis mesin & lambung ${ship.id} (kondisi ${before}%)`, -cost);
            shipSetState(ship, 'servis', { at: ent.nama, ll: (ent.lat != null && ent.lon != null) ? [ent.lat, ent.lon] : null });
            addLog(`SERVIS MESIN: ${ship.id} masuk servis di ${ent.nama} (kondisi mesin ${before}%, ${formatRupiah(cost)}, ±${SHIP_SERVICE_SEC} detik).`, 'warning', 'truck');
            notify(`${ship.id} menjalani servis mesin di ${ent.nama}.`, 'warn');
            updateCashDisplay();
            await pausableDelay(SHIP_SERVICE_SEC * 1000);
            ship.banPct = 100;
            shipSetState(ship, 'standby', { at: ent.nama, node: null });
            addLog(`SERVIS SELESAI: mesin ${ship.id} kembali 100%.`, 'success', 'truck');
            return true;
        }
        // standby -> [servis] -> [queue] -> loading -> unberthing (slot dermaga asal dilepas setelah kapal lepas sandar)
        async function shipDepart(ship, ent) {
            shipEnsure(ship);
            const node = ent.berth;
            await shipServiceIfNeeded(ship, ent);
            const wait = await berthAcquire(node, ship, 'muat', () => {
                shipSetState(ship, 'queue', { at: ent.nama, node, why: 'muat' });
                addLog(`ANTRE LABUH: ${ship.id} menunggu slot dermaga ${ent.nama} untuk muat (${berthOf(node).using.size}/${berthSlots(node)} slot terpakai, antrean ${berthOf(node).queue.length}).`, 'warning', 'truck');
                notify(`${ship.id} antre labuh di ${ent.nama}...`, 'warn');
            });
            try {
                if (wait > 0) {
                    const L = shipIdleBurn(ship, wait);
                    addLog(`SLOT DERMAGA: ${ship.id} mendapat slot di ${ent.nama} setelah antre ±${fmtJam(wait * GAME_SPEED / 3600000)} waktu game (BBM tunggu ${fmtN(L)} L).`, 'info', 'truck');
                }
                shipSetState(ship, 'loading', { at: ent.nama, node });
                addLog(`MUAT KAPAL: ${ship.id} memuat di dermaga ${ent.nama} (±${SHIP_LOAD_SEC} detik).`, 'info', 'truck');
                await pausableDelay(SHIP_LOAD_SEC * 1000);
                shipSetState(ship, 'unberthing', { at: ent.nama, node });
                await pausableDelay(SHIP_UNBERTH_SEC * 1000);
            } finally { berthRelease(node, ship.id); }
        }
        // Satu ruas pelayaran. Bahan bakar, odometer & keausan mesin dihitung saat ruas selesai.
        async function shipSail(ship, from, to, meta, fit) {
            shipEnsure(ship);
            const mult = shipFuelMult(ship);
            shipSetState(ship, 'sailing', { at: `${from.nama} → ${to.nama}`, node: null });
            const leg = await shipVoyage(from, to, meta, fit, { speedKmh: shipSpeedKmh(ship) });
            const burnL = shipApplyLeg(ship, leg.km, mult, leg.stallMs);
            leg.burnL = burnL;
            if (ship.fuelL <= 0) addLog(`BBM HABIS: tangki ${ship.id} kosong setelah pelayaran - perhitungan bunker seharusnya mencukupi, periksa jarak & kondisi mesin.`, 'warning', 'truck');
            return leg;
        }
        // Tiba di tujuan: [queue] -> berthing -> unloading -> unberthing. onUnloaded() dipanggil saat bongkar selesai
        // (di situ stok/uang berpindah). hooks.onBerthed(waitMs) dipanggil begitu kapal mendapat slot & mulai sandar.
        async function shipCallAt(ship, ent, unloadSec, onUnloaded, hooks) {
            const node = ent.berth;
            const wait = await shipDock(ship, ent, 'sandar');
            try {
                if (hooks && hooks.onBerthed) hooks.onBerthed(wait);
                await pausableDelay(SHIP_BERTH_SEC * 1000);
                shipSetState(ship, 'unloading', { at: ent.nama, node, sec: unloadSec });
                await pausableDelay(unloadSec * 1000);
                onUnloaded();
                shipSetState(ship, 'unberthing', { at: ent.nama, node });
                await pausableDelay(SHIP_UNBERTH_SEC * 1000);
            } finally { berthRelease(node, ship.id); }
        }
        // Minta slot di dermaga tujuan. Bila penuh: status queue (kapal berlabuh jangkar di dekat dermaga).
        async function shipDock(ship, ent, purpose) {
            const node = ent.berth;
            const wait = await berthAcquire(node, ship, purpose, () => {
                shipSetState(ship, 'queue', { at: ent.nama, node, why: purpose });
                addLog(`ANTRE LABUH: ${ship.id} tiba di ${ent.nama} tapi dermaga penuh (${berthOf(node).using.size}/${berthSlots(node)} slot). Berlabuh jangkar, urutan antrean ke-${berthOf(node).queue.length}.`, 'warning', 'truck');
                notify(`${ship.id} antre labuh di ${ent.nama}...`, 'warn');
            });
            if (wait > 0) {
                const L = shipIdleBurn(ship, wait);
                addLog(`SLOT DERMAGA: ${ship.id} akhirnya sandar di ${ent.nama} setelah antre ±${fmtJam(wait * GAME_SPEED / 3600000)} waktu game (BBM tunggu ${fmtN(L)} L).`, 'info', 'truck');
            }
            shipSetState(ship, 'berthing', { at: ent.nama, node });
            return wait;
        }
        // Pulang ke pangkalan: [queue] -> berthing -> [servis] -> standby.
        async function shipReturnHome(ship, ent) {
            const node = ent.berth;
            await shipDock(ship, ent, 'pulang');
            try { await pausableDelay(SHIP_BERTH_SEC * 1000); } finally { berthRelease(node, ship.id); }
            if (!(await shipServiceIfNeeded(ship, ent))) shipSetState(ship, 'standby', { at: ent.nama, node: null });
        }

        // ================= TAMPILAN =================
        // Posisi ikon kapal yang sedang antre: melingkar di sekitar dermaga (labuh jangkar), bukan bertumpuk di dermaga.
        function shipParkLL(id) {
            const r = shipRtOf(id); if (!r.node || !SEA_NODES[r.node]) return null;
            const base = SEA_NODES[r.node];
            if (r.state !== 'queue') return base;
            const b = berths.get(r.node), qi = b ? b.queue.findIndex(w => w.id === id) : -1; if (qi < 0) return base;
            const ang = (qi * 72 + 20) * Math.PI / 180, rad = 0.035 + 0.012 * Math.floor(qi / 5);
            return [base[0] + Math.sin(ang) * rad, base[1] + Math.cos(ang) * rad];
        }
        function shipRefreshMarker(id) {
            if (typeof parkedMarkers === 'undefined') return;
            const pm = parkedMarkers.get(id); if (!pm) return;
            pm.setTooltipContent(esc(`${id} · ${shipStateLabel(id)}`));
            const ll = shipParkLL(id); if (ll) pm.setLatLng(ll);
        }
        function shipInfoHtml(id) {
            const t = companyFleet.find(x => x.id === id); if (!t) return '';
            shipEnsure(t);
            const r = shipRtOf(id), sp = shipSpec(t), fp = Math.round(100 * t.fuelL / sp.tank);
            return `<div class="text-[10px] text-gray-600 leading-4">Status: <b>${esc(SHIP_ST[r.state].label)}</b></div>
                    <div class="text-[10px] text-gray-600 leading-4">BBM: <b>${fmtN(t.fuelL)} / ${fmtN(sp.tank)} L (${fp}%)</b></div>
                    <div class="text-[10px] text-gray-600 leading-4">Mesin: <b>${shipCond(t)}%</b></div>`;
        }
        // Blok status di kartu Armada (05-hr-kemitraan.js): status kapal + bar bahan bakar.
        function shipStatusBlock(t) {
            shipEnsure(t);
            const r = shipRtOf(t.id), st = SHIP_ST[r.state], sp = shipSpec(t), fp = Math.max(0, Math.min(100, Math.round(100 * t.fuelL / sp.tank)));
            const bar = fp <= 15 ? 'bg-red-500' : fp <= 40 ? 'bg-amber-500' : 'bg-emerald-500';
            return `<div class="flex justify-between items-center mt-1.5">
                        <span class="text-gray-400"><i class="fa-solid ${st.icon} mr-1 ${st.cls}"></i>Status: <b class="${st.cls}">${st.label}</b>${r.at && r.state !== 'standby' ? ` <span class="text-gray-500">· ${esc(r.at)}</span>` : ''}</span>
                        <span class="text-gray-400"><i class="fa-solid fa-gas-pump mr-1 text-gray-500"></i>BBM: <b class="text-gray-200 font-mono">${fmtN(t.fuelL)} L</b></span>
                    </div>
                    <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1"><div class="${bar} h-full" style="width:${fp}%"></div></div>
                    <div class="text-[9px] text-gray-500 mt-0.5">Kelas ${sp.tier}: tangki ${fmtN(sp.tank)} L, ±${sp.burn} L/km. Bunker otomatis sebelum berlayar; mesin aus = lebih boros &amp; lambat.</div>`;
        }
        function berthNames(node) {
            const names = [];
            if (typeof refineryData !== 'undefined') refineryData.forEach(k => { if (k.berth === node) names.push(k.nama); });
            if (typeof HULU_SITES !== 'undefined') Object.values(HULU_SITES).forEach(s => { if (s.berth === node) names.push(s.nama); });
            return names.join(' / ') || node;
        }
        function renderShipOps() {
            const card = document.getElementById('ship-ops-card'); if (!card) return;
            const ships = (typeof companyFleet !== 'undefined' ? companyFleet : []).filter(t => t.kelas === 'kapal');
            card.classList.toggle('hidden', !ships.length);
            if (!ships.length) return;
            const cnt = document.getElementById('ship-ops-count');
            const sailing = ships.filter(t => shipRtOf(t.id).state !== 'standby').length;
            if (cnt) cnt.textContent = `(${sailing}/${ships.length} bertugas)`;
            const now = vNow();
            document.getElementById('ship-ops-ships').innerHTML = ships.map(t => {
                shipEnsure(t);
                const r = shipRtOf(t.id), st = SHIP_ST[r.state], sp = shipSpec(t), fp = Math.max(0, Math.min(100, Math.round(100 * t.fuelL / sp.tank)));
                const secs = Math.round((now - r.since) / 1000);
                return `<div class="flex items-center justify-between gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-[10px]">
                    <div class="min-w-0"><span class="font-mono text-cyan-300 font-bold">${esc(t.id)}</span> <i class="fa-solid ${st.icon} ${st.cls} mx-1"></i><b class="${st.cls}">${st.label}</b>
                        ${r.state !== 'standby' && r.at ? `<span class="text-gray-500 truncate"> · ${esc(r.at)}</span>` : ''}${r.state !== 'standby' && r.state !== 'sailing' ? `<span class="text-gray-600"> · ${secs} dtk</span>` : ''}</div>
                    <div class="shrink-0 font-mono text-gray-400">BBM ${fp}% &middot; Mesin ${shipCond(t)}%</div></div>`;
            }).join('');
            // Dermaga yang sedang dipakai / punya antrean.
            const rows = [];
            berths.forEach((b, node) => {
                if (!b.using.size && !b.queue.length) return;
                const slots = berthSlots(node);
                rows.push(`<div class="bg-gray-900 border ${b.queue.length ? 'border-amber-500/40' : 'border-gray-800'} rounded-lg px-2.5 py-1.5 text-[10px] space-y-0.5">
                    <div class="flex justify-between gap-2"><span class="font-bold text-gray-200 truncate"><i class="fa-solid fa-anchor text-sky-400 mr-1"></i>${esc(berthNames(node))}</span>
                        <span class="font-mono ${b.using.size >= slots ? 'text-amber-400' : 'text-emerald-400'}">${b.using.size}/${slots} slot</span></div>
                    ${[...b.using].map(([id, u]) => `<div class="text-gray-400">&#9656; <b class="text-cyan-300 font-mono">${esc(id)}</b> ${BERTH_PURPOSE[u.purpose] || u.purpose}</div>`).join('')}
                    ${b.queue.map((w, i) => `<div class="text-amber-300">&#8987; Antre ${i + 1}: <b class="font-mono">${esc(w.id)}</b> (${BERTH_PURPOSE[w.purpose] || w.purpose}, ±${Math.round((now - w.since) / 1000)} dtk)</div>`).join('')}
                </div>`);
            });
            document.getElementById('ship-ops-berths').innerHTML = rows.length
                ? `<div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Dermaga aktif</div>` + rows.join('')
                : `<div class="text-[10px] text-gray-600">Semua dermaga kosong. Slot: Tuban &amp; Surabaya/Gresik ${berthSlots('TBb')}, lainnya ${berthSlots('_')}.</div>`;
        }
        let shipUiTimer = null;
        function shipUiSoon() {
            if (shipUiTimer) return;
            shipUiTimer = setTimeout(() => {
                shipUiTimer = null;
                try { renderShipOps(); if (typeof renderFleetDashboard === 'function' && typeof companyFleet !== 'undefined' && companyFleet.length) renderFleetDashboard(); } catch (e) { console.error('[kapal] render:', e); }
            }, 250);
        }
        // Penghitung waktu antre di kartu ikut berjalan selama tab Kirim BBL/LPG terbuka (hanya kartu ini, bukan seluruh Armada).
        setInterval(() => {
            const card = document.getElementById('ship-ops-card');
            if (card && !card.classList.contains('hidden') && card.offsetParent !== null && !isSuspended()) renderShipOps();
        }, 2000);
