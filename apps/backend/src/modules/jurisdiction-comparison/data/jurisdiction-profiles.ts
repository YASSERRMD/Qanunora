export interface JurisdictionProfile {
  code: string;
  name: string;
  region: string;
}

export const JURISDICTION_PROFILES: JurisdictionProfile[] = [
  { code: 'UAE', name: 'United Arab Emirates', region: 'GCC' },
  { code: 'SAU', name: 'Saudi Arabia', region: 'GCC' },
  { code: 'GBR', name: 'United Kingdom', region: 'Europe' },
  { code: 'USA', name: 'United States', region: 'Americas' },
  { code: 'FRA', name: 'France', region: 'Europe' },
  { code: 'SGP', name: 'Singapore', region: 'Asia' },
  { code: 'AUS', name: 'Australia', region: 'Oceania' },
  { code: 'CAN', name: 'Canada', region: 'Americas' },
  { code: 'DEU', name: 'Germany', region: 'Europe' },
  { code: 'JPN', name: 'Japan', region: 'Asia' },
];
