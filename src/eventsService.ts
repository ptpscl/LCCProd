export interface AppEvent {
  id: string;
  timestamp: string;
  dataset: string;
  action: string;
  detail: string;
  user: string;
}

const mockHistory: AppEvent[] = [
  { id: '1', timestamp: '2026-07-15T10:24:00Z', dataset: 'Customer database', action: 'Promote to Gold', detail: '211 records promoted', user: 'M. Reyes' },
  { id: '2', timestamp: '2026-07-15T09:15:00Z', dataset: 'Customer database', action: 'Upload', detail: 'batch #014, 1,204 rows', user: 'A. Santos' },
  { id: '3', timestamp: '2026-07-14T16:45:00Z', dataset: 'Loyalty sales', action: 'Promote to Gold', detail: '1,500 records promoted', user: 'M. Reyes' },
  { id: '4', timestamp: '2026-07-14T11:20:00Z', dataset: 'All transactions', action: 'Upload', detail: 'batch #089, 5,432 rows', user: 'J. Cruz' },
  { id: '5', timestamp: '2026-07-13T14:10:00Z', dataset: 'SKU hierarchy', action: 'Upload', detail: 'batch #005, 840 rows', user: 'C. Lim' },
  { id: '6', timestamp: '2026-07-13T10:05:00Z', dataset: 'Customer database', action: 'Promote to Gold', detail: '98 records promoted', user: 'M. Reyes' },
  { id: '7', timestamp: '2026-07-12T15:30:00Z', dataset: 'Loyalty sales', action: 'Upload', detail: 'batch #022, 2,100 rows', user: 'A. Santos' },
  { id: '8', timestamp: '2026-07-12T09:45:00Z', dataset: 'All transactions', action: 'Promote to Gold', detail: '4,100 records promoted', user: 'M. Reyes' },
  { id: '9', timestamp: '2026-07-11T13:20:00Z', dataset: 'SKU hierarchy', action: 'Promote to Gold', detail: '800 records promoted', user: 'J. Cruz' },
  { id: '10', timestamp: '2026-07-11T08:15:00Z', dataset: 'Customer database', action: 'Upload', detail: 'batch #013, 1,150 rows', user: 'C. Lim' },
];

export const eventsService = {
  logEvent(event: Omit<AppEvent, 'id' | 'timestamp'>) {
    const newEvent = {
      ...event,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    mockHistory.unshift(newEvent);
  },
  
  getEvents() {
    return mockHistory;
  }
};
