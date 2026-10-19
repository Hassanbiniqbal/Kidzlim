/**
 * Launch catalogue (dummy content): every Kidzlim title, grouped into series.
 * Covers live in ./assets/books/<slug>.webp. Prices, page counts and descriptions are
 * placeholders to fill the shop — review each book in the admin before launch.
 */

export type SeriesKey = 'prophet-stories' | 'heroes-of-islam' | 'faith-and-worship' | 'good-character' | 'names-of-allah' | 'learn-arabic' | 'art-and-activity'

export const SERIES: Record<SeriesKey, { title: string; blurb: string; sortOrder: number }> = {
  'prophet-stories': {
    title: 'Prophet Stories',
    blurb: 'Rhyming, beautifully illustrated retellings of the lives of the Prophets, peace be upon them.',
    sortOrder: 1,
  },
  'heroes-of-islam': {
    title: 'Heroes of Islam',
    blurb: 'The Companions and great women of Islam — real stories of courage, truthfulness and faith.',
    sortOrder: 2,
  },
  'faith-and-worship': {
    title: 'Faith & Worship',
    blurb: 'Gentle first lessons on Allah, the Quran, the angels, Jannah and the blessed places.',
    sortOrder: 3,
  },
  'good-character': {
    title: 'Good Character',
    blurb: 'Everyday stories that teach kindness, honesty, sharing and self-control the Islamic way.',
    sortOrder: 4,
  },
  'names-of-allah': {
    title: 'Names of Allah',
    blurb: 'Discover the beautiful Names of Allah through stories children can relate to.',
    sortOrder: 5,
  },
  'learn-arabic': {
    title: 'Learn Arabic',
    blurb: 'Picture-packed Arabic vocabulary books — everyday words in Arabic and English.',
    sortOrder: 6,
  },
  'art-and-activity': {
    title: 'Art & Activity',
    blurb: 'Step-by-step printable art activities that turn Islamic learning into hands-on fun.',
    sortOrder: 7,
  },
}

export type CatalogueBook = {
  /** Source file name in the cover folder. */
  file: string
  title: string
  series: SeriesKey
  blurb: string
  featured?: boolean
}

export const CATALOGUE: CatalogueBook[] = [
  /* ── Prophet Stories ── */
  { file: '1656750461-NUYshG.png', title: 'Adam (AS)', series: 'prophet-stories', blurb: 'The story of the very first human and Prophet — how Allah created Adam, taught him the names of all things and forgave him.', featured: true },
  { file: '1656750635-XhDtpP.png', title: 'Nuh (AS): A New Beginning', series: 'prophet-stories', blurb: 'Prophet Nuh builds a great ship to save the believers — a story of patience, trust and a brand-new beginning.', featured: true },
  { file: '1673599767-PtZaCH.png', title: 'Ibrahim (AS) Part One: Smashing the Idols', series: 'prophet-stories', blurb: 'A poetic account of Prophet Ibrahim’s birth and early life, and the day he showed his people that idols cannot help anyone.' },
  { file: '1673604278-hjXidi.png', title: 'Ibrahim (AS) Part Two: The Magical Story of Zamzam Water', series: 'prophet-stories', blurb: 'Allah tests Prophet Ibrahim by asking him to leave his family in a barren valley — and a miracle springs from the sand.' },
  { file: '1673605817-NlXEug.png', title: 'Ibrahim (AS) Part Three: Sacrificing the Most Precious Gift', series: 'prophet-stories', blurb: 'Prophet Ibrahim faces the hardest test of all, and his son Ismail shows remarkable faith — the story behind Eid ul Adha.' },
  { file: '1673613847-pMBqGe.png', title: 'Muhammad (SAW) Part One: The Most Loved Man', series: 'prophet-stories', blurb: 'A beautiful, rhyming account of the early life of the most perfect man, Prophet Muhammad, peace be upon him.', featured: true },
  { file: '1673614100-lQMegE.png', title: 'Muhammad (SAW) Part Two: Unlettered, Yet He Read', series: 'prophet-stories', blurb: 'The Prophet could neither read nor write — until Jibreel came to the cave of Hira and said “Iqra!”.' },
  { file: '1673614313-tiSUJW.png', title: 'Muhammad (SAW) Part Three: Guidance for All Times', series: 'prophet-stories', blurb: 'How the teachings and Sunnah of the Prophet guide all of humanity until the Day of Qiyamah.' },
  { file: '1673615153-iXDozL.png', title: 'Musa (AS) Part One: The Pharaoh’s Dream', series: 'prophet-stories', blurb: 'A cruel king has a frightening dream, and a baby is placed in a basket on the River Nile.' },
  { file: '1673614915-GGtlTy.png', title: 'Musa (AS) Part Two: Girls in Distress', series: 'prophet-stories', blurb: 'Far from home, Prophet Musa helps two worried sisters at a well — and Allah rewards his kindness.' },
  { file: '1673615364-IAZxsV.png', title: 'Musa (AS) Part Three: The Magicians Believed', series: 'prophet-stories', blurb: 'Prophet Musa returns to Egypt with a message — and Pharaoh’s own magicians become believers.' },
  { file: '1673615582-WbTPSW.png', title: 'Musa (AS) Part Four: Splitting of the Red Sea', series: 'prophet-stories', blurb: 'Allah’s great miracle saves Prophet Musa’s people and ends Pharaoh’s tyranny forever.' },

  /* ── Heroes of Islam ── */
  { file: '1673598863-dGKokU.png', title: 'Abu Bakr As-Siddiq: The Truthful Man', series: 'heroes-of-islam', blurb: 'The life journey of the closest companion of the Prophet — the man who always believed and always told the truth.', featured: true },
  { file: '1656750747-lHPLYS.png', title: 'Umar ibn al-Khattab: The Brave and Bold', series: 'heroes-of-islam', blurb: 'The life journey of the most daring companion of the Prophet, famous for his courage and his justice.' },
  { file: '1673938561-nEjosp.png', title: 'Uthman ibn Affan: The Kind-Hearted Companion', series: 'heroes-of-islam', blurb: 'A poetic memoir of Uthman, the generous companion who bought a well so everyone could drink for free.' },
  { file: '1673616079-uodPwq.png', title: 'Aisha: The Young and Courageous', series: 'heroes-of-islam', blurb: 'The life journey of the youngest and beloved wife of the Prophet — a brilliant teacher of the Ummah.' },
  { file: '1673616433-PoOovk.png', title: 'Khadija: The Devoted Wife and Businesswoman', series: 'heroes-of-islam', blurb: 'The story of the Prophet’s first wife and companion — a successful businesswoman and the first to believe.' },
  { file: '1656751082-OdDOgy.png', title: 'Maryam: Miraculous Mom and Son', series: 'heroes-of-islam', blurb: 'Her life was hard, but her faith never wavered — the story of Maryam, mother of Prophet Isa.' },

  /* ── Faith & Worship ── */
  { file: '1673099213-FgRdzd.png', title: 'The Creator', series: 'faith-and-worship', blurb: 'A first look at Allah and His amazing creation — from tiny bees to giant sunflowers.', featured: true },
  { file: '1673099098-XEmtyp.png', title: 'All Praise Is for Allah', series: 'faith-and-worship', blurb: 'What does “Alhamdulillah” really mean? Learn its uses, its worth and its benefits in the life of a Muslim.' },
  { file: '1673099321-rYgeqZ.png', title: 'Allah’s Reward', series: 'faith-and-worship', blurb: 'Understand the basics of saying “JazakAllah” and why thanking others the Islamic way is so special.' },
  { file: '1673099732-nLnqJB.png', title: 'Allah’s Mercy', series: 'faith-and-worship', blurb: 'Understand the basics of “Astaghfirullah” — asking Allah for forgiveness — and its many benefits.' },
  { file: '1673099409-isentF.png', title: 'The Only Book of Perfection', series: 'faith-and-worship', blurb: 'A first understanding of the Holy Quran: what makes it unique, and why it matters to every Muslim.' },
  { file: '1673099537-unHERU.png', title: 'Divine Messenger', series: 'faith-and-worship', blurb: 'The concept of angels — their attributes, their special duties and their abilities.' },
  { file: '1673099662-ICgnjK.png', title: 'Messenger of Allah', series: 'faith-and-worship', blurb: 'Who are the Prophets? Their attributes, and how they spread the teachings of Islam.' },
  { file: '1673098798-biDaLw.png', title: 'My Magic Stick', series: 'faith-and-worship', blurb: 'A fun first introduction to the miswak — the Sunnah toothbrush — and all its benefits.' },
  { file: '1673098948-KSJAEx.png', title: 'The Holy Kaaba’s Glory', series: 'faith-and-worship', blurb: 'The Kaaba: its history, its significance and its worth for the Muslim community.' },
  { file: '1673100438-PfJkcO.png', title: 'Heavens on Earth: Makkah & Madinah', series: 'faith-and-worship', blurb: 'The two most special places only Muslims can visit, explored through the eyes of two curious girls.' },
  { file: '1673099906-HOCxPs.png', title: 'The Unbelievable Journey', series: 'faith-and-worship', blurb: 'The Prophet’s journey through the night, to the seven skies and beyond — the story of Isra and Miraj.' },
  { file: '1673616706-LgbzmD.png', title: 'The Wonderland', series: 'faith-and-worship', blurb: 'Understand the concept of Jannah, its worth and its importance in the next life.' },
  { file: '1673100893-gRcXun.png', title: 'The Beautiful and Unseen', series: 'faith-and-worship', blurb: 'Experience Jannah through the eyes of two young siblings and their wonderful imaginations.' },
  { file: '1673619548-uJiMrn.png', title: 'The Blessed Water', series: 'faith-and-worship', blurb: 'Two friends discuss the origin and the blessings of Zamzam water.' },
  { file: 'fast reward.png', title: 'The Fast Reward', series: 'faith-and-worship', blurb: 'Nigel learns about the countless blessings of Ramadan and the festivities of the Eid that follows it.' },
  { file: '1673102062-bBRAQY.png', title: 'A Trip to the Grandparents', series: 'faith-and-worship', blurb: 'Maryam learns about the rewards and benefits of the ten blessed days of Dhul Hijjah.' },

  /* ── Good Character ── */
  { file: '1656752645-OUSITX.png', title: 'Controlling Anger = Controlling Shaitan', series: 'good-character', blurb: 'Ali tries to end a fight between two angry friends — and learns the Prophet’s tips for staying calm.', featured: true },
  { file: '1656752736-geZCnO.png', title: 'Caring for Orphans', series: 'good-character', blurb: 'Ahmed tells his own story of caring for and helping his orphan friends.' },
  { file: '1656752813-TdbUYG.png', title: 'Usman and Husna: Pot of Gold', series: 'good-character', blurb: 'The siblings face a choice: spend their savings on themselves, or help someone in need?', featured: true },
  { file: '1673100165-ixYxLF.png', title: 'Purify Your Money', series: 'good-character', blurb: 'Two friends discuss why Muslims pay Zakat and why giving makes our wealth pure.' },
  { file: '1673100274-xAMawY.png', title: 'Wiping Away Good Deeds', series: 'good-character', blurb: 'Why talking badly about someone who isn’t there is so harmful — a gentle story about backbiting.' },
  { file: '1673100354-OSiloo.png', title: 'Hafsa’s Haircut', series: 'good-character', blurb: 'A little girl’s effort to understand the concept of hijab in her life.' },
  { file: '1673100506-ynxKbX.png', title: 'Disease of the Hearts', series: 'good-character', blurb: 'A simple, harmless lie may affect Hassan’s trustworthiness and his relationship with his mother.' },
  { file: '1673100574-VPplej.png', title: 'An Endless Pit', series: 'good-character', blurb: 'Bisma’s struggle to break free from the never-ending wants and desires of this world.' },
  { file: '1673100725-rYehRG.png', title: 'Sharing Is Caring', series: 'good-character', blurb: 'Amna learns the benefits of taking care of her neighbours.' },
  { file: '1673101086-KBOItL.png', title: 'A Healthy Mind, Body & Soul', series: 'good-character', blurb: 'Abdul’s trip to America teaches him an important lesson about halal food and healthy living.' },
  { file: '1673102488-pTSTXq.png', title: 'Helping Everyone Around Us', series: 'good-character', blurb: 'Mohib and Manahil decide to help their mother in a time of need.' },
  { file: '1673102572-Xtpoje.png', title: 'Sharing What You Love', series: 'good-character', blurb: 'Sana decides to share her favourite things with her friends and the people in her house.' },
  { file: '1673242833-dWkgrD.png', title: 'Forgiving Others Is a Good Habit', series: 'good-character', blurb: 'Sana’s story of forgiving her friend Eshal for her mistake.' },
  { file: '1674583593-ObfNdX.png', title: 'Tit for Tat', series: 'good-character', blurb: 'A few class friends plot against a bully — but is revenge really the answer?' },

  /* ── Names of Allah ── */
  { file: 'cover.png', title: 'Al-Malik: The Absolute Ruler', series: 'names-of-allah', blurb: 'Discover the Name Al-Malik — Allah, the King of all kings — through a story about what we really own.', featured: true },
  { file: '27 2.png', title: 'Al-Hakam: The Impartial Judge', series: 'names-of-allah', blurb: 'Discover the Name Al-Hakam — Allah, the most fair Judge — through a story about fairness among friends.' },
  { file: 'shelf 2.png', title: 'Ar-Razzaq: The Provider', series: 'names-of-allah', blurb: 'Discover the Name Ar-Razzaq — Allah, who provides for every living thing.' },
  { file: 'shelf 3.png', title: 'Ar-Raqib: The Watchful One', series: 'names-of-allah', blurb: 'Discover the Name Ar-Raqib — Allah sees us at all times, even when no one else does.' },
  { file: 'shelf 4.png', title: 'Al-Musawwir: The Shaper of Beauty', series: 'names-of-allah', blurb: 'Discover the Name Al-Musawwir — Allah, who shaped every one of us beautifully and differently.' },
  { file: 'shelf 5.png', title: 'Al-Fattah: The Opener', series: 'names-of-allah', blurb: 'Discover the Name Al-Fattah — Allah, who opens the doors of mercy and solves our problems.' },
  { file: 'shelf.png', title: 'Al-Wahhab: The Giver of All', series: 'names-of-allah', blurb: 'Discover the Name Al-Wahhab — Allah, who gives us every gift without asking anything in return.' },

  /* ── Learn Arabic ── */
  { file: '1656748722-PSfVLi.png', title: 'Learn Arabic Vocabulary: Animals', series: 'learn-arabic', blurb: 'Lions, giraffes, elephants and more — learn the names of animals in Arabic and English.', featured: true },
  { file: '1656748941-LRXiVT.png', title: 'Learn Arabic Vocabulary: Farm', series: 'learn-arabic', blurb: 'Meet the farmer and his animals, and learn everyday farm words in Arabic.' },
  { file: '1656749016-pzVEuu.png', title: 'Learn Arabic Vocabulary: Forest', series: 'learn-arabic', blurb: 'Explore the forest and learn the Arabic words for trees, animals and everything in between.' },
  { file: '1656749086-FlETMC.png', title: 'Learn Arabic Vocabulary: Fruits', series: 'learn-arabic', blurb: 'Bananas, grapes, pineapples — a juicy, colourful first book of fruits in Arabic.' },
  { file: '1673092767-Xbwzhp.png', title: 'Learn Arabic Vocabulary: Vegetables', series: 'learn-arabic', blurb: 'From the garden to the kitchen — learn the names of vegetables in Arabic.' },
  { file: 'zoo.png', title: 'Learn Arabic Vocabulary: The Zoo', series: 'learn-arabic', blurb: 'A day out at the zoo, packed with Arabic words for animals and places.' },
  { file: 'house.png', title: 'Learn Arabic Vocabulary: The House', series: 'learn-arabic', blurb: 'Learn the Arabic words for the rooms and things around your home.' },
  { file: 'bedroom.png', title: 'Learn Arabic Vocabulary: The Bedroom', series: 'learn-arabic', blurb: 'Bed, pillow, wardrobe — learn the Arabic words for everything in the bedroom.' },
  { file: 'bathroom.png', title: 'Learn Arabic Vocabulary: The Bathroom', series: 'learn-arabic', blurb: 'Soap, towel, toothbrush — learn bathroom words in Arabic and English.' },
  { file: 'kitchen.png', title: 'Learn Arabic Vocabulary: The Kitchen', series: 'learn-arabic', blurb: 'Help cook dinner while learning the Arabic words for kitchen things.' },
  { file: 'living-room.png', title: 'Learn Arabic Vocabulary: The Living Room', series: 'learn-arabic', blurb: 'Sofa, lamp, clock — learn the Arabic words for the living room.' },
  { file: 'clothes.png', title: 'Learn Arabic Vocabulary: Clothes', series: 'learn-arabic', blurb: 'Open the wardrobe and learn the Arabic words for clothes and accessories.' },
  { file: 'classroom.png', title: 'Learn Arabic Vocabulary: The Classroom', series: 'learn-arabic', blurb: 'Pencils, books and the whiteboard — classroom words in Arabic.' },
  { file: 'city.png', title: 'Learn Arabic Vocabulary: The City', series: 'learn-arabic', blurb: 'Roads, buildings and traffic lights — explore the city in Arabic.' },
  { file: 'vehicle.png', title: 'Learn Arabic Vocabulary: The Vehicles', series: 'learn-arabic', blurb: 'Cars, buses, trucks and more — learn the Arabic names of vehicles.' },
  { file: 'supermarket.png', title: 'Learn Arabic Vocabulary: The Supermarket', series: 'learn-arabic', blurb: 'Go shopping and learn the Arabic words for everything in the trolley.' },
  { file: 'park.png', title: 'Learn Arabic Vocabulary: The Park', series: 'learn-arabic', blurb: 'Ponds, trees and butterflies — a sunny day at the park in Arabic.' },
  { file: 'play.png', title: 'Learn Arabic Vocabulary: The Playground', series: 'learn-arabic', blurb: 'Swings, slides and see-saws — learn playground words in Arabic.' },
  { file: 'fun-fair.png', title: 'Learn Arabic Vocabulary: The Fun Fair', series: 'learn-arabic', blurb: 'Ferris wheels and circus tents — learn the Arabic words for a day at the fair.' },
  { file: 'beach.png', title: 'Learn Arabic Vocabulary: The Beach', series: 'learn-arabic', blurb: 'Sand, waves and palm trees — learn beach words in Arabic.' },
  { file: 'season.png', title: 'Learn Arabic Vocabulary: The Seasons', series: 'learn-arabic', blurb: 'Summer, winter, spring and autumn — learn the four seasons and the weather in Arabic.' },
  { file: 'sports.png', title: 'Learn Arabic Vocabulary: Sports', series: 'learn-arabic', blurb: 'Football, swimming, cycling — learn the Arabic names of sports.' },
  { file: 'job-s.png', title: 'Learn Arabic Vocabulary: The Jobs', series: 'learn-arabic', blurb: 'Doctors, firefighters, police officers — learn the Arabic words for jobs.' },
  { file: 'moods.png', title: 'Learn Arabic Vocabulary: The Moods', series: 'learn-arabic', blurb: 'Happy, sad, excited, sleepy — learn to name feelings in Arabic.' },
  { file: 'action.png', title: 'Learn Arabic Vocabulary: What Are They Doing?', series: 'learn-arabic', blurb: 'Jumping, reading, sleeping — learn everyday action words in Arabic.' },

  /* ── Art & Activity ── */
  { file: '1656754208-wAqwuO.png', title: '25 Prophets Mentioned in the Quran', series: 'art-and-activity', blurb: 'A step-by-step art activity to learn and remember the 25 Prophets named in the Quran.', featured: true },
  { file: '1656754309-IywCSN.png', title: 'Allah’s Name Wall Art', series: 'art-and-activity', blurb: 'Create beautiful wall art of Allah’s Name, step by step.' },
  { file: '1656754401-HdrBPx.png', title: 'Alhamdulillah For…', series: 'art-and-activity', blurb: 'A gratitude art activity: draw and write the blessings you’re thankful for.' },
  { file: '1656754469-OUJJVA.png', title: 'Asma ul Husna Lamp', series: 'art-and-activity', blurb: 'Make a glowing lamp decorated with the beautiful Names of Allah.' },
  { file: '1673620651-DLwSkk.png', title: 'Asma ul Husna Feelings Wheel', series: 'art-and-activity', blurb: 'Build a feelings wheel that links everyday emotions to the Names of Allah.' },
  { file: '1673619971-EcZXzg.png', title: 'Always Speak…', series: 'art-and-activity', blurb: 'A playful art activity about speaking kind, truthful words.' },
  { file: '1673620831-ZPEwTa.png', title: 'Eid ul Adha Greeting Card', series: 'art-and-activity', blurb: 'Make your own Eid ul Adha greeting card for family and friends.' },
  { file: '1673621021-GIoUTJ.png', title: 'Five Pillars of Islam', series: 'art-and-activity', blurb: 'Build the five pillars — Shahada, Salah, Sawm, Zakat and Hajj — in a hands-on activity.' },
  { file: '1673621453-wAkOFo.png', title: 'Islamic Months of the Year', series: 'art-and-activity', blurb: 'Make an Islamic calendar and learn the twelve Hijri months.' },
  { file: '1673622366-FWvSvD.png', title: 'Mosque Puzzle', series: 'art-and-activity', blurb: 'Colour, cut and build your own mosque puzzle.' },
  { file: '1673622633-ANeFyj.png', title: 'My First Tasbeeh', series: 'art-and-activity', blurb: 'Make your very own tasbeeh and learn the words of dhikr.' },
  { file: '1673622951-DizbaJ.png', title: 'Phases of the Moon', series: 'art-and-activity', blurb: 'Learn the phases of the moon that mark the Islamic months, with a step-by-step craft.' },
  { file: '1673623290-wXFkuT.png', title: 'Character Strength Box', series: 'art-and-activity', blurb: 'Make a box to collect and celebrate good character, one deed at a time.' },
  { file: '1673623655-dKGDbS.png', title: 'My First Sadqa Box', series: 'art-and-activity', blurb: 'Build your own charity box and start the habit of giving.' },
  { file: '1673624032-TixfRD.png', title: 'My Mini Hajj Guide', series: 'art-and-activity', blurb: 'Make a mini guide to the steps of Hajj, from Ihram to Eid.' },
  { file: '1673624460-BRrEWn.png', title: 'Words That Are Loved by Allah', series: 'art-and-activity', blurb: 'Decorate the dhikr phrases that are most beloved to Allah.' },
  { file: 'salah.png', title: 'My Salah Calendar', series: 'art-and-activity', blurb: 'Make a colourful calendar to track your five daily prayers.' },
]

/** Placeholder pricing and print specs per series (AED, VAT-inclusive). */
export const SERIES_DEFAULTS: Record<
  SeriesKey,
  { ageRange: string; language: string; pageCount: number; paperback?: number; hardcover?: number; digital: number; digitalCompareAt?: number }
> = {
  'prophet-stories': { ageRange: '4–8', language: 'English', pageCount: 32, paperback: 49, hardcover: 69, digital: 25, digitalCompareAt: 35 },
  'heroes-of-islam': { ageRange: '6–10', language: 'English', pageCount: 32, paperback: 49, hardcover: 69, digital: 25, digitalCompareAt: 35 },
  'faith-and-worship': { ageRange: '4–8', language: 'English', pageCount: 28, paperback: 39, hardcover: 59, digital: 19 },
  'good-character': { ageRange: '5–9', language: 'English', pageCount: 28, paperback: 39, hardcover: 59, digital: 19 },
  'names-of-allah': { ageRange: '5–9', language: 'English', pageCount: 24, paperback: 39, digital: 19 },
  'learn-arabic': { ageRange: '3–6', language: 'English / Arabic', pageCount: 24, paperback: 35, digital: 15 },
  'art-and-activity': { ageRange: '4–9', language: 'English', pageCount: 16, digital: 12 },
}

export const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\(saw\)|\(as\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
