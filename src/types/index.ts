// User and Authentication Types
export type UserRole = 'admin' | 'finance' | 'trainer' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Event and Ticket Types
export interface Event {
  ProdID: number;
  ProdName: string;
  EventDate: string;
  Country: string;
  Venue: string;
  Trainer_1: string;
  Currency?: string; // Currency used for this event (EUR or JPY)
}

export interface EventTicket {
  Attendance: string;
  PaymentMethod: string | null;
  TierLevel: string | null;
  UnitPrice: number;  // Individual ticket price (from PriceTotal column)
  PriceTotal: number; // Total price sum (UnitPrice * Quantity)
  TrainerFeePct: number;
  Quantity: number;
  Currency?: string; // Currency used for prices (EUR or JPY)
}

export interface EventDetail extends Event {
  tickets: EventTicket[];
}

// Aggregated data for the table display
export interface EventSummaryRow {
  Attendance: string;
  PaymentMethod: string | null;
  TierLevel: string | null;
  UnitPrice: number;   // Individual ticket price
  PriceTotal: number;  // Total price sum
  TrainerFeePct: number;
  sumQuantity: number;
  sumPriceTotal: number;
  sumTrainerFee: number;
}

// Trainer Splits Types
export interface TrainerSplit {
  id?: number;
  ProdID: number;
  RowId: number;
  Name: string;
  Percent: number;
  TrainerFee: number;
  CashReceived: number;
  Payable: number;
}

// Expenses Types
export interface Expense {
  id?: number;
  ProdID: number;
  RowId: number;
  Description: string;
  Amount: number;
}

// Calculation Types
export interface EventOverview {
  trainerFee: number;
  cashSales: number;
  graceCommission: number;
  nannaFee: number;
  balance: number;
  payableToTrainer: number;
}

export interface Commission {
  grace?: number;
  nanna?: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface EventListResponse {
  ProdID: number;
  ProdName: string;
  EventDate: string;
}

// Export Types
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface ExportRequest {
  format: ExportFormat;
  trainerOverride?: string;
  commissions?: Commission;
  includeDeleted?: boolean;
  displayCurrency?: SupportedCurrency;
}

// Form Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface EventFilters {
  query?: string;
  includeDeleted?: boolean;
}

// Currency and formatting
export interface CurrencyOptions {
  locale: string;
  currency: string;
}

export type SupportedCurrency = 'EUR' | 'JPY' | 'USD' | 'GBP' | 'AUD' | 'CAD' | 'CHF';

export interface CurrencyConversion {
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  rate: number;
}

// Audit Trail Types
export interface AuditLog {
  id: number;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  prodId: number;
  details: string;
  createdAt: Date;
}
