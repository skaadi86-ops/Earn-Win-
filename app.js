// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAe3JHhrZ8Yl6STpMYeeeNg6nTZO1atgvg",
    authDomain: "earning-website-921d2.firebaseapp.com",
    projectId: "earning-website-921d2",
    storageBucket: "earning-website-921d2.firebasestorage.app",
    messagingSenderId: "1047082395308",
    appId: "1:1047082395308:web:41020670adc71e4f3b6109",
    measurementId: "G-SLKPYBPX60"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

// Global variables
let currentUser = null;
let userData = null;
let spinWheel = null;
let isSpinning = false;

// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const toast = document.getElementById('toast');

// Utility functions
function showToast(message, type = 'success') {
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    if (type === 'success') toastIcon.className = 'toast-icon fas fa-check-circle';
    else if (type === 'error') toastIcon.className = 'toast-icon fas fa-exclamation-circle';
    else if (type === 'warning') toastIcon.className = 'toast-icon fas fa-exclamation-triangle';

    setTimeout(() => toast.classList.remove('show'), 3000);
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function pointsToRupees(points) { return (points / 1000).toFixed(2); }
function rupeesToPoints(rupees) { return Math.floor(rupees * 1000); }

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}
function showAppScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-screen="${screenId.replace('Screen', '')}"]`).classList.add('active');
}

/* ================= SPIN WHEEL (unchanged) ================= */
class SpinWheel {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.segments = [
            { text: '1000', color: '#FF6B6B', points: 1000 },
            { text: '500', color: '#4ECDC4', points: 500 },
            { text: '1500', color: '#45B7D1', points: 1500 },
            { text: '250', color: '#96CEB4', points: 250 },
            { text: '300', color: '#FFEAA7', points: 300 },
            { text: '750', color: '#DDA0DD', points: 750 }
        ];
        this.rotation = 0;
        this.isSpinning = false;
        this.draw();
    }
    draw() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2, centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const segAngle = (2 * Math.PI) / this.segments.length;

        this.segments.forEach((seg, i) => {
            const start = i * segAngle + this.rotation, end = (i + 1) * segAngle + this.rotation;
            ctx.beginPath(); ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, start, end); ctx.closePath();
            ctx.fillStyle = seg.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(start + segAngle / 2);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Poppins';
            ctx.fillText(seg.text, radius * 0.7, 0); ctx.restore();
        });
    }
    spin() {
        if (this.isSpinning) return;
        this.isSpinning = true;
        const spins = 5 + Math.random() * 5, duration = 3000, startTime = Date.now(), startRot = this.rotation;
        const animate = () => {
            const elapsed = Date.now() - startTime, prog = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - prog, 3);
            this.rotation = startRot + (spins * 2 * Math.PI * easeOut);
            this.draw();
            if (prog < 1) requestAnimationFrame(animate);
            else { this.isSpinning = false; this.handleSpinResult(); }
        }; animate();
    }
    handleSpinResult() {
        const segAngle = (2 * Math.PI) / this.segments.length;
        const normRot = this.rotation % (2 * Math.PI);
        const index = Math.floor(((2 * Math.PI) - normRot) / segAngle) % this.segments.length;
        const wonPoints = this.segments[index].points;
        showToast(`Congratulations! You won ${wonPoints} points!`, 'success');
        updateUserPoints(wonPoints);
    }
}

/* ================= FIREBASE HELPERS ================= */
async function createUserDocument(user, info) {
    const refCode = generateReferralCode();
    const userDoc = {
        uid: user.uid,
        name: info.name,
        email: user.email,
        points: 0,
        referralCode: refCode,
        appliedReferralCode: info.appliedReferralCode,
        spinsToday: 0,
        lastSpinDate: null,

        // NEW daily counters
        scratchesToday: 0,
        lastScratchDate: null,
        quizzesToday: 0,
        lastQuizDate: null,

        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(user.uid).set(userDoc);
    return userDoc;
}
async function getUserData(uid) {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
}
async function updateUserPoints(points) {
    const ref = db.collection('users').doc(currentUser.uid);
    await ref.update({ points: userData.points + points, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    userData.points += points; updateUI();
}
async function updateSpinData() {
    const today = new Date().toDateString();
    const ref = db.collection('users').doc(currentUser.uid);
    await ref.update({ spinsToday: userData.spinsToday + 1, lastSpinDate: today, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    userData.spinsToday += 1; userData.lastSpinDate = today; updateUI();
}

/* Withdrawal (unchanged) */
async function submitWithdrawalRequest(amount) {
    try {
        if (!userData.upiId || userData.upiId.trim() === "") {
            showToast('Please update your UPI ID in profile before withdrawing', 'warning');
            return;
        }
        const userRef = db.collection('users').doc(currentUser.uid);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(userRef);
            if (!snap.exists) throw new Error("User not found");
            const user = snap.data();
            const balance = parseFloat(pointsToRupees(user.points));
            if (amount > balance) throw new Error("Insufficient balance");
            if (amount < 50) throw new Error("Minimum withdrawal is ₹50");
            const pointsToDeduct = rupeesToPoints(amount);

            const withdrawalData = {
                userId: currentUser.uid, userName: user.name, userEmail: user.email,
                upiId: user.upiId, amount, status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('withdrawalRequests').add(withdrawalData);
            tx.update(userRef, { points: user.points - pointsToDeduct, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            userData.points -= pointsToDeduct;
        });
        updateUI(); showToast('Withdrawal request submitted successfully!', 'success');
    } catch (e) {
        console.error("Withdraw error:", e);
        showToast(e.message || 'Error submitting withdrawal', 'error');
    }
}

/* Referral/Profile (unchanged) */
async function applyReferralCode(code) {
    if (userData.appliedReferralCode) { showToast('You already applied a referral code', 'warning'); return; }
    const q = await db.collection('users').where('referralCode', '==', code).get();
    if (q.empty) { showToast('Invalid referral code', 'error'); return; }
    const refDoc = q.docs[0]; if (refDoc.id === currentUser.uid) { showToast('Cannot use your own code', 'warning'); return; }
    const refData = refDoc.data(), bonus = 10000;
    await db.collection('users').doc(currentUser.uid).update({
        appliedReferralCode: code, points: userData.points + bonus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(refDoc.id).update({
        points: refData.points + bonus, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    userData.appliedReferralCode = code; userData.points += bonus; updateUI();
    showToast('Referral applied! You both earned ₹10!', 'success');
}
async function updateProfile(name, upiId) {
    await db.collection('users').doc(currentUser.uid).update({ name, upiId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    userData.name = name; userData.upiId = upiId; updateUI();
    showToast('Profile updated successfully!', 'success');
}

/* ================= SCRATCH CARD ================= */
const SCRATCH_LIMIT = 50;
let scratch = {
    canvas: null, ctx: null, isDown: false, cleared: false,
    lastPoint: null, coverFilled: true
};
function initScratchCanvas() {
    scratch.canvas = document.getElementById('scratchCanvas');
    scratch.ctx = scratch.canvas.getContext('2d');

    // Draw silver cover
    scratch.ctx.fillStyle = '#c0c0c0';
    scratch.ctx.fillRect(0, 0, scratch.canvas.width, scratch.canvas.height);
    scratch.ctx.fillStyle = '#b0b0b0';
    for (let i = 0; i < 50; i++) {
        scratch.ctx.fillRect(Math.random()*320, Math.random()*180, 8, 1.5);
    }

    scratch.ctx.globalCompositeOperation = 'destination-out';
    scratch.cleared = false; scratch.coverFilled = true;
}
function scratchBind() {
    const c = scratch.canvas;
    const draw = (x, y) => {
        scratch.ctx.beginPath();
        scratch.ctx.arc(x, y, 16, 0, Math.PI*2);
        scratch.ctx.fill();
    };
    const getPos = (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        return {x, y};
    };

    c.onmousedown = c.ontouchstart = (e) => { scratch.isDown = true; draw(...Object.values(getPos(e))); };
    c.onmousemove = c.ontouchmove  = (e) => {
        if (!scratch.isDown) return;
        e.preventDefault();
        const p = getPos(e);
        draw(p.x, p.y);
    };
    window.onmouseup = window.ontouchend = () => { scratch.isDown = false; checkScratchProgress(); };
}
function checkScratchProgress() {
    if (scratch.cleared) return;
    const pixels = scratch.ctx.getImageData(0,0,scratch.canvas.width,scratch.canvas.height).data;
    let transparent = 0;
    for (let i=3; i<pixels.length; i+=4) if (pixels[i] === 0) transparent++;
    const ratio = transparent / (scratch.canvas.width*scratch.canvas.height);
    if (ratio > 0.6) {
        scratch.cleared = true;
        claimScratchPrize();
    }
}
function randomScratchPrize() {
    // Points list (₹ shown on card for fun)
    const rewards = [250, 300, 500, 75, 100, 150]; // points
    return rewards[Math.floor(Math.random()*rewards.length)];
}
async function startScratch() {
    if (userData.scratchesToday >= SCRATCH_LIMIT) {
        showToast('Daily scratch limit reached', 'warning'); return;
    }
    const prizePts = randomScratchPrize();
    document.getElementById('scratchPrize').textContent = `₹${(prizePts/1000).toFixed(2)}`;
    initScratchCanvas();
    scratchBind();
}
async function claimScratchPrize() {
    const prizeText = document.getElementById('scratchPrize').textContent.replace('₹','');
    const prizePts = rupeesToPoints(parseFloat(prizeText));
    await updateUserPoints(prizePts);

    const today = new Date().toDateString();
    await db.collection('users').doc(currentUser.uid).update({
        scratchesToday: (userData.scratchesToday || 0) + 1,
        lastScratchDate: today,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    userData.scratchesToday = (userData.scratchesToday || 0) + 1;
    userData.lastScratchDate = today;
    updateUI();
    showToast('Scratch reward added!', 'success');
}

/* ================= QUIZ ================= */
const QUIZ_LIMIT = 20;
const QUIZ_REWARD = 200; // points per correct answer

let currentQuestion = null;
function generateMathQuestion() {
    const a = Math.floor(Math.random()*20)+1;
    const b = Math.floor(Math.random()*20)+1;
    const ops = [
        {s:"+", f:(x,y)=>x+y},
        {s:"−", f:(x,y)=>x-y},
        {s:"×", f:(x,y)=>x*y}
    ];
    const op = ops[Math.floor(Math.random()*ops.length)];
    const ans = op.f(a,b);
    const options = new Set([ans]);
    while (options.size < 4) {
        options.add(ans + Math.floor((Math.random()*10)-5));
    }
    const opts = Array.from(options).sort(()=>Math.random()-0.5);
    return {text:`${a} ${op.s} ${b} = ?`, answer: ans, options: opts};
}
function renderQuestion() {
    const q = generateMathQuestion();
    currentQuestion = q;
    const qEl = document.getElementById('quizQuestion');
    const oEl = document.getElementById('quizOptions');
    qEl.textContent = q.text;
    oEl.innerHTML = '';
    q.options.forEach(v => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = v;
        btn.addEventListener('click', () => selectAnswer(btn, v));
        oEl.appendChild(btn);
    });
    document.getElementById('nextQuiz').disabled = true;
}
async function selectAnswer(btn, value) {
    const all = [...document.querySelectorAll('.quiz-option')];
    all.forEach(b => b.disabled = true);
    const correct = Number(value) === Number(currentQuestion.answer);
    if (correct) {
        btn.classList.add('correct');
        await updateUserPoints(QUIZ_REWARD);
        const today = new Date().toDateString();
        await db.collection('users').doc(currentUser.uid).update({
            quizzesToday: (userData.quizzesToday || 0) + 1,
            lastQuizDate: today,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        userData.quizzesToday = (userData.quizzesToday || 0) + 1;
        userData.lastQuizDate = today;
        updateUI();
        showToast(`Correct! +${QUIZ_REWARD} points`, 'success');
    } else {
        btn.classList.add('wrong');
        const correctBtn = all.find(b => Number(b.textContent) === Number(currentQuestion.answer));
        if (correctBtn) correctBtn.classList.add('correct');
        showToast('Oops! Wrong answer', 'warning');
    }
    document.getElementById('nextQuiz').disabled = false;
}

/* ================= UI UPDATE ================= */
function updateUI() {
    if (!userData) return;
    document.getElementById('userName').textContent = userData.name;
    document.getElementById('profileName').textContent = userData.name;
    document.getElementById('profileEmail').textContent = userData.email;
    document.getElementById('totalPoints').textContent = userData.points.toLocaleString();
    document.getElementById('totalBalance').textContent = `₹${pointsToRupees(userData.points)}`;

    const spinsLeft = Math.max(0, 200 - (userData.spinsToday || 0));
    document.getElementById('spinsLeft').textContent = `${spinsLeft} spins left`;
    document.getElementById('spinsToday').textContent = userData.spinsToday || 0;

    // Scratch + Quiz counters
    const scratchesLeft = Math.max(0, SCRATCH_LIMIT - (userData.scratchesToday || 0));
    const quizzesLeft = Math.max(0, QUIZ_LIMIT - (userData.quizzesToday || 0));
    const sTodayEl = document.getElementById('scratchesToday');
    const qTodayEl = document.getElementById('quizzesToday');
    if (sTodayEl) sTodayEl.textContent = userData.scratchesToday || 0;
    if (qTodayEl) qTodayEl.textContent = userData.quizzesToday || 0;

    document.getElementById('spinButton').disabled = !(spinsLeft > 0 && !isSpinning);
    const withdrawDisabled = parseFloat(pointsToRupees(userData.points)) < 50;
    document.getElementById('withdrawButton').disabled = withdrawDisabled;

    document.getElementById('editName').value = userData.name;
    document.getElementById('editUpi').value = userData.upiId || "";
    document.getElementById('referralCode').textContent = userData.referralCode;
}

/* ================= EVENTS ================= */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
    }, 2000);

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user; userData = await getUserData(user.uid);
            if (userData) {
                showScreen('mainApp'); updateUI();

                // Spin init
                const canvas = document.getElementById('spinWheel'); spinWheel = new SpinWheel(canvas);
                const today = new Date().toDateString();

                // Reset daily counters if needed
                const updates = {};
                if (userData.lastSpinDate !== today) { updates.spinsToday = 0; updates.lastSpinDate = today; userData.spinsToday = 0; userData.lastSpinDate = today; }
                if (userData.lastScratchDate !== today) { updates.scratchesToday = 0; updates.lastScratchDate = today; userData.scratchesToday = 0; userData.lastScratchDate = today; }
                if (userData.lastQuizDate !== today) { updates.quizzesToday = 0; updates.lastQuizDate = today; userData.quizzesToday = 0; userData.lastQuizDate = today; }
                if (Object.keys(updates).length) await db.collection('users').doc(user.uid).update(updates);

                updateUI();
            }
        } else { currentUser = null; userData = null; showScreen('loginScreen'); }
        // Menu toggle for Spin screen (3-dot menu)
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');

if (menuBtn && menuDropdown) {
    // Toggle menu on button click
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent immediate window click hiding
        const isShown = menuDropdown.style.display === 'block';
        menuDropdown.style.display = isShown ? 'none' : 'block';
        menuDropdown.setAttribute('aria-hidden', isShown ? 'true' : 'false');
    });

    // Close menu when clicking outside
    window.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
            menuDropdown.style.display = 'none';
            menuDropdown.setAttribute('aria-hidden', 'true');
        }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            menuDropdown.style.display = 'none';
            menuDropdown.setAttribute('aria-hidden', 'true');
        }
    });
}
    });

    // Auth
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value, pass = document.getElementById('loginPassword').value;
        try { await auth.signInWithEmailAndPassword(email, pass); }
        catch { showToast('Invalid email or password', 'error'); }
    });
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value, email = document.getElementById('signupEmail').value,
              pass = document.getElementById('signupPassword').value, ref = document.getElementById('signupReferral').value;
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await createUserDocument(cred.user, { name, appliedReferralCode: ref || null });
            showToast('Account created successfully!', 'success');
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') showToast('Email already registered', 'error');
            else showToast('Error creating account', 'error');
        }
    });
    document.getElementById('showSignup').addEventListener('click', () => showScreen('signupScreen'));
    document.getElementById('showLogin').addEventListener('click', () => showScreen('loginScreen'));

    // Nav
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
        const screen = item.getAttribute('data-screen') + 'Screen';
        showAppScreen(screen);
        if (screen === 'scratchScreen') { /* ensure a fresh cover when opening */ initScratchCanvas(); }
        if (screen === 'quizScreen') { renderQuestion(); }
    }));

    // Spin
    document.getElementById('spinButton').addEventListener('click', async () => {
        if (isSpinning || (userData.spinsToday || 0) >= 200) return;
        isSpinning = true;
        spinWheel.spin();
        await updateSpinData();
        setTimeout(() => showToast('Thanks for watching the ad!', 'success'), 1000);
        setTimeout(() => { isSpinning = false; updateUI(); }, 10000); // 10s cooldown
    });

    // Wallet
    document.getElementById('withdrawButton').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        if (isNaN(amount)) { showToast('Please enter a valid amount', 'warning'); return; }
        submitWithdrawalRequest(amount);
        document.getElementById('withdrawAmount').value = '';
    });

    // Profile
    document.getElementById('saveProfile').addEventListener('click', () => {
        const name = document.getElementById('editName').value.trim(), upi = document.getElementById('editUpi').value.trim();
        if (!name || !upi) { showToast('Please fill all fields', 'warning'); return; }
        updateProfile(name, upi);
    });
    document.getElementById('copyCode').addEventListener('click', () => {
        const code = document.getElementById('referralCode').textContent;
        navigator.clipboard.writeText(code).then(() => showToast('Referral code copied!', 'success'))
        .catch(() => showToast('Failed to copy code', 'error'));
    });
    document.getElementById('applyReferralBtn').addEventListener('click', () => {
        const code = document.getElementById('applyReferral').value.trim().toUpperCase();
        if (!code) { showToast('Please enter a referral code', 'warning'); return; }
        applyReferralCode(code); document.getElementById('applyReferral').value = '';
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
        try { await auth.signOut(); showToast('Logged out successfully', 'success'); }
        catch { showToast('Error logging out', 'error'); }
    });

    // Scratch
    document.getElementById('scratchButton').addEventListener('click', startScratch);

    // Quiz
    document.getElementById('nextQuiz').addEventListener('click', () => {
        if ((userData.quizzesToday || 0) >= QUIZ_LIMIT) {
            showToast('Daily quiz limit reached', 'warning'); return;
        }
        renderQuestion();
        document.getElementById('nextQuiz').disabled = true;
    });
});
