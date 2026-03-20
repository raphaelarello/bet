// Rapha Guru — Favorites Context v1.0
// Gerencia jogos favoritos com persistência em localStorage
// Permite alertas automáticos quando confiança muda em jogos favoritados

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import type { Match } from '@/lib/types';

// ============================================================
// TIPOS
// ============================================================

interface FavoriteMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  dateEvent: string;
  addedAt: number;
  alertsEnabled: boolean;
}

interface FavoritesContextValue {
  favorites: FavoriteMatch[];
  isFavorite: (matchId: string) => boolean;
  addFavorite: (match: Match) => void;
  removeFavorite: (matchId: string) => void;
  toggleFavorite: (match: Match) => void;
  toggleAlerts: (matchId: string) => void;
  hasAlerts: (matchId: string) => boolean;
  favoritesCount: number;
}

// ============================================================
// CONTEXTO
// ============================================================

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const STORAGE_KEY = 'football-tips-favorites';

function loadFromStorage(): FavoriteMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteMatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(favorites: FavoriteMatch[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Ignora erros de storage
  }
}

// ============================================================
// PROVIDER
// ============================================================

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteMatch[]>(loadFromStorage);

  // Persiste sempre que muda
  useEffect(() => {
    saveToStorage(favorites);
  }, [favorites]);

  // Sincroniza com outras abas e garante leitura inicial no cliente
  useEffect(() => {
    setFavorites(loadFromStorage());

    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setFavorites(loadFromStorage());
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isFavorite = useCallback(
    (matchId: string) => favorites.some(f => f.matchId === matchId),
    [favorites]
  );

  const hasAlerts = useCallback(
    (matchId: string) => {
      const fav = favorites.find(f => f.matchId === matchId);
      return fav?.alertsEnabled ?? false;
    },
    [favorites]
  );

  const addFavorite = useCallback((match: Match) => {
    setFavorites(prev => {
      if (prev.some(f => f.matchId === match.idEvent)) return prev;
      const newFav: FavoriteMatch = {
        matchId: match.idEvent,
        homeTeam: match.strHomeTeam,
        awayTeam: match.strAwayTeam,
        league: match.strLeague,
        dateEvent: match.dateEvent,
        addedAt: Date.now(),
        alertsEnabled: true,
      };
      toast.success('⭐ Jogo favoritado!', {
        description: `${match.strHomeTeam} vs ${match.strAwayTeam} — alertas ativados`,
        duration: 4000,
      });
      return [...prev, newFav];
    });
  }, []);

  const removeFavorite = useCallback((matchId: string) => {
    setFavorites(prev => {
      const fav = prev.find(f => f.matchId === matchId);
      if (fav) {
        toast.info('Jogo removido dos favoritos', {
          description: `${fav.homeTeam} vs ${fav.awayTeam}`,
          duration: 3000,
        });
      }
      return prev.filter(f => f.matchId !== matchId);
    });
  }, []);

  const toggleFavorite = useCallback((match: Match) => {
    if (isFavorite(match.idEvent)) {
      removeFavorite(match.idEvent);
    } else {
      addFavorite(match);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  const toggleAlerts = useCallback((matchId: string) => {
    setFavorites(prev => prev.map(f => {
      if (f.matchId !== matchId) return f;
      const newAlerts = !f.alertsEnabled;
      toast.info(newAlerts ? '🔔 Alertas ativados' : '🔕 Alertas desativados', {
        description: `${f.homeTeam} vs ${f.awayTeam}`,
        duration: 3000,
      });
      return { ...f, alertsEnabled: newAlerts };
    }));
  }, []);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      isFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      toggleAlerts,
      hasAlerts,
      favoritesCount: favorites.length,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
