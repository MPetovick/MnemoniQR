// Compatible configuration
const CONFIG = {
    PBKDF2_ITERATIONS: 310000,
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    AES_KEY_LENGTH: 256,
    HMAC_KEY_LENGTH: 256,
    HMAC_LENGTH: 32,
    QR_SIZE: 220,
    MIN_PASSPHRASE_LENGTH: 12,
    QR_ERROR_CORRECTION: 'H',
    METADATA_VERSION: 1,
    METADATA_LENGTH: 128, // Aumentado para más datos
    MAX_MODIFICATION_COUNT: 255,
    MAX_FAILED_ATTEMPTS: 255
};

// DOM references
const dom = {
    startBtn: document.getElementById('start-btn'),
    scanBtn: document.getElementById('scan-btn'),
    seedModal: document.getElementById('seed-modal'),
    scannerModal: document.getElementById('scanner-modal'),
    closeModal: document.querySelector('.close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    seedPhrase: document.getElementById('seed-phrase'),
    wordCounter: document.getElementById('word-counter'),
    toggleVisibility: document.getElementById('toggle-visibility'),
    encryptBtn: document.getElementById('encrypt-btn'),
    password: document.getElementById('password'),
    passwordToggle: document.getElementById('password-toggle'),
    passwordStrengthBar: document.getElementById('password-strength-bar'),
    passwordStrengthText: document.getElementById('password-strength-text'),
    generatePassword: document.getElementById('generate-password'),
    qrContainer: document.getElementById('qr-container'),
    qrCanvas: document.getElementById('qr-canvas'),
    pdfBtn: document.getElementById('pdf-btn'),
    shareBtn: document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    toastContainer: document.getElementById('toast-container'),
    suggestionsContainer: document.getElementById('bip39-suggestions'),
    dropArea: document.getElementById('drop-area'),
    qrFile: document.getElementById('qr-file'),
    decryptBtn: document.getElementById('decrypt-btn'),
    decryptedModal: document.getElementById('decrypted-modal'),
    decryptedSeed: document.getElementById('decrypted-seed'),
    seedWordsContainer: document.getElementById('seed-words-container'),
    copySeed: document.getElementById('copy-seed'),
    closeDecrypted: document.getElementById('close-decrypted'),
    closeDecryptedBtn: document.getElementById('close-decrypted-btn'),
    wordCount: document.getElementById('word-count'),
    welcomeModal: document.getElementById('welcome-modal'),
    closeWelcome: document.getElementById('close-welcome'),
    acceptWelcome: document.getElementById('accept-welcome'),
    spinnerOverlay: document.getElementById('spinner-overlay'),
    passwordModal: document.getElementById('password-modal'),
    decryptPassword: document.getElementById('decrypt-password'),
    decryptPasswordToggle: document.getElementById('decrypt-password-toggle'),
    decryptSeedBtn: document.getElementById('decrypt-seed-btn'),
    cancelDecryptBtn: document.getElementById('cancel-decrypt-btn'),
    closePasswordModal: document.getElementById('close-password-modal'),
    qrModal: document.getElementById('qr-modal'),
    closeQRModal: document.getElementById('close-qr-modal'),
    cameraStream: document.getElementById('camera-stream'),
    closeScanner: document.getElementById('close-scanner'),
    stopScanBtn: document.getElementById('stop-scan-btn'),
    // Nuevos elementos para metadatos
    userMessage: document.getElementById('user-message'),
    messageChars: document.getElementById('message-chars'),
    metadataVersion: document.getElementById('metadata-version'),
    metadataCreated: document.getElementById('metadata-created'),
    metadataModifications: document.getElementById('metadata-modifications'),
    metadataFailedAttempts: document.getElementById('metadata-failed-attempts'),
    metadataLastAttempt: document.getElementById('metadata-last-attempt'),
    userMessageContainer: document.getElementById('user-message-container'),
    metadataUserMessage: document.getElementById('metadata-user-message'),
    updateQrBtn: document.getElementById('update-qr-btn'),
    metadataSection: document.querySelector('.metadata-section')
};

// App state
const appState = {
    wordsVisible: false,
    passwordVisible: false,
    seedPhrase: '',
    password: '',
    encryptedData: '',
    qrImageData: null,
    bip39Wordlist: null,
    currentWordIndex: -1,
    currentWordPartial: '',
    scannerActive: false,
    videoTrack: null,
    scanInterval: null,
    currentMetadata: null,
    failedAttempts: 0,
    lastFailedAttempt: null
};

// Check if running in Telegram
function isTelegram() {
    return window.Telegram && Telegram.WebApp && Telegram.WebApp.initData;
}

// Event Listeners
function initEventListeners() {
    dom.startBtn.addEventListener('click', showSeedModal);
    dom.scanBtn.addEventListener('click', openScannerModal);
    dom.closeModal.addEventListener('click', closeModal);
    dom.cancelBtn.addEventListener('click', closeModal);
    dom.seedPhrase.addEventListener('input', handleSeedInput);
    dom.toggleVisibility.addEventListener('click', toggleVisibility);
    dom.passwordToggle.addEventListener('click', togglePasswordVisibility);
    dom.password.addEventListener('input', updatePasswordStrength);
    dom.generatePassword.addEventListener('click', generateSecurePassword);
    dom.encryptBtn.addEventListener('click', startEncryption);
    dom.pdfBtn.addEventListener('click', generatePDF);
    dom.shareBtn.addEventListener('click', shareQR);
    dom.downloadBtn.addEventListener('click', downloadQRAsPNG);
    dom.dropArea.addEventListener('click', triggerFileSelect);
    dom.qrFile.addEventListener('change', handleFileSelect);
    dom.decryptBtn.addEventListener('click', showPasswordModal);
    dom.copySeed.addEventListener('click', copySeedToClipboard);
    dom.closeDecrypted.addEventListener('click', closeDecryptedModal);
    dom.closeDecryptedBtn.addEventListener('click', closeDecryptedModal);
    dom.closeWelcome.addEventListener('click', closeWelcomeModal);
    dom.acceptWelcome.addEventListener('click', closeWelcomeModal);
    dom.decryptSeedBtn.addEventListener('click', decryptQR);
    dom.cancelDecryptBtn.addEventListener('click', closePasswordModal);
    dom.closePasswordModal.addEventListener('click', closePasswordModal);
    dom.decryptPasswordToggle.addEventListener('click', toggleDecryptPasswordVisibility);
    dom.closeQRModal.addEventListener('click', closeQRModal);
    
    // Scanner events
    dom.closeScanner.addEventListener('click', closeScannerModal);
    dom.stopScanBtn.addEventListener('click', closeScannerModal);
    
    // Drag and drop
    dom.dropArea.addEventListener('dragover', handleDragOver);
    dom.dropArea.addEventListener('dragleave', handleDragLeave);
    dom.dropArea.addEventListener('drop', handleDrop);
    
    // Suggestions
    document.addEventListener('click', closeSuggestionsOutside);
    
    // Online/offline
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Nuevos listeners para metadatos
    if (dom.userMessage) {
        dom.userMessage.addEventListener('input', updateMessageCounter);
    }
    if (dom.updateQrBtn) {
        dom.updateQrBtn.addEventListener('click', showUpdateModal);
    }
}

// Modal functions
function showSeedModal() {
    dom.seedModal.style.display = 'flex';
    dom.seedPhrase.focus();
}

function closeModal() {
    dom.seedModal.style.display = 'none';
    resetModalState();
}

function resetModalState() {
    dom.seedPhrase.value = '';
    dom.password.value = '';
    if (dom.userMessage) dom.userMessage.value = '';
    if (dom.messageChars) dom.messageChars.textContent = '0';
    dom.wordCounter.textContent = '0 words';
    appState.wordsVisible = false;
    appState.passwordVisible = false;
    dom.seedPhrase.type = 'password';
    dom.password.type = 'password';
    dom.toggleVisibility.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordToggle.innerHTML = '<i class="fas fa-eye"></i>';
    dom.passwordStrengthBar.style.width = '0%';
    dom.passwordStrengthText.textContent = 'Security: Very weak';
    dom.encryptBtn.disabled = true;
    hideSuggestions();
}

// Scanner functions
function openScannerModal() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera not supported in this browser', 'error');
        return;
    }

    dom.scannerModal.style.display = 'flex';
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    })
    .then(stream => {
        appState.videoTrack = stream.getVideoTracks()[0];
        dom.cameraStream.srcObject = stream;
        appState.scannerActive = true;
        startScanningLoop();
        showToast('Camera activated - Point at QR code', 'success');
    })
    .catch(err => {
        console.error('Camera error:', err);
        showToast('Could not access camera: ' + err.message, 'error');
        closeScannerModal();
    });
}

function closeScannerModal() {
    if (appState.videoTrack) {
        appState.videoTrack.stop();
        appState.videoTrack = null;
    }
    if (appState.scanInterval) {
        clearInterval(appState.scanInterval);
        appState.scanInterval = null;
    }
    appState.scannerActive = false;
    dom.scannerModal.style.display = 'none';
    
    // Clear video stream
    if (dom.cameraStream.srcObject) {
        dom.cameraStream.srcObject = null;
    }
}

function startScanningLoop() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    appState.scanInterval = setInterval(() => {
        if (!appState.scannerActive) return;

        const video = dom.cameraStream;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
            handleScannedData(code.data);
        }
    }, 300); // ~3 scans per second
}

async function handleScannedData(encryptedBase64) {
    closeScannerModal();
    appState.qrImageData = null;
    appState.encryptedData = encryptedBase64;
    showToast('QR code scanned successfully', 'success');
    showPasswordModal();
}

function showPasswordModal() {
    if (!appState.encryptedData && !appState.qrImageData) {
        showToast('First load a QR code', 'error');
        return;
    }
    dom.passwordModal.style.display = 'flex';
    dom.decryptPassword.focus();
}

function closePasswordModal() {
    dom.passwordModal.style.display = 'none';
    dom.decryptPassword.value = '';
}

function closeDecryptedModal() {
    dom.decryptedModal.style.display = 'none';
    dom.decryptedSeed.value = '';
    appState.seedPhrase = '';
    appState.currentMetadata = null;
}

function closeWelcomeModal() {
    dom.welcomeModal.style.display = 'none';
}

function closeQRModal() {
    dom.qrModal.style.display = 'none';
    clearQRData();
}

function clearQRData() {
    // Clear canvas
    const ctx = dom.qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.qrCanvas.width, dom.qrCanvas.height);
    
    // Clear sensitive data
    appState.encryptedData = '';
    appState.password = '';
    appState.currentMetadata = null;
}

// Seed input handling
function handleSeedInput() {
    const words = dom.seedPhrase.value.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    dom.wordCounter.textContent = `${wordCount} words`;
    dom.encryptBtn.disabled = ![12, 18, 24].includes(wordCount);
    appState.seedPhrase = dom.seedPhrase.value;
    
    // Find current word
    const cursorPosition = dom.seedPhrase.selectionStart;
    const text = dom.seedPhrase.value;
    let charCount = 0;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = text.indexOf(word, charCount);
        const wordEnd = wordStart + word.length;
        
        if (cursorPosition >= wordStart && cursorPosition <= wordEnd) {
            appState.currentWordIndex = i;
            appState.currentWordPartial = word;
            
            if (word.length > 1) {
                showBIP39Suggestions(word);
            } else {
                hideSuggestions();
            }
            break;
        }
        charCount += word.length + 1;
    }
}

function toggleVisibility() {
    appState.wordsVisible = !appState.wordsVisible;
    dom.seedPhrase.type = appState.wordsVisible ? 'text' : 'password';
    dom.toggleVisibility.innerHTML = appState.wordsVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function togglePasswordVisibility() {
    appState.passwordVisible = !appState.passwordVisible;
    dom.password.type = appState.passwordVisible ? 'text' : 'password';
    dom.passwordToggle.innerHTML = appState.passwordVisible ? 
        '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function toggleDecryptPasswordVisibility() {
    const isVisible = dom.decryptPassword.type === 'text';
    dom.decryptPassword.type = isVisible ? 'password' : 'text';
    dom.decryptPasswordToggle.innerHTML = isVisible ? 
        '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
}

// Password strength
function updatePasswordStrength() {
    const strength = calculatePasswordStrength(dom.password.value);
    dom.passwordStrengthBar.style.width = `${strength}%`;
    updatePasswordStrengthText(strength);
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
    const levels = [
        {min: 0, text: 'Very weak'},
        {min: 20, text: 'Weak'},
        {min: 40, text: 'Moderate'},
        {min: 60, text: 'Strong'},
        {min: 80, text: 'Very strong'}
    ];
    
    const level = levels.reverse().find(l => strength >= l.min)?.text || 'Very weak';
    dom.passwordStrengthText.textContent = `Security: ${level}`;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let password = '';
    
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure complexity
    if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
    if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
    if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
    if (!/[^A-Za-z0-9]/.test(password)) password = password.slice(0, -1) + '!';
    
    dom.password.value = password;
    updatePasswordStrength();
    showToast('Secure password generated', 'success');
}

// BIP39 suggestions
function showBIP39Suggestions(partialWord) {
    if (!appState.bip39Wordlist || partialWord.length < 2) {
        hideSuggestions();
        return;
    }
    
    const lowerPartial = partialWord.toLowerCase();
    const suggestions = appState.bip39Wordlist
        .filter(word => word.toLowerCase().startsWith(lowerPartial))
        .slice(0, 5);
    
    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }
    
    dom.suggestionsContainer.innerHTML = '';
    suggestions.forEach(word => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<i class="fas fa-lightbulb"></i> ${word}`;
        item.addEventListener('click', () => selectSuggestion(word));
        dom.suggestionsContainer.appendChild(item);
    });
    
    dom.suggestionsContainer.style.display = 'block';
}

function hideSuggestions() {
    dom.suggestionsContainer.style.display = 'none';
}

function selectSuggestion(word) {
    const words = dom.seedPhrase.value.trim().split(/\s+/);
    if (appState.currentWordIndex >= 0 && appState.currentWordIndex < words.length) {
        words[appState.currentWordIndex] = word;
        dom.seedPhrase.value = words.join(' ');
        const event = new Event('input', { bubbles: true });
        dom.seedPhrase.dispatchEvent(event);
    }
    hideSuggestions();
}

function closeSuggestionsOutside(e) {
    if (!dom.seedPhrase.contains(e.target) && !dom.suggestionsContainer.contains(e.target)) {
        hideSuggestions();
    }
}

// Message counter for metadata
function updateMessageCounter() {
    const length = dom.userMessage.value.length;
    dom.messageChars.textContent = length;
    
    if (length > 200) {
        dom.messageChars.style.color = 'var(--warning-color)';
    } else if (length > 100) {
        dom.messageChars.style.color = 'var(--accent-color)';
    } else {
        dom.messageChars.style.color = '#666';
    }
}

// Encryption with metadata
async function startEncryption() {
    if (!validateInputs()) return;
    
    try {
        showSpinner(true);
        
        // Mostrar progreso de HMAC
        showToast('Generando claves derivadas...', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        showToast('Calculando HMAC para integridad...', 'info');
        
        const words = appState.seedPhrase.trim().split(/\s+/);
        if (![12, 18, 24].includes(words.length)) {
            throw new Error('Seed phrase must contain 12, 18 or 24 words');
        }
        
        const seedData = words.join(' ');
        const userMessage = dom.userMessage ? dom.userMessage.value : '';
        const encrypted = await cryptoUtils.encryptMessage(seedData, appState.password, userMessage);
        appState.encryptedData = encrypted;
        
        // Mostrar confirmación de HMAC
        showToast('✓ HMAC generado - Integridad verificada', 'success');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await generateQR(encrypted);
        
        closeModal();
        dom.qrModal.style.display = 'flex';
        showToast('Seed cifrado con verificación HMAC', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showSpinner(false);
    }
}

function validateInputs() {
    const words = appState.seedPhrase.trim().split(/\s+/);
    
    if (![12, 18, 24].includes(words.length)) {
        showToast('Seed phrase must contain 12, 18 or 24 words', 'error');
        return false;
    }
    
    if (appState.bip39Wordlist) {
        const invalidWords = words.filter(word => !appState.bip39Wordlist.includes(word));
        if (invalidWords.length > 0) {
            showToast(`Invalid words: ${invalidWords.slice(0, 5).join(', ')}${invalidWords.length > 5 ? '...' : ''}`, 'error');
            return false;
        }
    }
    
    if (dom.password.value.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
        showToast(`Password must be at least ${CONFIG.MIN_PASSPHRASE_LENGTH} characters`, 'error');
        return false;
    }
    
    const strength = calculatePasswordStrength(dom.password.value);
    if (strength < 40) {
        showToast('Password is too weak. Please use a stronger one.', 'warning');
        return false;
    }
    
    appState.password = dom.password.value;
    return true;
}

async function generateQR(data) {
    return new Promise((resolve) => {
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
                if (error) console.error('QR generation error:', error);
                resolve();
            }
        );
    });
}

// QR export functions
function generatePDF() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a5'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        
        // Background
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
        
        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('Secure Seed Backup', centerX, 25, null, null, 'center');
        
        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text('Encrypted with AES-256-GCM + HMAC-SHA256', centerX, 32, null, null, 'center');
        
        // QR code with border
        const qrSize = 80;
        const qrDataUrl = dom.qrCanvas.toDataURL('image/png');
        const qrX = centerX - (qrSize / 2);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(qrX - 10, 40, qrSize + 20, qrSize + 30, 3, 3, 'S');
        doc.addImage(qrDataUrl, 'PNG', qrX, 50, qrSize, qrSize);
        
        // Security note
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Store this securely. Password required for decryption.', 
                centerX, 50 + qrSize + 20, null, null, 'center');
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by MnemoniQR • ${new Date().toLocaleDateString()}`, 
                centerX, doc.internal.pageSize.getHeight() - 10, null, null, 'center');
        
        doc.save(`mnemoniqr-backup-${Date.now()}.pdf`);
        showToast('PDF generated successfully', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Error generating PDF', 'error');
    }
}

async function shareQR() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        // Convert canvas to blob
        dom.qrCanvas.toBlob(async blob => {
            if (isTelegram()) {
                // In Telegram: use downloadFile method
                const file = new File([blob], `mnemoniqr-${Date.now()}.png`, {
                    type: 'image/png'
                });
                Telegram.WebApp.downloadFile(file);
                showToast('QR saved. You can now share it.', 'success');
            } else {
                // In browsers: use Web Share API or clipboard
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Secure Seed Backup',
                            files: [new File([blob], 'seed-backup.png', { type: 'image/png' })]
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            throw err;
                        }
                    }
                } else {
                    // Fallback: copy to clipboard
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast('QR copied to clipboard', 'success');
                }
            }
        });
    } catch (error) {
        console.error('Sharing error:', error);
        showToast('Error sharing QR: ' + error.message, 'error');
    }
}

function downloadQRAsPNG() {
    if (!appState.encryptedData) {
        showToast('First generate a QR code', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = `mnemoniqr-${Date.now()}.png`;
        link.href = dom.qrCanvas.toDataURL('image/png');
        link.click();
        showToast('QR downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Error downloading QR', 'error');
    }
}

// Decryption functions
function triggerFileSelect() {
    dom.qrFile.click();
}

function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dom.dropArea.classList.add('drag-over');
}

function handleDragLeave() {
    dom.dropArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dom.dropArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
}

function handleFile(file) {
    if (!file.type.match('image.*')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        // Reset drop area appearance
        dom.dropArea.classList.remove('drag-over');
        appState.qrImageData = e.target.result;
        
        // Reset file input
        dom.qrFile.value = '';
        
        // Show password modal directly
        showToast('QR code loaded. Enter password to decrypt.', 'success');
        showPasswordModal();
    };
    reader.readAsDataURL(file);
}

async function decryptQR() {
    try {
        if (!appState.encryptedData && !appState.qrImageData) {
            throw new Error('First load a QR code');
        }

        let encryptedData = appState.encryptedData;
        
        // If we have image data but no encrypted data, scan the image
        if (appState.qrImageData && !encryptedData) {
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
                throw new Error('Could not read QR code');
            }
            encryptedData = code.data;
        }
        
        const password = dom.decryptPassword.value;
        if (!password) {
            throw new Error('Password is required');
        }
        
        showSpinner(true);
        
        // Mostrar progreso de verificación HMAC
        showToast('Verificando integridad HMAC...', 'info');
        
        const decryptedResult = await cryptoUtils.decryptMessage(encryptedData, password);
        
        // Éxito - HMAC verificado
        showToast('✓ HMAC verificado - Datos íntegros y auténticos', 'success');
        
        // Si hay intentos fallidos previos, actualizar el QR
        if (appState.failedAttempts > 0) {
            showToast(`Actualizando QR después de ${appState.failedAttempts} intentos fallidos`, 'warning');
            await updateQRAfterFailedAttempts(decryptedResult.seed, decryptedResult.metadata);
        } else {
            showDecryptedSeed(decryptedResult.seed, decryptedResult.metadata);
        }
        
        closePasswordModal();
        
    } catch (error) {
        if (error.message.includes('HMAC')) {
            appState.failedAttempts++;
            appState.lastFailedAttempt = new Date();
            showToast(`❌ Error HMAC: Contraseña incorrecta (Intento ${appState.failedAttempts})`, 'error');
            
            // Guardar datos para posible actualización futura
            if (!appState.encryptedData && appState.qrImageData) {
                // Si tenemos imagen pero no datos cifrados, guardar los datos
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
                
                if (code) {
                    appState.encryptedData = code.data;
                }
            }
        } else {
            showToast(`Error: ${error.message}`, 'error');
        }
    } finally {
        showSpinner(false);
    }
}

async function updateQRAfterFailedAttempts(seedPhrase, originalMetadata) {
    try {
        showSpinner(true);
        showToast('Actualizando QR con nuevo contador de intentos...', 'info');
        
        // Crear nuevos metadatos con el contador de intentos fallidos
        const newMetadata = {
            ...originalMetadata,
            modificationCount: originalMetadata.modificationCount + 1,
            failedAttempts: appState.failedAttempts,
            lastFailedAttempt: appState.lastFailedAttempt,
            userMessage: originalMetadata.userMessage // Mantener el mensaje original
        };
        
        // Recifrar con nuevos metadatos
        const encrypted = await cryptoUtils.encryptMessageWithMetadata(
            seedPhrase, 
            appState.password, 
            newMetadata
        );
        
        appState.encryptedData = encrypted;
        appState.failedAttempts = 0; // Resetear contador
        
        // Regenerar QR
        await generateQR(encrypted);
        
        showDecryptedSeed(seedPhrase, newMetadata);
        showToast(`QR actualizado exitosamente (Modificación #${newMetadata.modificationCount})`, 'success');
        
    } catch (error) {
        console.error('Error updating QR:', error);
        showToast('Error actualizando QR, mostrando datos originales', 'warning');
        showDecryptedSeed(seedPhrase, originalMetadata);
    } finally {
        showSpinner(false);
    }
}

function showDecryptedSeed(seedPhrase, metadata) {
    const words = seedPhrase.split(' ');
    const wordCount = words.length;
    
    dom.decryptedSeed.value = seedPhrase;
    dom.wordCount.textContent = `${wordCount} words`;
    
    dom.seedWordsContainer.innerHTML = '';
    words.forEach((word, index) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'seed-word';
        wordEl.textContent = word;
        wordEl.setAttribute('data-index', index + 1);
        dom.seedWordsContainer.appendChild(wordEl);
    });
    
    // Mostrar metadatos
    if (metadata) {
        showMetadataInDecrypted(metadata);
        appState.currentMetadata = metadata;
    }
    
    // Mostrar botón de actualización si hay intentos fallidos
    if (appState.failedAttempts > 0) {
        dom.updateQrBtn.style.display = 'inline-flex';
        dom.updateQrBtn.innerHTML = `<i class="fas fa-sync-alt"></i> Update QR (${appState.failedAttempts} failed attempts)`;
    } else {
        dom.updateQrBtn.style.display = 'none';
    }
    
    dom.decryptedModal.style.display = 'flex';
}

function showMetadataInDecrypted(metadata) {
    if (!dom.metadataVersion) return;
    
    dom.metadataVersion.textContent = metadata.version;
    dom.metadataCreated.textContent = metadata.timestamp.toLocaleString();
    dom.metadataModifications.textContent = metadata.modificationCount;
    
    // Mostrar intentos fallidos si existen
    if (metadata.failedAttempts > 0) {
        dom.metadataFailedAttempts.textContent = metadata.failedAttempts;
        dom.metadataFailedAttempts.parentElement.style.display = 'flex';
        
        if (metadata.lastFailedAttempt) {
            const lastAttempt = new Date(metadata.lastFailedAttempt);
            dom.metadataLastAttempt.textContent = lastAttempt.toLocaleString();
            dom.metadataLastAttempt.parentElement.style.display = 'flex';
        }
    } else {
        dom.metadataFailedAttempts.parentElement.style.display = 'none';
        dom.metadataLastAttempt.parentElement.style.display = 'none';
    }
    
    // Mostrar mensaje de usuario si existe
    if (metadata.userMessage && metadata.userMessage.length > 0) {
        dom.userMessageContainer.style.display = 'flex';
        dom.metadataUserMessage.textContent = metadata.userMessage;
    } else {
        dom.userMessageContainer.style.display = 'none';
    }
    
    // Mostrar advertencia si hay muchas modificaciones
    const existingWarning = dom.metadataSection.querySelector('.high-modification-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    if (metadata.modificationCount > 10) {
        const warning = document.createElement('div');
        warning.className = 'high-modification-warning';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>High modification count:</strong> This QR has been updated 
            ${metadata.modificationCount} times. Consider creating a new one for maximum security.
        `;
        dom.metadataSection.appendChild(warning);
    }
    
    // Mostrar advertencia si hay muchos intentos fallidos
    if (metadata.failedAttempts > 5) {
        const warning = document.createElement('div');
        warning.className = 'high-modification-warning';
        warning.style.background = 'rgba(231, 76, 60, 0.1)';
        warning.style.borderLeftColor = 'var(--error-color)';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Security Alert:</strong> ${metadata.failedAttempts} failed decryption attempts detected. 
            Ensure you are in a secure environment.
        `;
        dom.metadataSection.appendChild(warning);
    }
}

function copySeedToClipboard() {
    dom.decryptedSeed.select();
    document.execCommand('copy');
    showToast('Seed copied to clipboard', 'success');
}

// Update QR function
async function updateEncryptedQR(newSeedPhrase, newUserMessage = "") {
    if (!appState.encryptedData) {
        throw new Error('No encrypted data available');
    }
    
    try {
        showSpinner(true);
        
        // Descifrar datos existentes
        const decryptedResult = await cryptoUtils.decryptMessage(
            appState.encryptedData, 
            appState.password
        );
        
        // Crear nuevos metadatos incrementando el contador
        const currentMetadata = decryptedResult.metadata;
        const newMetadata = {
            ...currentMetadata,
            modificationCount: Math.min(
                currentMetadata.modificationCount + 1, 
                CONFIG.MAX_MODIFICATION_COUNT
            ),
            userMessage: newUserMessage,
            userMessageLength: Math.min(newUserMessage.length, 255),
            failedAttempts: 0, // Resetear intentos fallidos al actualizar manualmente
            lastFailedAttempt: null
        };
        
        // Recifrar con nuevos metadatos
        const encrypted = await cryptoUtils.encryptMessageWithMetadata(
            newSeedPhrase, 
            appState.password, 
            newMetadata
        );
        
        appState.encryptedData = encrypted;
        
        // Regenerar QR
        await generateQR(encrypted);
        
        showToast(`QR updated successfully (Modification #${newMetadata.modificationCount})`, 'success');
        return true;
        
    } catch (error) {
        showToast(`Update failed: ${error.message}`, 'error');
        throw error;
    } finally {
        showSpinner(false);
    }
}

function showUpdateModal() {
    // Implementar modal de actualización si es necesario
    showToast('Update functionality coming soon', 'info');
}

// Crypto utilities with enhanced metadata support
const cryptoUtils = {
    async encryptMessage(message, passphrase, userMessage = "") {
        if (!message || !passphrase) {
            throw new Error('Message and password are required');
        }
        
        if (passphrase.length < CONFIG.MIN_PASSPHRASE_LENGTH) {
            throw new Error(`Password must be at least ${CONFIG.MIN_PASSPHRASE_LENGTH} characters`);
        }
        
        // Crear metadatos
        const metadata = this.createMetadata(userMessage);
        
        const dataToEncrypt = new TextEncoder().encode(message);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        
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
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            dataToEncrypt
        );
        
        const ciphertext = new Uint8Array(encrypted);
        
        // Generar HMAC y mostrar información
        const hmac = await crypto.subtle.sign('HMAC', hmacKey, ciphertext);
        const hmacArray = new Uint8Array(hmac);
        
        console.log('HMAC generated:', {
            length: hmacArray.length,
            firstBytes: Array.from(hmacArray.slice(0, 4)),
            purpose: 'Data integrity and authentication'
        });
        
        // Combinar: metadatos + salt + iv + ciphertext + hmac
        const combined = new Uint8Array([
            ...this.serializeMetadata(metadata),
            ...salt,
            ...iv,
            ...ciphertext,
            ...hmacArray
        ]);
        
        return btoa(String.fromCharCode(...combined));
    },
    
    async encryptMessageWithMetadata(message, passphrase, metadata) {
        const dataToEncrypt = new TextEncoder().encode(message);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        
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
        
        const aesKey = await crypto.subtle.importKey(
            'raw',
            aesKeyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );
        
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            hmacKeyBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            dataToEncrypt
        );
        
        const ciphertext = new Uint8Array(encrypted);
        const hmac = await crypto.subtle.sign('HMAC', hmacKey, ciphertext);
        
        const combined = new Uint8Array([
            ...this.serializeMetadata(metadata),
            ...salt,
            ...iv,
            ...ciphertext,
            ...new Uint8Array(hmac)
        ]);
        
        return btoa(String.fromCharCode(...combined));
    },
    
    async decryptMessage(encryptedBase64, passphrase) {
        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        // Extraer metadatos
        const metadataBytes = encryptedData.slice(0, CONFIG.METADATA_LENGTH);
        const metadata = this.deserializeMetadata(metadataBytes);
        
        if (!metadata.isValid) {
            throw new Error('Invalid metadata format - possibly corrupted file');
        }
        
        // Extraer resto de componentes
        const dataOffset = CONFIG.METADATA_LENGTH;
        const salt = encryptedData.slice(dataOffset, dataOffset + CONFIG.SALT_LENGTH);
        const iv = encryptedData.slice(
            dataOffset + CONFIG.SALT_LENGTH, 
            dataOffset + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH
        );
        const ciphertext = encryptedData.slice(
            dataOffset + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH, 
            encryptedData.length - CONFIG.HMAC_LENGTH
        );
        const hmac = encryptedData.slice(encryptedData.length - CONFIG.HMAC_LENGTH);
        
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
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // VERIFICACIÓN HMAC - PUNTO CRÍTICO
        const hmacValid = await crypto.subtle.verify(
            'HMAC',
            hmacKey,
            hmac,
            ciphertext
        );
        
        if (!hmacValid) {
            console.error('HMAC verification failed:', {
                expected: Array.from(hmac.slice(0, 4)),
                dataLength: ciphertext.length,
                possibleCauses: ['Wrong password', 'Data corruption', 'Malicious tampering']
            });
            throw new Error('HMAC mismatch. Wrong password or corrupted file.');
        }
        
        console.log('HMAC verification successful - Data integrity confirmed');
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            aesKey,
            ciphertext
        );
        
        return {
            seed: new TextDecoder().decode(decrypted),
            metadata: metadata
        };
    },

    // Métodos para manejar metadatos
    createMetadata(userMessage = "") {
        const now = new Date();
        
        return {
            version: CONFIG.METADATA_VERSION,
            modificationCount: 0, // Siempre 0 en creación
            timestamp: now,
            userMessageLength: Math.min(userMessage.length, 255),
            userMessage: userMessage.slice(0, 255), // Máximo 255 caracteres
            failedAttempts: 0,
            lastFailedAttempt: null,
            isValid: true
        };
    },

    serializeMetadata(metadata) {
        const buffer = new ArrayBuffer(CONFIG.METADATA_LENGTH);
        const view = new DataView(buffer);
        
        let offset = 0;
        view.setUint8(offset++, metadata.version);
        view.setUint8(offset++, metadata.modificationCount);
        view.setUint32(offset, Math.floor(metadata.timestamp.getTime() / 1000), false); // big-endian
        offset += 4;
        view.setUint8(offset++, metadata.userMessageLength);
        
        // Escribir userMessage si existe
        if (metadata.userMessageLength > 0) {
            const encoder = new TextEncoder();
            const messageBytes = encoder.encode(metadata.userMessage);
            for (let i = 0; i < metadata.userMessageLength; i++) {
                view.setUint8(offset++, messageBytes[i]);
            }
        }
        
        // Escribir intentos fallidos
        view.setUint8(offset++, metadata.failedAttempts || 0);
        
        // Escribir último intento fallido si existe
        if (metadata.lastFailedAttempt) {
            view.setUint32(offset, Math.floor(metadata.lastFailedAttempt.getTime() / 1000), false);
        } else {
            view.setUint32(offset, 0, false);
        }
        offset += 4;
        
        // Rellenar con zeros
        while (offset < CONFIG.METADATA_LENGTH) {
            view.setUint8(offset++, 0);
        }
        
        return new Uint8Array(buffer);
    },

    deserializeMetadata(data) {
        const view = new DataView(data.buffer);
        
        let offset = 0;
        const version = view.getUint8(offset++);
        const modificationCount = view.getUint8(offset++);
        const timestamp = new Date(view.getUint32(offset, false) * 1000);
        offset += 4;
        const userMessageLength = view.getUint8(offset++);
        
        // Leer userMessage
        let userMessage = "";
        if (userMessageLength > 0) {
            const messageBytes = new Uint8Array(data.buffer, offset, userMessageLength);
            const decoder = new TextDecoder();
            userMessage = decoder.decode(messageBytes);
            offset += userMessageLength;
        }
        
        // Leer intentos fallidos
        const failedAttempts = view.getUint8(offset++);
        
        // Leer último intento fallido
        const lastFailedAttemptTimestamp = view.getUint32(offset, false);
        offset += 4;
        const lastFailedAttempt = lastFailedAttemptTimestamp > 0 ? 
            new Date(lastFailedAttemptTimestamp * 1000) : null;
        
        return {
            version,
            modificationCount,
            timestamp,
            userMessageLength,
            userMessage,
            failedAttempts,
            lastFailedAttempt,
            isValid: version <= CONFIG.METADATA_VERSION
        };
    }
};

// UI utilities
function showToast(message, type = 'info') {
    const icons = {
        error: 'fa-exclamation-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showSpinner(show) {
    dom.spinnerOverlay.style.display = show ? 'flex' : 'none';
}

// Offline mode indicator
function updateOnlineStatus() {
    if (!navigator.onLine) {
        if (!document.getElementById('offline-badge')) {
            const badge = document.createElement('div');
            badge.id = 'offline-badge';
            badge.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline Mode';
            badge.style.position = 'fixed';
            badge.style.bottom = '15px';
            badge.style.left = '15px';
            badge.style.background = 'var(--accent-color)';
            badge.style.color = 'white';
            badge.style.padding = '6px 12px';
            badge.style.borderRadius = '20px';
            badge.style.zIndex = '10000';
            badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            badge.style.fontWeight = '600';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '6px';
            badge.style.fontSize = '0.9rem';
            document.body.appendChild(badge);
        }
        showToast('Offline mode activated - Maximum security', 'success');
    } else {
        const badge = document.getElementById('offline-badge');
        if (badge) badge.remove();
    }
}

// Load BIP39 wordlist
async function loadBIP39Wordlist() {
    const STORAGE_KEY = 'bip39-wordlist';
    try {
        const cachedWordlist = localStorage.getItem(STORAGE_KEY);
        if (cachedWordlist) {
            appState.bip39Wordlist = JSON.parse(cachedWordlist);
            return;
        }

        const response = await fetch('https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt');
        if (!response.ok) throw new Error('Failed to fetch wordlist');
        const text = await response.text();
        const wordlist = text.split('\n').map(word => word.trim()).filter(word => word);
        appState.bip39Wordlist = wordlist;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wordlist));
    } catch (error) {
        console.error('Error loading BIP39 wordlist:', error);
        showToast('Warning: BIP39 validation not available', 'warning');
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadBIP39Wordlist();
    updateOnlineStatus();
    dom.welcomeModal.style.display = 'flex';
});
