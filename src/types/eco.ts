export interface Neighborhood {
    id: string;
    slug: string;
    name: string;
    created_at: string;
}

export interface Profile {
    user_id: string;
    role: 'resident' | 'cooperado' | 'operator';
    display_name: string;
    neighborhood_id?: string;
    neighborhood?: Neighborhood;
    created_at: string;
}

export interface PickupItem {
    id: string;
    request_id: string;
    material: string;
    unit: string;
    qty: number;
    created_at: string;
}

export interface PickupPrivate {
    id: string;
    request_id: string;
    address_full: string;
    contact_phone: string;
    created_at: string;
}

export interface PickupRequest {
    id: string;
    created_by: string;
    neighborhood_id: string;
    route_window_id?: string | null;
    scheduled_for?: string | null;
    is_recurring?: boolean;
    subscription_id?: string | null;
    fulfillment_mode?: "doorstep" | "drop_point";
    drop_point_id?: string | null;
    status: 'open' | 'accepted' | 'en_route' | 'collected';
    assigned_cooperado?: string;
    notes?: string;
    created_at: string;
    resident?: { display_name: string };
    neighborhood?: { name: string };
    drop_point?: EcoDropPoint | null;
    items?: PickupItem[];
    private?: PickupPrivate[];
    receipt?: { id: string; receipt_code: string };
}

export interface Receipt {
    id: string;
    request_id: string;
    cooperado_id: string;
    receipt_code: string;
    proof_photo_path?: string | null;
    final_notes?: string | null;
    quality_status?: "ok" | "attention" | "contaminated";
    quality_notes?: string | null;
    contamination_flags?: string[] | null;
    created_at: string;
    request?: PickupRequest;
    cooperado?: { display_name: string };
    receipt_tip?: ReceiptTip | ReceiptTip[] | null;
}

export interface EduTip {
    id: string;
    slug: string;
    title: string;
    body: string;
    material?: string | null;
    flag?: string | null;
    locale: string;
    active: boolean;
}

export interface ReceiptTip {
    receipt_id: string;
    tip_id: string;
    created_at: string;
    tip?: EduTip | null;
}

export interface Post {
    id: string;
    created_by: string;
    neighborhood_id: string;
    kind: 'registro' | 'recibo' | 'mutirao' | 'chamado' | 'ponto_critico' | 'transparencia' | 'receipt';
    title?: string;
    body?: string;
    receipt_id?: string;
    created_at: string;
    author?: { display_name: string };
    neighborhood?: { name: string };
    receipt?: Receipt;
}

export interface MediaObject {
    id: string;
    bucket: string;
    path: string;
    owner_id: string;
    entity_type: "receipt" | "post";
    entity_id: string;
    mime: string;
    bytes: number;
    created_at: string;
}

export interface NeighborhoodRank {
    id: string
    slug: string
    name: string
    impact_score: number
    receipts_count: number
    mutiroes_count: number
    chamados_count: number
}

export interface PartnerRank {
    id: string
    name: string
    impact_score: number
    receipts_count: number
}

export interface RouteWindow {
    id: string;
    neighborhood_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    capacity: number;
    active: boolean;
    created_at: string;
    updated_at?: string;
}

export interface RecurringSubscription {
    id: string;
    created_by: string;
    neighborhood_id: string;
    fulfillment_mode?: "doorstep" | "drop_point";
    drop_point_id?: string | null;
    scope: "resident" | "partner";
    partner_id?: string | null;
    cadence: "weekly" | "biweekly";
    preferred_weekday: number;
    preferred_window_id?: string | null;
    address_ref?: string | null;
    notes?: string | null;
    status: "active" | "paused";
    created_at: string;
    updated_at?: string;
}

export interface PartnerAnchor {
    partner_id: string;
    anchor_level: "bronze" | "prata" | "ouro";
    pickup_volume_hint?: string | null;
    active: boolean;
    created_at: string;
}

export interface AnchorCommitment {
    id: string;
    partner_id: string;
    level: "bronze" | "prata" | "ouro";
    monthly_commitment_text: string;
    status: "draft" | "active" | "paused" | "closed";
    created_at: string;
    updated_at?: string;
}

export interface EcoDropPoint {
    id: string;
    neighborhood_id: string;
    partner_id?: string | null;
    name: string;
    address_public: string;
    hours: string;
    accepted_materials: Array<"paper" | "plastic" | "metal" | "glass" | "oil" | "ewaste" | "reject">;
    active: boolean;
    created_at: string;
}

export interface TransparencyMonth {
    neighborhood_id: string
    month: string
    receipts_count: number
    mutiroes_count: number
    chamados_count: number
    impact_score: number
}

export interface PickupAddressProfile {
    user_id: string;
    address_full: string;
    contact_phone?: string | null;
    geo_lat?: number | null;
    geo_lng?: number | null;
    created_at: string;
    updated_at?: string;
}

export interface RecurringOccurrence {
    id: string;
    subscription_id: string;
    route_window_id: string;
    scheduled_for: string;
    request_id?: string | null;
    status: "generated" | "skipped_capacity" | "skipped_paused" | "skipped_invalid";
    created_at: string;
}

export interface UserNotification {
    id: string;
    user_id: string;
    kind: "recurring_skipped_invalid" | "recurring_skipped_capacity" | "request_status" | "receipt_ready" | "window_queue_ready";
    title: string;
    body: string;
    action_url?: string | null;
    entity_type?: "subscription" | "request" | "receipt" | "window" | null;
    entity_id?: string | null;
    is_read: boolean;
    created_at: string;
}

export interface PilotProgram {
    id: string;
    city: string;
    status: 'planning' | 'active' | 'paused' | 'completed';
    starts_on?: string;
    notes_public?: string;
    notes_ops?: string;
    created_at: string;
    updated_at: string;
}

export interface PilotProgramNeighborhood {
    id: string;
    program_id: string;
    neighborhood_id: string;
    priority: number;
    status: 'active' | 'inactive';
    neighborhood?: Neighborhood;
}

export interface PilotChecklist {
    id: string;
    program_id: string;
    kind: 'opening' | 'before_window' | 'during_window' | 'closing_day' | 'closing_week';
    title: string;
    created_at: string;
}

export interface PilotChecklistItem {
    id: string;
    checklist_id: string;
    neighborhood_id: string;
    task_key: string;
    title: string;
    status: 'todo' | 'done' | 'skipped';
    meta?: any;
    completed_at?: string;
    completed_by?: string;
}

export interface WeeklyBulletin {
    id: string;
    neighborhood_id: string;
    year: number;
    week_number: number;
    status: 'draft' | 'published' | 'archived';
    published_at?: string;
    created_at: string;
    neighborhood?: Neighborhood;
}

export interface WeeklyBulletinBlock {
    id: string;
    bulletin_id: string;
    kind: 'stats' | 'contamination' | 'decisions' | 'highlights';
    content: any;
    rank_order: number;
}

export interface NeighborhoodWeeklySnapshot {
    neighborhood_id: string;
    week_start: string;
    receipts_count: number;
    ok_rate: number;
    drop_point_share_pct: number;
    active_anchors_count: number;
}

export interface EcoGamificationLevel {
    id: number;
    name: string;
    min_score: number;
    badge_url?: string;
    color_hex: string;
}

export interface EcoGamificationBadge {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon_name: string;
}

export interface ProfileGamificationSummary {
    user_id: string;
    display_name: string;
    impact_score: number;
    badges_count: number;
    level_id: number;
    level_name: string;
    level_color: string;
    level_min: number;
    next_level_min: number | null;
    next_level_name: string | null;
}

export interface OnboardingState {
    user_id: string;
    step: 'start' | 'neighborhood' | 'mode' | 'address' | 'first_action' | 'done';
    chosen_mode?: 'drop_point' | 'doorstep';
    chosen_drop_point_id?: string;
    chosen_window_id?: string;
    completed_at?: string;
    updated_at: string;
}
