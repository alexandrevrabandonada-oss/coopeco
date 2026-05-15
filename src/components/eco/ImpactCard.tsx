import { Star, ShieldCheck, TrendingUp, Leaf, QrCode } from "lucide-react"

export function ImpactCard({ 
  name, 
  kg, 
  value, 
  cellName 
}: { 
  name: string, 
  kg: number, 
  value: number, 
  cellName: string 
}) {
  return (
    <div className="border-[8px] border-black p-8 bg-white max-w-md mx-auto shadow-[12px_12px_0px_black] relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-black text-white px-4 py-1 text-[10px] font-black uppercase transform rotate-45 translate-x-12 translate-y-4">
        ECO CERTIFIED
      </div>

      <div className="flex items-center gap-2 mb-8">
        <Leaf className="text-green-600 fill-green-600" />
        <h2 className="stencil-text text-2xl leading-none">IMPACTO POSITIVO</h2>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Local de Origem</p>
          <p className="text-2xl font-black uppercase leading-tight">{name}</p>
          <p className="text-xs font-bold text-primary-dark">{cellName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border-4 border-black p-4 bg-yellow-400">
            <p className="text-[10px] font-black uppercase mb-1">Peso Recuperado</p>
            <p className="text-3xl font-black leading-none">{kg.toFixed(1)} <span className="text-sm">KG</span></p>
          </div>
          <div className="border-4 border-black p-4 bg-black text-white">
            <p className="text-[10px] font-black uppercase mb-1 text-primary">Valor Gerado</p>
            <p className="text-3xl font-black leading-none"><span className="text-sm">R$</span> {value.toFixed(0)}</p>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-black border-dashed flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={20} />
            <span className="text-[10px] font-black uppercase">Rastreabilidade Garantida</span>
          </div>
          <QrCode size={24} className="opacity-20" />
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[9px] font-black uppercase opacity-40 leading-tight">
          Cada grama desviada do aterro é uma vitória coletiva.<br />
          Sistema ECO - Gestão Circular e Rateio Justo.
        </p>
      </div>
    </div>
  )
}
