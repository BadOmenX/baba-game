// Supabase 配置
const SUPABASE_URL = 'https://hpgpuwozekxmkvhoduwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZ3B1d296ZWt4bWt2aG9kdXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDExMjUsImV4cCI6MjA5NTE3NzEyNX0.gwu0eV5de73_AleWNJ0RxJdvuEyCbS9nvuqEbBD7I34';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);