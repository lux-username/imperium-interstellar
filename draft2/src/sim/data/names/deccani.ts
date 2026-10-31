import type { Community, Culture } from './culture'

const marathiM = [
  'Balwant', 'Vishnu', 'Ganesh', 'Gopal', 'Narayan', 'Vinayak', 'Gangadhar', 'Mahadev', 'Jyotirao', 'Jagannath',
  'Sakharam', 'Dadoba', 'Bhaskar', 'Keshav', 'Damodar', 'Vasudev', 'Ramchandra', 'Krishnaji', 'Shankar', 'Trimbak',
  'Moreshwar', 'Hari', 'Dattatreya', 'Yashwant', 'Raghunath', 'Bapu', 'Nana', 'Tatya', 'Appa', 'Bhau',
  'Ganpat', 'Govind', 'Kashinath', 'Laxman', 'Narhar', 'Pandurang', 'Purushottam', 'Sadashiv', 'Shivram', 'Waman',
]
const marathiF = [
  'Savitribai', 'Ramabai', 'Anandibai', 'Rakhmabai', 'Kashibai', 'Parvatibai', 'Yamunabai', 'Tarabai', 'Gangabai', 'Radhabai',
  'Laxmibai', 'Bhagirathibai', 'Jankibai', 'Sitabai', 'Rukminibai', 'Godavaribai', 'Tanubai', 'Manubai', 'Umabai', 'Krishnabai',
  'Bhimabai', 'Durgabai', 'Saraswatibai', 'Ahilyabai', 'Yesubai', 'Sagunabai', 'Chimnabai', 'Girijabai', 'Indirabai', 'Kamalabai',
  'Malatibai', 'Mathurabai', 'Nirmalabai', 'Padmabai', 'Shantabai', 'Sonabai', 'Sundarabai', 'Venubai', 'Vimalabai',
]
const marathiFamily = [
  'Patil', 'Deshmukh', 'Deshpande', 'Kulkarni', 'Joshi', 'Jadhav', 'Pawar', 'Shinde', 'Bhosale', 'Gaikwad',
  'More', 'Salunkhe', 'Chavan', 'Kadam', 'Mane', 'Sawant', 'Naik', 'Ranade', 'Gokhale', 'Tilak',
  'Agarkar', 'Chiplunkar', 'Phule', 'Karve', 'Bhandarkar', 'Apte', 'Godbole', 'Limaye', 'Paranjape', 'Sathe',
  'Vaidya', 'Kelkar', 'Damle', 'Ghorpade', 'Nimbalkar', 'Dabholkar', 'Mahajan', 'Wagh', 'Bhagwat', 'Sardesai',
  'Gupta', 'Desai', 'Kotwal',
]

const southernM = [
  'Venkata', 'Subba Rao', 'Rama Rao', 'Krishna Rao', 'Narasimha', 'Venkataramana', 'Seshagiri', 'Veeresalingam', 'Apparao', 'Nagabhushanam',
  'Ranga', 'Raghava', 'Subrahmanya', 'Seshayya', 'Basavappa', 'Ningappa', 'Lingappa', 'Mallappa', 'Siddappa', 'Timmappa',
  'Hanumantha', 'Chennappa', 'Venkatappa', 'Kempegowda', 'Ramaswamy', 'Srinivasa',
]
const southernF = [
  'Lakshmamma', 'Venkamma', 'Subbamma', 'Ramamma', 'Seethamma', 'Rajamma', 'Chennamma', 'Nagamma', 'Kamalamma', 'Gowramma',
  'Bhagyamma', 'Puttamma', 'Sharadamma', 'Saraswathamma', 'Rukminamma', 'Ratnamma', 'Manikyamma', 'Padmamma', 'Sarojamma', 'Jayamma',
  'Anasuya', 'Bangaramma', 'Durgamma', 'Gangamma', 'Hanumamma', 'Kanakamma', 'Lalithamma', 'Muniyamma', 'Nanjamma', 'Parvathamma',
]
const southernFamily = [
  'Reddy', 'Naidu', 'Rao', 'Chowdary', 'Gowda', 'Hegde', 'Shetty', 'Nayak', 'Pantulu', 'Sastri',
  'Achar', 'Bhat', 'Kamath', 'Pai', 'Prabhu', 'Setty', 'Varma', 'Raju', 'Iyengar', 'Murthy',
  'Pillai',
]

const muslimM = [
  'Mir Osman', 'Mahbub Ali', 'Afzal', 'Turab Ali', 'Mir Alam', 'Abdul Qadir', 'Muhammad Ali', 'Ghulam Yazdani', 'Sikandar', 'Fakhruddin',
  'Karimuddin', 'Moinuddin', 'Nizamuddin', 'Khaja',
]
const muslimF = [
  'Chand Bibi', 'Fatima', 'Zainab', 'Amtul', 'Sultan Begum', 'Hayat', 'Mahlaqa', 'Zeenat', 'Nur', 'Sajida',
  'Wahida',
]
const muslimFamily = [
  'Khan', 'Mirza', 'Sayyid', 'Sheikh', 'Qureshi', 'Jung', 'Mohiuddin', 'Nawaz', 'Baig', 'Pasha',
  'Yar Khan', 'Ali Khan', 'Hussaini', 'Bilgrami', 'Zaidi', 'Siddiqi',
]

/** Each community's names pair only with its own; the flat pools below are the union. */
const communities: Community[] = [
  { name: 'Marathi', weight: 2, given: { m: marathiM, f: marathiF }, family: marathiFamily },
  { name: 'Telugu and Kannada', weight: 2, given: { m: southernM, f: southernF }, family: southernFamily },
  { name: 'Dakhni Muslim', weight: 1, given: { m: muslimM, f: muslimF }, family: muslimFamily },
]

export const deccani: Culture = {
  name: 'Deccani',
  group: 'South Asian',
  order: 'given-family',
  pattern: { m: '{given} {family}', f: '{given} {family}' },
  notes: "The Deccan plateau: Marathi country (women's names in -bai), the Telugu and Kannada south (-amma), and the Dakhni Muslim court at Hyderabad. Roughly two-fifths, two-fifths, one-fifth, and the pools are split that way so that a given name and a family name always come from the same community.",
  communities,
  given: {
    m: communities.flatMap((c) => c.given.m),
    f: communities.flatMap((c) => c.given.f),
  },
  family: communities.flatMap((c) => c.family),
  places: [
    'Poona', 'Bombay', 'Satara', 'Kolhapur', 'Nasik', 'Ahmednagar', 'Aurangabad', 'Sholapur', 'Bijapur', 'Gulbarga',
    'Bidar', 'Hyderabad', 'Golconda', 'Secunderabad', 'Warangal', 'Nizamabad', 'Kurnool', 'Bellary', 'Raichur', 'Dharwar',
    'Belgaum', 'Hubli', 'Bangalore', 'Mysore', 'Seringapatam', 'Tumkur', 'Chitradurga', 'Shimoga', 'Hampi', 'Anantapur',
    'Cuddapah', 'Nellore', 'Guntur', 'Masulipatam', 'Rajahmundry', 'Vizagapatam', 'Nagpur', 'Wardha', 'Amravati', 'Akola',
    'Jalna', 'Parbhani', 'Nanded', 'Latur', 'Pandharpur', 'Daulatabad', 'Ellora', 'Ajanta', 'Sinhagad', 'Raigad',
    'Pratapgad', 'Panhala', 'Mahabaleshwar', 'Godavari', 'Krishna', 'Bhima', 'Tungabhadra', 'Kaveri', 'Manjira', 'Penner',
    'Sahyadri', 'Balaghat', 'Nallamala', 'Konkan', 'Marathwada', 'Telangana', 'Rayalaseema', 'Berar',
  ],
}
