#!/usr/bin/env node
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// --- Password Hashing ---
function hashPassword(password, salt) {
  const key = crypto.scryptSync(password, salt, 64);
  return key.toString('hex');
}

function setPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

function verifyPassword(password, stored) {
  const hash = hashPassword(password, Buffer.from(stored.salt, 'hex'));
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(stored.hash, 'hex'));
}

function promptPassword(message = '  Password: ') {
  return new Promise((resolve) => {
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdout.write(message);
    let password = '';
    const onData = (buf) => {
      for (const byte of buf) {
        const c = String.fromCharCode(byte);
        if (c === '\n' || c === '\r') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
          process.stdout.write('\n');
          resolve(password);
          return;
        } else if (c === '\u007F' || c === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c === '\u0003') {
          if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
          process.exit();
        } else {
          password += c;
          process.stdout.write('\u2022');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

// --- Bundled BIP39 Wordlist (2048 words) ---
const WORDLIST = ['abandon','ability','able','about','above','absent','absorb','abstract','absurd','abuse','access','accident','account','accuse','achieve','acid','acoustic','acquire','across','act','action','actor','actress','actual','adapt','add','addict','address','adjust','admit','adult','advance','advice','aerobic','affair','afford','afraid','again','age','agent','agree','ahead','aim','air','airport','aisle','alarm','album','alcohol','alert','alien','all','alley','allow','almost','alone','alpha','already','also','alter','always','amateur','amazing','among','amount','amused','analyst','anchor','ancient','anger','angle','angry','animal','ankle','announce','annual','another','answer','antenna','antique','anxiety','any','apart','apology','appear','apple','approve','april','arch','arctic','area','arena','argue','arm','armed','armor','army','around','arrange','arrest','arrive','arrow','art','artefact','artist','artwork','ask','aspect','assault','asset','assist','assume','asthma','athlete','atom','attack','attend','attitude','attract','auction','audit','august','aunt','author','auto','autumn','average','avocado','avoid','awake','aware','away','awesome','awful','awkward','axis','baby','bachelor','bacon','badge','bag','balance','balcony','ball','bamboo','banana','banner','bar','barely','bargain','barrel','base','basic','basket','battle','beach','bean','beauty','because','become','beef','before','begin','behave','behind','believe','below','belt','bench','benefit','best','betray','better','between','beyond','bicycle','bid','bike','bind','biology','bird','birth','bitter','black','blade','blame','blanket','blast','bleak','bless','blind','blood','blossom','blouse','blue','blur','blush','board','boat','body','boil','bomb','bone','bonus','book','boost','border','boring','borrow','boss','bottom','bounce','box','boy','bracket','brain','brand','brass','brave','bread','breeze','brick','bridge','brief','bright','bring','brisk','broccoli','broken','bronze','broom','brother','brown','brush','bubble','buddy','budget','buffalo','build','bulb','bulk','bullet','bundle','bunker','burden','burger','burst','bus','business','busy','butter','buyer','buzz','cabbage','cabin','cable','cactus','cage','cake','call','calm','camera','camp','can','canal','cancel','candy','cannon','canoe','canvas','canyon','capable','capital','captain','car','carbon','card','cargo','carpet','carry','cart','case','cash','casino','castle','casual','cat','catalog','catch','category','cattle','caught','cause','caution','cave','ceiling','celery','cement','census','century','cereal','certain','chair','chalk','champion','change','chaos','chapter','charge','chase','chat','cheap','check','cheese','chef','cherry','chest','chicken','chief','child','chimney','choice','choose','chronic','chuckle','chunk','churn','cigar','cinnamon','circle','citizen','city','civil','claim','clap','clarify','claw','clay','clean','clerk','clever','click','client','cliff','climb','clinic','clip','clock','clog','close','cloth','cloud','clown','club','clump','cluster','clutch','coach','coast','coconut','code','coffee','coil','coin','collect','color','column','combine','come','comfort','comic','common','company','concert','conduct','confirm','congress','connect','consider','control','convince','cook','cool','copper','copy','coral','core','corn','correct','cost','cotton','couch','country','couple','course','cousin','cover','coyote','crack','cradle','craft','cram','crane','crash','crater','crawl','crazy','cream','credit','creek','crew','cricket','crime','crisp','critic','crop','cross','crouch','crowd','crucial','cruel','cruise','crumble','crunch','crush','cry','crystal','cube','culture','cup','cupboard','curious','current','curtain','curve','cushion','custom','cute','cycle','dad','damage','damp','dance','danger','daring','dash','daughter','dawn','day','deal','debate','debris','decade','december','decide','decline','decorate','decrease','deer','defense','define','defy','degree','delay','deliver','demand','demise','denial','dentist','deny','depart','depend','deposit','depth','deputy','derive','describe','desert','design','desk','despair','destroy','detail','detect','develop','device','devote','diagram','dial','diamond','diary','dice','diesel','diet','differ','digital','dignity','dilemma','dinner','dinosaur','direct','dirt','disagree','discover','disease','dish','dismiss','disorder','display','distance','divert','divide','divorce','dizzy','doctor','document','dog','doll','dolphin','domain','donate','donkey','donor','door','dose','double','dove','draft','dragon','drama','drastic','draw','dream','dress','drift','drill','drink','drip','drive','drop','drum','dry','duck','dumb','dune','during','dust','dutch','duty','dwarf','dynamic','eager','eagle','early','earn','earth','easily','east','easy','echo','ecology','economy','edge','edit','educate','effort','egg','eight','either','elbow','elder','electric','elegant','element','elephant','elevator','elite','else','embark','embody','embrace','emerge','emotion','employ','empower','empty','enable','enact','end','endless','endorse','enemy','energy','enforce','engage','engine','enhance','enjoy','enlist','enough','enrich','enroll','ensure','enter','entire','entry','envelope','episode','equal','equip','era','erase','erode','erosion','error','erupt','escape','essay','essence','estate','eternal','ethics','evidence','evil','evoke','evolve','exact','example','excess','exchange','excite','exclude','excuse','execute','exercise','exhaust','exhibit','exile','exist','exit','exotic','expand','expect','expire','explain','expose','express','extend','extra','eye','eyebrow','fabric','face','faculty','fade','faint','faith','fall','false','fame','family','famous','fan','fancy','fantasy','farm','fashion','fat','fatal','father','fatigue','fault','favorite','feature','february','federal','fee','feed','feel','female','fence','festival','fetch','fever','few','fiber','fiction','field','figure','file','film','filter','final','find','fine','finger','finish','fire','firm','first','fiscal','fish','fit','fitness','fix','flag','flame','flash','flat','flavor','flee','flight','flip','float','flock','floor','flower','fluid','flush','fly','foam','focus','fog','foil','fold','follow','food','foot','force','forest','forget','fork','fortune','forum','forward','fossil','foster','found','fox','fragile','frame','frequent','fresh','friend','fringe','frog','front','frost','frown','frozen','fruit','fuel','fun','funny','furnace','fury','future','gadget','gain','galaxy','gallery','game','gap','garage','garbage','garden','garlic','garment','gas','gasp','gate','gather','gauge','gaze','general','genius','genre','gentle','genuine','gesture','ghost','giant','gift','giggle','ginger','giraffe','girl','give','glad','glance','glare','glass','glide','glimpse','globe','gloom','glory','glove','glow','glue','goat','goddess','gold','good','goose','gorilla','gospel','gossip','govern','gown','grab','grace','grain','grant','grape','grass','gravity','great','green','grid','grief','grit','grocery','group','grow','grunt','guard','guess','guide','guilt','guitar','gun','gym','habit','hair','half','hammer','hamster','hand','happy','harbor','hard','harsh','harvest','hat','have','hawk','hazard','head','health','heart','heavy','hedgehog','height','hello','helmet','help','hen','hero','hidden','high','hill','hint','hip','hire','history','hobby','hockey','hold','hole','holiday','hollow','home','honey','hood','hope','horn','horror','horse','hospital','host','hotel','hour','hover','hub','huge','human','humble','humor','hundred','hungry','hunt','hurdle','hurry','hurt','husband','hybrid','ice','icon','idea','identify','idle','ignore','ill','illegal','illness','image','imitate','immense','immune','impact','impose','improve','impulse','inch','include','income','increase','index','indicate','indoor','industry','infant','inflict','inform','inhale','inherit','initial','inject','injury','inmate','inner','innocent','input','inquiry','insane','insect','inside','inspire','install','intact','interest','into','invest','invite','involve','iron','island','isolate','issue','item','ivory','jacket','jaguar','jar','jazz','jealous','jeans','jelly','jewel','job','join','joke','journey','joy','judge','juice','jump','jungle','junior','junk','just','kangaroo','keen','keep','ketchup','key','kick','kid','kidney','kind','kingdom','kiss','kit','kitchen','kite','kitten','kiwi','knee','knife','knock','know','lab','label','labor','ladder','lady','lake','lamp','language','laptop','large','later','latin','laugh','laundry','lava','law','lawn','lawsuit','layer','lazy','leader','leaf','learn','leave','lecture','left','leg','legal','legend','leisure','lemon','lend','length','lens','leopard','lesson','letter','level','liar','liberty','library','license','life','lift','light','like','limb','limit','link','lion','liquid','list','little','live','lizard','load','loan','lobster','local','lock','logic','lonely','long','loop','lottery','loud','lounge','love','loyal','lucky','luggage','lumber','lunar','lunch','luxury','lyrics','machine','mad','magic','magnet','maid','mail','main','major','make','mammal','man','manage','mandate','mango','mansion','manual','maple','marble','march','margin','marine','market','marriage','mask','mass','master','match','material','math','matrix','matter','maximum','maze','meadow','mean','measure','meat','mechanic','medal','media','melody','melt','member','memory','mention','menu','mercy','merge','merit','merry','mesh','message','metal','method','middle','midnight','milk','million','mimic','mind','minimum','minor','minute','miracle','mirror','misery','miss','mistake','mix','mixed','mixture','mobile','model','modify','mom','moment','monitor','monkey','monster','month','moon','moral','more','morning','mosquito','mother','motion','motor','mountain','mouse','move','movie','much','muffin','mule','multiply','muscle','museum','mushroom','music','must','mutual','myself','mystery','myth','naive','name','napkin','narrow','nasty','nation','nature','near','neck','need','negative','neglect','neither','nephew','nerve','nest','net','network','neutral','never','news','next','nice','night','noble','noise','nominee','noodle','normal','north','nose','notable','note','nothing','notice','novel','now','nuclear','number','nurse','nut','oak','obey','object','oblige','obscure','observe','obtain','obvious','occur','ocean','october','odor','off','offer','office','often','oil','okay','old','olive','olympic','omit','once','one','onion','online','only','open','opera','opinion','oppose','option','orange','orbit','orchard','order','ordinary','organ','orient','original','orphan','ostrich','other','outdoor','outer','output','outside','oval','oven','over','own','owner','oxygen','oyster','ozone','pact','paddle','page','pair','palace','palm','panda','panel','panic','panther','paper','parade','parent','park','parrot','party','pass','patch','path','patient','patrol','pattern','pause','pave','payment','peace','peanut','pear','peasant','pelican','pen','penalty','pencil','people','pepper','perfect','permit','person','pet','phone','photo','phrase','physical','piano','picnic','picture','piece','pig','pigeon','pill','pilot','pink','pioneer','pipe','pistol','pitch','pizza','place','planet','plastic','plate','play','please','pledge','pluck','plug','plunge','poem','poet','point','polar','pole','police','pond','pony','pool','popular','portion','position','possible','post','potato','pottery','poverty','powder','power','practice','praise','predict','prefer','prepare','present','pretty','prevent','price','pride','primary','print','priority','prison','private','prize','problem','process','produce','profit','program','project','promote','proof','property','prosper','protect','proud','provide','public','pudding','pull','pulp','pulse','pumpkin','punch','pupil','puppy','purchase','purity','purpose','purse','push','put','puzzle','pyramid','quality','quantum','quarter','question','quick','quit','quiz','quote','rabbit','raccoon','race','rack','radar','radio','rail','rain','raise','rally','ramp','ranch','random','range','rapid','rare','rate','rather','raven','raw','razor','ready','real','reason','rebel','rebuild','recall','receive','recipe','record','recycle','reduce','reflect','reform','refuse','region','regret','regular','reject','relax','release','relief','rely','remain','remember','remind','remove','render','renew','rent','reopen','repair','repeat','replace','report','require','rescue','resemble','resist','resource','response','result','retire','retreat','return','reunion','reveal','review','reward','rhythm','rib','ribbon','rice','rich','ride','ridge','rifle','right','rigid','ring','riot','ripple','risk','ritual','rival','river','road','roast','robot','robust','rocket','romance','roof','rookie','room','rose','rotate','rough','round','route','royal','rubber','rude','rug','rule','run','runway','rural','sad','saddle','sadness','safe','sail','salad','salmon','salon','salt','salute','same','sample','sand','satisfy','satoshi','sauce','sausage','save','say','scale','scan','scare','scatter','scene','scheme','school','science','scissors','scorpion','scout','scrap','screen','script','scrub','sea','search','season','seat','second','secret','section','security','seed','seek','segment','select','sell','seminar','senior','sense','sentence','series','service','session','settle','setup','seven','shadow','shaft','shallow','share','shed','shell','sheriff','shield','shift','shine','ship','shiver','shock','shoe','shoot','shop','short','shoulder','shove','shrimp','shrug','shuffle','shy','sibling','sick','side','siege','sight','sign','silent','silk','silly','silver','similar','simple','since','sing','siren','sister','situate','six','size','skate','sketch','ski','skill','skin','skirt','skull','slab','slam','sleep','slender','slice','slide','slight','slim','slogan','slot','slow','slush','small','smart','smile','smoke','smooth','snack','snake','snap','sniff','snow','soap','soccer','social','sock','soda','soft','solar','soldier','solid','solution','solve','someone','song','soon','sorry','sort','soul','sound','soup','source','south','space','spare','spatial','spawn','speak','special','speed','spell','spend','sphere','spice','spider','spike','spin','spirit','split','spoil','sponsor','spoon','sport','spot','spray','spread','spring','spy','square','squeeze','squirrel','stable','stadium','staff','stage','stairs','stamp','stand','start','state','stay','steak','steel','stem','step','stereo','stick','still','sting','stock','stomach','stone','stool','story','stove','strategy','street','strike','strong','struggle','student','stuff','stumble','style','subject','submit','subway','success','such','sudden','suffer','sugar','suggest','suit','summer','sun','sunny','sunset','super','supply','supreme','sure','surface','surge','surprise','surround','survey','suspect','sustain','swallow','swamp','swap','swarm','swear','sweet','swift','swim','swing','switch','sword','symbol','symptom','syrup','system','table','tackle','tag','tail','talent','talk','tank','tape','target','task','taste','tattoo','taxi','teach','team','tell','ten','tenant','tennis','tent','term','test','text','thank','that','theme','then','theory','there','they','thing','this','thought','three','thrive','throw','thumb','thunder','ticket','tide','tiger','tilt','timber','time','tiny','tip','tired','tissue','title','toast','tobacco','today','toddler','toe','together','toilet','token','tomato','tomorrow','tone','tongue','tonight','tool','tooth','top','topic','topple','torch','tornado','tortoise','toss','total','tourist','toward','tower','town','toy','track','trade','traffic','tragic','train','transfer','trap','trash','travel','tray','treat','tree','trend','trial','tribe','trick','trigger','trim','trip','trophy','trouble','truck','true','truly','trumpet','trust','truth','try','tube','tuition','tumble','tuna','tunnel','turkey','turn','turtle','twelve','twenty','twice','twin','twist','two','type','typical','ugly','umbrella','unable','unaware','uncle','uncover','under','undo','unfair','unfold','unhappy','uniform','unique','unit','universe','unknown','unlock','until','unusual','unveil','update','upgrade','uphold','upon','upper','upset','urban','urge','usage','use','used','useful','useless','usual','utility','vacant','vacuum','vague','valid','valley','valve','van','vanish','vapor','various','vast','vault','vehicle','velvet','vendor','venture','venue','verb','verify','version','very','vessel','veteran','viable','vibrant','vicious','victory','video','view','village','vintage','violin','virtual','virus','visa','visit','visual','vital','vivid','vocal','voice','void','volcano','volume','vote','voyage','wage','wagon','wait','walk','wall','walnut','want','warfare','warm','warrior','wash','wasp','waste','water','wave','way','wealth','weapon','wear','weasel','weather','web','wedding','weekend','weird','welcome','west','wet','whale','what','wheat','wheel','when','where','whip','whisper','wide','width','wife','wild','will','win','window','wine','wing','wink','winner','winter','wire','wisdom','wise','wish','witness','wolf','woman','wonder','wood','wool','word','work','world','worry','worth','wrap','wreck','wrestle','wrist','write','wrong','yard','year','yellow','you','young','youth','zebra','zero','zone','zoo'];

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 32;
const SALT_PREFIX = 'htmlhost-v1:';

function generateMnemonic() {
  const entropy = crypto.randomBytes(16);
  const hash = crypto.createHash('sha256').update(entropy).digest();
  let bits = '';
  for (const byte of entropy) bits += byte.toString(2).padStart(8, '0');
  for (let i = 0; i < 4; i++) bits += ((hash[0] >> (7 - i)) & 1).toString();
  const words = [];
  for (let i = 0; i < bits.length; i += 11) {
    words.push(WORDLIST[parseInt(bits.slice(i, i + 11), 2)]);
  }
  return words.join(' ');
}

function deriveApiKey(mnemonic) {
  const normalized = mnemonic.toLowerCase().trim().split(/\s+/).join(' ');
  const salt = Buffer.from(SALT_PREFIX + normalized, 'utf8');
  const key = crypto.pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  return 'ps_' + key.toString('hex').slice(0, 32);
}

function hashKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// --- Config ---
const CONFIG_DIR = path.join(require('os').homedir(), '.htmlhost');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
  }
  return {};
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

// --- HTTP Client ---

const args = process.argv.slice(2);
const command = args[0];

// Load config early so request() can use it
const _config = loadConfig();

let BASE_URL = process.env.PASTE_URL || _config.url || 'https://html-host.fly.dev';
let API_KEY = process.env.PASTE_API_KEY || _config.apiKey;

function request(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers, ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
    };
    if (body !== undefined) {
      if (typeof body === 'string') {
        opts.headers['Content-Type'] = 'text/html';
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      } else {
        opts.headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      }
    }
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function printHelp() {
  console.log(`
htmlhost — Disposable HTML Hosting CLI

Usage:
  htmlhost <command> [args]

Commands:
  setup                    Create account + save credentials
  show-credentials         Show saved mnemonic and API key (password-protected)
  set-password             Set password to protect credentials display
  upload <file> [opts]     Upload HTML file
    --ttl <duration>       1h, 3h, 1d, 3d (default), 7d, 30d, indefinite
  list                     List your pastes
  delete <id>              Delete a paste
  info <id>                Get paste info
  keys                     List API keys
  create-key [label]       Create new API key
  delete-key <id>          Delete an API key
  update                   Pull latest version and reinstall

Config: ~/.htmlhost/config.json
  Stores mnemonic, API key, and server URL.
  Agent reads this file automatically.
`);
}

async function setup() {
  console.log('\n  Setting up htmlhost...\n');

  // Generate credentials
  const mnemonic = generateMnemonic();
  const apiKey = deriveApiKey(mnemonic);
  const id = crypto.randomBytes(8).toString('hex');
  const hash = hashKey(apiKey);

  // Register with server
  const res = await request('POST', '/api/auth/register', { body: { id, hash, label: 'default' } });
  if (res.status !== 201) {
    console.error('  Error registering:', res.data.error || res.data);
    process.exit(1);
  }

  // Save to ~/.htmlhost config
  saveConfig({ mnemonic, apiKey, url: BASE_URL });

  console.log('  Account created!\n');
  console.log('  ┌─────────────────────────────────────────────────────┐');
  console.log('  │  CREDENTIALS SAVED                                  │');
  console.log('  │                                                     │');
  console.log('  │  Config: ' + CONFIG_FILE + '  │');
  console.log('  │                                                     │');
  console.log('  │  Mnemonic: ' + mnemonic + '  │');
  console.log('  │  API Key:  ' + apiKey + '  │');
  console.log('  │                                                     │');
  console.log('  │  Save your mnemonic somewhere safe as backup.       │');
  console.log('  └─────────────────────────────────────────────────────┘\n');
  console.log('  └─────────────────────────────────────────────────────┘\n');
}

async function update() {
  const { execSync } = require('child_process');
  const repoRoot = path.join(__dirname, '..');

  console.log('\n  Checking for updates...\n');

  // Verify this is a git repo
  try {
    execSync('git rev-parse --git-dir', { cwd: repoRoot, stdio: 'ignore' });
  } catch {
    console.error('  Error: Not a git repository. Reinstall from git instead.');
    process.exit(1);
  }

  // Check for remote changes
  try {
    execSync('git fetch origin', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    console.error('  Error fetching:', err.message);
    process.exit(1);
  }

  const local = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  const remote = execSync('git rev-parse origin/main', { cwd: repoRoot }).toString().trim();

  if (local === remote) {
    console.log('  Already up to date.\n');
    return;
  }

  // Show what changed
  const log = execSync('git log HEAD..origin/main --oneline', { cwd: repoRoot }).toString().trim();
  console.log('  Updates available:\n');
  log.split('\n').forEach(line => console.log('    ' + line));
  console.log('');

  // Pull
  console.log('  Pulling...');
  try {
    execSync('git pull origin main', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    console.error('  Error pulling:', err.message);
    process.exit(1);
  }

  // Reinstall deps
  console.log('  Installing dependencies...');
  try {
    execSync('npm ci --production', { cwd: repoRoot, stdio: 'pipe' });
  } catch (err) {
    console.error('  Warning: npm ci failed, trying npm install...');
    try {
      execSync('npm install --production', { cwd: repoRoot, stdio: 'pipe' });
    } catch (err2) {
      console.error('  Error installing deps:', err2.message);
      process.exit(1);
    }
  }

  console.log('\n  Updated successfully!\n');
}

async function setPasswordCommand() {
  const cfg = loadConfig();
  if (!cfg.mnemonic) {
    console.error('No credentials found. Run "htmlhost setup" first.');
    process.exit(1);
  }

  console.log('\n  Set a password to protect your credentials.\n');

  const pw1 = await promptPassword('  Password: ');
  if (!pw1) { console.error('  Password cannot be empty.'); process.exit(1); }

  const pw2 = await promptPassword('  Repeat password: ');
  if (pw1 !== pw2) { console.error('  Passwords do not match.'); process.exit(1); }

  cfg.password = setPassword(pw1);
  saveConfig(cfg);

  console.log('\n  Password set. "show-credentials" will now require it.\n');
}

async function main() {
  try {
    if (command === 'setup') {
      await setup();
      return;
    }

    if (command === 'update') {
      await update();
      return;
    }

    if (command === 'set-password') {
      await setPasswordCommand();
      return;
    }

    if (!API_KEY && command && command !== 'help') {
      console.error('Error: Run "htmlhost setup" first, or set PASTE_API_KEY');
      process.exit(1);
    }

    switch (command) {
      case 'show-credentials': {
        const cfg = loadConfig();
        if (!cfg.mnemonic) {
          console.error('No credentials found. Run "htmlhost setup" first.');
          process.exit(1);
        }
        if (cfg.password) {
          const pw = await promptPassword('  Password: ');
          if (!verifyPassword(pw, cfg.password)) {
            console.error('  Incorrect password.');
            process.exit(1);
          }
        }
        console.log('\n  Stored credentials:\n');
        console.log('  Mnemonic: ' + (cfg.mnemonic || '(not saved — too late to recover)'));
        console.log('  API Key:  ' + cfg.apiKey);
        console.log('  Server:   ' + cfg.url);
        console.log('  Config:   ' + CONFIG_FILE + '\n');
        break;
      }
      case 'upload': {
        if (!args[1]) { console.error('Error: file path required'); process.exit(1); }
        const filePath = path.resolve(args[1]);
        if (!fs.existsSync(filePath)) { console.error('Error: file not found:', filePath); process.exit(1); }
        const html = fs.readFileSync(filePath, 'utf8');
        const ttlIdx = args.indexOf('--ttl');
        const ttl = ttlIdx !== -1 ? args[ttlIdx + 1] : '3d';
        const res = await request('POST', '/api/pastes', { body: html, headers: { 'X-TTL': ttl } });
        if (res.status === 201) {
          console.log(`\n  Uploaded: ${BASE_URL}${res.data.url}`);
          console.log(`  ID: ${res.data.id}`);
          console.log(`  Expires: ${res.data.expiresAt || 'never'}\n`);
        } else {
          console.error('Error:', res.data.error);
        }
        break;
      }
      case 'list': {
        const res = await request('GET', '/api/pastes');
        if (res.status !== 200) { console.error('Error:', res.data.error); break; }
        if (res.data.length === 0) { console.log('\n  No pastes yet.\n'); }
        else {
          console.log(`\n  ${res.data.length} paste(s):\n`);
          res.data.forEach(p => {
            const exp = p.expired ? ' (EXPIRED)' : p.ttl === 'never' ? '' : ` (${p.ttl})`;
            console.log(`    ${p.id}${exp}  ${BASE_URL}${p.url}`);
          });
          console.log('');
        }
        break;
      }
      case 'delete': {
        if (!args[1]) { console.error('Error: paste ID required'); process.exit(1); }
        const res = await request('DELETE', `/api/pastes/${args[1]}`);
        console.log(res.status === 200 ? '  Deleted.' : 'Error: ' + res.data.error);
        break;
      }
      case 'info': {
        if (!args[1]) { console.error('Error: paste ID required'); process.exit(1); }
        const res = await request('GET', `/api/pastes/${args[1]}`);
        if (res.status === 200) {
          console.log(`\n  ID:       ${res.data.id}`);
          console.log(`  Created:  ${res.data.createdAt}`);
          console.log(`  Expires:  ${res.data.expiresAt || 'never'}`);
          console.log(`  URL:      ${BASE_URL}/p/${res.data.id}\n`);
        } else { console.error('Error:', res.data.error); }
        break;
      }
      case 'keys': {
        const res = await request('GET', '/api/keys');
        if (res.status !== 200) { console.error('Error:', res.data.error); break; }
        if (res.data.length === 0) { console.log('\n  No keys.\n'); }
        else {
          console.log(`\n  ${res.data.length} key(s):\n`);
          res.data.forEach(k => console.log(`    ${k.id}  ${k.label || '(unnamed)'}  ${k.createdAt}`));
          console.log('');
        }
        break;
      }
      case 'create-key': {
        const res = await request('POST', '/api/keys', { body: { label: args[1] || 'default' } });
        if (res.status === 201) {
          console.log('\n  Key created!\n');
          console.log(`  Mnemonic: ${res.data.mnemonic}`);
          console.log(`  API Key:  ${res.data.apiKey}`);
          console.log('\n  SAVE THESE NOW.\n');
        } else { console.error('Error:', res.data.error); }
        break;
      }
      case 'delete-key': {
        if (!args[1]) { console.error('Error: key ID required'); process.exit(1); }
        const res = await request('DELETE', `/api/keys/${args[1]}`);
        if (res.status === 200) {
          console.log(`  Deleted. ${res.data.deletedPastes} paste(s) removed.`);
        } else { console.error('Error:', res.data.error); }
        break;
      }
      default:
        printHelp();
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
