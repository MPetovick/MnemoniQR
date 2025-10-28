# MnemoniQR - Secure Seed Encryption

## Overview

MnemoniQR is a **100% client-side, offline-capable** web application that provides military-grade encryption for cryptocurrency seed phrases using AES-256-GCM encryption. Convert your sensitive recovery phrases into secure QR codes that can only be decrypted with your password.

## 🔒 Security Features

### Core Security Principles
- **Zero Data Transmission**: All encryption/decryption occurs locally in your browser
- **AES-256-GCM Encryption**: Industry-standard military-grade encryption
- **PBKDF2 Key Derivation**: 310,000 iterations for brute-force protection
- **HMAC Integrity Verification**: Ensures encrypted data hasn't been tampered with
- **Offline-First Design**: Operates completely without internet connection

### Technical Specifications
- **Encryption Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 310,000 iterations
- **Salt Length**: 32 bytes
- **IV Length**: 16 bytes
- **HMAC**: SHA-256, 32 bytes
- **QR Error Correction**: Level H (30% recovery capability)

## 🚀 Key Features

### Encryption
- Support for 12, 18, and 24-word BIP-39 seed phrases
- Real-time BIP-39 word validation and auto-suggestions
- Password strength analysis with visual feedback
- Secure password generator
- Multiple export formats (PNG, PDF, share)

### Decryption
- QR code scanning via camera
- Drag & drop image upload
- HUSHBOX compatibility for cross-platform decryption
- Local image processing (no server upload)

### User Experience
- Progressive Web App (PWA) - installable on devices
- Mobile-optimized responsive design
- Telegram Web App integration
- Offline functionality
- Dark/light theme support

## 🛠️ Technical Architecture

### Frontend Stack
- **HTML5** with PWA manifest
- **CSS3** with CSS variables and responsive design
- **Vanilla JavaScript** with modern ES6+ features
- **Web Crypto API** for cryptographic operations

### External Libraries
- **QRCode.js** for QR generation
- **jsQR** for QR decoding
- **jsPDF** for PDF export
- **Font Awesome** for icons
- **Telegram Web App SDK** for native integration

### Browser APIs Used
- Web Crypto API (encryption/decryption)
- Canvas API (QR rendering)
- MediaDevices API (camera access)
- File API (drag & drop)
- Clipboard API (copy functionality)
- Service Worker (offline caching)

## 📖 How to Use

### Encryption Process
1. **Input Seed Phrase**
   - Enter 12, 18, or 24-word BIP-39 compliant seed phrase
   - Real-time word count and validation
   - BIP-39 dictionary suggestions

2. **Set Encryption Password**
   - Minimum 12 characters
   - Visual password strength indicator
   - Optional secure password generation

3. **Generate & Export**
   - QR code generation with HUSHBOX compatibility
   - Export options: PNG, PDF, share
   - Security watermark and metadata

### Decryption Process
1. **Load Encrypted QR**
   - Camera scanning with automatic detection
   - Drag & drop image upload
   - File selector option

2. **Enter Password**
   - Secure password input
   - HMAC verification for tamper detection

3. **View Decrypted Seed**
   - Formatted word display with numbering
   - Copy to clipboard functionality
   - Visual confirmation

## 🔧 Installation & Deployment

### Web Deployment
```bash
# Clone or download the project files
# Serve via any web server
python3 -m http.server 8000
# or
npx serve .
```

### Offline Usage (Recommended for Security)
1. Load application while online
2. Disconnect from internet
3. Reload page (Ctrl + F5) to load from cache
4. Use application in complete isolation

### PWA Installation
- **Chrome/Edge**: Click "Install App" when prompted
- **Safari**: Use "Add to Home Screen"
- **Firefox**: Use "Install Site as App"

## 🎯 Use Cases

### Primary Use Cases
- **Secure Seed Backup**: Convert seeds to encrypted QR for physical storage
- **Multi-location Storage**: Distribute encrypted backups geographically
- **Inheritance Planning**: Create password-protected recovery options
- **Cold Storage Enhancement**: Add encryption layer to paper wallets

### Security Scenarios
- **Travel Security**: Carry encrypted QR without exposing seeds
- **Multi-signature Setup**: Distribute encrypted shares
- **Disaster Recovery**: Weather/fire-proof encrypted backups

## 🔐 Security Best Practices

### Password Management
- Use password managers for encryption passwords
- Never reuse passwords across different seeds
- Consider password splitting (Shamir's Secret Sharing)
- Store passwords separately from encrypted QRs

### Storage Recommendations
- Print QR codes on durable materials
- Use multiple storage locations
- Consider fire-proof/water-proof containers
- Regular integrity checks of backups

### Operational Security
- Perform encryption on trusted, malware-free devices
- Use offline mode for maximum security
- Verify decryption capability periodically
- Destroy temporary files/cache after use

## 🌐 Compatibility

### Supported Standards
- **BIP-39**: Seed phrase standard compliance
- **Web Crypto API**: Modern browser requirement
- **PWA Standards**: Installable web app
- **HUSHBOX**: Cross-compatible encrypted QR format

### Browser Requirements
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

### Mobile Support
- iOS 11.3+ (with camera access)
- Android 7+ (with modern WebView)
- Progressive Web App capabilities

## 🚨 Limitations & Considerations

### Technical Limitations
- Requires modern browser with Web Crypto support
- Camera access needed for QR scanning
- JavaScript must be enabled
- Large seed phrases may impact performance

### Security Considerations
- Device security is paramount (malware-free environment)
- Password strength directly impacts security
- Physical security of encrypted QR codes
- Regular backup verification recommended

## 📊 Performance

### Encryption Performance
- Typical encryption time: 1-3 seconds
- Memory usage: < 50MB
- QR generation: < 1 second

### Browser Support Matrix
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| AES-256-GCM | ✅ | ✅ | ✅ | ✅ |
| Camera API | ✅ | ✅ | ✅ | ✅ |
| PWA | ✅ | ✅ | ✅ | ✅ |
| Offline | ✅ | ✅ | ✅ | ✅ |

## 🔄 Development

### Project Structure
```
mnemoniqr/
├── index.html          # Main application
├── manifest.json       # PWA configuration
├── styles.css          # Styling and responsive design
├── script.js           # Application logic
└── assets/            # Icons and images
```

### Code Quality
- Vanilla JavaScript (no frameworks)
- Modular architecture
- Comprehensive error handling
- Accessibility considerations
- Mobile-first responsive design

## 📄 License

**MnemoniQR** - Secure Seed Encryption  
Copyright © 2025 - Client-Side & Offline

This is a security-focused application designed to protect cryptocurrency assets. Use responsibly and always verify your backups.

---

**⚠️ Disclaimer**: Always test with small amounts before entrusting significant assets to any backup system. The developers are not responsible for lost funds due to improper usage or technical failures.
