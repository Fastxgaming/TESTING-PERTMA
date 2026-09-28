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

            animateDelivery(d);
            renderOrders();
            addLog(`SURAT JALAN ${nomorSJ}: Armada ${truck.id} [Supir: ${driver.name}] DITANDATANGANI & BERANGKAT membawa ${jenisMuatan} ke ${spbu.nama}.`, 'info', 'truck');
            showModal('Truk Berangkat', `Surat Jalan ${nomorSJ} telah ditandatangani. Truk ${truck.id} resmi berangkat membawa ${jenisMuatan} ke ${spbu.nama}.\nPendapatan akan cair otomatis setelah truk tiba di tujuan dan kru selesai bongkar muatan (±${UNLOAD_SECONDS} detik setelah tiba).`, 'fa-truck-fast', 'blue');
        }

        // DISPATCH LPG
        function dispatchLPGToSpbu() {
            const kodeSpbu = document.getElementById('lpg-spbu-select').value;
            const truckId = document.getElementById('lpg-truck-select').value;
            const driverId = document.getElementById('lpg-driver-select').value;
            const kernetId = document.getElementById('lpg-kernet-select').value;
            const lpgType = document.getElementById('lpg-type-select').value;

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

            const d = { spbu, truck, driver, kernet, jenisMuatan: lpgType, hargaPerUnit: ECO.jualTon };
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

        // ===== BIAYA BBM TRUK & KECEPATAN JALAN NYATA (fitur Rute Tol/Non-Tol sudah dihapus) =====
        // Semua pengiriman sekarang lewat SATU jalur nyata (hasil OSRM apa adanya, tanpa pilihan/kunci tol),
        // jadi kecepatan & waktu tempuh murni mengikuti kondisi ASLI jalur yang benar-benar dilalui (lihat
        // roadSpeedKmh & sinuosityOf) - bukan lagi diasumsikan lancar konstan seperti gaya jalan tol.
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
        // Rasio panjang jalur riil terhadap jarak garis lurus (haversine) antar 2 titik - makin besar rasionya,
        // makin berkelok-kelok jalannya (banyak tikungan/rintangan), makin kecil (mendekati 1) makin lurus & renggang.
        function sinuosityOf(pts, straightKm) {
            let total = 0;
            for (let i = 1; i < pts.length; i++) total += distKm({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: pts[i][0], lon: pts[i][1] });
            return { total, sinuosity: total / (straightKm > 0.05 ? straightKm : total || 1) };
        }
        // Kecepatan truk mengikuti karakter/rintangan jalur sesungguhnya yang dilalui (sinuosity = rasio panjang
        // jalur riil vs garis lurus - makin besar makin banyak tikungan/rintangan di sepanjang rute), BUKAN lagi
        // angka tetap ala jalan bebas hambatan. Rentang kecepatan jalan nasional/arteri Indonesia: 55-80 km/j.
        // Dipakai juga sebagai batas clamp fluktuasi kecepatan "hidup" real-time di popup info truk - lihat
        // liveSpeedKmh() di 07-animasi-kapal.js.
        const SPEED_RANGE = [55, 80];
        function roadSpeedKmh(sinuosity, real) {
            let speed;
            if (!real) speed = 55; // rute perkiraan (OSRM gagal dimuat) sengaja dibuat berkelok, anggap jalan kecil
            else if (sinuosity >= 1.35) speed = 55;      // sangat berkelok-kelok / banyak rintangan
            else if (sinuosity >= 1.22) speed = 60;      // cukup berkelok
            else if (sinuosity >= 1.12) speed = 68;      // sedikit berkelok
            else if (sinuosity >= 1.05) speed = 74;      // relatif lurus
            else speed = 80;                              // nyaris lurus & renggang, jarang ada belokan
            return Math.max(SPEED_RANGE[0], Math.min(SPEED_RANGE[1], speed));
        }
        // Estimasi biaya sekali jalan (one-way) untuk preview sebelum truk berangkat.
        function estimasiBiayaRute(kmEfektif, speedKmh, truck) {
            const biayaBbm = Math.round((kmEfektif / kmPerLiterTruk(truck)) * HARGA_SOLAR_TRUK);
            const jamTempuh = kmEfektif / speedKmh;
            return { kmEfektif, biayaBbm, jamTempuh };
        }

        // Tampilkan estimasi jarak, kecepatan & biaya BBM secara live begitu SPBU/armada dipilih, dengan
        // mengambil rute jalan sesungguhnya (sama persis seperti yang dipakai animasi, lihat driveLeg di
        // 07-animasi-kapal.js) supaya preview akurat & benar-benar mencerminkan rintangan/kelokan jalur asli
        // yang akan dilalui truk (fitur pilihan Rute Tol/Non-Tol sudah dihapus - hanya ada satu jalur nyata).
        let routeEstimateSeq = 0;
        async function updateRouteEstimate(prefix) {
            const box = document.getElementById(prefix + '-route-estimate');
            if (!box) return;
            const spbuSel = document.getElementById(prefix + '-spbu-select');
            const truckSel = document.getElementById(prefix + '-truck-select');
            const spbu = spbuSel && loadedSpbuList.find(s => s.kode === spbuSel.value);
            const truck = truckSel && companyFleet.find(t => t.id === truckSel.value);
            if (!spbu || !truck) {
                box.innerHTML = 'Pilih SPBU &amp; armada untuk melihat estimasi jarak &amp; BBM.';
                return;
            }
            // Preview juga ikut jenis BBM yang dipilih (kalau ada), supaya kilang/depo asal yang ditampilkan
            // sama dengan yang benar-benar dipakai saat dispatch (lihat FUEL_KAP_KEY di dispatchToSpbu).
            const fuelSel = document.getElementById(prefix + '-fuel-type');
            const fBBMPrev = fuelSel && FUELS.find(x => x.label === fuelSel.value);
            const kapKeyPrev = fBBMPrev && FUEL_KAP_KEY[fBBMPrev.id];
            const origin = pickOrigin(truck.type, spbu, truck.cap, truck, kapKeyPrev);
            if (!origin) {
                box.innerHTML = '<span class="text-amber-400">Tidak ditemukan kilang/depo asal yang cocok untuk kombinasi ini.</span>';
                return;
            }

            const mySeq = ++routeEstimateSeq;
            box.innerHTML = '<span class="text-gray-500">Menghitung rute...</span>';
            const straightKm = distKm(origin, spbu);

            const { pts, real } = await fetchRoute(origin, spbu);
            if (mySeq !== routeEstimateSeq) return; // sudah ada permintaan estimasi lain yang lebih baru, buang hasil ini
            const s = sinuosityOf(pts, straightKm);
            const sinuosity = s.sinuosity;
            const speedKmh = roadSpeedKmh(sinuosity, real);
            const kmEfektif = s.total;
            const est = estimasiBiayaRute(kmEfektif, speedKmh, truck);
            const biayaBbm = est.biayaBbm, jamTempuh = est.jamTempuh;
            const karakterJalan = !real ? 'rute perkiraan' : sinuosity >= 1.22 ? 'jalan berkelok-kelok/banyak rintangan' : sinuosity >= 1.12 ? 'sedikit berkelok' : 'jalan renggang & lurus';

            // Estimasi kotor & bersih: mengikuti persis rumus yang dipakai saat pendapatan benar-benar cair
            // di completeUnloading (07-animasi-kapal.js), TERMASUK bonus jarak (di atas jarakBonusMinKm) dan biaya
            // solar pulang-pergi (PP) - MINUS bonus pesanan & potensi denda, karena itu baru pasti setelah truk
            // benar-benar tiba (hasil riil bisa lebih besar, atau berkurang kalau kena denda KIR/dokumen).
            const hargaPerUnit = truck.type === 'LPG' ? ECO.jualTon : ECO.jualKl;
            const unitLabel = truck.type === 'LPG' ? 'Ton' : 'KL';
            const revenueDasar = truck.cap * hargaPerUnit;
            const jarakBonusKm = Math.max(0, Math.min(kmEfektif, ECO.jarakBonusCapKm) - ECO.jarakBonusMinKm);
            const bonusJarak = Math.round(revenueDasar * ECO.bonusJarakPerKm * jarakBonusKm);
            const revenueKotor = revenueDasar + bonusJarak;
            const biayaKirimDasar = Math.round(truck.cap * (truck.type === 'LPG' ? ECO.biayaKirimTon : ECO.biayaKirimKl));
            const kmPP = kmEfektif * 2;
            const totalPP = biayaBbm * 2;
            const totalBiayaEstimasi = biayaKirimDasar + totalPP;
            const revenueBersihEstimasi = revenueKotor - totalBiayaEstimasi;

            box.innerHTML = `
                <div class="flex justify-between"><span>Asal &rarr; Tujuan</span><span class="text-gray-300 font-semibold">${esc(origin.nama)} &rarr; ${esc(spbu.nama)}</span></div>
                <div class="flex justify-between"><span>Estimasi Jarak (1 arah / PP)</span><span class="text-gray-300 font-mono">&plusmn;${Math.round(kmEfektif)} km / &plusmn;${Math.round(kmPP)} km</span></div>
                <div class="flex justify-between"><span>Kondisi Jalan &amp; Kecepatan</span><span class="text-gray-300 font-mono">${karakterJalan} &middot; rata-rata ${Math.round(speedKmh)} km/j</span></div>
                <div class="flex justify-between"><span>Estimasi Waktu Tempuh</span><span class="text-gray-300 font-mono">${fmtJam(jamTempuh)}</span></div>
                <div class="flex justify-between mt-1 pt-1 border-t border-gray-800"><span>Pendapatan Dasar (${truck.cap} ${unitLabel})</span><span class="text-emerald-400 font-mono">${formatRupiah(revenueDasar)}</span></div>
                <div class="flex justify-between"><span>Bonus Jarak${jarakBonusKm > 0 ? ` (+${Math.round(jarakBonusKm)} km di atas ${ECO.jarakBonusMinKm} km)` : ` (di bawah ${ECO.jarakBonusMinKm} km)`}</span><span class="text-emerald-400 font-mono">+${formatRupiah(bonusJarak)}</span></div>
                <div class="flex justify-between"><span>Pendapatan Kotor</span><span class="text-emerald-400 font-mono">${formatRupiah(revenueKotor)}</span></div>
                <div class="flex justify-between"><span>Biaya Kirim Dasar</span><span class="text-red-400 font-mono">-${formatRupiah(biayaKirimDasar)}</span></div>
                <div class="flex justify-between"><span>Biaya BBM Solar Truk (PP, &plusmn;${Math.round(kmPP)} km)</span><span class="text-red-400 font-mono">-${formatRupiah(totalPP)}</span></div>
                <div class="flex justify-between border-t border-gray-800 mt-1 pt-1"><span class="font-bold text-gray-300">Estimasi Pendapatan Bersih</span><span class="font-bold ${revenueBersihEstimasi >= 0 ? 'text-emerald-300' : 'text-red-400'} font-mono">${formatRupiah(revenueBersihEstimasi)}</span></div>
                <div class="text-[9px] text-gray-500 pt-0.5">*Belum termasuk bonus pesanan (bisa nambah) atau denda pelanggaran dokumen (bisa mengurangi) - baru pasti setelah truk tiba &amp; bongkar muatan.</div>`;
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
        // Sinkronkan jam virtual & timer perjalanan dengan status berhenti (tab tersembunyi ATAU jeda manual).
        function syncTravelSuspend() {
            if (isSuspended()) {
                if (!hideStartedAt) hideStartedAt = Date.now();
                travelTimers.forEach(tm => tm.pause());
            } else if (hideStartedAt) {
                hiddenAccum += Date.now() - hideStartedAt;
                hideStartedAt = null;
                travelTimers.forEach(tm => tm.resume());
            }
        }
        document.addEventListener('visibilitychange', syncTravelSuspend);
        // Pengganti setTimeout yang bisa dijeda - dipakai untuk antre pelabuhan & waktu bongkar-muat.
        function pausableDelay(ms) {
            return new Promise(resolve => {
                let remaining = ms, handle = null, lastStart = null;
                const timer = {
                    pause() { if (handle) { clearTimeout(handle); remaining -= Date.now() - lastStart; handle = null; } },
                    resume() { if (!handle) { lastStart = Date.now(); handle = setTimeout(() => { travelTimers.delete(timer); resolve(); }, Math.max(0, remaining)); } }
                };
                travelTimers.add(timer);
                if (!isSuspended()) timer.resume();
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

        // Cadangan bila layanan rute tidak terjangkau: jalur berkelok perkiraan (bukan garis lurus)
        function windingPath(o, d) {
            const n = 90, dx = d.lon - o.lon, dy = d.lat - o.lat, len = Math.hypot(dx, dy) || 1e-4;
            const px = -dy / len, py = dx / len, amp = len * 0.07, ph = Math.random() * 6, out = [];
            for (let i = 0; i <= n; i++) {
                const t = i / n, off = Math.sin(t * Math.PI) * amp * (Math.sin(t * 14 + ph) + 0.5 * Math.sin(t * 31 + ph * 2));
                out.push([o.lat + dy * t + py * off, o.lon + dx * t + px * off]);
            }
            return out;
        }

        // Ambil satu jalur nyata apa adanya dari OSRM (tanpa opsi tol/non-tol - fitur itu sudah dihapus),
        // supaya jalur yang digambar/dianimasikan di peta selalu konsisten dengan yang dipakai untuk
        // menghitung jarak, kecepatan & durasi (lihat sinuosityOf/roadSpeedKmh) - benar-benar mengikuti
        // rintangan/kelokan jalur asli yang dilalui, bukan direkayasa jadi 2 gaya rute berbeda.
        //
        // FIX BUG "makin banyak unit, rute makin ngawur": server OSRM publik membatasi jumlah request per detik.
        // Sebelumnya tiap truk yang berangkat langsung menembak request sendiri-sendiri (dan kalau 1x gagal/timeout
        // langsung jatuh ke rute perkiraan yang berkelok palsu menembus hutan/laut). Makin banyak unit berangkat
        // bersamaan -> makin banyak yang kena batas -> makin banyak rute palsu. Rute PULANG normal karena baru
        // diminta belasan detik kemudian saat "hujan request" sudah reda. Sekarang:
        //  1) request diantre & dijarangkan (min. jeda antar request),
        //  2) request rute yang sama yang sedang berjalan digabung (tidak dobel),
        //  3) gagal -> coba lagi beberapa kali dengan jeda bertahap, selang-seling ke server cadangan,
        //  4) rute pergi otomatis juga disimpan untuk rute pulang (dibalik) -> menghemat request,
        //  5) rute perkiraan palsu hanya dipakai kalau SEMUA percobaan gagal.
        const routeInflight = new Map();
        const ROUTE_HOSTS = [
            (o, d) => `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`,
            (o, d) => `https://routing.openstreetmap.de/routed-car/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`
        ];
        const ROUTE_MIN_GAP_MS = 450, ROUTE_MAX_TRY = 5;
        let routeSlotTail = Promise.resolve(), routeLastStart = 0;
        function nextRouteSlot() {
            routeSlotTail = routeSlotTail.then(async () => {
                const wait = routeLastStart + ROUTE_MIN_GAP_MS - Date.now();
                if (wait > 0) await new Promise(r => setTimeout(r, wait));
                routeLastStart = Date.now();
            });
            return routeSlotTail;
        }
        async function fetchRoute(o, d) {
            const key = `${o.lat},${o.lon}|${d.lat},${d.lon}`;
            if (routeCache.has(key)) return routeCache.get(key);
            if (routeInflight.has(key)) return routeInflight.get(key);
            const job = (async () => {
                for (let attempt = 0; attempt < ROUTE_MAX_TRY; attempt++) {
                    await nextRouteSlot();
                    try {
                        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
                        const r = await fetch(ROUTE_HOSTS[attempt % ROUTE_HOSTS.length](o, d), { signal: ctl.signal });
                        clearTimeout(t);
                        const j = await r.json().catch(() => null);
                        if (j && j.code === 'Ok' && j.routes && j.routes[0]) {
                            const pts = j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                            const res = { pts, real: true };
                            routeCache.set(key, res);
                            const rkey = `${d.lat},${d.lon}|${o.lat},${o.lon}`;
                            if (!routeCache.has(rkey)) routeCache.set(rkey, { pts: pts.slice().reverse(), real: true });
                            return res;
                        }
                        if (j && j.code === 'NoRoute') break; // memang tidak ada jalan, tidak perlu diulang
                    } catch (e) { /* coba lagi */ }
                    await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
                }
                return { pts: windingPath(o, d), real: false }; // benar-benar gagal semua -> rute perkiraan (tidak di-cache)
            })();
            routeInflight.set(key, job);
            try { return await job; } finally { routeInflight.delete(key); }
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

