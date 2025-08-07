'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ProductoSearchResult } from '@/lib/productoService';

export interface ProductWithDate extends ProductoSearchResult {
  date?: Date;
  quantity?: number;
}

interface AgendaPostItProps {
  products: ProductWithDate[];
  topOffsetPx?: number;
}

function formatDateSpanish(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
  const formatted = formatter.format(date);
  // Capitalizar cada palabra
  return formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function AgendaPostIt({ products, topOffsetPx = 0 }: AgendaPostItProps) {
  const [computedTop, setComputedTop] = useState<number>(topOffsetPx);

  useEffect(() => {
    // Intenta ubicar la tarjeta debajo de la calculadora tomando su alto real
    const calc = document.querySelector('.payment-calculator') as HTMLElement | null;
    if (calc) {
      const offset = calc.offsetTop + calc.offsetHeight + 16; // 16px de separación
      setComputedTop(offset);
    } else {
      setComputedTop(topOffsetPx);
    }
  }, [products.length, topOffsetPx]);
  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; items: string[] }>();
    for (const p of products) {
      const d = p.date ? new Date(p.date) : new Date();
      // Normalizar a YYYY-MM-DD como clave
      const key = d.toISOString().split('T')[0];
      const entry = map.get(key) || { date: d, items: [] };
      entry.items.push(p.desayuno_nombre);
      map.set(key, entry);
    }
    // Orden ascendente por fecha
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [products]);

  if (!groups.length) return null;

  return (
    <aside
      className="postit-card"
      style={{ position: 'absolute', right: -225, top: computedTop }}
    >
      {groups.map((group, idx) => (
        <div key={idx} className="postit-section">
          <div className="postit-date">
            {formatDateSpanish(group.date)}
          </div>
          <ul className="postit-list">
            {group.items.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}


