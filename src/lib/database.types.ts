export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'student' | 'reviewer' | 'admin'
export type ExpedienteStatus = 'in_progress' | 'completed' | 'cancelled'
export type DocumentStatus = 'pending' | 'in_review' | 'accepted' | 'rejected' | 'correction_requested'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          matricula: string | null
          carrera: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: UserRole
          matricula?: string | null
          carrera?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: UserRole
          matricula?: string | null
          carrera?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      periods: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_date?: string
          end_date?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      document_types: {
        Row: {
          id: string
          name: string
          description: string | null
          required: boolean
          order_number: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          required?: boolean
          order_number: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          required?: boolean
          order_number?: number
          created_at?: string
        }
      }
      expedientes: {
        Row: {
          id: string
          student_id: string
          period_id: string
          assigned_reviewer_id: string | null
          progress_percentage: number
          status: ExpedienteStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          period_id: string
          assigned_reviewer_id?: string | null
          progress_percentage?: number
          status?: ExpedienteStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          period_id?: string
          assigned_reviewer_id?: string | null
          progress_percentage?: number
          status?: ExpedienteStatus
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          expediente_id: string
          document_type_id: string
          file_path: string
          file_name: string
          version: number
          status: DocumentStatus
          uploaded_by: string
          reviewed_by: string | null
          reviewer_comments: string | null
          uploaded_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          expediente_id: string
          document_type_id: string
          file_path: string
          file_name: string
          version?: number
          status?: DocumentStatus
          uploaded_by: string
          reviewed_by?: string | null
          reviewer_comments?: string | null
          uploaded_at?: string
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          expediente_id?: string
          document_type_id?: string
          file_path?: string
          file_name?: string
          version?: number
          status?: DocumentStatus
          uploaded_by?: string
          reviewed_by?: string | null
          reviewer_comments?: string | null
          uploaded_at?: string
          reviewed_at?: string | null
        }
      }
      document_history: {
        Row: {
          id: string
          document_id: string
          action: string
          status: string
          comments: string | null
          performed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          action: string
          status: string
          comments?: string | null
          performed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          action?: string
          status?: string
          comments?: string | null
          performed_by?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          related_document_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          related_document_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          related_document_id?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
    }
  }
}
