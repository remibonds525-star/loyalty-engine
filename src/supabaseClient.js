import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svpnehvmppbotqamwcgm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cG5laHZtcHBib3RxYW13Y2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTQzMzYsImV4cCI6MjA4NTY3MDMzNn0.MSpTtM5CP-OsF66QAS6Tp8E5Mer2rgcqGRMZnJiWJLg';

export const supabase = createClient(supabaseUrl, supabaseKey);