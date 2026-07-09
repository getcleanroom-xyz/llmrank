export async function encryptAES(plaintext: string, keyBase64: string, nonce: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  const iv = new TextEncoder().encode(nonce);

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 12; i++) nonce += chars[Math.floor(Math.random() * chars.length)];
  return nonce;
}
