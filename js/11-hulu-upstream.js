        // ===== SEKTOR HULU (UPSTREAM) - TAHAP 1: ANJUNGAN MINYAK LEPAS PANTAI, LAUT MADURA =====
        // Pemain membangun satu anjungan di lokasi tetap. Setelah selesai dibangun, anjungan menghasilkan minyak
        // mentah (Bbl) ke tangki penampung anjungan. Minyak diangkut ke Kilang Tuban memakai Kapal Tanker BBM yang
        // sudah ada (tab Dealer). Fitur ini TAMBAHAN: tombol "beli Bbl" di tab Kilang tetap berfungsi seperti biasa.
        //
        // Semua hitungan waktu memakai gameNow() (jam game), BUKAN Date.now(), jadi produksi otomatis ikut
        // berhenti saat game dijeda / tab tersembunyi / pemain offline - tidak perlu logika jeda tambahan.

        const HULU = {
            nama: 'Anjungan Madura Alpha',
            lat: -6.62, lon: 112.60,          // laut lepas utara pesisir Tuban-Lamongan (aman dari daratan)
            buildCost: 60e9,                  // Rp 60 miliar
            buildHours: 12,                   // jam GAME (= 24 menit nyata)
            rate: 5000,                       // Bbl per hari GAME
            cap: 30000,                       // kapasitas tangki penampung anjungan (Bbl)
            opexDay: 1.5e9,                   // biaya operasional per hari GAME
            minLoad: 500                      // muatan minimum sekali kirim (Bbl)
        };
        const HULU_DAY = 86400000;
        const huluDefault = () => ({ built: false, ready: false, readyGt: 0, lastGt: 0, opexDueGt: 0, stok: 0, transit: 0, produced: 0, shutIn: false });
        let hulu = huluDefault();
        let huluEpoch = 0; // naik tiap progres dimuat ulang; kapal yang masih berlayar dari "sesi lama" tidak menambah stok lagi

        // Dipanggil applySave(). Aman untuk save lama yang belum punya data hulu (sv.hulu === undefined).
        function huluNormalize(raw) {
            const d = huluDefault(), n = (v, def) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : def);
            if (raw && typeof raw === 'object') {
                d.built = raw.built === true; d.ready = raw.ready === true && d.built;
                d.readyGt = n(raw.readyGt, 0); d.lastGt = n(raw.lastGt, 0); d.opexDueGt = n(raw.opexDueGt, 0);
                d.stok = n(raw.stok, 0); d.transit = n(raw.transit, 0); d.produced = n(raw.produced, 0); d.shutIn = !!raw.shutIn;
            }
            // Kapal tidak ikut tersimpan. Muatan yang masih di laut saat save dikembalikan ke tangki anjungan.
            d.stok += d.transit; d.transit = 0;
            huluEpoch++;
            hulu = d;
            huluMarkerSig = ''; huluUiSig = '';
            if (typeof huluSyncMarker === 'function') huluSyncMarker();
            return d;
        }

        // ---------- Produksi & biaya operasional (dipanggil berkala) ----------
        function huluTick() {
            if (!currentAccount || !hulu.built) return;
            const now = gameNow();
            if (!hulu.ready) {
                if (now < hulu.readyGt) return;
                hulu.ready = true; hulu.lastGt = hulu.readyGt; hulu.opexDueGt = hulu.readyGt + HULU_DAY;
                addLog(`HULU: ${HULU.nama} selesai dibangun dan mulai berproduksi ±${HULU.rate.toLocaleString('id-ID')} Bbl/hari.`, 'success');
                notify(`${HULU.nama} selesai dibangun & mulai berproduksi!`, 'ok');
            }
            if (now < hulu.lastGt) { hulu.lastGt = now; return; } // jam game lebih mundur dari catatan (mis. muat progres lama)
            // 1) Tagihan operasional per hari game
            let guard = 0;
            while (now >= hulu.opexDueGt && guard++ < 5) {
                if (companyCash >= HULU.opexDay) {
                    companyCash -= HULU.opexDay; totalExpense += HULU.opexDay;
                    addFinanceLog(`Biaya operasional ${HULU.nama} (1 hari)`, -HULU.opexDay);
                    hulu.opexDueGt += HULU_DAY;
                    updateCashDisplay();
                    if (hulu.shutIn) { hulu.shutIn = false; addLog(`HULU: ${HULU.nama} beroperasi lagi setelah tagihan operasional dilunasi.`, 'success'); notify(`${HULU.nama} beroperasi lagi.`, 'ok'); }
                } else {
                    if (!hulu.shutIn) {
                        hulu.shutIn = true;
                        addLog(`HULU: ${HULU.nama} BERHENTI PRODUKSI karena kas tidak cukup membayar operasional ${formatRupiah(HULU.opexDay)}/hari.`, 'warning');
                        notify(`${HULU.nama} berhenti: kas tidak cukup untuk biaya operasional.`, 'warn');
                    }
                    break;
                }
            }
            if (guard >= 5 && now >= hulu.opexDueGt) hulu.opexDueGt = now + 1; // lompatan waktu sangat jauh: hindari loop tagihan menumpuk
            // 2) Produksi (tidak jalan saat berhenti karena kas / tangki penuh)
            if (!hulu.shutIn && hulu.stok < HULU.cap) {
                const add = Math.min(HULU.cap - hulu.stok, HULU.rate * (now - hulu.lastGt) / HULU_DAY);
                hulu.stok += add; hulu.produced += add;
            }
            hulu.lastGt = now;
        }

        // ---------- Penanda di peta ----------
        let huluMarker = null, huluMarkerSig = '';
        function huluStatusInfo() {
            if (!hulu.built) return { key: 'n', label: 'Belum dibangun', color: '#64748b' };
            if (!hulu.ready) return { key: 'b', label: 'Sedang dibangun', color: '#f59e0b' };
            if (hulu.shutIn) return { key: 's', label: 'Berhenti (kas kurang)', color: '#ef4444' };
            if (hulu.stok >= HULU.cap) return { key: 'f', label: 'Tangki penuh', color: '#eab308' };
            return { key: 'r', label: 'Berproduksi', color: '#14b8a6' };
        }
        function huluSyncMarker() {
            if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
            const st = huluStatusInfo();
            if (huluMarker && huluMarkerSig === st.key) return;
            if (huluMarker) { map.removeLayer(huluMarker); huluMarker = null; }
            huluMarkerSig = st.key;
            huluMarker = L.marker([HULU.lat, HULU.lon], {
                icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15],
                    html: `<div style="width:30px;height:30px;border-radius:9px;background:${st.color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.5);${hulu.built ? '' : 'opacity:.6;border-style:dashed'}"><i class="fa-solid fa-oil-well"></i></div>` }),
                zIndexOffset: 700
            }).addTo(map);
            huluMarker.bindPopup(() => {
                const s = huluStatusInfo();
                return `<div class="text-gray-900 font-sans p-1 min-w-[170px]">
                    <strong class="text-xs font-bold block text-blue-700 mb-1">${esc(HULU.nama)}</strong>
                    <div class="text-[10px] text-gray-600 leading-4">Status: <b>${s.label}</b></div>
                    ${hulu.ready ? `<div class="text-[10px] text-gray-600 leading-4">Tangki: <b>${Math.floor(hulu.stok).toLocaleString('id-ID')} / ${HULU.cap.toLocaleString('id-ID')} Bbl</b></div>` : ''}
                    <button onclick="switchTab('tab-hulu')" style="margin-top:6px;background:#0d9488;color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer">Buka Anjungan</button>
                </div>`;
            }, { maxWidth: 220 });
        }

        // ---------- Bangun anjungan ----------
        async function huluBuild() {
            if (!currentAccount || hulu.built) return;
            if (companyCash < HULU.buildCost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(HULU.buildCost)} untuk membangun ${HULU.nama}.`, 'fa-triangle-exclamation', 'red');
            const ok = await showConfirm(`Bangun ${HULU.nama} di Laut Madura seharga ${formatRupiah(HULU.buildCost)}? Pembangunan memakan ${HULU.buildHours} jam waktu game, setelah itu anjungan berproduksi ±${HULU.rate.toLocaleString('id-ID')} Bbl/hari dengan biaya operasional ${formatRupiah(HULU.opexDay)}/hari.`,
                { title: 'Bangun Anjungan', iconClass: 'fa-oil-well', theme: 'blue', okLabel: 'Bangun' });
            if (!ok || hulu.built || companyCash < HULU.buildCost) return;
            companyCash -= HULU.buildCost; totalExpense += HULU.buildCost;
            addFinanceLog(`Pembangunan ${HULU.nama}`, -HULU.buildCost);
            hulu = Object.assign(huluDefault(), { built: true, readyGt: gameNow() + HULU.buildHours * 3600000 });
            updateCashDisplay();
            addLog(`HULU: Pembangunan ${HULU.nama} dimulai (estimasi ${HULU.buildHours} jam game).`, 'info');
            huluSyncMarker(); huluRender();
        }

        // ---------- Pengiriman minyak ke Kilang Tuban ----------
        const huluShips = () => companyFleet.filter(t => t.kelas === 'kapal' && t.type === 'BBM' && !busyIds.has(t.id));
        function huluPopulateShip() {
            const sSel = document.getElementById('hulu-ship'), nSel = document.getElementById('hulu-nahkoda'), aSel = document.getElementById('hulu-abk');
            if (!sSel || !nSel || !aSel) return;
            const prev = [sSel.value, nSel.value, aSel.value];
            sSel.innerHTML = ''; nSel.innerHTML = ''; aSel.innerHTML = '';
            huluShips().forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = `${t.id} [${t.plat}] - ${t.cap.toLocaleString('id-ID')} KL`; sSel.appendChild(o); });
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
            const tuban = refineryData[0], km = distKm(HULU, tuban);
            const kapal = companyFleet.find(t => t.id === (document.getElementById('hulu-ship') || {}).value);
            const hours = km / AVG_SHIP_SPEED_KMH;
            const capBbl = kapal ? Math.ceil(kapal.cap * ECO.bblPerKl) : 0;
            const room = Math.max(0, tuban.stok_max - tuban.stok_current);
            const load = kapal ? Math.floor(Math.min(capBbl, hulu.stok, room)) : 0;
            el.innerHTML = `Jarak ke ${esc(tuban.nama)}: <b>±${Math.round(km)} km laut</b> &middot; estimasi <b>${fmtJam(hours)}</b> sekali jalan.` +
                (kapal ? `<br>Muatan kali ini: <b class="text-amber-300">${load.toLocaleString('id-ID')} Bbl</b> (kapal muat ${capBbl.toLocaleString('id-ID')} Bbl, tangki anjungan ${Math.floor(hulu.stok).toLocaleString('id-ID')} Bbl, sisa ruang Tuban ${Math.floor(room).toLocaleString('id-ID')} Bbl).` : '');
        }
        async function huluKirim() {
            if (!currentAccount || !hulu.ready) return;
            const kapal = companyFleet.find(t => t.id === document.getElementById('hulu-ship').value);
            const nahkoda = companyCrew.find(c => c.id === document.getElementById('hulu-nahkoda').value);
            const abk = companyCrew.find(c => c.id === document.getElementById('hulu-abk').value);
            if (!kapal || !nahkoda || !abk) return showModal('Peringatan', 'Lengkapi pilihan Kapal Tanker BBM, Nahkoda & ABK! Beli kapal di tab Dealer dan rekrut kru di tab SDM Driver.', 'fa-circle-exclamation', 'red');
            if (busyIds.has(kapal.id) || busyIds.has(nahkoda.id) || busyIds.has(abk.id)) return showModal('Masih Bertugas', 'Kapal atau kru yang dipilih masih bertugas. Tunggu sampai selesai atau pilih yang lain.', 'fa-ship', 'red');
            if (docBlock(kapal)) return;
            const tuban = refineryData[0];
            const calc = () => Math.floor(Math.min(Math.ceil(kapal.cap * ECO.bblPerKl), hulu.stok, tuban.stok_max - tuban.stok_current));
            if (tuban.stok_max - tuban.stok_current < HULU.minLoad) return showModal('Tangki Tuban Penuh', 'Tangki minyak mentah Kilang Tuban hampir penuh, tidak ada ruang untuk muatan baru.', 'fa-circle-info', 'blue');
            let amount = calc();
            if (amount < HULU.minLoad) return showModal('Muatan Kurang', `Stok anjungan baru ${Math.floor(hulu.stok).toLocaleString('id-ID')} Bbl. Minimal ${HULU.minLoad.toLocaleString('id-ID')} Bbl agar kapal berangkat.`, 'fa-circle-info', 'amber');
            const ok = await showConfirm(`Kirim ${amount.toLocaleString('id-ID')} Bbl minyak mentah dari ${HULU.nama} ke ${tuban.nama} memakai ${kapal.id} (Nahkoda ${nahkoda.name})?`,
                { title: 'Kirim Minyak Mentah', iconClass: 'fa-ship', theme: 'blue', okLabel: 'Berangkat' });
            if (!ok) return;
            // cek ulang setelah konfirmasi (stok/kesibukan bisa berubah selagi dialog terbuka)
            if (busyIds.has(kapal.id) || busyIds.has(nahkoda.id) || busyIds.has(abk.id)) return showModal('Masih Bertugas', 'Kapal atau kru sudah dipakai tugas lain.', 'fa-ship', 'red');
            amount = calc();
            if (amount < HULU.minLoad) return showModal('Muatan Kurang', 'Stok anjungan atau ruang tangki Tuban berubah, muatan kini terlalu sedikit.', 'fa-circle-info', 'amber');
            hulu.stok -= amount; hulu.transit += amount;
            animateHuluTransfer({ truck: kapal, driver: nahkoda, kernet: abk, amount, epoch: huluEpoch });
            addLog(`HULU: ${kapal.id} [Nahkoda: ${nahkoda.name}] berlayar dari ${HULU.nama} membawa ${amount.toLocaleString('id-ID')} Bbl minyak mentah ke ${tuban.nama}.`, 'purple');
            notify(`${kapal.id} berangkat membawa ${amount.toLocaleString('id-ID')} Bbl dari anjungan.`, 'info');
            huluPopulateShip(); huluRefreshUi();
        }
        async function animateHuluTransfer(d) {
            const { truck, driver, kernet } = d, tuban = refineryData[0];
            const origin = { nama: HULU.nama, lat: HULU.lat, lon: HULU.lon };
            const ids = [truck.id, driver.id, kernet.id];
            ids.forEach(i => busyIds.add(i));
            populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
            ownAnims++;
            const meta = { id: truck.id, plat: truck.plat, type: truck.type, owner: currentAccount ? currentAccount.company : 'Pemain',
                           depoNama: origin.nama, tujuanNama: tuban.nama, nomorSJ: 'MINYAK MENTAH' };
            const fit = ownAnims === 1;
            const release = () => { ids.forEach(x => busyIds.delete(x)); populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard(); huluPopulateShip(); };
            try {
                const leg = await shipLeg(origin, tuban, meta, fit);
                addLog(`SANDAR: Kapal ${truck.id} tiba di ${tuban.nama} (±${Math.round(leg.km)} km laut), kru bongkar minyak mentah (±${UNLOAD_SECONDS_KAPAL} detik)...`, 'info', 'truck');
                notify(`${truck.id} sandar di ${tuban.nama}, bongkar minyak mentah...`, 'info');
                ownAnims = Math.max(0, ownAnims - 1);
                await pausableDelay(UNLOAD_SECONDS_KAPAL * 1000);
                completeHuluTransfer(d);
                try {
                    await shipLeg(tuban, origin, meta, false);
                    addLog(`Kapal ${truck.id} [Nahkoda: ${driver.name}] kembali berlabuh di ${HULU.nama}.`, 'info', 'truck');
                } catch (e) { /* animasi pulang gagal, tidak mempengaruhi stok yang sudah masuk */ }
                release();
            } catch (err) {
                // Pelayaran gagal di tengah jalan: kembalikan muatan ke tangki anjungan agar tidak hilang.
                if (d.epoch === huluEpoch && !d.done) { hulu.transit = Math.max(0, hulu.transit - d.amount); hulu.stok += d.amount; }
                ownAnims = Math.max(0, ownAnims - 1);
                release();
            }
        }
        function completeHuluTransfer(d) {
            const { truck, driver, kernet, amount } = d, tuban = refineryData[0];
            d.done = true;
            const result = settleCrewResult(driver, kernet);
            if (result.fine) {
                companyCash -= result.fine; totalExpense += result.fine;
                addFinanceLog(`Denda pelanggaran pelayaran kapal ${truck.id} (minyak mentah ${HULU.nama})`, -result.fine);
            }
            if (d.epoch !== huluEpoch) { updateCashDisplay(); return; } // progres sudah dimuat ulang: muatan lama sudah dikembalikan ke anjungan
            hulu.transit = Math.max(0, hulu.transit - amount);
            const room = Math.max(0, tuban.stok_max - tuban.stok_current);
            const masuk = Math.min(amount, room), sisa = amount - masuk;
            tuban.stok_current = Math.round((tuban.stok_current + masuk) * 100) / 100;
            if (sisa > 0) hulu.stok += sisa; // tangki Tuban keburu penuh: sisa dibawa balik ke anjungan, tidak hilang
            addLog(`HULU: ${masuk.toLocaleString('id-ID')} Bbl minyak mentah masuk ${tuban.nama}. Stok kini ${Math.round(tuban.stok_current).toLocaleString('id-ID')}/${tuban.stok_max.toLocaleString('id-ID')} Bbl.${sisa > 0 ? ` Tangki penuh, ${Math.round(sisa).toLocaleString('id-ID')} Bbl dikembalikan ke anjungan.` : ''}`, 'success');
            notify(`${masuk.toLocaleString('id-ID')} Bbl minyak mentah masuk ${tuban.nama}.`, 'ok');
            updateCashDisplay(); renderRefineries();
        }

        // ---------- Tampilan tab "Anjungan Hulu" ----------
        let huluUiSig = '';
        const huluBar = (pct, cls) => `<div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden"><div class="${cls} h-full transition-all" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
        function huluRender() {
            const root = document.getElementById('hulu-root'); if (!root) return;
            const st = huluStatusInfo();
            const head = `<div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800 shadow border-t-2 border-t-teal-500">
                <h3 class="text-xs font-bold text-teal-400 uppercase tracking-wider mb-1 flex items-center"><i class="fa-solid fa-oil-well mr-2"></i> ${esc(HULU.nama)}</h3>
                <p class="text-[11px] text-gray-400 mb-2.5">Anjungan minyak lepas pantai di Laut Madura. Menghasilkan minyak mentah (Bbl) yang diangkut ke Kilang Tuban dengan Kapal Tanker BBM. Ini tambahan: tombol beli Bbl di tab Kilang tetap bisa dipakai.</p>
                <div class="flex items-center gap-2 text-[11px] mb-2"><span class="inline-block w-2 h-2 rounded-full" style="background:${st.color}"></span><span class="font-bold text-gray-200" id="hulu-status">${st.label}</span></div>`;
            let body = '';
            if (!hulu.built) {
                body = `<div class="grid grid-cols-2 gap-2 text-[10px] mb-3">
                        <div class="stat-chip"><div class="stat-chip-label">Biaya Bangun</div><div class="stat-chip-value text-amber-400">${formatRupiah(HULU.buildCost)}</div></div>
                        <div class="stat-chip"><div class="stat-chip-label">Waktu Bangun</div><div class="stat-chip-value text-sky-400">${HULU.buildHours} jam game</div></div>
                        <div class="stat-chip"><div class="stat-chip-label">Produksi</div><div class="stat-chip-value text-emerald-400">${HULU.rate.toLocaleString('id-ID')} Bbl/hari</div></div>
                        <div class="stat-chip"><div class="stat-chip-label">Operasional</div><div class="stat-chip-value text-red-400">${formatRupiah(HULU.opexDay)}/hari</div></div>
                    </div>
                    <button onclick="huluBuild()" class="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition"><i class="fa-solid fa-hammer mr-1.5"></i>Bangun Anjungan</button>
                    <div class="text-[9px] text-gray-500 mt-2"><i class="fa-solid fa-circle-info mr-1"></i>1 hari game = 48 menit nyata. Biaya pokok minyak sendiri jauh di bawah harga beli (${formatRupiah(1100000)}/Bbl), tapi butuh modal besar dan kapal tanker.</div>`;
            } else if (!hulu.ready) {
                body = `<div class="text-[11px] text-gray-300 mb-1.5">Pembangunan berlangsung...</div><div id="hulu-build-bar">${huluBar(0, 'bg-amber-500')}</div><div id="hulu-build-left" class="text-[10px] text-gray-400 mt-1.5"></div>`;
            } else {
                body = `<div class="flex justify-between text-[11px] mb-1"><span class="text-gray-400">Tangki penampung anjungan</span><b id="hulu-stok-txt" class="text-gray-200 font-mono"></b></div>
                    <div id="hulu-stok-bar">${huluBar(0, 'bg-teal-500')}</div>
                    <div class="grid grid-cols-2 gap-2 text-[10px] mt-3">
                        <div class="stat-chip"><div class="stat-chip-label">Produksi</div><div class="stat-chip-value text-emerald-400">${HULU.rate.toLocaleString('id-ID')} Bbl/hari</div></div>
                        <div class="stat-chip"><div class="stat-chip-label">Operasional</div><div class="stat-chip-value text-red-400">${formatRupiah(HULU.opexDay)}/hari</div></div>
                        <div class="stat-chip"><div class="stat-chip-label">Total Diproduksi</div><div id="hulu-produced" class="stat-chip-value text-sky-400"></div></div>
                        <div class="stat-chip"><div class="stat-chip-label">Tagihan Berikut</div><div id="hulu-due" class="stat-chip-value text-amber-400"></div></div>
                    </div>`;
            }
            let ship = '';
            if (hulu.ready) {
                const sel = 'w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-gray-200 font-semibold';
                ship = `<div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800 shadow border-t-2 border-t-cyan-500">
                    <h3 class="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center"><i class="fa-solid fa-ship mr-2"></i> Angkut ke Kilang Tuban</h3>
                    <div class="space-y-2 text-xs">
                        <div><label class="text-gray-400 block mb-1">Kapal Tanker BBM:</label><select id="hulu-ship" onchange="huluUpdateEstimate()" class="${sel}"></select></div>
                        <div><label class="text-gray-400 block mb-1">Nahkoda:</label><select id="hulu-nahkoda" class="${sel}"></select></div>
                        <div><label class="text-gray-400 block mb-1">ABK:</label><select id="hulu-abk" class="${sel}"></select></div>
                        <div id="hulu-estimate" class="text-[10px] text-cyan-300/80 leading-snug"></div>
                        <button onclick="huluKirim()" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl text-xs transition"><i class="fa-solid fa-ship mr-1.5"></i>Kirim Minyak ke Tuban</button>
                        <div id="hulu-ship-empty" class="text-[10px] text-amber-300 hidden"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Belum ada Kapal Tanker BBM yang menganggur. Beli di tab Dealer (Kapal Tanker BBM) dan rekrut Nahkoda &amp; ABK di tab SDM Driver.</div>
                    </div></div>`;
            }
            root.innerHTML = `<div class="space-y-4">${head}${body}</div>${ship}</div>`;
            huluUiSig = huluStatusInfo().key + '|' + hulu.built + '|' + hulu.ready;
            if (hulu.ready) huluPopulateShip();
            huluRefreshUi();
        }
        // Update angka/bar saja (tanpa membangun ulang HTML) supaya dropdown yang sedang dipilih tidak ke-reset.
        function huluRefreshUi() {
            const root = document.getElementById('hulu-root');
            if (!root || typeof currentTabId === 'undefined' || currentTabId !== 'tab-hulu') return;
            if (huluUiSig !== huluStatusInfo().key + '|' + hulu.built + '|' + hulu.ready) return huluRender();
            const st = huluStatusInfo(), set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
            set('hulu-status', st.label);
            if (hulu.built && !hulu.ready) {
                const left = Math.max(0, hulu.readyGt - gameNow()), total = HULU.buildHours * 3600000;
                set('hulu-build-bar', huluBar((1 - left / total) * 100, 'bg-amber-500'));
                set('hulu-build-left', `Sisa ±${fmtJam(left / 3600000)} waktu game`);
            } else if (hulu.ready) {
                set('hulu-stok-txt', `${Math.floor(hulu.stok).toLocaleString('id-ID')} / ${HULU.cap.toLocaleString('id-ID')} Bbl`);
                set('hulu-stok-bar', huluBar(hulu.stok / HULU.cap * 100, hulu.stok >= HULU.cap ? 'bg-yellow-500' : 'bg-teal-500'));
                set('hulu-produced', `${Math.floor(hulu.produced).toLocaleString('id-ID')} Bbl`);
                set('hulu-due', dShort(hulu.opexDueGt));
                const has = huluShips().length > 0, empty = document.getElementById('hulu-ship-empty');
                if (empty) empty.classList.toggle('hidden', has);
                huluUpdateEstimate();
            }
        }

        // Produksi jalan tiap 3 detik nyata (nilai sebenarnya dihitung dari selisih jam game, bukan jumlah tick).
        setInterval(() => { try { huluTick(); huluSyncMarker(); huluRefreshUi(); } catch (e) { console.warn('Hulu tick error:', e); } }, 3000);
