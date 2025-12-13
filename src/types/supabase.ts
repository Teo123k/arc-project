export interface Database {
  public: {
    Tables: {
      arc_intentions: {
        Row: {
          id: string
          intention: string
          friction: string | null
          action: string | null
          priority: string | null
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          intention: string
          friction?: string | null
          action?: string | null
          priority?: string | null
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          intention?: string
          friction?: string | null
          action?: string | null
          priority?: string | null
          status?: string
          created_at?: string | null
        }
      }
    }
  }
}
