import type { Culture } from './culture'

export const uyghur: Culture = {
  name: 'Uyghur',
  group: 'Central Asian',
  order: 'given-family',
  pattern: { m: '{given} {father} oghli', f: '{given} {father} qizi' },
  notes: "The Tarim oases — Kashgar, Yarkand, Khotan — and the Ili valley in the Qing and emirate decades. Patronymic like its neighbours. `family` holds the oasis nisbas (Qeshqeri, Yerkendi), the religious and civil titles (Axun, Beg, Haji) and the trade names (Tömürchi, Ötükchi) a townsman was known by.",
  given: {
    m: [
      'Abdulla', 'Abdurahman', 'Abduweli', 'Ablet', 'Ahmet', 'Alim', 'Anwar', 'Arslan', 'Batur', 'Dawut',
      'Erkin', 'Ghopur', 'Hesen', 'Husen', 'Ibrahim', 'Ilham', 'Imin', 'Ismail', 'Iskender', 'Jappar',
      'Kamal', 'Kerim', 'Mahmut', 'Memet', 'Memtimin', 'Mirzahid', 'Musa', 'Nurmemet', 'Osman', 'Ötkür',
      'Polat', 'Qadir', 'Qasim', 'Rehim', 'Rozi', 'Sabir', 'Sadiq', 'Seyit', 'Sidiq', 'Sultan',
      'Tahir', 'Tursun', 'Turdi', 'Turghun', 'Yaqub', 'Yasin', 'Yolwas', 'Yusup', 'Zakir', 'Zunun',
      'Abliz', 'Adil', 'Ekber', 'Emet', 'Eli', 'Ghalip', 'Hamid', 'Hebib', 'Jelil', 'Kurban',
      'Litip', 'Mijit', 'Muhter', 'Nijat', 'Obul', 'Pazil', 'Perhat', 'Rahman', 'Sattar', 'Semet',
      'Shakir', 'Talip', 'Tewekkül', 'Toxti', 'Wahap', 'Zeydin', 'Abdukérim', 'Abduréshit', 'Dolqun', 'Niyaz',
    ],
    f: [
      'Ayshem', 'Patime', 'Zeynep', 'Meryem', 'Xedichem', 'Reyhan', 'Gülnar', 'Gülbahar', 'Gülchehre', 'Gülnisa',
      'Gülsüm', 'Gülzar', 'Amine', 'Anargül', 'Aygül', 'Ayhan', 'Aynur', 'Buwi', 'Dilber', 'Dilnur',
      'Dilnaz', 'Hajar', 'Hüsniye', 'Jemile', 'Kerime', 'Latipe', 'Mahire', 'Mehbube', 'Menzire', 'Mihrigül',
      'Munire', 'Nadire', 'Nazire', 'Nurgül', 'Nurnisa', 'Patigül', 'Perizat', 'Rabiye', 'Rahile', 'Raziye',
      'Rizwangül', 'Roshen', 'Sajide', 'Salime', 'Saniye', 'Shemsiye', 'Tursungül', 'Zohre', 'Zülpiye', 'Zumret',
      'Adalet', 'Arzugül', 'Asiye', 'Bahargül', 'Bostan', 'Chimengül', 'Dilxumar', 'Halide', 'Helime', 'Hesiyet',
      'Iqbal', 'Kamile', 'Mahinur', 'Merhaba', 'Mestüre', 'Muqeddes', 'Nurhan', 'Qurbangül', 'Rahime', 'Sakine',
      'Seyide', 'Shahide', 'Tajigül', 'Turnisa', 'Ziba', 'Zulhumar', 'Zeynepgül', 'Ayperi', 'Gülayim', 'Xanzade',
    ],
  },
  family: [
    'Qeshqeri', 'Yerkendi', 'Xoteni', 'Aqsuluq', 'Kuchari', 'Turpanliq', 'Qumulluq', 'Ghuljiliq', 'Atushluq', 'Yengisarliq',
    'Poskamliq', 'Qaghiliqliq', 'Gumaliq', 'Keriyeliq', 'Niyaliq', 'Cherchenlik', 'Korliliq', 'Bügürlük', 'Shayarliq', 'Bayliq',
    'Uchturpanliq', 'Maralbeshilik', 'Kelpinlik', 'Tashqurghanliq', 'Toksunluq', 'Pichanliq', 'Lükchünlük', 'Barkölük', 'Qarasheherlik', 'Lopluq',
    'Haji', 'Molla', 'Axun', 'Beg', 'Hakim', 'Ishan', 'Sopi', 'Qazi', 'Damolla', 'Mupti',
    'Sheyx', 'Bay', 'Xoja', 'Seyit', 'Mirza', 'Yüzbeshi', 'Mingbeshi', 'Onbeshi', 'Aqsaqal', 'Mirab',
    'Tömürchi', 'Bezzaz', 'Ötükchi', 'Naway', 'Qassap', 'Sarrap', 'Attar', 'Baghwen', 'Dehqan', 'Zerger',
    'Kulal', 'Toqumchi', 'Yipekchi', 'Kigizchi', 'Boyaqchi', 'Tashchi', 'Yaghachchi', 'Ashpez', 'Chaychi', 'Karwanbeshi',
    'Sodiger', 'Tewip', 'Xettat', 'Neqqash', 'Sazchi', 'Dapchi', 'Ovchi', 'Béliqchi', 'Tögichi', 'Atbaqar',
  ],
  places: [
    'Kashgar', 'Yarkand', 'Khotan', 'Aksu', 'Kucha', 'Turpan', 'Qumul', 'Ghulja', 'Atush', 'Yengisar',
    'Poskam', 'Karghilik', 'Guma', 'Keriya', 'Niya', 'Cherchen', 'Charklik', 'Korla', 'Bugur', 'Shayar',
    'Bai', 'Uchturpan', 'Maralbeshi', 'Kelpin', 'Tashkurgan', 'Sariqol', 'Toksun', 'Pichan', 'Lukchun', 'Barkol',
    'Qarasheher', 'Lop', 'Tarim', 'Tekes', 'Kunges', 'Id Kah', 'Taklamakan', 'Kunlun', 'Pamir', 'Muztagh Ata',
    'Bogda', 'Tengritagh', 'Altishahr', 'Zungharia', 'Ili', 'Lop Nur', 'Bosten', 'Sayram', 'Muzart', 'Torugart',
    'Irkeshtam', 'Opal', 'Artush', 'Tashmiliq', 'Yopurgha', 'Peyziwat', 'Awat', 'Xoshut', 'Qaraqash', 'Yurungqash',
  ],
}
