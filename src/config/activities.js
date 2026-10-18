/**
 * Activity catalogue for the Adaptive Experience (Member 2).
 *
 * Each activity declares which weather factors it cares about and may narrow
 * (never widen silently) the shared thresholds from adaptiveThresholds.js for
 * factors where its sensitivity differs. Every override number lives here.
 *
 * Labels and precautions are bilingual (en / hi) so the cards, the advisory
 * text and the voice output all read from one source.
 */

export const ACTIVITIES = Object.freeze([
  {
    id: 'walk',
    icon: 'walk',
    labels: { en: 'Walking', hi: 'सैर' },
    factors: ['rain', 'thunder', 'heat', 'cold', 'wind', 'fog'],
    thresholdOverrides: {},
    precautions: {
      en: 'Carry water and use sunscreen; take a shaded break if it feels hotter than expected.',
      hi: 'पानी साथ रखें और धूप से बचाव करें; ज़्यादा गर्मी लगे तो छाया में आराम करें।',
    },
  },
  {
    id: 'run',
    icon: 'run',
    labels: { en: 'Jogging / running', hi: 'दौड़ना' },
    factors: ['rain', 'thunder', 'heat', 'cold', 'wind', 'dark'],
    thresholdOverrides: {
      // Running generates extra body heat, so act earlier on heat.
      heat: { cautionAt: 30 },
      // Getting soaked mid-run is worse than a walk getting rained on.
      rain: { avoidAt: 60 },
    },
    precautions: {
      en: 'Warm up first, keep water handy, and slow down if the heat index keeps climbing.',
      hi: 'पहले गर्म-अप करें, पानी साथ रखें और हीट इंडेक्स बढ़े तो गति घटाएँ।',
    },
  },
  {
    id: 'cycling',
    icon: 'cycle',
    labels: { en: 'Cycling', hi: 'साइकिल चलाना' },
    factors: ['rain', 'thunder', 'wind', 'heat', 'dark'],
    thresholdOverrides: {
      // A cyclist already moves through the air: crosswinds matter sooner.
      wind: { cautionAt: 15, avoidAt: 30 },
      rain: { cautionAt: 30, avoidAt: 60 },
    },
    precautions: {
      en: 'Use lights in dark hours, avoid slick metal surfaces when wet, and give yourself extra braking distance.',
      hi: 'अंधेरे में लाइट जलाएँ, गीली धातु पर न रुकें और ब्रेक के लिए अतिरिक्त दूरी रखें।',
    },
  },
  {
    id: 'sports',
    icon: 'sport',
    labels: { en: 'Outdoor sports', hi: 'बाहरी खेल' },
    factors: ['rain', 'thunder', 'heat', 'cold', 'wind', 'fog'],
    thresholdOverrides: {
      // Soggy ground and wet balls end games early.
      rain: { cautionAt: 30, avoidAt: 50 },
      heat: { cautionAt: 30 },
    },
    precautions: {
      en: 'Schedule strenuous play for cooler hours, take water breaks, and stop if anyone feels dizzy.',
      hi: 'तेज़ खेल ठंडे समय पर रखें, पानी पीते रहें और चक्कर आए तो खेल रोकें।',
    },
  },
  {
    id: 'picnic',
    icon: 'picnic',
    labels: { en: 'Picnic / outing', hi: 'पिकनिक' },
    factors: ['rain', 'thunder', 'heat', 'fog', 'dark'],
    thresholdOverrides: {
      rain: { cautionAt: 35, avoidAt: 60 },
    },
    precautions: {
      en: 'Pick a shaded spot, keep food covered, and have a covered alternative ready if showers build up.',
      hi: 'छायादार जगह चुनें, खाना ढककर रखें और बौछारें बढ़ें तो छाव का विकल्प तैयार रखें।',
    },
  },
  {
    id: 'sightseeing',
    icon: 'camera',
    labels: { en: 'Sightseeing / photography', hi: 'घूमना / फोटोग्राफी' },
    factors: ['rain', 'thunder', 'heat', 'fog', 'wind'],
    thresholdOverrides: {},
    precautions: {
      en: 'Carry a light rain cover for gear, and keep lenses clear of spray and fog.',
      hi: 'सामान पर हल्की रेन-कवर रखें और लेंस को फुहार व कोहरे से बचाएँ।',
    },
  },
])
