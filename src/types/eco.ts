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
    status: 'open' | 'accepted' | 'en_route' | 'collected';
    assigned_cooperado?: string;
    notes?: string;
    created_at: string;
    resident?: { display_name: string };
    neighborhood?: { name: string };
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
    created_at: string;
    request?: PickupRequest;
    cooperado?: { display_name: string };
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

export interface TransparencyMonth {
    neighborhood_id: string
    month: string
    receipts_count: number
    mutiroes_count: number
    chamados_count: number
    impact_score: number
}
