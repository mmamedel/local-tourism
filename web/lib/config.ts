export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  cognito: {
    region: process.env.NEXT_PUBLIC_COGNITO_REGION ?? "",
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
  },
  imagesBaseUrl: process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "",
};

export type Package = {
  id: string;
  slug: string;
  title: string;
  headline: string;
  description: string;
  priceBRL: number;
  durationDays: number;
  location: string;
  heroImageKey?: string;
  galleryKeys?: string[];
  published: boolean;
  updatedAt: string;
};
