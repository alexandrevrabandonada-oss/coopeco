"use client";

import React from 'react';
import { Wifi, WifiOff, CloudSync, AlertCircle } from 'lucide-react';
import { useSync } from '@/lib/offline/sync-provider';

export function OfflineBanner() {
    const { status, outboxCount } = useSync();

    if (status === 'online' && outboxCount === 0) return null;

    return (
        <div className="animate-slide-up mb-4 sticky top-0 z-50">
            {status === 'offline' && (
                <div className="card bg-accent text-white flex items-center justify-between py-3 border-accent shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 px-1">
                        <WifiOff size={16} />
                        <span className="font-black text-[10px] uppercase">Modo Rua: Sem Sinal — Salvando Offline</span>
                    </div>
                    {outboxCount > 0 && (
                        <span className="bg-white text-accent px-2 py-0.5 rounded font-black text-[10px] mr-1 border border-foreground">
                            {outboxCount} PENDENTE{outboxCount > 1 ? 'S' : ''}
                        </span>
                    )}
                </div>
            )}

            {status === 'syncing' && (
                <div className="card bg-primary text-foreground flex items-center justify-center gap-2 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <CloudSync size={16} className="animate-spin" />
                    <span className="font-black text-[10px] uppercase">Sincronizando ações com a nuvem...</span>
                </div>
            )}

            {status === 'online' && outboxCount > 0 && (
                <div className="card bg-yellow-400 text-foreground flex items-center justify-between py-3 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 px-1">
                        <Wifi size={16} />
                        <span className="font-black text-[10px] uppercase">Sinal Restaurado</span>
                    </div>
                    <span className="font-bold text-[10px] uppercase px-2 py-0.5 bg-white border border-foreground">
                        {outboxCount} ITEM AGUARDANDO SYNC
                    </span>
                </div>
            )}

            {status === 'error' && (
                <div className="card bg-red-600 text-white flex items-center justify-center gap-2 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <AlertCircle size={16} />
                    <span className="font-black text-[10px] uppercase">Erro na Sincronização. Tentando novamente...</span>
                </div>
            )}
        </div>
    );
}
