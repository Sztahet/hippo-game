/**
 * generate_words_v2.js
 * Reads existing words.json (marks all as A1), appends A2-C2 vocab.
 * Run: node generate_words_v2.js
 */
const fs = require('fs');

// ─────────────────────────────────────────────
// A2 — Elementarny (~1 500 słów)
// ─────────────────────────────────────────────
const A2_WORDS = [
  // === CZASOWNIKI ROZSZERZONE ===
  ["pływać","swim"],["gotować","cook"],["smażyć","fry"],["piec","bake"],["kroić","cut"],
  ["obierać","peel"],["mieszać","mix"],["ważyć","weigh"],["mierzyć","measure"],["sprzątać","clean"],
  ["odkurzać","vacuum"],["zamiatać","sweep"],["prać","do laundry"],["prasować","iron"],["naprawiać","repair"],
  ["budować","build"],["malować","paint"],["rysować","draw"],["fotografować","take photos"],["nagrywać","record"],
  ["biegać","run"],["skakać","jump"],["rzucać","throw"],["łapać","catch"],["kopać","kick"],
  ["ćwiczyć","exercise"],["tańczyć","dance"],["śpiewać","sing"],["grać na gitarze","play guitar"],["grać na pianinie","play piano"],
  ["pytać","ask"],["odpowiadać","answer"],["tłumaczyć","explain"],["powtarzać","repeat"],["planować","plan"],
  ["organizować","organize"],["rezerwować","book"],["odwoływać","cancel"],["wybierać","choose"],["decydować","decide"],
  ["zgadzać się","agree"],["proponować","suggest"],["polecać","recommend"],["zapraszać","invite"],["martwić się","worry"],
  ["cieszyć się","be happy"],["śmiać się","laugh"],["płakać","cry"],["odpoczywać","rest"],["wracać","return"],
  ["przyjeżdżać","arrive"],["wyjeżdżać","depart"],["przeprowadzać się","move house"],["odwiedzać","visit"],["pożyczać","borrow"],
  ["płacić","pay"],["zamawiać","order"],["wysyłać","send"],["ładować","charge"],["pobierać","download"],
  ["szukać","search"],["sprawdzać","check"],["zmieniać","change"],["poprawiać","improve"],["pomagać","help"],
  ["myć naczynia","wash dishes"],["kąpać się","take a bath"],["czesać się","comb hair"],["golić się","shave"],["ubierać się","get dressed"],
  ["pakować","pack"],["kupować","buy"],["sprzedawać","sell"],["wymieniać","exchange"],["kroić chleb","slice bread"],
  ["parzyć herbatę","brew tea"],["krzyczеć","shout"],["szептać","whisper"],["otwierać","open"],["zamykać","close"],
  ["włączać","turn on"],["wyłączać","turn off"],["dzwonić","call"],["wpisywać","type"],["drukować","print"],
  ["kopiować","copy"],["usuwać","delete"],["zapisywać","save"],["logować się","log in"],["wylogowywać się","log out"],
  ["kłócić się","argue"],["przepraszać","apologize"],["dziękować","thank"],["witać się","greet"],["żegnać się","say goodbye"],
  ["jeść śniadanie","eat breakfast"],["jeść obiad","eat lunch"],["jeść kolację","eat dinner"],["podjechać","drive up"],["zawieźć","drive someone"],
  ["umyć się","wash oneself"],["ściąć włosy","get a haircut"],["założyć okulary","put on glasses"],["zdjąć buty","take off shoes"],["spóźnić się","be late"],
  // === JEDZENIE ROZSZERZONE ===
  ["jogurt","yogurt"],["twaróg","cottage cheese"],["śmietana","sour cream"],["szynka","ham"],["kiełbasa","sausage"],
  ["boczek","bacon"],["indyk","turkey"],["kaczka","duck"],["łosoś","salmon"],["tuńczyk","tuna"],
  ["krewetki","shrimp"],["krab","crab"],["orzechy","nuts"],["migdały","almonds"],["orzechy włoskie","walnuts"],
  ["pestki dyni","pumpkin seeds"],["sezam","sesame"],["cukinia","zucchini"],["bakłażan","eggplant"],["por","leek"],
  ["seler","celery"],["pietruszka","parsley"],["koper","dill"],["bazylia","basil"],["oregano","oregano"],
  ["tymianek","thyme"],["rozmaryn","rosemary"],["curry","curry"],["papryka mielona","paprika"],["cynamon","cinnamon"],
  ["wanilia","vanilla"],["imbir","ginger"],["kurkuma","turmeric"],["musztarda","mustard"],["majonez","mayonnaise"],
  ["ketchup","ketchup"],["sos sojowy","soy sauce"],["ocet balsamiczny","balsamic vinegar"],["syrop","syrup"],["karmel","caramel"],
  ["bita śmietana","whipped cream"],["budyń","pudding"],["galaretka","jelly"],["marmolada","marmalade"],["płatki owsiane","oats"],
  ["musli","muesli"],["płatki kukurydziane","corn flakes"],["omlet","omelette"],["naleśniki","crepes"],["gofry","waffles"],
  ["tost","toast"],["bułka","bread roll"],["bajgiel","bagel"],["pączek","doughnut"],["rogalik","croissant"],
  ["ciasto drożdżowe","yeast cake"],["szarlotka","apple pie"],["sernik","cheesecake"],["tiramisu","tiramisu"],["mousse czekoladowe","chocolate mousse"],
  ["truskawki z cukrem","strawberries with sugar"],["kompot","compote"],["koktajl","smoothie"],["shake","milkshake"],["lemoniada","lemonade"],
  ["woda mineralna","mineral water"],["woda gazowana","sparkling water"],["napój energetyczny","energy drink"],["kakao","cocoa"],["gorąca czekolada","hot chocolate"],
  // === ZAKUPY ===
  ["sklep spożywczy","grocery store"],["supermarket","supermarket"],["centrum handlowe","shopping center"],["targ","market"],["kiosk","kiosk"],
  ["apteka","pharmacy"],["piekarnia","bakery"],["cukiernia","pastry shop"],["mięsny","butcher"],["warzywnik","greengrocer"],
  ["drogeria","drugstore"],["księgarnia","bookstore"],["sklep odzieżowy","clothing store"],["sklep sportowy","sports store"],["sklep z elektroniką","electronics store"],
  ["dział","department"],["kasa","checkout"],["paragon","receipt"],["faktura","invoice"],["rabat","discount"],
  ["wyprzedaż","sale"],["przecena","markdown"],["tani","cheap"],["drogi","expensive"],["rozmiar","size"],
  ["przymierzalnia","fitting room"],["przymierzać","try on"],["pasować","fit"],["karta kredytowa","credit card"],["gotówka","cash"],
  ["przelew","bank transfer"],["koszyk","basket"],["wózek","shopping cart"],["torba na zakupy","shopping bag"],["zwrot towaru","product return"],
  ["gwarancja","warranty"],["wymiana","exchange"],["promocja","promotion"],["oferta","offer"],["cena regularna","regular price"],
  // === TRANSPORT ===
  ["pociąg","train"],["autobus","bus"],["tramwaj","tram"],["metro","subway"],["taksówka","taxi"],
  ["rower","bicycle"],["skuter","scooter"],["motocykl","motorcycle"],["ciężarówka","truck"],["stacja","station"],
  ["peron","platform"],["przystanek","stop"],["lotnisko","airport"],["port lotniczy","airport terminal"],["terminal","terminal"],
  ["bilet","ticket"],["bilet w jedną stronę","one-way ticket"],["bilet powrotny","return ticket"],["bilet miesięczny","monthly pass"],["rozkład jazdy","timetable"],
  ["opóźnienie","delay"],["odlot","departure"],["przylot","arrival"],["odprawa","check-in"],["bagaż","luggage"],
  ["bagaż podręczny","hand luggage"],["walizka","suitcase"],["plecak szkolny","school bag"],["trasa","route"],["kierunek","direction"],
  ["skrzyżowanie","intersection"],["rondo","roundabout"],["autostrada","highway"],["chodnik","sidewalk"],["parking","parking lot"],
  ["stacja benzynowa","gas station"],["paliwo","fuel"],["benzyna","petrol"],["mandat","fine"],["przejście dla pieszych","crosswalk"],
  ["pasażer","passenger"],["kierowca","driver"],["pilot","pilot"],["kapitan","captain"],["szofer","chauffeur"],
  ["taxi uber","ride-share"],["sygnalizacja świetlna","traffic lights"],["korki","traffic jam"],["objazd","detour"],["most","bridge"],
  // === ZDROWIE ===
  ["ból głowy","headache"],["ból zęba","toothache"],["ból pleców","backache"],["gorączka","fever"],["kaszel","cough"],
  ["katar","runny nose"],["grypa","flu"],["przeziębienie","cold"],["alergia","allergy"],["astma","asthma"],
  ["pigułka","pill"],["tabletka","tablet"],["syrop","syrup"],["krople","drops"],["maść","ointment"],
  ["plaster","bandage"],["recepta","prescription"],["wizyta lekarska","doctor's appointment"],["lekarz","doctor"],["pielęgniarka","nurse"],
  ["dentysta","dentist"],["farmaceuta","pharmacist"],["karetka","ambulance"],["szpital","hospital"],["klinika","clinic"],
  ["poczekalnia","waiting room"],["badanie","examination"],["wynik","result"],["RTG","X-ray"],["USG","ultrasound"],
  ["szczepionka","vaccine"],["ubezpieczenie zdrowotne","health insurance"],["stłuczenie","bruise"],["skaleczenie","cut"],["złamanie","fracture"],
  ["skręcenie","sprain"],["rana","wound"],["zawroty głowy","dizziness"],["mdłości","nausea"],["wymioty","vomiting"],
  ["biegunka","diarrhea"],["zaparcie","constipation"],["wysypka","rash"],["swędzenie","itching"],["obrzęk","swelling"],
  // === UBRANIA ===
  ["koszula","shirt"],["bluzka","blouse"],["t-shirt","t-shirt"],["sweter","sweater"],["bluza","hoodie"],
  ["marynarka","blazer"],["garnitur","suit"],["sukienka","dress"],["spódnica","skirt"],["spodnie","trousers"],
  ["dżinsy","jeans"],["szorty","shorts"],["leginsy","leggings"],["rajstopy","tights"],["skarpety","socks"],
  ["majtki","underwear"],["biustonosz","bra"],["piżama","pyjamas"],["szlafrok","bathrobe"],["strój kąpielowy","swimsuit"],
  ["płaszcz","coat"],["kurtka","jacket"],["wiatrówka","windbreaker"],["rękawiczki","gloves"],["szalik","scarf"],
  ["czapka","cap"],["kapelusz","hat"],["buty","shoes"],["botki","ankle boots"],["trampki","sneakers"],
  ["sandały","sandals"],["klapki","flip-flops"],["obcasy","heels"],["kozaki","knee-high boots"],["kalosze","rubber boots"],
  ["krawat","tie"],["pasek","belt"],["naszyjnik","necklace"],["bransoletka","bracelet"],["kolczyki","earrings"],
  ["pierścionek","ring"],["zegarek","watch"],["okulary słoneczne","sunglasses"],["okulary","glasses"],["torebka","handbag"],
  // === DOM / MIESZKANIE ===
  ["salon","living room"],["sypialnia","bedroom"],["łazienka","bathroom"],["toaleta","toilet"],["kuchnia","kitchen"],
  ["jadalnia","dining room"],["korytarz","hallway"],["pralnia","laundry room"],["garaż","garage"],["piwnica","basement"],
  ["strych","attic"],["balkon","balcony"],["taras","terrace"],["ogród","garden"],["dziedziniec","courtyard"],
  ["wanna","bathtub"],["prysznic","shower"],["umywalka","washbasin"],["zlew","sink"],["pralka","washing machine"],
  ["suszarka","dryer"],["zmywarka","dishwasher"],["lodówka","fridge"],["zamrażarka","freezer"],["kuchenka","stove"],
  ["piekarnik","oven"],["mikrofalówka","microwave"],["toster","toaster"],["czajnik","kettle"],["ekspres do kawy","coffee machine"],
  ["sokowirówka","juicer"],["blender","blender"],["frytkownica","deep fryer"],["grzejnik","radiator"],["klimatyzacja","air conditioning"],
  ["wentylator","fan"],["odkurzacz","vacuum cleaner"],["żelazko","iron"],["deska do prasowania","ironing board"],["lustro","mirror"],
  ["szafa","wardrobe"],["komoda","chest of drawers"],["półka","shelf"],["regał","bookcase"],["biurko","desk"],
  ["tapeta","wallpaper"],["wykładzina","carpet"],["parkiet","parquet"],["kafelki","tiles"],["roleta","blind"],
  ["żaluzje","venetian blinds"],["firanka","net curtain"],["zasłona","curtain"],["żarówka","light bulb"],["kabel","cable"],
  // === SZKOŁA I NAUKA ===
  ["klasa","classroom"],["tablica","blackboard"],["kreda","chalk"],["marker","marker"],["zeszyt","notebook"],
  ["długopis","pen"],["ołówek","pencil"],["gumka","eraser"],["linijka","ruler"],["zakreślacz","highlighter"],
  ["temperówka","pencil sharpener"],["teczka","folder"],["dyktando","dictation"],["sprawdzian","test"],["ocena","grade"],
  ["zaliczenie","pass"],["niepowodzenie","fail"],["świadectwo","school report"],["dyplom","diploma"],["przedmiot","subject"],
  ["matematyka","mathematics"],["fizyka","physics"],["chemia","chemistry"],["biologia","biology"],["historia","history"],
  ["geografia","geography"],["literatura","literature"],["muzyka","music"],["plastyka","art"],["wychowanie fizyczne","PE"],
  ["informatyka","IT"],["religia","religion"],["wychowawca","class teacher"],["dyrektor","headmaster"],["korepetycje","tutoring"],
  ["wycieczka szkolna","school trip"],["przerwa","break"],["lekcja","lesson"],["ćwiczenie","exercise"],["zadanie domowe","homework"],
  ["projekt","project"],["referat","essay"],["prezentacja szkolna","school presentation"],["egzamin maturalny","A-levels"],["studia","university studies"],
  // === PRACA ===
  ["biuro","office"],["sala konferencyjna","conference room"],["recepcja","reception"],["stołówka","canteen"],["przełożony","supervisor"],
  ["menedżer","manager"],["asystent","assistant"],["sekretarka","secretary"],["pracownik","employee"],["urzędnik","clerk"],
  ["księgowy","accountant"],["prawnik","lawyer"],["konsultant","consultant"],["programista","programmer"],["grafik","graphic designer"],
  ["redaktor","editor"],["dziennikarz","journalist"],["marketing","marketing department"],["sprzedaż","sales"],["wynagrodzenie","salary"],
  ["pensja","wage"],["premia","bonus"],["urlop","annual leave"],["zwolnienie chorobowe","sick leave"],["awans","promotion"],
  ["szkolenie","training"],["konferencja","conference"],["delegacja","business trip"],["rekrutacja","recruitment"],["interview","job interview"],
  // === NATURA I POGODA ===
  ["mgła","fog"],["grad","hail"],["burza","storm"],["błyskawica","lightning"],["grzmot","thunder"],
  ["mróz","frost"],["lód","ice"],["ulewa","downpour"],["mżawka","drizzle"],["śnieżyca","blizzard"],
  ["powódź","flood"],["susza","drought"],["huragan","hurricane"],["prognoza pogody","weather forecast"],["wilgotność","humidity"],
  ["ciśnienie atmosferyczne","atmospheric pressure"],["wzgórze","hill"],["dolina","valley"],["nizina","lowland"],["wyżyna","upland"],
  ["płaskowyż","plateau"],["klif","cliff"],["jaskinia","cave"],["wodospad","waterfall"],["jezioro","lake"],
  ["staw","pond"],["bagno","swamp"],["plaża","beach"],["brzeg","shore"],["wybrzeże","coastline"],
  ["dżungla","jungle"],["pustynia","desert"],["tundra","tundra"],["sawanna","savanna"],["tropikalny","tropical"],
  ["polarny","polar"],["umiarkowany","temperate"],["kontynentalny","continental"],["równik","equator"],["biegun","pole"],
  // === HOBBY I SPORT ===
  ["ogrodnictwo","gardening"],["rzeźbienie","sculpting"],["zbieranie znaczków","stamp collecting"],["modelarstwo","model making"],
  ["szydełkowanie","crocheting"],["dzierganie","knitting"],["szycie","sewing"],["haftowanie","embroidery"],
  ["gry planszowe","board games"],["gry karciane","card games"],["szachy","chess"],["warcaby","checkers"],["sudoku","sudoku"],
  ["krzyżówka","crossword"],["jazda na rowerze","cycling"],["joga","yoga"],["pilates","pilates"],["wspinaczka","climbing"],
  ["jazda konna","horse riding"],["łucznictwo","archery"],["wędkarstwo","fishing"],["kempink","camping"],
  ["turystyka piesza","hiking"],["narciarstwo","skiing"],["snowboard","snowboarding"],["łyżwiarstwo","ice skating"],
  ["surfowanie","surfing"],["nurkowanie","diving"],["kajakarstwo","kayaking"],["żeglarstwo","sailing"],
  ["tenis","tennis"],["siatkówka","volleyball"],["koszykówka","basketball"],["siatkówka plażowa","beach volleyball"],
  ["golf","golf"],["badminton","badminton"],["squash","squash"],["ping-pong","table tennis"],["kręgle","bowling"],
  ["taniec towarzyski","ballroom dancing"],["balet","ballet"],["taniec nowoczesny","modern dance"],["zwiedzanie","sightseeing"],["wolontariat","volunteering"],
  // === RODZINA ROZSZERZONA ===
  ["wujek","uncle"],["ciocia","aunt"],["kuzyn","cousin"],["teść","father-in-law"],["teściowa","mother-in-law"],
  ["zięć","son-in-law"],["synowa","daughter-in-law"],["szwagier","brother-in-law"],["szwagierka","sister-in-law"],
  ["narzeczony","fiancé"],["narzeczona","fiancée"],["chłopak","boyfriend"],["partner","partner"],["kolega","colleague"],
  ["sąsiad","neighbour"],["pracodawca","employer"],["szef","boss"],["opieka","care"],["wsparcie","support"],
  ["miłość","love"],["przyjaźń","friendship"],["lojalność","loyalty"],["zaufanie","trust"],["szacunek","respect"],
  ["kłótnia","argument"],["rozstanie","breakup"],["ślub","wedding"],["wesele","wedding reception"],["rozwód","divorce"],
  // === MIEJSCA W MIEŚCIE ===
  ["ratusz","town hall"],["urząd","government office"],["poczta","post office"],["restauracja","restaurant"],["kawiarnia","café"],
  ["pub","pub"],["park","park"],["ogród zoologiczny","zoo"],["muzeum","museum"],["galeria sztuki","art gallery"],
  ["teatr","theatre"],["kino","cinema"],["biblioteka","library"],["kościół","church"],["meczet","mosque"],
  ["synagoga","synagogue"],["stadion","stadium"],["basen","swimming pool"],["siłownia","gym"],["klub sportowy","sports club"],
  ["hotel","hotel"],["hostel","hostel"],["pensjonat","guesthouse"],["centrum miasta","city centre"],["przedmieście","suburb"],
  ["dzielnica","district"],["plac","square"],["fontanna","fountain"],["pomnik","monument"],["tunel","tunnel"],
  ["nabrzeże","waterfront"],["bulwar","boulevard"],["aleja","avenue"],["przejście podziemne","underpass"],["kładka","footbridge"],
  // === CZAS ===
  ["poniedziałek","Monday"],["wtorek","Tuesday"],["środa","Wednesday"],["czwartek","Thursday"],["piątek","Friday"],
  ["sobota","Saturday"],["niedziela","Sunday"],["styczeń","January"],["luty","February"],["marzec","March"],
  ["kwiecień","April"],["maj","May"],["czerwiec","June"],["lipiec","July"],["sierpień","August"],
  ["wrzesień","September"],["październik","October"],["listopad","November"],["grudzień","December"],
  ["wiosna","spring"],["lato","summer"],["jesień","autumn"],["zima","winter"],["data","date"],
  ["termin","deadline"],["wakacje","summer holidays"],["ferie","school break"],["święto","public holiday"],
  ["urodziny","birthday"],["imieniny","name day"],["rocznica","anniversary"],["Boże Narodzenie","Christmas"],
  ["Wielkanoc","Easter"],["Nowy Rok","New Year"],["wigilia","Christmas Eve"],["sylwester","New Year's Eve"],
  ["zaraz","soon"],["później","later"],["dawno","long ago"],["niedawno","recently"],["zazwyczaj","usually"],
  ["czasami","sometimes"],["co dzień","every day"],["codziennie","daily"],["tygodniowo","weekly"],["miesięcznie","monthly"],
  ["rocznie","annually"],["rano","in the morning"],["w południe","at noon"],["po południu","in the afternoon"],["wieczorem","in the evening"],
  ["przez cały dzień","all day"],["kwadrans","quarter of an hour"],["pół godziny","half an hour"],["o świcie","at dawn"],["o zmierzchu","at dusk"],
  // === PRZYMIOTNIKI I PRZYSŁÓWKI ===
  ["niebieski","blue"],["czerwony","red"],["zielony","green"],["żółty","yellow"],["pomarańczowy","orange"],
  ["fioletowy","purple"],["różowy","pink"],["brązowy","brown"],["szary","grey"],["beżowy","beige"],
  ["złoty","golden"],["srebrny","silver"],["jasny","light"],["ciemny","dark"],["jaskrawy","bright"],
  ["blady","pale"],["przezroczysty","transparent"],["matowy","matt"],["błyszczący","shiny"],["okrągły","round"],
  ["kwadratowy","square"],["prostokątny","rectangular"],["owalny","oval"],["płaski","flat"],["gładki","smooth"],
  ["szorstki","rough"],["elastyczny","elastic"],["kruchy","fragile"],["wytrzymały","durable"],["lekki","light"],
  ["cienki","thin"],["gruby","thick"],["wąski","narrow"],["szeroki","wide"],["głośny","loud"],
  ["głęboki","deep"],["płytki","shallow"],["stary","old"],["nowy","new"],["świeży","fresh"],
  ["czysty","clean"],["brudny","dirty"],["mokry","wet"],["suchy","dry"],["gorący","hot"],
  ["zimny","cold"],["ciepły","warm"],["chłodny","cool"],["szybki","fast"],["wolny","slow"],
  ["łatwy","easy"],["trudny","difficult"],["ważny","important"],["ciekawy","interesting"],["nudny","boring"],
  ["ładny","pretty"],["brzydki","ugly"],["słodki","sweet"],["kwaśny","sour"],["gorzki","bitter"],
  ["słony","salty"],["ostry","spicy"],["łagodny","mild"],["tłusty","fatty"],["zdrowy","healthy"],
  ["chory","ill"],["gotowy","ready"],["zajęty","busy"],["wolny","free"],["szczęśliwy","happy"],
  ["smutny","sad"],["złościć się","be angry"],["zmęczony","tired"],["głodny","hungry"],["pewny","sure"],
  // === TECHNOLOGIA PODSTAWOWA ===
  ["internet","internet"],["strona internetowa","website"],["aplikacja","app"],["smartfon","smartphone"],["tablet","tablet"],
  ["laptop","laptop"],["monitor","monitor"],["klawiatura","keyboard"],["myszka","mouse"],["drukarka","printer"],
  ["skaner","scanner"],["dysk twardy","hard drive"],["pendrive","USB drive"],["karta pamięci","memory card"],["chmura","cloud"],
  ["serwer","server"],["sieć","network"],["wifi","wifi"],["bluetooth","bluetooth"],["hasło","password"],
  ["login","username"],["e-mail","email"],["załącznik","attachment"],["folder","folder"],["plik","file"],
  ["zdjęcie","photo"],["wideo","video"],["strumieniowanie","streaming"],["pobieranie","downloading"],["aktualizacja","update"],
  ["wirus komputerowy","computer virus"],["kopia zapasowa","backup"],["media społecznościowe","social media"],["profil","profile"],
  ["obserwujący","follower"],["polubienie","like"],["udostępnienie","share"],["komentarz","comment"],["powiadomienie","notification"],
];

// ─────────────────────────────────────────────
// B1 — Średniozaawansowany (~2 000 słów)
// ─────────────────────────────────────────────
const B1_WORDS = [
  // === KARIERA I PRACA ===
  ["wniosek o pracę","job application"],["CV","CV"],["list motywacyjny","cover letter"],["rozmowa kwalifikacyjna","job interview"],["praca na próbę","trial period"],
  ["umowa o pracę","employment contract"],["umowa zlecenie","freelance contract"],["samozatrudnienie","self-employment"],["praca zdalna","remote work"],["home office","home office"],
  ["agencja pracy","recruitment agency"],["headhunter","headhunter"],["referencje","references"],["polecenie","referral"],["sieć kontaktów","professional network"],
  ["kompetencje","competences"],["kwalifikacje","qualifications"],["doświadczenie zawodowe","work experience"],["staż","internship"],["wolontariat zawodowy","professional volunteering"],
  ["branża","industry"],["sektor","sector"],["korporacja","corporation"],["start-up","start-up"],["franczyza","franchise"],
  ["marka","brand"],["produkt","product"],["usługa","service"],["sprzedaż detaliczna","retail"],["sprzedaż hurtowa","wholesale"],
  ["eksport","export"],["import","import"],["dostawca","supplier"],["klient","client"],["kontrahent","contractor"],
  ["negocjacje","negotiations"],["oferta handlowa","business offer"],["przetarg","tender"],["zamówienie","order"],["dostawa","delivery"],
  // === TECHNOLOGIA ===
  ["sztuczna inteligencja","artificial intelligence"],["uczenie maszynowe","machine learning"],["algorytm","algorithm"],["kod źródłowy","source code"],["debugowanie","debugging"],
  ["programowanie","programming"],["baza danych","database"],["interfejs","interface"],["API","API"],["frontend","frontend"],
  ["backend","backend"],["szyfrowanie","encryption"],["cyberbezpieczeństwo","cybersecurity"],["hakerstwo","hacking"],["phishing","phishing"],
  ["chmura obliczeniowa","cloud computing"],["wirtualizacja","virtualization"],["serwer wirtualny","virtual server"],["hosting","hosting"],["domena","domain"],
  ["oprogramowanie","software"],["sprzęt","hardware"],["procesor","processor"],["pamięć RAM","RAM"],["dysk SSD","SSD drive"],
  ["rozdzielczość","resolution"],["grafika","graphics"],["rendering","rendering"],["animacja","animation"],["interfejs użytkownika","user interface"],
  ["aplikacja mobilna","mobile app"],["system operacyjny","operating system"],["aktualizacja systemu","system update"],["sterownik","driver"],["wtyczka","plugin"],
  // === ZDROWIE I MEDYCYNA ===
  ["kardiolog","cardiologist"],["neurolog","neurologist"],["ortopeda","orthopaedist"],["dermatolog","dermatologist"],["ginekolog","gynaecologist"],
  ["pediatra","paediatrician"],["psychiatra","psychiatrist"],["psycholog","psychologist"],["dietetyk","dietitian"],["logopeda","speech therapist"],
  ["fizjoterapia","physiotherapy"],["rehabilitacja","rehabilitation"],["chemioterapia","chemotherapy"],["radioterapia","radiotherapy"],["immunologia","immunology"],
  ["odporność","immunity"],["szczepienie","vaccination"],["epidemia","epidemic"],["pandemia","pandemic"],["kwarantanna","quarantine"],
  ["izolacja","isolation"],["test PCR","PCR test"],["antygen","antigen"],["przeciwciało","antibody"],["wirus","virus"],
  ["bakteria","bacteria"],["infekcja","infection"],["stan zapalny","inflammation"],["nowotwór","cancer"],["cukrzyca","diabetes"],
  ["nadciśnienie","hypertension"],["cholesterol","cholesterol"],["otyłość","obesity"],["anoreksja","anorexia"],["depresja","depression"],
  ["lęk","anxiety"],["panika","panic"],["stres","stress"],["syndrom wypalenia","burnout syndrome"],["terapia","therapy"],
  // === SPOŁECZEŃSTWO I POLITYKA ===
  ["demokracja","democracy"],["republika","republic"],["monarchia","monarchy"],["dyktatura","dictatorship"],["totalitaryzm","totalitarianism"],
  ["wybory","elections"],["głosowanie","voting"],["kandydat","candidate"],["kampania wyborcza","election campaign"],["propaganda","propaganda"],
  ["parlament","parliament"],["rząd","government"],["opozycja","opposition"],["koalicja","coalition"],["konstytucja","constitution"],
  ["prawo","law"],["obywatel","citizen"],["obywatelstwo","citizenship"],["imigrant","immigrant"],["uchodźca","refugee"],
  ["integracja","integration"],["dyskryminacja","discrimination"],["rasizm","racism"],["seksizm","sexism"],["homofobia","homophobia"],
  ["protest","protest"],["demonstracja","demonstration"],["strajk","strike"],["petycja","petition"],["bojkot","boycott"],
  ["prawa człowieka","human rights"],["wolność słowa","freedom of speech"],["cenzura","censorship"],["korupcja","corruption"],["lobbing","lobbying"],
  // === ŚRODOWISKO ===
  ["ekologia","ecology"],["środowisko naturalne","natural environment"],["zmiany klimatyczne","climate change"],["globalne ocieplenie","global warming"],["efekt cieplarniany","greenhouse effect"],
  ["ślad węglowy","carbon footprint"],["emisja CO2","CO2 emission"],["odnawialne źródła energii","renewable energy"],["energia słoneczna","solar energy"],["energia wiatrowa","wind energy"],
  ["energia wodna","hydropower"],["energia geotermalna","geothermal energy"],["paliwa kopalne","fossil fuels"],["węgiel","coal"],["ropa naftowa","crude oil"],
  ["gaz ziemny","natural gas"],["recykling","recycling"],["segregacja śmieci","waste sorting"],["biodegradowalny","biodegradable"],["plastik jednorazowy","single-use plastic"],
  ["deforestacja","deforestation"],["wylesianie","deforestation"],["erozja","erosion"],["degradacja gleby","soil degradation"],["zanieczyszczenie wody","water pollution"],
  ["zanieczyszczenie powietrza","air pollution"],["smog","smog"],["ozon","ozone"],["dziura ozonowa","ozone hole"],["bioróżnorodność","biodiversity"],
  ["gatunek zagrożony","endangered species"],["rezerwat przyrody","nature reserve"],["park narodowy","national park"],["ochrona środowiska","environmental protection"],["zrównoważony rozwój","sustainable development"],
  // === SZTUKA I KULTURA ===
  ["malarstwo","painting"],["rzeźba","sculpture"],["grafika","graphic art"],["instalacja artystyczna","art installation"],["performance","performance art"],
  ["fotografia artystyczna","artistic photography"],["film dokumentalny","documentary film"],["film fabularny","feature film"],["film animowany","animated film"],["serial","TV series"],
  ["scena","stage"],["reżyser","director"],["scenarzysta","screenwriter"],["aktor","actor"],["aktorka","actress"],
  ["muzyk","musician"],["kompozytor","composer"],["dyrygent","conductor"],["solista","soloist"],["chór","choir"],
  ["opera","opera"],["musicale","musical"],["jazz","jazz"],["blues","blues"],["rock","rock"],
  ["pop","pop music"],["hip-hop","hip-hop"],["elektronika","electronic music"],["klasyczna muzyka","classical music"],["folk","folk music"],
  ["powieść","novel"],["opowiadanie","short story"],["poezja","poetry"],["dramat","drama"],["esej","essay"],
  ["autobiografia","autobiography"],["biografia","biography"],["komiks","comic"],["manga","manga"],["literatura faktu","non-fiction"],
  // === PODRÓŻE I TURYSTYKA ===
  ["pensjonat","bed and breakfast"],["kurort","resort"],["ekoturystyka","ecotourism"],["backpacking","backpacking"],["wycieczka objazdowa","coach tour"],
  ["przewodnik turystyczny","tourist guide"],["biuro podróży","travel agency"],["wiza","visa"],["paszport","passport"],["ubezpieczenie podróżne","travel insurance"],
  ["strefa czasowa","time zone"],["różnica czasu","time difference"],["adaptacja kulturowa","cultural adaptation"],["bariera językowa","language barrier"],["phrasebook","phrasebook"],
  ["atrakcja turystyczna","tourist attraction"],["zabytek","historic monument"],["stare miasto","old town"],["katedra","cathedral"],["zamek","castle"],
  ["muzeum historyczne","history museum"],["rynek","market square"],["fontanna","fountain"],["kolumna","column"],["łuk triumfalny","triumphal arch"],
  ["spacer po mieście","city walk"],["wynajem samochodu","car rental"],["GPS","GPS"],["mapa offline","offline map"],["podróż autostopem","hitchhiking"],
  // === EKONOMIA PODSTAWY ===
  ["inflacja","inflation"],["deflacja","deflation"],["recesja","recession"],["wzrost gospodarczy","economic growth"],["PKB","GDP"],
  ["stopień bezrobocia","unemployment rate"],["płaca minimalna","minimum wage"],["podatek","tax"],["VAT","VAT"],["podatek dochodowy","income tax"],
  ["budżet państwa","state budget"],["deficyt","deficit"],["nadwyżka","surplus"],["dług publiczny","public debt"],["obligacja","bond"],
  ["akcja","share"],["giełda","stock exchange"],["inwestycja","investment"],["oprocentowanie","interest rate"],["kredyt","loan"],
  ["hipoteka","mortgage"],["leasing","leasing"],["emerytura","pension"],["zasiłek","benefit"],["dotacja","grant"],
  ["subwencja","subsidy"],["cło","customs duty"],["embargo","embargo"],["sankcje","sanctions"],["strefa wolnego handlu","free trade zone"],
  // === NAUKA ROZSZERZONA ===
  ["hipoteza","hypothesis"],["teoria","theory"],["eksperyment","experiment"],["metodologia","methodology"],["analiza","analysis"],
  ["synteza","synthesis"],["obserwacja","observation"],["wynik badania","research finding"],["publikacja naukowa","scientific publication"],["recenzja","peer review"],
  ["laboratorium","laboratory"],["mikroskop","microscope"],["probówka","test tube"],["odczynnik","reagent"],["reakcja chemiczna","chemical reaction"],
  ["kwas","acid"],["zasada","base/alkali"],["katalizator","catalyst"],["pierwiastek","element"],["związek chemiczny","chemical compound"],
  ["atom","atom"],["cząsteczka","molecule"],["elektron","electron"],["proton","proton"],["neutron","neutron"],
  ["energia kinetyczna","kinetic energy"],["energia potencjalna","potential energy"],["grawitacja","gravity"],["magnetyzm","magnetism"],["elektryczność","electricity"],
  // === EDUKACJA WYŻSZA ===
  ["rekrutacja na studia","university admission"],["egzamin wstępny","entrance exam"],["rok akademicki","academic year"],["semestr","semester"],["sesja egzaminacyjna","exam session"],
  ["zaliczenie","credit"],["kolokwium","colloquium"],["egzamin końcowy","final exam"],["praca licencjacka","bachelor's thesis"],["praca magisterska","master's thesis"],
  ["praca doktorska","doctoral thesis"],["promotor","thesis supervisor"],["recenzent","reviewer"],["konferencja naukowa","academic conference"],["stypendium","scholarship"],
  ["akademik","student dormitory"],["kampus","campus"],["dziekanat","dean's office"],["rektorat","rector's office"],["katedra","department chair"],
  // === MEDIA I KOMUNIKACJA ===
  ["telewizja publiczna","public television"],["stacja prywatna","private channel"],["streaming","streaming service"],["podcast","podcast"],["vlog","vlog"],
  ["influencer","influencer"],["bloger","blogger"],["redakcja","editorial office"],["artykuł","article"],["felieton","column"],
  ["wywiad","interview"],["reportaż","reportage"],["wiadomości","news"],["nagłówek","headline"],["clickbait","clickbait"],
  ["fake news","fake news"],["dezinformacja","disinformation"],["propaganda","propaganda"],["cenzura mediów","media censorship"],["neutralność mediów","media neutrality"],
  ["reklama","advertisement"],["reklama telewizyjna","TV commercial"],["billboard","billboard"],["marketing internetowy","online marketing"],["SEO","SEO"],
  // === PSYCHOLOGIA I EMOCJE ===
  ["samoocena","self-esteem"],["pewność siebie","self-confidence"],["motywacja","motivation"],["ambicja","ambition"],["wytrwałość","perseverance"],
  ["cierpliwość","patience"],["empatia","empathy"],["inteligencja emocjonalna","emotional intelligence"],["świadomość","awareness"],["uważność","mindfulness"],
  ["traumа","trauma"],["żałoba","grief"],["tęsknota","longing"],["nostalgia","nostalgia"],["euforia","euphoria"],
  ["frustracja","frustration"],["rozczarowanie","disappointment"],["zazdrość","jealousy"],["wstyd","shame"],["wina","guilt"],
  ["strach","fear"],["odwaga","courage"],["determinacja","determination"],["ciekawość","curiosity"],["zdziwienie","amazement"],
  // === PRAWO PODSTAWY ===
  ["przestępstwo","crime"],["wykroczenie","offence"],["kara","punishment"],["więzienie","prison"],["areszt","arrest"],
  ["sąd","court"],["sędzia","judge"],["prokurator","prosecutor"],["obrońca","defence lawyer"],["świadek","witness"],
  ["dowód","evidence"],["wyrok","verdict"],["apelacja","appeal"],["ugoda","settlement"],["mediacja","mediation"],
  ["prawo cywilne","civil law"],["prawo karne","criminal law"],["prawo rodzinne","family law"],["prawo pracy","labour law"],["prawo handlowe","commercial law"],
  // === SPORT I REKREACJA ===
  ["ligа piłkarska","football league"],["mistrzostwa","championship"],["turniej","tournament"],["mecz","match"],["wynik","score"],
  ["gol","goal"],["rzut karny","penalty kick"],["żółta kartka","yellow card"],["czerwona kartka","red card"],["sędzia","referee"],
  ["stadion","stadium"],["trener","coach"],["zawodnik","player"],["drużyna","team"],["kapitan drużyny","team captain"],
  // === GASTRONOMIA ===
  ["kuchnia włoska","Italian cuisine"],["kuchnia francuska","French cuisine"],["kuchnia azjatycka","Asian cuisine"],["kuchnia meksykańska","Mexican cuisine"],["kuchnia wegetariańska","vegetarian cuisine"],
  ["menu","menu"],["danie główne","main course"],["przystawka","starter"],["deser","dessert"],["danie dnia","dish of the day"],
  ["napój bezalkoholowy","soft drink"],["koktajl alkoholowy","cocktail"],["szampan","champagne"],["whisky","whisky"],["wódka","vodka"],
];

// ─────────────────────────────────────────────
// B2 — Wyższy średni (~2 000 słów)
// ─────────────────────────────────────────────
const B2_WORDS = [
  // === BIZNES I FINANSE ===
  ["fuzja","merger"],["przejęcie","acquisition"],["due diligence","due diligence"],["IPO","IPO"],["kapitalizacja rynkowa","market capitalisation"],
  ["portfel inwestycyjny","investment portfolio"],["dywersyfikacja","diversification"],["hedging","hedging"],["derywaty","derivatives"],["fundusz hedgingowy","hedge fund"],
  ["venture capital","venture capital"],["private equity","private equity"],["anioł biznesu","business angel"],["crowdfunding","crowdfunding"],["ICO","ICO"],
  ["blockchain","blockchain"],["kryptowaluta","cryptocurrency"],["token","token"],["smart contract","smart contract"],["decentralizacja","decentralisation"],
  ["przychód","revenue"],["zysk netto","net profit"],["zysk brutto","gross profit"],["EBITDA","EBITDA"],["marža","margin"],
  ["amortyzacja","depreciation"],["rezerwa","reserve"],["restrukturyzacja","restructuring"],["upadłość","bankruptcy"],["windykacja","debt collection"],
  ["faktoring","factoring"],["franchising","franchising"],["outsourcing","outsourcing"],["offshoring","offshoring"],["nearshoring","nearshoring"],
  ["strategia biznesowa","business strategy"],["analiza SWOT","SWOT analysis"],["benchmarking","benchmarking"],["KPI","KPI"],["OKR","OKR"],
  // === POLITYKA I RZĄD ===
  ["suwerenność","sovereignty"],["federalizm","federalism"],["autonomia","autonomy"],["secesja","secession"],["aneksja","annexation"],
  ["dyplomacja","diplomacy"],["ambasada","embassy"],["konsulat","consulate"],["traktat","treaty"],["konwencja","convention"],
  ["sankcje ekonomiczne","economic sanctions"],["embargo zbrojne","arms embargo"],["żołnierze pokoju","peacekeepers"],["misja humanitarna","humanitarian mission"],["interwencja zbrojna","military intervention"],
  ["sojusz","alliance"],["NATO","NATO"],["ONZ","UN"],["UE","EU"],["G7","G7"],
  ["lobbying","lobbying"],["think tank","think tank"],["civil society","civil society"],["NGO","NGO"],["organizacja pozarządowa","non-governmental organisation"],
  ["referendum","referendum"],["plebiscyt","plebiscite"],["impeachment","impeachment"],["wotum nieufności","vote of no confidence"],["rząd tymczasowy","interim government"],
  // === ŚRODOWISKO I EKOLOGIA ===
  ["protokół z Kioto","Kyoto Protocol"],["porozumienie paryskie","Paris Agreement"],["cel klimatyczny","climate target"],["neutralność klimatyczna","climate neutrality"],["net zero","net zero"],
  ["sekwestracja dwutlenku węgla","carbon sequestration"],["handel emisjami","emissions trading"],["podatek węglowy","carbon tax"],["zielona energia","green energy"],["zielony wodór","green hydrogen"],
  ["ekosystem","ecosystem"],["biom","biome"],["łańcuch pokarmowy","food chain"],["habitat","habitat"],["niша ekologiczna","ecological niche"],
  ["wymieranie gatunków","species extinction"],["masowe wymieranie","mass extinction"],["reintrodukcja","reintroduction"],["korytarz ekologiczny","ecological corridor"],["kompensacja ekologiczna","ecological compensation"],
  ["zrównoważone rolnictwo","sustainable agriculture"],["permaculture","permaculture"],["rolnictwo ekologiczne","organic farming"],["GMO","GMO"],["pestycyd","pesticide"],
  // === NAUKA I BADANIA ===
  ["nanotechnologia","nanotechnology"],["biotechnologia","biotechnology"],["inżynieria genetyczna","genetic engineering"],["edycja genów","gene editing"],["CRISPR","CRISPR"],
  ["klonowanie","cloning"],["komórki macierzyste","stem cells"],["terapia genowa","gene therapy"],["bioinformatyka","bioinformatics"],["genomika","genomics"],
  ["neurobiologia","neurobiology"],["neuronaukа","neuroscience"],["świadomość","consciousness"],["kognitywistyka","cognitive science"],["lingwistyka","linguistics"],
  ["fizyka kwantowa","quantum physics"],["mechanika kwantowa","quantum mechanics"],["splątanie kwantowe","quantum entanglement"],["komputer kwantowy","quantum computer"],["superprzewodnictwo","superconductivity"],
  ["astronomia","astronomy"],["astrofizyka","astrophysics"],["kosmologia","cosmology"],["egzoplaneta","exoplanet"],["astrobiology","astrobiology"],
  ["czarna dziura","black hole"],["ciemna materia","dark matter"],["ciemna energia","dark energy"],["wielki wybuch","Big Bang"],["inflacja kosmiczna","cosmic inflation"],
  // === MEDYCYNA ZAAWANSOWANA ===
  ["kardiochirurgia","cardiac surgery"],["neurochirurgia","neurosurgery"],["transplantacja","transplantation"],["przeszczep narządu","organ transplant"],["dializa","dialysis"],
  ["onkologia","oncology"],["chemioterapia","chemotherapy"],["immunoterapia","immunotherapy"],["hormonoterapia","hormone therapy"],["radioterapia","radiotherapy"],
  ["diagnostyka obrazowa","medical imaging"],["rezonans magnetyczny","MRI scan"],["tomografia komputerowa","CT scan"],["pozytonowa tomografia emisyjna","PET scan"],["biopsja","biopsy"],
  ["patologia","pathology"],["epidemiologia","epidemiology"],["farmakologia","pharmacology"],["toksykologia","toxicology"],["immunologia kliniczna","clinical immunology"],
  // === PRAWO ZAAWANSOWANE ===
  ["prawo konstytucyjne","constitutional law"],["prawo administracyjne","administrative law"],["prawo europejskie","European law"],["prawo międzynarodowe","international law"],["prawo zwyczajowe","customary law"],
  ["precedens","precedent"],["orzecznictwo","case law"],["jurysdykcja","jurisdiction"],["eksterytorialność","extraterritoriality"],["immunitet dyplomatyczny","diplomatic immunity"],
  ["kontratyp","justification"],["umyślność","intent"],["nieumyślność","negligence"],["recydywa","recidivism"],["warunkowe zwolnienie","parole"],
  ["tymczasowe aresztowanie","pre-trial detention"],["habeas corpus","habeas corpus"],["amnestia","amnesty"],["ułaskawienie","pardon"],["ekstradycja","extradition"],
  // === PSYCHOLOGIA I SOCJOLOGIA ===
  ["psychoanaliza","psychoanalysis"],["terapia poznawczo-behawioralna","cognitive-behavioural therapy"],["terapia EMDR","EMDR therapy"],["neuropsychologia","neuropsychology"],["psychopatologia","psychopathology"],
  ["zaburzenie osobowości","personality disorder"],["schizofrenia","schizophrenia"],["zaburzenie dwubiegunowe","bipolar disorder"],["ADHD","ADHD"],["spektrum autyzmu","autism spectrum"],
  ["konformizm","conformism"],["nonkonformizm","non-conformism"],["normа społeczna","social norm"],["kontrola społeczna","social control"],["socjalizacja","socialisation"],
  ["mobilność społeczna","social mobility"],["stratyfikacja społeczna","social stratification"],["klasa społeczna","social class"],["nierówność społeczna","social inequality"],["wykluczenie społeczne","social exclusion"],
  ["globalizacja","globalisation"],["glokalizacja","glocalisation"],["diaspora","diaspora"],["multikulturalizm","multiculturalism"],["asymilacja","assimilation"],
  // === TECHNOLOGIA CYFROWA ===
  ["Internet Rzeczy","Internet of Things"],["big data","big data"],["analityka danych","data analytics"],["wizualizacja danych","data visualisation"],["machine learning","machine learning"],
  ["sieć neuronowa","neural network"],["deep learning","deep learning"],["przetwarzanie języka naturalnego","natural language processing"],["rozpoznawanie obrazów","image recognition"],["autonomiczny pojazd","autonomous vehicle"],
  ["druk 3D","3D printing"],["rzeczywistość wirtualna","virtual reality"],["rzeczywistość rozszerzona","augmented reality"],["metaverse","metaverse"],["interfejs mózg-komputer","brain-computer interface"],
  ["robotyka","robotics"],["automatyzacja","automation"],["przemysł 4.0","Industry 4.0"],["transformacja cyfrowa","digital transformation"],["e-commerce","e-commerce"],
  // === SZTUKA I LITERATURA ===
  ["modernizm","modernism"],["postmodernizm","postmodernism"],["awangarda","avant-garde"],["realizm","realism"],["surrealizm","surrealism"],
  ["kubizm","cubism"],["impresjonizm","impressionism"],["ekspresjonizm","expressionism"],["abstrakcjonizm","abstractionism"],["minimalizm","minimalism"],
  ["narracja","narration"],["narrator","narrator"],["protagonista","protagonist"],["antagonista","antagonist"],["motyw literacki","literary motif"],
  ["alegoria","allegory"],["metafora","metaphor"],["ironia","irony"],["sarkazm","sarcasm"],["paradoks","paradox"],
  // === ARCHITEKTURA I DESIGN ===
  ["architektura gotycka","Gothic architecture"],["architektura barokowa","Baroque architecture"],["architektura modernistyczna","modernist architecture"],["brutalizm","brutalism"],["dekonstruktywizm","deconstructivism"],
  ["design przemysłowy","industrial design"],["UX design","UX design"],["interfejs graficzny","graphic interface"],["typografia","typography"],["branding","branding"],
  ["urbanistyka","urban planning"],["zagospodarowanie przestrzenne","spatial planning"],["rewitalizacja","revitalisation"],["gentryfikacja","gentrification"],["smart city","smart city"],
  // === EKONOMIA ZAAWANSOWANA ===
  ["teoria gier","game theory"],["ekonomia behawioralna","behavioural economics"],["ekonometria","econometrics"],["makroekonomia","macroeconomics"],["mikroekonomia","microeconomics"],
  ["popyt","demand"],["podaż","supply"],["elastyczność","elasticity"],["mechanizm rynkowy","market mechanism"],["zawodność rynku","market failure"],
  ["monopol","monopoly"],["oligopol","oligopoly"],["kartel","cartel"],["antymonopolowe przepisy","antitrust regulations"],["regulacja","regulation"],
  // === DZIENNIKARSTWO I MEDIA ===
  ["investigative journalism","investigative journalism"],["dziennikarstwo obywatelskie","citizen journalism"],["wolność prasy","press freedom"],["ochrona źródeł","source protection"],["sygnalista","whistleblower"],
  ["mediatyzacja","mediatisation"],["framing","framing"],["agenda setting","agenda setting"],["priming","priming"],["gatekeeping","gatekeeping"],
  // === STOSUNKI MIĘDZYNARODOWE ===
  ["hegemonia","hegemony"],["wielobiegunowość","multipolarity"],["orden światowy","world order"],["geopolityka","geopolitics"],["balance of power","balance of power"],
  ["zimna война","Cold War"],["wyścig zbrojeń","arms race"],["proliferacja nuklearna","nuclear proliferation"],["terroryzm","terrorism"],["radykalizacja","radicalisation"],
  ["służby specjalne","intelligence services"],["szpiegostwo","espionage"],["dezinformacja","disinformation"],["cyberwojna","cyberwarfare"],["propaganda wojenna","war propaganda"],
];

// ─────────────────────────────────────────────
// C1 — Zaawansowany (~2 000 słów)
// ─────────────────────────────────────────────
const C1_WORDS = [
  // === SŁOWNICTWO AKADEMICKIE ===
  ["epistemologia","epistemology"],["ontologia","ontology"],["hermeneutyka","hermeneutics"],["fenomenologia","phenomenology"],["dialektyka","dialectics"],
  ["paradygmat","paradigm"],["dyskurs","discourse"],["narracja","narrative"],["intertekstualność","intertextuality"],["dekonstrukcja","deconstruction"],
  ["postkolonializm","postcolonialism"],["feminizm","feminism"],["marksizm","Marxism"],["liberalizm","liberalism"],["konserwatyzm","conservatism"],
  ["utylitaryzm","utilitarianism"],["kantyzm","Kantianism"],["egzystencjalizm","existentialism"],["strukturalizm","structuralism"],["poststrukturalizm","post-structuralism"],
  ["redukcjonizm","reductionism"],["holizm","holism"],["empiryzm","empiricism"],["racjonalizm","rationalism"],["sceptycyzm","scepticism"],
  ["hedonizm","hedonism"],["stoicyzm","stoicism"],["pragmatyzm","pragmatism"],["relatywizm","relativism"],["determinizm","determinism"],
  ["woluntaryzm","voluntarism"],["fatalizm","fatalism"],["nihilizm","nihilism"],["absurdyzm","absurdism"],["humanizm","humanism"],
  // === JĘZYKI ZAAWANSOWANE ===
  ["morfologia","morphology"],["składnia","syntax"],["semantyka","semantics"],["pragmatyka","pragmatics"],["fonologia","phonology"],
  ["fonetyka","phonetics"],["leksykologia","lexicology"],["leksykografia","lexicography"],["etymologia","etymology"],["dialektologia","dialectology"],
  ["socjolingwistyka","sociolinguistics"],["psycholingwistyka","psycholinguistics"],["neurolingwistyka","neurolinguistics"],["lingwistyka tekstu","text linguistics"],["analiza dyskursu","discourse analysis"],
  ["rejestr języka","language register"],["styl","style"],["idiom","idiom"],["kolokacja","collocation"],["konotacja","connotation"],
  ["denotacja","denotation"],["polisemia","polysemy"],["homonim","homonym"],["synonim","synonym"],["antonim","antonym"],
  // === BIZNES KORPORACYJNY ===
  ["ład korporacyjny","corporate governance"],["rada nadzorcza","supervisory board"],["zarząd","management board"],["akcjonariusz","shareholder"],["interesariusz","stakeholder"],
  ["sprawozdanie finansowe","financial statement"],["bilans","balance sheet"],["rachunek zysków i strat","profit and loss statement"],["przepływy pieniężne","cash flow"],["audyt","audit"],
  ["biegły rewident","chartered accountant"],["controlling","controlling"],["compliance","compliance"],["ESG","ESG"],["CSR","CSR"],
  ["zrównoważony rozwój biznesu","sustainable business development"],["transformacja ESG","ESG transformation"],["raportowanie niefinansowe","non-financial reporting"],["certyfikacja ISO","ISO certification"],["due diligence prawne","legal due diligence"],
  // === PRAWO SPECJALISTYCZNE ===
  ["prawo własności intelektualnej","intellectual property law"],["patent","patent"],["znak towarowy","trademark"],["prawa autorskie","copyright"],["licencja","licence"],
  ["prawo konkurencji","competition law"],["prawo spółek","company law"],["prawo papierów wartościowych","securities law"],["regulacje finansowe","financial regulations"],["prawo bankowe","banking law"],
  ["prawo podatkowe","tax law"],["prawo celne","customs law"],["umowa dwustronna","bilateral agreement"],["arbitraż","arbitration"],["koncyliacja","conciliation"],
  ["ochrona danych osobowych","personal data protection"],["RODO","GDPR"],["przetwarzanie danych","data processing"],["administrator danych","data controller"],["podmiot przetwarzający","data processor"],
  // === MEDYCYNA KLINICZNA ===
  ["farmakodynamika","pharmacodynamics"],["farmakokinetyka","pharmacokinetics"],["interakcja leków","drug interaction"],["działanie niepożądane","adverse effect"],["iatrogenny","iatrogenic"],
  ["anamneza","anamnesis"],["wywiad lekarski","medical history"],["badanie fizykalne","physical examination"],["rozpoznanie różnicowe","differential diagnosis"],["rokowanie","prognosis"],
  ["profilaktyka","prophylaxis"],["zdrowie publiczne","public health"],["epidemiologia kliniczna","clinical epidemiology"],["medycyna oparta na dowodach","evidence-based medicine"],["wytyczne kliniczne","clinical guidelines"],
  ["randomizowane badanie kliniczne","randomised clinical trial"],["placebo","placebo"],["ślepa próba","blind trial"],["metaanaliza","meta-analysis"],["przegląd systematyczny","systematic review"],
  // === NAUKI ŚCISŁE ZAAWANSOWANE ===
  ["termodynamika","thermodynamics"],["elektrodynamika","electrodynamics"],["mechanika statystyczna","statistical mechanics"],["teoria względności","theory of relativity"],["ogólna teoria względności","general relativity"],
  ["szczególna teoria względności","special relativity"],["dylatacja czasu","time dilation"],["paradoks bliźniąt","twin paradox"],["zasada nieoznaczoności","uncertainty principle"],["dualność korpuskularno-falowa","wave-particle duality"],
  ["superpozycja","superposition"],["koherencja kwantowa","quantum coherence"],["teleportacja kwantowa","quantum teleportation"],["kryptografia kwantowa","quantum cryptography"],["kwantowe obliczenia","quantum computing"],
  ["chemia organiczna","organic chemistry"],["chemia nieorganiczna","inorganic chemistry"],["chemia analityczna","analytical chemistry"],["biochemia","biochemistry"],["biofizyka","biophysics"],
  ["genomika","genomics"],["proteomika","proteomics"],["metabolomika","metabolomics"],["transkryptomika","transcriptomics"],["biologia systemów","systems biology"],
  // === POLITYKA ZAAWANSOWANA ===
  ["realpolitik","realpolitik"],["konstruktywizm w stosunkach międzynarodowych","constructivism in international relations"],["liberalizm instytucjonalny","institutional liberalism"],["realizm strukturalny","structural realism"],["neoliberalizm","neoliberalism"],
  ["populizm","populism"],["nacjonalizm","nationalism"],["separatyzm","separatism"],["irredentyzm","irredentism"],["rewizjonizm","revisionism"],
  ["efektywna suwerenność","effective sovereignty"],["responibility to protect","responsibility to protect"],["interwencja humanitarna","humanitarian intervention"],["prawo weta","right of veto"],["reforma systemu ONZ","UN reform"],
  // === LITERATURA I RETORYKA ===
  ["aliteracja","alliteration"],["anafor","anaphora"],["epifor","epiphora"],["chiazm","chiasmus"],["elipsa","ellipsis"],
  ["enjambment","enjambment"],["eufemizm","euphemism"],["hiperbolа","hyperbole"],["metonimia","metonymy"],["synekdocha","synecdoche"],
  ["peryfrazа","periphrasis"],["pleonazm","pleonasm"],["oksymoron","oxymoron"],["antyteza","antithesis"],["anakoluт","anacoluthon"],
  ["inwersja","inversion"],["apostrofa","apostrophe"],["ironia sokratejska","Socratic irony"],["alegoria jaskini","allegory of the cave"],["deus ex machina","deus ex machina"],
  // === EKONOMIA ZAAWANSOWANA ===
  ["renta ekonomiczna","economic rent"],["efekty zewnętrzne","externalities"],["dobra publiczne","public goods"],["asymetria informacji","information asymmetry"],["ryzyko moralne","moral hazard"],
  ["selekcja negatywna","adverse selection"],["koszty transakcyjne","transaction costs"],["teoria kontraktów","contract theory"],["teoria wyboru publicznego","public choice theory"],["ekonomia instytucjonalna","institutional economics"],
  ["globalne łańcuchy wartości","global value chains"],["offshoring","offshoring"],["reshoring","reshoring"],["geopolityka gospodarcza","economic geopolitics"],["protekcjonizm","protectionism"],
  // === ARCHITEKTURA I URBANISTYKA ===
  ["fenomenologia miejsca","phenomenology of place"],["genius loci","genius loci"],["morfologia miejska","urban morphology"],["sprawl miejski","urban sprawl"],["zagęszczenie miejskie","urban densification"],
  ["segregacja przestrzenna","spatial segregation"],["getto","ghetto"],["enklawy zamożnych","affluent enclaves"],["przestrzeń publiczna","public space"],["przestrzeń trzecia","third place"],
  // === FILOZOFIA ===
  ["teleologia","teleology"],["deontologia","deontology"],["etyki cnót","virtue ethics"],["etyka troski","ethics of care"],["konsekwencjalizm","consequentialism"],
  ["dobro wspólne","common good"],["sprawiedliwość dystrybutywna","distributive justice"],["sprawiedliwość proceduralna","procedural justice"],["rawlsianizm","Rawlsianism"],["komunitaryzm","communitarianism"],
  ["libertarianizm","libertarianism"],["anarchizm","anarchism"],["socjalizm","socialism"],["demokratyczny socjalizm","democratic socialism"],["socjaldemokracja","social democracy"],
  // === SOCJOLOGIA ZAAWANSOWANA ===
  ["habitus","habitus"],["kapitał społeczny","social capital"],["kapitał kulturowy","cultural capital"],["pole społeczne","social field"],["reprodukcja społeczna","social reproduction"],
  ["performatywność","performativity"],["intersectionality","intersectionality"],["biopolityka","biopolitics"],["biopower","biopower"],["surveillance capitalism","surveillance capitalism"],
  ["posthumanizm","posthumanism"],["transhumanizm","transhumanism"],["cyborg","cyborg"],["technokultura","technoculture"],["posthuman","posthuman"],
  // === PSYCHOLOGIA KLINICZNA ===
  ["zaburzenia lękowe","anxiety disorders"],["fobia społeczna","social phobia"],["OCD","OCD"],["PTSD","PTSD"],["zaburzenia odżywiania","eating disorders"],
  ["psychoza","psychosis"],["neuroza","neurosis"],["narcyzm","narcissism"],["borderline","borderline"],["histrionizm","histrionism"],
  ["psychopatia","psychopathy"],["socjopatia","sociopathy"],["dysocjacja","dissociation"],["amnezja dysocjacyjna","dissociative amnesia"],["depersonalizacja","depersonalisation"],
  // === DODATKOWE WYRAŻENIA ZAAWANSOWANE ===
  ["pragmatyczny","pragmatic"],["doktrynalny","doctrinal"],["normatywny","normative"],["preskryptywny","prescriptive"],["deskryptywny","descriptive"],
  ["empiryczny","empirical"],["spekulatywny","speculative"],["indukcja","induction"],["dedukcja","deduction"],["abdukcja","abduction"],
  ["falsyfikowalność","falsifiability"],["pozytywizm","positivism"],["neopozytywizm","neopositivism"],["postpozytywizm","post-positivism"],["konstruktywizm","constructivism"],
  ["interpretacja","interpretation"],["kontekstualizacja","contextualisation"],["problematyzacja","problematisation"],["konceptualizacja","conceptualisation"],["operacjonalizacja","operationalisation"],
  ["zmienna zależna","dependent variable"],["zmienna niezależna","independent variable"],["korelacja","correlation"],["przyczynowość","causality"],["determinacja","determination"],
];

// ─────────────────────────────────────────────
// C2 — Biegły (~1 700 słów)
// ─────────────────────────────────────────────
const C2_WORDS = [
  // === ARCHAIZMY I LITERACKIE ===
  ["pożogа","conflagration"],["mordownia","slaughterhouse (archaic)"],["szermierz","swordsman"],["kronikarz","chronicler"],["wieszcz","bard/prophet-poet"],
  ["słowiańszczyzna","Slavdom"],["dzierżawa","tenure/lease (archaic)"],["żywot","life (archaic/literary)"],["dostojnik","dignitary"],["hetman","hetman (commander)"],
  ["starosta","starost"],["kasztelan","castellan"],["chorąży","standard-bearer"],["pisarz","scribe (archaic)"],["rotmistrz","cavalry captain"],
  ["ciura","camp follower"],["hufiec","squadron"],["zwycięstwo","victory (literary)"],["klęska","defeat/disaster"],["potyczka","skirmish"],
  ["oblężenie","siege"],["warownia","stronghold"],["baszta","tower/bastion"],["bramа","gate (archaic)"],["przybramny","near the gate"],
  ["świtanie","dawn (literary)"],["zmrok","dusk (literary)"],["otchłań","abyss"],["przepaść","chasm"],["bezkreś","boundlessness"],
  // === WYMYŚLNE PRZYMIOTNIKI ===
  ["efemерyczny","ephemeral"],["efemeryczny","ephemeral"],["ulotny","fleeting"],["przemijający","transient"],["ewanescencyjny","evanescent"],
  ["przenikliwy","incisive/penetrating"],["dociekliwy","inquisitive"],["wnikliwy","insightful"],["subtelny","subtle"],["wyrafinowany","refined/sophisticated"],
  ["nieuchwytny","elusive"],["tajemniczy","mysterious"],["enigmatyczny","enigmatic"],["nieodgadniony","inscrutable"],["zagadkowy","puzzling"],
  ["paradoksalny","paradoxical"],["antynomiczny","antinomic"],["aporetyczny","aporetic"],["apofatyczny","apophatic"],["katafatyczny","cataphatic"],
  ["transcendentny","transcendent"],["immanentny","immanent"],["transcendentalny","transcendental"],["metafizyczny","metaphysical"],["eschatologiczny","eschatological"],
  ["soteriologiczny","soteriological"],["teologiczny","theological"],["dogmatyczny","dogmatic"],["heretycki","heretical"],["synkretyczny","syncretic"],
  ["kabalistyczny","kabbalistic"],["hermetyczny","hermetic"],["okultystyczny","occult"],["ezotерyczny","esoteric"],["egzoteryczny","exoteric"],
  ["numinotyczny","numinous"],["awesomowy","awe-inspiring"],["wzniosły","sublime"],["sacrum","the sacred"],["profanum","the profane"],
  // === NAUKA WYSOCE SPECJALISTYCZNA ===
  ["czrenkovskie promieniowanie","Cherenkov radiation"],["efekt Comptona","Compton effect"],["efekt fotoelektryczny","photoelectric effect"],["promieniowanie Hawkinga","Hawking radiation"],["paradoks informacji","information paradox"],
  ["holograficzna zasada","holographic principle"],["AdS/CFT","AdS/CFT correspondence"],["teoria strun","string theory"],["teoria M","M-theory"],["wieloświat","multiverse"],
  ["inflacja wieczna","eternal inflation"],["Wielki Wybuch","Big Bang"],["singularność","singularity"],["horyzont zdarzeń","event horizon"],["spaghettifikacja","spaghettification"],
  ["chronologia ochronna","chronology protection"],["podróże w czasie","time travel"],["pętle czasoprzestrzeni","spacetime loops"],["wormhole","wormhole"],["biała dziura","white hole"],
  ["superfluid","superfluid"],["kondensat Bosego-Einsteina","Bose-Einstein condensate"],["nadciekłość","superfluidity"],["efekt Meissnera","Meissner effect"],["kwantowe tarcie","quantum friction"],
  ["fotosynteza","photosynthesis"],["cykl Calvina","Calvin cycle"],["respiracja komórkowa","cellular respiration"],["glikoliza","glycolysis"],["cykl Krebsa","Krebs cycle"],
  ["fosforylacja oksydacyjna","oxidative phosphorylation"],["łańcuch transportu elektronów","electron transport chain"],["ATP","ATP"],["ADP","ADP"],["mitochondrium","mitochondrion"],
  ["rybosomy","ribosomes"],["retikulum endoplazmatyczne","endoplasmic reticulum"],["aparat Golgiego","Golgi apparatus"],["lizosom","lysosome"],["peroksysom","peroxisome"],
  // === PRAWO SPECJALISTYCZNE ===
  ["actus reus","actus reus"],["mens rea","mens rea"],["nulla poena sine lege","nulla poena sine lege"],["nullum crimen sine lege","nullum crimen sine lege"],["in dubio pro reo","in dubio pro reo"],
  ["ne bis in idem","ne bis in idem"],["res judicata","res judicata"],["stare decisis","stare decisis"],["obiter dictum","obiter dictum"],["ratio decidendi","ratio decidendi"],
  ["ultra vires","ultra vires"],["inter partes","inter partes"],["erga omnes","erga omnes"],["ex parte","ex parte"],["pro bono","pro bono"],
  ["abolicja","abolition (legal)"],["lustracja","lustration"],["dekomunizacja","decommunisation"],["denazyfikacja","denazification"],["ludobójstwo","genocide"],
  ["zbrodnia wojenna","war crime"],["zbrodnia przeciwko ludzkości","crime against humanity"],["trybunał karny","criminal tribunal"],["Międzynarodowy Trybunał Karny","International Criminal Court"],["immunitet parlamentarny","parliamentary immunity"],
  // === MEDYCYNA WYSOCE SPECJALISTYCZNA ===
  ["neuroplastyczność","neuroplasticity"],["synaptogeneza","synaptogenesis"],["potencjał czynnościowy","action potential"],["depolaryzacja","depolarisation"],["repolaryzacja","repolarisation"],
  ["neuroprzekaźnik","neurotransmitter"],["receptory dopaminergiczne","dopaminergic receptors"],["serotonina","serotonin"],["norepinefryna","norepinephrine"],["GABA","GABA"],
  ["glutaminian","glutamate"],["acetylocholina","acetylcholine"],["endorfiny","endorphins"],["oksytocyna","oxytocin"],["kortyzol","cortisol"],
  ["oś HPA","HPA axis"],["odpowiedź stresowa","stress response"],["allostatyczne obciążenie","allostatic load"],["epigenетyka","epigenetics"],["metylacja DNA","DNA methylation"],
  ["acetylacja histonów","histone acetylation"],["chromatyna","chromatin"],["sekwencjonowanie genomu","genome sequencing"],["warianty genetyczne","genetic variants"],["SNP","SNP"],
  // === FILOZOFIA ANALITYCZNA ===
  ["wittgensteinizm","Wittgensteinianism"],["filozofia języka potocznego","ordinary language philosophy"],["teorie referencji","theories of reference"],["sztywne desygnatory","rigid designators"],["deskryptywizm","descriptivism"],
  ["eksternalizm semantyczny","semantic externalism"],["internalizm semantyczny","semantic internalism"],["realizm modalny","modal realism"],["kontrafaktualizm","counterfactualism"],["supervenience","supervenience"],
  ["fizykalizm","physicalism"],["dualizm własnościowy","property dualism"],["epifenomenizm","epiphenomenalism"],["funkcjonalizm","functionalism"],["identyczność typów","type identity"],
  ["identyczność egzemplarzy","token identity"],["problem umysł-ciało","mind-body problem"],["qualia","qualia"],["zombies filozoficzne","philosophical zombies"],["problem trudny świadomości","hard problem of consciousness"],
  // === ZŁOŻONE CZASOWNIKI I WYRAŻENIA ===
  ["dywagować","to digress/ramble"],["deliberować","to deliberate"],["spekulować","to speculate"],["hipotetyzować","to hypothesise"],["postulować","to postulate"],
  ["implikować","to imply"],["explicytnie","explicitly"],["implicytnie","implicitly"],["wnioskować","to infer"],["dewaluować","to devalue"],
  ["marginalizować","to marginalise"],["patologizować","to pathologise"],["fetyszyzować","to fetishise"],["instrumentalizować","to instrumentalise"],["komodyfikować","to commodify"],
  ["narracyjnie","narratively"],["dyskursywnie","discursively"],["performatywnie","performatively"],["systematycznie","systematically"],["metodologicznie","methodologically"],
  ["interdyscyplinarnie","interdisciplinarily"],["transdyscyplinarnie","transdisciplinarily"],["holistycznie","holistically"],["redukcjonistycznie","reductionistically"],["dialektycznie","dialectically"],
  // === WYRAŻENIA IDIOMATYCZNE I ZAAWANSOWANE ===
  ["wziąć byka za rogi","take the bull by the horns"],["ziarno prawdy","grain of truth"],["między Scyllą a Charybdą","between Scylla and Charybdis"],["miecz Damoklesa","sword of Damocles"],["pięta Achillesa","Achilles' heel"],
  ["pyrrusowe zwycięstwo","pyrrhic victory"],["koń trojański","Trojan horse"],["pandora's box","Pandora's box"],["koło fortuny","wheel of fortune"],["filozoficzny kamień","philosopher's stone"],
  ["terra incognita","terra incognita"],["tabula rasa","tabula rasa"],["cogito ergo sum","cogito ergo sum"],["homo homini lupus","homo homini lupus"],["carpe diem","carpe diem"],
  ["memento mori","memento mori"],["amor fati","amor fati"],["sic transit gloria mundi","sic transit gloria mundi"],["in statu nascendi","in statu nascendi"],["post festum","post festum"],
  // === NAUKI SPOŁECZNE ZAAWANSOWANE ===
  ["anomia","anomie"],["alienacja","alienation"],["fetyszyzm towarowy","commodity fetishism"],["reifikacja","reification"],["ideologia","ideology"],
  ["hegemoniczne dyskursy","hegemonic discourses"],["kontrhegemonia","counter-hegemony"],["subalterni","subaltern"],["orientalizm","Orientalism"],["kolonialność wiedzy","coloniality of knowledge"],
  ["epistemologia południa","epistemologies of the South"],["dekolonizacja wiedzy","decolonisation of knowledge"],["whiteness studies","whiteness studies"],["critical race theory","critical race theory"],["queer theory","queer theory"],
  // === RETORYKA I ARGUMENTACJA ===
  ["sofizmat","sophism"],["paralogизm","paralogism"],["ad hominem","ad hominem"],["ad absurdum","reductio ad absurdum"],["straw man","straw man argument"],
  ["slippery slope","slippery slope"],["false dichotomy","false dichotomy"],["circular reasoning","circular reasoning"],["appeal to authority","appeal to authority"],["hasty generalisation","hasty generalisation"],
  ["post hoc ergo propter hoc","post hoc ergo propter hoc"],["cum hoc ergo propter hoc","cum hoc ergo propter hoc"],["composition fallacy","composition fallacy"],["division fallacy","division fallacy"],["equivocation","equivocation"],
  // === LINGWISTYKA ZAAWANSOWANA ===
  ["izoglosa","isogloss"],["dialekt","dialect"],["idiolekt","idiolect"],["socjolekt","sociolect"],["etnolekt","ethnolect"],
  ["kreolizacja","creolisation"],["pidżynizacja","pidginisation"],["koine","koine"],["lingua franca","lingua franca"],["diglosja","diglossia"],
  ["puryzm językowy","linguistic purism"],["prescryptywizm","prescriptivism"],["deskryptywizm","descriptivism"],["polityczna poprawność","political correctness"],["nowomowa","newspeak"],
  // === BIOLOGIA ZAAWANSOWANA ===
  ["filogenetyka","phylogenetics"],["kladystyka","cladistics"],["takson","taxon"],["taksonomia","taxonomy"],["nomenklatura binominalna","binomial nomenclature"],
  ["ewolucja zbieżna","convergent evolution"],["ewolucja równoległa","parallel evolution"],["koewolucja","coevolution"],["ewolucja neutralna","neutral evolution"],["genetyczny dryf","genetic drift"],
  ["efekt założyciela","founder effect"],["efekt wąskiego gardła","bottleneck effect"],["dobór naturalny","natural selection"],["dobór seksualny","sexual selection"],["inkluzywna sprawność","inclusive fitness"],
  // === CHEMIA ZAAWANSOWANA ===
  ["stechiometria","stoichiometry"],["równanie Nersta","Nernst equation"],["stała Faradaya","Faraday constant"],["elektroliza","electrolysis"],["elektrochemia","electrochemistry"],
  ["koordynacyjna chemia","coordination chemistry"],["ligandy","ligands"],["kompleksy metali","metal complexes"],["kataliza heterogeniczna","heterogeneous catalysis"],["kataliza homogeniczna","homogeneous catalysis"],
  ["spektroskopia NMR","NMR spectroscopy"],["spektrometria mas","mass spectrometry"],["chromatografia","chromatography"],["elektroforeza","electrophoresis"],["krystalografia rentgenowska","X-ray crystallography"],
  // === WIELOZNACZNE I NUANSOWANE ===
  ["ambiwalencja","ambivalence"],["ambiwalentny","ambivalent"],["ambiwalentnie","ambivalently"],["poliwalentny","polyvalent"],["bivalentny","bivalent"],
  ["liminalne","liminal"],["przejściowe","transitional"],["transgresywny","transgressive"],["transgresja","transgression"],["sublimacja","sublimation"],
  ["katharsis","catharsis"],["anagnoryzm","anagnorisis"],["perypetia","peripeteia"],["hamartia","hamartia"],["hubris","hubris"],
  ["nemezis","nemesis"],["kairós","kairos"],["kronos","chronos"],["aión","aion"],["topos","topos"],
];

// ─────────────────────────────────────────────
// MAIN — łączymy i zapisujemy
// ─────────────────────────────────────────────
const existing = JSON.parse(fs.readFileSync('words.json', 'utf8'));

// Nadaj poziom A1 istniejącym słowom
const a1 = existing.map(w => ({ ...w, level: 'A1' }));

let nextId = a1.length + 1;

function toWords(pairs, level) {
  return pairs.map(([pl, en]) => ({ id: nextId++, pl, en, level }));
}

const all = [
  ...a1,
  ...toWords(A2_WORDS, 'A2'),
  ...toWords(B1_WORDS, 'B1'),
  ...toWords(B2_WORDS, 'B2'),
  ...toWords(C1_WORDS, 'C1'),
  ...toWords(C2_WORDS, 'C2'),
];

// Usuń duplikaty (po polskim słowie)
const seen = new Set();
const unique = all.filter(w => {
  const key = w.pl.toLowerCase().trim();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Przenumeruj ID
unique.forEach((w, i) => { w.id = i + 1; });

fs.writeFileSync('words.json', JSON.stringify(unique, null, 2), 'utf8');

const counts = {};
for (const w of unique) counts[w.level] = (counts[w.level] || 0) + 1;
console.log('✓ words.json wygenerowany!');
console.log('  Łącznie słów:', unique.length);
for (const [lvl, cnt] of Object.entries(counts)) {
  console.log(`  ${lvl}: ${cnt} słów`);
}
