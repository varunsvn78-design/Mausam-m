/**
 * User-facing copy for the Adaptive Experience (Member 2), English + Hindi.
 *
 * Business logic returns message keys / structured results; this file turns
 * them into readable sentences so translations stay in one place. Nothing in
 * here invents a measurement — values passed in come from forecast data or
 * from the documented estimates in src/services/heatStress.js.
 */

/* ------------------------------------------------------------- languages -- */

export const LANGUAGES = Object.freeze([
  { id: 'en', label: 'English', short: 'EN', speechLang: 'en', locale: 'en-IN' },
  { id: 'hi', label: 'हिन्दी', short: 'हि', speechLang: 'hi', locale: 'hi-IN' },
])

export function isLanguage(id) {
  return LANGUAGES.some((lang) => lang.id === id)
}

/* --------------------------------------------------------------- statuses -- */

export const STATUS_LABELS = Object.freeze({
  recommended: { en: 'Recommended', hi: 'अनुकूल' },
  caution: { en: 'Suit with caution', hi: 'सावधानी से' },
  'not-recommended': { en: 'Not recommended', hi: 'अनुशंसित नहीं' },
  unknown: { en: 'Not enough data', hi: 'अपर्याप्त डेटा' },
})

export const STATUS_SUMMARIES = Object.freeze({
  recommended: {
    en: 'Checked conditions are comfortable for this hour.',
    hi: 'इस समय की जाँची गई स्थितियाँ आरामदायक हैं।',
  },
  caution: {
    en: 'Doable — keep the listed precautions in mind.',
    hi: 'संभव है — दी गई सावधानियाँ ध्यान में रखें।',
  },
  'not-recommended': {
    en: 'Better to choose a different hour from the timeline.',
    hi: 'समयरेखा से कोई दूसरा समय चुनना बेहतर रहेगा।',
  },
  unknown: {
    en: 'Too little forecast data to judge this hour.',
    hi: 'इस समय का आकलन करने के लिए पर्याप्त पूर्वानुमान नहीं है।',
  },
})

export const STATUS_PRECAUTIONS = Object.freeze({
  recommended: null,
  caution: {
    en: 'Check the timeline for a calmer hour if plans are flexible.',
    hi: 'योजना लचीली हो तो समयरेखा पर शांत समय देखें।',
  },
  'not-recommended': {
    en: 'Move the activity to another hour — the timeline shows better slots.',
    hi: 'गतिविधि को दूसरे समय पर ले जाएँ — समयरेखा में बेहतर समय दिख रहे हैं।',
  },
  unknown: {
    en: 'Wait for fresh forecast data before committing to this hour.',
    hi: 'इस समय पर तय करने से पहले नए पूर्वानुमान की प्रतीक्षा करें।',
  },
})

export function statusLabel(status, language) {
  const entry = STATUS_LABELS[status] ?? STATUS_LABELS.unknown
  return language === 'hi' ? entry.hi : entry.en
}

export function statusSummary(status, language) {
  const entry = STATUS_SUMMARIES[status] ?? STATUS_SUMMARIES.unknown
  return language === 'hi' ? entry.hi : entry.en
}

/* -------------------------------------------------------- condition group -- */

const CONDITION_GROUPS = Object.freeze({
  clear: { en: 'Clear sky', hi: 'साफ़ आसमान' },
  'partly-cloudy': { en: 'Partly cloudy', hi: 'आंशिक बादल' },
  cloudy: { en: 'Overcast', hi: 'बादल छाए' },
  fog: { en: 'Fog', hi: 'कोहरा' },
  drizzle: { en: 'Drizzle', hi: 'बूँदाबाँदी' },
  rain: { en: 'Rain', hi: 'बारिश' },
  showers: { en: 'Showers', hi: 'बौछारें' },
  snow: { en: 'Snow', hi: 'बर्फबारी' },
  thunderstorm: { en: 'Thunderstorm', hi: 'आंधी-तूफान' },
  unknown: { en: 'Unknown conditions', hi: 'अज्ञात मौसम' },
})

/** Translate a condition group; falls back to the API's own English label. */
export function conditionLabel(group, fallbackLabel, language) {
  const entry = CONDITION_GROUPS[group]
  const label = language === 'hi' ? (entry?.hi ?? fallbackLabel) : (entry?.en ?? fallbackLabel)
  return label ?? (language === 'hi' ? 'अज्ञात मौसम' : 'Unknown conditions')
}

/* -------------------------------------------------------- factor reasons -- */

function pick(language, en, hi) {
  return language === 'hi' ? hi : en
}

/**
 * Human-readable explanation for one factor result from the activity engine.
 *
 * @param {{ factorId:string, level:'ok'|'caution'|'avoid'|'unknown', value?:number|null, source?:string, group?:string, groupLabel?:string }} result
 * @param {'en'|'hi'} language
 * @returns {string}
 */
export function formatFactorReason(result, language) {
  const { factorId, level } = result
  const value = Number.isFinite(result.value) ? Math.round(result.value) : null

  if (level === 'unknown') {
    switch (factorId) {
      case 'rain':
        return pick(language, 'Rain chance is not reported for this hour.', 'इस समय बारिश की संभावना नहीं बताई गई है।')
      case 'wind':
        return pick(language, 'Wind speed is not reported for this hour.', 'इस समय हवा की रफ़्तार नहीं बताई गई है।')
      case 'heat':
        return pick(
          language,
          'Humidity is missing, so no heat estimate could be made for this hour.',
          'इस समय आर्द्रता उपलब्ध नहीं है, इसलिए गर्मी का अनुमान नहीं लगाया जा सकता।',
        )
      case 'cold':
        return pick(language, 'Temperature is not reported for this hour.', 'इस समय तापमान नहीं बताया गया है।')
      case 'thunder':
      case 'fog':
        return pick(language, 'Condition details are unavailable for this hour.', 'इस समय मौसम की जानकारी उपलब्ध नहीं है।')
      case 'dark':
        return pick(language, 'Daylight information is unavailable for this hour.', 'इस समय दिन-रात की जानकारी उपलब्ध नहीं है।')
      default:
        return pick(language, 'Required weather data is missing for this check.', 'इस जाँच के लिए ज़रूरी मौसम डेटा नहीं है।')
    }
  }

  const groupLabel = result.groupLabel ?? null

  switch (factorId) {
    case 'rain':
      if (level === 'avoid')
        return pick(
          language,
          `Rain chance ${value}% — getting wet is likely.`,
          `बारिश की संभावना ${value}% — भीगने की आशंका है।`,
        )
      if (level === 'caution')
        return pick(
          language,
          `Rain chance ${value}% — showers could interrupt plans.`,
          `बारिश की संभावना ${value}% — बौछारें योजना बाधित कर सकती हैं।`,
        )
      return pick(language, `Rain chance ${value}% — low for this hour.`, `बारिश की संभावना ${value}% — इस समय कम है।`)

    case 'thunder':
      if (level === 'avoid')
        return pick(
          language,
          'Thunderstorms are forecast for this hour — stay indoors.',
          'इस समय आंधी-तूफान का पूर्वानुमान है — घर के अंदर रहें।',
        )
      return pick(
        language,
        `${conditionLabel(result.group, groupLabel, 'en')} is forecast for this hour.`,
        `इस समय ${conditionLabel(result.group, groupLabel, 'hi')} का पूर्वानुमान है।`,
      )

    case 'wind':
      if (level === 'avoid')
        return pick(language, `Wind ${value} km/h — too strong for this activity.`, `हवा ${value} किमी/घंटा — इस गतिविधि के लिए बहुत तेज़।`)
      if (level === 'caution')
        return pick(language, `Wind ${value} km/h — noticeably breezy.`, `हवा ${value} किमी/घंटा — हवा साफ़ महसूस होगी।`)
      return pick(language, `Wind ${value} km/h — within a comfortable range.`, `हवा ${value} किमी/घंटा — आरामदायक सीमा में।`)

    case 'heat': {
      const subject =
        result.source === 'apparentTemperature'
          ? pick(language, 'Feels like', 'गर्मी का अहसास')
          : pick(language, 'Heat index', 'हीट इंडेक्स')
      if (level === 'avoid')
        return pick(language, `${subject} ${value}°C — prolonged effort is risky.`, `${subject} ${value}°C — लंबे समय तक मेहनत जोखिम भरी है।`)
      if (level === 'caution')
        return pick(language, `${subject} ${value}°C — pace yourself and hydrate.`, `${subject} ${value}°C — धीरे चलें और पानी पीते रहें।`)
      return pick(language, `${subject} ${value}°C — manageable for now.`, `${subject} ${value}°C — फ़िलहाल संभव है।`)
    }

    case 'cold':
      if (level === 'avoid')
        return pick(language, `Temperature ${value}°C — too cold to linger outside.`, `तापमान ${value}°C — बाहर रुकने के लिए बहुत ठंड।`)
      if (level === 'caution')
        return pick(language, `Temperature ${value}°C — you will want warm layers.`, `तापमान ${value}°C — गर्म कपड़ों की ज़रूरत होगी।`)
      return pick(language, `Temperature ${value}°C — mild.`, `तापमान ${value}°C — हल्की ठंड।`)

    case 'fog':
      if (level === 'avoid' || level === 'caution')
        return pick(
          language,
          'Fog is forecast — visibility may be poor.',
          'कोहरे का पूर्वानुमान है — दृश्यता कम रह सकती है।',
        )
      return pick(language, 'No fog in the forecast for this hour.', 'इस समय के पूर्वानुमान में कोहरा नहीं है।')

    case 'dark':
      if (level === 'caution' || level === 'avoid')
        return pick(language, 'Dark hours — choose a well-lit route.', 'अंधेरा — अच्छी रोशनी वाला रास्ता चुनें।')
      return pick(language, 'Daylight hours.', 'दिन का समय।')

    default:
      return pick(language, 'Checked against forecast data.', 'पूर्वानुमान डेटा से जाँचा गया।')
  }
}

/* ------------------------------------------------------- heat & wet bulb -- */

export const HEAT_COPY = Object.freeze({
  title: { en: 'Heat & humidity estimates', hi: 'गर्मी व आर्द्रता के अनुमान' },
  subtitle: {
    en: 'Calculated from the selected hour’s air temperature and humidity.',
    hi: 'चुने गए घंटे के तापमान और आर्द्रता से गणना की गई।',
  },
  heatIndexLabel: { en: 'Heat index', hi: 'हीट इंडेक्स' },
  wetBulbLabel: { en: 'Wet-bulb temperature', hi: 'वेट-बल्ब तापमान' },
  estimatedChip: { en: 'Estimated', hi: 'अनुमानित' },
  inputsUsed: {
    en: (temp, humidity) => `From air temperature ${temp}°C and humidity ${humidity}%.`,
    hi: (temp, humidity) => `हवा का तापमान ${temp}°C और आर्द्रता ${humidity}% से।`,
  },
  unavailable: { en: 'Not calculated', hi: 'गणना नहीं' },
  howThisWorks: { en: 'How this is calculated', hi: 'गणना कैसे होती है' },
  heatIndex: {
    meaning: {
      en: 'How hot the air feels once humidity is included, using the Rothfusz regression of the US National Weather Service. It assumes shade and still air, so direct sun feels worse.',
      hi: 'आर्द्रता सहित हवा कितनी गर्म लगती है — अमेरिकी National Weather Service के रोथफ़ुज़ प्रतिगमन से। यह छाया और शांत हवा मानकर गणना करता है, तेज़ धूप में और भी बुरा लगता है।',
    },
    limitations: {
      en: 'An estimate built from two forecast variables — not a measured value and not an official warning. Breezes, sun exposure and personal fitness change the real feel.',
      hi: 'दो पूर्वानुमान मानों से बना अनुमान — न मापा गया मान, न आधिकारिक चेतावनी। हवा, धूप और व्यक्तिगत सहनशक्ति वास्तविक अहसास बदल सकते हैं।',
    },
    reasons: {
      missingTemperature: {
        en: 'Air temperature is missing for this hour.',
        hi: 'इस समय हवा का तापमान उपलब्ध नहीं है।',
      },
      missingHumidity: {
        en: 'Humidity is missing for this hour, so the heat index cannot be calculated.',
        hi: 'इस समय आर्द्रता उपलब्ध नहीं है, इसलिए हीट इंडेक्स की गणना नहीं हो सकती।',
      },
      belowValidity: {
        en: ({ min, value }) =>
          `Not calculated — the heat index is only computed when air temperature is at least ${min}°C (it is ${value}°C now).`,
        hi: ({ min, value }) =>
          `गणना नहीं — हीट इंडेक्स केवल तब निकाला जाता है जब हवा का तापमान कम से कम ${min}°C हो (अभी ${value}°C है)।`,
      },
      lowHumidity: {
        en: ({ value }) =>
          `Not calculated — relative humidity is ${value}%, below the 40% where this formula stays reliable.`,
        hi: ({ value }) =>
          `गणना नहीं — सापेक्ष आर्द्रता ${value}% है, जो सूत्र की भरोसेमंद सीमा 40% से नीचे है।`,
      },
      invalidInput: {
        en: 'Temperature or humidity is outside a plausible range, so no estimate is shown.',
        hi: 'तापमान या आर्द्रता संभव सीमा से बाहर है, इसलिए कोई अनुमान नहीं दिखाया गया।',
      },
    },
  },
  wetBulb: {
    meaning: {
      en: 'The temperature a thermometer reads when its bulb is kept wet — it shows how well the body can cool itself by sweating. Calculated with Stull’s (2011) published approximation.',
      hi: 'गीला किया गया बल्ब किस तापमान को दिखाता है — यह बताता है कि पसीने से शरीर कितनी अच्छी तरह ठंडा हो पाता है। स्टल (2011) के प्रकाशित सूत्र से गणना।',
    },
    limitations: {
      en: 'Assumes sea-level air pressure and calm, shaded air — no sun or wind is accounted for. A model estimate, not a measurement, and not an official warning.',
      hi: 'समुद्र तल के दबाव और शांत, छायादार हवा मानकर गणना — सूरज या हवा शामिल नहीं। मॉडल से बना अनुमान, न माप और न आधिकारिक चेतावनी।',
    },
    reasons: {
      missingTemperature: {
        en: 'Air temperature is missing for this hour.',
        hi: 'इस समय हवा का तापमान उपलब्ध नहीं है।',
      },
      missingHumidity: {
        en: 'Humidity is missing for this hour, so wet-bulb temperature cannot be calculated.',
        hi: 'इस समय आर्द्रता उपलब्ध नहीं है, इसलिए वेट-बल्ब तापमान की गणना नहीं हो सकती।',
      },
      temperatureBelowRange: {
        en: ({ min, value }) =>
          `Not calculated — this formula needs air temperature of at least ${min}°C (it is ${value}°C now).`,
        hi: ({ min, value }) =>
          `गणना नहीं — इस सूत्र के लिए हवा का तापमान कम से कम ${min}°C चाहिए (अभी ${value}°C है)।`,
      },
      temperatureAboveRange: {
        en: ({ max, value }) => `Not calculated — air temperature ${value}°C is above the ${max}°C limit of this formula.`,
        hi: ({ max, value }) => `गणना नहीं — हवा का तापमान ${value}°C, इस सूत्र की ${max}°C सीमा से ऊपर है।`,
      },
      humidityBelowRange: {
        en: ({ min, value }) => `Not calculated — humidity ${value}% is below the ${min}% minimum of this formula.`,
        hi: ({ min, value }) => `गणना नहीं — आर्द्रता ${value}% इस सूत्र की ${min}% न्यूनतम सीमा से नीचे है।`,
      },
      humidityAboveRange: {
        en: ({ max, value }) => `Not calculated — humidity ${value}% is above the ${max}% maximum of this formula.`,
        hi: ({ max, value }) => `गणना नहीं — आर्द्रता ${value}% इस सूत्र की ${max}% अधिकतम सीमा से ऊपर है।`,
      },
      invalidInput: {
        en: 'Temperature or humidity is outside a plausible range, so no estimate is shown.',
        hi: 'तापमान या आर्द्रता संभव सीमा से बाहर है, इसलिए कोई अनुमान नहीं दिखाया गया।',
      },
    },
  },
  categories: Object.freeze({
    caution: { en: 'Caution', hi: 'सावधानी' },
    'extreme-caution': { en: 'Extreme caution', hi: 'अत्यधिक सावधानी' },
    danger: { en: 'Danger', hi: 'खतरा' },
    'extreme-danger': { en: 'Extreme danger', hi: 'अत्यधिक खतरा' },
  }),
  bands: Object.freeze({
    low: { en: 'Low heat strain', hi: 'कम गर्मी का दबाव' },
    elevated: { en: 'Rising heat strain', hi: 'गर्मी का दबाव बढ़ रहा' },
    high: { en: 'High heat strain', hi: 'उच्च गर्मी का दबाव' },
    severe: { en: 'Severe heat strain', hi: 'गंभीर गर्मी का दबाव' },
    limit: { en: 'Beyond survivability limit', hi: 'सहनशीलता सीमा से परे' },
  }),
  sourceNote: {
    en: 'Categories follow the US NWS heat-index chart — planning guidance only.',
    hi: 'श्रेणियाँ अमेरिकी NWS हीट-इंडेक्स चार्ट पर आधारित हैं — केवल योजना सहायता।',
  },
})

export function heatCategoryLabel(categoryId, language) {
  const entry = HEAT_COPY.categories[categoryId]
  if (!entry) return null
  return language === 'hi' ? entry.hi : entry.en
}

export function wetBulbBandLabel(bandId, language) {
  const entry = HEAT_COPY.bands[bandId]
  if (!entry) return null
  return language === 'hi' ? entry.hi : entry.en
}

/* -------------------------------------------------------------- timeline -- */

export const SECTION_COPY = Object.freeze({
  eyebrow: { en: 'Adaptive experience', hi: 'अनुकूल अनुभव' },
  title: { en: 'Plan your hours', hi: 'अपने घंटों की योजना' },
  intro: {
    en: 'Scrub through the next hours, see why an activity fits, and hear the advisory in English or Hindi.',
    hi: 'आने वाले घंटों में घूमें, गतिविधियों के कारण जानें और सलाह अंग्रेज़ी या हिन्दी में सुनें।',
  },
})

export const TIMELINE_COPY = Object.freeze({
  eyebrow: { en: 'Chrono-UI', hi: 'समय-दृश्य' },
  title: { en: '24-hour timeline', hi: '24-घंटे समयरेखा' },
  hint: {
    en: 'Drag the handle, tap an hour, or use the arrow keys, Home and End.',
    hi: 'हैंडल खींचें, घंटे पर टैप करें या तीर कुंजियाँ, Home और End दबाएँ।',
  },
  today: { en: 'Today', hi: 'आज' },
  tomorrow: { en: 'Tomorrow', hi: 'कल' },
  nowButton: { en: 'Jump to now', hi: 'अभी पर जाएँ' },
  now: { en: 'Now', hi: 'अभी' },
  selectedHour: { en: 'Selected hour', hi: 'चुना गया घंटा' },
  timeLabel: { en: (time) => `${time} hours`, hi: (time) => `${time} बजे` },
  past: { en: 'Past', hi: 'बीता' },
  current: { en: 'Current hour', hi: 'अभी का घंटा' },
  future: { en: 'Upcoming', hi: 'आने वाला' },
  missing: { en: 'No data', hi: 'डेटा नहीं' },
  hourStates: Object.freeze({
    past: { en: 'Past hour', hi: 'बीता घंटा' },
    current: { en: 'Current hour', hi: 'अभी का घंटा' },
    future: { en: 'Upcoming hour', hi: 'आने वाला घंटा' },
    missing: { en: 'No data for this hour', hi: 'इस घंटे का डेटा नहीं' },
    unknown: { en: 'Hour', hi: 'घंटा' },
  }),
  noData: {
    en: 'No hourly forecast is available for this location right now.',
    hi: 'इस स्थान के लिए अभी घंटेवार पूर्वानुमान उपलब्ध नहीं है।',
  },
  noDataTitle: { en: 'Hourly timeline unavailable', hi: 'घंटेवार समयरेखा उपलब्ध नहीं' },
  hourMissingTitle: { en: 'This hour is not in the forecast', hi: 'यह घंटा पूर्वानुमान में नहीं है' },
  hourMissingBody: {
    en: 'Pick another hour on the timeline — the model did not return a value for this one.',
    hi: 'समयरेखा से कोई दूसरा घंटा चुनें — मॉडल ने इसके लिए मान नहीं लौटाया है।',
  },
})

export function hourStateLabel(state, language) {
  const entry = TIMELINE_COPY.hourStates[state] ?? TIMELINE_COPY.hourStates.unknown
  return language === 'hi' ? entry.hi : entry.en
}

/* ------------------------------------------------------------ activities -- */

export const ACTIVITY_COPY = Object.freeze({
  eyebrow: { en: 'Activity priorities', hi: 'गतिविधि प्राथमिकताएँ' },
  title: { en: 'Personalized activity cards', hi: 'व्यक्तिगत गतिविधि कार्ड' },
  whyLabel: { en: 'Why', hi: 'क्यों' },
  valuesLabel: { en: 'This hour', hi: 'इस घंटे' },
  precautionLabel: { en: 'Precaution', hi: 'सावधानी' },
  notice: {
    en: 'Rules are planning guidance from forecast data — not an official IMD warning.',
    hi: 'नियम पूर्वानुमान पर आधारित योजना सहायता हैं — आधिकारिक IMD चेतावनी नहीं।',
  },
  noData: {
    en: 'There is no hourly data for the selected hour, so no recommendation can be made.',
    hi: 'चुने गए घंटे का घंटेवार डेटा नहीं है, इसलिए कोई सुझाव नहीं दिया जा सकता।',
  },
})

/* --------------------------------------------------------------- advisory -- */

export const VOICE_COPY = Object.freeze({
  eyebrow: { en: 'Voice advisory', hi: 'ध्वनि सलाह' },
  title: { en: 'Advisory in your language', hi: 'आपकी भाषा में सलाह' },
  languageLabel: { en: 'Language', hi: 'भाषा' },
  play: { en: 'Play', hi: 'चलाएँ' },
  pause: { en: 'Pause', hi: 'रोकें' },
  resume: { en: 'Resume', hi: 'जारी रखें' },
  stop: { en: 'Stop', hi: 'बंद करें' },
  speaking: { en: 'Playing advisory…', hi: 'सलाह चल रही है…' },
  paused: { en: 'Paused.', hi: 'रोका गया।' },
  idle: { en: 'Press play to hear the advisory.', hi: 'सलाह सुनने के लिए चलाएँ दबाएँ।' },
  unsupported: {
    en: 'Speech playback is not available in this browser — read the advisory text below.',
    hi: 'इस ब्राउज़र में आवाज़ उपलब्ध नहीं है — नीचे लिखी सलाह पढ़ें।',
  },
  noVoices: {
    en: 'No matching voice was found for this language; the browser may still read it in its default voice.',
    hi: 'इस भाषा के लिए कोई आवाज़ नहीं मिली; ब्राउज़र डिफ़ॉल्ट आवाज़ से पढ़ सकता है।',
  },
  textLabel: { en: 'Advisory text', hi: 'सलाह का पाठ' },
})

export function advisoryConditionSentence(parts, language) {
  const { place, timePhrase, condition, temperature, feelsLike, rainChance, windSpeed } = parts
  if (language === 'hi') {
    const bits = []
    bits.push(`${temperature ?? '—'}°C`)
    if (feelsLike !== null && feelsLike !== undefined) bits.push(`अहसास ${feelsLike}°C`)
    if (condition) bits.push(condition)
    if (rainChance !== null && rainChance !== undefined) bits.push(`बारिश की संभावना ${rainChance}%`)
    if (windSpeed !== null && windSpeed !== undefined) bits.push(`हवा ${windSpeed} किमी/घंटा`)
    return `${place} में ${timePhrase}: ${bits.join(', ')}।`
  }
  const bits = []
  bits.push(`${temperature ?? '—'}°C`)
  if (feelsLike !== null && feelsLike !== undefined) bits.push(`feels like ${feelsLike}°C`)
  if (condition) bits.push(condition)
  if (rainChance !== null && rainChance !== undefined) bits.push(`rain chance ${rainChance}%`)
  if (windSpeed !== null && windSpeed !== undefined) bits.push(`wind ${windSpeed} km/h`)
  return `${timePhrase} in ${place}: ${bits.join(', ')}.`
}

export function advisoryHeatSentence({ valueC, categoryLabel }, language) {
  if (language === 'hi') {
    return categoryLabel
      ? `अनुमानित हीट इंडेक्स ${valueC}°C — ${categoryLabel}।`
      : `अनुमानित हीट इंडेक्स ${valueC}°C।`
  }
  return categoryLabel
    ? `Estimated heat index ${valueC}°C — ${categoryLabel}.`
    : `Estimated heat index ${valueC}°C.`
}

export function advisoryActivitySentence(groups, language) {
  const { recommended, caution, avoid } = groups
  const sections = []
  if (recommended.length) {
    sections.push(
      language === 'hi'
        ? `अभी अनुकूल: ${recommended.join(', ')}।`
        : `Recommended now: ${recommended.join(', ')}.`,
    )
  }
  if (caution.length) {
    sections.push(
      language === 'hi' ? `सावधानी: ${caution.join(', ')}।` : `Use caution: ${caution.join(', ')}.`,
    )
  }
  if (avoid.length) {
    sections.push(
      language === 'hi'
        ? `अनुशंसित नहीं: ${avoid.join(', ')}।`
        : `Not recommended: ${avoid.join(', ')}.`,
    )
  }
  return sections.join(' ')
}

export function advisoryDisclaimer(language) {
  return language === 'hi'
    ? 'यह पूर्वानुमान पर आधारित अनुमान है, आधिकारिक चेतावनी नहीं।'
    : 'Estimates from forecast data — not an official warning.'
}

export function advisoryNoDataSentence(language) {
  return language === 'hi'
    ? 'इस समय के लिए पर्याप्त मौसम डेटा नहीं है, इसलिए कोई सलाह नहीं दी जा सकती।'
    : 'There is not enough weather data for this hour to make a recommendation.'
}

/**
 * Speech-friendly time phrase.
 * EN: "2 PM"; HI: "शाम 5 बजे" / "दोपहर 12 बजे".
 */
export function spokenTimePhrase(hour, language) {
  const h = ((Math.round(hour) % 24) + 24) % 24
  const h12 = h % 12 === 0 ? 12 : h % 12
  if (language === 'hi') {
    let period
    if (h >= 4 && h <= 11) period = 'सुबह'
    else if (h >= 12 && h <= 16) period = 'दोपहर'
    else if (h >= 17 && h <= 19) period = 'शाम'
    else period = 'रात'
    return `${period} ${h12} बजे`
  }
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`
}
