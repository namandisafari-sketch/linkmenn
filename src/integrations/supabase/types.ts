export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_credit_id: string
          description: string | null
          id: string
          order_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_credit_id: string
          description?: string | null
          id?: string
          order_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_credit_id?: string
          description?: string | null
          id?: string
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_customer_credit_id_fkey"
            columns: ["customer_credit_id"]
            isOneToOne: false
            referencedRelation: "customer_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          created_at: string
          credit_balance: number
          customer_name: string
          customer_phone: string
          customer_type: string | null
          id: string
          last_purchase_date: string | null
          notes: string | null
          total_paid: number
          total_purchases: number | null
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_balance?: number
          customer_name: string
          customer_phone: string
          customer_type?: string | null
          id?: string
          last_purchase_date?: string | null
          notes?: string | null
          total_paid?: number
          total_purchases?: number | null
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_balance?: number
          customer_name?: string
          customer_phone?: string
          customer_type?: string | null
          id?: string
          last_purchase_date?: string | null
          notes?: string | null
          total_paid?: number
          total_purchases?: number | null
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      general_ledger: {
        Row: {
          account_name: string
          account_type: string
          created_at: string
          credit: number
          debit: number
          entry_date: string
          id: string
          narration: string | null
          voucher_id: string
        }
        Insert: {
          account_name: string
          account_type: string
          created_at?: string
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          narration?: string | null
          voucher_id: string
        }
        Update: {
          account_name?: string
          account_type?: string
          created_at?: string
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          narration?: string | null
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_ledger_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          custom_unit_price: number | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          custom_unit_price?: number | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          custom_unit_price?: number | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_prescriptions: {
        Row: {
          age_range: string | null
          created_at: string
          disease: string | null
          dosage: string | null
          id: string
          image_url: string | null
          instructions: string | null
          order_id: string
          product_id: string | null
          symptoms: string | null
          timing_notes: string | null
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          disease?: string | null
          dosage?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          order_id: string
          product_id?: string | null
          symptoms?: string | null
          timing_notes?: string | null
        }
        Update: {
          age_range?: string | null
          created_at?: string
          disease?: string | null
          dosage?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          order_id?: string
          product_id?: string | null
          symptoms?: string | null
          timing_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_prescriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_prescriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          created_at: string
          customer_name: string
          district: string | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_phone: string | null
          phone: string
          reuse_count: number
          sale_date: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_name: string
          district?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_phone?: string | null
          phone: string
          reuse_count?: number
          sale_date?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_name?: string
          district?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_phone?: string | null
          phone?: string
          reuse_count?: number
          sale_date?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      prescription_rules: {
        Row: {
          age_max: number
          age_min: number
          created_at: string
          disease: string
          dosage: string
          id: string
          instructions: string | null
          product_id: string | null
          symptoms: string | null
          timing_notes: string | null
          updated_at: string
        }
        Insert: {
          age_max?: number
          age_min?: number
          created_at?: string
          disease: string
          dosage: string
          id?: string
          instructions?: string | null
          product_id?: string | null
          symptoms?: string | null
          timing_notes?: string | null
          updated_at?: string
        }
        Update: {
          age_max?: number
          age_min?: number
          created_at?: string
          disease?: string
          dosage?: string
          id?: string
          instructions?: string | null
          product_id?: string | null
          symptoms?: string | null
          timing_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          file_url: string
          id: string
          order_id: string | null
          pharmacist_notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          order_id?: string | null
          pharmacist_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          order_id?: string | null
          pharmacist_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string
          created_at: string
          expiry_date: string
          id: string
          mfg_date: string | null
          mrp: number | null
          product_id: string
          purchase_price: number | null
          quantity: number
        }
        Insert: {
          batch_number: string
          created_at?: string
          expiry_date: string
          id?: string
          mfg_date?: string | null
          mrp?: number | null
          product_id: string
          purchase_price?: number | null
          quantity?: number
        }
        Update: {
          batch_number?: string
          created_at?: string
          expiry_date?: string
          id?: string
          mfg_date?: string | null
          mrp?: number | null
          product_id?: string
          purchase_price?: number | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          batch_number: string | null
          buying_price: number | null
          category_id: string | null
          created_at: string
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_controlled: boolean
          name: string
          pieces_per_unit: number | null
          prescription_info: string | null
          price: number
          product_code: string | null
          requires_prescription: boolean
          stock: number
          unit: string
          unit_description: string | null
          unit_prices: Json | null
          updated_at: string
          wholesale_price: number | null
        }
        Insert: {
          batch_number?: string | null
          buying_price?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_controlled?: boolean
          name: string
          pieces_per_unit?: number | null
          prescription_info?: string | null
          price?: number
          product_code?: string | null
          requires_prescription?: boolean
          stock?: number
          unit?: string
          unit_description?: string | null
          unit_prices?: Json | null
          updated_at?: string
          wholesale_price?: number | null
        }
        Update: {
          batch_number?: string | null
          buying_price?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_controlled?: boolean
          name?: string
          pieces_per_unit?: number | null
          prescription_info?: string | null
          price?: number
          product_code?: string | null
          requires_prescription?: boolean
          stock?: number
          unit?: string
          unit_description?: string | null
          unit_prices?: Json | null
          updated_at?: string
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          district: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          district?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          status: string
          supplier_name: string
          total_amount: number
          updated_at: string
          voucher_id: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          status?: string
          supplier_name: string
          total_amount?: number
          updated_at?: string
          voucher_id?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          status?: string
          supplier_name?: string
          total_amount?: number
          updated_at?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pdf_url: string | null
          status: string
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pdf_url?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pdf_url?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tally_vouchers: {
        Row: {
          address: string | null
          created_at: string
          guid: string | null
          id: string
          items: Json | null
          party_name: string | null
          reference: string | null
          total_amount: number
          voucher_date: string
          voucher_number: string
          voucher_type: string
          year: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          guid?: string | null
          id?: string
          items?: Json | null
          party_name?: string | null
          reference?: string | null
          total_amount?: number
          voucher_date: string
          voucher_number: string
          voucher_type?: string
          year: number
        }
        Update: {
          address?: string | null
          created_at?: string
          guid?: string | null
          id?: string
          items?: Json | null
          party_name?: string | null
          reference?: string | null
          total_amount?: number
          voucher_date?: string
          voucher_number?: string
          voucher_type?: string
          year?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_items: {
        Row: {
          amount: number
          batch_id: string | null
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          quantity: number
          rate: number
          voucher_id: string
        }
        Insert: {
          amount?: number
          batch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          voucher_id: string
        }
        Update: {
          amount?: number
          batch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          rate?: number
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_items_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          narration: string | null
          party_name: string | null
          party_phone: string | null
          reference_id: string | null
          status: string
          total_amount: number
          updated_at: string
          voucher_date: string
          voucher_number: string
          voucher_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          narration?: string | null
          party_name?: string | null
          party_phone?: string | null
          reference_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          voucher_date?: string
          voucher_number: string
          voucher_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          narration?: string | null
          party_name?: string | null
          party_phone?: string | null
          reference_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          voucher_date?: string
          voucher_number?: string
          voucher_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
