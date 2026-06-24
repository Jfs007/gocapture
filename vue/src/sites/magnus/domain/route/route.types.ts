export interface RouteResolverTrace {
  matched?: boolean;
  pagePath?: string;
  projectKind?: string;
  adapters?: string[];
  hits?: Array<Record<string, unknown>>;
  errors?: string[];
  [key: string]: unknown;
}
