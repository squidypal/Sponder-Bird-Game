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
    Timestamp
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
function initGameFrame() {
    const gameFrame = document.getElementById('game-frame');
    const placeholder = document.querySelector('.game-placeholder');
    
    gameFrame.src = GAME_URL;
    gameFrame.onload = () => {
        gameFrame.classList.add('loaded');
        placeholder.classList.add('hidden');
    };
    gameFrame.onerror = () => {
        placeholder.innerHTML = '<p>Failed to load game</p><small>Check the GAME_URL in app.js</small>';
    };
}

// Score submission
document.getElementById('submit-score').addEventListener('click', async () => {
    const scoreInput = document.getElementById('score-input');
    const score = parseInt(scoreInput.value);
    
    if (isNaN(score) || score < 0) {
        alert('Please enter a valid score');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const updates = {
            gamesPlayed: increment(1)
        };
        
        if (score > (userData.highScore || 0)) {
            updates.highScore = score;
        }
        
        await updateDoc(userRef, updates);
        
        // Log the game for admin analytics
        await setDoc(doc(collection(db, 'games')), {
            oderId: currentUser.uid,
            score: score,
            playedAt: Timestamp.now()
        });
        
        await loadUserData(currentUser.uid);
        await loadLeaderboard();
        
        scoreInput.value = '';
        alert('Score submitted!');
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Error submitting score');
    }
});

// Admin Dashboard
async function loadAdminData() {
    if (!userData || !userData.isAdmin) return;
    
    try {
        // Total players
        const usersSnapshot = await getDocs(collection(db, 'users'));
        document.getElementById('total-players').textContent = usersSnapshot.size;
        
        // Total games and avg score
        const gamesSnapshot = await getDocs(collection(db, 'games'));
        document.getElementById('total-games').textContent = gamesSnapshot.size;
        
        let totalScore = 0;
        gamesSnapshot.forEach(doc => {
            totalScore += doc.data().score || 0;
        });
        const avgScore = gamesSnapshot.size > 0 ? Math.round(totalScore / gamesSnapshot.size) : 0;
        document.getElementById('avg-score').textContent = avgScore;
        
        // New users in last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        let newUsers = 0;
        usersSnapshot.forEach(doc => {
            const createdAt = doc.data().createdAt?.toDate();
            if (createdAt && createdAt > weekAgo) {
                newUsers++;
            }
        });
        document.getElementById('new-users').textContent = newUsers;
        
        // Build charts
        buildScoresChart(gamesSnapshot);
        buildPlayersChart(gamesSnapshot);
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

function buildScoresChart(gamesSnapshot) {
    const ctx = document.getElementById('scores-chart').getContext('2d');
    
    // Score ranges
    const ranges = { '0-50': 0, '51-100': 0, '101-200': 0, '201-500': 0, '500+': 0 };
    
    gamesSnapshot.forEach(doc => {
        const score = doc.data().score || 0;
        if (score <= 50) ranges['0-50']++;
        else if (score <= 100) ranges['51-100']++;
        else if (score <= 200) ranges['101-200']++;
        else if (score <= 500) ranges['201-500']++;
        else ranges['500+']++;
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

function buildPlayersChart(gamesSnapshot) {
    const ctx = document.getElementById('players-chart').getContext('2d');
    
    // Games per day (last 7 days)
    const days = {};
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-US', { weekday: 'short' });
        days[key] = 0;
    }
    
    gamesSnapshot.forEach(doc => {
        const playedAt = doc.data().playedAt?.toDate();
        if (playedAt) {
            const daysSince = Math.floor((today - playedAt) / (1000 * 60 * 60 * 24));
            if (daysSince >= 0 && daysSince < 7) {
                const key = playedAt.toLocaleDateString('en-US', { weekday: 'short' });
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
