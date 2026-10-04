import { SetMetadata } from '@nestjs/common';

export const PUBLIC_BROWSER_SESSION_KEY = 'publicBrowserSession';

/** Explicitly exempts a target resolver from default browser-session authentication. */
export const PublicBrowserSession = () => SetMetadata(PUBLIC_BROWSER_SESSION_KEY, true);
