// Category from the categories table
export interface Category {
  id: string;
  name: string;
  description: string | null;
  tax_deductible: boolean;
  is_active: boolean;
  created_at: string;
}

// Receipt from receipts table
export interface Receipt {
  id: string;
  user_id: string;
  supplier: string;
  receipt_date: string;
  category: string; // text field - should match a category name
  total_cost: number;
  image_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
    };
  };
}
