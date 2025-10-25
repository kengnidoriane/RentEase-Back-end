export interface Favorite {
  id: string;
  createdAt: Date;
  userId: string;
  propertyId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  property?: {
    id: string;
    title: string;
    price: number;
    currency: string;
    propertyType: string;
    city: string;
    isActive: boolean;
    images: Array<{
      id: string;
      url: string;
      altText: string;
      order: number;
    }>;
  };
}

export interface CreateFavoriteRequest {
  propertyId: string;
}

export interface FavoriteResponse {
  id: string;
  createdAt: Date;
  propertyId: string;
  property: {
    id: string;
    title: string;
    price: number;
    currency: string;
    propertyType: string;
    city: string;
    isActive: boolean;
    images: Array<{
      id: string;
      url: string;
      altText: string;
      order: number;
    }>;
  };
}

export interface FavoritesListResponse {
  favorites: FavoriteResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FavoriteStatusResponse {
  isFavorited: boolean;
  favoriteId?: string;
}