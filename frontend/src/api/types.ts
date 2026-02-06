export type FlowDirection = "source_to_target" | "target_to_source" | "bidirectional";

export type GraphNode = {
  id: string;
  kind: string;
  name: string;
  metadata: Record<string, any> | null;

  etag: string;

  created_at?: string | number[];
  updated_at?: string | number[];
};

export type GraphEdgeFlow = {
  id: string;

  claim_id: string | null;

  flow_type: string;
  direction: FlowDirection;

  data_category_id: string | null;
  protocol: string | null;
  frequency: string | null;

  implicit: boolean;

  created_at: string | number[];
};

export type GraphLink = {
  id: string;

  source: string;
  target: string;

  kind: string;
  metadata: Record<string, any> | null;

  etag: string;

  current_claim_id?: string | null;

  review_claim_id?: string | null;

  flows?: GraphEdgeFlow[];

  review_flows?: GraphEdgeFlow[];

  created_at?: string | number[];
  updated_at?: string | number[];
};

export type GraphResponse = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type PathResult = {
  node_ids: string[];
  edge_ids: string[];
};

export type PathsResponse = {
  from: string;
  to: string;
  max_depth: number;
  min_confidence: number;
  include_needs_review: boolean;
  paths: PathResult[];
};

export type ComplianceResult = {
  matched_pii_nodes?: string[];
  node_ids: string[];
  edge_ids: string[];
};

export type ComplianceResponse = {
  min_confidence: number;
  include_needs_review: boolean;
  results: ComplianceResult[];
};

export type RecommendedMetadataKey = {
  key: string;
  description?: string;
  required?: boolean;
};

export type SchemaKind = {
  kind: string;
  display_name: string;
  description?: string | null;
  ui_hints?: Record<string, any> | null;

  recommended_metadata_keys?: RecommendedMetadataKey[];
};

export type SchemaKindsResponse = {
  node_kinds: SchemaKind[];
  edge_kinds: SchemaKind[];
};

export type BlastRadiusResponse = {
  node_ids: string[];
  edge_ids: string[];
};

export type EdgeClaimFlow = {
  id: string;
  claim_id: string;
  flow_type: string;
  direction: FlowDirection;

  data_category_id: string | null;
  protocol: string | null;
  frequency: string | null;

  created_at: string | number[];
};

export type EdgeClaim = {
  id: string;
  edge_id: string;
  status: "active" | "needs_review" | "retired";
  confidence: number;
  comment: string | null;
  created_by: string;
  created_at: string | number[];
  updated_at: string | number[];
};
