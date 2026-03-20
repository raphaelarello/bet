import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { traduzirTextoMercado } from '@/lib/utils';
import { useBetslip } from '@/contexts/BetslipContext';
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Copy,
  Shield,
  Send,
  ReceiptText,
  Lock,
  AlertTriangle,
} from 'lucide-react';

const BOOKMAKERS = [
  {
    id: 'seubet',
    name: 'SeuBet',
    url: 'https://www.seu.bet.br/',
    accent: 'from-emerald-500/20 to-emerald-700/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    note: 'Fluxo manual recomendado: copie o cupom e finalize no site oficial.',
  },
  {
    id: 'bet365',
    name: 'bet365',
    url: 'https://www.bet365.bet.br/',
    accent: 'from-yellow-500/20 to-green-700/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-200',
    note: 'Use o sistema para decidir e a casa oficial para autenticação e confirmação final.',
  },
] as const;

export default function ExecutionCenter() {
  const [, setLocation] = useLocation();
  const { items, stake, totalOdds, potentialReturn } = useBetslip();

  const slipText = useMemo(() => {
    if (items.length === 0) return 'Nenhuma seleção adicionada ao bilhete.';
    const lines = items.map((item, index) => (
      `${index + 1}. ${item.matchLabel} — ${traduzirTextoMercado(item.tipLabel)} cotação ${item.odds.toFixed(2)} | Prob. ${item.probability}%`
    ));
    lines.push('');
    lines.push(`Entrada sugerida: R$ ${stake.toFixed(2)}`);
    lines.push(`Cotações acumuladas: ${totalOdds.toFixed(2)}x`);
    lines.push(`Retorno potencial: R$ ${potentialReturn.toFixed(2)}`);
    return lines.join('\n');
  }, [items, stake, totalOdds, potentialReturn]);

  const copySlip = async () => {
    try {
      await navigator.clipboard.writeText(slipText);
      toast.success('Cupom copiado!', {
        description: 'Cole no site oficial da casa para conferir e finalizar manualmente.',
      });
    } catch {
      toast.error('Não foi possível copiar o cupom.');
    }
  };

  const copyTopSelection = async () => {
    if (items.length === 0) {
      toast.error('Adicione uma seleção ao bilhete primeiro.');
      return;
    }

    const first = items[0];
    const text = `${first.matchLabel} — ${traduzirTextoMercado(first.tipLabel)} cotação ${first.odds.toFixed(2)} | Prob. ${first.probability}%`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Seleção principal copiada!');
    } catch {
      toast.error('Não foi possível copiar a seleção principal.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-slate-700/50 bg-slate-900/40 text-slate-300 hover:bg-slate-800/70"
              onClick={() => setLocation('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao sistema
            </Button>
            <div>
              <h1 className="text-2xl font-black text-white">Central de execução manual</h1>
              <p className="text-sm text-slate-500">Use as análises e o bilhete do sistema para decidir. A autenticação e a confirmação final ficam no site oficial da casa.</p>
            </div>
          </div>
          <Button variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20" onClick={() => setLocation('/automacao')}>
            <Send className="w-4 h-4 mr-2" />
            Ir para automação
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1.3fr_0.9fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Fluxo prático</h2>
                  <div className="mt-3 space-y-2 text-sm text-slate-400">
                    <p><span className="text-slate-200 font-semibold">1.</span> Monte o bilhete com as seleções aprovadas pela análise.</p>
                    <p><span className="text-slate-200 font-semibold">2.</span> Copie o cupom resumido ou a seleção principal.</p>
                    <p><span className="text-slate-200 font-semibold">3.</span> Abra a casa oficial desejada e faça login diretamente lá.</p>
                    <p><span className="text-slate-200 font-semibold">4.</span> Reproduza a aposta manualmente e confirme no ambiente oficial.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {BOOKMAKERS.map((bookmaker) => (
                <div key={bookmaker.id} className={`rounded-2xl border ${bookmaker.border} bg-gradient-to-br ${bookmaker.accent} p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${bookmaker.text}`}>Casa suportada no fluxo manual</p>
                      <h3 className="text-xl font-black text-white mt-1">{bookmaker.name}</h3>
                      <p className="text-sm text-slate-400 mt-2">{bookmaker.note}</p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-black/20 border border-white/10 flex items-center justify-center">
                      <Shield className={`w-5 h-5 ${bookmaker.text}`} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={bookmaker.url} target="_blank" rel="noopener noreferrer">
                      <Button className="bg-white/10 hover:bg-white/15 text-white border border-white/10">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir {bookmaker.name}
                      </Button>
                    </a>
                    <Button variant="outline" className="border-slate-600/60 bg-slate-950/20 text-slate-200 hover:bg-slate-800/60" onClick={copySlip}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar cupom
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Limite desta tela</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Esta central foi desenhada para <span className="text-slate-200 font-semibold">execução manual assistida</span>: copiar o cupom, abrir a casa correta e finalizar no site oficial.
                    Não há captura de usuário/senha nem confirmação automática de aposta dentro do sistema.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <ReceiptText className="w-4 h-4 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">Cupom pronto para copiar</h2>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-slate-700/40 bg-slate-950/30 p-4 text-sm text-slate-500">
                  Nenhuma seleção no bilhete ainda. Volte ao painel principal, escolha os destaques da rodada e adicione ao cupom.
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="rounded-xl border border-slate-700/40 bg-slate-950/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{index + 1}. {item.matchLabel}</p>
                            <p className="text-xs text-slate-400 mt-1">{traduzirTextoMercado(item.tipLabel)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-300">cotação {item.odds.toFixed(2)}</p>
                            <p className="text-xs text-slate-500">Prob. {item.probability}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="rounded-xl border border-slate-700/40 bg-slate-950/30 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Entrada</p>
                      <p className="text-sm font-black text-white">R$ {stake.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/40 bg-slate-950/30 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Cotações</p>
                      <p className="text-sm font-black text-white">{totalOdds.toFixed(2)}x</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/40 bg-slate-950/30 px-3 py-2">
                      <p className="text-[11px] text-slate-500">Retorno</p>
                      <p className="text-sm font-black text-emerald-300">R$ {potentialReturn.toFixed(2)}</p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={copySlip}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar cupom
                </Button>
                <Button variant="outline" className="border-slate-600/60 bg-slate-950/20 text-slate-200 hover:bg-slate-800/60" onClick={copyTopSelection}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Copiar seleção principal
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-blue-300" />
                <h2 className="text-lg font-bold text-white">Autenticação segura</h2>
              </div>
              <p className="text-sm text-slate-400">
                Faça login apenas dentro do site oficial da casa. Assim você mantém a autenticação, o saldo e a confirmação final no ambiente da operadora.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
