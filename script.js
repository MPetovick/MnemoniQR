// ============================================================
// MnemoniQR - Script Principal (CORREGIDO - VERSION FINAL)
// ============================================================

// ============ CONFIGURATION ============
const CONFIG = {
    PBKDF2_ITERATIONS: 310000,
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    AES_KEY_LENGTH: 256,
    QR_SIZE: 280,
    MIN_PASSWORD_LENGTH: 12,
    DECRYPTION_DELAY: 1200,
    MAX_SUGGESTIONS: 5,
    AUTO_HIDE_SECONDS: 60,
    MAX_DECRYPT_ATTEMPTS: 5,
    BIP39_CACHE_MAX_SIZE: 100,
    TOAST_PERSISTENT_ERRORS: true
};

// ============ BIP39 WORD LIST ============
const BIP39_WORDS = [
    "abandon","ability","able","about","above","absent","absorb","abstract","absurd","abuse",
    "access","accident","account","accuse","achieve","acid","acoustic","acquire","across","act",
    "action","actor","actress","actual","adapt","add","addict","address","adjust","admit",
    "adult","advance","advice","aerobic","affair","afford","afraid","again","age","agent",
    "agree","ahead","aim","air","airport","aisle","alarm","album","alcohol","alert",
    "alien","all","alley","allow","almost","alone","alpha","already","also","alter",
    "always","amateur","amazing","among","amount","amused","analyst","anchor","ancient","anger",
    "angle","angry","animal","ankle","announce","annual","another","answer","antenna","antique",
    "anxiety","any","apart","apology","appear","apple","approve","april","arch","arctic",
    "area","arena","argue","arm","armed","armor","army","around","arrange","arrest",
    "arrive","arrow","art","artefact","artist","artwork","ask","aspect","assault","asset",
    "assist","assume","asthma","athlete","atom","attack","attend","attitude","attract","auction",
    "audit","august","aunt","author","auto","autumn","average","avocado","avoid","awake",
    "aware","away","awesome","awful","awkward","axis","baby","bachelor","bacon","badge",
    "bag","balance","balcony","ball","bamboo","banana","banner","bar","barely","bargain",
    "barrel","base","basic","basket","battle","beach","bean","beauty","because","become",
    "beef","before","begin","behave","behind","believe","below","belt","bench","benefit",
    "best","betray","better","between","beyond","bicycle","bid","bike","bind","biology",
    "bird","birth","bitter","black","blade","blame","blanket","blast","bleak","bless",
    "blind","blood","blossom","blouse","blue","blur","blush","board","boat","body",
    "boil","bomb","bone","bonus","book","boost","border","boring","borrow","boss",
    "bottom","bounce","box","boy","bracket","brain","brand","brass","brave","bread",
    "breeze","brick","bridge","brief","bright","bring","brisk","broccoli","broken","bronze",
    "broom","brother","brown","brush","bubble","buddy","budget","buffalo","build","bulb",
    "bulk","bullet","bundle","bunker","burden","burger","burst","bus","business","busy",
    "butter","buyer","buzz","cabbage","cabin","cable","cactus","cage","cake","call",
    "calm","camera","camp","can","canal","cancel","candy","cannon","canoe","canvas",
    "canyon","capable","capital","captain","car","carbon","card","cargo","carpet","carry",
    "cart","case","cash","casino","castle","casual","cat","catalog","catch","category",
    "cattle","caught","cause","caution","cave","ceiling","celery","cement","census","century",
    "cereal","certain","chair","chalk","champion","change","chaos","chapter","charge","chase",
    "chat","cheap","check","cheese","chef","cherry","chest","chicken","chief","child",
    "chimney","choice","choose","chronic","chuckle","chunk","churn","cigar","cinnamon","circle",
    "citizen","city","civil","claim","clap","clarify","claw","clay","clean","clerk",
    "clever","click","client","cliff","climb","clinic","clip","clock","clog","close",
    "cloth","cloud","clown","club","clump","cluster","clutch","coach","coast","coconut",
    "code","coffee","coil","coin","collect","color","column","combine","come","comfort",
    "comic","common","company","concert","conduct","confirm","congress","connect","consider","control",
    "convince","cook","cool","copper","copy","coral","core","corn","correct","cost",
    "cotton","couch","country","couple","course","cousin","cover","coyote","crack","cradle",
    "craft","cram","crane","crash","crater","crawl","crazy","cream","credit","creek",
    "crew","cricket","crime","crisp","critic","crop","cross","crouch","crowd","crucial",
    "cruel","cruise","crumble","crunch","crush","cry","crystal","cube","culture","cup",
    "cupboard","curious","current","curtain","curve","cushion","custom","cute","cycle","dad",
    "damage","damp","dance","danger","daring","dash","daughter","dawn","day","deal",
    "debate","debris","decade","december","decide","decline","decorate","decrease","deer","defense",
    "define","defy","degree","delay","deliver","demand","demise","denial","dentist","deny",
    "depart","depend","deposit","depth","deputy","derive","describe","desert","design","desk",
    "despair","destroy","detail","detect","develop","device","devote","diagram","dial","diamond",
    "diary","dice","diesel","diet","differ","digital","dignity","dilemma","dinner","dinosaur",
    "direct","dirt","disagree","discover","disease","dish","dismiss","disorder","display","distance",
    "divert","divide","divorce","dizzy","doctor","document","dog","doll","dolphin","domain",
    "donate","donkey","donor","door","dose","double","dove","draft","dragon","drama",
    "drastic","draw","dream","dress","drift","drill","drink","drip","drive","drop",
    "drum","dry","duck","dumb","dune","during","dust","dutch","duty","dwarf",
    "dynamic","eager","eagle","early","earn","earth","easily","east","easy","echo",
    "ecology","economy","edge","edit","educate","effort","egg","eight","either","elbow",
    "elder","electric","elegant","element","elephant","elevator","elite","else","embark","embody",
    "embrace","emerge","emotion","employ","empower","empty","enable","enact","end","endless",
    "endorse","enemy","energy","enforce","engage","engine","enhance","enjoy","enlist","enough",
    "enrich","enroll","ensure","enter","entire","entry","envelope","episode","equal","equip",
    "era","erase","erode","erosion","error","erupt","escape","essay","essence","estate",
    "eternal","ethics","evidence","evil","evoke","evolve","exact","example","excess","exchange",
    "excite","exclude","excuse","execute","exercise","exhaust","exhibit","exile","exist","exit",
    "exotic","expand","expect","expire","explain","expose","express","extend","extra","eye",
    "eyebrow","fabric","face","faculty","fade","faint","faith","fall","false","fame",
    "family","famous","fan","fancy","fantasy","farm","fashion","fat","fatal","father",
    "fatigue","fault","favorite","feature","february","federal","fee","feed","feel","female",
    "fence","festival","fetch","fever","few","fiber","fiction","field","figure","file",
    "film","filter","final","find","fine","finger","finish","fire","firm","first",
    "fiscal","fish","fit","fitness","fix","flag","flame","flash","flat","flavor",
    "flee","flight","flip","float","flock","floor","flower","fluid","flush","fly",
    "foam","focus","fog","foil","fold","follow","food","foot","force","forest",
    "forget","fork","fortune","forum","forward","fossil","foster","found","fox","fragile",
    "frame","frequent","fresh","friend","fringe","frog","front","frost","frown","frozen",
    "fruit","fuel","fun","funny","furnace","fury","future","gadget","gain","galaxy",
    "gallery","game","gap","garage","garbage","garden","garlic","garment","gas","gasp",
    "gate","gather","gauge","gaze","general","genius","genre","gentle","genuine","gesture",
    "ghost","giant","gift","giggle","ginger","giraffe","girl","give","glad","glance",
    "glare","glass","glide","glimpse","globe","gloom","glory","glove","glow","glue",
    "goat","goddess","gold","good","goose","gorilla","gospel","gossip","govern","gown",
    "grab","grace","grain","grant","grape","grass","gravity","great","green","grid",
    "grief","grit","grocery","group","grow","grunt","guard","guess","guide","guilt",
    "guitar","gun","gym","habit","hair","half","hammer","hamster","hand","happy",
    "harbor","hard","harsh","harvest","hat","have","hawk","hazard","head","health",
    "heart","heavy","hedgehog","height","hello","helmet","help","hen","hero","hidden",
    "high","hill","hint","hip","hire","history","hobby","hockey","hold","hole",
    "holiday","hollow","home","honey","hood","hope","horn","horror","horse","hospital",
    "host","hotel","hour","hover","hub","huge","human","humble","humor","hundred",
    "hungry","hunt","hurdle","hurry","hurt","husband","hybrid","ice","icon","idea",
    "identify","idle","ignore","ill","illegal","illness","image","imitate","immense","immune",
    "impact","impose","improve","impulse","inch","include","income","increase","index","indicate",
    "indoor","industry","infant","inflict","inform","inhale","inherit","initial","inject","injury",
    "inmate","inner","innocent","input","inquiry","insane","insect","inside","inspire","install",
    "intact","interest","into","invest","invite","involve","iron","island","isolate","issue",
    "item","ivory","jacket","jaguar","jar","jazz","jealous","jeans","jelly","jewel",
    "job","join","joke","journey","joy","judge","juice","jump","jungle","junior",
    "junk","just","kangaroo","keen","keep","ketchup","key","kick","kid","kidney",
    "kind","kingdom","kiss","kit","kitchen","kite","kitten","kiwi","knee","knife",
    "knock","know","lab","label","labor","ladder","lady","lake","lamp","language",
    "laptop","large","later","latin","laugh","laundry","lava","law","lawn","lawsuit",
    "layer","lazy","leader","leaf","learn","leave","lecture","left","leg","legal",
    "legend","leisure","lemon","lend","length","lens","leopard","lesson","letter","level",
    "liar","liberty","library","license","life","lift","light","like","limb","limit",
    "link","lion","liquid","list","little","live","lizard","load","loan","lobster",
    "local","lock","logic","lonely","long","loop","lottery","loud","lounge","love",
    "loyal","lucky","luggage","lumber","lunar","lunch","luxury","lyrics","machine","mad",
    "magic","magnet","maid","mail","main","major","make","mammal","man","manage",
    "mandate","mango","mansion","manual","maple","marble","march","margin","marine","market",
    "marriage","mask","mass","master","match","material","math","matrix","matter","maximum",
    "maze","meadow","mean","measure","meat","mechanic","medal","media","melody","melt",
    "member","memory","mention","menu","mercy","merge","merit","merry","mesh","message",
    "metal","method","middle","midnight","milk","million","mimic","mind","minimum","minor",
    "minute","miracle","mirror","misery","miss","mistake","mix","mixed","mixture","mobile",
    "model","modify","mom","moment","monitor","monkey","monster","month","moon","moral",
    "more","morning","mosquito","mother","motion","motor","mountain","mouse","move","movie",
    "much","muffin","mule","multiply","muscle","museum","mushroom","music","must","mutual",
    "myself","mystery","myth","naive","name","napkin","narrow","nasty","nation","nature",
    "near","neck","need","negative","neglect","neither","nephew","nerve","nest","net",
    "network","neutral","never","news","next","nice","night","noble","noise","nominee",
    "noodle","normal","north","nose","notable","note","nothing","notice","novel","now",
    "nuclear","number","nurse","nut","oak","obey","object","oblige","obscure","observe",
    "obtain","obvious","occur","ocean","october","odor","off","offer","office","often",
    "oil","okay","old","olive","olympic","omit","once","one","onion","online",
    "only","open","opera","opinion","oppose","option","orange","orbit","orchard","order",
    "ordinary","organ","orient","original","orphan","ostrich","other","outdoor","outer","output",
    "outside","oval","oven","over","own","owner","oxygen","oyster","ozone","pact",
    "paddle","page","pair","palace","palm","panda","panel","panic","panther","paper",
    "parade","parent","park","parrot","party","pass","patch","path","patient","patrol",
    "pattern","pause","pave","payment","peace","peanut","pear","peasant","pelican","pen",
    "penalty","pencil","people","pepper","perfect","permit","person","pet","phone","photo",
    "phrase","physical","piano","picnic","picture","piece","pig","pigeon","pill","pilot",
    "pink","pioneer","pipe","pistol","pitch","pizza","place","planet","plastic","plate",
    "play","please","pledge","pluck","plug","plunge","poem","poet","point","polar",
    "pole","police","pond","pony","pool","popular","portion","position","possible","post",
    "potato","pottery","poverty","powder","power","practice","praise","predict","prefer","present",
    "pretty","prevent","price","pride","primary","print","priority","prison","private",
    "prize","problem","process","produce","profit","program","project","promote","proof","property",
    "prosper","protect","proud","provide","public","pudding","pull","pulp","pulse","pumpkin",
    "punch","pupil","puppy","purchase","purity","purpose","purse","push","put","puzzle",
    "pyramid","quality","quantum","quarter","question","quick","quit","quiz","quote","rabbit",
    "raccoon","race","rack","radar","radio","rail","rain","raise","rally","ramp",
    "ranch","random","range","rapid","rare","rate","rather","raven","raw","razor",
    "ready","real","reason","rebel","rebuild","recall","receive","recipe","record","recycle",
    "reduce","reflect","reform","refuse","region","regret","regular","reject","relax","release",
    "relief","rely","remain","remember","remind","remove","render","renew","rent","reopen",
    "repair","repeat","replace","report","require","rescue","resemble","resist","resource","response",
    "result","retire","retreat","return","reunion","reveal","review","reward","rhythm","rib",
    "ribbon","rice","rich","ride","ridge","rifle","right","rigid","ring","riot",
    "ripple","risk","ritual","rival","river","road","roast","robot","robust","rocket",
    "romance","roof","rookie","room","rose","rotate","rough","round","route","royal",
    "rubber","rude","rug","rule","run","runway","rural","sad","saddle","sadness",
    "safe","sail","salad","salmon","salon","salt","salute","same","sample","sand",
    "satisfy","satoshi","sauce","sausage","save","say","scale","scan","scare","scatter",
    "scene","scheme","school","science","scissors","scorpion","scout","scrap","screen","script",
    "scrub","sea","search","season","seat","second","secret","section","security","seed",
    "seek","segment","select","sell","seminar","senior","sense","sentence","series","service",
    "session","settle","setup","seven","shadow","shaft","shallow","share","shed","shell",
    "sheriff","shield","shift","shine","ship","shiver","shock","shoe","shoot","shop",
    "short","shoulder","shove","shrimp","shrug","shuffle","shy","sibling","sick","side",
    "siege","sight","sign","silent","silk","silly","silver","similar","simple","since",
    "sing","siren","sister","situate","six","size","skate","sketch","ski","skill",
    "skin","skirt","skull","slab","slam","sleep","slender","slice","slide","slight",
    "slim","slogan","slot","slow","slush","small","smart","smile","smoke","smooth",
    "snack","snake","snap","sniff","snow","soap","soccer","social","sock","soda",
    "soft","solar","soldier","solid","solution","solve","someone","song","soon","sorry",
    "sort","soul","sound","soup","source","south","space","spare","spatial","spawn",
    "speak","special","speed","spell","spend","sphere","spice","spider","spike","spin",
    "spirit","split","spoil","sponsor","spoon","sport","spot","spray","spread","spring",
    "spy","square","squeeze","squirrel","stable","stadium","staff","stage","stairs","stamp",
    "stand","start","state","stay","steak","steel","stem","step","stereo","stick",
    "still","sting","stock","stomach","stone","stool","story","stove","strategy","street",
    "strike","strong","struggle","student","stuff","stumble","style","subject","submit","subway",
    "success","such","sudden","suffer","sugar","suggest","suit","summer","sun","sunny",
    "sunset","super","supply","supreme","sure","surface","surge","surprise","surround","survey",
    "suspect","sustain","swallow","swamp","swap","swarm","swear","sweet","swift","swim",
    "swing","switch","sword","symbol","symptom","syrup","system","table","tackle","tag",
    "tail","talent","talk","tank","tape","target","task","taste","tattoo","taxi",
    "teach","team","tell","ten","tenant","tennis","tent","term","test","text",
    "thank","that","theme","then","theory","there","they","thing","this","thought",
    "three","thrive","throw","thumb","thunder","ticket","tide","tiger","tilt","timber",
    "time","tiny","tip","tired","tissue","title","toast","tobacco","today","toddler",
    "toe","together","toilet","token","tomato","tomorrow","tone","tongue","tonight","tool",
    "tooth","top","topic","topple","torch","tornado","tortoise","toss","total","tourist",
    "toward","tower","town","toy","track","trade","traffic","tragic","train","transfer",
    "trap","trash","travel","tray","treat","tree","trend","trial","tribe","trick",
    "trigger","trim","trip","trophy","trouble","truck","true","truly","trumpet","trust",
    "truth","try","tube","tuition","tumble","tuna","tunnel","turkey","turn","turtle",
    "twelve","twenty","twice","twin","twist","two","type","typical","ugly","umbrella",
    "unable","unaware","uncle","uncover","under","undo","unfair","unfold","unhappy","uniform",
    "unique","unit","universe","unknown","unlock","until","unusual","unveil","update","upgrade",
    "uphold","upon","upper","upset","urban","urge","usage","use","used","useful",
    "useless","usual","utility","vacant","vacuum","vague","valid","valley","valve","van",
    "vanish","vapor","various","vast","vault","vehicle","velvet","vendor","venture","venue",
    "verb","verify","version","very","vessel","veteran","viable","vibrant","vicious","victory",
    "video","view","village","vintage","violin","virtual","virus","visa","visit","visual",
    "vital","vivid","vocal","voice","void","volcano","volume","vote","voyage","wage",
    "wagon","wait","walk","wall","walnut","want","warfare","warm","warrior","wash",
    "wasp","waste","water","wave","way","wealth","weapon","wear","weasel","weather",
    "web","wedding","weekend","weird","welcome","west","wet","whale","what","wheat",
    "wheel","when","where","whip","whisper","wide","width","wife","wild","will",
    "win","window","wine","wing","wink","winner","winter","wire","wisdom","wise",
    "wish","witness","wolf","woman","wonder","wood","wool","word","work","world",
    "worry","worth","wrap","wreck","wrestle","wrist","write","wrong","yard","year",
    "yellow","you","young","youth","zebra","zero","zone","zoo"
];

// ============ DOM REFERENCES ============
const DOM = {
    // Main
    encryptBtn: document.getElementById('encrypt-btn-main'),
    scanBtn: document.getElementById('scan-btn'),
    uploadArea: document.getElementById('upload-area'),
    qrFile: document.getElementById('qr-file'),
    aboutBtn: document.getElementById('about-btn'),
    
    // Steps
    stepSeed: document.getElementById('step-seed'),
    stepMessage: document.getElementById('step-message'),
    stepPassword: document.getElementById('step-password'),
    stepQR: document.getElementById('step-qr'),
    stepDecrypted: document.getElementById('step-decrypted'),
    
    // Seed
    seedInput: document.getElementById('seed-input'),
    wordCounter: document.getElementById('word-counter'),
    bip39Status: document.getElementById('bip39-status'),
    suggestions: document.getElementById('suggestions'),
    seedNext: document.getElementById('seed-next'),
    
    // Message
    messageInput: document.getElementById('message-input'),
    charCounter: document.getElementById('char-counter'),
    messageNext: document.getElementById('message-next'),
    messageSkip: document.getElementById('message-skip'),
    
    // Password
    passwordInput: document.getElementById('password-input'),
    showPassword: document.getElementById('show-password'),
    strengthFill: document.getElementById('strength-fill'),
    strengthLabel: document.getElementById('strength-label'),
    passwordGenerate: document.getElementById('password-generate'),
    passwordNext: document.getElementById('password-next'),
    requirements: document.querySelectorAll('.req-item'),
    
    // QR
    qrCanvas: document.getElementById('qr-canvas'),
    qrDownload: document.getElementById('qr-download'),
    qrPdf: document.getElementById('qr-pdf'),
    qrShare: document.getElementById('qr-share'),
    qrDone: document.getElementById('qr-done'),
    
    // Decrypted
    seedGrid: document.getElementById('seed-grid'),
    decryptedCount: document.getElementById('decrypted-count'),
    decryptedCopy: document.getElementById('decrypted-copy'),
    decryptedHide: document.getElementById('decrypted-hide'),
    decryptedDone: document.getElementById('decrypted-done'),
    timerFill: document.getElementById('timer-fill'),
    timerLabel: document.getElementById('timer-label'),
    
    // Modals
    passwordModal: document.getElementById('password'),
    decryptPassword: document.getElementById('decrypt-password'),
    decryptShowPassword: document.getElementById('decrypt-show-password'),
    decryptStatus: document.getElementById('decrypt-status'),
    decryptCancel: document.getElementById('decrypt-cancel'),
    decryptConfirm: document.getElementById('decrypt-confirm'),
    scannerPreviewContainer: document.getElementById('scanner-preview-container'),
    scannerVideo: document.getElementById('scanner-video'),
    scannerStatus: document.querySelector('.scanner-status'),
    
    aboutModal: document.getElementById('about'),
    aboutClose: document.getElementById('about-close'),
    aboutGotIt: document.getElementById('about-got-it'),
    
    // Toast & Spinner
    toastContainer: document.getElementById('toast-container'),
    spinnerOverlay: document.getElementById('spinner-overlay'),
    spinnerMessage: document.getElementById('spinner-message'),
    
    // Back buttons
    backButtons: document.querySelectorAll('.btn-back')
};

// ============ STATE ============
const STATE = {
    step: 'main',
    seed: '',
    message: '',
    password: '',
    encryptedData: '',
    qrImageData: null,
    decryptedSeed: '',
    decryptionAttempts: 0,
    timerInterval: null,
    timerRemaining: CONFIG.AUTO_HIDE_SECONDS,
    isProcessing: false,
    currentWordIndex: -1,
    currentWordPartial: '',
    seedValid: false,
    scannerActive: false,
    scannerTimer: null,
    scannerVideoTrack: null,
    isPaused: false
};

// ============ CRYPTO ============
const CryptoUtils = {
    _keyCache: new Map(),
    
    async _deriveKey(passphrase, salt) {
        const cacheKey = `${passphrase}:${Array.from(salt).join(',')}`;
        if (this._keyCache.has(cacheKey)) {
            return this._keyCache.get(cacheKey);
        }
        
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
                salt: salt,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            CONFIG.AES_KEY_LENGTH
        );
        
        const key = await crypto.subtle.importKey(
            'raw',
            derivedBits,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
        
        this._keyCache.set(cacheKey, key);
        setTimeout(() => this._keyCache.delete(cacheKey), 300000);
        
        return key;
    },

    createMetadata(userMessage = '') {
        const now = new Date();
        return {
            version: 2,
            modificationCount: 0,
            timestamp: now,
            userMessage: userMessage.slice(0, 255).replace(/[<>]/g, ''),
            failedAttempts: 0,
            lastFailedAttempt: null,
            isValid: true
        };
    },

    serializeMetadata(metadata) {
        const buf = new ArrayBuffer(128);
        const view = new DataView(buf);
        let offset = 0;
        
        view.setUint8(offset++, metadata.version);
        view.setUint8(offset++, metadata.modificationCount);
        view.setUint32(offset, Math.floor(metadata.timestamp.getTime() / 1000), false);
        offset += 4;
        
        const encoder = new TextEncoder();
        let msgBytes = encoder.encode(metadata.userMessage || '');
        if (msgBytes.length > 116) msgBytes = msgBytes.slice(0, 116);
        
        view.setUint8(offset++, msgBytes.length);
        view.setUint8(offset++, metadata.failedAttempts || 0);
        view.setUint32(offset, metadata.lastFailedAttempt ? Math.floor(metadata.lastFailedAttempt.getTime() / 1000) : 0, false);
        offset += 4;
        
        for (let i = 0; i < msgBytes.length; i++) {
            view.setUint8(offset++, msgBytes[i]);
        }
        
        while (offset < 128) {
            view.setUint8(offset++, 0);
        }
        
        return new Uint8Array(buf);
    },

    deserializeMetadata(data) {
        try {
            const view = new DataView(data.buffer, data.byteOffset, 128);
            let offset = 0;
            
            const version = view.getUint8(offset++);
            if (version > 2) throw new Error('Unsupported metadata version');
            
            const modificationCount = view.getUint8(offset++);
            const timestampValue = view.getUint32(offset, false);
            const timestamp = timestampValue > 0 ? new Date(timestampValue * 1000) : new Date();
            offset += 4;
            
            const userMessageLength = view.getUint8(offset++);
            const failedAttempts = view.getUint8(offset++);
            const lastFailedAttemptTimestamp = view.getUint32(offset, false);
            offset += 4;
            
            const maxLen = Math.min(userMessageLength, 116);
            const msgBytes = new Uint8Array(data.buffer, data.byteOffset + offset, maxLen);
            const userMessage = new TextDecoder().decode(msgBytes);
            
            return {
                version,
                modificationCount,
                timestamp,
                userMessage,
                failedAttempts,
                lastFailedAttempt: lastFailedAttemptTimestamp > 0 ? new Date(lastFailedAttemptTimestamp * 1000) : null,
                isValid: true
            };
        } catch (error) {
            throw new Error('Failed to read metadata: ' + error.message);
        }
    },

    async encryptMessage(message, passphrase, userMessage = '') {
        const metadata = this.createMetadata(userMessage);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        const aesKey = await this._deriveKey(passphrase, salt);
        const metadataBytes = this.serializeMetadata(metadata);
        
        const payload = JSON.stringify({
            seed: message,
            userMessage: this.createMetadata(userMessage).userMessage
        });
        
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                additionalData: metadataBytes,
                tagLength: 128
            },
            aesKey,
            new TextEncoder().encode(payload)
        );
        
        const ciphertext = new Uint8Array(encrypted);
        const combined = new Uint8Array(128 + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH + ciphertext.length);
        
        combined.set(metadataBytes, 0);
        combined.set(salt, 128);
        combined.set(iv, 128 + CONFIG.SALT_LENGTH);
        combined.set(ciphertext, 128 + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
        
        return btoa(String.fromCharCode(...combined));
    },

    async decryptMessage(encryptedBase64, passphrase) {
        try {
            const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            
            if (encryptedData.length < 128 + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH) {
                throw new Error('Invalid encrypted data format');
            }
            
            const metadataBytes = encryptedData.slice(0, 128);
            const salt = encryptedData.slice(128, 128 + CONFIG.SALT_LENGTH);
            const iv = encryptedData.slice(128 + CONFIG.SALT_LENGTH, 128 + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
            const ciphertext = encryptedData.slice(128 + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
            
            const aesKey = await this._deriveKey(passphrase, salt);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    additionalData: metadataBytes,
                    tagLength: 128
                },
                aesKey,
                ciphertext
            );
            
            const payload = JSON.parse(new TextDecoder().decode(decrypted));
            const metadata = this.deserializeMetadata(metadataBytes);
            
            return {
                seed: payload.seed || '',
                userMessage: payload.userMessage || '',
                metadata: metadata
            };
        } catch (error) {
            // Distinguir entre error de contraseña y otros errores
            if (error.message.includes('bad decrypt') || error.message.includes('decryption failed')) {
                throw new Error('Incorrect password');
            }
            throw new Error('Decryption failed: ' + error.message);
        }
    }
};

// ============ BIP39 ============
const BIP39 = {
    _checksumCache: new Map(),
    _cacheOrder: [],
    
    _evictCache() {
        while (this._cacheOrder.length > CONFIG.BIP39_CACHE_MAX_SIZE) {
            const oldest = this._cacheOrder.shift();
            this._checksumCache.delete(oldest);
        }
    },
    
    async validateChecksum(words) {
        if (![12, 18, 24].includes(words.length)) {
            return false;
        }
        
        const key = words.join(' ');
        if (this._checksumCache.has(key)) {
            return this._checksumCache.get(key);
        }
        
        try {
            for (const word of words) {
                if (!BIP39_WORDS.includes(word)) {
                    this._checksumCache.set(key, false);
                    this._cacheOrder.push(key);
                    this._evictCache();
                    return false;
                }
            }
            
            const bits = words.map(w => {
                const index = BIP39_WORDS.indexOf(w);
                return index.toString(2).padStart(11, '0');
            });
            
            const cs = words.length / 3;
            const entropyBits = bits.join('').slice(0, -cs);
            const checksumBits = bits.join('').slice(-cs);
            
            if (entropyBits.length % 8 !== 0) {
                this._checksumCache.set(key, false);
                this._cacheOrder.push(key);
                this._evictCache();
                return false;
            }
            
            const entropyBytes = new Uint8Array(
                entropyBits.match(/.{1,8}/g).map(b => parseInt(b, 2))
            );
            
            const hash = await crypto.subtle.digest('SHA-256', entropyBytes);
            const hashBytes = new Uint8Array(hash);
            const computedChecksum = hashBytes[0].toString(2).padStart(8, '0').slice(0, cs);
            
            const result = computedChecksum === checksumBits;
            this._checksumCache.set(key, result);
            this._cacheOrder.push(key);
            this._evictCache();
            return result;
        } catch (error) {
            console.error('BIP39 validation error:', error);
            this._checksumCache.set(key, false);
            this._cacheOrder.push(key);
            this._evictCache();
            return false;
        }
    },
    
    validateWords(words) {
        if (![12, 18, 24].includes(words.length)) {
            return false;
        }
        return words.every(w => BIP39_WORDS.includes(w));
    },
    
    getSuggestions(partial) {
        if (partial.length < 2) return [];
        const lower = partial.toLowerCase();
        return BIP39_WORDS
            .filter(w => w.startsWith(lower))
            .slice(0, CONFIG.MAX_SUGGESTIONS);
    }
};

// ============ QR ============
const QR = {
    async _ensureQRCodeLoaded() {
        if (typeof window === 'undefined') throw new Error('No window object (not running in browser)');
        if (window.QRCode || window.qrcode) return;
        
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js';
            s.onload = () => {
                setTimeout(() => resolve(), 0);
            };
            s.onerror = (e) => {
                reject(new Error('Failed to load qrcode library dynamically'));
            };
            document.head.appendChild(s);
        });
    },

    async generate(data) {
        if (!DOM.qrCanvas) throw new Error('Canvas element not found');
        DOM.qrCanvas.width = CONFIG.QR_SIZE;
        DOM.qrCanvas.height = CONFIG.QR_SIZE;
        const canvas = DOM.qrCanvas;

        let lib = window.QRCode || window.qrcode;
        if (!lib) {
            try {
                await this._ensureQRCodeLoaded();
                lib = window.QRCode || window.qrcode;
            } catch (err) {
                lib = null;
            }
        }

        if (lib && typeof lib.toCanvas === 'function') {
            return new Promise((resolve, reject) => {
                try {
                    lib.toCanvas(canvas, data, {
                        width: CONFIG.QR_SIZE,
                        margin: 2,
                        color: { dark: '#1a2a3a', light: '#ffffff' },
                        errorCorrectionLevel: 'H'
                    }, error => {
                        if (error) reject(error);
                        else resolve();
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }

        if (lib && typeof lib.toDataURL === 'function') {
            return new Promise((resolve, reject) => {
                try {
                    lib.toDataURL(data, { width: CONFIG.QR_SIZE, margin: 2, errorCorrectionLevel: 'H' }, (err, url) => {
                        if (err) return reject(err);
                        const img = new Image();
                        img.onload = () => {
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            resolve();
                        };
                        img.onerror = () => reject(new Error('Failed to load QR image from library'));
                        img.src = url;
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }

        // Fallback
        try {
            const chartUrl = `https://chart.googleapis.com/chart?cht=qr&chs=${CONFIG.QR_SIZE}x${CONFIG.QR_SIZE}&chld=H|0&chl=${encodeURIComponent(data)}`;
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('Failed to load QR image from fallback service'));
                img.src = chartUrl;
            });
        } catch (err) {
            throw new Error('No QR generator available: ' + err.message);
        }
    },
    
    async extract(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = imageData;
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const jsqr = window.jsQR || window.jsqr || window.JSQR;
                    if (typeof jsqr === 'function') {
                        const code = jsqr(data.data, canvas.width, canvas.height);
                        if (code) resolve(code.data);
                        else reject(new Error('No QR code found in image'));
                    } else if (typeof jsQR === 'function') {
                        const code = jsQR(data.data, canvas.width, canvas.height);
                        if (code) resolve(code.data);
                        else reject(new Error('No QR code found in image'));
                    } else {
                        reject(new Error('jsQR library is not available'));
                    }
                } catch (error) {
                    reject(new Error('Failed to process image: ' + error.message));
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        });
    }
};

// ============ UI HELPERS ============
function showToast(message, type = 'info') {
    const icons = {
        error: 'fa-exclamation-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}" aria-hidden="true"></i> ${message}`;
    
    if (type === 'error' && CONFIG.TOAST_PERSISTENT_ERRORS) {
        toast.style.cursor = 'pointer';
        toast.title = 'Click to dismiss';
        toast.addEventListener('click', () => dismissToast(toast));
    }
    
    DOM.toastContainer.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Los toasts de error persisten hasta que el usuario haga clic
    if (type !== 'error' || !CONFIG.TOAST_PERSISTENT_ERRORS) {
        setTimeout(() => {
            dismissToast(toast);
        }, type === 'error' ? 8000 : 4000);
    }
}

function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('show');
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 300);
}

function showSpinner(show, message = 'Processing…') {
    if (!DOM.spinnerOverlay) return;
    DOM.spinnerOverlay.style.display = show ? 'flex' : 'none';
    if (message && DOM.spinnerMessage) {
        DOM.spinnerMessage.textContent = message;
    }
}

function showStep(stepId) {
    const steps = ['step-seed', 'step-message', 'step-password', 'step-qr', 'step-decrypted'];
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === stepId ? 'block' : 'none';
    });
    STATE.step = stepId.replace('step-', '');
}

function goToStep(step) {
    showStep(`step-${step}`);
    if (step === 'main') {
        const container = document.querySelector('.container');
        if (container) container.style.display = 'flex';
    } else {
        const container = document.querySelector('.container');
        if (container) container.style.display = 'none';
    }
}

// ============ MODALS ============
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        document.addEventListener('keydown', handleModalEscape);
        
        // Si es el modal de password, enfocar el input
        if (id === 'password' && DOM.decryptPassword) {
            setTimeout(() => DOM.decryptPassword.focus(), 100);
        }
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        document.removeEventListener('keydown', handleModalEscape);
        
        // Limpiar estado si es el modal de password
        if (id === 'password') {
            stopScanner();
            STATE.decryptionAttempts = 0;
            STATE.encryptedData = '';
            STATE.qrImageData = null;
            if (DOM.decryptPassword) DOM.decryptPassword.value = '';
            if (DOM.decryptStatus) {
                DOM.decryptStatus.style.display = 'none';
                DOM.decryptStatus.className = 'decrypt-status';
            }
        }
    }
}

function handleModalEscape(e) {
    if (e.key === 'Escape') {
        // Cerrar cualquier modal abierto
        const openModals = document.querySelectorAll('.modal[style*="display: flex"]');
        if (openModals.length) {
            const id = openModals[openModals.length - 1].id;
            closeModal(id);
        }
    }
}

// ============ SUGGESTIONS ============
let suggestionTimeout = null;

function updateSuggestions() {
    const text = DOM.seedInput.value;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    
    DOM.wordCounter.textContent = `${words.length} words`;
    
    const allWordsValid = words.every(w => BIP39_WORDS.includes(w));
    const isValidCount = [12, 18, 24].includes(words.length);
    
    if (words.length > 0 && !allWordsValid) {
        DOM.bip39Status.textContent = '⚠️ Invalid word(s)';
        DOM.bip39Status.className = 'status-invalid';
        DOM.seedNext.disabled = true;
        STATE.seedValid = false;
    } else if (isValidCount && allWordsValid) {
        BIP39.validateChecksum(words).then(valid => {
            if (valid) {
                DOM.bip39Status.textContent = '✓ BIP39 Valid';
                DOM.bip39Status.className = 'status-valid';
                DOM.seedNext.disabled = false;
                STATE.seedValid = true;
            } else {
                DOM.bip39Status.textContent = '⚠️ Invalid checksum';
                DOM.bip39Status.className = 'status-invalid';
                DOM.seedNext.disabled = true;
                STATE.seedValid = false;
            }
        });
    } else {
        DOM.bip39Status.textContent = isValidCount && allWordsValid ? '✓ BIP39' : '✓ BIP39';
        DOM.bip39Status.className = 'status-valid';
        DOM.seedNext.disabled = !(isValidCount && allWordsValid);
        STATE.seedValid = isValidCount && allWordsValid;
    }
    
    const pos = DOM.seedInput.selectionStart;
    let idx = 0;
    let charCount = 0;
    for (let i = 0; i < words.length; i++) {
        charCount += words[i].length + 1;
        if (pos <= charCount) {
            idx = i;
            break;
        }
    }
    
    STATE.currentWordIndex = idx >= 0 && idx < words.length ? idx : words.length - 1;
    STATE.currentWordPartial = words[STATE.currentWordIndex] || '';
    
    if (STATE.currentWordPartial.length > 1) {
        const matches = BIP39.getSuggestions(STATE.currentWordPartial);
        if (matches.length > 0) {
            DOM.suggestions.innerHTML = matches.map(word => `
                <div class="suggestion-item" data-word="${word}" tabindex="0" role="option">
                    <i class="fas fa-lightbulb" aria-hidden="true"></i> ${word}
                </div>
            `).join('');
            
            DOM.suggestions.style.display = 'block';
            DOM.suggestions.setAttribute('role', 'listbox');
            
            DOM.suggestions.querySelectorAll('.suggestion-item').forEach(el => {
                el.addEventListener('click', () => selectSuggestion(el.dataset.word));
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') selectSuggestion(el.dataset.word);
                    if (e.key === 'Escape') DOM.suggestions.style.display = 'none';
                });
            });
        } else {
            DOM.suggestions.style.display = 'none';
        }
    } else {
        DOM.suggestions.style.display = 'none';
    }
}

function selectSuggestion(word) {
    const text = DOM.seedInput.value;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const idx = STATE.currentWordIndex >= 0 && STATE.currentWordIndex < words.length 
        ? STATE.currentWordIndex 
        : words.length - 1;
    
    if (idx >= 0 && idx < words.length) {
        words[idx] = word;
        let newText = words.join(' ');
        if (words.length < 24) {
            newText += ' ';
        }
        DOM.seedInput.value = newText;
        DOM.seedInput.selectionStart = DOM.seedInput.selectionEnd = newText.length;
        DOM.seedInput.focus();
        updateSuggestions();
    }
    DOM.suggestions.style.display = 'none';
}

// ============ PASSWORD STRENGTH ============
function updatePasswordStrength() {
    const pwd = DOM.passwordInput.value;
    let strength = 0;
    const checks = {
        length: pwd.length >= CONFIG.MIN_PASSWORD_LENGTH,
        uppercase: /[A-Z]/.test(pwd),
        lowercase: /[a-z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        symbol: /[^A-Za-z0-9]/.test(pwd)
    };
    
    DOM.requirements.forEach(el => {
        const req = el.dataset.req;
        const isMet = checks[req];
        if (isMet) {
            el.classList.add('met');
            el.classList.remove('failing');
            el.querySelector('i').className = 'fas fa-check-circle';
        } else {
            el.classList.remove('met');
            if (pwd.length > 0) {
                el.classList.add('failing');
                setTimeout(() => el.classList.remove('failing'), 500);
            }
            el.querySelector('i').className = 'fas fa-circle';
        }
    });
    
    if (checks.length) strength += 20;
    if (checks.uppercase) strength += 20;
    if (checks.lowercase) strength += 20;
    if (checks.number) strength += 20;
    if (checks.symbol) strength += 20;
    
    const levels = [
        { min: 80, label: 'Strong', color: '#2ecc71' },
        { min: 60, label: 'Good', color: '#3498db' },
        { min: 40, label: 'Fair', color: '#f39c12' },
        { min: 0, label: 'Weak', color: '#e74c3c' }
    ];
    
    const level = levels.find(l => strength >= l.min);
    
    if (DOM.strengthFill) {
        DOM.strengthFill.style.width = `${strength}%`;
        DOM.strengthFill.style.background = level.color;
        DOM.strengthFill.parentElement.setAttribute('aria-valuenow', strength);
    }
    if (DOM.strengthLabel) {
        DOM.strengthLabel.textContent = level.label;
        DOM.strengthLabel.style.color = level.color;
    }
    
    if (DOM.passwordNext) DOM.passwordNext.disabled = pwd.length < CONFIG.MIN_PASSWORD_LENGTH;
}

// ============ TIMER ============
function startTimer() {
    STATE.timerRemaining = CONFIG.AUTO_HIDE_SECONDS;
    if (DOM.timerFill) DOM.timerFill.style.width = '100%';
    if (DOM.timerLabel) DOM.timerLabel.textContent = `Auto-hide in ${STATE.timerRemaining}s`;
    
    if (STATE.timerInterval) {
        clearInterval(STATE.timerInterval);
    }
    
    STATE.timerInterval = setInterval(() => {
        if (STATE.isPaused) return;
        
        STATE.timerRemaining--;
        const pct = Math.max(0, (STATE.timerRemaining / CONFIG.AUTO_HIDE_SECONDS) * 100);
        if (DOM.timerFill) {
            DOM.timerFill.style.width = `${pct}%`;
            DOM.timerFill.parentElement.setAttribute('aria-valuenow', pct);
        }
        if (DOM.timerLabel) DOM.timerLabel.textContent = `Auto-hide in ${STATE.timerRemaining}s`;
        
        if (STATE.timerRemaining <= 0) {
            clearInterval(STATE.timerInterval);
            STATE.timerInterval = null;
            hideDecryptedSeed();
        }
    }, 1000);
}

function stopTimer() {
    if (STATE.timerInterval) {
        clearInterval(STATE.timerInterval);
        STATE.timerInterval = null;
    }
}

function hideDecryptedSeed() {
    stopTimer();
    showToast('Seed auto-hidden for security', 'warning');
    goToStep('main');
    if (DOM.seedGrid) DOM.seedGrid.innerHTML = '';
    STATE.decryptedSeed = '';
}

// ============ SCANNER ============
function initScanner() {
    // El scanner ahora usa el contenedor en el modal
    if (DOM.scannerVideo) {
        DOM.scannerVideo.autoplay = true;
        DOM.scannerVideo.playsInline = true;
        DOM.scannerVideo.muted = true;
    }
}

async function startScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera not supported on this device', 'error');
        return;
    }
    
    initScanner();
    STATE.scannerActive = true;
    
    // Mostrar el contenedor del scanner
    if (DOM.scannerPreviewContainer) {
        DOM.scannerPreviewContainer.style.display = 'block';
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        STATE.scannerVideoTrack = stream.getVideoTracks()[0];
        
        if (DOM.scannerVideo) {
            DOM.scannerVideo.srcObject = stream;
            await DOM.scannerVideo.play();
        }
        
        // Actualizar estado del scanner
        if (DOM.scannerStatus) {
            DOM.scannerStatus.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Looking for QR...';
        }
        
        scanLoop();
        showToast('Camera activated', 'success');
        
    } catch (error) {
        STATE.scannerActive = false;
        if (DOM.scannerPreviewContainer) {
            DOM.scannerPreviewContainer.style.display = 'none';
        }
        showToast('Camera error: ' + error.message, 'error');
    }
}

function scanLoop() {
    if (!STATE.scannerActive || !DOM.scannerVideo) return;
    
    const video = DOM.scannerVideo;
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        STATE.scannerTimer = requestAnimationFrame(scanLoop);
        return;
    }
    
    try {
        const width = Math.floor(video.videoWidth * 0.5) || 320;
        const height = Math.floor(video.videoHeight * 0.5) || 240;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const jsqr = window.jsQR || window.jsqr || window.JSQR || window.jsQr;
        let code = null;
        if (typeof jsqr === 'function') {
            code = jsqr(imageData.data, width, height);
        } else if (typeof jsQR === 'function') {
            code = jsQR(imageData.data, width, height);
        }
        
        if (code && code.data && code.data.length > 100) {
            stopScanner();
            STATE.encryptedData = code.data;
            STATE.qrImageData = null;
            
            // Actualizar estado visual
            if (DOM.scannerStatus) {
                DOM.scannerStatus.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i> QR Found!';
                DOM.scannerStatus.style.background = 'rgba(46,204,113,0.8)';
            }
            
            showToast('QR scanned successfully', 'success');
            setTimeout(() => {
                if (DOM.decryptPassword) DOM.decryptPassword.focus();
            }, 300);
            return;
        }
    } catch (error) {
        // Silently continue scanning
    }
    
    STATE.scannerTimer = requestAnimationFrame(scanLoop);
}

function stopScanner() {
    STATE.scannerActive = false;
    if (STATE.scannerTimer) {
        cancelAnimationFrame(STATE.scannerTimer);
        STATE.scannerTimer = null;
    }
    if (STATE.scannerVideoTrack) {
        try { 
            STATE.scannerVideoTrack.stop(); 
        } catch (e) {}
        STATE.scannerVideoTrack = null;
    }
    if (DOM.scannerVideo && DOM.scannerVideo.srcObject) {
        try {
            DOM.scannerVideo.srcObject.getTracks().forEach(t => t.stop());
            DOM.scannerVideo.srcObject = null;
        } catch (e) {}
    }
    if (DOM.scannerPreviewContainer) {
        DOM.scannerPreviewContainer.style.display = 'none';
    }
    if (DOM.scannerStatus) {
        DOM.scannerStatus.innerHTML = '<i class="fas fa-camera" aria-hidden="true"></i> Camera ready';
        DOM.scannerStatus.style.background = 'rgba(0,0,0,0.7)';
    }
}

// ============ ENCRYPT FLOW ============
async function startEncryption() {
    if (STATE.isProcessing) return;
    
    STATE.seed = DOM.seedInput.value.trim();
    STATE.message = DOM.messageInput.value.trim();
    STATE.password = DOM.passwordInput.value;
    
    const words = STATE.seed.split(/\s+/);
    
    if (![12, 18, 24].includes(words.length)) {
        showToast('Seed must be 12, 18 or 24 words', 'error');
        return;
    }
    
    for (const word of words) {
        if (!BIP39_WORDS.includes(word)) {
            showToast(`Invalid word: "${word}"`, 'error');
            return;
        }
    }
    
    const isValidChecksum = await BIP39.validateChecksum(words);
    if (!isValidChecksum) {
        showToast('⚠️ Invalid BIP39 checksum. Proceed with caution.', 'warning');
    }
    
    if (STATE.password.length < CONFIG.MIN_PASSWORD_LENGTH) {
        showToast(`Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters`, 'error');
        return;
    }
    
    STATE.isProcessing = true;
    showSpinner(true, 'Encrypting seed…');
    
    try {
        const encrypted = await CryptoUtils.encryptMessage(STATE.seed, STATE.password, STATE.message);
        STATE.encryptedData = encrypted;
        
        showSpinner(true, 'Generating QR code…');
        try {
            await QR.generate(encrypted);
        } catch (qrErr) {
            throw new Error('QR generation failed: ' + qrErr.message);
        }
        
        showSpinner(false);
        goToStep('qr');
        showToast('Seed encrypted successfully', 'success');
        
        // Limpiar datos sensibles
        STATE.seed = '';
        STATE.password = '';
        if (DOM.passwordInput) DOM.passwordInput.value = '';
        if (DOM.seedInput) DOM.seedInput.value = '';
        
    } catch (error) {
        showSpinner(false);
        showToast('Encryption failed: ' + error.message, 'error');
        console.error('Encryption error:', error);
    } finally {
        STATE.isProcessing = false;
    }
}

// ============ DECRYPT FLOW ============
async function decryptQR() {
    if (STATE.isProcessing) return;
    
    const password = DOM.decryptPassword.value;
    if (!password) {
        showToast('Password required', 'error');
        return;
    }
    
    STATE.isProcessing = true;
    showSpinner(true, 'Decrypting…');
    
    try {
        let encrypted = STATE.encryptedData;
        
        if (!encrypted && STATE.qrImageData) {
            showSpinner(true, 'Reading QR from image…');
            encrypted = await QR.extract(STATE.qrImageData);
        }
        
        if (!encrypted) {
            throw new Error('No QR data available. Please scan or upload a QR code first.');
        }
        
        const result = await CryptoUtils.decryptMessage(encrypted, password);
        STATE.decryptedSeed = result.seed;
        STATE.decryptionAttempts = 0;
        
        showSpinner(false);
        closeModal('password');
        showDecryptedSeed(result.seed);
        showToast('Decryption successful', 'success');
        
        if (DOM.decryptPassword) DOM.decryptPassword.value = '';
        STATE.encryptedData = '';
        STATE.qrImageData = null;
        
        // Limpiar estado de decryption
        if (DOM.decryptStatus) {
            DOM.decryptStatus.style.display = 'none';
            DOM.decryptStatus.className = 'decrypt-status';
        }
        
    } catch (error) {
        STATE.decryptionAttempts++;
        showSpinner(false);
        
        let errorMessage = error.message;
        if (error.message.includes('Incorrect password')) {
            errorMessage = '❌ Incorrect password. Please try again.';
        } else if (error.message.includes('No QR data')) {
            errorMessage = '❌ ' + error.message;
        } else {
            errorMessage = `❌ ${error.message}`;
        }
        
        if (STATE.decryptionAttempts >= CONFIG.MAX_DECRYPT_ATTEMPTS) {
            if (DOM.decryptStatus) {
                DOM.decryptStatus.textContent = '⚠️ Too many failed attempts. Please wait 30 seconds.';
                DOM.decryptStatus.className = 'decrypt-status warning';
                DOM.decryptStatus.style.display = 'block';
            }
            setTimeout(() => {
                if (DOM.decryptStatus) {
                    DOM.decryptStatus.style.display = 'none';
                    DOM.decryptStatus.className = 'decrypt-status';
                }
                STATE.decryptionAttempts = 0;
            }, 30000);
        } else {
            if (DOM.decryptStatus) {
                DOM.decryptStatus.textContent = `${errorMessage} (Attempt ${STATE.decryptionAttempts}/${CONFIG.MAX_DECRYPT_ATTEMPTS})`;
                DOM.decryptStatus.className = 'decrypt-status error';
                DOM.decryptStatus.style.display = 'block';
            }
        }
        
        // Si es error de password, no limpiar el QR data
        if (error.message.includes('Incorrect password')) {
            // Mantener los datos para otro intento
        } else {
            STATE.encryptedData = '';
            STATE.qrImageData = null;
        }
    } finally {
        STATE.isProcessing = false;
    }
}

function showDecryptedSeed(seed) {
    const words = seed.split(' ');
    if (DOM.seedGrid) {
        DOM.seedGrid.innerHTML = words.map((w, i) => `
            <div class="seed-word" role="listitem">
                <span class="word-index">${i + 1}</span>
                ${w}
            </div>
        `).join('');
    }
    
    if (DOM.decryptedCount) DOM.decryptedCount.textContent = `${words.length} words`;
    goToStep('decrypted');
    startTimer();
}

// ============ FILE HANDLING ============
function processFile(file) {
    if (!file || !file.type.match('image.*')) {
        showToast('Please select a valid image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image too large (max 5MB)', 'error');
        return;
    }
    
    showSpinner(true, 'Processing image…');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            STATE.qrImageData = e.target.result;
            STATE.encryptedData = '';
            if (DOM.qrFile) DOM.qrFile.value = '';
            
            showSpinner(false);
            openModal('password');
            showToast('Image loaded successfully', 'success');
            
            // Intentar extraer automáticamente el QR
            try {
                const extracted = await QR.extract(STATE.qrImageData);
                if (extracted) {
                    STATE.encryptedData = extracted;
                    STATE.qrImageData = null;
                    showToast('QR code detected automatically', 'success');
                }
            } catch (extractError) {
                // Si falla la extracción automática, el usuario puede usar la cámara o subir otra imagen
                console.log('Auto-extraction failed, manual decryption available');
            }
        } catch (error) {
            showSpinner(false);
            showToast('Failed to load image: ' + error.message, 'error');
        }
    };
    reader.onerror = () => {
        showSpinner(false);
        showToast('Failed to read file', 'error');
    };
    reader.readAsDataURL(file);
}

// ============ PDF EXPORT ============
function generatePDF() {
    if (!STATE.encryptedData) {
        showToast('No QR generated', 'error');
        return;
    }
    
    showSpinner(true, 'Generating PDF…');
    
    try {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
            showSpinner(false);
            showToast('PDF library not available', 'error');
            return;
        }
        
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        const cx = w / 2;
        
        doc.setFillColor(245, 248, 250);
        doc.rect(0, 0, w, h, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(26, 42, 58);
        doc.text('MnemoniQR', cx, 20, null, null, 'center');
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 106, 122);
        doc.text('Encrypted Backup', cx, 27, null, null, 'center');
        
        const qrData = DOM.qrCanvas.toDataURL('image/png');
        const qrSize = 75;
        const qrX = cx - qrSize / 2;
        const qrY = 40;
        doc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
        
        doc.setFontSize(8);
        doc.setTextColor(90, 106, 122);
        doc.text('AES-256-GCM Encrypted', cx, qrY + qrSize + 8, null, null, 'center');
        
        doc.setFontSize(7);
        doc.setTextColor(150);
        const now = new Date().toLocaleString();
        doc.text(`Generated: ${now}`, cx, h - 8, null, null, 'center');
        
        doc.setFontSize(7);
        doc.setTextColor(200, 60, 60);
        doc.text('Store this document securely', cx, h - 3, null, null, 'center');
        
        doc.save(`mnemoniqr-backup-${Date.now()}.pdf`);
        showSpinner(false);
        showToast('PDF generated successfully', 'success');
    } catch (error) {
        showSpinner(false);
        showToast('PDF failed: ' + error.message, 'error');
    }
}

// ============ SHARE ============
async function shareQR() {
    if (!STATE.encryptedData) return;
    
    DOM.qrCanvas.toBlob(async blob => {
        if (!blob) {
            showToast('Failed to generate image', 'error');
            return;
        }
        
        if (navigator.share) {
            try {
                await navigator.share({
                    files: [new File([blob], 'seed-backup.png', { type: 'image/png' })],
                    title: 'MnemoniQR Backup'
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    showToast('Share cancelled', 'warning');
                }
            }
        } else {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showToast('QR copied to clipboard', 'success');
            } catch {
                showToast('Share not supported on this device', 'warning');
            }
        }
    }, 'image/png', 0.92);
}

// ============ EVENTS ============
function init() {
    // Encrypt flow
    if (DOM.encryptBtn) DOM.encryptBtn.addEventListener('click', () => {
        goToStep('seed');
        if (DOM.seedInput) {
            DOM.seedInput.value = '';
            DOM.seedInput.focus();
        }
        updateSuggestions();
    });
    
    if (DOM.seedInput) {
        DOM.seedInput.addEventListener('input', updateSuggestions);
        DOM.seedInput.addEventListener('blur', updateSuggestions);
        DOM.seedInput.addEventListener('focus', updateSuggestions);
    }
    
    if (DOM.seedNext) DOM.seedNext.addEventListener('click', () => {
        const text = DOM.seedInput.value.trim();
        const words = text.split(/\s+/).filter(w => w.length > 0);
        
        if (![12, 18, 24].includes(words.length)) {
            showToast('Seed must be 12, 18 or 24 words', 'error');
            return;
        }
        
        const invalidWords = words.filter(w => !BIP39_WORDS.includes(w));
        if (invalidWords.length > 0) {
            showToast(`Invalid words: ${invalidWords.join(', ')}`, 'error');
            return;
        }
        
        goToStep('message');
        if (DOM.messageInput) {
            DOM.messageInput.value = STATE.message || '';
            DOM.messageInput.focus();
            updateCharCounter();
        }
    });
    
    if (DOM.messageNext) DOM.messageNext.addEventListener('click', () => {
        STATE.message = DOM.messageInput.value.trim();
        goToStep('password');
        if (DOM.passwordInput) {
            DOM.passwordInput.value = '';
            DOM.passwordInput.focus();
            updatePasswordStrength();
        }
    });
    
    if (DOM.messageSkip) DOM.messageSkip.addEventListener('click', () => {
        if (DOM.messageInput) DOM.messageInput.value = '';
        STATE.message = '';
        goToStep('password');
        if (DOM.passwordInput) {
            DOM.passwordInput.value = '';
            DOM.passwordInput.focus();
            updatePasswordStrength();
        }
    });
    
    if (DOM.messageInput) {
        DOM.messageInput.addEventListener('input', updateCharCounter);
    }
    
    if (DOM.passwordInput) {
        DOM.passwordInput.addEventListener('input', updatePasswordStrength);
        DOM.passwordInput.addEventListener('focus', updatePasswordStrength);
    }
    
    if (DOM.showPassword) {
        DOM.showPassword.addEventListener('change', () => {
            if (DOM.passwordInput) {
                DOM.passwordInput.type = DOM.showPassword.checked ? 'text' : 'password';
            }
        });
    }
    
    if (DOM.passwordGenerate) {
        DOM.passwordGenerate.addEventListener('click', () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
            let pwd = '';
            for (let i = 0; i < 20; i++) {
                const randomIndex = crypto.getRandomValues(new Uint8Array(1))[0] % chars.length;
                pwd += chars[randomIndex];
            }
            if (DOM.passwordInput) DOM.passwordInput.value = pwd;
            updatePasswordStrength();
            showToast('Password generated', 'success');
        });
    }
    
    if (DOM.passwordNext) DOM.passwordNext.addEventListener('click', startEncryption);
    
    // QR actions
    if (DOM.qrDownload) {
        DOM.qrDownload.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `mnemoniqr-${Date.now()}.png`;
            link.href = DOM.qrCanvas.toDataURL('image/png', 1.0);
            link.click();
            showToast('QR downloaded', 'success');
        });
    }
    
    if (DOM.qrPdf) DOM.qrPdf.addEventListener('click', generatePDF);
    if (DOM.qrShare) DOM.qrShare.addEventListener('click', shareQR);
    
    if (DOM.qrDone) {
        DOM.qrDone.addEventListener('click', () => {
            goToStep('main');
            STATE.encryptedData = '';
            if (DOM.qrCanvas) {
                const ctx = DOM.qrCanvas.getContext('2d');
                ctx.clearRect(0, 0, DOM.qrCanvas.width, DOM.qrCanvas.height);
            }
        });
    }
    
    // Decrypt
    if (DOM.scanBtn) {
        DOM.scanBtn.addEventListener('click', async () => {
            openModal('password');
            // Limpiar estado previo
            STATE.encryptedData = '';
            STATE.qrImageData = null;
            if (DOM.decryptStatus) {
                DOM.decryptStatus.style.display = 'none';
                DOM.decryptStatus.className = 'decrypt-status';
            }
            if (DOM.decryptPassword) DOM.decryptPassword.value = '';
            await startScanner();
        });
    }
    
    if (DOM.uploadArea) {
        DOM.uploadArea.addEventListener('click', () => {
            if (DOM.qrFile) DOM.qrFile.click();
        });
        DOM.uploadArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (DOM.qrFile) DOM.qrFile.click();
            }
        });
    }
    
    if (DOM.qrFile) {
        DOM.qrFile.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                processFile(e.target.files[0]);
            }
        });
    }
    
    // Drag and drop
    if (DOM.uploadArea) {
        DOM.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.uploadArea.style.borderColor = 'var(--accent)';
            DOM.uploadArea.style.background = 'rgba(44,122,122,0.05)';
        });
        
        DOM.uploadArea.addEventListener('dragleave', () => {
            DOM.uploadArea.style.borderColor = '';
            DOM.uploadArea.style.background = '';
        });
        
        DOM.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.uploadArea.style.borderColor = '';
            DOM.uploadArea.style.background = '';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFile(e.dataTransfer.files[0]);
            }
        });
    }
    
    // Password modal
    if (DOM.decryptShowPassword) {
        DOM.decryptShowPassword.addEventListener('change', () => {
            if (DOM.decryptPassword) {
                DOM.decryptPassword.type = DOM.decryptShowPassword.checked ? 'text' : 'password';
            }
        });
    }
    
    if (DOM.decryptConfirm) DOM.decryptConfirm.addEventListener('click', decryptQR);
    
    if (DOM.decryptCancel) {
        DOM.decryptCancel.addEventListener('click', () => {
            stopScanner();
            closeModal('password');
        });
    }
    
    if (DOM.decryptPassword) {
        DOM.decryptPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                decryptQR();
            }
        });
    }
    
    // Decrypted actions
    if (DOM.decryptedCopy) {
        DOM.decryptedCopy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(STATE.decryptedSeed);
                showToast('Seed copied to clipboard', 'success');
            } catch {
                // Fallback: seleccionar y copiar manualmente
                const textarea = document.createElement('textarea');
                textarea.value = STATE.decryptedSeed;
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showToast('Seed copied to clipboard', 'success');
                } catch {
                    showToast('Failed to copy. Please select manually.', 'error');
                }
                document.body.removeChild(textarea);
            }
        });
    }
    
    if (DOM.decryptedHide) DOM.decryptedHide.addEventListener('click', hideDecryptedSeed);
    if (DOM.decryptedDone) DOM.decryptedDone.addEventListener('click', hideDecryptedSeed);
    
    // About
    if (DOM.aboutBtn) DOM.aboutBtn.addEventListener('click', () => openModal('about'));
    if (DOM.aboutClose) DOM.aboutClose.addEventListener('click', () => closeModal('about'));
    if (DOM.aboutGotIt) DOM.aboutGotIt.addEventListener('click', () => closeModal('about'));
    
    // Back buttons
    DOM.backButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.step;
            if (target === 'back') {
                // Preguntar si hay datos ingresados
                let hasData = false;
                if (STATE.step === 'seed' && DOM.seedInput && DOM.seedInput.value.trim().length > 0) {
                    hasData = true;
                }
                if (STATE.step === 'message' && DOM.messageInput && DOM.messageInput.value.trim().length > 0) {
                    hasData = true;
                }
                if (STATE.step === 'password' && DOM.passwordInput && DOM.passwordInput.value.length > 0) {
                    hasData = true;
                }
                
                if (hasData) {
                    if (!confirm('You have entered data. Are you sure you want to go back?')) {
                        return;
                    }
                }
                
                stopScanner();
                goToStep('main');
            } else {
                goToStep(target);
            }
        });
    });
    
    // Close modal on backdrop click
    document.querySelectorAll('.modal, .step-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const id = modal.id;
                if (id === 'password') {
                    stopScanner();
                    STATE.decryptionAttempts = 0;
                    if (DOM.decryptStatus) {
                        DOM.decryptStatus.style.display = 'none';
                        DOM.decryptStatus.className = 'decrypt-status';
                    }
                    STATE.encryptedData = '';
                    STATE.qrImageData = null;
                    if (DOM.decryptPassword) DOM.decryptPassword.value = '';
                }
                closeModal(id);
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (STATE.step === 'seed' && !DOM.seedNext.disabled) {
                DOM.seedNext.click();
            }
            if (STATE.step === 'message') {
                DOM.messageNext.click();
            }
            if (STATE.step === 'password' && !DOM.passwordNext.disabled) {
                DOM.passwordNext.click();
            }
        }
        // Ctrl+Enter en el campo de seed para confirmar
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && STATE.step === 'seed') {
            if (!DOM.seedNext.disabled) DOM.seedNext.click();
        }
    });
    
    // Visibility change - pausar timer
    document.addEventListener('visibilitychange', () => {
        STATE.isPaused = document.hidden;
        if (document.hidden && STATE.timerInterval) {
            // El timer se pausa automáticamente
        } else if (!document.hidden && STATE.step === 'decrypted' && STATE.decryptedSeed) {
            // Reanudar el timer si estaba pausado
            if (!STATE.timerInterval) {
                startTimer();
            }
        }
    });
    
    // Update char counter
    function updateCharCounter() {
        if (DOM.messageInput && DOM.charCounter) {
            const len = DOM.messageInput.value.length;
            DOM.charCounter.textContent = `${len}/255`;
        }
    }
    
    console.log('MnemoniQR initialized successfully');
}

// ============ START ============
document.addEventListener('DOMContentLoaded', init);

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    stopScanner();
    stopTimer();
    // Limpiar datos sensibles
    STATE.seed = '';
    STATE.password = '';
    STATE.decryptedSeed = '';
    STATE.encryptedData = '';
    STATE.qrImageData = null;
});
