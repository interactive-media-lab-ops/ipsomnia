/* =====================================================================
   IPSOMNIA · GAME ENGINE  (engine.js)
   ---------------------------------------------------------------------
   EN · A single-file, dependency-free game engine for "Ipsomnia", a
   training game that teaches players to spot and counter hostile
   information operations (IPSO). The engine is pure vanilla JS with no
   build step: index.html loads content.js (data) and then this file.

   The engine is content-agnostic. It never knows which operation it is
   running; it only reads the `SCENARIOS` array exported by content.js.
   Adding an operation means adding a data object, not touching this file.

   Reading order for this file:
     1. Config & feature flags
     2. i18n: UI dictionary and language switching
     3. Game state `S` and the audio module `SFX`
     4. Scoring helpers (clamp / pen / gainAdj)
     5. Instructor tutorial hints
     6. HUD: influence bar, trust, streak, badges, toasts
     7. Campaign progress (localStorage) and wave gating
     8. Screen rendering primitives (render / glitch / boot flicker)
     9. Timers (counter-narrative timer, wildcard timer, boss glitch)
    10. Screens, in play order:
        mode select → intro cutscene → role select → campaign map →
        briefing → Phase 1 feed (+OSINT) → wildcard → Phase 2 technique →
        Phase 3 audience → Phase 4 counter → After Action Report → finale
    11. Pack mode (player-made operations passed via ?pack=)
    12. Boot
   ---------------------------------------------------------------------
   UA · Двигун гри. Один файл, без фреймворків і білдів. Контент (операції,
   ролі, wildcard-події, діалоги) живе окремо в content.js, двигун лише
   читає масив SCENARIOS. Порядок секцій нижче відповідає порядку
   проходження гри, читати можна згори вниз.
   ===================================================================== */

/* =====================================================================
   1. КОНФІГ І ФІЧЕ-ФЛАГИ
   ===================================================================== */
const app = document.getElementById('app');   // єдиний контейнер, у який render() вставляє поточний екран

// true → на екрані режимів з'являється вхід у «Червону команду» (creator.html).
// Завантажувач ?pack= при цьому працює завжди, незалежно від прапорця.
const ENABLE_CREATOR = false;
// false → ховає і плаваючу кнопку ФІДБЕК, і заклик на фінальному екрані.
const SHOW_FEEDBACK_BTN = true;
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeDB4fjDf7NMWksBCaX9ReWMuy1Y6vgP0ns7f4aOEskyrynEA/viewform?usp=header';

/** Кнопка-посилання на форму фідбеку. Завжди нова вкладка, щоб стан гри не переривався. */
function feedbackLink(label){
  return '<a href="'+FEEDBACK_URL+'" target="_blank" rel="noopener" class="btn" style="text-decoration:none">'+label+'</a>';
}
/* =====================================================================
   2. МОВА / i18n
   UI — словник рядків самого ДВИГУНА (заголовки фаз, кнопки, тости,
   лейбли). Контент операцій (SCENARIOS) перекладається окремо, у
   content.js через applyLang(), і сюди не дублюється.
   Значення може бути рядком або функцією (коли в рядку є динамічна
   частина). t(key, ...args) повертає активну мову з фолбеком на uk.
   Активна мова зберігається у глобальній змінній LANG (content.js).
   ===================================================================== */
const UI = {
  /* ---- Українська (базова мова; фолбек для всіх ключів) ---- */
  uk: {
    trainingPlatform:"ПЛАТФОРМА ТРЕНУВАННЯ ІНФОСТІЙКОСТІ",
    modeLead:"Одне ядро зі спільною моделлю аудиторії та наративів. Режими працюють як контент-паки поверх нього.",
    playBadge:"ГРАТИ",
    coreModeName:"ІНФОСТІЙКІСТЬ",
    coreModeDesc:"Базовий режим для будь-кого. Розпізнавання російських ворожих наративів, аналіз технік, контрнаративи. Кампанія з 6 операцій.",
    soonBadge:"СКОРО",
    mobileModeName:"МОБІЛЬНІ ГРУПИ",
    mobileModeDesc:"Для виїзних мистецьких груп: читання аудиторії за чотирма шкалами, побудова програми, адаптація на ходу. На базі карткової версії.",
    intlModeName:"МІЖНАРОДНИЙ",
    intlModeDesc:"Дипломатичні та медійні сценарії для скептичних аудиторій. Прев'ю вже всередині базового режиму, операція 4.",
    redTeamBadge:"СТВОРИТИ",
    redTeamModeName:"ЧЕРВОНА КОМАНДА",
    redTeamModeDesc:"Зворотний режим: сконструюй ІПСО сам. Ціль, емоція, техніка, канал. Найшвидший шлях зрозуміти захист, це раз побувати атакою.",
    footerNote:"ІПСОМНІЯ v0.3 · DEMO BUILD · КУЛЬТУРНІ СИЛИ",
    chooseRole:"ОБЕРИ РОЛЬ",
    whoAreYou:"Хто ти в цій кампанії?",
    roleLead:"Роль визначає темп і ціну помилки. Російські ворожі наративи не схожі на пропаганду: вони схожі на інсайд, на обережного експерта, на голос миру. Твоя робота: знайти їх у стрічці, назвати техніку і встигнути з контрходом, поки вакуум не заповнив ворог.",
    back:"НАЗАД",
    campaignMap:"МАПА КАМПАНІЇ",
    meanwhile:"ТИМ ЧАСОМ",
    operationWord:"ОПЕРАЦІЯ",
    intlPreviewSuffix:" · ПРЕВ'Ю МІЖНАРОДНОГО АДДОНУ",
    finalSuffix:" · ФІНАЛ",
    openFeed:"ВІДКРИТИ СТРІЧКУ",
    attackLaunched:"Атаку запущено",
    lowTrustToast:"Вам не вірять. Вкидам вірять охочіше",
    phase1Title:"ФАЗА 1 · РОЗПІЗНАЙ",
    highActivityBanner:"⚠ ПІДВИЩЕНА АКТИВНІСТЬ ІПСО",
    feedTask:"Познач <b>усі російські ворожі наративи</b> й підтверди. Скільки їх, не підказуємо. Хибна тривога теж коштує: бачити ІПСО там, де його нема, це програш іншого типу.",
    osintBar:(left,total)=>'🛰 <b>OSINT</b> · ПЕРЕВІРКА ДЖЕРЕЛА · лишилось '+left+' / '+total,
    confirmSelection:"ПІДТВЕРДИТИ ВИБІР",
    osintCheckTitle:"OSINT: перевірити джерело",
    moderationFlagged:"⚠ МОДЕРАЦІЯ ВЖЕ ПОЗНАЧИЛА: ФЕЙК",
    osintDossier:"🛰 OSINT-ДОСЬЄ КАНАЛУ",
    osintCreated:"СТВОРЕНО", osintActivity:"АКТИВНІСТЬ", osintAvatar:"АВАТАРКА", osintNames:"НАЗВИ",
    osintOldPosts:"СТАРІ ПОСТИ", osintReposted:"РЕПОСТЯТЬ",
    close:"ЗАКРИТИ",
    osintExhausted:"OSINT вичерпано",
    tagSubtleFound:"✓ РОСІЙСЬКИЙ ТОНКИЙ НАРАТИВ ×2", tagFound:"✓ РОСІЙСЬКИЙ НАРАТИВ", tagMissed:"ПРОПУЩЕНО", tagFalseAlarm:"ХИБНА ТРИВОГА",
    recognition:"Розпізнавання", misses:"Промахи",
    nextTechAnalysis:"ДАЛІ · АНАЛІЗ ТЕХНІКИ",
    phase1bTitle:"ФАЗА 1 · УТОЧНЕННЯ",
    accurate:"Точно", wrong:"Хибно",
    unexpectedEvent:"НЕОЧІКУВАНА ПОДІЯ",
    acceptAndContinue:"ПРИЙНЯТИ Й ПРАЦЮВАТИ ДАЛІ",
    unexpectedEvent15s:"НЕОЧІКУВАНА ПОДІЯ · 15 СЕКУНД",
    eventLabel:"Подія",
    timeUpPrefix:"Час вийшов, рішення прийняли за тебе. ",
    continueBtn:"ПРОДОВЖИТИ",
    tagSubtle:"ТОНКИЙ", tagExplicit:"ЯВНИЙ",
    revealedNarrativesLabel:(op)=>'РОЗКРИТІ НАРАТИВИ · ДОВІДКА · ОПЕРАЦІЯ «'+op+'»',
    phase2Title:"ФАЗА 2 · НАЗВИ ТЕХНІКУ",
    badgeToast:(b)=>'БЕЙДЖ: '+b,
    techRevealed:"Техніку розкрито", wrongAnalysis:"Хибний аналіз",
    nextCounter:"ДАЛІ · ПРОТИДІЯ",
    chooseTargetBanner:"📡 ОБИРАЄШ НАПРЯМОК УДАРУ",
    phase3AudienceTitle:"ФАЗА 3 · НАПРЯМОК",
    bothDirectionsNote:"Обидва напрямки правильні. У повній версії команди ділять їх між собою, у демо обираєш один.",
    liveAirBanner:"🔴 ЕФІР ЖИВИЙ · ВОРОЖА ВЕРСІЯ ШИРИТЬСЯ",
    phaseCounterTitle:(n)=>'ФАЗА '+n+' · КОНТРНАРАТИВ',
    vacuumNote:"вакуум працює на ворога",
    counterWorks:"Контрнаратив працює", partialEffect:"Частковий ефект", ipsoFavorMove:"Хід на користь ІПСО",
    nextDebrief:"ДАЛІ · РОЗБІР",
    debriefTitle:"РОЗБІР ОПЕРАЦІЇ",
    rankOperation:"ОЦІНКА ОПЕРАЦІЇ ▸",
    failedTitle:"ОПЕРАЦІЮ ПРОВАЛЕНО",
    failedRank:"НАРАТИВ ЗАКРІПИВСЯ",
    failedText:"Вплив ІПСО дійшов критичної межі: ворожа версія закріпилась і стала правдою за замовчуванням для твоєї аудиторії. Витіснити наратив, що вже вкорінився, у рази дорожче, ніж не пустити його. У тренажері є розкіш, якої нема в реальності: розберись, які рішення віддали поле, і зайди в операцію ще раз.",
    replayOp:"↻ ПЕРЕПРОЙТИ ОПЕРАЦІЮ",
    restartCampaign:"ПОЧАТИ КАМПАНІЮ ЗАНОВО",
    rankTitle:(node)=>'ОЦІНКА ОПЕРАЦІЇ · '+node,
    rankSubA:"бездоганно", rankSubB:"одна помилка, тримайся", rankSubC:"є над чим працювати",
    statRecognition:"Розпізнавання", statTechAnalysis:"Аналіз техніки", statCounter:"Контрхід", statSpeed:"Швидкість",
    missedWord:"пропущено", falseWord:"хибних", cleanWord:"чисто",
    correctMark:"✓ вірно", wrongMark:"✗ хибно",
    optimalCounter:"оптимальний", midCounter:"середній", harmfulCounter:"шкідливий",
    timeUpVacuum:"час вичерпано · вакуум", timeLeftFrac:(s,f)=>s+'с лишок · '+f+'%',
    summaryBtn:"ПІДСУМОК ▸", toMapBtn:"ДО МАПИ ▸",
    silenceEventTitle:"⚠ ПОДІЯ: ГУЧНЕ МОВЧАННЯ",
    silenceEventText:"Кілька разів ти обирав «заспокоїти» замість «відповісти». Зовні ставало тихіше, але питання без відповідей нікуди не дівались. Вони консервувались і тепер вибухнули падінням довіри. Гучне мовчання не означає відсутності проблем. Воно означає їхню консервацію. Стійкість −10.",
    loudSilenceLabel:"Гучне мовчання",
    campaignSummary:"ПІДСУМОК КАМПАНІЇ",
    campaignSummaryRole:(role)=>'ПІДСУМОК КАМПАНІЇ · '+role,
    rankResilient:"ІНФОСТІЙКИЙ", rankResilientNote:"Лінія впливу на твоєму боці. Ти читаєш техніки, а не заголовки.",
    rankLiterate:"МЕДІАГРАМОТНИЙ", rankLiterateNote:"Основу тримаєш. Частина рішень зіграла на ворожий фрейм, розбори підкажуть де саме.",
    rankVictim:"ЖЕРТВА МЕТОДИЧКИ", rankVictimNote:"Наративи пройшли крізь оборону. Хороша новина: тепер ти знаєш, де саме. А це вже половина захисту.",
    finalResilience:"Фінальна стійкість", trustInYou:"Довіра до тебе", minTrust:"Мін. довіра за кампанію",
    accurateDecisions:"Точні рішення", ofWord:"з", techBadges:"Бейджі технік",
    vulnerabilityProfile:"ПРОФІЛЬ ВРАЗЛИВОСТІ",
    resilientTo:"Стійкий до:", workZone:"Зона роботи:", cleanRun:"Чистий прохід по всіх техніках. Рідкість.",
    profileNote:"У повній версії профіль накопичується між сесіями і дає тренеру картину по підрозділу: які техніки пробивають людей найчастіше.",
    demoTitle:"ТИ ЩОЙНО ПРОЙШОВ ДЕМО-ЗБІРКУ ЯДРА",
    demoText:"Кампанія з 6 операцій, OSINT, аналіз технік і контрходи — все, що ти бачив, уже працює. Нижче — те, чого в демо ще нема.",
    fullVersionAdds:"ПОВНА ВЕРСІЯ ДОДАСТЬ",
    fullVersionList:["Прогресію: починаєш простим пресофіцером, прокачуєш персонажа, відкриваєш складніші ролі й нові регіони мапи","Вільний вибір операцій на мапі — у демо порядок фіксований заради наскрізного сюжету","Прикладне ворогознавство: дерево знань про техніки, що відкриває нові контрходи","Командний режим: два гравці, одна ситуація, порівняння рішень","Аналітику для тренера і регіональні профілі стійкості"],
    addonsInProgress:"АДДОНИ В РОЗРОБЦІ",
    addonsList:["МОБІЛЬНІ ГРУПИ: читання аудиторії, побудова виступу. На базі карткової версії","МІЖНАРОДНИЙ: дипломатичні сценарії, скептичні аудиторії","ЧЕРВОНА КОМАНДА: сконструюй ІПСО сам і зрозумій захист зсередини"],
    feedbackCta:"ЗАЛИШИТИ ФІДБЕК — 2 ХВИЛИНИ",
    againOtherRole:"ЩЕ РАЗ · ІНША РОЛЬ",
    toModes:"ДО РЕЖИМІВ",
    brokenPackTitle:"ПОШКОДЖЕНИЙ ПАКЕТ",
    brokenPackH2:"Не вдалось прочитати операцію",
    brokenPackText:"Посилання обірване або зібране в несумісній версії. Відкрий звичайну гру й спробуй згенерувати пакет заново.",
    toStandardGame:"ДО ЗВИЧАЙНОЇ ГРИ ▸",
    pvpTitle:"РОЗБІР ЧУЖОЇ ОПЕРАЦІЇ",
    pvpH2:"ОПЕРАЦІЮ СТВОРИВ ІНШИЙ ГРАВЕЦЬ",
    pvpBreached:"ПРОБИТО", pvpHeld:"ВСТОЯВ",
    pvpBreachedText:"Хоч один закладений наратив пройшов повз тебе. Автор влучив у твою сліпу зону.",
    pvpHeldText:"Ти розкрив кожен наратив, який автор заклав. Атака не пройшла.",
    pvpTechLabel:"ТЕХНІКИ · ЗАКЛАВ АВТОР vs РОЗКРИВ ТИ",
    pvpFoundMark:"✓ розкрито", pvpMissedMark:"✗ пропущено",
    pvpTechAnalysis:"Аналіз техніки", pvpFinalResilience:"Фінальна стійкість",
    createYourOp:"СТВОРИТИ СВОЮ ОПЕРАЦІЮ ▸", toStandardGameNoArrow:"ДО ЗВИЧАЙНОЇ ГРИ",
    commanderChannel:"▸ ВХІДНЕ · КОМАНДИР",
    commanderName:"КОМАНДИР",
    pauseHintNote:"⏸ пауза: підказка Командира",
    ok:"OK",
    skip:"SKIP ▸",
    soundTitle:"Звук",
    musicTitle:"Музика",
    leaveFeedback:"Залишити фідбек",
    feedbackFabLabel:"ФІДБЕК",
    seeMore:"Показати більше", seeLess:"Згорнути",
    langFabToEn:"Switch to English", langFabToUk:"Перемкнути на українську",
    vacuumWord:"ВАКУУМ", vacuumLabel:"Вакуум", vacuumEnemyNote:"ворог заповнює тишу",
    infoVacuumLabel:"Інфовакуум",
    lowTrustPenalty:"Довіра низька: вам менше вірять",
    streakLabel:(s,mult)=>'СЕРІЯ '+s+mult,
    trustLabel:(v)=>'ДОВІРА '+Math.round(v),
    trustDelta:(applied)=>'ДОВІРА '+(applied>0?'+':'')+applied,
    /* ФЛОУ-РЕФАКТОРИНГ, Фаза 1: короткий вердикт у місії + звіт AAR після неї */
    verdictRight:"✅ ВІРНО.", verdictWrong:"❌ ХИБНО.",
    fullReportNote:"Повний розбір — у звіті після операції.",
    aarTitle:"ЗВІТ ПРО ОПЕРАЦІЮ",
    aarFeedSection:"РОЗБІР СТРІЧКИ",
    aarTechSection:"АНАЛІЗ ТЕХНІКИ", aarCounterSection:"КОНТРХІД",
    aarYourPick:"ТВІЙ ВИБІР", aarRightPick:"ПРАВИЛЬНО БУЛО",
    aarResilDelta:"Стійкість за операцію", aarTrustDelta:"Довіра за операцію",
    aarMarkHit:"✓ РОСІЙСЬКИЙ ВОРОЖИЙ · РОЗПІЗНАНО", aarMarkMiss:"✗ РОСІЙСЬКИЙ ВОРОЖИЙ · ПРОПУЩЕНО",
    aarMarkFalse:"✗ ХИБНА ТРИВОГА", aarMarkClean:"✓ ЧЕСНИЙ · ЧИСТО",
    aarDetailShow:"ДЕТАЛЬНИЙ РОЗБІР ▾", aarDetailHide:"ЗГОРНУТИ РОЗБІР ▴",
  },
  /* ---- English (той самий набір ключів; відсутній ключ падає на uk) ---- */
  en: {
    trainingPlatform:"INFO-RESILIENCE TRAINING PLATFORM",
    modeLead:"One core with a shared audience and narrative model. Modes work as content packs on top of it.",
    playBadge:"PLAY",
    coreModeName:"RESILIENCE",
    coreModeDesc:"A base mode for anyone. Spotting Russian hostile narratives, technique analysis, counter-narratives. A campaign of 6 operations.",
    soonBadge:"SOON",
    mobileModeName:"MOBILE UNITS",
    mobileModeDesc:"For touring arts groups: reading the audience on four scales, building a program, adapting on the go. Based on the card version.",
    intlModeName:"INTERNATIONAL",
    intlModeDesc:"Diplomatic and media scenarios for skeptical audiences. A preview already lives inside the base mode, operation 4.",
    redTeamBadge:"CREATE",
    redTeamModeName:"RED TEAM",
    redTeamModeDesc:"The reverse mode: build a disinformation op yourself. Target, emotion, technique, channel. The fastest way to understand defense is to be the attack once.",
    footerNote:"IPSOMNIA v0.3 · DEMO BUILD · CULTURE FORCES",
    chooseRole:"CHOOSE A ROLE",
    whoAreYou:"Who are you in this campaign?",
    roleLead:"Your role sets the pace and the cost of a mistake. Russian hostile narratives don't look like propaganda: they look like a leak, a cautious expert, a voice for peace. Your job: find them in the feed, name the technique, and land a counter before the vacuum fills up with the enemy.",
    back:"BACK",
    campaignMap:"CAMPAIGN MAP",
    meanwhile:"MEANWHILE",
    operationWord:"OPERATION",
    intlPreviewSuffix:" · INTERNATIONAL ADD-ON PREVIEW",
    finalSuffix:" · FINAL",
    openFeed:"OPEN FEED",
    attackLaunched:"Attack launched",
    lowTrustToast:"They don't trust you. Leaks are trusted more readily",
    phase1Title:"PHASE 1 · SPOT IT",
    highActivityBanner:"⚠ ELEVATED DISINFORMATION ACTIVITY",
    feedTask:"Mark <b>all Russian hostile narratives</b> and confirm. We won't tell you how many there are. A false alarm costs too: seeing disinformation where there is none is a different kind of loss.",
    osintBar:(left,total)=>'🛰 <b>OSINT</b> · SOURCE CHECK · '+left+' / '+total+' left',
    confirmSelection:"CONFIRM SELECTION",
    osintCheckTitle:"OSINT: check the source",
    moderationFlagged:"⚠ MODERATION ALREADY FLAGGED: FAKE",
    osintDossier:"🛰 OSINT CHANNEL DOSSIER",
    osintCreated:"CREATED", osintActivity:"ACTIVITY", osintAvatar:"AVATAR", osintNames:"NAME HISTORY",
    osintOldPosts:"OLD POSTS", osintReposted:"REPOSTED BY",
    close:"CLOSE",
    osintExhausted:"OSINT exhausted",
    tagSubtleFound:"✓ RUSSIAN SUBTLE NARRATIVE ×2", tagFound:"✓ RUSSIAN NARRATIVE", tagMissed:"MISSED", tagFalseAlarm:"FALSE ALARM",
    recognition:"Recognition", misses:"Misses",
    nextTechAnalysis:"NEXT · TECHNIQUE ANALYSIS",
    phase1bTitle:"PHASE 1 · CLARIFICATION",
    accurate:"Accurate", wrong:"Wrong",
    unexpectedEvent:"UNEXPECTED EVENT",
    acceptAndContinue:"ACCEPT AND CONTINUE",
    unexpectedEvent15s:"UNEXPECTED EVENT · 15 SECONDS",
    eventLabel:"Event",
    timeUpPrefix:"Time ran out, the decision was made for you. ",
    continueBtn:"CONTINUE",
    tagSubtle:"SUBTLE", tagExplicit:"EXPLICIT",
    revealedNarrativesLabel:(op)=>'REVEALED NARRATIVES · REFERENCE · OPERATION «'+op+'»',
    phase2Title:"PHASE 2 · NAME THE TECHNIQUE",
    badgeToast:(b)=>'BADGE: '+b,
    techRevealed:"Technique revealed", wrongAnalysis:"Wrong analysis",
    nextCounter:"NEXT · COUNTER",
    chooseTargetBanner:"📡 CHOOSING THE DIRECTION OF THE STRIKE",
    phase3AudienceTitle:"PHASE 3 · DIRECTION",
    bothDirectionsNote:"Both directions are correct. In the full version, teams split them between themselves; in the demo you pick one.",
    liveAirBanner:"🔴 LIVE ON AIR · THE HOSTILE VERSION IS SPREADING",
    phaseCounterTitle:(n)=>'PHASE '+n+' · COUNTER-NARRATIVE',
    vacuumNote:"the vacuum is working for the enemy",
    counterWorks:"Counter-narrative works", partialEffect:"Partial effect", ipsoFavorMove:"A move in the enemy's favor",
    nextDebrief:"NEXT · DEBRIEF",
    debriefTitle:"OPERATION DEBRIEF",
    rankOperation:"RATE THE OPERATION ▸",
    failedTitle:"OPERATION FAILED",
    failedRank:"THE NARRATIVE TOOK HOLD",
    failedText:"Disinformation influence has reached a critical threshold: the hostile version has taken hold and become the default truth for your audience. Displacing a narrative that has already rooted itself costs many times more than keeping it out in the first place. The trainer gives you a luxury reality doesn't: work out which decisions gave up the field, and go through the operation again.",
    replayOp:"↻ REPLAY OPERATION",
    restartCampaign:"RESTART CAMPAIGN",
    rankTitle:(node)=>'OPERATION RATING · '+node,
    rankSubA:"flawless", rankSubB:"one mistake, hang in there", rankSubC:"there's work to do",
    statRecognition:"Recognition", statTechAnalysis:"Technique analysis", statCounter:"Counter", statSpeed:"Speed",
    missedWord:"missed", falseWord:"false", cleanWord:"clean",
    correctMark:"✓ correct", wrongMark:"✗ wrong",
    optimalCounter:"optimal", midCounter:"mediocre", harmfulCounter:"harmful",
    timeUpVacuum:"time's up · vacuum", timeLeftFrac:(s,f)=>s+'s left · '+f+'%',
    summaryBtn:"SUMMARY ▸", toMapBtn:"TO THE MAP ▸",
    silenceEventTitle:"⚠ EVENT: LOUD SILENCE",
    silenceEventText:"Several times you chose to «calm things down» instead of «respond». On the surface things got quieter, but unanswered questions didn't go anywhere. They festered, and now they've exploded into a drop in trust. Loud silence doesn't mean the absence of problems. It means their preservation. Resilience −10.",
    loudSilenceLabel:"Loud silence",
    campaignSummary:"CAMPAIGN SUMMARY",
    campaignSummaryRole:(role)=>'CAMPAIGN SUMMARY · '+role,
    rankResilient:"INFO-RESILIENT", rankResilientNote:"The influence line is on your side. You read techniques, not headlines.",
    rankLiterate:"MEDIA-LITERATE", rankLiterateNote:"You held the line overall. Some decisions played into the hostile frame — the debriefs show exactly where.",
    rankVictim:"VICTIM OF THE PLAYBOOK", rankVictimNote:"The narratives got through your defense. The good news: now you know exactly where. That's already half the defense.",
    finalResilience:"Final resilience", trustInYou:"Trust in you", minTrust:"Min. trust over the campaign",
    accurateDecisions:"Accurate decisions", ofWord:"of", techBadges:"Technique badges",
    vulnerabilityProfile:"VULNERABILITY PROFILE",
    resilientTo:"Resilient to:", workZone:"Work zone:", cleanRun:"A clean run across every technique. Rare.",
    profileNote:"In the full version the profile accumulates across sessions and gives the trainer a picture across the whole unit: which techniques break through people most often.",
    demoTitle:"YOU JUST FINISHED THE CORE DEMO BUILD",
    demoText:"A 6-operation campaign, OSINT, technique analysis and counters — everything you saw already works. Below is what the demo doesn't have yet.",
    fullVersionAdds:"THE FULL VERSION ADDS",
    fullVersionList:["Progression: start as a plain press officer, level up your character, unlock harder roles and new map regions","Free choice of operations on the map — the demo's order is fixed for the sake of a through-line story","Applied enemy-studies: a skill tree of techniques that unlocks new counters","Team mode: two players, one situation, compare decisions","Analytics for the trainer and regional resilience profiles"],
    addonsInProgress:"ADD-ONS IN DEVELOPMENT",
    addonsList:["MOBILE UNITS: reading the audience, building a set. Based on the card version","INTERNATIONAL: diplomatic scenarios, skeptical audiences","RED TEAM: build a disinformation op yourself and understand the defense from the inside"],
    feedbackCta:"LEAVE FEEDBACK — 2 MINUTES",
    againOtherRole:"AGAIN · A DIFFERENT ROLE",
    toModes:"TO MODES",
    brokenPackTitle:"BROKEN PACKAGE",
    brokenPackH2:"Couldn't read the operation",
    brokenPackText:"The link is broken or was built in an incompatible version. Open the standard game and try generating the package again.",
    toStandardGame:"TO THE STANDARD GAME ▸",
    pvpTitle:"ANALYSIS OF SOMEONE ELSE'S OPERATION",
    pvpH2:"ANOTHER PLAYER CREATED THIS OPERATION",
    pvpBreached:"BREACHED", pvpHeld:"HELD",
    pvpBreachedText:"At least one planted narrative got past you. The author hit your blind spot.",
    pvpHeldText:"You uncovered every narrative the author planted. The attack didn't get through.",
    pvpTechLabel:"TECHNIQUES · PLANTED BY THE AUTHOR vs FOUND BY YOU",
    pvpFoundMark:"✓ found", pvpMissedMark:"✗ missed",
    pvpTechAnalysis:"Technique analysis", pvpFinalResilience:"Final resilience",
    createYourOp:"CREATE YOUR OWN OPERATION ▸", toStandardGameNoArrow:"TO THE STANDARD GAME",
    commanderChannel:"▸ INCOMING · COMMANDER",
    commanderName:"COMMANDER",
    pauseHintNote:"⏸ paused: Commander's tip",
    ok:"OK",
    skip:"SKIP ▸",
    soundTitle:"Sound",
    musicTitle:"Music",
    leaveFeedback:"Leave feedback",
    feedbackFabLabel:"FEEDBACK",
    seeMore:"See more", seeLess:"See less",
    langFabToEn:"Switch to English", langFabToUk:"Switch to Ukrainian",
    vacuumWord:"VACUUM", vacuumLabel:"Vacuum", vacuumEnemyNote:"the enemy is filling the silence",
    infoVacuumLabel:"Info vacuum",
    lowTrustPenalty:"They trust you less now: leaks are trusted more readily",
    streakLabel:(s,mult)=>'STREAK '+s+mult,
    trustLabel:(v)=>'TRUST '+Math.round(v),
    trustDelta:(applied)=>'TRUST '+(applied>0?'+':'')+applied,
    /* FLOW REFACTOR, Phase 1: short in-mission verdict + post-op AAR */
    verdictRight:"✅ CORRECT.", verdictWrong:"❌ WRONG.",
    fullReportNote:"Full breakdown in the post-operation report.",
    aarTitle:"AFTER ACTION REPORT",
    aarFeedSection:"FEED BREAKDOWN",
    aarTechSection:"TECHNIQUE ANALYSIS", aarCounterSection:"COUNTER",
    aarYourPick:"YOUR PICK", aarRightPick:"THE RIGHT CALL",
    aarResilDelta:"Resilience this op", aarTrustDelta:"Trust this op",
    aarMarkHit:"✓ RUSSIAN HOSTILE · SPOTTED", aarMarkMiss:"✗ RUSSIAN HOSTILE · MISSED",
    aarMarkFalse:"✗ FALSE ALARM", aarMarkClean:"✓ HONEST · CLEAN",
    aarDetailShow:"DETAILED BREAKDOWN ▾", aarDetailHide:"COLLAPSE BREAKDOWN ▴",
  }
};
/**
 * Переклад рядка двигуна. Повертає значення з активної мови; якщо ключа
 * там нема, бере український. Функціональні значення викликає з args.
 */
function t(key, ...args){
  const dict = (UI[LANG] || UI.uk);
  const v = (key in dict) ? dict[key] : UI.uk[key];
  return typeof v==='function' ? v(...args) : v;
}
/* currentScreen: замикання, яке вміє перемалювати поточний екран під нову
   мову. Кожен «верхньорівневий» екран (не вкладена подія типу wildcard або
   підказки) записує сюди себе на вході. setLang() викликає його замість
   перезавантаження сторінки, тому стан кампанії (S) не губиться. */
let currentScreen = null;

/** Плаваюча кнопка мови показує мову, НА ЯКУ перемкне, а не поточну. */
function updateLangFab(){
  const btn = document.getElementById('langFab');
  if(!btn) return;
  btn.textContent = LANG==='uk' ? 'EN' : 'УКР';
  btn.title = LANG==='uk' ? t('langFabToEn') : t('langFabToUk');
}
/**
 * Статичні елементи топбару живуть в index.html поза #app (бренд, кнопки
 * звуку, підписи шкали впливу, фідбек-кнопка), тож render() їх не
 * перемальовує. Синхронізуємо їх мову тут напряму. Викликається з setLang()
 * і один раз при завантаженні, щоб стартова мова з localStorage не лишала
 * їх українською.
 */
function syncStaticLangUI(){
  const tbTitle = document.getElementById('tbTitle');
  if(tbTitle) tbTitle.innerHTML = (LANG==='en'?'IPSO':'ІПСО')+'<span class="x">·</span>'+(LANG==='en'?'MNIA':'МНІЯ');
  const sfxBtn = document.getElementById('sfxBtn');
  if(sfxBtn){ sfxBtn.title = t('soundTitle'); sfxBtn.setAttribute('aria-label', t('soundTitle')); }
  const musicBtn = document.getElementById('musicBtn');
  if(musicBtn){ musicBtn.title = t('musicTitle'); musicBtn.setAttribute('aria-label', t('musicTitle')); }
  const inflL = document.getElementById('inflLabelL'), inflR = document.getElementById('inflLabelR');
  if(inflL) inflL.textContent = '◂ '+(LANG==='en'?'ENEMY INFLUENCE':'ВПЛИВ ІПСО');
  if(inflR) inflR.textContent = (LANG==='en'?'RESILIENCE':'СТІЙКІСТЬ')+' ▸';
  const fbFab = document.getElementById('feedbackFab');
  if(fbFab){ fbFab.textContent = t('feedbackFabLabel'); fbFab.title = t('leaveFeedback'); }
  updateLangFab();
}
/** Перемикає мову гри «на льоту», без перезавантаження і без втрати прогресу. */
function setLang(lang){
  if(lang!=='en' && lang!=='uk') return;
  if(lang===LANG) return;
  applyLang(lang);   // content.js: перевизначає SCENARIOS/ROLES/WILD/mapOps/BOSS_CHAR/DIALOGUE/BOSS_DIALOGUE/TUTORIAL
  try{ localStorage.setItem('ipsomnia_lang', lang); }catch(e){}
  document.documentElement.lang = lang;
  // S.role посилається на об'єкт зі СТАРОГО масиву ROLES; після перемикання
  // масив інший, тому підхоплюємо роль за тим самим індексом.
  if(S.role && S.roleIndex!=null && ROLES[S.roleIndex]) S.role = ROLES[S.roleIndex];
  syncStaticLangUI();
  if(document.getElementById('topbar') && document.getElementById('topbar').style.display!=='none') hud();
  if(typeof currentScreen==='function') currentScreen();
}
function toggleLang(){ setLang(LANG==='uk' ? 'en' : 'uk'); }

/* =====================================================================
   3. СТАН ГРИ
   S — єдиний об'єкт стану кампанії. Усе, що треба скинути через «ЩЕ РАЗ»,
   живе тут (див. resetState). Поля з підкресленням (_op, _snap, _feed…)
   є тимчасовими даними поточної операції/екрана.
   Поза S навмисно тримаються прапорці сесії, які «ЩЕ РАЗ» не скидає:
   introSeen, tutorialDone, hintsShown, firstOpId.
   ===================================================================== */
const S = {
  role:null,            // обрана роль (об'єкт із ROLES); задає темп і ціну помилки
  i:0,                  // індекс поточної операції у SCENARIOS
  infl:50,              // СТІЙКІСТЬ, 4..100: головна шкала; 100 = повна перемога, <=8 = поразка в операції
  rep:100, repMin:100,  // ДОВІРА (репутація) і її мінімум за кампанію
  streak:0,             // серія чистих відповідей поспіль (множник гейнів ×1.5 від 3, ×2 від 5)
  correct:0, total:0,   // лічильник точних рішень / усіх рішень для фіналу
  picks:new Set(),      // індекси постів, позначених у фазі 1
  audience:null,        // обрана аудиторія у фазі 3 (якщо операція її має)
  cons:0,               // лічильник «гучного мовчання»: >=2 на фіналі запускає кризову подію
  results:[],           // по одному запису на операцію: {tech, techOK, counterGood} для профілю вразливості
  badges:[],            // назви технік, бейджі яких розкрито
  usedWild:[],          // id wildcard-подій, які вже траплялись (не повторюються)
  timerCut:0,           // скільки секунд wildcard відрізав від таймера контрходу
  lastTechPos:-1,       // позиція правильної техніки в попередній операції (щоб не повторювалась)
  feed:[],              // робоча стрічка поточної операції (копія sc.feed, можливо з мутацією)
  osintLeft:2, osintTotal:2, osintDone:new Set(),   // ресурс OSINT-перевірок на операцію
  op1Bad:false          // чи провалено операцію «Блекаут»: вмикає наратив-мутацію у фіналі
};
let timerInt=null, wtimerInt=null;   // інтервали таймера контрходу і таймера wildcard

// Прихований дев-стрибок на операцію через URL (?op=N), без жодного UI.
let pendingOp = parseInt(new URLSearchParams(location.search).get('op'))||0;
if(pendingOp<1||pendingOp>SCENARIOS.length) pendingOp=0;

/* =====================================================================
   ЗВУК. Модуль SFX інкапсулює весь аудіостан. Файлів може не бути:
   .play() тоді відхиляється промісом, catch() ковтає це мовчки і гра
   лишається повністю робочою без звуку.
   Два незалежні перемикачі: muted (майстер 🔊, глушить усе) і musicMuted
   (лише музика: ambient/boss/intro; короткі sfx лишаються).
   ===================================================================== */
const SFX_FILES = {
  click:"assets/sfx/click.ogg", tick:"assets/sfx/tick.ogg", alert:"assets/sfx/alert.ogg",
  gain:"assets/sfx/gain.ogg", loss:"assets/sfx/loss.ogg", badge:"assets/sfx/badge.ogg",
  result:"assets/sfx/result.ogg"
};
const SFX = (function(){
  let muted = false, musicMuted = false, unlocked = false, ambientWanted = false, introWanted = false;
  // Робочий рівень музики і ціль фейду. musicMuted глушить лише музику (ambient/boss/intro),
  // короткі sfx у play() лишаються — це і є «виключити музику, саунд-дизайн лишити».
  // muted (майстер-🔊) глушить усе: і музику, і sfx.
  function musicVol(){ return (muted || musicMuted) ? 0 : 0.34; }
  const ambient = new Audio('assets/sfx/ambient.ogg');
  const bossAmbient = new Audio('assets/sfx/boss_ambient.ogg');
  const introMusic = new Audio('assets/sfx/intro.ogg');
  [ambient, bossAmbient, introMusic].forEach(a=>{ a.loop = true; a.volume = 0; a.preload = 'auto'; });
  /* setInterval, а не requestAnimationFrame: rAF повністю зупиняється в неактивній
     вкладці, і гучність застрягала б на нулі. setInterval лише тротлиться, тому
     фейд завжди рано чи пізно доходить до цілі. */
  function fadeTo(el, target, ms){
    if(el._fadeInt) clearInterval(el._fadeInt);
    const start = el.volume, t0 = Date.now();
    el._fadeInt = setInterval(()=>{
      const p = Math.min(1, (Date.now()-t0)/ms);
      try{ el.volume = start + (target-start)*p; }catch(e){}
      if(p>=1){ clearInterval(el._fadeInt); el._fadeInt=null; if(target===0){ try{ el.pause(); }catch(e){} } }
    }, 50);
  }
  /* Короткі sfx (click/tick/alert/gain/loss/badge/result) граються через
     Web Audio: createBufferSource стартує без затримки, яку дає новий
     HTMLAudioElement на кожен виклик. Музичні треки лишаються на <audio>
     із fadeTo вище.
     AudioContext створюється одразу (без жесту користувача дозволено
     створювати, лише .resume() вимагає жест, і він у unlock() нижче), щоб
     буфери декодувались ще при завантаженні, а не після першого тапу. */
  let actx = null;
  const buffers = {};   // name -> AudioBuffer; заповнюється асинхронно, поки порожньо — фолбек на new Audio
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx) actx = new Ctx();
  }catch(e){ actx = null; }
  if(actx){
    Object.keys(SFX_FILES).forEach(name=>{
      fetch(SFX_FILES[name])
        .then(r=>{ if(!r.ok) throw new Error('sfx fetch failed'); return r.arrayBuffer(); })
        .then(buf=>actx.decodeAudioData(buf))
        .then(decoded=>{ buffers[name] = decoded; })
        .catch(()=>{});   // файлу може не бути — мовчки лишаємось на фолбеку
    });
  }
  function unlock(){                          // перший клік користувача знімає блокування автоплею
    if(unlocked) return; unlocked = true;
    if(ambientWanted && ambient.paused) ambient.play().catch(()=>{});
    if(introWanted && introMusic.paused) introMusic.play().catch(()=>{});
    if(actx && actx.state === 'suspended') actx.resume().catch(()=>{});
  }
  function play(name){
    if(muted) return;
    const buf = buffers[name];
    if(buf && actx){
      try{
        const src = actx.createBufferSource(); src.buffer = buf;
        const g = actx.createGain(); g.gain.value = 0.55;
        src.connect(g); g.connect(actx.destination);
        src.start(0);
        return;
      }catch(e){ /* провалюємось у фолбек нижче */ }
    }
    // Буфер ще не догрузився (або Web Audio недоступний) — старий шлях, тихо і без помилок.
    const srcUrl = SFX_FILES[name]; if(!srcUrl) return;
    try{ const a = new Audio(srcUrl); a.volume = 0.55; a.play().catch(()=>{}); }catch(e){}
  }
  /* .paused-перевірка: повторний виклик не має ще раз смикати play() на вже граючому треку. */
  function startAmbient(){
    ambientWanted = true;
    if(unlocked && ambient.paused) ambient.play().catch(()=>{});
    fadeTo(ambient, musicVol(), 900);
  }
  // Вступна катсцена має свій трек, окремий від геймплейного амбієнту.
  function startIntroMusic(){
    introWanted = true;
    if(unlocked && introMusic.paused) introMusic.play().catch(()=>{});
    fadeTo(introMusic, musicVol(), 900);
  }
  function crossfadeToBoss(){
    fadeTo(ambient, 0, 1500);
    if(unlocked && bossAmbient.paused) bossAmbient.play().catch(()=>{});
    fadeTo(bossAmbient, musicVol(), 1500);
  }
  function crossfadeToAmbient(){
    fadeTo(bossAmbient, 0, 1500);
    if(unlocked && ambient.paused) ambient.play().catch(()=>{});
    fadeTo(ambient, musicVol(), 1500);
  }
  // Перехід катсцена → мапа кампанії: кросфейд intro.ogg у геймплейний ambient.
  function crossfadeIntroToAmbient(){
    introWanted = false;
    fadeTo(introMusic, 0, 1500);
    if(unlocked && ambient.paused) ambient.play().catch(()=>{});
    ambientWanted = true;
    fadeTo(ambient, musicVol(), 1500);
    setTimeout(()=>{ if(introWanted) return; try{ introMusic.pause(); introMusic.currentTime=0; }catch(e){} }, 1550);
  }
  function stopAmbient(){
    ambientWanted = false; introWanted = false;
    fadeTo(ambient, 0, 400); fadeTo(bossAmbient, 0, 400); fadeTo(introMusic, 0, 400);
    setTimeout(()=>{ if(ambientWanted || introWanted) return; try{ ambient.pause(); bossAmbient.pause(); introMusic.pause(); ambient.currentTime=0; bossAmbient.currentTime=0; introMusic.currentTime=0; }catch(e){} }, 450);
  }
  // Спільний рефреш музики для обох перемикачів (майстер muted і окремий musicMuted).
  // Глушіння — миттєве через .muted; повернення звуку — дофейдити активний трек назад до 0.34.
  function refreshMusic(){
    const off = muted || musicMuted;
    ambient.muted = off; bossAmbient.muted = off; introMusic.muted = off;
    if(off) return;
    if(ambientWanted){
      const active = document.body.classList.contains('boss-mode') ? bossAmbient : ambient;
      if(unlocked && active.paused) active.play().catch(()=>{});
      fadeTo(active, 0.34, 900);
    }
    if(introWanted){
      if(unlocked && introMusic.paused) introMusic.play().catch(()=>{});
      fadeTo(introMusic, 0.34, 900);
    }
  }
  function setMuted(v){ muted = v; refreshMusic(); }
  function setMusicMuted(v){ musicMuted = v; refreshMusic(); }
  function toggle(){ setMuted(!muted); return muted; }
  function toggleMusic(){ setMusicMuted(!musicMuted); return musicMuted; }
  return { play, startAmbient, startIntroMusic, crossfadeToBoss, crossfadeToAmbient, crossfadeIntroToAmbient, stopAmbient, toggle, toggleMusic, unlock, isMuted:()=>muted, isMusicMuted:()=>musicMuted };
})();
/** Кнопка 🔊/🔇 у топбарі: майстер-звук. */
function toggleSfx(){
  SFX.unlock();
  const muted = SFX.toggle();
  const btn = document.getElementById('sfxBtn'); if(btn) btn.textContent = muted?'🔇':'🔊';
}
/** Кнопка ♪ у топбарі: лише музика, саунд-дизайн лишається. */
function toggleMusic(){
  SFX.unlock();
  const off = SFX.toggleMusic();
  const btn = document.getElementById('musicBtn');
  if(btn){ btn.classList.toggle('off', off); btn.setAttribute('aria-pressed', off?'true':'false'); }
}
/* Клік по кнопках/опціях = звук click; той самий жест знімає блокування автоплею браузера. */
document.addEventListener('click', function(e){
  SFX.unlock();
  // .dialogue-box навмисно без звуку: перемикання реплік не повинно клацати
  if(e.target.closest('.btn,.opt,.mode,.msg,.osint-btn,.role-card,.intro-skip,.osint-x,.sfx-btn,.narr-card,.hint-panel')) SFX.play('click');
}, true);

/* =====================================================================
   4. ЕКОНОМІКА: три помічники, через які проходять усі зміни шкали.
   Базові числа живуть у місцях виклику (розпізнавання +5/+8, пропуск -6,
   техніка +7/-8, контрхід від -12 до +12), а тут лише модифікатори ролі,
   серії та довіри.
   ===================================================================== */
/** Стійкість ніколи не падає нижче 4 і не росте вище 100. */
function clamp(v){return Math.max(4,Math.min(100,v))}
/** Штраф (v від'ємне) помножений на коефіцієнт ролі: складніша роль платить дорожче. */
function pen(v){ return Math.round(v * S.role.pen); }
/**
 * Гейн з урахуванням серії (×1.5 від 3 поспіль, ×2 від 5). Для контрходів
 * (isCounter) низька довіра (<50) ріже гейн навпіл: «вам менше вірять».
 */
function gainAdj(v, isCounter){
  let m = 1;
  if(S.streak>=5) m=2; else if(S.streak>=3) m=1.5;
  v = Math.round(v*m);
  if(isCounter && S.rep<50){ v = Math.ceil(v/2); setTimeout(()=>toast(t('lowTrustPenalty'),'minus0'),1700); }
  return v;
}

/* =====================================================================
   5. ВБУДОВАНИЙ ТУТОРІАЛ: підказки Інструктора поверх першої операції.
   Тексти і селектори підсвітки живуть у TUTORIAL (content.js).
   Кожна підказка показується один раз за тригер і лише в першому
   проходженні кампанії за сесію («ЩЕ РАЗ» підказок не повторює), тому
   стан тримаємо поза S і resetState його не чіпає.
   Мапа дозволяє почати з будь-якої операції, тому «перша операція» є не
   S.i===0, а та, яку гравець реально обрав першою (firstOpId).
   ===================================================================== */
let tutorialDone = false;
let firstOpId = null;
function inFirstOp(){ return !!(SCENARIOS[S.i] && SCENARIOS[S.i].id === firstOpId); }
const hintsShown = new Set();
let hintQueue = [], hintBusy = false;   // підказки показуються по одній, решта чекає в черзі

/** Поставити підказку в чергу. force=true показує її навіть після завершення туторіалу (бос). */
function showHint(id, force){
  if(hintsShown.has(id)) return;
  if(!force && tutorialDone) return;
  const t = TUTORIAL.find(x=>x.id===id); if(!t) return;
  hintsShown.add(id);
  hintQueue.push({id, text:t.text, sel:t.sel});
  if(!hintBusy) advanceHintQueue();
}
function advanceHintQueue(){
  if(!hintQueue.length){ hintBusy=false; return; }
  hintBusy = true;
  const {id, text, sel} = hintQueue.shift();
  // Підказка на вході у фазу контрходу морозить таймер, щоб не з'їдати час гравця.
  // Заморозка стається до першого тіку, тому без підпису здається, що таймер
  // «не запустився»: явно показуємо паузу, щоб це читалось як стан, а не поломка.
  const freeze = (id==='counter_enter' && timerInt);
  const freezeWild = (id==='wildcard_first' && wtimerInt);   // той самий патерн для таймера wildcard-вибору
  if(freeze){
    clearInterval(timerInt); timerInt=null;
    const note = document.querySelector('.timer .note'); if(note) note.textContent = t('pauseHintNote');
  }
  if(freezeWild){ clearInterval(wtimerInt); wtimerInt=null; }
  const wrap = document.createElement('div');
  wrap.className = 'hint-panel';
  wrap.innerHTML =
      '<div class="hint-channel px">'+t('commanderChannel')+'</div>'
    + '<div class="hint-panel-top">'
    +   '<div class="hint-portrait"><div class="hint-silhouette"></div><img src="assets/instructor_1.png" alt="" onerror="this.remove()"></div>'
    +   '<div class="hint-body"><div class="hint-name">'+t('commanderName')+'</div><div class="hint-text">'+text+'</div></div>'
    + '</div>'
    + '<button class="hint-ok">'+t('ok')+'</button>';
  wrap.addEventListener('click', ()=>{
    if(!wrap.parentNode) return;
    wrap.classList.remove('show');
    setTimeout(()=>{
      wrap.remove();
      if(focusEl) focusEl.classList.remove('hint-focus');
      // відновити таймер лише якщо гравець ще не відповів (не встиг натиснути опцію)
      if(freeze && !S._counterDone && S._timeLeft>0 && document.getElementById('timerT')){
        const note = document.querySelector('.timer .note'); if(note) note.textContent = t('vacuumNote');
        startTimer(S._timeLeft, S._op.timeTotal);
      }
      if(freezeWild && !S._wildDone && S._wildLeft>0 && document.getElementById('wT')){
        startWildTimer(S._wildLeft, 15);
      }
      advanceHintQueue();
    }, 250);
  });
  document.body.appendChild(wrap);
  let focusEl = sel ? document.querySelector(sel) : null;
  if(focusEl) focusEl.classList.add('hint-focus');
  // Панель у верхньому правому куті, одразу під топбаром (якщо він видимий).
  // На мобілі (≤560px) inline-top не виставляється: позицію тримає CSS bottom.
  if(window.innerWidth > 560){
    const topbarEl = document.getElementById('topbar');
    const topOffset = (topbarEl && topbarEl.style.display!=='none') ? Math.max(8, topbarEl.getBoundingClientRect().bottom+8) : 16;
    wrap.style.top = topOffset+'px';
  }
  requestAnimationFrame(()=>wrap.classList.add('show'));
}

/* =====================================================================
   6. HUD: шкала впливу, довіра, серія, бейджі, тости.
   Топбар живе в index.html поза #app і переживає всі render().
   ===================================================================== */
/**
 * Малює червоне заповнення шкали. value = частка шкали, яку займає ВОРОГ
 * (100 - S.infl), тому тривожний стан .danger вмикається, коли ворог
 * тримає понад 75% шкали.
 */
function setInfluence(inflEl, value){
  value = Math.max(0, Math.min(100, value));
  inflEl.querySelector('.infl-fill').style.transform = 'scaleX(' + value/100 + ')';
  inflEl.classList.toggle('danger', value > 75);
}
/**
 * Єдина точка зміни СТІЙКОСТІ. Застосовує дельту, рухає лінію фронту й число
 * на шкалі, показує тост і грає звук.
 * @param delta  зміна (0 = лише перемалювати, без тосту)
 * @param label  підпис тосту («Розпізнавання», «Інфовакуум»…)
 * @param sfx    назва звуку; false = без звуку; undefined = gain/loss за знаком
 */
function setInfl(delta,label,sfx){
  S.infl = clamp(S.infl + delta);
  const m = document.getElementById('inflMarker'), n = document.getElementById('inflNum');
  const edge = 100 - S.infl;   // позиція лінії фронту: червоне зліва займає (100-infl)%
  m.style.left = 'calc('+edge+'% - 3px)';
  setInfluence(document.querySelector('.infl'), edge);
  n.textContent = S.infl;
  n.style.left = Math.max(6, Math.min(94, edge))+'%';
  document.querySelector('.infl').classList.toggle('critical', S.infl<=12);
  if(delta!==0){
    toast((delta>0?'+':'')+delta+' '+(label||''), delta>0);
    if(sfx!==false) SFX.play(sfx || (delta>0?'gain':'loss'));
    // Відкладено на макротаск: launchAttack() викликає setInfl, а одразу після
    // phaseFeed(), чий render() чистить чергу підказок. Без затримки підказка
    // вбивала б сама себе.
    if(delta<0 && inFirstOp()) setTimeout(()=>showHint('infl_drop'),0);
  }
  hud();
}
/** Єдина точка зміни ДОВІРИ (0..100). Кожна реальна зміна дає окремий тост. */
function setRep(delta){
  if(!delta) return;
  const before = S.rep;
  S.rep = Math.max(0,Math.min(100,S.rep+delta));
  const applied = S.rep - before;
  if(!applied) return;   // вже на межі 0/100, реальної зміни нема — тост зайвий
  if(S.rep < S.repMin) S.repMin = S.rep;
  toast(t('trustDelta',applied), applied>0);
  if(inFirstOp()) showHint('rep_change');
  hud();
}
/**
 * Швидкий «тік» числа від from до to замість миттєвого стрибка (3..8 кроків
 * по 40мс). Поважає prefers-reduced-motion. Використовується для довіри в HUD
 * і лічильників переглядів у стрічці.
 */
function tickValue(el, from, to, formatter){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ el.textContent = formatter(to); return; }
  if(from===to){ el.textContent = formatter(to); return; }
  const steps = Math.min(8, Math.max(3, Math.round(Math.abs(to-from)/3)));
  let i = 0;
  const int = setInterval(()=>{
    i++;
    el.textContent = formatter(i>=steps ? to : from + (to-from)*(i/steps));
    if(i>=steps) clearInterval(int);
  }, 40);
}
let _prevBadgeCount = 0;   // щоб анімувати «печатку» лише на щойно здобутому бейджі
/** Перемальовує правий блок топбару: аватар ролі, серію, довіру, бейджі технік. */
function hud(){
  const st=document.getElementById('hudStreak'), rp=document.getElementById('hudRep'), bd=document.getElementById('hudBadges');
  if(!st) return;
  const av=document.getElementById('hudAvatar');
  if(av) av.innerHTML = S.role ? avatarHTML(S.role,'av-sm') : '';
  let mult = S.streak>=5?' ×2':(S.streak>=3?' ×1.5':'');
  st.textContent = t('streakLabel', S.streak, mult);
  st.className = 'streak'+(S.streak>=3?'':' cold');
  const prevRep = parseInt((rp.textContent.match(/\d+/)||[0])[0]);
  tickValue(rp, prevRep, S.rep, v=>t('trustLabel', v));
  rp.className = 'rep'+(S.rep<50?' low':'');
  // Бейдж щойно розкритої техніки отримує анімацію «печатки» (scale 1.15→1
  // плюс один glow-імпульс), і лише він один.
  bd.innerHTML = SCENARIOS.map(sc=>{
    const got = S.badges.includes(sc.badge);
    return '<span class="badge-ico'+(got?' got':'')+'">'+(got?'▣':'▢')+'</span>';
  }).join('');
  if(S.badges.length > _prevBadgeCount){
    const idx = SCENARIOS.findIndex(sc=>sc.badge===S.badges[S.badges.length-1]);
    const spans = bd.querySelectorAll('.badge-ico');
    if(idx>=0 && spans[idx]){
      const el = spans[idx];
      el.classList.remove('stamp'); void el.offsetWidth; el.classList.add('stamp');
      el.addEventListener('animationend', ()=>el.classList.remove('stamp'), {once:true});
    }
  }
  _prevBadgeCount = S.badges.length;
}
/* Черга тостів: активний тост дограє свої 1.7с, наступний чекає в масиві
   і показується після нього, а не перебиває поточний. */
let toastQueue = [], toastBusy = false;
/** Показати тост. plus=true/'plus' → зелений, інакше червоний. */
function toast(txt,plus){
  toastQueue.push({txt,plus});
  if(!toastBusy) processToastQueue();
}
function processToastQueue(){
  if(!toastQueue.length){ toastBusy=false; return; }
  toastBusy = true;
  const {txt,plus} = toastQueue.shift();
  const t=document.getElementById('toast');
  t.textContent=txt; t.className='toast show '+(plus===true||plus==='plus'?'plus':'minus');
  setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(processToastQueue, 400);
  }, 1700);
}
/* =====================================================================
   7. ПРОГРЕС КАМПАНІЇ І ГЕЙТИНГ
   Кампанія не лінійна: гравець обирає операції на мапі. Список пройдених
   операцій зберігається в localStorage як плаский масив id без дублів.
   Мапа читає його при кожному рендері; коли всі не-босівські операції
   пройдені, відкривається бос.
   ===================================================================== */
function getCompleted(){
  try{ const raw = JSON.parse(localStorage.getItem('ipsomnia_completed')); return Array.isArray(raw) ? raw : []; }
  catch(e){ return []; }
}
function markCompleted(id){
  const done = getCompleted();
  if(done.includes(id)) return;
  done.push(id);
  try{ localStorage.setItem('ipsomnia_completed', JSON.stringify(done)); }catch(e){}
}
function nonBossOps(){ return mapOps.filter(o=>o.id!==BOSS_ID); }
function bossUnlocked(){ const done = getCompleted(); return nonBossOps().every(o=>done.includes(o.id)); }

/* Кампанія відкривається хвилями по WAVE_SIZE операцій. Порядок хвиль береться
   зі SCENARIOS (від найлегшої до найважчої), а не з розкладки пінів mapOps.
   Наступна хвиля відкривається, коли попередня пройдена повністю.
   Групування суто на рівні двигуна, контент про хвилі не знає. */
const WAVE_SIZE = 3;
function nonBossOrder(){ return SCENARIOS.filter(s=>!s.boss).map(s=>s.id); }
function opWave(id){ const i = nonBossOrder().indexOf(id); return i<0 ? 0 : Math.floor(i/WAVE_SIZE); }
function waveUnlocked(w){
  if(w<=0) return true;
  const done = getCompleted(), order = nonBossOrder();
  // хвиля w відкрита, коли всі операції попередніх хвиль пройдені
  return order.every((id,i)=> Math.floor(i/WAVE_SIZE) >= w || done.includes(id));
}
function opUnlocked(id){ return waveUnlocked(opWave(id)); }
/** Лічильник «пройдено / усього» в топбарі. */
function prog(){
  const done = getCompleted().filter(id=>mapOps.some(o=>o.id===id));
  document.getElementById('prog').textContent = done.length+'/'+mapOps.length;
}

/* =====================================================================
   8. ПРИМІТИВИ РЕНДЕРУ
   render() підміняє вміст #app; поверх нього два CRT-ефекти:
   bootScreen (флікер «термінал прокидається» на кожному екрані) і
   glitchTransition (слайс-смуги + RGB-розсув, лише на вузлових переходах).
   ===================================================================== */
/**
 * Глітч-перехід. Ефект грає на persistent-оверлеї .glitch-fx (index.html)
 * ПОВЕРХ уже підміненого екрана, а callback викликається синхронно.
 * Це свідомий компроміс: у ~20 місцях код одразу після render() чіпляється
 * до щойно вставленого DOM (таймери, фокус підказки, ревіл стрічки), тож
 * відкладати підміну контенту не можна.
 * Клас .run обов'язково знімається після animationend: інакше анімація
 * «зависає» у стані filling, і будь-який наступний forced reflow дає
 * однокадровий блим на звичайних переходах.
 */
function glitchTransition(callback){
  const fx = document.querySelector('.glitch-fx');
  if(fx){
    fx.classList.remove('run'); void fx.offsetWidth; fx.classList.add('run');
    fx.addEventListener('animationend', ()=>fx.classList.remove('run'), {once:true});
  }
  callback();
}
/**
 * «Термінал прокидається»: прямі діти .screen виринають зверху вниз зі
 * стагером (CSS: .screen.booting>*). Індекс стагера обмежено 3-4 «рядками»,
 * далі все з'являється одночасно, щоб довгі екрани не розтягували анімацію.
 * ВАЖЛИВО: .booting знімається одразу після стагера, інакше правило
 * .screen.booting>*{opacity:0} назавжди ховає кнопки, які код дописує
 * пізніше через appendActionBtn.
 */
function bootScreen(screen){
  screen.classList.remove('booting');
  void screen.offsetWidth;              // reflow → перезапуск анімації
  screen.classList.add('booting');      // CRT-спалах ~180мс
  const CAP = 3;   // максимум 3-4 "рядки" стагера (індекси 0..3)
  let maxDelay = 0;
  [...screen.children].forEach((line, i) => {
    const step = Math.min(i, CAP);
    const delay = 30 + step * 40;
    if(delay > maxDelay) maxDelay = delay;
    line.classList.remove('on');
    void line.offsetWidth;
    setTimeout(() => line.classList.add('on'), delay); // рядки зверху вниз, далі — одночасно
  });
  setTimeout(() => screen.classList.remove('booting'), maxDelay + 160);
}
/** Картки «РОЗКРИТІ НАРАТИВИ» виринають зі стагером 50мс (стрічка фази 1 має свій, повільніший ревіл). */
function staggerNarrCards(screen){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  screen.querySelectorAll('.narr-card').forEach((el,i)=>{
    el.classList.remove('narr-stagger');
    if(reduced) return;
    void el.offsetWidth;
    el.style.animationDelay = (i*50)+'ms';
    el.classList.add('narr-stagger');
  });
}
/**
 * Головна функція показу екрана. Повністю підміняє вміст #app і прибирає все,
 * що жило поверх попереднього екрана: таймери, бос-глітч, OSINT-модалки,
 * підказки, черги тостів і підказок.
 * @param html    розмітка екрана
 * @param glitch  true лише на 4 вузлових переходах кампанії (тайтл→гра,
 *                катсцена→мапа, розбір→мапа, вхід у фінал); решта екранів
 *                отримує тільки boot-флікер.
 */
function render(html, glitch){
  stopAllTimers();
  stopBossGlitch();
  document.querySelectorAll('.osint-modal').forEach(e=>e.remove());
  document.querySelectorAll('.hint-panel').forEach(e=>e.remove());
  document.querySelectorAll('.hint-focus').forEach(e=>e.classList.remove('hint-focus'));
  hintQueue=[]; hintBusy=false; toastQueue=[];
  app.innerHTML = '<div class="screen">'+html+'</div>';
  app.scrollTop = 0;   // скролиться #app, не body/window
  const boot=()=>{ const scr=app.querySelector('.screen'); bootScreen(scr); staggerNarrCards(scr); };
  if(glitch) glitchTransition(boot); else boot();
}
/**
 * Дописує кнопку «ДАЛІ» (або інший блок) у низ поточного екрана після відповіді.
 * Знімає .booting напряму: якщо таймер bootScreen ще не встиг це зробити,
 * нова кнопка лишилась би з opacity:0 назавжди.
 */
function appendActionBtn(html){
  const scr = app.querySelector('.screen');
  scr.classList.remove('booting');
  scr.insertAdjacentHTML('beforeend', html);
}
/** Випадкова перестановка індексів 0..n-1 (Фішер-Єйтс). */
function shuffled(n){
  const a=[...Array(n).keys()];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
/** Зупиняє всі ігрові інтервали: таймер контрходу, таймер wildcard, тікер переглядів. */
function stopAllTimers(){
  if(timerInt){ clearInterval(timerInt); timerInt=null; }
  if(wtimerInt){ clearInterval(wtimerInt); wtimerInt=null; }
  if(S._viewsInt){ clearInterval(S._viewsInt); S._viewsInt=null; }
  document.body.classList.remove('timer-active');
}

/* =====================================================================
   9. ТАЙМЕРИ
   ===================================================================== */
/**
 * Таймер інфовакууму у фазі контрходу. Рахує залишок від реального часу
 * (Date.now()), а не декрементом на кожен тік: у фоновій вкладці браузер
 * тротлить setInterval, і лічильник тіків відставав би від секунд.
 * Побічні ефекти (звук тіку, штраф -2 кожні 9с) прив'язані до кожної цілої
 * секунди, яку таймер перетнув, і агрегуються, якщо тротлінг пропустив
 * кілька секунд за раз (один тост і один звук на весь діапазон).
 * На нулі тиск не зникає: вмикається режим «ВАКУУМ» (-5 кожні 5с, довіра -3
 * один раз), поки гравець не відповість.
 * @param seconds  скільки лишилось (при відновленні після паузи менше за total)
 * @param total    повна тривалість, для ширини смужки
 */
function startTimer(seconds, total){
  document.body.classList.add('timer-active');   // притлумлює фідбек-кнопку на час активної фази
  total = total || seconds;   // total лишається сталим при відновленні після заморозки підказкою
  const startedAt = Date.now();
  let lastLeft = seconds;
  let vacuumStarted = false, vacuumTicksApplied = 0;
  S._timeLeft = seconds;
  const el=document.getElementById('timerT'), bar=document.getElementById('timerBar'), box=document.getElementById('timerBox');
  function tick(){
    const elapsed = Math.floor((Date.now()-startedAt)/1000);
    const left = Math.max(0, seconds-elapsed);
    S._timeLeft = left;
    if(left<=0){
      // Режим вакууму: триває, поки гравець не відповість
      if(!vacuumStarted){
        vacuumStarted = true;
        setRep(-3);   // промовчав у вакуумі: довіра падає
        if(S._op) S._op.timedOut = true;   // таймаут рахується як помилка в ранзі операції
        if(el) el.textContent = t('vacuumWord');
        if(bar) bar.style.width = '0%';
        if(box) box.classList.add('hot');
        const note = document.querySelector('.timer .note'); if(note) note.textContent = t('vacuumEnemyNote');
      }
      const vacElapsed = elapsed - seconds;
      const dueTicks = Math.floor(vacElapsed/5);
      // один виклик на всі пропущені 5-секундні тіки замість N тостів
      const n = dueTicks - vacuumTicksApplied;
      if(n>0){ vacuumTicksApplied = dueTicks; setInfl(pen(-5)*n,t('vacuumLabel')); }
      lastLeft = 0;
      return;
    }
    if(el) el.textContent = left;
    if(bar) bar.style.width = (left/total*100)+'%';
    if(left<=12 && box) box.classList.add('hot');
    // Проходимо кожну цілу секунду між попереднім і поточним тіком: тік-звук
    // в останні 10с, штраф кожні 9с. Якщо перетнуто понад 3 секунди за раз
    // (тротлінг), звук грає один раз.
    const spanCovered = lastLeft - left;
    let count = 0, tickPlayed = false;
    for(let s=lastLeft-1; s>=left; s--){
      if(s<=10 && s>0){
        if(spanCovered>3){ if(!tickPlayed){ SFX.play('tick'); tickPlayed=true; } }
        else SFX.play('tick');
      }
      if(s>0 && s%9===0) count++;
    }
    if(count>0) setInfl(pen(-2)*count,t('infoVacuumLabel'),false);
    lastLeft = left;
  }
  timerInt = setInterval(tick, 1000);
}

/* ---------- Бос-глітч: RGB-зсув + jitter на 300-400мс кожні 3-5с ----------
   Вішається на елементи з класом .glitch-target (заголовок операції боса,
   банер, пін на мапі, портрет боса). Навмисно активний і при
   prefers-reduced-motion: це частина образу загрози. */
let glitchTimeout = null;
function initGlitch(selector){
  stopBossGlitch();
  scheduleGlitch(selector);
}
function scheduleGlitch(selector){
  glitchTimeout = setTimeout(()=>{
    document.querySelectorAll(selector).forEach(el=>el.classList.add('glitch-active'));
    const dur = 300 + Math.random()*100;
    setTimeout(()=>{ document.querySelectorAll(selector).forEach(el=>el.classList.remove('glitch-active')); }, dur);
    scheduleGlitch(selector);
  }, 3000 + Math.random()*2000);
}
function stopBossGlitch(){
  if(glitchTimeout){ clearTimeout(glitchTimeout); glitchTimeout=null; }
  document.querySelectorAll('.glitch-active').forEach(el=>el.classList.remove('glitch-active'));
}

/* =====================================================================
   10. ЕКРАНИ, у порядку проходження гри
   ===================================================================== */

/* ---------- Екран режимів (тайтл) ----------
   Один живий режим («ІНФОСТІЙКІСТЬ»), решта показані як анонс. Вхід у
   «Червону команду» відкривається прапорцем ENABLE_CREATOR. */
function modeSelect(){
  currentScreen = modeSelect;
  document.getElementById('topbar').style.display='none';
  render(`
    <div class="title-screen" style="padding-top:7vh">
      <div class="eyebrow">${t('trainingPlatform')}</div>
      <h1><span style="color:var(--gold)">${LANG==='en'?'IPSO':'ІПСО'}</span>${LANG==='en'?'MNIA':'МНІЯ'}</h1>
      <p class="lead">${t('modeLead')}</p>
      <div class="modes">
        <button class="mode hero" onclick="startIntro()">
          <span class="mode-badge live px">${t('playBadge')}</span>
          <div class="mode-name">${t('coreModeName')}</div>
          <div class="mode-desc">${t('coreModeDesc')}</div>
        </button>
        <div class="mode locked" aria-disabled="true">
          <span class="mode-badge lock px">${t('soonBadge')}</span>
          <div class="mode-name">${t('mobileModeName')}</div>
          <div class="mode-desc">${t('mobileModeDesc')}</div>
        </div>
        <div class="mode locked" aria-disabled="true">
          <span class="mode-badge lock px">${t('soonBadge')}</span>
          <div class="mode-name">${t('intlModeName')}</div>
          <div class="mode-desc">${t('intlModeDesc')}</div>
        </div>
        ${ENABLE_CREATOR ? `
        <button class="mode" onclick="location.href='creator.html'">
          <span class="mode-badge live px">${t('redTeamBadge')}</span>
          <div class="mode-name">${t('redTeamModeName')}</div>
          <div class="mode-desc">${t('redTeamModeDesc')}</div>
        </button>` : `
        <div class="mode locked" aria-disabled="true">
          <span class="mode-badge lock px">${t('soonBadge')}</span>
          <div class="mode-name">${t('redTeamModeName')}</div>
          <div class="mode-desc">${t('redTeamModeDesc')}</div>
        </div>`}
      </div>
      <div class="footer-note">${t('footerNote')}</div>
    </div>`);
}

/* ---------- Діалогова катсцена ----------
   Одна система на дві сцени: вступ з Інструктором (перед вибором ролі) і
   катсцена перед босом. Портрет із 4 кадрів: 1 спокій, 2-3 говоріння,
   4 моргання. Текст друкується typewriter-ефектом, тап по панелі добиває
   репліку або переходить до наступної, SKIP завершує всю сцену. */
let introSeen = false;          // вступ показуємо один раз за сесію («ЩЕ РАЗ» не повторює), без localStorage
let introState = null;          // стан поточної репліки: {line, full, pos, done, typeInt}
let talkInt = null, talkIdx = 0;
const talkSeq = [1,2,3,2];      // цикл кадрів рота під час говоріння
let blinkTimeout = null;
let instrImgOk = true;

/* Кадри портрета попередньо завантажуються і перевіряються кожен окремо:
   якщо якогось файлу нема, анімація просто не перемикається на нього, а не
   ховає портрет назавжди. Якщо нема навіть кадру 1, лишається CSS-силует. */
let framesOK = {};   // src -> true після успішного завантаження
function preloadFrames(frames){
  framesOK = {};
  frames.forEach(src=>{ const im=new Image(); im.onload=()=>{framesOK[src]=true;}; im.src=src; });
}
function instructorHTML(){
  return '<div class="instr-portrait" id="instrPortrait">'
       +   '<div class="instr-silhouette"></div>'
       +   '<img id="instrImg" src="'+activePortrait[0]+'" alt="" onerror="instrImgFailed()">'
       + '</div>';
}
function instrImgFailed(){
  const im = document.getElementById('instrImg');
  if(im && framesOK[activePortrait[0]]){ im.src = activePortrait[0]; return; }  // відкат на кадр 1
  instrImgOk = false; if(im) im.style.display='none';                            // нема навіть кадру 1 — силует
}
function setInstrFrame(n){
  if(!instrImgOk) return;
  const src = activePortrait[n-1];
  if(!framesOK[src]) return;              // кадру нема — лишаємось на поточному, без onerror-смерті
  const im = document.getElementById('instrImg'); if(im) im.src = src;
}
function startTalkAnim(){
  stopTalkAnim();
  talkIdx = 0; setInstrFrame(talkSeq[0]);
  talkInt = setInterval(()=>{
    talkIdx = (talkIdx+1) % talkSeq.length;
    setInstrFrame(talkSeq[talkIdx]);
  }, 140);
}
function stopTalkAnim(){ if(talkInt){ clearInterval(talkInt); talkInt=null; } }
function scheduleBlink(){
  if(blinkTimeout) clearTimeout(blinkTimeout);
  blinkTimeout = setTimeout(()=>{
    if(!introState || !introState.done) return;
    setInstrFrame(4);
    setTimeout(()=>{ if(introState && introState.done) setInstrFrame(1); }, 120);
    scheduleBlink();
  }, 3000 + Math.random()*2000);
}
function clearIntroTimers(){
  if(introState && introState.typeInt){ clearInterval(introState.typeInt); introState.typeInt=null; }
  stopTalkAnim();
  if(blinkTimeout){ clearTimeout(blinkTimeout); blinkTimeout=null; }
}

/* Параметри активної сцени: які репліки грати, чий портрет показувати і що
   робити після завершення (roleSelect для вступу, startScenario для боса). */
let activeDialogue = DIALOGUE;
let dialogueDoneCb = roleSelect;
let activePortrait = INSTRUCTOR.frames, activeSpeaker = t('commanderName');
/** Малює екран діалогу з поточних active* і запускає першу репліку. */
function renderDialogueScreen(glitch){
  preloadFrames(activePortrait);
  instrImgOk = true;
  introState = null;
  render(`
    <div class="intro-screen">
      <button class="intro-skip px" onclick="skipIntro()">SKIP ▸</button>
      ${instructorHTML()}
      <div class="dialogue-box" id="dlgBox" onclick="advanceDialogue()" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')advanceDialogue()">
        <div class="dlg-name px">${activeSpeaker}</div>
        <div class="dlg-text" id="dlgText"></div>
        <div class="dlg-next" id="dlgNext">▼</div>
      </div>
    </div>`, !!glitch);
  playLine(0);
}
/** Кнопка «ГРАТИ»: вступна катсцена, або одразу вибір ролі, якщо її вже бачили цієї сесії. */
function startIntro(){
  if(introSeen){ roleSelect(true); return; }   // вузловий перехід тайтл → гра
  SFX.startIntroMusic();   // трек катсцени стартує разом із нею, не чекає вибору ролі
  activeDialogue = DIALOGUE;
  dialogueDoneCb = ()=>{ introSeen=true; roleSelect(); };
  activePortrait = INSTRUCTOR.frames; activeSpeaker = t('commanderName');
  renderDialogueScreen(true);   // вузловий перехід тайтл → гра
}
/** Катсцена перед босом. Тригер: клік по піну «ФІНАЛЬНА ОПЕРАЦІЯ» на мапі. Без глітчу: це не вузловий перехід. */
function startBossIntro(){
  S.i = SCENARIOS.findIndex(sc=>sc.boss);
  activeDialogue = BOSS_DIALOGUE;
  dialogueDoneCb = startScenario;
  activePortrait = BOSS_CHAR.frames; activeSpeaker = BOSS_CHAR.name;
  document.body.classList.add('boss-mode');   // фон уже червоний до входу в операцію; startScenario підтвердить клас
  SFX.crossfadeToBoss();
  renderDialogueScreen();
  const p = document.getElementById('instrPortrait');
  if(p){ p.classList.add('glitch-target'); initGlitch('.glitch-target'); }
}
/** Друкує репліку idx по символу (25мс), анімуючи рот; по завершенні finishLine(). */
function playLine(idx){
  clearIntroTimers();
  introState = { line: idx, full: activeDialogue[idx], pos: 0, done: false, typeInt: null };
  const textEl = document.getElementById('dlgText'), nextEl = document.getElementById('dlgNext');
  textEl.textContent = ''; nextEl.classList.remove('show');
  startTalkAnim();
  introState.typeInt = setInterval(()=>{
    introState.pos++;
    textEl.textContent = introState.full.slice(0, introState.pos);
    if(introState.pos >= introState.full.length) finishLine();
  }, 25);
}
function finishLine(){
  if(introState.typeInt){ clearInterval(introState.typeInt); introState.typeInt=null; }
  introState.done = true;
  stopTalkAnim();
  setInstrFrame(1);
  scheduleBlink();
  const nextEl = document.getElementById('dlgNext'); if(nextEl) nextEl.classList.add('show');
}
/** Тап по панелі: недодрукована репліка добивається миттєво, готова переходить до наступної. */
function advanceDialogue(){
  if(!introState) return;
  if(!introState.done){
    const textEl = document.getElementById('dlgText'); if(textEl) textEl.textContent = introState.full;
    finishLine();
    return;
  }
  const next = introState.line + 1;
  if(next < activeDialogue.length) playLine(next); else skipIntro();
}
/** Один вихід із сцени і для SKIP, і для природного завершення: робить те, що призначено в dialogueDoneCb. */
function skipIntro(){ clearIntroTimers(); dialogueDoneCb(); }

/* ---------- Вибір ролі ----------
   Роль задає економіку: множник штрафів (pen), час на контрхід (time)
   і ймовірність wildcard-події (wild). Дані в ROLES (content.js). */

/** Портрет ролі. Якщо файлу в assets нема, лишається піксельний плейсхолдер з ініціалами (onerror прибирає лише <img>). */
function avatarHTML(r, cls){
  return '<span class="avatar '+(cls||'')+'" style="--acol:'+r.col+'">'
       +   '<span class="avatar-ini">'+r.ini+'</span>'
       +   '<img src="'+r.img+'" alt="" onerror="this.remove()">'
       + '</span>';
}

function roleSelect(glitch){
  currentScreen = ()=>roleSelect();
  render(`
    <div style="padding-top:4vh">
      <div class="eyebrow">${t('chooseRole')}</div>
      <h2>${t('whoAreYou')}</h2>
      <p class="lead">${t('roleLead')}</p>
      <div class="modes">
        ${ROLES.map((r,i)=>`
          <button class="mode role-card" onclick="pickRole(${i})">
            ${avatarHTML(r,'av-lg bob')}
            <div class="role-text">
              <div class="mode-name">${r.n}</div>
              <div class="mode-desc">${r.d}</div>
              <div class="role-stats">${r.stats}</div>
            </div>
          </button>`).join('')}
      </div>
      <button class="btn ghost" onclick="modeSelect()">${t('back')}</button>
    </div>`, !!glitch);
}
function pickRole(i){
  S.role = ROLES[i]; S.roleIndex = i;
  document.getElementById('topbar').style.display='block';   // HUD з'являється лише з цього моменту
  hud();
  SFX.crossfadeIntroToAmbient();   // intro.ogg → ambient.ogg
  if(pendingOp){ const idx = pendingOp-1; pendingOp = 0; if(SCENARIOS[idx]){ selectOp(idx); return; } }   // дев-стрибок ?op=N
  campaignMap();
}

/* ---------- Мапа кампанії ----------
   Хаб гри. Сюди гравець потрапляє після вибору ролі й після кожного розбору
   операції; обидва переходи вузлові, тому глітч тут завжди true.
   Піни беруться з mapOps (content.js): координати у % від картинки мапи.
   Стан піна: locked (хвиля ще закрита) / available / done / cur (бос).
   Бос читає прогрес із localStorage і відкривається, коли пройдено все. */
function campaignMap(cliff){
  currentScreen = ()=>campaignMap(cliff);
  prog();
  const done = getCompleted();
  const unlocked = bossUnlocked();
  render(`
    <div class="eyebrow">${t('campaignMap')}</div>
    <div class="map-geo">
      <img class="map-bg" src="assets/map_ukraine.png" alt="" onerror="this.remove()">
      ${mapOps.map(o=>{
        const idx = SCENARIOS.findIndex(sc=>sc.id===o.id);
        const isBoss = o.id===BOSS_ID;
        const isDone = done.includes(o.id);
        // звичайні операції гейтяться хвилями, бос відкривається після всіх
        const opOpen = isBoss ? unlocked : opUnlocked(o.id);
        const st = isBoss ? (!unlocked ? 'locked' : (isDone?'done':'cur')) : (!opOpen ? 'locked' : (isDone?'done available':'available'));
        const clickable = opOpen;
        const click = clickable ? ` onclick="selectOp(${idx})"` : '';
        const dot = isDone ? '✓' : (isBoss ? (unlocked?'☠':'🔒') : (opOpen?'▸':'🔒'));
        const lockCounter = (isBoss && !unlocked) ? '<div class="nlock">'+nonBossOps().filter(x=>done.includes(x.id)).length+'/'+nonBossOps().length+'</div>' : '';
        return `<div class="gnode ${st}${isBoss?' gboss':''}" style="left:${o.x}%;top:${o.y}%"${click} ${clickable?'role="button" tabindex="0"':''}>
          <div class="dot${isBoss&&unlocked&&!isDone?' glitch-target':''}">${dot}</div>
          <div class="nlabel">${o.title}</div>
          ${lockCounter}
        </div>`;
      }).join('')}
    </div>
    ${cliff?`<div class="cliff"><b>${t('meanwhile')}</b>${cliff}</div>`:''}`, true);
  if(unlocked) initGlitch('.glitch-target');
}
/** Клік по піну на мапі. Бос іде через катсцену, решта одразу в бріфінг. */
function selectOp(idx){
  S.i = idx;
  const sc = SCENARIOS[idx];
  if(sc.boss) startBossIntro(); else startScenario();
}

/* ---------- Бріфінг операції ----------
   Ініціалізує все, що стосується однієї операції, і показує бриф.
   glitch=true лише з pack-режиму (вхід у гру без тайтла і катсцени);
   зі звичайної мапи, боса і replayOp бріфінг рендериться без глітчу. */
function startScenario(glitch){
  currentScreen = ()=>startScenario();
  prog();
  const sc = SCENARIOS[S.i];
  if(firstOpId===null) firstOpId = sc.id;   // туторіал прив'язаний до реально першої зіграної операції
  S.picks = new Set(); S.audience = null; S.timerCut = 0;
  // Робоча стрічка операції. Мутація: якщо «Блекаут» закрито погано, у фінал
  // додається наратив-відлуння (sc.mutation) як звичайний тонкий наратив.
  S.feed = sc.feed.slice();
  if(sc.mutation && S.op1Bad) S.feed.push(sc.mutation);
  // ресурс OSINT: 2 перевірки джерела на операцію, у боса 3
  S.osintTotal = sc.boss ? 3 : 2;
  S.osintLeft = S.osintTotal; S.osintDone = new Set();
  // пам'ять вибору для блоку «РОЗКРИТІ НАРАТИВИ», наповнюється у resolveFeed
  S._recognized = [];
  S._techAnswered = false;   // підтипи наративів показуються лише після відповіді у фазі 2
  // підсумки поточної операції для рангу і AAR
  S._op = {found:0, total:0, false:0, miss:0, techOK:false, counter:'', timeLeft:0, timeTotal:0};
  // знімок стану на старті операції, щоб «перепройти» без скидання кампанії
  S._snap = { infl:S.infl, rep:S.rep, repMin:S.repMin, streak:S.streak, correct:S.correct, total:S.total,
              cons:S.cons, resultsLen:S.results.length, badges:S.badges.slice(),
              usedWild:S.usedWild.slice(), lastTechPos:S.lastTechPos };
  document.body.classList.toggle('boss-mode', !!sc.boss);
  if(sc.boss) SFX.crossfadeToBoss();
  render(`
    <div class="eyebrow">${t('operationWord')} ${S.i+1}${sc.international?t('intlPreviewSuffix'):''}${sc.boss?t('finalSuffix'):''}</div>
    <h2 class="${sc.boss?'glitch-target':''}">${sc.title}</h2>
    ${sc.art?'<img class="op-art" src="'+sc.art+'" alt="" onerror="this.remove()">':''}
    <div class="card"><p style="line-height:1.6;font-size:15px">${sc.brief}</p></div>
    <button class="btn" onclick="launchAttack()">${t('openFeed')}</button>`, !!glitch);
  if(sc.boss) initGlitch('.glitch-target');
  if(sc.boss) showHint('boss_brief', true);
}

/** Кнопка «ВІДКРИТИ СТРІЧКУ»: стартовий удар по стійкості (sc.attack × множник ролі), далі фаза 1. */
function launchAttack(){
  const sc = SCENARIOS[S.i];
  // другий поріг довіри: <30 робить стартовий вкид на 25% сильнішим
  const lowTrust = S.rep < 30;
  const atk = lowTrust ? Math.round(sc.attack*1.25) : sc.attack;
  setInfl(pen(atk),t('attackLaunched'),'alert');
  if(lowTrust) setTimeout(()=>toast(t('lowTrustToast'),'minus0'),1700);
  phaseFeed();
}

/* ---------- ФАЗА 1 · РОЗПІЗНАЙ ----------
   Стрічка стилізована під месенджер: фейк має виглядати як реальний пост.
   Гравець позначає всі ворожі пости (скільки їх, не кажемо) і підтверджує.
   Пости з'являються послідовно з typing-індикатором, перегляди ростуть
   у реальному часі (ворожі швидше). На кожному пості кнопка 🔍 OSINT. */
function phaseFeed(){
  const sc = SCENARIOS[S.i];
  const feed = S.feed;
  // Порядок постів тасується, щоб позиції ворожих не запам'ятовувались, а
  // таймстемпи лишаються в авторському порядку зверху вниз, тож хронологія
  // виглядає природно. У боса пара пост↔час несе сюжет, тому не тасуємо.
  S._feedOrder = sc.boss ? [...Array(feed.length).keys()] : shuffled(feed.length);
  S._feedStamps = feed.map(m=>m.m);
  S._feedReady = false;
  S._feedGen = (S._feedGen||0) + 1;       // покоління ревілу: застарілий ланцюжок setTimeout сам зупиниться
  const gen = S._feedGen;
  render(`
    <div class="eyebrow phase-title">${t('phase1Title')}</div>
    ${sc.boss?'<div class="attack-banner glitch-target">'+t('highActivityBanner')+'</div>':''}
    <div class="task">🎯 <div>${t('feedTask')}</div></div>
    <div class="osint-bar">${t('osintBar', S.osintLeft, S.osintTotal)}</div>
    <div class="feed" id="feed"></div>
    <button class="btn" id="confirmBtn" disabled onclick="resolveFeed()">${t('confirmSelection')}</button>`);
  if(sc.boss) initGlitch('.glitch-target');
  if(inFirstOp()) showHint('feed_enter');
  revealFeed(gen, 0);
}
/** Розмітка одного поста стрічки. Клас .appear анімує появу; перегляди стартують з 0, revealFeed тікає їх до m.v. */
function msgHTML(idx, m, stamp){
  return '<div class="msg appear" tabindex="0" role="button" data-i="'+idx+'" data-views="'+parseViews(m.v)+'" data-hostile="'+(m.h?1:0)+'" onclick="pickMsg('+idx+')" onkeydown="if(event.key===\'Enter\')pickMsg('+idx+')">'
    + '<div class="msg-head"><span class="msg-author">'+m.a+'</span><span class="msg-tools"><span class="msg-meta">'+stamp+'</span><button class="osint-btn" data-i="'+idx+'" title="'+t('osintCheckTitle')+'" onclick="event.stopPropagation();osintOpen('+idx+')" onkeydown="event.stopPropagation()">🔍</button></span></div>'
    + (m.flagged ? '<div class="msg-flag">'+t('moderationFlagged')+'</div>' : '')
    + msgTextHTML(m.t)
    + '<div class="msg-views">👁 <span class="views-n">0</span></div>'
    + '</div>';
}
/** Рекурсивний ревіл стрічки: typing-індикатор 260мс, потім пост, пауза 160-300мс, наступний. */
function revealFeed(gen, i){
  if(gen !== S._feedGen) return;
  const feedEl = document.getElementById('feed');
  if(!feedEl) return;
  const order = S._feedOrder, stamps = S._feedStamps;
  if(i >= order.length){
    S._feedReady = true;
    startViewsTicker();
    updateConfirmBtn();
    return;
  }
  const typEl = document.createElement('div');
  typEl.className = 'msg typing';
  typEl.innerHTML = '<span class="typing-dots">●●●</span>';
  feedEl.appendChild(typEl);
  setTimeout(()=>{
    if(gen !== S._feedGen || !document.getElementById('feed')) return;
    typEl.remove();
    const idx = order[i], m = S.feed[idx];
    feedEl.insertAdjacentHTML('beforeend', msgHTML(idx, m, stamps[i]));
    const viewsEl = feedEl.querySelector('.msg[data-i="'+idx+'"] .views-n');
    if(viewsEl) tickValue(viewsEl, 0, parseViews(m.v), formatViews);
    setTimeout(()=>revealFeed(gen, i+1), 160 + Math.random()*140);
  }, 260);
}
/** «12.4K» → 12400; просте число → як є. */
function parseViews(str){
  const m = /^([\d.]+)\s*K$/i.exec(String(str).trim());
  return m ? parseFloat(m[1])*1000 : (parseFloat(str)||0);
}
function formatViews(n){
  const k = n/1000, r = Math.round(k*10)/10;
  return (Number.isInteger(r) ? r : r.toFixed(1)) + 'K';
}
/* Лічильник переглядів росте в реальному часі; ворожі пости — швидше. */
function startViewsTicker(){
  if(S._viewsInt) clearInterval(S._viewsInt);
  S._viewsInt = setInterval(()=>{
    document.querySelectorAll('#feed .msg[data-views]').forEach(el=>{
      const hostile = el.dataset.hostile==='1';
      const v = parseFloat(el.dataset.views) + (hostile ? 150+Math.random()*450 : 20+Math.random()*130);
      el.dataset.views = v;
      const disp = el.querySelector('.views-n'); if(disp) disp.textContent = formatViews(v);
    });
  }, 1400);
}
/** «ПІДТВЕРДИТИ» активна лише коли всі пости з'явились і щось позначено. */
function updateConfirmBtn(){
  const btn = document.getElementById('confirmBtn');
  if(btn) btn.disabled = !S._feedReady || S.picks.size===0;
}
/** Тап по посту: нейтральна позначка SELECTED. Вердикт (червоне/зелене) ставить лише resolveFeed(). */
function pickMsg(idx){
  if(document.querySelector('#feed.locked-feed')) return;   // після підтвердження; pointer-events:none не блокує keydown
  if(inFirstOp()) showHint('first_pick');
  const el = document.querySelector('.msg[data-i="'+idx+'"]');
  if(S.picks.has(idx)){ S.picks.delete(idx); el.classList.remove('sel'); }
  else { S.picks.add(idx); el.classList.add('sel'); }
  updateConfirmBtn();
}

/* ---------- OSINT: «Перевірити джерело» ----------
   Обмежений ресурс (S.osintLeft). Досьє показує лише сирі факти про канал
   (дата створення, активність, історія назв, старі пости, хто репостить),
   без готового вердикту «підозріло»: висновок робить сам гравець. Дані в
   полі osint кожного поста (content.js). */
/** Клік по 🔍. Повторний перегляд уже перевіреного каналу безкоштовний. */
function osintOpen(idx){
  const m = S.feed[idx];
  if(!m || !m.osint) return;
  if(!S.osintDone.has(idx)){                        // повторний перегляд перевіреного безкоштовний
    if(S.osintLeft<=0){ toast(t('osintExhausted'),'minus'); return; }
    S.osintLeft--; S.osintDone.add(idx);
    const el=document.getElementById('osintLeft'); if(el) el.textContent=S.osintLeft;
    const b=document.querySelector('.osint-btn[data-i="'+idx+'"]'); if(b) b.classList.add('used');
  }
  showOsint(m);
}
/** Модалка-досьє каналу. */
function showOsint(m){
  const o=m.osint;
  const wrap=document.createElement('div');
  wrap.className='osint-modal';
  const row=(icon,label,valueHtml)=>
    '<div class="osint-row"><span class="osint-ico">'+icon+'</span>'
    + '<div class="osint-rowbody"><b>'+label+'</b><span>'+valueHtml+'</span></div></div>';
  // Досьє може бути розрідженим (дрібні джерела мають не всі поля), тож
  // порожній рядок просто не рендериться.
  const rows = [
    o.created    ? row('📅',t('osintCreated'), o.created) : '',
    o.postsMonth ? row('📊',t('osintActivity'), o.postsMonth) : '',
    o.avatar     ? row('🖼',t('osintAvatar'), o.avatar) : '',
    o.nameHistory? row('🏷',t('osintNames'), o.nameHistory) : '',
    (o.oldPosts && o.oldPosts.length) ? row('📄',t('osintOldPosts'), o.oldPosts.map(p=>'<span class="osint-post">'+p+'</span>').join('')) : '',
    o.repostedBy ? row('🔁',t('osintReposted'), o.repostedBy) : ''
  ].join('');
  wrap.innerHTML =
    '<div class="osint-card">'
    + '<div class="osint-h"><span>'+t('osintDossier')+'</span><button class="osint-x" onclick="this.closest(\'.osint-modal\').remove()">✕</button></div>'
    + '<div class="osint-name">'+m.a+'</div>'
    + rows
    + '<button class="btn" onclick="this.closest(\'.osint-modal\').remove()">'+t('close')+'</button>'
    + '</div>';
  wrap.addEventListener('click', e=>{ if(e.target===wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

/**
 * «ПІДТВЕРДИТИ ВИБІР»: підбиває фазу 1.
 * Економіка: знайдений явний +5, тонкий +8, пропуск -6, хибна тривога -6.
 * Чиста фаза (усі знайдені, нуль хибних) продовжує серію і дає множник,
 * будь-яка помилка скидає серію. Довіра: хибна тривога -2, пропущений
 * явний наратив -1 (тонкий пропуск довіру не чіпає).
 */
function resolveFeed(){
  const sc = SCENARIOS[S.i];
  if(S._viewsInt){ clearInterval(S._viewsInt); S._viewsInt=null; }   // заморозити перегляди на моменті підтвердження
  const picked = [...S.picks];
  document.getElementById('feed').classList.add('locked-feed');
  document.getElementById('confirmBtn').style.display='none';
  let gain=0, loss=0, hostileTotal=0, hostileFound=0, falseAlarms=0, missedExplicit=0, missedSubtle=0;
  const recognized = [];   // пам'ять вибору: усі ворожі пости цієї операції, знайдені й пропущені
  // Червона рамка + глітч «підтверджена загроза» лише на червоних вердиктах
  // (пропущено / хибна тривога); влучення лишається звичним зеленим.
  const punchThreat = el => {
    el.classList.add('is-threat');
    el.classList.remove('glitch'); void el.offsetWidth; el.classList.add('glitch');
    el.addEventListener('animationend', ()=>el.classList.remove('glitch'), {once:true});
  };
  S.feed.forEach((m,idx)=>{
    const el = document.querySelector('.msg[data-i="'+idx+'"]');
    el.classList.remove('sel');   // прибрати нейтральну позначку вибору
    if(m.h){
      hostileTotal++;
      const subtle = m.tier==='sub';
      const found = picked.includes(idx);
      recognized.push({idx, found});
      if(found){
        hostileFound++;
        gain += subtle?8:5;
        el.classList.add('hit');
        el.insertAdjacentHTML('afterbegin','<span class="tag '+(subtle?'hs':'h')+'">'+(subtle?t('tagSubtleFound'):t('tagFound'))+'</span>');
      } else {
        loss += -6;
        if(!subtle) missedExplicit++;   // тонкий пропуск довіру не чіпає, явний коштує
        else missedSubtle++;
        el.classList.add('missed','shake');
        punchThreat(el);
        el.insertAdjacentHTML('afterbegin','<span class="tag '+(subtle?'hs':'h')+'">'+t('tagMissed')+'</span>');
      }
    } else if(picked.includes(idx)){
      falseAlarms++;
      loss += -6;
      el.classList.add('safe','shake');
      punchThreat(el);
      el.insertAdjacentHTML('afterbegin','<span class="tag n">'+t('tagFalseAlarm')+'</span>');
      // у місії лише вердикт + перше речення пояснення; повний `w` буде в AAR
      el.insertAdjacentHTML('beforeend', verdictExpl(false, m.w));
    }
  });
  // Самодостатній лог стрічки для AAR: копіюємо й тексти, щоб звіт не залежав
  // від подальших змін S.feed.
  S._op.review = S.feed.map((m,idx)=>({
    a:m.a, hostile:!!m.h, tier:m.tier||null, subtype:m.subtype||null, w:m.w||null,
    marker: m.h ? (picked.includes(idx)?'hit':'miss') : (picked.includes(idx)?'false':'clean')
  }));
  S._recognized = recognized;
  S.total += hostileTotal;
  S.correct += hostileFound;
  const clean = (hostileFound===hostileTotal && falseAlarms===0);
  S._spotClean = clean;
  S._op.found=hostileFound; S._op.total=hostileTotal; S._op.false=falseAlarms; S._op.miss=hostileTotal-hostileFound;
  if(clean){ S.streak++; } else { S.streak=0; }
  const repDelta = falseAlarms*-2 + missedExplicit*-1;
  if(repDelta) setRep(repDelta);
  if(inFirstOp()){
    if(falseAlarms>0) showHint('feed_false_alarm');
    if(missedSubtle>0) showHint('feed_missed_subtle');
  }
  const delta = (clean?gainAdj(gain):gain) + pen(loss);
  setTimeout(()=>{ setInfl(delta, delta>0?t('recognition'):t('misses')); },350);
  // Операція може мати додаткове підпитання перед аналізом техніки (sc.subQuestion).
  const nextAfterFeed = sc.subQuestion ? 'phaseSubQuestion' : 'phaseTech';
  const feedNote = falseAlarms>0 ? '<p class="report-note">'+t('fullReportNote')+'</p>' : '';
  appendActionBtn(feedNote+'<button class="btn" onclick="wildThen(\''+nextAfterFeed+'\')">'+t('nextTechAnalysis')+'</button>');
}

/* ---------- ФАЗА 1б · Підпитання (необов'язкова) ----------
   Уточнення про конкретне джерело між стрічкою і аналізом техніки. Той
   самий single-choice патерн, що й phaseTech, лише з довільним {q, opts}
   із sc.subQuestion. Економіка та сама: +7 / -8. */
function phaseSubQuestion(){
  const sc = SCENARIOS[S.i];
  const q = sc.subQuestion;
  const order = shuffled(q.opts.length);
  render(`
    <div class="ph-analysis">
    <div class="eyebrow phase-title">${t('phase1bTitle')}</div>
    <div class="task">🔬 <div>${q.q}</div></div>
    <div class="opts">
      ${order.map(idx=>{const o=q.opts[idx];return `
        <button class="opt" data-i="${idx}" onclick="pickSubQuestion(${idx})"><b>${o.n}</b>${optDesc(o.d)}</button>`}).join('')}
    </div>
    ${narrativesBlockHTML()}
    </div>`);
}
function pickSubQuestion(idx){
  const sc = SCENARIOS[S.i], q = sc.subQuestion;
  S.total++;
  const ok = q.opts[idx].ok;
  S._op.subOK = ok;
  if(ok){ S.correct++; S.streak++; } else S.streak=0;
  q.opts.forEach((o,j)=>{
    const el = document.querySelector('.opt[data-i="'+j+'"]');
    el.disabled = true;
    if(o.ok){ el.classList.add('good'); el.insertAdjacentHTML('beforeend','<div class="expl">'+o.e+'</div>'); }
    else if(j===idx){ el.classList.add('bad','shake'); el.insertAdjacentHTML('beforeend','<div class="expl">'+o.e+'</div>'); }
    else el.classList.add('dim');
  });
  setInfl(ok?gainAdj(7):pen(-8), ok?t('accurate'):t('wrong'));
  appendActionBtn('<button class="btn" onclick="wildThen(\'phaseTech\')">'+t('nextTechAnalysis')+'</button>');
}

/* ---------- Wildcard: несподівана подія між фазами ----------
   Дані у WILD (content.js). Два типи: 'inst' (миттєвий ефект на шкалу,
   довіру або таймер) і вибір з двох варіантів на 15 секунд. Кожна подія
   трапляється не більше одного разу за кампанію; ймовірність задає роль. */
/** Перехід до наступної фази fnName через можливу wildcard-подію. */
function wildThen(fnName){
  const pool = WILD.filter(w=>!S.usedWild.includes(w.id));
  if(pool.length && Math.random() < S.role.wild){
    const w = pool[Math.floor(Math.random()*pool.length)];
    S.usedWild.push(w.id);
    showWild(w, fnName);
  } else {
    window[fnName]();
  }
}
function showWild(w, fnName){
  if(w.type==='inst'){
    render(`
      <div class="eyebrow" style="color:var(--purple)">${t('unexpectedEvent')}</div>
      <div class="wild">
        <h3>${w.h}</h3>
        <p>${w.p}</p>
      </div>
      <button class="btn" onclick="window['${fnName}']()">${t('acceptAndContinue')}</button>`);
    // Ефект застосовується синхронно при показі: шкала в топбарі анімується
    // CSS-переходом і рух видно ще до «продовжити». Відкладений через таймер
    // ефект міг би загубитись у прихованій вкладці.
    if(w.fx) setInfl(w.fx>0?w.fx:pen(w.fx), t('eventLabel'));
    if(w.rep) setRep(w.rep);
    if(w.timerCut) S.timerCut = w.timerCut;
  } else {
    render(`
      <div class="eyebrow" style="color:var(--purple)">${t('unexpectedEvent15s')}</div>
      <div class="wild">
        <h3>${w.h}</h3>
        <p>${w.p}</p>
      </div>
      <div class="timer" id="wBox">⏱ <span class="t" id="wT">15</span><div class="timer-bar"><i id="wBar" style="width:100%"></i></div></div>
      <div class="opts">
        <button class="opt" id="wOptA" onclick="wildPick('a')"><b>${w.a.t}</b></button>
        <button class="opt" id="wOptB" onclick="wildPick('b')"><b>${w.b.t}</b></button>
      </div>`);
    S._wild = w; S._wildNext = fnName;
    S._wildDone = false;
    startWildTimer(15);
  }
  if(inFirstOp()) showHint('wildcard_first');   // після render(), інакше підказку одразу змиє очищення екрана
}
/** 15-секундний таймер wildcard-вибору; той самий Date.now()-патерн, що й startTimer. На нулі вибирається варіант b. */
function startWildTimer(seconds, total){
  document.body.classList.add('timer-active');   // притлумлює фідбек-кнопку на час активної фази
  total = total || seconds;
  const startedAt = Date.now();
  S._wildLeft = seconds;
  const el=document.getElementById('wT'), bar=document.getElementById('wBar'), box=document.getElementById('wBox');
  wtimerInt = setInterval(()=>{
    const elapsed = Math.floor((Date.now()-startedAt)/1000);
    const left = Math.max(0, seconds-elapsed);
    S._wildLeft = left;
    if(el) el.textContent=left;
    if(bar) bar.style.width=(left/total*100)+'%';
    if(left<=5 && box) box.classList.add('hot');
    if(left<=0){ clearInterval(wtimerInt); wtimerInt=null; wildPick('b',true); }
  },1000);
}
/** Вибір варіанта 'a'/'b' у wildcard. «Добрий» вибір = плюс до шкали без прихованих штрафів (cons, rep<0). */
function wildPick(key, timedOut){
  S._wildDone = true;
  if(wtimerInt){ clearInterval(wtimerInt); wtimerInt=null; }
  document.body.classList.remove('timer-active');
  const w=S._wild, o=w[key], other=w[key==='a'?'b':'a'];
  const elA=document.getElementById('wOptA'), elB=document.getElementById('wOptB');
  const picked = key==='a'?elA:elB, notPicked = key==='a'?elB:elA;
  [elA,elB].forEach(e=>e.disabled=true);
  const goodPick = o.fx>0 && !o.cons && !(o.rep&&o.rep<0);
  picked.classList.add(goodPick?'good':'bad');
  if(!goodPick) picked.classList.add('shake');
  notPicked.classList.add('dim');
  picked.insertAdjacentHTML('beforeend','<div class="expl">'+(timedOut?t('timeUpPrefix'):'')+o.e+'</div>');
  // Звук за сенсом вибору, а не за знаком дельти: пастки дають fx>0, але
  // cons/rep<0, і картка вже показує 'bad', тож і звук має бути 'loss'.
  setInfl(o.fx>0?o.fx:pen(o.fx),t('eventLabel'), goodPick?'gain':'loss');
  if(o.rep) setRep(o.rep);
  if(o.cons) S.cons++;
  appendActionBtn('<button class="btn" onclick="window[\''+S._wildNext+'\']()">'+t('continueBtn')+'</button>');
}

/* ---------- Пам'ять вибору: блок «РОЗКРИТІ НАРАТИВИ» ----------
   Показується у фазах 2-4 під питанням: усі ворожі пости операції, знайдені
   й пропущені, щоб гравець аналізував техніку з контекстом перед очима. */
function narrativesBlockHTML(){
  const rec = S._recognized || [];
  if(!rec.length) return '';
  const showSubtype = !!S._techAnswered;   // ярлик підтипу з'являється лише після відповіді у фазі 2
  const cards = rec.map(r=>{
    const m = S.feed[r.idx];
    const subtle = m.tier==='sub';
    const short = m.t.length>80 ? m.t.slice(0,80)+'…' : m.t;
    return '<div class="narr-card'+(r.found?'':' narr-missed')+'" onclick="toggleNarr(this)">'
      + '<div class="narr-head"><span class="narr-author">'+m.a+'</span>'
      +   '<span class="narr-tags"><span class="narr-tag '+(subtle?'sub':'ob')+'">'+(subtle?t('tagSubtle'):t('tagExplicit'))+'</span>'
      +   (r.found?'':'<span class="narr-tag miss">'+t('tagMissed')+'</span>')+'</span></div>'
      + (showSubtype && m.subtype ? '<div class="narr-subtype">'+m.subtype+'</div>' : '')
      + '<div class="narr-text short">'+short+'</div>'
      + '<div class="narr-text full">'+m.t+'</div>'
      + '</div>';
  }).join('');
  return '<div class="narr-block"><div class="narr-label">'+t('revealedNarrativesLabel', SCENARIOS[S.i].node.replace('☠ ',''))+'</div><div class="narr-list">'+cards+'</div></div>';
}
function toggleNarr(el){ el.classList.toggle('narr-open'); }

/* ---------- Згортання довгого тексту («показати більше») ----------
   Один механізм на два місця: описи опцій і пости стрічки. toggleClamp
   завжди робить stopPropagation, бо і .opt, і .msg самі клікабельні. */
const OPT_CLAMP_LEN = 90;    // історичний поріг для описів опцій (зараз опис завжди згорнутий)
const MSG_CLAMP_LEN = 240;   // пости довші за це згортаються до 4 рядків
/** Картка опції показує лише заголовок; опис розкривається по кліку, незалежно від довжини. */
function optDesc(d){
  if(!d) return '';
  return `<span class="opt-d clamped">${d}</span><span class="opt-more" onclick="toggleClamp(event,this)">${t('seeMore')}</span>`;
}
function msgTextHTML(txt){
  if(!txt || txt.length <= MSG_CLAMP_LEN) return '<div class="msg-text">'+txt+'</div>';
  return '<div class="msg-text clamped">'+txt+'</div>'
       + '<span class="msg-more" role="button" tabindex="0" onclick="toggleClamp(event,this)" onkeydown="if(event.key===\'Enter\'){toggleClamp(event,this)}else{event.stopPropagation()}">'+t('seeMore')+'</span>';
}
function toggleClamp(ev, el){
  ev.stopPropagation();                       // НЕ тригерити pickMsg/вибір опції
  const d = el.previousElementSibling;
  const open = d.classList.toggle('clamped') === false;
  el.textContent = open ? t('seeLess') : t('seeMore');
}

/* ---------- Короткий фідбек у місії ----------
   Гра і розбір розведені: під час місії показуємо лише вердикт і перше
   речення пояснення, повний текст (`e`, `w`) гравець читає в AAR після
   операції. Перше речення витягується на льоту, контент не дублюється. */
/** Перше речення тексту; якщо воно коротше 15 символів («Так.»), додає ще одне. */
function firstSentence(s){
  if(!s) return "";
  const m = s.match(/^[^.!?]*[.!?]/);
  let out = m ? m[0].trim() : s.trim();
  if(out.length < 15){                 // «Так.» надто коротке — беремо ще одне речення
    const rest = s.slice(m ? m[0].length : 0);
    const m2 = rest.match(/^[^.!?]*[.!?]/);
    out = (out + ' ' + (m2 ? m2[0].trim() : rest.trim())).trim();
  }
  return out;
}
/* Короткий блок пояснення під опцією: вердикт + перше речення. Повний розбір — в AAR. */
function verdictExpl(right, e){
  return '<div class="expl">'+(right?t('verdictRight'):t('verdictWrong'))+' '+firstSentence(e)+'</div>';
}

/* ---------- ФАЗА 2 · ТЕХНІКА ----------
   Яку техніку маніпуляції використано. 4 варіанти: правильна і три сусідні
   техніки, частково присутні в постах (дистрактори). Економіка +7 / -8;
   правильна відповідь відкриває бейдж техніки. */
function phaseTech(){
  const sc = SCENARIOS[S.i];
  const okIdx = sc.techniques.opts.findIndex(o=>o.ok);
  let order = shuffled(sc.techniques.opts.length);
  // правильна відповідь не має стояти на тій самій позиції, що в попередній операції
  while(sc.techniques.opts.length>1 && order.indexOf(okIdx)===S.lastTechPos){
    order = shuffled(sc.techniques.opts.length);
  }
  S.lastTechPos = order.indexOf(okIdx);
  render(`
    <div class="ph-analysis">
    <div class="eyebrow phase-title">${t('phase2Title')}</div>
    <div class="task">🔬 <div>${sc.techniques.q}</div></div>
    <div class="opts">
      ${order.map(idx=>{const o=sc.techniques.opts[idx];return `
        <button class="opt" data-i="${idx}" onclick="pickTech(${idx})"><b>${o.n}</b>${optDesc(o.d)}</button>`}).join('')}
    </div>
    ${narrativesBlockHTML()}
    </div>`);
  if(inFirstOp()) showHint('tech_enter');
}
function pickTech(idx){
  const sc = SCENARIOS[S.i]; S.total++;
  const ok = sc.techniques.opts[idx].ok;
  S._techOK = ok; S._op.techOK = ok; S._op.techPick = idx;   // вибір запам'ятовуємо для AAR
  S._techAnswered = true;   // з цього моменту блок наративів показує підтипи
  if(ok){
    S.correct++; S.streak++;
    if(!S.badges.includes(sc.badge)){
      S.badges.push(sc.badge);
      setTimeout(()=>{ toast(t('badgeToast',sc.badge),'plus'); SFX.play('badge'); },1800);
    }
  }
  else S.streak=0;
  // підсвітка: правильна зелена, обрана хибна червона з тряскою, решта пригашена
  sc.techniques.opts.forEach((o,j)=>{
    const el = document.querySelector('.opt[data-i="'+j+'"]');
    el.disabled = true;
    if(o.ok){ el.classList.add('good'); el.insertAdjacentHTML('beforeend', verdictExpl(true, o.e)); }
    else if(j===idx){ el.classList.add('bad','shake'); el.insertAdjacentHTML('beforeend', verdictExpl(false, o.e)); }
    else el.classList.add('dim');
  });
  setInfl(ok?gainAdj(7):pen(-8), ok?t('techRevealed'):t('wrongAnalysis'));
  const next = sc.audiences ? 'phaseAudience' : 'phaseCounter';
  appendActionBtn('<p class="report-note">'+t('fullReportNote')+'</p><button class="btn" onclick="wildThen(\''+next+'\')">'+t('nextCounter')+'</button>');
}

/* ---------- ФАЗА 3 · АУДИТОРІЯ (лише в операціях із sc.audiences) ----------
   Кому адресувати контрхід. Вибір без оцінки, але він визначає набір
   контрходів у наступній фазі (кожна аудиторія має свої counters). */
function phaseAudience(){
  const sc = SCENARIOS[S.i];
  render(`
    <div class="ph-counter ph-aud">
    <div class="phase-banner live">${t('chooseTargetBanner')}</div>
    <div class="eyebrow phase-title">${t('phase3AudienceTitle')}</div>
    <div class="task">📡 <div>${sc.audienceQ}</div></div>
    <div class="opts">
      ${sc.audiences.map((a,idx)=>`
        <button class="opt" onclick="pickAudience(${idx})"><b>${a.n}</b>${a.d}</button>`).join('')}
    </div>
    <p class="lead" style="margin-top:12px;font-size:13px">${t('bothDirectionsNote')}</p>
    ${narrativesBlockHTML()}
    </div>`);
}
function pickAudience(idx){ S.audience = idx; phaseCounter(); }

/* ---------- ФАЗА 4 · КОНТРХІД (на таймері) ----------
   Таймер інфовакууму: час задає роль, мінус те, що відрізали wildcard і
   сюжет боса, але не менше 12с. Поки гравець думає, ворог заповнює тишу
   (-2 кожні 9с). Опції: best (+12, довіра +3), середні (+2..5),
   шкідливі (-12). Поле cons позначає «гучне мовчання». */
function phaseCounter(){
  const sc = SCENARIOS[S.i];
  const c = sc.audiences ? sc.audiences[S.audience].counters : sc.counters;
  const tSec = Math.max(12, S.role.time - S.timerCut - (sc.bossTimerCut||0));
  S._op.timeTotal = tSec;
  S._counterDone = false;   // чи гравець уже відповів (щоб підказка не відновлювала таймер даремно)
  const order = shuffled(c.opts.length);
  render(`
    <div class="ph-counter">
    <div class="phase-banner live">${t('liveAirBanner')}</div>
    <div class="eyebrow phase-title">${t('phaseCounterTitle', sc.audiences?'4':'3')}</div>
    <div class="timer" id="timerBox">⏱ <span class="t" id="timerT">${tSec}</span>
      <div class="timer-bar"><i id="timerBar" style="width:100%"></i></div>
      <span class="note">${t('vacuumNote')}</span>
    </div>
    <div class="task">⚔️ <div>${c.q}</div></div>
    <div class="opts">
      ${order.map(idx=>{const o=c.opts[idx];return `
        <button class="opt" data-i="${idx}" onclick="pickCounter(${idx})"><b>${o.n}</b>${optDesc(o.d)}</button>`}).join('')}
    </div>
    ${narrativesBlockHTML()}
    </div>`);
  startTimer(tSec);
  if(inFirstOp()) showHint('counter_enter');
}
function pickCounter(idx){
  S._counterDone = true;
  if(timerInt){clearInterval(timerInt);timerInt=null;}
  document.body.classList.remove('timer-active');
  const sc = SCENARIOS[S.i]; S.total++;
  const c = sc.audiences ? sc.audiences[S.audience].counters : sc.counters;
  const o = c.opts[idx];
  if(o.best){ S.correct++; S.streak++; } else S.streak=0;
  if(o.cons) S.cons++;
  // довіра: оптимальний контрхід +3, плюс власне поле rep опції (зазвичай штраф)
  const repDelta = (o.rep||0) + (o.best?3:0);
  if(repDelta) setTimeout(()=>setRep(repDelta), 900);   // затримка, щоб не забити тост впливу нижче
  S._op.counter = o.best ? 'best' : (o.fx<0 ? 'bad' : 'mid');
  S._op.counterPick = idx;   // для AAR
  S._op.timeLeft = S._timeLeft||0;
  S.results.push({tech: sc.tech, techOK: S._techOK, counterGood: !!o.best});   // для профілю вразливості на фіналі
  // Вердикт бінарний проти best, так само як ранг рахує помилку.
  c.opts.forEach((op,j)=>{
    const el = document.querySelector('.opt[data-i="'+j+'"]');
    el.disabled = true;
    let cls = op.fx>=8 ? 'good' : (op.fx<0 ? 'bad' : 'mid');
    if(j===idx){
      el.classList.add(cls);
      if(op.fx<0) el.classList.add('shake');
      el.insertAdjacentHTML('beforeend', verdictExpl(!!op.best, op.e));
    }
    else if(op.best){ el.classList.add('good'); el.insertAdjacentHTML('beforeend', verdictExpl(true, op.e)); }
    else el.classList.add('dim');
  });
  // Чесний фідбек: середня опція підписана як «частковий ефект», без звуку перемоги.
  const label = o.best ? t('counterWorks') : (o.fx>0 ? t('partialEffect') : t('ipsoFavorMove'));
  setInfl(o.fx>0?gainAdj(o.fx,true):pen(o.fx), label, (!o.best && o.fx>0) ? false : undefined);
  appendActionBtn('<p class="report-note">'+t('fullReportNote')+'</p><button class="btn" onclick="phaseAAR()">'+t('nextDebrief')+'</button>');
}

/* ---------- Ранг за операцію (A/B/C) ----------
   Помилка = кожен пропуск, кожна хибна тривога, хибна техніка, хибне
   підпитання, неоптимальний контрхід, таймаут. 0 помилок A, рівно 1 B,
   дві й більше C. Швидкість у ранг не входить, лише показується. */
function countMistakes(d){
  let m = (d.miss||0) + (d.false||0);
  if(!d.techOK) m++;
  if(d.subOK===false) m++;   // підпитання рахується лише коли операція його ставить
  if(d.counter!=='best') m++;
  if(d.timedOut) m++;
  return m;
}
function gradeOp(){
  const mistakes = countMistakes(S._op || {});
  if(mistakes===0) return 'A';
  if(mistakes===1) return 'B';
  return 'C';
}

/* ---------- AFTER ACTION REPORT (розбір після операції) ----------
   Навчальне ядро гри. Один екран: ранг і дельти за операцію, а під кнопкою
   «ДЕТАЛЬНИЙ РОЗБІР» повні пояснення: кожен пост стрічки (повний `w` чесних
   постів, підтипи ворожих), техніка і контрхід з повними `e`, дебриф,
   кліфхенгер. Показується і на перемозі, і на поразці (infl<=8).
   AAR лише читає підсумки S._op, нічого не рахує заново. */
function phaseAAR(){
  const sc = SCENARIOS[S.i], d = S._op || {};
  const defeated = S.infl <= 8;
  const g = gradeOp();
  // Якщо «Блекаут» закрито погано, у фінальній операції з'явиться наратив-мутація.
  if(sc.id==='blackout') S.op1Bad = (g==='C') || !S._spotClean;
  SFX.play(defeated ? 'loss' : 'result');

  /* --- результат / шапка --- */
  const gcls = 'gr-'+g.toLowerCase();
  const subs = {A:t('rankSubA'),B:t('rankSubB'),C:t('rankSubC')};
  const frac = d.timeTotal>0 ? Math.round(d.timeLeft/d.timeTotal*100) : 0;
  let parts=[]; if(d.miss) parts.push(d.miss+' '+t('missedWord')); if(d.false) parts.push(d.false+' '+t('falseWord'));
  const recV = (d.found||0)+'/'+(d.total||0)+(parts.length?' · '+parts.join(', '):' · '+t('cleanWord'));
  const techV = d.techOK ? t('correctMark') : t('wrongMark');
  const cV = d.counter==='best'?t('optimalCounter'):(d.counter==='mid'?t('midCounter'):t('harmfulCounter'));
  const spV = d.timedOut ? t('timeUpVacuum') : t('timeLeftFrac', d.timeLeft, frac);
  const errCount = (d.miss||0)+(d.false||0);
  const recCls = errCount===0 ? 'good' : (errCount>=2 ? 'bad' : '');
  const techCls = d.techOK ? 'good' : 'bad';
  const cCls = d.counter==='best' ? 'good' : (d.counter==='bad' ? 'bad' : '');
  const spCls = d.timedOut ? 'bad' : '';
  // дельти за операцію: різниця з переднім знімком старту (лише читання)
  const snap = S._snap || {infl:S.infl, rep:S.rep};
  const dInfl = S.infl - snap.infl, dRep = S.rep - snap.rep;
  const dlt = v => (v>0?'+':'')+v, dcls = v => v>0?'good':(v<0?'bad':'');

  const headHTML = defeated
    ? `<div class="eyebrow" style="color:var(--hostile)">${t('failedTitle')}</div>
       <div class="rank low">${t('failedRank')}</div>
       <p class="lead" style="max-width:440px;margin:0 auto 16px">${t('failedText')}</p>`
    : `<div class="grade ${gcls}">${g}</div><div class="grade-sub">${subs[g]}</div>`;

  const resultCard = `
    <div class="card" style="text-align:left">
      <div class="stat"><span>${t('statRecognition')}</span><span class="v ${recCls}">${recV}</span></div>
      <div class="stat"><span>${t('statTechAnalysis')}</span><span class="v ${techCls}">${techV}</span></div>
      <div class="stat"><span>${t('statCounter')}</span><span class="v ${cCls}">${cV}</span></div>
      <div class="stat"><span>${t('statSpeed')}</span><span class="v ${spCls}">${spV}</span></div>
      <div class="stat"><span>${t('aarResilDelta')}</span><span class="v ${dcls(dInfl)}">${dlt(dInfl)}</span></div>
      <div class="stat"><span>${t('aarTrustDelta')}</span><span class="v ${dcls(dRep)}">${dlt(dRep)}</span></div>
    </div>`;

  /* --- розбір стрічки: повний `w` чесних постів + підтип ворожих --- */
  const markLabel = {hit:t('aarMarkHit'), miss:t('aarMarkMiss'), false:t('aarMarkFalse'), clean:t('aarMarkClean')};
  const feedHTML = (d.review||[]).map(r=>{
    const detail = r.hostile
      ? (r.subtype ? '<div class="aar-post-sub">'+(r.tier==='sub'?t('tagSubtle'):t('tagExplicit'))+' · '+r.subtype+'</div>' : '')
      : (r.w ? '<div class="aar-post-w">'+r.w+'</div>' : '');
    return '<div class="aar-post '+r.marker+'"><div class="aar-post-head"><span class="aar-post-author">'+r.a+'</span>'
      + '<span class="aar-post-mark">'+markLabel[r.marker]+'</span></div>'+detail+'</div>';
  }).join('');
  const feedSection = feedHTML ? '<div class="aar-section-h">'+t('aarFeedSection')+'</div><div class="aar-feed">'+feedHTML+'</div>' : '';

  /* --- техніка --- */
  const tOpts = sc.techniques ? sc.techniques.opts : [];
  const tPick = tOpts[d.techPick], tRight = tOpts.find(o=>o.ok);
  const techSection = tPick ? '<div class="aar-section-h">'+t('aarTechSection')+'</div>'+aarReviewCard(!!tPick.ok, tPick, tRight) : '';

  /* --- контрхід (гілка аудиторії, якщо є) --- */
  const cc = sc.audiences ? (sc.audiences[S.audience]||{}).counters : sc.counters;
  const cOpts = cc ? cc.opts : [];
  const cPick = cOpts[d.counterPick], cRight = cOpts.find(o=>o.best);
  const counterSection = cPick ? '<div class="aar-section-h">'+t('aarCounterSection')+'</div>'+aarReviewCard(!!cPick.best, cPick, cRight) : '';

  // Поразка: операція не зараховується, лише «перепройти» або «спочатку».
  const btns = defeated
    ? '<button class="btn" onclick="replayOp()">'+t('replayOp')+'</button>'
      + '<button class="btn ghost" onclick="restart()">'+t('restartCampaign')+'</button>'
    : '<button class="btn" onclick="nextScenario()">'+(sc.boss ? t('summaryBtn') : t('toMapBtn'))+'</button>'
      + '<button class="btn ghost" onclick="replayOp()">'+t('replayOp')+'</button>';
  const cliffHTML = (sc.cliff && !defeated) ? '<div class="cliff aar-cliff"><b>'+t('meanwhile')+'</b>'+sc.cliff+'</div>' : '';

  // За замовчуванням видно лише таблицю результату; розбір розкривається кнопкою.
  const detailHTML = `
      ${feedSection}
      ${techSection}
      ${counterSection}
      <div class="aar-section-h">${t('debriefTitle')}</div>
      <div class="card debrief"><p style="line-height:1.65;font-size:15px">${sc.debrief}</p></div>
      ${cliffHTML}`;
  render(`
    <div class="aar">
      <div class="eyebrow">${t('aarTitle')} · ${sc.node}</div>
      <h2>${sc.title}</h2>
      <div class="aar-head">${headHTML}</div>
      ${resultCard}
      <button class="btn ghost aar-detail-toggle" onclick="toggleAARDetail(this)">${t('aarDetailShow')}</button>
      <div class="aar-detail">${detailHTML}</div>
      <div class="aar-btns">${btns}</div>
    </div>`);
}
function toggleAARDetail(btn){
  const d = document.querySelector('.aar-detail');
  if(!d) return;
  const open = d.classList.toggle('open');
  btn.textContent = open ? t('aarDetailHide') : t('aarDetailShow');
}
/* Картка розбору однієї відповіді: твій вибір (вердикт + повне `e`) і, якщо була
   помилка, правильний варіант з його повним `e`. */
function aarReviewCard(right, pick, correct){
  const yours = '<div class="aar-pick '+(right?'good':'bad')+'">'
    + '<div class="aar-pick-h">'+t('aarYourPick')+' · '+(right?t('verdictRight'):t('verdictWrong'))+'</div>'
    + '<b>'+pick.n+'</b><div class="aar-pick-e">'+pick.e+'</div></div>';
  const rightCard = (!right && correct && correct!==pick)
    ? '<div class="aar-pick good"><div class="aar-pick-h">'+t('aarRightPick')+'</div>'
      + '<b>'+correct.n+'</b><div class="aar-pick-e">'+correct.e+'</div></div>'
    : '';
  return yours + rightCard;
}
/** «ПЕРЕПРОЙТИ»: відкат стану до знімка S._snap, зробленого на старті операції; кампанія не скидається. */
function replayOp(){
  const s = S._snap; if(!s) return;
  S.infl=s.infl; S.rep=s.rep; S.repMin=s.repMin; S.streak=s.streak; S.correct=s.correct; S.total=s.total;
  S.cons=s.cons; S.results.length=s.resultsLen; S.badges=s.badges.slice();
  S.usedWild=s.usedWild.slice(); S.lastTechPos=s.lastTechPos;
  setInfl(0);   // перемалювати шкалу й HUD під відновлені значення
  startScenario();
}
/** Після розбору гравець завжди повертається на мапу; завершення боса — єдиний вихід у фінал. */
function nextScenario(){
  const sc = SCENARIOS[S.i];
  const wasFirstOp = (sc.id === firstOpId);
  markCompleted(sc.id);
  if(sc.boss){ finale(); return; }
  campaignMap();
  // Прощальна підказка туторіалу, і лише після неї tutorialDone=true,
  // інакше showHint відкинув би її.
  if(wasFirstOp){ showHint('map_after_op1'); tutorialDone = true; }
}

/* ---------- ФІНАЛ КАМПАНІЇ ----------
   Ранг за стійкістю: ≥78 Інфостійкий, ≥52 Медіаграмотний, інакше Жертва
   методички. Профіль вразливості: техніки, де і аналіз, і контрхід були
   правильні, проти тих, де хоч щось не так. Якщо гравець двічі і більше
   обирав «гучне мовчання» (S.cons>=2), спочатку грає кризова подія -10. */
function finale(){
  if(packMode){ packFinale(); return; }   // pack-режим: своя звірка замість кампанійного підсумку
  document.body.classList.remove('boss-mode');
  SFX.crossfadeToAmbient();
  let crisisHtml = '';
  const doCrisis = S.cons >= 2;
  if(doCrisis){
    crisisHtml = `<div class="crisis">
      <h3>${t('silenceEventTitle')}</h3>
      <p>${t('silenceEventText')}</p>
    </div>`;
  }
  // Проміжний екран без кнопок одразу: інакше за 1.5с затримки гравець міг би
  // ще раз клікнути «ПІДСУМОК» чи «ПЕРЕПРОЙТИ».
  if(doCrisis){
    render(`
      <div style="padding-top:3vh;text-align:center">
        <div class="eyebrow">${t('campaignSummary')}</div>
        ${crisisHtml}
      </div>`, true);   // вузлова точка 4: вхід у фінал (після боса)
  }

  const resilient = [...new Set(S.results.filter(r=>r.techOK && r.counterGood).map(r=>r.tech))];
  const vulnerable = [...new Set(S.results.filter(r=>!r.techOK || !r.counterGood).map(r=>r.tech))];

  const doRender = ()=>{
    let rank, cls, note;
    if(S.infl>=78){ rank=t('rankResilient'); cls='gold'; note=t('rankResilientNote'); }
    else if(S.infl>=52){ rank=t('rankLiterate'); cls='mid'; note=t('rankLiterateNote'); }
    else { rank=t('rankVictim'); cls='low'; note=t('rankVictimNote'); }

    render(`
      <div style="padding-top:3vh;text-align:center">
        <div class="eyebrow">${t('campaignSummaryRole', S.role.n)}</div>
        <div class="rank ${cls}">${rank}</div>
        <p class="lead" style="max-width:440px;margin:0 auto 20px">${note}</p>
        <img class="finale-art" src="assets/finale_art.png" alt="" onerror="this.remove()">
        ${crisisHtml}
        <div class="card" style="text-align:left">
          <div class="stat"><span>${t('finalResilience')}</span><span class="v">${S.infl} / 100</span></div>
          <div class="stat"><span>${t('trustInYou')}</span><span class="v">${S.rep} / 100</span></div>
          <div class="stat"><span>${t('minTrust')}</span><span class="v">${S.repMin} / 100</span></div>
          <div class="stat"><span>${t('accurateDecisions')}</span><span class="v">${S.correct} ${t('ofWord')} ${S.total}</span></div>
          <div class="stat"><span>${t('techBadges')}</span><span class="v">${S.badges.length} / ${SCENARIOS.length}</span></div>
        </div>
        <div class="card" style="text-align:left">
          <div class="px" style="font-size:9px;color:var(--gold);margin-bottom:10px;line-height:1.7">${t('vulnerabilityProfile')}</div>
          ${resilient.length?'<div style="font-size:13px;color:var(--muted)">'+t('resilientTo')+'</div><div class="vuln-row">'+resilient.map(tc=>'<span class="chip ok">'+tc+'</span>').join('')+'</div>':''}
          ${vulnerable.length?'<div style="font-size:13px;color:var(--muted);margin-top:10px">'+t('workZone')+'</div><div class="vuln-row">'+vulnerable.map(tc=>'<span class="chip vuln">'+tc+'</span>').join('')+'</div>':'<div style="font-size:13px;color:var(--ok);margin-top:10px">'+t('cleanRun')+'</div>'}
          <p style="font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5">${t('profileNote')}</p>
        </div>
        <div class="demo-note">
          <h3>${t('demoTitle')}</h3>
          <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:12px">${t('demoText')}</p>
          <h3>${t('fullVersionAdds')}</h3>
          <ul>
            ${t('fullVersionList').map(li=>'<li>'+li+'</li>').join('')}
          </ul>
          <h3 style="margin-top:14px">${t('addonsInProgress')}</h3>
          <ul>
            ${t('addonsList').map(li=>'<li>'+li+'</li>').join('')}
          </ul>
        </div>
        ${SHOW_FEEDBACK_BTN ? feedbackLink(t('feedbackCta')) : ''}
        <button class="btn" onclick="restart()">${t('againOtherRole')}</button>
        <button class="btn ghost" onclick="restartToModes()">${t('toModes')}</button>
      </div>`, !doCrisis);   // вузлова точка 4, якщо кризового проміжного екрана не було
  };

  if(doCrisis){
    setTimeout(()=>setInfl(-10,t('loudSilenceLabel')), 700);
    setTimeout(doRender, 1500);
  } else doRender();
}

/** Скидання кампанії до стартових значень. Прогрес на мапі (localStorage) і прапорці сесії не чіпає. */
function resetState(){
  S.role=null; S.i=0;
  S.infl=50; S.rep=100; S.repMin=100;
  S.streak=0; S.correct=0; S.total=0; S.cons=0;
  S.results=[]; S.badges=[]; S.usedWild=[];
  S.timerCut=0; S.lastTechPos=-1;
  S._op=null; S._snap=null; S.feed=[];
  S.osintLeft=2; S.osintTotal=2; S.osintDone=new Set();
  S.op1Bad=false; S._recognized=[]; S._techAnswered=false;
  document.body.classList.remove('boss-mode');
  SFX.stopAmbient();
}
function restart(){ resetState(); setInfl(0); roleSelect(); }        // «ЩЕ РАЗ, ІНША РОЛЬ»
function restartToModes(){ resetState(); setInfl(0); modeSelect(); }  // «ДО РЕЖИМІВ»

/* =====================================================================
   11. PACK-РЕЖИМ (Червона команда)
   Операцію зібрав інший гравець у creator.html і передав посиланням
   ?pack=<base64>. Без сервера. Валідний pack = кампанія з однієї операції:
   без інтро й мапи, одразу бріфінг → операція → PvP-звіт.
   ===================================================================== */
let packMode = false;
/** Декодує і валідує pack за схемою операції. Кидає помилку на невалідних даних. */
function decodePack(raw){
  // UTF-8-safe base64: escape() тримає кирилицю байт-у-байт, без роздування,
  // яке дав би голий decodeURIComponent(atob()).
  const sc = JSON.parse(decodeURIComponent(escape(atob(raw))));
  const str = v => typeof v==='string' && v.length>0;
  const okMsg = m => m && str(m.a) && str(m.t) && str(m.m) && str(m.v)
      && typeof m.h==='boolean' && m.osint && str(m.osint.created)
      && Array.isArray(m.osint.oldPosts);
  const okOpts = (a,flag) => Array.isArray(a) && a.length>=2
      && a.every(o=>o && str(o.n) && str(o.e)) && a.some(o=>o[flag]===true);
  if(!(sc && str(sc.title) && str(sc.brief) && str(sc.debrief) && str(sc.node)
      && str(sc.tech) && str(sc.badge) && typeof sc.attack==='number'
      && sc.map && typeof sc.map.x==='number' && typeof sc.map.y==='number'
      && Array.isArray(sc.feed) && sc.feed.length && sc.feed.every(okMsg) && sc.feed.some(m=>m.h)
      && sc.techniques && str(sc.techniques.q) && okOpts(sc.techniques.opts,'ok')
      && sc.counters && str(sc.counters.q) && okOpts(sc.counters.opts,'best')))
    throw new Error('bad pack schema');
  return sc;
}
/** Вхід у pack-режим: підміняє SCENARIOS однією операцією і одразу відкриває бріфінг. */
function bootPack(raw){
  let sc; try{ sc = decodePack(raw); }catch(e){ brokenPack(); return; }
  packMode = true; introSeen = true; tutorialDone = true;   // без інтро й туторіалу
  SCENARIOS.length = 0; SCENARIOS.push(sc);                 // кампанія з однієї операції
  S.role = ROLES[1];                                        // стандартний темп для чесного порівняння гравців
  document.getElementById('topbar').style.display = 'block';
  hud(); SFX.startAmbient();
  startScenario(true);   // вузловий перехід «вхід у гру» без тайтла і катсцени
}
/** Екран помилки, якщо pack не пройшов схему. */
function brokenPack(){
  packMode = false;
  document.getElementById('topbar').style.display = 'none';
  render(`
    <div style="padding-top:8vh;text-align:center">
      <div class="eyebrow" style="color:var(--hostile)">${t('brokenPackTitle')}</div>
      <h2>${t('brokenPackH2')}</h2>
      <p class="lead" style="max-width:440px;margin:0 auto 20px">${t('brokenPackText')}</p>
      <button class="btn" onclick="goStandard()">${t('toStandardGame')}</button>
    </div>`);
}
/** Вихід із pack-режиму у звичайну гру: прибрати ?pack= з URL і перезавантажити. */
function goStandard(){ history.replaceState(null,'',location.pathname); location.reload(); }
/** Анімація PvP-звіту: рядки виринають по черзі, потім «удар печаткою» на вердикті. */
function playPvpReport(root){
  const rows = root.querySelectorAll('.stat');
  const stamp = root.querySelector('.rank');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  rows.forEach((r,i)=>{
    r.classList.remove('on');
    void r.offsetWidth;
    setTimeout(()=>r.classList.add('on'), reduced?0:120+i*180);
  });
  setTimeout(()=>{
    stamp.classList.remove('hit');
    void stamp.offsetWidth;
    stamp.classList.add('hit');
  }, reduced?0:120+rows.length*180+120);
}
/** PvP-звіт замість фіналу кампанії: чи «пробив» захист автор операції. */
function packFinale(){
  document.body.classList.remove('boss-mode');
  const sc = SCENARIOS[0], rec = S._recognized || [];
  const rows = rec.map(r=>({tech:(S.feed[r.idx].subtype||sc.tech), found:r.found}));
  const hit = rows.filter(r=>r.found).length;
  const breached = hit < rows.length || !!(S._op && S._op.false>0);
  render(`
    <div class="pvp-report" style="padding-top:3vh;text-align:center">
      <div class="eyebrow">${t('pvpTitle')}</div>
      <h2>${t('pvpH2')}</h2>
      <div class="rank ${breached?'low':'gold'}">${breached?t('pvpBreached'):t('pvpHeld')}</div>
      <p class="lead" style="max-width:440px;margin:0 auto 18px">${breached ? t('pvpBreachedText') : t('pvpHeldText')}</p>
      <div class="card" style="text-align:left">
        <div class="narr-label" style="margin-bottom:10px">${t('pvpTechLabel')}</div>
        ${rows.map(r=>`<div class="stat"><span>${r.tech}</span><span class="v ${r.found?'good':'bad'}">${r.found?t('pvpFoundMark'):t('pvpMissedMark')}</span></div>`).join('')}
        <div class="stat"><span>${t('pvpTechAnalysis')}</span><span class="v ${S._techOK?'good':'bad'}">${S._techOK?t('correctMark'):t('wrongMark')}</span></div>
        <div class="stat"><span>${t('pvpFinalResilience')}</span><span class="v">${S.infl} / 100</span></div>
      </div>
      ${ENABLE_CREATOR ? `<button class="btn" onclick="location.href='creator.html'">${t('createYourOp')}</button>` : ''}
      <button class="btn ghost" onclick="goStandard()">${t('toStandardGameNoArrow')}</button>
    </div>`, true);   // pack-режим: вузлова точка "фінальний звіт"
  playPvpReport(document.querySelector('.pvp-report'));
}

/* =====================================================================
   12. БУТ
   Заставка «ІПСОМНІЯ» (#ipso-boot) є самодостатнім HTML+CSS+JS-блоком на
   початку index.html з власним таймінгом і скіпом; її inline-скрипт
   виконується ще до завантаження цього файлу. Коли заставка закінчується,
   вона кидає подію 'ipso:intro-done', і лише тоді стартує сама гра.
   ===================================================================== */
/** Перший екран гри: pack-режим, якщо в URL є ?pack=, інакше екран режимів. */
window.ipsoIntroDone = function(){
  const packRaw = new URLSearchParams(location.search).get('pack');
  if(packRaw){ bootPack(packRaw); } else { modeSelect(); }
};

hud();
setInfl(0);
document.documentElement.lang = LANG;
// Плаваючі кнопки фідбеку і мови створюються раз, живуть поза #app і переживають усі render().
if(SHOW_FEEDBACK_BTN) document.body.insertAdjacentHTML('beforeend', '<a id="feedbackFab" class="feedback-fab btn--feedback" href="'+FEEDBACK_URL+'" target="_blank" rel="noopener" title="'+t('leaveFeedback')+'">'+t('feedbackFabLabel')+'</a>');
document.body.insertAdjacentHTML('beforeend', '<button id="langFab" class="lang-fab" onclick="toggleLang()"></button>');
syncStaticLangUI();
updateLangFab();
// Якщо #ipso-boot з якоїсь причини нема в розмітці, подія ніколи не прийде:
// стартуємо одразу, щоб гра не висіла.
if(document.getElementById('ipso-boot')){
  document.addEventListener('ipso:intro-done', window.ipsoIntroDone, { once:true });
} else {
  window.ipsoIntroDone();
}
