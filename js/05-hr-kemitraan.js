        // ===== KEMITRAAN: izin, tagihan bulanan, blokir otomatis =====
        const DAY_MS = 86400000;
        const MITRA_CFG = { cycleDays: 30, graceDays: 10, izin: { BBM: 60e6, LPG: 100e6 }, bulanan: { BBM: 6e6, LPG: 10e6 }, setorCoco: { BBM: 1.5e6, LPG: 2.5e6 }, maxIzinBulan: 20 };
        let izinLog = { mi: -1, n: 0 };
        const miNow = () => Math.floor((gameNow() - GAME_START) / (MITRA_CFG.cycleDays * DAY_MS));
        let lastSetor = 0;
        const NAMA_MITRA = ['Maju Jaya', 'Berkah Energi', 'Sumber Rejeki', 'Karya Mandiri', 'Nusa Petro', 'Cahaya Utama', 'Mitra Sejahtera', 'Bumi Lestari', 'Sinar Timur', 'Tirta Abadi', 'Artha Prima', 'Gemilang Karya'];
        const dShort = ms => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const jenisKey = s => s.has_lpg ? 'LPG' : 'BBM';
        function newMitra(s) {
            const k = jenisKey(s);
            return { nama: (Math.random() < 0.6 ? 'PT ' : 'CV ') + NAMA_MITRA[Math.floor(Math.random() * NAMA_MITRA.length)], bulanan: MITRA_CFG.bulanan[k], rel: 0.6 + Math.random() * 0.37, due: gameNow() + MITRA_CFG.cycleDays * DAY_MS, telat: false, telatSejak: 0, lastDay: -1, lastTagih: -1, sejak: gameNow(), total: 0 };
        }
        function renderInvestorTab() { renderMitraSearch(); renderMitraActive(); }
        function renderMitraSearch() {
            const c = document.getElementById('investor-spbu-list'); if (!c) return;
            const q = (document.getElementById('mitra-q').value || '').toLowerCase().trim(), jf = document.getElementById('mitra-lpg').value;
            const all = loadedSpbuList.filter(x => !x.is_approved && x.tipe === 'DODO' && (jf === 'ALL' || jenisKey(x) === jf) && (!q || `${x.region} ${x.provinsi} ${x.nama} ${x.kode}`.toLowerCase().includes(q)));
            const list = all.slice(0, q ? 30 : 10);
            const kuota = `<div class="text-[10px] text-pink-300 bg-pink-500/10 border border-pink-500/30 rounded px-2 py-1">Kuota izin bulan ini: ${izinLog.mi === miNow() ? izinLog.n : 0}/${MITRA_CFG.maxIzinBulan}</div>`;
            if (!list.length) { c.innerHTML = kuota + '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i>Tidak ada lokasi tersedia untuk pencarian ini.</div>'; return; }
            c.innerHTML = kuota + list.map(x => { const k = jenisKey(x); return `<div class="p-2.5 bg-gray-900 rounded-lg border border-gray-800 flex justify-between items-center gap-2">
                <div class="min-w-0"><div class="text-[10px] text-purple-400 font-bold">${x.kode} <span class="${x.has_lpg ? 'text-amber-400' : 'text-gray-400'}">&middot; ${x.has_lpg ? 'SPBU + LPG' : 'SPBU tanpa LPG'}</span></div>
                <div class="font-bold text-gray-200 text-xs truncate">${esc(x.nama)}</div><div class="text-[10px] text-gray-400">${esc(x.region)} &middot; ${esc(x.provinsi || '')}</div>
                <div class="text-[10px] text-emerald-400">Izin ${formatRupiah(MITRA_CFG.izin[k])} &middot; Iuran ${formatRupiah(MITRA_CFG.bulanan[k])}/bln</div></div>
                <button onclick="approveMitra('${x.kode}')" class="shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-[10px] font-bold shadow">Setujui</button></div>`; }).join('')
                + (all.length > list.length ? `<div class="text-[10px] text-gray-500 text-center">Menampilkan ${list.length} dari ${all.length}. Persempit pencarian.</div>` : '');
        }
        function approveMitra(kode) {
            const x = loadedSpbuList.find(v => v.kode === kode); if (!x || x.is_approved) return;
            const k = jenisKey(x), fee = MITRA_CFG.izin[k];
            if (izinLog.mi !== miNow()) izinLog = { mi: miNow(), n: 0 };
            if (izinLog.n >= MITRA_CFG.maxIzinBulan) return showModal('Kuota Izin Habis', `Maksimal ${MITRA_CFG.maxIzinBulan} izin mitra baru per bulan game. Coba lagi bulan depan.`, 'fa-ban', 'red');
            izinLog.n++;
            x.is_approved = true; x.blocked = false; x.mitra = newMitra(x); x.mitra.total = fee;
            companyCash += fee; totalIncome += fee; addFinanceLog(`Biaya izin mitra ${x.mitra.nama} - ${x.nama}`, fee); updateCashDisplay();
            renderSpbuOnMap(); populateSpbuDropdowns(); renderInvestorTab();
            map.flyTo([x.lat, x.lon], 11);
            addLog(`PERIZINAN DISETUJUI: ${x.nama} (${x.mitra.nama}) aktif di peta. Biaya izin ${formatRupiah(fee)} diterima.`, 'purple');
            showModal('Kemitraan Disetujui', `${x.nama} (${x.mitra.nama}) kini aktif${x.has_lpg ? ' dengan outlet LPG' : ''}. Biaya izin ${formatRupiah(fee)} diterima; iuran ${formatRupiah(x.mitra.bulanan)}/bulan jatuh tempo ${dShort(x.mitra.due)}.`, 'fa-circle-check', 'purple');
        }
        function revokeMitra(x) {
            x.blocked = true; x.blockedAt = gameNow();
            orders.filter(o => o.kode === x.kode).forEach(o => closeOrder(o, 'Batal'));
            addLog(`LISENSI DICABUT: ${x.nama} (${x.mitra.nama}) menunggak lebih dari ${MITRA_CFG.graceDays} hari. SPBU diblokir, operasional OFF.`, 'warning');
            notify(`Lisensi ${x.nama} dicabut & diblokir (tunggakan > ${MITRA_CFG.graceDays} hari). Bisa diambil alih di tab Mitra.`, 'warn');
            renderSpbuOnMap(); populateSpbuDropdowns(); renderInvestorTab();
        }
        function tagihMitra(kode) {
            const x = loadedSpbuList.find(v => v.kode === kode), m = x && x.mitra; if (!m || !m.telat || x.blocked) return;
            const day = Math.floor(gameNow() / DAY_MS); if (m.lastTagih === day) return showModal('Sudah Ditagih', 'Penagihan hanya bisa 1x per hari game.', 'fa-clock', 'purple');
            m.lastTagih = day;
            if (Math.random() < 0.5) { payMitra(x, true); showModal('Tagihan Dibayar', `${m.nama} melunasi tunggakan setelah ditagih.`, 'fa-circle-check', 'purple'); }
            else showModal('Belum Dibayar', `${m.nama} berjanji membayar, tetapi belum ada pembayaran.`, 'fa-hourglass-half', 'purple');
            renderMitraActive();
        }
        function payMitra(x, late) {
            const m = x.mitra; companyCash += m.bulanan; totalIncome += m.bulanan; m.total += m.bulanan;
            addFinanceLog(`Iuran bulanan ${m.nama} - ${x.nama}${late ? ' (terlambat)' : ''}`, m.bulanan);
            m.telat = false; m.due = (late ? gameNow() : m.due) + MITRA_CFG.cycleDays * DAY_MS; updateCashDisplay();
        }
        async function takeOverSpbu(kode) {
            const x = loadedSpbuList.find(v => v.kode === kode); if (!x || !x.blocked) return;
            if (!(await showConfirm(`Ambil alih ${x.nama}? Tunggakan mitra dihapus, SPBU menjadi milik perusahaan dan dikelola swasta.`, { title: 'Ambil Alih SPBU', iconClass: 'fa-hand-holding-dollar', theme: 'blue', okLabel: 'Ambil Alih' }))) return;
            x.mitraLama = x.mitra && x.mitra.nama; delete x.mitra; x.blocked = false; x.tipe = 'COCO'; x.taken = true;
            addLog(`AMBIL ALIH: ${x.nama} kini milik perusahaan & dikelola swasta.`, 'success');
            renderSpbuOnMap(); populateSpbuDropdowns(); renderInvestorTab();
            showModal('Berhasil Diambil Alih', `${x.nama} aktif kembali sebagai SPBU perusahaan (dikelola swasta) dan memberi setoran bulanan.`, 'fa-circle-check', 'blue');
        }
        function tickMitra() {
            const now = gameNow(), day = Math.floor(now / DAY_MS);
            loadedSpbuList.forEach(x => {
                const m = x.mitra; if (!m || !isOp(x)) return;
                if (!m.telat && now >= m.due) {
                    if (Math.random() < m.rel) payMitra(x, false);
                    else { m.telat = true; m.telatSejak = m.due; m.lastDay = day; addLog(`TUNGGAKAN: ${m.nama} (${x.nama}) belum membayar iuran ${formatRupiah(m.bulanan)}.`, 'warning'); notify(`${m.nama} menunggak iuran ${x.nama}. Batas ${MITRA_CFG.graceDays} hari sebelum lisensi dicabut.`, 'warn'); }
                } else if (m.telat) {
                    if (now - m.telatSejak > MITRA_CFG.graceDays * DAY_MS) return revokeMitra(x);
                    if (m.lastDay !== day) { m.lastDay = day; if (Math.random() < 0.2) payMitra(x, true); }
                }
            });
            const mi = miNow();
            if (mi > lastSetor) {
                const bln = mi - lastSetor, gaji = Math.round(companyCrew.reduce((n, c) => n + (ECO[ROLE_META[c.role].salary][0] + c.reputation * ECO[ROLE_META[c.role].salary][1]), 0) * bln);
                if (gaji > 0) { companyCash -= gaji; totalExpense += gaji; addFinanceLog(`Gaji kru (${companyCrew.length} orang, ${bln} bulan)`, -gaji); addLog(`GAJI KRU: ${formatRupiah(gaji)} dibayarkan untuk ${companyCrew.length} kru.`, 'info'); updateCashDisplay(); }
                const own = loadedSpbuList.filter(x => isOp(x) && x.tipe === 'COCO'); let tot = 0;
                own.forEach(x => tot += MITRA_CFG.setorCoco[jenisKey(x)] * (mi - lastSetor));
                lastSetor = mi;
                if (tot > 0) { companyCash += tot; totalIncome += tot; addFinanceLog(`Setoran pengelola swasta (${own.length} SPBU milik perusahaan)`, tot); addLog(`PENDAPATAN SPBU: setoran pengelola swasta ${formatRupiah(tot)} dari ${own.length} SPBU.`, 'success'); updateCashDisplay(); }
            }
            if (!document.getElementById('tab-partnership').classList.contains('hidden')) renderMitraActive();
        }
        function renderMitraActive() {
            const c = document.getElementById('mitra-active-list'); if (!c) return;
            const ms = loadedSpbuList.filter(x => x.mitra && x.is_approved), now = gameNow();
            const act = ms.filter(x => !x.blocked && !x.mitra.telat).length, tel = ms.filter(x => !x.blocked && x.mitra.telat).length, blk = ms.filter(x => x.blocked).length;
            const own = loadedSpbuList.filter(x => isOp(x) && x.tipe === 'COCO'), est = own.reduce((n, x) => n + MITRA_CFG.setorCoco[jenisKey(x)], 0);
            const kpi = (l, v, cl) => `<div class="stat-chip"><div class="stat-chip-label">${l}</div><div class="stat-chip-value ${cl}">${v}</div></div>`;
            document.getElementById('mitra-kpi').innerHTML = kpi('Aktif', act, 'text-emerald-400') + kpi('Menunggak', tel, 'text-amber-400') + kpi('Diblokir', blk, 'text-red-400')
                + `<div class="col-span-3 text-[10px] text-gray-400 bg-gray-900 rounded-lg p-2 border border-gray-800">SPBU milik perusahaan (dikelola swasta): <b class="text-blue-400">${own.length}</b> &middot; estimasi setoran <b class="text-emerald-400">${formatRupiah(est)}</b>/bulan</div>`;
            const order = x => x.blocked ? 0 : x.mitra.telat ? 1 : 2;
            c.innerHTML = ms.length ? ms.sort((a, b) => order(a) - order(b)).map(x => {
                const m = x.mitra; let badge, extra = '', btn = '';
                if (x.blocked) { badge = '<span class="text-red-400 font-bold">DIBLOKIR</span>'; extra = `<div class="text-[10px] text-red-300">Lisensi dicabut ${dShort(x.blockedAt)} &middot; operasional off</div>`; btn = `<button onclick="takeOverSpbu('${x.kode}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-[10px] font-bold">Ambil Alih</button>`; }
                else if (m.telat) { const d = Math.floor((now - m.telatSejak) / DAY_MS); badge = `<span class="text-amber-400 font-bold">MENUNGGAK ${d}/${MITRA_CFG.graceDays} hari</span>`; extra = `<div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1"><div class="bg-red-500 h-full" style="width:${Math.min(100, d / MITRA_CFG.graceDays * 100)}%"></div></div>`; btn = `<button onclick="tagihMitra('${x.kode}')" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded text-[10px] font-bold">Tagih</button>`; }
                else { badge = '<span class="text-emerald-400 font-bold">AKTIF</span>'; extra = `<div class="text-[10px] text-gray-500">Tagihan berikut ${dShort(m.due)} &middot; ${formatRupiah(m.bulanan)}</div>`; }
                return `<div class="p-2.5 bg-gray-900 rounded-lg border ${x.blocked ? 'border-red-500/50' : 'border-gray-800'} flex justify-between items-center gap-2"><div class="min-w-0 flex-1"><div class="text-[10px]">${badge} <span class="text-gray-500">&middot; ${esc(m.nama)}${x.has_lpg ? ' &middot; +LPG' : ''}</span></div><div class="font-bold text-gray-200 text-xs truncate">${esc(x.nama)}</div><div class="text-[10px] text-gray-400">${esc(x.region)}</div>${extra}</div>${btn}</div>`;
            }).join('') : '<div class="text-xs text-gray-500 text-center py-3">Belum ada mitra. Setujui izin di atas.</div>';
        }
        setInterval(() => { if (currentAccount) tickMitra(); }, 3000);

        // DASHBOARD 1: TAB KHUSUS FISIK ARMADA
        // Susun satu kartu armada (dipakai di dalam kelompok jenis+pangkalan pada renderFleetDashboard)
        function fleetCardHtml(trk) {
                const depot = refineryData.find(k => k.id === trk.depotId) || refineryData[0];
                const depotOptions = refineryData.filter(k => k.is_unlocked && k.mekanikId)
                    .map(k => `<option value="${k.id}" ${k.id === trk.depotId ? 'selected' : ''}>${k.nama}</option>`).join('');

                return `<div class="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2.5">
                    <div class="flex justify-between items-center border-b border-gray-800 pb-2">
                        <div>
                            <span class="text-[10px] font-mono bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800">${trk.id}</span>
                            <h4 class="font-bold text-gray-200 text-xs inline-block ml-1.5">${trk.name}</h4>
                        </div>
                        <span class="font-mono font-bold text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">${trk.plat}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div class="bg-gray-950 p-2 rounded border border-gray-800 col-span-2">
                            ${trk.kelas === 'kapal' ? `
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400"><i class="fa-solid fa-route mr-1 text-gray-500"></i>Jarak Tempuh: <b class="text-gray-200 font-mono">${trk.odometer.toLocaleString('id-ID')} km</b></span>
                                <span class="text-gray-400"><i class="fa-solid fa-gauge-high mr-1 text-gray-500"></i>Kondisi Mesin: <b class="${banCls(trk.banPct)} font-mono">${trk.banPct}%</b></span>
                            </div>
                            <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1"><div class="${banBar(trk.banPct)} h-full" style="width:${trk.banPct}%"></div></div>
                            <div class="text-[9px] text-gray-500 mt-0.5">Kapal tidak pakai ban - ini kondisi mesin &amp; lambung, diservis otomatis begitu sandar di depot kalau sudah menipis.</div>
                            ` : `
                            <div class="flex justify-between items-center">
                                <span class="text-gray-400"><i class="fa-solid fa-road mr-1 text-gray-500"></i>Odometer: <b class="text-gray-200 font-mono">${trk.odometer.toLocaleString('id-ID')} km</b></span>
                                <span class="text-gray-400"><i class="fa-solid fa-circle-dot mr-1 text-gray-500"></i>Ban: <b class="${banCls(trk.banPct)} font-mono">${trk.banPct}%</b></span>
                            </div>
                            <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1"><div class="${banBar(trk.banPct)} h-full" style="width:${trk.banPct}%"></div></div>
                            <div class="text-[9px] text-gray-500 mt-0.5">Ban otomatis diganti kru bengkel begitu tiba di depot kalau sisa &le;${TIRE_REPLACE_THRESHOLD}%.</div>
                            `}
                        </div>
                        <div class="bg-gray-950 p-2 rounded border border-gray-800">
                            <span class="text-gray-400 block">Masa Uji KIR:</span>
                            <span class="font-semibold ${docCls(trk.kirTs)} font-mono">${docTxt(trk.kirTs)}</span>
                            ${trk.kirPending
                                ? `<div class="mt-1 text-amber-400 font-sans"><i class="fa-solid fa-hourglass-half mr-1"></i>Diverifikasi Dishub, selesai ${fmtTime(trk.kirPending)}</div>`
                                : `<button onclick="renewDoc('${trk.id}','kir')" class="block mt-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded px-2 py-0.5 font-sans">Kirim ke Dishub ${formatRupiah(kirRenewCost(trk))}</button>`}
                        </div>
                        <div class="bg-gray-950 p-2 rounded border border-gray-800">
                            <span class="text-gray-400 block">STNK Aktif (5 th):</span>
                            <span class="font-semibold ${docCls(trk.stnkTs)} font-mono">${docTxt(trk.stnkTs)}</span>
                            <button onclick="renewDoc('${trk.id}','stnk')" class="block mt-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded px-2 py-0.5 font-sans">Perpanjang ${formatRupiah(stnkRenewCost(trk))}</button>
                        </div>
                        <div class="bg-gray-950 p-2 rounded border border-gray-800">
                            <span class="text-gray-400 block">Plat Nomor (5 th):</span>
                            <span class="font-semibold ${docCls(trk.platTs)} font-mono">${docTxt(trk.platTs)}</span>
                            <button onclick="renewDoc('${trk.id}','plat')" class="block mt-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded px-2 py-0.5 font-sans">Perpanjang ${formatRupiah(platRenewCost(trk))}</button>
                        </div>
                        <div class="bg-gray-950 p-2 rounded border border-gray-800">
                            <span class="text-gray-400 block">Pangkalan Depo:</span>
                            <span class="font-semibold text-teal-300">${depot ? depot.nama : '-'}</span>
                            <select id="depot-sel-${trk.id}" class="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-gray-200 font-sans">${depotOptions}</select>
                            <button onclick="pindahDepot('${trk.id}')" class="block mt-1 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 rounded px-2 py-0.5 font-sans">Pindah Depot ${formatRupiah(DEPOT_MOVE_FEE)}</button>
                        </div>
                    </div>

                    <div class="pt-1 border-t border-gray-800">
                        ${busyIds.has(trk.id)
                            ? `<button disabled class="w-full bg-gray-800/60 text-gray-500 font-semibold py-1.5 rounded-lg text-[11px] cursor-not-allowed"><i class="fa-solid fa-truck-fast mr-1.5"></i>Sedang Bertugas &mdash; Tidak Bisa Dijual</button>`
                            : `<button onclick="openSellModal('${trk.id}')" class="w-full bg-orange-600/90 hover:bg-orange-600 text-white font-semibold py-1.5 rounded-lg text-[11px] transition"><i class="fa-solid fa-right-left mr-1.5"></i>Jual ke Bursa P2P</button>`}
                    </div>
                </div>`;
        }

        const FLEET_CATS = [
            { key: 'truk-bbm', label: 'Truk BBM', icon: 'fa-truck', match: t => t.kelas !== 'kapal' && t.type === 'BBM' },
            { key: 'truk-lpg', label: 'Truk LPG', icon: 'fa-truck-ramp-box', match: t => t.kelas !== 'kapal' && t.type === 'LPG' },
            { key: 'kapal', label: 'Kapal', icon: 'fa-ship', match: t => t.kelas === 'kapal' }
        ];
        let fleetCatFilter = 'ALL', fleetDepotFilter = 'ALL';
        function setFleetCat(key) { fleetCatFilter = key; fleetDepotFilter = 'ALL'; renderFleetDashboard(); }
        function setFleetDepot(key) { fleetDepotFilter = key; renderFleetDashboard(); }
        function renderFleetDashboard() {
            const container = document.getElementById('fleet-list-container');
            container.innerHTML = '';
            if (!companyFleet.length) {
                document.getElementById('fleet-cat-tabs').innerHTML = '';
                document.getElementById('fleet-depot-tabs').innerHTML = '';
                container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-truck-fast"></i>Belum punya armada. Beli truk di tab Dealer Armada (biaya KIR, STNK &amp; plat ikut dibayar).</div>'; return;
            }

            // Chip kategori: klik "Kapal" supaya cuma kapal yang tampil, dst. Klik langsung judul kelompoknya juga sama efeknya.
            document.getElementById('fleet-cat-tabs').innerHTML = [{ key: 'ALL', label: 'Semua', icon: 'fa-layer-group' }, ...FLEET_CATS].map(c =>
                `<button onclick="setFleetCat('${c.key}')" class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition ${fleetCatFilter === c.key ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'}"><i class="fa-solid ${c.icon}"></i>${c.label}</button>`
            ).join('');

            const catsToShow = fleetCatFilter === 'ALL' ? FLEET_CATS : FLEET_CATS.filter(c => c.key === fleetCatFilter);
            const refOrderIdx = refineryData.map(k => k.id);

            // Chip pangkalan: cuma menampilkan depo yang benar-benar punya unit di kategori yang sedang dipilih.
            // Klik nama kilang (mis. "Kilang Tuban") supaya cuma armada berpangkalan di sana yang muncul.
            const scope = catsToShow.flatMap(cat => companyFleet.filter(cat.match));
            const depotSeen = new Map();
            scope.forEach(trk => {
                const depot = refineryData.find(k => k.id === trk.depotId && k.is_unlocked);
                const key = depot ? depot.id : 'IDLE';
                if (!depotSeen.has(key)) depotSeen.set(key, depot);
            });
            const depotKeysAll = [...depotSeen.keys()].sort((a, b) => (a === 'IDLE' ? 1 : b === 'IDLE' ? -1 : refOrderIdx.indexOf(a) - refOrderIdx.indexOf(b)));
            document.getElementById('fleet-depot-tabs').innerHTML = [{ key: 'ALL', label: 'Semua Pangkalan' }, ...depotKeysAll.map(k => ({ key: k, label: k === 'IDLE' ? 'Idle' : depotSeen.get(k).nama }))].map(c =>
                `<button onclick="setFleetDepot('${c.key}')" class="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${fleetDepotFilter === c.key ? 'bg-teal-600 border-teal-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'}">${esc(c.label)}</button>`
            ).join('');

            const html = catsToShow.map(cat => {
                const list = companyFleet.filter(cat.match);
                if (!list.length) return '';
                const byDepot = new Map(); // id kilang (atau 'IDLE') -> { depot, trucks: [] }
                list.forEach(trk => {
                    const depot = refineryData.find(k => k.id === trk.depotId && k.is_unlocked);
                    const key = depot ? depot.id : 'IDLE';
                    if (!byDepot.has(key)) byDepot.set(key, { depot, trucks: [] });
                    byDepot.get(key).trucks.push(trk);
                });
                const depotKeys = [...byDepot.keys()].filter(dk => fleetDepotFilter === 'ALL' || dk === fleetDepotFilter)
                    .sort((a, b) => (a === 'IDLE' ? 1 : b === 'IDLE' ? -1 : refOrderIdx.indexOf(a) - refOrderIdx.indexOf(b)));
                if (!depotKeys.length) return '';
                return `<div class="space-y-2.5">
                  <div onclick="setFleetCat('${cat.key}')" class="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-200 border-b border-gray-700 pb-1.5 cursor-pointer select-none" title="Klik untuk hanya tampilkan kategori ini">
                    <i class="fa-solid ${cat.icon} text-cyan-400"></i><span>${cat.label}</span><span class="ml-auto font-mono text-[10px] bg-gray-900 border border-gray-800 rounded-full px-2 py-0.5 normal-case text-gray-400">${list.length} unit</span>
                  </div>
                  ${depotKeys.map(dk => {
                      const grp = byDepot.get(dk), d = grp.depot;
                      return `<div class="pl-1 space-y-2">
                        <div onclick="setFleetDepot('${dk}')" class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${d ? 'text-teal-400' : 'text-amber-400'} cursor-pointer select-none" title="Klik untuk hanya tampilkan pangkalan ini">
                          <i class="fa-solid ${d ? (d.id === 'KILANG-01' ? 'fa-industry' : 'fa-warehouse') : 'fa-triangle-exclamation'}"></i>
                          <span>${d ? esc(d.nama) : 'Idle &middot; Belum Ada Pangkalan Valid'}</span>
                          <span class="ml-auto font-mono text-[9px] text-gray-500 normal-case">${grp.trucks.length} unit</span>
                        </div>
                        <div class="space-y-2.5">${grp.trucks.map(fleetCardHtml).join('')}</div>
                      </div>`;
                  }).join('')}
                </div>`;
            }).join('');
            container.innerHTML = html || '<div class="text-xs text-gray-500 text-center py-4">Tidak ada armada yang cocok dengan filter ini.</div>';
        }

        // ===== SISTEM REPUTASI KRU =====
        let crewIdCounter = 10;
        let recruitRole = 'Supir';
        let candidatePool = { Supir: [], Kernet: [], Mekanik: [], Nahkoda: [], ABK: [] };

        // Metadata generik per role - dipusatkan di sini biar nambah role baru (Nahkoda/ABK utk kapal)
        // gak perlu ubah ternary di banyak tempat.
        const ROLE_META = {
            Supir:   { salary: 'gajiSupir',   hireBase: 1000000, hirePer: 40000, idPrefix: 'DRV-', icon: 'fa-id-card' },
            Kernet:  { salary: 'gajiKernet',  hireBase: 600000,  hirePer: 20000, idPrefix: 'KRN-', icon: 'fa-user-gear' },
            Mekanik: { salary: 'gajiMekanik', hireBase: 800000,  hirePer: 30000, idPrefix: 'MEK-', icon: 'fa-screwdriver-wrench' },
            Nahkoda: { salary: 'gajiNahkoda', hireBase: 1200000, hirePer: 45000, idPrefix: 'NHK-', icon: 'fa-user-tie' },
            ABK:     { salary: 'gajiABK',     hireBase: 650000,  hirePer: 22000, idPrefix: 'ABK-', icon: 'fa-anchor' }
        };

        const FIRST_NAMES = ['Eko','Setyo','Hendra','Deni','Bambang','Rudi','Agus','Slamet','Wahyu','Dimas','Yusuf','Heru','Bayu','Rizal','Joko','Andi','Fajar','Tono','Rian','Gunawan','Purnomo','Anwar','Imam','Taufik','Hadi','Sugeng'];
        const LAST_NAMES = ['Prasetyo','Budiman','Wijaya','Raharjo','Sukoco','Hartono','Santoso','Saputra','Kurniawan','Nugroho','Utomo','Wibowo','Firmansyah','Setiawan','Susanto','Hidayat','Mulyadi','Suryanto'];

        function repToStars(rep) { return Math.min(5, Math.max(1, Math.round(rep / 20))); }

        function repInfo(rep) {
            if (rep >= 85) return { label: 'Sangat Terpercaya', text: 'text-emerald-400', bar: 'bg-emerald-500' };
            if (rep >= 70) return { label: 'Terpercaya', text: 'text-blue-400', bar: 'bg-blue-500' };
            if (rep >= 50) return { label: 'Cukup', text: 'text-amber-400', bar: 'bg-amber-500' };
            if (rep >= 30) return { label: 'Buruk', text: 'text-orange-400', bar: 'bg-orange-500' };
            return { label: 'Sangat Buruk', text: 'text-red-400', bar: 'bg-red-500' };
        }

        // Peluang pelanggaran per tugas: makin rendah reputasi, makin besar risikonya
        function violationChance(rep) {
            if (rep >= 90) return 0.02;
            if (rep >= 75) return 0.06;
            if (rep >= 60) return 0.15;
            if (rep >= 40) return 0.28;
            return 0.42;
        }

        function riskLabel(rep) {
            const ch = violationChance(rep);
            if (ch <= 0.06) return { label: 'Risiko Rendah', cls: 'text-emerald-400', icon: 'fa-shield-halved' };
            if (ch <= 0.15) return { label: 'Risiko Sedang', cls: 'text-amber-400', icon: 'fa-eye' };
            return { label: 'Risiko Tinggi', cls: 'text-red-400', icon: 'fa-triangle-exclamation' };
        }

        // Harga rekrut: makin tinggi reputasi, makin mahal
        function hireCost(role, rep) {
            const m = ROLE_META[role];
            return Math.round((m.hireBase + rep * m.hirePer) / 50000) * 50000;
        }

        // ===== REKRUTMEN KRU: KANDIDAT =====
        const KOTA = ['Surabaya','Malang','Sidoarjo','Gresik','Tuban','Bojonegoro','Ngawi','Madiun','Kediri','Jember','Banyuwangi','Probolinggo','Pasuruan','Lamongan','Mojokerto','Situbondo'];
        const SKILLS = { Supir: ['Mengemudi','Disiplin','Keselamatan'], Kernet: ['Ketelitian','Stamina','Disiplin'], Mekanik: ['Servis Mesin','Kelistrikan','Ketelitian'],
                         Nahkoda: ['Navigasi','Kepemimpinan','Disiplin'], ABK: ['Stamina','Ketelitian','Kerja Tim'] };
        const TAGS = {
            Supir: ['SIM B2 Umum','Diklat Defensive Driving','Sertifikat Angkutan B3','Hafal Jalur Pantura','Terbiasa Tol Trans-Jawa'],
            Kernet: ['Sertifikat K3 Dasar','Cekatan Bongkar Muat','Paham Prosedur Segel','Pernah Kerja di SPBU','Terlatih APAR'],
            Mekanik: ['Sertifikat Mekanik Diesel','Bengkel Resmi Terlatih','Spesialis Tangki BBM','Pengalaman Kilang/Depo','K3 Bengkel'],
            Nahkoda: ['ANT (Ahli Nautika)','Sertifikat BST','Hafal Jalur Pelayaran Nusantara','Pengalaman Kapal Tanker','Radar & GPS Bersertifikat'],
            ABK: ['Sertifikat BST Dasar','Cekatan Tambat Kapal','Paham Prosedur Muatan B3 Laut','Pernah Berlayar Antar Pulau','Terlatih Alat Keselamatan Laut']
        };
        const AVATAR = ['bg-purple-600','bg-blue-600','bg-emerald-600','bg-amber-600','bg-rose-600','bg-cyan-600','bg-indigo-600'];
        const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
        const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
        let recruitSort = 'cost';
        let confirmCid = null;

        function generateCandidate(role) {
            const used = new Set([...companyCrew.map(c => c.name), ...candidatePool[role].map(c => c.name)]);
            let name, guard = 0;
            do {
                name = FIRST_NAMES[rnd(0, FIRST_NAMES.length - 1)] + ' ' + LAST_NAMES[rnd(0, LAST_NAMES.length - 1)];
                guard++;
            } while (used.has(name) && guard < 50);
            if (used.has(name)) name += ' ' + 'ABCDEFGHJKLMNPRSTW'[rnd(0, 17)] + '.';
            const base = rnd(18, 96);
            const skills = SKILLS[role].map(() => clamp(base + rnd(-12, 12)));
            const reputation = Math.round(skills.reduce((a, b) => a + b, 0) / skills.length);
            const exp = clamp(Math.round((base - 15) / 7) + rnd(0, 3), 0, 25);
            const tags = [...TAGS[role]].sort(() => Math.random() - 0.5).slice(0, base > 70 ? 3 : base > 45 ? 2 : 1);
            return { cid: 'CND-' + (++crewIdCounter), name, role, reputation, skills, exp, tags,
                     age: 19 + exp + rnd(0, 9), kota: KOTA[rnd(0, KOTA.length - 1)], cost: hireCost(role, reputation) };
        }

        function ensureCandidatePool(role, force = false) {
            if (force) candidatePool[role] = [];
            while (candidatePool[role].length < 500) candidatePool[role].push(generateCandidate(role));
        }

        // Hasil satu tugas: pelanggaran -> reputasi turun; sukses -> reputasi naik perlahan
        function applyTripResult(member) {
            member.trips += 1;
            if (Math.random() < violationChance(member.reputation)) {
                const drop = 6 + Math.floor(Math.random() * 7); // -6 s/d -12
                member.reputation = Math.max(0, member.reputation - drop);
                member.violations += 1;
                return { violated: true, drop: drop };
            }
            member.reputation = Math.min(100, member.reputation + 1);
            return { violated: false, drop: 0 };
        }

        // DASHBOARD 2: TAB KHUSUS SDM DRIVER
        function renderDriversDashboard() {
            const container = document.getElementById('driver-list-container');
            container.innerHTML = '';
            if (!companyCrew.length) container.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">Belum ada supir &amp; kernet. Klik Rekrut untuk merekrut kru sebelum bisa mengirim BBM/LPG.</div>';

            companyCrew.forEach(c => {
                const rep = Math.round(c.reputation);
                const info = repInfo(rep);
                const risk = riskLabel(rep);
                const sev = fireSeverance(c);
                const stars = '★'.repeat(repToStars(rep)) + '☆'.repeat(5 - repToStars(rep));
                const violationBadge = c.violations === 0
                    ? `<span class="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold"><i class="fa-solid fa-shield-halved mr-1"></i> Bebas Pelanggaran</span>`
                    : `<span class="text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${c.violations} Pelanggaran Tercatat</span>`;

                const card = document.createElement('div');
                card.className = 'bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2';
                card.innerHTML = `
                    <div class="flex justify-between items-center border-b border-gray-800 pb-2">
                        <div>
                            <span class="text-[10px] font-mono bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded border border-purple-800">${c.id}</span>
                            ${c.awal ? '<span class="text-[9px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded ml-1.5">Kru Awal</span>' : ''}
                            <h4 class="font-bold text-gray-200 text-xs inline-block ml-1.5">${c.name} (${c.role})</h4>
                        </div>
                        <span class="text-amber-400 font-mono font-bold text-xs">${stars}</span>
                    </div>
                    <div>
                        <div class="flex justify-between text-[10px] mb-1">
                            <span class="text-gray-400">Reputasi: <b class="${info.text}">${rep}/100 - ${info.label}</b></span>
                            <span class="${risk.cls}"><i class="fa-solid ${risk.icon} mr-1"></i>${risk.label}</span>
                        </div>
                        <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${info.bar}" style="width:${rep}%"></div></div>
                    </div>
                    ${c.kota ? `<div class="text-[10px] text-gray-500">${c.age} th &middot; ${c.kota} &middot; ${c.exp} th pengalaman</div>` : ''}
                    ${c.role === 'Mekanik' ? `<div class="text-[10px] ${c.kilangId ? 'text-emerald-400' : 'text-amber-400'}"><i class="fa-solid fa-screwdriver-wrench mr-1"></i>${c.kilangId ? 'Bertugas di ' + ((refineryData.find(k => k.id === c.kilangId) || {}).nama || '-') : 'Belum ditugaskan - tugaskan di tab Kilang'}</div>` : ''}
                    <div class="text-[10px] pt-1">
                        <span class="text-gray-400 mr-2">Total Rute: <b>${c.trips} Pengiriman</b></span>
                        ${violationBadge}
                    </div>
                    <div class="pt-2 border-t border-gray-800 space-y-1.5">
                        ${fireId === c.id ? `
                        <div class="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                            Pecat <b>${c.name}</b>? ${sev > 0 ? `Pesangon <b class="font-mono">${formatRupiah(sev)}</b> akan dibayar.` : 'Reputasi buruk: <b>tanpa pesangon</b> (PHK tidak hormat).'}
                            ${companyCrew.filter(x => x.role === c.role).length === 1 ? `<br><i class="fa-solid fa-triangle-exclamation mr-1"></i>Ini ${c.role} terakhir Anda, dispatch tidak bisa dilakukan sebelum merekrut lagi.` : ''}
                        </div>
                        <div class="flex gap-1.5 justify-end">
                            <button onclick="cancelFire()" class="px-2.5 py-1 rounded text-[10px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300">Batal</button>
                            <button onclick="fireCrew('${c.id}')" class="px-2.5 py-1 rounded text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white">Ya, Pecat</button>
                        </div>` : `
                        <div class="flex items-center justify-between text-[10px]">
                            <span class="text-gray-500">Pesangon jika dipecat: <b class="font-mono ${sev > 0 ? 'text-gray-300' : 'text-emerald-400'}">${sev > 0 ? formatRupiah(sev) : 'Rp 0'}</b></span>
                            <button onclick="askFire('${c.id}')" class="px-2.5 py-1 rounded text-[10px] font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition"><i class="fa-solid fa-user-slash mr-1"></i>Pecat</button>
                        </div>`}
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // ===== SISTEM PECAT KRU =====
        let fireId = null;
        // Pesangon: dasar per peran + bonus masa kerja. Reputasi < 30 = PHK tidak hormat (tanpa pesangon)
        function fireSeverance(c) {
            if (Math.round(c.reputation) < 30) return 0;
            const base = c.role === 'Supir' ? 1500000 : c.role === 'Mekanik' ? 900000 : 750000;
            return Math.round((base + c.trips * 40000) / 50000) * 50000;
        }
        function askFire(id) { fireId = id; renderDriversDashboard(); }
        function cancelFire() { fireId = null; renderDriversDashboard(); }
        function fireCrew(id) {
            const idx = companyCrew.findIndex(c => c.id === id);
            if (idx === -1) return;
            const c = companyCrew[idx];
            if (busyIds.has(c.id)) { showModal('Masih Bertugas', `${c.name} sedang dalam perjalanan. Tunggu sampai tiba sebelum dipecat.`, 'fa-truck-fast', 'red'); fireId = null; renderDriversDashboard(); return; }
            const sev = fireSeverance(c);
            if (companyCash < sev) {
                showModal('Kas Tidak Cukup', `Pesangon ${c.name} sebesar ${formatRupiah(sev)} belum bisa dibayar.`, 'fa-circle-xmark', 'red');
                return;
            }
            fireId = null;
            companyCash -= sev;
            totalExpense += sev;
            companyCrew.splice(idx, 1);
            if (c.role === 'Mekanik' && c.kilangId) {
                const k = refineryData.find(x => x.id === c.kilangId);
                if (k && k.mekanikId === c.id) { k.mekanikId = null; renderRefineries(); }
            }
            if (sev > 0) addFinanceLog(`Pesangon PHK ${c.role.toUpperCase()} (${c.name})`, -sev);
            addLog(`PHK: ${c.name} (${c.role}) dipecat${sev > 0 ? ', pesangon ' + formatRupiah(sev) : ' tanpa pesangon (reputasi buruk)'}.`, 'warning');
            updateCashDisplay();
            populateCrewDropdowns();
            renderDriversDashboard();
            renderCandidateList();
            renderFleetDashboard();
        }

        // ===== MODAL REKRUT (BURSA KERJA) =====
        function askHire(cid) { confirmCid = cid; renderCandidateList(); }
        function cancelHire() { confirmCid = null; renderCandidateList(); }

        function openRecruitModal(role) {
            confirmCid = null;
            ['Supir', 'Kernet', 'Mekanik', 'Nahkoda', 'ABK'].forEach(r => ensureCandidatePool(r));
            if (role) recruitRole = role;
            document.getElementById('recruit-status').classList.add('hidden');
            document.getElementById('recruit-modal').classList.remove('hidden');
            renderCandidateList();
        }
        function closeRecruitModal() { document.getElementById('recruit-modal').classList.add('hidden'); }
        function setRecruitRole(role) { recruitRole = role; confirmCid = null; renderCandidateList(); }
        function setRecruitSort(k) { recruitSort = k; renderCandidateList(); }
        function refreshCandidates() { confirmCid = null; ensureCandidatePool(recruitRole, true); renderCandidateList(); }

        function renderCandidateList() {
            document.getElementById('recruit-cash').innerText = formatRupiah(companyCash);
            ['Supir', 'Kernet', 'Mekanik', 'Nahkoda', 'ABK'].forEach(r => {
                const el = document.getElementById('recruit-tab-' + r);
                const n = companyCrew.filter(c => c.role === r).length;
                el.className = 'py-2 rounded-lg text-xs font-bold transition ' + (r === recruitRole ? 'bg-purple-600 text-white shadow' : 'bg-gray-800 text-gray-400 hover:bg-gray-700');
                el.innerHTML = `<i class="fa-solid ${ROLE_META[r].icon} mr-1.5"></i>${r} <span class="opacity-70 font-normal">(${n} di tim)</span>`;
            });
            document.getElementById('recruit-sorts').innerHTML = [['cost', 'Termurah'], ['rep', 'Reputasi Tertinggi'], ['exp', 'Paling Berpengalaman']].map(([k, l]) =>
                `<button onclick="setRecruitSort('${k}')" class="px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${recruitSort === k ? 'bg-purple-600/20 text-purple-300 border-purple-500/40' : 'text-gray-400 border-gray-700 hover:border-gray-500'}">${l}</button>`).join('');

            const sorter = { cost: (a, b) => a.cost - b.cost, rep: (a, b) => b.reputation - a.reputation, exp: (a, b) => b.exp - a.exp || b.reputation - a.reputation }[recruitSort];
            const totalPool = candidatePool[recruitRole].length;
            const list = [...candidatePool[recruitRole]].sort(sorter).slice(0, 10);
            document.getElementById('recruit-sorts').insertAdjacentHTML('beforeend', `<span class="text-[10px] text-gray-500 ml-auto self-center">Tampil ${list.length} dari ${totalPool} kandidat</span>`);
            const container = document.getElementById('candidate-list');
            if (!list.length) {
                container.innerHTML = `<div class="md:col-span-2 text-center text-xs text-gray-400 py-10">Semua kandidat sudah direkrut.<br><button onclick="refreshCandidates()" class="mt-2 text-purple-400 font-semibold hover:text-purple-300"><i class="fa-solid fa-rotate mr-1"></i>Cari kandidat baru</button></div>`;
                return;
            }
            container.innerHTML = list.map(c => {
                const info = repInfo(c.reputation), risk = riskLabel(c.reputation);
                const chance = Math.round(violationChance(c.reputation) * 100);
                const canAfford = companyCash >= c.cost;
                const av = AVATAR[c.name.length % AVATAR.length];
                const stars = repToStars(c.reputation);
                const bars = c.skills.map((v, i) => `<div class="flex items-center gap-2 text-[10px]"><span class="w-16 text-gray-400 shrink-0">${SKILLS[c.role][i]}</span><div class="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${repInfo(v).bar}" style="width:${v}%"></div></div><span class="w-6 text-right font-mono text-gray-300">${v}</span></div>`).join('');
                const tags = c.tags.map(t => `<span class="text-[9px] text-gray-300 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5">${t}</span>`).join('');
                const action = c.cid === confirmCid && canAfford
                    ? `<div class="flex gap-1"><button onclick="cancelHire()" class="px-2 py-1 rounded text-[10px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300">Batal</button><button onclick="hireCandidate('${c.cid}')" class="px-2 py-1 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Ya, Rekrut</button></div>`
                    : `<button onclick="askHire('${c.cid}')" ${canAfford ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${canAfford ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}">${canAfford ? 'Rekrut' : 'Kas Kurang'}</button>`;
                return `<div class="bg-gray-950 border ${c.cid === confirmCid ? 'border-purple-500' : 'border-gray-800'} rounded-xl p-3 flex flex-col gap-2.5">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-full ${av} flex items-center justify-center font-bold text-sm shrink-0">${c.name.split(' ').map(w => w[0]).join('')}</div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold text-gray-100 truncate">${c.name}</div>
                            <div class="text-[10px] text-gray-400">${c.age} th &middot; ${c.kota} &middot; ${c.exp} th pengalaman</div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-amber-400 text-[11px]">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
                            <div class="text-[10px] font-bold ${info.text}">${c.reputation} &middot; ${info.label}</div>
                        </div>
                    </div>
                    <div class="space-y-1">${bars}</div>
                    <div class="flex flex-wrap gap-1">${tags}</div>
                    <div class="flex items-center justify-between gap-2 pt-2 border-t border-gray-800 mt-auto">
                        <div>
                            <div class="text-[10px] ${risk.cls}"><i class="fa-solid ${risk.icon} mr-1"></i>${risk.label} &middot; ${chance}% pelanggaran/tugas</div>
                            <div class="font-mono font-bold text-emerald-400 text-xs">${formatRupiah(c.cost)}</div>
                        </div>
                        ${action}
                    </div>
                </div>`;
            }).join('');
        }

        function hireCandidate(cid) {
            const pool = candidatePool[recruitRole];
            const idx = pool.findIndex(c => c.cid === cid);
            if (idx === -1) return;
            const cand = pool[idx];
            if (companyCash < cand.cost) {
                showModal('Kas Tidak Cukup', `Biaya rekrutmen ${cand.name} adalah ${formatRupiah(cand.cost)}!`, 'fa-circle-xmark', 'red');
                return;
            }
            confirmCid = null;
            companyCash -= cand.cost;
            totalExpense += cand.cost;
            pool.splice(idx, 1);

            crewIdCounter++;
            companyCrew.push({
                id: ROLE_META[cand.role].idPrefix + crewIdCounter,
                name: cand.name, role: cand.role, reputation: cand.reputation,
                violations: 0, status: cand.role === 'Mekanik' ? 'Belum Ditugaskan' : 'Siap Bertugas', trips: 0,
                age: cand.age, exp: cand.exp, kota: cand.kota, kilangId: null
            });

            addFinanceLog(`Rekrut ${cand.role.toUpperCase()} (${cand.name})`, -cand.cost);
            updateCashDisplay();
            populateCrewDropdowns();
            renderDriversDashboard();
            renderCandidateList();
            renderRefineries();
            const st = document.getElementById('recruit-status');
            st.textContent = cand.role === 'Mekanik'
                ? `✓ ${cand.name} berhasil direkrut sebagai Mekanik. Tugaskan ke salah satu kilang/depo di tab Kilang. Sisa kas ${formatRupiah(companyCash)}.`
                : `✓ ${cand.name} berhasil direkrut sebagai ${cand.role}. Sisa kas ${formatRupiah(companyCash)}.`;
            st.classList.remove('hidden');
            addLog(`REKRUT SDM: ${cand.name} bergabung sebagai ${cand.role} (Reputasi ${cand.reputation}) seharga ${formatRupiah(cand.cost)}.`, 'purple');
        }

        // Proses hasil tugas untuk supir + kernet, kembalikan denda & catatan
        function settleCrewResult(driver, kernet) {
            const notes = [];
            let fine = 0;
            const dRes = applyTripResult(driver);
            const kRes = applyTripResult(kernet);

            if (dRes.violated) {
                fine += 2000000;
                notes.push(`${driver.name} melanggar (terlambat/rute) - denda Rp 2jt, reputasi -${dRes.drop}`);
            } else {
                notes.push(`${driver.name} reputasi +1`);
            }
            if (kRes.violated) {
                fine += 500000;
                notes.push(`${kernet.name} lalai bongkar muat - denda Rp 500rb, reputasi -${kRes.drop}`);
            } else {
                notes.push(`${kernet.name} reputasi +1`);
            }
            return { fine, notes, violated: dRes.violated || kRes.violated };
        }

        // Kalau pesanan ini sudah "dikunci" ke armada tertentu (sedang kirim bertahap/nyicil, lihat settleTruckDelivery),
        // armada lain dilarang ikut mengambil sisanya sampai armada yang sama itu melunasi semuanya sendiri.
        function orderLockBlock(spbu, fuelId, truck) {
            const o = orders.find(x => x.kode === spbu.kode && x.fuel === fuelId && x.status === 'open');
            if (!o || !o.lockedTruckId || o.lockedTruckId === truck.id) return null;
            const lockedTruck = companyFleet.find(t => t.id === o.lockedTruckId);
            return `Pesanan ${spbu.nama} sedang dikirim bertahap oleh armada ${o.lockedTruckId}${lockedTruck ? ' [' + lockedTruck.name + ']' : ''}. Armada lain tidak bisa membantu sampai pesanan ini lunas - tunggu ${o.lockedTruckId} kembali dan kirim lagi pakai armada itu.`;
        }
        // Cek kesesuaian ukuran truk vs sisa pesanan SPBU: truk kecil boleh dipakai kirim bertahap (nyicil),
        // TAPI hanya kalau semua truk yang cukup besar untuk melunasi sisa pesanan dalam sekali jalan sedang bertugas/tidak ada.
        // Kalau ada truk yang pas & lagi nganggur, truk kecil harus nunggu / pemain diarahkan pakai truk itu dulu.
        function truckSizeBlock(spbu, fuelId, truck, type) {
            const o = orders.find(x => x.kode === spbu.kode && x.fuel === fuelId);
            if (!o) return null; // tidak ada pesanan aktif buat kombinasi ini, tidak ada batasan
            const sisa = Math.round((o.kl - o.terkirim) * 10) / 10;
            if (truck.cap >= sisa) return null; // truk ini sendiri sudah cukup buat lunasi sisa pesanan
            const unit = type === 'LPG' ? 'Ton' : 'KL';
            const better = companyFleet.find(t => t.type === type && t.id !== truck.id && t.cap >= sisa && !busyIds.has(t.id));
            if (!better) return null; // tidak ada truk yang lebih pas & available - truk kecil boleh nyicil
            return `Sisa pesanan ${spbu.nama} tinggal ${sisa} ${unit}, dan armada ${better.id} [${better.name}] berkapasitas ${better.cap} ${unit} sedang tidak bertugas - cukup buat melunasi sekali jalan. Gunakan ${better.id} dulu sebelum memakai ${truck.id} [${truck.cap} ${unit}] buat kirim bertahap.`;
        }

        // DISPATCH BBM - Tahap 1: validasi pilihan lalu buka Surat Jalan untuk ditandatangani
        function dispatchToSpbu() {
            const kodeSpbu = document.getElementById('delivery-spbu-select').value;
            const truckId = document.getElementById('delivery-truck-select').value;
            const driverId = document.getElementById('delivery-driver-select').value;
            const kernetId = document.getElementById('delivery-kernet-select').value;
            const fuelType = document.getElementById('delivery-fuel-type').value;
            const routeModeInput = document.querySelector('input[name="delivery-route-mode"]:checked');
            const routeMode = routeModeInput ? routeModeInput.value : 'tol';

            const spbu = loadedSpbuList.find(s => s.kode === kodeSpbu);
            if (spbu && spbu.blocked) return showModal('SPBU Diblokir', 'Lisensi SPBU ini dicabut. Operasional dihentikan.', 'fa-ban', 'red');
            const truck = companyFleet.find(t => t.id === truckId);
            const driver = companyCrew.find(c => c.id === driverId);
            const kernet = companyCrew.find(c => c.id === kernetId);

            if (!spbu || !truck || !driver || !kernet) {
                showModal('Peringatan', 'Lengkapi pilihan SPBU, Armada Truk, Supir & Kernet!', 'fa-circle-exclamation', 'red');
                return;
            }
            if (busyCheck(truck, driver, kernet)) return;
            if (docBlock(truck)) return;
            const fBBM = FUELS.find(x => x.label === fuelType);
            const lockMsg = fBBM ? orderLockBlock(spbu, fBBM.id, truck) : null;
            if (lockMsg) return showModal('Pesanan Terkunci', lockMsg, 'fa-lock', 'red');
            const sizeMsg = fBBM ? truckSizeBlock(spbu, fBBM.id, truck, 'BBM') : null;
            if (sizeMsg) return showModal('Pakai Armada yang Lebih Pas', sizeMsg, 'fa-truck-ramp-box', 'red');
            const kapKey = fBBM && FUEL_KAP_KEY[fBBM.id];
            const origin = pickOrigin('BBM', spbu, truck.cap, truck, kapKey);
            if (!origin) return showModal('Stok Kilang Kurang', `Tidak ada kilang/depo aktif dengan stok ${fuelType} (jadi) cukup untuk ${truck.cap} KL. Olah dulu BBL mentah jadi ${fuelType} di tab Kilang (tombol Konversi), atau transfer stok ${fuelType} ke depo.`, 'fa-gas-pump', 'red');
            // Jaga-jaga di sisi server logic: kalau rute tol ternyata tidak tersedia untuk asal/tujuan ini
            // (mis. UI belum sempat memperbarui kunci), paksa turun ke Non-Tol supaya tidak lolos kena tarif tol semu.
            const routeModeFinal = tollRouteAvailable(origin, spbu) ? routeMode : 'nontol';

            const d = { spbu, truck, driver, kernet, origin, jenisMuatan: fuelType, kapKey, hargaPerUnit: ECO.jualKl, routeMode: routeModeFinal };
            openSuratJalanModal({ mode: 'BBM', tujuanNama: spbu.nama, tujuanKode: spbu.kode, jenisMuatan: fuelType, volumeText: `${truck.cap} KL`, truck, driver, kernet,
                execute: (no) => settleTruckDelivery(no, d) });
        }

