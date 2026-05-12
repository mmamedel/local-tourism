"use client";

import { config } from "./config";

// Minimal Cognito USER_PASSWORD_AUTH client — no SDK dependency.
// The Cognito User Pool client must have ALLOW_USER_PASSWORD_AUTH enabled.

const STORAGE_KEY = "lt.tokens";

export type Tokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const endpoint = () => `https://cognito-idp.${config.cognito.region}.amazonaws.com/`;

async function cognitoCall<T>(target: string, body: unknown): Promise<T> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${target} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function signIn(username: string, password: string): Promise<Tokens> {
  type AuthResult = {
    AuthenticationResult?: {
      IdToken: string;
      AccessToken: string;
      RefreshToken: string;
      ExpiresIn: number;
    };
    ChallengeName?: string;
    Session?: string;
  };

  const result = await cognitoCall<AuthResult>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.cognito.clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });

  if (result.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    throw new Error("NEW_PASSWORD_REQUIRED");
  }

  const auth = result.AuthenticationResult;
  if (!auth) throw new Error("No AuthenticationResult");

  const tokens: Tokens = {
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    refreshToken: auth.RefreshToken,
    expiresAt: Date.now() + auth.ExpiresIn * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

export function saveTokens(t: Tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export function loadTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function signOut() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isValid(t: Tokens | null): t is Tokens {
  return !!t && t.expiresAt > Date.now() + 30_000;
}
