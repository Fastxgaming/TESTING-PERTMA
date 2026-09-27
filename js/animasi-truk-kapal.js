        // ===== ANIMASI TRUK: hanya terlihat oleh pemain yang mengirim (tidak dibagikan ke pemain lain) =====
        const flying = new Set();
        let ownAnims = 0;
        // Bug fix: sebelumnya truk/kapal yang sudah tiba kembali di depot langsung dihapus total dari peta (marker +
        // bekas rute lenyap begitu saja). Sekarang truk milik sendiri "diparkir" sebagai titik kecil di lokasi
        // terakhirnya (depot) sampai truk itu ditugaskan berangkat lagi, supaya tidak terasa tiba-tiba menghilang.
        const parkedMarkers = new Map();

        // Isi popup info yang muncul saat ikon truk/kapal (yang sedang dispatch/jalan) ditekan.
        function truckInfoPopupHtml(e) {
            const isFerry = e.vehicle === 'ferry', isKapal = e.vehicle === 'kapal';
            const label = isFerry ? 'Ferry · ' + e.id : isKapal ? 'Kapal · ' + e.id : e.id;
            return `
                <div class="text-gray-900 font-sans p-1 min-w-[160px]">
                    <strong class="text-xs font-bold block text-blue-700 mb-1">${esc(label)}${e.plat ? ' · ' + esc(e.plat) : ''}</strong>
                    <div class="text-[10px] text-gray-600 leading-4">Depo: <b>${esc(e.depoNama || '-')}</b></div>
                    <div class="text-[10px] text-gray-600 leading-4">Tujuan: <b>${esc(e.tujuanNama || '-')}</b></div>
                    <div class="text-[10px] text-gray-600 leading-4">Speed: <b>${e.speedKmh ? Math.round(e.speedKmh) + ' km/j' : '-'}</b></div>
                    <div class="text-[10px] text-gray-600 leading-4">Surat Jalan: <b>${esc(e.nomorSJ || '-')}</b></div>
                </div>
            `;
        }

        // Fluktuasi kecepatan "hidup" untuk truk (kosmetik saja, TIDAK mengubah durasi/biaya perjalanan yang
        // sudah dihitung & dikunci sejak dispatch) - dulu popup info truk cuma menampilkan satu angka speed
        // tetap sepanjang perjalanan (mis. selalu "55 km/j"), padahal jalan lurus & lancar seharusnya kecepatan
        // riil naik-turun sedikit (56/57/58...80), bukan diam di satu angka. Dibungkus gelombang sinus 2
        // frekuensi (bukan random murni) supaya perubahannya mulus, bukan lompat-lompat kasar tiap frame.
        function hashSeed(str) {
            let h = 0;
            for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
            return h;
        }
        function liveSpeedKmh(t, now) {
            const range = SPEED_RANGE[t.e.segMode] || SPEED_RANGE[t.e.routeMode] || SPEED_RANGE.tol;
            const base = t.e.baseSpeedKmh != null ? t.e.baseSpeedKmh : t.e.speedKmh;
            const seed = hashSeed(t.e.id || 'truck');
            const wobble = Math.sin(now / 2600 + seed) * 0.6 + Math.sin(now / 900 + seed * 1.7) * 0.4;
            const amp = (range[1] - range[0]) * 0.18; // amplitudo proporsional lebar rentang mode-nya
            return Math.max(range[0], Math.min(range[1], base + wobble * amp));
        }
        function launchTruck(e, remote) {
            if (vNow() - e.startAt >= e.dur || flying.size > 80) return null;
            if (!remote && parkedMarkers.has(e.id)) { map.removeLayer(parkedMarkers.get(e.id)); parkedMarkers.delete(e.id); }
            const pts = e.pts, cum = [0];
            for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distKm({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: pts[i][0], lon: pts[i][1] }));
            const isFerry = e.vehicle === 'ferry';
            const isKapal = e.vehicle === 'kapal';
            const isBoat = isFerry || isKapal;
            const color = isFerry ? '#0ea5e9' : isKapal ? '#06b6d4' : (remote ? '#38bdf8' : (TRUCK_COLOR[e.type] || '#3b82f6'));
            const routeColor = '#a855f7'; // ungu terang - dulu amber (#f59e0b), gampang menyatu dengan warna jalan nasional/arteri di tile peta
            const line = L.polyline(pts, { color: routeColor, weight: remote ? 2 : 3, opacity: isBoat ? 0.75 : 0.85, dashArray: isBoat ? '2 10' : '6 8' }).addTo(map);
            const trail = L.polyline([pts[0]], { color, weight: remote ? 3 : 4, opacity: 0.85 }).addTo(map);
            const marker = L.marker(pts[0], {
                icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="truck-ico ${isBoat ? 'boat' : ''}" style="background:${color};${remote ? 'opacity:.85' : ''}"><span class="tf"><i class="fa-solid fa-${isBoat ? 'ship' : 'truck'}"></i></span></div>` }),
                zIndexOffset: remote ? 500 : 1000
            }).addTo(map);
            marker.bindTooltip(esc(remote ? `${e.owner} · ${e.plat}` : `${isFerry ? 'Ferry · ' + e.id : isKapal ? 'Kapal · ' + e.id : e.id} · ${e.plat}`), { permanent: true, direction: 'top', offset: [0, -16], className: 'truck-tip' });
            // Info armada saat ikon truk/kapal yang lagi jalan ditekan: Depo asal, Tujuan, Speed & No. Surat Jalan.
            if (!remote) marker.bindPopup(() => truckInfoPopupHtml(e), { className: 'truck-info-popup', closeButton: true, maxWidth: 220 });
            const t = { e, pts, cum, total: cum[cum.length - 1] || 0.01, marker, line, trail, remote, color, isBoat, lastTrail: 0, done: null };
            flying.add(t);
            if (flying.size === 1) requestAnimationFrame(flyLoop);
            return t;
        }

        function flyLoop() {
            const now = vNow();
            flying.forEach(t => {
                const f = Math.min(1, (now - t.e.startAt) / t.e.dur);
                if (t.e.vehicle === 'truck' && f < 1) t.e.speedKmh = liveSpeedKmh(t, now);
                const { i, ll } = posAt(t.pts, t.cum, f * t.total);
                t.marker.setLatLng(ll);
                const tf = t.marker.getElement() && t.marker.getElement().querySelector('.tf');
                const dLon = t.pts[Math.min(i + 1, t.pts.length - 1)][1] - t.pts[i][1];
                if (tf && Math.abs(dLon) > 1e-5) tf.style.transform = dLon < 0 ? 'scaleX(-1)' : '';
                if (now - t.lastTrail > 150 || f === 1) {
                    // trail (solid, terang) = jejak yang SUDAH dilalui truk, dari titik berangkat sampai posisi sekarang.
                    t.trail.setLatLngs(t.pts.slice(0, i + 1).concat([ll]));
                    // line (putus-putus, transparan) = sisa jalur yang BELUM dilalui, dari posisi truk sekarang menuju tujuan.
                    // Sebelumnya garis ini statis penuh dari titik depo sampai tujuan sejak awal; sekarang ikut menyusut
                    // mengikuti posisi truk supaya benar-benar menggambarkan arah sisa perjalanan ke tujuan.
                    t.line.setLatLngs([ll].concat(t.pts.slice(i + 1)));
                    t.lastTrail = now;
                }
                if (f < 1) return;
                const el = t.marker.getElement() && t.marker.getElement().querySelector('.truck-ico');
                if (el) { el.classList.add('done'); el.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; }
                if (t.done) t.done();
                flying.delete(t);
                setTimeout(() => {
                    [t.line, t.trail].forEach(l => map.removeLayer(l));
                    map.removeLayer(t.marker);
                    if (!t.remote) {
                        // Truk/kapal TIDAK dihapus total dari peta - diganti jadi ikon "terparkir" (redup) di lokasi
                        // terakhirnya. Ini berlaku baik saat baru tiba di tujuan (SPBU/depo, masih bongkar muatan)
                        // MAUPUN saat sudah kembali ke depot asal. Otomatis dibersihkan sendiri saat truk ini
                        // ditugaskan berangkat lagi (lihat launchTruck).
                        if (parkedMarkers.has(t.e.id)) map.removeLayer(parkedMarkers.get(t.e.id));
                        const finalLL = t.pts[t.pts.length - 1];
                        const parked = L.marker(finalLL, {
                            icon: L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: `<div class="truck-ico ${t.isBoat ? 'boat' : ''}" style="background:${t.color};opacity:.6;width:26px;height:26px"><span class="tf"><i class="fa-solid fa-${t.isBoat ? 'ship' : 'truck'}"></i></span></div>` }),
                            zIndexOffset: 300
                        }).addTo(map);
                        parked.bindTooltip(esc(`${t.e.id} · terparkir/bongkar muatan`), { direction: 'top', offset: [0, -14], className: 'truck-tip' });
                        parkedMarkers.set(t.e.id, parked);
                    }
                }, 4000);
            });
            if (flying.size) requestAnimationFrame(flyLoop);
        }

        // Format jam tempuh (mis. 2.4 jam) jadi teks "2j 24m"
        function fmtJam(h) {
            const totalMin = Math.round(h * 60), jam = Math.floor(totalMin / 60), men = totalMin % 60;
            return (jam ? `${jam}j ` : '') + `${men}m`;
        }

        // Jalankan satu ruas perjalanan (darat via OSRM ATAU laut/ferry garis lurus) dan tunggu sampai tiba.
        function runVehicleLeg(pts, dur, meta, fit) {
            return new Promise(resolve => {
                const e = { ...meta, pts, dur, startAt: vNow() };
                const t = launchTruck(e, false);
                if (!t) { resolve(); return; }
                if (fit) map.fitBounds(t.line.getBounds(), { padding: [50, 50], maxZoom: 11 });
                t.done = () => resolve();
            });
        }
        // Satu ruas tunggal darat (dipakai baik untuk rute non-tol langsung, MAUPUN sebagai salah satu dari
        // 3 potongan rute tol - lihat driveLeg). routeKeyForFetch menentukan gaya rute yang diminta ke OSRM
        // ('tol' = boleh lewat motorway, 'nontol' = dipaksa exclude=motorway,toll) DAN rentang kecepatan yang
        // dipakai (lihat roadSpeedKmh) - keduanya wajib konsisten satu sama lain per ruas.
        async function driveSegment(from, to, meta, fit, routeKeyForFetch) {
            const { pts, real } = await fetchRoute(from, to, routeKeyForFetch);
            const straightKm = distKm(from, to);
            const { total: rawTotal, sinuosity } = sinuosityOf(pts, straightKm);
            const speedKmh = roadSpeedKmh(sinuosity, real, routeKeyForFetch);
            const rm = ROUTE_MODE[routeKeyForFetch] || ROUTE_MODE.tol;
            const total = rawTotal * rm.distFactor;
            const dur = (total / speedKmh) * (3600000 / GAME_SPEED);
            await runVehicleLeg(pts, dur, { ...meta, vehicle: 'truck', speedKmh, baseSpeedKmh: speedKmh, segMode: routeKeyForFetch }, fit);
            return { km: total, dur, real, speedKmh, sinuosity };
        }
        async function driveLeg(from, to, meta, fit) {
            const rm = ROUTE_MODE[meta.routeMode] || ROUTE_MODE.tol;
            if (rm.key === 'tol') {
                // Coba pecah jadi 3 ruas nyata: jalan biasa ke gerbang masuk -> jalan tol -> jalan biasa dari
                // gerbang keluar ke tujuan. Ini meniru cara truk sungguhan lewat tol (tidak start/selesai persis
                // di badan jalan tol) - sebelumnya seluruh rute "Tol" cuma satu request OSRM polos dari asal
                // langsung ke tujuan, jadi terasa aneh kalau asal/tujuannya sendiri jauh dari jalan tol.
                const gates = pickTollGates(from, to);
                if (gates) {
                    const l1 = await driveSegment(from, gates.entryPoint, meta, fit, 'nontol');
                    addLog(`${meta.id} tiba di ${gates.entryPoint.nama}, masuk jalan tol...`, 'info', 'truck');
                    const l2 = await driveSegment(gates.entryPoint, gates.exitPoint, meta, false, 'tol');
                    addLog(`${meta.id} keluar di ${gates.exitPoint.nama}, lanjut jalan biasa menuju tujuan...`, 'info', 'truck');
                    const l3 = await driveSegment(gates.exitPoint, to, meta, false, 'nontol');
                    const km = l1.km + l2.km + l3.km, dur = l1.dur + l2.dur + l3.dur;
                    const jamAsli = (dur * GAME_SPEED) / 3600000;
                    return { km, dur, real: l1.real && l2.real && l3.real, speedKmh: jamAsli > 0 ? km / jamAsli : l2.speedKmh, sinuosity: l2.sinuosity };
                }
            }
            // Non-tol, atau Tol diminta tapi tidak ada kombinasi gerbang yang masuk akal (fallback aman) -
            // satu ruas langsung seperti sebelumnya.
            return await driveSegment(from, to, meta, fit, meta.routeMode);
        }
        async function ferryLeg(from, to, meta, fit) {
            const pts = [[from.lat, from.lon], [to.lat, to.lon]];
            const total = distKm(from, to);
            const dur = (total / AVG_FERRY_SPEED_KMH) * (3600000 / GAME_SPEED);
            await runVehicleLeg(pts, dur, { ...meta, vehicle: 'ferry', speedKmh: AVG_FERRY_SPEED_KMH }, fit);
            return { km: total, dur };
        }
        // Pelayaran langsung Kilang Pusat <-> Depo Cabang Pesisir (kapal tanker curah): garis lurus laut, TIDAK lewat
        // logika jalan darat/ferry pulau seperti journey() di bawah - kapal tanker niaga jalan sendiri lewat rute laut.
        async function shipLeg(from, to, meta, fit) {
            const pts = [[from.lat, from.lon], [to.lat, to.lon]];
            const total = distKm(from, to);
            const dur = (total / AVG_SHIP_SPEED_KMH) * (3600000 / GAME_SPEED);
            await runVehicleLeg(pts, dur, { ...meta, vehicle: 'kapal', speedKmh: AVG_SHIP_SPEED_KMH }, fit);
            return { km: total, dur };
        }
        // Satu perjalanan lengkap dari titik A ke titik B, otomatis menyisipkan penyeberangan ferry bila beda pulau.
        // Alur: [darat ke pelabuhan] -> antre masuk kapal -> [penyeberangan] -> kapal sandar & antre turun -> [darat ke tujuan].
        async function journey(from, to, meta, fitFirst) {
            const oIsl = islandOf(from), dIsl = islandOf(to);
            if (oIsl === dIsl) {
                const leg = await driveLeg(from, to, meta, fitFirst);
                const rmLabel = meta.vehicle !== 'kapal' && ROUTE_MODE[meta.routeMode] ? ` &middot; ${ROUTE_MODE[meta.routeMode].label} &middot; ${Math.round(leg.speedKmh)} km/j` : '';
                addLog(`BERANGKAT: ${meta.id} dari ${from.nama} menuju ${to.nama} (±${Math.round(leg.km)} km${leg.real ? ', mengikuti jalan' : ', rute perkiraan'}${rmLabel} &middot; estimasi ${fmtJam(leg.dur * GAME_SPEED / 3600000)} perjalanan).`, 'info', 'truck');
                return leg.km;
            }
            const depPort = getPort(oIsl, dIsl), arrPort = getPort(dIsl, oIsl);
            let km = 0;
            const l1 = await driveLeg(from, depPort, meta, fitFirst);
            km += l1.km;
            addLog(`BERANGKAT: ${meta.id} dari ${from.nama} menuju ${depPort.name} (±${Math.round(l1.km)} km) untuk menyeberang ke Pulau ${dIsl}.`, 'info', 'truck');
            addLog(`TIBA DI PELABUHAN: ${meta.id} tiba di ${depPort.name}, mengantre masuk kapal ferry...`, 'info', 'truck');
            notify(`${meta.id} mengantre naik kapal di ${depPort.name}...`, 'info');
            await sleep(FERRY_QUEUE_SEC * 1000);
            addLog(`PENYEBERANGAN: Kapal ferry membawa ${meta.id} dari ${depPort.name} menuju ${arrPort.name} (±${Math.round(distKm(depPort, arrPort))} km laut)...`, 'info', 'truck');
            const l2 = await ferryLeg(depPort, arrPort, meta, false);
            km += l2.km;
            addLog(`SANDAR: Kapal tiba &amp; sandar di ${arrPort.name}, ${meta.id} mengantre turun kapal...`, 'info', 'truck');
            notify(`Kapal sandar di ${arrPort.name}, ${meta.id} bersiap lanjut jalan darat.`, 'info');
            await sleep(FERRY_QUEUE_SEC * 1000);
            const l3 = await driveLeg(arrPort, to, meta, false);
            km += l3.km;
            addLog(`LANJUT PERJALANAN: ${meta.id} melanjutkan jalan darat dari ${arrPort.name} menuju ${to.nama} (±${Math.round(l3.km)} km).`, 'info', 'truck');
            return km;
        }
        async function animateDelivery(d) {
            const { spbu, truck, driver, kernet, origin: origin0 } = d;
            const ids = [truck.id, driver.id, kernet.id];
            const origin = origin0 || pickOrigin(truck.type, spbu, truck.cap, truck);
            if (!origin) return;
            ids.forEach(i => busyIds.add(i));
            populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
            ownAnims++;
            const meta = { id: truck.id, plat: truck.plat, type: truck.type, owner: currentAccount ? currentAccount.company : 'Pemain', routeMode: d.routeMode || 'tol',
                           depoNama: origin.nama, tujuanNama: spbu.nama, nomorSJ: d.nomorSJ };
            const fit = ownAnims === 1;
            try {
                d.km = await journey(origin, spbu, meta, fit);
                updateOrderTahap(spbu, truck, d.jenisMuatan, 'tiba');
                addLog(`TIBA: ${truck.id} [Supir: ${driver.name}] sampai di ${spbu.nama}. Kru bersiap bongkar muatan (±${UNLOAD_SECONDS} detik)...`, 'info', 'truck');
                notify(`${truck.id} tiba di ${spbu.nama}, sedang bongkar muatan...`, 'info');
                ownAnims = Math.max(0, ownAnims - 1);
                updateOrderTahap(spbu, truck, d.jenisMuatan, 'bongkar');
                await pausableDelay(UNLOAD_SECONDS * 1000);
                {
                    completeUnloading(d);
                    // Animasi truk/kapal berjalan balik ke depot asal setelah bongkar muatan tuntas (lewat ferry lagi bila perlu).
                    // PENTING: truk/supir/kernet baru dibebaskan (busyIds) SETELAH benar-benar tiba di depot di bawah ini,
                    // supaya tidak bisa ditugaskan ulang (dobel) selagi masih dalam perjalanan pulang.
                    try {
                        await journey(spbu, origin, meta, false);
                        addLog(`TIBA DI DEPOT: ${truck.id} [Supir: ${driver.name}] kembali ke ${origin.nama} setelah selesai bongkar muatan.`, 'info', 'truck');
                    } catch (e) { /* animasi balik gagal dimuat, tidak mempengaruhi keuangan yang sudah cair */ }
                    ids.forEach(x => busyIds.delete(x));
                    populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
                }
            } catch (err) {
                ids.forEach(x => busyIds.delete(x));
                populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
                ownAnims = Math.max(0, ownAnims - 1);
            }
        }

        // ===== TRANSFER KAPAL TANKER: Kilang Pusat <-> Depo Cabang Pesisir =====
        // Berbeda dari animateDelivery (BBM/LPG ke SPBU, ada pendapatan) - ini murni pemindahan stok internal
        // perusahaan sendiri lewat laut, jadi tidak ada pendapatan, hanya biaya pelayaran implisit dari harga beli kapal.
        async function animateKapalTransfer(d) {
            const { spbu: target, truck, driver, kernet, origin } = d;
            const ids = [truck.id, driver.id, kernet.id];
            ids.forEach(i => busyIds.add(i));
            populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
            ownAnims++;
            const meta = { id: truck.id, plat: truck.plat, type: truck.type, owner: currentAccount ? currentAccount.company : 'Pemain',
                           depoNama: origin.nama, tujuanNama: target.nama, nomorSJ: d.nomorSJ };
            const fit = ownAnims === 1;
            try {
                const leg = await shipLeg(origin, target, meta, fit);
                d.km = leg.km;
                addLog(`BERLAYAR: Kapal ${truck.id} [Nahkoda: ${driver.name}] dari ${origin.nama} menuju ${target.nama} (±${Math.round(leg.km)} km laut &middot; estimasi ${fmtJam(leg.dur * GAME_SPEED / 3600000)} pelayaran).`, 'info', 'truck');
                addLog(`SANDAR: Kapal ${truck.id} tiba &amp; sandar di ${target.nama}, kru bongkar muatan curah (±${UNLOAD_SECONDS_KAPAL} detik)...`, 'info', 'truck');
                notify(`${truck.id} sandar di ${target.nama}, sedang bongkar muatan curah...`, 'info');
                ownAnims = Math.max(0, ownAnims - 1);
                await pausableDelay(UNLOAD_SECONDS_KAPAL * 1000);
                {
                    completeKapalTransfer(d);
                    // PENTING: sama seperti truk darat - busyIds baru dilepas SETELAH kapal benar-benar sandar
                    // kembali di depot asal, supaya kapal tidak bisa dipakai lagi selagi masih berlayar pulang.
                    try {
                        await shipLeg(target, origin, meta, false);
                        addLog(`TIBA DI DEPOT: Kapal ${truck.id} [Nahkoda: ${driver.name}] kembali berlabuh di ${origin.nama} setelah selesai bongkar muatan.`, 'info', 'truck');
                    } catch (e) { /* animasi balik gagal dimuat, tidak mempengaruhi stok yang sudah masuk */ }
                    ids.forEach(x => busyIds.delete(x));
                    populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
                }
            } catch (err) {
                ids.forEach(x => busyIds.delete(x));
                populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
                ownAnims = Math.max(0, ownAnims - 1);
            }
        }

        // Dieksekusi setelah kapal sandar DAN selesai masa bongkar (UNLOAD_SECONDS_KAPAL) - stok depo tujuan baru bertambah di sini
        function completeKapalTransfer(d) {
            const { spbu: target, truck, driver, kernet, nomorSJ } = d;
            const ids = [truck.id, driver.id, kernet.id];
            const info = creditKlgDelivery(target, truck.cap);
            const result = settleCrewResult(driver, kernet);
            if (result.fine) {
                companyCash -= result.fine; totalExpense += result.fine;
                addFinanceLog(`Denda pelanggaran pelayaran kapal ${truck.id} (${target.nama})`, -result.fine);
            }
            // busyIds TIDAK dilepas di sini lagi - baru dilepas setelah kapal benar-benar sandar kembali di depot
            // asal (lihat animateKapalTransfer), supaya kapal tidak bisa ditugaskan dobel selagi masih berlayar pulang.
            addLog(`TRANSFER SELESAI ${nomorSJ || ''}: ${truck.cap.toLocaleString()} ${target.unit} pasokan curah diturunkan di ${target.nama}. Stok kini ${Math.round(info.cur).toLocaleString()}/${info.max.toLocaleString()} ${info.unit}.`, 'success');
            notify(`${truck.id} selesai bongkar muatan di ${target.nama}.`, 'ok');
            updateCashDisplay();
            renderRefineries();
            populateTruckDropdowns(); populateCrewDropdowns(); renderDriversDashboard(); renderFleetDashboard();
        }

        // Dieksekusi setelah truk tiba DAN selesai masa bongkar muatan (UNLOAD_SECONDS) - baru di sinilah pendapatan cair
        function completeUnloading(d) {
            const { spbu, truck, driver, kernet, jenisMuatan, hargaPerUnit, nomorSJ } = d;
            const ids = [truck.id, driver.id, kernet.id];
            let revenueKotor = truck.cap * hargaPerUnit;
            const result = settleCrewResult(driver, kernet);
            revenueKotor -= result.fine;
            revenueKotor += fulfilOrder(spbu, jenisMuatan, truck);

            // Bonus jarak tempuh: pendapatan sedikit naik sesuai jauhnya pengiriman (dan tetap mengikuti volume
            // KL/Ton yang diangkut) - dibatasi jarakBonusCapKm supaya rute yang super jauh tidak jadi absurd.
            const jarakBonusKm = Math.min(d.km || 0, ECO.jarakBonusCapKm);
            const bonusJarak = Math.round(truck.cap * hargaPerUnit * ECO.bonusJarakPerKm * jarakBonusKm);
            revenueKotor += bonusJarak;

            const biayaKirimDasar = Math.round(truck.cap * (truck.type === 'LPG' ? ECO.biayaKirimTon : ECO.biayaKirimKl));

            // Biaya BBM Solar & Tol truk dihitung dari jarak riil pulang-pergi (PP) & rute yang dipilih saat dispatch.
            const roundTripKmBiaya = Math.round((d.km || 0) * 2 * 10) / 10;
            const routeMode = d.routeMode || 'tol';
            const rm = ROUTE_MODE[routeMode] || ROUTE_MODE.tol;
            const biayaBbm = Math.round((roundTripKmBiaya / kmPerLiterTruk(truck)) * HARGA_SOLAR_TRUK);
            const biayaTol = routeMode === 'tol' ? Math.round(roundTripKmBiaya * tarifTolPerKm(truck)) : 0;
            const biayaKirim = biayaKirimDasar + biayaBbm + biayaTol;
            const revenueBersih = revenueKotor - biayaKirim;

            companyCash += revenueBersih;
            totalIncome += revenueKotor;
            totalExpense += biayaKirim;

            addFinanceLog(`Pasokan ${jenisMuatan} ke ${spbu.nama} (${driver.name}) - pendapatan kotor`, revenueKotor);
            if (bonusJarak > 0) addFinanceLog(`Bonus jarak tempuh ${truck.id} ke ${spbu.nama} (±${Math.round(jarakBonusKm)} km)`, bonusJarak);
            addFinanceLog(`Biaya kirim dasar ${truck.id} ke ${spbu.nama}`, -biayaKirimDasar);
            addFinanceLog(`Biaya BBM Solar truk ${truck.id} (PP, ${rm.label}, ±${roundTripKmBiaya} km)`, -biayaBbm);
            if (biayaTol > 0) addFinanceLog(`Biaya Tol truk ${truck.id} (PP, Golongan ${golonganTolTruk(truck).gol})`, -biayaTol);

            // Truk kembali ke depot pangkalan setelah bongkar muatan tuntas - jarak PP dihitung ke odometer & keausan ban
            const roundTripKm = roundTripKmBiaya;
            truck.odometer = Math.round((truck.odometer + roundTripKm) * 10) / 10;
            truck.banPct = Math.max(0, Math.round((truck.banPct - roundTripKm * TIRE_WEAR_PER_KM) * 10) / 10);
            let banNote = '';
            if (truck.banPct <= TIRE_REPLACE_THRESHOLD) {
                const cost = tireReplaceCost(truck);
                companyCash -= cost; totalExpense += cost;
                addFinanceLog(`Ganti ban otomatis ${truck.id} [${truck.plat}] di depot`, -cost);
                truck.banPct = 100;
                banNote = ` Ban sudah menipis saat tiba di depot, kru bengkel otomatis mengganti set ban baru (${formatRupiah(cost)}).`;
                addLog(`BAN DIGANTI OTOMATIS: ${truck.id} [${truck.plat}] tiba di depot dengan ban tersisa kritis, langsung diganti set baru. Odometer: ${truck.odometer.toLocaleString('id-ID')} km.`, 'warning', 'truck');
                notify(`${truck.id} ganti ban otomatis di depot.`, 'warn');
            }

            updateCashDisplay();
            populateCrewDropdowns();
            renderDriversDashboard();
            renderFleetDashboard();

            addLog(`BONGKAR SELESAI (SJ ${nomorSJ}): ${truck.id} [Supir: ${driver.name}] tuntas bongkar ${jenisMuatan} di ${spbu.nama} lewat ${rm.label}. Kotor ${formatRupiah(revenueKotor)}${bonusJarak > 0 ? ` (termasuk bonus jarak ±${Math.round(jarakBonusKm)} km: ${formatRupiah(bonusJarak)})` : ''} - biaya kirim dasar ${formatRupiah(biayaKirimDasar)} - BBM ${formatRupiah(biayaBbm)}${biayaTol > 0 ? ` - Tol ${formatRupiah(biayaTol)}` : ''} = bersih ${formatRupiah(revenueBersih)} cair ke kas. ${result.notes.join('; ')}. Menempuh ±${roundTripKm} km PP (total odometer ${truck.odometer.toLocaleString('id-ID')} km, sisa ban ${truck.banPct}%).${banNote}`, result.violated ? 'warning' : 'success', 'truck');
            notify(`Pendapatan ${formatRupiah(revenueBersih)} cair dari ${truck.id} setelah bongkar muatan di ${spbu.nama}.`, result.violated ? 'warn' : 'info');

            // busyIds TIDAK dilepas di sini lagi - baru dilepas setelah truk benar-benar tiba kembali di depot asal
            // (lihat animateDelivery), supaya truk tidak bisa ditugaskan dobel selagi masih dalam perjalanan pulang.
            populateTruckDropdowns(); populateCrewDropdowns();
        }


