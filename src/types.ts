export type ViewType = 'upload' | 'summary' | 'history' | 'practice' | 'access-requests';

export interface Store {
  id: string;
  name: string;
}

export interface User {
  initials: string;
  name: string;
  role: string;
  defaultStoreId: string;
}
