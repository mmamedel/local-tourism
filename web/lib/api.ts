import { config, type Package } from "./config";

export async function listPackages(): Promise<Package[]> {
  const res = await fetch(`${config.apiUrl}/packages`, { cache: "no-store" });
  if (!res.ok) throw new Error(`listPackages failed: ${res.status}`);
  return res.json();
}

export async function getPackage(slug: string): Promise<Package | null> {
  const res = await fetch(`${config.apiUrl}/packages/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPackage failed: ${res.status}`);
  return res.json();
}

export async function savePackage(token: string, pkg: Package): Promise<Package> {
  const res = await fetch(`${config.apiUrl}/packages/${pkg.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(pkg),
  });
  if (!res.ok) throw new Error(`savePackage failed: ${res.status}`);
  return res.json();
}

export async function createPackage(token: string, pkg: Omit<Package, "id" | "updatedAt">): Promise<Package> {
  const res = await fetch(`${config.apiUrl}/packages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(pkg),
  });
  if (!res.ok) throw new Error(`createPackage failed: ${res.status}`);
  return res.json();
}

export async function deletePackage(token: string, id: string): Promise<void> {
  const res = await fetch(`${config.apiUrl}/packages/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`deletePackage failed: ${res.status}`);
}

export async function requestUploadUrl(
  token: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string }> {
  const res = await fetch(`${config.apiUrl}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ contentType }),
  });
  if (!res.ok) throw new Error(`requestUploadUrl failed: ${res.status}`);
  return res.json();
}

export function imageUrl(key?: string): string {
  if (!key) return "";
  return `${config.imagesBaseUrl}/${key}`;
}
