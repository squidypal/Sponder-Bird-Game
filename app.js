import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
    orderBy,
    limit,
    updateDoc,
    increment,
    where,
    Timestamp,
    addDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ============================================================
// FIREBASE CONFIG - REPLACE WITH YOUR OWN
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAI2YI2bDk2SsHT5_S8VaTF8HLDmzyJ2N0",
    authDomain: "sponderbird.firebaseapp.com",
    projectId: "sponderbird",
    storageBucket: "sponderbird.firebasestorage.app",
    messagingSenderId: "817586385261",
    appId: "1:817586385261:web:49f8cba1422ab45018aa64"
};

// ============================================================
// GAME URL - UPDATE AFTER DEPLOYING WEBGL BUILD
// ============================================================
const GAME_URL = "./game/index.html"; // Path to your WebGL build

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authTabs = document.querySelectorAll('.auth-tab');
const navTabs = document.querySelectorAll('.nav-tab');
const contentScreens = document.querySelectorAll('.content-screen');
const logoutBtn = document.getElementById('logout-btn');
const adminTab = document.querySelector('.nav-tab.admin-only');

// Current user data
let currentUser = null;
let userData = null;

// Auth tab switching
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${tabName}-form`).classList.add('active');
    });
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    try {
        errorEl.textContent = '';
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorEl.textContent = getErrorMessage(error.code);
    }
});

// Signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const errorEl = document.getElementById('signup-error');
    
    try {
        errorEl.textContent = '';
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            username: username,
            email: email,
            highScore: 0,
            gamesPlayed: 0,
            isAdmin: false,
            createdAt: Timestamp.now()
        });
    } catch (error) {
        errorEl.textContent = getErrorMessage(error.code);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData(user.uid);
        showMainApp();
    } else {
        currentUser = null;
        userData = null;
        showAuthScreen();
    }
});

async function loadUserData(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
        userData = userDoc.data();
        updateProfileUI();
        
        if (userData.isAdmin) {
            adminTab.classList.add('visible');
        } else {
            adminTab.classList.remove('visible');
        }
    }
}

function updateProfileUI() {
    document.getElementById('profile-username').textContent = userData.username;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-highscore').textContent = userData.highScore || 0;
    document.getElementById('profile-games').textContent = userData.gamesPlayed || 0;
    document.getElementById('game-highscore').textContent = userData.highScore || 0;
}

function showAuthScreen() {
    authScreen.classList.add('active');
    mainApp.classList.remove('active');
}

function showMainApp() {
    authScreen.classList.remove('active');
    mainApp.classList.add('active');
    loadLeaderboard();
    initGameFrame();
}

// Navigation
navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const screenName = tab.dataset.screen;
        
        if (screenName === 'admin' && (!userData || !userData.isAdmin)) {
            return;
        }
        
        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        contentScreens.forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${screenName}-screen`).classList.add('active');
        
        if (screenName === 'admin') {
            loadAdminData();
        }
        if (screenName === 'game') {
            setTimeout(focusGameFrame, 50);
        }
    });
});

// Leaderboard
async function loadLeaderboard() {
    const leaderboardEl = document.getElementById('leaderboard');
    
    try {
        const q = query(
            collection(db, 'users'),
            orderBy('highScore', 'desc'),
            limit(10)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            leaderboardEl.innerHTML = '<div class="leaderboard-loading">No scores yet. Be the first!</div>';
            return;
        }
        
        let html = '';
        let rank = 1;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            
            html += `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank ${rankClass}">#${rank}</span>
                    <span class="leaderboard-name">${data.username}</span>
                    <span class="leaderboard-score">${data.highScore}</span>
                </div>
            `;
            rank++;
        });
        
        leaderboardEl.innerHTML = html;
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardEl.innerHTML = '<div class="leaderboard-loading">Error loading leaderboard</div>';
    }
}

// Game
function focusGameFrame() {
    const gameFrame = document.getElementById('game-frame');
    if (!gameFrame) return;
    try {
        gameFrame.focus();
        if (gameFrame.contentWindow) gameFrame.contentWindow.focus();
        const innerCanvas = gameFrame.contentDocument?.getElementById('unity-canvas');
        if (innerCanvas) innerCanvas.focus();
    } catch (_) { /* cross-origin focus may throw — safe to ignore */ }
}

function initGameFrame() {
    const gameFrame = document.getElementById('game-frame');
    const placeholder = document.querySelector('.game-placeholder');
    const container = document.getElementById('game-frame-container');

    gameFrame.src = GAME_URL;
    gameFrame.onload = () => {
        gameFrame.classList.add('loaded');
        placeholder.classList.add('hidden');
        focusGameFrame();
    };
    gameFrame.onerror = () => {
        placeholder.innerHTML = '<p>Failed to load game</p><small>Check the GAME_URL in app.js</small>';
    };

    if (container && !container.dataset.focusBound) {
        container.dataset.focusBound = '1';
        container.addEventListener('mousedown', focusGameFrame);
    }
}

// ============================================================
// TELEMETRY
// Listens for postMessage events from the Unity WebGL build and
// persists one document per completed session to Firestore.
// ============================================================
window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data || data.source !== 'sponderbird-telemetry') return;

    const payload = data.payload || {};
    if (payload.type !== 'session_end') return;

    if (!currentUser) {
        console.warn('[telemetry] session_end received with no logged-in user, dropping');
        return;
    }

    try {
        await addDoc(collection(db, 'sessions'), {
            uid: currentUser.uid,
            username: userData?.username || currentUser.email,
            startTime: payload.startTimeIso ? Timestamp.fromDate(new Date(payload.startTimeIso)) : Timestamp.now(),
            endTime: payload.endTimeIso ? Timestamp.fromDate(new Date(payload.endTimeIso)) : Timestamp.now(),
            durationMs: payload.durationMs ?? 0,
            score: payload.score ?? 0,
            flaps: payload.flaps ?? 0
        });

        const score = payload.score ?? 0;
        const updates = { gamesPlayed: increment(1) };
        if (score > (userData?.highScore || 0)) {
            updates.highScore = score;
        }
        await updateDoc(doc(db, 'users', currentUser.uid), updates);

        await loadUserData(currentUser.uid);
        await loadLeaderboard();
    } catch (err) {
        console.error('[telemetry] failed to write session:', err);
    }
});

// Admin Dashboard
let adminUnsubSessions = null;
let adminUnsubUsers = null;

async function loadAdminData() {
    if (!userData || !userData.isAdmin) return;

    if (adminUnsubSessions) { adminUnsubSessions(); adminUnsubSessions = null; }
    if (adminUnsubUsers) { adminUnsubUsers(); adminUnsubUsers = null; }

    adminUnsubUsers = onSnapshot(collection(db, 'users'), (usersSnapshot) => {
        document.getElementById('total-players').textContent = usersSnapshot.size;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        let newUsers = 0;
        usersSnapshot.forEach(doc => {
            const createdAt = doc.data().createdAt?.toDate();
            if (createdAt && createdAt > weekAgo) newUsers++;
        });
        document.getElementById('new-users').textContent = newUsers;
    }, (err) => console.error('users snapshot error:', err));

    adminUnsubSessions = onSnapshot(collection(db, 'sessions'), (sessionsSnapshot) => {
        document.getElementById('total-games').textContent = sessionsSnapshot.size;

        let totalScore = 0;
        let totalFlaps = 0;
        sessionsSnapshot.forEach(d => {
            const s = d.data();
            totalScore += s.score || 0;
            totalFlaps += s.flaps || 0;
        });
        const avgScore = sessionsSnapshot.size > 0 ? Math.round(totalScore / sessionsSnapshot.size) : 0;
        const avgFlaps = sessionsSnapshot.size > 0 ? Math.round(totalFlaps / sessionsSnapshot.size) : 0;

        document.getElementById('avg-score').textContent = avgScore;
        const avgFlapsEl = document.getElementById('avg-flaps');
        if (avgFlapsEl) avgFlapsEl.textContent = avgFlaps;

        buildScoresChart(sessionsSnapshot);
        buildPlayersChart(sessionsSnapshot);
    }, (err) => console.error('sessions snapshot error:', err));
}

function buildScoresChart(sessionsSnapshot) {
    const ctx = document.getElementById('scores-chart').getContext('2d');

    const ranges = { '0-5': 0, '6-15': 0, '16-30': 0, '31-60': 0, '60+': 0 };

    sessionsSnapshot.forEach(doc => {
        const score = doc.data().score || 0;
        if (score <= 5) ranges['0-5']++;
        else if (score <= 15) ranges['6-15']++;
        else if (score <= 30) ranges['16-30']++;
        else if (score <= 60) ranges['31-60']++;
        else ranges['60+']++;
    });
    
    if (window.scoresChart) window.scoresChart.destroy();
    
    window.scoresChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: 'Games',
                data: Object.values(ranges),
                backgroundColor: '#00d4aa',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#888' },
                    grid: { color: '#2a2a35' }
                },
                x: {
                    ticks: { color: '#888' },
                    grid: { display: false }
                }
            }
        }
    });
}

function buildPlayersChart(sessionsSnapshot) {
    const ctx = document.getElementById('players-chart').getContext('2d');

    const days = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-US', { weekday: 'short' });
        days[key] = 0;
    }

    sessionsSnapshot.forEach(doc => {
        const endTime = doc.data().endTime?.toDate() || doc.data().startTime?.toDate();
        if (endTime) {
            const daysSince = Math.floor((today - endTime) / (1000 * 60 * 60 * 24));
            if (daysSince >= 0 && daysSince < 7) {
                const key = endTime.toLocaleDateString('en-US', { weekday: 'short' });
                if (days.hasOwnProperty(key)) {
                    days[key]++;
                }
            }
        }
    });
    
    if (window.playersChart) window.playersChart.destroy();
    
    window.playersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(days),
            datasets: [{
                label: 'Games Played',
                data: Object.values(days),
                borderColor: '#00d4aa',
                backgroundColor: 'rgba(0, 212, 170, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#888' },
                    grid: { color: '#2a2a35' }
                },
                x: {
                    ticks: { color: '#888' },
                    grid: { display: false }
                }
            }
        }
    });
}

function getErrorMessage(code) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'Email already in use';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password';
        default:
            return 'An error occurred. Please try again.';
    }
}
