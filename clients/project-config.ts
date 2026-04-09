/**
 * Project-level pi-lens configuration.
 *
 * Reads `.pi-lens.json` from the project root to allow per-project
 * tool configuration without CLI flags.
 *
 * Example `.pi-lens.json`:
 * ```json
 * {
 *   "disable": ["biome", "madge", "ruff"],
 *   "enable": ["eslint-core"]
 * }
 * ```
 *
 * Disable values map to `--no-<name>` flags.
 * Enable values map to `--lens-<name>` flags.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectConfig {
	/** Tools to disable (maps to --no-<name> flags) */
	disable?: string[];
	/** Features to enable (maps to --lens-<name> flags) */
	enable?: string[];
}

const CONFIG_FILENAMES = [".pi-lens.json", ".pi-lens/config.json"];

let _cachedConfig: ProjectConfig | null = null;
let _cachedConfigRoot: string | null = null;

/**
 * Load project config from `.pi-lens.json` or `.pi-lens/config.json`.
 * Caches result per project root.
 */
export function loadProjectConfig(projectRoot: string): ProjectConfig {
	if (_cachedConfigRoot === projectRoot && _cachedConfig !== null) {
		return _cachedConfig;
	}

	_cachedConfigRoot = projectRoot;
	_cachedConfig = {};

	for (const filename of CONFIG_FILENAMES) {
		const configPath = path.join(projectRoot, filename);
		try {
			const raw = fs.readFileSync(configPath, "utf-8");
			_cachedConfig = JSON.parse(raw) as ProjectConfig;
			return _cachedConfig;
		} catch {
			// File not found or invalid JSON — try next
		}
	}

	return _cachedConfig;
}

/**
 * Reset cached config (call on session_start).
 */
export function resetProjectConfig(): void {
	_cachedConfig = null;
	_cachedConfigRoot = null;
}

/**
 * Check if a tool is disabled via project config.
 *
 * Maps `disable: ["biome"]` → flag `no-biome` returns true.
 * Maps `enable: ["eslint-core"]` → flag `lens-eslint-core` returns true.
 */
export function getProjectConfigFlag(flagName: string): boolean | undefined {
	if (!_cachedConfig) return undefined;

	// --no-<tool> flags
	if (flagName.startsWith("no-") && _cachedConfig.disable) {
		const tool = flagName.slice(3); // "no-biome" → "biome"
		if (_cachedConfig.disable.includes(tool)) return true;
	}

	// --lens-<feature> flags
	if (flagName.startsWith("lens-") && _cachedConfig.enable) {
		const feature = flagName.slice(5); // "lens-eslint-core" → "eslint-core"
		if (_cachedConfig.enable.includes(feature)) return true;
	}

	// Direct name match in disable (e.g., "no-lsp" in disable list)
	if (_cachedConfig.disable?.includes(flagName)) return true;

	// Direct name match in enable
	if (_cachedConfig.enable?.includes(flagName)) return true;

	return undefined;
}

/**
 * Create a flag resolver that merges CLI flags with project config.
 * Project config acts as defaults — CLI flags always win.
 */
export function createFlagResolver(
	getCliFlag: (name: string) => boolean | string | undefined,
): (name: string) => boolean | string | undefined {
	return (name: string) => {
		const cliValue = getCliFlag(name);
		if (cliValue !== undefined && cliValue !== false) return cliValue;
		return getProjectConfigFlag(name) ?? cliValue;
	};
}
