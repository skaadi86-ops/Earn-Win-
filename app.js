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

function pointsToRupees(points) {
    return (points / 1000).toFixed(2);
}
function rupeesToPoints(rupees) {
    return Math.floor(rupees * 1000);
}

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

// Spin wheel
class SpinWheel {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.segments = [
            { text: '1000', color: '#FF6B6B', points: 1000 },
            { text: '500', color: '#4ECDC4', points: 500 },
            { text: '5000', color: '#45B7D1', points: 5000 },
            { text: '10000', color: '#96CEB4', points: 10000 },
            { text: '3000', color: '#FFEAA7', points: 3000 },
            { text: '7500', color: '#DDA0DD', points: 7500 }
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

// Firebase functions
async function createUserDocument(user, info) {
    const refCode = generateReferralCode();
    const userDoc = {
        uid: user.uid, name: info.name, email: user.email, points: 0,
        referralCode: refCode, appliedReferralCode: info.appliedReferralCode,
        spinsToday: 0, lastSpinDate: null,
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

// ✅ Fixed withdrawal function
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
            if (amount < 100) throw new Error("Minimum withdrawal is ₹100");
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

// Referral
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

// UI update
function updateUI() {
    if (!userData) return;
    document.getElementById('userName').textContent = userData.name;
    document.getElementById('profileName').textContent = userData.name;
    document.getElementById('profileEmail').textContent = userData.email;
    document.getElementById('totalPoints').textContent = userData.points.toLocaleString();
    document.getElementById('totalBalance').textContent = `₹${pointsToRupees(userData.points)}`;
    const spinsLeft = Math.max(0, 20 - userData.spinsToday);   // ✅ updated daily limit
    document.getElementById('spinsLeft').textContent = `${spinsLeft} spins left`;
    document.getElementById('spinsToday').textContent = userData.spinsToday;
    document.getElementById('spinButton').disabled = !(spinsLeft > 0 && !isSpinning);
    document.getElementById('withdrawButton').disabled = parseFloat(pointsToRupees(userData.points)) < 100;
    document.getElementById('editName').value = userData.name;
    document.getElementById('editUpi').value = userData.upiId || "";
    document.getElementById('referralCode').textContent = userData.referralCode;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { loadingScreen.style.opacity = '0'; setTimeout(() => { loadingScreen.style.display = 'none'; }, 500); }, 2000);

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user; userData = await getUserData(user.uid);
            if (userData) {
                showScreen('mainApp'); updateUI();
                const canvas = document.getElementById('spinWheel'); spinWheel = new SpinWheel(canvas);
                const today = new Date().toDateString();
                if (userData.lastSpinDate !== today) {
                    await db.collection('users').doc(user.uid).update({ spinsToday: 0, lastSpinDate: today });
                    userData.spinsToday = 0; userData.lastSpinDate = today; updateUI();
                }
            }
        } else { currentUser = null; userData = null; showScreen('loginScreen'); }
    });

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

    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
        const screen = item.getAttribute('data-screen') + 'Screen'; showAppScreen(screen);
    }));

    // ✅ Spin button with 20 spins/day + 5s cooldown
    document.getElementById('spinButton').addEventListener('click', async () => {
        if (isSpinning || userData.spinsToday >= 20) return;

        isSpinning = true;
        spinWheel.spin();
        await updateSpinData();

        setTimeout(() => showToast('Thanks for watching the ad!', 'success'), 1000);

        // 5-second cooldown
        setTimeout(() => {
            isSpinning = false;
            updateUI();
        }, 5000);
    });

    document.getElementById('withdrawButton').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        if (isNaN(amount)) { showToast('Please enter a valid amount', 'warning'); return; }
        submitWithdrawalRequest(amount);
        document.getElementById('withdrawAmount').value = '';
    });

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
});
