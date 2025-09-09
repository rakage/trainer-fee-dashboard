// User and Authentication Types
export type UserRole = 'admin' | 'finance' | 'trainer' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
}

export interface EventTicket {
  Attendance: string;
  PaymentMethod: string | null;
  TierLevel: string | null;
  PriceTotal: number;
  TrainerFeePct: number;
  Quantity: number;
}

export interface EventDetail extends Event {
  tickets: EventTicket[];
}

// Aggregated data for the table display
export interface EventSummaryRow {
  Attendance: string;
  PaymentMethod: string | null;
  TierLevel: string | null;
  PriceTotal: number;
  TrainerFeePct: number;
  sumQuantity: number;
  sumPriceTotal: number;
  sumTrainerFee: number;
}

// Trainer Splits (Blue Cells) Types
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

// Audit Trail Types
export interface AuditLog {
  id: number;
  userId: string;
  action: string;
  prodId: number;
  details: string;
  createdAt: Date;
}
