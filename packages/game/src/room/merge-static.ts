import {
	Mesh,
	MeshStandardMaterial,
	type BufferGeometry,
	type Material,
	type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Marks an object (and everything under it) as moving: it is never merged. */
export function keepSeparate(object: Object3D): void {
	object.userData.dynamic = true;
}

/**
 * Materials that look the same are the same: many parts create their own
 * copy of e.g. black plastic, which would otherwise keep them apart.
 */
function signature(material: Material): string {
	if (!(material instanceof MeshStandardMaterial)) return material.uuid;
	const m = material;
	return [
		m.type,
		m.color.getHexString(),
		m.roughness,
		m.metalness,
		m.emissive.getHexString(),
		m.emissiveIntensity,
		m.map?.uuid,
		m.emissiveMap?.uuid,
		m.envMap?.uuid,
		m.envMapIntensity,
		m.transparent,
		m.opacity,
		m.side,
	].join('|');
}

function isDynamic(object: Object3D | null): boolean {
	for (let o = object; o; o = o.parent) if (o.userData.dynamic) return true;
	return false;
}

/**
 * Detailed furniture is hundreds of small parts; drawing each separately
 * costs a draw call (two with shadows) per part. Static parts that share a
 * material are baked into one mesh here - same pixels, a fraction of the
 * calls. Parts marked with `keepSeparate` (doors, the swivel chair, the
 * duvet) stay as they are. Returns how many meshes were merged away.
 */
export function mergeStatic(root: Object3D): number {
	root.updateMatrixWorld(true);
	const groups = new Map<string, { material: Material; meshes: Mesh[] }>();
	root.traverse((object) => {
		if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
		if (isDynamic(object)) return;
		const key = `${signature(object.material)}:${object.castShadow ? 1 : 0}${object.receiveShadow ? 1 : 0}`;
		const entry = groups.get(key) ?? {
			material: object.material as Material,
			meshes: [] as Mesh[],
		};
		entry.meshes.push(object);
		groups.set(key, entry);
	});

	const inverseRoot = root.matrixWorld.clone().invert();
	let removed = 0;
	for (const { material, meshes } of groups.values()) {
		if (meshes.length < 2) continue;
		const geometries: BufferGeometry[] = [];
		for (const mesh of meshes) {
			let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
			// Only what every part has (some have extra attributes, e.g. tangents).
			for (const name of Object.keys(geometry.attributes)) {
				if (name !== 'position' && name !== 'normal' && name !== 'uv')
					geometry.deleteAttribute(name);
			}
			geometry = geometry.applyMatrix4(mesh.matrixWorld.clone().premultiply(inverseRoot));
			geometries.push(geometry);
		}
		if (!geometries.every((g) => g.getAttribute('uv') && g.getAttribute('normal'))) continue;
		const merged = mergeGeometries(geometries, false);
		for (const g of geometries) g.dispose();
		if (!merged) continue;
		const mesh = new Mesh(merged, material);
		mesh.castShadow = meshes[0]?.castShadow ?? true;
		mesh.receiveShadow = meshes[0]?.receiveShadow ?? true;
		for (const part of meshes) {
			part.removeFromParent();
			part.geometry.dispose();
		}
		root.add(mesh);
		removed += meshes.length - 1;
	}
	return removed;
}
