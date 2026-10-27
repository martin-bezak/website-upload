/* Every user-facing string of Sell the top, one object per language. {name} placeholders are filled by fill(). */

export const LANGS = ['en', 'cs', 'sk'];
export const LANG_LABELS = { en: 'EN', cs: 'CZ', sk: 'SK' };
export const FILTERS = ['all', 'stock', 'crypto', 'commodity', 'index'];   // "index" also covers currencies

export const STRINGS = {
  en: {
    docTitle: 'Sell the top · MB Arcade',
    title: ['Sell the', 'top.'],
    langLabel: 'Language',
    loading: 'Loading charts…',
    loadError: 'The charts could not be loaded. A file opened straight from the disk can’t load them, so open the game through a local server or the live site.',
    pageEyebrow: 'Game 03',
    pageLede: 'A real price chart plays one year in 20 seconds. You don’t know what it is. One button: get out or get back in. Beat simply holding on.',
    pageRules: [
      'You start invested. Press Sell (or Space) to get out, press Buy to get back in. As often as you like.',
      'At the end you’re compared with buy-and-hold: someone who bought on day one and never touched it.',
      'Then you find out what you were trading. 1,000 real years of stocks, crypto, gold, oil, indices and currencies.'
    ],
    backToGames: '← All games',
    disclaimer: 'For education and fun only. Not investment advice.',

    chooseTitle: 'Choose a mode',
    dailyName: 'Daily #{n}', dailyDesc: '3 mystery charts, the same for everyone today.',
    dailyDone: 'Done for today: {beat}/3 beat buy-and-hold. New charts tomorrow.', dailyShow: 'Show my result',
    endlessName: 'Endless', endlessDesc: 'One chart after another. Pick a market:',
    filters: { all: 'All', stock: 'Stocks', crypto: 'Crypto', commodity: 'Commodities', index: 'Indices & FX' },
    continue: 'Continue →',
    statsBtn: 'Stats', menu: 'Menu',
    themeToLight: 'Light theme', themeToDark: 'Dark theme',
    feedbackLink: 'Found a bug or have an idea? Tell me →',

    roundOf: 'Chart {i} of {n}', endlessLabel: 'Endless · {f}',
    mystery: 'Mystery chart · {cat}', day: 'Day {d}/{n}',
    cats: { stock: 'stock', crypto: 'coin', commodity: 'commodity', index: 'index', fx: 'currency' },
    you: 'You', hold: 'Buy & hold', trades: 'Trades',
    holding: 'In · holding', cash: 'Out · cash',
    buy: 'Buy', sell: 'Sell',
    ready: 'The grey line is what came just before. You start invested.', go: 'Start',
    keyHint: 'Space = sell / buy', paused: 'Paused while the tab was hidden', resume: 'Resume',
    start: 'Start', top: 'Top',

    beat: 'You beat buy-and-hold by {x}.', lost: 'Buy-and-hold beat you by {x}.', tie: 'You held the whole way: same as buy-and-hold.',
    yourMoney: '100 became {you}. Holding made it {hold}.',
    itWas: 'It was',
    revealWho: '{name} ({ticker})',
    span: '{from} – {to}',
    story: 'The top came on {date}, {up} from the start. By the end it had {fall}.',
    storyFell: 'fallen {x} from there', storyRose: 'stayed near the top',
    included: 'This year included: {list}.',
    next: 'Next chart', seeResults: 'See results',

    resultsTitle: 'Daily #{n} done', beatCount: '{b}/3', beatOf: 'beat buy-and-hold',
    shareHead: 'Sell the top #{n}', shareBeat: '{b}/3 beat buy-and-hold',
    copy: 'Copy result', copied: 'Copied', copyFailed: 'Copy didn’t work. Select the text above instead.',

    statsTitle: 'Your stats', statPlayed: 'Charts played', statBeat: 'Beat buy-and-hold', statBest: 'Best win', statStreak: 'Best streak',
    streakNote: 'A streak counts charts in a row where you beat buy-and-hold.', noStats: 'No charts played yet.',
    byMarket: 'By market', colPlayed: 'Played', colBeat: 'Beaten', colAvg: 'Average vs hold',

    events: {
      crash1929: 'the Wall Street crash of 1929', blackmonday: 'Black Monday (19 Oct 1987)', asia1997: 'the Asian financial crisis (1997)',
      russia1998: 'Russia’s default (Aug 1998)', dotcom: 'the dot-com peak (Mar 2000)', sept11: 'the 9/11 attacks',
      lehman: 'the fall of Lehman Brothers (Sep 2008)', flashcrash: 'the Flash Crash (May 2010)', usdowngrade: 'the US credit downgrade (Aug 2011)',
      snbfloor: 'the Swiss franc floor ending (Jan 2015)', china2015: 'China’s 2015 stock crash', brexit: 'the Brexit vote (Jun 2016)',
      czkfloor: 'the end of the Czech koruna floor (Apr 2017)', btc2017: 'the 2017 Bitcoin peak', covid: 'the Covid crash (Mar 2020)',
      oilnegative: 'oil going below zero (Apr 2020)', gamestop: 'the GameStop squeeze (Jan 2021)', crypto2021: 'the 2021 crypto peak',
      ukraine: 'Russia’s invasion of Ukraine (Feb 2022)', luna: 'the Terra/Luna collapse (May 2022)', ftx: 'the FTX collapse (Nov 2022)',
      chatgpt: 'the launch of ChatGPT (Nov 2022)', svb: 'the Silicon Valley Bank failure (Mar 2023)', halving2024: 'the 2024 Bitcoin halving',
      election2024: 'the 2024 US election', tariffs2025: 'the “Liberation Day” tariffs (Apr 2025)'
    }
  },

  cs: {
    docTitle: 'Prodej na vrcholu · MB Arcade',
    title: ['Prodej na', 'vrcholu.'],
    langLabel: 'Jazyk',
    loading: 'Načítám grafy…',
    loadError: 'Grafy se nepodařilo načíst. Soubor otevřený přímo z disku je načíst nemůže, otevři hru přes lokální server nebo živý web.',
    pageEyebrow: 'Hra 03',
    pageLede: 'Skutečný graf ceny přehraje jeden rok za 20 sekund. Nevíš, co to je. Jedno tlačítko: vystoupit, nebo znovu naskočit. Poraz obyčejné držení.',
    pageRules: [
      'Začínáš zainvestovaný. Tlačítkem Prodat (nebo mezerníkem) vystoupíš, tlačítkem Koupit naskočíš zpátky. Kolikrát chceš.',
      'Na konci se porovnáš s „kup a drž“: s někým, kdo koupil první den a už na nic nesáhl.',
      'Pak se dozvíš, s čím jsi obchodoval. 1 000 skutečných roků akcií, kryptoměn, zlata, ropy, indexů a měn.'
    ],
    backToGames: '← Všechny hry',
    disclaimer: 'Jen pro vzdělání a zábavu. Nejde o investiční doporučení.',

    chooseTitle: 'Vyber režim',
    dailyName: 'Denní #{n}', dailyDesc: '3 tajné grafy, dnes pro všechny stejné.',
    dailyDone: 'Pro dnešek hotovo: {beat}/3 porazily „kup a drž“. Nové grafy zítra.', dailyShow: 'Ukázat výsledek',
    endlessName: 'Nekonečná hra', endlessDesc: 'Jeden graf za druhým. Vyber trh:',
    filters: { all: 'Vše', stock: 'Akcie', crypto: 'Krypto', commodity: 'Komodity', index: 'Indexy a měny' },
    continue: 'Pokračovat →',
    statsBtn: 'Statistiky', menu: 'Menu',
    themeToLight: 'Světlý motiv', themeToDark: 'Tmavý motiv',
    feedbackLink: 'Našel jsi chybu nebo máš nápad? Napiš mi →',

    roundOf: 'Graf {i} z {n}', endlessLabel: 'Nekonečná · {f}',
    mystery: 'Neznámý trh · {cat}', day: 'Den {d}/{n}',
    cats: { stock: 'akcie', crypto: 'kryptoměna', commodity: 'komodita', index: 'index', fx: 'měna' },
    you: 'Ty', hold: 'Kup a drž', trades: 'Obchody',
    holding: 'Uvnitř · držíš', cash: 'Venku · hotovost',
    buy: 'Koupit', sell: 'Prodat',
    ready: 'Šedá čára ukazuje, co bylo těsně předtím. Začínáš zainvestovaný.', go: 'Start',
    keyHint: 'Mezerník = prodat / koupit', paused: 'Pozastaveno, když byla karta skrytá', resume: 'Pokračovat',
    start: 'Start', top: 'Vrchol',

    beat: 'Porazil jsi „kup a drž“ o {x}.', lost: '„Kup a drž“ tě porazilo o {x}.', tie: 'Držel jsi celou dobu: stejně jako „kup a drž“.',
    yourMoney: 'Ze 100 se stalo {you}. Držení z nich udělalo {hold}.',
    itWas: 'Šlo o',
    revealWho: '{name} ({ticker})',
    span: '{from} – {to}',
    story: 'Vrchol přišel {date}, {up} od začátku. Do konce pak cena {fall}.',
    storyFell: 'klesla o {x}', storyRose: 'zůstala blízko vrcholu',
    included: 'Tento rok zahrnoval: {list}.',
    next: 'Další graf', seeResults: 'Výsledky',

    resultsTitle: 'Denní #{n} hotovo', beatCount: '{b}/3', beatOf: 'porazily „kup a drž“',
    shareHead: 'Prodej na vrcholu #{n}', shareBeat: '{b}/3 porazily „kup a drž“',
    copy: 'Kopírovat výsledek', copied: 'Zkopírováno', copyFailed: 'Kopírování nefungovalo. Označ text výše.',

    statsTitle: 'Tvoje statistiky', statPlayed: 'Odehrané grafy', statBeat: 'Porazil „kup a drž“', statBest: 'Nejlepší výhra', statStreak: 'Nejdelší série',
    streakNote: 'Série počítá grafy v řadě, kde jsi porazil „kup a drž“.', noStats: 'Zatím žádné odehrané grafy.',
    byMarket: 'Podle trhu', colPlayed: 'Hráno', colBeat: 'Poraženo', colAvg: 'Průměr vs držení',

    events: {
      crash1929: 'krach na Wall Street v roce 1929', blackmonday: 'černé pondělí (19. 10. 1987)', asia1997: 'asijskou finanční krizi (1997)',
      russia1998: 'bankrot Ruska (srpen 1998)', dotcom: 'vrchol dot-com bubliny (březen 2000)', sept11: 'útoky 11. září',
      lehman: 'pád Lehman Brothers (září 2008)', flashcrash: 'Flash Crash (květen 2010)', usdowngrade: 'snížení ratingu USA (srpen 2011)',
      snbfloor: 'konec minimálního kurzu franku (leden 2015)', china2015: 'propad čínských akcií v roce 2015', brexit: 'referendum o brexitu (červen 2016)',
      czkfloor: 'konec kurzového závazku ČNB (duben 2017)', btc2017: 'vrchol bitcoinu v roce 2017', covid: 'covidový propad (březen 2020)',
      oilnegative: 'ropu pod nulou (duben 2020)', gamestop: 'short squeeze GameStopu (leden 2021)', crypto2021: 'vrchol kryptoměn v roce 2021',
      ukraine: 'ruskou invazi na Ukrajinu (únor 2022)', luna: 'kolaps Terra/Luna (květen 2022)', ftx: 'pád FTX (listopad 2022)',
      chatgpt: 'spuštění ChatGPT (listopad 2022)', svb: 'pád Silicon Valley Bank (březen 2023)', halving2024: 'halving bitcoinu v roce 2024',
      election2024: 'volby v USA 2024', tariffs2025: 'cla „Dne osvobození“ (duben 2025)'
    }
  },

  sk: {
    docTitle: 'Predaj na vrchole · MB Arcade',
    title: ['Predaj na', 'vrchole.'],
    langLabel: 'Jazyk',
    loading: 'Načítavam grafy…',
    loadError: 'Grafy sa nepodarilo načítať. Súbor otvorený priamo z disku ich načítať nemôže, otvor hru cez lokálny server alebo živý web.',
    pageEyebrow: 'Hra 03',
    pageLede: 'Skutočný graf ceny prehrá jeden rok za 20 sekúnd. Nevieš, čo to je. Jedno tlačidlo: vystúpiť, alebo znova naskočiť. Poraz obyčajné držanie.',
    pageRules: [
      'Začínaš zainvestovaný. Tlačidlom Predať (alebo medzerníkom) vystúpiš, tlačidlom Kúpiť naskočíš späť. Koľkokrát chceš.',
      'Na konci sa porovnáš s „kúp a drž“: s niekým, kto kúpil prvý deň a už na nič nesiahol.',
      'Potom sa dozvieš, s čím si obchodoval. 1 000 skutočných rokov akcií, kryptomien, zlata, ropy, indexov a mien.'
    ],
    backToGames: '← Všetky hry',
    disclaimer: 'Len na vzdelávanie a zábavu. Nejde o investičné odporúčanie.',

    chooseTitle: 'Vyber režim',
    dailyName: 'Denná #{n}', dailyDesc: '3 tajné grafy, dnes pre všetkých rovnaké.',
    dailyDone: 'Na dnes hotovo: {beat}/3 porazili „kúp a drž“. Nové grafy zajtra.', dailyShow: 'Ukázať výsledok',
    endlessName: 'Nekonečná hra', endlessDesc: 'Jeden graf za druhým. Vyber trh:',
    filters: { all: 'Všetko', stock: 'Akcie', crypto: 'Krypto', commodity: 'Komodity', index: 'Indexy a meny' },
    continue: 'Pokračovať →',
    statsBtn: 'Štatistiky', menu: 'Menu',
    themeToLight: 'Svetlý motív', themeToDark: 'Tmavý motív',
    feedbackLink: 'Našiel si chybu alebo máš nápad? Napíš mi →',

    roundOf: 'Graf {i} z {n}', endlessLabel: 'Nekonečná · {f}',
    mystery: 'Neznámy trh · {cat}', day: 'Deň {d}/{n}',
    cats: { stock: 'akcia', crypto: 'kryptomena', commodity: 'komodita', index: 'index', fx: 'mena' },
    you: 'Ty', hold: 'Kúp a drž', trades: 'Obchody',
    holding: 'Dnu · držíš', cash: 'Vonku · hotovosť',
    buy: 'Kúpiť', sell: 'Predať',
    ready: 'Sivá čiara ukazuje, čo bolo tesne predtým. Začínaš zainvestovaný.', go: 'Štart',
    keyHint: 'Medzerník = predať / kúpiť', paused: 'Pozastavené, keď bola karta skrytá', resume: 'Pokračovať',
    start: 'Štart', top: 'Vrchol',

    beat: 'Porazil si „kúp a drž“ o {x}.', lost: '„Kúp a drž“ ťa porazilo o {x}.', tie: 'Držal si celý čas: rovnako ako „kúp a drž“.',
    yourMoney: 'Zo 100 sa stalo {you}. Držanie z nich urobilo {hold}.',
    itWas: 'Išlo o',
    revealWho: '{name} ({ticker})',
    span: '{from} – {to}',
    story: 'Vrchol prišiel {date}, {up} od začiatku. Do konca potom cena {fall}.',
    storyFell: 'klesla o {x}', storyRose: 'zostala blízko vrcholu',
    included: 'Tento rok zahŕňal: {list}.',
    next: 'Ďalší graf', seeResults: 'Výsledky',

    resultsTitle: 'Denná #{n} hotová', beatCount: '{b}/3', beatOf: 'porazili „kúp a drž“',
    shareHead: 'Predaj na vrchole #{n}', shareBeat: '{b}/3 porazili „kúp a drž“',
    copy: 'Kopírovať výsledok', copied: 'Skopírované', copyFailed: 'Kopírovanie nefungovalo. Označ text vyššie.',

    statsTitle: 'Tvoje štatistiky', statPlayed: 'Odohrané grafy', statBeat: 'Porazil „kúp a drž“', statBest: 'Najlepšia výhra', statStreak: 'Najdlhšia séria',
    streakNote: 'Séria počíta grafy za sebou, kde si porazil „kúp a drž“.', noStats: 'Zatiaľ žiadne odohrané grafy.',
    byMarket: 'Podľa trhu', colPlayed: 'Hrané', colBeat: 'Porazené', colAvg: 'Priemer vs držanie',

    events: {
      crash1929: 'krach na Wall Street v roku 1929', blackmonday: 'čierny pondelok (19. 10. 1987)', asia1997: 'ázijskú finančnú krízu (1997)',
      russia1998: 'bankrot Ruska (august 1998)', dotcom: 'vrchol dot-com bubliny (marec 2000)', sept11: 'útoky 11. septembra',
      lehman: 'pád Lehman Brothers (september 2008)', flashcrash: 'Flash Crash (máj 2010)', usdowngrade: 'zníženie ratingu USA (august 2011)',
      snbfloor: 'koniec minimálneho kurzu franku (január 2015)', china2015: 'prepad čínskych akcií v roku 2015', brexit: 'referendum o brexite (jún 2016)',
      czkfloor: 'koniec kurzového záväzku ČNB (apríl 2017)', btc2017: 'vrchol bitcoinu v roku 2017', covid: 'covidový prepad (marec 2020)',
      oilnegative: 'ropu pod nulou (apríl 2020)', gamestop: 'short squeeze GameStopu (január 2021)', crypto2021: 'vrchol kryptomien v roku 2021',
      ukraine: 'ruskú inváziu na Ukrajinu (február 2022)', luna: 'kolaps Terra/Luna (máj 2022)', ftx: 'pád FTX (november 2022)',
      chatgpt: 'spustenie ChatGPT (november 2022)', svb: 'pád Silicon Valley Bank (marec 2023)', halving2024: 'halving bitcoinu v roku 2024',
      election2024: 'voľby v USA 2024', tariffs2025: 'clá „Dňa oslobodenia“ (apríl 2025)'
    }
  }
};

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
  const d = Math.abs(value) >= 100 ? 0 : digits;
  const n = new Intl.NumberFormat(loc, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(Math.abs(value));
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  return lang === 'en' ? `${sign}${n}%` : `${sign}${n} %`;
}

/** 1 234.5 style plain number in the page language. */
export function num(value, lang, digits = 0) {
  const loc = { en: 'en-US', cs: 'cs-CZ', sk: 'sk-SK' }[lang] || 'en-US';
  return new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}
