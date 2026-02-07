import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Redirect to the main incidents page for creating a new incident
export const load: PageServerLoad = async () => {
	throw redirect(302, '/incidents');
};
