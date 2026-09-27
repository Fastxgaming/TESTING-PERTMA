    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
    import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
             sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider, deleteUser, updateProfile
           } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection, query, where, onSnapshot, updateDoc, getDocs, orderBy, limit, writeBatch, runTransaction
           } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

    const firebaseConfig = {
        apiKey: "AIzaSyAokOJBi9KPoQZDEGNlZHU1RgBwMY6DNm4",
        authDomain: "nusa-energi-manager-id.firebaseapp.com",
        projectId: "nusa-energi-manager-id",
        storageBucket: "nusa-energi-manager-id.firebasestorage.app",
        messagingSenderId: "1018363998822",
        appId: "1:1018363998822:web:aef36ec463cf412cfaf3a7",
        measurementId: "G-TCT9SZ8QEJ"
    };
    const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
    // Analytics bersifat opsional; tidak boleh mengganggu game jika gagal (mis. dibuka via file://)
    isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
    auth.languageCode = 'id'; // email reset password berbahasa Indonesia

    window.fb = {
        async register(email, pw, prof) {
            window.__regBusy = true;
            let user = null;
            try {
                const cred = await createUserWithEmailAndPassword(auth, email, pw);
                user = cred.user;
                try { await updateProfile(user, { displayName: prof.company }); } catch (e) {}
                // Klaim kode perusahaan WAJIB berhasil dulu - keunikannya dijamin oleh Firestore Rules
                // (allow create hanya kalau dokumen companyCodes/{code} belum ada). Kalau gagal (mis. kode
                // ini "direbut" pemain lain persis di detik yang sama), akun Auth yang baru dibuat langsung
                // dihapus lagi (rollback) supaya tidak ada akun nyangkut tanpa kode perusahaan yang valid.
                await setDoc(doc(db, 'companyCodes', prof.code), { uid: user.uid, created: serverTimestamp() });
                try { await setDoc(doc(db, 'users', user.uid), { ...prof, email, created: serverTimestamp() }); } catch (e) { console.warn('Firestore:', e); }
                return { user, profile: prof };
            } catch (err) {
                if (user) { try { await deleteUser(user); } catch (e) { console.warn('Rollback user gagal:', e); } }
                throw err;
            } finally { window.__regBusy = false; }
        },
        saveCloud: (uid, data, ts) => setDoc(doc(db, 'saves', uid), { data, ts }),
        async loadSave(uid) { const s = await getDoc(doc(db, 'saves', uid)); return s.exists() ? s.data() : null; },
        deleteSave: uid => deleteDoc(doc(db, 'saves', uid)),
        login: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
        out: () => signOut(auth),
        publishStats: (uid, d) => setDoc(doc(db, 'leaderboard', uid), { ...d, updated: serverTimestamp() }),
        listenBoard: cb => onSnapshot(query(collection(db, 'leaderboard'), orderBy('cash', 'desc'), limit(50)), sn => cb(sn.docs.map(x => ({ uid: x.id, ...x.data() }))), e => console.warn('Listener leaderboard:', e)),
        listenVerified: cb => onSnapshot(collection(db, 'verified'), sn => { const m = {}; sn.docs.forEach(x => { m[x.id] = x.data().until || 0; }); cb(m); }, e => console.warn('Listener verified:', e)),
        // Top up manual: pemain kirim bukti bayar via WhatsApp, admin mengirim saldo memakai UID pemain
        listenTopups: (uid, cb) => onSnapshot(query(collection(db, 'topups'), where('uid', '==', uid), where('status', '==', 'paid'), where('claimed', '==', false)),
            snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.warn('Listener top up:', e)),
        isAdmin: uid => getDoc(doc(db, 'admins', uid)).then(x => x.exists()).catch(() => false),
        checkBanned: uid => getDoc(doc(db, 'banned', uid)).then(x => x.exists() ? x.data() : null).catch(() => null),
        // Real-time: pantau dokumen banned/{uid} selama sesi berjalan, supaya blokir yang dijatuhkan admin
        // langsung menendang pemain yang SEDANG online, tanpa perlu tunggu login berikutnya.
        listenBanned: (uid, cb) => onSnapshot(doc(db, 'banned', uid), snap => cb(snap.exists() ? snap.data() : null), e => console.warn('Listener banned:', e)),
        banPlayer: (adminUid, uid, days, reason) => setDoc(doc(db, 'banned', uid), { permanent: !days, until: days ? Date.now() + days * 86400000 : null, reason: reason || '', by: adminUid, updated: serverTimestamp() }),
        unbanPlayer: uid => deleteDoc(doc(db, 'banned', uid)),
        lookupPlayer: uid => getDoc(doc(db, 'leaderboard', uid)).then(x => x.exists() ? x.data() : null),
        // Cek kode perusahaan (3-4 huruf, dicetak di Surat Jalan) sudah dipakai pemain lain atau belum.
        // Ini cuma pengecekan awal untuk UX (best-effort, dibaca publik dari koleksi companyCodes yang
        // memang tidak berisi data sensitif) - keunikan yang SEBENARNYA dijamin oleh Firestore Rules saat
        // fb.register() mencoba "mengklaim" kode ini (lihat companyCodes di bawah).
        isCompanyCodeTaken: code => getDoc(doc(db, 'companyCodes', code)).then(s => s.exists()).catch(() => false),
        recentGrants: () => getDocs(query(collection(db, 'topups'), orderBy('created', 'desc'), limit(10))).then(sn => sn.docs.map(d => ({ id: d.id, ...d.data() }))),
        async adminGrant(adminUid, uid, pkg, note) {
            const id = 'ADM-' + Date.now() + '-' + uid.slice(0, 6);
            const b = writeBatch(db);   // atomik: saldo + centang biru berhasil bersamaan atau tidak sama sekali
            b.set(doc(db, 'topups', id), { uid, pkgId: pkg.id, cash: pkg.cash, price: pkg.price, days: pkg.days, status: 'paid', claimed: false, created: serverTimestamp(), paidAt: serverTimestamp(), by: adminUid, note: note || '' });
            // Kalau days = 0 (mode "hanya saldo"), dokumen centang biru TIDAK disentuh sama sekali -
            // centang biru pemain tidak ikut diperpanjang/diaktifkan lewat kiriman ini.
            if (pkg.days > 0) {
                const vref = doc(db, 'verified', uid), v = await getDoc(vref);
                const base = Math.max(Date.now(), v.exists() ? (v.data().until || 0) : 0);
                b.set(vref, { until: base + pkg.days * 86400000, updated: serverTimestamp() });
            }
            await b.commit(); return id;
        },
        markClaimed: id => updateDoc(doc(db, 'topups', id), { claimed: true, claimedAt: serverTimestamp() }),
        // ===== BROADCAST: notifikasi admin ke semua pemain, tersimpan permanen di Firestore =====
        // Kenapa bukan push notification (FCM)? Proyek ini belum menyiapkan service worker/VAPID key.
        // Solusinya: setiap dokumen broadcast disimpan permanen, lalu tiap klien mengambil broadcast yang
        // ID/waktunya lebih baru dari "terakhir dilihat" (disimpan di localStorage per akun) begitu mereka
        // login/refresh - jadi pemain yang sedang offline tetap otomatis menerimanya nanti, kapan pun mereka
        // login berikutnya, tanpa perlu online saat admin mengirim.
        sendBroadcast: (adminUid, message, level) => setDoc(doc(collection(db, 'broadcasts')), { message, level: level || 'info', by: adminUid, created: serverTimestamp() }),
        recentBroadcasts: () => getDocs(query(collection(db, 'broadcasts'), orderBy('created', 'desc'), limit(5))).then(sn => sn.docs.map(d => ({ id: d.id, ...d.data() }))),
        // Dipanggil sekali per sesi (bukan realtime) - cukup ambil status saat login/refresh, tidak perlu
        // listener terus-menerus untuk pengumuman yang sifatnya tidak mendesak seperti ini.
        fetchNewBroadcasts: () => getDocs(query(collection(db, 'broadcasts'), orderBy('created', 'desc'), limit(20))).then(sn => sn.docs.map(d => ({ id: d.id, ...d.data() }))),
        // "Terakhir dilihat" disimpan di Firestore (dokumen users/{uid}), BUKAN localStorage, supaya kalau
        // pemain login dari HP lalu dari laptop, status "sudah dilihat"-nya tersinkron - tidak dobel per perangkat.
        markBroadcastSeen: (uid, ts) => setDoc(doc(db, 'users', uid), { lastBroadcastSeen: ts }, { merge: true }),
        // ===== Bursa P2P: jual-beli unit truk bekas antar pemain nyata =====
        listenBursaListings: cb => onSnapshot(query(collection(db, 'bursa'), where('status', '==', 'open'), orderBy('created', 'desc'), limit(200)),
            sn => cb(sn.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.warn('Listener bursa:', e)),
        postBursaListing(sellerUid, sellerCompany, truck, harga) {
            const ref = doc(collection(db, 'bursa'));
            return setDoc(ref, { sellerUid, sellerCompany, truck, harga, status: 'open', created: serverTimestamp() }).then(() => ref.id);
        },
        cancelBursaListing: id => deleteDoc(doc(db, 'bursa', id)),
        // Transaksi atomik: cegah 2 pembeli membeli iklan yang sama secara bersamaan
        buyBursaListing: (listingId, buyerUid, buyerCompany) => runTransaction(db, async tx => {
            const ref = doc(db, 'bursa', listingId), snap = await tx.get(ref);
            if (!snap.exists() || snap.data().status !== 'open') throw new Error('SOLD');
            const data = snap.data();
            if (data.sellerUid === buyerUid) throw new Error('SELF');
            tx.update(ref, { status: 'sold', buyerUid, buyerCompany, soldAt: serverTimestamp() });
            const tradeRef = doc(collection(db, 'bursa_trades'));
            tx.set(tradeRef, { listingId, sellerUid: data.sellerUid, sellerCompany: data.sellerCompany, buyerUid, buyerCompany, truck: data.truck, harga: data.harga, claimed: false, created: serverTimestamp() });
            return data;
        }),
        listenBursaSales: (uid, cb) => onSnapshot(query(collection(db, 'bursa_trades'), where('sellerUid', '==', uid), where('claimed', '==', false)),
            sn => cb(sn.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.warn('Listener bursa_trades:', e)),
        markBursaSaleClaimed: id => updateDoc(doc(db, 'bursa_trades', id), { claimed: true, claimedAt: serverTimestamp() }),
        resetPassword: email => sendPasswordResetEmail(auth, email),
        reauth: pw => reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw)),
        async deleteAccount() {
            const u = auth.currentUser;
            try { await deleteDoc(doc(db, 'saves', u.uid)); await deleteDoc(doc(db, 'leaderboard', u.uid)); await deleteDoc(doc(db, 'users', u.uid)); } catch (e) { console.warn('Firestore:', e); }
            await deleteUser(u);
        }
    };

    // Sesi login otomatis dipulihkan Firebase saat halaman dibuka lagi
    onAuthStateChanged(auth, async user => {
        if (window.__regBusy) return;
        if (!user) { authChecked = true; maybeFinish(); return; }
        let prof = null;
        try { const snap = await getDoc(doc(db, 'users', user.uid)); prof = snap.exists() ? snap.data() : null; } catch (e) {}
        authChecked = true;
        window.fbSession(user, prof || { company: user.displayName || user.email, owner: '-' }, false);
    });
