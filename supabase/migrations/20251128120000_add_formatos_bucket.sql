-- Create Storage Bucket for 'formatos'
-- This bucket will store document templates managed by admins.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('formatos', 'formatos', false, 10485760, ARRAY['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage.objects in the 'formatos' bucket

-- 1. Admins have full access to the 'formatos' bucket.
-- This allows admins to upload, download, rename (move), and delete files.
CREATE POLICY "Admins can manage all 'formatos'"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'formatos' AND
    public.get_my_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'formatos' AND
    public.get_my_role() = 'admin'
  );

-- 2. Any authenticated user can view and download files from the 'formatos' bucket.
-- This allows students and reviewers to access the templates.
CREATE POLICY "Authenticated users can view 'formatos'"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'formatos'
  );