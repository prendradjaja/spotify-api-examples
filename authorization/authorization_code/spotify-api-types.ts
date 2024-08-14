import { z } from 'zod';


// ITEMS ---------------------------------------------------------------------

export const SimplifiedPlaylistObject = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.object({
    id: z.string(),
    display_name: z.string(),
  }),
  tracks: z.object({
    href: z.string(),
    total: z.number().int(),
  }),
  uri: z.string(),
});
export type SimplifiedPlaylistObject = z.infer<typeof SimplifiedPlaylistObject>;

export const SimplifiedArtistObject = z.object({
  id: z.string().nullable(), // I think if a artist ID is null that means the artist is unavailable (maybe deleted or region-locked)
  name: z.string(),
});
export type SimplifiedArtistObject = z.infer<typeof SimplifiedArtistObject>;

export const TrackObject = z.object({
  type: z.literal('track'),
  artists: z.array(SimplifiedArtistObject),
  id: z.string().nullable(), // I think if a track ID is null that means the track or artist is unavailable (maybe deleted or region-locked)
  name: z.string(),
});
export type TrackObject = z.infer<typeof TrackObject>;

export const EpisodeObject = z.object({
  type: z.literal('episode'),
});
export type EpisodeObject = z.infer<typeof EpisodeObject>;

export const PlaylistTrackObject = z.object({
  track: z.discriminatedUnion('type', [
    TrackObject,
    EpisodeObject,
  ]),
});
export type PlaylistTrackObject = z.infer<typeof PlaylistTrackObject>;

// ERROR RESPONSE ------------------------------------------------------------

export const ErrorResponse = z.object({
  status: z.number().int(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

// ENDPOINTS -----------------------------------------------------------------

// GET /me/playlists
export const CurrentUserPlaylistsResponse = z.object({
  next: z.string().nullable(),
  total: z.number().int(),
  items: z.array(SimplifiedPlaylistObject),
});
export type CurrentUserPlaylistsResponse = z.infer<typeof CurrentUserPlaylistsResponse>;

// GET /playlists/{playlist_id}/tracks
export const PlaylistItemsResponse = z.object({
  next: z.string().nullable(),
  total: z.number().int(),
  items: z.array(PlaylistTrackObject),
});
export type PlaylistItemsResponse = z.infer<typeof PlaylistItemsResponse>;
