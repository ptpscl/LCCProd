import { Store, User } from './types';

export const MOCK_STORES: Store[] = [
  { id: 'legazpi', name: 'LCC Legazpi' },
  { id: 'naga', name: 'LCC Naga' },
  { id: 'tabaco', name: 'LCC Tabaco' },
  { id: 'sorsogon', name: 'LCC Sorsogon' },
  { id: 'daet', name: 'LCC Daet' },
];

export const MOCK_USER: User = {
  initials: 'CM',
  name: 'Category Manager',
  role: 'LCC Legazpi',
  defaultStoreId: 'legazpi'
};
