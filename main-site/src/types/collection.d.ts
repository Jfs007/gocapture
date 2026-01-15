export interface CategoryOption {
  label: string;
  value: string;
  children?: CategoryOption[];
  [key: string]: any;
}

export interface SelectedCategory {
  label: string;
  value: string;
  path: string[];
}

export interface CollectionTask {
  id: string;
  taskName: string;
  count: number;
  status: 'collecting' | 'completed' | 'failed' | 'stopped';
  createTime: string;
  categories: string[];
  productCount: number;
  factoryCount: number;
}

export interface CollectionSettings {
  categories: SelectedCategory[];
  rankingTime: number;
  maxProductsPerCategory: number;
  maxFactoriesPerProduct: number;
}

export {};
