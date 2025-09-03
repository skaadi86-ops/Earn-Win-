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
let cooldownTimer = null; // ✅ for countdown

// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const toast = document.getElementById('toast');
const spinButton = document.getElementById('spinButton');

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

// Spin wheel class (unchanged)
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

// Firebase functions (same as before) ...

// UI update
function updateUI() {
    if (!userData) return;
    document.getElementById('userName').textContent = userData.name;
    document.getElementById('profileName').textContent = userData.name;
    document.getElementById('profileEmail').textContent = userData.email;
    document.getElementById('totalPoints').textContent = userData.points.toLocaleString();
    document.getElementById('totalBalance').textContent = `₹${pointsToRupees(userData.points)}`;
    const spinsLeft = Math.max(0, 20 - userData.spinsToday);   // ✅ 20 spins
    document.getElementById('spinsLeft').textContent = `${spinsLeft} spins left`;
    document.getElementById('spinsToday').textContent = userData.spinsToday;
    spinButton.disabled = !(spinsLeft > 0 && !isSpinning);
    document.getElementById('withdrawButton').disabled = parseFloat(pointsToRupees(userData.points)) < 100;
    document.getElementById('editName').value = userData.name;
    document.getElementById('editUpi').value = userData.upiId || "";
    document.getElementById('referralCode').textContent = userData.referralCode;
}

// ✅ Cooldown with countdown
function startCooldown(seconds) {
    let remaining = seconds;
    spinButton.disabled = true;
    spinButton.textContent = `Wait ${remaining}s`;
    cooldownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            spinButton.textContent = `Wait ${remaining}s`;
        } else {
            clearInterval(cooldownTimer);
            spinButton.disabled = false;
            spinButton.textContent = "Spin Again";
            updateUI();
        }
    }, 1000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // ... login/signup/profile listeners unchanged ...

    // ✅ Spin button with 20/day + 10s cooldown + countdown
    spinButton.addEventListener('click', async () => {
        if (isSpinning || userData.spinsToday >= 20) return;

        isSpinning = true;
        spinWheel.spin();
        await updateSpinData();

        setTimeout(() => showToast('Thanks for watching the ad!', 'success'), 1000);

        // Start 10s cooldown timer
        startCooldown(10);

        // Reset spinning after animation
        setTimeout(() => { isSpinning = false; }, 3000);
    });

    // ... rest unchanged ...
});