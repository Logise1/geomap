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
    console.log(`Showing view: ${id}`);
    hideAllViews();
    const el = $(id);
    if (el) {
        el.classList.add('active');
    } else {
        console.error(`View not found: ${id}`);
    }
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
            <div class="card-actions">
                ${state.auth.user && set.ownerId === state.auth.user.id ?
                `<button class="mini-btn" onclick="editSet(event, '${set.id}')">✎ Editar</button>` : ''}
                ${deleteBtn}
            </div>
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

function editSet(e, id) {
    if (e) e.stopPropagation();
    const set = state.sets.find(s => s.id === id);
    if (!set) return;

    state.currentSet = JSON.parse(JSON.stringify(set)); // Deep copy to avoid mutating list directly
    state.editorMarkers = [];
    state.tempMarker = null;

    // Ensure mode defaults
    if (!state.currentSet.mode) state.currentSet.mode = 'world';

    // Reuse 'fromBackup' flag (true) to skip initialization blank state
    initEditor(set.name, true);

    // Restore markers
    // initEditor calls initMapForEditor which resets the map. We add markers after.
    setTimeout(() => {
        state.currentSet.points.forEach(p => {
            const m = L.marker([p.lat, p.lng]).addTo(editorMap).bindPopup(p.name);
            state.editorMarkers.push(m);
        });
    }, 100); // Small delay to ensure map init
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
    $('btn-next-round').onclick = nextRound;

    // Results
    $('btn-home').onclick = () => showView('dashboard');
}

// ----------------------
// CREATOR LOGIC
// ----------------------

const YYF_URL = 'https://yyf.mubilop.com';

async function uploadToYYF(file) {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const response = await fetch(`${YYF_URL}/api/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('Upload failed');
    const result = await response.json();
    return YYF_URL + result.fileUrl;
}

function startCreator() {
    Swal.fire({
        title: 'Crear Nuevo Set',
        html: `
            <input id="swal-input-name" class="swal2-input" placeholder="Nombre del Set">
            <select id="swal-input-type" class="swal2-input" style="margin-top: 15px;">
                <option value="world">Mapa del Mundo (Leaflet)</option>
                <option value="image">Subir Imagen (Plano/Ficción)</option>
            </select>
            <div id="swal-upload-container" style="display:none; margin-top: 15px;">
                <label style="display:block; margin-bottom:5px;">Sube tu mapa:</label>
                <input type="file" id="swal-input-file" accept="image/*" class="swal2-file">
            </div>
        `,
        focusConfirm: false,
        didOpen: () => {
            const typeSelect = document.getElementById('swal-input-type');
            const uploadDiv = document.getElementById('swal-upload-container');
            typeSelect.onchange = () => {
                uploadDiv.style.display = typeSelect.value === 'image' ? 'block' : 'none';
            };
        },
        preConfirm: () => {
            const name = document.getElementById('swal-input-name').value;
            const type = document.getElementById('swal-input-type').value;
            const fileInput = document.getElementById('swal-input-file');

            if (!name) {
                Swal.showValidationMessage('Escribe un nombre para el set');
                return false;
            }
            if (type === 'image') {
                if (fileInput.files.length === 0) {
                    Swal.showValidationMessage('Debes seleccionar una imagen');
                    return false;
                }
                return { name, type, file: fileInput.files[0] };
            }
            return { name, type };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { name, type, file } = result.value;

            if (type === 'image') {
                Swal.fire({
                    title: 'Subiendo mapa...',
                    text: 'Por favor espera',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                try {
                    const imageUrl = await uploadToYYF(file);
                    Swal.close();
                    initEditor(name, false, { mode: 'image', imageUrl });
                } catch (e) {
                    console.error(e);
                    Swal.fire('Error', 'Falló la subida de la imagen. Inténtalo de nuevo.', 'error');
                }
            } else {
                initEditor(name, false, { mode: 'world' });
            }
        }
    });
}

const EDITOR_BACKUP_KEY = 'geo_editor_backup';

function initEditor(setName, fromBackup = false, options = {}) {
    if (!fromBackup) {
        // Check for backup
        const backup = localStorage.getItem(EDITOR_BACKUP_KEY);
        if (backup) {
            try {
                const data = JSON.parse(backup);
                // Simple validation
                if (data.name) {
                    Swal.fire({
                        title: 'Restaurar sesión',
                        text: `Tenías un set sin guardar: "${data.name}"`,
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Restaurar',
                        cancelButtonText: 'Descartar'
                    }).then((res) => {
                        if (res.isConfirmed) {
                            state.currentSet = data;
                            // Ensure valid object structure
                            if (!state.currentSet.mode) state.currentSet.mode = 'world';

                            initEditor(data.name, true);

                            // Restore markers
                            // Wait for map to be ready? initMapForEditor is synchronous generally but image loading validiation might delay bounds
                            // But for marker placement, we just need the map object.
                            state.currentSet.points.forEach(p => {
                                const m = L.marker([p.lat, p.lng]).addTo(editorMap).bindPopup(p.name);
                                state.editorMarkers.push(m);
                            });

                            $('editor-set-name').innerText = data.name;
                            renderEditorList();
                        } else {
                            localStorage.removeItem(EDITOR_BACKUP_KEY);
                            initEditor(setName, false, options);
                        }
                    });
                    return; // Wait for user choice
                }
            } catch (e) { console.error(e); }
        }
    }

    if (!fromBackup) {
        state.currentSet = {
            name: setName,
            points: [],
            mode: options.mode || 'world',
            imageUrl: options.imageUrl || null
        };
        state.editorMarkers = [];
        state.tempMarker = null;
    }

    showView('editor');
    $('editor-set-name').innerText = state.currentSet.name;

    renderEditorList();
    $('point-name-input').value = '';
    $('point-name-input').disabled = true;
    $('btn-add-point').disabled = true;

    initMapForEditor();
}

function initMapForEditor() {
    // If map exists, completely remove it to reset CRS and layers
    if (editorMap) {
        editorMap.remove();
        editorMap = null;
    }

    const isImageMode = state.currentSet.mode === 'image';

    if (isImageMode) {
        // Custom Image Map
        editorMap = L.map('editor-map', {
            crs: L.CRS.Simple, // Coordinate system for flat images
            minZoom: -2,
            maxZoom: 4,
            zoomControl: true
        });

        const url = state.currentSet.imageUrl;
        const img = new Image();
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const bounds = [[0, 0], [h, w]]; // Leaflet uses [y, x] for simple CRS sometimes, but actually [lat, lng] -> [y, x]

            L.imageOverlay(url, bounds).addTo(editorMap);
            editorMap.fitBounds(bounds);
            editorMap.setMaxBounds(bounds);
            editorMap.setView([h / 2, w / 2], 0);
        };
        img.src = url;

    } else {
        // Standard World Map
        editorMap = L.map('editor-map', {
            layers: [tileLayers["Callejero"]],
            zoomControl: true
        }).setView([20, 0], 2);

        L.control.layers(tileLayers).addTo(editorMap);
    }

    // Common event listeners
    editorMap.on('click', onEditorMapClick);

    // Resize fix
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
        mode: state.currentSet.mode || 'world',
        imageUrl: state.currentSet.imageUrl || null,
        ownerId: state.auth.user.id,
        ownerEmail: state.auth.user.email
    };

    try {
        if (state.currentSet.id) {
            // UPDATE existing set
            await window.firebase.setDoc(window.firebase.doc(db, "sets", state.currentSet.id), payload);
        } else {
            // CREATE new set
            await window.firebase.addDoc(window.firebase.collection(db, "sets"), payload);
        }

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

const synth = window.speechSynthesis;
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
}

// Tone.js Synth
let toneSynth = null;
async function initTone() {
    await Tone.start();
    toneSynth = new Tone.PolySynth(Tone.Synth).toDestination();
}

function playTone(isCorrect) {
    if (!toneSynth) return;
    const now = Tone.now();
    if (isCorrect) {
        toneSynth.triggerAttackRelease("C5", "8n", now);
        toneSynth.triggerAttackRelease("E5", "8n", now + 0.1);
        toneSynth.triggerAttackRelease("G5", "8n", now + 0.2);
    } else {
        toneSynth.triggerAttackRelease("A3", "8n", now);
        toneSynth.triggerAttackRelease("Ab3", "8n", now + 0.1);
        toneSynth.triggerAttackRelease("G3", "4n", now + 0.2);
    }
}

function speak(text) {
    if (synth.speaking) synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES';
    utter.rate = 1.0;
    synth.speak(utter);
}

function normalizeString(str) {
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, ""); // remove spaces and punctuation
}

async function startGame(mode) {
    state.game.mode = mode;
    const points = state.currentSet.points || [];
    if (points.length === 0) {
        Swal.fire('Error', 'Este set no tiene puntos válidos.', 'error');
        showView('dashboard');
        return;
    }

    // Init Audio Context
    initTone().catch(e => console.log("Audio context warning", e));

    state.game.shuffledPoints = [...points].sort(() => 0.5 - Math.random());
    state.game.round = 0;
    state.game.score = 0;
    state.game.markers = [];

    showView('game');

    try {
        await initGameMap();
    } catch (e) {
        console.error("Map init error:", e);
        return;
    }

    if (mode === 'geo-show') {
        // No welcome speech
    }

    startRound();
}

function initGameMap() {
    return new Promise((resolve, reject) => {
        // Cleanup existing map
        if (gameMap) {
            gameMap.remove();
            gameMap = null;
        }

        const container = document.getElementById('game-map');
        if (container) {
            container._leaflet_id = null; // Clear Leaflet ID if stuck
            container.innerHTML = ''; // Force clear
        }

        const isImageMode = state.currentSet.mode === 'image';

        if (isImageMode) {
            // IMAGE Custom Map
            gameMap = L.map('game-map', {
                crs: L.CRS.Simple,
                minZoom: -2,
                maxZoom: 4,
                zoomControl: true,
                attributionControl: false
            });

            const url = state.currentSet.imageUrl;
            const img = new Image();

            img.onload = () => {
                const w = img.width;
                const h = img.height;
                const bounds = [[0, 0], [h, w]];

                L.imageOverlay(url, bounds).addTo(gameMap);
                gameMap.fitBounds(bounds);
                gameMap.setMaxBounds(bounds);

                // Wait for view animation (400ms) + buffer
                setTimeout(() => {
                    gameMap.invalidateSize();
                    resolve();
                }, 500);
            };

            img.onerror = () => reject(new Error("Failed to load map image"));
            img.src = url;

        } else {
            // WORLD Map
            gameMap = L.map('game-map', {
                layers: [tileLayers["Callejero"]], // Default layer
                zoomControl: true,
                attributionControl: false
            }).setView([20, 0], 2);

            // Wait for view animation (400ms) + buffer
            setTimeout(() => {
                gameMap.invalidateSize();
                resolve();
            }, 500);
        }
    });
}

function startRound() {
    // Check if game is over
    if (state.game.round >= state.game.shuffledPoints.length) {
        endGame();
        return;
    }

    // Get current target
    state.game.currentPoint = state.game.shuffledPoints[state.game.round];
    const point = state.game.currentPoint;

    // Update UI Progress
    const total = state.game.shuffledPoints.length;
    const current = state.game.round + 1;
    if ($('game-progress')) $('game-progress').innerText = `${current} / ${total}`;

    // Clear previous markers
    if (state.game.markers && state.game.markers.length > 0) {
        state.game.markers.forEach(m => gameMap.removeLayer(m));
    }
    state.game.markers = [];

    // Reset Feedback UI
    document.querySelectorAll('.feedback-msg').forEach(el => {
        el.innerText = '';
        el.className = 'feedback-msg';
        // Note: keeping base class, removing 'correct'/'wrong'
    });

    if ($('btn-next-round')) $('btn-next-round').classList.add('hidden');

    state.game.roundStartTime = Date.now();

    // Route to mode setup
    if (state.game.mode === 'find-loc') {
        setupModeFind(point);
    } else if (state.game.mode === 'geo-show') {
        setupModeGeoShow(point);
    }
}

// MODE 1: FIND LOCATION
function setupModeFind(point) {
    if ($('prompt-find')) $('prompt-find').classList.remove('hidden');
    if ($('prompt-show')) $('prompt-show').classList.add('hidden');
    $('target-name').innerText = point.name;

    state.currentSet.points.forEach(p => {
        const marker = L.marker([p.lat, p.lng]).addTo(gameMap);
        marker.on('click', () => handleMarkerClick(p, marker));
        state.game.markers.push(marker);
    });

    if (state.currentSet.points.length > 0) {
        const group = new L.featureGroup(state.game.markers);
        gameMap.fitBounds(group.getBounds().pad(0.1));
    }
}

function handleMarkerClick(clickedPointData, markerClicked) {
    if ($('btn-next-round').classList.contains('hidden') === false) return;

    const target = state.game.currentPoint;
    const isCorrect = (clickedPointData.lat === target.lat && clickedPointData.lng === target.lng);
    const feedback = $('feedback-find');

    if (isCorrect) {
        state.game.score++;
        feedback.innerText = "¡Correcto! 🎉";
        feedback.classList.add('correct');
        markerClicked.setIcon(getIcon('green'));
        playTone(true);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else {
        feedback.innerText = `Incorrecto. Era: ${target.name}`;
        feedback.classList.add('wrong');
        markerClicked.setIcon(getIcon('red'));
        playTone(false);
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


// MODE 2: GEO SHOW (Voice)
function setupModeGeoShow(point) {
    if ($('prompt-find')) $('prompt-find').classList.add('hidden');
    if ($('prompt-show')) $('prompt-show').classList.remove('hidden');

    // Hide the question text for a cleaner UI
    $('show-question-text').style.display = 'none';

    // reset mic button logic
    const micBtn = $('btn-mic');
    micBtn.onclick = startListening;
    micBtn.disabled = false;

    // Marker logic
    const marker = L.marker([point.lat, point.lng]).addTo(gameMap);
    state.game.markers.push(marker);

    // Reduced zoom: 4 for World, 1 for Image (was 6 and 2)
    const zoomLevel = state.currentSet.mode === 'image' ? 1 : 4;

    // Zoom/Pan
    gameMap.flyTo([point.lat, point.lng], zoomLevel, {
        animate: true,
        duration: 0.5 // Faster transition
    });

    // Start listening immediately (during transition)
    startListening();
}

function startListening() {
    if (!recognition) {
        Swal.fire('Error', 'Tu navegador no soporta reconocimiento de voz.', 'error');
        return;
    }
    const btn = $('btn-mic');
    const indicator = $('listening-indicator');

    // Setup events (always update handlers)
    recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript;
        const isFinal = lastResult.isFinal;
        checkVoiceAnswer(transcript, isFinal);
    };

    recognition.onerror = (event) => {
        console.error("STT Error", event.error);
        if (event.error === 'not-allowed') {
            btn.classList.remove('listening');
            indicator.classList.add('hidden');
            Swal.fire('Permiso denegado', 'Permite el uso del micrófono.', 'warning');
        }
        // Don't stop continuous on other errors if possible, or let onend handle it
    };

    recognition.onend = () => {
        // Auto-restart if in Geo Show mode and not finished
        if (state.game.mode === 'geo-show' && document.getElementById('game').classList.contains('active')) {
            try {
                recognition.start();
            } catch (e) { /* ignore */ }
        } else {
            btn.classList.remove('listening');
            indicator.classList.add('hidden');
        }
    };

    try {
        recognition.start();
        btn.classList.add('listening');
        indicator.classList.remove('hidden');
    } catch (e) {
        // Recognition already active
        // Ensure UI matches state
        btn.classList.add('listening');
        indicator.classList.remove('hidden');
    }
}

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

const stateLock = { processing: false };

function checkVoiceAnswer(transcript, isFinal) {
    if (stateLock.processing) return;

    if (!transcript || transcript.trim().length < 2) return;

    // --- NON-BLOCKING CHECKS (Run before grace period) ---
    const correctName = state.game.currentPoint.name;
    const cleanTranscript = transcript.replace(/\b(\w+)\s+\1\b/gi, '$1'); // Deduplicate
    const normalizedTranscript = normalizeString(cleanTranscript);
    const normalizedTarget = normalizeString(correctName);

    // 1. Check "PASAR" Command (Instant)
    if (normalizedTranscript === 'pasar') {
        stateLock.processing = true;
        const feedback = $('feedback-show');
        feedback.innerText = "↺ Saltado. Volverá al final.";
        feedback.className = 'feedback-msg'; // neutral

        // Add current point to the end of the queue
        state.game.shuffledPoints.push(state.game.currentPoint);

        setTimeout(() => {
            stateLock.processing = false;
            nextRound();
        }, 500); // Faster transition for skip (0.5s)
        return;
    }

    // 2. Check CORRECT Answer (Instant)
    const distance = levenshteinDistance(normalizedTranscript, normalizedTarget);
    let tolerance = 0;
    if (normalizedTarget.length > 3) tolerance = 1;
    if (normalizedTarget.length > 6) tolerance = 2;
    if (normalizedTarget.length > 10) tolerance = 3;

    const isCorrect = normalizedTranscript === normalizedTarget ||
        (normalizedTarget.length > 3 && normalizedTranscript.includes(normalizedTarget)) ||
        distance <= tolerance;

    const feedback = $('feedback-show');

    if (isCorrect) {
        stateLock.processing = true;
        state.game.score++;
        feedback.innerText = `¡Bien! Dijiste: "${cleanTranscript}" 🎉`;
        feedback.classList.remove('wrong');
        feedback.classList.add('correct');
        playTone(true);
        confetti({ particleCount: 50 });

        setTimeout(() => {
            stateLock.processing = false;
            nextRound();
        }, 1000);
        return;
    }

    // --- GRACE PERIOD FILTER for Incorrect/Noise ---
    // User requested 1.5s grace period where incorrect/noise is ignored
    if (state.game.roundStartTime && (Date.now() - state.game.roundStartTime < 1500)) {
        return;
    }

    // 3. Incorrect (Only if final)
    if (isFinal) {
        feedback.innerText = `Incorrecto. Inténtalo de nuevo.`;
        feedback.classList.remove('correct');
        feedback.classList.add('wrong');
        playTone(false);
    }
}

function nextRound() {
    state.game.round++;
    startRound();
}

function endGame() {
    showView('results');
    $('final-score').innerText = state.game.score;
    $('total-rounds').innerText = state.game.shuffledPoints.length;

    if (state.game.score > 0) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

function getIcon(color) {
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
