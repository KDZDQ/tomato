/**
 * Supabase 配置 —— 替换为你自己的项目值
 */
const SUPABASE_URL = 'https://ljbbogmlisseuvpwzpbc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqYmJvZ21saXNzZXV2cHd6cGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjU4ODEsImV4cCI6MjA4ODEwMTg4MX0.eZVDtfmnYIAGG57krksLHbGkiW_qYKSEHWwY8463oFc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
