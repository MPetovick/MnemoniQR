// ============================================================
// MnemoniQR – Secure Seed Backup (AAA edition - corrected)
// ============================================================
const CONFIG = {
    PBKDF2_ITERATIONS: 310000,
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    AES_KEY_LENGTH: 256,
    QR_SIZE: 220,
    MIN_PASSPHRASE_LENGTH: 12,
    QR_ERROR_CORRECTION: 'H',
    METADATA_VERSION: 2,
    METADATA_LENGTH: 128,
    MAX_USERMSG_BYTES: 116,
    MAX_MODIFICATION_COUNT: 255
};

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
    "potato","pottery","poverty","powder","power","practice","praise","predict","prefer","prepare",
    "present","pretty","prevent","price","pride","primary","print","priority","prison","private",
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

// ============ DOM References ============
const dom = {
    startBtn: document.getElementById('start-btn'),
    scanBtn: document.getElementById('scan-btn'),
    seedModal: document.getElementById('seed-modal'),
    scannerModal: document.getElementById('scanner-modal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),
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
    qrCanvas: document.getElementById('qr-canvas'),
    pdfBtn: document.getElementById('pdf-btn'),
    shareBtn: document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    toastContainer: document.getElementById('toast-container'),
    suggestionsContainer: document.getElementById('bip39-suggestions'),
    dropArea: document.getElementById('drop-area'),
    qrFile: document.getElementById('qr-file'),
    decryptSeedBtn: document.getElementById('decrypt-seed-btn'),
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
    spinnerMessage: document.getElementById('spinner-message'),
    passwordModal: document.getElementById('password-modal'),
    decryptPassword: document.getElementById('decrypt-password'),
    decryptPasswordToggle: document.getElementById('decrypt-password-toggle'),
    cancelDecryptBtn: document.getElementById('cancel-decrypt-btn'),
    closePasswordModal: document.getElementById('close-password-modal'),
    qrModal: document.getElementById('qr-modal'),
    closeQRModal: document.getElementById('close-qr-modal'),
    cameraStream: document.getElementById('camera-stream'),
    closeScanner: document.getElementById('close-scanner'),
    stopScanBtn: document.getElementById('stop-scan-btn'),
    switchCameraBtn: document.getElementById('switch-camera-btn'),
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
    bip39Warning: document.getElementById('bip39-warning'),
    failedAttemptsContainer: document.getElementById('failed-attempts-container'),
    lastFailedContainer: document.getElementById('last-failed-container'),
    qrWrapper: document.getElementById('qr-wrapper'),
    themeToggleIcon: document.querySelector('#theme-toggle i')  // añadido aquí para initTheme
};

// ============ App State ============
const appState = {
    wordsVisible: false,
    passwordVisible: false,
    seedPhrase: '',
    password: '',
    encryptedData: '',
    qrImageData: null,
    currentMetadata: null,
    scannerActive: false,
    scanTimer: null,
    videoTrack: null,
    facingMode: 'environment',
    decryptionAttempts: 0,
    currentWordIndex: -1,
    currentWordPartial: ''
};

// ============ Crypto Utils ============
const cryptoUtils = {
    async _deriveKey(passphrase, salt) {
        const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: CONFIG.PBKDF2_ITERATIONS, hash: 'SHA-256' },
            baseKey,
            CONFIG.AES_KEY_LENGTH
        );
        return crypto.subtle.importKey('raw', derivedBits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    },
    createMetadata(userMessage = '') {
        const now = new Date();
        return { version: CONFIG.METADATA_VERSION, modificationCount: 0, timestamp: now, userMessage: userMessage.slice(0, 255), failedAttempts: 0, lastFailedAttempt: null };
    },
    serializeMetadata(metadata) {
        const buf = new ArrayBuffer(CONFIG.METADATA_LENGTH);
        const view = new DataView(buf);
        let offset = 0;
        view.setUint8(offset++, metadata.version);
        view.setUint8(offset++, metadata.modificationCount);
        view.setUint32(offset, Math.floor(metadata.timestamp.getTime() / 1000), false);
        offset += 4;
        const encoder = new TextEncoder();
        let msgBytes = encoder.encode(metadata.userMessage || '');
        if (msgBytes.length > CONFIG.MAX_USERMSG_BYTES) msgBytes = msgBytes.slice(0, CONFIG.MAX_USERMSG_BYTES);
        view.setUint8(offset++, msgBytes.length);
        view.setUint8(offset++, metadata.failedAttempts || 0);
        view.setUint32(offset, metadata.lastFailedAttempt ? Math.floor(metadata.lastFailedAttempt.getTime() / 1000) : 0, false);
        offset += 4;
        for (let i = 0; i < msgBytes.length; i++) view.setUint8(offset++, msgBytes[i]);
        while (offset < CONFIG.METADATA_LENGTH) view.setUint8(offset++, 0);
        return new Uint8Array(buf);
    },
    deserializeMetadata(data) {
        const view = new DataView(data.buffer, data.byteOffset, CONFIG.METADATA_LENGTH);
        let offset = 0;
        const version = view.getUint8(offset++);
        if (version > CONFIG.METADATA_VERSION) throw new Error('Unsupported metadata version');
        const modificationCount = view.getUint8(offset++);
        const timestamp = new Date(view.getUint32(offset, false) * 1000); offset += 4;
        const userMessageLength = view.getUint8(offset++);
        const failedAttempts = view.getUint8(offset++);
        const lastFailedAttemptTimestamp = view.getUint32(offset, false); offset += 4;
        const msgBytes = new Uint8Array(data.buffer, data.byteOffset + offset, userMessageLength);
        const userMessage = new TextDecoder().decode(msgBytes);
        return { version, modificationCount, timestamp, userMessage, userMessageLength, failedAttempts, lastFailedAttempt: lastFailedAttemptTimestamp ? new Date(lastFailedAttemptTimestamp * 1000) : null, isValid: true };
    },
    async encryptMessage(message, passphrase, userMessage = '') {
        const metadata = this.createMetadata(userMessage);
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        const aesKey = await this._deriveKey(passphrase, salt);
        const metadataBytes = this.serializeMetadata(metadata);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: metadataBytes, tagLength: 128 }, aesKey, new TextEncoder().encode(message));
        const ciphertext = new Uint8Array(encrypted);
        const combined = new Uint8Array(CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH + ciphertext.length);
        combined.set(metadataBytes, 0);
        combined.set(salt, CONFIG.METADATA_LENGTH);
        combined.set(iv, CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH);
        combined.set(ciphertext, CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
        return btoa(String.fromCharCode(...combined));
    },
    async decryptMessage(encryptedBase64, passphrase) {
        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const metadataBytes = encryptedData.slice(0, CONFIG.METADATA_LENGTH);
        const salt = encryptedData.slice(CONFIG.METADATA_LENGTH, CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH);
        const iv = encryptedData.slice(CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH, CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
        const ciphertext = encryptedData.slice(CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
        const aesKey = await this._deriveKey(passphrase, salt);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: metadataBytes, tagLength: 128 }, aesKey, ciphertext);
        const seed = new TextDecoder().decode(decrypted);
        const metadata = this.deserializeMetadata(metadataBytes);
        return { seed, metadata };
    },
    async encryptWithMetadata(message, passphrase, metadata) {
        const salt = crypto.getRandomValues(new Uint8Array(CONFIG.SALT_LENGTH));
        const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_LENGTH));
        const aesKey = await this._deriveKey(passphrase, salt);
        const metadataBytes = this.serializeMetadata(metadata);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: metadataBytes, tagLength: 128 }, aesKey, new TextEncoder().encode(message));
        const ciphertext = new Uint8Array(encrypted);
        const combined = new Uint8Array(CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH + ciphertext.length);
        combined.set(metadataBytes, 0);
        combined.set(salt, CONFIG.METADATA_LENGTH);
        combined.set(iv, CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH);
        combined.set(ciphertext, CONFIG.METADATA_LENGTH + CONFIG.SALT_LENGTH + CONFIG.IV_LENGTH);
        return btoa(String.fromCharCode(...combined));
    }
};

// ============ BIP39 Checksum Validation ============
function validateBIP39Checksum(words) {
    if (![12,18,24].includes(words.length)) return false;
    const bits = words.map(w => BIP39_WORDS.indexOf(w).toString(2).padStart(11, '0')).join('');
    const cs = words.length / 3;
    const entropyBits = bits.slice(0, -cs);
    const checksumBits = bits.slice(-cs);
    const entropyBytes = new Uint8Array(entropyBits.match(/.{1,8}/g).map(b => parseInt(b, 2)));
    return crypto.subtle.digest('SHA-256', entropyBytes).then(hash => {
        const hashBytes = new Uint8Array(hash);
        const firstByte = hashBytes[0];
        const computedChecksum = firstByte.toString(2).padStart(8, '0').slice(0, cs);
        return computedChecksum === checksumBits;
    });
}

// ============ UI Helpers ============
function showToast(message, type = 'info') {
    const icons = { error: 'fa-exclamation-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 5000);
}

function showSpinner(show, message = 'Processing…') {
    dom.spinnerOverlay.style.display = show ? 'flex' : 'none';
    if (message) dom.spinnerMessage.textContent = message;
}

function updateSpinnerMessage(msg) {
    dom.spinnerMessage.textContent = msg;
}

function sanitizeAndWipe() {
    appState.seedPhrase = '';
    appState.password = '';
    appState.encryptedData = '';
    if (dom.decryptedSeed) dom.decryptedSeed.value = '';
    if (dom.password) dom.password.value = '';
    if (dom.decryptPassword) dom.decryptPassword.value = '';
}

// ============ Modals (with Escape support) ============
function openModal(modal) {
    modal.style.display = 'flex';
    document.addEventListener('keydown', onEscapeKey);
}
function closeModal(modal) {
    modal.style.display = 'none';
    document.removeEventListener('keydown', onEscapeKey);
    sanitizeAndWipe();
}
function onEscapeKey(e) {
    if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal[style*="display: flex"]');
        if (visibleModal) closeModal(visibleModal);
    }
}

function resetModalState() {
    dom.seedPhrase.value = '';
    dom.password.value = '';
    dom.userMessage.value = '';
    dom.messageChars.textContent = '0';
    dom.wordCounter.textContent = '0 words';
    dom.encryptBtn.disabled = true;
    dom.passwordStrengthBar.style.width = '0%';
    dom.passwordStrengthText.textContent = 'Security: Very weak';
    hideSuggestions();
}

// ============ Theme Toggle ============
function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.setAttribute('data-theme', 'dark');
        dom.themeToggleIcon.className = 'fas fa-sun';
    } else {
        document.body.removeAttribute('data-theme');
        dom.themeToggleIcon.className = 'fas fa-moon';
    }
}
function toggleTheme() {
    const isDark = document.body.hasAttribute('data-theme');
    if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        dom.themeToggleIcon.className = 'fas fa-moon';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        dom.themeToggleIcon.className = 'fas fa-sun';
    }
}

// ============ Seed Input & Suggestions ============
function handleSeedInput() {
    const text = dom.seedPhrase.value;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    dom.wordCounter.textContent = `${words.length} words`;
    const validCounts = [12,18,24].includes(words.length);
    dom.encryptBtn.disabled = !validCounts;

    if (validCounts) {
        validateBIP39Checksum(words).then(valid => {
            dom.bip39Warning.style.display = valid ? 'none' : 'flex';
        });
    } else {
        dom.bip39Warning.style.display = 'none';
    }

    const pos = dom.seedPhrase.selectionStart;
    let idx = 0, charCount = 0;
    for (let i = 0; i < words.length; i++) {
        charCount += words[i].length + 1;
        if (pos <= charCount) { idx = i; break; }
    }
    appState.currentWordPartial = words[idx] || '';
    if (appState.currentWordPartial.length > 1) {
        showBIP39Suggestions(appState.currentWordPartial);
    } else {
        hideSuggestions();
    }
}

function showBIP39Suggestions(partial) {
    if (partial.length < 2) { hideSuggestions(); return; }
    const lower = partial.toLowerCase();
    const matches = BIP39_WORDS.filter(w => w.startsWith(lower)).slice(0, 5);
    if (matches.length === 0) { hideSuggestions(); return; }
    dom.suggestionsContainer.innerHTML = '';
    matches.forEach(word => {
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
    const idx = appState.currentWordIndex >= 0 ? appState.currentWordIndex : words.length - 1;
    if (idx >= 0 && idx < words.length) {
        words[idx] = word;
        dom.seedPhrase.value = words.join(' ');
        dom.seedPhrase.dispatchEvent(new Event('input', { bubbles: true }));
    }
    hideSuggestions();
}

// ============ Password Strength ============
function updatePasswordStrength() {
    const pwd = dom.password.value;
    let strength = 0;
    strength += Math.min(pwd.length * 4, 40);
    if (/[A-Z]/.test(pwd)) strength += 10;
    if (/[a-z]/.test(pwd)) strength += 10;
    if (/[0-9]/.test(pwd)) strength += 10;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 15;
    strength = Math.min(100, Math.max(0, strength));
    dom.passwordStrengthBar.style.width = `${strength}%`;
    const levels = [{ min: 80, text: 'Very strong' }, { min: 60, text: 'Strong' }, { min: 40, text: 'Moderate' }];
    const level = levels.find(l => strength >= l.min)?.text || 'Very weak';
    dom.passwordStrengthText.textContent = `Security: ${level}`;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    let pwd = '';
    for (let i = 0; i < array.length; i++) pwd += chars[array[i] % chars.length];
    if (!/[A-Z]/.test(pwd)) pwd = 'A' + pwd.slice(1);
    if (!/[a-z]/.test(pwd)) pwd = pwd.slice(0, -1) + 'a';
    if (!/[0-9]/.test(pwd)) pwd = pwd.slice(0, -1) + '1';
    if (!/[^A-Za-z0-9]/.test(pwd)) pwd = pwd.slice(0, -1) + '!';
    dom.password.value = pwd;
    updatePasswordStrength();
    showToast('Secure password generated', 'success');
}

// ============ Encryption Flow ============
async function startEncryption() {
    const words = dom.seedPhrase.value.trim().split(/\s+/);
    if (![12,18,24].includes(words.length)) return showToast('Seed must be 12, 18 or 24 words', 'error');
    if (dom.password.value.length < CONFIG.MIN_PASSPHRASE_LENGTH) return showToast(`Password min ${CONFIG.MIN_PASSPHRASE_LENGTH} chars`, 'error');

    appState.seedPhrase = words.join(' ');
    appState.password = dom.password.value;

    try {
        showSpinner(true, 'Deriving encryption key…');
        await new Promise(resolve => setTimeout(resolve, 100));
        updateSpinnerMessage('Encrypting seed phrase…');
        const userMessage = dom.userMessage ? dom.userMessage.value : '';
        const encrypted = await cryptoUtils.encryptMessage(appState.seedPhrase, appState.password, userMessage);
        updateSpinnerMessage('Generating QR code…');
        appState.encryptedData = encrypted;
        await generateQR(encrypted);
        closeModal(dom.seedModal);
        openModal(dom.qrModal);
        showToast('Seed encrypted successfully', 'success');
    } catch (e) {
        showToast('Encryption failed: ' + e.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function generateQR(data) {
    return new Promise(resolve => {
        dom.qrCanvas.width = CONFIG.QR_SIZE;
        dom.qrCanvas.height = CONFIG.QR_SIZE;
        QRCode.toCanvas(dom.qrCanvas, data, {
            width: CONFIG.QR_SIZE,
            margin: 2,
            color: { dark: '#000', light: '#fff' },
            errorCorrectionLevel: CONFIG.QR_ERROR_CORRECTION
        }, resolve);
    });
}

// ============ Decryption ============
function showPasswordModal() {
    if (!appState.encryptedData && !appState.qrImageData) return showToast('First load a QR code', 'error');
    openModal(dom.passwordModal);
    dom.decryptPassword.focus();
}

async function decryptQR() {
    const password = dom.decryptPassword.value;
    if (!password) return showToast('Password required', 'error');

    let encrypted = appState.encryptedData;
    if (!encrypted && appState.qrImageData) {
        const img = new Image();
        img.src = appState.qrImageData;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (!code) throw new Error('No QR code found');
        encrypted = code.data;
    }
    if (!encrypted) throw new Error('No QR data');

    const delay = Math.min(100 * Math.pow(2, appState.decryptionAttempts), 3000);
    await new Promise(res => setTimeout(res, delay));

    try {
        showSpinner(true, 'Decrypting…');
        const result = await cryptoUtils.decryptMessage(encrypted, password);
        appState.decryptionAttempts = 0;
        showDecryptedSeed(result.seed, result.metadata);
        closeModal(dom.passwordModal);
        showToast('Decryption successful', 'success');
    } catch (e) {
        appState.decryptionAttempts++;
        showToast('Decryption failed: ' + e.message, 'error');
    } finally {
        showSpinner(false);
    }
}

function showDecryptedSeed(seed, metadata) {
    const words = seed.split(' ');
    dom.decryptedSeed.value = seed;
    dom.wordCount.textContent = `${words.length} words`;
    dom.seedWordsContainer.innerHTML = words.map((w,i) => `<div class="seed-word" data-index="${i+1}">${w}</div>`).join('');

    if (metadata) {
        dom.metadataVersion.textContent = metadata.version;
        dom.metadataCreated.textContent = metadata.timestamp.toLocaleString();
        dom.metadataModifications.textContent = metadata.modificationCount;
        dom.failedAttemptsContainer.style.display = metadata.failedAttempts > 0 ? 'flex' : 'none';
        dom.metadataFailedAttempts.textContent = metadata.failedAttempts;
        dom.lastFailedContainer.style.display = metadata.lastFailedAttempt ? 'flex' : 'none';
        dom.metadataLastAttempt.textContent = metadata.lastFailedAttempt?.toLocaleString() || '';
        dom.userMessageContainer.style.display = metadata.userMessage ? 'flex' : 'none';
        dom.metadataUserMessage.textContent = metadata.userMessage;
        appState.currentMetadata = metadata;
    }
    openModal(dom.decryptedModal);
}

async function copySeedToClipboard() {
    try {
        await navigator.clipboard.writeText(dom.decryptedSeed.value);
        showToast('Seed copied to clipboard', 'success');
    } catch {
        showToast('Copy failed', 'error');
    }
}

// ============ Update QR ============
async function updateEncryptedQR(newSeed, newMessage = '') {
    if (!appState.encryptedData || !appState.password) throw new Error('No active QR session');
    try {
        showSpinner(true, 'Updating QR…');
        const oldResult = await cryptoUtils.decryptMessage(appState.encryptedData, appState.password);
        const newMetadata = { ...oldResult.metadata, modificationCount: Math.min(oldResult.metadata.modificationCount+1, 255), userMessage: newMessage, failedAttempts: 0, lastFailedAttempt: null };
        const encrypted = await cryptoUtils.encryptWithMetadata(newSeed, appState.password, newMetadata);
        appState.encryptedData = encrypted;
        await generateQR(encrypted);
        showToast(`QR updated (v${newMetadata.modificationCount})`, 'success');
    } catch (e) {
        showToast('Update failed: ' + e.message, 'error');
        throw e;
    } finally {
        showSpinner(false);
    }
}

// ============ QR Export ============
function downloadQRAsPNG() {
    if (!appState.encryptedData) return showToast('No QR generated', 'error');
    const link = document.createElement('a');
    link.download = `mnemoniqr-${Date.now()}.png`;
    link.href = dom.qrCanvas.toDataURL('image/png');
    link.click();
    showToast('QR downloaded', 'success');
}

async function shareQR() {
    if (!appState.encryptedData) return;
    dom.qrCanvas.toBlob(async blob => {
        if (navigator.share) {
            try { await navigator.share({ files: [new File([blob], 'seed-backup.png', { type: 'image/png' })] }); } catch {}
        } else {
            try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); showToast('QR copied to clipboard', 'success'); } catch { showToast('Sharing not supported', 'warning'); }
        }
    });
}

function generatePDF() {
    if (!appState.encryptedData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const w = doc.internal.pageSize.getWidth(), cx = w/2;
    doc.setFillColor(245,245,245); doc.rect(0,0,w,doc.internal.pageSize.getHeight(),'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Secure Seed Backup', cx, 25, null, null, 'center');
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.text('AES-256-GCM encrypted', cx, 32, null, null, 'center');
    const qrData = dom.qrCanvas.toDataURL('image/png');
    doc.addImage(qrData, 'PNG', cx-40, 50, 80, 80);
    doc.setFontSize(9); doc.text('Password required for decryption', cx, 50+80+15, null, null, 'center');
    doc.save(`mnemoniqr-backup-${Date.now()}.pdf`);
    showToast('PDF generated', 'success');
}

// ============ File Handling ============
function triggerFileSelect() { dom.qrFile.click(); }
function handleFileSelect(e) { if (e.target.files.length) processFile(e.target.files[0]); }
function handleDragOver(e) { e.preventDefault(); dom.dropArea.classList.add('drag-over'); }
function handleDragLeave() { dom.dropArea.classList.remove('drag-over'); }
function handleDrop(e) {
    e.preventDefault();
    dom.dropArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
}
function processFile(file) {
    if (!file.type.match('image.*')) return showToast('Please select an image', 'error');
    const reader = new FileReader();
    reader.onload = e => {
        appState.qrImageData = e.target.result;
        appState.encryptedData = '';
        dom.qrFile.value = '';
        showToast('Image loaded', 'success');
        showPasswordModal();
    };
    reader.readAsDataURL(file);
}

// ============ Scanner ============
function openScannerModal() {
    if (!navigator.mediaDevices?.getUserMedia) return showToast('Camera not supported', 'error');
    openModal(dom.scannerModal);
    startScanner(appState.facingMode);
}

async function startScanner(facingMode) {
    if (appState.videoTrack) appState.videoTrack.stop();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } } });
        appState.videoTrack = stream.getVideoTracks()[0];
        dom.cameraStream.srcObject = stream;
        appState.scannerActive = true;
        scanLoop();
        showToast('Camera activated', 'success');
    } catch (e) {
        showToast('Camera error: ' + e.message, 'error');
        closeScannerModal();
    }
}

function scanLoop() {
    if (!appState.scannerActive) return;
    const video = dom.cameraStream;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) { requestAnimationFrame(scanLoop); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth * 0.5;
    canvas.height = video.videoHeight * 0.5;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);
    if (code) {
        handleScannedData(code.data);
        return;
    }
    appState.scanTimer = requestAnimationFrame(scanLoop);
}

function handleScannedData(encryptedBase64) {
    closeScannerModal();
    appState.qrImageData = null;
    appState.encryptedData = encryptedBase64;
    showToast('QR scanned', 'success');
    showPasswordModal();
}

function closeScannerModal() {
    appState.scannerActive = false;
    if (appState.scanTimer) cancelAnimationFrame(appState.scanTimer);
    if (appState.videoTrack) { appState.videoTrack.stop(); appState.videoTrack = null; }
    dom.cameraStream.srcObject = null;
    closeModal(dom.scannerModal);
}

function switchCamera() {
    appState.facingMode = appState.facingMode === 'environment' ? 'user' : 'environment';
    startScanner(appState.facingMode);
}

// ============ Message Counter ============
function updateMessageCounter() {
    const len = dom.userMessage.value.length;
    dom.messageChars.textContent = len;
    dom.messageChars.style.color = len > 200 ? 'var(--warning-color)' : len > 100 ? 'var(--accent-color)' : '#666';
}

// ============ Event Listeners ============
function initEventListeners() {
    dom.startBtn.addEventListener('click', () => openModal(dom.seedModal));
    dom.scanBtn.addEventListener('click', openScannerModal);
    dom.cancelBtn.addEventListener('click', () => closeModal(dom.seedModal));
    dom.closeModalBtns.forEach(btn => btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) closeModal(modal);
    }));
    dom.seedPhrase.addEventListener('input', handleSeedInput);
    dom.toggleVisibility.addEventListener('click', () => {
        appState.wordsVisible = !appState.wordsVisible;
        dom.seedPhrase.type = appState.wordsVisible ? 'text' : 'password';
        dom.toggleVisibility.innerHTML = appState.wordsVisible ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
    dom.passwordToggle.addEventListener('click', () => {
        appState.passwordVisible = !appState.passwordVisible;
        dom.password.type = appState.passwordVisible ? 'text' : 'password';
        dom.passwordToggle.innerHTML = appState.passwordVisible ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
    dom.password.addEventListener('input', updatePasswordStrength);
    dom.generatePassword.addEventListener('click', generateSecurePassword);
    dom.encryptBtn.addEventListener('click', startEncryption);
    dom.pdfBtn.addEventListener('click', generatePDF);
    dom.shareBtn.addEventListener('click', shareQR);
    dom.downloadBtn.addEventListener('click', downloadQRAsPNG);
    dom.dropArea.addEventListener('click', triggerFileSelect);
    dom.qrFile.addEventListener('change', handleFileSelect);
    dom.decryptSeedBtn.addEventListener('click', decryptQR);
    dom.copySeed.addEventListener('click', copySeedToClipboard);
    dom.closeDecrypted.addEventListener('click', () => closeModal(dom.decryptedModal));
    dom.closeDecryptedBtn.addEventListener('click', () => closeModal(dom.decryptedModal));
    dom.closeWelcome.addEventListener('click', () => closeModal(dom.welcomeModal));
    dom.acceptWelcome.addEventListener('click', () => closeModal(dom.welcomeModal));
    dom.closeQRModal.addEventListener('click', () => closeModal(dom.qrModal));
    dom.closeScanner.addEventListener('click', closeScannerModal);
    dom.stopScanBtn.addEventListener('click', closeScannerModal);
    dom.switchCameraBtn.addEventListener('click', switchCamera);
    dom.cancelDecryptBtn.addEventListener('click', () => closeModal(dom.passwordModal));
    dom.closePasswordModal.addEventListener('click', () => closeModal(dom.passwordModal));
    dom.decryptPasswordToggle.addEventListener('click', () => {
        const isVisible = dom.decryptPassword.type === 'text';
        dom.decryptPassword.type = isVisible ? 'password' : 'text';
        dom.decryptPasswordToggle.innerHTML = isVisible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
    dom.dropArea.addEventListener('dragover', handleDragOver);
    dom.dropArea.addEventListener('dragleave', handleDragLeave);
    dom.dropArea.addEventListener('drop', handleDrop);
    document.addEventListener('click', e => {
        if (!dom.seedPhrase.contains(e.target) && !dom.suggestionsContainer.contains(e.target)) hideSuggestions();
    });
    if (dom.userMessage) dom.userMessage.addEventListener('input', updateMessageCounter);
    if (dom.updateQrBtn) dom.updateQrBtn.addEventListener('click', async () => {
        const newSeed = dom.decryptedSeed.value;
        const newMsg = dom.userMessage?.value || '';
        await updateEncryptedQR(newSeed, newMsg);
        closeModal(dom.decryptedModal);
        openModal(dom.qrModal);
    });

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

// ============ Initialization ============
window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initTheme();
    openModal(dom.welcomeModal);
});
