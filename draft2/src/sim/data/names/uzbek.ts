import type { Culture } from './culture'

export const uzbek: Culture = {
  name: 'Uzbek',
  group: 'Central Asian',
  order: 'given-family',
  pattern: { m: "{given} {father} o'g'li", f: '{given} {father} qizi' },
  notes: "The khanates — Bukhara, Khiva, Kokand — and Russian Turkestan. Names were patronymic (o'g'li, son of; qizi, daughter of), which the pattern uses. `family` holds the classical nisbas (Buxoriy, Samarqandiy) and the titles and epithets (Mirzo, Xo'ja, Hoji) a settled man might be known by, for the generator's use where a patronymic is not enough.",
  given: {
    m: [
      'Abdulla', 'Abdurahmon', 'Abdulqodir', 'Abdulaziz', 'Abduhakim', 'Ahmad', 'Alisher', 'Anvar', 'Asqar', 'Bahodir',
      'Baxtiyor', 'Bobur', 'Botir', 'Davron', 'Dilshod', 'Erkin', 'Farhod', 'Fayzulla', "G'ani", "G'ulom",
      'Hamid', 'Hasan', 'Husayn', 'Ibrohim', 'Ilhom', 'Iskandar', 'Islom', 'Ismoil', 'Jahongir', 'Jalol',
      'Jamshid', "Jo'ra", 'Kamol', 'Karim', 'Komil', 'Mahmud', 'Mansur', 'Mirzo', 'Muhammad', 'Muhiddin',
      'Murod', 'Muso', 'Mustafo', 'Nasrullo', 'Nazar', "Ne'mat", 'Nodir', 'Nosir', 'Nurulla', 'Odil',
      'Olim', 'Orif', 'Otabek', 'Qodir', 'Qosim', 'Qudrat', 'Rahim', 'Rahmat', 'Rashid', 'Rustam',
      "Sa'dulla", 'Said', 'Salim', 'Sharif', 'Shavkat', 'Sherali', 'Shokir', 'Sodiq', 'Sulton', 'Tohir',
      'Tursun', "Ulug'bek", 'Umar', 'Usmon', 'Vali', 'Xudoyberdi', "Yo'ldosh", 'Yusuf', 'Zafar', 'Zokir',
    ],
    f: [
      'Fotima', 'Zaynab', 'Oysha', 'Xadicha', 'Maryam', 'Sora', 'Robiya', 'Sakina', 'Zuhra', 'Gulnora',
      'Gulbahor', 'Gulchehra', 'Guljahon', 'Gulnoz', 'Gulsara', 'Gulshan', 'Dilbar', 'Dilorom', 'Dilnoza', 'Dilafruz',
      'Mohira', 'Mohinur', 'Munira', 'Nafisa', 'Nargiza', 'Nasiba', 'Nigora', 'Nilufar', 'Nodira', 'Nozima',
      'Ozoda', 'Rano', 'Risolat', 'Ruxsora', 'Sabohat', 'Saida', 'Salima', 'Sanam', 'Sarvinoz', 'Shahlo',
      'Shahnoza', 'Shirin', 'Shoira', 'Sitora', 'Tursunoy', 'Umida', 'Xurshida', 'Yulduz', 'Zebo', 'Zebuniso',
      'Zulfiya', 'Zulayho', 'Anora', 'Asal', 'Barno', 'Bibisora', 'Bibixon', 'Feruza', 'Hakima', 'Halima',
      'Hosiyat', 'Iqbol', 'Jamila', 'Karima', 'Latifa', 'Lola', 'Madina', 'Mahbuba', 'Malika', 'Manzura',
      'Mastura', 'Muxabbat', 'Muattar', 'Oygul', 'Oynisa', 'Rahima', 'Rohat', 'Sadoqat', 'Tojixon', 'Zarifa',
    ],
  },
  family: [
    'Buxoriy', 'Samarqandiy', 'Xivaliy', 'Toshkandiy', "Farg'oniy", 'Andijoniy', 'Namangoniy', "Qo'qoniy", "Marg'iloniy", 'Shahrisabziy',
    'Termiziy', 'Qarshiy', 'Urganchiy', "Xo'jandiy", "O'ratepaliy", 'Jizzaxiy', 'Kattaqo\'rg\'oniy', 'Chustiy', 'Kosoniy', 'Nasafiy',
    'Keshiy', 'Xorazmiy', 'Sug\'diy', 'Turkistoniy', 'Chimkentiy', 'Sayramiy', 'Avliyootaliy', 'Mirzo', "Xo'ja", 'Eshon',
    "So'fi", 'Hoji', 'Mulla', 'Qori', 'Bek', 'Boy', 'Bobo', 'Ota', "To'ra", 'Sayyid',
    'Sarkor', 'Oqsoqol', 'Mingboshi', 'Yuzboshi', "Qo'rboshi", 'Devonbegi', 'Qushbegi', 'Mirob', 'Kotib', 'Munshi',
    'Attor', 'Bazzoz', 'Zargar', 'Temirchi', 'Kulol', 'Duradgor', 'Nonvoy', 'Qassob', 'Sarrof', "Bog'bon",
    'Dehqon', 'Chorvador', 'Karvonboshi', 'Savdogar', 'Tabib', 'Mudarris', 'Imom', "Mo'azzin", 'Xattot', 'Naqqosh',
    'Kulohdo\'z', 'Etikdo\'z', "To'qimachi", 'Ipakchi', 'Paxtakor', 'Tuyachi', 'Otboqar', 'Ovchi', 'Baliqchi', 'Qayiqchi',
  ],
  places: [
    'Buxoro', 'Samarqand', 'Xiva', 'Toshkent', "Qo'qon", "Farg'ona", 'Andijon', 'Namangan', "Marg'ilon", 'Shahrisabz',
    'Termiz', 'Qarshi', 'Urganch', "Xo'jand", "O'ratepa", 'Jizzax', "Kattaqo'rg'on", 'Chust', 'Koson', 'Nasaf',
    'Kesh', 'Xorazm', "Sug'd", 'Turkiston', 'Chimkent', 'Sayram', 'Avliyoota', 'Xonobod', "Pop", "Kanibodom",
    'Isfara', "Qorako'l", "G'ijduvon", 'Vobkent', 'Romitan', 'Nurota', 'Zomin', 'Baxmal', "G'uzor", 'Boysun',
    'Denov', 'Sherobod', "Ko'hitang", 'Zarafshon', 'Amudaryo', 'Sirdaryo', "Qashqadaryo", 'Surxondaryo', 'Chirchiq', 'Ohangaron',
    'Qizilqum', 'Orol', 'Ustyurt', 'Hisor', 'Chatqol', 'Xazorasp', "Mirzacho'l", 'Movarounnahr', "Sog'diyona", 'Baqtriya',
  ],
}
