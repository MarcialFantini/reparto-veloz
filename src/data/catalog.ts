export type ItemShape = 'sack' | 'bottle' | 'box' | 'can' | 'jar' | 'pack';

export interface Product {
  sku: string;
  name: string;
  unit: string;
  shape: ItemShape;
}

export const PRODUCTS: readonly Product[] = [
  { sku: 'YER-1K', name: 'Yerba mate 1 kg', unit: 'paq.', shape: 'pack' },
  { sku: 'ACE-15', name: 'Aceite de girasol 1,5 L', unit: 'bot.', shape: 'bottle' },
  { sku: 'HAR-000', name: 'Harina 000 x 25 kg', unit: 'bolsa', shape: 'sack' },
  { sku: 'AZU-1K', name: 'Azúcar 1 kg', unit: 'paq.', shape: 'pack' },
  { sku: 'FID-500', name: 'Fideos tirabuzón 500 g', unit: 'caja', shape: 'box' },
  { sku: 'TOM-520', name: 'Puré de tomate 520 g', unit: 'caja', shape: 'box' },
  { sku: 'ARV-350', name: 'Arvejas en lata 350 g', unit: 'lata', shape: 'can' },
  { sku: 'DUL-400', name: 'Dulce de leche 400 g', unit: 'frasco', shape: 'jar' },
  { sku: 'MAY-500', name: 'Mayonesa 500 g', unit: 'frasco', shape: 'jar' },
  { sku: 'ARR-1K', name: 'Arroz largo fino 1 kg', unit: 'paq.', shape: 'pack' },
  { sku: 'GAL-6', name: 'Galletitas de agua x 6', unit: 'caja', shape: 'box' },
  { sku: 'DET-750', name: 'Detergente 750 ml', unit: 'bot.', shape: 'bottle' },
  { sku: 'SOD-2L', name: 'Soda en sifón 2 L', unit: 'bot.', shape: 'bottle' },
  { sku: 'ATU-170', name: 'Atún al natural 170 g', unit: 'lata', shape: 'can' },
  { sku: 'POL-1K', name: 'Polenta 1 kg', unit: 'bolsa', shape: 'sack' },
  { sku: 'CAF-250', name: 'Café molido 250 g', unit: 'paq.', shape: 'pack' },
];

export const CUSTOMERS: readonly string[] = [
  'Almacén Don Tito',
  'Despensa La Cañada',
  'Autoservicio El Trébol',
  'Kiosco Plaza Colón',
  'Mercadito Los Sauces',
  'Despensa Doña Rosa',
  'Almacén El Puente',
  'Minimercado San Jerónimo',
  'Proveeduría La Docta',
  'Autoservicio Ñandú',
  'Almacén Las Tunas',
  'Despensa El Molino',
  'Mercadito La Esquina',
  'Kiosco El Parque',
  'Almacén Santa Rita',
  'Proveeduría Quebracho',
  'Despensa Los Álamos',
  'Autoservicio Mitre',
];

export interface Driver {
  id: string;
  name: string;
  initials: string;
  truck: string;
  vehicle: string;
  zone: string;
  since: number;
}

export const DRIVERS: readonly Driver[] = [
  { id: 'nahuel', name: 'Nahuel Ríos', initials: 'NR', truck: 'AF 214 KD', vehicle: 'Utilitario 1,5 t', zone: 'Noroeste', since: 2019 },
  { id: 'carla', name: 'Carla Medina', initials: 'CM', truck: 'AE 873 TR', vehicle: 'Camión 3,5 t', zone: 'Centro', since: 2021 },
  { id: 'julian', name: 'Julián Ferreyra', initials: 'JF', truck: 'AG 102 PL', vehicle: 'Utilitario 1,5 t', zone: 'Sur', since: 2022 },
  { id: 'romina', name: 'Romina Sosa', initials: 'RS', truck: 'AD 559 MS', vehicle: 'Camión 3,5 t', zone: 'Este', since: 2018 },
  { id: 'facundo', name: 'Facundo Vera', initials: 'FV', truck: 'AH 331 BQ', vehicle: 'Furgón 2 t', zone: 'Norte', since: 2023 },
  { id: 'lucia', name: 'Lucía Bustos', initials: 'LB', truck: 'AF 908 ZC', vehicle: 'Furgón 2 t', zone: 'Oeste', since: 2020 },
  { id: 'matias', name: 'Matías Quiroga', initials: 'MQ', truck: 'AE 447 RN', vehicle: 'Camión 3,5 t', zone: 'Sudeste', since: 2017 },
  { id: 'belen', name: 'Belén Arias', initials: 'BA', truck: 'AG 615 HV', vehicle: 'Utilitario 1,5 t', zone: 'Centro', since: 2024 },
  { id: 'gonzalo', name: 'Gonzalo Paz', initials: 'GP', truck: 'AD 772 FT', vehicle: 'Furgón 2 t', zone: 'Sudoeste', since: 2021 },
  { id: 'agustina', name: 'Agustina Luna', initials: 'AL', truck: 'AH 120 JM', vehicle: 'Utilitario 1,5 t', zone: 'Noreste', since: 2022 },
];

const driverById = new Map(DRIVERS.map((d) => [d.id, d]));
export const getDriver = (id: string): Driver => driverById.get(id) ?? DRIVERS[0]!;
