// Rapha Guru — API Key Configuration Component
// Design: "Estádio Noturno" — Premium Sports Dark
// Allows users to configure their football-data.org API key for enriched data

import React, { useState } from 'react';
import { getFDOApiKey, setFDOApiKey, removeFDOApiKey } from '@/lib/footballDataOrg';
import { cn } from '@/lib/utils';
import { Key, Check, X, ExternalLink, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function ApiKeyConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(getFDOApiKey() || '');
  const [saved, setSalvard] = useState(!!getFDOApiKey());

  const handleSalvar = () => {
    if (!apiKey.trim()) {
      toast.error('Digite uma chave de API válida');
      return;
    }
    setFDOApiKey(apiKey.trim());
    setSalvard(true);
    toast.success('Chave da API salva! As análises agora usarão dados enriquecidos.', {
      description: 'Reanalise qualquer partida para ver os dados atualizados.',
    });
  };

  const handleRemove = () => {
    removeFDOApiKey();
    setApiKey('');
    setSalvard(false);
    toast.info('Chave da API removida. Usando apenas dados do TheSportsDB.');
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-6 h-6 rounded-lg flex items-center justify-center',
            saved ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-slate-700/50'
          )}>
            <Key className={cn('w-3 h-3', saved ? 'text-emerald-400' : 'text-slate-500')} />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-300">football-data.org API</p>
            <p className="text-xs text-slate-600">
              {saved ? 'Dados enriquecidos ativos' : 'Opcional — melhora xG e posse de bola'}
            </p>
          </div>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              <Check className="w-3 h-3" />
              Ativo
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  A <strong className="text-blue-400">football-data.org</strong> oferece dados gratuitos das 10 principais ligas europeias (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, etc.).
                </p>
                <p>
                  Com a chave, o sistema usa dados reais de posse de bola e chutes para calcular um xG mais preciso.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Cole sua chave aqui..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="flex-1 h-9 bg-slate-900/60 border-slate-700/50 text-slate-200 placeholder:text-slate-600 text-sm focus:border-blue-500/50"
            />
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-3"
              onClick={handleSalvar}
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            {saved && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-9 px-3"
                onClick={handleRemove}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <a
            href="https://www.football-data.org/client/register"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Obter chave gratuita em football-data.org
          </a>
        </div>
      )}
    </div>
  );
}
