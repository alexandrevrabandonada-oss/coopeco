# ECO Operational Flow Guide

This guide describes the complete lifecycle of a pickup request within the ECO PWA.

## 1. Authentication & Onboarding
- **Route**: `/perfil`
- **Flow**:
    - User authenticates via Email OTP (Magic Link).
    - If new, the app presents the **Onboarding** screen.
    - User selects their **Neighborhood** (crucial for local logistics) and sets a **Display Name**.
    - Profile is created with the `resident` role by default.

## 2. Requesting a Pickup
- **Route**: `/pedir-coleta`
- **Flow**:
    - **Step 1 (Items)**: Dynamic list of materials (Plastic, Paper, etc.) and quantities.
    - **Step 2 (Logistics)**: Private address and phone number entry.
    - **Step 3 (Review)**: Final industrial-style summary.
    - **Submission**: Creates `pickup_request` (public) and `pickup_request_private` (sensitive data).

## 3. Cooperator Interaction
- **Route**: `/cooperado`
- **Flow**:
    - Cooperators see "Open" requests in their own neighborhood.
    - Clicking **Accept** assigns the cooperator to the request and unlocks the resident's private address/phone.
    - Cooperator updates status: **En Route** -> **Collected**.

## 4. Verification & Social Proof
- **Route**: `/cooperado/pedido/[id]`
- **Flow**:
    - Cooperator finalizes the collection by uploading a **Photo Proof** (compressed client-side).
    - A unique **ECO Receipt** is generated with a dedicated code.
    - A **Post** is automatically created in the Mural.

## 5. Social Impact
- **Route**: `/mural`
- **Flow**:
    - Residents see the impact from their neighborhood.
    - Each post links back to the official verified receipt.
    - Interactions: **Apoiar** (Acknowledge), **Replicar** (Inspiration), **Chamado** (Action).

## Security & RLS
Private data (Address/Phone) is protected by RLS and only becomes visible to the `created_by` user or the `assigned_cooperado` (once accepted).
