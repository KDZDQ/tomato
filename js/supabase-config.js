/**
 * Supabase 配置 —— 替换为你自己的项目值
 */
const SUPABASE_URL = 'https://ljbbogmlisseuvpwzpbc.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY_HERE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
