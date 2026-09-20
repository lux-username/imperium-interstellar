import type { Culture } from './culture'

export const egyptian: Culture = {
  name: 'Egyptian',
  group: 'Middle Eastern',
  order: 'given-family',
  pattern: { m: '{given} {family}', f: '{given} {family}' },
  notes: "The Khedivate. `family` mixes the al-nisbas and trade names a person went by with the fixed family names that Cairo's notables and the Coptic families were starting to keep. Copts are about a tenth of each pool, as they were.",
  given: {
    m: [
      'Muhammad', 'Ahmad', 'Ali', 'Hasan', 'Husayn', 'Mahmud', 'Mustafa', 'Ibrahim', 'Ismail', 'Abdallah',
      'Abd al-Rahman', 'Abd al-Aziz', 'Abd al-Hamid', 'Abd al-Latif', 'Abd al-Majid', 'Abd al-Qadir', 'Abd al-Salam', 'Abd al-Wahhab', 'Abduh', 'Sayyid',
      'Salih', 'Sulayman', 'Uthman', 'Umar', 'Yusuf', 'Yaqub', 'Zakariya', 'Amin', 'Anwar', 'Aziz',
      'Badawi', 'Bakr', 'Farag', 'Fathi', 'Fawzi', 'Fuad', 'Hafiz', 'Hamid', 'Hamza', 'Hilmi',
      'Husni', 'Jamal', 'Kamal', 'Khalil', 'Labib', 'Lutfi', 'Mahfuz', 'Mansur', 'Muhsin', 'Mukhtar',
      'Murad', 'Mursi', 'Nabil', 'Naguib', 'Rashid', 'Riyad', 'Saad', 'Sabri', 'Sadiq', 'Salim',
      'Sami', 'Shafiq', 'Sharif', 'Shukri', 'Tahir', 'Tawfiq', 'Wahid', 'Yahya', 'Zaki', 'Ragab',
      'Ramadan', 'Shaaban', 'Bishara', 'Butrus', 'Girgis', 'Hanna', 'Mikhail', 'Wisa', 'Tadrus', 'Shenouda',
    ],
    f: [
      'Fatima', 'Aisha', 'Khadija', 'Zaynab', 'Maryam', 'Amina', 'Nafisa', 'Sayyida', 'Sakina', 'Ruqayya',
      'Umm Kulthum', 'Hafsa', 'Halima', 'Hamida', 'Hanim', 'Huda', 'Inshirah', 'Karima', 'Latifa', 'Nabawiyya',
      'Nabiha', 'Nazira', 'Nur', 'Rahma', 'Safiyya', 'Salha', 'Samira', 'Sana', 'Shafiqa', 'Sharifa',
      'Suad', 'Thuraya', 'Umm Hashim', 'Wadida', 'Zakiyya', 'Zubayda', 'Bahiyya', 'Bamba', 'Fikriyya', 'Galila',
      'Hikmat', 'Ihsan', 'Iqbal', 'Malak', 'Munira', 'Naima', 'Nargis', 'Nazli', 'Nimat', 'Qadriyya',
      'Ratiba', 'Sabiha', 'Sadiqa', 'Tafida', 'Wahiba', 'Warda', 'Zahra', 'Aziza', 'Badriyya', 'Duriyya',
      'Fawziyya', 'Firdaus', 'Hanifa', 'Jamila', 'Kamila', 'Labiba', 'Mahira', 'Nadra', 'Rasmiyya', 'Sabra',
      'Salima', 'Sitt', 'Tahiya', 'Marta', 'Damiana', 'Irini', 'Mariam', 'Tereza', 'Dimyana', 'Yustina',
    ],
  },
  family: [
    'al-Sayyid', 'al-Masri', 'al-Alfi', 'al-Shinnawi', 'al-Gazzar', 'al-Attar', 'al-Khayyat', 'al-Najjar', 'al-Haddad', 'al-Saqqa',
    'al-Sharqawi', 'al-Minyawi', 'al-Asyuti', 'al-Fayyumi', 'al-Iskandarani', 'al-Dimyati', 'al-Rashidi', 'al-Mansuri', 'al-Tantawi', 'al-Mahallawi',
    'al-Zaqaziqi', 'al-Suhagi', 'al-Qinawi', 'al-Aswani', 'al-Saidi', 'al-Sudani', 'al-Maghribi', 'al-Shami', 'al-Halabi', 'al-Turki',
    'al-Rumi', 'al-Kurdi', 'al-Hijazi', 'al-Yamani', 'al-Nubi', 'al-Bahrawi', 'al-Gharbawi', 'al-Daqahli', 'al-Manufi', 'al-Qalyubi',
    'Abu Zayd', 'Abu Bakr', 'Abu Ghazala', 'Abu Sayf', 'Abu Ismail', 'Abu Talib', 'Abu Shadi', 'Abu Hamad', 'Radwan', 'Ramadan',
    'Rizq', 'Shaaban', 'Salama', 'Mansur', 'Shahin', 'Sirag', 'Sultan', 'Suleiman', 'Abaza', 'Shukri',
    'Hamdi', 'Fahmi', 'Sabri', 'Kamil', 'Amin', 'Ghali', 'Gabra', 'Hanna', 'Mikhail', 'Rufail',
    'Wissa', 'Basili', 'Sidhom', 'Boutros', 'Girgis', 'Youssef', 'Attia', 'Bishara', 'Fanous', 'Habib',
  ],
  places: [
    'Cairo', 'Alexandria', 'Damietta', 'Rosetta', 'Port Said', 'Suez', 'Ismailia', 'Tanta', 'Mansura', 'Zagazig',
    'Mahalla', 'Damanhur', 'Kafr al-Shaykh', 'Banha', 'Shibin al-Kom', 'Fayyum', 'Beni Suef', 'Minya', 'Asyut', 'Sohag',
    'Qena', 'Luxor', 'Aswan', 'Esna', 'Edfu', 'Kom Ombo', 'Girga', 'Akhmim', 'Mallawi', 'Bulaq',
    'Giza', 'Helwan', 'Azbakiyya', 'Abukir', 'Matruh', 'Siwa', 'Bahariya', 'Dakhla', 'Kharga', 'Farafra',
    'Sinai', 'Tur', 'Qusayr', 'Nile', 'Delta', 'Said', 'Buhayra', 'Sharqiyya', 'Gharbiyya', 'Daqahliyya',
    'Minufiyya', 'Qalyubiyya', 'Muqattam', 'Wadi Natrun', 'Fustat', 'Bilbays', 'Qus', 'Nubia', 'Wadi Halfa', 'Faiyum Oasis',
  ],
}
