        // ===== KATALOG DEALER ARMADA =====
        const DEALER_CATALOG = [
            // --- Mobil Tangki BBM ---
            { list: 'dealer-bbm-list', type: 'BBM', name: 'Tangki Kecil 8 KL (BBM)', short: 'Tangki Kecil (8 KL)', cap: 8, price: 520000000, engine: 'Diesel 4 Silinder Turbo 190 PS', axle: '2 Sumbu (6 Roda)', capText: '8.000 Liter · 2 kompartemen' },
            { list: 'dealer-bbm-list', type: 'BBM', name: 'Tangki Menengah 16 KL (BBM)', short: 'Tangki Menengah (16 KL)', cap: 16, price: 980000000, engine: 'Diesel 6 Silinder 235 PS', axle: '3 Sumbu Rigid (10 Roda)', capText: '16.000 Liter · 4 kompartemen' },
            { list: 'dealer-bbm-list', type: 'BBM', name: 'Tangki Besar 18 KL (BBM)', short: 'Tangki Besar (18 KL)', cap: 18, price: 1100000000, engine: 'Diesel 6 Silinder 260 PS', axle: '3 Sumbu Rigid (10 Roda)', capText: '18.000 Liter · 4 kompartemen' },
            { list: 'dealer-bbm-list', type: 'BBM', name: 'Tangki Besar 24 KL Standar (BBM)', short: 'Tangki Besar (24 KL)', cap: 24, price: 1400000000, engine: 'Diesel 6 Silinder 290 PS', axle: '3 Sumbu Rigid (10 Roda)', capText: '24.000 Liter · 5 kompartemen' },
            { list: 'dealer-bbm-list', type: 'BBM', name: 'Tangki Besar 24 KL Heavy Duty (BBM)', short: 'Tangki Besar (24 KL)', cap: 24, price: 1650000000, engine: 'Diesel 6 Silinder 330 PS Euro 4', axle: '3 Sumbu Rigid (10 Roda)', capText: '24.000 Liter · 5 kompartemen' },
            { list: 'dealer-bbm-list', type: 'BBM', name: 'Tangki Trailer 32 KL (BBM)', short: 'Tangki Trailer (32 KL)', cap: 32, price: 2300000000, engine: 'Kepala Trailer Diesel 6 Silinder 380 PS', axle: 'Semi-Trailer (18 Roda)', capText: '32.000 Liter · 6 kompartemen' },
            // --- LPG curah: Pressure Tanker & Skid Tank ---
            { list: 'dealer-lpg-bulk-list', type: 'LPG', name: 'Pressure Tanker LPG 8 Ton', short: 'Pressure Tanker (8 Ton)', cap: 8, price: 880000000, engine: 'Diesel 4 Silinder Turbo 190 PS', axle: '2 Sumbu (6 Roda)', capText: '8 Ton LPG Curah (Pressure Vessel)' },
            { list: 'dealer-lpg-bulk-list', type: 'LPG', name: 'Skid Tank LPG 15 Ton', short: 'Skid Tank (15 Ton)', cap: 15, price: 1550000000, engine: 'Diesel 6 Silinder 235 PS', axle: '3 Sumbu Rigid (10 Roda)', capText: '15 Ton LPG Curah' },
            { list: 'dealer-lpg-bulk-list', type: 'LPG', name: 'Skid Tank LPG 20 Ton Trailer', short: 'Skid Tank Trailer (20 Ton)', cap: 20, price: 2400000000, engine: 'Kepala Trailer Diesel 6 Silinder 400 PS', axle: 'Semi-Trailer (18 Roda)', capText: '20 Ton LPG Curah (Pressure Vessel)' },

            // --- Kapal Tanker (khusus transfer Kilang Pusat <-> Depo Cabang yang punya akses pelabuhan) ---
            { list: 'dealer-kapal-bbm-list', type: 'BBM', kelas: 'kapal', name: 'Tanker Pesisir 50.000 Bbl (Coastal)', short: 'Coastal Tanker (50.000 Bbl)', cap: 50000, price: 10000000000, engine: 'Marine Diesel 2.400 HP', axle: 'Coastal Tanker · di bawah 50.000 DWT (antar-pulau/pantai)', capText: '50.000 Bbl · Tanker Curah Pesisir' },
            { list: 'dealer-kapal-bbm-list', type: 'BBM', kelas: 'kapal', name: 'MR Tanker Nusa Sagara 250.000 Bbl', short: 'MR / GP Tanker (250.000 Bbl)', cap: 250000, price: 50000000000, engine: 'Marine Diesel 8.000 HP', axle: 'Medium Range / General Purpose · 17.000–45.000 DWT', capText: '250.000 Bbl · Tanker Curah MR/GP' },
            { list: 'dealer-kapal-bbm-list', type: 'BBM', kelas: 'kapal', name: 'Aframax MT Galunggong 500.000 Bbl', short: 'Aframax / LR2 (500.000 Bbl)', cap: 500000, price: 150000000000, engine: 'Marine Diesel 14.000 HP', axle: 'Large Range / Aframax · 80.000–120.000 DWT', capText: '500.000 Bbl · Tanker Curah Aframax' },
            { list: 'dealer-kapal-bbm-list', type: 'BBM', kelas: 'kapal', name: 'Suezmax Permatina Halmahera 800.000 Bbl', short: 'Suezmax (800.000 Bbl)', cap: 800000, price: 300000000000, engine: 'Marine Diesel 18.000 HP', axle: 'Suezmax · 125.000–156.000 DWT', capText: '800.000 Bbl · Tanker Curah Suezmax' },
            { list: 'dealer-kapal-bbm-list', type: 'BBM', kelas: 'kapal', name: 'VLCC Pertamini Pride 2.000.000 Bbl', short: 'VLCC (2.000.000 Bbl)', cap: 2000000, price: 500000000000, engine: 'Marine Diesel 30.000 HP', axle: 'Very Large Crude Carrier · 300.000+ DWT', capText: '2.000.000 Bbl · Tanker Minyak Mentah Raksasa' },
            { list: 'dealer-kapal-lpg-list', type: 'LPG', kelas: 'kapal', name: 'Small LPG Gas Antasenu 3.000 Ton', short: 'Small LPG (3.000 Ton)', cap: 3000, price: 15000000000, engine: 'Marine Diesel 3.500 HP', axle: 'Small LPG Carrier · 1.700–3.800 MT (2.000–4.000 CBM)', capText: '3.000 Ton LPG Curah · Kapal Kecil (pelabuhan kecil/antar-pulau)' },
            { list: 'dealer-kapal-lpg-list', type: 'LPG', kelas: 'kapal', name: 'Midsize LPG Gas Widuro 15.000 Ton', short: 'Midsize LPG (15.000 Ton)', cap: 15000, price: 100000000000, engine: 'Marine Diesel 9.000 HP', axle: 'Midsize LPG Carrier · 15.000–17.400 MT', capText: '15.000 Ton LPG Curah · Kapal Menengah (rute regional)' },
            { list: 'dealer-kapal-lpg-list', type: 'LPG', kelas: 'kapal', name: 'VLGC PIZ Prolifik 40.000 Ton', short: 'VLGC (40.000 Ton)', cap: 40000, price: 400000000000, engine: 'Marine Diesel 22.000 HP', axle: 'Very Large Gas Carrier · 56.000–91.000 CBM', capText: '40.000 Ton LPG Curah · Kapal Raksasa (VLGC)' },
            // --- LPG tabung: Truk distribusi agen/SPBE ---
            { list: 'dealer-lpg-agent-list', type: 'LPG', name: 'Truk Agen Tabung 3 Kg (Oranye)', short: 'Agen Tabung 3 Kg (3 Ton)', cap: 3, price: 380000000, engine: 'Diesel 4 Silinder 110 PS', axle: '2 Sumbu (6 Roda)', capText: '3 Ton Tabung LPG 3 Kg' },
            { list: 'dealer-lpg-agent-list', type: 'LPG', name: 'Truk Agen LPG 12 Kg (Biru)', short: 'Agen LPG 12 Kg (4 Ton)', cap: 4, price: 420000000, engine: 'Diesel 4 Silinder 130 PS', axle: '2 Sumbu (6 Roda)', capText: '4 Ton Tabung LPG 12 Kg' },
            { list: 'dealer-lpg-agent-list', type: 'LPG', name: 'Truk Tabung LPG 5 Ton', short: 'Truk Tabung Campuran (5 Ton)', cap: 5, price: 460000000, engine: 'Diesel 4 Silinder 110 PS', axle: '2 Sumbu (6 Roda)', capText: '5 Ton Tabung (3 Kg / 12 Kg)' }
        ];

        // Biaya legalitas saat beli: uji KIR baru + STNK/BBN + pelat nomor (TNKB)
        const regFee = u => { const kir = u.kelas === 'kapal' ? Math.round(u.price * 0.005 / 100000) * 100000 : Math.round((1200000 + u.cap * 150000) / 100000) * 100000, stnk = Math.round(u.price * 0.03 / 100000) * 100000, plat = 500000; return { kir, stnk, plat, total: kir + stnk + plat }; };
        const kirRenewCost = t => Math.round(regFee({ cap: t.cap, price: t.price || 500e6, kelas: t.kelas }).kir * 0.6 / 50000) * 50000;
        const stnkRenewCost = t => Math.round((t.price || 500e6) * 0.02 / 100000) * 100000;
        const platRenewCost = t => 500000;
        const STNK_PERIOD = 5 * 365 * 86400000; // STNK berlaku 5 tahun
        const PLAT_PERIOD = 5 * 365 * 86400000; // Plat nomor (TNKB) berlaku 5 tahun
        const KIR_DISHUB_MS = 3600000; // proses verifikasi Dishub = 1 jam waktu in-game
        const docCls = ts => { const l = ts - gameNow(); return l <= 0 ? 'text-red-400' : l < 30 * 86400000 ? 'text-amber-400' : 'text-emerald-400'; };
        const docTxt = ts => { const l = ts - gameNow(); return dShort(ts) + (l <= 0 ? ' (KEDALUWARSA)' : l < 30 * 86400000 ? ' (segera habis)' : ''); };
        function docBlock(t) {
            const bad = [t.kirTs <= gameNow() ? 'Uji KIR' : '', t.stnkTs <= gameNow() ? 'STNK' : '', t.platTs <= gameNow() ? 'Plat Nomor' : ''].filter(Boolean);
            if (!bad.length) return false;
            showModal('Dokumen Kedaluwarsa', `${t.id} [${t.plat}] tidak boleh jalan: ${bad.join(' & ')} sudah habis. Perpanjang di tab Armada.`, 'fa-file-circle-xmark', 'red'); return true;
        }
        // Proses berkas Uji KIR yang sedang diverifikasi Dishub (dicek tiap tick jam game berjalan)
        function processKirPending() {
            companyFleet.forEach(t => {
                if (t.kirPending && gameNow() >= t.kirPending) {
                    t.kirTs = Math.max(gameNow(), t.kirTs) + 182 * 86400000;
                    t.kirPending = null;
                    addLog(`UJI KIR DISETUJUI DISHUB: berkas ${t.id} [${t.plat}] selesai diverifikasi, KIR baru aktif hingga ${dShort(t.kirTs)}.`, 'success');
                    notify(`Uji KIR ${t.id} [${t.plat}] disetujui Dishub.`, 'success');
                    renderFleetDashboard();
                }
            });
        }
        function renewDoc(id, kind) {
            const t = companyFleet.find(x => x.id === id); if (!t) return;
            if (kind === 'kir') {
                if (t.kirPending) return showModal('Sedang Diproses Dishub', `Berkas Uji KIR ${t.id} [${t.plat}] masih diverifikasi Dishub, estimasi selesai ${fmtTime(t.kirPending)} (waktu in-game).`, 'fa-hourglass-half', 'blue');
                const cost = kirRenewCost(t);
                if (companyCash < cost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(cost)}.`, 'fa-triangle-exclamation', 'red');
                companyCash -= cost; totalExpense += cost;
                t.kirPending = gameNow() + KIR_DISHUB_MS;
                addFinanceLog(`Uji KIR dikirim ke Dishub ${t.id} [${t.plat}]`, -cost);
                addLog(`UJI KIR DIKIRIM: berkas ${t.id} [${t.plat}] dikirim ke Dishub untuk verifikasi.`, 'info');
                showModal('Uji KIR Dikirim ke Dishub', `Berkas Uji KIR untuk ${t.id} [${t.plat}] sudah dikirim ke Dishub. Proses verifikasi memakan waktu 1 jam (waktu in-game), estimasi selesai pukul ${fmtTime(t.kirPending)} WIB.`, 'fa-paper-plane', 'blue');
                updateCashDisplay(); renderFleetDashboard();
                return;
            }
            const cost = kind === 'stnk' ? stnkRenewCost(t) : platRenewCost(t);
            if (companyCash < cost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(cost)}.`, 'fa-triangle-exclamation', 'red');
            companyCash -= cost; totalExpense += cost;
            let newTs;
            if (kind === 'stnk') { t.stnkTs = Math.max(gameNow(), t.stnkTs) + STNK_PERIOD; newTs = t.stnkTs; }
            else { t.platTs = Math.max(gameNow(), t.platTs) + PLAT_PERIOD; newTs = t.platTs; }
            addFinanceLog(`${kind === 'stnk' ? 'Perpanjang STNK/pajak' : 'Perpanjang Plat Nomor'} ${t.id} [${t.plat}]`, -cost);
            showModal(kind === 'stnk' ? 'STNK Diperpanjang' : 'Plat Nomor Diperpanjang', `${kind === 'stnk' ? 'STNK' : 'Plat nomor'} untuk ${t.id} [${t.plat}] berhasil diperpanjang dan berlaku 5 tahun, aktif hingga ${dShort(newTs)}.`, 'fa-circle-check', 'blue');
            updateCashDisplay(); renderFleetDashboard();
        }
        function renderDealerCatalog() {
            document.querySelectorAll('[id^="dealer-"][id$="-list"]').forEach(el => el.innerHTML = '');
            DEALER_CATALOG.forEach((u, idx) => {
                const isBBM = u.type === 'BBM';
                const btn = u.kelas === 'kapal' ? 'bg-cyan-600 hover:bg-cyan-700' : (isBBM ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700');
                const row = document.createElement('div');
                row.className = 'p-2.5 bg-gray-900 rounded-lg border border-gray-800 flex justify-between items-center gap-2';
                row.innerHTML = `
                    <div class="min-w-0">
                        <div class="font-bold text-gray-200">${u.short}</div>
                        <div class="text-[10px] text-gray-400">${u.axle} • ${u.engine}</div>
                        <div class="text-[10px] text-gray-500">${u.capText}</div>
                        <div class="text-emerald-400 font-mono font-bold mt-0.5">${formatRupiah(u.price)}</div>
                        <div class="text-[10px] text-gray-500">+ KIR/STNK/plat ${formatRupiah(regFee(u).total)}</div>
                    </div>
                    <button onclick="buyFromCatalog(${idx})" class="${btn} text-white px-3 py-1.5 rounded font-semibold transition shrink-0">Beli Unit</button>
                `;
                document.getElementById(u.list).appendChild(row);
            });
        }

        function buyFromCatalog(idx) {
            const u = DEALER_CATALOG[idx];
            openDealerConfirm(u.name, u.cap, u.type, u.price, u.engine, u.axle, u.capText, u.kelas);
        }

        function openDealerConfirm(name, cap, type, price, engine, axle, capText, kelas) {
            pendingTruckPurchase = { name, cap, type, price, fee: regFee({ cap, price }), kelas: kelas || 'truk' };
            
            document.getElementById('dealer-spec-name').innerText = name;
            document.getElementById('dealer-spec-engine').innerText = engine;
            document.getElementById('dealer-spec-axle').innerText = axle;
            document.getElementById('dealer-spec-capacity').innerText = capText;
            { const f = regFee({ cap, price }); document.getElementById('dealer-spec-price').innerHTML = formatRupiah(price) + `<br><span class="text-[10px] font-sans font-normal text-gray-400">+ Uji KIR ${formatRupiah(f.kir)} &middot; STNK ${formatRupiah(f.stnk)} &middot; Plat ${formatRupiah(f.plat)}</span><br><span class="text-[11px] font-sans text-amber-300">Total ${formatRupiah(price + f.total)}</span>`; }

            document.getElementById('btn-confirm-buy-truck').onclick = executeTruckPurchase;
            document.getElementById('dealer-modal').classList.remove('hidden');
        }

        function closeDealerModal() {
            document.getElementById('dealer-modal').classList.add('hidden');
            pendingTruckPurchase = null;
        }

        function executeTruckPurchase() {
            if (!pendingTruckPurchase) return;
            
            const { name, cap, type, price, fee, kelas } = pendingTruckPurchase;

            if (companyCash < price + fee.total) {
                closeDealerModal();
                showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(price + fee.total)} (harga unit ${formatRupiah(price)} + KIR/STNK/plat ${formatRupiah(fee.total)}).`, 'fa-triangle-exclamation', 'red');
                return;
            }

            companyCash -= price + fee.total;
            totalExpense += price + fee.total;

            const isKapal = kelas === 'kapal';
            const randomPlat = isKapal ? 'GT ' + Math.floor(100 + Math.random() * 900) + ' NUSA' : 'W ' + Math.floor(1000 + Math.random() * 9000) + ' PK';
            const prefix = isKapal ? 'KPL-' : 'TRK-';
            let truckNo = companyFleet.length + 1;
            while (companyFleet.some(t => t.id === prefix + String(truckNo).padStart(2, '0'))) truckNo++;
            const newTruckId = prefix + String(truckNo).padStart(2, '0');

            const newTruck = {
                id: newTruckId, 
                name: name, 
                cap: cap, 
                type: type, 
                kelas: isKapal ? 'kapal' : 'truk',
                status: 'Sedia',
                plat: randomPlat,
                depotId: 'KILANG-01',
                odometer: 0, banPct: 100,
                price, kirTs: gameNow() + 182 * 86400000, stnkTs: gameNow() + STNK_PERIOD, platTs: gameNow() + PLAT_PERIOD, kirPending: null
            };
            companyFleet.push(newTruck);

            addFinanceLog(`Pembelian ${name} (${newTruckId})`, -price);
            addFinanceLog(`Uji KIR baru ${newTruckId}`, -fee.kir);
            addFinanceLog(`STNK/BBN ${newTruckId}`, -fee.stnk);
            addFinanceLog(`Pelat nomor ${randomPlat}`, -fee.plat);
            spawnOrderForNewTruck(newTruck);
            closeDealerModal();
            updateCashDisplay();
            populateTruckDropdowns();
            renderFleetDashboard();

            addLog(`BERHASIL MEMBELI ARMADA: 1 Unit ${name} [${randomPlat}] ditambahkan ke garasi, berpangkalan di Kilang Tuban.`, 'success');
            showModal('Pembelian Berhasil', `1 Unit ${name} [Plat: ${randomPlat}] berhasil dibeli!<br><br>STNK &amp; Plat Nomor aktif <b>5 tahun</b> sejak hari ini. Silakan assign ${isKapal ? 'Nahkoda & ABK' : 'driver'} saat hendak dispatch, dan atur pangkalan depo di tab Armada.`, 'fa-circle-check', 'blue');
        }

        function formatRupiah(amount) {
            return 'Rp ' + amount.toLocaleString('id-ID');
        }

        function updateCashDisplay() {
            document.getElementById('kpis-cash').innerText = formatRupiah(companyCash);
            document.getElementById('kpis-truck-count').innerText = `${companyFleet.length} Unit`;
            document.getElementById('kpis-driver-count').innerText = `${companyCrew.length} Orang`;
            document.getElementById('fin-income').innerText = formatRupiah(totalIncome);
            document.getElementById('fin-expense').innerText = formatRupiah(totalExpense);
            renderFinance();
            saveGame();
        }

        // ===== LAPORAN KEUANGAN & PPh BADAN =====
        // PPh Badan tiap 2 MINGGU: tiap akhir periode 2 minggu game (14 hari game = ±11,2 jam nyata) terbit tagihan sebesar
        // PPh kumulatif dikurangi yang sudah pernah ditagih. Bayar sebelum jatuh tempo; lewat itu denda otomatis
        // ditambahkan ke tagihan dan makin besar tiap hari game keterlambatan.
        const PPH_TARIF_KECIL = 0.15, PPH_TARIF_UMUM = 0.30;   // tarif SIMULASI game, dinaikkan dari 11% / 22% aslinya
        const PPH_DAY_MS = 86400000, PPH_PERIODE_MS = 14 * PPH_DAY_MS;
        const PPH_JATUH_TEMPO_HARI = 2;                         // batas bayar: 2 hari game (±96 menit nyata) sejak tagihan terbit
        const PPH_DENDA_AWAL = 0.20, PPH_DENDA_PER_HARI = 0.10, PPH_DENDA_MAX = 1.0; // denda 20% begitu lewat tempo, +10%/hari game berikutnya, maksimal 100% dari pokok tagihan
        let pphPaid = 0, pphBilled = 0, pphBills = [], nextPphGt = 0, topupTotal = 0;
        // Tarif: omzet <= Rp 4,8 M pakai tarif kecil; Rp 4,8-50 M campuran (bagian laba setara Rp 4,8 M pertama tarif kecil, sisanya tarif umum); > Rp 50 M tarif umum.
        function calcPph(laba, omzet) {
            if (laba <= 0 || omzet <= 0) return 0;
            if (omzet <= 4.8e9) return Math.round(laba * PPH_TARIF_KECIL);
            if (omzet <= 50e9) { const a = laba * 4.8e9 / omzet; return Math.round(a * PPH_TARIF_KECIL + (laba - a) * PPH_TARIF_UMUM); }
            return Math.round(laba * PPH_TARIF_UMUM);
        }
        const pphPokokBelum = () => pphBills.reduce((n, b) => n + b.amt, 0);
        const pphDendaBelum = () => pphBills.reduce((n, b) => n + b.fine, 0);
        // Dipanggil dari tickStock (tiap ~6 detik): terbitkan tagihan mingguan & hitung denda yang lewat jatuh tempo.
        function tickPph() {
            if (!currentAccount) return;
            const now = gameNow();
            if (!nextPphGt) nextPphGt = GAME_START + PPH_PERIODE_MS;
            let berubah = false;
            if (now >= nextPphGt) {
                const baru = Math.max(0, calcPph(totalIncome - totalExpense, totalIncome) - pphBilled);
                nextPphGt += PPH_PERIODE_MS * Math.max(1, Math.ceil((now - nextPphGt + 1) / PPH_PERIODE_MS)); // lompat ke batas minggu berikutnya (aman kalau game lama ditinggal)
                if (baru > 0) {
                    pphBilled += baru;
                    pphBills.push({ id: Date.now(), amt: baru, gt: now, due: now + PPH_JATUH_TEMPO_HARI * PPH_DAY_MS, fine: 0, rate: 0 });
                    addLog(`PAJAK: Tagihan PPh Badan periode 2 minggu ini terbit ${formatRupiah(baru)}. Bayar di tab Laporan dalam ${PPH_JATUH_TEMPO_HARI} hari game, kalau lewat kena denda otomatis mulai ${Math.round(PPH_DENDA_AWAL * 100)}%.`, 'warning');
                }
                berubah = true;
            }
            pphBills.forEach(b => {
                if (now <= b.due) return;
                const telat = Math.floor((now - b.due) / PPH_DAY_MS);
                const rate = Math.min(PPH_DENDA_MAX, PPH_DENDA_AWAL + PPH_DENDA_PER_HARI * telat);
                if (rate > b.rate) {
                    const pertama = b.rate === 0;
                    b.rate = rate; b.fine = Math.round(b.amt * rate); berubah = true;
                    addLog(`PAJAK: PPh Badan ${formatRupiah(b.amt)} TERLAMBAT ${telat + 1} hari. Denda otomatis ${Math.round(rate * 100)}% = ${formatRupiah(b.fine)}${rate >= PPH_DENDA_MAX ? ' (batas maksimal denda)' : ' dan terus naik tiap hari game'}.`, 'warning');
                }
            });
            if (berubah && typeof renderFinance === 'function') renderFinance();
        }
        function renderFinance() {
            const box = document.getElementById('fin-report'); if (!box) return;
            const laba = totalIncome - totalExpense, tax = calcPph(laba, totalIncome), pokokBelum = pphPokokBelum(), dendaBelum = pphDendaBelum(), kurang = pokokBelum + dendaBelum;
            const row = (l, v, c, b) => `<div class="flex justify-between gap-2 ${b ? 'border-t border-gray-700 pt-1 font-bold' : ''}"><span class="text-gray-400 font-sans">${l}</span><span class="${c || 'text-gray-200'}">${v}</span></div>`;
            const neg = n => (n < 0 ? '(' + formatRupiah(-n) + ')' : formatRupiah(n));
            box.innerHTML = row('Pendapatan (peredaran bruto)', formatRupiah(totalIncome), 'text-emerald-400')
                + row('Beban pembelian bahan bakar', '(' + formatRupiah(bbmSpent) + ')', 'text-red-400')
                + row('Beban armada, SDM &amp; lainnya', '(' + formatRupiah(Math.max(0, totalExpense - bbmSpent)) + ')', 'text-red-400')
                + row('Laba (Rugi) Sebelum Pajak', neg(laba), laba >= 0 ? 'text-emerald-400' : 'text-red-400', true)
                + row('PPh Badan terutang', '(' + formatRupiah(tax) + ')', 'text-amber-300')
                + row('Laba (Rugi) Bersih', neg(laba - tax), laba - tax >= 0 ? 'text-emerald-400' : 'text-red-400', true)
                + row('Kas saat ini', formatRupiah(companyCash), 'text-teal-300', true)
                + row('Setoran modal tambahan (top up)', formatRupiah(topupTotal), 'text-sky-300');
            const estimasi = Math.max(0, tax - pphBilled), jt = pphBills.length ? Math.min(...pphBills.map(b => b.due)) : 0, now = gameNow();
            const sisaMs = nextPphGt ? Math.max(0, nextPphGt - now) : 0;
            document.getElementById('pph-box').innerHTML = row('Dasar pengenaan (laba sebelum pajak)', neg(laba))
                + row('Tarif efektif', laba > 0 ? (tax / laba * 100).toFixed(1).replace('.', ',') + '%' : '-')
                + row('PPh terutang (kumulatif)', formatRupiah(tax), 'text-amber-300')
                + row('Sudah dibayar', formatRupiah(pphPaid), 'text-emerald-400')
                + row('Estimasi PPh periode berjalan (2 minggu)', formatRupiah(estimasi), 'text-gray-300')
                + row('Tagihan berikutnya terbit', nextPphGt ? 'dalam ' + Math.floor(sisaMs / PPH_DAY_MS) + ' hr ' + Math.floor((sisaMs % PPH_DAY_MS) / 3600000) + ' j game' : '-', 'text-gray-300')
                + row('Tagihan PPh belum dibayar', formatRupiah(pokokBelum), pokokBelum ? 'text-amber-300' : 'text-gray-300')
                + (pphBills.length ? row('Jatuh tempo terdekat', jt > now ? 'dalam ' + Math.floor((jt - now) / 3600000) + ' j game' : 'LEWAT ' + Math.floor((now - jt) / 3600000) + ' j game', jt > now ? 'text-gray-300' : 'text-red-400') : '')
                + row('Denda keterlambatan', formatRupiah(dendaBelum), dendaBelum ? 'text-red-400' : 'text-gray-300')
                + row('Total wajib bayar', formatRupiah(kurang), kurang ? 'text-red-400' : 'text-gray-300', true);
            document.getElementById('pph-pay').disabled = kurang <= 0;
            const co = currentAccount ? esc(currentAccount.company) : 'perusahaan';
            document.getElementById('pph-law').innerHTML = `<div class="font-bold text-gray-300">Dasar hukum untuk ${co} (WP badan dalam negeri berbentuk PT)</div>
                <div>&bull; <b>UU No. 7 Tahun 1983</b> tentang Pajak Penghasilan, sebagaimana telah diubah terakhir dengan <b>UU No. 7 Tahun 2021</b> tentang Harmonisasi Peraturan Perpajakan (UU HPP).</div>
                <div>&bull; Tarif umum aslinya: <b>Pasal 17 ayat (1) huruf b</b> = 22%. <b>Di game ini tarif dinaikkan</b> menjadi ${Math.round(PPH_TARIF_UMUM * 100)}% (umum) dan ${Math.round(PPH_TARIF_KECIL * 100)}% (fasilitas omzet kecil).</div>
                <div>&bull; Fasilitas: <b>Pasal 31E ayat (1)</b> (UU No. 36 Tahun 2008) = fasilitas tarif lebih rendah atas penghasilan kena pajak dari bagian peredaran bruto sampai Rp 4,8 miliar, bagi peredaran bruto sampai Rp 50 miliar.</div>
                <div>&bull; <b>Tagihan 2 mingguan &amp; denda (aturan game):</b> PPh ditagih tiap 2 minggu game, jatuh tempo ${PPH_JATUH_TEMPO_HARI} hari game. Lewat tempo, denda otomatis ${Math.round(PPH_DENDA_AWAL * 100)}% dari tagihan, lalu +${Math.round(PPH_DENDA_PER_HARI * 100)}% tiap hari game keterlambatan (maks ${Math.round(PPH_DENDA_MAX * 100)}%).</div>
                <div>&bull; Pelaporan: <b>UU No. 6 Tahun 1983</b> tentang KUP (diubah UU No. 7 Tahun 2021) <b>Pasal 3 ayat (3) huruf b</b>: SPT Tahunan badan paling lambat 4 bulan setelah tahun pajak berakhir.</div>
                <div class="text-gray-500">Simulasi: laba = pendapatan &minus; beban, dihitung kumulatif sejak akun dibuat; tagihan 2 mingguan = PPh kumulatif dikurangi yang sudah ditagih. Bukan konsultasi pajak.</div>`;
        }
        function payPph() {
            const pokok = pphPokokBelum(), denda = pphDendaBelum(), total = pokok + denda;
            if (total <= 0) return showModal('Tidak Ada Tagihan', 'Belum ada tagihan PPh yang terbit. Tagihan baru terbit tiap 2 minggu game.', 'fa-circle-info', 'blue');
            if (companyCash < total) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(total)} untuk melunasi PPh${denda > 0 ? ` (pokok ${formatRupiah(pokok)} + denda ${formatRupiah(denda)})` : ''}.`, 'fa-triangle-exclamation', 'red');
            companyCash -= total; pphPaid += pokok; pphBills = [];
            addFinanceLog('Pembayaran PPh Badan', -pokok);
            if (denda > 0) addFinanceLog('Denda keterlambatan PPh Badan', -denda);
            updateCashDisplay();
            addLog(`PAJAK: PPh Badan ${formatRupiah(pokok)}${denda > 0 ? ` + denda ${formatRupiah(denda)}` : ''} dibayar lunas.`, 'success');
        }

        let financeEntries = [];
        function addFinanceLog(desc, amount) {
            financeEntries.push({ desc, amount }); if (financeEntries.length > 80) financeEntries.shift();
            const container = document.getElementById('finance-history-log');
            const div = document.createElement('div');
            div.className = 'p-2 bg-gray-900 rounded border border-gray-800 flex justify-between items-center';

            const isIncome = amount > 0;
            div.innerHTML = `
                <span class="text-gray-300">${desc}</span>
                <span class="${isIncome ? 'text-emerald-400' : 'text-red-400'} font-bold font-mono">
                    ${isIncome ? '+' : ''}${formatRupiah(amount)}
                </span>
            `;
            container.prepend(div);
        }

        // Tab yang tampil menggantikan peta (Peta & Dealer tetap tampil inline di sidebar)
        const POPUP_TABS = ['tab-kilang', 'tab-hulu', 'tab-dealer', 'tab-delivery', 'tab-lpg', 'tab-kapal', 'tab-fleet', 'tab-bursa', 'tab-drivers', 'tab-partnership', 'tab-finance', 'tab-orders', 'tab-leaderboard'];

        let currentTabId = 'tab-map-view';
        function switchTab(tabId) {
            // Listener leaderboard & daftar lapak Bursa (koleksi bersama, broadcast ke semua pemain online -
            // paling boros kuota baca Firestore gratis) hanya dihidupkan selagi tab terkait benar-benar
            // dibuka, dan dimatikan begitu pindah ke tab lain.
            if (currentTabId === 'tab-leaderboard' && tabId !== 'tab-leaderboard') stopLeaderboardListener();
            if (currentTabId === 'tab-bursa' && tabId !== 'tab-bursa') stopBursaListingsListener();
            currentTabId = tabId;

            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('text-emerald-300', 'bg-emerald-500/10', 'border-emerald-500/25', 'shadow-inner');
                el.classList.add('text-gray-400');
            });

            // kembalikan konten panel sebelumnya (jika ada) ke tempat asal di sidebar
            const panel = document.getElementById('tab-content-panel');
            const popupBody = document.getElementById('tab-popup-body');
            while (popupBody.firstChild) panel.appendChild(popupBody.firstChild);

            const target = document.getElementById(tabId);
            target.classList.remove('hidden');
            if (tabId === 'tab-leaderboard') { startLeaderboardListener(); renderLeaderboard(); }
            if (tabId === 'tab-orders') renderOrders();
            if (tabId === 'tab-delivery' || tabId === 'tab-lpg') populateSpbuDropdowns(document.getElementById('delivery-region-filter') ? document.getElementById('delivery-region-filter').value : 'ALL');
            if (tabId === 'tab-kapal') populateTransferKapal();
            if (tabId === 'tab-hulu' && typeof huluRender === 'function') huluRender();
            if (tabId === 'tab-bursa') { startBursaListingsListener(); renderBursa(); }
            const activeBtn = document.getElementById('btn-' + tabId);
            // Tombol yang bukan bagian nav sidebar (mis. Peringkat di header) sengaja tidak diberi class
            // 'tab-btn', jadi gaya khasnya (gradient kuning trofi) tidak ditimpa warna aktif/nonaktif sidebar ini.
            if (activeBtn.classList.contains('tab-btn')) {
                activeBtn.classList.add('text-emerald-300', 'bg-emerald-500/10', 'border-emerald-500/25', 'shadow-inner');
                activeBtn.classList.remove('text-gray-400');
            }

            const mapViewWrap = document.getElementById('map-view-wrap');
            const tabPanelInline = document.getElementById('tab-panel-inline');
            const leftAside = document.getElementById('left-aside');

            if (POPUP_TABS.includes(tabId)) {
                // Tampilkan konten tab menggantikan peta (bukan overlay) - sidebar tetap bisa diklik
                const icon = activeBtn.querySelector('i'), label = activeBtn.querySelector('span');
                document.getElementById('tab-panel-title').innerHTML = (icon ? icon.outerHTML + ' ' : '') + (label ? label.textContent : '');
                popupBody.appendChild(target);
                mapViewWrap.classList.add('hidden');
                tabPanelInline.classList.remove('hidden');
                // Panel konten sidebar kiri jadi kosong (isinya pindah ke atas) -> sembunyikan & susutkan aside
                panel.classList.add('hidden');
                if (leftAside) leftAside.classList.add('nav-only');
            } else {
                // Peta / Dealer: tampilkan peta lagi & kembalikan panel konten sidebar kiri
                mapViewWrap.classList.remove('hidden');
                tabPanelInline.classList.add('hidden');
                panel.classList.remove('hidden');
                if (leftAside) leftAside.classList.remove('nav-only');
                setTimeout(() => { if (window.map) map.invalidateSize(); }, 60);
            }
        }

        function closeTabPopup() { switchTab('tab-map-view'); }

        const map = L.map('map').setView([-2.5, 117.5], 5);

        // OpenStreetMap standar: gratis, tanpa API key
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        function initSpbuDatabase() {
            // Tiap kota kini mulai dengan 3 SPBU AKTIF (bukan cuma 1): 1 unit COCO milik perusahaan
            // + 2 unit DODO yang sudah otomatis disetujui sejak awal permainan. Jenis layanannya
            // sengaja dicampur (has_lpg berselang-seling per rIndex+sIndex) supaya tiap kota punya
            // kombinasi SPBU + Outlet LPG dan SPBU non-LPG, bukan seragam satu jenis saja.
            // Berlaku untuk SELURUH kota (rawSpbuData yang manual maupun hasil generate WILAYAH).
            const START_APPROVED_PER_KOTA = 3;
            rawSpbuData.forEach((region, rIndex) => {
                const pv = region.provinsi || 'Jawa Timur';

                region.list_spbu.forEach((item, sIndex) => {
                    const isLpgAvailable = ((rIndex + sIndex) % 2 === 0);
                    const isStartApproved = sIndex < START_APPROVED_PER_KOTA;
                    if (sIndex === 0) item = { ...item, tipe: 'COCO' }; else item = { ...item, tipe: 'DODO' };

                    const spbu = {
                        kode: item.kode,
                        nama: item.nama,
                        region: region.kabupaten_kota,
                        provinsi: pv,
                        lat: item.lat,
                        lon: item.lon,
                        tipe: item.tipe,
                        has_lpg: isLpgAvailable,
                        is_approved: isStartApproved
                    };
                    // 2 slot DODO pertama yang di-auto-approve butuh objek mitra langsung (sama seperti
                    // hasil approveMitra manual), supaya iuran bulanan & status tunggakan langsung berjalan.
                    if (isStartApproved && spbu.tipe === 'DODO') spbu.mitra = newMitra(spbu);

                    loadedSpbuList.push(spbu);
                });
            });

            recomputeWilayah();
            renderRefineries();
            renderSpbuOnMap();
            populateSpbuDropdowns();
            populateTruckDropdowns();
            populateCrewDropdowns();
            renderInvestorTab();
            renderFleetDashboard();
            renderDriversDashboard();
        }

