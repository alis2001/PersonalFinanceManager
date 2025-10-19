export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  is_active: boolean;
  parent_id?: string;
  level: number;
  path: string;
  path_ids: string[];
  children?: Category[];
  created_at: string;
  updated_at: string;
}
