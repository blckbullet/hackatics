/*
  # Schema para Sistema de Servicio Social Universitario

  ## 1. Tablas Principales
    
  ### `profiles`
  - `id` (uuid, FK a auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (enum: student, reviewer, admin)
  - `matricula` (text, único, solo para estudiantes)
  - `carrera` (text, solo para estudiantes)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `periods`
  - `id` (uuid, PK)
  - `name` (text) - ej: "Enero-Junio 2025"
  - `start_date` (date)
  - `end_date` (date)
  - `is_active` (boolean)
  - `created_by` (uuid, FK a profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `expedientes`
  - `id` (uuid, PK)
  - `student_id` (uuid, FK a profiles)
  - `period_id` (uuid, FK a periods)
  - `assigned_reviewer_id` (uuid, FK a profiles, nullable)
  - `progress_percentage` (numeric, 0-100)
  - `status` (enum: in_progress, completed, cancelled)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `document_types`
  - `id` (uuid, PK)
  - `name` (text) - ej: "Solicitud", "Informe Final"
  - `description` (text)
  - `required` (boolean)
  - `order_number` (integer)
  - `created_at` (timestamptz)

  ### `documents`
  - `id` (uuid, PK)
  - `expediente_id` (uuid, FK a expedientes)
  - `document_type_id` (uuid, FK a document_types)
  - `file_path` (text) - ruta en Supabase Storage
  - `file_name` (text)
  - `version` (integer, default 1)
  - `status` (enum: pending, in_review, accepted, rejected, correction_requested)
  - `uploaded_by` (uuid, FK a profiles)
  - `reviewed_by` (uuid, FK a profiles, nullable)
  - `reviewer_comments` (text, nullable)
  - `uploaded_at` (timestamptz)
  - `reviewed_at` (timestamptz, nullable)

  ### `document_history`
  - `id` (uuid, PK)
  - `document_id` (uuid, FK a documents)
  - `action` (text) - uploaded, accepted, rejected, etc.
  - `status` (text)
  - `comments` (text, nullable)
  - `performed_by` (uuid, FK a profiles)
  - `created_at` (timestamptz)

  ### `notifications`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK a profiles)
  - `title` (text)
  - `message` (text)
  - `type` (text) - document_status, comment, assignment
  - `related_document_id` (uuid, FK a documents, nullable)
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz)

  ## 2. Seguridad (RLS)
  - Todas las tablas tienen RLS habilitado
  - Políticas específicas por rol para cada operación

  ## 3. Índices
  - Índices en FKs y campos de búsqueda frecuente
*/

-- Create enum types
CREATE TYPE user_role AS ENUM ('student', 'reviewer', 'admin');
CREATE TYPE expediente_status AS ENUM ('in_progress', 'completed', 'cancelled');
CREATE TYPE document_status AS ENUM ('pending', 'in_review', 'accepted', 'rejected', 'correction_requested');

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  matricula text UNIQUE,
  carrera text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Periods table
CREATE TABLE IF NOT EXISTS periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Document types table
CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  required boolean DEFAULT true,
  order_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Expedientes table
CREATE TABLE IF NOT EXISTS expedientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES periods(id),
  assigned_reviewer_id uuid REFERENCES profiles(id),
  progress_percentage numeric(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status expediente_status DEFAULT 'in_progress',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, period_id)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES document_types(id),
  file_path text NOT NULL,
  file_name text NOT NULL,
  version integer DEFAULT 1,
  status document_status DEFAULT 'pending',
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  reviewed_by uuid REFERENCES profiles(id),
  reviewer_comments text,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- Document history table
CREATE TABLE IF NOT EXISTS document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL,
  comments text,
  performed_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  related_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_matricula ON profiles(matricula);
CREATE INDEX IF NOT EXISTS idx_periods_is_active ON periods(is_active);
CREATE INDEX IF NOT EXISTS idx_expedientes_student ON expedientes(student_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_reviewer ON expedientes(assigned_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_period ON expedientes(period_id);
CREATE INDEX IF NOT EXISTS idx_documents_expediente ON documents(expediente_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_document_history_document ON document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles

-- Helper function to get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Reviewers and admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('reviewer', 'admin'));

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for periods
CREATE POLICY "Everyone can view periods"
  ON periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage periods"
  ON periods FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- RLS Policies for document_types
CREATE POLICY "Everyone can view document types"
  ON document_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage document types"
  ON document_types FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- RLS Policies for expedientes
CREATE POLICY "Students can view their own expedientes"
  ON expedientes FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Reviewers can view assigned expedientes"
  ON expedientes FOR SELECT
  TO authenticated
  USING (
    assigned_reviewer_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Admins can manage all expedientes"
  ON expedientes FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Reviewers can update assigned expedientes"
  ON expedientes FOR UPDATE
  TO authenticated
  USING (assigned_reviewer_id = auth.uid())
  WITH CHECK (assigned_reviewer_id = auth.uid());

CREATE POLICY "Students can create their own expedientes"
  ON expedientes FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- RLS Policies for documents
CREATE POLICY "Students can view their own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM expedientes
      WHERE expedientes.id = documents.expediente_id
      AND expedientes.student_id = auth.uid()
    )
  );

CREATE POLICY "Reviewers can view documents from assigned expedientes"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expedientes
      WHERE expedientes.id = documents.expediente_id
      AND (
        expedientes.assigned_reviewer_id = auth.uid()
        OR public.get_my_role() = 'admin'
      )
    )
  );

CREATE POLICY "Students can upload documents to their expedientes"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expedientes
      WHERE expedientes.id = documents.expediente_id
      AND expedientes.student_id = auth.uid()
    )
  );

CREATE POLICY "Reviewers can update documents from assigned expedientes"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expedientes
      WHERE expedientes.id = documents.expediente_id
      AND expedientes.assigned_reviewer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expedientes
      WHERE expedientes.id = documents.expediente_id
      AND expedientes.assigned_reviewer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all documents"
  ON documents FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- RLS Policies for document_history
CREATE POLICY "Users can view history of their related documents"
  ON document_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      JOIN expedientes ON expedientes.id = documents.expediente_id
      WHERE documents.id = document_history.document_id
      AND (
        expedientes.student_id = auth.uid()
        OR expedientes.assigned_reviewer_id = auth.uid()
        OR public.get_my_role() = 'admin'
      )
    )
  );

CREATE POLICY "System can insert document history"
  ON document_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default document types
INSERT INTO document_types (name, description, required, order_number) VALUES
  ('Solicitud de Servicio Social', 'Documento de solicitud inicial para el servicio social', true, 1),
  ('Carta Compromiso', 'Carta de compromiso firmada por el estudiante', true, 2),
  ('Carta de Aceptación', 'Carta de aceptación de la institución receptora', true, 3),
  ('Plan de Trabajo', 'Plan detallado de las actividades a realizar', true, 4),
  ('Informe Mensual 1', 'Primer informe mensual de actividades', true, 5),
  ('Informe Mensual 2', 'Segundo informe mensual de actividades', true, 6),
  ('Informe Mensual 3', 'Tercer informe mensual de actividades', true, 7),
  ('Informe Mensual 4', 'Cuarto informe mensual de actividades', true, 8),
  ('Informe Final', 'Informe final del servicio social', true, 9),
  ('Carta de Liberación', 'Carta de liberación del servicio social', true, 10)
ON CONFLICT DO NOTHING;

-- Create Storage Bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf'];


-- RLS Policies for storage.objects
CREATE POLICY "Students can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM expedientes e
      WHERE e.student_id = auth.uid()
      AND e.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Students can view their own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM expedientes e
      WHERE e.student_id = auth.uid()
      AND e.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Reviewers and admins can view all documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    get_my_role() IN ('reviewer', 'admin')
  );

CREATE POLICY "Authenticated users can update their own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM expedientes e
      WHERE e.student_id = auth.uid()
      AND e.id::text = (storage.foldername(name))[1]
    )
  );
