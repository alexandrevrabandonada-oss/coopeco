import { PevLot } from "@/lib/eco/pev"
import { DollarSign, Wallet, Percent, ArrowDownToLine } from "lucide-react"

export function LotFinanceCard({ lot }: { lot: PevLot }) {
  const gross = lot.gross_value || 0
  const costs = lot.total_direct_costs || 0
  const fundValue = lot.eco_fund_value || 0
  const distributable = lot.distributable_value || 0
  const net = gross - costs

  return (
    <div className="card border-4 bg-white">
      <h3 className="stencil-text text-xl mb-6 flex items-center gap-2">
        <DollarSign className="text-primary" /> RESUMO FINANCEIRO
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-end border-b-2 border-black pb-2">
          <span className="text-xs font-black uppercase text-gray-500">Valor Bruto da Venda</span>
          <span className="text-2xl font-black">R$ {gross.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center text-red-600">
          <div className="flex items-center gap-2">
            <ArrowDownToLine size={16} />
            <span className="text-xs font-black uppercase">Custos Diretos (-)</span>
          </div>
          <span className="font-bold">- R$ {costs.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center font-bold bg-gray-50 p-2 border border-black">
          <span className="text-[10px] font-black uppercase">Saldo Após Custos</span>
          <span>R$ {net.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center text-primary-dark">
          <div className="flex items-center gap-2">
            <Percent size={16} />
            <span className="text-xs font-black uppercase">Fundo ECO ({lot.eco_fund_percent}%)</span>
          </div>
          <span className="font-bold">- R$ {fundValue.toFixed(2)}</span>
        </div>

        <div className="pt-2 border-t-4 border-black">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Wallet className="text-green-600" />
              <span className="text-sm font-black uppercase">VALOR DISTRIBUÍVEL</span>
            </div>
            <span className="text-3xl font-black text-green-600">R$ {distributable.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
