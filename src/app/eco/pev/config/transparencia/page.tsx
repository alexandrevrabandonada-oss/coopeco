"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PevConfigTransparenciaPage() {
  const router = useRouter()
  // Minimal frontend component for config
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black uppercase tracking-tight">Configuração de Transparência</h1>
      <p className="text-gray-600">Apenas PEVs com transparência pública ativada serão listados na rota pública.</p>
      <div className="border-4 border-black p-6 bg-white space-y-4">
        <h3 className="font-black uppercase text-lg border-b-2 border-black pb-2">Status Público</h3>
        <p className="text-sm font-bold text-gray-700">Para alterar o status, um admin deve habilitar no banco de dados ou via ação futura.</p>
        <p className="text-sm">A página pública é acessível via: <code className="bg-gray-100 p-1">/t/pev/[slug]</code></p>
      </div>
      <div className="border-4 border-dashed border-gray-300 p-6 bg-gray-50 text-center">
         <p className="text-sm font-black uppercase text-gray-500">Funcionalidade de Toggle em desenvolvimento para a próxima sprint.</p>
      </div>
    </div>
  )
}
