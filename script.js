// App State
const state = {
    auth: {
        user: null,
        isLoginMode: true
    },
    sets: [],
    currentSet: null,
    editorMarkers: [],
    tempMarker: null,
    game: {
        mode: null,
        round: 0,
        score: 0,
        shuffledPoints: [],
        currentPoint: null,
        markers: []
    }
};

// Maps
let editorMap = null;
let gameMap = null;

const tileLayers = {
    "Callejero": L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }),
    "Satélite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    }),
    "Oscuro": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }),
    "Claro": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    })
};

// Firebase Globals
let auth = null;
let db = null;
let apiReady = false;

// Firebase Configuration
// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBMnjYRZ4XpZ_KXvPU5zabpnXyl3H7oGg8",
    authDomain: "geomap-84c19.firebaseapp.com",
    projectId: "geomap-84c19",
    storageBucket: "geomap-84c19.firebasestorage.app",
    messagingSenderId: "617633273626",
    appId: "1:617633273626:web:90f830922454052bb8fea3",
    measurementId: "G-FX53JXFSFL"
};

// Utils
const $ = (id) => document.getElementById(id);
const hideAllViews = () => document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
const showView = (id) => {
    hideAllViews();
    $(id).classList.add('active');
};
const getId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    initEventListeners();
    initFirebase();
});

function initFirebase() {
    if (!window.firebase) {
        setTimeout(initFirebase, 100);
        return;
    }
    try {
        const app = window.firebase.initializeApp(firebaseConfig);
        auth = window.firebase.getAuth(app);
        db = window.firebase.getFirestore(app);

        // Auth Listener
        window.firebase.onAuthStateChanged(auth, (user) => {
            if (user) {
                const appUser = {
                    id: user.uid,
                    email: user.email
                };
                loginSuccess(appUser, null, false);
            } else {
                logout(false);
            }
        });

        apiReady = true;
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        Swal.fire('Error de Configuración', 'No se pudo conectar con Firebase. Revisa la consola.', 'error');
    }
}

async function loadSets() {
    if (!state.auth.user || !db) return;
    try {
        const q = window.firebase.query(
            window.firebase.collection(db, "sets"),
            window.firebase.where("ownerId", "==", state.auth.user.id)
        );

        const querySnapshot = await window.firebase.getDocs(q);
        state.sets = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Ensure points array exists in the data
            if (!data.points) data.points = [];
            state.sets.push({ id: doc.id, ...data });
        });

        renderSetsList();
    } catch (e) {
        console.error("Failed to load sets", e);
        Swal.fire('Error', 'No se pudieron cargar los sets', 'error');
    }
}

// Auth Logic
async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!apiReady) return;

    let email = $('auth-email').value.trim();
    const pass = $('auth-password').value;
    const btn = $('btn-auth-submit');

    if (!email.includes('@')) {
        email = email + '@geoquiz.app';
    }

    btn.disabled = true;
    btn.innerText = 'Cargando...';

    try {
        if (state.auth.isLoginMode) {
            await window.firebase.signInWithEmailAndPassword(auth, email, pass);
        } else {
            await window.firebase.createUserWithEmailAndPassword(auth, email, pass);
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerText = state.auth.isLoginMode ? 'Entrar' : 'Registrarse';
        console.error(err);

        let msg = "Error de autenticación";
        if (err.code === 'auth/wrong-password') msg = "Contraseña incorrecta";
        if (err.code === 'auth/user-not-found') msg = "Usuario no encontrado";
        if (err.code === 'auth/email-already-in-use') msg = "El usuario ya existe";
        if (err.code === 'auth/invalid-email') msg = "Nombre de usuario inválido";

        Swal.fire('Error', msg, 'error');
    }
}

function loginSuccess(user, token, showToast = true) {
    state.auth.user = user;
    // Token is handled by Firebase SDK internally

    // Strip domain for display if it's our fake one
    let displayName = user.email;
    if (displayName && displayName.endsWith('@geoquiz.app')) {
        displayName = displayName.split('@')[0];
    }

    $('user-email').innerText = displayName;
    $('user-info').classList.remove('hidden');

    showView('dashboard');
    loadSets();

    if (showToast) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
        Toast.fire({ icon: 'success', title: `¡Hola, ${displayName}!` });
    }

    $('auth-email').value = '';
    $('auth-password').value = '';
    $('btn-auth-submit').disabled = false;
    $('btn-auth-submit').innerText = 'Entrar';
}

function logout(manual = true) {
    state.auth.user = null;
    $('user-info').classList.add('hidden');
    showView('auth-view');

    if (manual && auth) window.firebase.signOut(auth);
}

function toggleAuthMode() {
    state.auth.isLoginMode = !state.auth.isLoginMode;
    const isLogin = state.auth.isLoginMode;

    $('auth-toggle-text').innerText = isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
    $('btn-toggle-auth').innerText = isLogin ? 'Regístrate' : 'Inicia Sesión';
    $('btn-auth-submit').innerText = isLogin ? 'Entrar' : 'Registrarse';
}

function renderSetsList() {
    const container = $('sets-list');
    container.innerHTML = '';

    if (state.sets.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay sets. ¡Crea el primero!</div>';
        return;
    }

    state.sets.forEach(set => {
        const div = document.createElement('div');
        div.className = 'card set-card';

        let deleteBtn = '';
        if (state.auth.user && set.ownerId === state.auth.user.id) {
            deleteBtn = `<button class="delete-btn" onclick="deleteSet(event, '${set.id}')">✕</button>`;
        }

        div.innerHTML = `
            <h3>${set.name}</h3>
            <p>${set.points ? set.points.length : 0} ubicaciones</p>
            ${deleteBtn}
             <div style="margin-top:auto; font-size:0.8rem; color:var(--text-muted); opacity:0.6;">
                 De: ${(set.ownerEmail || 'Anónimo').replace('@geoquiz.app', '')}
            </div>
        `;
        div.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn')) openGameSetup(set);
        };
        container.appendChild(div);
    });
}

function deleteSet(e, id) {
    e.stopPropagation();
    Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esto",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, borrar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await window.firebase.deleteDoc(window.firebase.doc(db, "sets", id));
                loadSets();
                Swal.fire('Borrado', '', 'success');
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo borrar el set', 'error');
            }
        }
    });
}

function initEventListeners() {
    // Auth
    $('auth-form').onsubmit = handleAuthSubmit;
    $('btn-toggle-auth').onclick = toggleAuthMode;
    $('btn-logout').onclick = () => logout(true);

    // Dashboard
    $('btn-create-set').onclick = startCreator;

    // Editor
    $('btn-editor-back').onclick = () => showView('dashboard');
    $('btn-add-point').onclick = confirmEditorPoint;
    $('btn-save-set').onclick = finalizeSet;

    // Game Setup
    $('btn-setup-back').onclick = () => showView('dashboard');
    document.querySelectorAll('.mode-card').forEach(card => {
        card.onclick = () => startGame(card.dataset.mode);
    });

    // Game
    $('btn-game-exit').onclick = () => {
        Swal.fire({
            title: '¿Salir del juego?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Salir'
        }).then((res) => {
            if (res.isConfirmed) showView('dashboard');
        });
    };
    $('btn-submit-name').onclick = handleNameSubmit;
    $('btn-next-round').onclick = nextRound;

    $('game-input-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleNameSubmit();
    });

    // Results
    $('btn-home').onclick = () => showView('dashboard');
}

// ----------------------
// CREATOR LOGIC
// ----------------------

function startCreator() {
    Swal.fire({
        title: 'Nombre del nuevo Set',
        input: 'text',
        inputPlaceholder: 'Ej. Capitales de Europa',
        showCancelButton: true,
        confirmButtonText: 'Crear',
        preConfirm: (name) => {
            if (!name) Swal.showValidationMessage('Introduce un nombre');
            return name;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            initEditor(result.value);
        }
    });
}

const EDITOR_BACKUP_KEY = 'geo_editor_backup';

function initEditor(setName, fromBackup = false) {
    if (!fromBackup) {
        // Check for backup
        const backup = localStorage.getItem(EDITOR_BACKUP_KEY);
        if (backup) {
            try {
                const data = JSON.parse(backup);
                if (data.points && data.points.length > 0) {
                    Swal.fire({
                        title: 'Restaurar sesión',
                        text: `Tenías un set sin guardar: "${data.name}" con ${data.points.length} puntos.`,
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Restaurar',
                        cancelButtonText: 'Descartar'
                    }).then((res) => {
                        if (res.isConfirmed) {
                            initEditor(data.name, true);
                            state.currentSet = data;
                            // Restore markers
                            data.points.forEach(p => {
                                const m = L.marker([p.lat, p.lng]).addTo(editorMap).bindPopup(p.name);
                                state.editorMarkers.push(m);
                            });
                            $('editor-set-name').innerText = data.name;
                            renderEditorList();
                        } else {
                            localStorage.removeItem(EDITOR_BACKUP_KEY);
                            initEditor(setName, true);
                        }
                    });
                    return; // Wait for user choice
                }
            } catch (e) { console.error(e); }
        }
    }

    state.currentSet = {
        name: setName,
        points: []
    };
    state.editorMarkers = [];
    state.tempMarker = null;

    showView('editor');
    $('editor-set-name').innerText = setName;
    // $('point-count').innerText = '0'; // Handled by renderEditorList

    renderEditorList();
    $('point-name-input').value = '';
    $('point-name-input').disabled = true;
    $('btn-add-point').disabled = true;

    // Init Leaflet map if not exists
    if (!editorMap) {
        editorMap = L.map('editor-map', {
            layers: [tileLayers["Callejero"]] // Default layer
        }).setView([20, 0], 2);

        L.control.layers(tileLayers).addTo(editorMap);

        editorMap.on('click', onEditorMapClick);
    } else {
        // Clear old layers
        editorMap.eachLayer((layer) => {
            if (layer instanceof L.Marker) editorMap.removeLayer(layer);
        });
        editorMap.setView([20, 0], 2);
    }

    // Force strict resize check to fix "gray map" issues
    setTimeout(() => {
        editorMap.invalidateSize();
    }, 200);
}

function onEditorMapClick(e) {
    // If there's already a temp marker, move it
    if (state.tempMarker) {
        state.tempMarker.setLatLng(e.latlng);
    } else {
        state.tempMarker = L.marker(e.latlng, { draggable: true }).addTo(editorMap);
        state.tempMarker.on('dragend', () => {
            // Optional: update something on drag
        });
    }

    // Enable inputs
    const input = $('point-name-input');
    input.disabled = false;
    input.focus();
    $('btn-add-point').disabled = false;
}

function confirmEditorPoint() {
    const nameInput = $('point-name-input');
    const name = nameInput.value.trim();

    if (!name) {
        Swal.fire('¡Falta el nombre!', 'Escribe un nombre para esta ubicación', 'warning');
        return;
    }
    if (!state.tempMarker) return;

    const latlng = state.tempMarker.getLatLng();

    // Add to set data
    state.currentSet.points.push({
        lat: latlng.lat,
        lng: latlng.lng,
        name: name
    });

    // Save backup
    localStorage.setItem(EDITOR_BACKUP_KEY, JSON.stringify(state.currentSet));

    // Make marker permanent (change color or just leave it) and non-draggable
    // For visual simplicity, we remove temp and add a permanent one
    editorMap.removeLayer(state.tempMarker);
    const permMarker = L.marker(latlng).addTo(editorMap).bindPopup(name);
    state.editorMarkers.push(permMarker);

    state.tempMarker = null;

    // Reset UI
    nameInput.value = '';
    nameInput.disabled = true;
    $('btn-add-point').disabled = true;

    renderEditorList();

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
    });
    Toast.fire({ icon: 'success', title: 'Punto añadido' });
}

function renderEditorList() {
    const list = $('editor-points-list');
    $('point-count').innerText = `${state.currentSet.points.length} puntos`;

    if (state.currentSet.points.length === 0) {
        list.innerHTML = '<div class="empty-list">Añade puntos en el mapa</div>';
        return;
    }

    list.innerHTML = '';
    state.currentSet.points.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = 'point-item';
        div.innerHTML = `
            <span>${index + 1}. ${p.name}</span>
            <div class="point-actions">
                <button class="mini-btn" onclick="renamePoint(${index})">✎</button>
                <button class="mini-btn del" onclick="removePoint(${index})">✕</button>
            </div>
        `;
        div.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                editorMap.flyTo([p.lat, p.lng], 6);
            }
        };
        list.appendChild(div);
    });
}

function removePoint(index) {
    // Remove from array
    state.currentSet.points.splice(index, 1);

    // Remove marker from map
    const marker = state.editorMarkers[index];
    editorMap.removeLayer(marker);
    state.editorMarkers.splice(index, 1);

    // Update Backup
    localStorage.setItem(EDITOR_BACKUP_KEY, JSON.stringify(state.currentSet));

    renderEditorList();
}

function renamePoint(index) {
    const point = state.currentSet.points[index];
    Swal.fire({
        title: 'Renombrar punto',
        input: 'text',
        inputValue: point.name,
        showCancelButton: true
    }).then((res) => {
        if (res.isConfirmed && res.value) {
            point.name = res.value;
            // Update marker popup
            state.editorMarkers[index].bindPopup(point.name);
            // Update Backup
            localStorage.setItem(EDITOR_BACKUP_KEY, JSON.stringify(state.currentSet));
            renderEditorList();
        }
    });
}

async function finalizeSet() {
    if (state.currentSet.points.length === 0) {
        Swal.fire('Set vacío', 'Añade al menos un punto', 'warning');
        return;
    }

    const btn = $('btn-save-set');
    btn.disabled = true;
    btn.innerText = 'Guardando...';

    const payload = {
        name: state.currentSet.name,
        points: state.currentSet.points,
        ownerId: state.auth.user.id,
        ownerEmail: state.auth.user.email
    };

    try {
        await window.firebase.addDoc(window.firebase.collection(db, "sets"), payload);
        localStorage.removeItem(EDITOR_BACKUP_KEY); // Clear backup

        Swal.fire({
            title: '¡Set Guardado!',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            showView('dashboard');
            loadSets();
        });
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo guardar el set', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Guardar Set';
    }
}



// ----------------------
// GAME LOGIC
// ----------------------

function openGameSetup(set) {
    state.currentSet = set;
    showView('game-setup');
}

function startGame(mode) {
    state.game.mode = mode;
    const points = state.currentSet.points || [];
    if (points.length === 0) {
        Swal.fire('Error', 'Este set no tiene puntos válidos.', 'error');
        showView('dashboard');
        return;
    }
    state.game.shuffledPoints = [...points].sort(() => 0.5 - Math.random());
    state.game.round = 0;
    state.game.score = 0;
    state.game.markers = []; // Reset markers

    showView('game');
    initGameMap();
    startRound();
}

function initGameMap() {
    if (!gameMap) {
        gameMap = L.map('game-map', {
            zoomControl: false,
            layers: [tileLayers["Callejero"]]
        }).setView([20, 0], 2);

        L.control.layers(tileLayers).addTo(gameMap); // Users want to choose layer in game too
    } else {
        // Clear all previous markers
        gameMap.setView([20, 0], 2);
    }

    setTimeout(() => gameMap.invalidateSize(), 200);
}

function startRound() {
    if (state.game.round >= state.game.shuffledPoints.length) {
        endGame();
        return;
    }

    const currentPoint = state.game.shuffledPoints[state.game.round];
    state.game.currentPoint = currentPoint;

    // Update UI
    $('game-progress').innerText = `${state.game.round + 1} / ${state.game.shuffledPoints.length}`;
    $('btn-next-round').classList.add('hidden');
    $('feedback-input').innerText = '';
    $('feedback-find').innerText = '';
    $('feedback-input').className = 'feedback-msg'; // reset colors
    $('feedback-find').className = 'feedback-msg';

    // Clear Markers from map just in case (depending on mode)
    gameMap.eachLayer((layer) => {
        if (layer instanceof L.Marker) gameMap.removeLayer(layer);
    });

    if (state.game.mode === 'find-loc') {
        setupModeFind(currentPoint);
    } else {
        setupModeName(currentPoint);
    }
}

// MODE 1: FIND LOCATION (Shows Name -> User clicks Marker)
function setupModeFind(point) {
    $('prompt-find').classList.remove('hidden');
    $('prompt-input').classList.add('hidden');
    $('target-name').innerText = point.name;

    // Add ALL markers to the map but don't label them initially?
    // User request: "le das al punto".
    // We add all markers from the set to define the search space.
    // They should be clickable.

    state.currentSet.points.forEach(p => {
        const marker = L.marker([p.lat, p.lng]).addTo(gameMap);

        // Interaction
        marker.on('click', () => handleMarkerClick(p, marker));
        state.game.markers.push(marker);
    });

    // Fit bounds to show all points
    if (state.currentSet.points.length > 0) {
        const group = new L.featureGroup(state.game.markers);
        gameMap.fitBounds(group.getBounds().pad(0.1));
    }
}

function handleMarkerClick(clickedPointData, markerClicked) {
    if ($('btn-next-round').classList.contains('hidden') === false) return; // Round already done

    const target = state.game.currentPoint;
    const isCorrect = (clickedPointData.lat === target.lat && clickedPointData.lng === target.lng); // Simple check since data ref is same

    const feedback = $('feedback-find');

    if (isCorrect) {
        state.game.score++;
        feedback.innerText = "¡Correcto! 🎉";
        feedback.classList.add('correct');
        markerClicked.setIcon(getIcon('green'));

        // Mini confetti for correct answer
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
        });

    } else {
        feedback.innerText = `Incorrecto. Era: ${target.name}`; // Well, in this mode we knew the name.
        feedback.classList.add('wrong');
        markerClicked.setIcon(getIcon('red'));

        // Highlight the correct one
        state.game.markers.forEach(m => {
            const mLatLng = m.getLatLng();
            if (mLatLng.lat === target.lat && mLatLng.lng === target.lng) {
                m.setIcon(getIcon('green'));
                m.bindPopup("¡Era aquí!").openPopup();
            }
        });
    }

    $('btn-next-round').classList.remove('hidden');
}


// MODE 2: NAME LOCATION (Shows Marker -> User types Name)
function setupModeName(point) {
    $('prompt-find').classList.add('hidden');
    $('prompt-input').classList.remove('hidden');
    $('game-input-name').value = '';
    $('game-input-name').disabled = false;
    $('btn-submit-name').disabled = false;
    $('game-input-name').focus();

    // Show ONLY target marker? Or all? 
    // "te dice el punto" implies singular. Let's just show the specific target point.
    // This avoids confusion "Which one am I naming?"
    // This avoids confusion "Which one am I naming?"
    const marker = L.marker([point.lat, point.lng]).addTo(gameMap);

    // Smooth Fly Animation
    gameMap.flyTo([point.lat, point.lng], 6, {
        animate: true,
        duration: 1.5
    });

    state.game.markers.push(marker);
}

function handleNameSubmit() {
    if ($('btn-next-round').classList.contains('hidden') === false) return;

    const input = $('game-input-name');
    const val = input.value.trim().toLowerCase();
    const correctName = state.game.currentPoint.name.toLowerCase();

    if (!val) return;

    // Simple string similarity or exact match?
    // Let's do partial match (contains) or basic check
    // Actually exact(ish) match is standard. Let's loosen it a bit (trim, case)

    const isCorrect = val === correctName || (correctName.includes(val) && val.length > 3);

    const feedback = $('feedback-input');

    if (isCorrect) {
        state.game.score++;
        feedback.innerText = "¡Correcto! 🎉";
        feedback.classList.add('correct');

        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.8 }
        });
    } else {
        feedback.innerText = `Incorrecto. La respuesta era: ${state.game.currentPoint.name}`;
        feedback.classList.add('wrong');
    }

    input.disabled = true;
    $('btn-submit-name').disabled = true;
    $('btn-next-round').classList.remove('hidden');
}

function nextRound() {
    state.game.round++;
    startRound();
}

function endGame() {
    showView('results');
    $('final-score').innerText = state.game.score;
    $('total-rounds').innerText = state.game.shuffledPoints.length;

    // Celebration
    if (state.game.score > 0) {
        var duration = 3 * 1000;
        var end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#6366f1', '#ec4899', '#10b981']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#6366f1', '#ec4899', '#10b981']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }
}

// Helper: Custom Icons (using Leaflet default filtering logic or just hue-rotate for simplicity via CSS? No, easier to use Leaflet API if I had images. 
// Actually, default leaflet marker is blue. I can't easily change color without custom images.
// I will use CSS filters on the .leaflet-marker-icon class if I add a class, OR simpler:
// Use a colored DivIcon or a filter.
function getIcon(color) {
    // Basic trick: use a filter on the default image URL 
    // But since we can't easily modify the default Icon object instance color, 
    // let's just make a simple distinction.

    // Better: use L.divIcon with a colored emoji or circle.
    // OR: use the standard hack for colors via hue-rotate in CSS, but that applies to class.

    // Let's use a simple DivIcon for colored markers to avoid complex image assets

    let cssColor = color === 'green' ? '#22c55e' : '#ef4444';

    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="
            background: linear-gradient(135deg, ${cssColor}, ${color === 'green' ? '#15803d' : '#991b1b'});
            width: 24px;
            height: 24px;
            border-radius: 50% 50% 0 50%;
            transform: rotate(45deg);
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}
