// Rapha Guru — Notification Settings Component v1.0
// Design: "Estádio Noturno" — Premium Sports Dark
// Gerencia permissões e configurações de notificações push do navegador

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Bell, BellOff, BellRing, CheckCircle2, XCircle, Info,
  Zap, TrendingUp, Trophy, Clock, Siren
} from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

interface NotificationCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  enabled: boolean;
}

// ============================================================
// COMPONENTE
// ============================================================

interface NotificationSettingsProps {
  onClose?: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { isSupported, permission, isGranted, requestPermission, sendNotification } =
    usePushNotifications();

  const [categories, setCategories] = useState<NotificationCategory[]>([
    {
      id: 'goals',
      label: 'Gols ao Vivo',
      description: 'Alertas instantâneos quando um gol é marcado em jogos favoritados',
      icon: Trophy,
      color: 'text-yellow-400',
      enabled: true,
    },
    {
      id: 'suggestions',
      label: 'Sugestões de Alta Confiança',
      description: 'Notificação quando uma sugestão atinge nível de confiança Alta (≥75%)',
      icon: Zap,
      color: 'text-amber-400',
      enabled: true,
    },
    {
      id: 'odds',
      label: 'Movimento de cotações',
      description: 'Alerta quando odds mudam ≥5% em jogos favoritados',
      icon: TrendingUp,
      color: 'text-cyan-400',
      enabled: false,
    },
    {
      id: 'favorite-swing',
      label: 'Inversão de Favorito',
      description: 'Alerta quando o lado azarão vira a projeção ao vivo do jogo favoritado',
      icon: Siren,
      color: 'text-orange-400',
      enabled: true,
    },
    {
      id: 'kickoff',
      label: 'Início de Partida',
      description: 'Lembrete 5 minutos antes do apito inicial de jogos favoritados',
      icon: Clock,
      color: 'text-blue-400',
      enabled: true,
    },
  ]);

  const toggleCategory = (id: string) => {
    setCategories(prev =>
      prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const handleTestNotification = () => {
    sendNotification({
      title: '🏆 Rapha Guru — Teste',
      body: 'Notificações push estão funcionando corretamente!',
      tag: 'test',
    });
  };

  const permissionConfig = {
    default: {
      icon: Bell,
      color: 'text-slate-400',
      bg: 'bg-slate-700/30 border-slate-600/30',
      label: 'Não configurado',
      description: 'Clique em "Ativar Notificações" para receber alertas mesmo com a aba minimizada.',
    },
    granted: {
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      label: 'Ativas',
      description: 'Você receberá alertas do Rapha Guru mesmo com a aba minimizada.',
    },
    denied: {
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/30',
      label: 'Bloqueadas',
      description: 'Para ativar, clique no ícone de cadeado na barra de endereço do navegador.',
    },
  };

  const config = permissionConfig[permission];
  const PermIcon = config.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
            Notificações Push
          </h4>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status */}
      {!isSupported ? (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Não suportado</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Seu navegador não suporta a Web Notifications API. Tente Chrome, Firefox ou Edge.
            </p>
          </div>
        </div>
      ) : (
        <div className={cn('flex items-start gap-3 rounded-xl border p-3', config.bg)}>
          <PermIcon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', config.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold', config.color)}>
                Notificações {config.label}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
          </div>
        </div>
      )}

      {/* Botão de ativar */}
      {isSupported && permission !== 'granted' && permission !== 'denied' && (
        <button
          onClick={requestPermission}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
        >
          <Bell className="w-4 h-4" />
          Ativar Notificações Push
        </button>
      )}

      {/* Botão de teste */}
      {isGranted && (
        <button
          onClick={handleTestNotification}
          className="w-full flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 rounded-xl border border-slate-600/30 transition-all"
        >
          <BellRing className="w-3.5 h-3.5" />
          Enviar notificação de teste
        </button>
      )}

      {/* Categorias */}
      {isGranted && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">
              Tipos de alerta
            </span>
          </div>
          <div className="space-y-1.5">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all cursor-pointer',
                    cat.enabled
                      ? 'bg-slate-800/50 border-slate-700/40'
                      : 'bg-slate-800/20 border-slate-700/20 opacity-60'
                  )}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', cat.enabled ? cat.color : 'text-slate-600')} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold', cat.enabled ? 'text-slate-200' : 'text-slate-500')}>
                      {cat.label}
                    </p>
                    <p className="text-xs text-slate-600 truncate">{cat.description}</p>
                  </div>
                  {/* Toggle */}
                  <div className={cn(
                    'w-8 h-4 rounded-full transition-all flex-shrink-0 relative',
                    cat.enabled ? 'bg-blue-600' : 'bg-slate-700'
                  )}>
                    <div className={cn(
                      'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                      cat.enabled ? 'left-4' : 'left-0.5'
                    )} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nota sobre jogos favoritados */}
      {isGranted && (
        <div className="flex items-start gap-2 bg-slate-800/30 border border-slate-700/20 rounded-lg px-3 py-2">
          <Info className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600">
            Alertas são enviados apenas para jogos favoritados com alertas ativados.
            Favorite um jogo e ative o sino para receber notificações.
          </p>
        </div>
      )}

      {/* Instrução para denied */}
      {permission === 'denied' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium">Como reativar:</p>
          <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
            <li>Clique no ícone de cadeado 🔒 na barra de endereço</li>
            <li>Encontre "Notificações" e mude para "Permitir"</li>
            <li>Recarregue a página</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HOOK INTEGRADO PARA USAR EM OUTROS COMPONENTES
// ============================================================

export { usePushNotifications };
