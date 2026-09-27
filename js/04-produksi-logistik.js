        // ===== WILAYAH OTOMATIS: tiap SPBU di-assign ke Kilang/Depo AKTIF TERDEKAT berdasarkan radius jarak =====
        // Menggantikan wilayah kabupaten/kota manual - dipanggil ulang tiap kali ada kilang/depo baru dibuka,
        // supaya SPBU yang tadinya "jauh" bisa otomatis pindah wilayah begitu ada depo cabang lebih dekat.
        // Kilang/Depo terdekat yang BENAR-BENAR bisa mensuplai jenis produk ini (Pusat Utama selalu bisa;
        // Depo Cabang cuma bisa kalau tipenya cocok - mis. Depo LPG Gresik cuma bisa disebut wilayah LPG,
        // bukan wilayah BBM, walau jaraknya paling dekat). Logika filter tipe disamakan dengan pickOrigin().
        // Radius layanan realistis (km) per jenis produk - di luar radius ini, sebuah kilang/depo (termasuk
        // Pusat Utama) TIDAK dianggap bisa mensuplai SPBU tsb, walau tidak ada kandidat lain yang lebih dekat.
        // BBM disamakan dengan LPG (200 km) - SPBU yang jauh dari Kilang Pusat Tuban (mis. Jember) TIDAK dianggap
        // terjangkau sampai ada TBBM/Depo cabang BBM yang lebih dekat dibuka.
        const MAX_SERVICE_KM = { LPG: 200, BBM: 200 };
        function nearestActiveKilang(spbu, type) {
            const cap = MAX_SERVICE_KM[type] || Infinity;
            return refineryData.filter(k => k.is_unlocked && (k.tipe.includes('Pusat') || k.tipe.includes(type)) && distKm(k, spbu) <= cap)
                .reduce((best, k) => (!best || distKm(k, spbu) < distKm(best, spbu)) ? k : best, null);
        }
        function recomputeWilayah() {
            loadedSpbuList.forEach(s => {
                const bbm = nearestActiveKilang(s, 'BBM');
                if (bbm) { s.wilayahBbmId = bbm.id; s.wilayahBbmNama = bbm.nama; s.wilayahBbmJarak = Math.round(distKm(bbm, s) * 10) / 10; }
                else { s.wilayahBbmId = null; s.wilayahBbmNama = '-'; s.wilayahBbmJarak = null; }
                if (s.has_lpg) {
                    const lpg = nearestActiveKilang(s, 'LPG');
                    if (lpg) { s.wilayahLpgId = lpg.id; s.wilayahLpgNama = lpg.nama; s.wilayahLpgJarak = Math.round(distKm(lpg, s) * 10) / 10; }
                    else { s.wilayahLpgId = null; s.wilayahLpgNama = '-'; s.wilayahLpgJarak = null; }
                } else { s.wilayahLpgId = null; s.wilayahLpgNama = null; s.wilayahLpgJarak = null; }
                // Alias wilayah utama = wilayah BBM (dipakai buat dropdown filter & tampilan umum, karena semua SPBU jual BBM).
                s.wilayahId = s.wilayahBbmId; s.wilayahNama = s.wilayahBbmNama; s.wilayahJarak = s.wilayahBbmJarak;
            });
            rebuildRegionFilterOptions();
        }
        // Bangun ulang opsi dropdown "Pilih Wilayah" berdasarkan Kilang/Depo yang aktif saat ini,
        // dikelompokkan otomatis (bukan lagi daftar kabupaten/kota statis).
        function rebuildRegionFilterOptions() {
            const sel = document.getElementById('delivery-region-filter');
            if (!sel) return;
            const prev = sel.value;
            const counts = {};
            loadedSpbuList.forEach(s => { if (s.wilayahId) counts[s.wilayahId] = (counts[s.wilayahId] || 0) + 1; });
            sel.innerHTML = '<option value="ALL">-- Semua Wilayah Nusantara --</option>';
            refineryData.filter(k => k.is_unlocked).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k.id;
                opt.innerText = `${k.nama} (${counts[k.id] || 0} SPBU)`;
                sel.appendChild(opt);
            });
            if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev; else sel.value = 'ALL';
        }

        let kilangFilter = 'ALL';
        function setKilangFilter(key) { kilangFilter = key; renderRefineries(); }
        function renderRefineries() {
            kilangMarkers.forEach(km => map.removeLayer(km));
            kilangMarkers = [];

            const listContainer = document.getElementById('kilang-list-container');
            const targetSelect = document.getElementById('transfer-target-select');
            const tabsEl = document.getElementById('kilang-filter-tabs');

            listContainer.innerHTML = '';
            targetSelect.innerHTML = '';

            if (tabsEl) {
                // Dropdown, bukan deretan chip - daftar kilang/depo terus bertambah seiring ekspansi (bisa sampai
                // belasan), jadi kalau dijejer horizontal pasti ada saatnya kepotong berapa pun lebar layarnya.
                const opts = [{ key: 'ALL', label: 'Semua Kilang' }, ...refineryData.map(k => ({ key: k.id, label: k.nama + (k.is_unlocked ? '' : ' (Terkunci)') }))];
                tabsEl.innerHTML = `<select onchange="setKilangFilter(this.value)" class="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-200 focus:outline-none focus:border-teal-500">
                    ${opts.map(c => `<option value="${c.key}" ${kilangFilter === c.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}
                </select>`;
            }

            refineryData.forEach(kilang => {
                const pct = Math.round((kilang.stok_current / kilang.stok_max) * 100);
                
                const card = document.createElement('div');
                card.className = "p-3 bg-gray-900 rounded-lg border border-gray-800 space-y-2";
                
                if (kilang.is_unlocked) {
                    const mName = mekanikName(kilang);
                    const freeMekanik = companyCrew.filter(c => c.role === 'Mekanik' && !c.kilangId);
                    const mekanikBlock = mName
                        ? `<div class="flex items-center justify-between text-[10px] pt-1 border-t border-gray-800"><span class="text-gray-400"><i class="fa-solid fa-screwdriver-wrench mr-1 text-blue-400"></i>Mekanik: <b class="text-emerald-400">${mName}</b></span></div>`
                        : `<div class="pt-1 border-t border-gray-800 space-y-1 text-[10px]">
                            <span class="text-gray-400"><i class="fa-solid fa-screwdriver-wrench mr-1 text-amber-400"></i>Mekanik: <b class="text-amber-400">Belum ada</b></span>
                            ${freeMekanik.length
                                ? `<div class="flex gap-1"><select id="mekanik-sel-${kilang.id}" class="flex-1 bg-gray-950 border border-gray-700 rounded px-1 py-0.5 text-gray-200">${freeMekanik.map(c => `<option value="${c.id}">${c.name} (Rep ${Math.round(c.reputation)})</option>`).join('')}</select><button onclick="assignMekanik('${kilang.id}')" class="bg-blue-700 hover:bg-blue-600 text-white px-2 py-0.5 rounded font-bold">Tugaskan</button></div>`
                                : `<button onclick="openRecruitModal('Mekanik')" class="w-full bg-blue-700 hover:bg-blue-600 text-white px-2 py-0.5 rounded font-bold">Rekrut Mekanik di Bursa Kerja</button>`}
                          </div>`;
                    const anyRefining = kilang.kap ? Object.values(kilang.kap).some(s => s.refining) : false;
                    card.innerHTML = `
                        <div class="flex justify-between text-xs">
                            <span class="text-gray-200 font-bold">${kilang.nama} <span class="text-[10px] text-blue-400 font-normal">(${kilang.tipe})</span> ${isCoastal(kilang) ? '<span class="text-[9px] text-cyan-400 font-normal" title="Punya akses pelabuhan, bisa dilayani kapal tanker"><i class="fa-solid fa-anchor"></i> Pesisir</span>' : '<span class="text-[9px] text-gray-500 font-normal" title="Tidak ada akses pelabuhan, hanya bisa dilayani truk"><i class="fa-solid fa-road"></i> Darat</span>'}${kilang.id === 'KILANG-01' ? `<span id="refine-indicator-${kilang.id}" class="${anyRefining ? '' : 'hidden'} text-[9px] text-amber-400 font-normal ml-1"><i class="fa-solid fa-gear fa-spin mr-0.5"></i>Mengolah...</span>` : ''}</span>
                            <span id="crude-text-${kilang.id}" class="font-bold text-gray-200 font-mono">${kilang.stok_current.toLocaleString()} / ${kilang.stok_max.toLocaleString()} ${kilang.unit}</span>
                        </div>
                        <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                            <div id="crude-bar-${kilang.id}" class="${anyRefining ? 'refine-flow' : ''} bg-emerald-500 h-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                        ${mekanikBlock}
                        ${kilang.id === 'KILANG-01' ? fuelBuyHtml(kilang) : ''}
                        ${kilang.id === 'KILANG-01' ? lpgCurahBuyHtml(kilang) : ''}
                        ${renderKapPanel(kilang)}
                    `;

                    if (kilang.id !== 'KILANG-01') {
                        const opt = document.createElement('option');
                        opt.value = kilang.id;
                        opt.innerText = `${kilang.nama} (Sisa: ${kilang.stok_max - kilang.stok_current} ${kilang.unit})`;
                        targetSelect.appendChild(opt);
                    }
                } else {
                    card.innerHTML = `
                        <div class="flex justify-between items-center text-xs">
                            <div>
                                <span class="text-gray-400 font-bold block">${kilang.nama}</span>
                                <span class="text-[10px] text-amber-500 font-mono"><i class="fa-solid fa-lock mr-1"></i> Terkunci</span>
                            </div>
                            <button onclick="buyRefinery('${kilang.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10px] font-bold transition">
                                Beli ${formatRupiah(kilang.harga_beli)}
                            </button>
                        </div>
                    `;
                }

                if (kilangFilter === 'ALL' || kilangFilter === kilang.id) listContainer.appendChild(card);

                let colorMarker = '#6b7280';
                if (kilang.is_unlocked) {
                    colorMarker = kilang.id === 'KILANG-01' ? '#14b8a6' : '#f97316';
                }

                const marker = L.circleMarker([kilang.lat, kilang.lon], {
                    radius: 10,
                    fillColor: colorMarker,
                    color: "#ffffff",
                    weight: 2,
                    fillOpacity: 0.9
                }).addTo(map);

                const coastal = isCoastal(kilang);
                marker.bindPopup(`
                    <div class="text-gray-900 font-sans p-1">
                        <strong class="text-xs font-bold block text-teal-700">${kilang.nama}</strong>
                        <div class="text-[10px] text-gray-600">Status: <b>${kilang.is_unlocked ? 'Aktif' : 'Terkunci'}</b></div>
                        <div class="text-[10px] text-gray-600">Akses: <b>${coastal ? '⚓ Pesisir (ada dermaga, bisa disandari kapal tanker)' : '🛣️ Darat saja (tidak ada dermaga)'}</b></div>
                        <div class="text-[10px] text-gray-600">Stok: <b>${kilang.stok_current.toLocaleString()} / ${kilang.stok_max.toLocaleString()} ${kilang.unit}</b></div>
                        <div class="text-[10px] text-gray-600">Mekanik: <b>${mekanikName(kilang) || 'Belum ada'}</b></div>
                    </div>
                `);

                kilangMarkers.push(marker);

                // Bug fix: tandai di PETA (bukan cuma di daftar sidebar) depo/kilang mana yang punya akses
                // pelabuhan (dermaga) - lencana jangkar kecil menempel di pojok marker depo tersebut.
                if (coastal) {
                    const dermagaBadge = L.marker([kilang.lat, kilang.lon], {
                        icon: L.divIcon({
                            className: '',
                            iconSize: [16, 16],
                            iconAnchor: [-6, 18],
                            html: `<div style="width:16px;height:16px;border-radius:50%;background:#0891b2;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;box-shadow:0 1px 4px rgba(0,0,0,.6)"><i class="fa-solid fa-anchor"></i></div>`
                        }),
                        zIndexOffset: 700,
                        interactive: false
                    }).addTo(map);
                    dermagaBadge.bindTooltip(esc(`${kilang.nama} - Ada Dermaga`), { direction: 'top', offset: [0, -8], className: 'truck-tip' });
                    kilangMarkers.push(dermagaBadge);
                }
            });

            if (targetSelect.options.length === 0) {
                targetSelect.innerHTML = '<option value="">-- Beli Depo Cabang Terlebih Dahulu --</option>';
            }
            populateTransferKapal();
        }

        // ===== MEKANIK DI SETIAP KILANG/DEPO (direkrut lewat Bursa Kerja Kru, lalu ditugaskan ke kilang) =====
        function mekanikName(kilang) {
            if (!kilang.mekanikId) return null;
            if (kilang.mekanikId === 'BUILTIN') return 'Slamet Riyadi (Kepala Mekanik Tetap)';
            const c = companyCrew.find(x => x.id === kilang.mekanikId);
            return c ? c.name : null;
        }
        function assignMekanik(kilangId) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || !kilang.is_unlocked || kilang.mekanikId) return;
            const sel = document.getElementById('mekanik-sel-' + kilangId);
            if (!sel || !sel.value) return;
            const crewId = sel.value;
            const c = companyCrew.find(x => x.id === crewId);
            if (!c || c.role !== 'Mekanik' || c.kilangId) return;
            kilang.mekanikId = c.id;
            c.kilangId = kilang.id;
            c.status = 'Bertugas di ' + kilang.nama;
            addLog(`MEKANIK DITUGASKAN: ${c.name} kini bertugas di ${kilang.nama}. Depo ini sekarang bisa dipilih sebagai pangkalan armada.`, 'success');
            showModal('Mekanik Ditugaskan', `${c.name} kini bertugas sebagai mekanik di ${kilang.nama}. Depo ini sekarang bisa dipilih sebagai pangkalan armada (Pindah Depot di tab Armada).`, 'fa-screwdriver-wrench', 'blue');
            renderRefineries(); renderFleetDashboard(); renderDriversDashboard();
        }

        // ===== ODOMETER & KEAUSAN BAN ARMADA =====
        const TIRE_WEAR_PER_KM = 100 / 4000; // set ban habis (0%) tiap ±4.000 km tempuh
        const TIRE_REPLACE_THRESHOLD = 15; // otomatis diganti begitu tiba di depot kalau sisa <=15%
        const tireReplaceCost = t => Math.round((t.price || 500e6) * 0.01 / 100000) * 100000;
        function banCls(pct) { return pct <= TIRE_REPLACE_THRESHOLD ? 'text-red-400' : pct <= 40 ? 'text-amber-400' : 'text-emerald-400'; }
        function banBar(pct) { return pct <= TIRE_REPLACE_THRESHOLD ? 'bg-red-500' : pct <= 40 ? 'bg-amber-500' : 'bg-emerald-500'; }

        // ===== PINDAH DEPOT PANGKALAN ARMADA =====
        const DEPOT_MOVE_FEE = 3500000;
        function pindahDepot(truckId) {
            const t = companyFleet.find(x => x.id === truckId); if (!t) return;
            const sel = document.getElementById('depot-sel-' + truckId); if (!sel || !sel.value) return;
            const target = refineryData.find(k => k.id === sel.value);
            if (!target || !target.is_unlocked || !target.mekanikId) return showModal('Depo Belum Siap', 'Depo tujuan harus sudah aktif dan punya mekanik yang ditugaskan terlebih dahulu.', 'fa-triangle-exclamation', 'red');
            if (target.id === t.depotId) return;
            if (companyCash < DEPOT_MOVE_FEE) return showModal('Kas Tidak Cukup', `Pindah depot butuh biaya mobilisasi ${formatRupiah(DEPOT_MOVE_FEE)}.`, 'fa-triangle-exclamation', 'red');
            const asal = refineryData.find(k => k.id === t.depotId);
            companyCash -= DEPOT_MOVE_FEE; totalExpense += DEPOT_MOVE_FEE;
            t.depotId = target.id;
            addFinanceLog(`Mobilisasi ${t.id} ke ${target.nama}`, -DEPOT_MOVE_FEE);
            addLog(`PINDAH DEPOT: ${t.id} [${t.plat}] dipindah pangkalan dari ${asal ? asal.nama : '-'} ke ${target.nama}.`, 'info');
            showModal('Armada Dipindah', `${t.id} [${t.plat}] kini berpangkalan di ${target.nama}.`, 'fa-truck-fast', 'blue');
            updateCashDisplay(); renderFleetDashboard();
        }

        // ===== BELI BAHAN BAKAR KILANG UTAMA =====
        const BBL_PRICE = 1100000; let bbmWarned = false, bbmSpent = 0;
        // Batas atas kapasitas tangki (upgrade tidak bisa lewat ini): BBL mentah & LPG Curah sama-sama 10 Juta.
        const KAP_UPGRADE_CAPS = { lpg_curah: 10000000 };
        const BBL_KAP_MAX = 10000000, BBL_KAP_STEP = 200000, BBL_KAP_BASE_COST = 1500e6;
        const bblUpgradeCost = kilang => Math.round(BBL_KAP_BASE_COST * Math.pow(1.32, kilang.stokUpgradeLevel || 0));
        function upgradeBblTangki(kilangId) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || !kilang.is_unlocked) return;
            if (kilang.stok_max >= BBL_KAP_MAX) return showModal('Kapasitas Maksimum', `Tangki BBL mentah ${kilang.nama} sudah mencapai batas maksimum ${BBL_KAP_MAX.toLocaleString('id-ID')} Bbl.`, 'fa-circle-info', 'blue');
            const cost = bblUpgradeCost(kilang);
            if (companyCash < cost) return showModal('Kas Tidak Cukup', `Upgrade kapasitas tangki BBL mentah di ${kilang.nama} butuh ${formatRupiah(cost)}.`, 'fa-triangle-exclamation', 'red');
            companyCash -= cost; totalExpense += cost;
            kilang.stok_max = Math.min(BBL_KAP_MAX, kilang.stok_max + BBL_KAP_STEP);
            kilang.stokUpgradeLevel = (kilang.stokUpgradeLevel || 0) + 1;
            addFinanceLog(`Upgrade Kapasitas Tangki BBL Mentah - ${kilang.nama}`, -cost);
            updateCashDisplay();
            addLog(`KAPASITAS DITINGKATKAN: Tangki BBL mentah ${kilang.nama} kini menampung ${kilang.stok_max.toLocaleString('id-ID')} Bbl.`, 'success');
            renderRefineries();
        }
        function fuelBuyHtml(kilang) {
            const pct = Math.round((kilang.stok_current / kilang.stok_max) * 100);
            const atMax = kilang.stok_max >= BBL_KAP_MAX;
            const b = (n, l) => `<button onclick="buyFuel(${n})" class="bg-teal-700 hover:bg-teal-600 text-white rounded px-2 py-1 font-bold">${l}</button>`;
            return `<div class="pt-1.5 border-t border-gray-800 space-y-1.5">
                ${pct <= 25 ? '<div class="text-[10px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Stok bahan bakar menipis! Segera beli pasokan.</div>' : ''}
                <div class="text-[10px] text-gray-400"><i class="fa-solid fa-gas-pump text-amber-400 mr-1"></i>Beli bahan bakar mentah &middot; ${formatRupiah(BBL_PRICE)}/Bbl</div>
                <div class="flex flex-wrap gap-1 text-[10px]">${b(10000, '+10.000 Bbl')}${b(50000, '+50.000 Bbl')}${b(100000, '+100.000 Bbl')}${b(500000, '+500.000 Bbl')}${b(1000000, '+1 Juta Bbl')}${b(0, 'Isi Penuh')}
                    ${atMax ? '' : `<button onclick="upgradeBblTangki('${kilang.id}')" class="bg-emerald-700 hover:bg-emerald-600 text-white rounded px-2 py-1 font-bold"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Tangki (${formatRupiah(bblUpgradeCost(kilang))})</button>`}
                </div>
                <div class="text-[9px] text-gray-500"><i class="fa-solid fa-circle-info mr-1"></i>Stok mentah ini diolah jadi Pertalite, Pertamax, dst lewat tombol Konversi di panel Kapasitas Depo di bawah - tidak jalan sendiri.${atMax ? ' Kapasitas tangki sudah maksimum (10 Juta Bbl).' : ' Kapasitas tangki bisa di-upgrade sampai maksimum 10 Juta Bbl.'}</div></div>`;
        }
        function buyFuel(n) {
            const k = refineryData[0], room = k.stok_max - k.stok_current, qty = Math.min(n || room, room);
            if (qty <= 0) return showModal('Tangki Penuh', 'Stok Kilang Tuban sudah penuh.', 'fa-circle-info', 'blue');
            const cost = qty * BBL_PRICE;
            if (companyCash < cost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(cost)} untuk ${qty.toLocaleString('id-ID')} Bbl.`, 'fa-triangle-exclamation', 'red');
            // Konfirmasi isi ulang pasokan kilang wajib ditandatangani dulu (bukti serah terima) sebelum transaksi dieksekusi
            openSignature(`Konfirmasi pembelian ${qty.toLocaleString('id-ID')} Bbl bahan bakar untuk Kilang Tuban seharga ${formatRupiah(cost)}. Tanda tangani kotak di bawah untuk menyetujui pembelian.`, () => {
                companyCash -= cost; totalExpense += cost; bbmSpent += cost; k.stok_current += qty; bbmWarned = false;
                addFinanceLog(`Pembelian bahan bakar ${qty.toLocaleString('id-ID')} Bbl (Kilang Tuban)`, -cost);
                updateCashDisplay(); renderRefineries();
                addLog(`PEMBELIAN BBM: ${qty.toLocaleString('id-ID')} Bbl masuk Kilang Tuban seharga ${formatRupiah(cost)} (ditandatangani).`, 'success');
                showModal('Pembelian Berhasil', `${qty.toLocaleString('id-ID')} Bbl bahan bakar masuk Kilang Tuban. Bukti pembelian sudah ditandatangani.`, 'fa-gas-pump', 'blue');
            });
        }

        // ===== LPG CURAH: diperlakukan sama seperti bahan mentah (Bbl) - beli manual, bukan diolah otomatis dari crude =====
        function lpgCurahBuyHtml(kilang) {
            const meta = PRODUCT_META.lpg_curah, slot = kilang.kap && kilang.kap.lpg_curah;
            if (!slot) return '';
            const pct = slot.max ? Math.round((slot.cur / slot.max) * 100) : 0;
            const upCost = kapUpgradeCost(meta, slot.level);
            const capMax = KAP_UPGRADE_CAPS.lpg_curah;
            const atMax = capMax && slot.max >= capMax;
            const b = (n, l) => `<button onclick="buyLpgCurah('${kilang.id}',${n})" class="bg-orange-700 hover:bg-orange-600 text-white rounded px-2 py-1 font-bold">${l}</button>`;
            return `<div class="pt-1.5 border-t border-gray-800 space-y-1.5">
                <div class="flex justify-between text-xs">
                    <span class="text-gray-200 font-bold"><i class="fa-solid fa-fire-flame-simple text-orange-400 mr-1"></i>LPG Curah <span class="text-[10px] text-gray-500 font-normal">(Bahan Mentah)</span></span>
                    <span id="lpgcurah-text-${kilang.id}" class="font-bold text-gray-200 font-mono">${slot.cur.toLocaleString('id-ID', { maximumFractionDigits: 1 })} / ${slot.max.toLocaleString('id-ID')} Ton</span>
                </div>
                <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div id="lpgcurah-bar-${kilang.id}" class="bg-orange-500 h-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
                ${pct <= 25 ? '<div class="text-[10px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Stok LPG Curah menipis! Segera beli pasokan.</div>' : ''}
                <div class="text-[10px] text-gray-400"><i class="fa-solid fa-fire-flame-simple text-orange-400 mr-1"></i>Beli LPG Curah &middot; ${formatRupiah(meta.buyPrice)}/Ton</div>
                <div class="flex flex-wrap gap-1 text-[10px]">${b(200, '+200 Ton')}${b(1000, '+1.000 Ton')}${b(2000, '+2.000 Ton')}${b(0, 'Isi Penuh')}
                    ${atMax ? '' : `<button onclick="upgradeKapasitas('${kilang.id}','lpg_curah')" class="bg-emerald-700 hover:bg-emerald-600 text-white rounded px-2 py-1 font-bold"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Tangki (${formatRupiah(upCost)})</button>`}
                </div>
                <div class="text-[9px] text-gray-500"><i class="fa-solid fa-circle-info mr-1"></i>Bahan baku LPG Tabung - konversi di panel Kapasitas Depo di bawah.${atMax ? ' Kapasitas tangki sudah maksimum (10 Juta Ton).' : ' Kapasitas tangki bisa di-upgrade sampai maksimum 10 Juta Ton.'}</div>
            </div>`;
        }
        function buyLpgCurah(kilangId, n) {
            const k = refineryData.find(x => x.id === kilangId) || refineryData[0];
            const meta = PRODUCT_META.lpg_curah;
            if (!k || !k.kap || !k.kap.lpg_curah) return;
            const slot = k.kap.lpg_curah, room = slot.max - slot.cur, qty = Math.min(n || room, room);
            if (qty <= 0) return showModal('Tangki Penuh', `Tangki LPG Curah di ${k.nama} sudah penuh.`, 'fa-circle-info', 'blue');
            const cost = Math.round(qty * meta.buyPrice);
            if (companyCash < cost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(cost)} untuk ${qty.toLocaleString('id-ID')} Ton LPG Curah.`, 'fa-triangle-exclamation', 'red');
            openSignature(`Konfirmasi pembelian ${qty.toLocaleString('id-ID')} Ton LPG Curah untuk ${k.nama} seharga ${formatRupiah(cost)}. Tanda tangani kotak di bawah untuk menyetujui pembelian.`, () => {
                companyCash -= cost; totalExpense += cost; bbmSpent += cost;
                slot.cur = Math.min(slot.max, Math.round((slot.cur + qty) * 100) / 100);
                addFinanceLog(`Pembelian LPG Curah ${qty.toLocaleString('id-ID')} Ton (${k.nama})`, -cost);
                updateCashDisplay(); renderRefineries();
                addLog(`PEMBELIAN LPG CURAH: ${qty.toLocaleString('id-ID')} Ton masuk ${k.nama} seharga ${formatRupiah(cost)} (ditandatangani).`, 'success');
                showModal('Pembelian Berhasil', `${qty.toLocaleString('id-ID')} Ton LPG Curah masuk ${k.nama}. Bukti pembelian sudah ditandatangani.`, 'fa-fire-flame-simple', 'blue');
            });
        }

        // ===== TANDA TANGAN DIGITAL: konfirmasi transaksi (dipakai isi ulang kilang, dll) =====
        let signCtx = null, signDrawing = false, signHasStroke = false, signPendingAction = null;
        function initSignatureCanvas() {
            const canvas = document.getElementById('sign-canvas');
            if (!canvas || signCtx) return;
            signCtx = canvas.getContext('2d');
            signCtx.lineWidth = 2.2; signCtx.lineCap = 'round'; signCtx.lineJoin = 'round'; signCtx.strokeStyle = '#111827';
            const pos = e => {
                const r = canvas.getBoundingClientRect();
                const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
                const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
                return { x: cx * canvas.width / r.width, y: cy * canvas.height / r.height };
            };
            const start = e => { signDrawing = true; signHasStroke = true; const p = pos(e); signCtx.beginPath(); signCtx.moveTo(p.x, p.y); e.preventDefault(); };
            const move = e => { if (!signDrawing) return; const p = pos(e); signCtx.lineTo(p.x, p.y); signCtx.stroke(); e.preventDefault(); };
            const end = () => { signDrawing = false; };
            canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
            canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
        }
        function clearSignature() {
            if (!signCtx) return;
            signCtx.clearRect(0, 0, signCtx.canvas.width, signCtx.canvas.height);
            signHasStroke = false;
            document.getElementById('sign-msg').classList.add('hidden');
        }
        function openSignature(desc, onConfirm) {
            signPendingAction = onConfirm;
            document.getElementById('sign-desc').textContent = desc;
            document.getElementById('sign-modal').classList.remove('hidden');
            setTimeout(() => { initSignatureCanvas(); clearSignature(); }, 0);
        }
        function cancelSignature() {
            document.getElementById('sign-modal').classList.add('hidden');
            signPendingAction = null;
        }
        function confirmSignature() {
            if (!signHasStroke) {
                const m = document.getElementById('sign-msg');
                m.textContent = 'Tanda tangan dulu di kotak putih di atas sebelum konfirmasi.';
                m.classList.remove('hidden');
                return;
            }
            const action = signPendingAction;
            document.getElementById('sign-modal').classList.add('hidden');
            signPendingAction = null;
            if (action) action();
        }

        function buyRefinery(kilangId) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang) return;

            if (companyCash < kilang.harga_beli) {
                showModal('Kas Tidak Cukup', `Biaya pembelian ${kilang.nama} adalah ${formatRupiah(kilang.harga_beli)}. Kas perusahaan tidak mencukupi!`, 'fa-triangle-exclamation', 'red');
                return;
            }

            companyCash -= kilang.harga_beli;
            totalExpense += kilang.harga_beli;
            kilang.is_unlocked = true;

            addFinanceLog(`Pembelian Aset ${kilang.nama}`, -kilang.harga_beli);
            updateCashDisplay();
            renderRefineries();
            recomputeWilayah();
            renderSpbuOnMap();

            addLog(`KILANG BARU DIBUKA: ${kilang.nama} telah dibeli. Stok awal 0!`, 'success');
            showModal('Kilang Berhasil Dibeli', `${kilang.nama} telah dibuka! Silakan lakukan transfer pasokan BBM dari Kilang Pusat (Tuban).`, 'fa-building-circle-check', 'blue');
        }

        // ===== KAPASITAS DEPO: upgrade tangki, isi ulang, konversi LPG curah->tabung, kirim otomatis ke cabang =====
        function kapUpgradeCost(meta, level) { return Math.round(meta.baseCost * Math.pow(1.32, level || 0)); }

        function upgradeKapasitas(kilangId, key) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || !kilang.is_unlocked || !kilang.kap || !kilang.kap[key]) return;
            const meta = PRODUCT_META[key], slot = kilang.kap[key];
            const capMax = KAP_UPGRADE_CAPS[key];
            if (capMax && slot.max >= capMax) {
                showModal('Kapasitas Maksimum', `Tangki ${meta.label} di ${kilang.nama} sudah mencapai batas maksimum ${capMax.toLocaleString('id-ID')} ${meta.unit}.`, 'fa-circle-info', 'blue');
                return;
            }
            const cost = kapUpgradeCost(meta, slot.level);
            if (companyCash < cost) {
                showModal('Kas Tidak Cukup', `Upgrade kapasitas tangki ${meta.label} di ${kilang.nama} butuh ${formatRupiah(cost)}.`, 'fa-triangle-exclamation', 'red');
                return;
            }
            companyCash -= cost; totalExpense += cost;
            slot.max = capMax ? Math.min(capMax, slot.max + meta.step) : slot.max + meta.step;
            slot.level = (slot.level || 0) + 1;
            addFinanceLog(`Upgrade Kapasitas ${meta.label} - ${kilang.nama}`, -cost);
            updateCashDisplay();
            addLog(`KAPASITAS DITINGKATKAN: Tangki ${meta.label} di ${kilang.nama} kini menampung ${slot.max.toLocaleString('id-ID')} ${meta.unit}.`, 'success');
            renderRefineries();
        }

        function isiUlangProduk(kilangId, key, amount) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || kilang.id !== 'KILANG-01' || !kilang.kap || !kilang.kap[key]) return;
            const meta = PRODUCT_META[key];
            if (!meta.buyPrice) return;
            const slot = kilang.kap[key], room = slot.max - slot.cur, qty = Math.min(amount || room, room);
            if (qty <= 0) return showModal('Tangki Penuh', `Tangki ${meta.label} di ${kilang.nama} sudah penuh.`, 'fa-circle-info', 'blue');
            const cost = Math.round(qty * meta.buyPrice);
            if (companyCash < cost) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(cost)} untuk ${qty.toLocaleString('id-ID')} ${meta.unit} ${meta.label}.`, 'fa-triangle-exclamation', 'red');
            companyCash -= cost; totalExpense += cost; bbmSpent += cost;
            slot.cur = Math.min(slot.max, Math.round((slot.cur + qty) * 100) / 100);
            addFinanceLog(`Pembelian ${meta.label} ${qty.toLocaleString('id-ID')} ${meta.unit} (${kilang.nama})`, -cost);
            updateCashDisplay(); renderRefineries();
            addLog(`PEMBELIAN ${meta.label.toUpperCase()}: ${qty.toLocaleString('id-ID')} ${meta.unit} masuk ${kilang.nama}.`, 'success');
        }

        // Lama proses olah (ms), makin besar jumlah yang dikonversi makin lama animasinya berjalan (dibatasi min/max biar tetap enak dimainkan).
        function refineDurationMs(amount, scale) {
            const s = scale || amount || 1;
            return Math.min(6000, Math.max(1200, Math.round((amount / s) * 1800)));
        }

        // Bug fix: sebelumnya slot.cur "diam" total sepanjang durasi olah lalu melompat penuh sekaligus di
        // akhir (satu-satunya setTimeout), jadi terlihat seperti instan begitu badge "Diolah" hilang - padahal
        // updateKilangLiveBars() sudah dibuat khusus untuk update progress bar live tapi belum pernah dipanggil
        // di mana pun. Helper ini menaikkan slot.cur SEDIKIT DEMI SEDIKIT tiap tick mengikuti waktu berjalan
        // (bukan lompat di akhir), lalu memanggil onDone() persis saat animasinya selesai (durasi sama seperti
        // sebelumnya, cuma sekarang benar-benar terlihat progresnya, bukan cuma badge statis lalu tiba-tiba penuh).
        function animateRefineFill(kilang, slot, addAmount, durasiMs, onDone) {
            const startCur = slot.cur, target = Math.min(slot.max, Math.round((startCur + addAmount) * 100) / 100);
            const t0 = performance.now();
            const TICK_MS = 150;
            const iv = setInterval(() => {
                const frac = Math.min(1, (performance.now() - t0) / durasiMs);
                slot.cur = Math.round((startCur + (target - startCur) * frac) * 100) / 100;
                updateKilangLiveBars(kilang);
                if (frac >= 1) {
                    clearInterval(iv);
                    slot.cur = target;
                    onDone();
                }
            }, TICK_MS);
            return iv;
        }

        function convertLpgCurah(kilangId) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || !kilang.kap || !kilang.kap.lpg_curah || !kilang.kap.lpg_tabung) return;
            const curah = kilang.kap.lpg_curah, tabung = kilang.kap.lpg_tabung, RATIO = 0.92;
            if (tabung.refining) return; // sedang diolah, tombol seharusnya sudah disembunyikan/nonaktif
            const room = tabung.max - tabung.cur;
            const amount = Math.min(curah.cur, room / RATIO);
            if (amount <= 0) {
                showModal('Tidak Bisa Konversi', curah.cur <= 0 ? `Stok LPG Curah di ${kilang.nama} kosong.` : `Tangki LPG Tabung di ${kilang.nama} sudah penuh.`, 'fa-circle-exclamation', 'amber');
                return;
            }
            const hasil = Math.round(amount * RATIO * 100) / 100;
            const durasi = refineDurationMs(amount, 1500);
            // Bahan mentah LPG Curah langsung terpakai begitu proses dimulai; hasil LPG Tabung baru masuk tangki setelah durasi olah selesai.
            curah.cur = Math.round((curah.cur - amount) * 100) / 100;
            tabung.refining = true;
            addLog(`KONVERSI LPG: ${kilang.nama} mulai mengolah ${amount.toLocaleString('id-ID')} Ton LPG Curah menjadi LPG Tabung (&plusmn;${Math.round(durasi / 1000)} detik).`, 'info');
            renderRefineries();
            animateRefineFill(kilang, tabung, hasil, durasi, () => {
                tabung.refining = false;
                addLog(`KONVERSI SELESAI: ${hasil.toLocaleString('id-ID')} Ton LPG Tabung siap distribusi di ${kilang.nama}.`, 'success');
                showModal('Konversi Selesai', `${amount.toLocaleString('id-ID')} Ton LPG Curah berhasil diolah menjadi ${hasil.toLocaleString('id-ID')} Ton LPG Tabung di ${kilang.nama}. (Susut proses pengisian tabung 8%)`, 'fa-fire-flame-simple', 'blue');
                renderRefineries();
            });
        }

        // ===== KONVERSI BBL -> BBM: manual lewat tombol, prosesnya berjalan sesuai durasi (tidak instan, tidak otomatis lagi) =====
        // n = jumlah produk (KL) yang mau dihasilkan sekali klik; n=0/kosong artinya "isi penuh sebisa mungkin".
        function convertBblKeProduk(kilangId, key, n) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || !kilang.kap || !kilang.kap[key]) return;
            const meta = PRODUCT_META[key], slot = kilang.kap[key];
            if (!meta || !meta.refineRatio) return;
            if (slot.refining) return; // sedang diolah, tombol seharusnya sudah disembunyikan/nonaktif
            const room = slot.max - slot.cur;
            const maxByBbl = kilang.stok_current / meta.refineRatio;
            const amount = Math.min(n || room, room, maxByBbl);
            if (amount <= 0) {
                showModal('Tidak Bisa Konversi', kilang.stok_current <= 0 ? `Stok BBL mentah di ${kilang.nama} kosong.` : `Tangki ${meta.label} di ${kilang.nama} sudah penuh.`, 'fa-circle-exclamation', 'amber');
                return;
            }
            const bblUsed = Math.round(amount * meta.refineRatio * 100) / 100;
            const durasi = refineDurationMs(amount, BBL_CONVERT_STEP[key]);
            // BBL mentah langsung terpakai/terkunci begitu proses dimulai; hasil BBM baru masuk tangki setelah durasi olah selesai.
            kilang.stok_current = Math.max(0, Math.round((kilang.stok_current - bblUsed) * 100) / 100);
            slot.refining = true;
            addLog(`KONVERSI BBL: ${kilang.nama} mulai mengolah ${bblUsed.toLocaleString('id-ID')} Bbl mentah menjadi ${meta.label} (&plusmn;${Math.round(durasi / 1000)} detik).`, 'info');
            renderRefineries();
            animateRefineFill(kilang, slot, amount, durasi, () => {
                slot.refining = false;
                addLog(`KONVERSI SELESAI: ${amount.toLocaleString('id-ID')} ${meta.unit} ${meta.label} siap di ${kilang.nama}.`, 'success');
                showModal('Konversi Selesai', `${bblUsed.toLocaleString('id-ID')} Bbl BBL mentah berhasil diolah menjadi ${amount.toLocaleString('id-ID')} ${meta.unit} ${meta.label} di ${kilang.nama}.`, meta.icon, 'blue');
                renderRefineries();
            });
        }

        // ===== KONVERSI BBL -> SEMUA JENIS BBM SEKALIGUS (1 tombol) =====
        // Beda dari convertBblKeProduk (per-jenis, manual pilih satu-satu): tombol ini mengurutkan semua jenis BBM
        // yang belum diolah/belum penuh di kilang/depo ini, lalu MULAI proses "isi penuh" untuk tiap jenis satu
        // per satu (stok BBL mentah dipakai berurutan sampai habis atau semua tangki BBM penuh). Proses tiap
        // jenis TETAP berjalan sesuai durasinya masing-masing secara paralel (bukan instan/langsung jadi) - lihat
        // convertBblKeProduk untuk mekanisme durasi & badge "Diolah" per jenis.
        function convertBblSemuaJenis(kilangId) {
            const kilang = refineryData.find(k => k.id === kilangId);
            if (!kilang || !kilang.kap) return;
            const keys = Object.keys(kilang.kap).filter(key => {
                const meta = PRODUCT_META[key], slot = kilang.kap[key];
                return meta && meta.refineRatio && key !== 'lpg_curah' && key !== 'lpg_tabung' && slot && !slot.refining;
            });
            if (!keys.length) return;
            const started = [];
            for (const key of keys) {
                if (kilang.stok_current <= 0) break; // BBL mentah habis, hentikan - jenis berikutnya tidak kebagian
                const meta = PRODUCT_META[key], slot = kilang.kap[key];
                const room = slot.max - slot.cur;
                if (room <= 0) continue; // tangki jenis ini sudah penuh, lewati
                const maxByBbl = kilang.stok_current / meta.refineRatio;
                const amount = Math.min(room, maxByBbl);
                if (amount <= 0) continue;
                const bblUsed = Math.round(amount * meta.refineRatio * 100) / 100;
                const durasi = refineDurationMs(amount, BBL_CONVERT_STEP[key]);
                kilang.stok_current = Math.max(0, Math.round((kilang.stok_current - bblUsed) * 100) / 100);
                slot.refining = true;
                started.push({ key, meta, amount, bblUsed });
                addLog(`KONVERSI BBL: ${kilang.nama} mulai mengolah ${bblUsed.toLocaleString('id-ID')} Bbl mentah menjadi ${meta.label} (&plusmn;${Math.round(durasi / 1000)} detik) - bagian dari konversi massal semua jenis.`, 'info');
                animateRefineFill(kilang, slot, amount, durasi, () => {
                    slot.refining = false;
                    addLog(`KONVERSI SELESAI: ${amount.toLocaleString('id-ID')} ${meta.unit} ${meta.label} siap di ${kilang.nama}.`, 'success');
                    renderRefineries();
                });
            }
            renderRefineries();
            if (!started.length) {
                showModal('Tidak Bisa Konversi', kilang.stok_current <= 0 ? `Stok BBL mentah di ${kilang.nama} kosong.` : `Semua tangki BBM di ${kilang.nama} sudah penuh.`, 'fa-circle-exclamation', 'amber');
                return;
            }
            const ringkasan = started.map(s => `${s.amount.toLocaleString('id-ID')} ${s.meta.unit} ${s.meta.label}`).join(', ');
            // Bug fix: sebelumnya showModal (blocking, wajib diklik OK) tepat saat proses baru mulai - kalau
            // durasinya pendek, begitu modal ditutup prosesnya sudah selesai duluan sehingga terasa "instan".
            // Sekarang notify() (toast di panel notifikasi, tidak menutupi/menghentikan apa pun) supaya progress
            // bar & badge "Diolah" yang sedang berjalan bertahap tetap kelihatan.
            notify(`${kilang.nama} mulai mengolah BBL mentah jadi semua jenis BBM sekaligus: ${ringkasan}. Tunggu sampai badge "Diolah" hilang.`, 'info');
        }

        const KAP_KIRIM_STEP = { pertalite: 3000, pertamax: 2500, pertamax_turbo: 1200, solar: 3000, dexlite: 1800, lpg_curah: 500 };
        function kirimProdukKeDepo(key) {
            const sel = document.getElementById('kap-kirim-target-' + key);
            if (!sel || !sel.value) return showModal('Pilih Tujuan', 'Pilih dulu Depo Cabang tujuan pengiriman.', 'fa-circle-exclamation', 'amber');
            const pusat = refineryData[0], target = refineryData.find(k => k.id === sel.value), meta = PRODUCT_META[key];
            if (!pusat.kap[key] || !target || !target.kap || !target.kap[key]) return;
            const room = target.kap[key].max - target.kap[key].cur;
            const amount = Math.min(KAP_KIRIM_STEP[key] || 500, pusat.kap[key].cur, room);
            if (amount <= 0) {
                showModal('Tidak Bisa Kirim', pusat.kap[key].cur <= 0 ? `Stok ${meta.label} di Kilang Tuban kosong.` : `Tangki ${meta.label} di ${target.nama} sudah penuh.`, 'fa-circle-exclamation', 'amber');
                return;
            }
            pusat.kap[key].cur = Math.round((pusat.kap[key].cur - amount) * 100) / 100;
            target.kap[key].cur = Math.round((target.kap[key].cur + amount) * 100) / 100;
            addLog(`KIRIM OTOMATIS: ${amount.toLocaleString('id-ID')} ${meta.unit} ${meta.label} dikirim dari Kilang Tuban ke ${target.nama}${key === 'lpg_curah' ? ' (curah, siap dikonversi jadi tabung di sana)' : ''}.`, 'purple');
            showModal('Pengiriman Terkirim', `${amount.toLocaleString('id-ID')} ${meta.unit} ${meta.label} berhasil dikirim otomatis ke ${target.nama}.`, key === 'lpg_curah' ? 'fa-truck-ramp-box' : 'fa-gas-pump', 'blue');
            renderRefineries();
        }

        const BBL_KIRIM_STEP = 8000;
        function kirimBblKeDepo() {
            const sel = document.getElementById('kap-kirim-target-bbl');
            if (!sel || !sel.value) return showModal('Pilih Tujuan', 'Pilih dulu Depo Cabang tujuan pengiriman.', 'fa-circle-exclamation', 'amber');
            const pusat = refineryData[0], target = refineryData.find(k => k.id === sel.value);
            if (!pusat || !target) return;
            const room = target.stok_max - target.stok_current;
            const amount = Math.min(BBL_KIRIM_STEP, pusat.stok_current, room);
            if (amount <= 0) {
                showModal('Tidak Bisa Kirim', pusat.stok_current <= 0 ? 'Stok BBL mentah di Kilang Tuban kosong.' : `Tangki BBL mentah di ${target.nama} sudah penuh.`, 'fa-circle-exclamation', 'amber');
                return;
            }
            pusat.stok_current = Math.max(0, Math.round((pusat.stok_current - amount) * 100) / 100);
            target.stok_current = Math.min(target.stok_max, Math.round((target.stok_current + amount) * 100) / 100);
            addLog(`KIRIM OTOMATIS: ${amount.toLocaleString('id-ID')} Bbl BBL mentah dikirim dari Kilang Tuban ke ${target.nama} (siap diolah jadi BBM di sana lewat tombol Konversi).`, 'purple');
            showModal('Pengiriman Terkirim', `${amount.toLocaleString('id-ID')} Bbl BBL mentah berhasil dikirim otomatis ke ${target.nama}. Olah sendiri jadi BBM di panel Kapasitas Depo cabang tersebut.`, 'fa-gas-pump', 'blue');
            renderRefineries();
        }

        const openKapPanels = new Set(); // id kilang yang panel "Kapasitas Depo"-nya sedang dibuka user - dipakai supaya tidak ikut nutup tiap renderRefineries()
        function toggleKapPanel(id) {
            const el = document.getElementById('kap-panel-' + id), btn = document.getElementById('kap-toggle-' + id);
            if (!el) return;
            el.classList.toggle('hidden');
            const nowOpen = !el.classList.contains('hidden');
            if (nowOpen) openKapPanels.add(id); else openKapPanels.delete(id);
            if (btn) { const ic = btn.querySelector('.kap-chev'); if (ic) ic.classList.toggle('rotate-180', nowOpen); }
        }

        function renderKapPanel(kilang) {
            if (!kilang.kap) return '';
            const keys = Object.keys(kilang.kap);
            if (!keys.length) return '';
            const isPusat = kilang.id === 'KILANG-01';
            // LPG Curah sudah tampil sebagai gauge bahan mentah sendiri (lpgCurahBuyHtml, sejajar BBL mentah) di Kilang
            // Pusat, jadi tidak perlu dobel muncul lagi di daftar kecil "Kapasitas Depo" ini.
            const visibleKeys = isPusat ? keys.filter(k => k !== 'lpg_curah') : keys;
            // Jenis BBM (bukan LPG) yang di kilang/depo ini memang diolah dari BBL mentah - dipakai buat tombol
            // konversi massal "Semua Jenis" (1 klik olah semua, bukan satu-satu manual per jenis lewat convertBblKeProduk).
            const bbmRefineKeys = visibleKeys.filter(key => PRODUCT_META[key] && PRODUCT_META[key].refineRatio && key !== 'lpg_curah' && key !== 'lpg_tabung');
            const anyBbmRefining = bbmRefineKeys.some(key => kilang.kap[key].refining);
            const convertAllBtn = bbmRefineKeys.length
                ? (anyBbmRefining
                    ? `<button disabled class="w-full mb-1.5 bg-amber-900/60 text-amber-200 text-[10px] font-bold py-1.5 rounded cursor-not-allowed"><i class="fa-solid fa-industry fa-fade mr-1"></i>Sedang Mengolah BBL &rarr; BBM...</button>`
                    : `<button onclick="convertBblSemuaJenis('${kilang.id}')" class="w-full mb-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold py-1.5 rounded shadow"><i class="fa-solid fa-industry mr-1"></i> Konversi BBL &rarr; Semua Jenis BBM (Isi Penuh)</button>`)
                : '';
            const rows = visibleKeys.map(key => {
                const meta = PRODUCT_META[key], slot = kilang.kap[key];
                const pct = slot.max ? Math.round((slot.cur / slot.max) * 100) : 0;
                const cost = kapUpgradeCost(meta, slot.level);
                // BBL (bahan mentah) diolah jadi BBM (Pertalite/Pertamax/dst) lewat tombol Konversi manual - tidak lagi otomatis.
                // Berlaku di Kilang Pusat MAUPUN Depo Cabang BBM: cabang mengolah sendiri stok BBL mentah yang dikirim dari pusat.
                const isBbmRefine = meta.refineRatio && key !== 'lpg_curah' && key !== 'lpg_tabung';
                // Badge "Diolah" dipakai untuk animasi selama proses konversi berjalan (BBL->BBM maupun LPG Curah->Tabung).
                const showsRefineBadge = isBbmRefine || key === 'lpg_tabung';
                const restockBtn = (isPusat && meta.buyPrice && !meta.refineRate)
                    ? `<button onclick="isiUlangProduk('${kilang.id}','${key}',${meta.step})" class="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-200 rounded px-1.5 py-0.5 font-semibold"><i class="fa-solid fa-plus"></i> Isi ${meta.step.toLocaleString('id-ID')} ${meta.unit}</button>`
                    : '';
                const refineBadge = showsRefineBadge
                    ? `<span id="kap-refine-${kilang.id}-${key}" class="${slot.refining ? '' : 'hidden'} text-[8px] text-amber-300 font-semibold shrink-0 ml-1"><i class="fa-solid fa-industry fa-fade mr-0.5"></i>Diolah</span>`
                    : '';
                const refineInfo = isBbmRefine
                    ? `<div class="text-[9px] text-gray-500 mb-1"><i class="fa-solid fa-arrows-turn-right mr-1 text-amber-500"></i>Diolah dari stok BBL mentah lewat tombol Konversi &middot; butuh ${meta.refineRatio.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Bbl mentah / ${meta.unit}</div>`
                    : '';
                const convertBblRow = isBbmRefine
                    ? (slot.refining
                        ? `<div class="mb-1"><button disabled class="w-full text-[9px] bg-amber-900/60 text-amber-200 rounded px-1.5 py-1 font-bold cursor-not-allowed"><i class="fa-solid fa-industry fa-fade mr-1"></i>Sedang Diolah Jadi ${meta.label}...</button></div>`
                        : '')
                    : '';
                const capMax = KAP_UPGRADE_CAPS[key];
                const atCap = capMax && slot.max >= capMax;
                const upgradeBtn = atCap
                    ? `<span class="text-[9px] text-gray-500 px-1.5 py-0.5"><i class="fa-solid fa-circle-check mr-1"></i>Kapasitas maksimum</span>`
                    : `<button onclick="upgradeKapasitas('${kilang.id}','${key}')" class="text-[9px] bg-emerald-700 hover:bg-emerald-600 text-white rounded px-1.5 py-0.5 font-semibold"><i class="fa-solid fa-arrow-up-right-dots"></i> Upgrade Tangki (${formatRupiah(cost)})</button>`;
                return `<div class="text-[10px]">
                    <div class="flex justify-between items-center mb-0.5 gap-1">
                        <span class="text-gray-300 font-semibold truncate flex items-center"><i class="fa-solid ${meta.icon} mr-1" style="color:${meta.color}"></i>${meta.label}${refineBadge}</span>
                        <span id="kap-text-${kilang.id}-${key}" class="font-mono text-gray-400 shrink-0">${slot.cur.toLocaleString('id-ID', { maximumFractionDigits: 1 })}/${slot.max.toLocaleString('id-ID')} ${meta.unit}</span>
                    </div>
                    <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mb-1">
                        <div id="kap-bar-${kilang.id}-${key}" class="${slot.refining ? 'refine-flow' : ''} h-full transition-all duration-500" style="width:${pct}%;background:${meta.color}"></div>
                    </div>
                    ${refineInfo}
                    ${convertBblRow}
                    <div class="flex gap-1 flex-wrap">
                        ${restockBtn}
                        ${upgradeBtn}
                    </div>
                </div>`;
            }).join('<div class="border-t border-gray-800/70"></div>');

            const convertBtn = (kilang.kap.lpg_curah && kilang.kap.lpg_tabung)
                ? (kilang.kap.lpg_tabung.refining
                    ? `<button disabled class="w-full mt-1.5 bg-amber-900/60 text-amber-200 text-[10px] font-bold py-1.5 rounded cursor-not-allowed"><i class="fa-solid fa-industry fa-fade mr-1"></i> Sedang Diolah Jadi Tabung...</button>`
                    : `<button onclick="convertLpgCurah('${kilang.id}')" class="w-full mt-1.5 bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold py-1.5 rounded"><i class="fa-solid fa-arrows-turn-to-dots mr-1"></i> Konversi LPG Curah &rarr; Tabung</button>`)
                : '';

            let kirimForm = '';
            if (isPusat) {
                // Kilang Pusat HANYA mengirim bahan mentah (BBL & LPG Curah) ke Depo Cabang - BBM/LPG Tabung jadi
                // tidak lagi dikirim jadi dari sini, tiap cabang wajib mengolah sendiri stok mentah yang diterima
                // lewat tombol Konversi di panelnya masing-masing.
                const bblOpts = refineryData.filter(d => d.is_unlocked && d.id !== 'KILANG-01' && d.unit === 'Bbl')
                    .map(d => `<option value="${d.id}">${d.nama}</option>`).join('');
                const bblRow = bblOpts ? `<div class="flex gap-1 items-center">
                        <span class="text-[9px] text-gray-400 w-16 shrink-0 truncate">BBL Mentah</span>
                        <select id="kap-kirim-target-bbl" class="flex-1 bg-gray-900 border border-gray-800 rounded text-[9px] px-1 py-0.5 text-gray-200 min-w-0"><option value="">-- Tujuan Depo --</option>${bblOpts}</select>
                        <button onclick="kirimBblKeDepo()" class="text-[9px] bg-blue-700 hover:bg-blue-600 text-white rounded px-1.5 py-0.5 font-bold shrink-0">Kirim</button>
                    </div>` : '';
                const cabangOpts = k2 => refineryData.filter(d => d.is_unlocked && d.id !== 'KILANG-01' && d.kap && d.kap[k2])
                    .map(d => `<option value="${d.id}">${d.nama}</option>`).join('');
                const rows2 = keys.filter(k2 => k2 === 'lpg_curah').map(k2 => {
                    const opts = cabangOpts(k2);
                    if (!opts) return '';
                    return `<div class="flex gap-1 items-center">
                        <span class="text-[9px] text-gray-400 w-16 shrink-0 truncate">${PRODUCT_META[k2].label}</span>
                        <select id="kap-kirim-target-${k2}" class="flex-1 bg-gray-900 border border-gray-800 rounded text-[9px] px-1 py-0.5 text-gray-200 min-w-0"><option value="">-- Tujuan Depo --</option>${opts}</select>
                        <button onclick="kirimProdukKeDepo('${k2}')" class="text-[9px] bg-blue-700 hover:bg-blue-600 text-white rounded px-1.5 py-0.5 font-bold shrink-0">Kirim</button>
                    </div>`;
                }).join('');
                if (bblRow || rows2) kirimForm = `<div class="mt-2 pt-2 border-t border-gray-800 space-y-1">
                    <div class="text-[9px] text-gray-500 uppercase font-bold">Kirim Bahan Mentah ke Depo Cabang</div>
                    ${bblRow}${rows2}
                </div>`;
            }

            const isOpen = openKapPanels.has(kilang.id);
            return `<div class="pt-1.5 border-t border-gray-800">
                <button id="kap-toggle-${kilang.id}" onclick="toggleKapPanel('${kilang.id}')" class="w-full flex items-center justify-between text-[10px] font-bold text-teal-400 uppercase tracking-wide py-1">
                    <span><i class="fa-solid fa-warehouse mr-1"></i> Kapasitas Depo (${visibleKeys.length} Jenis)</span>
                    <i class="fa-solid fa-chevron-down kap-chev text-[9px] transition-transform${isOpen ? ' rotate-180' : ''}"></i>
                </button>
                <div id="kap-panel-${kilang.id}" class="${isOpen ? '' : 'hidden'} space-y-1.5 mt-1">
                    ${convertAllBtn}
                    ${rows}
                    ${convertBtn}
                    ${kirimForm}
                </div>
            </div>`;
        }

        // ===== PENGOLAHAN BBL: sekarang manual lewat tombol Konversi (lihat convertBblKeProduk) =====
        // Update tampilan bar stok mentah & tiap tangki produk tanpa render ulang seluruh kartu (biar panel yg lagi
        // dibuka pemain, misal Kapasitas Depo, tidak ikut ke-collapse tiap kali proses olah berdenyut).
        function updateKilangLiveBars(kilang) {
            if (!kilang) return;
            const pct = kilang.stok_max ? Math.round((kilang.stok_current / kilang.stok_max) * 100) : 0;
            const crudeBar = document.getElementById('crude-bar-' + kilang.id);
            const crudeTxt = document.getElementById('crude-text-' + kilang.id);
            const anyRefining = kilang.kap ? Object.values(kilang.kap).some(s => s.refining) : false;
            if (crudeTxt) crudeTxt.innerText = `${Math.round(kilang.stok_current).toLocaleString('id-ID')} / ${kilang.stok_max.toLocaleString('id-ID')} ${kilang.unit}`;
            if (crudeBar) {
                crudeBar.style.width = pct + '%';
                crudeBar.classList.toggle('bg-red-500', pct <= 15);
                crudeBar.classList.toggle('bg-emerald-500', pct > 15);
                crudeBar.classList.toggle('refine-flow', anyRefining);
            }
            const indicator = document.getElementById('refine-indicator-' + kilang.id);
            if (indicator) indicator.classList.toggle('hidden', !anyRefining);

            const lpgSlot = kilang.kap && kilang.kap.lpg_curah;
            if (lpgSlot) {
                const lpgBar = document.getElementById('lpgcurah-bar-' + kilang.id);
                const lpgTxt = document.getElementById('lpgcurah-text-' + kilang.id);
                const lpgPct = lpgSlot.max ? Math.round((lpgSlot.cur / lpgSlot.max) * 100) : 0;
                if (lpgTxt) lpgTxt.innerText = `${lpgSlot.cur.toLocaleString('id-ID', { maximumFractionDigits: 1 })} / ${lpgSlot.max.toLocaleString('id-ID')} Ton`;
                if (lpgBar) lpgBar.style.width = lpgPct + '%';
            }

            Object.keys(kilang.kap || {}).forEach(key => {
                const meta = PRODUCT_META[key], slot = kilang.kap[key];
                const kBar = document.getElementById(`kap-bar-${kilang.id}-${key}`);
                const kTxt = document.getElementById(`kap-text-${kilang.id}-${key}`);
                const kBadge = document.getElementById(`kap-refine-${kilang.id}-${key}`);
                const kpct = slot.max ? Math.round((slot.cur / slot.max) * 100) : 0;
                if (kTxt) kTxt.innerText = `${slot.cur.toLocaleString('id-ID', { maximumFractionDigits: 1 })}/${slot.max.toLocaleString('id-ID')} ${meta.unit}`;
                if (kBar) { kBar.style.width = kpct + '%'; kBar.classList.toggle('refine-flow', !!slot.refining); }
                if (kBadge) kBadge.classList.toggle('hidden', !slot.refining);
            });
        }

        // Kredit hasil pengiriman Kilang Pusat -> Depo Cabang (rute kapal/darat). Untuk Depo Cabang LPG, muatan
        // "LPG Curah" masuk ke tangki kap.lpg_curah (yang benar-benar dipakai tombol Konversi LPG Curah -> Tabung),
        // bukan ke gauge atas yang terpisah, supaya LPG curah yang dikirim beneran bisa diolah cabang.
        // Untuk Depo Cabang BBM, BBL mentah tetap masuk ke gauge atas (stok_current), sama seperti dipakai
        // convertBblKeProduk. Mengembalikan info tangki yang dikredit, untuk ditampilkan di log.
        function creditKlgDelivery(target, amount) {
            if (target.kap && target.kap.lpg_curah && target.tipe.includes('LPG')) {
                const slot = target.kap.lpg_curah;
                slot.cur = Math.min(slot.max, Math.round((slot.cur + amount) * 100) / 100);
                return { cur: slot.cur, max: slot.max, unit: 'Ton' };
            }
            target.stok_current = Math.min(target.stok_max, Math.round((target.stok_current + amount) * 10) / 10);
            return { cur: target.stok_current, max: target.stok_max, unit: target.unit };
        }

        // Info rute transfer Kilang Pusat -> Depo tujuan: jenis muatan yg dibutuhkan & apakah dua-duanya Pesisir
        // (kalau ya, bisa dilayani kapal tanker; kalau tidak, hanya bisa lewat jalur darat).
        function transferModeInfo() {
            const targetId = document.getElementById('transfer-target-select').value;
            const pusat = refineryData[0];
            const target = refineryData.find(k => k.id === targetId);
            if (!target) return { target: null, pusat, neededType: null, coastal: false };
            const neededType = target.tipe.includes('LPG') ? 'LPG' : 'BBM';
            return { target, pusat, neededType, coastal: isCoastal(pusat) && isCoastal(target) };
        }

        // Isi ulang dropdown Unit Kapal Tanker & tampilkan/sembunyikan panel laut vs darat sesuai kelayakan rute.
        function populateTransferKapal() {
            const sel = document.getElementById('transfer-kapal-select');
            const wrapKapal = document.getElementById('transfer-kapal-wrap');
            const wrapLand = document.getElementById('transfer-land-wrap');
            const hint = document.getElementById('transfer-hint');
            if (!sel || !wrapKapal) return;
            const info = transferModeInfo();
            const prev = sel.value;
            sel.innerHTML = '';
            let ships = [];
            if (info.target && info.coastal) {
                ships = companyFleet.filter(t => t.kelas === 'kapal' && t.type === info.neededType && !busyIds.has(t.id));
                ships.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.innerText = `${s.id} [${s.plat}] - ${s.name} (${s.cap.toLocaleString()} ${info.neededType === 'LPG' ? 'Ton' : 'KL'})`; sel.appendChild(o); });
            }
            if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
            else if (sel.options.length) sel.selectedIndex = 0;

            const useKapal = !!(info.target && info.coastal && ships.length);
            wrapKapal.classList.toggle('hidden', !useKapal);
            if (wrapLand) wrapLand.classList.toggle('hidden', useKapal);

            if (hint) {
                if (!info.target) hint.textContent = '';
                else if (info.coastal && !ships.length) hint.textContent = `${info.target.nama} berakses pelabuhan (Pesisir), tapi Anda belum punya Kapal Tanker ${info.neededType} - beli dulu di tab Dealer, atau kirim sementara lewat jalur darat di bawah.`;
                else if (info.coastal) hint.textContent = `${info.target.nama} berakses pelabuhan - kirim otomatis pakai Kapal Tanker ${info.neededType}, durasi pelayaran mengikuti jarak laut sesungguhnya.`;
                else hint.textContent = `${info.target.nama} tidak berakses pelabuhan (Darat) - hanya bisa ditransfer lewat jalur darat.`;
            }
            if (useKapal) populateTransferCrew();
        }

        // Isi ulang dropdown Nahkoda & ABK yang sedang tidak bertugas.
        function populateTransferCrew() {
            const nSel = document.getElementById('transfer-nahkoda-select');
            const aSel = document.getElementById('transfer-abk-select');
            if (!nSel || !aSel) return;
            const prev = [nSel.value, aSel.value];
            nSel.innerHTML = ''; aSel.innerHTML = '';
            companyCrew.forEach(c => {
                if (busyIds.has(c.id)) return;
                const stars = '★'.repeat(repToStars(c.reputation));
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.innerText = `${c.name} (${stars} Rep ${Math.round(c.reputation)} - Viol: ${c.violations})`;
                if (c.role === 'Nahkoda') nSel.appendChild(opt.cloneNode(true));
                else if (c.role === 'ABK') aSel.appendChild(opt.cloneNode(true));
            });
            [nSel, aSel].forEach((el, i) => { if (prev[i] && el.querySelector(`option[value="${prev[i]}"]`)) el.value = prev[i]; else if (el.options.length) el.selectedIndex = 0; });
        }

        function executeTransferStock() {
            const info = transferModeInfo();
            if (!info.target) return showModal('Peringatan', 'Pilih depo tujuan terlebih dahulu!', 'fa-circle-exclamation', 'red');

            const wrapKapal = document.getElementById('transfer-kapal-wrap');
            const useKapal = wrapKapal && !wrapKapal.classList.contains('hidden');
            const { pusat, target, neededType } = info;

            // ===== RUTE LAUT: Kapal Tanker (Kilang Pusat <-> Depo Pesisir), volume = kapasitas kapal, durasi = jarak laut =====
            if (useKapal) {
                const kapal = companyFleet.find(t => t.id === document.getElementById('transfer-kapal-select').value);
                const nahkoda = companyCrew.find(c => c.id === document.getElementById('transfer-nahkoda-select').value);
                const abk = companyCrew.find(c => c.id === document.getElementById('transfer-abk-select').value);
                if (!kapal || !nahkoda || !abk) return showModal('Peringatan', 'Lengkapi pilihan Kapal Tanker, Nahkoda & ABK!', 'fa-circle-exclamation', 'red');
                if (busyCheck(kapal, nahkoda, abk)) return;
                if (docBlock(kapal)) return;

                const bblUse = target.unit === 'KL' ? Math.ceil(kapal.cap * ECO.bblPerKl) : kapal.cap;
                if (pusat.stok_current < bblUse) return showModal('Stok Kurang', `Stok Kilang Tuban tidak cukup untuk memuat kapal (butuh setara ${kapal.cap.toLocaleString()} ${target.unit}).`, 'fa-triangle-exclamation', 'red');

                const d = { spbu: target, truck: kapal, driver: nahkoda, kernet: abk, origin: pusat };
                openSuratJalanModal({ mode: 'KLG', tujuanNama: target.nama, tujuanKode: target.id, jenisMuatan: `${neededType} Curah (dari Kilang Pusat Tuban)`, volumeText: `${kapal.cap.toLocaleString()} ${target.unit}`,
                    truck: kapal, driver: nahkoda, kernet: abk, labels: { truk: 'Unit Kapal Tanker', plat: 'No. Registrasi', driver: 'Nahkoda Bertugas', kernet: 'ABK Pendamping' },
                    execute: (nomorSJ) => {
                        if (pusat.stok_current < bblUse) return showModal('Stok Kurang', 'Stok Kilang Tuban tidak mencukupi!', 'fa-triangle-exclamation', 'red');
                        pusat.stok_current = Math.max(0, pusat.stok_current - bblUse);
                        renderRefineries();
                        d.nomorSJ = nomorSJ;
                        animateKapalTransfer(d);
                        addLog(`SURAT JALAN ${nomorSJ}: Kapal ${kapal.id} [Nahkoda: ${nahkoda.name}] DITANDATANGANI & BERLAYAR membawa ${kapal.cap.toLocaleString()} ${target.unit} ${neededType} curah ke ${target.nama}.`, 'purple');
                        showModal('Kapal Berangkat', `Surat Jalan ${nomorSJ} telah ditandatangani. ${kapal.id} resmi berlayar membawa ${kapal.cap.toLocaleString()} ${target.unit} ke ${target.nama}.\nStok depo tujuan bertambah otomatis setelah kapal tiba & kru selesai bongkar muatan.`, 'fa-ship', 'blue');
                    } });
                return;
            }

            // ===== RUTE DARAT: transfer instan (truk konvoi, diabstraksikan) untuk depo tanpa akses pelabuhan =====
            const amount = parseInt(document.getElementById('transfer-amount-input').value);
            if (isNaN(amount) || amount <= 0) return showModal('Peringatan', 'Masukkan jumlah transfer yang valid!', 'fa-circle-exclamation', 'red');
            const bblUse = target.unit === 'KL' ? Math.ceil(amount * ECO.bblPerKl) : amount;
            if (pusat.stok_current < bblUse) return showModal('Stok Kurang', `Stok Kilang Tuban tidak mencukupi!`, 'fa-triangle-exclamation', 'red');

            openSuratJalanModal({ mode: 'KLG', tujuanNama: target.nama, tujuanKode: target.id, jenisMuatan: `${neededType} (dari Kilang Pusat Tuban, jalur darat)`, volumeText: `${amount.toLocaleString()} ${target.unit}`,
                execute: (nomorSJ) => {
                    if (pusat.stok_current < bblUse) {
                        showModal('Stok Kurang', 'Stok Kilang Tuban tidak mencukupi!', 'fa-triangle-exclamation', 'red');
                        return;
                    }
                    pusat.stok_current -= bblUse;
                    creditKlgDelivery(target, amount);

                    renderRefineries();
                    document.getElementById('transfer-amount-input').value = '';

                    addLog(`SURAT JALAN ${nomorSJ}: TRANSFER PASOKAN DARAT ${amount.toLocaleString()} ${target.unit} dikirim dari Tuban ke ${target.nama}.`, 'purple');
                    showModal('Transfer Berhasil', `Surat Jalan ${nomorSJ} telah ditandatangani. Berhasil mentransfer ${amount.toLocaleString()} ${target.unit} ${neededType} ke ${target.nama} lewat jalur darat.`, 'fa-truck-arrow-right', 'blue');
                } });
        }

        function filterSpbuByRegion() {
            const selectedRegion = document.getElementById('delivery-region-filter').value;
            populateSpbuDropdowns(selectedRegion);
            const l = loadedSpbuList.filter(s => isOp(s) && (selectedRegion === 'ALL' || s.wilayahId === selectedRegion));
            if (l.length) map.flyToBounds(L.latLngBounds(l.map(s => [s.lat, s.lon])), { maxZoom: 11, padding: [30, 30] });
        }

        function renderSpbuOnMap() {
            mapMarkers.forEach(m => map.removeLayer(m));
            mapMarkers = [];

            let activeSpbuCount = 0;

            loadedSpbuList.forEach(spbu => {
                if (!spbu.is_approved) return;

                if (!spbu.blocked) activeSpbuCount++;
                let markerColor = spbu.tipe === 'COCO' ? '#3b82f6' : '#a855f7';
                if (spbu.has_lpg) markerColor = '#eab308';
                if (spbu.blocked) markerColor = '#ef4444';

                const marker = L.circleMarker([spbu.lat, spbu.lon], {
                    radius: spbu.has_lpg ? 6.5 : 5,
                    fillColor: markerColor,
                    color: "#ffffff",
                    weight: 1.2,
                    fillOpacity: spbu.blocked ? 0.45 : 0.85
                }).addTo(map);

                marker.bindPopup(`
                    <div class="text-gray-900 font-sans p-1">
                        <div class="text-[10px] font-bold text-blue-700">${spbu.kode}</div>
                        <strong class="text-xs font-bold block">${spbu.nama}</strong>
                        <div class="text-[10px] text-gray-600">Kab/Kota: ${spbu.region}</div>
                        <div class="text-[10px] text-gray-600">Wilayah BBM Terdekat: <b>${spbu.wilayahBbmNama || '-'}</b>${spbu.wilayahBbmJarak != null ? ` (&plusmn;${spbu.wilayahBbmJarak} km)` : ''}</div>
                        ${spbu.has_lpg ? `<div class="text-[10px] text-gray-600">Wilayah LPG Terdekat: <b>${spbu.wilayahLpgNama || '-'}</b>${spbu.wilayahLpgJarak != null ? ` (&plusmn;${spbu.wilayahLpgJarak} km)` : ''}</div>` : ''}
                        <div class="text-[10px] text-gray-600">Keramaian: <b>${TRAFFIC[spbu.traffic || (spbu.traffic = pickTraffic())].label}</b> &middot; konsumsi BBM/LPG ${TRAFFIC[spbu.traffic].mult}x</div>
                        <div class="text-[10px] text-gray-600">${spbu.tipe === 'COCO' ? 'Milik perusahaan (dikelola swasta)' : 'Mitra: ' + esc(spbu.mitra ? spbu.mitra.nama : '-')}${spbu.has_lpg ? ' &middot; + LPG' : ''}</div>
                        ${spbu.blocked ? '<div class="text-[10px] font-bold text-red-600">DIBLOKIR - operasional off</div>' : ''}
                    </div>
                `);

                mapMarkers.push(marker);
            });

            document.getElementById('kpis-spbu-count').innerText = `${activeSpbuCount} Unit`;
        }

        function populateSpbuDropdowns(filterRegion = 'ALL') {
            const deliverySelect = document.getElementById('delivery-spbu-select');
            const lpgSelect = document.getElementById('lpg-spbu-select');
            const prevDelivery = deliverySelect.value, prevLpg = lpgSelect.value;

            deliverySelect.innerHTML = '';
            lpgSelect.innerHTML = '';

            const filteredList = loadedSpbuList.filter(s => isOp(s) && (filterRegion === 'ALL' || s.wilayahId === filterRegion));
            // Dropdown target dispatch SEKARANG cuma nampilin SPBU yang lagi punya pesanan terbuka -
            // dispatch bebas ke SPBU yang stoknya masih aman dimatikan supaya nggak dobel/bentrok
            // sama alur Pesanan SPBU. Transfer antar Kilang/Depo (tab Kilang) TIDAK kena filter ini.
            const orderFor = (kode, wantLpg) => orders.find(x => x.kode === kode && (wantLpg ? x.fuel === 'lpg' : x.fuel !== 'lpg'));

            filteredList.forEach(spbu => {
                const oBbm = orderFor(spbu.kode, false);
                if (oBbm) {
                    const opt1 = document.createElement('option');
                    opt1.value = spbu.kode;
                    opt1.innerText = `[${spbu.kode}] ${spbu.nama} \u{1F4E6} Pesan ${fuelLabel(oBbm.fuel)} ${oBbm.kl - oBbm.terkirim} KL (+6%)`;
                    deliverySelect.appendChild(opt1);
                }

                if (spbu.has_lpg) {
                    const oLpg = orderFor(spbu.kode, true);
                    if (oLpg) {
                        const opt2 = document.createElement('option');
                        opt2.value = spbu.kode;
                        opt2.innerText = `[${spbu.kode}] ${spbu.nama} - Outlet LPG \u{1F4E6} Pesan ${oLpg.kl - oLpg.terkirim} Ton (+6%)`;
                        lpgSelect.appendChild(opt2);
                    }
                }
            });

            if (!deliverySelect.options.length) deliverySelect.appendChild(new Option('-- Tidak ada SPBU dengan pesanan terbuka saat ini --', ''));
            if (!lpgSelect.options.length) lpgSelect.appendChild(new Option('-- Tidak ada Outlet LPG dengan pesanan terbuka saat ini --', ''));

            // Pertahankan pilihan SPBU sebelumnya kalau masih ada di daftar hasil filter,
            // supaya isian form pemain nggak kereset tiap dropdown di-refresh.
            if (prevDelivery && deliverySelect.querySelector(`option[value="${prevDelivery}"]`)) deliverySelect.value = prevDelivery;
            if (prevLpg && lpgSelect.querySelector(`option[value="${prevLpg}"]`)) lpgSelect.value = prevLpg;
            updateRouteEstimate('delivery'); updateRouteEstimate('lpg');
        }

        function populateTruckDropdowns() {
            const deliveryTruckSelect = document.getElementById('delivery-truck-select');
            const lpgTruckSelect = document.getElementById('lpg-truck-select');
            const prev = [deliveryTruckSelect.value, lpgTruckSelect.value];

            deliveryTruckSelect.innerHTML = '';
            lpgTruckSelect.innerHTML = '';

            companyFleet.forEach(trk => {
                if (busyIds.has(trk.id)) return; // sedang bertugas, sembunyikan dari pilihan
                if (trk.kelas === 'kapal') return; // kapal cuma buat transfer Kilang<->Depo, bukan ke SPBU
                const opt = document.createElement('option');
                opt.value = trk.id;
                opt.innerText = `${trk.id} [${trk.plat}] - ${trk.name}`;

                if (trk.type === 'BBM') deliveryTruckSelect.appendChild(opt);
                else lpgTruckSelect.appendChild(opt);
            });
            [deliveryTruckSelect, lpgTruckSelect].forEach((el, i) => { if (prev[i] && el.querySelector(`option[value="${prev[i]}"]`)) el.value = prev[i]; });
            if (!deliveryTruckSelect.value && deliveryTruckSelect.options.length) deliveryTruckSelect.selectedIndex = 0;
            if (!lpgTruckSelect.value && lpgTruckSelect.options.length) lpgTruckSelect.selectedIndex = 0;
            populateTransferKapal();
            updateRouteEstimate('delivery'); updateRouteEstimate('lpg');
        }

        // POPULATE DROPDOWN DRIVER & KERNET
        function populateCrewDropdowns() {
            const dDriver = document.getElementById('delivery-driver-select');
            const dKernet = document.getElementById('delivery-kernet-select');
            const lDriver = document.getElementById('lpg-driver-select');
            const lKernet = document.getElementById('lpg-kernet-select');

            const prev = [dDriver.value, dKernet.value, lDriver.value, lKernet.value];
            dDriver.innerHTML = ''; dKernet.innerHTML = '';
            lDriver.innerHTML = ''; lKernet.innerHTML = '';

            companyCrew.forEach(c => {
                if (busyIds.has(c.id)) return; // sedang bertugas, sembunyikan dari pilihan
                const stars = '★'.repeat(repToStars(c.reputation));
                const text = `${c.name} (${stars} Rep ${Math.round(c.reputation)} - Viol: ${c.violations})`;
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.innerText = text;

                if (c.role === 'Supir') {
                    dDriver.appendChild(opt.cloneNode(true));
                    lDriver.appendChild(opt.cloneNode(true));
                } else if (c.role === 'Kernet') {
                    dKernet.appendChild(opt.cloneNode(true));
                    lKernet.appendChild(opt.cloneNode(true));
                }
            });
            [dDriver, dKernet, lDriver, lKernet].forEach((el, i) => { if (prev[i] && el.querySelector(`option[value="${prev[i]}"]`)) el.value = prev[i]; });
            [dDriver, dKernet, lDriver, lKernet].forEach(el => { if (!el.value && el.options.length) el.selectedIndex = 0; });
            populateTransferCrew();
        }

