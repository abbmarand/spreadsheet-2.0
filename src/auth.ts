import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import { AUTH_TRUST_HOST } from '$env/static/private';
import { accounts, sessions, users, verificationTokens } from '$lib/server/db/schema';
import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';

const scopes = [
	'openid',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.readonly',
	'https://www.googleapis.com/auth/gmail.readonly'
].join(' ')

export const { handle, signIn, signOut } = SvelteKitAuth({
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens
	}),
	providers: [
		Google({
			authorization: {
				params: {
					scope: scopes,
					access_type: 'offline',
					prompt: 'consent'
				}
			}
		})
	],

	callbacks: {
		async signIn({ account }) {
			// quick live test of the brand-new token
			if (!account) {
				return false;
			}
			console.log('account', account);

			// Only attempt Gmail and Calendar validation if we have a Google account with access token
			if (account.provider === 'google' && account.access_token) {
				try {
					const auth = new google.auth.OAuth2();
					auth.setCredentials({ access_token: account.access_token });

					await db
						.update(accounts)
						.set({
							access_token: account.access_token,
							refresh_token: account.refresh_token,
							expires_at: account.expires_at
						})
						.where(eq(accounts.providerAccountId, account.providerAccountId));
					// Note: Gmail API needs to be enabled in Google Cloud Console
					// If this fails with a 403 SERVICE_DISABLED error, visit:
					// https://console.developers.google.com/apis/api/gmail.googleapis.com/overview
					const mails = await google
						.gmail({ version: 'v1', auth })
						.users.getProfile({ userId: 'me' });
					console.log('Google account is valid with Gmail access');
					console.log('mails', mails);
					// Also validate Calendar access
					// Calendar API also needs to be enabled in Google Cloud Console
					// https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview
					const calendar = await google.calendar({ version: 'v3', auth }).calendarList.list();
					console.log('Google account is valid with Calendar access');
					console.log('calendar', calendar);
				} catch (error) {
					console.error('Google API validation failed:', error);
					// Continue sign-in even if API validation fails
					// The user may not have enabled Gmail or Calendar API yet
				}
			}

			return true; // let sign-in continue
		}
	},
	trustHost: AUTH_TRUST_HOST === 'true'
});
