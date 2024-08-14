import { z, ZodRawShape, ZodObject } from 'zod';


function zObjectPassthrough<T extends ZodRawShape>(shape: T): ZodObject<T> {
  return z.object(shape).passthrough();
}


// ITEMS ---------------------------------------------------------------------

export const SimplifiedPlaylistObject = zObjectPassthrough({
  id: z.string(),
  name: z.string(),
  owner: zObjectPassthrough({
    id: z.string(),
    display_name: z.string(),
  }),
  tracks: zObjectPassthrough({
    href: z.string(),
    total: z.number().int(),
  }),
  uri: z.string(),
});
export type SimplifiedPlaylistObject = z.infer<typeof SimplifiedPlaylistObject>;

export const SimplifiedArtistObject = zObjectPassthrough({
  id: z.string().nullable(), // I think if a artist ID is null that means the artist is unavailable (maybe deleted or region-locked)
  name: z.string(),
});
export type SimplifiedArtistObject = z.infer<typeof SimplifiedArtistObject>;

export const TrackObject = zObjectPassthrough({
  type: z.literal('track'),
  artists: z.array(SimplifiedArtistObject),
  id: z.string().nullable(), // I think if a track ID is null that means the track or artist is unavailable (maybe deleted or region-locked)
  name: z.string(),
});
export type TrackObject = z.infer<typeof TrackObject>;

export const EpisodeObject = zObjectPassthrough({
  type: z.literal('episode'),
});
export type EpisodeObject = z.infer<typeof EpisodeObject>;

export const PlaylistTrackObject = zObjectPassthrough({
  track: z.discriminatedUnion('type', [
    TrackObject,
    EpisodeObject,
  ]),
});
export type PlaylistTrackObject = z.infer<typeof PlaylistTrackObject>;


// ERROR RESPONSE ------------------------------------------------------------

export const ErrorResponse = zObjectPassthrough({
  status: z.number().int(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;


// ENDPOINTS -----------------------------------------------------------------

// GET /me/playlists
export const CurrentUserPlaylistsResponse = zObjectPassthrough({
  next: z.string().nullable(),
  total: z.number().int(),
  items: z.array(SimplifiedPlaylistObject),
});
export type CurrentUserPlaylistsResponse = z.infer<typeof CurrentUserPlaylistsResponse>;

// GET /playlists/{playlist_id}/tracks
export const PlaylistItemsResponse = zObjectPassthrough({
  next: z.string().nullable(),
  total: z.number().int(),
  items: z.array(PlaylistTrackObject),
});
export type PlaylistItemsResponse = z.infer<typeof PlaylistItemsResponse>;
