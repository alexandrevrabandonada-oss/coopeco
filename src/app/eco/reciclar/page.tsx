"use client"

import { useState } from "react"
import { MapPin, Box, Truck, CheckCircle, Info } from "lucide-react"

export default function EcoReciclarPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const payload = {
      neighborhood: formData.get("neighborhood"),
      participant_type: formData.get("participant_type"),
      material_types: formData.getAll("material_types"),
      volume_level: formData.get("volume_level"),
      frequency: formData.get("frequency"),
      preference: formData.get("preference"),
      main_problem: formData.get("main_problem"),
      can_be_pev: formData.get("can_be_pev") === "on",
      can_volunteer: formData.get("can_volunteer") === "on",
      contact_name: formData.get("contact_name"),
      contact_phone: formData.get("contact_phone"),
      consent_contact: formData.get("consent_contact") === "on"
    }

    try {
      const res = await fetch("/api/eco/recycling-demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar formulário.")
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8 space-y-8">
        <div className="text-green-600">
          <CheckCircle size={64} />
        </div>
        <div className="text-center space-y-4 max-w-md">
          <h1 className="stencil-text text-4xl">CADASTRO RECEBIDO</h1>
          <p className="font-bold text-gray-700">
            Você ajudou a cidade a enxergar onde a reciclagem precisa chegar.
          </p>
          <p className="text-sm text-gray-500">
            Lembre-se: este cadastro não garante coleta imediata, mas nos orienta na criação de rotas comunitárias e instalação de PEVs.
          </p>
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <a href="/eco/mapa-demanda" className="bg-black text-white text-center py-3 font-black uppercase text-sm w-full hover:bg-gray-800 transition-colors">
            Ver Mapa da Demanda
          </a>
          <button onClick={() => window.location.reload()} className="bg-transparent border-4 border-black text-black text-center py-3 font-black uppercase text-sm w-full hover:bg-gray-200 transition-colors">
            Enviar outro local
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Header ECO */}
        <div className="text-center space-y-2">
           <h1 className="stencil-text text-4xl text-green-800">MAPA DA DEMANDA ECO</h1>
           <p className="text-xs font-black uppercase tracking-widest text-gray-500">Escutar • Cuidar • Organizar</p>
        </div>

        {/* Warning */}
        <div className="bg-yellow-400 border-4 border-black p-4 flex gap-4 items-start">
           <Info className="shrink-0 mt-1" />
           <p className="text-sm font-bold uppercase">
             Este cadastro não garante coleta imediata. Ele ajuda a planejar PEVs, rotas comunitárias e fortalecer as cooperativas locais. Depois do cadastro, a equipe pode entrar em contato se houver rota, PEV ou orientação disponível no seu bairro.
           </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border-4 border-black p-6 space-y-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="space-y-2">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2">1. Onde você está?</h2>
            <label className="block text-sm font-bold mt-4">Bairro (Volta Redonda) *</label>
            <input name="neighborhood" required className="w-full border-2 border-black p-3 font-mono text-sm" placeholder="Ex: Retiro, Vila Santa Cecília..." />
            
            <label className="block text-sm font-bold mt-4">Tipo de local *</label>
            <select name="participant_type" required className="w-full border-2 border-black p-3 font-mono text-sm bg-white">
              <option value="">Selecione...</option>
              <option value="resident">Casa / Morador</option>
              <option value="condominium">Condomínio</option>
              <option value="commerce">Comércio / Empresa</option>
              <option value="school">Escola</option>
              <option value="association">Associação / Igreja</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div className="space-y-2">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2">2. O que tem aí?</h2>
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">Marque todos os materiais recicláveis secos que aparecem:</p>
            <div className="grid grid-cols-2 gap-2 text-sm font-bold">
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="cardboard" className="w-4 h-4 border-2 border-black" /> Papelão</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="paper" className="w-4 h-4 border-2 border-black" /> Papel / Cadernos</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="plastic" className="w-4 h-4 border-2 border-black" /> Plástico (Garrafas/Potes)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="metal" className="w-4 h-4 border-2 border-black" /> Metal (Latinhas/Panela)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="glass" className="w-4 h-4 border-2 border-black" /> Vidro</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="cooking_oil" className="w-4 h-4 border-2 border-black" /> Óleo de Cozinha</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="electronics" className="w-4 h-4 border-2 border-black" /> Eletrônicos</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="material_types" value="mixed_dry" className="w-4 h-4 border-2 border-black" /> Secos Misturados</label>
            </div>

            <label className="block text-sm font-bold mt-6">Volume médio *</label>
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">Não precisa saber o peso. Pode estimar por volume:</p>
            <select name="volume_level" required className="w-full border-2 border-black p-3 font-mono text-sm bg-white">
              <option value="">Selecione...</option>
              <option value="small_bag">Sacolinha pequena</option>
              <option value="big_bag">Saco grande (100L)</option>
              <option value="box">Uma caixa de papelão cheia</option>
              <option value="many_boxes">Muitas caixas/sacos</option>
              <option value="commercial_volume">Volume comercial (muito grande)</option>
            </select>

            <label className="block text-sm font-bold mt-4">Com que frequência esse material aparece? *</label>
            <select name="frequency" required className="w-full border-2 border-black p-3 font-mono text-sm bg-white">
              <option value="">Selecione...</option>
              <option value="weekly">Toda semana</option>
              <option value="biweekly">A cada 15 dias</option>
              <option value="monthly">Uma vez por mês</option>
              <option value="once">Apenas dessa vez (limpeza pontual)</option>
            </select>
          </div>

          <div className="space-y-2">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2">3. O que você prefere?</h2>
            <div className="space-y-3 mt-4">
              <label className="flex items-start gap-3 p-3 border-2 border-black hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="preference" value="dropoff_pev" required className="mt-1 w-5 h-5 border-2 border-black" />
                <div>
                  <p className="font-bold uppercase text-sm">Entregar num PEV</p>
                  <p className="text-xs text-gray-500">Eu levo até um ponto fixo no meu bairro.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border-2 border-black hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="preference" value="pickup_request" required className="mt-1 w-5 h-5 border-2 border-black" />
                <div>
                  <p className="font-bold uppercase text-sm">Pedir Coleta</p>
                  <p className="text-xs text-gray-500">Preciso que alguém passe para retirar (ideal para muito volume ou condomínios).</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border-2 border-black hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="preference" value="both" required className="mt-1 w-5 h-5 border-2 border-black" />
                <div>
                  <p className="font-bold uppercase text-sm">Qualquer um</p>
                  <p className="text-xs text-gray-500">Tanto faz, o importante é reciclar.</p>
                </div>
              </label>
            </div>

            <label className="block text-sm font-bold mt-4">Qual é o seu maior problema com a reciclagem hoje? (Opcional)</label>
            <select name="main_problem" className="w-full border-2 border-black p-3 font-mono text-sm bg-white">
              <option value="">Nenhum específico</option>
              <option value="nao_sei_separar">Não sei como separar direito</option>
              <option value="coleta_nao_passa">A coleta não passa na minha rua</option>
              <option value="sem_espaco">Não tenho espaço para guardar em casa</option>
              <option value="moro_predio">Moro em prédio e o condomínio não ajuda</option>
              <option value="sem_transporte">Não tenho como levar o material</option>
              <option value="outro">Outro motivo</option>
            </select>
          </div>

          <div className="space-y-4">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2">4. Quer somar forças? (Opcional)</h2>
            <label className="flex items-start gap-3 p-3 bg-green-50 border-2 border-green-800 cursor-pointer">
              <input type="checkbox" name="can_be_pev" className="mt-1 w-5 h-5 border-2 border-black" />
              <div>
                <p className="font-bold uppercase text-sm text-green-900">Meu local pode ser um Ponto de Entrega (PEV)</p>
                <p className="text-xs text-green-800">Tenho espaço (ex: condomínio, comércio) e topo receber materiais de terceiros se a rede organizar a coleta.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 bg-yellow-50 border-2 border-yellow-800 cursor-pointer">
              <input type="checkbox" name="can_volunteer" className="mt-1 w-5 h-5 border-2 border-black" />
              <div>
                <p className="font-bold uppercase text-sm text-yellow-900">Quero ajudar como voluntário(a)</p>
                <p className="text-xs text-yellow-800">Posso ajudar a organizar o bairro, conversar com vizinhos ou ser um Anjo de um PEV.</p>
              </div>
            </label>
          </div>

          <div className="space-y-4">
            <h2 className="font-black uppercase text-xl border-b-2 border-black pb-2">Contato Seguros (Opcional)</h2>
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">
              Não se preocupe: nome, e-mail e telefone nunca aparecerão no mapa público. 
              Serão usados apenas pela coordenação caso precisem falar com você.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="contact_name" className="w-full border-2 border-black p-3 font-mono text-sm" placeholder="Seu nome" />
              <input name="contact_phone" className="w-full border-2 border-black p-3 font-mono text-sm" placeholder="Telefone / WhatsApp" />
            </div>
            
            <label className="flex items-start gap-3 mt-4">
              <input type="checkbox" name="consent_contact" className="mt-1 w-5 h-5 border-2 border-black" />
              <span className="text-xs font-bold text-gray-600">Autorizo que a equipe ECO entre em contato comigo usando estes dados para organizar a coleta ou tirar dúvidas.</span>
            </label>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 border-2 border-red-500 p-3 text-sm font-bold">
              Erro: {error}
            </div>
          )}

          <button disabled={loading} type="submit" className="w-full bg-black text-white font-black uppercase text-lg py-4 border-4 border-black hover:bg-transparent hover:text-black transition-colors disabled:opacity-50">
            {loading ? "Enviando..." : "Cadastrar Minha Demanda"}
          </button>
        </form>
      </div>
    </div>
  )
}
