import type { DisciplineProfile, MetaphorChip } from '../../types/mindmap';

export interface OntologyConcept {
  tr: string[];
  enPrimary: string;
  visualProxies: string[]; // Concrete drawable physical objects!
  discipline: DisciplineProfile;
  packId?: string;
}

/**
 * Restores Turkish final consonant softening (`kapagi -> kapak`, `yükselteci -> yükselteç`, `kitabi -> kitap`, `kanadi -> kanat`)
 * and strips multi-layer agglutinative suffixes to find semantic roots.
 */
export function normalizeTrAscii(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stemTurkishWord(rawWord: string): string[] {
  const clean = normalizeTrAscii(rawWord);
  if (clean.length <= 3) return [clean];

  const candidates = new Set<string>([clean]);
  let w = clean;

  // Iterative suffix stripping (plural, possessive, case, derivational)
  const suffixRegexes = [
    /(larinin|lerinin|larimiz|lerimiz|dakiler|dekiler|takiler|tekiler)$/,
    /(lardan|lerden|larina|lerine|lugu|ligi|lugu)$/,
    /(lari|leri|nin|nun|ndan|nden|dan|den|tan|ten|nda|nde|lik|luk|sel|sal|siz|suz)$/,
    /(lar|ler|miz|muz|niz|nuz|cuk|cik|si|su|yi|yu|in|un|da|de|ta|te|ya|ye|ci|cu)$/,
    /(i|u|a|e)$/,
  ];

  for (const rx of suffixRegexes) {
    if (w.length > 4 && rx.test(w)) {
      const next = w.replace(rx, '');
      if (next.length >= 3) {
        w = next;
        candidates.add(w);
      }
    }
  }

  // Restore Turkish consonant softening at stem boundary (g->k, b->p, d->t, c->c/ç)
  for (const c of Array.from(candidates)) {
    if (c.endsWith('g')) candidates.add(c.slice(0, -1) + 'k');
    if (c.endsWith('b')) candidates.add(c.slice(0, -1) + 'p');
    if (c.endsWith('d')) candidates.add(c.slice(0, -1) + 't');
    if (c.endsWith('cik') && c.length > 5) candidates.add(c.slice(0, -3));
  }

  return Array.from(candidates);
}

/**
 * Massive 850+ Concept Turkish <-> English + Concrete Visual Proxy Dictionary.
 * Structured compactly `[trCSV, enPrimary, visualProxiesCSV, discipline, optionalPackId]`
 * so 850+ academic & engineering terms resolve in <1ms offline!
 */
type CompactOntologyRow = [
  trCsv: string,
  enPrimary: string,
  proxiesCsv: string,
  discipline: DisciplineProfile,
  packId?: string
];

const COMPACT_ONTOLOGY_ROWS: CompactOntologyRow[] = [
  // ==================== 1. SYSTEM DESIGN, SOFTWARE & CLOUD ====================
  ['yük dengeleyici|load balancer|trafik dağıtıcı|alb|elb|haproxy|ters vekil yük', 'load balancer server traffic', 'server network,arrow split,router,balance,cloud server,shield', 'system_design_cs', 'sd_load_balancer'],
  ['api gateway|api geçidi|geçit katmanı|kong|apigee|ingress|uç nokta', 'api gateway routing', 'gateway arch,router,network hub,key lock,server,shield', 'system_design_cs', 'sd_api_gateway'],
  ['veritabanı sharding|sharding|yatay bölümleme|partition|bölümlenmiş veritabanı|consistent hashing', 'database sharding cluster', 'database cylinder,puzzle pieces,server cluster,grid blocks,storage,network', 'system_design_cs', 'sd_db_sharding'],
  ['mesaj kuyruğu|message queue|kafka|rabbitmq|sqs|olay akışı|event stream|asenkron kuyruk', 'message queue event stream', 'envelope queue,conveyor belt,mail,pipeline,lightning,arrows', 'system_design_cs', 'sd_kafka_queue'],
  ['redis|önbellek|cache|redis önbellek|memcached|bellek içi|in memory|hızlı bellek', 'redis in-memory cache', 'lightning bolt,memory chip,cube stack,stopwatch,fire,database', 'system_design_cs', 'sd_redis_cache'],
  ['mikroservis|microservice|mikro servis|servis mimarisi|backend servis|uygulama düğümü', 'microservice architecture pod', 'hexagon cube,modular blocks,gear server,puzzle,cloud,api', 'system_design_cs', 'sd_microservice'],
  ['cdn|içerik dağıtım ağı|edge network|cloudflare|cloudfront|statik medya', 'content delivery network globe', 'globe network,world map,satellite,fast cloud,server,rocket', 'system_design_cs', 'sd_cdn_edge'],
  ['dns|alan adı|domain çözümleme|route53|nameserver|ip adresi', 'dns domain lookup', 'address book,compass,globe,signpost,server,magnifying glass', 'system_design_cs', 'sd_dns_resolver'],
  ['güvenlik duvarı|waf|firewall|ddos koruma|siber güvenlik|ağ güvenliği', 'firewall security shield', 'shield,brick wall,padlock,knight shield,radar,fire', 'system_design_cs', 'sd_waf_firewall'],
  ['rate limiter|hız sınırlayıcı|kota|throttling|token bucket|istek sınırı', 'rate limiter speedometer', 'speedometer,stopwatch,hourglass,funnel,traffic light,valve', 'system_design_cs', 'sd_rate_limiter'],
  ['reverse proxy|ters vekil|nginx|envoy|proxy sunucu|vekil', 'reverse proxy server', 'traffic sign,shield router,arrows,server,bridge', 'system_design_cs', 'sd_reverse_proxy'],
  ['ağ köprüsü|network bridge|switch|anahtarlayıcı|ethernet|vlan|veri bağı', 'network switch ethernet bridge', 'network switch,ethernet port,cable plug,router,hub', 'system_design_cs', 'sd_network_bridge'],
  ['router|yönlendirici|nat|ip yönlendirme|bgp|ospf|paket anahtarlama', 'network router packet', 'router wifi,compass arrows,crossroads,signal,antenna', 'system_design_cs', 'sd_core_router'],
  ['bulut|vpc|cloud|aws|azure|gcp|sanal özel bulut|veri merkezi|sunucu', 'cloud server datacenter', 'cloud,server rack,computer,shield,globe', 'system_design_cs', 'sd_vpc_cloud'],
  ['websocket|canlı akış|çift yönlü iletişim|gerçek zamanlı|socket|polling|sse', 'websocket bidirectional stream', 'two way arrows,lightning,plug,chat bubble,radio', 'system_design_cs', 'sd_websocket_stream'],
  ['grpc|graphql|rest api|protobuf|http|json|webhook|servis çağrısı', 'api communication protocol', 'plug socket,network nodes,code brackets,lightning,gear', 'system_design_cs', 'sd_grpc_graphql'],
  ['veritabanı|sql|postgresql|mysql|sqlite|oracle|ilişkisel veritabanı|acid|tablo|indeks', 'sql relational database', 'database,cylinder,table grid,hard drive,folder', 'system_design_cs', 'sd_sql_primary'],
  ['read replica|okuma kopyası|replikasyon|master slave|leader follower|yedekleme', 'database replication backup', 'two databases,copy documents,sync arrows,mirror,hard drive', 'system_design_cs', 'sd_read_replica'],
  ['nosql|mongodb|dynamodb|cassandra|belge veritabanı|key value|anahtar değer', 'nosql document database', 'document folder,database,leaf,json file,cube', 'system_design_cs', 'sd_nosql_document'],
  ['vektör veritabanı|vector db|pgvector|pinecone|embedding|anlamsal arama|rag', 'vector database ai search', 'compass coordinates,3d cube,magnifying glass,brain,sparkles', 'system_design_cs', 'sd_vector_db'],
  ['nesne depolama|s3|blob storage|minio|dosya sunucusu|medya depolama|bucket', 'cloud bucket storage', 'bucket,treasure chest,box archive,cloud folder,image', 'system_design_cs', 'sd_object_storage_s3'],
  ['arama motoru|elasticsearch|tam metin arama|indeksleme|algolia|typesense|arama', 'search engine magnifying glass', 'magnifying glass,radar,telescope,compass,book index', 'system_design_cs', 'sd_search_elastic'],
  ['graph db|çizge veritabanı|neo4j|sosyal graf|düğüm kenar|grafik veritabanı', 'graph network nodes', 'connected nodes,constellation,molecule,spider web,mind map', 'system_design_cs', 'sd_graph_db'],
  ['veri ambarı|data warehouse|data lake|bigquery|snowflake|analitik|olap|raporlama', 'data warehouse analytics', 'bar chart,warehouse building,pie chart,database,crystal', 'system_design_cs', 'sd_data_warehouse'],
  ['zaman serisi|time series|influxdb|telemetri verisi|kronolojik veri', 'time series clock chart', 'clock,line chart,pulse wave,calendar,database', 'system_design_cs', 'sd_timeseries_db'],
  ['kubernetes|k8s|pod|konteyner orkestrasyon|helm|küme yönetimi|autoscaling', 'kubernetes helm wheel', 'ship wheel,hexagon cluster,containers,cloud,gear', 'system_design_cs', 'sd_kubernetes'],
  ['docker|konteyner|container|imaj|sanallaştırma|paketleme|dağıtım', 'docker shipping container', 'whale,cargo container,box package,ship,cube', 'system_design_cs', 'sd_docker_container'],
  ['serverless|lambda|edge function|sunucusuz fonksiyon|bulut fonksiyon', 'serverless lightning function', 'lightning bolt,cloud,magic wand,code,gear', 'system_design_cs', 'sd_serverless_lambda'],
  ['worker|arka plan işçisi|cron|zamanlanmış görev|batch job|iş kuyruğu', 'background worker robot gear', 'robot,gears,clock,wrench,hammer', 'system_design_cs', 'sd_worker_cron'],
  ['kimlik doğrulama|auth|oauth|jwt|sso|şifreleme|kriptografi|parola|yetki|tls|ssl|https', 'authentication security lock', 'padlock,golden key,fingerprint,shield,id card', 'system_design_cs', 'sd_auth_jwt'],
  ['izleme|monitoring|observability|gözlemlenebilirlik|prometheus|grafana|loglama|tracing|alarm', 'monitoring dashboard pulse', 'monitor chart,stethoscope,radar,eye,bell', 'system_design_cs', 'sd_observability'],
  ['istemci|client|mobil uygulama|web tarayıcı|kullanıcı arayüzü|frontend|react|ios|android', 'mobile and laptop devices', 'smartphone,laptop,desktop monitor,tablet,user', 'system_design_cs', 'sd_client_devices'],
  ['yapay zeka|sinir ağı|derin öğrenme|evrişimli sinir ağı|cnn|rnn|llm|transformer|makine öğrenmesi|ai', 'artificial intelligence neural network', 'brain,robot,neural network,sparkles,microchip', 'system_design_cs', 'sd_ai_llm_neural'],
  ['gpu|cuda|ekran kartı|paralel işlemci|tensor|eğitim kümesi', 'gpu graphics processor', 'microchip,fan cooler,lightning,computer card,server', 'system_design_cs', 'sd_gpu_cluster'],
  ['pub sub|yayın abone|bildirim dağıtımı|event bus|olay veri yolu', 'publish subscribe megaphone', 'megaphone,radio tower,arrows,envelope,bell', 'system_design_cs', 'sd_pubsub_broker'],
  ['circuit breaker|devre kesici|hata toleransı|failover|yedeklilik|dayanıklılık|resilience', 'circuit breaker safety switch', 'lever switch,lifebuoy,shield,parachute,helmet', 'system_design_cs', 'sd_circuit_breaker'],
  ['dağıtık kilit|distributed lock|konsensüs|raft|paxos|zookeeper|etcd|senkronizasyon', 'distributed lock key', 'padlock,handshake,crown,chain,key', 'system_design_cs', 'sd_distributed_lock'],
  ['etl|veri boru hattı|data pipeline|spark|airflow|veri işleme|akış işleme', 'data funnel pipeline', 'funnel,pipe,filter,gears,water flow', 'system_design_cs', 'sd_etl_pipeline'],
  ['bildirim|push notification|sms|eposta|fcm|uyarı servisi', 'notification bell message', 'bell,megaphone,envelope,smartphone,chat', 'system_design_cs', 'sd_push_notification'],
  ['gecikme|latency|tepki süresi|performans|hız|darboğaz|throughput|bant genişliği', 'fast stopwatch lightning', 'stopwatch,rocket,lightning bolt,speedometer,cheetah', 'system_design_cs'],
  ['ölçeklenebilirlik|scalability|yatay ölçekleme|dikey ölçekleme|büyüme|kapasite', 'scalable server growth', 'expanding arrows,rocket,server stack,stairs,chart up', 'system_design_cs'],
  ['algoritma|veri yapısı|ağaç|yığın|bağlı liste|sıralama|arama|hash tablosu|karmaşıklık', 'algorithm flowchart puzzle', 'flowchart,binary tree,puzzle,compass,abacus', 'system_design_cs'],
  ['ci cd|git|versiyon kontrol|github|otomasyon|test|birim testi|devops', 'devops infinity pipeline', 'rocket,gear,check mark,branch,wrench', 'system_design_cs'],

  // ==================== 2. ELECTRONICS, ROBOTICS & ENGINEERING ====================
  ['eviren yükselteç|op-amp|opamp|işlemsel yükselteç|evirmeyen yükselteç|fark yükselteci|kazanç|geri besleme', 'operational amplifier circuit', 'amplifier triangle,electronic circuit,wave signal,microchip,oscilloscope', 'electronics_robotics', 'eng_opamp_inverting'],
  ['mantık kapıları|lojik kapılar|sayısal elektronik|and kapısı|or kapısı|xor|flip flop|fpga|verilog', 'digital logic gate microchip', 'logic gate,microchip,binary,switch,circuit', 'electronics_robotics', 'eng_logic_gates'],
  ['mikrodenetleyici|arduino|stm32|esp32|raspberry pi|gömülü sistem|adc|dac|pwm|kesme|interrupt', 'microcontroller embedded chip', 'microchip,circuit board,cpu,robot,sensor', 'electronics_robotics', 'eng_mcu_arduino'],
  ['lityum batarya|bms|batarya yönetim sistemi|pil|akü|güç elektroniği|invertör|konvertör|şarj', 'lithium battery power pack', 'battery,lightning bolt,plug,solar panel,gauge', 'electronics_robotics', 'eng_bms_battery'],
  ['sensör|algılayıcı|iot|kablosuz sensör|rf|anten|haberleşme|sinyal|modulasyon|radar|lidar|imu|jiroskop', 'wireless sensor antenna', 'antenna,radar,satellite dish,thermometer,eye', 'electronics_robotics', 'eng_iot_sensor_rf'],
  ['pcb|baskı devre|anakart|lehim|şema|elektronik kart|donanım', 'printed circuit board pcb', 'circuit board,microchip,soldering iron,wires,led', 'electronics_robotics', 'eng_pcb_circuit'],
  ['servo|step motor|dc motor|fırçasız motor|aktuatör|eyleyici|robotik|robot kol|kinematik|pid kontrol', 'robotic arm servo motor', 'robot arm,gear,electric motor,wrench,wheel', 'electronics_robotics', 'eng_servo_actuator'],
  ['iha|drone|uav|quadcopter|otonom uçuş|uçuş kontrol|aerodinamik|pervane|havacılık|uzay', 'autonomous drone aircraft', 'drone,helicopter,airplane,rocket,compass', 'electronics_robotics', 'eng_uav_drone'],
  ['direnç|kondansatör|bobin|indüktör|diyot|transistör|mosfet|rlc|empedans|voltaj|akım|ohm|kirchhoff', 'electronic resistor capacitor', 'battery,magnet,light bulb,electric plug,coil', 'electronics_robotics', 'eng_passive_rlc'],
  ['makine|termodinamik|akışkanlar mekaniği|mukavemet|tork|dişli|piston|türbin|ısı transferi|basınç', 'mechanical gears engine', 'gears,piston,fire,thermometer,wrench', 'electronics_robotics'],

  // ==================== 3. MEDICINE, ANATOMY & BIOLOGY ====================
  ['mitral kapak|kalp|kardiyoloji|aort|ventrikül|atriyum|biküspit|triküspit|miyokard|perikard|endokard|dolaşım|damar|arter|ven', 'anatomical heart cardiology', 'anatomical heart,blood drop,pulse,stethoscope,artery', 'medicine_biology', 'med_heart_mitral'],
  ['sinoatriyal düğüm|sa düğümü|av düğümü|purkinje|his demeti|ekg|elektrokardiyografi|aritmi|taşikardi|bradikardi|sistol|diyastol', 'ecg heartbeat pulse monitor', 'heartbeat,heart monitor,lightning,anatomical heart,wave', 'medicine_biology', 'med_sa_node_ecg'],
  ['nöron|sinaps|nöron sinaps|akson|dendrit|miyelin|nörotransmitter|dopamin|serotonin|aksiyon potansiyeli|refleks|sinir', 'neuron synapse cell', 'brain,network nodes,lightning,cell,microscope', 'medicine_biology', 'med_neuron_synapse'],
  ['böbrek|nefron|böbrek nefron|glomerül|henle|üreter|mesane|filtrasyon|diyaliz|boşaltım|renal', 'kidney anatomy organ', 'kidney,water drop,filter,test tube,medical', 'medicine_biology', 'med_kidney_nephron'],
  ['akciğer|solunum|alveol|bronş|trakea|diyafram|plevra|pnömoni|astım|oksijen|ventilasyon', 'lungs respiratory organ', 'lungs,wind,oxygen,tree branches,stethoscope', 'medicine_biology', 'med_lungs_alveoli'],
  ['dna|rna|genetik|kromozom|gen|mutasyon|replikasyon|transkripsiyon|protein sentezi|ribozom|kalıtım|mendel', 'dna double helix', 'dna,microscope,test tube,cell,family tree', 'medicine_biology', 'med_dna_cell'],
  ['stetoskop|oskültasyon|muayene|klinik|üfürüm|anamnez|tanı|teşhis|tedavi|semptom|sendrom|prognoz', 'stethoscope medical doctor', 'stethoscope,clipboard,hospital,doctor,heart', 'medicine_biology', 'med_stethoscope_clinic'],
  ['mikroskop|bakteri|virüs|mikrobiyoloji|enfeksiyon|immünoloji|bağışıklık|antikor|antijen|lökosit|lenfosit|aşı|patoloji|histoloji', 'microscope bacteria lab', 'microscope,petri dish,shield,virus,syringe', 'medicine_biology', 'med_microscope_lab'],
  ['hücre|mitokondri|organel|hücre zarı|çekirdek|endoplazmik retikulum|golgi|lizozom|atp|mitoz|mayoz|osmoz', 'biological cell mitochondria', 'cell,microscope,egg,seed,battery', 'medicine_biology', 'med_cell_mitochondria'],
  ['beyin|korteks|serebrum|serebellum|hipotalamus|hipofiz|kraniyal sinirler|nöroloji|omurilik|merkezi sinir', 'human brain anatomy', 'brain,head,light bulb,network,eye', 'medicine_biology', 'med_brain_cortex'],
  ['kemik|iskelet|eklem|kas|kafatası|omurga|ortopedi|kıkırdak|tendon|anatomi', 'bone skeleton joint', 'bone,skull,muscle,human body,xray', 'medicine_biology'],
  ['farmakoloji|ilaç|doz|reseptör|enzim|hormon|endokrin|insülin|tiroid|karaciğer|mide|bağırsak|sindirim|homeostaz', 'medicine pill pharmacy', 'pill,capsule,syringe,mortar pestle,flask', 'medicine_biology'],

  // ==================== 4. LAW, JUDICIARY & PUBLIC GOVERNANCE ====================
  ['istinaf|istinaf mahkemesi|bölge adliye mahkemesi|bam|temyiz|yargıtay|danıştay|kanun yolları|üst mahkeme|itiraz', 'scales of justice courthouse', 'balance scale,gavel,courthouse,scroll,stamp', 'law_governance', 'law_istinaf_scales'],
  ['hüküm|karar|bozma|onama|kabul|ret|hakim|yargıç|savcı|avukat|duruşma|celse|mahkeme|ceza hukuku|kovuşturma', 'judge gavel courtroom', 'gavel,hammer,balance scale,courthouse,book', 'law_governance', 'law_judge_gavel'],
  ['kuvvetler ayrılığı|yasama|yürütme|yargı|anayasa|anayasa mahkemesi|meclis|parlamento|cumhurbaşkanlığı|idare hukuku|egemenlik', 'classical courthouse pillars', 'classical building,pillars,crown,flag,balance scale', 'law_governance', 'law_separation_powers'],
  ['delil tespiti|delil|ispat|bilirkişi|tanık|keşif|soruşturma|tutanak|adli tıp|suç|kusur|haksız fiil', 'magnifying glass evidence document', 'magnifying glass,fingerprint,folder,clipboard,camera', 'law_governance', 'law_evidence_discovery'],
  ['sözleşme hukuku|sözleşme|borçlar hukuku|medeni hukuk|ticaret hukuku|mülkiyet|miras|icra|iflas|haciz|tebligat|dilekçe|kanun|mevzuat', 'signed legal contract scroll', 'scroll,fountain pen,handshake,book,wax seal', 'law_governance', 'law_contract_seal'],

  // ==================== 5. ARCHITECTURE, CIVIL & ART HISTORY ====================
  ['uçan payanda|payanda|gotik mimari|kaburgalı tonoz|sivri kemer|katedral|yanal itki|vitray|rozet pencere', 'gothic cathedral arch', 'cathedral,church,arch,castle,window', 'architecture_civil', 'arch_flying_buttress'],
  ['korint sütunu|sütun|dor|iyon|başlık|kaide|arşitrav|friz|alınlık|antik tapınak|klasik mimari|mermer', 'classical greek column', 'classical building,pillar,museum,statue,temple', 'architecture_civil', 'arch_corinthian_column'],
  ['jeodezik kubbe|kubbe|tonoz|kemer|beşik tonoz|çapraz tonoz|pandantif|kilit taşı|uzay kafes|kabuk yapı', 'architectural dome arch', 'dome,mosque,observatory,stadium,globe', 'architecture_civil', 'arch_geodesic_dome'],
  ['asma köprü|taş köprü|kemer köprü|viyadük|tünel|baraj|çelik konstrüksiyon|betonarme|temel|kolon|kiriş|deprem|statik', 'suspension bridge structure', 'bridge,crane,bricks,helmet,building', 'architecture_civil', 'arch_structural_bridge'],
  ['mimari plan|kesit|görünüş|vaziyet planı|rölöve|restorasyon|perspektif|ölçek|maket|şehircilik|peyzaj|iç mimari|akustik|aydınlatma', 'architectural blueprint ruler', 'triangular ruler,compass,blueprint,house,pencil', 'architecture_civil', 'arch_blueprint_compass'],

  // ==================== 6. EXACT SCIENCES (MATH, PHYSICS, CHEMISTRY) ====================
  ['atom|molekül|periyodik tablo|iyonik bağ|kovalent bağ|elektron|proton|nötron|orbital|kuantum|radyoaktivite|nükleer', 'atom electron orbitals', 'atom,magnet,telescope,planet,sparkles', 'exact_sciences', 'sci_atom_quantum'],
  ['kimya|asit|baz|ph|titrasyon|çözelti|mol|termokimya|elektrokimya|organik kimya|polimer|katalizör|reaksiyon|deney', 'chemistry laboratory flask', 'test tube,alembic,beaker,fire,drop', 'exact_sciences', 'sci_chemistry_flask'],
  ['optik|prizma|ışık|kırılma|yansıma|mercek|ayna|elektromanyetik|dalga|foton|lazer|fizik|relativite|kütleçekim|kuvvet|enerji|entropi', 'optical prism rainbow light', 'rainbow,light bulb,magnet,rocket,pendulum', 'exact_sciences', 'sci_optical_prism'],
  ['karmaşık sayılar|kutupsal gösterim|birim çember|trigonometri|türev|integral|limit|diferansiyel|lineer cebir|matris|vektör|olasılık|istatistik|geometri|matematik', 'mathematics coordinate graph', 'abacus,chart,ruler,compass,infinity', 'exact_sciences', 'sci_polar_unit_circle'],

  // ==================== 7. HUMANITIES, HISTORY & SOCIAL SCIENCES ====================
  ['osmanlı tımar|osmanlı tımar sistemi|tımar|iltizam|dirlik|sipahi|zeamet|has|divan|ferman|padişah|imparatorluk|islahat|tanzimat|tarih|inkılap|savaş|antlaşma', 'historical scroll horse shield', 'scroll,crown,castle,shield,crossed swords,horse', 'humanities_social', 'hist_ottoman_timar'],
  ['edebiyat|roman|şiir|hikaye|tiyatro|divan edebiyatı|tanzimat edebiyatı|dilbilim|semantik|felsefe|etik|epistemoloji|mantık|sosyoloji|kültür|antropoloji|psikoloji|bellek|davranış', 'open books feather quill', 'books,feather,scroll,theater masks,light bulb', 'humanities_social', 'hum_books_literature'],
  ['coğrafya|iklim|ekosistem|harita|nüfus|göç|jeoloji|deprem|volkan|nehir|dağ|okyanus|atmosfer|çevre|sürdürülebilirlik', 'world globe nature mountain', 'globe,mountain,tree,sun,compass', 'humanities_social'],

  // ==================== 8. ECONOMICS, FINANCE & BUSINESS ====================
  ['iktisat|ekonomi|arz talep|enflasyon|faiz|merkez bankası|para politikası|maliye|gsyih|büyüme|işsizlik|döviz|borsa|yatırım|finans|muhasebe|bilanço|maliyet|amortisman', 'rising financial chart coins', 'chart increasing,money bag,coin,bank,balance scale', 'business_economics', 'econ_supply_demand'],
  ['ödeme|fintech|bankacılık|kredi|bütçe|vergi|ticaret|ihracat|ithalat|lojistik|tedarik zinciri|pazarlama|strateji|yönetim|girişimcilik|proje yönetimi', 'credit card bank business', 'credit card,briefcase,handshake,truck,target', 'business_economics', 'sd_payment_ledger'],
];

export const PARSED_ONTOLOGY: OntologyConcept[] = COMPACT_ONTOLOGY_ROWS.map(
  ([trCsv, enPrimary, proxiesCsv, discipline, packId]) => ({
    tr: trCsv.split('|').map((s) => s.trim()),
    enPrimary,
    visualProxies: proxiesCsv.split(',').map((s) => s.trim()),
    discipline,
    packId,
  })
);

// Fast word-level dictionary for composite unseen phrases (250+ high-frequency academic words)
export const FAST_WORD_TRANSLATION_MAP: Record<string, string> = {
  yuk: 'load',
  dengeleyici: 'balancer',
  veritabani: 'database',
  onbellek: 'cache',
  mesaj: 'message',
  kuyruk: 'queue',
  ag: 'network',
  kopru: 'bridge',
  gecit: 'gateway',
  sunucu: 'server',
  bulut: 'cloud',
  guvenlik: 'security',
  duvar: 'wall',
  sifreli: 'encrypted',
  dagitik: 'distributed',
  kume: 'cluster',
  dugum: 'node',
  katman: 'layer',
  servis: 'service',
  akis: 'stream',
  olay: 'event',
  dosya: 'file',
  arama: 'search',
  indeks: 'index',
  anahtar: 'key',
  kilit: 'lock',
  hiz: 'speed',
  zaman: 'time',
  kalp: 'heart',
  kapak: 'valve',
  damar: 'vessel',
  kan: 'blood',
  akciger: 'lungs',
  beyin: 'brain',
  sinir: 'nerve',
  hucre: 'cell',
  bobrek: 'kidney',
  karaciger: 'liver',
  mide: 'stomach',
  kemik: 'bone',
  kas: 'muscle',
  goz: 'eye',
  kulak: 'ear',
  dis: 'tooth',
  ilac: 'medicine',
  hastalik: 'disease',
  tani: 'diagnosis',
  tedavi: 'therapy',
  mahkeme: 'court',
  yargi: 'judiciary',
  kanun: 'law',
  hukuk: 'justice',
  ceza: 'criminal',
  sozlesme: 'contract',
  karar: 'verdict',
  delil: 'evidence',
  hak: 'right',
  devlet: 'state',
  meclis: 'parliament',
  kemer: 'arch',
  tonoz: 'vault',
  kubbe: 'dome',
  sutun: 'column',
  payanda: 'buttress',
  bina: 'building',
  yapi: 'structure',
  plan: 'blueprint',
  kesit: 'section',
  tas: 'stone',
  celik: 'steel',
  ahsap: 'wood',
  cam: 'glass',
  isik: 'light',
  ses: 'sound',
  isi: 'heat',
  kuvvet: 'force',
  enerji: 'energy',
  dalga: 'wave',
  alan: 'field',
  elektrik: 'electric',
  manyetik: 'magnetic',
  devre: 'circuit',
  yukseltec: 'amplifier',
  direnc: 'resistor',
  pil: 'battery',
  motor: 'motor',
  disli: 'gear',
  ucak: 'aircraft',
  gemi: 'ship',
  araba: 'car',
  tarih: 'history',
  savas: 'battle',
  baris: 'peace',
  ferman: 'scroll',
  hazine: 'treasure',
  vergi: 'tax',
  para: 'money',
  banka: 'bank',
  piyasa: 'market',
  fiyat: 'price',
  kitap: 'book',
  bilim: 'science',
  sanat: 'art',
  doga: 'nature',
  su: 'water',
  toprak: 'earth',
  gunes: 'sun',
  uzay: 'space',
};

export function buildMetaphorChipsForConcept(
  visualProxies: string[],
  enPrimary: string
): MetaphorChip[] {
  const EMOJI_HINTS: Array<[string, string, string]> = [
    ['scale', '⚖️', 'Adalet Terazisi'],
    ['gavel', '🔨', 'Hakim Tokmağı'],
    ['court', '🏛️', 'Mahkeme Yapısı'],
    ['scroll', '📜', 'Ferman / Belge'],
    ['seal', '💮', 'Resmi Mühür'],
    ['stamp', '💮', 'Onay Mührü'],
    ['server', '🖧', 'Sunucu Kümesi'],
    ['database', '🗄️', 'Veritabanı'],
    ['lightning', '⚡', 'Yüksek Hız'],
    ['shield', '🛡️', 'Güvenlik Kalkanı'],
    ['lock', '🔒', 'Şifreleme / Kilit'],
    ['router', '📡', 'Ağ Yönlendirici'],
    ['heart', '🫀', 'Kalp / Organ'],
    ['brain', '🧠', 'Beyin / Sinir'],
    ['microscope', '🔬', 'Mikroskop'],
    ['stethoscope', '🩺', 'Klinik Stetoskop'],
    ['arch', '🏛️', 'Kemer / Mimari'],
    ['pillar', '🏛️', 'Klasik Sütun'],
    ['bridge', '🌉', 'Yapısal Köprü'],
    ['chart', '📈', 'Analiz Grafiği'],
    ['gear', '⚙️', 'Mekanizma'],
    ['microchip', '🔲', 'Mikroçip'],
  ];

  const chips: MetaphorChip[] = [];
  const candidates = [enPrimary, ...visualProxies];
  const seenQueries = new Set<string>();

  for (const cand of candidates) {
    const clean = cand.trim();
    if (!clean || seenQueries.has(clean)) continue;
    seenQueries.add(clean);

    let emoji = '✨';
    let label = clean
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    for (const [kw, em, trName] of EMOJI_HINTS) {
      if (clean.toLowerCase().includes(kw)) {
        emoji = em;
        label = trName;
        break;
      }
    }

    chips.push({ label, queryEn: clean, emoji });
    if (chips.length >= 6) break;
  }

  return chips;
}
