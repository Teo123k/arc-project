create table if not exists arc_intentions (
  id uuid default gen_random_uuid() primary key,
  intention text not null,
  friction text,
  action text,
  priority text,
  status text not null default 'captured',
  created_at timestamptz default now()
);
