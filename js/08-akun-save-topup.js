        // ===== AKUN, PENYIMPANAN & LEADERBOARD =====
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const mem = {};
        const store = {
            get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return k in mem ? JSON.parse(mem[k]) : d; } },
            set(k, v) { const t = JSON.stringify(v); try { localStorage.setItem(k, t); } catch (e) { mem[k] = t; } }
        };
        let currentAccount = null;
        let lbSort = 'cash';

        async function hashPw(pw, salt) {
            const t = salt + '|' + pw;
            try {
                const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
                return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
            } catch (e) { let h = 5381; for (const ch of t) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return 'x' + h; }
        }

        function setAuthMode(m) {
            const reg = m === 'register';
            document.getElementById('auth-form-register').classList.toggle('hidden', !reg);
            document.getElementById('auth-form-login').classList.toggle('hidden', reg);
            document.getElementById('auth-error').classList.add('hidden');
            const on = 'bg-teal-600 text-white shadow', off = 'text-gray-400 hover:text-gray-200';
            document.getElementById('auth-tab-register').className = 'py-2 rounded-lg text-xs font-bold transition ' + (reg ? on : off);
            document.getElementById('auth-tab-login').className = 'py-2 rounded-lg text-xs font-bold transition ' + (reg ? off : on);
        }
        function showMsg(id, msg, ok) { const el = document.getElementById(id); el.textContent = msg; el.className = 'mt-3 text-[11px] rounded-lg px-3 py-2 border ' + (ok ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30'); }
        function authError(msg) { showMsg('auth-error', msg, false); }
        const fbErr = e => ({ 'auth/invalid-credential': 'Email atau password salah.', 'auth/wrong-password': 'Password salah.', 'auth/user-not-found': 'Email belum terdaftar.', 'auth/email-already-in-use': 'Email sudah terdaftar, silakan masuk.', 'auth/weak-password': 'Password minimal 6 karakter.', 'auth/invalid-email': 'Format email tidak valid.', 'auth/missing-password': 'Password wajib diisi.', 'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti.', 'auth/network-request-failed': 'Koneksi internet bermasalah.', 'auth/requires-recent-login': 'Sesi kedaluwarsa, silakan keluar lalu masuk lagi.', 'permission-denied': 'Kode perusahaan barusan dipakai pemain lain. Coba lagi dengan kode lain.' }[e.code] || ('Terjadi kesalahan: ' + (e.code || e.message)));

        function initAuth() { setAuthMode(store.get('pml_seen', false) ? 'login' : 'register'); }

        async function submitAuth(e, mode) {
            e.preventDefault();
            if (!window.fb) return authError('Firebase belum siap. Periksa koneksi lalu muat ulang halaman.');
            const val = id => document.getElementById(id).value.trim();
            try {
                if (mode === 'register') {
                    const company = val('reg-company').replace(/\s+/g, ' '), owner = val('reg-owner'), email = val('reg-email');
                    const code = val('reg-code').toUpperCase();
                    const pw = document.getElementById('reg-pass').value, pw2 = document.getElementById('reg-pass2').value;
                    if (company.length < 3) return authError('Nama perusahaan minimal 3 karakter.');
                    if (!/^[A-Z]{3,4}$/.test(code)) return authError('Kode perusahaan wajib 3-4 huruf (A-Z), tanpa spasi/angka.');
                    if (owner.length < 2) return authError('Nama pemilik wajib diisi.');
                    if (pw.length < 6) return authError('Password minimal 6 karakter.');
                    if (pw !== pw2) return authError('Konfirmasi password tidak sama.');
                    const codeTaken = await fb.isCompanyCodeTaken(code).catch(() => false);
                    if (codeTaken) return authError(`Kode "${code}" sudah dipakai pemain lain, pakai kode lain.`);
                    const { user, profile } = await fb.register(email, pw, { company, owner, code });
                    fbSession(user, profile, true);
                } else {
                    await fb.login(val('log-email'), document.getElementById('log-pass').value); // lanjut via onAuthStateChanged
                }
            } catch (err) { authError(fbErr(err)); }
        }

        // Bangun teks pop-up blokir (dipakai baik saat cek login maupun saat blokir dijatuhkan real-time
        // ketika pemain sedang online), supaya pesannya selalu konsisten: permanen/berapa hari + alasan.
        function banModalText(ban) {
            return `Akun ini diblokir oleh admin.${ban.reason ? ' Alasan: ' + ban.reason + '.' : ''}\n${ban.permanent ? 'Blokir bersifat permanen.' : 'Blokir aktif sampai ' + new Date(ban.until).toLocaleString('id-ID') + '.'}`;
        }
        function isBanActive(ban) { return !!(ban && (ban.permanent || (ban.until && ban.until > Date.now()))); }

        // Dipanggil modul Firebase setelah user terautentikasi. acc.id = UID Firebase.
        window.fbSession = async function (user, prof, isNew) {
            if ((currentAccount && currentAccount.id === user.uid) || window.__sessBusy) return;
            window.__sessBusy = true;
            const ban = await fb.checkBanned(user.uid).catch(() => null);
            if (isBanActive(ban)) {
                window.__sessBusy = false;
                try { await fb.out(); } catch (e) {}
                hideLoadingOverlay();
                document.getElementById('splash-overlay').classList.add('hidden');
                document.getElementById('auth-overlay').classList.remove('hidden');
                showModal('Akun Diblokir', banModalText(ban), 'fa-ban', 'red');
                return;
            }
            store.set('pml_seen', true);
            const accs = store.get('pml_accounts', []);
            let acc = accs.find(a => a.id === user.uid);
            if (!acc) { acc = { id: user.uid, stats: liveStats() }; accs.push(acc); }
            // lastBroadcastSeen datang dari dokumen users/{uid} di Firestore (fb.markBroadcastSeen), jadi
            // status "sudah dilihat" ikut akun, bukan ikut perangkat/browser.
            Object.assign(acc, { email: user.email, company: prof.company, code: prof.code || acc.code || '', owner: prof.owner, lastBroadcastSeen: prof.lastBroadcastSeen || 0 });
            store.set('pml_accounts', accs);
            try {
                const cloud = await fb.loadSave(user.uid), key = 'pml_save_' + user.uid, local = store.get(key, null);
                cloudTs = cloud ? (cloud.ts || 0) : 0; store.set('pml_cloudts_' + user.uid, cloudTs);
                if (cloud && (!local || (local.ts || 0) < cloud.ts)) store.set(key, JSON.parse(cloud.data));
            } catch (e) { cloudTs = store.get('pml_cloudts_' + user.uid, 0); console.warn('Muat cloud gagal, pakai data lokal:', e); }
            startSession(acc, !!isNew);
        };

        async function sendResetEmail(email, target) {
            const id = target || 'auth-error';
            if (!email) return showMsg(id, 'Isi email dulu.', false);
            try { await fb.resetPassword(email); showMsg(id, 'Email reset password dikirim ke ' + email + '. Cek inbox/spam.', true); }
            catch (err) { showMsg(id, fbErr(err), false); }
        }

        function startSession(acc, isNew) {
            currentAccount = acc;
            const save = store.get('pml_save_' + acc.id, null);
            if (save) applySave(save);
            document.getElementById('kpis-company').innerText = acc.company;
            // Catatan: JANGAN sembunyikan loading-overlay di sini. Kalau sesi login lama dipulihkan otomatis
            // oleh Firebase, fungsi ini berjalan di belakang layar loading - biar transisinya tetap
            // loading -> "Main Sekarang" (bukan loading -> sempat kelihatan layar in-game -> baru "Main Sekarang").
            // Loading overlay baru ditutup oleh finishLoadingIfReady() setelah animasi loading selesai.
            const fromAuthForm = document.getElementById('splash-overlay').classList.contains('hidden');
            const revealGame = () => {
                document.getElementById('auth-overlay').classList.add('hidden');
                updateCashDisplay();
                renderCloudStatus();
                startTopupListener();
                startVerifiedListener();
                startBursaSalesListener();
                startBanListener();
                checkAdmin();
                checkNewBroadcasts();
                map.invalidateSize();
                addLog(`LOGIN: ${acc.owner} masuk sebagai pemilik ${acc.company}.`, 'success');
                // Kalau splash "Main Sekarang" sudah dilewati (alur daftar/masuk manual), tampilkan tutorial/welcome sekarang.
                if (fromAuthForm) maybeShowTutorial(isNew);
            };
            // Kalau ini alur Daftar/Masuk manual (splash sudah dilewati, form auth sedang tampil), fade dulu
            // sebelum masuk ke in-game biar mulus. Kalau splash masih tampil (sesi lama dipulihkan otomatis
            // di latar belakang), tidak perlu fade karena belum ada yang terlihat pemain.
            if (fromAuthForm) coverScreen(() => { revealGame(); uncoverScreen(); });
            else revealGame();
        }

        function maybeShowTutorial(isNew) {
            if (!currentAccount) return;
            if (!store.get('pml_tutorial_' + currentAccount.id, false)) {
                store.set('pml_tutorial_' + currentAccount.id, true);
                setTimeout(() => openTutorial(isNew), 400);
            } else if (isNew) {
                showModal(`Selamat Datang, ${currentAccount.owner}!`, `${currentAccount.company} resmi berdiri dengan modal ${formatRupiah(companyCash)}. Beli armada, rekrut kru, dan naiki peringkat di Leaderboard.`, 'fa-building-circle-check', 'blue');
            }
        }

        // ===== RESET & HAPUS AKUN =====
        let skipSave = false, acctMode = 'reset';
        const storeDel = k => { try { localStorage.removeItem(k); } catch (e) {} delete mem[k]; };
        const ACCT_TXT = {
            reset: ['Progres game diulang dari awal (modal Rp 650 Juta, tanpa armada & kru, Kilang Tuban stok 750.000 Bbl). Akun, nama perusahaan, dan password tetap ada.', 'Reset Akun', 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow shadow-amber-900/30'],
            delete: ['Akun beserta seluruh data game dihapus PERMANEN (dari cloud dan perangkat ini) dan tidak bisa dikembalikan. Nama perusahaan bisa dipakai lagi.', 'Hapus Permanen', 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow shadow-red-900/30']
        };
        function setAcctMode(m) {
            acctMode = m;
            const on = m === 'reset' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm' : 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm', off = 'text-gray-400 hover:text-gray-200';
            document.getElementById('acct-tab-reset').className = 'py-2 rounded-lg font-bold text-[11px] transition ' + (m === 'reset' ? on : off);
            document.getElementById('acct-tab-delete').className = 'py-2 rounded-lg font-bold text-[11px] transition ' + (m === 'delete' ? on : off);
            document.getElementById('acct-desc').innerText = ACCT_TXT[m][0];
            const b = document.getElementById('acct-confirm'); b.innerText = ACCT_TXT[m][1]; b.className = 'flex-1 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed ' + ACCT_TXT[m][2];
            document.getElementById('acct-error').classList.add('hidden');
            // Mode Hapus Akun: kunci tombol konfirmasi sampai nama perusahaan diketik ulang persis - pengaman
            // ekstra karena aksi ini PERMANEN (hapus akun Firebase Auth + semua data cloud, tidak bisa dibatalkan).
            const typedWrap = document.getElementById('acct-delete-typed-wrap'), typedInput = document.getElementById('acct-delete-typed');
            typedInput.value = '';
            if (m === 'delete') {
                typedWrap.classList.remove('hidden');
                document.getElementById('acct-delete-typed-target').innerText = currentAccount ? currentAccount.company : '';
                b.disabled = true;
            } else {
                typedWrap.classList.add('hidden');
                b.disabled = false;
            }
        }
        function checkDeleteTyped() {
            if (acctMode !== 'delete') return;
            const target = (currentAccount ? currentAccount.company : '').trim();
            document.getElementById('acct-confirm').disabled = document.getElementById('acct-delete-typed').value.trim() !== target;
        }
        async function sendAcctResetPw() {
            const btn = document.getElementById('acct-reset-pw-btn');
            if (!btn || btn.disabled || !currentAccount) return;
            const ok = await showConfirm(`Email link reset password akan dikirim ke ${currentAccount.email}. Lanjutkan?`,
                { title: 'Reset Password', iconClass: 'fa-key', theme: 'blue', okLabel: 'Ya, Kirim', cancelLabel: 'Batal' });
            if (!ok) return;
            const original = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Mengirim...</span>';
            try {
                await fb.resetPassword(currentAccount.email);
                showMsg('acct-error', 'Email reset password dikirim ke ' + currentAccount.email + '. Cek inbox/spam.', true);
                btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Email terkirim, cek inbox</span>';
                // Jeda 20 detik sebelum tombol bisa dipakai lagi - cegah spam kirim email reset berkali-kali.
                setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 20000);
            } catch (err) {
                showMsg('acct-error', fbErr(err), false);
                btn.innerHTML = original; btn.disabled = false;
            }
        }
        function openAccountModal() {
            if (!currentAccount) return;
            document.getElementById('acct-company').innerText = currentAccount.company + (currentAccount.code ? ' [' + currentAccount.code + ']' : '') + ' · ' + currentAccount.owner;
            document.getElementById('acct-pass').value = '';
            document.getElementById('acct-uid').innerText = currentAccount.id;
            document.getElementById('acct-email').innerText = currentAccount.email || '-';
            setAcctMode('reset');
            document.getElementById('account-modal').classList.remove('hidden');
        }
        function closeAccountModal() { document.getElementById('account-modal').classList.add('hidden'); }
        async function confirmAccountAction() {
            const pw = document.getElementById('acct-pass').value, id = currentAccount.id;
            if (acctMode === 'delete' && document.getElementById('acct-delete-typed').value.trim() !== currentAccount.company.trim()) {
                return showMsg('acct-error', 'Nama perusahaan yang diketik belum cocok.', false);
            }
            try {
                await fb.reauth(pw);            // verifikasi password ke Firebase
                skipSave = true;
                const accs = store.get('pml_accounts', []);
                if (acctMode === 'delete') {
                    await fb.deleteAccount();   // hapus dokumen profil + akun Firebase Auth
                    store.set('pml_accounts', accs.filter(a => a.id !== id));
                } else {
                    await fb.deleteSave(id);
                    const a = accs.find(x => x.id === id); if (a) { a.stats = { cash: 125500000000, units: 2, kilang: 1 }; store.set('pml_accounts', accs); }
                }
                storeDel('pml_save_' + id);
                location.reload();
            } catch (err) { skipSave = false; showMsg('acct-error', fbErr(err), false); }
        }

        async function logoutAccount() {
            if (cloudBusy && !(await showConfirm('Penyimpanan cloud sedang berjalan. Jika keluar sekarang, penyimpanan dibatalkan. Lanjutkan keluar?', { title: 'Keluar Akun', iconClass: 'fa-right-from-bracket', theme: 'red', okLabel: 'Keluar' }))) return;
            try { saveGame(); } catch (e) {} skipSave = true; try { await fb.out(); } catch (e) {} location.reload(); }

        function liveStats() { return { cash: companyCash, units: companyFleet.length, kilang: refineryData.filter(k => k.is_unlocked).length }; }

        // ===== SAVE: lokal otomatis (30 dtk), cloud manual lewat tombol "Save Cloud" =====
        function buildSave() {
            return {
                cash: companyCash, income: totalIncome, expense: totalExpense,
                refineries: refineryData.map(k => ({ id: k.id, u: k.is_unlocked, s: k.stok_current, m: k.stok_max, lvl: k.stokUpgradeLevel, mid: k.mekanikId, kap: k.kap })),
                fleet: companyFleet, crew: companyCrew, crewCounter: crewIdCounter, sj: suratJalanCounter,
                spbu: loadedSpbuList, fin: financeEntries, orders, ordHist, nextOrderGt, setor: lastSetor, izin: izinLog, clock: gameElapsed, topups: appliedTopups, pph: pphPaid, bbm: bbmSpent, tsetor: topupTotal, ts: Date.now()
            };
        }

        function saveGame() {
            if (!currentAccount || skipSave) return;
            const sv = buildSave();
            store.set('pml_save_' + currentAccount.id, sv);
            const accs = store.get('pml_accounts', []);
            const a = accs.find(x => x.id === currentAccount.id);
            if (a) { a.stats = liveStats(); store.set('pml_accounts', accs); }
        }

        function cloudSave(sv) {
            publishBoard();
            // Daftar SPBU dasar tidak perlu disimpan; cukup yang berubah (DODO disetujui / mitra baru)
            const c = { ...sv, spbu: sv.spbu.filter(x => x.gen || x.mitra || x.taken || x.blocked) };
            let t = JSON.stringify(c);
            if (t.length > 900000) { c.fin = (c.fin || []).slice(-100); c.ordHist = (c.ordHist || []).slice(-100); t = JSON.stringify(c); }
            return fb.saveCloud(currentAccount.id, t, sv.ts); // error dilempar ke pemanggil
        }

        let cloudTs = 0, cloudBusy = false;
        const CLOUD_WAIT_MS = 15000;
        const fmtCloudTs = ts => ts ? new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Belum pernah';
        function renderCloudStatus() { const el = document.getElementById('cloud-last'); if (el) el.textContent = fmtCloudTs(cloudTs); }

        async function manualCloudSave() {
            if (!currentAccount || cloudBusy) return;
            document.getElementById('btn-cloud-save')?.classList.remove('cloud-remind');
            if (!window.fb) return addLog('CLOUD: Firebase belum siap. Periksa koneksi lalu muat ulang halaman.', 'warning');
            const uid = currentAccount.id, btn = document.getElementById('btn-cloud-save'),
                  lbl = document.getElementById('cloud-label'), bar = document.getElementById('cloud-bar'), ico = document.getElementById('cloud-ico');
            const setUi = (icon, text, pct) => { ico.className = 'fa-solid ' + icon + ' mr-1'; lbl.textContent = text; bar.style.width = pct + '%'; };
            cloudBusy = true; btn.disabled = true;
            try {
                // Fase 1: loading / cooldown 15 detik
                const end = Date.now() + CLOUD_WAIT_MS;
                setUi('fa-spinner fa-spin', 'Menyimpan... 15 dtk', 0);
                let left;
                while ((left = end - Date.now()) > 0) {
                    setUi('fa-spinner fa-spin', 'Menyimpan... ' + Math.ceil(left / 1000) + ' dtk', (CLOUD_WAIT_MS - left) / CLOUD_WAIT_MS * 100);
                    await new Promise(r => setTimeout(r, 250));
                    if (!currentAccount || currentAccount.id !== uid || skipSave) return; // sesi berubah / keluar akun
                }
                // Fase 2: setelah 15 detik selesai, baru ambil kondisi game terbaru & unggah ke cloud
                setUi('fa-spinner fa-spin', 'Mengunggah...', 100);
                const sv = buildSave();
                store.set('pml_save_' + uid, sv);
                await cloudSave(sv);
                cloudTs = sv.ts; store.set('pml_cloudts_' + uid, cloudTs);
                renderCloudStatus();
                addLog('CLOUD: Progres game berhasil disimpan ke cloud.', 'success');
                setUi('fa-check', 'Tersimpan!', 100);
                await new Promise(r => setTimeout(r, 1500));
            } catch (e) {
                console.warn('Simpan cloud gagal:', e);
                addLog('CLOUD: Gagal menyimpan ke cloud (' + (e.code || e.message || 'error') + '). Silakan coba lagi.', 'warning');
                setUi('fa-triangle-exclamation', 'Gagal, coba lagi', 0);
                await new Promise(r => setTimeout(r, 2000));
            } finally {
                cloudBusy = false; btn.disabled = false; setUi('fa-cloud-arrow-up', 'Save Cloud', 0);
            }
        }

        // ===== TOP UP MANUAL (bukti bayar via WhatsApp, admin kirim saldo lewat UID) =====
        // ISI: nomor WhatsApp admin (format internasional tanpa +/spasi) dan info pembayaran yang tampil ke pemain
        const TOPUP_ADMIN = { wa: '6285141017508' };
        const TOPUP_PKGS = [
            { id: 'p500j', label: 'Rp 500 Juta', cash: 500e6, price: 5000, days: 5 },
            { id: 'p1m', label: 'Rp 1 Miliar', cash: 1e9, price: 10000, days: 10 },
            { id: 'p5m', label: 'Rp 5 Miliar', cash: 5e9, price: 25000, days: 25 },
            { id: 'p10m', label: 'Rp 10 Miliar', cash: 10e9, price: 40000, days: 30, tag: 'Hemat' },
            { id: 'p50m', label: 'Rp 50 Miliar', cash: 50e9, price: 70000, days: 30, tag: 'Hemat' },
            { id: 'p100m', label: 'Rp 100 Miliar', cash: 100e9, price: 100000, days: 30, tag: 'Terbaik' }
        ];
        // Paket khusus panel admin: tidak melalui pembayaran, jadi tanpa harga (price) dan boleh sampai 1 Triliun
        const ADMIN_PKGS = [
            { id: 'a500j', label: 'Rp 500 Juta', cash: 500e6, price: 0, days: 5 },
            { id: 'a1m', label: 'Rp 1 Miliar', cash: 1e9, price: 0, days: 10 },
            { id: 'a5m', label: 'Rp 5 Miliar', cash: 5e9, price: 0, days: 25 },
            { id: 'a10m', label: 'Rp 10 Miliar', cash: 10e9, price: 0, days: 30 },
            { id: 'a50m', label: 'Rp 50 Miliar', cash: 50e9, price: 0, days: 30 },
            { id: 'a100m', label: 'Rp 100 Miliar', cash: 100e9, price: 0, days: 30 },
            { id: 'a500m', label: 'Rp 500 Miliar', cash: 500e9, price: 0, days: 30 },
            { id: 'a1t', label: 'Rp 1 Triliun', cash: 1e12, price: 0, days: 30 }
        ];
        const ADMIN_CASH_MAX = 1e12; // batas atas nominal khusus admin: 1 Triliun
        let appliedTopups = [], selTopup = null, topupBusy = false, topupUnsub = null, topupChain = Promise.resolve();
        let banUnsub = null;
        const topupInflight = new Set();
        // Registrasi nama pengirim (dipakai utk alur QRIS): wajib diisi sebelum tombol WhatsApp aktif
        let topupSender = '', topupRegistered = false;

