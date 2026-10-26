/* Every user-facing string, one object per language. {name} placeholders are filled by t().
   The questions themselves are translated inside questions.json. */

export const LANGS = ['en', 'cs', 'sk'];
export const LANG_LABELS = { en: 'EN', cs: 'CZ', sk: 'SK' };

export const STRINGS = {
  en: {
    docTitle: 'Estimate · Martin Bezak',
    appTitle: 'Estimate',
    // The game page's own intro (title, lede, rules)
    pageEyebrow: 'Game 01',
    pageTitle: ['Estimate', 'it.'],
    pageLede: '750 questions on economics and finance, from Cournot and CAPM to Czech inflation and Nvidia’s revenue. Type one number. The closer you get, the more points.',
    pageRules: [
      'Type your best guess. 5k, 2.3m and 1.2bn all work.',
      'Up to 100 points a question: 10% off still gets 92, twice too high or half too low gets 49, 10× off gets 0. Years: 10 years off gets 64.',
      'Daily: 5 random questions, the same for everyone. Share your score.'
    ],
    langLabel: 'Language',
    loading: 'Loading questions…',
    loadError: 'The questions could not be loaded. A file opened straight from the disk can’t load them, so open the game through a local server or the live site.',
    noscript: 'This game needs JavaScript.',

    intro: 'Type one number. The closer you are to the true answer, the more points.',
    dailyTitle: 'Daily #{n}',
    dailyDesc: '5 questions, the same for everyone today.',
    dailyStart: 'Play the daily',
    dailyContinue: 'Continue the daily ({i}/5)',
    dailyDone: 'Done for today: {score}/500. New questions tomorrow.',
    dailyShow: 'Show my result',
    endlessTitle: 'Endless',
    endlessDesc: 'Random questions until the bank runs out.',
    endlessStats: '{n} answered · average {avg} · streak {streak}',
    endlessStart: 'Play endless',
    endlessContinue: 'Continue endless',

    calibTitle: 'Your record',
    calib: 'Average over {n} answers. {close} of them were close ({min}+ points).',
    calibNone: 'No answers yet.',

    themeToLight: 'Light theme',
    themeToDark: 'Dark theme',
    backToGames: '← All games',

    modeDaily: 'Daily #{n}',
    modeEndless: 'Endless',
    progress: 'Question {i} of {n}',
    endlessMeta: 'Average {avg} · Streak {streak}',
    menu: 'Menu',
    switchEndless: 'Play endless instead →',
    diff: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    levelLabel: 'Difficulty',
    levels: { all: 'Mix', easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    chooseTitle: 'Choose a game',
    dailyMixTag: 'Mix',
    dailyMixDesc: '5 random questions of any difficulty. The same for everyone today.',
    endlessPick: 'Endless: pick a level',
    left: '{n} left',
    inProgress: 'In progress →',
    endGame: 'End game & see score',
    endTitle: 'Endless game over',
    endAvg: 'average points per question',
    statAnswered: 'Answered', statTotal: 'Total points', statHits: 'Close (50+)', statBest: 'Best streak',
    endNone: 'No questions were answered in this game.',
    newGame: 'New endless game',
    shareEndless: 'Estimation · endless · {n} answered · average {avg}/100',
    logoLabel: 'Back to the menu',
    logoLabelSite: 'Back to the Games page',
    feedbackLink: 'Found a bug or have an idea? Tell me →',
    skip: 'Skip this question →',
    skipNote: 'Doesn’t count toward your score or streak. Skipped questions come back at the end.',
    switchNote: 'Your daily stays saved, so you can finish it later today.',
    unit: 'Answer in {unit}',
    unitYear: 'Answer with a year',

    guessLabel: 'Your guess',
    placeholder: 'e.g. 5k, 2.3m',
    suffixHint: 'Add to your number:',
    suffixes: [['k', 'k'], ['m', 'm'], ['bn', 'bn'], ['t', 't']],
    parsedEmpty: ' ',
    parsedInvalid: 'not a number',
    errEmpty: 'Type a number first.',
    errInvalid: 'That number can’t be read. Try 5k, 2.3m or 1 200.',
    errPositive: 'The number must be above zero.',
    submit: 'Check',

    answer: 'Answer',
    offExact: 'Spot on', offHigh: '{amount} too high', offLow: '{amount} too low',
    offLate: '{n} {years} too late', offEarly: '{n} {years} too early', offHighX: '{amount} too high', offLowX: '{amount} too low',
    yearWords: ['year', 'years', 'years'],
    points: '{n} points',
    yourGuess: 'Your guess: {guess}',
    logScale: 'log scale',
    linearScale: 'years',
    source: 'Source: {name}',
    asOf: 'Figure for {year}',
    next: 'Next question',
    seeResults: 'See results',

    resultsTitle: 'Daily #{n} done',
    shareLine: 'Estimation #{n} — {score}/500',
    copy: 'Copy result',
    copied: 'Copied',
    copyFailed: 'Copy didn’t work. Select the text above instead.',
    playEndless: 'Play endless',
    bankDone: 'You’ve seen all {n} questions.',
    restart: 'Start over',

    categories: {
      theory: 'Economic theory', corpfin: 'Corporate finance', markets: 'Markets', macro: 'Macro & central banks',
      companies: 'Companies', history: 'Financial history', czsk: 'Czech & Slovak economy', fermi: 'Money estimates'
    },
  },

  cs: {
    docTitle: 'Odhad · Martin Bezák',
    appTitle: 'Odhad',
    pageEyebrow: 'Hra 01',
    pageTitle: ['Odhadni', 'to.'],
    pageLede: '750 otázek z ekonomie a financí, od Cournota a CAPM po českou inflaci a tržby Nvidie. Napiš jedno číslo. Čím blíž, tím víc bodů.',
    pageRules: [
      'Napiš svůj nejlepší odhad. Funguje i 5 tis., 2,3 mil. nebo 1,2 mld.',
      'Až 100 bodů za otázku: o 10 % vedle je pořád 92, dvakrát víc nebo polovina je 49, 10× vedle je 0. Roky: o 10 let vedle je 64.',
      'Denní hra: 5 náhodných otázek, pro všechny stejných. Výsledek můžeš sdílet.'
    ],
    langLabel: 'Jazyk',
    loading: 'Načítám otázky…',
    loadError: 'Otázky se nepodařilo načíst. Soubor otevřený přímo z disku je načíst nedokáže, otevři hru přes místní server nebo na webu.',
    noscript: 'Tahle hra potřebuje JavaScript.',

    intro: 'Napiš jedno číslo. Čím blíž jsi správné odpovědi, tím víc bodů.',
    dailyTitle: 'Denní #{n}',
    dailyDesc: '5 otázek, dnes stejných pro všechny.',
    dailyStart: 'Hrát denní hru',
    dailyContinue: 'Pokračovat v denní hře ({i}/5)',
    dailyDone: 'Pro dnešek hotovo: {score}/500. Nové otázky zítra.',
    dailyShow: 'Ukázat můj výsledek',
    endlessTitle: 'Nekonečná',
    endlessDesc: 'Náhodné otázky, dokud nedojdou.',
    endlessStats: 'zodpovězeno {n} · průměr {avg} · série {streak}',
    endlessStart: 'Hrát nekonečnou',
    endlessContinue: 'Pokračovat v nekonečné',

    calibTitle: 'Tvoje bilance',
    calib: 'Průměr z {n} odpovědí. Blízko ({min}+ bodů) jsi byl(a) {close}×.',
    calibNone: 'Zatím žádné odpovědi.',

    themeToLight: 'Světlý režim',
    themeToDark: 'Tmavý režim',
    backToGames: '← Všechny hry',

    modeDaily: 'Denní #{n}',
    modeEndless: 'Nekonečná',
    progress: 'Otázka {i} z {n}',
    endlessMeta: 'Průměr {avg} · Série {streak}',
    menu: 'Nabídka',
    switchEndless: 'Radši hrát nekonečnou →',
    diff: { easy: 'Lehká', medium: 'Střední', hard: 'Těžká' },
    levelLabel: 'Obtížnost',
    levels: { all: 'Mix', easy: 'Lehká', medium: 'Střední', hard: 'Těžká' },
    chooseTitle: 'Vyber si hru',
    dailyMixTag: 'Mix',
    dailyMixDesc: '5 náhodných otázek jakékoli obtížnosti. Dnes stejné pro všechny.',
    endlessPick: 'Nekonečná: vyber obtížnost',
    left: 'zbývá {n}',
    inProgress: 'Rozehráno →',
    endGame: 'Ukončit hru a zobrazit skóre',
    endTitle: 'Konec nekonečné hry',
    endAvg: 'průměr bodů na otázku',
    statAnswered: 'Zodpovězeno', statTotal: 'Body celkem', statHits: 'Blízko (50+)', statBest: 'Nejdelší série',
    endNone: 'V této hře nepadla žádná odpověď.',
    newGame: 'Nová nekonečná hra',
    shareEndless: 'Odhad · nekonečná hra · zodpovězeno {n} · průměr {avg}/100',
    logoLabel: 'Zpět do nabídky',
    logoLabelSite: 'Zpět na stránku Hry',
    feedbackLink: 'Chyba nebo nápad? Napiš mi →',
    skip: 'Přeskočit otázku →',
    skipNote: 'Nepočítá se do skóre ani série. Přeskočené otázky se vrátí na konci.',
    switchNote: 'Denní hra zůstane uložená, dohraješ ji později během dne.',
    unit: 'Odpověď v jednotkách: {unit}',
    unitYear: 'Odpověz rokem',

    guessLabel: 'Tvůj odhad',
    placeholder: 'např. 5 tis., 2,3 mil.',
    suffixHint: 'Přidat k číslu:',
    suffixes: [['tis.', 'tis.'], ['mil.', 'mil.'], ['mld.', 'mld.'], ['bil.', 'bil.']],
    parsedEmpty: ' ',
    parsedInvalid: 'není číslo',
    errEmpty: 'Nejdřív napiš číslo.',
    errInvalid: 'Tohle číslo nejde přečíst. Zkus 5 tis., 2,3 mil. nebo 1 200.',
    errPositive: 'Číslo musí být větší než nula.',
    submit: 'Vyhodnotit',

    answer: 'Odpověď',
    offExact: 'Přesně', offHigh: 'o {amount} víc', offLow: 'o {amount} míň',
    offLate: 'o {n} {years} později', offEarly: 'o {n} {years} dřív', offHighX: '{amount} víc', offLowX: '{amount} míň',
    yearWords: ['rok', 'roky', 'let'],
    points: '{n} bodů',
    yourGuess: 'Tvůj odhad: {guess}',
    logScale: 'logaritmická škála',
    linearScale: 'roky',
    source: 'Zdroj: {name}',
    asOf: 'Údaj za rok {year}',
    next: 'Další otázka',
    seeResults: 'Zobrazit výsledek',

    resultsTitle: 'Denní #{n} dokončena',
    shareLine: 'Odhad #{n} — {score}/500',
    copy: 'Kopírovat výsledek',
    copied: 'Zkopírováno',
    copyFailed: 'Kopírování nevyšlo. Označ text výše ručně.',
    playEndless: 'Hrát nekonečnou',
    bankDone: 'Všech {n} otázek máš za sebou.',
    restart: 'Začít znovu',

    categories: {
      theory: 'Ekonomická teorie', corpfin: 'Podnikové finance', markets: 'Trhy', macro: 'Makro a centrální banky',
      companies: 'Firmy', history: 'Finanční historie', czsk: 'Česká a slovenská ekonomika', fermi: 'Odhady s penězi'
    }
  },

  sk: {
    docTitle: 'Odhad · Martin Bezák',
    appTitle: 'Odhad',
    pageEyebrow: 'Hra 01',
    pageTitle: ['Odhadni', 'to.'],
    pageLede: '750 otázok z ekonómie a financií, od Cournota a CAPM po českú infláciu a tržby Nvidie. Napíš jedno číslo. Čím bližšie, tým viac bodov.',
    pageRules: [
      'Napíš svoj najlepší odhad. Funguje aj 5 tis., 2,3 mil. alebo 1,2 mld.',
      'Až 100 bodov za otázku: o 10 % vedľa je stále 92, dvakrát viac alebo polovica je 49, 10× vedľa je 0. Roky: o 10 rokov vedľa je 64.',
      'Denná hra: 5 náhodných otázok, pre všetkých rovnakých. Výsledok môžeš zdieľať.'
    ],
    langLabel: 'Jazyk',
    loading: 'Načítavam otázky…',
    loadError: 'Otázky sa nepodarilo načítať. Súbor otvorený priamo z disku ich načítať nevie, otvor hru cez lokálny server alebo na webe.',
    noscript: 'Táto hra potrebuje JavaScript.',

    intro: 'Napíš jedno číslo. Čím bližšie si k správnej odpovedi, tým viac bodov.',
    dailyTitle: 'Denná #{n}',
    dailyDesc: '5 otázok, dnes rovnakých pre všetkých.',
    dailyStart: 'Hrať dennú hru',
    dailyContinue: 'Pokračovať v dennej hre ({i}/5)',
    dailyDone: 'Na dnes hotovo: {score}/500. Nové otázky zajtra.',
    dailyShow: 'Ukázať môj výsledok',
    endlessTitle: 'Nekonečná',
    endlessDesc: 'Náhodné otázky, kým sa neminú.',
    endlessStats: 'zodpovedané {n} · priemer {avg} · séria {streak}',
    endlessStart: 'Hrať nekonečnú',
    endlessContinue: 'Pokračovať v nekonečnej',

    calibTitle: 'Tvoja bilancia',
    calib: 'Priemer z {n} odpovedí. Blízko ({min}+ bodov) si bol(a) {close}×.',
    calibNone: 'Zatiaľ žiadne odpovede.',

    themeToLight: 'Svetlý režim',
    themeToDark: 'Tmavý režim',
    backToGames: '← Všetky hry',

    modeDaily: 'Denná #{n}',
    modeEndless: 'Nekonečná',
    progress: 'Otázka {i} z {n}',
    endlessMeta: 'Priemer {avg} · Séria {streak}',
    menu: 'Ponuka',
    switchEndless: 'Radšej hrať nekonečnú →',
    diff: { easy: 'Ľahká', medium: 'Stredná', hard: 'Ťažká' },
    levelLabel: 'Náročnosť',
    levels: { all: 'Mix', easy: 'Ľahká', medium: 'Stredná', hard: 'Ťažká' },
    chooseTitle: 'Vyber si hru',
    dailyMixTag: 'Mix',
    dailyMixDesc: '5 náhodných otázok akejkoľvek náročnosti. Dnes rovnaké pre všetkých.',
    endlessPick: 'Nekonečná: vyber náročnosť',
    left: 'zostáva {n}',
    inProgress: 'Rozohrané →',
    endGame: 'Ukončiť hru a zobraziť skóre',
    endTitle: 'Koniec nekonečnej hry',
    endAvg: 'priemer bodov na otázku',
    statAnswered: 'Zodpovedané', statTotal: 'Body spolu', statHits: 'Blízko (50+)', statBest: 'Najdlhšia séria',
    endNone: 'V tejto hre nepadla žiadna odpoveď.',
    newGame: 'Nová nekonečná hra',
    shareEndless: 'Odhad · nekonečná hra · zodpovedané {n} · priemer {avg}/100',
    logoLabel: 'Späť do ponuky',
    logoLabelSite: 'Späť na stránku Hry',
    feedbackLink: 'Chyba alebo nápad? Napíš mi →',
    skip: 'Preskočiť otázku →',
    skipNote: 'Nepočíta sa do skóre ani série. Preskočené otázky sa vrátia na konci.',
    switchNote: 'Denná hra zostane uložená, dohráš ju neskôr počas dňa.',
    unit: 'Odpoveď v jednotkách: {unit}',
    unitYear: 'Odpovedz rokom',

    guessLabel: 'Tvoj odhad',
    placeholder: 'napr. 5 tis., 2,3 mil.',
    suffixHint: 'Pridať k číslu:',
    suffixes: [['tis.', 'tis.'], ['mil.', 'mil.'], ['mld.', 'mld.'], ['bil.', 'bil.']],
    parsedEmpty: ' ',
    parsedInvalid: 'nie je číslo',
    errEmpty: 'Najprv napíš číslo.',
    errInvalid: 'Toto číslo sa nedá prečítať. Skús 5 tis., 2,3 mil. alebo 1 200.',
    errPositive: 'Číslo musí byť väčšie ako nula.',
    submit: 'Vyhodnotiť',

    answer: 'Odpoveď',
    offExact: 'Presne', offHigh: 'o {amount} viac', offLow: 'o {amount} menej',
    offLate: 'o {n} {years} neskôr', offEarly: 'o {n} {years} skôr', offHighX: '{amount} viac', offLowX: '{amount} menej',
    yearWords: ['rok', 'roky', 'rokov'],
    points: '{n} bodov',
    yourGuess: 'Tvoj odhad: {guess}',
    logScale: 'logaritmická škála',
    linearScale: 'roky',
    source: 'Zdroj: {name}',
    asOf: 'Údaj za rok {year}',
    next: 'Ďalšia otázka',
    seeResults: 'Zobraziť výsledok',

    resultsTitle: 'Denná #{n} dokončená',
    shareLine: 'Odhad #{n} — {score}/500',
    copy: 'Kopírovať výsledok',
    copied: 'Skopírované',
    copyFailed: 'Kopírovanie nevyšlo. Označ text vyššie ručne.',
    playEndless: 'Hrať nekonečnú',
    bankDone: 'Všetkých {n} otázok máš za sebou.',
    restart: 'Začať odznova',

    categories: {
      theory: 'Ekonomická teória', corpfin: 'Podnikové financie', markets: 'Trhy', macro: 'Makro a centrálne banky',
      companies: 'Firmy', history: 'Finančná história', czsk: 'Česká a slovenská ekonomika', fermi: 'Odhady s peniazmi'
    }
  }
};

/** Pick the starting language: ?lang= from the link (e.g. from the Czech Games page), then the saved choice,
    then the browser, then English. */
export function initialLang(saved) {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(fromUrl)) return fromUrl;
  } catch (e) {}
  if (LANGS.includes(saved)) return saved;
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(browser) ? browser : 'en';
}

/** Fill {placeholders}. */
export function fill(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
