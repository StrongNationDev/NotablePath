alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;
alter table public.payments enable row level security;

insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', true)
on conflict (id) do update set public = true;

drop policy if exists "workspace_files_insert" on storage.objects;
drop policy if exists "workspace_files_select" on storage.objects;

create policy "workspace_files_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace-files');

create policy "workspace_files_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'workspace-files');

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_client_own" on public.profiles;
drop policy if exists "profiles_select_staff" on public.profiles;
drop policy if exists "clients_select_own_email" on public.clients;
drop policy if exists "clients_insert_own_email" on public.clients;
drop policy if exists "clients_select_staff" on public.clients;
drop policy if exists "conversations_select_client_or_staff" on public.conversations;
drop policy if exists "conversations_insert_client_own" on public.conversations;
drop policy if exists "members_select_own_or_staff" on public.conversation_members;
drop policy if exists "members_insert_own" on public.conversation_members;
drop policy if exists "messages_select_member_or_staff" on public.messages;
drop policy if exists "messages_insert_self_member_or_staff" on public.messages;
drop policy if exists "offers_select_client_or_staff" on public.offers;
drop policy if exists "offers_insert_staff" on public.offers;
drop policy if exists "offers_insert_client_own" on public.offers;
drop policy if exists "payments_select_client_or_staff" on public.payments;
alter table public.offers drop constraint if exists offers_currency_usd_check;
alter table public.offers drop constraint if exists offers_currency_ngn_check;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_insert_client_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'client' and is_active = true);

create policy "profiles_select_staff"
  on public.profiles for select to authenticated
  using (public.get_my_role() in ('agent', 'admin'));

create policy "clients_select_own_email"
  on public.clients for select to authenticated
  using (primary_email = (select email from public.profiles where id = auth.uid()));

create policy "clients_insert_own_email"
  on public.clients for insert to authenticated
  with check (primary_email = (select email from public.profiles where id = auth.uid()));

create policy "clients_select_staff"
  on public.clients for select to authenticated
  using (public.get_my_role() in ('agent', 'admin'));

create policy "conversations_select_client_or_staff"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = conversations.client_id
        and c.primary_email = (select email from public.profiles where id = auth.uid())
    )
    or public.get_my_role() in ('agent', 'admin')
  );

create policy "conversations_insert_client_own"
  on public.conversations for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = conversations.client_id
        and c.primary_email = (select email from public.profiles where id = auth.uid())
    )
  );

create policy "members_select_own_or_staff"
  on public.conversation_members for select to authenticated
  using (
    profile_id = auth.uid()
    or public.get_my_role() in ('agent', 'admin')
  );

create policy "members_insert_own"
  on public.conversation_members for insert to authenticated
  with check (profile_id = auth.uid());

create policy "messages_select_member_or_staff"
  on public.messages for select to authenticated
  using (
    exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.profile_id = auth.uid())
    or public.get_my_role() in ('agent', 'admin')
  );

create policy "messages_insert_self_member_or_staff"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.profile_id = auth.uid())
      or public.get_my_role() in ('agent', 'admin')
    )
  );

create policy "offers_select_client_or_staff"
  on public.offers for select to authenticated
  using (
    exists (
      select 1 from public.conversations conversation
      join public.clients client_record on client_record.id = conversation.client_id
      where conversation.id = offers.conversation_id
        and client_record.primary_email = (select email from public.profiles where id = auth.uid())
    )
    or public.get_my_role() in ('agent', 'admin')
  );

create policy "offers_insert_staff"
  on public.offers for insert to authenticated
  with check (public.get_my_role() in ('agent', 'admin') and created_by = auth.uid() and currency = 'NGN');

create policy "offers_insert_client_own"
  on public.offers for insert to authenticated
  with check (
    public.get_my_role() = 'client'
    and created_by = auth.uid()
    and currency = 'NGN'
    and exists (
      select 1 from public.conversations conversation
      join public.clients client_record on client_record.id = conversation.client_id
      where conversation.id = offers.conversation_id
        and offers.client_id = client_record.id
        and client_record.primary_email = (select email from public.profiles where id = auth.uid())
    )
  );

create policy "payments_select_client_or_staff"
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.offers offer
      join public.conversations conversation on conversation.id = offer.conversation_id
      join public.clients client_record on client_record.id = conversation.client_id
      where offer.id = payments.offer_id
        and client_record.primary_email = (select email from public.profiles where id = auth.uid())
    )
    or public.get_my_role() in ('agent', 'admin')
  );

create unique index if not exists clients_primary_email_unique
  on public.clients (lower(primary_email));

create unique index if not exists conversation_members_unique_pair
  on public.conversation_members (conversation_id, profile_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_currency_ngn_check') then
    alter table public.offers add constraint offers_currency_ngn_check check (currency = 'NGN') not valid;
  end if;
end
$$;

create or replace function public.bootstrap_client_workspace(p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_name text;
  client_record_id uuid;
  workspace_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select email into current_email from auth.users where id = current_user_id;
  current_name := coalesce(nullif(trim(p_display_name), ''), split_part(current_email, '@', 1), 'NotablePath client');

  insert into public.profiles (id, email, full_name, role, is_active)
  values (current_user_id, current_email, current_name, 'client'::public.user_role, true)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  if exists (
    select 1 from public.profiles
    where id = current_user_id and (role <> 'client'::public.user_role or is_active is false)
  ) then
    raise exception 'This account is not enabled as a client';
  end if;

  select id into client_record_id
  from public.clients
  where lower(primary_email) = lower(current_email)
  order by created_at
  limit 1;

  if client_record_id is null then
    insert into public.clients (display_name, primary_contact_name, primary_email)
    values (current_name, current_name, current_email)
    returning id into client_record_id;
  end if;

  select id into workspace_conversation_id
  from public.conversations
  where client_id = client_record_id
  order by created_at
  limit 1;

  if workspace_conversation_id is null then
    insert into public.conversations (client_id, status)
    values (client_record_id, 'open'::public.conversation_status)
    returning id into workspace_conversation_id;
  end if;

  insert into public.conversation_members (conversation_id, profile_id)
  values (workspace_conversation_id, current_user_id)
  on conflict (conversation_id, profile_id) do nothing;

  return workspace_conversation_id;
end;
$$;

revoke all on function public.bootstrap_client_workspace(text) from public;
grant execute on function public.bootstrap_client_workspace(text) to authenticated;

create or replace function public.create_offer(
  p_conversation_id uuid,
  p_title text,
  p_description text,
  p_service_type text,
  p_amount numeric,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_agent_id uuid := auth.uid();
  target_client_id uuid;
  created_offer_id uuid;
begin
  if public.get_my_role() not in ('agent', 'admin') then
    raise exception 'Staff authorization is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Offer amount must be greater than zero';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null or nullif(trim(p_service_type), '') is null then
    raise exception 'Offer details are required';
  end if;
  select client_id into target_client_id from public.conversations where id = p_conversation_id;
  if target_client_id is null then raise exception 'Conversation was not found'; end if;
  insert into public.offers (conversation_id, client_id, created_by, title, description, service_type, amount, currency, status, expires_at)
  values (p_conversation_id, target_client_id, current_agent_id, trim(p_title), trim(p_description), trim(p_service_type), p_amount, 'NGN', 'sent', p_expires_at)
  returning id into created_offer_id;
  return created_offer_id;
end;
$$;

revoke all on function public.create_offer(uuid, text, text, text, numeric, timestamptz) from public;
grant execute on function public.create_offer(uuid, text, text, text, numeric, timestamptz) to authenticated;

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = coalesce(new.created_at, now()),
      last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers') then
    alter publication supabase_realtime add table public.offers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments') then
    alter publication supabase_realtime add table public.payments;
  end if;
end
$$;