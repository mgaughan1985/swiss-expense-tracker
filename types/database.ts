// Category from the categories table
export interface Category {
  id: string;
  name: string;
  description: string | null;
  tax_deductible: boolean;
  is_active: boolean;
  created_at: string;
}

// Organisation
export interface Organisation {
  id: string;
  name: string;
  country: string;
  currency: string;
  accounting_software: string | null;
  created_at: string;
}

// Organisation member — a user may have multiple rows (one per org). V1 UI uses first row only.
export interface OrganisationMember {
  id: string;
  organisation_id: string;
  user_id: string;
  role: 'employee' | 'manager' | 'admin';
  created_at: string;
}

// Receipt from receipts table
export interface Receipt {
  id: string;
  user_id: string;
  supplier: string;
  receipt_date: string;
  category: string;
  total_cost: number;
  image_path: string | null;
  notes: string | null;
  status: string; // 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string;
  updated_at: string;
  // Approval workflow fields (added in migration 001)
  organisation_id: string | null;
  project_notes: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  edited_by: string | null;
  edited_at: string | null;
}

// For creating new receipts
export interface NewReceipt {
  user_id: string;
  supplier: string;
  receipt_date: string;
  category: string;
  total_cost: number;
  image_path?: string | null;
  notes?: string | null;
  project_notes?: string | null;
  organisation_id?: string | null;
}

// For updates (all fields optional except id)
export interface UpdateReceipt {
  id: string;
  supplier?: string;
  receipt_date?: string;
  category?: string;
  total_cost?: number;
  image_path?: string | null;
  notes?: string | null;
  project_notes?: string | null;
}

// For aggregations and reporting
export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

// Database schema type (for Supabase client with TypeScript)
export interface Database {
  public: {
    Tables: {
      receipts: {
        Row: Receipt;
        Insert: NewReceipt;
        Update: Partial<Omit<Receipt, 'id' | 'created_at' | 'updated_at' | 'user_id'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at'>>;
      };
      organisations: {
        Row: Organisation;
        Insert: Omit<Organisation, 'id' | 'created_at'>;
        Update: Partial<Omit<Organisation, 'id' | 'created_at'>>;
      };
      organisation_members: {
        Row: OrganisationMember;
        Insert: Omit<OrganisationMember, 'id' | 'created_at'>;
        Update: Partial<Omit<OrganisationMember, 'id' | 'created_at'>>;
      };
    };
  };
}
