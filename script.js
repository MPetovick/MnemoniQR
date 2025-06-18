// Configuración compatible
const CONFIG = {
    PBKDF2_ITERATIONS: 310000,
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    AES_KEY_LENGTH: 256,
    HMAC_KEY_LENGTH: 256,
    HMAC_LENGTH: 32,
    QR_SIZE: 220,
    MIN_PASSPHRASE_LENGTH: 12,
    QR_ERROR_CORRECTION: 'H'
};

// Referencias a elementos DOM
const dom = {
    startBtn: document.getElementById('start-btn'),
    seedModal: document.getElementById('seed-modal'),
    closeModal: document.querySelector('.close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    seedPhrase: document.getElementById('seed-phrase'),
    wordCounter: document.getElementById('word-counter'),
    toggleVisibility: document.getElementById('toggle-visibility'),
    encryptBtn: document.getElementById('encrypt-btn'),
    passwordSection: document.getElementById('password-section'),
    password: document.getElementById('password'),
    passwordToggle: document.getElementById('password-toggle'),
    passwordStrengthBar: document.getElementById('password-strength-bar'),
    passwordStrengthText: document.getElementById('password-strength-text'),
    generatePassword: document.getElementById('generate-password'),
    qrContainer: document.getElementById('qr-container'),
    qrCanvas: document.getElementById('qr-canvas'),
    pdfBtn: document.getElementById('pdf-btn'),
    copyBtn: document.getElementById('copy-btn'),
    downloadBtn: document.getElementById('download-btn'),
    toastContainer: document.getElementById('toast-container'),
    
    // Nuevos elementos para descifrado
    dropArea: document.getElementById('drop-area'),
    qrFile: document.getElementById('qr-file'),
    qrPreview: document.getElementById('qr-preview'),
    decryptBtn: document.getElementById('decrypt-btn'),
    decryptedModal: document.getElementById('decrypted-modal'),
    decryptedSeed: document.getElementById('decrypted-seed'),
    seedWordsContainer: document.getElementById('seed-words-container'),
    copySeed: document.getElementById('copy-seed'),
    closeDecrypted: document.getElementById('close-decrypted'),
    wordCount: document.getElementById('word-count'),
    
    // Modal de bienvenida
    welcomeModal: document.getElementById('welcome-modal'),
    closeWelcome: document.getElementById('close-welcome'),
    acceptWelcome: document.getElementById('accept-welcome')
};

// Estado de la aplicación
const appState = {
    wordsVisible: false,
    passwordVisible: false,
    seedPhrase: '',
    password: '',
    encryptedData: '',
    qrImageData: null
};

// Event Listeners
dom.startBtn.addEventListener('click', () => {
    dom.seedModal.style.display = 'flex';
    dom.seedPhrase.focus();
});

dom.closeModal.addEventListener('click', closeModal);
dom.cancelBtn.addEventListener('click', closeModal);

dom.seedPhrase.addEventListener('input', () => {
    const words = dom.seedPhrase.value.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    dom.wordCounter.textContent = `${wordCount} palabras`;
    
    // Habilitar botón si tenemos un número válido de palabras
    dom.encryptBtn.disabled = ![12, 18, 24].includes(wordCount);
    
    // Actualizar estado
    appState.seedPhrase = dom.seedPhrase.value;
});

dom.toggleVisibility.addEventListener('click', () => {
    appState.wordsVisible = !appState.wordsVisible;
    dom.seedPhrase.type = appState.wordsVisible ? 'text' : 'password';
    dom.toggleVisibility.innerHTML = appState.wordsVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
});

dom.passwordToggle.addEventListener('click', () => {
    appState.passwordVisible = !appState.passwordVisible;
    dom.password.type = appState.passwordVisible ? 'text' : 'password';
    dom.passwordToggle.innerHTML = appState.passwordVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
});

dom.encryptBtn.addEventListener('click', async () => {
    if (validateInputs()) {
        try {
            await encryptSeedPhrase();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    }
});

dom.password.addEventListener('input', () => {
    const strength = calculatePasswordStrength(dom.password.value);
    dom.passwordStrengthBar.style.width = `${strength}%`;
    updatePasswordStrengthText(strength);
});

dom.generatePassword.addEventListener('click', generateSecurePassword);

dom.pdfBtn.addEventListener('click', generatePDF);
dom.copyBtn.addEventListener('click', copyQRToClipboard);
dom.downloadBtn.addEventListener('click', downloadQRAsPNG);

// Event Listeners para descifrado
dom.dropArea.addEventListener('click', () => {
    dom.qrFile.click();
});

dom.qrFile.addEventListener('change', handleFileSelect);

// Drag and drop
dom.dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropArea.classList.add('drag-over');
});

dom.dropArea.addEventListener('dragleave', () => {
    dom.dropArea.classList.remove('drag-over');
});

dom.dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropArea.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

dom.decryptBtn.addEventListener('click', () => {
    dom.seedModal.style.display = 'flex';
    dom.password.focus();
});

dom.copySeed.addEventListener('click', () => {
    dom.decryptedSeed.select();
    document.execCommand('copy');
    showToast('Semilla copiada al portapapeles', 'success');
});

dom.closeDecrypted.addEventListener('click', () => {
    dom.decryptedModal.style.display = 'none';
    // Limpiar datos sensibles
    dom.decryptedSeed.value = '';
    appState.seedPhrase = '';
});

// Modal de bienvenida
dom.closeWelcome.addEventListener('click', () => {
    dom.welcomeModal.style.display = 'none';
});

dom.acceptWelcome.addEventListener('click', () => {
    dom.welcomeModal.style.display = 'none';
});

// Funciones principales
function closeModal() {
    dom.seedModal.style.display = 'none';
    resetModalState();
}

function resetModalState() {
    dom.seedPhrase.value = '';
    dom.password.value = '';
    dom.wordCounter.textContent = '0 palabras';
    appState.wordsVisible = false;
    appState.passwordVisible = false;
    dom.seedPhrase.type = 'password';
    dom.password.type = 'password';
    dom.toggleVisibility.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordToggle.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordStrengthBar.style.width = '0%';
    dom.passwordStrengthText.textContent = 'Seguridad: Muy débil';
    dom.encryptBtn.disabled = true;
}

function validateInputs() {
    // Validar semilla
    const words = appState.seedPhrase.trim().split(/\s+/);
    if (![12, 18, 24].includes(words.length)) {
        showToast('La frase semilla debe contener 12, 18 o 24 palabras', 'error');
        return false;
    }
    
    // Validar contraseña
    if (dom.password.value.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
        showToast(`La contraseña debe tener al menos ${CONFIG.MIN_PASSPHRASE_LENGTH} caracteres`, 'error');
        return false;
    }
    
    const strength = calculatePasswordStrength(dom.password.value);
    if (strength < 40) {
        showToast('La contraseña es demasiado débil. Por favor, usa una más segura.', 'warning');
        return false;
    }
    
    appState.password = dom.password.value;
    return true;
}

function calculatePasswordStrength(password) {
    if (!password) return 0;
    
    let strength = 0;
    strength += Math.min(password.length * 4, 40);
    
    if (/[A-Z]/.test(password)) strength += 10;
    if (/[a-z]/.test(password)) strength += 10;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[^A-Za-z0-9]/.test(password)) strength += 15;
    
    return Math.max(0, Math.min(100, strength));
}

function updatePasswordStrengthText(strength) {
    let text = 'Seguridad: ';
    
    if (strength < 20) {
        text += 'Muy débil';
    } else if (strength < 40) {
        text += 'Débil';
    } else if (strength < 60) {
        text += 'Moderada';
    } else if (strength < 80) {
        text += 'Fuerte';
    } else {
        text += 'Muy fuerte';
    }
    
    dom.passwordStrengthText.textContent = text;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let password = '';
    
    // Asegurarse de que la contraseña cumple con los requisitos
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Asegurar al menos una mayúscula, minúscula, número y símbolo
    if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
    if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
    if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
    if (!/[^A-Za-z0-9]/.test(password)) password = password.slice(0, -1) + '!';
    
    dom.password.value = password;
    const strength = calculatePasswordStrength(password);
    dom.passwordStrengthBar.style.width = `${strength}%`;
    updatePasswordStrengthText(strength);
    
    showToast('Contraseña segura generada', 'success');
}

async function encryptSeedPhrase() {
    try {
        // Validar semilla
        const words = appState.seedPhrase.trim().split(/\s+/);
        if (![12, 18, 24].includes(words.length)) {
            throw new Error('La frase semilla debe contener 12, 18 o 24 palabras');
        }
        
        // Convertir a formato seguro
        const seedData = words.join(' ');
        
        // Cifrar usando Web Crypto API
        const encrypted = await cryptoUtils.encryptMessage(seedData, appState.password);
        appState.encryptedData = encrypted;
        
        // Generar QR
        await generateQR(encrypted);
        
        // Cerrar modal y mostrar resultado
        closeModal();
        dom.qrContainer.style.display = 'flex';
        showToast('Semilla cifrada correctamente', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Encryption error:', error);
    }
}

async function generateQR(data) {
    return new Promise((resolve, reject) => {
        const qrSize = CONFIG.QR_SIZE;
        dom.qrCanvas.width = qrSize;
        dom.qrCanvas.height = qrSize;
        
        QRCode.toCanvas(
            dom.qrCanvas,
            data,
            {
                width: qrSize,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: CONFIG.QR_ERROR_CORRECTION
            },
            (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                resolve();
            }
        );
    });
}

function generatePDF() {
    if (!appState.encryptedData) {
        showToast('Primero genera un código QR', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a5'
        });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text('Respaldo Seguro de Semilla', 105, 15, null, null, 'center');
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Este código QR contiene tu frase semilla cifrada con AES-256-GCM', 105, 22, null, null, 'center');
        
        const qrDataUrl = dom.qrCanvas.toDataURL('image/png');
        doc.addImage(qrDataUrl, 'PNG', 50, 30, 100, 100);
        
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Generado por MnemoniQR - ' + new Date().toLocaleDateString(), 105, 145, null, null, 'center');
        
        doc.save(`mnemoniqr-backup-${Date.now()}.pdf`);
        showToast('PDF generado correctamente', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Error al generar el PDF', 'error');
    }
}

function copyQRToClipboard() {
    if (!appState.encryptedData) {
        showToast('Primero genera un código QR', 'error');
        return;
    }
    
    try {
        dom.qrCanvas.toBlob(blob => {
            navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]).then(() => {
                showToast('QR copiado al portapapeles', 'success');
            }).catch(err => {
                console.error('Failed to copy: ', err);
                showToast('Error al copiar el QR', 'error');
            });
        });
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Error al copiar el QR', 'error');
    }
}

function downloadQRAsPNG() {
    if (!appState.encryptedData) {
        showToast('Primero genera un código QR', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = `mnemoniqr-${Date.now()}.png`;
        link.href = dom.qrCanvas.toDataURL('image/png');
        link.click();
        showToast('QR descargado correctamente', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Error al descargar el QR', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 
                             type === 'success' ? 'fa-check-circle' : 
                             type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    dom.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// Funciones para descifrado
function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (!file.type.match('image.*')) {
        showToast('Por favor, selecciona un archivo de imagen', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        dom.qrPreview.src = e.target.result;
        dom.qrPreview.style.display = 'block';
        dom.decryptBtn.style.display = 'block';
        appState.qrImageData = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function decryptQR() {
    if (!appState.qrImageData) {
        showToast('Primero carga un código QR', 'error');
        return;
    }
    
    if (!appState.password) {
        showToast('Por favor, ingresa la contraseña', 'error');
        return;
    }
    
    try {
        // Decodificar la imagen QR
        const img = new Image();
        img.src = appState.qrImageData;
        
        await img.decode();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (!code) {
            throw new Error('No se pudo leer el código QR');
        }
        
        // Descifrar el mensaje
        const decrypted = await cryptoUtils.decryptMessage(code.data, appState.password);
        
        // Mostrar resultado
        showDecryptedSeed(decrypted);
        
    } catch (error) {
        console.error('Decryption error:', error);
        showToast(`Error al descifrar: ${error.message}`, 'error');
    }
}

function showDecryptedSeed(seedPhrase) {
    const words = seedPhrase.split(' ');
    const wordCount = words.length;
    
    // Actualizar DOM
    dom.decryptedSeed.value = seedPhrase;
    dom.wordCount.textContent = `${wordCount} palabras`;
    
    // Generar cuadrícula de palabras
    dom.seedWordsContainer.innerHTML = '';
    words.forEach((word, index) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'seed-word';
        wordEl.textContent = word;
        wordEl.setAttribute('data-index', index + 1);
        dom.seedWordsContainer.appendChild(wordEl);
    });
    
    // Mostrar modal
    dom.decryptedModal.style.display = 'flex';
}

// Utilidades criptográficas
const cryptoUtils = {
    async encryptMessage(message, passphrase) {
        let salt = null;
        let iv = null;
        let aesKey = null;
        let hmacKey = null;
        
        try {
            // Validar entrada
            if (!message || !passphrase) {
                throw new Error('Mensaje y contraseña son requeridos');
            }
            
            if (passphrase.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
                throw new Error(`La contraseña debe tener al menos ${CONFIG.MIN_PASSPHRASE_LENGTH} caracteres`);
            }
            
            // Convertir datos
            const dataToEncrypt = new TextEncoder().encode(message);
            
            // Generar salt e IV
            salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
            iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
            
            // Derivar clave usando PBKDF2
            const baseKey = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(passphrase),
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );
            
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt,
                    iterations: CONFIG.PBKDF2_ITERATIONS,
                    hash: 'SHA-256'
                },
                baseKey,
                CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
            );
            
            const derivedBitsArray = new Uint8Array(derivedBits);
            const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
            const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
            
            // Importar claves
            aesKey = await crypto.subtle.importKey(
                'raw',
                aesKeyBytes,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            
            hmacKey = await crypto.subtle.importKey(
                'raw',
                hmacKeyBytes,
                {
                    name: 'HMAC',
                    hash: { name: 'SHA-256' }
                },
                false,
                ['sign']
            );
            
            // Cifrar con AES-GCM
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv, tagLength: 128 },
                aesKey,
                dataToEncrypt
            );
            
            const ciphertext = new Uint8Array(encrypted);
            
            // Calcular HMAC del texto cifrado
            const hmac = await crypto.subtle.sign(
                'HMAC',
                hmacKey,
                ciphertext
            );
            
            // Combinar: salt + iv + ciphertext + hmac
            const combined = new Uint8Array([
                ...salt,
                ...iv,
                ...ciphertext,
                ...new Uint8Array(hmac)
            ]);
            
            // Convertir a Base64 para el QR
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Error al cifrar: ' + error.message);
        }
    },
    
    async decryptMessage(encryptedBase64, passphrase) {
        try {
            // Convertir de Base64
            const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            
            // Extraer componentes
            const salt = encryptedData.slice(0, CONFIG.SALT_LENGTH);
            const iv = encryptedData.slice(CONFIG.SALT_LENGTH, CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
            const ciphertext = encryptedData.slice(
                CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH, 
                encryptedData.length - CONFIG.HMAC_LENGTH
            );
            const hmac = encryptedData.slice(encryptedData.length - CONFIG.HMAC_LENGTH);
            
            // Derivar clave usando PBKDF2
            const baseKey = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(passphrase),
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );
            
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt,
                    iterations: CONFIG.PBKDF2_ITERATIONS,
                    hash: 'SHA-256'
                },
                baseKey,
                CONFIG.AES_KEY_LENGTH + CONFIG.HMAC_KEY_LENGTH
            );
            
            const derivedBitsArray = new Uint8Array(derivedBits);
            const aesKeyBytes = derivedBitsArray.slice(0, CONFIG.AES_KEY_LENGTH / 8);
            const hmacKeyBytes = derivedBitsArray.slice(CONFIG.AES_KEY_LENGTH / 8);
            
            // Importar claves
            const aesKey = await crypto.subtle.importKey(
                'raw',
                aesKeyBytes,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            const hmacKey = await crypto.subtle.importKey(
                'raw',
                hmacKeyBytes,
                {
                    name: 'HMAC',
                    hash: { name: 'SHA-256' }
                },
                false,
                ['verify']
            );
            
            // Verificar HMAC
            const hmacValid = await crypto.subtle.verify(
                'HMAC',
                hmacKey,
                hmac,
                ciphertext
            );
            
            if (!hmacValid) {
                throw new Error('El HMAC no coincide. La contraseña podría ser incorrecta o el archivo está corrupto.');
            }
            
            // Descifrar con AES-GCM
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv, tagLength: 128 },
                aesKey,
                ciphertext
            );
            
            // Convertir a texto
            return new TextDecoder().decode(decrypted);
            
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Error al descifrar: ' + error.message);
        }
    }
};

// Mostrar indicador de modo offline
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    if (!navigator.onLine) {
        showToast('Modo offline activado - Máxima seguridad', 'success');
        // Crear indicador visual
        const offlineBadge = document.createElement('div');
        offlineBadge.id = 'offline-badge';
        offlineBadge.innerHTML = '<i class="fas fa-wifi-slash"></i> Modo Offline';
        offlineBadge.style.position = 'fixed';
        offlineBadge.style.bottom = '20px';
        offlineBadge.style.left = '20px';
        offlineBadge.style.background = 'var(--accent-color)';
        offlineBadge.style.color = 'white';
        offlineBadge.style.padding = '8px 16px';
        offlineBadge.style.borderRadius = '20px';
        offlineBadge.style.zIndex = '10000';
        offlineBadge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        offlineBadge.style.fontWeight = '600';
        offlineBadge.style.display = 'flex';
        offlineBadge.style.alignItems = 'center';
        offlineBadge.style.gap = '8px';
        document.body.appendChild(offlineBadge);
    } else {
        const badge = document.getElementById('offline-badge');
        if (badge) badge.remove();
    }
}

// Comprobar estado inicial
updateOnlineStatus();

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    dom.passwordSection.style.display = 'block';
    
    // Modificamos el listener para usar la función de descifrado
    dom.encryptBtn.addEventListener('click', async () => {
        if (validateInputs()) {
            try {
                await encryptSeedPhrase();
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        }
    });
    
    // Nuevo listener para el botón de descifrado
    dom.decryptBtn.addEventListener('click', async () => {
        // Mostrar modal para contraseña
        dom.seedModal.style.display = 'flex';
        // Cambiar título para descifrado
        document.querySelector('.modal-title').textContent = "Descifrar Semilla";
        document.querySelector('.modal-subtitle').textContent = "Ingresa la contraseña para descifrar el código QR";
        
        // Ocultar el textarea de semilla
        dom.seedPhrase.style.display = 'none';
        dom.wordCounter.style.display = 'none';
        dom.toggleVisibility.style.display = 'none';
        document.querySelector('.word-hints').style.display = 'none';
        
        // Cambiar el listener del botón de cifrado para que ahora descifre
        const encryptBtn = document.getElementById('encrypt-btn');
        encryptBtn.textContent = "Descifrar";
        encryptBtn.removeEventListener('click', null);
        encryptBtn.addEventListener('click', async () => {
            try {
                await decryptQR();
                dom.seedModal.style.display = 'none';
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        });
    });
    
    // Mostrar modal de bienvenida al cargar
    dom.welcomeModal.style.display = 'flex';
});
