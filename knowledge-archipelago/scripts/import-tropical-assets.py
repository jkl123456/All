#!/usr/bin/env python3
"""Convert a selected subset of the Tropical Rain Forest pack to GLB.

The source pack is Torque 3D (COLLADA + DDS). This script:
  * picks the highest-detail non-collision LOD per asset;
  * groups primitives by material and bakes node transforms;
  * resolves diffuse textures from materials.cs / DAE image references;
  * decodes DDS via Pillow, downscales, and embeds it in GLB;
  * converts Z-up inches to Y-up metres and puts each model's feet at y=0.

Requires: trimesh, pycollada, Pillow, lxml
Run: python scripts/import-tropical-assets.py [source-root] [output-dir]
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals

NS = {"c": "http://www.collada.org/2005/11/COLLADASchema"}
DEFAULT_SOURCE = Path(r"H:\minimax\1\Tropical_Environment_Pack_v2.0\Tropical_Environment_Pack_v2.0_Ready")
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "public" / "models" / "tropical"
TEXTURE_EXTENSIONS = {".dds", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}
MAX_TEXTURE = 512

# key -> (relative folder under game/art/shapes, DAE filename)
ASSETS = {
    "beach-palm": ("trees/BeachPalm", "BeachPalm01.DAE", 4.8),
    "palm-01": ("trees/Palms", "Palm01.DAE", 7.0),
    "queens-palm": ("trees/QueensPalm", "QueensPalm01.DAE", 3.6),
    "banana": ("trees/Banana", "Banana01.DAE", 3.0),
    "cecropia": ("trees/Cecropia", "CecropiaTree01.DAE", 8.5),
    "fern": ("Plants/TropicFern", "TropicFern01.DAE", 1.1),
    "elephant-ear": ("Plants/ElephantEar", "ElephantEar.DAE", 1.8),
    "beach-grass": ("groundCover/BeachGrass_01", "BeachGrass01.DAE", 0.6),
    "beach-rock": ("rocks/BeachRock01", "BeachRock_01.dae", 1.1),
    "stone": ("rocks/Stones", "Stone01.DAE", 1.25),
    "jetty": ("props/Jetty01", "Tropical_Jetty01.DAE", 4.2),
    "jetty-simple": ("props/Jetty02", "Tropical_Jetty02.DAE", 1.6),
    "hut": ("props/JungleHut02", "JungleHut02.dae", 4.4),
    "crate": ("props/crate_01", "Crate_01.dae", 0.55),
}


def norm(value: str | None) -> str:
    return (value or "").strip().strip('"').replace("\\", "/").lower()


def base_stem(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("\\", "/")
    name = value.rsplit("/", 1)[-1]
    return os.path.splitext(name)[0].lower()


def parse_cs_materials(folder: Path) -> dict[str, dict]:
    """Collect T3D materials by mapTo. Later files can fill missing fields."""
    result: dict[str, dict] = {}
    for cs in folder.glob("*.cs"):
        try:
            text = cs.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        blocks = re.findall(r"singleton\s+Material\(([^)]+)\)\s*\{(.*?)\};", text, re.S)
        for name, body in blocks:
            def value(key: str):
                match = re.search(rf"{key}\s*=\s*\"([^\"]*)\"", body)
                return match.group(1) if match else None

            map_to = value("mapTo")
            if not map_to:
                continue
            entry = {
                "name": name,
                "mapTo": map_to,
                "diffuseMap": value(r"diffuseMap\[0\]") or value("diffuseMap"),
                "normalMap": value(r"normalMap\[0\]") or value("normalMap"),
                "diffuseColor": value(r"diffuseColor\[0\]") or value("diffuseColor"),
                "doubleSided": value("doubleSided") == "1",
                "alphaTest": value("alphaTest") == "1",
            }
            key = norm(map_to)
            merged = result.setdefault(key, {})
            for k, v in entry.items():
                if v not in (None, "", False) or k not in merged:
                    merged[k] = v
    return result


def parse_dae_effects(dae: Path) -> dict[str, str]:
    """Map DAE material id -> diffuse image basename (without extension)."""
    try:
        tree = ET.parse(dae)
    except ET.ParseError:
        return {}
    root = tree.getroot()
    images: dict[str, str] = {}
    for image in root.findall(".//c:library_images/c:image", NS):
        init = image.find("c:init_from", NS)
        if init is not None and init.text:
            images[image.get("id")] = base_stem(init.text)

    effects: dict[str, str] = {}
    for effect in root.findall(".//c:library_effects/c:effect", NS):
        # Build sampler/surface -> image chains for this effect.
        surfaces: dict[str, str] = {}
        samplers: dict[str, str] = {}
        for param in effect.findall(".//c:profile_COMMON/c:newparam", NS):
            sid = param.get("sid")
            surface = param.find("c:surface", NS)
            if surface is not None:
                init = surface.find("c:init_from", NS)
                if init is not None and init.text:
                    surfaces[sid] = init.text
            sampler = param.find("c:sampler2D", NS)
            if sampler is not None:
                source = sampler.find("c:source", NS)
                if source is not None and source.text:
                    samplers[sid] = source.text

        diffuse_image = ""
        diffuse = effect.find(".//c:profile_COMMON//c:diffuse", NS)
        if diffuse is not None:
            texture = diffuse.find("c:texture", NS)
            if texture is not None:
                tex_sid = texture.get("texture")
                surface_sid = samplers.get(tex_sid, tex_sid)
                image_id = surfaces.get(surface_sid, surface_sid)
                diffuse_image = images.get(image_id, base_stem(image_id))
        if diffuse_image:
            effects[effect.get("id")] = diffuse_image

    mapping: dict[str, str] = {}
    for material in root.findall(".//c:library_materials/c:material", NS):
        inst = material.find("c:instance_effect", NS)
        if inst is None:
            continue
        url = (inst.get("url") or "").lstrip("#")
        if effects.get(url):
            mapping[material.get("id")] = effects[url]
    return mapping


def build_texture_index(folder: Path) -> list[Path]:
    files = []
    for path in folder.rglob("*"):
        if path.is_file() and path.suffix.lower() in TEXTURE_EXTENSIONS:
            stem = path.stem.lower()
            if any(tag in stem for tag in ("imposter", "_nrm", "_spec", "_disp")):
                continue
            files.append(path)
    return files


def resolve_texture(folder_files: list[Path], requested: str | None) -> Path | None:
    stem = base_stem(requested)
    if not stem:
        return None
    exact = [p for p in folder_files if p.stem.lower() == stem]
    if exact:
        return exact[0]
    # T3D often omits the extension or points at an old art/ path.
    starts = [p for p in folder_files if p.stem.lower().startswith(stem)]
    if starts:
        return starts[0]
    contains = [p for p in folder_files if stem in p.stem.lower()]
    if contains:
        return contains[0]
    return None


texture_cache: dict[tuple[str, str], Image.Image] = {}


def load_texture(path: Path, alpha: bool) -> Image.Image:
    key = (str(path), "rgba" if alpha else "rgb")
    if key in texture_cache:
        return texture_cache[key]
    image = Image.open(path)
    image.load()
    image = image.convert("RGBA" if alpha else "RGB")
    if max(image.size) > MAX_TEXTURE:
        scale = MAX_TEXTURE / max(image.size)
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    texture_cache[key] = image
    return image


def image_has_alpha(path: Path) -> bool:
    try:
        image = Image.open(path)
        if image.mode not in ("RGBA", "LA", "P"):
            return False
        alpha = image.convert("RGBA").getchannel("A")
        return alpha.getextrema()[0] < 248
    except Exception:
        return False


def parse_color(value: str | None) -> list[int] | None:
    if not value:
        return None
    parts = [p for p in re.split(r"[\s,]+", value.strip()) if p]
    if len(parts) < 3:
        return None
    try:
        rgb = [max(0, min(255, round(float(parts[i]) * 255))) for i in range(3)]
        return [*rgb, 255]
    except ValueError:
        return None


def model_total_faces(bound_geometry) -> int:
    faces = 0
    for primitive in bound_geometry.primitives():
        try:
            faces += int(np.asarray(primitive.vertex_index).shape[0])
        except Exception:
            pass
    return faces


def primitive_arrays(primitive) -> tuple[np.ndarray, np.ndarray]:
    positions = np.asarray(primitive.vertex, dtype=np.float64)
    vertex_index = np.asarray(primitive.vertex_index, dtype=np.int64)
    if vertex_index.ndim != 2 or vertex_index.shape[1] != 3:
        return np.empty((0, 3)), np.empty((0, 2))
    corners = positions[vertex_index.reshape(-1)]
    uv = np.zeros((len(corners), 2), dtype=np.float64)
    try:
        texcoords = np.asarray(primitive.texcoordset[0], dtype=np.float64)
        texindex = np.asarray(primitive.texcoord_indexset[0], dtype=np.int64)
        if texindex.ndim == 2 and texindex.shape[1] == 3:
            uv = texcoords[texindex.reshape(-1)]
    except Exception:
        pass
    return corners, uv


def convert_asset(key: str, rel_folder: str, dae_name: str, target_height: float, source: Path, output: Path) -> dict:
    import collada

    folder = source / "Tropical Rain Forest_Source v2.0" / "game" / "art" / "shapes" / rel_folder
    dae = folder / dae_name
    if not dae.exists():
        raise FileNotFoundError(dae)

    t3d = parse_cs_materials(folder)
    dae_images = parse_dae_effects(dae)
    texture_files = build_texture_index(folder)
    doc = collada.Collada(str(dae))

    # Group scene geometry instances by original id; pick the highest detail LOD.
    groups: dict[str, list] = {}
    for bound in doc.scene.objects("geometry"):
        original = bound.original
        gid = original.id
        if re.search(r"collision|colbox|imposter|shadow", gid, re.I):
            continue
        groups.setdefault(gid, []).append(bound)
    if not groups:
        raise RuntimeError(f"{key}: no non-collision geometry")
    best_id = max(groups, key=lambda gid: sum(model_total_faces(b) for b in groups[gid]))
    chosen = groups[best_id]

    unit_meter = 0.0254
    up_axis = (doc.assetInfo.upaxis if doc.assetInfo else "Z_UP") or "Z_UP"
    try:
        unit_meter = float(doc.assetInfo.unitmeter)
    except Exception:
        pass

    # material key -> accumulator
    buckets: dict[str, dict] = {}
    tri_total = 0
    for bound in chosen:
        matrix = np.asarray(bound.matrix, dtype=np.float64)
        for primitive in bound.primitives():
            positions, uv = primitive_arrays(primitive)
            if not len(positions):
                continue
            positions = (positions @ matrix[:3, :3].T) + matrix[:3, 3]

            material = getattr(primitive, "material", None)
            mat_id = getattr(material, "id", None) or getattr(material, "name", None) or "default-material"
            symbol = re.sub(r"-material$", "", mat_id, flags=re.I)
            symbol = re.sub(r"_\d+$", "", symbol)
            clean = norm(symbol)
            t3d_entry = t3d.get(clean)
            if not t3d_entry:
                # material names sometimes retain the whole effect name
                for map_to, entry in t3d.items():
                    if clean.endswith(map_to) or map_to.endswith(clean):
                        t3d_entry = entry
                        break
            t3d_entry = t3d_entry or {}
            requested = t3d_entry.get("diffuseMap") or dae_images.get(mat_id) or ""
            texture_path = resolve_texture(texture_files, requested)
            alpha = bool(t3d_entry.get("alphaTest")) or (texture_path is not None and image_has_alpha(texture_path))
            bucket_key = f"{mat_id}|{texture_path.name if texture_path else 'flat'}|{int(alpha)}"
            bucket = buckets.setdefault(bucket_key, {
                "mat_id": mat_id,
                "symbol": symbol,
                "texture": texture_path,
                "alpha": alpha,
                "double": bool(t3d_entry.get("doubleSided")) or alpha,
                "color": parse_color(t3d_entry.get("diffuseColor")) or [235, 232, 218, 255],
                "positions": [],
                "uvs": [],
            })
            bucket["positions"].append(positions)
            bucket["uvs"].append(uv)
            tri_total += len(positions) // 3

    # Apply unit + Z-up conversion, then center horizontally and rest at y=0.
    def up_transform(points: np.ndarray) -> np.ndarray:
        points = points * unit_meter
        if up_axis.upper().startswith("Z"):
            return np.column_stack((points[:, 0], points[:, 2], -points[:, 1]))
        if up_axis.upper().startswith("X"):
            return np.column_stack((points[:, 1], points[:, 0], -points[:, 2]))
        return points

    transformed = []
    for bucket in buckets.values():
        if not bucket["positions"]:
            continue
        points = up_transform(np.concatenate(bucket["positions"], axis=0))
        bucket["positions"] = [points]
        transformed.append(points)
    if not transformed:
        raise RuntimeError(f"{key}: no vertices after conversion")
    all_points = np.concatenate(transformed, axis=0)
    lo = all_points.min(axis=0)
    hi = all_points.max(axis=0)
    center_x = (lo[0] + hi[0]) / 2
    center_z = (lo[2] + hi[2]) / 2
    # The source has wildly inconsistent node scales (inches, centimetres,
    # third-party Max rigs). Normalise every hero asset to an intentional
    # in-game height so placements remain predictable.
    raw_height = max(1e-6, float(hi[1] - lo[1]))
    normalise = target_height / raw_height
    all_points = all_points * normalise
    offset = np.array([center_x * normalise, lo[1] * normalise, center_z * normalise], dtype=np.float64)
    for bucket in buckets.values():
        bucket["positions"] = [points * normalise for points in bucket["positions"]]

    scene = trimesh.Scene()
    material_report = []
    for index, bucket in enumerate(buckets.values()):
        positions = bucket["positions"][0] - offset
        uvs = np.concatenate(bucket["uvs"], axis=0)
        if not len(positions):
            continue
        vertices = positions.astype(np.float32)
        faces = np.arange(len(vertices), dtype=np.int64).reshape(-1, 3)
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        base_color = [c / 255.0 for c in bucket["color"][:3]] + [1.0]
        material = PBRMaterial(
            name=bucket["mat_id"],
            baseColorFactor=base_color,
            metallicFactor=0.0,
            roughnessFactor=0.82,
            doubleSided=bucket["double"],
            alphaMode="MASK" if bucket["alpha"] else "OPAQUE",
            alphaCutoff=0.35,
        )
        if bucket["texture"] is not None:
            material.baseColorTexture = load_texture(bucket["texture"], bucket["alpha"])
        mesh.visual = TextureVisuals(uv=uvs.astype(np.float32), material=material)
        scene.add_geometry(mesh, geom_name=f"{key}-{index}", node_name=f"{key}-{index}")
        material_report.append({
            "material": bucket["mat_id"],
            "texture": bucket["texture"].name if bucket["texture"] else None,
            "alpha": bucket["alpha"],
            "doubleSided": bucket["double"],
            "triangles": len(faces),
        })

    target = output / f"{key}.glb"
    target.parent.mkdir(parents=True, exist_ok=True)
    scene.export(target, file_type="glb")
    # Bounds from the final scene after centering.
    final_lo = all_points.min(axis=0) - offset
    final_hi = all_points.max(axis=0) - offset
    size = final_hi - final_lo
    return {
        "key": key,
        "file": target.name,
        "targetHeight": target_height,
        "triangles": tri_total,
        "materials": material_report,
        "bounds": {
            "min": [round(float(v), 4) for v in final_lo],
            "max": [round(float(v), 4) for v in final_hi],
            "size": [round(float(v), 4) for v in size],
        },
        "bytes": target.stat().st_size,
    }


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT
    if not (source / "Tropical Rain Forest_Source v2.0").exists():
        print(f"Source kit not found: {source}")
        return 2
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for key, (folder, dae, target_height) in ASSETS.items():
        print(f"Converting {key}…", flush=True)
        try:
            report = convert_asset(key, folder, dae, target_height, source, output)
            results.append(report)
            print(
                f"  ok: {report['triangles']} tris, "
                f"{len(report['materials'])} materials, "
                f"{report['bytes'] / 1024 / 1024:.2f} MB, "
                f"size={report['bounds']['size']}",
                flush=True,
            )
        except Exception as error:
            print(f"  FAILED: {error}", flush=True)
            import traceback
            traceback.print_exc()

    manifest = {
        "source": "Tropical Rain Forest Environment Pack v2.0 (3TD Studios, Ronald C. Kapaun)",
        "unit": "metres",
        "upAxis": "Y",
        "textureMax": MAX_TEXTURE,
        "assets": {r["key"]: r for r in results},
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {len(results)} assets to {output}")
    return 0 if len(results) == len(ASSETS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
