export interface PageRequest {
  url?: string;
  pathname?: string;
  method?: string;
  requestKeys?: string[];
  [key: string]: unknown;
}
