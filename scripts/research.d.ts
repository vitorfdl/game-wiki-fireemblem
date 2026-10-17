export const SITE: string;
export const LIBRARY: string;
export const RESEARCH: string;
export function hasLibrary(): boolean;
export function researchFiles(): string[];
export function isResearchFile(f: string): boolean;
export function syncResearch(only?: string[]): string[];
