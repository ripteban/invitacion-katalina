"""Traduce el recorte de Figma de una foto a otra versión de la misma imagen (alineación SIFT).

Caso real: la foto 1 (g1-1) en Figma es una edición retocada; la clienta prefiere la versión natural,
cuyo original en alta (1792×2400) es la fuente de g2-5. Se calcula dónde cae el encuadre de Figma
en esa imagen para reproducirlo exacto.

Resultado: scripts/recortes-fotos.json  ->  { "g1-1": {"src": "...", "x":..,"y":..,"lado":..} }
Uso: python scripts/alinear-fotos.py
"""
import json
import cv2
import numpy as np

F = 227.948  # lado de la foto en la polaroid (px de Figma)

# Recortes de Figma (porcentajes de la imagen dentro del cuadro de 227.948)
# None = object-fit: cover centrado
# clave -> (fuente vieja de Figma, imagen destino, recorte de Figma sobre la fuente vieja)
FOTOS = {
    "g1-1": ("figma-export/raw/g1-1.png", "figma-export/raw/g2-5.png", dict(l=-0.1734, t=-0.7663, w=1.3284, h=2.38)),
}


def recorte_viejo(ancho, alto, r):
    """Cuadro (x, y, lado) en px de la fuente vieja."""
    if r is None:
        lado = min(ancho, alto)
        return (ancho - lado) / 2, (alto - lado) / 2, lado
    s = ancho / (F * r["w"])
    return -r["l"] * F * s, -r["t"] * F * s, F * s


sift = cv2.SIFT_create(6000)
resultado = {}
for clave, (fuente, nuevo, r) in FOTOS.items():
    vieja = cv2.imread(fuente, cv2.IMREAD_GRAYSCALE)
    nueva = cv2.imread(nuevo, cv2.IMREAD_GRAYSCALE)
    k1, d1 = sift.detectAndCompute(vieja, None)
    k2, d2 = sift.detectAndCompute(nueva, None)
    pares = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    buenos = [m for m, n in pares if m.distance < 0.7 * n.distance]
    p1 = np.float32([k1[m.queryIdx].pt for m in buenos])
    p2 = np.float32([k2[m.trainIdx].pt for m in buenos])
    # similitud (escala + rotación + traslación)
    M, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=3)
    escala = float(np.hypot(M[0, 0], M[1, 0]))
    giro = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
    x, y, lado = recorte_viejo(vieja.shape[1], vieja.shape[0], r)
    nx, ny = M @ np.array([x, y, 1.0])
    nlado = lado * escala
    H, W = nueva.shape
    dentro = nx >= -1 and ny >= -1 and nx + nlado <= W + 1 and ny + nlado <= H + 1
    resultado[clave] = dict(src=nuevo, x=round(float(nx), 1), y=round(float(ny), 1), lado=round(float(nlado), 1))
    print(
        f"{clave} <- {nuevo}: inliers {int(inl.sum())}/{len(buenos)} escala {escala:.4f} giro {giro:.2f}° "
        f"recorte x={nx:.0f} y={ny:.0f} lado={nlado:.0f}px ({nlado / F:.2f}× diseño) "
        f"{'OK' if dentro else 'SE SALE DE LA FOTO'}"
    )

with open("scripts/recortes-fotos.json", "w", encoding="utf8") as f:
    json.dump(resultado, f, indent=2)
print("scripts/recortes-fotos.json")
