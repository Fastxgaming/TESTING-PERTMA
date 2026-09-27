        // ===== Jual Cepat dari Tab Armada =====
        let sellModalTruckId = null;
        function estimateTruckValue(truck) {
            // Estimasi kasar buat isian awal harga: harga beli dikurangi penyusutan odometer & kondisi ban
            const base = truck.price || 500000000;
            const wear = Math.max(0.4, 1 - (truck.odometer / 300000) * 0.5 - ((100 - truck.banPct) / 100) * 0.15);
            return Math.round(base * wear / 1000000) * 1000000;
        }
        function openSellModal(truckId) {
            const truck = companyFleet.find(t => t.id === truckId);
            if (!truck) return;
            if (busyIds.has(truckId)) return showModal('Truk Sedang Bertugas', 'Truk yang sedang dalam perjalanan tidak bisa dijual. Tunggu sampai tiba di depot.', 'fa-truck-fast', 'red');
            if (!currentAccount || !window.fb) return showModal('Belum Siap', 'Firebase belum siap. Periksa koneksi lalu muat ulang halaman.', 'fa-triangle-exclamation', 'red');
            sellModalTruckId = truckId;
            document.getElementById('sell-spec-name').innerText = `${truck.id} - ${truck.name}`;
            document.getElementById('sell-spec-plat').innerText = truck.plat;
            document.getElementById('sell-spec-cond').innerText = `${truck.odometer.toLocaleString('id-ID')} km \u00b7 ${truck.kelas === 'kapal' ? 'Kondisi Mesin' : 'Ban'} ${truck.banPct}%`;
            document.getElementById('sell-modal-price').value = estimateTruckValue(truck);
            document.getElementById('sell-modal').classList.remove('hidden');
        }
        function closeSellModal() {
            sellModalTruckId = null;
            document.getElementById('sell-modal').classList.add('hidden');
        }
        async function confirmSellModal() {
            const truckId = sellModalTruckId;
            if (!truckId) return closeSellModal();
            const harga = Math.round(Number(document.getElementById('sell-modal-price').value));
            const ok = await postTruckToBursa(truckId, harga);
            if (ok) { closeSellModal(); switchTab('tab-bursa'); }
        }

        async function cancelBursaListing(id) {
            const l = bursaListings.find(x => x.id === id && x.sellerUid === currentAccount.id);
            if (!l) return;
            try {
                await fb.cancelBursaListing(id);
                bursaListings = bursaListings.filter(x => x.id !== id);
                companyFleet.push(l.truck);   // truk kembali ke garasi
                populateTruckDropdowns(); renderFleetDashboard(); updateCashDisplay();
                addLog(`BURSA P2P: Iklan truk ${l.truck.id} [${l.truck.plat}] dibatalkan, unit kembali ke garasi.`, 'info');
                renderBursa();
            } catch (e) { showModal('Gagal Membatalkan', 'Coba lagi. (' + (e.code || e.message) + ')', 'fa-triangle-exclamation', 'red'); }
        }

        async function buyBursaListing(id) {
            const l = bursaListings.find(x => x.id === id);
            if (!l || bursaBuyBusy.has(id) || !currentAccount) return;
            if (l.sellerUid === currentAccount.id) return;
            if (companyCash < l.harga) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(l.harga)} untuk membeli ${l.truck.name}.`, 'fa-triangle-exclamation', 'red');
            bursaBuyBusy.add(id); renderBursa();
            try {
                const data = await fb.buyBursaListing(id, currentAccount.id, currentAccount.company);
                const truck = { ...data.truck };
                if (companyFleet.some(t => t.id === truck.id) || bursaListings.some(x => x.sellerUid === currentAccount.id && x.truck.id === truck.id)) {
                    let n = companyFleet.length + 1;
                    while (companyFleet.some(t => t.id === 'TRK-' + String(n).padStart(2, '0'))) n++;
                    truck.id = 'TRK-' + String(n).padStart(2, '0');
                }
                truck.status = 'Sedia';
                if (!refineryData.find(k => k.id === truck.depotId && k.is_unlocked && k.mekanikId)) truck.depotId = 'KILANG-01';
                companyCash -= data.harga; totalExpense += data.harga;
                companyFleet.push(truck);
                addFinanceLog(`Bursa P2P: pembelian ${truck.name} [${truck.plat}] dari ${data.sellerCompany}`, -data.harga);
                bursaListings = bursaListings.filter(x => x.id !== id);
                populateTruckDropdowns(); renderFleetDashboard(); updateCashDisplay();
                addLog(`BURSA P2P: Membeli ${truck.name} [${truck.plat}] dari ${esc(data.sellerCompany)} seharga ${formatRupiah(data.harga)}. Unit ditambahkan ke garasi (${truck.id}).`, 'success');
                showModal('Pembelian Berhasil', `${truck.name} [${truck.plat}] resmi jadi milik Anda, berpangkalan di ${(refineryData.find(k => k.id === truck.depotId) || {}).nama || 'Kilang Tuban'}.`, 'fa-circle-check', 'blue');
            } catch (e) {
                if (e.message === 'SOLD') showModal('Sudah Terjual', 'Truk ini baru saja dibeli pemain lain. Cari unit lain di Bursa P2P.', 'fa-circle-exclamation', 'red');
                else if (e.message !== 'SELF') showModal('Gagal Membeli', 'Coba lagi. (' + (e.code || e.message) + ')', 'fa-triangle-exclamation', 'red');
            }
            finally { bursaBuyBusy.delete(id); renderBursa(); }
        }

        function migrateLegacy(sv) {
            let raw = JSON.stringify(sv);
            [
             ['Truk Agen Bright Gas & 12 Kg', 'Truk Agen LPG 12 Kg'], ['Bright Gas', 'LPG Nonsubsidi'], ['SPBU TPPI Jenu', 'SPBU Jenu'], ['Kilang Tuban (TPPI)', 'Kilang Tuban'],
             ['Tangki Besar 18 KL Fuso', 'Tangki Besar 18 KL'], ['Tangki Besar 24 KL FAW', 'Tangki Besar 24 KL Standar'], ['Tangki Besar 24 KL UD', 'Tangki Besar 24 KL Heavy Duty']]
                .forEach(([a, b]) => { raw = raw.split(a).join(b); });
            return JSON.parse(raw.replace(/"kode":"\d\d\.(\d{3})\.(\d\d)"/g, '"kode":"JT-$1-$2"'));
        }

        function applySave(sv) {
            sv = migrateLegacy(sv);
            companyCash = sv.cash; totalIncome = sv.income; totalExpense = sv.expense;
            sv.refineries.forEach(r => { const k = refineryData.find(x => x.id === r.id); if (k) { k.is_unlocked = r.u; k.stok_current = r.s; if (r.m) k.stok_max = r.m; if (r.lvl !== undefined) k.stokUpgradeLevel = r.lvl; if (r.mid !== undefined) k.mekanikId = r.mid; if (r.kap) k.kap = r.kap; } });
            companyFleet = sv.fleet; companyCrew = sv.crew; crewIdCounter = sv.crewCounter; suratJalanCounter = sv.sj; { const saved = sv.spbu || [], m = new Map(saved.map(s => [s.kode, s]));
              loadedSpbuList = loadedSpbuList.map(s => m.get(s.kode) || s);
              const have = new Set(loadedSpbuList.map(s => s.kode)); saved.forEach(s => { if (!have.has(s.kode)) loadedSpbuList.push(s); }); }
            orders = sv.orders || []; ordHist = sv.ordHist || []; nextOrderGt = sv.nextOrderGt || 0;
            // Pesanan SPBU dihitung mundur pakai waktu nyata (lihat ORDER_TTL) - kalau tidak digeser,
            // durasi saat pemain logout ikut terhitung dan banyak pesanan langsung dianggap kedaluwarsa
            // begitu login lagi. Geser jam pembuatan tiap pesanan maju sebesar durasi offline, supaya
            // hitungan mundurnya "berhenti" selama logout, sama seperti jam permainan (gameElapsed).
            if (sv.ts) {
                const offlineMs = Math.max(0, Date.now() - sv.ts);
                if (offlineMs > 0) orders.forEach(o => { o.t += offlineMs; });
            }
            gameElapsed = sv.clock || 0; izinLog = sv.izin || { mi: -1, n: 0 }; companyFleet.forEach(t => { if (!t.kirTs) t.kirTs = Date.parse(t.kir) || gameNow() + 182 * 86400000; if (!t.stnkTs) t.stnkTs = Date.parse(t.stnk) || gameNow() + STNK_PERIOD; if (!t.platTs) t.platTs = gameNow() + PLAT_PERIOD; if (t.kirPending === undefined) t.kirPending = null; if (!t.depotId) t.depotId = 'KILANG-01'; if (t.odometer == null) t.odometer = 0; if (t.banPct == null) t.banPct = 100; if (!t.price) t.price = 500e6; }); companyCrew.forEach(c => { if (c.kilangId === undefined) c.kilangId = null; }); lastSetor = sv.setor != null ? sv.setor : Math.floor(gameElapsed * GAME_SPEED / (MITRA_CFG.cycleDays * DAY_MS)); loadedSpbuList.forEach(x => { if (x.tipe === 'DODO' && x.is_approved && !x.mitra && !x.blocked) x.mitra = newMitra(x); }); appliedTopups = sv.topups || []; pphPaid = sv.pph || 0; bbmSpent = sv.bbm || 0; topupTotal = sv.tsetor || 0;
            document.getElementById('finance-history-log').innerHTML = '';
            financeEntries = [];
            (sv.fin || []).forEach(f => addFinanceLog(f.desc, f.amount));
            recomputeWilayah();
            renderRefineries(); renderSpbuOnMap(); populateSpbuDropdowns(); populateTruckDropdowns();
            populateCrewDropdowns(); renderInvestorTab(); renderFleetDashboard(); renderDriversDashboard();
        }

        // Leaderboard: hanya pemain nyata (koleksi Firestore 'leaderboard'); centang biru dari koleksi 'verified'
        // Listener leaderboard di-broadcast ke SEMUA pemain online tiap kali ada yang publish skor - paling
        // boros kuota baca gratis Firestore. Sengaja hanya menyala selagi tab Peringkat dibuka (lihat switchTab),
        // bukan sepanjang sesi login. Listener 'verified' jauh lebih kecil (cuma pemain centang biru) & dipakai
        // juga di modal Top Up, jadi tetap dibiarkan menyala sepanjang sesi - dampaknya ke kuota kecil.
        let boardRows = [], verMap = {}, verifiedUnsub = null, leaderboardUnsub = null;
        const vbadge = until => until > Date.now() ? ` <i class="fa-solid fa-circle-check text-sky-400 align-middle" title="Terverifikasi sampai ${new Date(until).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}"></i>` : '';
        const boardOpen = () => !document.getElementById('tab-leaderboard').classList.contains('hidden');
        function publishBoard() {
            if (!window.fb || !currentAccount || skipSave) return;
            const st = liveStats();
            fb.publishStats(currentAccount.id, { company: currentAccount.company, owner: currentAccount.owner, cash: Math.round(st.cash), units: st.units, kilang: st.kilang }).catch(e => console.warn('Leaderboard:', e));
        }
        function startVerifiedListener() {
            if (verifiedUnsub || !window.fb || !currentAccount) return;
            verifiedUnsub = fb.listenVerified(m => { verMap = m; renderVerified(); if (boardOpen()) renderLeaderboard(); });
            publishBoard();
        }
        function startLeaderboardListener() {
            if (leaderboardUnsub || !window.fb || !currentAccount) return;
            leaderboardUnsub = fb.listenBoard(r => { boardRows = r; if (boardOpen()) renderLeaderboard(); });
        }
        function stopLeaderboardListener() { if (leaderboardUnsub) { leaderboardUnsub(); leaderboardUnsub = null; } }
        function renderVerified() {
            if (!currentAccount) return;
            const u = verMap[currentAccount.id] || 0;
            document.getElementById('kpis-verified').innerHTML = vbadge(u);
            const t = document.getElementById('topup-verif');
            if (t) t.textContent = u > Date.now() ? 'Centang biru aktif sampai ' + new Date(u).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Akun belum terverifikasi';
        }
        function getBoard() {
            const me = currentAccount ? currentAccount.id : null;
            const rows = boardRows.filter(r => r.uid !== me).map(r => ({ uid: r.uid, name: r.company || '-', owner: r.owner || '-', cash: r.cash || 0, units: r.units || 0, kilang: r.kilang || 0, until: verMap[r.uid] || 0 }));
            if (currentAccount) rows.push({ uid: me, name: currentAccount.company, owner: currentAccount.owner, ...liveStats(), until: verMap[me] || 0, me: true });
            return rows;
        }

        function fmtShort(n) {
            if (n >= 1e12) return 'Rp ' + (n / 1e12).toFixed(2).replace('.', ',') + ' T';
            if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace('.', ',') + ' M';
            if (n >= 1e6) return 'Rp ' + Math.round(n / 1e6) + ' jt';
            return formatRupiah(Math.round(n));
        }

        function setLbSort(k) { lbSort = k; renderLeaderboard(); }

        function renderLeaderboard() {
            const rows = getBoard().sort((a, b) => b[lbSort] - a[lbSort] || b.cash - a.cash || b.units - a.units);
            document.getElementById('lb-sorts').innerHTML = [['cash', 'Uang', 'fa-coins'], ['units', 'Unit', 'fa-truck'], ['kilang', 'Kilang', 'fa-oil-well']].map(([k, l, ic]) =>
                `<button onclick="setLbSort('${k}')" class="py-1.5 rounded-lg text-[11px] font-bold border transition ${lbSort === k ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40' : 'text-gray-400 border-gray-800 hover:border-gray-600'}"><i class="fa-solid ${ic} mr-1"></i>${l}</button>`).join('');
            const my = rows.findIndex(r => r.me);
            document.getElementById('lb-mine').innerHTML = my < 0 ? '' : `<div class="bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent border border-yellow-500/30 rounded-lg p-2.5 flex justify-between items-center text-xs"><span class="text-gray-300 flex items-center gap-1.5"><i class="fa-solid fa-user text-yellow-400"></i>Peringkat Anda</span><span class="font-black text-yellow-400 text-base">#${my + 1}<span class="text-[10px] text-gray-500 font-normal"> dari ${rows.length}</span></span></div>`;

            if (!rows.length) {
                document.getElementById('lb-podium').innerHTML = '';
                document.getElementById('lb-list').innerHTML = '<div class="text-xs text-gray-500 text-center py-6"><i class="fa-solid fa-trophy text-2xl text-gray-700 block mb-2"></i>Belum ada data peringkat.</div>';
                return;
            }

            // ===== PODIUM: 3 besar ditonjolkan (rank 1 di tengah & lebih besar), sisanya (rank 4+) jadi list biasa =====
            const MEDAL = [
                { ring: 'ring-yellow-400', badge: 'bg-yellow-500 text-gray-900', ic: 'fa-crown', ictxt: 'text-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,.4)]', pos: 'order-2', size: 'w-16 h-16 text-2xl -mt-3' },
                { ring: 'ring-gray-300', badge: 'bg-gray-300 text-gray-900', ic: 'fa-medal', ictxt: 'text-gray-300', glow: '', pos: 'order-1', size: 'w-12 h-12 text-lg' },
                { ring: 'ring-amber-700', badge: 'bg-amber-700 text-white', ic: 'fa-medal', ictxt: 'text-amber-600', glow: '', pos: 'order-3', size: 'w-12 h-12 text-lg' }
            ];
            const top3 = rows.slice(0, 3);
            document.getElementById('lb-podium').innerHTML = top3.map((r, i) => { const m = MEDAL[i]; return `
                <div class="flex flex-col items-center ${m.pos}">
                    <div class="${m.size} rounded-full ring-2 ${m.ring} ${m.glow} bg-gray-900 flex items-center justify-center mb-1.5 relative shrink-0">
                        <i class="fa-solid ${m.ic} ${m.ictxt}"></i>
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${m.badge} border-2 border-gray-950">${i + 1}</div>
                    </div>
                    <div class="text-[11px] font-bold ${r.me ? 'text-yellow-300' : 'text-gray-100'} text-center truncate w-full" title="${esc(r.name)}">${esc(r.name)}</div>
                    <div class="text-[9px] text-gray-500 truncate w-full text-center">${fmtShort(r.cash)}</div>
                </div>`; }).join('');

            const cell = (k, icon, label, v, full) => `<div class="bg-gray-950/70 rounded p-1.5" ${full ? `title="${full}"` : ''}><div class="text-[9px] text-gray-500"><i class="fa-solid ${icon} mr-1"></i>${label}</div><div class="font-mono font-bold text-xs ${lbSort === k ? 'text-yellow-300' : 'text-gray-200'}">${v}</div></div>`;
            document.getElementById('lb-list').innerHTML = rows.length > 3 ? rows.slice(3).map((r, idx) => { const i = idx + 3; return `
                <div class="rounded-lg border p-2.5 transition ${r.me ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 bg-gray-800 text-gray-400">${i + 1}</div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold text-gray-100 truncate">${esc(r.name)}${r.me ? ' <span class="text-[9px] bg-yellow-500 text-gray-900 rounded px-1 py-0.5 ml-1 align-middle">ANDA</span>' : ''}${vbadge(r.until)}</div>
                            <div class="text-[10px] text-gray-500 truncate">Pemilik: ${esc(r.owner)}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1.5 mt-2 text-center">
                        ${cell('units', 'fa-truck', 'Unit', r.units)}
                        ${cell('kilang', 'fa-oil-well', 'Kilang', r.kilang)}
                        ${cell('cash', 'fa-coins', 'Uang', fmtShort(r.cash), formatRupiah(Math.round(r.cash)))}
                    </div>
                </div>`; }).join('') : '';
        }

        // ===== JAM GAME: 1 menit game = 3,5 detik nyata (1 jam game = 3,5 menit nyata, 1 hari game = 84 menit nyata, 1 minggu game = 9,8 jam nyata) =====
        const GAME_START = new Date(2026, 8, 25, 6, 0, 0).getTime(), GAME_SPEED = 60 / 3.5, ORDER_DELAY = 180000; // GAME_SPEED=60/3.5 -> 1 menit in-game = 3,5 detik nyata
        let gameElapsed = 0;
        const gameNow = () => GAME_START + gameElapsed * GAME_SPEED;
        const fmtTime = ms => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
        const fmtDate = ms => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const gameStamp = () => new Date(gameNow()).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + fmtTime(gameNow());
        function renderClock() { document.getElementById('game-date').innerText = fmtDate(gameNow()); document.getElementById('game-time').innerText = fmtTime(gameNow()) + ' WIB'; }
        // Jam game dihitung dari SELISIH waktu nyata (Date.now()), bukan dari jumlah "tick" setInterval yang lewat,
        // supaya akurat. Tapi begitu tab/window tidak aktif (pindah tab, minimize dsb), jam SENGAJA dijeda:
        // selisih waktu selama tersembunyi TIDAK ditambahkan ke gameElapsed. Saat tab aktif lagi, lastClockTick
        // di-reset ke waktu sekarang dulu, jadi jam lanjut jalan normal dari titik terakhir dia berhenti
        // (bukan "mengejar" ketertinggalan).
        let lastClockTick = Date.now();
        function tickClock() {
            const now = Date.now();
            const delta = now - lastClockTick;
            lastClockTick = now;
            if (currentAccount && !document.hidden && delta > 0) gameElapsed += delta;
            renderClock();
        }
        function resumeClock() { lastClockTick = Date.now(); tickClock(); }
        setInterval(tickClock, 500);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeClock(); });
        window.addEventListener('focus', resumeClock);
        renderClock();

        // ===== STOK SPBU & PESANAN OTOMATIS =====
        const busyIds = new Set();
        const FUELS = [
            { id: 'solar', label: 'Solar', cap: 64, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
            { id: 'pertalite', label: 'Pertalite', cap: 64, color: 'text-green-400 border-green-500/40 bg-green-500/10' },
            { id: 'dex', label: 'Dex', cap: 32, color: 'text-teal-300 border-teal-500/40 bg-teal-500/10' },
            { id: 'turbo', label: 'Pertamax Turbo', cap: 32, color: 'text-red-400 border-red-500/40 bg-red-500/10' },
            { id: 'lpg', label: 'LPG', cap: 40, lpg: true, unit: 'Ton', color: 'text-orange-400 border-orange-500/40 bg-orange-500/10' }
        ];
        // Bug fix: dispatch BBM sebelumnya salah mengurangi stok BBL mentah (kilang.stok_current) alih-alih
        // tangki jenis BBM yang benar-benar dipesan SPBU (kilang.kap[key].cur). Mapping ini menghubungkan
        // id jenis BBM di FUELS (dipakai form dispatch) ke key tangki produk jadi di PRODUCT_META/kap.
        const FUEL_KAP_KEY = { solar: 'solar', pertalite: 'pertalite', dex: 'dexlite', turbo: 'pertamax_turbo' };
        let orders = [], ordHist = [], orderSeq = 1;
        const ORDER_BATCH = { BBM: 5, LPG: 3 }, ORDER_TTL = 1470000; // batas maksimal pesanan TERBUKA bersamaan per jenis; TTL: 24,5 menit nyata = 7 jam game (1 menit in-game = 3,5 detik nyata, lihat GAME_SPEED)
        // Pesanan baru muncul BERTAHAP satu per satu (bukan langsung penuh sekaligus begitu ada armada pertama),
        // supaya terasa natural. Jeda dasar antar kemunculan pesanan baru = ORDER_TRICKLE_HOURS jam waktu GAME,
        // dengan sedikit variasi acak (+-30%) biar tidak terasa seperti metronom. Terus jalan sampai jumlah
        // pesanan TERBUKA per jenis menyentuh batas ORDER_BATCH di atas.
        const ORDER_TRICKLE_HOURS = 2;
        let nextOrderGt = 0; // gameNow() paling cepat pesanan baru berikutnya boleh muncul
        // Stok SPBU cuma diturunkan setiap STOK_TICK_MINUTES menit waktu GAME (bukan tiap kali tickStock()
        // dipanggil oleh setInterval, yang jauh lebih sering) - ganti ke 3 kalau mau penurunannya lebih rapat.
        const STOK_TICK_MINUTES = 5;
        let nextStockTickGt = 0; // gameNow() paling cepat stok SPBU boleh diturunkan lagi

        const fuelsOf = s => FUELS.filter(f => !f.lpg || s.has_lpg);
        const capsOf = type => [...new Set(companyFleet.filter(t => t.type === type).map(t => t.cap))];
        // Tingkat keramaian SPBU menentukan seberapa cepat BBM/LPG habis: rata-rata butuh beberapa hari,
        // bukan hitungan jam. Ramai = kota besar/jalur utama, Sepi = daerah kecil, Sedang = di antaranya.
        const TRAFFIC = { Ramai: { p: 0.25, mult: 1.4, label: 'Ramai' }, Sedang: { p: 0.5, mult: 1.0, label: 'Sedang' }, Sepi: { p: 0.25, mult: 0.6, label: 'Sepi' } };
        function pickTraffic() { const r = Math.random(); return r < 0.25 ? 'Ramai' : r < 0.75 ? 'Sedang' : 'Sepi'; }
        // Laju dasar per tick (1 tick tickStock = 12 menit game): tangki penuh SPBU "Sedang" habis rata-rata ~4 hari game.
        const STOK_BASE_RATE = 1 / 480;
        function ensureStok(s) {
            s.stok = s.stok || {};
            if (!s.traffic) s.traffic = pickTraffic();
            fuelsOf(s).forEach(f => { if (s.stok[f.id] == null) s.stok[f.id] = Math.round(f.cap * (0.5 + Math.random() * 0.5) * 10) / 10; });
        }
        function closeOrder(o, status) {
            o.status = status; o.tutup = Date.now();
            orders = orders.filter(x => x !== o);
            ordHist.unshift(o); ordHist = ordHist.slice(0, 15);
        }
        // Begitu pemain beli armada BARU (BBM/LPG - kapal dikecualikan karena tidak melayani SPBU secara
        // langsung, cuma transfer antar kilang/depo), langsung munculkan 1 pesanan SPBU yang ukurannya
        // menyesuaikan kapasitas truk itu - supaya armada baru langsung ada kerjaan, tidak perlu nunggu jeda
        // acak pesanan otomatis (lihat tickStock/ORDER_TRICKLE_HOURS) yang bisa makan waktu cukup lama.
        function spawnOrderForNewTruck(truck) {
            if (truck.kelas === 'kapal') return; // kapal cuma transfer antar Kilang/Depo, tidak pernah melayani SPBU langsung
            try {
                const wantLpg = truck.type === 'LPG';
                const cand = [];
                let nApproved = 0, nApprovedRightFuel = 0, nInRange = 0;
                loadedSpbuList.forEach(s => {
                    if (!isOp(s)) return;
                    nApproved++;
                    ensureStok(s);
                    fuelsOf(s).forEach(f => {
                        if (!!f.lpg !== wantLpg) return; // jenis BBM/LPG harus cocok dengan truk yang baru dibeli
                        nApprovedRightFuel++;
                        if (!(f.lpg ? s.wilayahLpgId : s.wilayahBbmId)) return; // SPBU di luar jangkauan depo aktif jenis ini
                        nInRange++;
                        if (orders.some(o => o.kode === s.kode && o.fuel === f.id)) return; // sudah ada pesanan terbuka jenis ini
                        cand.push({ s, f, ratio: (s.stok[f.id] || 0) / f.cap });
                    });
                });
                if (!cand.length) {
                    // BUG FIX (diagnostik): sebelumnya fungsi ini keluar diam-diam tanpa jejak sama sekali kalau
                    // tidak ketemu kandidat SPBU, jadi pemain tidak pernah tahu KENAPA pesanan tidak muncul.
                    // Sekarang selalu dicatat ke Log Aktivitas, lengkap dengan angka diagnostik penyebabnya:
                    // SPBU aktif (isOp) yang jenis bahan bakarnya cocok tapi tidak masuk radius layanan 200 km
                    // dari Kilang/Depo aktif manapun (mis. baru main & belum buka Depo cabang di dekat SPBU itu),
                    // atau semua SPBU yang cocok sudah kebagian pesanan terbuka jenis yang sama.
                    const label = wantLpg ? 'LPG' : 'BBM';
                    addLog(`ARMADA ${truck.id}: belum ada pesanan yang bisa dibuat otomatis untuk armada ${label} ini. SPBU aktif: ${nApproved}, jenis ${label} cocok: ${nApprovedRightFuel}, masuk jangkauan 200km Kilang/Depo aktif: ${nInRange}. ${nInRange === 0 ? 'Kemungkinan besar belum ada SPBU jenis ini yang terjangkau dari Kilang/Depo yang sudah dibuka - buka Depo cabang lebih dekat di tab Kilang.' : 'Kemungkinan semua SPBU yang terjangkau sudah punya pesanan terbuka jenis ini - cek tab Pesanan.'}`, 'warning');
                    return;
                }
                cand.sort((a, b) => a.ratio - b.ratio); // SPBU dengan stok paling menipis diprioritaskan
                const { s, f } = cand[0];
                const kl = Math.min(truck.cap, Math.round(f.cap * 0.8 * 10) / 10), unit = f.unit || 'KL';
                orders.push({ id: orderSeq++, kode: s.kode, nama: s.nama, region: s.region, prov: s.provinsi || 'Jawa Timur', fuel: f.id, kl, unit, terkirim: 0, inTransit: 0, tahap: null, lockedTruckId: null, t: Date.now(), gt: gameNow(), status: 'open' });
                addLog(`PESANAN BARU (Armada ${truck.id}): ${s.nama} (${s.region}) memesan ${kl} ${unit} ${f.label} - ukuran menyesuaikan kapasitas armada baru Anda.`, 'purple');
                notify(`Armada baru siap kerja: pesanan ${kl} ${unit} ${f.label} untuk ${s.nama} menanti dikirim.`, 'info');
                renderOrders();
            } catch (e) {
                // BUG FIX: sebelumnya kalau ada error tak terduga di sini, seluruh proses berhenti diam-diam
                // (order tidak jadi dibuat, badge tidak ke-update) tanpa jejak apa pun buat pemain maupun kita
                // lacak nanti. Sekarang errornya tetap ditangkap & dicatat ke Log Aktivitas supaya kelihatan.
                addLog(`ARMADA ${truck.id}: gagal membuat pesanan otomatis karena error internal (${e.message}). Coba buka tab Pesanan manual atau laporkan ini.`, 'warning');
                console.error('spawnOrderForNewTruck error:', e);
            }
        }
        function tickStock() {
            const now = Date.now();
            processKirPending();
            orders.slice().forEach(o => { if (now - o.t > ORDER_TTL) {
                const s = loadedSpbuList.find(x => x.kode === o.kode);
                if (s) { ensureStok(s); s.stok[o.fuel] = FUELS.find(f => f.id === o.fuel).cap * 0.6; }
                addLog(`PESANAN BATAL: ${o.nama} membeli ${fuelLabel(o.fuel)} dari pesaing karena pesanan ${o.kl} ${o.unit || 'KL'} tidak dipenuhi.`, 'warning');
                closeOrder(o, 'Batal');
            } });
            if (gameNow() >= nextStockTickGt) {
                loadedSpbuList.forEach(s => {
                    if (!isOp(s)) return;
                    ensureStok(s);
                    const mult = TRAFFIC[s.traffic || 'Sedang'].mult;
                    fuelsOf(s).forEach(f => { s.stok[f.id] = Math.max(0, Math.round((s.stok[f.id] - f.cap * STOK_BASE_RATE * mult * (0.7 + Math.random() * 0.6)) * 10) / 10); });
                });
                nextStockTickGt = gameNow() + STOK_TICK_MINUTES * 60000;
            }
            // Pesanan datang BERTAHAP satu-satu (lihat ORDER_TRICKLE_HOURS/nextOrderGt di atas), bukan langsung
            // penuh sekaligus - terus jalan sampai jumlah pesanan TERBUKA per jenis menyentuh batas ORDER_BATCH.
            // SPBU sudah masuk kandidat pesanan begitu stoknya turun ke antara 80%-100% kapasitas tangki timbun
            // (acak tiap kali dicek) - jadi SPBU minta pasokan lebih dini & bervariasi, selagi stoknya masih
            // cukup banyak, bukan menunggu sampai hampir habis.
            const ORDER_TRIGGER_RATIO = 0.8 + Math.random() * 0.2;
            const openBBM = orders.filter(o => o.fuel !== 'lpg').length, openLPG = orders.filter(o => o.fuel === 'lpg').length;
            const slotBBMOpen = openBBM < ORDER_BATCH.BBM, slotLPGOpen = openLPG < ORDER_BATCH.LPG;
            if ((slotBBMOpen || slotLPGOpen) && gameElapsed >= ORDER_DELAY && gameNow() >= nextOrderGt) {
                // Ukuran pesanan = kapasitas armada milik pemain (BBM: KL, LPG: Ton)
                const cand = [];
                loadedSpbuList.forEach(s => { if (isOp(s)) fuelsOf(s).forEach(f => {
                    ensureStok(s);
                    if (f.lpg ? !slotLPGOpen : !slotBBMOpen) return; // jenis ini sudah penuh, jangan diundi dulu
                    if (orders.some(o => o.kode === s.kode && o.fuel === f.id)) return; // SPBU ini sudah punya pesanan jenis ini yang masih terbuka
                    // BBM maupun LPG cuma boleh bikin pesanan kalau SPBU-nya masih dalam jangkauan depo aktif
                    // yang sesuai jenisnya (lihat MAX_SERVICE_KM/nearestActiveKilang) - di luar itu, dianggap
                    // belum terjangkau layanan sama sekali (SPBU tidak akan pernah minta pasokan ke sana).
                    if (f.lpg ? !s.wilayahLpgId : !s.wilayahBbmId) return;
                    const ratio = (s.stok[f.id] || 0) / f.cap;
                    if (ratio > ORDER_TRIGGER_RATIO) return; // masih di atas ambang (80%-100%), belum perlu pesan
                    // Ukuran pesanan HARUS mengikuti kapasitas armada yang benar-benar dimiliki pemain untuk jenis
                    // ini (BBM maupun LPG) - kalau belum punya truk jenis itu sama sekali, jangan buat pesanan
                    // (sama seperti BBM: tidak ada armada = tidak ada pesanan yang bisa/perlu ditawarkan).
                    const sizes = capsOf(f.lpg ? 'LPG' : 'BBM').filter(c => c <= f.cap * 0.8);
                    if (sizes.length) cand.push({ s, f, sizes, r: ratio });
                }); });
                if (cand.length) {
                    // SPBU dengan sisa stok (rasio) paling kecil menang duluan - yang paling butuh dilayani lebih dulu.
                    cand.sort((x, y) => x.r - y.r);
                    const { s, f, sizes } = cand[0];
                    const kl = sizes[Math.floor(Math.random() * sizes.length)], unit = f.unit || 'KL';
                    // inTransit: volume yang sudah "dipesankan" ke armada yang sedang berjalan (belum tentu sampai) -
                    // dipakai supaya pesanan yang sudah dikirim langsung hilang dari daftar terbuka meski belum
                    // dinyatakan Selesai (baru Selesai setelah truk benar-benar tiba & tuntas bongkar muatan).
                    // tahap: fase perjalanan armada yang sedang menuju pesanan ini ('berangkat'|'tiba'|'bongkar'|null).
                    orders.push({ id: orderSeq++, kode: s.kode, nama: s.nama, region: s.region, prov: s.provinsi || 'Jawa Timur', fuel: f.id, kl, unit, terkirim: 0, inTransit: 0, tahap: null, lockedTruckId: null, t: now, gt: gameNow(), status: 'open' });
                    addLog(`PESANAN OTOMATIS (${fmtTime(gameNow())}): ${s.nama} (${s.region}) memesan ${kl} ${unit} ${f.label} - sisa stok ${s.stok[f.id]} ${unit} (${Math.round(s.stok[f.id] / f.cap * 100)}% dari tangki).`, 'purple');
                    notify(`Pesanan baru masuk: ${s.nama} - ${kl} ${unit} ${f.label}. Buka tab Pesanan.`, 'info');
                    // Jeda acak (+-30%) sebelum pesanan berikutnya boleh muncul, biar kedatangannya terasa bertahap.
                    nextOrderGt = gameNow() + ORDER_TRICKLE_HOURS * 3600000 * (0.7 + Math.random() * 0.6);
                }
            }
            const p0 = refineryData[0], pp = p0.stok_current / p0.stok_max;
            if (pp <= 0.2 && !bbmWarned) { bbmWarned = true; renderRefineries(); addLog(`PERINGATAN: Stok bahan bakar Kilang Tuban tinggal ${Math.round(pp * 100)}%. Segera beli pasokan di menu Kilang.`, 'warning'); }
            else if (pp > 0.3) bbmWarned = false;
            renderOrders();
        }
        const fuelLabel = id => (FUELS.find(f => f.id === id) || {}).label || id;

        function fulfilOrder(spbu, label, truck) {
            const f = truck.type === 'LPG' ? FUELS.find(x => x.lpg) : (truck.type === 'BBM' ? FUELS.find(x => x.label === label) : null); if (!f) return 0;
            ensureStok(spbu);
            spbu.stok[f.id] = Math.min(f.cap, Math.round(((spbu.stok[f.id] || 0) + truck.cap) * 10) / 10);
            const o = orders.find(x => x.kode === spbu.kode && x.fuel === f.id);
            if (!o) return 0;
            o.terkirim += truck.cap;
            // Lepas volume truk ini dari "sedang dalam perjalanan" - sudah benar2 sampai & dibongkar, bukan cuma
            // dijanjikan. Kalau masih ada sisa dan pesanan ini terkunci ke truk ini (kirim bertahap), pesanan
            // TETAP tersembunyi dari daftar terbuka (lockedTruckId belum dilepas) - truk yang sama ini yang wajib
            // balik lagi melunasinya, bukan truk lain (lihat isOrderDispatchable & orderLockBlock).
            o.inTransit = Math.max(0, (o.inTransit || 0) - truck.cap);
            if (o.terkirim >= o.kl) closeOrder(o, 'Selesai');
            else if (o.inTransit <= 0) o.tahap = null;
            addLog(`PESANAN DIPENUHI: ${truck.cap} ${f.unit || 'KL'} ${f.label} untuk ${spbu.nama}. Bonus pesanan otomatis +${Math.round(ECO.bonusPesanan * 100)}%.`, 'success');
            renderOrders();
            return Math.round(truck.cap * (f.lpg ? ECO.jualTon : ECO.jualKl) * ECO.bonusPesanan);
        }
        function kirimPesanan(id) {
            const o = orders.find(x => x.id === id); if (!o) return;
            if (o.fuel === 'lpg') { document.getElementById('delivery-region-filter').value = 'ALL'; populateSpbuDropdowns('ALL'); document.getElementById('lpg-spbu-select').value = o.kode; switchTab('tab-lpg'); return; }
            document.getElementById('delivery-region-filter').value = 'ALL';
            populateSpbuDropdowns('ALL');
            document.getElementById('delivery-spbu-select').value = o.kode;
            document.getElementById('delivery-fuel-type').value = fuelLabel(o.fuel);
            switchTab('tab-delivery');
        }
        let ordFuelFilter = 'ALL';
        let ordKilangFilter = 'ALL';
        function setOrdFuel(f) { ordFuelFilter = f; renderOrders(); }
        function setOrdKilang(key) { ordKilangFilter = key; renderOrders(); }
        // BUG FIX (Pesanan): pesanan yang seluruh sisanya sudah "dipesankan" ke truk yang sedang jalan (inTransit)
        // dianggap tidak lagi butuh aksi dari pemain, jadi TIDAK dihitung/ditampilkan di daftar Pesanan terbuka.
        // Pesanan yang terkunci (lockedTruckId, kirim bertahap) JUGA selalu disembunyikan dari daftar terbuka -
        // termasuk saat truk yang mengunci sedang balik ke pool untuk muat ulang (inTransit sempat 0 lagi) -
        // karena pesanan ini eksklusif milik truk itu sampai lunas, bukan lagi rebutan truk lain (lihat orderLockBlock).
        const isOrderDispatchable = o => !o.lockedTruckId && (o.kl - o.terkirim - (o.inTransit || 0)) > 0;
        function renderOrders() {
            const badge = document.getElementById('ord-badge');
            const openCount = orders.filter(isOrderDispatchable).length;
            badge.innerText = openCount; badge.classList.toggle('hidden', !openCount);
            const sel = document.getElementById('ord-prov');
            if (sel.options.length === 1) WILAYAH.forEach(w => sel.add(new Option(w[0], w[0])));
            if (document.getElementById('tab-orders').classList.contains('hidden')) return;
            document.querySelectorAll('.ord-fuel-btn').forEach(b => { const on = b.dataset.f === ordFuelFilter; b.classList.toggle('bg-amber-600', on); b.classList.toggle('shadow', on); b.classList.toggle('text-white', on); b.classList.toggle('text-gray-400', !on); });
            const pv = sel.value, now = Date.now();
            const live = o => { const s = loadedSpbuList.find(x => x.kode === o.kode); return s && s.stok ? s.stok[o.fuel] : 0; };
            const matchFuel = o => ordFuelFilter === 'ALL' || (ordFuelFilter === 'LPG' ? o.fuel === 'lpg' : o.fuel !== 'lpg');
            const open = orders.filter(o => isOrderDispatchable(o) && (pv === 'ALL' || o.prov === pv) && matchFuel(o)).sort((a, b) => live(a) - live(b));
            const dOrders = orders.filter(isOrderDispatchable);
            const kpi = (l, v, c, ic) => `<div class="stat-chip"><i class="fa-solid ${ic} ${c} stat-chip-icon"></i><div class="stat-chip-label">${l}</div><div class="stat-chip-value ${c}">${v}</div></div>`;
            document.getElementById('ord-kpi').innerHTML = kpi('Pesanan BBM', dOrders.filter(o => o.fuel !== 'lpg').length, 'text-blue-400', 'fa-gas-pump') + kpi('Pesanan LPG', dOrders.filter(o => o.fuel === 'lpg').length, 'text-orange-400', 'fa-fire') + kpi('Stok Habis', dOrders.filter(o => live(o) <= 0).length, 'text-amber-400', 'fa-triangle-exclamation') + kpi('Total Diminta', dOrders.filter(o => !o.unit || o.unit === 'KL').reduce((n, o) => n + o.kl - o.terkirim - (o.inTransit || 0), 0) + ' KL' + (dOrders.some(o => o.unit === 'Ton') ? ' + ' + dOrders.filter(o => o.unit === 'Ton').reduce((n, o) => n + o.kl - o.terkirim - (o.inTransit || 0), 0) + ' T' : ''), 'text-emerald-400', 'fa-truck-ramp-box');
            // ===== KELOMPOKKAN PESANAN PER KILANG/DEPO SUMBER =====
            // Setiap pesanan dikaitkan ke kilang/depo AKTIF terdekat yang benar-benar men-supply jenis produknya
            // (lihat recomputeWilayah/nearestActiveKilang). Kalau pemain sudah membuka kilang/depo kedua,
            // pesanan SPBU di sekitarnya otomatis masuk bagian kilang itu sendiri, terpisah dari bagian Kilang Tuban.
            // Pesanan yang sumbernya tidak valid/tidak ketemu (jangan pernah ditebak asal-asalan) masuk bagian "Idle" di akhir.
            const orderAsal = o => {
                const sp = loadedSpbuList.find(x => x.kode === o.kode);
                const asalId = sp ? (o.fuel === 'lpg' ? sp.wilayahLpgId : sp.wilayahBbmId) : null;
                const asalKilang = asalId ? refineryData.find(k => k.id === asalId && k.is_unlocked) : null;
                const asalJarak = asalKilang ? (o.fuel === 'lpg' ? sp.wilayahLpgJarak : sp.wilayahBbmJarak) : null;
                return { sp, asalKilang, asalJarak };
            };
            const orderCardHtml = o => {
                const f = FUELS.find(x => x.id === o.fuel), sisa = live(o), pct = Math.round(sisa / f.cap * 100), left = Math.max(0, Math.round((ORDER_TTL - (now - o.t)) / (60000 / GAME_SPEED))), trf = TRAFFIC[(orderAsal(o).sp && orderAsal(o).sp.traffic) || 'Sedang'].label; // menit game
                const { asalJarak } = orderAsal(o);
                const fIcon = o.fuel === 'lpg' ? 'fa-fire' : 'fa-gas-pump', fText = (f.color.split(' ').find(c => c.startsWith('text-')) || 'text-gray-400');
                return `<div class="bg-gray-900/70 border ${sisa <= 0 ? 'border-red-500/50' : 'border-gray-800'} rounded-xl p-3 space-y-2 hover:border-amber-500/30 transition">
                  <div class="flex items-start gap-2.5">
                    <div class="shrink-0 w-8 h-8 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center"><i class="fa-solid ${fIcon} text-xs ${fText}"></i></div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2"><div class="text-xs font-bold text-gray-100 truncate">${esc(o.nama)}</div><span class="text-[9px] font-bold border rounded-full px-2 py-0.5 shrink-0 ${f.color}">${f.label}</span></div>
                      <div class="text-[10px] text-gray-500 mt-0.5">${esc(o.region)} &middot; ${esc(o.prov)} &middot; Keramaian ${trf}${asalJarak != null ? ` &middot; &plusmn;${asalJarak} km dari depo` : ''}${o.gt ? ' &middot; ' + new Date(o.gt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(o.gt) : ''}</div>
                    </div>
                  </div>
                  <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden"><div class="${pct <= 0 ? 'bg-red-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'} h-full rounded-full" style="width:${pct}%"></div></div>
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-[10px] text-gray-400 leading-tight">${sisa <= 0 ? '<b class="text-red-400">STOK HABIS</b>' : `Sisa <b class="text-amber-400">${sisa} ${f.unit || 'KL'}</b>/${f.cap}`} <span class="mx-0.5 text-gray-700">&middot;</span> Pesan <b class="text-emerald-400">${o.kl - o.terkirim - (o.inTransit || 0)} ${o.unit || 'KL'}</b> <span class="inline-flex items-center gap-1 ml-1 bg-gray-950 border border-gray-800 rounded-full px-1.5 py-0.5 text-gray-400"><i class="fa-regular fa-clock"></i>${Math.floor(left / 60)}j ${left % 60}m</span></div>
                    <button onclick="kirimPesanan(${o.id})" class="shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow shadow-emerald-900/30"><i class="fa-solid fa-paper-plane text-[9px]"></i>Kirim</button>
                  </div>
                </div>`;
            };
            const ordGroups = new Map(); // id kilang (atau 'IDLE') -> { kilang, orders: [] }
            open.forEach(o => {
                const { asalKilang } = orderAsal(o);
                const key = asalKilang ? asalKilang.id : 'IDLE';
                if (!ordGroups.has(key)) ordGroups.set(key, { kilang: asalKilang, orders: [] });
                ordGroups.get(key).orders.push(o);
            });
            const refOrderIdx = refineryData.map(k => k.id);
            const ordGroupKeys = [...ordGroups.keys()].sort((a, b) => (a === 'IDLE' ? 1 : b === 'IDLE' ? -1 : refOrderIdx.indexOf(a) - refOrderIdx.indexOf(b)));
            // Chip filter kilang/depo: klik salah satu (atau klik langsung judul grupnya) untuk cuma menampilkan pesanan kilang itu.
            const kilangChips = refineryData.filter(k => k.is_unlocked).map(k => ({ key: k.id, label: k.nama }));
            if (ordGroups.has('IDLE')) kilangChips.push({ key: 'IDLE', label: 'Idle' });
            document.getElementById('ord-kilang-tabs').innerHTML = [{ key: 'ALL', label: 'Semua Kilang' }, ...kilangChips].map(c =>
                `<button onclick="setOrdKilang('${c.key}')" class="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${ordKilangFilter === c.key ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 border-violet-500 text-white shadow shadow-violet-900/30' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'}">${esc(c.label)}</button>`
            ).join('');
            const visibleGroupKeys = ordGroupKeys.filter(key => ordKilangFilter === 'ALL' || key === ordKilangFilter);
            document.getElementById('ord-list').innerHTML = open.length && visibleGroupKeys.length ? visibleGroupKeys.map(key => {
                const grp = ordGroups.get(key), k = grp.kilang;
                return `<div class="space-y-2">
                  <div onclick="setOrdKilang('${key}')" class="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${k ? 'text-violet-300' : 'text-amber-400'} bg-gray-950/60 border ${k ? 'border-violet-500/20' : 'border-amber-500/20'} rounded-lg px-2.5 py-1.5 cursor-pointer select-none" title="Klik untuk hanya tampilkan bagian ini">
                    <i class="fa-solid ${k ? (k.id === 'KILANG-01' ? 'fa-industry' : 'fa-warehouse') : 'fa-triangle-exclamation'}"></i>
                    <span>${k ? esc(k.nama) : 'Idle &middot; Belum Ada Kilang/Depo Aktif'}</span>
                    <span class="ml-auto font-mono text-[10px] bg-gray-900 border border-gray-800 rounded-full px-2 py-0.5 normal-case text-gray-400">${grp.orders.length} pesanan</span>
                  </div>
                  <div class="space-y-2">${grp.orders.map(orderCardHtml).join('')}</div>
                </div>`;
            }).join('') : (companyFleet.length ? `<div class="text-xs text-gray-500 text-center py-6 bg-gray-950/60 border border-gray-800 rounded-xl"><i class="fa-solid fa-circle-check text-emerald-500/60 text-lg mb-1.5 block"></i>Belum ada pesanan ${ordFuelFilter === 'ALL' ? '' : ordFuelFilter + ' '}yang cocok dengan filter ini. Pesanan muncul otomatis, ukurannya mengikuti kapasitas armada Anda.</div>` : '<div class="text-xs text-gray-500 text-center py-6 bg-gray-950/60 border border-gray-800 rounded-xl"><i class="fa-solid fa-truck-fast text-gray-700 text-lg mb-1.5 block"></i>Belum punya armada. Beli truk dulu (BBM dan/atau LPG); pesanan menyesuaikan kapasitas armada yang Anda miliki.</div>');
            // BUG FIX (Pesanan): pesanan yang sedang dalam perjalanan (inTransit > 0) ikut ditampilkan di sini
            // dengan status "Proses" berjalan (Berangkat -> Tiba -> Bongkar Muat) - jadi begitu truk dikirim,
            // pesanan langsung pindah dari daftar terbuka di atas ke sini, dan otomatis berubah jadi "Selesai"
            // (hijau) sendiri begitu bongkar muatan tuntas, tanpa perlu aksi tambahan dari pemain.
            // Pesanan yang terkunci (kirim bertahap) tetap tampil di sini walau inTransit sempat 0 (truk yang
            // menguncinya lagi balik ke pool buat muat ulang) - biar pemain tidak kehilangan jejak & tahu harus
            // pakai armada yang sama itu untuk lanjut mengirim.
            const TAHAP_LABEL = { berangkat: 'Proses &middot; Berangkat', tiba: 'Proses &middot; Tiba di Tujuan', bongkar: 'Proses &middot; Bongkar Muat' };
            const prosesRows = orders.filter(o => (o.inTransit || 0) > 0 || o.lockedTruckId).map(o =>
                `<div class="flex items-center gap-2 bg-gray-900/70 rounded-lg px-2.5 py-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span><span class="truncate text-gray-300 flex-1">${esc(o.nama)} &middot; ${fuelLabel(o.fuel)} ${o.kl} ${o.unit || 'KL'}</span><b class="text-amber-400 shrink-0">${(o.inTransit || 0) > 0 ? (TAHAP_LABEL[o.tahap] || 'Proses') : `Terkunci &middot; Menunggu ${esc(o.lockedTruckId)}`}</b></div>`);
            const histRows = ordHist.map(o => `<div class="flex items-center gap-2 bg-gray-900/70 rounded-lg px-2.5 py-1.5"><span class="w-1.5 h-1.5 rounded-full ${o.status === 'Selesai' ? 'bg-emerald-400' : 'bg-red-400'} shrink-0"></span><span class="truncate text-gray-300 flex-1">${esc(o.nama)} &middot; ${fuelLabel(o.fuel)} ${o.kl} ${o.unit || 'KL'}</span><b class="${o.status === 'Selesai' ? 'text-emerald-400' : 'text-red-400'} shrink-0">${o.status}</b></div>`);
            document.getElementById('ord-hist').innerHTML = prosesRows.concat(histRows).join('') || '<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i>Belum ada riwayat.</div>';
        }
        setInterval(() => { if (currentAccount) tickStock(); }, 6000);

        setInterval(saveGame, 30000);
        // Heartbeat leaderboard diperlambat jadi tiap 15 menit (dari 5 menit) - broadcast-nya ke semua pemain
        // online lewat listener real-time, jadi ini pengungkit terbesar buat hemat kuota baca Firestore gratis.
        // Auto-publish skor ke leaderboard: sengaja dijarangkan (bukan tiap 15 menit lagi) supaya hemat
        // kuota gratis Firestore - tiap publish ditulis 1x, lalu dikirim ke SEMUA pemain yang tab
        // Peringkat-nya sedang terbuka, jadi makin sering publish = makin boros. Mau ganti jadi tiap
        // berapa jam? Tinggal ubah angka jam di bawah ini (LEADERBOARD_UPDATE_HOURS).
        const LEADERBOARD_UPDATE_HOURS = 3;
        setInterval(publishBoard, LEADERBOARD_UPDATE_HOURS * 60 * 60 * 1000);
        setInterval(renderVerified, 30000);
        setInterval(() => { if (currentAccount && !document.getElementById('tab-leaderboard').classList.contains('hidden')) renderLeaderboard(); }, 3000);
        window.addEventListener('beforeunload', saveGame);

        // ============================================================
        // DEALER: pemilih kategori armada, biar cuma satu kategori yang tampil
        // (nggak perlu scroll panjang ngelewatin semua jenis truk/kapal).
        // ============================================================
        function selectDealerCat(cat) {
            document.querySelectorAll('.dealer-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.dcat === cat));
            document.querySelectorAll('.dealer-cat-panel').forEach(p => p.classList.toggle('hidden', p.dataset.dcatPanel !== cat));
            const strip = document.getElementById('dealer-cat-switch');
            const activeBtn = strip && strip.querySelector('.dealer-cat-btn.active');
            if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        // ============================================================
        // PICKER: ganti semua <select> jadi tombol + lembar pilihan (bottom sheet)
        // <select> asli TETAP ada di DOM (disembunyikan) supaya semua logic lama
        // (populate*, .value=, .selectedIndex=, onchange=...) tetap jalan apa adanya.
        // ============================================================
        (function () {
            const VALUE_DESC = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
            const INDEX_DESC = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
            let activeOverlay = null;

            const ICONS = [
                [/truck|kapal|armada/i, 'fa-truck'],
                [/driver|nahkoda/i, 'fa-id-card'],
                [/kernet|abk|mekanik/i, 'fa-user-gear'],
                [/spbu|target|depot/i, 'fa-gas-pump'],
                [/region|prov|wilayah/i, 'fa-map-location-dot'],
                [/fuel|type|lpg-type|muatan/i, 'fa-droplet'],
                [/pkg|paket/i, 'fa-box'],
                [/ban-days|hari/i, 'fa-calendar-days'],
            ];
            function iconFor(sel) {
                const key = sel.id || '';
                for (const [re, ic] of ICONS) if (re.test(key)) return ic;
                return 'fa-list-ul';
            }
            function titleFor(sel) {
                const lbl = sel.parentElement && sel.parentElement.querySelector('label');
                if (lbl) return lbl.textContent.replace(/:\s*$/, '').trim();
                return sel.getAttribute('aria-label') || 'Pilih';
            }
            function currentLabel(sel) {
                const opt = sel.options[sel.selectedIndex];
                return opt ? opt.text : '-- Pilih --';
            }
            function isPlaceholderText(t) { return /^--.*--$/.test((t || '').trim()); }

            function refreshBtn(sel) {
                const btn = sel._pickerBtn;
                if (!btn) return;
                const span = btn.querySelector('.pb-label');
                const txt = currentLabel(sel);
                span.textContent = txt;
                span.classList.toggle('pb-placeholder', isPlaceholderText(txt) || !sel.value);
                btn.disabled = !sel.options.length;
                btn.classList.toggle('opacity-60', !sel.options.length);
            }

            function closeOverlay() {
                if (!activeOverlay) return;
                const ov = activeOverlay, btn = ov._forBtn;
                ov.classList.remove('show');
                if (btn) btn.classList.remove('open');
                setTimeout(() => ov.remove(), 160);
                activeOverlay = null;
                document.removeEventListener('keydown', onEsc);
            }
            function onEsc(e) { if (e.key === 'Escape') closeOverlay(); }

            function openPicker(sel) {
                closeOverlay();
                const overlay = document.createElement('div');
                overlay.className = 'picker-overlay';
                overlay._forBtn = sel._pickerBtn;

                const sheet = document.createElement('div');
                sheet.className = 'picker-sheet';
                overlay.appendChild(sheet);

                const head = document.createElement('div');
                head.className = 'picker-sheet-head';
                head.innerHTML = `<div class="picker-sheet-title"><span><i class="fa-solid ${iconFor(sel)} mr-1.5 text-emerald-400"></i>${esc(titleFor(sel))}</span><span class="picker-sheet-close"><i class="fa-solid fa-xmark"></i></span></div>`;
                head.querySelector('.picker-sheet-close').onclick = closeOverlay;
                sheet.appendChild(head);

                const leafCount = sel.querySelectorAll('option').length;
                let searchInput = null;
                if (leafCount > 7) {
                    const sw = document.createElement('div');
                    sw.className = 'picker-search';
                    sw.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Cari...">`;
                    head.appendChild(sw);
                    searchInput = sw.querySelector('input');
                }

                const body = document.createElement('div');
                body.className = 'picker-sheet-body custom-scrollbar';
                sheet.appendChild(body);

                function makeItem(opt) {
                    const item = document.createElement('button');
                    item.type = 'button';
                    item.className = 'picker-item' + (opt.index === sel.selectedIndex ? ' active' : '');
                    item.dataset.text = (opt.text || '').toLowerCase();
                    if (opt.disabled) {
                        item.disabled = true;
                        item.innerHTML = `<span class="pi-check"></span><span>${esc(opt.text)}</span>`;
                    } else {
                        item.innerHTML = `<span class="pi-check"><i class="fa-solid fa-check"></i></span><span class="flex-1 min-w-0">${esc(opt.text)}</span>`;
                        item.onclick = () => {
                            VALUE_DESC.set.call(sel, opt.value);
                            refreshBtn(sel);
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            sel.dispatchEvent(new Event('input', { bubbles: true }));
                            closeOverlay();
                        };
                    }
                    return item;
                }

                function renderList() {
                    body.innerHTML = '';
                    let shown = 0;
                    Array.from(sel.children).forEach(child => {
                        if (child.tagName === 'OPTGROUP') {
                            const opts = Array.from(child.children);
                            const wrap = document.createElement('div');
                            wrap.className = 'picker-group';
                            const lbl = document.createElement('div');
                            lbl.className = 'picker-group-label';
                            lbl.textContent = child.label || '';
                            wrap.appendChild(lbl);
                            let groupShown = 0;
                            opts.forEach(opt => {
                                const t = (opt.text || '').toLowerCase();
                                if (searchInput && searchInput._q && !t.includes(searchInput._q)) return;
                                wrap.appendChild(makeItem(opt));
                                groupShown++; shown++;
                            });
                            if (groupShown) body.appendChild(wrap);
                        } else if (child.tagName === 'OPTION') {
                            const t = (child.text || '').toLowerCase();
                            if (searchInput && searchInput._q && !t.includes(searchInput._q)) return;
                            body.appendChild(makeItem(child));
                            shown++;
                        }
                    });
                    if (!shown) body.innerHTML = '<div class="picker-empty">Tidak ada hasil.</div>';
                }
                renderList();

                if (searchInput) {
                    searchInput.addEventListener('input', () => {
                        searchInput._q = searchInput.value.trim().toLowerCase();
                        renderList();
                    });
                }

                document.body.appendChild(overlay);
                overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeOverlay(); });
                requestAnimationFrame(() => overlay.classList.add('show'));
                if (sel._pickerBtn) sel._pickerBtn.classList.add('open');
                activeOverlay = overlay;
                document.addEventListener('keydown', onEsc);
                if (searchInput && !('ontouchstart' in window)) setTimeout(() => searchInput.focus(), 180);
            }

            function enhanceSelect(sel) {
                if (sel.dataset.pickerEnhanced || sel.multiple) return;
                sel.dataset.pickerEnhanced = '1';

                const wrap = document.createElement('div');
                wrap.className = 'picker-wrap';
                sel.parentNode.insertBefore(wrap, sel);
                wrap.appendChild(sel);
                sel.classList.add('picker-native');
                sel.tabIndex = -1;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = sel.className.replace('picker-native', '') + ' picker-btn';
                btn.innerHTML = `<i class="fa-solid ${iconFor(sel)} pb-ico"></i><span class="pb-label"></span><i class="fa-solid fa-chevron-down pb-chev"></i>`;
                btn.onclick = () => openPicker(sel);
                wrap.appendChild(btn);
                sel._pickerBtn = btn;

                Object.defineProperty(sel, 'value', {
                    configurable: true,
                    get() { return VALUE_DESC.get.call(sel); },
                    set(v) { VALUE_DESC.set.call(sel, v); refreshBtn(sel); }
                });
                Object.defineProperty(sel, 'selectedIndex', {
                    configurable: true,
                    get() { return INDEX_DESC.get.call(sel); },
                    set(v) { INDEX_DESC.set.call(sel, v); refreshBtn(sel); }
                });

                sel.addEventListener('change', () => refreshBtn(sel));
                new MutationObserver(() => refreshBtn(sel)).observe(sel, { childList: true, subtree: true });

                refreshBtn(sel);
            }

            function scanAndEnhance(root) {
                (root.matches && root.matches('select') ? [root] : Array.from(root.querySelectorAll ? root.querySelectorAll('select') : [])).forEach(enhanceSelect);
            }

            window.addEventListener('DOMContentLoaded', () => scanAndEnhance(document.body));
            document.querySelectorAll('select').forEach(enhanceSelect);

            new MutationObserver(muts => {
                muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) scanAndEnhance(n); }));
            }).observe(document.body, { childList: true, subtree: true });
        })();

        updateCashDisplay();
        renderDealerCatalog();
        initSpbuDatabase();
        initAuth();
        switchLogTab('general');
