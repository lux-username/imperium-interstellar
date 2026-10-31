import type { Culture } from './culture'

export const kazakh: Culture = {
  name: 'Kazakh',
  group: 'Central Asian',
  order: 'given-family',
  pattern: { m: '{given} {father}uly', f: '{given} {father}qyzy' },
  notes: "The steppe under Russian rule, before the surname decrees. Names were patronymic — -uly, son of; -qyzy, daughter of — which the pattern uses. `family` holds the clan names (ru) of the three hordes, which a Kazakh would give before a stranger asked anything else; a generator may use one as a settled name.",
  given: {
    m: [
      'Abai', 'Shoqan', 'Ybyrai', 'Kenesary', 'Abylai', 'Bogenbai', 'Qabanbai', 'Nauryzbai', 'Zhanibek', 'Kasym',
      'Esim', 'Tauke', 'Amangeldi', 'Alikhan', 'Akhmet', 'Mirzhakyp', 'Saken', 'Ilyas', 'Beimbet', 'Mukhtar',
      'Gabit', 'Sabit', 'Zhambyl', 'Birzhan', 'Akan', 'Estai', 'Ibrai', 'Kurmangazy', 'Dauletkerei', 'Tattimbet',
      'Nurzhan', 'Nurlan', 'Nurbol', 'Bekbolat', 'Bolat', 'Serik', 'Serikbol', 'Erlan', 'Ermek', 'Erbol',
      'Erzhan', 'Bakyt', 'Baurzhan', 'Daulet', 'Dosym', 'Zhaksybai', 'Zhaksylyk', 'Zhanat', 'Zhumabek', 'Kairat',
      'Kanat', 'Kuanysh', 'Marat', 'Maksat', 'Murat', 'Nurbek', 'Orazbek', 'Oraz', 'Otegen', 'Raiymbek',
      'Sagyndyk', 'Sarsen', 'Seitkali', 'Talgat', 'Temirbek', 'Temir', 'Tolegen', 'Toleu', 'Tursyn', 'Zhanbolat',
      'Zhandos', 'Zhaqsybek', 'Aitbai', 'Alibek', 'Askar', 'Aidar', 'Baibek', 'Bekzhan', 'Berik', 'Kunanbai',
    ],
    f: [
      'Aigerim', 'Aisulu', 'Aizhan', 'Aigul', 'Ainur', 'Akbota', 'Akmaral', 'Aliya', 'Altynai', 'Anar',
      'Asel', 'Bayan', 'Balzhan', 'Bibigul', 'Botagoz', 'Dana', 'Dariga', 'Dina', 'Dinara', 'Gaukhar',
      'Gulnar', 'Gulmira', 'Gulzhan', 'Zhanar', 'Zhibek', 'Zhuldyz', 'Zere', 'Kamshat', 'Karlygash', 'Kulyash',
      'Kunsulu', 'Lyazzat', 'Madina', 'Makpal', 'Maral', 'Mariyam', 'Meiramgul', 'Nazgul', 'Nurgul', 'Perizat',
      'Raushan', 'Saltanat', 'Samal', 'Saule', 'Sholpan', 'Tolkyn', 'Toty', 'Ulbolsyn', 'Ulzhan', 'Umit',
      'Urker', 'Zauresh', 'Zhamal', 'Zhansaya', 'Zhazira', 'Zhumagul', 'Akerke', 'Akzhan', 'Alua', 'Ardak',
      'Asem', 'Balkiya', 'Bakytgul', 'Batima', 'Damira', 'Dametken', 'Fariza', 'Gulbanu', 'Gulsim', 'Kalamkas',
      'Kanshaiym', 'Kunimzhan', 'Marzhan', 'Nurzhamal', 'Orazgul', 'Rabiga', 'Rakhima', 'Shara', 'Tursynai', 'Zeinep',
    ],
  },
  family: [
    'Dulat', 'Alban', 'Suan', 'Zhalaiyr', 'Kangly', 'Shanyshkyly', 'Ysty', 'Oshakty', 'Sirgeli', 'Shaprashty',
    'Sary-Uisin', 'Botpai', 'Shymyr', 'Siqym', 'Zhanys', 'Kyzylborik', 'Konyrborik', 'Aitbozym', 'Argyn', 'Naiman',
    'Kerei', 'Kipchak', 'Uak', 'Konyrat', 'Karakesek', 'Tobykty', 'Kuandyk', 'Suyindik', 'Begendik', 'Shegendik',
    'Taraqty', 'Kanzhygaly', 'Atygai', 'Karauyl', 'Basentiin', 'Abak', 'Ashamaily', 'Baltaly', 'Bagynaly', 'Matai',
    'Sadyr', 'Karakerei', 'Sarzhomart', 'Tortuyl', 'Kulboldy', 'Bura', 'Kotenshi', 'Bozhban', 'Zhetimder', 'Kuldeke',
    'Tanbaly', 'Toksaba', 'Uzun', 'Karabalyk', 'Kytai', 'Sarykytai', 'Adai', 'Alimuly', 'Baiuly', 'Zhetiru',
    'Tabyn', 'Tama', 'Kerderi', 'Kereit', 'Zhagalbaily', 'Telau', 'Shekty', 'Kete', 'Karasakal', 'Tortkara',
    'Shomekei', 'Sherkesh', 'Ysyk', 'Taz', 'Baibakty', 'Berish', 'Altyn', 'Zhappas', 'Esentemir', 'Tana',
  ],
  places: [
    'Semei', 'Verny', 'Akmola', 'Kokshetau', 'Petropavl', 'Pavlodar', 'Oskemen', 'Zaisan', 'Ayagoz', 'Karkaraly',
    'Bayanaul', 'Turkistan', 'Shymkent', 'Aulie-Ata', 'Taraz', 'Sairam', 'Otrar', 'Sygnak', 'Sauran', 'Perovsk',
    'Kazaly', 'Aral', 'Torgai', 'Irgiz', 'Aktobe', 'Oral', 'Atyrau', 'Mangyshlak', 'Zhezkazgan', 'Ulytau',
    'Balkhash', 'Zhetysu', 'Saryarka', 'Betpak-Dala', 'Kyzylkum', 'Karakum', 'Ustyurt', 'Mugalzhar', 'Altai', 'Tarbagatai',
    'Alatau', 'Zhungar Alatau', 'Karatau', 'Irtysh', 'Ishim', 'Tobol', 'Ural', 'Emba', 'Syr Darya', 'Chu',
    'Ili', 'Talas', 'Nura', 'Sarysu', 'Alakol', 'Tengiz', 'Burabai', 'Kokpekty', 'Lepsy', 'Kapal',
  ],
}
