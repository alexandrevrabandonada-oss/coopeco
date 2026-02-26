-- ECO Test Pack RPCs
-- Restricted to operator role

-- Promote User Role
CREATE OR REPLACE FUNCTION eco_promote_user(target_user_id uuid, new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify if the caller is an operator
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'operator'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas operadores podem promover roles.';
  END IF;

  UPDATE profiles
  SET role = new_role
  WHERE user_id = target_user_id;
END;
$$;

-- Set User Neighborhood
CREATE OR REPLACE FUNCTION eco_set_neighborhood(target_user_id uuid, neighborhood_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid uuid;
BEGIN
  -- Verify if the caller is an operator
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'operator'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas operadores podem mudar territórios.';
  END IF;

  SELECT id INTO nid FROM neighborhoods WHERE slug = neighborhood_slug;
  
  IF nid IS NULL THEN
    RAISE EXCEPTION 'Bairro não encontrado: %', neighborhood_slug;
  END IF;

  UPDATE profiles
  SET neighborhood_id = nid
  WHERE user_id = target_user_id;
END;
$$;
