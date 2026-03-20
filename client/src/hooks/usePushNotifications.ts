// Rapha Guru — Push Notifications Hook v1.0
// Gerencia notificações push via Web Notifications API
// Funciona mesmo com a aba minimizada (enquanto o browser estiver aberto)

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================
// TIPOS
// ============================================================

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;           // Agrupa notificações com mesmo tag (substitui a anterior)
  requireInteraction?: boolean;  // Mantém a notificação até o usuário interagir
  data?: Record<string, unknown>;
}

// ============================================================
// ÍCONE PADRÃO (emoji como data URL)
// ============================================================

const RAPHA_GURU_ICON = 'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/26bd.png'; // ⚽

// ============================================================
// HOOK
// ============================================================

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission as NotificationPermission;
  });

  const isSupported = typeof Notification !== 'undefined';

  // Atualiza o estado quando a permissão muda externamente
  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission as NotificationPermission);
  }, [isSupported]);

  // Solicita permissão ao usuário
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Seu navegador não suporta notificações push.');
      return false;
    }

    if (permission === 'granted') return true;
    if (permission === 'denied') {
      toast.error('Notificações bloqueadas', {
        description: 'Habilite as notificações nas configurações do navegador para este site.',
        duration: 6000,
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      if (result === 'granted') {
        toast.success('🔔 Notificações ativadas!', {
          description: 'Você receberá alertas do Rapha Guru mesmo com a aba minimizada.',
          duration: 5000,
        });
        // Envia notificação de boas-vindas
        sendNotification({
          title: '🏆 Rapha Guru',
          body: 'Notificações ativadas! Você será alertado sobre gols, sugestões e mudanças de odds.',
          tag: 'welcome',
        });
        return true;
      } else {
        toast.info('Notificações não ativadas', {
          description: 'Você pode ativar depois nas configurações.',
          duration: 4000,
        });
        return false;
      }
    } catch {
      return false;
    }
  }, [permission, isSupported]);

  // Envia uma notificação push
  const sendNotification = useCallback((options: PushNotificationOptions): Notification | null => {
    if (!isSupported || Notification.permission !== 'granted') return null;

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon ?? RAPHA_GURU_ICON,
        badge: options.badge ?? RAPHA_GURU_ICON,
        tag: options.tag,
        requireInteraction: options.requireInteraction ?? false,
        data: options.data,
      });

      // Auto-fecha após 8s se não requerer interação
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 8000);
      }

      return notification;
    } catch {
      return null;
    }
  }, [isSupported]);

  // Notificação de gol
  const notifyGoal = useCallback((
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
    scorer?: string,
    minute?: number
  ) => {
    sendNotification({
      title: `⚽ GOL! ${homeTeam} ${homeScore}–${awayScore} ${awayTeam}`,
      body: scorer
        ? `${scorer}${minute ? ` (${minute}')` : ''} marca para ${homeScore > awayScore ? homeTeam : awayTeam}`
        : `Placar atualizado no minuto ${minute ?? '?'}`,
      tag: `goal-${homeTeam}-${awayTeam}`,
      requireInteraction: false,
    });
  }, [sendNotification]);

  // Notificação de sugestão de alta confiança
  const notifyHighConfidenceSuggestion = useCallback((
    homeTeam: string,
    awayTeam: string,
    suggestion: string,
    confidence: number
  ) => {
    sendNotification({
      title: `🎯 Sugestão Alta Confiança — Rapha Guru`,
      body: `${homeTeam} vs ${awayTeam}: ${suggestion} (${confidence}% confiança)`,
      tag: `suggestion-${homeTeam}-${awayTeam}`,
      requireInteraction: false,
    });
  }, [sendNotification]);

  // Notificação de movimento de odds
  const notifyOddsMovement = useCallback((
    homeTeam: string,
    awayTeam: string,
    market: string,
    changePct: number,
    direction: 'up' | 'down'
  ) => {
    const arrow = direction === 'up' ? '📈' : '📉';
    sendNotification({
      title: `${arrow} Movimento de Odds — Rapha Guru`,
      body: `${homeTeam} vs ${awayTeam}: ${market} ${direction === 'up' ? 'subiu' : 'caiu'} ${changePct.toFixed(1)}%`,
      tag: `odds-${homeTeam}-${awayTeam}-${market}`,
    });
  }, [sendNotification]);

  // Notificação de início de jogo favoritado
  const notifyMatchStarting = useCallback((
    homeTeam: string,
    awayTeam: string,
    league: string
  ) => {
    sendNotification({
      title: `🏟️ Jogo começando — Rapha Guru`,
      body: `${homeTeam} vs ${awayTeam} (${league}) está prestes a começar!`,
      tag: `start-${homeTeam}-${awayTeam}`,
      requireInteraction: true,
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    isGranted: permission === 'granted',
    requestPermission,
    sendNotification,
    notifyGoal,
    notifyHighConfidenceSuggestion,
    notifyOddsMovement,
    notifyMatchStarting,
  };
}
