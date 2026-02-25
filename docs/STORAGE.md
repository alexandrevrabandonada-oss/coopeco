# ECO Storage Guide

## Bucket Details
- **Name**: `eco-media`
- **Access**: Private (Authenticated only via Signed URLs)

## Path Conventions

### 1. Receipts
**Path**: `receipts/{receipt_id}/{uuid}.jpg`
- **Access**: Restricted to the Request Creator, Assigned Cooperado, and Operators.
- **Usage**: Proof of collection photos.

### 2. Social Posts
**Path**: `posts/{post_id}/{uuid}.jpg`
- **Access**: Authenticated users (further limited by post privacy logic in the app).
- **Usage**: Images shared in the Mural.

### 3. Community Actions (Mutirões)
**Path**: `mutiroes/{post_id}/{uuid}.jpg`
- **Access**: Publicly visible (Authenticated) when associated with a public post.

## Security Pattern
We do **not** use public bucket URLs. All images must be served via **Signed URLs** generated on the server or client (with RLS validation).

### Implementation Checklist
- [x] Create bucket `eco-media`.
- [x] Apply RLS policies for `INSERT`, `SELECT`, and `DELETE`.
- [ ] Implement useStorage hook for signed URLs.
- [ ] Implement MediaUpload component with compression.
