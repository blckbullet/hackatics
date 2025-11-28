-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, matricula, carrera)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    NULLIF(NEW.raw_user_meta_data->>'matricula', ''),
    NULLIF(NEW.raw_user_meta_data->>'carrera', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.create_profile_for_new_user();
