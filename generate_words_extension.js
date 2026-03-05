/**
 * generate_words_extension.js — dodaje więcej słów do istniejącego words.json
 * Run: node generate_words_extension.js
 */
const fs = require('fs');

const A2_EXTRA = [
  // === CIAŁO ROZSZERZONE ===
  ["nadgarstek","wrist"],["łokieć","elbow"],["ramię","shoulder"],["biodro","hip"],["kolano","knee"],
  ["kostka","ankle"],["stopa","foot"],["palec u nogi","toe"],["kciuk","thumb"],["paznokieć","nail"],
  ["pięść","fist"],["klatka piersiowa","chest"],["brzuch","belly"],["plecy","back"],["kręgosłup","spine"],
  ["żebro","rib"],["obojczyk","collarbone"],["łopatka","shoulder blade"],["miednica","pelvis"],["przedramię","forearm"],
  ["podudzie","lower leg"],["udo","thigh"],["łydka","calf"],["pośladki","buttocks"],["kark","nape of neck"],
  ["skroń","temple"],["policzek","cheek"],["szczęka","jaw"],["broda","chin"],["czoło","forehead"],
  ["brwi","eyebrows"],["rzęsy","eyelashes"],["źrenica","pupil"],["tęczówka","iris"],["język","tongue"],
  ["migdały","tonsils"],["przepona","diaphragm"],["wątroba","liver"],["nerka","kidney"],["płuco","lung"],
  ["żołądek","stomach"],["jelito","intestine"],["pęcherz","bladder"],["tarczyca","thyroid"],["trzustka","pancreas"],

  // === ZWIERZĘTA ROZSZERZONE ===
  ["małpa","monkey"],["żyrafa","giraffe"],["słoń","elephant"],["lew","lion"],["tygrys","tiger"],
  ["niedźwiedź","bear"],["wilk","wolf"],["lis","fox"],["zając","hare"],["wiewiórka","squirrel"],
  ["jeż","hedgehog"],["bóbr","beaver"],["wydra","otter"],["foka","seal"],["wieloryb","whale"],
  ["delfin","dolphin"],["rekin","shark"],["ośmiornica","octopus"],["meduza","jellyfish"],["krokodyl","crocodile"],
  ["żółw","turtle"],["wąż","snake"],["żmija","viper"],["jaszczurka","lizard"],["kameleon","chameleon"],
  ["orzeł","eagle"],["sokół","falcon"],["jastrzą","hawk"],["kruk","raven"],["wrona","crow"],
  ["sroka","magpie"],["dzięcioł","woodpecker"],["kos","blackbird"],["rudzik","robin"],["wróbel","sparrow"],
  ["jaskółka","swallow"],["bocian","stork"],["flamingo","flamingo"],["papuga","parrot"],["pingwin","penguin"],
  ["struś","ostrich"],["paw","peacock"],["kur","rooster"],["kura","hen"],["żaba","frog"],
  ["ropucha","toad"],["salamandra","salamander"],["mrówka","ant"],["pszczoła","bee"],["osa","wasp"],
  ["bąk","bumblebee"],["motyl","butterfly"],["ćma","moth"],["chrząszcz","beetle"],["świerszcz","cricket"],
  ["komar","mosquito"],["mucha","fly"],["pająk","spider"],["skarabeusz","scarab"],["modliszka","praying mantis"],

  // === NARZĘDZIA I SPRZĘT ===
  ["młotek","hammer"],["śrubokręt","screwdriver"],["klucz nastawny","adjustable wrench"],["gwoźdź","nail"],["śruba","screw"],
  ["nakrętka","nut"],["miarka","tape measure"],["poziomnica","spirit level"],["piła","saw"],["dłuto","chisel"],
  ["pędzel","paintbrush"],["wałek malarski","paint roller"],["drabina","ladder"],["klej","glue"],["taśma klejąca","adhesive tape"],
  ["nożyczki","scissors"],["obcęgi","pliers"],["imadło","vice"],["wiertarka","drill"],["szlifierka","sander"],
  ["spawarka","welder"],["skrzynka narzędziowa","toolbox"],["rękawice robocze","work gloves"],["okulary ochronne","safety goggles"],["kask","hard hat"],

  // === INSTRUMENTY MUZYCZNE ===
  ["skrzypce","violin"],["altówka","viola"],["wiolonczela","cello"],["kontrabas","double bass"],["harfa","harp"],
  ["flet","flute"],["obój","oboe"],["klarnet","clarinet"],["fagot","bassoon"],["saksofon","saxophone"],
  ["trąbka","trumpet"],["puzon","trombone"],["tuba","tuba"],["waltornia","French horn"],["akordeon","accordion"],
  ["organy","organ"],["syntezator","synthesizer"],["perkusja","drum kit"],["werbel","snare drum"],["marimba","marimba"],
  ["cymbały","cymbals"],["kastaniety","castanets"],["tamburyn","tambourine"],["bębenek","drum"],["ukulele","ukulele"],

  // === ROŚLINY I OGRÓD ===
  ["dąb","oak"],["buk","beech"],["brzoza","birch"],["sosna","pine"],["świerk","spruce"],
  ["jodła","fir"],["wierzba","willow"],["topola","poplar"],["klon","maple"],["kasztanowiec","horse chestnut"],
  ["jabłoń","apple tree"],["gruszka","pear tree"],["wiśnia","cherry tree"],["śliwka","plum tree"],["brzoskwinia","peach tree"],
  ["krzew","shrub"],["żywopłot","hedge"],["bluszcz","ivy"],["winorośl","grapevine"],["paproć","fern"],
  ["mech","moss"],["porost","lichen"],["glony","algae"],["kaktus","cactus"],["bambus","bamboo"],
  ["tulipan","tulip"],["róża","rose"],["stokrotka","daisy"],["niezapominajka","forget-me-not"],["słonecznik","sunflower"],
  ["lawenda","lavender"],["lilia","lily"],["konwalia","lily of the valley"],["mak","poppy"],["fiołek","violet"],
  ["orchidea","orchid"],["chryzantema","chrysanthemum"],["begonia","begonia"],["pelargonia","pelargonium"],["hortensja","hydrangea"],

  // === KUCHNIA SZCZEGÓŁOWO ===
  ["deska do krojenia","chopping board"],["tarka","grater"],["przecier","sieve/strainer"],["trzepaczka","whisk"],["szkło żaroodporne","oven dish"],
  ["patelnia","frying pan"],["wok","wok"],["rondel","saucepan"],["garnek do gotowania","cooking pot"],["forma do pieczenia","baking tin"],
  ["papier do pieczenia","baking paper"],["folia aluminiowa","aluminium foil"],["pokrywka","lid"],["łyżka drewniana","wooden spoon"],["szpatułka","spatula"],
  ["wyciskacz do czosnku","garlic press"],["nóż do chleba","bread knife"],["nóż kuchenny","chef's knife"],["nóż do jarzyn","paring knife"],["ostrzałka do noży","knife sharpener"],
  ["ekspres do kawy","coffee machine"],["blender kielichowy","jug blender"],["robot kuchenny","food processor"],["lodygomat","ice cream maker"],["grill elektryczny","electric grill"],

  // === WYRAŻENIA CODZIENNE ===
  ["nie ma sprawy","no problem"],["z pewnością","certainly"],["oczywiście","of course"],["niestety","unfortunately"],["na szczęście","fortunately"],
  ["tak naprawdę","actually"],["na przykład","for example"],["to znaczy","that is to say"],["innymi słowy","in other words"],["z drugiej strony","on the other hand"],
  ["przede wszystkim","first of all"],["po pierwsze","firstly"],["po drugie","secondly"],["w końcu","finally"],["podsumowując","to sum up"],
  ["moim zdaniem","in my opinion"],["jak wiadomo","as is known"],["uważam że","I think that"],["wydaje mi się","it seems to me"],["nie jestem pewien","I'm not sure"],
];

const B1_EXTRA = [
  // === ŚRODOWISKO PRACY ===
  ["elastyczny czas pracy","flexible working hours"],["praca hybrydowa","hybrid work"],["czterodniowy tydzień pracy","four-day working week"],["burnout","burnout"],["dobrostan pracownika","employee wellbeing"],
  ["różnorodność i inkluzywność","diversity and inclusion"],["szklany sufit","glass ceiling"],["luka płacowa","pay gap"],["dyskryminacja w pracy","workplace discrimination"],["molestowanie","harassment"],
  ["tworzenie sieci kontaktów","networking"],["mentor","mentor"],["coaching","coaching"],["feedback 360°","360° feedback"],["ocena pracownicza","performance review"],
  ["wypalenie zawodowe","professional burnout"],["satysfakcja z pracy","job satisfaction"],["zaangażowanie pracownika","employee engagement"],["rotacja pracowników","employee turnover"],["retencja pracowników","employee retention"],
  ["platforma e-learningowa","e-learning platform"],["szkolenie online","online training"],["certyfikat zawodowy","professional certificate"],["upskilling","upskilling"],["reskilling","reskilling"],

  // === ZDROWIE PUBLICZNE ===
  ["zdrowie psychiczne","mental health"],["higiena psychiczna","mental hygiene"],["terapia grupowa","group therapy"],["terapia indywidualna","individual therapy"],["sesja terapeutyczna","therapy session"],
  ["mindfulness","mindfulness"],["medytacja","meditation"],["techniki oddechowe","breathing techniques"],["relaksacja progresywna","progressive relaxation"],["biofeedback","biofeedback"],
  ["uzależnienie od alkoholu","alcohol addiction"],["uzależnienie od narkotyków","drug addiction"],["nikotynizm","nicotine addiction"],["uzależnienie od internetu","internet addiction"],["hazard","gambling addiction"],
  ["leczenie uzależnień","addiction treatment"],["detoksykacja","detoxification"],["abstynencja","abstinence"],["nawrót","relapse"],["program 12 kroków","12-step programme"],

  // === TECHNOLOGIA SPOŁECZEŃSTWO ===
  ["prywatność cyfrowa","digital privacy"],["ślad cyfrowy","digital footprint"],["prawo do bycia zapomnianym","right to be forgotten"],["zgoda na cookies","cookie consent"],["śledzenie online","online tracking"],
  ["deepfake","deepfake"],["misinformacja","misinformation"],["echo chamber","echo chamber"],["bańka filtrowania","filter bubble"],["algorytmiczna manipulacja","algorithmic manipulation"],
  ["cyfrowe nierówności","digital divide"],["wykluczenie cyfrowe","digital exclusion"],["analfabetyzm cyfrowy","digital illiteracy"],["umiejętności cyfrowe","digital skills"],["edukacja cyfrowa","digital education"],

  // === KULTURA I SPOŁECZEŃSTWO ===
  ["wielokulturowość","multiculturalism"],["integracja kulturowa","cultural integration"],["ksenofobia","xenophobia"],["tolerancja","tolerance"],["dialog międzykulturowy","intercultural dialogue"],
  ["subkultura","subculture"],["kontrkultura","counterculture"],["mainstream","mainstream"],["kultura masowa","mass culture"],["kultura popularna","popular culture"],
  ["lifestyle","lifestyle"],["konsumpcjonizm","consumerism"],["minimalizm w życiu","minimalist lifestyle"],["slow life","slow life"],["zero waste","zero waste"],
  ["wegaństwo","veganism"],["wegetarianizm","vegetarianism"],["fleksitarianizm","flexitarianism"],["frutarianizm","fruitarianism"],["surowiznożercy","raw food movement"],

  // === PODRÓŻE I GEOGRAFIA ===
  ["Skandynawia","Scandinavia"],["Półwysep Iberyjski","Iberian Peninsula"],["Bałkany","Balkans"],["Kraje Bałtyckie","Baltic States"],["Benelux","Benelux"],
  ["Ameryka Łacińska","Latin America"],["Bliski Wschód","Middle East"],["Azja Połudnowo-Wschodnia","Southeast Asia"],["Afryka Subsaharyjska","Sub-Saharan Africa"],["Karaiby","Caribbean"],
  ["dżet lag","jet lag"],["aklimatyzacja","acclimatisation"],["choroba lokomocyjna","motion sickness"],["ubezpieczenie bagażu","luggage insurance"],["opóźnienie lotu","flight delay"],
  ["transfer na lotnisko","airport transfer"],["autokar turystyczny","tourist coach"],["wynajem jeźdźca","car rental"],["camping pod namiotem","tent camping"],["glamping","glamping"],

  // === SYSTEM EDUKACYJNY ===
  ["obowiązek szkolny","compulsory education"],["szkoła podstawowa","primary school"],["szkoła średnia","secondary school"],["liceum","high school"],["technikum","technical school"],
  ["szkoła zawodowa","vocational school"],["szkoła specjalna","special needs school"],["edukacja domowa","home schooling"],["nauczanie indywidualne","individual teaching"],["klasa integracyjna","integration class"],
  ["edukacja włączająca","inclusive education"],["dostępność edukacyjna","educational accessibility"],["wyrównanie szans","equal opportunities"],["stypendium socjalne","social scholarship"],["wyprawka szkolna","school starter kit"],

  // === GASTRONOMIA ZAAWANSOWANA ===
  ["kuchnia fusion","fusion cuisine"],["slow food","slow food"],["street food","street food"],["food truck","food truck"],["farm-to-table","farm-to-table"],
  ["menu degustacyjne","tasting menu"],["sommelier","sommelier"],["karta win","wine list"],["parowanie jedzenia i wina","food and wine pairing"],["kucharz sous vide","sous-vide cooking"],
  ["fermentacja","fermentation"],["zakwas","sourdough starter"],["kiszenie","pickling"],["marynowanie","marinating"],["wędzenie","smoking"],
];

const B2_EXTRA = [
  // === AKADEMICKIE PISANIE ===
  ["streszczenie","abstract"],["wstęp","introduction"],["przegląd literatury","literature review"],["metodyka badań","research methodology"],["metody jakościowe","qualitative methods"],
  ["metody ilościowe","quantitative methods"],["triangulacja","triangulation"],["studium przypadku","case study"],["badanie etnograficzne","ethnographic study"],["obserwacja uczestnicząca","participant observation"],
  ["wywiad pogłębiony","in-depth interview"],["focus group","focus group"],["kwestionariusz","questionnaire"],["dane pierwotne","primary data"],["dane wtórne","secondary data"],
  ["cytowanie","citation"],["bibliografia","bibliography"],["plagiat","plagiarism"],["wartości p","p-value"],["istotność statystyczna","statistical significance"],

  // === BIOETYKA I ETYKA ===
  ["bioetyka","bioethics"],["etyka medyczna","medical ethics"],["zgoda poinformowana","informed consent"],["autonomia pacjenta","patient autonomy"],["zasada dobroczynności","principle of beneficence"],
  ["zasada nieszkodzenia","principle of non-maleficence"],["sprawiedliwość rozdzielcza","distributive justice"],["etyczna komisja","ethics committee"],["dylemat etyczny","ethical dilemma"],["kazus","case study (ethics)"],
  ["inżynieria eugeniczna","eugenic engineering"],["transhumanizm","transhumanism"],["wzmocnienie poznawcze","cognitive enhancement"],["nieśmiertelność cyfrowa","digital immortality"],["cybernetyczne rozszerzenie","cybernetic enhancement"],

  // === NAUKI SPOŁECZNE ===
  ["dynamika grup","group dynamics"],["przywództwo transformacyjne","transformational leadership"],["przywództwo transakcyjne","transactional leadership"],["styl zarządzania","management style"],["kultura organizacyjna","organisational culture"],
  ["zmiana organizacyjna","organisational change"],["opór wobec zmian","resistance to change"],["zarządzanie konfliktem","conflict management"],["mediacja konfliktów","conflict mediation"],["negocjacje zbiorowe","collective bargaining"],
  ["demokracja bezpośrednia","direct democracy"],["demokracja deliberatywna","deliberative democracy"],["partycypacja obywatelska","citizen participation"],["społeczeństwo obywatelskie","civil society"],["trzeci sektor","third sector"],

  // === TECHNOLOGIA ZAAWANSOWANA ===
  ["sieć 5G","5G network"],["sieć 6G","6G network"],["latające taksówki","flying taxis"],["hyperloop","hyperloop"],["samochód elektryczny","electric car"],
  ["samochód wodorowy","hydrogen car"],["autonomiczne drony","autonomous drones"],["druk biomedyczny","biomedical printing"],["organy wydrukowane 3D","3D printed organs"],["nano-roboty medyczne","medical nano-robots"],
  ["edwtech","edtech"],["healthtech","healthtech"],["fintech","fintech"],["legaltech","legaltech"],["insurtech","insurtech"],
  ["proptech","proptech"],["agritech","agritech"],["cleantech","cleantech"],["govtech","govtech"],["civictech","civic tech"],

  // === EKONOMIA ZAAWANSOWANA ===
  ["rynek wschodzący","emerging market"],["rynek graniczny","frontier market"],["indeks giełdowy","stock market index"],["obligacja skarbowa","government bond"],["obligacja korporacyjna","corporate bond"],
  ["rating kredytowy","credit rating"],["agencja ratingowa","rating agency"],["spekulacja","speculation"],["short selling","short selling"],["margin call","margin call"],
  ["kryzys finansowy","financial crisis"],["bańka spekulacyjna","speculative bubble"],["krach giełdowy","stock market crash"],["dodruk pieniądza","money printing"],["quantitative easing","quantitative easing"],
  ["stagflacja","stagflation"],["pułapka długu","debt trap"],["kryzys zadłużenia","debt crisis"],["restrukturyzacja długu","debt restructuring"],["default","default"],

  // === ŚRODOWISKO ZAAWANSOWANE ===
  ["granice planetarne","planetary boundaries"],["zamknięty obieg materii","circular economy"],["zasada 3R","3Rs principle"],["gospodarka linearna","linear economy"],["gospodarka cyrkularna","circular economy"],
  ["LCA (analiza cyklu życia)","life cycle assessment"],["ślad wodny","water footprint"],["ślad biologiczny","biofootprint"],["usługi ekosystemowe","ecosystem services"],["kapitał naturalny","natural capital"],
  ["adaptacja do zmian klimatu","climate adaptation"],["mitygacja zmian klimatu","climate mitigation"],["odporność klimatyczna","climate resilience"],["sprawiedliwość klimatyczna","climate justice"],["długi klimatyczni","climate debt"],
];

const C1_EXTRA = [
  // === FILOZOFIA ZAAWANSOWANA ===
  ["implicite wiedza","tacit knowledge"],["explicite wiedza","explicit knowledge"],["enaktywizm","enactivism"],["ucieleśniene poznanie","embodied cognition"],["rozszerzone umysł","extended mind"],
  ["kognitywne narzędzia","cognitive tools"],["scaffolding","scaffolding"],["internalizacja","internalization"],["eksterioryzacja","exteriorization"],["intersubiektywność","intersubjectivity"],
  ["fenomenologia społeczna","social phenomenology"],["typizacje","typifications"],["świat życia","lifeworld"],["kryzys nauk europejskich","crisis of European sciences"],["intencjonalność","intentionality"],
  ["noema","noema"],["noesis","noesis"],["epoché","epoché"],["redukcja fenomenologiczna","phenomenological reduction"],["intersubiektywna konstytucja","intersubjective constitution"],

  // === NAUKI O JĘZYKU ===
  ["gramatyka komunikatywna","communicative grammar"],["kompetencja komunikatywna","communicative competence"],["interlingua","interlingual"],["transfer językowy","language transfer"],["fosylizacja","fossilisation"],
  ["kontinuum nabywania","acquisition continuum"],["hipoteza wejścia","input hypothesis"],["zrozumiałe wejście","comprehensible input"],["filtr afektywny","affective filter"],["nabywanie porządku naturalnego","natural order acquisition"],
  ["interlang","interlanguage"],["komunikacja niejednoznaczna","ambiguous communication"],["parafraza","paraphrase"],["peryfrazа","periphrasis"],["redundancja","redundancy"],

  // === TEORIA LITERATURY ===
  ["teoria recepcji","reception theory"],["estetyka odbioru","aesthetics of reception"],["horyzont oczekiwań","horizon of expectations"],["luka nieokreśloności","gap of indeterminacy"],["konkretyzacja","concretisation"],
  ["fikcja jako ontologia","fiction as ontology"],["narratologia","narratology"],["czas narracji","narrative time"],["perspektywa narracyjna","narrative perspective"],["wolna mowa zależna","free indirect speech"],
  ["stream of consciousness","stream of consciousness"],["monolog wewnętrzny","internal monologue"],["wielogłosowość","polyphony"],["heteroglosja","heteroglossia"],["karnawalizacja","carnivalisation"],
  ["intertekstualność","intertextuality"],["hipertekst literacki","literary hypertext"],["transfikcjonalność","transfictionality"],["metafikcja","metafiction"],["autoreferencjalność","self-referentiality"],

  // === PSYCHOLOGIA ZAAWANSOWANA ===
  ["afekt podstawowy","core affect"],["walencja emocjonalna","emotional valence"],["pobudzenie emocjonalne","emotional arousal"],["regulacja emocji","emotion regulation"],["reappraisal","reappraisal"],
  ["tłumienie emocji","emotional suppression"],["aleksytymia","alexithymia"],["mentalizowanie","mentalising"],["teoria umysłu","theory of mind"],["empatia poznawcza","cognitive empathy"],
  ["empatia afektywna","affective empathy"],["zarażenie emocjonalne","emotional contagion"],["rezonans emocjonalny","emotional resonance"],["współczucie","compassion"],["samowspółczucie","self-compassion"],

  // === PRAWO ZAAWANSOWANE ===
  ["sukcesja prawna","legal succession"],["dziedziczenie ustawowe","intestate succession"],["testament","will"],["zapis testamentowy","bequest"],["zachowek","forced heirship"],
  ["prawo rzeczowe","property law"],["służebność","easement"],["użytkowanie wieczyste","perpetual usufruct"],["hipoteka","mortgage"],["zastaw rejestrowy","registered pledge"],
  ["upadłość konsumencka","consumer bankruptcy"],["restrukturyzacja sądowa","court restructuring"],["wierzytelność","receivable"],["dłużnik","debtor"],["wierzyciel","creditor"],
];

const C2_EXTRA = [
  // === SŁOWNICTWO ARCHAICZNE ===
  ["opak","backward (archaic)"],["jeno","only/but (archaic)"],["czart","devil (archaic)"],["mamona","Mammon/wealth (archaic)"],["knieja","dense forest"],
  ["gusła","sorcery"],["wróżba","divination"],["zaklinanie","conjuring"],["guślarz","sorcerer"],["jędza","hag/witch"],
  ["błoto","mud/swamp (older connotation)"],["moczary","marshland"],["ostęp","deep forest/thicket"],["kniejа","forest glade"],["zamczysko","ruined castle"],
  ["grodzisko","fortified settlement (ruin)"],["gród","stronghold (historical)"],["podgrodzie","settlement below castle"],["opole","territorial community (historical)"],["komes","count (historical)"],

  // === NEOLOGIZMY ===
  ["cyfrowa demencja","digital dementia"],["infodemia","infodemic"],["nomofobia","nomophobia"],["phubbing","phubbing"],["digital detox","digital detox"],
  ["techlash","techlash"],["surveillance capitalism","surveillance capitalism"],["nudge theory","nudge theory"],["dark patterns","dark patterns"],["enshittification","enshittification"],
  ["FOMO","FOMO"],["JOMO","JOMO"],["doomscrolling","doomscrolling"],["brain rot","brain rot"],["parasocial relationship","parasocial relationship"],

  // === NAUKI SPECJALISTYCZNE ===
  ["topologia","topology"],["topologia algebraiczna","algebraic topology"],["geometria różniczkowa","differential geometry"],["przestrzeń Hilberta","Hilbert space"],["przestrzeń Banacha","Banach space"],
  ["analiza funkcjonalna","functional analysis"],["teoria miary","measure theory"],["topologia punktowa","point-set topology"],["teoria grafów","graph theory"],["kombinatoryka","combinatorics"],
  ["teoria kategorii","category theory"],["logika modalna","modal logic"],["teoria typów","type theory"],["lambda rachunek","lambda calculus"],["logika intuicjonistyczna","intuitionistic logic"],

  // === WYRAFINOWANE PRZYMIOTNIKI ===
  ["melancholijny","melancholic"],["elegijny","elegiac"],["diafan","diaphanous"],["translucidny","translucent"],["opalizujący","opalescent"],
  ["iridescent","iridescent"],["fosforyzujący","phosphorescent"],["bioluminescencyjny","bioluminescent"],["fluorescencyjny","fluorescent"],["emanujący","emanating"],
  ["przenikający","permeating"],["wszechobecny","omnipresent"],["wszechmocny","omnipotent"],["wszechwiedząc","omniscient"],["nieomylny","infallible"],
  ["nieokiełznany","untamed/unbridled"],["nieposkromiony","indomitable"],["niezłomny","unbreakable"],["niezachwiany","unwavering"],["nieugięty","unyielding"],
  ["bezlitosny","merciless"],["nieubłagany","inexorable"],["nieuchronny","inevitable"],["nieunikniony","unavoidable"],["nieodwołalny","irrevocable"],
];

// ─── Load, extend, dedup, save ───
const words = JSON.parse(fs.readFileSync('words.json', 'utf8'));

let nextId = words.length + 1;
const seen = new Set(words.map(w => w.pl.toLowerCase().trim()));

function addWords(pairs, level) {
  for (const [pl, en] of pairs) {
    const key = pl.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      words.push({ id: nextId++, pl, en, level });
    }
  }
}

addWords(A2_EXTRA, 'A2');
addWords(B1_EXTRA, 'B1');
addWords(B2_EXTRA, 'B2');
addWords(C1_EXTRA, 'C1');
addWords(C2_EXTRA, 'C2');

// Renumber
words.forEach((w, i) => { w.id = i + 1; });

fs.writeFileSync('words.json', JSON.stringify(words, null, 2), 'utf8');

const counts = {};
for (const w of words) counts[w.level] = (counts[w.level] || 0) + 1;
console.log('✓ Rozszerzono words.json!');
console.log('  Łącznie słów:', words.length);
for (const [lvl, cnt] of Object.entries(counts)) console.log(`  ${lvl}: ${cnt}`);
