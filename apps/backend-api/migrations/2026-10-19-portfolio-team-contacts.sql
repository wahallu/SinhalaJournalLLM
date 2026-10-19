-- Contact links shown on the four member cards of the public portfolio.
-- Names, photos and roles stay in apps/portfolio/content/team.ts; only the
-- contact details live here so an admin can change them without a deploy.
-- Rows are keyed by student ID, which is how the portfolio matches a card.

create table if not exists portfolio_team_contacts (
    student_id      text primary key check (char_length(student_id) between 1 and 20),
    name            text not null check (char_length(name) between 1 and 100),
    phone           text check (phone is null or char_length(phone) <= 25),
    linkedin_url    text check (linkedin_url is null or char_length(linkedin_url) <= 300),
    github_url      text check (github_url is null or char_length(github_url) <= 300),
    sort_order      integer not null default 0,
    updated_at      timestamptz not null default now()
);

alter table portfolio_team_contacts enable row level security;
-- Only the FastAPI service-role client reads or writes this table; the public
-- website reads through GET /api/v1/portfolio/team-contacts.
grant all on table public.portfolio_team_contacts to service_role;

-- GitHub handles are the repository's collaborators, matched to members by
-- commit email. LinkedIn links are the ones each member publishes on their
-- own GitHub profile or personal site. Blank values are filled in from the
-- admin panel (Admin → Team contacts).
insert into portfolio_team_contacts (student_id, name, linkedin_url, github_url, sort_order)
values
  ('IT22207272', 'Nisal Fonseka',        'https://www.linkedin.com/in/nisalfonseka/',             'https://github.com/nisalfonseka',  0),
  ('IT22228062', 'Akash Jayasinghe',     'https://www.linkedin.com/in/akash-jayasinghe/',         'https://github.com/AKAZJAYA',      1),
  ('IT22049872', 'Chathushka Navod',     'https://www.linkedin.com/in/chathushka-navod-withanage', 'https://github.com/chathuwa-whiz', 2),
  ('IT22246332', 'Sandun Hettiarachchi', null,                                                     'https://github.com/sandunlak',     3)
on conflict (student_id) do nothing;
