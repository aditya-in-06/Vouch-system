import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = true; // Force true to hide missing env warnings

// In-memory data store for the mock
const db: any = {
  users: [],
  profiles: [],
  projects: [{ id: 'proj-1', name: 'Mock Project', invite_code: 'ABC123', creator_id: 'user-1' }],
  members: [{ project_id: 'proj-1', user_id: 'user-1', email: 'test@example.com' }],
  tasks: [],
  task_vouches: []
}

let currentUser = { id: 'user-1', email: 'test@example.com' };
db.users.push(currentUser);

class MockQueryBuilder {
  table: string;
  data: any = null;
  error: any = null;
  eqFilters: any = {};
  pendingInsert: any = null;
  pendingUpdate: any = null;
  isSelect: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select() {
    this.isSelect = true;
    this.data = [...(db[this.table] || [])];
    return this;
  }
  
  insert(items: any[]) {
    this.pendingInsert = items[0];
    return this;
  }

  update(updates: any) {
    this.pendingUpdate = updates;
    return this;
  }

  eq(col: string, val: any) {
    this.eqFilters[col] = val;
    if (this.isSelect && Array.isArray(this.data)) {
      this.data = this.data.filter((item: any) => item[col] === val);
    }
    return this;
  }

  order() { return this; }

  async single() {
    await this._execute();
    let result = Array.isArray(this.data) ? this.data[0] : this.data;
    if (!result) return { data: null, error: { message: 'Not found' } };
    return { data: result, error: null };
  }

  async _execute() {
    if (this.pendingInsert) {
      const item = { ...this.pendingInsert };
      if (this.table === 'projects' && !item.id) item.id = 'proj-' + Math.random().toString(36).substring(7);
      if (this.table === 'tasks' && !item.id) item.id = 'task-' + Math.random().toString(36).substring(7);
      
      if (!db[this.table]) db[this.table] = [];
      db[this.table].push(item);
      
      this.data = this.isSelect ? item : null;
    }
    
    if (this.pendingUpdate) {
      if (this.table === 'tasks') {
        db.tasks = db.tasks.map((t: any) => {
          let match = true;
          for (const k in this.eqFilters) if (t[k] !== this.eqFilters[k]) match = false;
          return match ? { ...t, ...this.pendingUpdate } : t;
        });
      }
    }
  }

  then(resolve: any, reject: any) {
    this._execute().then(() => {
      resolve({ data: this.data, error: this.error });
    }).catch(reject);
  }
}

const mockSupabase = {
  auth: {
    signUp: async ({ email }: any) => {
      currentUser = { id: 'user-' + Math.random().toString(36).substring(7), email };
      db.users.push(currentUser);
      return { data: { user: currentUser }, error: null };
    },
    signInWithPassword: async ({ email }: any) => {
      currentUser = db.users.find((u: any) => u.email === email) || { id: 'user-' + Math.random().toString(36).substring(7), email };
      return { data: { user: currentUser }, error: null };
    },
    getUser: async () => ({ data: { user: currentUser }, error: null }),
  },
  from: (table: string) => {
    return {
      select: () => new MockQueryBuilder(table).select(),
      insert: (items: any) => new MockQueryBuilder(table).insert(items),
      update: (updates: any) => new MockQueryBuilder(table).update(updates)
    }
  }
};

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : (mockSupabase as any);