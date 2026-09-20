import type { Culture } from './culture'

export const maya: Culture = {
  name: 'Maya',
  group: 'Indigenous American',
  order: 'given-family',
  pattern: { m: '{given} {family}', f: '{given} {family}' },
  notes: "Yucatán in the Caste War decades, with a corner of the Guatemalan highlands. Given names are Spanish saints' names; the Maya surnames (Pech, Canul, Cocom) never went away and are the whole of the family pool but for a few K'iche' ones.",
  given: {
    m: [
      'José', 'Juan', 'Manuel', 'Francisco', 'Pedro', 'Jacinto', 'Cecilio', 'Bonifacio', 'Crescencio', 'Bernardino',
      'Marcelo', 'Santiago', 'Andrés', 'Anselmo', 'Apolinar', 'Basilio', 'Benito', 'Buenaventura', 'Casimiro', 'Cayetano',
      'Celestino', 'Cipriano', 'Cornelio', 'Cristino', 'Dámaso', 'Desiderio', 'Dionisio', 'Eleuterio', 'Eugenio', 'Eusebio',
      'Feliciano', 'Felipe', 'Fermín', 'Florentino', 'Fulgencio', 'Gaspar', 'Gervasio', 'Gumersindo', 'Hilario', 'Isidro',
      'Justo', 'Leandro', 'Leonardo', 'Lino', 'Lucas', 'Macario', 'Marcial', 'Martín', 'Mateo', 'Matías',
      'Maximiliano', 'Nazario', 'Nicanor', 'Nicolás', 'Pantaleón', 'Pascual', 'Patricio', 'Perfecto', 'Pío', 'Plácido',
      'Remigio', 'Román', 'Rosendo', 'Rufino', 'Santos', 'Saturnino', 'Secundino', 'Sotero', 'Teodoro', 'Tiburcio',
      'Timoteo', 'Tomás', 'Toribio', 'Valerio', 'Venancio', 'Vicente', 'Victoriano', 'Wenceslao', 'Zacarías', 'Anastasio',
    ],
    f: [
      'María', 'Juana', 'Josefa', 'Francisca', 'Feliciana', 'Petrona', 'Tomasa', 'Gregoria', 'Bonifacia', 'Catalina',
      'Cecilia', 'Clemencia', 'Concepción', 'Dolores', 'Eusebia', 'Faustina', 'Felipa', 'Fidelia', 'Filomena', 'Guadalupe',
      'Hilaria', 'Ignacia', 'Isabel', 'Jacinta', 'Juliana', 'Justa', 'Leocadia', 'Lorenza', 'Lucía', 'Magdalena',
      'Manuela', 'Marcelina', 'Margarita', 'Martina', 'Matilde', 'Mercedes', 'Micaela', 'Narcisa', 'Natalia', 'Nicolasa',
      'Pascuala', 'Paulina', 'Petra', 'Pilar', 'Ramona', 'Regina', 'Rita', 'Rosa', 'Rosalía', 'Sabina',
      'Santiaga', 'Saturnina', 'Sebastiana', 'Serafina', 'Silveria', 'Simona', 'Susana', 'Tecla', 'Teodora', 'Teresa',
      'Tiburcia', 'Trinidad', 'Úrsula', 'Valentina', 'Venancia', 'Vicenta', 'Victoria', 'Virginia', 'Anastasia', 'Apolonia',
      'Basilia', 'Bartola', 'Candelaria', 'Casimira', 'Damiana', 'Eduviges', 'Encarnación', 'Estefana', 'Eulalia', 'Gertrudis',
    ],
  },
  family: [
    'Pech', 'Chan', 'Canul', 'Uc', 'Dzul', 'May', 'Cauich', 'Tun', 'Ek', 'Chi',
    'Pat', 'Poot', 'Tzab', 'Puc', 'Balam', 'Cocom', 'Xiu', 'Ceh', 'Chuc', 'Cab',
    'Cen', 'Chable', 'Che', 'Chim', 'Chuil', 'Coba', 'Cohuo', 'Couoh', 'Cutz', 'Dzib',
    'Euan', 'Hau', 'Hoil', 'Huchim', 'Ic', 'Itza', 'Kantun', 'Ku', 'Kuk', 'Mis',
    'Moo', 'Mukul', 'Nah', 'Nahuat', 'Noh', 'Oxte', 'Pool', 'Tamay', 'Tec', 'Tuz',
    'Tzec', 'Ucan', 'Uicab', 'Uitz', 'Xool', 'Yah', 'Yam', 'Cimé', 'Cituk', 'Coyoc',
    'Kauil', 'Kumul', 'Koh', 'Ake', 'Ayil', 'Baas', 'Batun', 'Cahum', 'Camal', 'Canche',
    'Canto', 'Chay', 'Chel', 'Kinil', 'Tzul', 'Ixcoy', 'Tzoc', 'Coj', 'Xicay', 'Ajanel',
  ],
  places: [
    'Mérida', 'Valladolid', 'Izamal', 'Motul', 'Tizimín', 'Tekax', 'Peto', 'Ticul', 'Maní', 'Oxkutzcab',
    'Sotuta', 'Chan Santa Cruz', 'Bacalar', 'Tihosuco', 'Campeche', 'Champotón', 'Hecelchakán', 'Calkiní', 'Hopelchén', 'Chichén Itzá',
    'Uxmal', 'Mayapán', 'Tulum', 'Cobá', 'Cozumel', 'Isla Mujeres', 'Sisal', 'Progreso', 'Celestún', 'Dzilam',
    'Espita', 'Hunucmá', 'Umán', 'Acanceh', 'Tecoh', 'Teabo', 'Chumayel', 'Yaxcabá', 'Tixkokob', 'Cansahcab',
    'Río Lagartos', 'Holbox', 'Puuc', 'Chenes', 'Río Hondo', 'Petén', 'Flores', 'Tikal', 'Quiché', 'Chichicastenango',
    'Quetzaltenango', 'Totonicapán', 'Sololá', 'Atitlán', 'Cobán', 'Verapaz', 'Usumacinta', 'Corozal', 'Xcalak', 'Ekab',
  ],
}
