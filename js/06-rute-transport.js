        // ===== SURAT JALAN: NOMOR DOKUMEN, MODAL & TANDA TANGAN DIGITAL =====
        let suratJalanCounter = { BBM: 0, LPG: 0, KLG: 0 };
        let suratJalanHistory = [];
        let pendingDispatch = null;
        let sigCanvas, sigCtx, isDrawing = false, hasSignature = false;

        // Konfigurasi tampilan Surat Jalan per jenis: BBM (SPBU), LPG (SPBU), KLG (transfer kilang -> depo)
        const SJ_MODE = {
            BBM: { judul: 'Surat Jalan Pengiriman BBM', sub: 'Terminal BBM Nusantara', lTujuan: 'Tujuan SPBU', lKode: 'Kode SPBU', lJenis: 'Jenis BBM', sig: 'Tanda Tangan Digital Supir', confirm: 'Konfirmasi Keberangkatan Truk', icon: 'fa-truck-fast',
                   cek: 'Supir menyatakan kendaraan, muatan, dan dokumen telah diperiksa serta <b>laik jalan</b> untuk berangkat.', errSig: 'Supir wajib membubuhkan tanda tangan digital pada Surat Jalan sebelum truk dapat berangkat.' },
            LPG: { judul: 'Surat Jalan Pengiriman LPG', sub: 'Terminal LPG Nusantara', lTujuan: 'Tujuan SPBU/Agen', lKode: 'Kode SPBU', lJenis: 'Jenis LPG', sig: 'Tanda Tangan Digital Supir', confirm: 'Konfirmasi Keberangkatan Truk LPG', icon: 'fa-truck-fast',
                   cek: 'Supir menyatakan kendaraan, tabung/tangki LPG, segel, dan dokumen telah diperiksa serta <b>laik jalan</b> untuk berangkat.', errSig: 'Supir wajib membubuhkan tanda tangan digital pada Surat Jalan sebelum truk LPG dapat berangkat.' },
            KLG: { judul: 'Surat Jalan Transfer Kilang', sub: 'Kilang Pusat Tuban - Distribusi Antar Depo', lTujuan: 'Depo Tujuan', lKode: 'Kode Depo', lJenis: 'Jenis Muatan', sig: 'Tanda Tangan Digital Petugas Transfer', confirm: 'Konfirmasi Transfer Pasokan', icon: 'fa-truck-arrow-right',
                   cek: 'Petugas menyatakan volume, segel, dan dokumen transfer telah diperiksa serta <b>sesuai</b> untuk dikirim.', errSig: 'Petugas wajib membubuhkan tanda tangan digital pada Surat Jalan sebelum transfer dilakukan.' }
        };

        function formatNomorSuratJalan(urut, mode = 'BBM') {
            const romawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
            const now = new Date(gameNow());
            // Pakai kode perusahaan pemain sendiri (diisi saat daftar akun, lihat companyCodes/{code}) -
            // sebelumnya di sini hardcode teks 'NUSA' untuk SEMUA pemain, jadi Surat Jalan tidak pernah
            // benar-benar menampilkan kode perusahaan masing-masing pemain.
            const kodePerusahaan = (currentAccount && currentAccount.code) || 'NUSA';
            return `SJ/${mode}-${kodePerusahaan}/${String(urut).padStart(3, '0')}/${romawi[now.getMonth()]}/${now.getFullYear()}`;
        }

        // Nomor final (mengunci counter) - dipakai saat Surat Jalan benar-benar dikonfirmasi
        function generateNomorSuratJalan(mode = 'BBM') {
            suratJalanCounter[mode] += 1;
            return formatNomorSuratJalan(suratJalanCounter[mode], mode);
        }

        // data: { mode, tujuanNama, tujuanKode, jenisMuatan, volumeText, truck?, driver?, kernet?, execute(nomorSJ) }
        function openSuratJalanModal(data) {
            pendingDispatch = data;
            const cfg = SJ_MODE[data.mode];
            const now = new Date(gameNow());
            const set = (id, v) => { document.getElementById(id).textContent = v; };

            set('sj-perusahaan', currentAccount ? `${currentAccount.company} (${currentAccount.code || '-'})` : 'NAMA PERUSAHAAN ANDA');
            set('sj-judul', cfg.judul);
            set('sj-sub', cfg.sub);
            set('sj-l-tujuan', cfg.lTujuan);
            set('sj-l-kode', cfg.lKode);
            set('sj-l-jenis', cfg.lJenis);
            set('sj-sig-label', cfg.sig);
            set('sj-confirm-text', cfg.confirm);
            document.getElementById('sj-confirm-icon').className = `fa-solid ${cfg.icon} mr-2`;
            document.getElementById('sj-check-text').innerHTML = cfg.cek;

            set('sj-nomor', 'No: ' + formatNomorSuratJalan(suratJalanCounter[data.mode] + 1, data.mode) + ' (draft)');
            set('sj-tanggal', 'Tanggal: ' + now.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }));
            set('sj-spbu', data.tujuanNama);
            set('sj-kode-spbu', data.tujuanKode);
            set('sj-fuel', data.jenisMuatan);
            set('sj-volume', data.volumeText);

            // Transfer kilang darat (instan, tanpa armada) tidak memakai truk/kru, jadi kolom itu disembunyikan
            const adaKru = !!data.truck;
            document.querySelectorAll('#surat-jalan-modal .sj-truck-cell').forEach(el => el.classList.toggle('hidden', !adaKru));
            if (adaKru) {
                const lb = data.labels || {};
                set('sj-l-truk', lb.truk || 'Armada Truk');
                set('sj-l-plat', lb.plat || 'No. Polisi');
                set('sj-l-driver', lb.driver || 'Supir Bertugas');
                set('sj-l-kernet', lb.kernet || 'Kernet Pendamping');
                set('sj-truk', `${data.truck.id} - ${data.truck.name}`);
                set('sj-plat', data.truck.plat);
                set('sj-driver', `${data.driver.name} (${data.driver.id})`);
                set('sj-kernet', `${data.kernet.name} (${data.kernet.id})`);
            }
            document.getElementById('sj-checklist').checked = false;

            document.getElementById('surat-jalan-modal').classList.remove('hidden');
            document.getElementById('surat-jalan-modal').classList.add('flex');

            // Inisialisasi canvas tanda tangan setelah modal tampil agar dimensinya benar
            setTimeout(initSignaturePad, 50);
        }

        function cancelSuratJalan() {
            pendingDispatch = null;
            document.getElementById('surat-jalan-modal').classList.add('hidden');
            document.getElementById('surat-jalan-modal').classList.remove('flex');
        }

        function initSignaturePad() {
            sigCanvas = document.getElementById('signature-pad');
            sigCanvas.width = sigCanvas.offsetWidth;
            sigCtx = sigCanvas.getContext('2d');
            sigCtx.fillStyle = '#f3f4f6';
            sigCtx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
            sigCtx.strokeStyle = '#111827';
            sigCtx.lineWidth = 2.2;
            sigCtx.lineCap = 'round';
            hasSignature = false;

            const getPos = (e) => {
                const rect = sigCanvas.getBoundingClientRect();
                const point = e.touches ? e.touches[0] : e;
                return { x: point.clientX - rect.left, y: point.clientY - rect.top };
            };
            const start = (e) => { e.preventDefault(); isDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
            const move = (e) => {
                if (!isDrawing) return;
                e.preventDefault();
                const p = getPos(e);
                sigCtx.lineTo(p.x, p.y);
                sigCtx.stroke();
                hasSignature = true;
            };
            const end = () => { isDrawing = false; };

            sigCanvas.onmousedown = start;
            sigCanvas.onmousemove = move;
            sigCanvas.onmouseup = end;
            sigCanvas.onmouseleave = end;
            sigCanvas.ontouchstart = start;
            sigCanvas.ontouchmove = move;
            sigCanvas.ontouchend = end;
        }

        function clearSignature() {
            if (!sigCtx) return;
            sigCtx.fillStyle = '#f3f4f6';
            sigCtx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
            hasSignature = false;
        }

        // Tahap 2 (BBM/LPG/Kilang): dieksekusi hanya setelah Surat Jalan ditandatangani & dikonfirmasi
        function confirmKeberangkatan() {
            if (!pendingDispatch) return;
            const data = pendingDispatch;
            const cfg = SJ_MODE[data.mode];

            if (!hasSignature) {
                showModal('Tanda Tangan Diperlukan', cfg.errSig, 'fa-signature', 'red');
                return;
            }
            if (!document.getElementById('sj-checklist').checked) {
                showModal('Checklist Belum Diisi', 'Centang pernyataan pemeriksaan terlebih dahulu sebelum konfirmasi.', 'fa-clipboard-check', 'red');
                return;
            }

            const nomorSJ = generateNomorSuratJalan(data.mode);
            const signatureDataUrl = sigCanvas.toDataURL('image/png');
            suratJalanHistory.push({ nomorSJ, mode: data.mode, waktu: new Date(gameNow()), tujuan: data.tujuanNama, jenisMuatan: data.jenisMuatan, signatureDataUrl });

            cancelSuratJalan();
            data.execute(nomorSJ);
        }

        // ID jenis BBM/LPG (sama dengan field `fuel` di objek pesanan) dari sebuah truk + label muatannya -
        // dipakai untuk mencocokkan truk yang sedang jalan dengan pesanan SPBU terkait (lihat settleTruckDelivery,
        // animateDelivery, fulfilOrder).
        function orderFuelIdFor(truck, jenisMuatan) {
            if (truck.type === 'LPG') { const f = FUELS.find(x => x.lpg); return f ? f.id : null; }
            const f = FUELS.find(x => x.label === jenisMuatan);
            return f ? f.id : null;
        }
        // Perbarui fase perjalanan ('berangkat'|'tiba'|'bongkar') pada pesanan SPBU terkait sebuah pengiriman,
        // kalau pesanannya masih ada & masih terbuka. Dipanggil dari animateDelivery saat truk tiba & mulai bongkar.
        function updateOrderTahap(spbu, truck, jenisMuatan, tahap) {
            const fuelId = orderFuelIdFor(truck, jenisMuatan);
            const o = fuelId ? orders.find(x => x.kode === spbu.kode && x.fuel === fuelId && x.status === 'open') : null;
            if (o) { o.tahap = tahap; renderOrders(); }
        }
        // Keberangkatan truk (BBM & LPG): muat kargo (ambil stok kilang / beli LPG), lalu berangkat.
        // Pendapatan TIDAK cair di sini lagi - baru cair setelah truk tiba & selesai masa bongkar muatan (lihat completeUnloading).
        function settleTruckDelivery(nomorSJ, d) {
            const { spbu, truck, driver, jenisMuatan } = d;
            d.nomorSJ = nomorSJ; // dibawa sampai proses bongkar selesai untuk keperluan catatan

            if (truck.type === 'BBM' && d.origin) {
                // Kurangi tangki JENIS BBM yang benar-benar dipesan (kap[kapKey]), bukan stok BBL mentah (stok_current).
                const slot = d.kapKey && d.origin.kap && d.origin.kap[d.kapKey];
                if (slot) slot.cur = Math.max(0, Math.round((slot.cur - truck.cap) * 100) / 100);
                else d.origin.stok_current = Math.max(0, d.origin.stok_current - stokNeed(d.origin, truck.cap)); // fallback lama, jaga-jaga kalau kapKey tidak ada
                renderRefineries();
            }
            else if (truck.type === 'LPG') { const hpp = truck.cap * ECO.hppTon; companyCash -= hpp; totalExpense += hpp; bbmSpent += hpp; addFinanceLog(`Pembelian LPG ${truck.cap} Ton (${spbu.nama})`, -hpp); updateCashDisplay(); }

            // BUG FIX: pesanan SPBU terkait (kalau ada) langsung ditandai "Proses - Berangkat" begitu truk resmi
            // dikirim, supaya SEKETIKA hilang dari daftar Pesanan terbuka (bukan nyangkut di sana sampai truk
            // tiba/bongkar) dan langsung muncul di Riwayat Pesanan dengan status berjalan. inTransit dipakai
            // buat progress bar "Proses" berjalan.
            // KUNCI PESANAN BERTAHAP: kalau kapasitas truk ini belum cukup melunasi SELURUH sisa pesanan sekali
            // jalan, pesanan langsung dikunci ke truk ini (lockedTruckId) - truk lain dilarang membantu
            // (lihat orderLockBlock) dan pesanan tetap tersembunyi dari daftar terbuka (lihat isOrderDispatchable)
            // sampai truk yang sama ini selesai bolak-balik melunasi semuanya.
            const fuelIdForOrder = orderFuelIdFor(truck, jenisMuatan);
            const orderTerkait = fuelIdForOrder ? orders.find(x => x.kode === spbu.kode && x.fuel === fuelIdForOrder && x.status === 'open') : null;
            if (orderTerkait) {
                const sisaSebelumKirim = orderTerkait.kl - orderTerkait.terkirim - (orderTerkait.inTransit || 0);
                orderTerkait.inTransit = (orderTerkait.inTransit || 0) + truck.cap;
                orderTerkait.tahap = 'berangkat';
                if (!orderTerkait.lockedTruckId && truck.cap < sisaSebelumKirim) orderTerkait.lockedTruckId = truck.id;
            }

            const rmChosen = ROUTE_MODE[d.routeMode] || ROUTE_MODE.tol;
            animateDelivery(d);
            renderOrders();
            addLog(`SURAT JALAN ${nomorSJ}: Armada ${truck.id} [Supir: ${driver.name}] DITANDATANGANI & BERANGKAT membawa ${jenisMuatan} ke ${spbu.nama} lewat ${rmChosen.label}.`, 'info', 'truck');
            showModal('Truk Berangkat', `Surat Jalan ${nomorSJ} telah ditandatangani. Truk ${truck.id} resmi berangkat membawa ${jenisMuatan} ke ${spbu.nama} lewat ${rmChosen.label}${rmChosen.key === 'tol' ? ' (kena tarif tol, lebih cepat)' : ' (bebas tol, lebih jauh & lambat)'}.\nPendapatan akan cair otomatis setelah truk tiba di tujuan dan kru selesai bongkar muatan (±${UNLOAD_SECONDS} detik setelah tiba).`, 'fa-truck-fast', 'blue');
        }

        // DISPATCH LPG
        function dispatchLPGToSpbu() {
            const kodeSpbu = document.getElementById('lpg-spbu-select').value;
            const truckId = document.getElementById('lpg-truck-select').value;
            const driverId = document.getElementById('lpg-driver-select').value;
            const kernetId = document.getElementById('lpg-kernet-select').value;
            const lpgType = document.getElementById('lpg-type-select').value;
            const routeModeInputLpg = document.querySelector('input[name="lpg-route-mode"]:checked');
            const routeModeLpg = routeModeInputLpg ? routeModeInputLpg.value : 'tol';

            const spbu = loadedSpbuList.find(s => s.kode === kodeSpbu);
            if (spbu && spbu.blocked) return showModal('SPBU Diblokir', 'Lisensi SPBU ini dicabut. Operasional dihentikan.', 'fa-ban', 'red');
            const truck = companyFleet.find(t => t.id === truckId);
            const driver = companyCrew.find(c => c.id === driverId);
            const kernet = companyCrew.find(c => c.id === kernetId);

            if (!spbu || !truck || !driver || !kernet) {
                showModal('Peringatan', 'Lengkapi pilihan SPBU, Armada LPG, Supir & Kernet!', 'fa-circle-exclamation', 'red');
                return;
            }
            if (busyCheck(truck, driver, kernet)) return;
            if (docBlock(truck)) return;
            if (truck.type !== 'LPG') return showModal('Armada Salah', 'Pilih truk LPG untuk pengiriman LPG.', 'fa-circle-exclamation', 'red');
            const lockMsgLpg = orderLockBlock(spbu, 'lpg', truck);
            if (lockMsgLpg) return showModal('Pesanan Terkunci', lockMsgLpg, 'fa-lock', 'red');
            const sizeMsg = truckSizeBlock(spbu, 'lpg', truck, 'LPG');
            if (sizeMsg) return showModal('Pakai Armada yang Lebih Pas', sizeMsg, 'fa-truck-ramp-box', 'red');
            const hpp = truck.cap * ECO.hppTon;
            if (companyCash < hpp) return showModal('Kas Tidak Cukup', `Butuh ${formatRupiah(hpp)} untuk membeli ${truck.cap} Ton LPG dari pemasok.`, 'fa-triangle-exclamation', 'red');
            // Jaga-jaga di sisi server logic, sama seperti dispatch BBM: paksa Non-Tol kalau rute tol ternyata
            // tidak tersedia untuk asal/tujuan ini walau radio UI entah kenapa masih menunjuk ke Tol.
            const originLpg = pickOrigin(truck.type, spbu, truck.cap, truck);
            const routeModeLpgFinal = originLpg && !tollRouteAvailable(originLpg, spbu) ? 'nontol' : routeModeLpg;

            const d = { spbu, truck, driver, kernet, jenisMuatan: lpgType, hargaPerUnit: ECO.jualTon, routeMode: routeModeLpgFinal };
            openSuratJalanModal({ mode: 'LPG', tujuanNama: spbu.nama, tujuanKode: spbu.kode, jenisMuatan: lpgType, volumeText: `${truck.cap} Ton`, truck, driver, kernet,
                execute: (no) => settleTruckDelivery(no, d) });
        }

        const ctx = document.getElementById('chartSupply').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Penyaluran BBM Nasional (KL)',
                    data: [1200, 1900, 3000, 5400, 4200, 2100],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af', font: { size: 9 } } },
                    y: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af', font: { size: 9 } } }
                }
            }
        });

        // ===== ANIMASI KENDARAAN DI PETA (mengikuti jalan sebenarnya) =====
        const routeCache = new Map();
        let activeAnims = 0;
        const TRUCK_COLOR = { BBM: '#10b981', LPG: '#f59e0b' };
        const AVG_TRUCK_SPEED_KMH = 45; // estimasi kecepatan rata-rata truk tangki di jalan (termasuk berhenti/istirahat), mendekati perkiraan Google Maps utk kendaraan besar
        const UNLOAD_SECONDS = 35; // waktu nyata (detik) kru bongkar muatan setelah truk tiba, sebelum pendapatan cair - dinaikkan dari 20 detik biar fase "Bongkar Muat" terasa (tidak sekejap saja)
        // Catatan: GAME_SPEED dideklarasikan lebih bawah di file ini; dipakai di dalam fungsi (bukan di top-level) agar sudah terisi saat dipanggil.

        // ===== RUTE TOL vs NON-TOL: biaya BBM truk & tarif tol mengikuti kondisi nyata Indonesia =====
        // Harga Solar non-subsidi/industri (acuan Dexlite/Dex per medio 2026) - truk perusahaan tidak pakai Biosolar subsidi.
        const HARGA_SOLAR_TRUK = 21000; // Rp/liter
        // Konsumsi BBM truk tangki: makin besar kapasitas & makin berat muatan, makin boros per km.
        function kmPerLiterTruk(truck) {
            const cap = (truck && truck.cap) || 0;
            if (cap <= 8) return 4.2;
            if (cap <= 16) return 3.4;
            if (cap <= 24) return 2.8;
            return 2.3; // trailer 32 KL / LPG trailer 20 Ton ke atas
        }
        // Golongan tarif tol berdasarkan jumlah sumbu kendaraan, mengikuti aturan resmi BPJT/Kepmen PUPR:
        // tarif Golongan II & III = 1,5x Golongan I, Golongan IV & V = 2x Golongan I.
        const TARIF_TOL_GOL_I_PER_KM = 1000; // Rp/km, acuan tarif awal Golongan I ruas baru Tol Trans-Jawa
        function golonganTolTruk(truck) {
            const axle = String((truck && truck.axle) || '');
            if (/semi-trailer|trailer/i.test(axle)) return { gol: 'IV/V', mult: 2 };
            return { gol: 'II/III', mult: 1.5 }; // truk tangki 2-3 sumbu (rigid) tetap kena Golongan II/III
        }
        function tarifTolPerKm(truck) { return TARIF_TOL_GOL_I_PER_KM * golonganTolTruk(truck).mult; }
        // Rute Non-Tol (jalan nasional/arteri): bebas tarif tol tapi jaraknya lebih jauh (banyak simpang/lewat kota).
        // Kecepatan TIDAK lagi angka tetap - lihat roadSpeedKmh() di bawah, mengikuti kelokan jalan sesungguhnya.
        const ROUTE_MODE = {
            tol: { key: 'tol', label: 'Rute Tol', distFactor: 1.00 },
            nontol: { key: 'nontol', label: 'Rute Non-Tol', distFactor: 1.20 }
        };
        // Rasio panjang jalur riil terhadap jarak garis lurus (haversine) antar 2 titik - makin besar rasionya,
        // makin berkelok-kelok jalannya (banyak tikungan), makin kecil (mendekati 1) makin lurus & renggang.
        function sinuosityOf(pts, straightKm) {
            let total = 0;
            for (let i = 1; i < pts.length; i++) total += distKm({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: pts[i][0], lon: pts[i][1] });
            return { total, sinuosity: total / (straightKm > 0.05 ? straightKm : total || 1) };
        }
        // Kecepatan truk mengikuti karakter jalan sesungguhnya (sinuosity = rasio panjang jalur riil vs garis
        // lurus, makin besar makin berkelok) DAN mode rute yang dipilih - masing-masing mode punya rentang
        // kecepatan sendiri, jadi keduanya tidak overlap:
        //  - Rute Tol (jalan bebas hambatan): 80-100 km/j. Tol sesungguhnya bisa juga sedikit berkelok
        //    (naik-turun kontur/interchange), jadi tetap diskalakan dari sinuosity, hanya rentangnya jauh
        //    lebih tinggi dari jalan biasa.
        //  - Rute Non-Tol (jalan nasional/arteri, lewat kota/kampung): 55-80 km/j, makin berkelok jalurnya
        //    (banyak tikungan/persimpangan) makin pelan.
        // Rentang kecepatan resmi per mode rute (dipakai roadSpeedKmh() DAN untuk clamp fluktuasi kecepatan
        // "hidup" yang ditampilkan real-time di popup info truk - lihat liveSpeedKmh() di 07-animasi-kapal.js).
        const SPEED_RANGE = { tol: [80, 100], nontol: [55, 80] };
        function roadSpeedKmh(sinuosity, real, routeKey) {
            const rm = ROUTE_MODE[routeKey] || ROUTE_MODE.tol;
            if (rm.key === 'tol') {
                let speed;
                if (!real) speed = 90; // rute perkiraan (OSRM gagal dimuat) - anggap tol lancar rata-rata
                else if (sinuosity >= 1.15) speed = 80;      // ada kelokan cukup berarti (interchange/kontur)
                else if (sinuosity >= 1.08) speed = 88;
                else if (sinuosity >= 1.03) speed = 95;
                else speed = 100;                             // lurus & renggang, khas ruas tol utama
                return Math.max(SPEED_RANGE.tol[0], Math.min(SPEED_RANGE.tol[1], speed));
            }
            let speed;
            if (!real) speed = 55; // rute perkiraan (OSRM gagal dimuat) sengaja dibuat berkelok, anggap jalan kecil
            else if (sinuosity >= 1.35) speed = 55;      // sangat berkelok-kelok
            else if (sinuosity >= 1.22) speed = 60;      // cukup berkelok
            else if (sinuosity >= 1.12) speed = 68;      // sedikit berkelok
            else if (sinuosity >= 1.05) speed = 74;      // relatif lurus
            else speed = 80;                              // nyaris lurus & renggang, jarang ada belokan
            return Math.max(SPEED_RANGE.nontol[0], Math.min(SPEED_RANGE.nontol[1], speed));
        }
        // Bikin daftar kecepatan NAIK/TURUN BERTAHAP dari satu ruas ke ruas berikutnya (mis. 55 > 60 > 70 > 80),
        // dipakai supaya transisi jalan-biasa->tol->jalan-biasa tidak ditampilkan sebagai lompatan angka tunggal
        // (55 lalu tiba-tiba 90), melainkan tahapan akselerasi/deselerasi yang lebih masuk akal & enak dibaca.
        // Jarak antar tahap kira-kira 10 km/j (maksimal 4 tahap), lalu dibulatkan supaya angkanya rapi.
        function speedRampSteps(from, to, maxSteps = 4) {
            from = Math.round(from); to = Math.round(to);
            if (from === to) return [from];
            const dir = to > from ? 1 : -1, diff = Math.abs(to - from);
            const stepCount = Math.min(maxSteps, Math.max(1, Math.round(diff / 10)));
            const steps = [from];
            for (let i = 1; i < stepCount; i++) steps.push(Math.round(from + dir * (diff * i / stepCount)));
            steps.push(to);
            return steps;
        }
        // Estimasi biaya sekali jalan (one-way) untuk preview sebelum truk berangkat.
        function estimasiBiayaRute(kmEfektif, speedKmh, truck, routeKey) {
            const rm = ROUTE_MODE[routeKey] || ROUTE_MODE.tol;
            const biayaBbm = Math.round((kmEfektif / kmPerLiterTruk(truck)) * HARGA_SOLAR_TRUK);
            const biayaTol = rm.key === 'tol' ? Math.round(kmEfektif * tarifTolPerKm(truck)) : 0;
            const jamTempuh = kmEfektif / speedKmh;
            return { kmEfektif, biayaBbm, biayaTol, jamTempuh, rm };
        }

        // Tampilkan estimasi jarak, kecepatan, biaya BBM & tol secara live begitu SPBU/armada/rute dipilih,
        // dengan mengambil rute jalan sesungguhnya (sama seperti yang dipakai animasi) supaya preview akurat.
        let routeEstimateSeq = 0;
        async function updateRouteEstimate(prefix) {
            const box = document.getElementById(prefix + '-route-estimate');
            if (!box) return;
            const spbuSel = document.getElementById(prefix + '-spbu-select');
            const truckSel = document.getElementById(prefix + '-truck-select');
            const spbu = spbuSel && loadedSpbuList.find(s => s.kode === spbuSel.value);
            const truck = truckSel && companyFleet.find(t => t.id === truckSel.value);
            if (!spbu || !truck) {
                applyTollLock(prefix, null, null); // belum lengkap dipilih -> buka kunci Rute Tol dulu
                const modeInputEarly = document.querySelector(`input[name="${prefix}-route-mode"]:checked`);
                const routeKeyEarly = modeInputEarly ? modeInputEarly.value : 'tol';
                document.querySelectorAll(`.route-opt[data-prefix="${prefix}"]`).forEach(el => {
                    const on = el.dataset.mode === routeKeyEarly;
                    el.classList.toggle('border-emerald-600/60', on && prefix === 'delivery');
                    el.classList.toggle('border-amber-600/60', on && prefix === 'lpg');
                    el.classList.toggle('border-gray-800', !on);
                });
                box.innerHTML = 'Pilih SPBU &amp; armada untuk melihat estimasi jarak, BBM &amp; tol.';
                return;
            }
            // Preview juga ikut jenis BBM yang dipilih (kalau ada), supaya kilang/depo asal yang ditampilkan
            // sama dengan yang benar-benar dipakai saat dispatch (lihat FUEL_KAP_KEY di dispatchToSpbu).
            const fuelSel = document.getElementById(prefix + '-fuel-type');
            const fBBMPrev = fuelSel && FUELS.find(x => x.label === fuelSel.value);
            const kapKeyPrev = fBBMPrev && FUEL_KAP_KEY[fBBMPrev.id];
            const origin = pickOrigin(truck.type, spbu, truck.cap, truck, kapKeyPrev);
            if (!origin) {
                applyTollLock(prefix, null, null);
                box.innerHTML = '<span class="text-amber-400">Tidak ditemukan kilang/depo asal yang cocok untuk kombinasi ini.</span>';
                return;
            }

            // Kunci pilihan "Rute Tol" otomatis kalau asal/tujuan pengiriman ini tidak dilalui jaringan tol -
            // lihat applyTollLock(). routeKey diambil ULANG setelahnya karena bisa saja dipaksa pindah ke Non-Tol.
            const routeKey = applyTollLock(prefix, origin, spbu);

            // Sorot kartu rute yang lagi dipilih
            document.querySelectorAll(`.route-opt[data-prefix="${prefix}"]`).forEach(el => {
                const on = el.dataset.mode === routeKey;
                el.classList.toggle('border-emerald-600/60', on && prefix === 'delivery');
                el.classList.toggle('border-amber-600/60', on && prefix === 'lpg');
                el.classList.toggle('border-gray-800', !on);
            });

            const mySeq = ++routeEstimateSeq;
            box.innerHTML = '<span class="text-gray-500">Menghitung rute...</span>';
            const straightKm = distKm(origin, spbu);

            // Kalau Rute Tol dipilih & ada kombinasi gerbang masuk/keluar yang masuk akal (lihat pickTollGates),
            // preview dipecah jadi 3 ruas SAMA PERSIS seperti yang dijalankan animasi truk (driveLeg di
            // 07-animasi-kapal.js): jalan biasa -> tol -> jalan biasa. Biaya tol dihitung HANYA dari km ruas
            // tengah (yang benar-benar di jalan tol), bukan dari seluruh jarak - sebelumnya seluruh jarak
            // dikenakan tarif tol walau sebagian besarnya sebenarnya cuma jalan akses biasa menuju gerbang.
            const gates = routeKey === 'tol' ? pickTollGates(origin, spbu) : null;
            let real, kmEfektif, speedKmh, sinuosity, biayaBbm, biayaTol, jamTempuh, karakterJalan, rmLabelUsed = ROUTE_MODE[routeKey] || ROUTE_MODE.tol;

            if (gates) {
                const [r1, r2, r3] = await Promise.all([
                    fetchRoute(origin, gates.entryPoint, 'nontol'),
                    fetchRoute(gates.entryPoint, gates.exitPoint, 'tol'),
                    fetchRoute(gates.exitPoint, spbu, 'nontol')
                ]);
                if (mySeq !== routeEstimateSeq) return;
                const raw = [
                    { r: r1, key: 'nontol', straight: distKm(origin, gates.entryPoint) },
                    { r: r2, key: 'tol', straight: distKm(gates.entryPoint, gates.exitPoint) },
                    { r: r3, key: 'nontol', straight: distKm(gates.exitPoint, spbu) }
                ].map(l => {
                    const s = sinuosityOf(l.r.pts, l.straight);
                    const spd = roadSpeedKmh(s.sinuosity, l.r.real, l.key);
                    const km = s.total * (ROUTE_MODE[l.key] || ROUTE_MODE.tol).distFactor;
                    return { km, spd, real: l.r.real, key: l.key, jam: km / spd };
                });
                real = raw.every(l => l.real);
                kmEfektif = raw.reduce((s, l) => s + l.km, 0);
                jamTempuh = raw.reduce((s, l) => s + l.jam, 0);
                // "rata-rata" yang ditampilkan sekarang diambil langsung dari 2 angka yang sudah muncul di
                // atas (speed jalan biasa & speed tol, lihat karakterJalan "55 > 100" di bawah) - dirata-rata
                // sederhana, BUKAN dihitung ulang dari total-jarak/total-waktu (jamTempuh tetap dihitung dari
                // situ untuk estimasi waktu tempuh & biaya, cuma angka speed yang DITAMPILKAN saja yang beda
                // sumbernya, supaya konsisten & gampang dicek pemain dengan 2 angka yang mereka lihat).
                speedKmh = (raw[0].spd + raw[1].spd) / 2;
                sinuosity = raw[1].km > 0 ? raw[1].km / (raw[1].straight || raw[1].km) : 1;
                biayaBbm = Math.round((kmEfektif / kmPerLiterTruk(truck)) * HARGA_SOLAR_TRUK);
                biayaTol = Math.round(raw[1].km * tarifTolPerKm(truck));
                // Selalu tampilkan speed NAIK/TURUN BERTAHAP (mis. 55 > 60 > 70 > 80 > 90 > 80 > ... > 55),
                // baik saat rute OSRM asli berhasil dimuat MAUPUN saat gagal (fallback "rute perkiraan") -
                // sebelumnya begitu OSRM gagal, keterangan 3 ruas ini langsung diganti jadi teks generik
                // 'rute perkiraan' padahal kecepatan tiap ruas (55/90/55 km/j dst, lihat roadSpeedKmh) TETAP
                // dihitung berbeda per ruas di balik layar - cuma tidak pernah ditunjukkan ke pemain, jadi
                // Rute Tol & Non-Tol terlihat sama saja di keterangan. Ramp naik dipasang saat masuk tol
                // (akselerasi), ramp turun dipasang saat keluar tol lagi ke jalan biasa (deselerasi) - nilai
                // tengah (puncak) tidak diulang dua kali antara ramp naik & turun.
                // Cukup tampilkan speed AWAL (jalan biasa masuk gerbang) -> PUNCAK (di ruas tol), tanpa
                // tahapan tengah, supaya keterangan tidak kepanjangan - mis. "55 > 100 km/j".
                const rampTxt = `${Math.round(raw[0].spd)} &gt; ${Math.round(raw[1].spd)}`;
                karakterJalan = `${rampTxt} km/j${real ? '' : ' &middot; rute perkiraan'}`;
            } else {
                const { pts, real: realDirect } = await fetchRoute(origin, spbu, routeKey);
                if (mySeq !== routeEstimateSeq) return; // sudah ada permintaan estimasi lain yang lebih baru, buang hasil ini
                const s = sinuosityOf(pts, straightKm);
                sinuosity = s.sinuosity; real = realDirect;
                speedKmh = roadSpeedKmh(sinuosity, real, routeKey);
                const rmDef = ROUTE_MODE[routeKey] || ROUTE_MODE.tol;
                kmEfektif = s.total * rmDef.distFactor;
                const est = estimasiBiayaRute(kmEfektif, speedKmh, truck, routeKey);
                biayaBbm = est.biayaBbm; biayaTol = est.biayaTol; jamTempuh = est.jamTempuh;
                karakterJalan = !real ? 'rute perkiraan' : sinuosity >= 1.22 ? 'jalan berkelok-kelok' : sinuosity >= 1.12 ? 'sedikit berkelok' : 'jalan renggang & lurus';
            }

            const gol = golonganTolTruk(truck);
            const totalPP = (biayaBbm + biayaTol) * 2;

            box.innerHTML = `
                <div class="flex justify-between"><span>Asal &rarr; Tujuan</span><span class="text-gray-300 font-semibold">${esc(origin.nama)} &rarr; ${esc(spbu.nama)}</span></div>
                <div class="flex justify-between"><span>Estimasi Jarak (1 arah)</span><span class="text-gray-300 font-mono">&plusmn;${Math.round(kmEfektif)} km &middot; ${rmLabelUsed.label}</span></div>
                <div class="flex justify-between"><span>Kondisi Jalan &amp; Kecepatan</span><span class="text-gray-300 font-mono">${karakterJalan} &middot; rata-rata ${Math.round(speedKmh)} km/j</span></div>
                <div class="flex justify-between"><span>Estimasi Waktu Tempuh</span><span class="text-gray-300 font-mono">${fmtJam(jamTempuh)}</span></div>
                <div class="flex justify-between"><span>Biaya BBM Solar (PP)</span><span class="text-red-400 font-mono">${formatRupiah(biayaBbm * 2)}</span></div>
                <div class="flex justify-between"><span>Biaya Tol Gol. ${gol.gol} (PP)</span><span class="text-red-400 font-mono">${biayaTol > 0 ? formatRupiah(biayaTol * 2) : 'Rp0 (bebas tol)'}</span></div>
                <div class="flex justify-between border-t border-gray-800 mt-1 pt-1"><span class="font-bold text-gray-300">Total Estimasi Operasional (PP)</span><span class="font-bold text-gray-100 font-mono">${formatRupiah(totalPP)}</span></div>`;
        }

        function distKm(a, b) {
            const rad = x => x * Math.PI / 180;
            const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
            return 12742 * Math.asin(Math.sqrt(h));
        }

        // ===== DETEKSI AKSES PELABUHAN (OTOMATIS DARI LAT/LON) =====
        // Titik acuan kota-kota pesisir besar se-Indonesia. Kilang/Depo dianggap "punya akses laut" (coastal)
        // kalau jaraknya ke titik acuan terdekat di bawah COASTAL_THRESHOLD_KM - dipakai buat nentuin apakah
        // sebuah cabang bisa dilayani kapal tanker, atau cuma bisa lewat darat pakai truk.
        const COASTAL_ANCHORS = [
            { name: 'Tuban', lat: -6.8979, lon: 112.0649 },
            { name: 'Jakarta/Tanjung Priok', lat: -6.10, lon: 106.88 }, { name: 'Semarang', lat: -6.95, lon: 110.43 },
            { name: 'Surabaya', lat: -7.20, lon: 112.75 }, { name: 'Banyuwangi', lat: -8.22, lon: 114.37 },
            { name: 'Denpasar/Bali', lat: -8.55, lon: 115.22 }, { name: 'Makassar', lat: -5.13, lon: 119.43 },
            { name: 'Balikpapan', lat: -1.27, lon: 116.83 }, { name: 'Banjarmasin', lat: -3.32, lon: 114.59 },
            { name: 'Pontianak', lat: -0.02, lon: 109.34 }, { name: 'Tarakan', lat: 3.30, lon: 117.63 },
            { name: 'Bitung', lat: 1.45, lon: 125.18 }, { name: 'Donggala', lat: -0.68, lon: 119.75 },
            { name: 'Mamuju', lat: -2.68, lon: 118.89 }, { name: 'Belawan/Medan', lat: 3.78, lon: 98.68 },
            { name: 'Palembang', lat: -2.99, lon: 104.76 }, { name: 'Padang', lat: -0.95, lon: 100.35 },
            { name: 'Dumai', lat: 1.68, lon: 101.45 }, { name: 'Jayapura', lat: -2.53, lon: 140.72 },
            { name: 'Ambon', lat: -3.70, lon: 128.18 }, { name: 'Kupang', lat: -10.17, lon: 123.61 }
        ];
        const COASTAL_THRESHOLD_KM = 40;
        function isCoastal(entity) {
            if (!entity || entity.lat == null || entity.lon == null) return false;
            return COASTAL_ANCHORS.some(a => distKm(entity, a) <= COASTAL_THRESHOLD_KM);
        }

        // ===== PENYEBERANGAN FERRY ANTAR PULAU =====
        // Deteksi pulau dari nama/provinsi (kilang, depo, maupun SPBU) - dipakai untuk menentukan apakah
        // sebuah pengiriman perlu naik kapal ferry (Jawa <-> Bali/Kalimantan/Sulawesi).
        function islandOfName(txt) {
            const t = String(txt || '').toLowerCase();
            if (/\bbali\b/.test(t)) return 'Bali';
            if (/sulawesi|sul(ut|teng|bar|sel|tra)|manado|bitung|palu|mamuju|makassar|kendari|parepare|gowa|maros/.test(t)) return 'Sulawesi';
            if (/kalimantan|kal(tim|sel|bar|teng|tara)|balikpapan|samarinda|banjarmasin|banjarbaru|pontianak|singkawang|palangka|sampit|bontang|tarakan/.test(t)) return 'Kalimantan';
            return 'Jawa';
        }
        const islandOf = e => islandOfName(`${e.provinsi || ''} ${e.nama || ''} ${e.region || ''}`);
        // Pelabuhan penyeberangan (nama & koordinat mengikuti OpenStreetMap) - satu entri per rute tujuan pulau.
        const PORTS = {
            Jawa: [
                { name: 'Pelabuhan ASDP Ketapang, Banyuwangi', lat: -8.1247, lon: 114.3903, ke: 'Bali' },
                { name: 'Pelabuhan Tanjung Perak, Surabaya', lat: -7.1978, lon: 112.7378, ke: 'Kalimantan' },
                { name: 'Pelabuhan Tanjung Perak, Surabaya', lat: -7.1978, lon: 112.7378, ke: 'Sulawesi' }
            ],
            Bali: [{ name: 'Pelabuhan ASDP Gilimanuk, Bali', lat: -8.1594, lon: 114.4364, ke: 'Jawa' }],
            Kalimantan: [{ name: 'Pelabuhan Trisakti, Banjarmasin', lat: -3.3208, lon: 114.5875, ke: 'Jawa' }],
            Sulawesi: [{ name: 'Pelabuhan Soekarno-Hatta, Makassar', lat: -5.1289, lon: 119.4022, ke: 'Jawa' }]
        };
        function getPort(island, towardIsland) {
            const list = PORTS[island] || PORTS.Jawa;
            return list.find(p => p.ke === towardIsland) || list[0];
        }

        // ===== JARINGAN JALAN TOL NYATA (dipakai mengunci pilihan "Rute Tol") =====
        // Dimodelkan sebagai graf titik+ruas (bukan cuma satu garis lurus) supaya bisa merepresentasikan rute
        // CAMPURAN yang realistis: jalan biasa ke gerbang tol terdekat -> masuk tol -> keluar di gerbang terdekat
        // dari tujuan -> lanjut jalan biasa. Jadi truk TIDAK harus mulai & berakhir persis di jalur tol supaya
        // "Rute Tol" tetap bisa dipilih - selama total jarak lewat tol tidak jadi memutar jauh dibanding jalan
        // langsung. Contoh: Tuban -> Situbondo tetap bisa lewat tol (masuk di Gresik/Manyar, keluar di
        // Probolinggo) walau titik awal & akhirnya sendiri tidak persis di jalur tol.
        const TOLL_NETWORK = {
            Jawa: {
                nodes: [
                    [-5.9280, 106.0075], [-6.1783, 106.6319], [-6.3015, 107.3020], [-6.9030, 107.6180], [-6.7063, 108.5571], // 0-4: Merak-Jakarta-Cikampek-Bandung(cabang)-Cirebon
                    [-6.8694, 109.1402], [-6.8886, 109.6753], [-6.9212, 110.2024], [-6.9667, 110.4167], [-7.3284, 110.4923], // 5-9: Brebes-Tegal-Pekalongan-Kendal-Semarang-Salatiga
                    [-7.5666, 110.8283], [-7.4263, 111.0247], [-7.4100, 111.4470], [-7.5350, 111.6500], [-7.6050, 111.9030], // 10-14: Solo-Sragen-Ngawi-Madiun-Nganjuk
                    [-7.5980, 112.1060], [-7.5460, 112.2350], [-7.4726, 112.4338], [-7.3830, 112.5670], [-7.2570, 112.7520], // 15-19: Kertosono-Jombang-Mojokerto-Krian-Surabaya
                    [-7.4460, 112.7180], [-7.5780, 112.7000], [-7.6550, 112.7060], [-7.6450, 112.9070], [-7.7500, 113.3000], // 20-24: Sidoarjo-Gempol-Pandaan-Pasuruan-Probolinggo(Gending, ujung timur tol saat ini)
                    [-7.2200, 112.6600], [-7.1500, 112.6300], [-6.8800, 112.1000] // 25-27: Driyorejo-Gresik/Manyar-spur arah Lamongan/Tuban (Tol KLBM & perpanjangannya)
                ],
                edges: [[0,1],[1,2],[2,3],[2,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],
                    [18,19],[18,20],[20,21],[21,22],[22,23],[23,24],[18,25],[25,26],[26,27]],
                // Nama gerbang per node (cuma untuk label log perjalanan, mengikuti urutan komentar di atas)
                names: ['Merak','Jakarta','Cikampek','Cileunyi','Cirebon','Brebes','Tegal','Pekalongan','Kendal','Semarang',
                    'Salatiga','Sragen','Ngawi','Madiun','Nganjuk','Kertosono','Jombang','Mojokerto','Krian','Surabaya',
                    'Sidoarjo','Gempol','Pandaan','Pasuruan','Probolinggo','Driyorejo','Gresik/Manyar','Lamongan/Tuban']
            },
            Bali: { nodes: [[-8.7480, 115.1670], [-8.7490, 115.2130], [-8.7960, 115.2220]], edges: [[0,1],[1,2]], names: ['Ngurah Rai','Benoa','Nusa Dua'] }, // Tol Bali Mandara: Ngurah Rai-Benoa-Nusa Dua
            Kalimantan: { nodes: [[-1.2379, 116.8529], [-0.8500, 117.0000], [-0.5022, 117.1536]], edges: [[0,1],[1,2]], names: ['Balikpapan','KM 13','Samarinda'] }, // Tol Balikpapan-Samarinda
            Sulawesi: { nodes: [[-5.1477, 119.4327], [-5.0500, 119.5000], [-4.9887, 119.5713]], edges: [[0,1],[1,2]], names: ['Makassar','KM 15','Maros'] } // Tol Makassar-Maros (Seksi 1-4)
        };
        // Jarak wajar naik/turun tol lewat jalan biasa (akses ke gerbang) tetap dianggap masuk akal sampai batas ini -
        // dilonggarkan supaya kasus seperti Tuban->Banyuwangi (masuk tol di Gresik, keluar jauh di Probolinggo,
        // lalu masih lanjut jalan biasa cukup panjang ke Banyuwangi) tetap dianggap wajar selama TOTAL rutenya
        // (lihat TOLL_DETOUR_RATIO di bawah) tidak jadi memutar jauh dibanding jalan langsung.
        const TOLL_ACCESS_CAP_KM = 150;
        // Rute-lewat-tol dianggap "layak" kalau totalnya (jalan biasa+tol+jalan biasa) tidak memutar lebih dari
        // 50% dibanding jarak langsung - kalau lebih dari itu, percuma lewat tol, jalan biasa saja lebih masuk akal.
        const TOLL_DETOUR_RATIO = 1.5;
        function nearestTollNode(entity, net) {
            let best = Infinity, idx = -1;
            net.nodes.forEach(([lat, lon], i) => { const d = distKm(entity, { lat, lon }); if (d < best) { best = d; idx = i; } });
            return { dist: best, idx };
        }
        // SEMUA node jaringan yang jaraknya (garis lurus) ke `entity` masih dalam batas wajar akses gerbang tol -
        // dipakai sebagai KANDIDAT gerbang masuk/keluar, bukan cuma 1 node paling dekat saja. Ini penting karena
        // gerbang PALING DEKAT garis lurus belum tentu gerbang yang paling EFISIEN kalau posisinya bikin rute
        // tol jadi harus memutar dulu di dalam jaringan (mis. dari Tuban, gerbang terdekat garis lurus ada di
        // spur Gresik/Manyar, tapi kalau tujuannya ke arah Kertosono/Nganjuk, gerbang Jombang - meski sedikit
        // lebih jauh dari Tuban - justru menghasilkan total rute jauh lebih pendek karena tidak perlu memutar
        // lewat Krian/Mojokerto/Surabaya dulu).
        function candidateTollNodes(entity, net, capKm) {
            const cands = [];
            net.nodes.forEach(([lat, lon], i) => {
                const d = distKm(entity, { lat, lon });
                if (d <= capKm) cands.push({ idx: i, dist: d });
            });
            return cands;
        }
        // Jarak terpendek dari SATU titik jaringan tol (srcIdx) ke SEMUA titik lain (mengikuti ruas yang benar-benar
        // ada, bukan garis lurus) - Dijkstra sederhana. Di-cache per srcIdx supaya aman dipanggil berkali-kali untuk
        // beberapa kandidat gerbang keluar sekaligus tanpa mengulang perhitungan yang sama.
        function tollNetworkDistAll(net, srcIdx) {
            net._distCache = net._distCache || {};
            if (net._distCache[srcIdx]) return net._distCache[srcIdx];
            const n = net.nodes.length, dist = new Array(n).fill(Infinity), visited = new Array(n).fill(false);
            dist[srcIdx] = 0;
            const adj = net._adj || (net._adj = (() => {
                const a = Array.from({ length: n }, () => []);
                net.edges.forEach(([i, j]) => {
                    const w = distKm({ lat: net.nodes[i][0], lon: net.nodes[i][1] }, { lat: net.nodes[j][0], lon: net.nodes[j][1] });
                    a[i].push([j, w]); a[j].push([i, w]);
                });
                return a;
            })());
            for (let iter = 0; iter < n; iter++) {
                let u = -1, best = Infinity;
                for (let k = 0; k < n; k++) if (!visited[k] && dist[k] < best) { best = dist[k]; u = k; }
                if (u === -1) break;
                visited[u] = true;
                adj[u].forEach(([v, w]) => { if (dist[u] + w < dist[v]) dist[v] = dist[u] + w; });
            }
            net._distCache[srcIdx] = dist;
            return dist;
        }
        // Jarak terpendek antar 2 titik jaringan tol tertentu - dipertahankan supaya kompatibel kalau ada
        // pemanggil lain yang butuh 1 pasang saja (dipakai lewat cache tollNetworkDistAll juga).
        function tollNetworkDist(net, srcIdx, dstIdx) {
            return tollNetworkDistAll(net, srcIdx)[dstIdx];
        }
        // Cari kombinasi gerbang-masuk & gerbang-keluar (di antara SEMUA kandidat yang jaraknya wajar dari asal/
        // tujuan) yang menghasilkan total rute lewat tol PALING PENDEK - bukan cuma pasangan node-terdekat.
        function bestTollRouteKm(a, b, net, entries, exits) {
            let best = Infinity;
            entries.forEach(en => {
                const distArr = tollNetworkDistAll(net, en.idx);
                exits.forEach(ex => {
                    const total = en.dist + distArr[ex.idx] + ex.dist;
                    if (total < best) best = total;
                });
            });
            return best;
        }
        // Pilih KOMBINASI gerbang masuk & keluar tol terbaik antara dua titik (satu pulau) sekaligus
        // mengembalikan KOORDINAT gerbangnya - dipakai untuk benar-benar memecah rute jadi 3 ruas nyata:
        // jalan biasa (asal -> gerbang masuk) -> jalan tol (gerbang masuk -> gerbang keluar) -> jalan biasa
        // (gerbang keluar -> tujuan), meniru cara kerja tol sungguhan. Null kalau tidak ada kombinasi gerbang
        // yang masuk akal (sama seperti syarat di segmentTollAvailable) - pemanggil harus fallback ke rute
        // langsung non-tol/tol biasa.
        function pickTollGates(a, b) {
            if (!a || !b || a.lat == null || b.lat == null) return null;
            const net = TOLL_NETWORK[islandOf(a)];
            if (!net) return null;
            const entries = candidateTollNodes(a, net, TOLL_ACCESS_CAP_KM);
            const exits = candidateTollNodes(b, net, TOLL_ACCESS_CAP_KM);
            if (!entries.length || !exits.length) return null;
            let best = null;
            entries.forEach(en => {
                const distArr = tollNetworkDistAll(net, en.idx);
                exits.forEach(ex => {
                    if (en.idx === ex.idx) return; // gerbang masuk & keluar sama = tidak masuk akal masuk-keluar tol
                    const total = en.dist + distArr[ex.idx] + ex.dist;
                    if (!best || total < best.total) best = { total, entry: en, exit: ex };
                });
            });
            if (!best || best.total > distKm(a, b) * TOLL_DETOUR_RATIO) return null;
            const names = net.names || [];
            const [elat, elon] = net.nodes[best.entry.idx], [xlat, xlon] = net.nodes[best.exit.idx];
            return {
                entryPoint: { lat: elat, lon: elon, nama: `Gerbang Tol ${names[best.entry.idx] || ''}`.trim() },
                exitPoint: { lat: xlat, lon: xlon, nama: `Gerbang Tol ${names[best.exit.idx] || ''}`.trim() }
            };
        }
        // Cek satu ruas perjalanan (asal & tujuan di PULAU YANG SAMA): apakah masuk akal lewat tol sebagian jalan.
        function segmentTollAvailable(a, b) {
            if (!a || !b || a.lat == null || b.lat == null) return false;
            const net = TOLL_NETWORK[islandOf(a)];
            if (!net) return false;
            // Syarat dasar: titik asal & tujuan tetap harus punya SETIDAKNYA satu gerbang dalam jangkauan wajar
            // (pakai node-terdekat tunggal untuk cek batas ini, sama seperti sebelumnya) - kalau asal/tujuan
            // memang jauh dari jaringan tol manapun (>150 km ke gerbang terdekat), Rute Tol tetap dikunci.
            const nearestA = nearestTollNode(a, net), nearestB = nearestTollNode(b, net);
            if (nearestA.dist > TOLL_ACCESS_CAP_KM || nearestB.dist > TOLL_ACCESS_CAP_KM) return false;
            // Tapi begitu lolos syarat dasar itu, jangan cuma pakai 1 gerbang node-terdekat itu - coba SEMUA
            // kandidat gerbang dalam radius wajar dari asal & tujuan, ambil kombinasi paling efisien.
            const entries = candidateTollNodes(a, net, TOLL_ACCESS_CAP_KM);
            const exits = candidateTollNodes(b, net, TOLL_ACCESS_CAP_KM);
            const viaToll = bestTollRouteKm(a, b, net, entries, exits);
            const direct = distKm(a, b);
            return viaToll <= direct * TOLL_DETOUR_RATIO;
        }
        // Rute Tol dianggap tersedia kalau MINIMAL SATU ruas perjalanan (langsung, atau salah satu ruas darat
        // sebelum/sesudah ferry kalau beda pulau) benar-benar bisa memotong lewat tol. Kalau semuanya jauh dari
        // jaringan tol atau cuma jadi memutar (mis. Tuban<->Bojonegoro yang searah, atau Situbondo<->Banyuwangi
        // yang sama-sama di luar jangkauan tol), pilihan Rute Tol otomatis dikunci ke Non-Tol.
        function tollRouteAvailable(origin, destination) {
            if (!origin || !destination) return true; // belum lengkap dipilih -> jangan dikunci dulu
            const oIsl = islandOf(origin), dIsl = islandOf(destination);
            if (oIsl === dIsl) return segmentTollAvailable(origin, destination);
            const depPort = getPort(oIsl, dIsl), arrPort = getPort(dIsl, oIsl);
            return segmentTollAvailable(origin, depPort) || segmentTollAvailable(arrPort, destination);
        }
        // Terapkan/lepas kunci visual pada kartu "Rute Tol" + paksa pilih Non-Tol kalau sedang terkunci.
        // Mengembalikan routeKey efektif yang harus dipakai ('tol'/'nontol') setelah penguncian diterapkan.
        function applyTollLock(prefix, origin, destination) {
            const tolInput = document.getElementById(prefix + '-route-tol');
            const nontolInput = document.getElementById(prefix + '-route-nontol');
            const tolLabel = document.getElementById(prefix + '-route-tol-label');
            const lockNote = document.getElementById(prefix + '-route-lock-note');
            if (!tolInput || !nontolInput) return 'tol';
            const ok = tollRouteAvailable(origin, destination);
            tolInput.disabled = !ok;
            if (tolLabel) tolLabel.classList.toggle('route-locked', !ok);
            if (lockNote) lockNote.classList.toggle('hidden', ok);
            if (!ok && tolInput.checked) { tolInput.checked = false; nontolInput.checked = true; }
            return (document.querySelector(`input[name="${prefix}-route-mode"]:checked`) || {}).value || 'nontol';
        }
        const AVG_FERRY_SPEED_KMH = 25; // kecepatan rata-rata kapal ferry RoRo
        const FERRY_QUEUE_SEC = 15; // waktu nyata (detik) antre naik/turun kapal di pelabuhan
        const AVG_SHIP_SPEED_KMH = 22; // kecepatan rata-rata kapal tanker niaga (kargo curah) - lebih pelan dari ferry RoRo
        const UNLOAD_SECONDS_KAPAL = 90; // waktu nyata (detik) bongkar-muat curah kapal tanker di pelabuhan, lebih lama dari truk

        // ===== JEDA OTOMATIS SEMUA PERJALANAN SAAT TAB/WINDOW TIDAK AKTIF =====
        // vNow() adalah "jam virtual" yang dipakai khusus untuk animasi jalan truk/kapal (posisi di peta).
        // Berhenti bertambah selagi tab disembunyikan, lalu lanjut normal (bukan mengejar) saat tab aktif lagi.
        let hiddenAccum = 0, hideStartedAt = document.hidden ? Date.now() : null;
        function vNow() { return (hideStartedAt || Date.now()) - hiddenAccum; }
        // travelTimers: daftar timer "antre pelabuhan" & "bongkar-muat" yang sedang berjalan, supaya ikut
        // dijeda/dilanjutkan manual (setTimeout biasa tidak otomatis berhenti saat tab disembunyikan).
        const travelTimers = new Set();
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (!hideStartedAt) hideStartedAt = Date.now();
                travelTimers.forEach(tm => tm.pause());
            } else if (hideStartedAt) {
                hiddenAccum += Date.now() - hideStartedAt;
                hideStartedAt = null;
                travelTimers.forEach(tm => tm.resume());
            }
        });
        // Pengganti setTimeout yang bisa dijeda - dipakai untuk antre pelabuhan & waktu bongkar-muat.
        function pausableDelay(ms) {
            return new Promise(resolve => {
                let remaining = ms, handle = null, lastStart = null;
                const timer = {
                    pause() { if (handle) { clearTimeout(handle); remaining -= Date.now() - lastStart; handle = null; } },
                    resume() { if (!handle) { lastStart = Date.now(); handle = setTimeout(() => { travelTimers.delete(timer); resolve(); }, Math.max(0, remaining)); } }
                };
                travelTimers.add(timer);
                if (!document.hidden) timer.resume();
            });
        }
        const sleep = ms => pausableDelay(ms);

        // Truk berangkat dari kilang/depo aktif terdekat yang cocok dengan jenis muatan
        const stokNeed = (k, cap) => k.unit === 'Bbl' ? Math.ceil(cap * ECO.bblPerKl) : cap;
        function pickOrigin(type, spbu, cap, truck, kapKey) {
            // Untuk BBM: kalau kapKey (jenis BBM yang dipesan) diketahui, kilang/depo baru dianggap "cukup stok"
            // jika tangki produk jadi jenis ITU (kap[kapKey].cur) mencukupi - bukan stok BBL mentah (stok_current),
            // karena BBL mentah & BBM jadi per-jenis adalah dua pool stok yang berbeda.
            const cukupBBM = k => !kapKey ? k.stok_current >= stokNeed(k, cap) : !!(k.kap && k.kap[kapKey] && k.kap[kapKey].cur >= cap);
            const ok = refineryData.filter(k => k.is_unlocked && (k.tipe.includes('Pusat') || k.tipe.includes(type)) && (!cap || type !== 'BBM' || cukupBBM(k)));
            // Utamakan kilang/depo yang jadi "wilayah" (radius terdekat) SPBU ini UNTUK JENIS PRODUK INI -
            // lihat recomputeWilayah(). Dipisah per jenis (BBM/LPG) karena depo cabang bisa cuma khusus salah satunya.
            const wilayahId = type === 'LPG' ? spbu.wilayahLpgId : spbu.wilayahBbmId;
            if (wilayahId) { const near = ok.find(k => k.id === wilayahId); if (near) return near; }
            // Kalau depo wilayah tidak memenuhi syarat (mis. stok kurang), baru coba depo pangkalan (home base) truk itu sendiri.
            if (truck && truck.depotId) { const home = ok.find(k => k.id === truck.depotId); if (home) return home; }
            return ok.reduce((best, k) => (!best || distKm(k, spbu) < distKm(best, spbu)) ? k : best, null);
        }

        // Cadangan bila layanan rute tidak terjangkau: jalur berkelok perkiraan (bukan garis lurus).
        // CATATAN PERBAIKAN: amplitudo lama (0.07 x jarak, DITUMPUK dua gelombang sinus yang bisa saling
        // menguatkan sampai 1.5x) bikin truk kelihatan melenceng puluhan km dari garis lurus asal->tujuan
        // untuk perjalanan jauh - kadang sampai kelihatan "nyasar" ke arah laut/pantai di peta, padahal ini
        // cuma perkiraan kosmetik saat OSRM gagal dijawab (berlaku sama untuk Rute Tol MAUPUN Non-Tol, karena
        // keduanya lewat fungsi ini). Sekarang amplitudo jauh lebih kecil (maks &plusmn;3% dari jarak lurus,
        // dan TIDAK ditumpuk lagi - cukup satu gelombang) supaya kelokannya tetap wajar & jalurnya tetap dekat
        // garis lurus asal-tujuan, mirip jalan sungguhan.
        function windingPath(o, d) {
            const n = 90, dx = d.lon - o.lon, dy = d.lat - o.lat, len = Math.hypot(dx, dy) || 1e-4;
            const px = -dy / len, py = dx / len, amp = len * 0.03, ph = Math.random() * 6, out = [];
            for (let i = 0; i <= n; i++) {
                const t = i / n, off = Math.sin(t * Math.PI) * amp * Math.sin(t * 10 + ph);
                out.push([o.lat + dy * t + py * off, o.lon + dx * t + px * off]);
            }
            return out;
        }

        async function fetchRoute(o, d, routeKey) {
            // routeKey ('tol'/'nontol') WAJIB ikut jadi bagian cache key & query OSRM - sebelumnya rute yang
            // digambar/dianimasikan di peta SELALU sama untuk kedua mode (cache cuma berdasar lat/lon), jadi
            // walau pemain pilih "Rute Tol", jalur yang benar-benar dilalui truk di peta tetap rute default
            // OSRM apa adanya (kadang justru rute non-tol kalau OSRM anggap itu yang tercepat/tersedia).
            // Sekarang mode Non-Tol memaksa OSRM menghindari jalan tol (exclude=motorway,toll - didukung
            // bawaan oleh profil car.lua OSRM), supaya jalur di peta benar-benar konsisten dengan pilihan.
            const rk = routeKey === 'nontol' ? 'nontol' : 'tol';
            const key = `${rk}|${o.lat},${o.lon}|${d.lat},${d.lon}`;
            if (routeCache.has(key)) return routeCache.get(key);
            try {
                const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
                const excludeParam = rk === 'nontol' ? '&exclude=motorway,toll' : '';
                const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson${excludeParam}`, { signal: ctl.signal });
                clearTimeout(t);
                const j = await r.json();
                if (j.code === 'Ok' && j.routes && j.routes[0]) {
                    const res = { pts: j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), real: true };
                    routeCache.set(key, res);
                    return res;
                }
            } catch (e) { /* jatuh ke rute perkiraan */ }
            return { pts: windingPath(o, d), real: false };
        }

        function posAt(pts, cum, sd) {
            let lo = 0, hi = cum.length - 1;
            while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= sd) lo = m; else hi = m; }
            const f = Math.min(1, Math.max(0, (sd - cum[lo]) / ((cum[hi] - cum[lo]) || 1e-9)));
            return { i: lo, ll: [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f] };
        }

        function busyCheck(truck, driver, kernet) {
            const x = [[truck, 'Truk ' + truck.id], [driver, 'Supir ' + driver.name], [kernet, 'Kernet ' + kernet.name]].find(([o]) => busyIds.has(o.id));
            if (!x) return false;
            showModal('Masih Bertugas', `${x[1]} masih dalam perjalanan atau sedang bongkar muatan. Tunggu sampai selesai atau pilih yang lain.`, 'fa-truck-fast', 'red');
            return true;
        }

