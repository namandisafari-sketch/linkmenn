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
      account_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          nature: string
          parent_group_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nature: string
          parent_group_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nature?: string
          parent_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          code: string
          created_at: string
          group_id: string | null
          id: string
          is_system: boolean
          name: string
          opening_balance: number
          pharmacy_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_system?: boolean
          name: string
          opening_balance?: number
          pharmacy_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_system?: boolean
          name?: string
          opening_balance?: number
          pharmacy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
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
      chat_conversations: {
        Row: {
          channel: string | null
          created_at: string
          external_id: string | null
          id: string
          metadata: Json | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          credit_balance: number | null
          customer_name: string
          customer_phone: string | null
          customer_type: string | null
          id: string
          last_purchase_date: string | null
          notes: string | null
          total_paid: number | null
          total_purchases: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_balance?: number | null
          customer_name: string
          customer_phone?: string | null
          customer_type?: string | null
          id?: string
          last_purchase_date?: string | null
          notes?: string | null
          total_paid?: number | null
          total_purchases?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_balance?: number | null
          customer_name?: string
          customer_phone?: string | null
          customer_type?: string | null
          id?: string
          last_purchase_date?: string | null
          notes?: string | null
          total_paid?: number | null
          total_purchases?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      goods_received_notes: {
        Row: {
          created_at: string
          created_by: string | null
          grn_date: string
          grn_number: string
          id: string
          invoice_reference: string | null
          journal_id: string | null
          notes: string | null
          pharmacy_id: string | null
          po_id: string | null
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grn_date?: string
          grn_number: string
          id?: string
          invoice_reference?: string | null
          journal_id?: string | null
          notes?: string | null
          pharmacy_id?: string | null
          po_id?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grn_date?: string
          grn_number?: string
          id?: string
          invoice_reference?: string | null
          journal_id?: string | null
          notes?: string | null
          pharmacy_id?: string | null
          po_id?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_notes_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_lines: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          created_at: string
          expiry_date: string
          grn_id: string
          id: string
          manufacture_date: string | null
          medicine_id: string | null
          qty_received: number
          rate: number
          total: number | null
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          expiry_date: string
          grn_id: string
          id?: string
          manufacture_date?: string | null
          medicine_id?: string | null
          qty_received: number
          rate?: number
          total?: number | null
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          expiry_date?: string
          grn_id?: string
          id?: string
          manufacture_date?: string | null
          medicine_id?: string | null
          qty_received?: number
          rate?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_lines_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string | null
          account_name: string
          account_type: string
          created_at: string
          credit: number
          debit: number
          entry_date: string
          id: string
          journal_id: string | null
          narration: string | null
        }
        Insert: {
          account_id?: string | null
          account_name: string
          account_type: string
          created_at?: string
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          journal_id?: string | null
          narration?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string
          account_type?: string
          created_at?: string
          credit?: number
          debit?: number
          entry_date?: string
          id?: string
          journal_id?: string | null
          narration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "general_ledger_voucher_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "general_ledger_voucher_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_cancelled: boolean
          narration: string | null
          party_name: string | null
          party_phone: string | null
          pharmacy_id: string | null
          posted_by: string | null
          reference: string | null
          reference_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
          voucher_date: string | null
          voucher_number: string | null
          voucher_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_cancelled?: boolean
          narration?: string | null
          party_name?: string | null
          party_phone?: string | null
          pharmacy_id?: string | null
          posted_by?: string | null
          reference?: string | null
          reference_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          voucher_date?: string | null
          voucher_number?: string | null
          voucher_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_cancelled?: boolean
          narration?: string | null
          party_name?: string | null
          party_phone?: string | null
          pharmacy_id?: string | null
          posted_by?: string | null
          reference?: string | null
          reference_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          voucher_date?: string | null
          voucher_number?: string | null
          voucher_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_batches: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          grn_id: string | null
          id: string
          medicine_id: string
          mfg_date: string | null
          mrp: number | null
          pharmacy_id: string | null
          purchase_cost: number | null
          purchase_price: number | null
          qty_received: number
          qty_remaining: number
          quantity: number | null
          selling_price: number | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          grn_id?: string | null
          id?: string
          medicine_id: string
          mfg_date?: string | null
          mrp?: number | null
          pharmacy_id?: string | null
          purchase_cost?: number | null
          purchase_price?: number | null
          qty_received?: number
          qty_remaining?: number
          quantity?: number | null
          selling_price?: number | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          grn_id?: string | null
          id?: string
          medicine_id?: string
          mfg_date?: string | null
          mrp?: number | null
          pharmacy_id?: string | null
          purchase_cost?: number | null
          purchase_price?: number | null
          qty_received?: number
          qty_remaining?: number
          quantity?: number | null
          selling_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_batches_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          barcode: string | null
          batch_number: string | null
          brand: string | null
          buying_price: number | null
          category_id: string | null
          created_at: string
          description: string | null
          expiry_date: string | null
          generic_name: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_controlled: boolean | null
          name: string
          pharmacy_id: string | null
          pieces_per_unit: number | null
          prescription_info: string | null
          price: number
          product_code: string | null
          reorder_level: number | null
          requires_prescription: boolean | null
          stock: number | null
          unit: string | null
          unit_description: string | null
          unit_of_measure: string | null
          unit_prices: Json | null
          updated_at: string
          vat_applicable: boolean | null
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          batch_number?: string | null
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_controlled?: boolean | null
          name: string
          pharmacy_id?: string | null
          pieces_per_unit?: number | null
          prescription_info?: string | null
          price?: number
          product_code?: string | null
          reorder_level?: number | null
          requires_prescription?: boolean | null
          stock?: number | null
          unit?: string | null
          unit_description?: string | null
          unit_of_measure?: string | null
          unit_prices?: Json | null
          updated_at?: string
          vat_applicable?: boolean | null
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          batch_number?: string | null
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_controlled?: boolean | null
          name?: string
          pharmacy_id?: string | null
          pieces_per_unit?: number | null
          prescription_info?: string | null
          price?: number
          product_code?: string | null
          reorder_level?: number | null
          requires_prescription?: boolean | null
          stock?: number | null
          unit?: string | null
          unit_description?: string | null
          unit_of_measure?: string | null
          unit_prices?: Json | null
          updated_at?: string
          vat_applicable?: boolean | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicines_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
            referencedRelation: "medicines"
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
          created_at: string
          customer_age: number | null
          customer_name: string | null
          doctor_name: string | null
          id: string
          notes: string | null
          order_id: string | null
          prescription_image: string | null
        }
        Insert: {
          created_at?: string
          customer_age?: number | null
          customer_name?: string | null
          doctor_name?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          prescription_image?: string | null
        }
        Update: {
          created_at?: string
          customer_age?: number | null
          customer_name?: string | null
          doctor_name?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          prescription_image?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_prescriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          created_at: string
          customer_name: string | null
          district: string | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_phone: string | null
          phone: string | null
          reuse_count: number | null
          sale_date: string | null
          status: string | null
          total: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_name?: string | null
          district?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_phone?: string | null
          phone?: string | null
          reuse_count?: number | null
          sale_date?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_name?: string | null
          district?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_phone?: string | null
          phone?: string | null
          reuse_count?: number | null
          sale_date?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          vat_number: string | null
          vat_rate: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      prescription_rules: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string
          disease: string | null
          dosage: string | null
          id: string
          instructions: string | null
          product_id: string | null
          symptoms: string | null
          timing_notes: string | null
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          disease?: string | null
          dosage?: string | null
          id?: string
          instructions?: string | null
          product_id?: string | null
          symptoms?: string | null
          timing_notes?: string | null
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          disease?: string | null
          dosage?: string | null
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
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
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
          amount_due: number | null
          amount_paid: number | null
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          status: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string
          voucher_id: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          status?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
          voucher_id?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          status?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
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
          amount: number | null
          created_at: string
          id: string
          product_id: string | null
          product_name: string | null
          purchase_order_id: string
          qty_ordered: number | null
          qty_received: number | null
          rate: number | null
          unit_price: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          purchase_order_id: string
          qty_ordered?: number | null
          qty_received?: number | null
          rate?: number | null
          unit_price?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          purchase_order_id?: string
          qty_ordered?: number | null
          qty_received?: number | null
          rate?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
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
          amount_due: number | null
          amount_paid: number | null
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          pharmacy_id: string | null
          po_number: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          pharmacy_id?: string | null
          po_number?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          pharmacy_id?: string | null
          po_number?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
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
          is_primary: boolean | null
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
          is_primary?: boolean | null
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
          is_primary?: boolean | null
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
          amount_due: number | null
          amount_paid: number | null
          created_at: string
          created_by: string | null
          guid: string | null
          id: string
          items: Json | null
          notes: string | null
          party_name: string | null
          reference: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
          voucher_date: string | null
          voucher_number: string | null
          voucher_type: string | null
          year: number | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          guid?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          party_name?: string | null
          reference?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          voucher_date?: string | null
          voucher_number?: string | null
          voucher_type?: string | null
          year?: number | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          guid?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          party_name?: string | null
          reference?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
          voucher_date?: string | null
          voucher_number?: string | null
          voucher_type?: string | null
          year?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_items: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          product_id: string | null
          product_name: string | null
          quantity: number | null
          unit_price: number | null
          voucher_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          unit_price?: number | null
          voucher_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          unit_price?: number | null
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "medicines"
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
            referencedRelation: "journals"
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
      voucher_sequences: {
        Row: {
          next_number: number
          prefix: string
          voucher_type: string
        }
        Insert: {
          next_number?: number
          prefix: string
          voucher_type: string
        }
        Update: {
          next_number?: number
          prefix?: string
          voucher_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      general_ledger: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_type: string | null
          created_at: string | null
          credit: number | null
          debit: number | null
          entry_date: string | null
          id: string | null
          journal_id: string | null
          narration: string | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          account_type?: string | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          entry_date?: string | null
          id?: string | null
          journal_id?: string | null
          narration?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          account_type?: string | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          entry_date?: string | null
          id?: string | null
          journal_id?: string | null
          narration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "general_ledger_voucher_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "general_ledger_voucher_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string | null
          created_at: string | null
          expiry_date: string | null
          grn_id: string | null
          id: string | null
          medicine_id: string | null
          mfg_date: string | null
          mrp: number | null
          pharmacy_id: string | null
          purchase_cost: number | null
          purchase_price: number | null
          qty_received: number | null
          qty_remaining: number | null
          quantity: number | null
          selling_price: number | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          grn_id?: string | null
          id?: string | null
          medicine_id?: string | null
          mfg_date?: string | null
          mrp?: number | null
          pharmacy_id?: string | null
          purchase_cost?: number | null
          purchase_price?: number | null
          qty_received?: number | null
          qty_remaining?: number | null
          quantity?: number | null
          selling_price?: number | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          grn_id?: string | null
          id?: string | null
          medicine_id?: string | null
          mfg_date?: string | null
          mrp?: number | null
          pharmacy_id?: string | null
          purchase_cost?: number | null
          purchase_price?: number | null
          qty_received?: number | null
          qty_remaining?: number | null
          quantity?: number | null
          selling_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_batches_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          batch_number: string | null
          brand: string | null
          buying_price: number | null
          category_id: string | null
          created_at: string | null
          description: string | null
          expiry_date: string | null
          generic_name: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_controlled: boolean | null
          name: string | null
          pharmacy_id: string | null
          pieces_per_unit: number | null
          prescription_info: string | null
          price: number | null
          product_code: string | null
          reorder_level: number | null
          requires_prescription: boolean | null
          stock: number | null
          unit: string | null
          unit_description: string | null
          unit_of_measure: string | null
          unit_prices: Json | null
          updated_at: string | null
          vat_applicable: boolean | null
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          batch_number?: string | null
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          generic_name?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_controlled?: boolean | null
          name?: string | null
          pharmacy_id?: string | null
          pieces_per_unit?: number | null
          prescription_info?: string | null
          price?: number | null
          product_code?: string | null
          reorder_level?: number | null
          requires_prescription?: boolean | null
          stock?: number | null
          unit?: string | null
          unit_description?: string | null
          unit_of_measure?: string | null
          unit_prices?: Json | null
          updated_at?: string | null
          vat_applicable?: boolean | null
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          batch_number?: string | null
          brand?: string | null
          buying_price?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          generic_name?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_controlled?: boolean | null
          name?: string | null
          pharmacy_id?: string | null
          pieces_per_unit?: number | null
          prescription_info?: string | null
          price?: number | null
          product_code?: string | null
          reorder_level?: number | null
          requires_prescription?: boolean | null
          stock?: number | null
          unit?: string | null
          unit_description?: string | null
          unit_of_measure?: string | null
          unit_prices?: Json | null
          updated_at?: string | null
          vat_applicable?: boolean | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicines_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          is_cancelled: boolean | null
          narration: string | null
          party_name: string | null
          party_phone: string | null
          pharmacy_id: string | null
          posted_by: string | null
          reference: string | null
          reference_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          voucher_date: string | null
          voucher_number: string | null
          voucher_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_cancelled?: boolean | null
          narration?: string | null
          party_name?: string | null
          party_phone?: string | null
          pharmacy_id?: string | null
          posted_by?: string | null
          reference?: string | null
          reference_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          voucher_date?: string | null
          voucher_number?: string | null
          voucher_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_cancelled?: boolean | null
          narration?: string | null
          party_name?: string | null
          party_phone?: string | null
          pharmacy_id?: string | null
          posted_by?: string | null
          reference?: string | null
          reference_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          voucher_date?: string | null
          voucher_number?: string | null
          voucher_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      deduct_fefo_stock: {
        Args: { p_medicine_id: string; p_qty_needed: number }
        Returns: {
          batch_id: string
          qty_deducted: number
          unit_cost: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_voucher_number: { Args: { p_voucher_type: string }; Returns: string }
      post_grn: { Args: { p_grn_id: string }; Returns: string }
      post_sale_voucher: {
        Args: {
          p_customer_id: string
          p_payment_method: string
          p_pharmacy_id?: string
          p_sale_lines: Json
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "cashier" | "manager"
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
      app_role: ["admin", "moderator", "user", "cashier", "manager"],
    },
  },
} as const
