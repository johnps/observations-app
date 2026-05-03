-- Initial tag seed — run once in Supabase SQL Editor
-- Requires the tags table to exist with a unique constraint on name.
-- If ON CONFLICT fails, run first:
--   ALTER TABLE public.tags ADD CONSTRAINT tags_name_key UNIQUE (name);

INSERT INTO public.tags (name, description, retired)
VALUES
  ('group_formation',           'Forming or reviewing a women''s self-help group',                   false),
  ('training_life_skills',      'Weekly training session on life skills',                            false),
  ('training_literacy',         'Weekly training session on literacy skills',                        false),
  ('training_livelihood_skills','Weekly training session on livelihood skills',                      false),
  ('kitchen_garden',            'Setting up or reviewing a kitchen garden',                          false),
  ('livelihood_planning',       'Planning household livelihoods (target: 2 per household)',          false),
  ('input_purchase',            'Helping household purchase inputs or assets with government funds', false),
  ('livelihood_setup',          'Setting up the livelihood (infrastructure, equipment, etc.)',       false),
  ('livelihood_execution',      'Training or supporting household in running the livelihood',        false),
  ('livelihood_profit',         'Reviewing or supporting profit generation from the livelihood',     false),
  ('scheme_documents',          'Helping household prepare documents for government schemes',        false),
  ('scheme_application',        'Helping household apply for government schemes',                    false),
  ('scheme_benefit_tracking',   'Checking if household has received scheme benefits',                false)
ON CONFLICT (name) DO NOTHING;
