// Posición inicial (Figma, px sobre 412 de ancho) de cada polaroid y sticker.
// x, y: esquina superior izquierda del cuadro (ya rotado) dentro del frame Home.
// z: orden de capas de Figma (mayor = encima).
import type { ImageMetadata } from 'astro';

import g1_1 from '../assets/fotos/g1-1.png';
import g1_2 from '../assets/fotos/g1-2.png';
import g2_1 from '../assets/fotos/g2-1.png';
import g2_2 from '../assets/fotos/g2-2.png';
import g2_3 from '../assets/fotos/g2-3.png';
import g2_4 from '../assets/fotos/g2-4.png';
import g2_5 from '../assets/fotos/g2-5.png';

import lirio from '../assets/stickers/lirio.png';
import corazones from '../assets/stickers/corazones.png';
import tulipan from '../assets/stickers/tulipan.png';
import pastel from '../assets/stickers/pastel.png';
import cerezas from '../assets/stickers/cerezas.png';
import sobre from '../assets/stickers/sobre.png';
import taza from '../assets/stickers/taza.png';

export interface Polaroid {
  tipo: 'polaroid';
  foto: ImageMetadata;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  /** a = sombra hacia abajo (−5°), b = sombra hacia arriba-izquierda (+5°) */
  sombra: 'a' | 'b';
  z: number;
}

export interface Sticker {
  tipo: 'sticker';
  imagen: ImageMetadata;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sombra: boolean;
  z: number;
}

export type Elemento = Polaroid | Sticker;

const P = { w: 276.622, h: 351.973 };

export const galeria1 = {
  top: 300,
  alto: 580,
  elementos: [
    { tipo: 'polaroid', foto: g1_1, x: 30.63, y: 310, ...P, rot: -5, sombra: 'a', z: 31 },
    { tipo: 'polaroid', foto: g1_2, x: 101.55, y: 524.64, ...P, rot: 5, sombra: 'b', z: 32 },
    { tipo: 'sticker', imagen: tulipan, nombre: 'tulipán', x: 307.22, y: 755, w: 85.557, h: 113.773, sombra: false, z: 33 },
    { tipo: 'sticker', imagen: lirio, nombre: 'lirio', x: 254.95, y: 446.51, w: 140.049, h: 140.049, sombra: true, z: 34 },
    { tipo: 'sticker', imagen: corazones, nombre: 'corazones', x: 14.21, y: 532.28, w: 160.239, h: 160.239, sombra: true, z: 35 },
  ] satisfies Elemento[],
};

export const galeria2 = {
  top: 3165,
  alto: 1235,
  elementos: [
    { tipo: 'polaroid', foto: g2_1, x: 32.02, y: 3175.18, ...P, rot: -5, sombra: 'a', z: 3 },
    { tipo: 'polaroid', foto: g2_2, x: 102.94, y: 3390.18, ...P, rot: 5, sombra: 'b', z: 4 },
    { tipo: 'sticker', imagen: lirio, nombre: 'lirio', x: 256.35, y: 3312.18, w: 140.049, h: 140.049, sombra: true, z: 5 },
    { tipo: 'sticker', imagen: corazones, nombre: 'corazones', x: 15.6, y: 3397.18, w: 160.239, h: 160.239, sombra: true, z: 6 },
    { tipo: 'polaroid', foto: g2_3, x: 37.53, y: 3596.18, ...P, rot: -5, sombra: 'a', z: 7 },
    { tipo: 'polaroid', foto: g2_4, x: 102.94, y: 3799.18, ...P, rot: 5, sombra: 'b', z: 8 },
    { tipo: 'polaroid', foto: g2_5, x: 44.65, y: 4027.18, w: 262.374, h: 341.711, rot: -2.41, sombra: 'a', z: 9 },
    { tipo: 'sticker', imagen: taza, nombre: 'taza', x: 29.43, y: 4298.18, w: 95.834, h: 96.561, sombra: false, z: 10 },
    { tipo: 'sticker', imagen: pastel, nombre: 'pastel', x: 254, y: 3629.18, w: 121.846, h: 116.685, sombra: false, z: 11 },
    { tipo: 'sticker', imagen: cerezas, nombre: 'cerezas', x: 32.09, y: 3854.18, w: 121.846, h: 116.685, sombra: false, z: 12 },
    { tipo: 'sticker', imagen: sobre, nombre: 'sobre', x: 268, y: 4063.18, w: 121.846, h: 98.596, sombra: false, z: 13 },
  ] satisfies Elemento[],
};
