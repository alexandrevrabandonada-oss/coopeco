import { PevPayout } from "@/lib/eco/pev"
import { User, Clock, Star, Coins } from "lucide-react"

export function PayoutTable({ payouts }: { payouts: PevPayout[] }) {
  if (payouts.length === 0) {
    return (
      <div className="card border-dashed border-2 text-center py-8 text-gray-500 font-bold uppercase text-xs">
        Nenhum rateio calculado ainda.
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto p-0 border-4">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black text-white text-[10px] font-black uppercase">
            <th className="p-3 border-r border-gray-700">Trabalhador</th>
            <th className="p-3 border-r border-gray-700 text-center">Pontos</th>
            <th className="p-3 border-r border-gray-700 text-right">Pagamento</th>
            <th className="p-3 border-r border-gray-700 text-right">Reembolso</th>
            <th className="p-3 text-right bg-primary text-black">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black">
          {payouts.map((p) => (
            <tr key={p.id} className="hover:bg-yellow-50 transition-colors">
              <td className="p-3 border-r border-black">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="font-black text-sm uppercase">{p.worker_label}</span>
                </div>
              </td>
              <td className="p-3 border-r border-black text-center font-bold text-sm">
                <div className="flex items-center justify-center gap-1">
                  <Star size={12} className="text-primary fill-primary" />
                  {p.points.toFixed(0)}
                </div>
              </td>
              <td className="p-3 border-r border-black text-right font-bold text-sm">
                R$ {p.work_payment.toFixed(2)}
              </td>
              <td className="p-3 border-r border-black text-right font-bold text-sm text-blue-600">
                R$ {p.reimbursement.toFixed(2)}
              </td>
              <td className="p-3 text-right font-black text-lg bg-yellow-50">
                R$ {p.total_payment.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="p-4 bg-gray-50 border-t-2 border-black">
        <div className="flex flex-wrap gap-6 justify-between items-center">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-primary-dark" />
            <span className="text-[10px] font-black uppercase">Total a Pagar:</span>
            <span className="font-black">
              R$ {payouts.reduce((sum, p) => sum + p.total_payment, 0).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] font-bold text-gray-500 uppercase italic">
            * Cálculo baseado em pontos acumulados por horas e tipo de tarefa.
          </div>
        </div>
      </div>
    </div>
  )
}
