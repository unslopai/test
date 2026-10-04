create table users (
    id serial primary key,
    username text unique not null,
    email text unique not null,
    password_hash text not null,
    reset_token text,
    reset_token_expires_at timestamptz
);

create table products (
    id serial primary key,
    name text not null,
    price_cents integer not null
);

create table orders (
    id serial primary key,
    user_id integer references users(id),
    status text not null default 'pending',
    payment_intent_id text
);

create table contact_messages (
    id serial primary key,
    name text not null,
    email text not null,
    message text not null,
    created_at timestamptz not null default now()
);
