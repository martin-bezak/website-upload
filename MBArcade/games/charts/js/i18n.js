/* Every user-facing string of the chart game, one object per language. {name} placeholders are filled by fill().
   Pattern names, explanations and target rules live here too. */

export const LANGS = ['en', 'cs', 'sk'];
export const LANG_LABELS = { en: 'EN', cs: 'CZ', sk: 'SK' };
export const PATTERNS = ['head_shoulders', 'inverse_head_shoulders', 'double_top', 'double_bottom', 'bull_flag', 'bear_flag',
  'ascending_triangle', 'descending_triangle', 'symmetrical_triangle', 'cup_handle'];

export const STRINGS = {
  en: {
    docTitle: 'Chart it · Martin Bezak',
    title: ['Chart', 'it.'],
    langLabel: 'Language', logoLabel: 'Back to the menu', logoLabelSite: 'Back to the Games page',
    loading: 'Loading charts…',
    loadError: 'The charts could not be loaded. A file opened straight from the disk can’t load them, so open the game through a local server or the live site.',
    pageEyebrow: 'Game 02',
    pageLede: 'A real stock chart stops right where a classic pattern completes. Draw where you think the price goes next, then see the textbook projection and what really happened.',
    pageRules: [
      'Draw the next 30 trading days with your mouse or finger.',
      'You score against what really happened, not against the textbook. Up to 100 points: 30 for the direction, 35 for where it ends, 35 for the shape. A wrong direction costs you most of the points.',
      'You also see how many points you’d have got if the textbook had been right. It is wrong more often than you’d think.'
    ],
    backToGames: '← All games',
    disclaimer: 'For education and fun only. Not investment advice. Past patterns don’t guarantee future results.',

    chooseTitle: 'Choose a mode',
    modes: {
      learn: ['Learn', 'The pattern is named and drawn for you, with the textbook target as an optional hint.'],
      blind: ['Blind', 'No hints. Name the pattern first (+10 points), then draw.'],
      daily: ['Daily #{n}', '5 charts, the same for everyone today, one of each of five patterns.']
    },
    play: 'Play →', continue: 'Continue →',
    dailyDone: 'Done for today: {score}/500. New charts tomorrow.', dailyShow: 'Show my result',
    statsBtn: 'Stats', libraryBtn: 'Pattern library',
    themeToLight: 'Light theme', themeToDark: 'Dark theme',
    feedbackLink: 'Found a bug or have an idea? Tell me →',

    menu: 'Menu', progress: 'Chart {i} of {n}',
    whatPattern: 'Which pattern is this?', step: 'Step {i} of {n}', stepName: 'Which pattern is this?', stepNameSub: 'Pick one of the four names under the chart. A right answer is worth +10 points.', stepDraw: 'Now draw where the price goes next', drawHere: 'DRAW\nHERE',  quizRight: 'Right! +10 points', quizWrong: 'Not quite: it’s a {name}.',
    drawHint: 'Draw the next 30 days in the shaded area →', drawHintTouch: 'Draw the next 30 days in the shaded area with your finger',
    undo: 'Undo', clear: 'Clear', submit: 'Reveal', hintToggle: 'Textbook hint', covered: '{pct} of the zone drawn',
    needMore: 'Draw across at least half of the zone',
    you: 'You', textbook: 'Textbook', real: 'Real',
    vs: 'Scored on reality · the textbook line itself got {tb}', expected: 'If the textbook had been right: {exp}/100', bonus: '+{n} for the pattern',
    parts: 'Direction {d}/30 · End {t}/35 · Shape {s}/35',
    outcome: { hit: 'Target hit', failed: 'Failed', partial: 'Partial' },
    happened: {
      hit: 'Here the price reached the textbook target on day {day}.',
      failed: 'Here it hit the invalidation level on day {day} instead, so the pattern failed.',
      partial: 'Here neither happened within 30 days: it got {pct} of the way to the target.'
    },
    revealWho: '{name} ({ticker}) · {from} – {to}',
    next: 'Next chart', seeResults: 'See results',

    resultsTitle: 'Daily #{n} done', shareLine: 'Chart Game #{n} — {score}/500',
    copy: 'Copy result', copied: 'Copied', copyFailed: 'Copy didn’t work. Select the text above instead.',

    statsTitle: 'Your stats', statPlayed: 'Charts played', statAvg: 'Average score', statBest: 'Best streak', statBeat: 'Beat the textbook',
    streakNote: 'A streak counts charts in a row where you got the direction right.',
    perPattern: 'By pattern', colSeen: 'Seen', colTextbook: 'Textbook right', colYou: 'Your average',
    dataLine: 'Across all {n} charts in this game, {pattern} hit its target {pct} of the time.',
    noStats: 'Play a chart to see your stats.',

    libraryTitle: 'Pattern library', locked: 'Play a chart with this pattern to unlock it.', targetRule: 'Target', hitRate: 'In this game: hit its target in {pct} of {n} charts',
    up: 'Bullish', down: 'Bearish', both: 'Either way',

    names: {
      head_shoulders: 'Head and shoulders', inverse_head_shoulders: 'Inverse head and shoulders', double_top: 'Double top',
      double_bottom: 'Double bottom', bull_flag: 'Bull flag', bear_flag: 'Bear flag', ascending_triangle: 'Ascending triangle',
      descending_triangle: 'Descending triangle', symmetrical_triangle: 'Symmetrical triangle', cup_handle: 'Cup and handle'
    },
    explain: {
      head_shoulders: 'Three peaks after a rise, the middle one highest. When the price closes below the neckline that joins the two dips, buyers are thought to be exhausted.',
      inverse_head_shoulders: 'Three dips after a fall, the middle one lowest. A close above the neckline suggests the sellers are done.',
      double_top: 'Two peaks at about the same level with a dip between them. Breaking below the dip says the price was rejected twice.',
      double_bottom: 'Two lows at about the same level with a bounce between them. Breaking above the bounce says the low held twice.',
      bull_flag: 'A sharp rise (the pole) followed by a short, slightly falling pause (the flag). The breakout up is read as the rise continuing.',
      bear_flag: 'A sharp fall followed by a short, slightly rising pause. The break down is read as the fall continuing.',
      ascending_triangle: 'A flat ceiling with rising lows. Buyers keep stepping in higher until the ceiling breaks.',
      descending_triangle: 'A flat floor with falling highs. Sellers keep pushing lower until the floor breaks.',
      symmetrical_triangle: 'Lower highs and higher lows squeezing together. The textbook follows whichever side breaks.',
      cup_handle: 'A rounded dip (the cup) and a small pullback (the handle) below an old high. A close above the rim is read as a fresh leg up.'
    },
    rule: {
      head_shoulders: 'Neckline − (head − neckline)', inverse_head_shoulders: 'Neckline + (neckline − head)',
      double_top: 'Neckline − (peak − neckline)', double_bottom: 'Neckline + (neckline − trough)',
      bull_flag: 'Breakout + pole height', bear_flag: 'Breakout − pole height',
      ascending_triangle: 'Breakout + triangle height', descending_triangle: 'Breakout − triangle height',
      symmetrical_triangle: 'Breakout ± triangle height', cup_handle: 'Rim + cup depth'
    }
  },

  cs: {
    docTitle: 'Nakresli to · Martin Bezák',
    title: ['Nakresli', 'to.'],
    langLabel: 'Jazyk', logoLabel: 'Zpět do nabídky', logoLabelSite: 'Zpět na stránku Hry',
    loading: 'Načítám grafy…',
    loadError: 'Grafy se nepodařilo načíst. Soubor otevřený přímo z disku je načíst nedokáže, otevři hru přes místní server nebo na webu.',
    pageEyebrow: 'Hra 02',
    pageLede: 'Skutečný graf akcie končí přesně ve chvíli, kdy se dokončí klasická formace. Nakresli, kam podle tebe cena půjde dál, a pak uvidíš učebnicovou projekci i to, co se opravdu stalo.',
    pageRules: [
      'Nakresli myší nebo prstem dalších 30 obchodních dní.',
      'Body dostáváš podle toho, co se opravdu stalo, ne podle učebnice. Až 100 bodů: 30 za směr, 35 za to, kde graf skončí, a 35 za tvar. Špatný směr tě připraví o většinu bodů.',
      'Uvidíš i to, kolik bodů bys měl(a), kdyby učebnice měla pravdu. Mýlí se častěji, než bys čekal(a).'
    ],
    backToGames: '← Všechny hry',
    disclaimer: 'Jen pro vzdělání a zábavu. Nejde o investiční doporučení. Minulé formace nezaručují budoucí výsledky.',

    chooseTitle: 'Vyber si režim',
    modes: {
      learn: ['Učení', 'Formaci uvidíš pojmenovanou a zakreslenou, učebnicový cíl si můžeš zapnout jako nápovědu.'],
      blind: ['Naslepo', 'Bez nápověd. Nejdřív urči formaci (+10 bodů), pak kresli.'],
      daily: ['Denní #{n}', '5 grafů, dnes stejných pro všechny, pět různých formací.']
    },
    play: 'Hrát →', continue: 'Pokračovat →',
    dailyDone: 'Pro dnešek hotovo: {score}/500. Nové grafy zítra.', dailyShow: 'Ukázat můj výsledek',
    statsBtn: 'Statistiky', libraryBtn: 'Knihovna formací',
    themeToLight: 'Světlý režim', themeToDark: 'Tmavý režim',
    feedbackLink: 'Chyba nebo nápad? Napiš mi →',

    menu: 'Nabídka', progress: 'Graf {i} z {n}',
    whatPattern: 'Která formace to je?', step: 'Krok {i} ze {n}', stepName: 'Která formace to je?', stepNameSub: 'Vyber jeden ze čtyř názvů pod grafem. Správná odpověď je za +10 bodů.', stepDraw: 'Teď nakresli, kam cena půjde dál', drawHere: 'KRESLI\nSEM',  quizRight: 'Správně! +10 bodů', quizWrong: 'Tentokrát ne: je to {name}.',
    drawHint: 'Nakresli dalších 30 dní do vystínované oblasti →', drawHintTouch: 'Nakresli prstem dalších 30 dní do vystínované oblasti',
    undo: 'Zpět', clear: 'Smazat', submit: 'Odhalit', hintToggle: 'Učebnicová nápověda', covered: 'nakresleno {pct} oblasti',
    needMore: 'Nakresli aspoň polovinu oblasti',
    you: 'Ty', textbook: 'Učebnice', real: 'Skutečnost',
    vs: 'Body podle skutečnosti · samotná čára učebnice: {tb}', expected: 'Kdyby učebnice měla pravdu: {exp}/100', bonus: '+{n} za formaci',
    parts: 'Směr {d}/30 · Konec {t}/35 · Tvar {s}/35',
    outcome: { hit: 'Cíl splněn', failed: 'Selhala', partial: 'Částečně' },
    happened: {
      hit: 'Tady cena dosáhla učebnicového cíle {day}. den.',
      failed: 'Tady místo toho {day}. den prolomila hranici neplatnosti, takže formace selhala.',
      partial: 'Tady se za 30 dní nestalo ani jedno: cena urazila {pct} cesty k cíli.'
    },
    revealWho: '{name} ({ticker}) · {from} – {to}',
    next: 'Další graf', seeResults: 'Zobrazit výsledek',

    resultsTitle: 'Denní #{n} dokončena', shareLine: 'Hra s grafy #{n} — {score}/500',
    copy: 'Kopírovat výsledek', copied: 'Zkopírováno', copyFailed: 'Kopírování nevyšlo. Označ text výše ručně.',

    statsTitle: 'Tvoje statistiky', statPlayed: 'Odehráno grafů', statAvg: 'Průměrné skóre', statBest: 'Nejdelší série', statBeat: 'Lepší než učebnice',
    streakNote: 'Série počítá grafy po sobě, u kterých jsi trefil(a) směr.',
    perPattern: 'Podle formací', colSeen: 'Viděno', colTextbook: 'Učebnice měla pravdu', colYou: 'Tvůj průměr',
    dataLine: 'Ve všech {n} grafech této hry dosáhla formace {pattern} svého cíle v {pct} případů.',
    noStats: 'Zahraj si graf a uvidíš své statistiky.',

    libraryTitle: 'Knihovna formací', locked: 'Zahraj si graf s touto formací a odemkneš ji.', targetRule: 'Cíl', hitRate: 'V této hře: cíle dosáhla v {pct} z {n} grafů',
    up: 'Býčí', down: 'Medvědí', both: 'Oběma směry',

    names: {
      head_shoulders: 'hlava a ramena', inverse_head_shoulders: 'obrácená hlava a ramena', double_top: 'dvojitý vrchol',
      double_bottom: 'dvojité dno', bull_flag: 'býčí vlajka', bear_flag: 'medvědí vlajka', ascending_triangle: 'rostoucí trojúhelník',
      descending_triangle: 'klesající trojúhelník', symmetrical_triangle: 'symetrický trojúhelník', cup_handle: 'hrnek s uchem'
    },
    explain: {
      head_shoulders: 'Tři vrcholy po růstu, prostřední nejvyšší. Když cena uzavře pod neckline, která spojuje oba propady, kupci jsou podle učebnice vyčerpaní.',
      inverse_head_shoulders: 'Tři propady po poklesu, prostřední nejhlubší. Uzavření nad neckline naznačuje, že prodejci skončili.',
      double_top: 'Dva vrcholy zhruba na stejné úrovni a mezi nimi propad. Prolomení pod tento propad znamená, že cena byla dvakrát odmítnuta.',
      double_bottom: 'Dvě dna zhruba na stejné úrovni a mezi nimi odraz. Prolomení nad odraz říká, že dno dvakrát vydrželo.',
      bull_flag: 'Prudký růst (žerď) a po něm krátká, mírně klesající pauza (vlajka). Průraz nahoru se čte jako pokračování růstu.',
      bear_flag: 'Prudký pád a po něm krátká, mírně rostoucí pauza. Průraz dolů se čte jako pokračování poklesu.',
      ascending_triangle: 'Vodorovný strop a rostoucí dna. Kupci nastupují stále výš, dokud strop nepovolí.',
      descending_triangle: 'Vodorovná podlaha a klesající vrcholy. Prodejci tlačí cenu níž, dokud podlaha nepovolí.',
      symmetrical_triangle: 'Nižší vrcholy a vyšší dna, která se sbíhají. Učebnice jde tím směrem, kterým cena prorazí.',
      cup_handle: 'Zaoblený propad (hrnek) a malý návrat (ucho) pod starým maximem. Uzavření nad okrajem se čte jako nová vlna růstu.'
    },
    rule: {
      head_shoulders: 'Neckline − (hlava − neckline)', inverse_head_shoulders: 'Neckline + (neckline − hlava)',
      double_top: 'Neckline − (vrchol − neckline)', double_bottom: 'Neckline + (neckline − dno)',
      bull_flag: 'Průraz + výška žerdi', bear_flag: 'Průraz − výška žerdi',
      ascending_triangle: 'Průraz + výška trojúhelníku', descending_triangle: 'Průraz − výška trojúhelníku',
      symmetrical_triangle: 'Průraz ± výška trojúhelníku', cup_handle: 'Okraj + hloubka hrnku'
    }
  },

  sk: {
    docTitle: 'Nakresli to · Martin Bezák',
    title: ['Nakresli', 'to.'],
    langLabel: 'Jazyk', logoLabel: 'Späť do ponuky', logoLabelSite: 'Späť na stránku Hry',
    loading: 'Načítavam grafy…',
    loadError: 'Grafy sa nepodarilo načítať. Súbor otvorený priamo z disku ich načítať nevie, otvor hru cez lokálny server alebo na webe.',
    pageEyebrow: 'Hra 02',
    pageLede: 'Skutočný graf akcie končí presne vo chvíli, keď sa dokončí klasická formácia. Nakresli, kam podľa teba pôjde cena ďalej, a potom uvidíš učebnicovú projekciu aj to, čo sa naozaj stalo.',
    pageRules: [
      'Nakresli myšou alebo prstom ďalších 30 obchodných dní.',
      'Body dostávaš podľa toho, čo sa naozaj stalo, nie podľa učebnice. Až 100 bodov: 30 za smer, 35 za to, kde graf skončí, a 35 za tvar. Zlý smer ťa pripraví o väčšinu bodov.',
      'Uvidíš aj to, koľko bodov by si mal(a), keby mala učebnica pravdu. Mýli sa častejšie, než by si čakal(a).'
    ],
    backToGames: '← Všetky hry',
    disclaimer: 'Len na vzdelávanie a zábavu. Nejde o investičné odporúčanie. Minulé formácie nezaručujú budúce výsledky.',

    chooseTitle: 'Vyber si režim',
    modes: {
      learn: ['Učenie', 'Formáciu uvidíš pomenovanú a zakreslenú, učebnicový cieľ si môžeš zapnúť ako nápovedu.'],
      blind: ['Naslepo', 'Bez nápovied. Najprv urči formáciu (+10 bodov), potom kresli.'],
      daily: ['Denná #{n}', '5 grafov, dnes rovnakých pre všetkých, päť rôznych formácií.']
    },
    play: 'Hrať →', continue: 'Pokračovať →',
    dailyDone: 'Na dnes hotovo: {score}/500. Nové grafy zajtra.', dailyShow: 'Ukázať môj výsledok',
    statsBtn: 'Štatistiky', libraryBtn: 'Knižnica formácií',
    themeToLight: 'Svetlý režim', themeToDark: 'Tmavý režim',
    feedbackLink: 'Chyba alebo nápad? Napíš mi →',

    menu: 'Ponuka', progress: 'Graf {i} z {n}',
    whatPattern: 'Ktorá formácia to je?', step: 'Krok {i} z {n}', stepName: 'Ktorá formácia to je?', stepNameSub: 'Vyber jeden zo štyroch názvov pod grafom. Správna odpoveď je za +10 bodov.', stepDraw: 'Teraz nakresli, kam cena pôjde ďalej', drawHere: 'KRESLI\nSEM',  quizRight: 'Správne! +10 bodov', quizWrong: 'Tentoraz nie: je to {name}.',
    drawHint: 'Nakresli ďalších 30 dní do vytieňovanej oblasti →', drawHintTouch: 'Nakresli prstom ďalších 30 dní do vytieňovanej oblasti',
    undo: 'Späť', clear: 'Zmazať', submit: 'Odhaliť', hintToggle: 'Učebnicová nápoveda', covered: 'nakreslené {pct} oblasti',
    needMore: 'Nakresli aspoň polovicu oblasti',
    you: 'Ty', textbook: 'Učebnica', real: 'Skutočnosť',
    vs: 'Body podľa skutočnosti · samotná čiara učebnice: {tb}', expected: 'Keby mala učebnica pravdu: {exp}/100', bonus: '+{n} za formáciu',
    parts: 'Smer {d}/30 · Koniec {t}/35 · Tvar {s}/35',
    outcome: { hit: 'Cieľ splnený', failed: 'Zlyhala', partial: 'Čiastočne' },
    happened: {
      hit: 'Tu cena dosiahla učebnicový cieľ na {day}. deň.',
      failed: 'Tu namiesto toho na {day}. deň prelomila hranicu neplatnosti, takže formácia zlyhala.',
      partial: 'Tu sa za 30 dní nestalo ani jedno: cena prešla {pct} cesty k cieľu.'
    },
    revealWho: '{name} ({ticker}) · {from} – {to}',
    next: 'Ďalší graf', seeResults: 'Zobraziť výsledok',

    resultsTitle: 'Denná #{n} dokončená', shareLine: 'Hra s grafmi #{n} — {score}/500',
    copy: 'Kopírovať výsledok', copied: 'Skopírované', copyFailed: 'Kopírovanie nevyšlo. Označ text vyššie ručne.',

    statsTitle: 'Tvoje štatistiky', statPlayed: 'Odohraných grafov', statAvg: 'Priemerné skóre', statBest: 'Najdlhšia séria', statBeat: 'Lepší ako učebnica',
    streakNote: 'Séria počíta grafy po sebe, pri ktorých si trafil(a) smer.',
    perPattern: 'Podľa formácií', colSeen: 'Videné', colTextbook: 'Učebnica mala pravdu', colYou: 'Tvoj priemer',
    dataLine: 'Vo všetkých {n} grafoch tejto hry dosiahla formácia {pattern} svoj cieľ v {pct} prípadov.',
    noStats: 'Zahraj si graf a uvidíš svoje štatistiky.',

    libraryTitle: 'Knižnica formácií', locked: 'Zahraj si graf s touto formáciou a odomkneš ju.', targetRule: 'Cieľ', hitRate: 'V tejto hre: cieľ dosiahla v {pct} z {n} grafov',
    up: 'Býčia', down: 'Medvedia', both: 'Oboma smermi',

    names: {
      head_shoulders: 'hlava a plecia', inverse_head_shoulders: 'obrátená hlava a plecia', double_top: 'dvojitý vrchol',
      double_bottom: 'dvojité dno', bull_flag: 'býčia vlajka', bear_flag: 'medvedia vlajka', ascending_triangle: 'stúpajúci trojuholník',
      descending_triangle: 'klesajúci trojuholník', symmetrical_triangle: 'symetrický trojuholník', cup_handle: 'šálka s uchom'
    },
    explain: {
      head_shoulders: 'Tri vrcholy po raste, prostredný najvyšší. Keď cena uzavrie pod neckline, ktorá spája oba prepady, kupci sú podľa učebnice vyčerpaní.',
      inverse_head_shoulders: 'Tri prepady po poklese, prostredný najhlbší. Uzavretie nad neckline naznačuje, že predajcovia skončili.',
      double_top: 'Dva vrcholy zhruba na rovnakej úrovni a medzi nimi prepad. Prelomenie pod tento prepad znamená, že cena bola dvakrát odmietnutá.',
      double_bottom: 'Dve dná zhruba na rovnakej úrovni a medzi nimi odraz. Prelomenie nad odraz hovorí, že dno dvakrát vydržalo.',
      bull_flag: 'Prudký rast (žrď) a po ňom krátka, mierne klesajúca pauza (vlajka). Prieraz nahor sa číta ako pokračovanie rastu.',
      bear_flag: 'Prudký pád a po ňom krátka, mierne stúpajúca pauza. Prieraz nadol sa číta ako pokračovanie poklesu.',
      ascending_triangle: 'Vodorovný strop a stúpajúce dná. Kupci nastupujú stále vyššie, kým strop nepovolí.',
      descending_triangle: 'Vodorovná podlaha a klesajúce vrcholy. Predajcovia tlačia cenu nižšie, kým podlaha nepovolí.',
      symmetrical_triangle: 'Nižšie vrcholy a vyššie dná, ktoré sa zbiehajú. Učebnica ide tým smerom, ktorým cena prerazí.',
      cup_handle: 'Zaoblený prepad (šálka) a malý návrat (ucho) pod starým maximom. Uzavretie nad okrajom sa číta ako nová vlna rastu.'
    },
    rule: {
      head_shoulders: 'Neckline − (hlava − neckline)', inverse_head_shoulders: 'Neckline + (neckline − hlava)',
      double_top: 'Neckline − (vrchol − neckline)', double_bottom: 'Neckline + (neckline − dno)',
      bull_flag: 'Prieraz + výška žrde', bear_flag: 'Prieraz − výška žrde',
      ascending_triangle: 'Prieraz + výška trojuholníka', descending_triangle: 'Prieraz − výška trojuholníka',
      symmetrical_triangle: 'Prieraz ± výška trojuholníka', cup_handle: 'Okraj + hĺbka šálky'
    }
  }
};

/** ?lang= from the link first, then the saved choice, then the browser, then English. */
export function initialLang(saved) {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(fromUrl)) return fromUrl;
  } catch (e) {}
  if (LANGS.includes(saved)) return saved;
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(browser) ? browser : 'en';
}

export function fill(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** 12.5% (en) / 12,5 % (cs, sk), with an explicit + for gains when signed. */
export function pct(value, lang, { signed = false, digits = 1 } = {}) {
  const loc = { en: 'en-US', cs: 'cs-CZ', sk: 'sk-SK' }[lang] || 'en-US';
  const n = new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Math.abs(value));
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  return lang === 'en' ? `${sign}${n}%` : `${sign}${n} %`;
}
