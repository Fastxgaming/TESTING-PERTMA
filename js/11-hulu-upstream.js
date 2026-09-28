        // ===== SEKTOR HULU (UPSTREAM) - TAHAP 2: 3 LOKASI ANJUNGAN (MINYAK + GAS), UPGRADE PRODUKSI =====
        // Pemain membangun anjungan lepas pantai di Laut Madura. Anjungan minyak menghasilkan minyak mentah (Bbl) yang
        // diangkut Kapal Tanker BBM ke stok mentah Kilang Tuban. Anjungan gas menghasilkan gas bumi yang dijual masuk
        // sebagai LPG Curah (Ton) ke Kilang Tuban lewat Kapal Tanker LPG. Semua TAMBAHAN: tombol beli di tab Kilang tetap ada.
        //
        // Hitungan waktu memakai gameNow() (jam game), BUKAN Date.now(), jadi produksi ikut berhenti saat game dijeda /
        // tab tersembunyi / pemain offline - tidak perlu logika jeda tambahan.

        const HULU_SITES = {
            alpha: { nama: 'Anjungan Madura Alpha', fuel: 'oil', unit: 'Bbl', jenis: 'minyak mentah', shipType: 'BBM', icon: 'fa-oil-well', tone: 'teal',
                     lat: -6.62, lon: 112.60, buildCost: 60e9, buildHours: 12, rate: 5000, cap: 30000, opexDay: 1.5e9, minLoad: 500 },
            bravo: { nama: 'Anjungan Madura Bravo', fuel: 'oil', unit: 'Bbl', jenis: 'minyak mentah', shipType: 'BBM', icon: 'fa-oil-well', tone: 'amber',
                     lat: -6.45, lon: 113.30, buildCost: 110e9, buildHours: 18, rate: 9500, cap: 60000, opexDay: 2.8e9, minLoad: 500 },
            gamma: { nama: 'Anjungan Gas Madura Gamma', fuel: 'gas', unit: 'Ton', jenis: 'gas bumi (LPG Curah)', shipType: 'LPG', icon: 'fa-fire-flame-simple', tone: 'orange',
                     lat: -6.30, lon: 113.00, buildCost: 45e9, buildHours: 12, rate: 300, cap: 2400, opexDay: 0.8e9, minLoad: 50 }
        };
        const HULU_KEYS = Object.keys(HULU_SITES);
        const HULU_DAY = 86400000, HULU_MAX_LVL = 3, HULU_UP = { rate: 0.30, opex: 0.20, cost: 0.5, growth: 1.6 };
        const huluSiteDefault = () => ({ built: false, ready: false, readyGt: 0, lastGt: 0, opexDueGt: 0, stok: 0, transit: 0, produced: 0, shutIn: false, lvl: 0 });
        const huluDefault = () => { const s = {}; HULU_KEYS.forEach(k => { s[k] = huluSiteDefault(); }); return { sites: s }; };
        let hulu = huluDefault();
        let huluEpoch = 0;   // naik tiap progres dimuat ulang; kapal "sesi lama" tidak menambah stok lagi
        let huluSel = 'alpha';
        const hs = k => hulu.sites[k];
        const hRate = k => HULU_SITES[k].rate * (1 + HULU_UP.rate * hs(k).lvl);
        const hCap = k => Math.round(HULU_SITES[k].cap * (1 + HULU_UP.rate * hs(k).lvl));
        const hOpex = k => Math.round(HULU_SITES[k].opexDay * (1 + HULU_UP.opex * hs(k).lvl));
        const hUpCost = k => Math.round(HULU_SITES[k].buildCost * HULU_UP.cost * Math.pow(HULU_UP.growth, hs(k).lvl));
        const fmtN = v => Math.floor(v).toLocaleString('id-ID');

        // Dipanggil applySave(). Aman untuk save lama: tanpa data hulu, atau format Tahap 1 (satu anjungan = alpha).
        function huluNormalize(raw) {
            const num = (v, def) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : def);
            const src = raw && typeof raw === 'object' ? (raw.sites || ('built' in raw ? { alpha: raw } : {})) : {};
            const out = huluDefault();
            HULU_KEYS.forEach(k => {
                const r = src[k], d = out.sites[k];
                if (!r || typeof r !== 'object') return;
                d.built = r.built === true; d.ready = r.ready === true && d.built;
                d.readyGt = num(r.readyGt, 0); d.lastGt = num(r.lastGt, 0); d.opexDueGt = num(r.opexDueGt, 0);
                d.stok = num(r.stok, 0); d.transit = num(r.transit, 0); d.produced = num(r.produced, 0); d.shutIn = r.shutIn === true;
                d.lvl = Math.min(HULU_MAX_LVL, Math.floor(num(r.lvl, 0)));
                // Kapal tidak ikut tersimpan: muatan yang masih di laut saat save dikembalikan ke tangki anjungan.
                d.stok += d.transit; d.transit = 0;
            });
            huluEpoch++;
            hulu = out;
            huluMarkerSig = {}; huluUiSig = '';
            huluSyncMarkers();
            return out;
        }

        // ---------- Produksi & biaya operasional ----------
        function huluTickSite(k) {
            const s = hs(k), c = HULU_SITES[k], now = gameNow();
            if (!s.built) return;
            if (!s.ready) {
                if (now < s.readyGt) return;
                s.ready = true; s.lastGt = s.readyGt; s.opexDueGt = s.readyGt + HULU_DAY;
                addLog(`HULU: ${c.nama} selesai dibangun dan mulai berproduksi ±${fmtN(hRate(k))} ${c.unit}/hari.`, 'success');
                notify(`${c.nama} selesai dibangun & mulai berproduksi!`, 'ok');
            }
            if (now < s.lastGt) { s.lastGt = now; return; } // jam game lebih mundur dari catatan (mis. muat progres lama)
            let guard = 0;
            while (now >= s.opexDueGt && guard++ < 5) {
                const opex = hOpex(k);
                if (companyCash >= opex) {
                    companyCash -= opex; totalExpense += opex;
                    addFinanceLog(`Biaya operasional ${c.nama} (1 hari)`, -opex);
                    s.opexDueGt += HULU_DAY; updateCashDisplay();
                    if (s.shutIn) { s.shutIn = false; addLog(`HULU: ${c.nama} beroperasi lagi setelah tagihan operasional dilunasi.`, 'success'); notify(`${c.nama} beroperasi lagi.`, 'ok'); }
                } else {
                    if (!s.shutIn) {
                        s.shutIn = true;
                        addLog(`HULU: ${c.nama} BERHENTI PRODUKSI karena kas tidak cukup membayar operasional ${formatRupiah(opex)}/hari.`, 'warning');
                        notify(`${c.nama} berhenti: kas tidak cukup untuk biaya operasional.`, 'warn');
                    }
                    break;
                }
            }
            if (guard >= 5 && now >= s.opexDueGt) s.opexDueGt = now + 1; // lompatan waktu sangat jauh: hindari tagihan menumpuk
            const cap = hCap(k);
            if (!s.shutIn && s.stok < cap) {
                const add = Math.min(cap - s.stok, hRate(k) * (now - s.lastGt) / HULU_DAY);
                s.stok += add; s.produced += add;
            }
            s.lastGt = now;
        }
        function huluTick() { if (currentAccount) HULU_KEYS.forEach(huluTickSite); }

        // ---------- Penanda di peta ----------
        const huluMarkers = {}; let huluMarkerSig = {};
        function huluStatusInfo(k) {
            const s = hs(k);
            if (!s.built) return { key: 'n', label: 'Belum dibangun', color: '#64748b' };
            if (!s.ready) return { key: 'b', label: 'Sedang dibangun', color: '#f59e0b' };
            if (s.shutIn) return { key: 's', label: 'Berhenti (kas kurang)', color: '#ef4444' };
            if (s.stok >= hCap(k)) return { key: 'f', label: 'Tangki penuh', color: '#eab308' };
            return { key: 'r', label: 'Berproduksi', color: '#14b8a6' };
        }
        function huluSyncMarkers() {
            if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
            HULU_KEYS.forEach(k => {
                const c = HULU_SITES[k], s = hs(k), st = huluStatusInfo(k), sig = st.key + s.lvl;
                if (huluMarkers[k] && huluMarkerSig[k] === sig) return;
                if (huluMarkers[k]) { map.removeLayer(huluMarkers[k]); huluMarkers[k] = null; }
                huluMarkerSig[k] = sig;
                huluMarkers[k] = L.marker([c.lat, c.lon], {
                    icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15],
                        html: `<div style="width:30px;height:30px;border-radius:9px;background:${st.color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.5);${s.built ? '' : 'opacity:.6;border-style:dashed'}"><i class="fa-solid ${c.icon}"></i></div>` }),
                    zIndexOffset: 700
                }).addTo(map);
                huluMarkers[k].bindPopup(() => {
                    const s2 = hs(k), st2 = huluStatusInfo(k);
                    return `<div class="text-gray-900 font-sans p-1 min-w-[170px]">
                        <strong class="text-xs font-bold block text-blue-700 mb-1">${esc(c.nama)}${s2.lvl ? ' &middot; Lv ' + s2.lvl : ''}</strong>
                        <div class="text-[10px] text-gray-600 leading-4">Status: <b>${st2.label}</b></div>
                        ${s2.ready ? `<div class="text-[10px] text-gray-600 leading-4">Tangki: <b>${fmtN(s2.stok)} / ${fmtN(hCap(k))} ${c.unit}</b></div>` : ''}
                        <button onclick="huluOpen('${k}')" style="margin-top:6px;background:#0d9488;color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer">Buka Anjungan</button>
                    </div>`;
                }, { maxWidth: 220 });
            });
        }
        function huluOpen(k) { if (HULU_SITES[k]) huluSel = k; switchTab('tab-hulu'); }
        function huluPick(k) { if (HULU_SITES[k]) { huluSel = k; huluRender(); } }

        // ---------- Bangun & upgrade ----------
        async function huluBuild(k) {
            const c = HULU_SITES[k];
            if (!currentAccount || !c || hs(k).built) return;
            if (companyCash < c.buildCost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(c.buildCost)} untuk membangun ${c.nama}.`, 'fa-triangle-exclamation', 'red');
            const ok = await showConfirm(`Bangun ${c.nama} di Laut Madura seharga ${formatRupiah(c.buildCost)}? Pembangunan memakan ${c.buildHours} jam waktu game, setelah itu anjungan berproduksi ±${fmtN(c.rate)} ${c.unit}/hari ${c.jenis} dengan biaya operasional ${formatRupiah(c.opexDay)}/hari.`,
                { title: 'Bangun Anjungan', iconClass: c.icon, theme: 'blue', okLabel: 'Bangun' });
            if (!ok || hs(k).built || companyCash < c.buildCost) return;
            companyCash -= c.buildCost; totalExpense += c.buildCost;
            addFinanceLog(`Pembangunan ${c.nama}`, -c.buildCost);
            hulu.sites[k] = Object.assign(huluSiteDefault(), { built: true, readyGt: gameNow() + c.buildHours * 3600000 });
            updateCashDisplay();
            addLog(`HULU: Pembangunan ${c.nama} dimulai (estimasi ${c.buildHours} jam game).`, 'info');
            huluSyncMarkers(); huluRender();
        }
        async function huluUpgrade(k) {
            const c = HULU_SITES[k], s = hs(k);
            if (!currentAccount || !c || !s.ready || s.lvl >= HULU_MAX_LVL) return;
            const cost = hUpCost(k);
            if (companyCash < cost) return showModal('Kas Tidak Cukup', `Upgrade ${c.nama} butuh ${formatRupiah(cost)}.`, 'fa-triangle-exclamation', 'red');
            const r2 = HULU_SITES[k].rate * (1 + HULU_UP.rate * (s.lvl + 1)), o2 = c.opexDay * (1 + HULU_UP.opex * (s.lvl + 1));
            const ok = await showConfirm(`Upgrade ${c.nama} ke Level ${s.lvl + 1} seharga ${formatRupiah(cost)}? Produksi jadi ±${fmtN(r2)} ${c.unit}/hari, tangki ${fmtN(Math.round(c.cap * (1 + HULU_UP.rate * (s.lvl + 1))))} ${c.unit}, operasional ${formatRupiah(Math.round(o2))}/hari.`,
                { title: 'Upgrade Anjungan', iconClass: 'fa-arrow-up-right-dots', theme: 'blue', okLabel: 'Upgrade' });
            if (!ok || !s.ready || s.lvl >= HULU_MAX_LVL || companyCash < hUpCost(k)) return;
            huluTickSite(k); // catat produksi sampai detik ini dengan tarif lama
            const pay = hUpCost(k);
            companyCash -= pay; totalExpense += pay; s.lvl++;
            addFinanceLog(`Upgrade ${c.nama} ke Level ${s.lvl}`, -pay);
            updateCashDisplay();
            addLog(`HULU: ${c.nama} di-upgrade ke Level ${s.lvl} (produksi ±${fmtN(hRate(k))} ${c.unit}/hari, tangki ${fmtN(hCap(k))} ${c.unit}).`, 'success');
            huluSyncMarkers(); huluRender();
        }

        // ---------- Pengiriman ke Kilang Tuban ----------
        const huluShips = k => companyFleet.filter(t => t.kelas === 'kapal' && t.type === HULU_SITES[k].shipType && !busyIds.has(t.id));
        // Ruang kosong & fungsi kredit di Kilang Tuban: minyak -> stok mentah (Bbl); gas -> slot LPG Curah (Ton)
        function huluDest(k) {
            const tuban = refineryData[0];
            if (HULU_SITES[k].fuel === 'gas') {
                const slot = tuban.kap && tuban.kap.lpg_curah;
                return { tuban, room: slot ? Math.max(0, slot.max - slot.cur) : 0, label: 'LPG Curah',
                         credit: q => { slot.cur = Math.round((slot.cur + q) * 100) / 100; return { cur: slot.cur, max: slot.max }; } };
            }
            return { tuban, room: Math.max(0, tuban.stok_max - tuban.stok_current), label: 'stok mentah',
                     credit: q => { tuban.stok_current = Math.round((tuban.stok_current + q) * 100) / 100; return { cur: tuban.stok_current, max: tuban.stok_max }; } };
        }
        const huluShipCap = (k, kapal) => HULU_SITES[k].fuel === 'gas' ? kapal.cap : Math.ceil(kapal.cap * ECO.bblPerKl);
        function huluPopulateShip() {
            const k = huluSel, sSel = document.getElementById('hulu-ship'), nSel = document.getElementById('hulu-nahkoda'), aSel = document.getElementById('hulu-abk');
            if (!sSel || !nSel || !aSel) return;
            const prev = [sSel.value, nSel.value, aSel.value], unitKap = HULU_SITES[k].fuel === 'gas' ? 'Ton' : 'KL';
            sSel.innerHTML = ''; nSel.innerHTML = ''; aSel.innerHTML = '';
            huluShips(k).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = `${t.id} [${t.plat}] - ${t.cap.toLocaleString('id-ID')} ${unitKap}`; sSel.appendChild(o); });
            companyCrew.forEach(c => {
                if (busyIds.has(c.id)) return;
                const o = document.createElement('option'); o.value = c.id;
                o.textContent = `${c.name} (${'★'.repeat(repToStars(c.reputation))} Rep ${Math.round(c.reputation)} - Viol: ${c.violations})`;
                if (c.role === 'Nahkoda') nSel.appendChild(o); else if (c.role === 'ABK') aSel.appendChild(o);
            });
            [sSel, nSel, aSel].forEach((el, i) => { if (prev[i] && el.querySelector(`option[value="${prev[i]}"]`)) el.value = prev[i]; else if (el.options.length) el.selectedIndex = 0; });
            huluUpdateEstimate();
        }
        function huluUpdateEstimate() {
            const el = document.getElementById('hulu-estimate'); if (!el) return;
            const k = huluSel, c = HULU_SITES[k], s = hs(k), dest = huluDest(k), km = distKm(c, dest.tuban);
            const kapal = companyFleet.find(t => t.id === (document.getElementById('hulu-ship') || {}).value);
            const capU = kapal ? huluShipCap(k, kapal) : 0, load = kapal ? Math.floor(Math.min(capU, s.stok, dest.room)) : 0;
            el.innerHTML = `Jarak ke ${esc(dest.tuban.nama)}: <b>±${Math.round(km)} km laut</b> &middot; estimasi <b>${fmtJam(km / AVG_SHIP_SPEED_KMH)}</b> sekali jalan.` +
                (kapal ? `<br>Muatan kali ini: <b class="text-amber-300">${fmtN(load)} ${c.unit}</b> (kapal muat ${fmtN(capU)}, tangki anjungan ${fmtN(s.stok)}, sisa ruang ${dest.label} Tuban ${fmtN(dest.room)}).` : '');
        }
        async function huluKirim() {
            const k = huluSel, c = HULU_SITES[k], s = hs(k);
            if (!currentAccount || !s.ready) return;
            const kapal = companyFleet.find(t => t.id === document.getElementById('hulu-ship').value);
            const nahkoda = companyCrew.find(x => x.id === document.getElementById('hulu-nahkoda').value);
            const abk = companyCrew.find(x => x.id === document.getElementById('hulu-abk').value);
            if (!kapal || !nahkoda || !abk) return showModal('Peringatan', `Lengkapi pilihan Kapal Tanker ${c.shipType}, Nahkoda & ABK! Beli kapal di tab Dealer dan rekrut kru di tab SDM Driver.`, 'fa-circle-exclamation', 'red');
            if (busyIds.has(kapal.id) || busyIds.has(nahkoda.id) || busyIds.has(abk.id)) return showModal('Masih Bertugas', 'Kapal atau kru yang dipilih masih bertugas. Tunggu sampai selesai atau pilih yang lain.', 'fa-ship', 'red');
            if (docBlock(kapal)) return;
            const calc = () => { const d = huluDest(k); return Math.floor(Math.min(huluShipCap(k, kapal), s.stok, d.room)); };
            const d0 = huluDest(k);
            if (d0.room < c.minLoad) return showModal('Tangki Tuban Penuh', `Tangki ${d0.label} Kilang Tuban hampir penuh, tidak ada ruang untuk muatan baru.`, 'fa-circle-info', 'blue');
            let amount = calc();
            if (amount < c.minLoad) return showModal('Muatan Kurang', `Stok anjungan baru ${fmtN(s.stok)} ${c.unit}. Minimal ${fmtN(c.minLoad)} ${c.unit} agar kapal berangkat.`, 'fa-circle-info', 'amber');
            const ok = await showConfirm(`Kirim ${fmtN(amount)} ${c.unit} ${c.jenis} dari ${c.nama} ke ${d0.tuban.nama} memakai ${kapal.id} (Nahkoda ${nahkoda.name})?`,
                { title: 'Kirim Muatan', iconClass: 'fa-ship', theme: 'blue', okLabel: 'Berangkat' });
            if (!ok) return;
            if (busyIds.has(kapal.id) || busyIds.has(nahkoda.id) || busyIds.has(abk.id)) return showModal('Masih Bertugas', 'Kapal atau kru sudah dipakai tugas lain.', 'fa-ship', 'red');
            amount = calc();
            if (amount < c.minLoad) return showModal('Muatan Kurang', 'Stok anjungan atau ruang tangki Tuban berubah, muatan kini terlalu sedikit.', 'fa-circle-info', 'amber');
            s.stok -= amount; s.transit += amount;
            animateHuluTransfer({ site: k, truck: kapal, driver: nahkoda, kernet: abk, amount, epoch: huluEpoch });
            addLog(`HULU: ${kapal.id} [Nahkoda: ${nahkoda.name}] berlayar dari ${c.nama} membawa ${fmtN(amount)} ${c.unit} ${c.jenis} ke ${d0.tuban.nama}.`, 'purple');
            notify(`${kapal.id} berangkat membawa ${fmtN(amount)} ${c.unit} dari anjungan.`, 'info');
            huluPopulateShip(); huluRefreshUi();
        }
        async function animateHuluTransfer(d) {
            const { truck, driver, kernet, site } = d, c = HULU_SITES[site], tuban = refineryData[0];
            const origin = { nama: c.nama, lat: c.lat, lon: c.lon };
            const ids = [truck.id, driver.id, kernet.id];
            ids.forEach(i => busyIds.add(i));
            populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
            ownAnims++;
            const meta = { id: truck.id, plat: truck.plat, type: truck.type, owner: currentAccount ? currentAccount.company : 'Pemain',
                           depoNama: origin.nama, tujuanNama: tuban.nama, nomorSJ: c.fuel === 'gas' ? 'GAS BUMI' : 'MINYAK MENTAH' };
            const fit = ownAnims === 1;
            const release = () => { ids.forEach(x => busyIds.delete(x)); populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard(); huluPopulateShip(); };
            try {
                const leg = await shipLeg(origin, tuban, meta, fit);
                addLog(`SANDAR: Kapal ${truck.id} tiba di ${tuban.nama} (±${Math.round(leg.km)} km laut), kru bongkar ${c.jenis} (±${UNLOAD_SECONDS_KAPAL} detik)...`, 'info', 'truck');
                notify(`${truck.id} sandar di ${tuban.nama}, bongkar ${c.jenis}...`, 'info');
                ownAnims = Math.max(0, ownAnims - 1);
                await pausableDelay(UNLOAD_SECONDS_KAPAL * 1000);
                completeHuluTransfer(d);
                try {
                    await shipLeg(tuban, origin, meta, false);
                    addLog(`Kapal ${truck.id} [Nahkoda: ${driver.name}] kembali berlabuh di ${c.nama}.`, 'info', 'truck');
                } catch (e) { /* animasi pulang gagal, tidak mempengaruhi stok yang sudah masuk */ }
                release();
            } catch (err) {
                // Pelayaran gagal di tengah jalan: kembalikan muatan ke tangki anjungan agar tidak hilang.
                if (d.epoch === huluEpoch && !d.done) { const s = hs(site); s.transit = Math.max(0, s.transit - d.amount); s.stok += d.amount; }
                ownAnims = Math.max(0, ownAnims - 1);
                release();
            }
        }
        function completeHuluTransfer(d) {
            const { truck, driver, kernet, amount, site } = d, c = HULU_SITES[site], s = hs(site);
            d.done = true;
            const result = settleCrewResult(driver, kernet);
            if (result.fine) {
                companyCash -= result.fine; totalExpense += result.fine;
                addFinanceLog(`Denda pelanggaran pelayaran kapal ${truck.id} (${c.jenis} ${c.nama})`, -result.fine);
            }
            if (d.epoch !== huluEpoch) { updateCashDisplay(); return; } // progres sudah dimuat ulang: muatan lama sudah dikembalikan
            s.transit = Math.max(0, s.transit - amount);
            const dest = huluDest(site), masuk = Math.min(amount, dest.room), sisa = amount - masuk;
            const now = masuk > 0 ? dest.credit(masuk) : { cur: 0, max: 0 };
            if (sisa > 0) s.stok += sisa; // tangki Tuban keburu penuh: sisa dibawa balik ke anjungan, tidak hilang
            addLog(`HULU: ${fmtN(masuk)} ${c.unit} ${c.jenis} masuk ${dest.tuban.nama} (${dest.label}).${masuk > 0 ? ` Stok kini ${fmtN(now.cur)}/${fmtN(now.max)} ${c.unit}.` : ''}${sisa > 0 ? ` Tangki penuh, ${fmtN(sisa)} ${c.unit} dikembalikan ke anjungan.` : ''}`, 'success');
            notify(`${fmtN(masuk)} ${c.unit} ${c.jenis} masuk ${dest.tuban.nama}.`, 'ok');
            updateCashDisplay(); renderRefineries();
        }

        // ---------- Tampilan tab "Anjungan Hulu" ----------
        let huluUiSig = '';
        const huluBar = (pct, cls) => `<div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden"><div class="${cls} h-full transition-all" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
        const huluSigNow = () => huluSel + '|' + HULU_KEYS.map(k => huluStatusInfo(k).key + hs(k).lvl).join(',');
        function huluRender() {
            const root = document.getElementById('hulu-root'); if (!root) return;
            const k = huluSel, c = HULU_SITES[k], s = hs(k), st = huluStatusInfo(k);
            const cards = HULU_KEYS.map(x => {
                const cx = HULU_SITES[x], sx = huluStatusInfo(x), on = x === k;
                return `<button onclick="huluPick('${x}')" class="text-left rounded-xl border p-2 transition ${on ? 'border-teal-500 bg-teal-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-600'}">
                    <div class="flex items-center gap-1.5 text-[11px] font-bold text-gray-200"><i class="fa-solid ${cx.icon} text-${cx.tone}-400"></i><span class="truncate">${cx.fuel === 'gas' ? 'Gas' : 'Minyak'} ${x.charAt(0).toUpperCase() + x.slice(1)}${hs(x).lvl ? ' · Lv' + hs(x).lvl : ''}</span></div>
                    <div class="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5"><span class="inline-block w-1.5 h-1.5 rounded-full" style="background:${sx.color}"></span>${sx.label}</div></button>`;
            }).join('');
            const chip = (l, v, cls, id) => `<div class="stat-chip"><div class="stat-chip-label">${l}</div><div ${id ? `id="${id}"` : ''} class="stat-chip-value ${cls}">${v}</div></div>`;
            let body = '';
            if (!s.built) {
                body = `<div class="grid grid-cols-2 gap-2 text-[10px] mb-3">${chip('Biaya Bangun', formatRupiah(c.buildCost), 'text-amber-400')}${chip('Waktu Bangun', c.buildHours + ' jam game', 'text-sky-400')}
                        ${chip('Produksi', fmtN(c.rate) + ' ' + c.unit + '/hari', 'text-emerald-400')}${chip('Operasional', formatRupiah(c.opexDay) + '/hari', 'text-red-400')}</div>
                    <button onclick="huluBuild('${k}')" class="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition"><i class="fa-solid fa-hammer mr-1.5"></i>Bangun Anjungan</button>
                    <div class="text-[9px] text-gray-500 mt-2"><i class="fa-solid fa-circle-info mr-1"></i>1 hari game = 48 menit nyata. ${c.fuel === 'gas' ? `Gas diangkut kapal Tanker LPG dan masuk sebagai LPG Curah Tuban (harga beli ${formatRupiah(PRODUCT_META.lpg_curah.buyPrice)}/Ton).` : `Biaya pokok minyak sendiri jauh di bawah harga beli (${formatRupiah(BBL_PRICE)}/Bbl), tapi modalnya besar dan butuh kapal tanker.`}</div>`;
            } else if (!s.ready) {
                body = `<div class="text-[11px] text-gray-300 mb-1.5">Pembangunan berlangsung...</div><div id="hulu-build-bar">${huluBar(0, 'bg-amber-500')}</div><div id="hulu-build-left" class="text-[10px] text-gray-400 mt-1.5"></div>`;
            } else {
                const up = s.lvl >= HULU_MAX_LVL
                    ? `<div class="text-[10px] text-emerald-300 mt-3"><i class="fa-solid fa-circle-check mr-1"></i>Upgrade sudah level maksimum (Lv ${HULU_MAX_LVL}).</div>`
                    : `<button onclick="huluUpgrade('${k}')" class="w-full mt-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs transition"><i class="fa-solid fa-arrow-up-right-dots mr-1.5"></i>Upgrade ke Lv ${s.lvl + 1} (${formatRupiah(hUpCost(k))})</button>
                       <div class="text-[9px] text-gray-500 mt-1">Tiap level: produksi &amp; tangki +${Math.round(HULU_UP.rate * 100)}%, operasional +${Math.round(HULU_UP.opex * 100)}% dari nilai dasar.</div>`;
                body = `<div class="flex justify-between text-[11px] mb-1"><span class="text-gray-400">Tangki penampung anjungan</span><b id="hulu-stok-txt" class="text-gray-200 font-mono"></b></div>
                    <div id="hulu-stok-bar">${huluBar(0, 'bg-teal-500')}</div>
                    <div class="grid grid-cols-2 gap-2 text-[10px] mt-3">${chip('Produksi', fmtN(hRate(k)) + ' ' + c.unit + '/hari', 'text-emerald-400')}${chip('Operasional', formatRupiah(hOpex(k)) + '/hari', 'text-red-400')}
                        ${chip('Total Diproduksi', '', 'text-sky-400', 'hulu-produced')}${chip('Tagihan Berikut', '', 'text-amber-400', 'hulu-due')}</div>${up}`;
            }
            let ship = '';
            if (s.ready) {
                const sel = 'w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-gray-200 font-semibold';
                ship = `<div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800 shadow border-t-2 border-t-cyan-500">
                    <h3 class="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center"><i class="fa-solid fa-ship mr-2"></i> Angkut ke Kilang Tuban</h3>
                    <div class="space-y-2 text-xs">
                        <div><label class="text-gray-400 block mb-1">Kapal Tanker ${c.shipType}:</label><select id="hulu-ship" onchange="huluUpdateEstimate()" class="${sel}"></select></div>
                        <div><label class="text-gray-400 block mb-1">Nahkoda:</label><select id="hulu-nahkoda" class="${sel}"></select></div>
                        <div><label class="text-gray-400 block mb-1">ABK:</label><select id="hulu-abk" class="${sel}"></select></div>
                        <div id="hulu-estimate" class="text-[10px] text-cyan-300/80 leading-snug"></div>
                        <button onclick="huluKirim()" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl text-xs transition"><i class="fa-solid fa-ship mr-1.5"></i>Kirim ke Tuban</button>
                        <div id="hulu-ship-empty" class="text-[10px] text-amber-300 hidden"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Belum ada Kapal Tanker ${c.shipType} yang menganggur. Beli di tab Dealer dan rekrut Nahkoda &amp; ABK di tab SDM Driver.</div>
                    </div></div>`;
            }
            root.innerHTML = `<div class="space-y-4">
                <div class="grid grid-cols-3 gap-2">${cards}</div>
                <div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800 shadow border-t-2 border-t-${c.tone}-500">
                    <h3 class="text-xs font-bold text-${c.tone}-400 uppercase tracking-wider mb-1 flex items-center"><i class="fa-solid ${c.icon} mr-2"></i> ${esc(c.nama)}</h3>
                    <p class="text-[11px] text-gray-400 mb-2.5">${c.fuel === 'gas' ? 'Anjungan gas bumi lepas pantai. Hasilnya diangkut Kapal Tanker LPG dan masuk sebagai LPG Curah di Kilang Tuban.' : 'Anjungan minyak lepas pantai. Hasilnya diangkut Kapal Tanker BBM dan masuk ke stok minyak mentah Kilang Tuban.'} Ini tambahan: tombol beli di tab Kilang tetap bisa dipakai.</p>
                    <div class="flex items-center gap-2 text-[11px] mb-2"><span class="inline-block w-2 h-2 rounded-full" style="background:${st.color}"></span><span class="font-bold text-gray-200" id="hulu-status">${st.label}</span></div>
                    ${body}</div>${ship}</div>`;
            huluUiSig = huluSigNow();
            if (s.ready) huluPopulateShip();
            huluRefreshUi();
        }
        // Update angka/bar saja (tanpa membangun ulang HTML) supaya dropdown yang sedang dipilih tidak ke-reset.
        function huluRefreshUi() {
            const root = document.getElementById('hulu-root');
            if (!root || typeof currentTabId === 'undefined' || currentTabId !== 'tab-hulu') return;
            if (huluUiSig !== huluSigNow()) return huluRender();
            const k = huluSel, c = HULU_SITES[k], s = hs(k), set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
            set('hulu-status', huluStatusInfo(k).label);
            if (s.built && !s.ready) {
                const left = Math.max(0, s.readyGt - gameNow()), total = c.buildHours * 3600000;
                set('hulu-build-bar', huluBar((1 - left / total) * 100, 'bg-amber-500'));
                set('hulu-build-left', `Sisa ±${fmtJam(left / 3600000)} waktu game`);
            } else if (s.ready) {
                set('hulu-stok-txt', `${fmtN(s.stok)} / ${fmtN(hCap(k))} ${c.unit}`);
                set('hulu-stok-bar', huluBar(s.stok / hCap(k) * 100, s.stok >= hCap(k) ? 'bg-yellow-500' : 'bg-teal-500'));
                set('hulu-produced', `${fmtN(s.produced)} ${c.unit}`);
                set('hulu-due', dShort(s.opexDueGt));
                const empty = document.getElementById('hulu-ship-empty');
                if (empty) empty.classList.toggle('hidden', huluShips(k).length > 0);
                huluUpdateEstimate();
            }
        }

        // Produksi jalan tiap 3 detik nyata (nilai sebenarnya dihitung dari selisih jam game, bukan jumlah tick).
        setInterval(() => { try { huluTick(); huluSyncMarkers(); huluRefreshUi(); } catch (e) { console.warn('Hulu tick error:', e); } }, 3000);
