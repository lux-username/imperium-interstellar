/**
 * Ship names, one pool per hull class, in the naming tradition of a
 * nineteenth-century blue-water navy carried into space: the same
 * themes an Admiralty would keep using once its hulls left the water.
 * Every name is ours to use — a quality, a beast, a river, a bird, an old
 * region — none is a ship famous in its own right or borrowed from any
 * setting. A name is used once per game; if a pool ever runs dry the
 * generator numbers the reuse (Vigilant II) as navies do.
 *
 *  - patrol:    the line of battle — qualities, classical figures, and
 *               the same grandeur found in the sky (Meridian, Perihelion).
 *  - escort:    the destroyer tradition — weapons, hunting beasts, weather,
 *               and the brisk adjectives of small warships.
 *  - transport: the auxiliaries — home rivers, and the "Empire X" names a
 *               ministry of transport gives hulls it builds in a hurry.
 *  - scout:     the survey and despatch tradition — birds, instruments of
 *               navigation, messengers, and the exploring verbs.
 *  - raider:    what pirates call their ships — bravado, bad jokes about
 *               money, and the old freebooters' names.
 *  - packet:    the mail steamers — old regions in their Latin form, and
 *               the virtues of a timetable.
 */
export type NamedHull = 'patrol' | 'escort' | 'transport' | 'scout' | 'raider' | 'packet'

export const SHIP_NAMES: Record<NamedHull, string[]> = {
  patrol: [
    // Qualities
    'Vigilant', 'Steadfast', 'Resolute', 'Indefatigable', 'Invincible', 'Indomitable', 'Implacable', 'Inflexible', 'Irresistible', 'Illustrious',
    'Formidable', 'Magnificent', 'Majestic', 'Glorious', 'Courageous', 'Audacious', 'Valiant', 'Vanguard', 'Vengeance', 'Venerable',
    'Victorious', 'Renown', 'Repulse', 'Revenge', 'Resolution', 'Defiance', 'Defence', 'Dauntless', 'Dreadnought', 'Fearless',
    'Intrepid', 'Relentless', 'Redoubtable', 'Superb', 'Sovereign', 'Triumph', 'Temeraire', 'Thunderer', 'Terrible', 'Tremendous',
    'Powerful', 'Impregnable', 'Conqueror', 'Colossus', 'Centurion', 'Champion', 'Monarch', 'Emperor', 'Empress', 'Ardent',
    'Bulwark', 'Rampart', 'Bastion', 'Citadel', 'Fortitude', 'Constancy', 'Perseverance', 'Endurance', 'Tenacity', 'Prudence',
    'Justice', 'Concord', 'Unity', 'Fidelity', 'Loyalty', 'Honour', 'Glory', 'Splendour', 'Valour', 'Prowess',
    'Warspite', 'Unconquered', 'Undaunted', 'Unyielding', 'Unbending', 'Inexorable', 'Insuperable', 'Invulnerable', 'Imperious', 'Magnanimous',
    // Classical
    'Ajax', 'Achilles', 'Agamemnon', 'Bellerophon', 'Orion', 'Neptune', 'Mars', 'Minerva', 'Jupiter', 'Juno',
    'Saturn', 'Hercules', 'Theseus', 'Perseus', 'Hector', 'Ulysses', 'Nestor', 'Diomede', 'Andromeda', 'Cassiopeia',
    'Polyphemus', 'Cyclops', 'Hyperion', 'Helios', 'Prometheus', 'Atlas', 'Leviathan', 'Behemoth', 'Goliath', 'Juggernaut',
    // The sky
    'Meridian', 'Zenith', 'Perihelion', 'Aphelion', 'Corona', 'Firmament', 'Empyrean', 'Ecliptic', 'Equinox', 'Solstice',
    'Eclipse', 'Sunburst', 'Aurora', 'Phoebus', 'Sunward', 'Starward', 'Circumpolar', 'Antares', 'Arcturus', 'Aldebaran',
  ],
  escort: [
    // Weapons
    'Scimitar', 'Cutlass', 'Sabre', 'Rapier', 'Broadsword', 'Claymore', 'Dagger', 'Dirk', 'Lance', 'Javelin',
    'Halberd', 'Pike', 'Spear', 'Arrow', 'Bolt', 'Harpoon', 'Trident', 'Mace', 'Musket', 'Carbine',
    'Culverin', 'Falconet', 'Petard', 'Bombard', 'Buckler', 'Gauntlet', 'Visor', 'Partisan', 'Glaive', 'Poniard',
    'Stiletto', 'Falchion', 'Estoc', 'Tomahawk', 'Boomerang', 'Sling', 'Crossbow', 'Longbow', 'Ballista', 'Catapult',
    // Beasts
    'Greyhound', 'Wolfhound', 'Foxhound', 'Staghound', 'Mastiff', 'Bulldog', 'Terrier', 'Lurcher', 'Basilisk', 'Griffin',
    'Wyvern', 'Hydra', 'Chimera', 'Kraken', 'Leopard', 'Lynx', 'Panther', 'Puma', 'Jaguar', 'Tiger',
    'Lion', 'Lioness', 'Wolf', 'Jackal', 'Cougar', 'Wildcat', 'Ocelot', 'Cheetah', 'Serval', 'Caracal',
    'Wolverine', 'Badger', 'Marten', 'Polecat', 'Stoat', 'Weasel', 'Ferret', 'Mongoose', 'Viper', 'Adder',
    'Cobra', 'Python', 'Anaconda', 'Scorpion', 'Hornet', 'Wasp', 'Gadfly', 'Dragonfly', 'Mantis', 'Tarantula',
    // Weather
    'Tempest', 'Typhoon', 'Cyclone', 'Hurricane', 'Tornado', 'Whirlwind', 'Squall', 'Gale', 'Thunder', 'Lightning',
    'Blizzard', 'Hailstorm', 'Sirocco', 'Mistral', 'Monsoon', 'Levanter', 'Simoom', 'Harmattan', 'Chinook', 'Tramontane',
    'Meteor', 'Bolide', 'Firebolt', 'Flare', 'Solar Wind', 'Sunspot', 'Coronal', 'Tailwind', 'Crosswind', 'Headwind',
    // Brisk adjectives
    'Active', 'Alert', 'Brisk', 'Lively', 'Nimble', 'Sprightly', 'Rapid', 'Ready', 'Eager', 'Fervent',
    'Fierce', 'Ferocious', 'Savage', 'Grim', 'Stern', 'Sturdy', 'Stalwart', 'Hardy', 'Spirited', 'Zealous',
    'Vehement', 'Vivacious', 'Vigorous', 'Wakeful', 'Watchful', 'Wary', 'Restless', 'Tireless', 'Sleepless', 'Prompt',
  ],
  transport: [
    // Home rivers
    'Thames', 'Severn', 'Trent', 'Mersey', 'Humber', 'Tyne', 'Tees', 'Tamar', 'Medway', 'Avon',
    'Clyde', 'Forth', 'Tay', 'Dee', 'Tweed', 'Wye', 'Usk', 'Shannon', 'Liffey', 'Boyne',
    'Bann', 'Foyle', 'Ouse', 'Derwent', 'Exe', 'Tavy', 'Dart', 'Teign', 'Itchen', 'Test',
    'Arun', 'Stour', 'Orwell', 'Deben', 'Wensum', 'Yare', 'Nene', 'Welland', 'Witham', 'Ribble',
    'Lune', 'Eden', 'Wear', 'Coquet', 'Aln', 'Spey', 'Don', 'Ness', 'Lossie', 'Tummel',
    'Garry', 'Teviot', 'Ettrick', 'Annan', 'Nith', 'Cree', 'Conwy', 'Towy', 'Teifi', 'Dovey',
    'Mawddach', 'Rheidol', 'Taff', 'Ebbw', 'Rhymney', 'Lagan', 'Blackwater', 'Suir', 'Nore', 'Barrow',
    'Slaney', 'Lee', 'Moy', 'Erne', 'Corrib', 'Kennet', 'Cherwell', 'Windrush', 'Evenlode', 'Thame',
    'Loddon', 'Wandle', 'Lea', 'Colne', 'Roding', 'Crouch', 'Chelmer', 'Waveney', 'Bure', 'Ant',
    // Hulls the Empire builds in a hurry
    'Empire Hope', 'Empire Faith', 'Empire Trust', 'Empire Dawn', 'Empire Star', 'Empire Light', 'Empire Bond', 'Empire Guard', 'Empire Pride', 'Empire Strength',
    'Empire Harvest', 'Empire Granary', 'Empire Plenty', 'Empire Provider', 'Empire Bounty', 'Empire Carrier', 'Empire Haulier', 'Empire Bearer', 'Empire Porter', 'Empire Steward',
    'Empire Anchorage', 'Empire Haven', 'Empire Harbour', 'Empire Roadstead', 'Empire Landing', 'Empire Quay', 'Empire Wharf', 'Empire Mooring', 'Empire Lodestar', 'Empire Beacon',
    // Bays and reaches
    'Torbay', 'Lyme Bay', 'Mounts Bay', 'Cardigan Bay', 'Morecambe Bay', 'Bantry Bay', 'Galway Bay', 'Dundalk Bay', 'Whitby Reach', 'Gravesend Reach',
  ],
  scout: [
    // Birds
    'Kestrel', 'Merlin', 'Peregrine', 'Goshawk', 'Sparrowhawk', 'Osprey', 'Kite', 'Harrier', 'Falcon', 'Hobby',
    'Buzzard', 'Curlew', 'Plover', 'Lapwing', 'Sandpiper', 'Snipe', 'Woodcock', 'Petrel', 'Fulmar', 'Shearwater',
    'Gannet', 'Cormorant', 'Tern', 'Skua', 'Kittiwake', 'Puffin', 'Guillemot', 'Razorbill', 'Swift', 'Swallow',
    'Martin', 'Nightjar', 'Wheatear', 'Redwing', 'Fieldfare', 'Starling', 'Linnet', 'Siskin', 'Redpoll', 'Goldcrest',
    'Firecrest', 'Wren', 'Dipper', 'Kingfisher', 'Heron', 'Bittern', 'Egret', 'Crane', 'Stork', 'Widgeon',
    'Teal', 'Pintail', 'Shoveler', 'Gadwall', 'Pochard', 'Goldeneye', 'Merganser', 'Smew', 'Whimbrel', 'Godwit',
    'Dunlin', 'Turnstone', 'Sanderling', 'Oystercatcher', 'Avocet', 'Dotterel', 'Chough', 'Raven', 'Rook', 'Jackdaw',
    'Magpie', 'Jay', 'Cuckoo', 'Hoopoe', 'Wryneck', 'Nightingale', 'Skylark', 'Woodlark', 'Pipit', 'Wagtail',
    // Instruments of navigation
    'Sextant', 'Astrolabe', 'Quadrant', 'Compass', 'Lodestar', 'Lodestone', 'Almanac', 'Chronometer', 'Theodolite', 'Azimuth',
    'Nadir', 'Parallax', 'Ephemeris', 'Transit', 'Occultation', 'Plumbline', 'Leadline', 'Logline', 'Traverse', 'Bearing',
    // Messengers and winds
    'Mercury', 'Hermes', 'Iris', 'Echo', 'Zephyr', 'Boreas', 'Notus', 'Eurus', 'Aeolus', 'Halcyon',
    // The exploring verbs
    'Discovery', 'Endeavour', 'Investigator', 'Adventure', 'Challenger', 'Enquirer', 'Surveyor', 'Herald', 'Pathfinder', 'Pioneer',
    'Ranger', 'Rover', 'Wanderer', 'Explorer', 'Seeker', 'Searcher', 'Observer', 'Sentinel', 'Lookout', 'Outrider',
  ],
  raider: [
    // Bravado
    'Sweet Revenge', 'No Quarter', 'Fair Warning', 'Last Laugh', 'Short Shrift', 'Small Mercy', 'Cold Comfort', 'Hard Bargain', 'Sharp Practice', 'Rough Justice',
    'Black Flag', 'Black Joke', 'Black Ledger', 'Black Dog', 'Black Cat', 'Red Hand', 'Red Ink', 'Red Sky', 'Bloody Nose', 'Dead Reckoning',
    'Widowmaker', 'Reaver', 'Marauder', 'Corsair', 'Buccaneer', 'Freebooter', 'Privateer', 'Sea Wolf', 'Star Wolf', 'Void Wolf',
    'Night Rambler', 'Night Hawk', 'Night Owl', 'Nightfall', 'Dark Tide', 'Dark Lantern', 'Dark Horse', 'Grim Tidings', 'Ill Wind', 'Foul Weather',
    'Rising Sun', 'Flying Dragon', 'Golden Fleece', 'Golden Goose', 'Silver Hand', 'Iron Hand', 'Brass Neck', 'Hard Case', 'Wild Card', 'Long Odds',
    'Long Shot', 'Loose Cannon', 'Blind Eye', 'Deaf Ear', 'Cocked Hat', "Devil's Own", "Devil's Due", 'Devil May Care', 'Damn Your Eyes', 'Kiss My Hand',
    // Bad jokes about money
    'Late Return', 'Unpaid Tax', 'Tax Return', 'Dividend', 'Windfall', 'Bad Penny', 'Old Debt', 'Reckoning', 'Salvage Right', 'Letter of Marque',
    'Free Trader', 'Honest Broker', 'Fair Dealer', "Trader's Luck", 'Slim Pickings', 'Easy Money', 'Ready Money', 'Hard Currency', 'Small Change', 'Loose Change',
    'Bottom Line', 'Profit Margin', 'Cash Down', 'Net Gain', 'Gross Profit', 'Dead Cargo', 'Excise', 'Tithe', 'Tariff', 'Toll',
    'Full Purse', 'Empty Purse', 'Second Mortgage', 'Bankrupt', 'Receiver', 'Liquidator', 'Creditor', 'Debtor', 'Usurer', 'Pawnbroker',
    // The old freebooters
    'Fancy', 'Delight', 'Desire', 'Fortune', 'Good Fortune', 'Happy Delivery', 'Liberty', 'Amity', 'Speedwell', 'Prosperous',
    'Sudden Death', 'Scowerer', 'Postillion', 'Batchelor', "Batchelor's Delight", "Ranger's Revenge", 'Gamecock', 'Maypole', 'Charming Mary', 'Merry Christmas',
    "New Year's Gift", 'Little Ranger', 'Great Ranger', 'Childhood', 'Content', 'Amiable', 'Trompeuse', 'Sainte Rose', 'Flying King', 'Jolly Roger',
  ],
  packet: [
    // Old regions in their Latin form, as the mail steamers were named
    'Britannia', 'Hibernia', 'Cambria', 'Caledonia', 'Scotia', 'Anglia', 'Mercia', 'Northumbria', 'Cornubia', 'Demetia',
    'Venedotia', 'Deira', 'Bernicia', 'Dalriada', 'Iona', 'Persia', 'Arabia', 'Asia', 'Africa', 'Europa',
    'Etruria', 'Umbria', 'Campania', 'Lucania', 'Apulia', 'Calabria', 'Liguria', 'Iberia', 'Gallia', 'Armorica',
    'Belgica', 'Germania', 'Rhaetia', 'Pannonia', 'Dalmatia', 'Illyria', 'Thracia', 'Macedonia', 'Thessalia', 'Boeotia',
    'Attica', 'Arcadia', 'Ionia', 'Lydia', 'Phrygia', 'Cilicia', 'Cappadocia', 'Galatia', 'Bithynia', 'Armenia',
    'Media', 'Parthia', 'Bactria', 'Sogdiana', 'Aria', 'Arachosia', 'Gedrosia', 'Carmania', 'Susiana', 'Assyria',
    'Babylonia', 'Chaldea', 'Syria', 'Phoenicia', 'Nubia', 'Aethiopia', 'Cyrenaica', 'Numidia', 'Sardinia', 'Corsica',
    'Sicilia', 'Melita', 'Creta', 'Rhodia', 'Scythia', 'Sarmatia', 'Dacia', 'Moesia', 'Hispania', 'Baetica',
    'Gallaecia', 'Vasconia', 'Narbonensis', 'Lugdunensis', 'Helvetia', 'Vindelicia', 'Noricum', 'Pontus', 'Colchis', 'Mysia',
    'Caria', 'Lycia', 'Pamphylia', 'Pisidia', 'Isauria', 'Lycaonia', 'Paphlagonia', 'Thule', 'Orcadia', 'Hebridia',
    // The virtues of a timetable
    'Express', 'Dispatch', 'Messenger', 'Postboy', 'Speedy', 'Swiftsure', 'Celerity', 'Alacrity', 'Diligence', 'Punctual',
    'Regular', 'Timely', 'Constant', 'Reliable', 'Faithful', 'Dutiful', 'Assiduous', 'Sedulous', 'Expedition', 'Promptitude',
  ],
}
