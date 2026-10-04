-- Public portfolio document library, managed only through the admin API.

create table if not exists portfolio_documents (
    id              uuid primary key default gen_random_uuid(),
    title           text not null check (char_length(title) between 1 and 160),
    category        text not null check (category in ('document', 'presentation', 'publication')),
    document_type   text not null check (char_length(document_type) between 1 and 80),
    submitted_at    date,
    description     text,
    file_name       text not null,
    file_path       text not null unique,
    file_url        text not null,
    mime_type       text not null,
    size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
    is_published    boolean not null default true,
    sort_order      integer not null default 0,
    created_by      uuid references profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_portfolio_documents_public
    on portfolio_documents (is_published, category, sort_order, submitted_at desc);

alter table portfolio_documents enable row level security;
-- The FastAPI service-role client is the only database writer and the public
-- website reads through GET /api/v1/portfolio/documents.
grant all on table public.portfolio_documents to service_role;

-- Files are intentionally public: every published row links directly to its
-- Storage object. Upload/delete still require the service-role key through the
-- admin API; browsers never receive storage credentials.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'portfolio-documents',
    'portfolio-documents',
    true,
    26214400,
    array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
