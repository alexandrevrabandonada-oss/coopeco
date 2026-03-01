"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ecoOutbox, OutboxItem } from './db';
import { createClient } from '@/lib/supabase';
import { uploadMediaFiles } from '@/lib/storage-helpers';
import { reportObsEvent } from '@/lib/obs';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

interface SyncContextType {
    status: SyncStatus;
    outboxCount: number;
    enqueue: (type: OutboxItem['type'], payload: any) => Promise<string>;
    triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [syncing, setSyncing] = useState(false);
    const [outboxCount, setOutboxCount] = useState(0);
    const [lastError, setLastError] = useState<string | null>(null);

    const supabase = createClient();

    const updateOutboxCount = useCallback(async () => {
        const items = await ecoOutbox.getAll();
        setOutboxCount(items.length);
    }, []);

    const triggerSync = useCallback(async () => {
        if (!navigator.onLine || syncing) return;

        const items = await ecoOutbox.getAll();
        if (items.length === 0) return;

        setSyncing(true);
        setLastError(null);

        // Process items in order
        const sorted = items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        for (const item of sorted) {
            try {
                let success = false;

                if (item.type === 'set_status') {
                    const { error } = await supabase
                        .from('pickup_requests')
                        .update({ status: item.payload.status })
                        .eq('id', item.payload.id);
                    if (!error) success = true;
                } else if (item.type === 'create_receipt') {
                    // Idempotent receipt creation
                    const { error } = await supabase
                        .from('receipts')
                        .upsert({
                            request_id: item.payload.request_id,
                            ...item.payload.data
                        }, { onConflict: 'request_id' });
                    if (!error) success = true;
                } else if (item.type === 'upload_media') {
                    const { files, entityType, entityId } = item.payload;
                    const result = await uploadMediaFiles(files, entityType, entityId);
                    if (result.length > 0) {
                        success = true;
                        if (entityType === 'receipt') {
                            await supabase
                                .from('receipts')
                                .update({ proof_photo_path: result[0].path })
                                .eq('id', entityId);
                        }
                    }
                }

                if (success) {
                    await ecoOutbox.remove(item.id);
                } else {
                    item.retries++;
                    await ecoOutbox.update(item);
                    // If a dependent action fails, we might want to stop or continue. 
                    // For now, we continue but mark error.
                }
            } catch (e: any) {
                console.error("Sync error for item", item.id, e);
                item.retries++;
                await ecoOutbox.update(item);

                reportObsEvent({
                    event_kind: item.type === 'upload_media' ? 'upload_fail' : 'sync_fail',
                    severity: item.retries > 3 ? 'error' : 'warn',
                    context_kind: 'feature',
                    context_key: `offline_sync:${item.type}`,
                    message: e.message || "Unknown sync error",
                    meta: { item_id: item.id, retries: item.retries }
                });
            }
        }

        await updateOutboxCount();
        setSyncing(false);
    }, [supabase, syncing, updateOutboxCount]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            reportObsEvent({
                event_kind: 'offline_exit',
                severity: 'info',
                message: "Dispositivo voltou a ficar online."
            });
            triggerSync();
        };
        const handleOffline = () => {
            setIsOnline(false);
            reportObsEvent({
                event_kind: 'offline_enter',
                severity: 'info',
                message: "Dispositivo entrou em modo offline."
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        updateOutboxCount();

        const interval = setInterval(() => {
            if (navigator.onLine) triggerSync();
        }, 30000); // Check every 30s

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [triggerSync, updateOutboxCount]);

    const enqueue = async (type: OutboxItem['type'], payload: any) => {
        const id = crypto.randomUUID();
        const item: OutboxItem = {
            id,
            type,
            payload,
            created_at: new Date().toISOString(),
            retries: 0
        };
        await ecoOutbox.enqueue(item);
        await updateOutboxCount();

        if (navigator.onLine) triggerSync();

        return id;
    };

    const status: SyncStatus = syncing ? 'syncing' : (isOnline ? 'online' : 'offline');

    return (
        <SyncContext.Provider value={{ status, outboxCount, enqueue, triggerSync }}>
            {children}
        </SyncContext.Provider>
    );
}

export const useSync = () => {
    const context = useContext(SyncContext);
    if (!context) throw new Error("useSync must be used within SyncProvider");
    return context;
};
