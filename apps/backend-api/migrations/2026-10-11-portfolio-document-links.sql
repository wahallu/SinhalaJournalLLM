-- A portfolio document may now be just a link (the file is hosted elsewhere),
-- or have no link yet ("pending"). Rows uploaded through Supabase Storage keep
-- every column they have today.
--
-- Rolling back means deleting link-only rows first; the NOT NULL constraints
-- cannot be restored while any row has a NULL file column.

alter table portfolio_documents
    alter column file_name drop not null,
    alter column file_path drop not null,
    alter column file_url drop not null,
    alter column mime_type drop not null,
    alter column size_bytes drop not null;

alter table portfolio_documents
    drop constraint if exists portfolio_documents_size_bytes_check;

alter table portfolio_documents
    add constraint portfolio_documents_size_bytes_check
    check (size_bytes is null or (size_bytes > 0 and size_bytes <= 26214400));
